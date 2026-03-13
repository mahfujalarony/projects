const Merchant = require("../models/MerchantProfile");
const { Op, fn, col, where: W } = require("sequelize");
const sequelize = require("../config/db");
const Product = require("../models/Product");
const MerchentStore = require("../models/MerchentStore");
const Authentication = require("../models/Authentication");
const OrderItem = require("../models/Order");
const Review = require("../models/Review");
const { subMoney2 } = require("../utils/money");
const { appendAdminHistory } = require("../utils/adminHistory");

const isNonEmpty = (v) => typeof v === "string" && v.trim().length > 0;

const getAuthUserId = (req) => req.user?.id || req.userId || req.user?.userId;

// normalize input: "home-living" => "home living"
const normInput = (s = "") =>
  String(s).trim().toLowerCase().replace(/[-_]+/g, " ").replace(/\s+/g, " ");

// normalize DB field in MySQL: lower + replace '-' '_' => space
const normDbExpr = (fieldName) =>
  fn("REPLACE", fn("REPLACE", fn("LOWER", col(fieldName)), "-", " "), "_", " ");

// soldBy upsert (no helper file)
const upsertSoldBy = (soldBy, merchantId, qty) => {
  const arr = Array.isArray(soldBy) ? soldBy : [];
  const mid = Number(merchantId);
  const q = Number(qty);

  const idx = arr.findIndex((x) => Number(x?.merchantId) === mid);
  if (idx >= 0) arr[idx].qty = Number(arr[idx].qty || 0) + q;
  else arr.push({ merchantId: mid, qty: q });

  return arr;
};

const normalizeKeywordList = (value) => {
  const input = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];

  const seen = new Set();
  const out = [];
  for (const item of input) {
    const k = String(item || "").trim().toLowerCase();
    if (!k || k.length > 40 || seen.has(k)) continue;
    seen.add(k);
    out.push(k);
    if (out.length >= 10) break;
  }
  return out;
};

const suggestKeywordsFromProduct = (src = {}) => {
  const candidates = [
    src.name,
    src.category,
    src.subCategory,
    ...(Array.isArray(src.keywords) ? src.keywords : []),
  ];
  const expanded = [];
  for (const value of candidates) {
    const raw = String(value || "").trim();
    if (!raw) continue;
    expanded.push(raw);
    expanded.push(
      ...raw
        .toLowerCase()
        .replace(/[^a-z0-9\u0980-\u09ff\s-]/g, " ")
        .replace(/[-_]+/g, " ")
        .split(/\s+/)
        .filter(Boolean)
    );
  }
  return normalizeKeywordList(expanded);
};

/**
 * =========================
 * Merchant Register/Profile
 * =========================
 */

