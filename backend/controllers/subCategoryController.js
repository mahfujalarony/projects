const { Op } = require("sequelize");
const Category = require("../models/Category");
const SubCategory = require("../models/SubCategory");
const { deleteUploadFileIfSafe } = require("../utils/uploadFileCleanup");
const { appendAdminHistory } = require("../utils/adminHistory");

const slugify = (s = "") =>
  s
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

async function makeUniqueSlug(baseSlug, categoryId, excludeId = null) {
  let slug = baseSlug;
  let n = 1;

  while (true) {
    const where = excludeId
      ? { categoryId, slug, id: { [Op.ne]: excludeId } }
      : { categoryId, slug };

    const exists = await SubCategory.findOne({ where });
    if (!exists) return slug;

    slug = `${baseSlug}-${n++}`;
  }
}

const toTree = (rows = []) => {
  const plain = rows.map((r) => (typeof r?.toJSON === "function" ? r.toJSON() : r));
  const byId = new Map();
  const roots = [];

  for (const row of plain) byId.set(Number(row.id), { ...row, children: [] });

  for (const row of plain) {
    const node = byId.get(Number(row.id));
    const pid = Number(row.parentSubCategoryId || 0);
    if (pid && byId.has(pid)) byId.get(pid).children.push(node);
    else roots.push(node);
  }

  return roots;
};

async function getDescendantIds(startId) {
  const ids = [];
  const q = [Number(startId)];
  while (q.length) {
    const current = q.shift();
    const children = await SubCategory.findAll({
      where: { parentSubCategoryId: current },
      attributes: ["id"],
      raw: true,
    });
    for (const child of children) {
      const cid = Number(child.id);
      ids.push(cid);
      q.push(cid);
    }
  }
  return ids;
}

exports.createSubCategory = async (req, res) => {
  try {
    let { categoryId, parentSubCategoryId, name, imageUrl, isActive } = req.body;

    if (!name || !name.trim()) return res.status(400).json({ message: "Subcategory name is required" });

    const parentId = parentSubCategoryId ? Number(parentSubCategoryId) : null;
    const directCategoryId = categoryId ? Number(categoryId) : null;

    if (!parentId && !directCategoryId) {
      return res.status(400).json({ message: "categoryId or parentSubCategoryId is required" });
    }

    let resolvedCategoryId = directCategoryId;

    if (parentId) {
      const parent = await SubCategory.findByPk(parentId);
      if (!parent) return res.status(404).json({ message: "Parent subcategory not found" });
      resolvedCategoryId = Number(parent.categoryId);
    }

    const cat = await Category.findByPk(Number(resolvedCategoryId));
    if (!cat) return res.status(404).json({ message: "Category not found" });

    const baseSlug = slugify(name);
    const slug = await makeUniqueSlug(baseSlug, Number(resolvedCategoryId));

    const created = await SubCategory.create({
      categoryId: Number(resolvedCategoryId),
      parentSubCategoryId: parentId || null,
      name: name.trim(),
      slug,
      imageUrl: imageUrl || null,
      isActive: typeof isActive === "boolean" ? isActive : true,
    });
    const actorId = req.user?.id || req.userId || null;
    await appendAdminHistory(
      `Subcategory created. Subcategory #${created.id} (${created.name}) under category #${created.categoryId} by admin #${actorId || "unknown"}.`,
      {
        meta: {
          type: "subcategory_created",
          actorId,
          subCategoryId: created.id,
          categoryId: created.categoryId,
          parentSubCategoryId: created.parentSubCategoryId || null,
          name: created.name,
          slug: created.slug,
          isActive: created.isActive,
        },
      }
    );

    return res.status(201).json(created);
  } catch (err) {

    return res.status(500).json({ message: "Server error" });
  }
};

