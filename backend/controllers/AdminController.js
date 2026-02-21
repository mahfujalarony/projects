const Merchant = require("../models/MerchantProfile");
const User = require("../models/Authentication");
const Product = require("../models/Product");
const OrderItem = require("../models/Order");
const Offer = require("../models/Offer");
const BalanceTopupRequest = require("../models/BalanceTopupRequest");
const sequelize = require('../config/db');
const Notification = require("../models/Notification");
const { Op, fn, col, where: W, literal } = require("sequelize");

// const clampInt = (v, d) => {
//   const n = Number(v);
//   return Number.isFinite(n) && n > 0 ? Math.floor(n) : d;
// };

exports.getMerchantRequests = async (req, res) => {
  try {
    // query: ?status=pending&page=1&limit=20&q=rony
    const status = (req.query.status || "pending").trim();
    const page = clampInt(req.query.page, 1);
    const limit = clampInt(req.query.limit, 20);
    const q = (req.query.q || "").trim().toLowerCase();

    const where = {};
    if (status) where.status = status;

    const { count, rows } = await Merchant.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: "user", // association নিচে দেখো
          attributes: ["id", "name", "email", "role", "balance", "imageUrl"],
          required: false,
        },
      ],
      order: [["createdAt", "DESC"]],
      limit,
      offset: (page - 1) * limit,
    });

    // simple client-side search (name/email) if q provided
    const filtered = q
      ? rows.filter((m) => {
          const name = (m.user?.name || "").toLowerCase();
          const email = (m.user?.email || "").toLowerCase();
          return name.includes(q) || email.includes(q);
        })
      : rows;

    return res.json({
      ok: true,
      data: filtered,
      page,
      limit,
      total: q ? filtered.length : count,
      totalPages: q ? 1 : Math.ceil(count / limit),
    });
  } catch (err) {
    console.error("getMerchantRequests error:", err);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
};

exports.approveMerchant = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;

    const merchant = await Merchant.findByPk(id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!merchant) {
      await t.rollback();
      return res.status(404).json({ ok: false, message: "Merchant request not found" });
    }

    if (merchant.status === "approved" && merchant.isApproved) {
      await t.commit();
      return res.json({ ok: true, message: "Already approved", data: merchant });
    }

    merchant.status = "approved";
    merchant.isApproved = true;
    await merchant.save({ transaction: t });

    // optional: user role merchant করে দিতে চাইলে
    const user = await User.findByPk(merchant.userId, { transaction: t, lock: t.LOCK.UPDATE });
    if (user && user.role !== "merchant") {
      user.role = "merchant";
      await user.save({ transaction: t });
    }

      await Notification.create(
        {
          userId: merchant.userId,
          type: "system", 
          title: "Merchant request approved",
          message: "Congratulations! Your merchant request has been approved. You can now start selling.",
          meta: { merchantRequestId: merchant.id, status: "approved", route: "/merchant" },
        },
  { transaction: t }
);


    await t.commit();
    return res.json({ ok: true, message: "Merchant approved", data: merchant });
  } catch (err) {
    console.error("approveMerchant error:", err);
    await t.rollback();
    return res.status(500).json({ ok: false, message: err?.message || "Server error" });
  }
};

exports.rejectMerchant = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;

    const merchant = await Merchant.findByPk(id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!merchant) {
      await t.rollback();
      return res.status(404).json({ ok: false, message: "Merchant request not found" });
    }

    const notifyUserId = merchant.userId;

    // ✅ Notification add (delete হওয়ার আগে)
    await Notification.create(
      {
        userId: notifyUserId,
        type: "system",
        title: "Merchant request rejected",
        message: "Sorry, your merchant request was rejected. Please review your information and try again.",
        meta: { merchantRequestId: merchant.id, status: "rejected", route: "/merchant" },
      },
      { transaction: t }
    );

    // Safe approach: destroy
    await merchant.destroy({ transaction: t });

    await t.commit();
    return res.json({ ok: true, message: "Merchant request rejected & deleted" });
  } catch (err) {
    console.error("rejectMerchant error:", err);
    await t.rollback();
    return res.status(500).json({ ok: false, message: err?.message || "Server error" });
  }
};


const clampInt = (v, d, min = 1, max = 100) => {
  const n = parseInt(v, 10);
  if (!Number.isFinite(n)) return d;
  return Math.min(Math.max(n, min), max);
};

// normalize input like "electronic-computer" => "electronic computer"
const normInput = (s = "") =>
  String(s).trim().toLowerCase().replace(/[-_]+/g, " ").replace(/\s+/g, " ");

// normalize DB field: lower + replace '-' '_' to space
// MySQL replace nested
const normDbExpr = (fieldName) =>
  fn(
    "REPLACE",
    fn("REPLACE", fn("LOWER", col(fieldName)), "-", " "),
    "_",
    " "
  );

  // GET /api/admin/products?category=electronic-computer&subCategory=laptop&page=1&limit=10&search=hp&sortBy=createdAt&order=DESC