exports.merchantRegister = async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const {
      YourAddress,
      idNumber,
      idFrontImage,
      idBackImage,
      paypalEmail,
      stripeAccountId,
      bankName,
      accountNumber,
      swiftCode,
      description,
      socialLinks,
      phoneNumber,
    } = req.body || {};

    if (!isNonEmpty(YourAddress)) return res.status(400).json({ message: "YourAddress is required" });
    if (!isNonEmpty(idNumber)) return res.status(400).json({ message: "idNumber is required" });
    if (!isNonEmpty(idFrontImage)) return res.status(400).json({ message: "idFrontImage is required" });
    if (!isNonEmpty(idBackImage)) return res.status(400).json({ message: "idBackImage is required" });

    const hasPayout = isNonEmpty(paypalEmail) || isNonEmpty(stripeAccountId) || isNonEmpty(bankName);
    if (!hasPayout) {
      return res.status(400).json({
        message: "At least one payout method is required (PayPal, Stripe, or Bank)",
      });
    }

    const already = await Merchant.findOne({ where: { userId } });
    if (already) return res.status(409).json({ message: "You already have a merchant profile" });

    let socialLinksJson = null;
    if (socialLinks) {
      if (typeof socialLinks === "object") socialLinksJson = socialLinks;
      else {
        try {
          socialLinksJson = JSON.parse(socialLinks);
        } catch {
          return res.status(400).json({ message: "socialLinks must be a valid JSON" });
        }
      }
    }

    const merchant = await Merchant.create({
      userId,
      YourAddress: String(YourAddress).trim(),
      idNumber: String(idNumber).trim(),
      idFrontImage: String(idFrontImage).trim(),
      idBackImage: String(idBackImage).trim(),

      paypalEmail: isNonEmpty(paypalEmail) ? String(paypalEmail).trim() : null,
      stripeAccountId: isNonEmpty(stripeAccountId) ? String(stripeAccountId).trim() : null,
      bankName: isNonEmpty(bankName) ? String(bankName).trim() : null,
      accountNumber: isNonEmpty(accountNumber) ? String(accountNumber).trim() : null,
      swiftCode: isNonEmpty(swiftCode) ? String(swiftCode).trim() : null,

      status: "pending",
      isApproved: false,

      description: isNonEmpty(description) ? String(description).trim() : null,
      socialLinks: socialLinksJson,
      phoneNumber: isNonEmpty(phoneNumber) ? String(phoneNumber).trim() : null,
    });

    await appendAdminHistory(
      `Merchant join request submitted by user #${userId}. Request status: pending.`,
      {
        meta: {
          type: "merchant_join_request",
          userId,
          merchantProfileId: merchant.id,
          status: merchant.status,
        },
      }
    );

    return res.status(201).json({
      message: "Merchant registration submitted. Waiting for approval.",
      data: merchant,
    });
  } catch (err) {
    return res.status(500).json({ message: err?.message || "Server error" });
  }
};

exports.getMyMerchantProfile = async (req, res) => {
  try {
    const userId = req.userId || req.user?.id || getAuthUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const merchant = await Merchant.findOne({ where: { userId } });
    if (!merchant) return res.json({ success: true, data: { merchant: null } });

    // Realtime rating from active reviews on this merchant's store products.
    const live = await Review.findOne({
      attributes: [
        [fn("COUNT", col("Review.id")), "cnt"],
        [fn("AVG", col("Review.rating")), "avg"],
      ],
      include: [
        {
          model: MerchentStore,
          as: "product",
          attributes: [],
          where: { merchantId: userId },
        },
      ],
      where: { isActive: true },
      raw: true,
    });

    const liveTotalReviews = Number(live?.cnt || 0);
    const liveAverageRating = liveTotalReviews ? Number(Number(live?.avg || 0).toFixed(2)) : 0;

    const merchantJson = merchant.toJSON();
    merchantJson.averageRating = liveAverageRating;
    merchantJson.totalReviews = liveTotalReviews;
    merchantJson.isSuspended = merchant.status === "approved" && merchant.isApproved && req.user?.role !== "merchant";
    merchantJson.suspendMessage =
      "Your merchant account has been suspended. If you want to restore your account access, please contact support. Your previous data can be recovered after verification.";

    return res.json({ success: true, data: { merchant: merchantJson } });
  } catch (e) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * =========================
 * Merchant - browse admin products (pick page)
 * =========================
 */

// GET /api/merchant/admin-products?category=home-living&subCategory=laptop&page=1&limit=12&search=abc
exports.getAdminProductsForMerchant = async (req, res) => {
  try {
    const merchantId = req.userId || req.user?.id || getAuthUserId(req);
    if (!merchantId) return res.status(401).json({ message: "Unauthorized" });

    const {
      category = "",
      subCategory = "",
      categoryScopes = "",
      subCategoryScopes = "",
      page = 1,
      limit = 12,
      search = "",
      sortBy = "createdAt",
      order = "DESC",
    } = req.query;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 12, 1), 60);
    const offset = (pageNum - 1) * limitNum;

    const andConditions = [];

    // ✅ Only admin products that have stock
    andConditions.push({ stock: { [Op.gt]: 0 } });

    // ✅ category normalize compare
    const categoryScopeList = String(categoryScopes || "")
      .split(",")
      .map((x) => normInput(x))
      .filter(Boolean);
    const uniqueCategoryScopes = [...new Set(categoryScopeList)];

    if (uniqueCategoryScopes.length) {
      andConditions.push({
        [Op.or]: [
          W(normDbExpr("category"), { [Op.in]: uniqueCategoryScopes }),
          W(normDbExpr("subCategory"), { [Op.in]: uniqueCategoryScopes }),
        ],
      });
    } else if (category && category.trim()) {
      const norm = normInput(category);
      andConditions.push(W(normDbExpr("category"), norm));
    }

    // ✅ subCategory normalize compare
    const subCategoryScopeList = String(subCategoryScopes || "")
      .split(",")
      .map((x) => normInput(x))
      .filter(Boolean);
    const uniqueSubCategoryScopes = [...new Set(subCategoryScopeList)];

    if (uniqueSubCategoryScopes.length) {
      andConditions.push(W(normDbExpr("subCategory"), { [Op.in]: uniqueSubCategoryScopes }));
    } else if (subCategory && subCategory.trim()) {
      const norm = normInput(subCategory);
      andConditions.push(W(normDbExpr("subCategory"), norm));
    }

    // ✅ search (case-insensitive)
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

    const where = andConditions.length ? { [Op.and]: andConditions } : {};

    // sort allowlist
    const sortAllow = new Set(["createdAt", "updatedAt", "price", "stock", "name", "soldCount", "id"]);
    const sortField = sortAllow.has(sortBy) ? sortBy : "createdAt";
    const sortOrder = String(order).toUpperCase() === "ASC" ? "ASC" : "DESC";

    const { rows, count } = await Product.findAndCountAll({
      where,
      attributes: { exclude: ["description"] },
      order: [[sortField, sortOrder]],
      limit: limitNum,
      offset,
    });

    const productIds = rows.map((p) => Number(p.id)).filter(Boolean);
    let storeQtyMap = new Map();
    if (productIds.length) {
      const storeRows = await MerchentStore.findAll({
        where: {
          merchantId,
          productId: productIds,
        },
        attributes: ["productId", "stock"],
        raw: true,
      });

      storeQtyMap = new Map(
        storeRows.map((row) => [Number(row.productId), Number(row.stock || 0)])
      );
    }

    const data = rows.map((row) => {
      const json = row.toJSON();
      return {
        ...json,
        merchantStoreQty: Number(storeQtyMap.get(Number(row.id)) || 0),
      };
    });

    return res.json({
      data,
      meta: {
        total: count,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(count / limitNum),
      },
    });
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
};

