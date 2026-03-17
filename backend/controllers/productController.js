const Product = require('../models/Product');
const User = require('../models/Authentication');
const MerchentStore = require('../models/MerchentStore');
const ProductDailyStat = require('../models/ProductDailyStat');
const Category = require('../models/Category');
const SubCategory = require('../models/SubCategory');
const MerchantProfile = require('../models/MerchantProfile');
const Review = require('../models/Review');
const { Op, Sequelize, fn, col } = require('sequelize');
const { appendAdminHistory } = require("../utils/adminHistory");
const RANK_CACHE_TTL_MS = 30 * 1000;
const rankCache = new Map();

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

const BN_DIGIT_MAP = {
  "\u09E6": "0",
  "\u09E7": "1",
  "\u09E8": "2",
  "\u09E9": "3",
  "\u09EA": "4",
  "\u09EB": "5",
  "\u09EC": "6",
  "\u09ED": "7",
  "\u09EE": "8",
  "\u09EF": "9",
};

const SEARCH_SYNONYM_GROUPS = [
  ["mobile", "mobail", "phone", "smartphone", "\u09AE\u09CB\u09AC\u09BE\u0987\u09B2", "\u09AB\u09CB\u09A8"],
  ["laptop", "notebook", "\u09B2\u09CD\u09AF\u09BE\u09AA\u099F\u09AA"],
  ["computer", "pc", "desktop", "\u0995\u09AE\u09CD\u09AA\u09BF\u0989\u099F\u09BE\u09B0", "\u09A1\u09C7\u09B8\u09CD\u0995\u099F\u09AA"],
  ["fridge", "refrigerator", "\u09AB\u09CD\u09B0\u09BF\u099C"],
  ["tv", "television", "\u099F\u09BF\u09AD\u09BF"],
  ["watch", "smartwatch", "\u0998\u09DC\u09BF", "\u0998\u09A1\u09BC\u09BF"],
];

