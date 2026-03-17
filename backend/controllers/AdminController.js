const Merchant = require("../models/MerchantProfile");
const User = require("../models/Authentication");
const Product = require("../models/Product");
const OrderItem = require("../models/Order");
const Offer = require("../models/Offer");
const BalanceTopupRequest = require("../models/BalanceTopupRequest");
const sequelize = require('../config/db');
const Notification = require("../models/Notification");
const { Op, fn, col, where: W, literal } = require("sequelize");
const { appendAdminHistory } = require("../utils/adminHistory");
const { deleteUploadFileIfSafe } = require("../utils/uploadFileCleanup");

const normalizeStoredImagePath = (value) => {
  if (value == null) return "";
  let raw = String(value).trim();
  if (!raw) return "";

  if (/^https?:\/\//i.test(raw)) {
    try {
      raw = new URL(raw).pathname || "";
    } catch {
      return String(value).trim();
    }
  }

  let normalized = raw.replace(/\\/g, "/").split("?")[0];
  try {
    normalized = decodeURIComponent(normalized);
  } catch {}
  normalized = normalized.replace(/^\/+/, "");

  if (normalized.startsWith("public/")) {
    return `/${normalized}`;
  }
  return String(value).trim();
};

// const clampInt = (v, d) => {
//   const n = Number(v);
//   return Number.isFinite(n) && n > 0 ? Math.floor(n) : d;
// };

exports.getMerchantRequests = async (req, res) => {
  try {
    // query: ?status=pending&page=1&limit=20&q=rony
    const status = (req.query.status || "pending").trim();
    const suspended = (req.query.suspended || "").trim().toLowerCase();
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
    let filtered = q
      ? rows.filter((m) => {
          const name = (m.user?.name || "").toLowerCase();
          const email = (m.user?.email || "").toLowerCase();
          return name.includes(q) || email.includes(q);
        })
      : rows;

    const hasSuspendedFilter = suspended === "true" || suspended === "false";

    if (suspended === "true") {
      filtered = filtered.filter((m) => m.status === "approved" && m.user?.role !== "merchant");
    } else if (suspended === "false") {
      filtered = filtered.filter((m) => !(m.status === "approved" && m.user?.role !== "merchant"));
    }

    const normalized = filtered.map((m) => {
      const json = m.toJSON ? m.toJSON() : m;
      return {
        ...json,
        isSuspended: json.status === "approved" && json.user?.role !== "merchant",
      };
    });

    return res.json({
      ok: true,
      data: normalized,
      page,
      limit,
      total: q || hasSuspendedFilter ? normalized.length : count,
      totalPages: q || hasSuspendedFilter ? 1 : Math.ceil(count / limit),
    });
  } catch (err) {
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
      const user = await User.findByPk(merchant.userId, { transaction: t, lock: t.LOCK.UPDATE });
      if (user && user.role !== "merchant") {
        user.role = "merchant";
        await user.save({ transaction: t });
      }
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

    await appendAdminHistory(
      `Merchant request approved. User #${merchant.userId}, request #${merchant.id}.`,
      {
        transaction: t,
        meta: {
          type: "merchant_request_approved",
          userId: merchant.userId,
          merchantProfileId: merchant.id,
          status: "approved",
        },
      }
    );

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
    const cleanupTargets = [merchant.idFrontImage, merchant.idBackImage]
      .map((p) => normalizeStoredImagePath(p))
      .filter(Boolean);

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

    await appendAdminHistory(
      `Merchant request rejected. User #${merchant.userId}, request #${merchant.id}.`,
      {
        transaction: t,
        meta: {
          type: "merchant_request_rejected",
          userId: merchant.userId,
          merchantProfileId: merchant.id,
          status: "rejected",
        },
      }
    );

    // Safe approach: destroy
    await merchant.destroy({ transaction: t });

    await t.commit();

    const cleanupResults = await Promise.allSettled(
      cleanupTargets.map((target) => deleteUploadFileIfSafe(target))
    );
    const cleanupFailed = cleanupResults.some((r) => r.status === "rejected");

    return res.json({
      ok: true,
      message: cleanupFailed
        ? "Merchant request rejected & deleted (some images could not be removed)"
        : "Merchant request rejected & deleted",
    });
  } catch (err) {
    await t.rollback();
    return res.status(500).json({ ok: false, message: err?.message || "Server error" });
  }
};

