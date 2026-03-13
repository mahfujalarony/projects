const { Op, fn, col, literal } = require("sequelize");
const ProductDailyStat = require("../models/ProductDailyStat");
const MerchentStore = require("../models/MerchentStore");
const User = require("../models/Authentication");
const HomeCache = require("../models/HomeCache");

const HOME_SECTIONS_CACHE_VERSION = "v1";
const HOME_SECTIONS_CACHE_TTL_SECONDS = Math.max(
  30,
  Number(process.env.HOME_SECTIONS_CACHE_TTL_SECONDS || 120)
);
const HOME_TRENDING_STATS_LIMIT = Math.min(
  5000,
  Math.max(100, Number(process.env.HOME_TRENDING_STATS_LIMIT || 1500))
);
const HOME_CACHE_KEY_MAX_LENGTH = 191;

const getDbCachedPayload = async (cacheKey) => {
  if (!cacheKey) return null;

  const row = await HomeCache.findOne({
    where: {
      cacheKey,
      expiresAt: { [Op.gt]: new Date() },
    },
    attributes: ["payload"],
    raw: true,
  });

  if (!row?.payload) return null;

  try {
    return JSON.parse(row.payload);
  } catch (_e) {
    await HomeCache.destroy({ where: { cacheKey } });
    return null;
  }
};

const setDbCachePayload = async (cacheKey, payload) => {
  if (!cacheKey || !payload) return;

  const expiresAt = new Date(Date.now() + HOME_SECTIONS_CACHE_TTL_SECONDS * 1000);
  await HomeCache.upsert({
    cacheKey: String(cacheKey).slice(0, HOME_CACHE_KEY_MAX_LENGTH),
    payload: JSON.stringify(payload),
    expiresAt,
  });
};

const cleanImages = (imgs = []) =>
  (Array.isArray(imgs) ? imgs : []).map((x) => (x || "").replace(/\\/g, "/"));

const calcDiscountPct = (price, oldPrice) => {
  const p = Number(price || 0);
  const o = Number(oldPrice || 0);
  if (o > 0 && p > 0 && o > p) return ((o - p) / o) * 100;
  return 0;
};

const calcTrendingScore = (stat, product) => {
  const { views, addToCart, purchases, soldQty, revenue } = stat;

  const discountPct = calcDiscountPct(product.price, product.oldPrice);
  const rating = Number(product.averageRating ?? product.rating ?? 0);

  const ageDays =
    (Date.now() - new Date(product.createdAt).getTime()) / (1000 * 60 * 60 * 24);
  const freshBoost = ageDays <= 7 ? 10 : ageDays <= 30 ? 5 : 0;

  const stock = Number(product.stock || 0);
  const stockPenalty = stock <= 0 ? -999 : 0;

  return (
    purchases * 80 +
    soldQty * 25 +
    addToCart * 8 +
    views * 1 +
    Number(revenue || 0) * 0.02 +
    discountPct * 1.2 +
    rating * 6 +
    freshBoost +
    stockPenalty
  );
};