const normalizeSearchText = (value = "") => {
  const asString = String(value || "");
  const normalizedDigits = asString.replace(/[\u09E6-\u09EF]/g, (d) => BN_DIGIT_MAP[d] || d);
  return normalizedDigits
    .toLowerCase()
    .replace(/[`~!@#$%^&*()_|+\-=?;:'",.<>{}\[\]\\\/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const expandSearchTerms = (query = "") => {
  const normalized = normalizeSearchText(query);
  const baseTerms = normalized.split(" ").filter(Boolean);
  const terms = new Set(baseTerms);

  for (const token of baseTerms) {
    for (const group of SEARCH_SYNONYM_GROUPS) {
      if (group.includes(token)) {
        for (const w of group) terms.add(normalizeSearchText(w));
      }
    }
  }

  return Array.from(terms).slice(0, 10);
};

const buildTermOrConditions = (term) => {
  const likeTerm = `%${term}%`;
  return [
    { name: { [Op.like]: likeTerm } },
    { category: { [Op.like]: likeTerm } },
    { subCategory: { [Op.like]: likeTerm } },
    { description: { [Op.like]: likeTerm } },
    Sequelize.where(Sequelize.literal("LOWER(CAST(`keywords` AS CHAR))"), { [Op.like]: likeTerm }),
  ];
};

const attachMerchantSummary = async (rows = []) => {
  const source = Array.isArray(rows) ? rows : [];
  if (!source.length) return [];

  const baseRows = source.map((row) => (typeof row?.toJSON === "function" ? row.toJSON() : row));
  const merchantIds = [...new Set(baseRows.map((r) => Number(r?.merchantId)).filter((id) => Number.isFinite(id) && id > 0))];

  if (!merchantIds.length) {
    return baseRows.map((r) => ({ ...r, merchant: null }));
  }

  const merchants = await User.findAll({
    where: { id: merchantIds },
    attributes: ["id", "name", "imageUrl"],
    raw: true,
  });

  const merchantMap = new Map(merchants.map((m) => [Number(m.id), m]));
  return baseRows.map((r) => ({
    ...r,
    merchant: merchantMap.get(Number(r.merchantId)) || null,
  }));
};

const num = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

const discountPct = (row = {}) => {
  const p = num(row.price, 0);
  const o = num(row.oldPrice, 0);
  if (o > p && p > 0) return ((o - p) / o) * 100;
  return 0;
};

const recencyBoost = (row = {}) => {
  const createdAt = row?.createdAt ? new Date(row.createdAt).getTime() : 0;
  if (!createdAt) return 0;
  const ageDays = (Date.now() - createdAt) / (1000 * 60 * 60 * 24);
  return Math.max(0, 30 - ageDays);
};

const buildRecentTrendMap = async (rows = []) => {
  const ids = [...new Set((rows || []).map((r) => num(r?.id, 0)).filter((id) => id > 0))];
  if (!ids.length) return new Map();

  const since = new Date();
  since.setDate(since.getDate() - 7);
  const sinceDate = since.toISOString().slice(0, 10);

  const stats = await ProductDailyStat.findAll({
    where: {
      productId: { [Op.in]: ids },
      statDate: { [Op.gte]: sinceDate },
    },
    attributes: [
      "productId",
      [Sequelize.fn("SUM", Sequelize.col("views")), "views"],
      [Sequelize.fn("SUM", Sequelize.col("addToCart")), "addToCart"],
      [Sequelize.fn("SUM", Sequelize.col("purchases")), "purchases"],
      [Sequelize.fn("SUM", Sequelize.col("soldQty")), "soldQty"],
      [Sequelize.fn("SUM", Sequelize.col("revenue")), "revenue"],
    ],
    group: ["productId"],
    raw: true,
  });

  const map = new Map();
  for (const s of stats) {
    const pid = num(s.productId, 0);
    if (!pid) continue;
    map.set(pid, {
      views: num(s.views, 0),
      addToCart: num(s.addToCart, 0),
      purchases: num(s.purchases, 0),
      soldQty: num(s.soldQty, 0),
      revenue: num(s.revenue, 0),
    });
  }
  return map;
};

const trendScore = (row = {}, trendMap = new Map()) => {
  const t = trendMap.get(num(row.id, 0)) || {};
  return (
    num(t.purchases, 0) * 80 +
    num(t.soldQty, 0) * 25 +
    num(t.addToCart, 0) * 8 +
    num(t.views, 0) * 1 +
    num(t.revenue, 0) * 0.02
  );
};

const hasTrendSignal = (row = {}, trendMap = new Map()) => {
  const t = trendMap.get(num(row.id, 0)) || {};
  return (
    num(t.views, 0) > 0 ||
    num(t.addToCart, 0) > 0 ||
    num(t.purchases, 0) > 0 ||
    num(t.soldQty, 0) > 0 ||
    num(t.revenue, 0) > 0
  );
};

const rowScore = (row = {}, sort = "smart", trendMap = new Map()) => {
  const rating = num(row.averageRating, 0);
  const reviews = num(row.totalReviews, 0);
  const sold = num(row.soldCount, 0);
  const price = num(row.price, 0);
  const disc = discountPct(row);
  const fresh = recencyBoost(row);
  const trend = trendScore(row, trendMap);

  switch (sort) {
    case "newest":
      return row?.createdAt ? new Date(row.createdAt).getTime() : 0;
    case "oldest":
      return -1 * (row?.createdAt ? new Date(row.createdAt).getTime() : 0);
    case "price_low":
      return -price;
    case "price_high":
      return price;
    case "rating":
      return rating * 1000 + reviews * 2 + trend * 0.05;
    case "discount":
      return disc * 100 + trend * 0.1 + fresh;
    case "popular":
      return trend + sold * 5 + rating * 8 + reviews * 0.2;
    case "trending":
      return trend * 3 + sold * 8 + rating * 5 + reviews * 0.1;
    case "smart":
    default:
      return (
        trend * 1 +
        rating * 28 +
        Math.min(reviews, 200) * 0.35 +
        Math.min(sold, 1000) * 0.08 +
        disc * 0.9 +
        fresh * 0.12
      );
  }
};

const collapseAndRankByBaseProduct = (rows = [], sort = "smart", trendMap = new Map()) => {
  const source = (rows || []).map((row) => (typeof row?.toJSON === "function" ? row.toJSON() : row));
  const bestByBase = new Map();

  for (const row of source) {
    const baseId = num(row.productId, 0) || num(row.id, 0);
    if (!baseId) continue;
    const currentBest = bestByBase.get(baseId);
    if (!currentBest) {
      bestByBase.set(baseId, row);
      continue;
    }
    const currentScore = rowScore(row, sort, trendMap);
    const bestScore = rowScore(currentBest, sort, trendMap);
    if (currentScore > bestScore) {
      bestByBase.set(baseId, row);
    } else if (currentScore === bestScore) {
      const currentCreated = row?.createdAt ? new Date(row.createdAt).getTime() : 0;
      const bestCreated = currentBest?.createdAt ? new Date(currentBest.createdAt).getTime() : 0;
      if (currentCreated > bestCreated || (currentCreated === bestCreated && num(row.id, 0) < num(currentBest.id, 0))) {
        bestByBase.set(baseId, row);
      }
    }
  }

  const ranked = Array.from(bestByBase.values()).sort((a, b) => {
    // In ranking-driven lists, products with real interaction history come first.
    if (sort === "smart" || sort === "popular" || sort === "trending") {
      const aHasTrend = hasTrendSignal(a, trendMap) ? 1 : 0;
      const bHasTrend = hasTrendSignal(b, trendMap) ? 1 : 0;
      if (aHasTrend !== bHasTrend) return bHasTrend - aHasTrend;
    }

    const sa = rowScore(a, sort, trendMap);
    const sb = rowScore(b, sort, trendMap);
    if (sa !== sb) return sb - sa;
    const aCreated = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bCreated = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (aCreated !== bCreated) return bCreated - aCreated;
    return num(a.id, 0) - num(b.id, 0);
  });

  return ranked;
};

const rankRowsWithoutCollapse = (rows = [], sort = "smart", trendMap = new Map()) => {
  const source = (rows || []).map((row) => (typeof row?.toJSON === "function" ? row.toJSON() : row));
  return source.sort((a, b) => {
    if (sort === "smart" || sort === "popular" || sort === "trending") {
      const aHasTrend = hasTrendSignal(a, trendMap) ? 1 : 0;
      const bHasTrend = hasTrendSignal(b, trendMap) ? 1 : 0;
      if (aHasTrend !== bHasTrend) return bHasTrend - aHasTrend;
    }

    const sa = rowScore(a, sort, trendMap);
    const sb = rowScore(b, sort, trendMap);
    if (sa !== sb) return sb - sa;

    const aCreated = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bCreated = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (aCreated !== bCreated) return bCreated - aCreated;
    return num(a.id, 0) - num(b.id, 0);
  });
};

const cleanupRankCache = () => {
  const now = Date.now();
  for (const [key, entry] of rankCache.entries()) {
    if (!entry || now - entry.createdAt > RANK_CACHE_TTL_MS) {
      rankCache.delete(key);
    }
  }
};

const quoteIdentifier = (value = "") => `\`${String(value).replace(/`/g, "``")}\``;

const getDailyStatTableSql = () => {
  const raw = ProductDailyStat.getTableName();
  if (typeof raw === "string") return quoteIdentifier(raw);
  if (raw && typeof raw === "object" && raw.tableName) return quoteIdentifier(raw.tableName);
  return quoteIdentifier("ProductDailyStats");
};

const buildScoreSql = (sort = "smart", sinceDate = "", alias = "MerchentStore") => {
  const a = quoteIdentifier(alias);
  const statTable = getDailyStatTableSql();
  const safeSinceDate = String(sinceDate || "").slice(0, 10);
  const viewsSql = `COALESCE((SELECT SUM(pds.views) FROM ${statTable} pds WHERE pds.productId = ${a}.id AND pds.statDate >= '${safeSinceDate}'), 0)`;
  const addToCartSql = `COALESCE((SELECT SUM(pds.addToCart) FROM ${statTable} pds WHERE pds.productId = ${a}.id AND pds.statDate >= '${safeSinceDate}'), 0)`;
  const purchasesSql = `COALESCE((SELECT SUM(pds.purchases) FROM ${statTable} pds WHERE pds.productId = ${a}.id AND pds.statDate >= '${safeSinceDate}'), 0)`;
  const soldQtySql = `COALESCE((SELECT SUM(pds.soldQty) FROM ${statTable} pds WHERE pds.productId = ${a}.id AND pds.statDate >= '${safeSinceDate}'), 0)`;
  const revenueSql = `COALESCE((SELECT SUM(pds.revenue) FROM ${statTable} pds WHERE pds.productId = ${a}.id AND pds.statDate >= '${safeSinceDate}'), 0)`;
  const trendSql = `(${purchasesSql} * 80 + ${soldQtySql} * 25 + ${addToCartSql} * 8 + ${viewsSql} * 1 + ${revenueSql} * 0.02)`;
  const ratingSql = `COALESCE(${a}.averageRating, 0)`;
  const reviewsSql = `COALESCE(${a}.totalReviews, 0)`;
  const soldSql = `COALESCE(${a}.soldCount, 0)`;
  const priceSql = `COALESCE(${a}.price, 0)`;
  const discountSql = `(CASE WHEN COALESCE(${a}.oldPrice, 0) > COALESCE(${a}.price, 0) AND COALESCE(${a}.price, 0) > 0 THEN ((COALESCE(${a}.oldPrice, 0) - COALESCE(${a}.price, 0)) / COALESCE(${a}.oldPrice, 0)) * 100 ELSE 0 END)`;
  const freshSql = `GREATEST(0, 30 - TIMESTAMPDIFF(DAY, ${a}.createdAt, NOW()))`;
  const createdTsSql = `UNIX_TIMESTAMP(${a}.createdAt)`;

  switch (String(sort || "smart").toLowerCase()) {
    case "newest":
      return createdTsSql;
    case "oldest":
      return `(-1 * ${createdTsSql})`;
    case "price_low":
      return `(-1 * ${priceSql})`;
    case "price_high":
      return priceSql;
    case "rating":
      return `(${ratingSql} * 1000 + ${reviewsSql} * 2 + ${trendSql} * 0.05)`;
    case "discount":
      return `(${discountSql} * 100 + ${trendSql} * 0.1 + ${freshSql})`;
    case "popular":
      return `(${trendSql} + ${soldSql} * 5 + ${ratingSql} * 8 + ${reviewsSql} * 0.2)`;
    case "trending":
      return `(${trendSql} * 3 + ${soldSql} * 8 + ${ratingSql} * 5 + ${reviewsSql} * 0.1)`;
    case "smart":
    default:
      return `(${trendSql} * 1 + ${ratingSql} * 28 + LEAST(${reviewsSql}, 200) * 0.35 + LEAST(${soldSql}, 1000) * 0.08 + ${discountSql} * 0.9 + ${freshSql} * 0.12)`;
  }
};

const fetchRankedPublicRows = async ({
  where,
  sort,
  offset,
  limit,
  mode = "unique",
  snapshotAt,
  cacheKey,
}) => {
  cleanupRankCache();
  const requestCacheKey = cacheKey ? `${cacheKey}|mode:${mode}|offset:${offset}|limit:${limit}` : null;
  const cached = requestCacheKey ? rankCache.get(requestCacheKey) : null;
  if (cached && Date.now() - cached.createdAt <= RANK_CACHE_TTL_MS) {
    return { rows: cached.rows, total: cached.total };
  }

  const snapshotDate = new Date(Number(snapshotAt) || Date.now());
  const since = new Date();
  since.setDate(since.getDate() - 7);
  const sinceDate = since.toISOString().slice(0, 10);
  const scoreSql = buildScoreSql(sort, sinceDate);
  const effectiveWhere = {
    ...where,
    updatedAt: {
      ...(where.updatedAt || {}),
      [Op.lte]: snapshotDate,
    },
  };

  if (mode === "all") {
    const total = await MerchentStore.count({ where: effectiveWhere });
    if (!total) return { rows: [], total: 0 };

    const rows = await MerchentStore.findAll({
      where: effectiveWhere,
      order: [
        [Sequelize.literal(scoreSql), "DESC"],
        ["createdAt", "DESC"],
        ["id", "ASC"],
      ],
      limit,
      offset,
    });

    if (requestCacheKey) {
      rankCache.set(requestCacheKey, {
        createdAt: Date.now(),
        total,
        rows,
      });
    }
    return { rows, total };
  }

  const total = await MerchentStore.count({
    where: effectiveWhere,
    distinct: true,
    col: "productId",
  });
  if (!total) return { rows: [], total: 0 };

  const grouped = await MerchentStore.findAll({
    where: effectiveWhere,
    attributes: [
      "productId",
      [Sequelize.literal(`MAX(${scoreSql})`), "bestScore"],
      [Sequelize.fn("MAX", Sequelize.col("createdAt")), "latestCreatedAt"],
      [Sequelize.fn("MIN", Sequelize.col("id")), "minId"],
    ],
    group: ["productId"],
    order: [
      [Sequelize.literal("bestScore"), "DESC"],
      [Sequelize.literal("latestCreatedAt"), "DESC"],
      [Sequelize.literal("minId"), "ASC"],
    ],
    limit,
    offset,
    raw: true,
  });

  const pageProductIds = grouped
    .map((x) => Number(x.productId))
    .filter((x) => Number.isFinite(x) && x > 0);
  if (!pageProductIds.length) return { rows: [], total };

  const candidateRows = await MerchentStore.findAll({
    where: {
      ...effectiveWhere,
      productId: { [Op.in]: pageProductIds },
    },
    order: [
      [Sequelize.literal(scoreSql), "DESC"],
      ["createdAt", "DESC"],
      ["id", "ASC"],
    ],
  });

  const trendMap = await buildRecentTrendMap(candidateRows);
  const deduped = collapseAndRankByBaseProduct(candidateRows, sort, trendMap);
  const byProductId = new Map(
    deduped.map((row) => {
      const base = typeof row?.toJSON === "function" ? row.toJSON() : row;
      return [Number(base.productId || base.id), base];
    })
  );
  const rows = pageProductIds.map((pid) => byProductId.get(Number(pid))).filter(Boolean);

  if (requestCacheKey) {
    rankCache.set(requestCacheKey, {
      createdAt: Date.now(),
      total,
      rows,
    });
  }

  return { rows, total };
};

const collectDescendantSubCategorySlugs = (list = [], rootIds = new Set()) => {
  const rows = Array.isArray(list) ? list : [];
  if (!rows.length || !rootIds.size) return [];

  const childrenByParent = new Map();
  for (const row of rows) {
    const parentId = Number(row.parentSubCategoryId || 0);
    if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, []);
    childrenByParent.get(parentId).push(row);
  }

  const slugs = new Set();
  const queue = [...rootIds];
  const visited = new Set();

  while (queue.length) {
    const currentId = Number(queue.shift());
    if (!currentId || visited.has(currentId)) continue;
    visited.add(currentId);

    const current = rows.find((x) => Number(x.id) === currentId);
    const currentSlug = String(current?.slug || "").trim();
    if (currentSlug) slugs.add(currentSlug);

    const children = childrenByParent.get(currentId) || [];
    for (const child of children) queue.push(Number(child.id));
  }

  return Array.from(slugs);
};