exports.suspendMerchant = async (req, res) => {
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

    if (!(merchant.status === "approved" && merchant.isApproved)) {
      await t.rollback();
      return res.status(400).json({ ok: false, message: "Only approved merchant can be suspended" });
    }

    const user = await User.findByPk(merchant.userId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!user) {
      await t.rollback();
      return res.status(404).json({ ok: false, message: "User not found" });
    }

    if (user.role !== "merchant") {
      await t.commit();
      return res.json({ ok: true, message: "Merchant already suspended", data: merchant });
    }

    user.role = "user";
    await user.save({ transaction: t });
    const actorId = req.user?.id || req.userId || null;

    await appendAdminHistory(
      `Merchant suspended. User #${merchant.userId}, request #${merchant.id}, by admin #${actorId || "unknown"}.`,
      {
        transaction: t,
        meta: {
          type: "merchant_suspended",
          actorId,
          userId: merchant.userId,
          merchantProfileId: merchant.id,
        },
      }
    );

    await Notification.create(
      {
        userId: merchant.userId,
        type: "system",
        title: "Merchant account suspended",
        message:
          "Your merchant account has been suspended. To request reactivation and recover your previous data, please contact support.",
        meta: { merchantRequestId: merchant.id, status: "suspended", route: "/merchant" },
      },
      { transaction: t }
    );

    await t.commit();
    return res.json({ ok: true, message: "Merchant suspended successfully", data: merchant });
  } catch (err) {
    await t.rollback();
    return res.status(500).json({ ok: false, message: err?.message || "Server error" });
  }
};

exports.resumeMerchant = async (req, res) => {
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

    if (!(merchant.status === "approved" && merchant.isApproved)) {
      await t.rollback();
      return res.status(400).json({ ok: false, message: "Only approved merchant can be resumed" });
    }

    const user = await User.findByPk(merchant.userId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!user) {
      await t.rollback();
      return res.status(404).json({ ok: false, message: "User not found" });
    }

    if (user.role === "merchant") {
      await t.commit();
      return res.json({ ok: true, message: "Merchant already active", data: merchant });
    }

    user.role = "merchant";
    await user.save({ transaction: t });
    const actorId = req.user?.id || req.userId || null;

    await appendAdminHistory(
      `Merchant resumed. User #${merchant.userId}, request #${merchant.id}, by admin #${actorId || "unknown"}.`,
      {
        transaction: t,
        meta: {
          type: "merchant_resumed",
          actorId,
          userId: merchant.userId,
          merchantProfileId: merchant.id,
        },
      }
    );

    await Notification.create(
      {
        userId: merchant.userId,
        type: "system",
        title: "Merchant account reactivated",
        message: "Your merchant access has been restored. You can now continue with your previous data.",
        meta: { merchantRequestId: merchant.id, status: "approved", route: "/merchant" },
      },
      { transaction: t }
    );

    await t.commit();
    return res.json({ ok: true, message: "Merchant resumed successfully", data: merchant });
  } catch (err) {
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

    const safe = async (label, fnCall, fallback) => {
      try {
        return await fnCall();
      } catch (error) {
        return fallback;
      }
    };

    const users = await safe("users_count", () => User.count(), 0);
    const products = await safe("products_count", () => Product.count(), 0);
    const orders = await safe("orders_count", () => OrderItem.count(), 0);
    const merchants = await safe("merchants_count", () => Merchant.count(), 0);
    const approvedMerchants = await safe(
      "merchants_approved_count",
      () => Merchant.count({ where: { status: "approved" } }),
      0
    );
    const pendingMerchantRequests = await safe(
      "merchants_pending_count",
      () => Merchant.count({ where: { status: "pending" } }),
      0
    );
    const pendingTopups = await safe(
      "topups_pending_count",
      () => BalanceTopupRequest.count({ where: { status: "pending" } }),
      0
    );
    const activeOffers = await safe(
      "offers_active_count",
      () => Offer.count({ where: { isActive: true } }),
      0
    );
    const usersBalanceRaw = await safe("balance_users_sum", () => User.sum("balance"), 0);
    const merchantBalanceRaw = await safe(
      "balance_merchants_sum",
      () => User.sum("balance", { where: { role: "merchant" } }),
      0
    );
    const adminBalanceRaw = await safe("balance_admin_sum", () => User.sum("balance", { where: { role: "admin" } }), 0);
    const lowStockProducts = await safe(
      "products_low_stock_count",
      () => Product.count({ where: { stock: { [Op.between]: [1, 5] } } }),
      0
    );
    const outOfStockProducts = await safe("products_out_stock_count", () => Product.count({ where: { stock: 0 } }), 0);
    const todayOrders = await safe(
      "orders_today_count",
      () => OrderItem.count({ where: { createdAt: { [Op.gte]: todayStart, [Op.lt]: tomorrowStart } } }),
      0
    );
    const todayUsers = await safe(
      "users_today_count",
      () => User.count({ where: { createdAt: { [Op.gte]: todayStart, [Op.lt]: tomorrowStart } } }),
      0
    );
    const todayOrderStatusRows = await safe(
      "orders_today_by_status",
      () =>
        OrderItem.findAll({
          where: { createdAt: { [Op.gte]: todayStart, [Op.lt]: tomorrowStart } },
          attributes: ["status", [sequelize.fn("COUNT", sequelize.col("id")), "count"]],
          group: ["status"],
          raw: true,
        }),
      []
    );
    const allOrderStatusRows = await safe(
      "orders_all_by_status",
      () =>
        OrderItem.findAll({
          attributes: ["status", [sequelize.fn("COUNT", sequelize.col("id")), "count"]],
          group: ["status"],
          raw: true,
        }),
      []
    );
    const todayTopupApprovedRaw = await safe(
      "topups_today_approved_sum",
      () =>
        BalanceTopupRequest.sum("amount", {
          where: {
            status: "approved",
            createdAt: { [Op.gte]: todayStart, [Op.lt]: tomorrowStart },
          },
        }),
      0
    );

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

    const todaySalesValue = await safe(
      "orders_today_sales_sum",
      async () => {
        const rows = await OrderItem.findAll({
          where: {
            createdAt: { [Op.gte]: todayStart, [Op.lt]: tomorrowStart },
            status: { [Op.ne]: "cancelled" },
          },
          attributes: [
            [sequelize.fn("SUM", sequelize.literal("(price * quantity) + deliveryCharge")), "total"],
          ],
          raw: true,
        });
        return Number(rows?.[0]?.total || 0);
      },
      0
    );

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
          sales: Number(todaySalesValue || 0),
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
    return res.status(500).json({ message: "Server error" });
  }
};