const attachMerchantSummary = async (rows = []) => {
  const source = Array.isArray(rows) ? rows : [];
  if (!source.length) return [];

  const baseRows = source.map((row) => (typeof row?.toJSON === "function" ? row.toJSON() : row));
  const merchantIds = [...new Set(baseRows.map((r) => Number(r?.merchantId)).filter((id) => Number.isFinite(id) && id > 0))];

  if (!merchantIds.length) return baseRows.map((r) => ({ ...r, merchant: null }));

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

exports.getHomeSections = async (req, res) => {
  try {
    const days = Number(req.query.days || 7);
    const limit = Number(req.query.limit || 30);
    const cacheKey = `home:sections:${HOME_SECTIONS_CACHE_VERSION}:days:${days}:limit:${limit}`;

    const cached = await getDbCachedPayload(cacheKey);
    if (cached?.success && cached?.data) {
      return res.json({ ...cached.data, cached: true, cacheSource: "db" });
    }

    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceDate = since.toISOString().slice(0, 10); // YYYY-MM-DD

    // 1) Stats last N days aggregated in DB (avoids huge raw row transfer)
    const stats = await ProductDailyStat.findAll({
      where: { statDate: { [Op.gte]: sinceDate } },
      attributes: [
        "productId",
        [fn("SUM", col("views")), "views"],
        [fn("SUM", col("addToCart")), "addToCart"],
        [fn("SUM", col("purchases")), "purchases"],
        [fn("SUM", col("soldQty")), "soldQty"],
        [fn("SUM", col("revenue")), "revenue"],
      ],
      group: ["productId"],
      order: [
        [literal("SUM(purchases)"), "DESC"],
        [literal("SUM(soldQty)"), "DESC"],
        [literal("SUM(addToCart)"), "DESC"],
        [literal("SUM(views)"), "DESC"],
      ],
      limit: HOME_TRENDING_STATS_LIMIT,
      raw: true,
    });

    // sum per product
    const agg = new Map(); // productId -> sums
    for (const s of stats) {
      const id = Number(s.productId);
      if (!agg.has(id)) {
        agg.set(id, {
          productId: id,
          views: 0,
          addToCart: 0,
          purchases: 0,
          soldQty: 0,
          revenue: 0,
        });
      }
      const a = agg.get(id);
      a.views += Number(s.views || 0);
      a.addToCart += Number(s.addToCart || 0);
      a.purchases += Number(s.purchases || 0);
      a.soldQty += Number(s.soldQty || 0);
      a.revenue += Number(s.revenue || 0);
    }

    const productIds = [...agg.keys()];

    // 2) Products fetch
    const products = await MerchentStore.findAll({
      where: productIds.length
        ? { id: { [Op.in]: productIds }, stock: { [Op.gt]: 0 } }
        : { stock: { [Op.gt]: 0 } },
      attributes: [
        "id",
        "name",
        "price",
        "oldPrice",
        "images",
        "stock",
        "category",
        "subCategory",
        "merchantId",
        "averageRating",
        "totalReviews",
        "createdAt",
      ],
      // fallback: no stats -> show newest
      limit: productIds.length ? undefined : limit,
      order: productIds.length ? undefined : [["createdAt", "DESC"]],
    });

    // ✅ stock না থাকলে output এ আসবে না (trending/category/newest fallback সব জায়গায় apply হবে)
    const productJson = products
      .map((p) => p.toJSON())
      .filter((p) => Number(p.stock || 0) > 0);

    // 3) Trending rank
    const rankedTrendingBase = productJson
      .map((p) => {
        const a = agg.get(Number(p.id)) || {
          views: 0,
          addToCart: 0,
          purchases: 0,
          soldQty: 0,
          revenue: 0,
        };
        const score = calcTrendingScore(a, p);
        return {
          ...p,
          images: cleanImages(p.images),
          trending: a,
          score,
        };
      })
      .sort((x, y) => y.score - x.score)
      .slice(0, limit);
    const rankedTrending = await attachMerchantSummary(rankedTrendingBase);

    // 4) New Arrivals — 1 newest product per merchant, fair rotation
    const newArrivalsRaw = await MerchentStore.findAll({
      where: { stock: { [Op.gt]: 0 } },
      attributes: ["id", "name", "price", "oldPrice", "images", "stock",
                   "category", "subCategory", "merchantId",
                   "averageRating", "totalReviews", "createdAt"],
      order: [["createdAt", "DESC"]],
      limit: 500,
    });

    const NEW_ARRIVALS_TARGET = 30;

    // how many unique merchants have products?
    const allMerchantIds = new Set(newArrivalsRaw.map((p) => p.merchantId));
    const uniqueMerchantCount = allMerchantIds.size || 1;
    // each merchant contributes ceil(30 / merchantCount) products
    // e.g. 1 merchant → 30, 3 → 10, 10 → 3, 30+ → 1
    const maxPerMerchant = Math.max(1, Math.ceil(NEW_ARRIVALS_TARGET / uniqueMerchantCount));

    const merchantProductCounts = {};
    const newArrivalsCandidates = [];
    for (const p of newArrivalsRaw) {
      const mid = p.merchantId;
      if ((merchantProductCounts[mid] || 0) >= maxPerMerchant) continue;
      merchantProductCounts[mid] = (merchantProductCounts[mid] || 0) + 1;
      newArrivalsCandidates.push({
        ...p.toJSON(),
        images: cleanImages(p.toJSON().images),
      });
      if (newArrivalsCandidates.length >= NEW_ARRIVALS_TARGET) break;
    }

    // slight random jitter so order rotates each request → take 30
    const newArrivalsShuffled = newArrivalsCandidates
      .sort((a, b) => {
        const aTime = new Date(a.createdAt).getTime();
        const bTime = new Date(b.createdAt).getTime();
        const jitter = (Math.random() - 0.5) * 1000 * 60 * 60 * 24; // ±1 day jitter
        return (bTime + jitter) - aTime;
      })
      .slice(0, NEW_ARRIVALS_TARGET);

    const newArrivals = await attachMerchantSummary(newArrivalsShuffled);

    // 5) Category sections (trending থেকে ভাগ করা)
    const categoryMap = {};
    for (const p of rankedTrending) {
      const c = p.category || "General";
      if (!categoryMap[c]) categoryMap[c] = [];
      if (categoryMap[c].length < 12) categoryMap[c].push(p);
    }

    // 6) ourProducts — diverse: different categories + different merchants (random each request)
    const allInStockRows = await MerchentStore.findAll({
      where: { stock: { [Op.gt]: 0 } },
      attributes: ["id", "name", "price", "oldPrice", "images", "stock",
                   "category", "subCategory", "merchantId",
                   "averageRating", "totalReviews", "createdAt"],
      order: [["createdAt", "DESC"]],
      limit: 400,
    });

    const allInStockJson = allInStockRows.map((p) => ({
      ...p.toJSON(),
      images: cleanImages(p.toJSON().images),
    }));

    // group by category → per category pick max 2 per merchant, max 6 products
    const byCat = {};
    for (const p of allInStockJson) {
      const cat = p.category || "General";
      if (!byCat[cat]) byCat[cat] = [];
      byCat[cat].push(p);
    }

    const TARGET_PER_CAT = 6; // products to show per category row

    // Score a product by quality (higher = better)
    const scoreProduct = (p) => {
      const rating   = Number(p.averageRating || 0);
      const reviews  = Number(p.totalReviews  || 0);
      const discount = calcDiscountPct(p.price, p.oldPrice);
      const stock    = Number(p.stock || 0);
      const ageDays  = (Date.now() - new Date(p.createdAt).getTime()) / (1000 * 60 * 60 * 24);
      const freshBoost = ageDays <= 7 ? 8 : ageDays <= 30 ? 4 : 0;
      // small random jitter (0-3) so same-score products rotate across requests
      const jitter = Math.random() * 3;
      return rating * 12 + Math.log1p(reviews) * 5 + discount * 0.8 +
             Math.min(stock, 50) * 0.1 + freshBoost + jitter;
    };

    const ourProductsPool = [];
    for (const items of Object.values(byCat)) {
      const uniqueMerchants = new Set(items.map((p) => p.merchantId)).size;

      // Score all products in this category
      const scored = items
        .map((p) => ({ ...p, _score: scoreProduct(p) }))
        .sort((a, b) => b._score - a._score);

      // Per-merchant quota: fair share first
      const initialQuota = Math.max(1, Math.ceil(TARGET_PER_CAT / uniqueMerchants));
      const merchantCount = {};
      const picked = [];

      // Pass 1: take up to initialQuota per merchant
      for (const p of scored) {
        if (picked.length >= TARGET_PER_CAT) break;
        const mid = p.merchantId;
        if ((merchantCount[mid] || 0) < initialQuota) {
          merchantCount[mid] = (merchantCount[mid] || 0) + 1;
          picked.push(p);
        }
      }

      // Pass 2: if still below TARGET (some merchants had fewer products),
      // fill remaining slots from any merchant — best score wins
      if (picked.length < TARGET_PER_CAT) {
        const pickedIds = new Set(picked.map((p) => p.id));
        for (const p of scored) {
          if (picked.length >= TARGET_PER_CAT) break;
          if (!pickedIds.has(p.id)) {
            picked.push(p);
            pickedIds.add(p.id);
          }
        }
      }

      ourProductsPool.push(...picked.slice(0, TARGET_PER_CAT).map(({ _score, ...p }) => p));
    }

    // Keep category structure intact — shuffle within each category, no global slice
    // so ALL categories always appear regardless of total product count
    const ourProducts = await attachMerchantSummary(ourProductsPool);

    const payload = {
      success: true,
      days,
      trending: rankedTrending,
      newArrivals,
      categorySections: Object.entries(categoryMap).map(([category, products]) => ({
        category,
        products,
      })),
      ourProducts,
    };

    await setDbCachePayload(cacheKey, { success: true, data: payload });

    return res.json(payload);
  } catch (e) {

    return res
      .status(500)
      .json({ success: false, message: e.message, stack: e.stack });
  }
};
