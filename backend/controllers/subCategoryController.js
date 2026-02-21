const { Op } = require("sequelize");
const Category = require("../models/Category");
const SubCategory = require("../models/SubCategory");

const slugify = (s = "") =>
  s.toString().trim().toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-");

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

exports.createSubCategory = async (req, res) => {
  try {
    const { categoryId, name, imageUrl, isActive } = req.body;

    if (!categoryId) return res.status(400).json({ message: "categoryId is required" });
    if (!name || !name.trim()) return res.status(400).json({ message: "Subcategory name is required" });

    const cat = await Category.findByPk(Number(categoryId));
    if (!cat) return res.status(404).json({ message: "Category not found" });

    const baseSlug = slugify(name);
    const slug = await makeUniqueSlug(baseSlug, Number(categoryId));

    const created = await SubCategory.create({
      categoryId: Number(categoryId),
      name: name.trim(),
      slug,
      imageUrl: imageUrl || null,
      isActive: typeof isActive === "boolean" ? isActive : true,
    });

    return res.status(201).json(created);
  } catch (err) {
    console.error("createSubCategory error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getSubCategories = async (req, res) => {
  try {
    const { categoryId = "", q = "", active = "" } = req.query;

    const where = {};
    if (categoryId) where.categoryId = Number(categoryId);
    if (q) where.name = { [Op.like]: `%${q}%` };
    if (active === "true") where.isActive = true;
    if (active === "false") where.isActive = false;

    const rows = await SubCategory.findAll({
      where,
      order: [["createdAt", "DESC"]],
    });

    return res.json(rows);
  } catch (err) {
    console.error("getSubCategories error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.updateSubCategory = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, imageUrl, isActive } = req.body;

    const sub = await SubCategory.findByPk(id);
    if (!sub) return res.status(404).json({ message: "Subcategory not found" });

    if (typeof name === "string" && name.trim() && name.trim() !== sub.name) {
      const baseSlug = slugify(name);
      const slug = await makeUniqueSlug(baseSlug, sub.categoryId, id);
      sub.name = name.trim();
      sub.slug = slug;
    }

    if (typeof imageUrl !== "undefined") sub.imageUrl = imageUrl || null;
    if (typeof isActive === "boolean") sub.isActive = isActive;

    await sub.save();
    return res.json(sub);
  } catch (err) {
    console.error("updateSubCategory error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.deleteSubCategory = async (req, res) => {
  try {
    const id = Number(req.params.id);

    const sub = await SubCategory.findByPk(id);
    if (!sub) return res.status(404).json({ message: "Subcategory not found" });

    await sub.destroy();
    return res.json({ message: "Subcategory deleted" });
  } catch (err) {
    console.error("deleteSubCategory error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
