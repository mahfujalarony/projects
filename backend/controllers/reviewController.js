// controllers/reviewController.js
const { Op, fn, col } = require("sequelize");
const sequelize = require("../config/db");
const Review = require("../models/Review");
const OrderItem = require("../models/Order");
const User = require("../models/Authentication");
const MerchentStore = require("../models/MerchentStore");
const Notification = require("../models/Notification");
const MerchantProfile = require("../models/MerchantProfile");

const clampInt = (v, d) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : d;
};

const safeTrim = (v) => (typeof v === "string" ? v.trim() : null);

async function getLiveReviewStats(productId, t) {
  const row = await Review.findOne({
    where: { productId, isActive: true },
    attributes: [
      [fn("COUNT", col("id")), "cnt"],
      [fn("AVG", col("rating")), "avg"],
    ],
    raw: true,
    transaction: t,
  });

  const total = Number(row?.cnt || 0);
  const avg = Number(row?.avg || 0);
  return {
    totalReviews: total,
    averageRating: total ? Number(avg.toFixed(2)) : 0,
  };
}

async function recomputeProductRating(productId, t) {
  // only active reviews
  const row = await Review.findOne({
    where: { productId, isActive: true },
    attributes: [
      [fn("COUNT", col("id")), "cnt"],
      [fn("AVG", col("rating")), "avg"],
    ],
    raw: true,
    transaction: t,
  });

  const total = Number(row?.cnt || 0);
  const avg = Number(row?.avg || 0);

  // update product stats (if fields exist)
  await MerchentStore.update(
    {
      totalReviews: total,
      averageRating: total ? Number(avg.toFixed(2)) : 0,
    },
    { where: { id: productId }, transaction: t }
  );

  return { totalReviews: total, averageRating: total ? Number(avg.toFixed(2)) : 0 };
}

// ✅ New function: Recompute Merchant's overall rating
async function recomputeMerchantRating(merchantUserId, t) {
  if (!merchantUserId) return;

  // Calculate average of all active reviews for this merchant's products
  const row = await Review.findOne({
    attributes: [
      [fn("COUNT", col("Review.id")), "cnt"],
      [fn("AVG", col("Review.rating")), "avg"],
    ],
    include: [
      {
        model: MerchentStore,
        as: "product",
        where: { merchantId: merchantUserId },
        attributes: [],
      },
    ],
    where: { isActive: true },
    raw: true,
    transaction: t,
  });

  const total = Number(row?.cnt || 0);
  const avg = Number(row?.avg || 0);

  await MerchantProfile.update(
    {
      totalReviews: total,
      averageRating: total ? Number(avg.toFixed(2)) : 0,
    },
    { where: { userId: merchantUserId }, transaction: t }
  );
}

// ✅ eligibility check: user must have delivered order for that product
async function userCanReview({ userId, productId }) {
  const delivered = await OrderItem.findOne({
    where: {
      userId,
      productId,
      status: "delivered",
    },
    attributes: ["id"],
  });

  return !!delivered;
}