exports.updateAdminProduct = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });

    const product = await Product.findByPk(id);
    if (!product) return res.status(404).json({ message: "Product not found" });
    const actorId = req.user?.id || req.userId || null;
    const before = {
      name: product.name,
      price: Number(product.price || 0),
      stock: Number(product.stock || 0),
      category: product.category || null,
      subCategory: product.subCategory || null,
    };

    const { name, price, stock, category, subCategory, description, images, imageUrl, categoryId, subCategoryId } = req.body;
    const isSubAdminActor = req.user?.role === "subadmin";

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
        .map(normalizeStoredImagePath)
        .filter(Boolean);
      product.images = imgs;
      product.changed("images", true);
    }

    // Subadmins can edit product content/price/stock/images, but category refs stay immutable.
    if (!isSubAdminActor) {
      if (category !== undefined) product.category = category;
      if (subCategory !== undefined) product.subCategory = subCategory;
      if (categoryId !== undefined) product.categoryId = categoryId;
      if (subCategoryId !== undefined) product.subCategoryId = subCategoryId;
    }

    await product.save();
    await appendAdminHistory(
      `Admin product updated. Product #${product.id} (${product.name}) by admin #${actorId || "unknown"}.`,
      {
        meta: {
          type: "admin_product_updated",
          actorId,
          productId: product.id,
          before,
          after: {
            name: product.name,
            price: Number(product.price || 0),
            stock: Number(product.stock || 0),
            category: product.category || null,
            subCategory: product.subCategory || null,
          },
        },
      }
    );

    return res.json({ success: true, message: "Product updated", data: product });
  } catch (err) {
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
    return res.status(500).json({ message: "Server error" });
  }
};



exports.deleteAdminProduct = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid product id" });

    const found = await Product.findByPk(id);
    if (!found) return res.status(404).json({ message: "Product not found" });
    const actorId = req.user?.id || req.userId || null;
    const snapshot = {
      productId: found.id,
      name: found.name,
      category: found.category || null,
      subCategory: found.subCategory || null,
      price: Number(found.price || 0),
      stock: Number(found.stock || 0),
    };

    await Product.destroy({ where: { id } });
    await appendAdminHistory(
      `Admin product deleted. Product #${snapshot.productId} (${snapshot.name}) by admin #${actorId || "unknown"}.`,
      {
        meta: {
          type: "admin_product_deleted",
          actorId,
          ...snapshot,
        },
      }
    );

    return res.json({ message: "Product deleted successfully" });
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
};



const VALID = new Set([
  "create_products",
  "edit_products",
  "manage_order",
  "manage_offer",
  "manage_catagory",
  "manage_catagoy",
  "manage_merchant",
  "manage_users",
  "manage_support_chat",
  "manage_balance_topup",
  "manage_wallet",
]);

exports.setSubAdminPermissions = async (req, res) => {
  try {
    const subAdminId = Number(req.params.id);
    const permissions = Array.isArray(req.body?.permissions) ? req.body.permissions : [];

    const clean = [...new Set(permissions.map(String))].filter((p) => VALID.has(p));

    const user = await User.findByPk(subAdminId);
    if (!user) return res.status(404).json({ message: "User not found" });
    const actorId = req.user?.id || req.userId || null;

    // optional: ensure role
    // if (user.role !== "subadmin") return res.status(400).json({ message: "Not a subadmin" });

    // replace all permissions (simple & safe)
    await SubAdminPermission.destroy({ where: { userId: subAdminId } });

    if (clean.length) {
      await SubAdminPermission.bulkCreate(
        clean.map((permKey) => ({ userId: subAdminId, permKey }))
      );
    }

    await appendAdminHistory(
      `Subadmin permissions set for user #${subAdminId} by admin #${actorId || "unknown"}.`,
      {
        meta: {
          type: "subadmin_permissions_set",
          actorId,
          userId: subAdminId,
          permissions: clean,
        },
      }
    );

    return res.json({ success: true, userId: subAdminId, permissions: clean });
  } catch (e) {
    return res.status(500).json({ message: "Server error" });
  }
};