// GET /api/merchant/admin-products/:id
exports.getAdminProductDetails = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid ID" });

    const product = await Product.findByPk(id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    return res.json({ success: true, data: product });
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
};

// GET /api/merchant/me/balance
exports.getMyBalance = async (req, res) => {
  try {
    const merchantId = req.userId || req.user?.id || getAuthUserId(req);
    if (!merchantId) return res.status(401).json({ message: "Unauthorized" });

    const me = await Authentication.findByPk(merchantId, { attributes: ["id", "balance"] });
    if (!me) return res.status(404).json({ message: "Merchant not found" });

    return res.json({ data: { merchantId: me.id, balance: Number(me.balance || 0) } });
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * =========================
 * Merchant - pick from admin to merchant store
 * =========================
 */

// POST /api/merchant/store/pick
// body: { productId: 12, qty: 1 }  (qty allowed 1/3/5)
exports.pickFromAdminToMerchantStore = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const merchantId = req.userId || req.user?.id || getAuthUserId(req);
    if (!merchantId) {
      await t.rollback();
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { productId, qty } = req.body || {};
    const pid = Number(productId);
    const q = parseInt(qty, 10);

    if (!pid || !q) {
      await t.rollback();
      return res.status(400).json({ message: "productId & qty required" });
    }

    // lock product row
    const product = await Product.findByPk(pid, { transaction: t, lock: t.LOCK.UPDATE });
    if (!product) {
      await t.rollback();
      return res.status(404).json({ message: "Product not found" });
    }

    if ((product.stock || 0) < q) {
      await t.rollback();
      return res.status(400).json({ message: "Not enough stock in admin store" });
    }

    // lock merchant row (balance)
    const merchant = await Authentication.findByPk(merchantId, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!merchant) {
      await t.rollback();
      return res.status(404).json({ message: "Merchant not found" });
    }

    const unitPrice = Number(product.price || 0);
    const fullCost = unitPrice * q;
    const totalCost = Number((fullCost * 0.5).toFixed(2));
    const currentBalance = Number(merchant.balance || 0);

    if (currentBalance < totalCost) {
      await t.rollback();
      return res.status(400).json({ message: "Insufficient balance" });
    }

    // 1) deduct balance
    const nextMerchantBalance = subMoney2(currentBalance, totalCost);
    if (!nextMerchantBalance) {
      await t.rollback();
      return res.status(400).json({ message: "Invalid balance calculation" });
    }
    merchant.balance = nextMerchantBalance;
    await merchant.save({ transaction: t });

    // 2) decrease admin stock + update soldCount/soldBy
    product.stock = Number(product.stock || 0) - q;
    product.soldCount = Number(product.soldCount || 0) + q;
    product.soldBy = upsertSoldBy(product.soldBy, merchantId, q);
    await product.save({ transaction: t });

    // 3) upsert into merchant store
    const existing = await MerchentStore.findOne({
      where: { merchantId, productId: pid },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (existing) {
      existing.stock = Number(existing.stock || 0) + q;

      // sync fields
      existing.name = product.name;
      existing.price = product.price;
      existing.oldPrice = product.oldPrice;
      existing.category = product.category;
      existing.subCategory = product.subCategory; // ✅ keep sync
      existing.images = product.images;
      if (!Array.isArray(existing.keywords) || existing.keywords.length === 0) {
        existing.keywords = suggestKeywordsFromProduct(product);
      }

      await existing.save({ transaction: t });
    } else {
      await MerchentStore.create(
        {
          merchantId,
          productId: pid,
          name: product.name,
          description: product.description,
          price: product.price,
          oldPrice: product.oldPrice,
          stock: q,
          category: product.category,
          subCategory: product.subCategory, // ✅ add
          images: product.images,
          keywords: suggestKeywordsFromProduct(product),
        },
        { transaction: t }
      );
    }

    await appendAdminHistory(
      `Merchant #${merchantId} picked ${q} item(s) of "${product.name}" (product #${pid}). Full price ${fullCost.toFixed(
        2
      )}, charged 50% = ${totalCost.toFixed(2)}.`,
      {
        transaction: t,
        meta: {
          type: "merchant_pick",
          merchantId,
          productId: pid,
          qty: q,
          fullCost: Number(fullCost.toFixed(2)),
          chargedAmount: totalCost,
        },
      }
    );

    await t.commit();

    return res.json({
      message: "Added to merchant store",
      data: {
        productId: pid,
        pickedQty: q,
        newAdminStock: product.stock,
        newBalance: merchant.balance,
        soldCount: product.soldCount,
        soldBy: product.soldBy,
      },
    });
  } catch (err) {
    await t.rollback();
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * =========================
 * Merchant Store (My Store)
 * =========================
 */

// GET /api/merchant/store?page=1&limit=20
exports.getMyStore = async (req, res) => {
  try {
    const merchantId = req.userId || req.user?.id || getAuthUserId(req);
    if (!merchantId) return res.status(401).json({ message: "Unauthorized" });

    const { page = 1, limit = 20, search = "", sortBy = "updatedAt", order = "DESC" } = req.query;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const offset = (pageNum - 1) * limitNum;
    const s = String(search || "").trim().toLowerCase();

    const where = { merchantId };
    if (s) {
      where[Op.or] = [
        W(fn("LOWER", col("name")), { [Op.like]: `%${s}%` }),
        W(fn("LOWER", col("category")), { [Op.like]: `%${s}%` }),
        W(fn("LOWER", col("subCategory")), { [Op.like]: `%${s}%` }),
        W(sequelize.literal("LOWER(CAST(`keywords` AS CHAR))"), { [Op.like]: `%${s}%` }),
        ...(Number.isNaN(Number(s)) ? [] : [{ productId: Number(s) }]),
      ];
    }

    const sortAllow = new Set(["createdAt", "updatedAt", "price", "stock", "name", "soldCount", "id"]);
    const sortField = sortAllow.has(sortBy) ? sortBy : "updatedAt";
    const sortOrder = String(order).toUpperCase() === "ASC" ? "ASC" : "DESC";

    const { rows, count } = await MerchentStore.findAndCountAll({
      where,
      order: [[sortField, sortOrder]],
      limit: limitNum,
      offset,
    });

    return res.json({
      data: rows,
      meta: { total: count, page: pageNum, limit: limitNum, totalPages: Math.ceil(count / limitNum) },
    });
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
};

// PATCH /api/merchant/store/:id
exports.updateMyStoreProduct = async (req, res) => {
  try {
    const merchantId = req.userId || req.user?.id || getAuthUserId(req);
    if (!merchantId) return res.status(401).json({ message: "Unauthorized" });

    const { id } = req.params;
    const { name, description, keywords } = req.body || {};

    const product = await MerchentStore.findOne({ where: { id, merchantId } });
    if (!product) {
      return res.status(404).json({ message: "Product not found in your store" });
    }

    if (name !== undefined) product.name = name;
    if (description !== undefined) product.description = description;
    if (keywords !== undefined) {
      if (Array.isArray(keywords) && keywords.length > 10) {
        return res.status(400).json({ message: "Maximum 10 keywords allowed" });
      }
      product.keywords = normalizeKeywordList(keywords);
    }

    await product.save();

    return res.json({ success: true, message: "Product updated", data: product });
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * =========================
 * Merchant Orders (single function, paginated)
 * =========================
 */

// GET /api/merchant/orders?status=&paymentStatus=&paymentMethod=&search=&page=1&limit=20&sort=desc
exports.getMerchantOrders = async (req, res) => {
  try {
    const merchantId = req.userId || req.user?.id || getAuthUserId(req);
    if (!merchantId) return res.status(401).json({ ok: false, message: "Unauthorized" });

    const {
      status,
      paymentStatus,
      paymentMethod,
      search,
      page = 1,
      limit = 20,
      sort = "desc",
    } = req.query;

    const where = { matchMerchantId: merchantId };

    if (status) where.status = status;
    if (paymentStatus) where.paymentStatus = paymentStatus;
    if (paymentMethod) where.paymentMethod = paymentMethod;

    if (search && String(search).trim()) {
      const s = String(search).trim();
      where[Op.or] = [
        { name: { [Op.like]: `%${s}%` } },
        ...(Number.isNaN(Number(s)) ? [] : [{ productId: Number(s) }]),
      ];
    }

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const offset = (pageNum - 1) * limitNum;

    const { rows, count } = await OrderItem.findAndCountAll({
      where,
      limit: limitNum,
      offset,
      order: [["createdAt", String(sort).toLowerCase() === "asc" ? "ASC" : "DESC"]],
    });

    // attach store meta
    const productIds = [...new Set(rows.map((r) => r.productId))];
    const products = await MerchentStore.findAll({
      where: { merchantId, productId: productIds },
      attributes: ["productId", "category", "subCategory", "stock", "soldCount"],
    });

    const productMap = new Map(products.map((p) => [p.productId, p]));

    const data = rows.map((r) => {
      const p = productMap.get(r.productId);
      return {
        id: r.id,
        userId: r.userId,
        addressId: r.addressId,
        matchMerchantId: r.matchMerchantId,
        paymentMethod: r.paymentMethod,
        paymentStatus: r.paymentStatus,
        productId: r.productId,
        name: r.name,
        price: r.price,
        quantity: r.quantity,
        imageUrl: r.imageUrl,
        status: r.status,
        deliveryCharge: r.deliveryCharge,
        commissionPercent: r.commissionPercent,
        commissionAmount: r.commissionAmount,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        productMeta: p
          ? { category: p.category, subCategory: p.subCategory, stock: p.stock, soldCount: p.soldCount }
          : null,
      };
    });

    return res.json({
      ok: true,
      page: pageNum,
      limit: limitNum,
      total: count,
      totalPages: Math.ceil(count / limitNum),
      data,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, message: "Server error" });
  }
};

// GET /api/merchant/stats/top-products
exports.getTopSellingProducts = async (req, res) => {
  try {
    const merchantId = req.userId || req.user?.id || getAuthUserId(req);
    if (!merchantId) return res.status(401).json({ message: "Unauthorized" });

    const topProducts = await OrderItem.findAll({
      where: { matchMerchantId: merchantId },
      attributes: [
        "productId",
        "name",
        "imageUrl",
        [sequelize.fn("SUM", sequelize.col("quantity")), "soldCount"]
      ],
      group: ["productId", "name", "imageUrl"],
      order: [[sequelize.literal("soldCount"), "DESC"]],
      limit: 5,
    });

    return res.json({ success: true, data: topProducts });
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
};

// GET /api/merchant/stats/overview
exports.getMerchantDashboardOverview = async (req, res) => {
  try {
    const merchantId = req.userId || req.user?.id || getAuthUserId(req);
    if (!merchantId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const sevenDaysStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
    const sumAmountExpr = sequelize.literal("COALESCE(SUM(price * quantity), 0)");
    const sumEarningsExpr = sequelize.literal("COALESCE(SUM(commissionAmount), 0)");

    const [
      merchantUser,
      totalProducts,
      lowStockProducts,
      outOfStockProducts,
      totalOrders,
      pendingOrders,
      processingOrders,
      shippedOrders,
      deliveredOrders,
      cancelledOrders,
      todayOrders,
      todayDeliveredOrders,
      todaySalesSum,
      todayEarningsSum,
      totalEarningsSum,
      recentOrdersRaw,
      last7OrdersRaw,
      topProductsRaw,
    ] = await Promise.all([
      Authentication.findByPk(merchantId, { attributes: ["id", "balance"] }),
      MerchentStore.count({ where: { merchantId } }),
      MerchentStore.count({ where: { merchantId, stock: { [Op.between]: [1, 5] } } }),
      MerchentStore.count({ where: { merchantId, stock: 0 } }),
      OrderItem.count({ where: { matchMerchantId: merchantId } }),
      OrderItem.count({ where: { matchMerchantId: merchantId, status: "pending" } }),
      OrderItem.count({ where: { matchMerchantId: merchantId, status: "processing" } }),
      OrderItem.count({ where: { matchMerchantId: merchantId, status: "shipped" } }),
      OrderItem.count({ where: { matchMerchantId: merchantId, status: "delivered" } }),
      OrderItem.count({ where: { matchMerchantId: merchantId, status: "cancelled" } }),
      OrderItem.count({
        where: { matchMerchantId: merchantId, createdAt: { [Op.gte]: todayStart, [Op.lt]: tomorrowStart } },
      }),
      OrderItem.count({
        where: {
          matchMerchantId: merchantId,
          status: "delivered",
          createdAt: { [Op.gte]: todayStart, [Op.lt]: tomorrowStart },
        },
      }),
      OrderItem.findOne({
        attributes: [[sumAmountExpr, "amount"]],
        where: {
          matchMerchantId: merchantId,
          status: { [Op.ne]: "cancelled" },
          createdAt: { [Op.gte]: todayStart, [Op.lt]: tomorrowStart },
        },
        raw: true,
      }),
      OrderItem.findOne({
        attributes: [[sumEarningsExpr, "amount"]],
        where: {
          matchMerchantId: merchantId,
          status: "delivered",
          createdAt: { [Op.gte]: todayStart, [Op.lt]: tomorrowStart },
        },
        raw: true,
      }),
      OrderItem.findOne({
        attributes: [[sumEarningsExpr, "amount"]],
        where: {
          matchMerchantId: merchantId,
          status: "delivered",
        },
        raw: true,
      }),
      OrderItem.findAll({
        where: { matchMerchantId: merchantId },
        attributes: ["id", "name", "price", "quantity", "status", "createdAt"],
        order: [["createdAt", "DESC"]],
        limit: 8,
        raw: true,
      }),
      OrderItem.findAll({
        where: {
          matchMerchantId: merchantId,
          status: { [Op.ne]: "cancelled" },
          createdAt: { [Op.gte]: sevenDaysStart, [Op.lt]: tomorrowStart },
        },
        attributes: ["createdAt", "price", "quantity"],
        raw: true,
      }),
      OrderItem.findAll({
        where: { matchMerchantId: merchantId, status: { [Op.ne]: "cancelled" } },
        attributes: [
          "productId",
          "name",
          "imageUrl",
          [sequelize.fn("SUM", sequelize.col("quantity")), "soldCount"],
        ],
        group: ["productId", "name", "imageUrl"],
        order: [[sequelize.literal("soldCount"), "DESC"]],
        limit: 5,
        raw: true,
      }),
    ]);

    const days = [];
    const dayMap = {};
    for (let i = 0; i < 7; i += 1) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - i));
      const key = d.toISOString().slice(0, 10);
      dayMap[key] = { date: key, sales: 0, orders: 0 };
      days.push(dayMap[key]);
    }

    for (const row of last7OrdersRaw) {
      const key = new Date(row.createdAt).toISOString().slice(0, 10);
      if (!dayMap[key]) continue;
      const line = Number(row.price || 0) * Number(row.quantity || 0);
      dayMap[key].sales += Number.isFinite(line) ? line : 0;
      dayMap[key].orders += 1;
    }

    const totalSales = days.reduce((sum, d) => sum + Number(d.sales || 0), 0);

    return res.json({
      success: true,
      data: {
        balance: Number(merchantUser?.balance || 0),
        totalEarnings: Number(totalEarningsSum?.amount || 0),
        products: {
          total: Number(totalProducts || 0),
          lowStock: Number(lowStockProducts || 0),
          outOfStock: Number(outOfStockProducts || 0),
        },
        orders: {
          total: Number(totalOrders || 0),
          pending: Number(pendingOrders || 0),
          processing: Number(processingOrders || 0),
          shipped: Number(shippedOrders || 0),
          delivered: Number(deliveredOrders || 0),
          cancelled: Number(cancelledOrders || 0),
        },
        today: {
          orders: Number(todayOrders || 0),
          deliveredOrders: Number(todayDeliveredOrders || 0),
          sales: Number(todaySalesSum?.amount || 0),
          earnings: Number(todayEarningsSum?.amount || 0),
        },
        last7Days: {
          sales: Number(totalSales || 0),
          trend: days.map((d) => ({
            ...d,
            sales: Number(Number(d.sales || 0).toFixed(2)),
          })),
        },
        recentOrders: recentOrdersRaw,
        topProducts: topProductsRaw,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * =========================
 * Apply For Merchant (kept)
 * =========================
 */

exports.applyForMerchant = async (req, res) => {
  try {
    const userId = req.userId || req.user?.id || getAuthUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const {
      YourAddress,
      idNumber,
      idFrontImage,
      idBackImage,
      paypalEmail,
      stripeAccountId,
      bankName,
      accountNumber,
      swiftCode,
      description,
      socialLinks,
      phoneNumber,
    } = req.body || {};

    const existing = await Merchant.findOne({ where: { userId } });

    if (existing) {
      if (existing.status === "pending") return res.status(409).json({ message: "Your merchant request is already pending" });
      if (existing.status === "approved") return res.status(409).json({ message: "You are already an approved merchant" });
      if (existing.status === "rejected") return res.status(409).json({ message: "Your previous request was rejected. Please apply again." });
    }

    const merchant = await Merchant.create({
      userId,
      YourAddress,
      idNumber,
      idFrontImage,
      idBackImage,
      paypalEmail: paypalEmail || null,
      stripeAccountId: stripeAccountId || null,
      bankName: bankName || null,
      accountNumber: accountNumber || null,
      swiftCode: swiftCode || null,
      description: description || null,
      socialLinks: socialLinks || null,
      phoneNumber: phoneNumber || null,
    });

    await appendAdminHistory(
      `Merchant join request submitted by user #${userId}. Request status: pending.`,
      {
        meta: {
          type: "merchant_join_request",
          userId,
          merchantProfileId: merchant.id,
          status: merchant.status,
        },
      }
    );

    return res.status(201).json({ message: "Merchant request submitted successfully", merchant });
  } catch (err) {
    const msg = err?.errors?.[0]?.message || err.message || "Failed to submit merchant request";
    return res.status(400).json({ message: msg });
  }
};



// GET /api/merchants/:id/storefront?page=1&limit=20
exports.getMerchantStorefront = async (req, res) => {
  try {
    const rawId = Number(req.params.id);
    if (!rawId) return res.status(400).json({ message: "Invalid merchant ID" });

    // Supports both User.id and MerchantProfile.id.
    // IMPORTANT: prefer User.id first to avoid wrong profile due to ID collision
    // between User.id and MerchantProfile.id.
    let merchantUserId = null;
    let profileById = null;

    const userById = await Authentication.findByPk(rawId, {
      attributes: ["id"],
      include: [
        {
          model: Merchant,
          as: "merchantProfile",
          attributes: ["id", "userId"],
          required: false,
        },
      ],
    });

    if (userById?.merchantProfile) {
      merchantUserId = Number(userById.id);
      profileById = userById.merchantProfile || null;
    } else {
      profileById = await Merchant.findByPk(rawId, {
        attributes: ["id", "userId", "description", "YourAddress", "averageRating", "totalReviews"],
      });
      if (profileById?.userId) {
        merchantUserId = Number(profileById.userId);
      }
    }

    if (!merchantUserId) {
      return res.status(404).json({ message: "Merchant not found" });
    }

    const { page = 1, limit = 20, search = "", sort = "newest", category = "" } = req.query;
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const offset = (pageNum - 1) * limitNum;

    const searchTerm = String(search || "").trim();
    const categoryTerm = String(category || "").trim();

    // 1. Get Merchant Info
    const merchantUser = await Authentication.findByPk(merchantUserId, {
      attributes: ["id", "name", "imageUrl", "email", "createdAt"],
      include: [
        {
          model: Merchant,
          as: "merchantProfile",
          attributes: ["description", "YourAddress", "averageRating", "totalReviews"],
          required: false,
        },
      ],
    });

    if (!merchantUser) {
      return res.status(404).json({ message: "Merchant not found" });
    }

    // Always compute current merchant rating from reviews to avoid stale profile stats.
    const live = await Review.findOne({
      attributes: [
        [fn("COUNT", col("Review.id")), "cnt"],
        [fn("AVG", col("Review.rating")), "avg"],
      ],
      include: [
        {
          model: MerchentStore,
          as: "product",
          attributes: [],
          where: { merchantId: merchantUserId },
        },
      ],
      where: { isActive: true },
      raw: true,
    });

    const liveTotalReviews = Number(live?.cnt || 0);
    const liveAverageRating = liveTotalReviews ? Number(Number(live?.avg || 0).toFixed(2)) : 0;

    const merchantJson = merchantUser.toJSON();
    const fallbackProfile = profileById ? profileById.toJSON() : {};
    merchantJson.merchantProfile = {
      ...(fallbackProfile || {}),
      ...(merchantJson.merchantProfile || {}),
      averageRating: liveAverageRating,
      totalReviews: liveTotalReviews,
    };

    // 2. Get Products
    const productWhere = { merchantId: merchantUserId, stock: { [Op.gt]: 0 } };

    if (searchTerm) {
      productWhere[Op.or] = [
        { name: { [Op.like]: `%${searchTerm}%` } },
        { category: { [Op.like]: `%${searchTerm}%` } },
        { subCategory: { [Op.like]: `%${searchTerm}%` } },
      ];
    }

    if (categoryTerm) {
      productWhere.category = { [Op.like]: `%${categoryTerm}%` };
    }

    const sortOrders = {
      newest:     [["createdAt", "DESC"]],
      oldest:     [["createdAt", "ASC"]],
      price_low:  [["price", "ASC"]],
      price_high: [["price", "DESC"]],
      popular:    [["soldCount", "DESC"], ["createdAt", "DESC"]],
      rating:     [["averageRating", "DESC"], ["totalReviews", "DESC"]],
    };
    const order = sortOrders[sort] || sortOrders.newest;

    const { rows, count } = await MerchentStore.findAndCountAll({
      where: productWhere,
      attributes: { exclude: ["description"] },
      order,
      limit: limitNum,
      offset,
    });

    return res.json({
      success: true,
      merchant: merchantJson,
      products: rows,
      meta: {
        total: count,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(count / limitNum),
      },
    });
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
};