// POST /api/reviews
// body: { productId, rating, title?, comment?, images?[] }
exports.createReview = async (req, res) => {
  try {
    const userId = req.user?.id || req.userId;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const { productId, rating, title, comment, images } = req.body || {};

    const pid = Number(productId);
    const r = Number(rating);

    if (!Number.isFinite(pid) || pid <= 0) {
      return res.status(400).json({ success: false, message: "Invalid productId" });
    }
    if (!Number.isFinite(r) || r < 1 || r > 5) {
      return res.status(400).json({ success: false, message: "Rating must be 1-5" });
    }

    const product = await MerchentStore.findByPk(pid, { attributes: ["id", "merchantId", "name"] });
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });

    const ok = await userCanReview({ userId, productId: pid });
    if (!ok) {
      return res.status(403).json({
        success: false,
        message: "You can review only after ordering and receiving (delivered) this product.",
      });
    }

    // prevent duplicate: unique (userId, productId)
    const exists = await Review.findOne({ where: { userId, productId: pid } });
    if (exists) {
      return res.status(409).json({
        success: false,
        message: "You already reviewed this product. Use update endpoint.",
      });
    } 

    const created = await sequelize.transaction(async (t) => {
      const review = await Review.create(
        {
          userId,
          productId: pid,
          rating: r,
          title: safeTrim(title),
          comment: safeTrim(comment),
          images: Array.isArray(images) ? images : [],
        },
        { transaction: t }
      );

      let stats;
      try {
        stats = await recomputeProductRating(pid, t);
      } catch (e) {
        stats = await getLiveReviewStats(pid, t);
      }

      // ✅ Update Merchant Profile Stats
      if (product.merchantId) {
        try {
          await recomputeMerchantRating(product.merchantId, t);
        } catch (e) {
          // Keep review flow successful even if merchant stat table/schema is behind.

        }
      }

      return { review, stats };
    });

    // create notification
    if (product.merchantId) {
      await Notification.create({
        userId: product.merchantId,
        type: "review",
        title: "New Review Received",
        message: `Your product "${product.name || "Item"}" received a new review with ${created.review.rating} stars.`,
        meta: { productId: pid, reviewId: created.review.id, route: "/merchant/my-store" },
      });
    }
    return res.json({
      success: true,
      message: "Review submitted",
      review: created.review,
      productStats: created.stats,
    });
  } catch (err) {

    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// PATCH /api/reviews/:id
// user can update own review
exports.updateReview = async (req, res) => {
  try {
    const userId = req.user?.id || req.userId;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ success: false, message: "Invalid review id" });
    }

    const { rating, title, comment, images, isActive } = req.body || {};

    const review = await Review.findByPk(id);
    if (!review || review.userId !== userId) {
      return res.status(404).json({ success: false, message: "Review not found" });
    }

    if (rating !== undefined) {
      const r = Number(rating);
      if (!Number.isFinite(r) || r < 1 || r > 5) {
        return res.status(400).json({ success: false, message: "Rating must be 1-5" });
      }
      review.rating = r;
    }
    if (title !== undefined) review.title = title?.trim() || null;
    if (comment !== undefined) review.comment = comment?.trim() || null;
    if (images !== undefined) review.images = Array.isArray(images) ? images : [];
    if (isActive !== undefined) review.isActive = !!isActive;

    // Fetch product to get merchantId
    const product = await MerchentStore.findByPk(review.productId, { attributes: ["merchantId"] });

    const out = await sequelize.transaction(async (t) => {
      await review.save({ transaction: t });
      let stats;
      try {
        stats = await recomputeProductRating(review.productId, t);
      } catch (e) {

        stats = await getLiveReviewStats(review.productId, t);
      }

      if (product?.merchantId) {
        try {
          await recomputeMerchantRating(product.merchantId, t);
        } catch (e) {

        }
      }

      return { review, stats };
    });

    return res.json({
      success: true,
      message: "Review updated",
      review: out.review,
      productStats: out.stats,
    });
  } catch (err) {

    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// GET /api/reviews/product/:productId?page=1&limit=10&sort=desc
exports.getProductReviews = async (req, res) => {
  try {
    const productId = Number(req.params.productId);
    if (!Number.isFinite(productId) || productId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid productId" });
    }

    const page = clampInt(req.query.page, 1);
    const limit = clampInt(req.query.limit, 10);
    const sort = (req.query.sort || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";
    const orderBy = (req.query.orderBy || "").toLowerCase() === "rating" ? "rating" : "createdAt";
    const offset = (page - 1) * limit;

    const { count, rows } = await Review.findAndCountAll({
      where: { productId, isActive: true },
      include: [
        { model: User, as: "user", attributes: ["id", "name", "imageUrl"] },
      ],
      order: [[orderBy, sort], ["createdAt", "DESC"]],
      limit,
      offset,
    });

    return res.json({
      success: true,
      page,
      limit,
      total: count,
      reviews: rows,
    });
  } catch (err) {

    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// GET /api/reviews/eligibility/:productId
exports.getReviewEligibility = async (req, res) => {
  try {
    const userId = req.user?.id || req.userId;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const productId = Number(req.params.productId);
    if (!Number.isFinite(productId) || productId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid productId" });
    }

    const can = await userCanReview({ userId, productId });
    const existing = await Review.findOne({
      where: { userId, productId },
      attributes: ["id"],
    });

    return res.json({
      success: true,
      canReview: can && !existing,
      alreadyReviewed: !!existing,
      reviewId: existing?.id || null,
    });
  } catch (err) {

    return res.status(500).json({ success: false, message: "Server error" });
  }
};