const resolveSubCategoryScope = async ({ categorySlug = "", subCategorySlug = "" }) => {
  const cleanSub = String(subCategorySlug || "").trim();
  const cleanCategory = String(categorySlug || "").trim();
  if (!cleanSub) return [];

  let categoryIds = [];
  if (cleanCategory) {
    const cat = await Category.findOne({
      where: { slug: cleanCategory },
      attributes: ["id"],
      raw: true,
    });
    if (!cat?.id) return [cleanSub];
    categoryIds = [Number(cat.id)];
  }

  const where = { slug: cleanSub };
  if (categoryIds.length) where.categoryId = { [Op.in]: categoryIds };

  const roots = await SubCategory.findAll({
    where,
    attributes: ["id", "categoryId", "slug"],
    raw: true,
  });

  if (!roots.length) return [cleanSub];

  const scopedCategoryIds = [...new Set(roots.map((r) => Number(r.categoryId)).filter(Boolean))];
  const treeRows = await SubCategory.findAll({
    where: { categoryId: { [Op.in]: scopedCategoryIds } },
    attributes: ["id", "parentSubCategoryId", "slug", "categoryId"],
    raw: true,
  });

  const rootIds = new Set(roots.map((r) => Number(r.id)).filter(Boolean));
  const slugs = collectDescendantSubCategorySlugs(treeRows, rootIds);
  return slugs.length ? slugs : [cleanSub];
};


