const { Op } = require("sequelize");
const Category = require("../models/Category");
const SubCategory = require("../models/SubCategory");
const { deleteUploadFileIfSafe } = require("../utils/uploadFileCleanup");
const { appendAdminHistory } = require("../utils/adminHistory");

const slugify = (s = "") =>
  s.toString().trim().toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-");

async function makeUniqueSlug(baseSlug, excludeId = null) {
  let slug = baseSlug;
  let n = 1;

  while (true) {
    const where = excludeId
      ? { slug, id: { [Op.ne]: excludeId } }
      : { slug };

    const exists = await Category.findOne({ where });
    if (!exists) return slug;

    slug = `${baseSlug}-${n++}`;
  }
}

const buildSubCategoryTree = (list = [], parentPath = "") => {
  const byId = new Map(list.map((x) => [Number(x.id), { ...x, children: [] }]));
  const roots = [];

  for (const node of byId.values()) {
    const pid = Number(node.parentSubCategoryId || 0);
    if (pid && byId.has(pid)) byId.get(pid).children.push(node);
    else roots.push(node);
  }

  const decorate = (node, depth = 1, pathPrefix = "") => {
    const currentSlug = String(node.slug || "").trim();
    const nextPath = pathPrefix ? `${pathPrefix}/${currentSlug}` : currentSlug;
    const children = Array.isArray(node.children) ? node.children : [];
    const decoratedChildren = children.map((child) => decorate(child, depth + 1, nextPath));

    return {
      ...node,
      depth,
      path: nextPath,
      urlPath: parentPath ? `/${parentPath}/${nextPath}` : `/${nextPath}`,
      hasChildren: decoratedChildren.length > 0,
      childrenCount: decoratedChildren.length,
      children: decoratedChildren,
    };
  };

  return roots.map((root) => decorate(root, 1, ""));
};

const flattenTree = (nodes = []) => {
  const out = [];
  const walk = (arr) => {
    for (const node of arr) {
      out.push(node);
      if (Array.isArray(node.children) && node.children.length) walk(node.children);
    }
  };
  walk(nodes);
  return out;
};

exports.createCategory = async (req, res) => {
  try {
    const { name, imageUrl, isActive } = req.body;

    if (!name || !name.trim()) return res.status(400).json({ message: "Category name is required" });

    const baseSlug = slugify(name);
    const slug = await makeUniqueSlug(baseSlug);

    const created = await Category.create({
      name: name.trim(),
      slug,
      imageUrl: imageUrl || null,
      isActive: typeof isActive === "boolean" ? isActive : true,
    });
    const actorId = req.user?.id || req.userId || null;
    await appendAdminHistory(
      `Category created. Category #${created.id} (${created.name}) by admin #${actorId || "unknown"}.`,
      {
        meta: {
          type: "category_created",
          actorId,
          categoryId: created.id,
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

exports.getCategories = async (req, res) => {
  try {
    const { q = "", active = "", format = "legacy" } = req.query;

    const where = {};
    if (q) where.name = { [Op.like]: `%${q}%` };
    if (active === "true") where.isActive = true;
    if (active === "false") where.isActive = false;

    const rows = await Category.findAll({
      where,
      order: [["createdAt", "DESC"]],
      raw: true,
    });

    const categoryIds = rows.map((r) => Number(r.id)).filter(Boolean);
    const subs = categoryIds.length
      ? await SubCategory.findAll({
          where: { categoryId: { [Op.in]: categoryIds } },
          order: [["createdAt", "DESC"]],
          raw: true,
        })
      : [];

    const byCategory = new Map();
    for (const s of subs) {
      const cid = Number(s.categoryId);
      if (!byCategory.has(cid)) byCategory.set(cid, []);
      byCategory.get(cid).push({ ...s, children: [] });
    }

    const out = rows.map((cat) => ({
      ...cat,
      depth: 0,
      path: String(cat.slug || ""),
      urlPath: `/${String(cat.slug || "")}`,
      hasChildren: (byCategory.get(Number(cat.id)) || []).length > 0,
      subCategories: buildSubCategoryTree(byCategory.get(Number(cat.id)) || [], String(cat.slug || "")),
    }));

    if (String(format).toLowerCase() === "ecom") {
      const totalSubCategories = out.reduce(
        (acc, cat) => acc + flattenTree(cat.subCategories || []).length,
        0
      );

      return res.json({
        success: true,
        data: {
          categories: out,
          summary: {
            totalCategories: out.length,
            totalSubCategories,
          },
        },
      });
    }

    return res.json(out);
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, imageUrl, isActive } = req.body;

    const cat = await Category.findByPk(id);
    if (!cat) return res.status(404).json({ message: "Category not found" });
    const actorId = req.user?.id || req.userId || null;
    const before = {
      name: cat.name,
      slug: cat.slug,
      isActive: cat.isActive,
      imageUrl: cat.imageUrl || null,
    };

    if (typeof name === "string" && name.trim() && name.trim() !== cat.name) {
      const baseSlug = slugify(name);
      const slug = await makeUniqueSlug(baseSlug, id);
      cat.name = name.trim();
      cat.slug = slug;
    }

    if (typeof imageUrl !== "undefined") cat.imageUrl = imageUrl || null;
    if (typeof isActive === "boolean") cat.isActive = isActive;

    await cat.save();
    await appendAdminHistory(
      `Category updated. Category #${cat.id} (${cat.name}) by admin #${actorId || "unknown"}.`,
      {
        meta: {
          type: "category_updated",
          actorId,
          categoryId: cat.id,
          before,
          after: {
            name: cat.name,
            slug: cat.slug,
            isActive: cat.isActive,
            imageUrl: cat.imageUrl || null,
          },
        },
      }
    );
    return res.json(cat);
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    const id = Number(req.params.id);

    const cat = await Category.findByPk(id, {
      include: [{ model: SubCategory, as: "subCategories", attributes: ["id", "imageUrl"], required: false }],
    });
    if (!cat) return res.status(404).json({ message: "Category not found" });
    const actorId = req.user?.id || req.userId || null;
    const snapshot = {
      categoryId: cat.id,
      name: cat.name,
      slug: cat.slug,
      subCategoryCount: Array.isArray(cat.subCategories) ? cat.subCategories.length : 0,
    };

    const imagePaths = [
      cat.imageUrl,
      cat.icon,
      ...((Array.isArray(cat.subCategories) ? cat.subCategories : []).map((s) => s.imageUrl)),
    ].filter(Boolean);

    await cat.destroy();

    for (const p of imagePaths) {
      try {
        await deleteUploadFileIfSafe(p);
      } catch (e) {

      }
    }

    await appendAdminHistory(
      `Category deleted. Category #${snapshot.categoryId} (${snapshot.name}) by admin #${actorId || "unknown"}.`,
      {
        meta: {
          type: "category_deleted",
          actorId,
          ...snapshot,
        },
      }
    );

    return res.json({ message: "Category deleted" });
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
};