exports.getAdminProducts = async (req, res) => {
  try {
    const category = req.query.category || "";
    const subCategory = req.query.subCategory || "";
    const search = req.query.search || "";

    const pageNum = clampInt(req.query.page, 1, 1, 1000000);
    const limitNum = clampInt(req.query.limit, 10, 1, 100);
    const offset = (pageNum - 1) * limitNum;

    // allowlist sorting fields (security)
    const sortByAllow = new Set(["createdAt", "updatedAt", "price", "stock", "name", "id"]);
    const sortBy = sortByAllow.has(req.query.sortBy) ? req.query.sortBy : "createdAt";
    const order = String(req.query.order || "DESC").toUpperCase() === "ASC" ? "ASC" : "DESC";

    const where = {};
    const andConditions = [];

    // ✅ category match (slug বা name যাই হোক)
    if (category && category.trim()) {
      const norm = normInput(category);
      // DB normalize করে compare
      andConditions.push(W(normDbExpr("category"), norm));
      // অথবা চাইলে loose:
      // andConditions.push(W(normDbExpr("category"), { [Op.like]: `%${norm}%` }));
    }

    // ✅ subCategory match
    if (subCategory && subCategory.trim()) {
      const norm = normInput(subCategory);
      andConditions.push(W(normDbExpr("subCategory"), norm));
    }

    // ✅ search (name/category/subCategory partial)
    if (search && search.trim()) {
      const s = search.trim().toLowerCase();
      andConditions.push({
        [Op.or]: [
          W(fn("LOWER", col("name")), { [Op.like]: `%${s}%` }),
          W(fn("LOWER", col("category")), { [Op.like]: `%${s}%` }),
          W(fn("LOWER", col("subCategory")), { [Op.like]: `%${s}%` }),
        ],
      });
    }

    if (andConditions.length) where[Op.and] = andConditions;

    const { rows, count } = await Product.findAndCountAll({
      where,
      attributes: { exclude: ["description"] },
      order: [[sortBy, order]],
      limit: limitNum,
      offset,
    });

    return res.json({
      data: rows,
      meta: {
        total: count,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(count / limitNum),
        hasNext: pageNum * limitNum < count,
        hasPrev: pageNum > 1,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};

// GET /api/admin/stats
exports.getAdminStats = async (req, res) => {
  try {
    const includeRevenue = String(req.query.includeRevenue || "0") === "1";
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    const [
      users,
      products,
      orders,
      merchants,
      approvedMerchants,
      pendingMerchantRequests,
      pendingTopups,
      activeOffers,
      usersBalanceRaw,
      merchantBalanceRaw,
      adminBalanceRaw,
      lowStockProducts,
      outOfStockProducts,
      todayOrders,
      todayUsers,
      todayOrderStatusRows,
      allOrderStatusRows,
      todayTopupApprovedRaw,
    ] = await Promise.all([
      User.count(),
      Product.count(),
      OrderItem.count(),
      Merchant.count(),
      Merchant.count({ where: { status: "approved" } }),
      Merchant.count({ where: { status: "pending" } }),
      BalanceTopupRequest.count({ where: { status: "pending" } }),
      Offer.count({ where: { isActive: true } }),
      User.sum("balance", { where: { role: "user" } }),
      User.sum("balance", { where: { role: "merchant" } }),
      User.sum("balance", { where: { role: "admin" } }),
      Product.count({ where: { stock: { [Op.between]: [1, 5] } } }),
      Product.count({ where: { stock: 0 } }),
      OrderItem.count({ where: { createdAt: { [Op.gte]: todayStart, [Op.lt]: tomorrowStart } } }),
      User.count({ where: { createdAt: { [Op.gte]: todayStart, [Op.lt]: tomorrowStart } } }),
      OrderItem.findAll({
        where: { createdAt: { [Op.gte]: todayStart, [Op.lt]: tomorrowStart } },
        attributes: ["status", [sequelize.fn("COUNT", sequelize.col("id")), "count"]],
        group: ["status"],
        raw: true,
      }),
      OrderItem.findAll({
        attributes: ["status", [sequelize.fn("COUNT", sequelize.col("id")), "count"]],
        group: ["status"],
        raw: true,
      }),
      BalanceTopupRequest.sum("amount", {
        where: {
          status: "approved",
          createdAt: { [Op.gte]: todayStart, [Op.lt]: tomorrowStart },
        },
      }),
    ]);

    let revenue = 0;
    if (includeRevenue) {
      // Optional heavy aggregate; keep disabled by default for faster dashboard load.
      const revenueData = await OrderItem.findAll({
        where: { status: { [Op.ne]: "cancelled" } },
        attributes: [[sequelize.fn("SUM", sequelize.literal("price * quantity")), "total"]],
        raw: true,
      });
      revenue = Number(revenueData[0]?.total || 0);
    }

    const [todaySalesRow] = await OrderItem.findAll({
      where: {
        createdAt: { [Op.gte]: todayStart, [Op.lt]: tomorrowStart },
        status: { [Op.ne]: "cancelled" },
      },
      attributes: [[sequelize.fn("SUM", sequelize.literal("(price * quantity) + deliveryCharge")), "total"]],
      raw: true,
    });

    const toStatusMap = (rows = []) =>
      rows.reduce((acc, row) => {
        acc[row.status] = Number(row.count || 0);
        return acc;
      }, {});

    const todayStatusMap = toStatusMap(todayOrderStatusRows);
    const orderStatusMap = toStatusMap(allOrderStatusRows);

    return res.json({
      success: true,
      stats: {
        users,
        products,
        orders,
        merchants,
        revenue,
        approvedMerchants,
        pendingMerchantRequests,
        pendingTopups,
        activeOffers,
        balances: {
          users: Number(usersBalanceRaw || 0),
          merchants: Number(merchantBalanceRaw || 0),
          admin: Number(adminBalanceRaw || 0),
        },
        inventory: {
          lowStockProducts: Number(lowStockProducts || 0),
          outOfStockProducts: Number(outOfStockProducts || 0),
        },
        today: {
          orders: Number(todayOrders || 0),
          sales: Number(todaySalesRow?.total || 0),
          newUsers: Number(todayUsers || 0),
          approvedTopupAmount: Number(todayTopupApprovedRaw || 0),
          byStatus: {
            pending: Number(todayStatusMap.pending || 0),
            processing: Number(todayStatusMap.processing || 0),
            shipped: Number(todayStatusMap.shipped || 0),
            delivered: Number(todayStatusMap.delivered || 0),
            cancelled: Number(todayStatusMap.cancelled || 0),
          },
        },
        ordersByStatus: {
          pending: Number(orderStatusMap.pending || 0),
          processing: Number(orderStatusMap.processing || 0),
          shipped: Number(orderStatusMap.shipped || 0),
          delivered: Number(orderStatusMap.delivered || 0),
          cancelled: Number(orderStatusMap.cancelled || 0),
        },
      },
    });
  } catch (err) {
    console.error("getAdminStats error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getAdminProductById = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });

    const product = await Product.findByPk(id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    return res.json({ success: true, data: product });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.updateAdminProduct = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });

    const product = await Product.findByPk(id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    const { name, price, stock, category, subCategory, description, images, imageUrl, categoryId, subCategoryId } = req.body;

    if (name !== undefined) product.name = name.trim();
    if (price !== undefined) product.price = Number(price);
    if (stock !== undefined) product.stock = Number(stock);
    if (description !== undefined) product.description = description;
    
    // Update images if provided (support both `images` and legacy `imageUrl` payloads)
    const nextImages = images !== undefined ? images : imageUrl;
    if (nextImages !== undefined) {
      const imgs = (Array.isArray(nextImages) ? nextImages : [nextImages])
        .filter(Boolean)
        .map((x) => String(x).trim())
        .filter(Boolean);
      product.images = imgs;
      product.changed("images", true);
    }

    // Update category/subcategory refs if provided
    if (category !== undefined) product.category = category;
    if (subCategory !== undefined) product.subCategory = subCategory;
    if (categoryId !== undefined) product.categoryId = categoryId;
    if (subCategoryId !== undefined) product.subCategoryId = subCategoryId;

    await product.save();

    return res.json({ success: true, message: "Product updated", data: product });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};

// Optional: dropdown/filter এর জন্য categories/subCategories list
// GET /api/admin/products/filters
exports.getProductFilters = async (req, res) => {
  try {
    const cats = await Product.findAll({
      attributes: [[fn("DISTINCT", col("category")), "category"]],
      order: [[col("category"), "ASC"]],
      raw: true,
    });

    const subs = await Product.findAll({
      attributes: [[fn("DISTINCT", col("subCategory")), "subCategory"]],
      order: [[col("subCategory"), "ASC"]],
      raw: true,
    });

    return res.json({
      data: {
        categories: cats.map((x) => x.category).filter(Boolean),
        subCategories: subs.map((x) => x.subCategory).filter(Boolean),
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};



exports.deleteAdminProduct = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid product id" });

    const found = await Product.findByPk(id);
    if (!found) return res.status(404).json({ message: "Product not found" });

    await Product.destroy({ where: { id } });

    return res.json({ message: "Product deleted successfully" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};



const VALID = new Set([
  "create_",
  "manage_order",
  "manage_offer",
  "manage_catagory",
  "manage_catagoy",
  "manage_users",
]);

exports.setSubAdminPermissions = async (req, res) => {
  try {
    const subAdminId = Number(req.params.id);
    const permissions = Array.isArray(req.body?.permissions) ? req.body.permissions : [];

    const clean = [...new Set(permissions.map(String))].filter((p) => VALID.has(p));

    const user = await User.findByPk(subAdminId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // optional: ensure role
    // if (user.role !== "subadmin") return res.status(400).json({ message: "Not a subadmin" });

    // replace all permissions (simple & safe)
    await SubAdminPermission.destroy({ where: { userId: subAdminId } });

    if (clean.length) {
      await SubAdminPermission.bulkCreate(
        clean.map((permKey) => ({ userId: subAdminId, permKey }))
      );
    }

    return res.json({ success: true, userId: subAdminId, permissions: clean });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Server error" });
  }
};