// for user
exports.getPublicProducts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 24,
      search = "",
      category = "",
      subCategory = "",
      sort = "smart",
      mode = "unique",
      snapshotAt = "",
    } = req.query;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 24, 1), 100);
    const offset = (pageNum - 1) * limitNum;

    const where = {};

    // only available stock
    where.stock = { [Op.gt]: 0 };

    // category exact match
    if (category && category.trim()) {
      where.category = category.trim();
    }
    if (subCategory && subCategory.trim()) {
      const nestedSubCategorySlugs = await resolveSubCategoryScope({
        categorySlug: category,
        subCategorySlug: subCategory,
      });
      where.subCategory = nestedSubCategorySlugs.length > 1
        ? { [Op.in]: nestedSubCategorySlugs }
        : nestedSubCategorySlugs[0];
    }

    // search by name/category
    if (search && search.trim()) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search.trim()}%` } },
        { category: { [Op.like]: `%${search.trim()}%` } },
        { subCategory: { [Op.like]: `%${search.trim()}%` } },
        Sequelize.where(
          Sequelize.literal("LOWER(CAST(`keywords` AS CHAR))"),
          { [Op.like]: `%${search.trim().toLowerCase()}%` }
        ),
      ];
    }

    const selectedSort = String(sort || "smart").toLowerCase();
    const selectedMode = String(mode || "unique").toLowerCase() === "all" ? "all" : "unique";
    const snapshotTs = Number(snapshotAt) > 0 ? Number(snapshotAt) : Date.now();
    const cacheKey = JSON.stringify({
      selectedSort,
      selectedMode,
      category: category || "",
      subCategory: subCategory || "",
      search: search || "",
      snapshotTs,
    });

    const { rows, total } = await fetchRankedPublicRows({
      where,
      sort: selectedSort,
      offset,
      limit: limitNum,
      mode: selectedMode,
      snapshotAt: snapshotTs,
      cacheKey,
    });

    const rowsWithMerchant = await attachMerchantSummary(rows);

    return res.json({
      data: rowsWithMerchant,
      meta: {
        sort: selectedSort,
        mode: selectedMode,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
        hasNext: pageNum * limitNum < total,
        hasPrev: pageNum > 1,
        snapshotAt: snapshotTs,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getPublicProductById = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await MerchentStore.findOne({
      where: {
        id,
        // stock filter সরানো হয়েছে — out of stock product ও return হবে
      },
      include: [
        {
          model: User,
          as: "merchant",
          attributes: ["id", "name", "imageUrl", "createdAt"],
          include: [
            {
              model: MerchantProfile,
              as: "merchantProfile",
              attributes: ["averageRating", "totalReviews"],
            },
          ],
        },
      ],
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // compute merchant's live aggregate rating from all active reviews across their products
    let merchantRating = product.merchant?.merchantProfile?.averageRating || 0;
    let merchantReviews = product.merchant?.merchantProfile?.totalReviews || 0;

    if (product.merchant) {
      try {
        const row = await Review.findOne({
          attributes: [
            [fn("COUNT", col("Review.id")), "cnt"],
            [fn("AVG", col("Review.rating")), "avg"],
          ],
          include: [{
            model: MerchentStore,
            as: "product",
            where: { merchantId: product.merchant.id },
            attributes: [],
          }],
          where: { isActive: true },
          raw: true,
        });
        const total = Number(row?.cnt || 0);
        const avg = Number(row?.avg || 0);
        if (total > 0) {
          merchantRating = Number(avg.toFixed(2));
          merchantReviews = total;
          // keep stored profile in sync
          await MerchantProfile.update(
            { averageRating: merchantRating, totalReviews: merchantReviews },
            { where: { userId: product.merchant.id } }
          );
        }
      } catch (e) {
        // non-fatal: fall back to stored profile value
      }
    }

    // frontend friendly shape
    return res.json({
      success: true,
      product: {
        ...product.toJSON(),
        merchant: product.merchant
          ? {
              id: product.merchant.id,
              name: product.merchant.name,
              logo: product.merchant.imageUrl,
              rating: merchantRating,
              reviews: merchantReviews,
              joinedAt: product.merchant.createdAt,
            }
          : null,
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.getRelatedPublicProducts = async (req, res) => {
  try {
    const { id } = req.params;
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 8, 1), 24);

    const current = await MerchentStore.findOne({
      where: { id, stock: { [Op.gt]: 0 } },
      attributes: ["id", "category", "subCategory", "merchantId"],
    });

    if (!current) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    const baseWhere = {
      id: { [Op.ne]: current.id },
      stock: { [Op.gt]: 0 },
    };

    const subCategory = String(current.subCategory || "").trim();
    const category = String(current.category || "").trim();

    let rows = [];

    if (subCategory) {
      rows = await MerchentStore.findAll({
        where: { ...baseWhere, subCategory },
        order: [
          ["averageRating", "DESC"],
          ["totalReviews", "DESC"],
          ["soldCount", "DESC"],
          ["createdAt", "DESC"],
        ],
        limit,
      });
    }

    if (rows.length < limit && category) {
      const excludeIds = [current.id, ...rows.map((r) => r.id)];
      const more = await MerchentStore.findAll({
        where: {
          ...baseWhere,
          category,
          id: { [Op.notIn]: excludeIds },
        },
        order: [
          ["averageRating", "DESC"],
          ["totalReviews", "DESC"],
          ["soldCount", "DESC"],
          ["createdAt", "DESC"],
        ],
        limit: limit - rows.length,
      });
      rows = [...rows, ...more];
    }

    if (rows.length < limit && current.merchantId) {
      const excludeIds = [current.id, ...rows.map((r) => r.id)];
      const more = await MerchentStore.findAll({
        where: {
          ...baseWhere,
          merchantId: current.merchantId,
          id: { [Op.notIn]: excludeIds },
        },
        order: [["createdAt", "DESC"]],
        limit: limit - rows.length,
      });
      rows = [...rows, ...more];
    }

    return res.json({
      success: true,
      products: rows,
      relatedBy: subCategory ? "subCategory" : category ? "category" : "merchant",
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

//search


exports.search = async (req, res) => {
  try {
    const query = String(req.query.query || "").trim();
    const normalizedQuery = normalizeSearchText(query);
    const pageNum = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(req.query.limit, 10) || 24, 1), 100);
    const offset = (pageNum - 1) * limitNum;
    const sort = String(req.query.sort || "smart").toLowerCase();
    const snapshotTs = Number(req.query.snapshotAt) > 0 ? Number(req.query.snapshotAt) : Date.now();

    const baseTerms = normalizedQuery.split(" ").filter(Boolean).slice(0, 8);
    const expandedTerms = expandSearchTerms(query);

    if (!normalizedQuery) {
      return res.status(200).json({
        success: true,
        query: null,
        data: [],
        products: [],
        meta: {
          sort,
          page: pageNum,
          limit: limitNum,
          total: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false,
          strategy: "empty_query",
          terms: [],
        },
      });
    }

    const baseWhere = {
      stock: { [Op.gt]: 0 },
    };

    // strict strategy: every base term must match at least one searchable field
    const strictWhere = {
      ...baseWhere,
      [Op.and]: baseTerms.map((term) => ({ [Op.or]: buildTermOrConditions(term) })),
    };

    // relaxed strategy fallback: any expanded term may match
    const relaxedWhere = {
      ...baseWhere,
      [Op.or]: expandedTerms.flatMap((term) => buildTermOrConditions(term)),
    };

    const runSearch = async (where, strategyName) =>
      fetchRankedPublicRows({
        where,
        sort,
        offset,
        limit: limitNum,
        snapshotAt: snapshotTs,
        cacheKey: JSON.stringify({ sort, query: normalizedQuery, strategy: strategyName, snapshotTs }),
      });

    let strategy = "strict";
    let { rows, total } = await runSearch(strictWhere, "strict");

    if (total === 0 && expandedTerms.length > 0) {
      strategy = "relaxed";
      const fallback = await runSearch(relaxedWhere, "relaxed");
      rows = fallback.rows;
      total = fallback.total;
    }
    const uniqueRowsWithMerchant = await attachMerchantSummary(rows);

    return res.status(200).json({
      success: true,
      query: query || null,
      data: uniqueRowsWithMerchant,
      products: uniqueRowsWithMerchant,
      meta: {
        sort,
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
        hasNext: pageNum * limitNum < total,
        hasPrev: pageNum > 1,
        strategy,
        terms: expandedTerms,
        snapshotAt: snapshotTs,
      },
    });
  } catch (error) {

    return res.status(500).json({
      success: false,
      message: 'Server error while searching products',
      error: error.message,
    });
  }
};


// for admin


// upload a product this is for admin
exports.createProduct = async (req, res) => {
    try {
        const body = req.body || {};
        const requestedCategoryId = Number(body.categoryId);
        const requestedSubCategoryId = Number(body.subCategoryId);

        const categoryById = Number.isFinite(requestedCategoryId) && requestedCategoryId > 0
          ? await Category.findByPk(requestedCategoryId, { attributes: ["id", "name", "slug"] })
          : null;

        const categoryBySlug = !categoryById && body.category
          ? await Category.findOne({
              where: {
                [Op.or]: [
                  { slug: String(body.category).trim() },
                  { name: String(body.category).trim() },
                ],
              },
              attributes: ["id", "name", "slug"],
            })
          : null;

        let resolvedCategory = categoryById || categoryBySlug || null;

        let resolvedSubCategory = null;
        if (Number.isFinite(requestedSubCategoryId) && requestedSubCategoryId > 0) {
          resolvedSubCategory = await SubCategory.findByPk(requestedSubCategoryId, {
            attributes: ["id", "categoryId", "name", "slug"],
          });
        } else if (body.subCategory) {
          const subWhere = {
            [Op.or]: [
              { slug: String(body.subCategory).trim() },
              { name: String(body.subCategory).trim() },
            ],
          };
          if (resolvedCategory?.id) subWhere.categoryId = Number(resolvedCategory.id);
          resolvedSubCategory = await SubCategory.findOne({
            where: subWhere,
            attributes: ["id", "categoryId", "name", "slug"],
          });
        }

        if (!resolvedCategory && resolvedSubCategory?.categoryId) {
          resolvedCategory = await Category.findByPk(Number(resolvedSubCategory.categoryId), {
            attributes: ["id", "name", "slug"],
          });
        }

        if (!resolvedCategory) {
          return res.status(400).json({ message: "Valid category is required." });
        }

        if (
          resolvedSubCategory &&
          Number(resolvedSubCategory.categoryId) !== Number(resolvedCategory.id)
        ) {
          return res.status(400).json({
            message: "Selected subcategory does not belong to selected category.",
          });
        }

        const productData = {
            name: body.name,
            description: body.description,
            price:  body.price ? parseFloat(body.price) : null,
            oldPrice: body.oldPrice ? parseFloat(body.oldPrice) : null,
            stock: parseInt(body.stock),
            category: String(resolvedCategory.slug || resolvedCategory.name || "").trim() || null,
            subCategory: resolvedSubCategory
              ? String(resolvedSubCategory.slug || resolvedSubCategory.name || "").trim()
              : null,
            images: (Array.isArray(body.imageUrl) ? body.imageUrl : [])
              .map(normalizeStoredImagePath)
              .filter(Boolean),
        };


        if (!productData.name || (!productData.price)) {
            return res.status(400).json({ message: "Name and valid Price are required fields." });
        }
        if (productData.price < 0) {
            return res.status(400).json({ message: "Price cannot be negative." });
        }

        const savedProduct = await Product.create(productData);
        const actorId = req.user?.id || req.userId || null;
        await appendAdminHistory(
          `Admin product created. Product #${savedProduct.id} (${savedProduct.name}) by admin #${actorId || "unknown"}.`,
          {
            meta: {
              type: "admin_product_created",
              actorId,
              productId: savedProduct.id,
              name: savedProduct.name,
              category: savedProduct.category || null,
              subCategory: savedProduct.subCategory || null,
              price: Number(savedProduct.price || 0),
              stock: Number(savedProduct.stock || 0),
            },
          }
        );

        res.status(201).json({
            message: "Product created successfully!",
            product: savedProduct
        });

    } catch (error) {

        res.status(400).json({ 
            message: "Error creating product", 
            error: error.message 
        });
    }
};