exports.getSubCategories = async (req, res) => {
  try {
    const { categoryId = "", q = "", active = "", parentSubCategoryId = "", tree = "false" } = req.query;

    const where = {};
    if (categoryId) where.categoryId = Number(categoryId);
    if (parentSubCategoryId) where.parentSubCategoryId = Number(parentSubCategoryId);
    if (q) where.name = { [Op.like]: `%${q}%` };
    if (active === "true") where.isActive = true;
    if (active === "false") where.isActive = false;

    const rows = await SubCategory.findAll({
      where,
      order: [["createdAt", "DESC"]],
    });

    if (String(tree).toLowerCase() === "true") {
      return res.json(toTree(rows));
    }

    return res.json(rows);
  } catch (err) {

    return res.status(500).json({ message: "Server error" });
  }
};

exports.updateSubCategory = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, imageUrl, isActive, parentSubCategoryId } = req.body;

    const sub = await SubCategory.findByPk(id);
    if (!sub) return res.status(404).json({ message: "Subcategory not found" });
    const actorId = req.user?.id || req.userId || null;
    const before = {
      name: sub.name,
      slug: sub.slug,
      isActive: sub.isActive,
      parentSubCategoryId: sub.parentSubCategoryId || null,
      imageUrl: sub.imageUrl || null,
    };

    if (typeof parentSubCategoryId !== "undefined") {
      const nextParentId = parentSubCategoryId ? Number(parentSubCategoryId) : null;
      if (nextParentId === id) return res.status(400).json({ message: "Subcategory cannot be its own parent" });

      if (nextParentId) {
        const parent = await SubCategory.findByPk(nextParentId);
        if (!parent) return res.status(404).json({ message: "Parent subcategory not found" });
        if (Number(parent.categoryId) !== Number(sub.categoryId)) {
          return res.status(400).json({ message: "Parent must belong to same category" });
        }

        const descendants = await getDescendantIds(id);
        if (descendants.includes(nextParentId)) {
          return res.status(400).json({ message: "Invalid parent relation (cycle detected)" });
        }
      }

      sub.parentSubCategoryId = nextParentId;
    }

    if (typeof name === "string" && name.trim() && name.trim() !== sub.name) {
      const baseSlug = slugify(name);
      const slug = await makeUniqueSlug(baseSlug, sub.categoryId, id);
      sub.name = name.trim();
      sub.slug = slug;
    }

    if (typeof imageUrl !== "undefined") sub.imageUrl = imageUrl || null;
    if (typeof isActive === "boolean") sub.isActive = isActive;

    await sub.save();
    await appendAdminHistory(
      `Subcategory updated. Subcategory #${sub.id} (${sub.name}) by admin #${actorId || "unknown"}.`,
      {
        meta: {
          type: "subcategory_updated",
          actorId,
          subCategoryId: sub.id,
          categoryId: sub.categoryId,
          before,
          after: {
            name: sub.name,
            slug: sub.slug,
            isActive: sub.isActive,
            parentSubCategoryId: sub.parentSubCategoryId || null,
            imageUrl: sub.imageUrl || null,
          },
        },
      }
    );
    return res.json(sub);
  } catch (err) {

    return res.status(500).json({ message: "Server error" });
  }
};

exports.deleteSubCategory = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const sub = await SubCategory.findByPk(id);
    if (!sub) return res.status(404).json({ message: "Subcategory not found" });
    const actorId = req.user?.id || req.userId || null;
    const snapshot = {
      subCategoryId: sub.id,
      categoryId: sub.categoryId,
      name: sub.name,
      slug: sub.slug,
    };

    const descendants = await getDescendantIds(id);
    const idsToDelete = [id, ...descendants];
    const rows = await SubCategory.findAll({
      where: { id: idsToDelete },
      attributes: ["id", "imageUrl"],
      raw: true,
    });

    await SubCategory.destroy({ where: { id: idsToDelete } });

    for (const row of rows) {
      try {
        await deleteUploadFileIfSafe(row.imageUrl);
      } catch (e) {

      }
    }

    await appendAdminHistory(
      `Subcategory deleted. Subcategory #${snapshot.subCategoryId} (${snapshot.name}) by admin #${actorId || "unknown"}.`,
      {
        meta: {
          type: "subcategory_deleted",
          actorId,
          ...snapshot,
          deletedCount: idsToDelete.length,
        },
      }
    );

    return res.json({ message: "Subcategory deleted", deletedCount: idsToDelete.length });
  } catch (err) {

    return res.status(500).json({ message: "Server error" });
  }
};
