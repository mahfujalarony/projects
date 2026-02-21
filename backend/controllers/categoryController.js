const { Op } = require("sequelize");
const Category = require("../models/Category");
const SubCategory = require("../models/SubCategory");

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

    return res.status(201).json(created);
  } catch (err) {
    console.error("createCategory error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getCategories = async (req, res) => {
  try {
    const { q = "", active = "" } = req.query;

    const where = {};
    if (q) where.name = { [Op.like]: `%${q}%` };
    if (active === "true") where.isActive = true;
    if (active === "false") where.isActive = false;

    const rows = await Category.findAll({
      where,
      order: [["createdAt", "DESC"]],
      include: [{ model: SubCategory, as: "subCategories", required: false }],
    });

    return res.json(rows);
  } catch (err) {
    console.error("getCategories error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, imageUrl, isActive } = req.body;

    const cat = await Category.findByPk(id);
    if (!cat) return res.status(404).json({ message: "Category not found" });

    if (typeof name === "string" && name.trim() && name.trim() !== cat.name) {
      const baseSlug = slugify(name);
      const slug = await makeUniqueSlug(baseSlug, id);
      cat.name = name.trim();
      cat.slug = slug;
    }

    if (typeof imageUrl !== "undefined") cat.imageUrl = imageUrl || null;
    if (typeof isActive === "boolean") cat.isActive = isActive;

    await cat.save();
    return res.json(cat);
  } catch (err) {
    console.error("updateCategory error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    const id = Number(req.params.id);

    const cat = await Category.findByPk(id);
    if (!cat) return res.status(404).json({ message: "Category not found" });

    await cat.destroy();
    return res.json({ message: "Category deleted" });
  } catch (err) {
    console.error("deleteCategory error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
