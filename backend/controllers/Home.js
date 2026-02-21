const { Op } = require("sequelize");
const ProductDailyStat = require("../models/ProductDailyStat");
const MerchentStore = require("../models/MerchentStore");
const User = require("../models/Authentication");
const MerchentProfile = require("../models/MerchantProfile");

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

exports.getHomeSections = async (req, res) => {
  try {
    const days = Number(req.query.days || 7);
    const limit = Number(req.query.limit || 30);
    const flashPage = Math.max(Number(req.query.flashPage || 1), 1);
    const flashLimit = Math.min(
      Math.max(Number(req.query.flashLimit || 10), 1),
      100
    );

    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceDate = since.toISOString().slice(0, 10); // YYYY-MM-DD

    // 1) Stats last N days (raw)
    const stats = await ProductDailyStat.findAll({
      where: { statDate: { [Op.gte]: sinceDate } },
      attributes: [
        "productId",
        "views",
        "addToCart",
        "purchases",
        "soldQty",
        "revenue",
      ],
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
      where: productIds.length ? { id: { [Op.in]: productIds } } : {},
      include: [
        {
          model: User,
          as: "merchant",
          attributes: ["id", "name", "imageUrl"],
          required: false,
          include: [
            {
              model: MerchentProfile,
              as: "merchantProfile",
              required: false,
            },
          ],
        },
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
    const rankedTrending = productJson
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

    // 4) Flash sale = biggest discount (stock > 0)
    const flash = await MerchentStore.findAll({
      where: { stock: { [Op.gt]: 0 } },
      order: [["createdAt", "DESC"]],
    });

    const flashRanked = flash
      .map((p) => {
        const j = p.toJSON();
        const discountPct = calcDiscountPct(j.price, j.oldPrice);
        return { ...j, discountPct, images: cleanImages(j.images) };
      })
      .filter((p) => Number(p.discountPct || 0) > 0)
      .sort((a, b) => (b.discountPct || 0) - (a.discountPct || 0))
    const flashTotal = flashRanked.length;
    const flashTotalPages = Math.ceil(flashTotal / flashLimit) || 1;
    const flashStart = (flashPage - 1) * flashLimit;
    const flashPaged = flashRanked.slice(flashStart, flashStart + flashLimit);

    // 5) Category sections (trending থেকে ভাগ করা)
    const categories = {};
    for (const p of rankedTrending) {
      const c = p.category || "General";
      if (!categories[c]) categories[c] = [];
      if (categories[c].length < 12) categories[c].push(p);
    }

    return res.json({
      success: true,
      days,
      trending: rankedTrending,
      flash: flashPaged,
      flashMeta: {
        page: flashPage,
        limit: flashLimit,
        total: flashTotal,
        totalPages: flashTotalPages,
        hasNext: flashPage < flashTotalPages,
        hasPrev: flashPage > 1,
      },
      categorySections: Object.entries(categories).map(
        ([category, products]) => ({
          category,
          products,
        })
      ),
    });
  } catch (e) {
    console.error("getHomeSections error:", e);
    return res
      .status(500)
      .json({ success: false, message: e.message, stack: e.stack });
  }
};
