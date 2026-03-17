// controllers/storyController.js
const { Op } = require("sequelize");
const fs = require("fs/promises");
const path = require("path");
const sequelize = require("../config/db");
const Story = require("../models/Story");
const Merchant = require("../models/MerchantProfile");
const User = require("../models/Authentication");
const MerchentStore = require("../models/MerchentStore");
const ProductDailyStat = require("../models/ProductDailyStat");
const AppSetting = require("../models/AppSetting");
const { subMoney2 } = require("../utils/money");
const { appendAdminHistory } = require("../utils/adminHistory");

const now = () => new Date();
const UPLOAD_ROOT = path.resolve(__dirname, "../../upload");
const SAFE_UPLOAD_ROOTS = [
  path.resolve(UPLOAD_ROOT, "public"),
];

const clampInt = (v, d) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

// ✅ logged user -> merchantId
async function getMerchantIdFromUser(userId) {
  const merchant = await Merchant.findOne({
    where: { userId },
    attributes: ["id"],
  });
  return merchant?.id || null;
}

const normalizeMediaUrls = (value) => {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter(Boolean) : [value];
    } catch {
      return value ? [value] : [];
    }
  }
  return [];
};

const mediaUrlToUploadFilePath = (url) => {
  if (!url) return null;
  const raw = String(url).trim();
  if (!raw) return null;

  let pathname = raw;
  if (/^https?:\/\//i.test(raw)) {
    try {
      pathname = new URL(raw).pathname || "";
    } catch {
      pathname = raw;
    }
  }

  const normalized = pathname
    .split("?")[0]
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");

  if (
    !normalized.toLowerCase().startsWith("public/")
  ) {
    return null;
  }

  const fullPath = path.resolve(UPLOAD_ROOT, normalized);
  if (!SAFE_UPLOAD_ROOTS.some((root) => fullPath.startsWith(root))) return null;
  return fullPath;
};

const deleteStoryMediaFiles = async (story) => {
  const mediaUrls = normalizeMediaUrls(story?.mediaUrls);
  await Promise.all(
    mediaUrls.map(async (url) => {
      const filePath = mediaUrlToUploadFilePath(url);
      if (!filePath) return;
      try {
        await fs.unlink(filePath);
      } catch (err) {
        if (err?.code !== "ENOENT") {

        }
      }
    })
  );
};

const purgeExpiredStories = async () => {
  const expiredStories = await Story.findAll({
    where: { expiresAt: { [Op.lte]: now() } },
    attributes: ["id", "mediaUrls"],
  });
  if (!expiredStories.length) return 0;

  for (const story of expiredStories) {
    await deleteStoryMediaFiles(story);
  }

  await Story.destroy({ where: { id: expiredStories.map((s) => s.id) } });
  return expiredStories.length;
};

const getStoryPostFee = async () => {
  const toSafeFee = (v) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  const row = await AppSetting.findByPk("storyPostFee");
  if (!row) return 0;
  try {
    const parsed = JSON.parse(row.value);
    return toSafeFee(parsed);
  } catch {
    return toSafeFee(row.value);
  }
};

const getStoryDurationHours = async () => {
  const row = await AppSetting.findByPk("storyDurationHours");
  if (!row) return 24;

  let raw = row.value;
  try {
    raw = JSON.parse(row.value);
  } catch {}

  const n = Math.round(Number(raw));
  return Number.isFinite(n) && n >= 24 ? n : 24;
};

const getBDDateString = () => {
  const nowDt = new Date();
  const bd = new Date(nowDt.toLocaleString("en-US", { timeZone: "Asia/Dhaka" }));
  return bd.toISOString().slice(0, 10);
};

/**
 * ✅ POST /api/stories  (protected, merchant only)
 * body: { title?, mediaUrls:[] } // duration is fixed by admin setting
 */
exports.createStory = async (req, res) => {
  let uploadedUrls = [];
  try {
    const userId = req.user?.id || req.userId;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const merchantId = await getMerchantIdFromUser(userId);
    if (!merchantId) {
      return res.status(403).json({ success: false, message: "Only merchant can create story" });
    }

    const { title, mediaUrls, productId } = req.body || {};
    const urls = Array.isArray(mediaUrls) ? mediaUrls.filter(Boolean) : [];
    uploadedUrls = urls;

    if (!urls.length) {
      return res.status(400).json({ success: false, message: "mediaUrls is required" });
    }

    const safeHours = await getStoryDurationHours();
    const expiresAt = new Date(Date.now() + safeHours * 60 * 60 * 1000);
    const normalizedProductId = Number(productId || 0);
    const linkedProductId = Number.isFinite(normalizedProductId) && normalizedProductId > 0 ? normalizedProductId : null;

    if (linkedProductId) {
      const storeProduct = await MerchentStore.findOne({
        where: { id: linkedProductId, merchantId: userId },
        attributes: ["id"],
      });
      if (!storeProduct) {
        return res.status(400).json({
          success: false,
          message: "Selected product is invalid for this merchant",
        });
      }
    }

    const storyFee = await getStoryPostFee();

    const story = await sequelize.transaction(async (t) => {
      if (storyFee > 0) {
        const user = await User.findByPk(userId, {
          attributes: ["id", "balance"],
          transaction: t,
          lock: t.LOCK.UPDATE,
        });
        if (!user) {
          const err = new Error("Unauthorized");
          err.statusCode = 401;
          throw err;
        }

        const currentBalance = Number(user.balance || 0);
        if (currentBalance < storyFee) {
          const err = new Error(`Insufficient balance. Story fee is USD ${storyFee}`);
          err.statusCode = 400;
          err.code = "INSUFFICIENT_BALANCE";
          throw err;
        }

        const nextUserBalance = subMoney2(currentBalance, storyFee);
        if (!nextUserBalance) {
          const err = new Error("Invalid balance calculation");
          err.statusCode = 400;
          throw err;
        }
        user.balance = nextUserBalance;
        await user.save({ transaction: t });
      }

      const created = await Story.create(
        {
          merchantId,
          title: title?.trim() || null,
          productId: linkedProductId,
          mediaUrls: urls,
          expiresAt,
          isActive: true,
        },
        { transaction: t }
      );

      if (linkedProductId) {
        const statDate = getBDDateString();
        const [row] = await ProductDailyStat.findOrCreate({
          where: { productId: linkedProductId, statDate },
          defaults: {
            productId: linkedProductId,
            statDate,
            views: 0,
            addToCart: 0,
            purchases: 0,
            soldQty: 0,
            revenue: 0,
          },
          transaction: t,
        });
        await row.increment("views", { by: 1, transaction: t });
      }

      await appendAdminHistory(
        `Story published by merchant user #${userId}. Story #${created.id}, fee ${Number(storyFee || 0).toFixed(
          2
        )}, duration ${safeHours} hour(s).`,
        {
          transaction: t,
          meta: {
            type: "merchant_story_published",
            userId,
            merchantId,
            storyId: created.id,
            feeCharged: Number(storyFee || 0),
            durationHours: safeHours,
            productId: linkedProductId || null,
          },
        }
      );

      return created;
    });

    return res.json({
      success: true,
      message: "Story created",
      story,
      feeCharged: storyFee,
      durationHours: safeHours,
    });
  } catch (e) {
    if (uploadedUrls.length) {
      await deleteStoryMediaFiles({ mediaUrls: uploadedUrls });
    }

    return res
      .status(e.statusCode || 500)
      .json({ success: false, message: e.statusCode ? e.message : "Server error" });
  }
};

/**
 * ✅ GET /api/stories?limit=50
 * Public feed: active + not expired
 */
exports.getStoryFeed = async (req, res) => {
  try {
    await purgeExpiredStories();
    const limit = Math.min(Math.max(Number(req.query.limit || 30), 1), 100);

    const rows = await Story.findAll({
      where: {
        isActive: true,
        expiresAt: { [Op.gt]: now() },
      },
      include: [
        {
          model: Merchant,
          as: "merchant",
          attributes: ["id"],
          include: [{ model: User, as: "user", attributes: ["id", "name", "imageUrl"] }],
        },
      ],
      order: [["createdAt", "DESC"]],
      limit,
    });

    return res.json({ success: true, stories: rows });
  } catch (e) {

    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * ✅ GET /api/stories/me  (protected, merchant only)
 * merchant own stories (expired + inactive সহ সব)
 */
exports.getMyStories = async (req, res) => {
  try {
    await purgeExpiredStories();
    const userId = req.user?.id || req.userId;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const merchantId = await getMerchantIdFromUser(userId);
    if (!merchantId) return res.status(403).json({ success: false, message: "Only merchant" });

    const rows = await Story.findAll({
      where: { merchantId },
      order: [["createdAt", "DESC"]],
    });

    return res.json({ success: true, stories: rows });
  } catch (e) {

    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * ✅ PATCH /api/stories/:id  (protected, merchant only)
 * body: { isActive?, title? }
 */
exports.updateStory = async (req, res) => {
  try {
    const userId = req.user?.id || req.userId;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const merchantId = await getMerchantIdFromUser(userId);
    if (!merchantId) return res.status(403).json({ success: false, message: "Only merchant" });

    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ success: false, message: "Invalid story id" });
    }

    const story = await Story.findByPk(id);
    if (!story || story.merchantId !== merchantId) {
      return res.status(404).json({ success: false, message: "Story not found" });
    }

    const { isActive, title, expiresAt } = req.body || {};
    const before = {
      title: story.title || null,
      isActive: story.isActive,
      expiresAt: story.expiresAt,
    };

    if (isActive !== undefined) story.isActive = !!isActive;
    if (title !== undefined) story.title = String(title).trim() || null;

    if (expiresAt !== undefined) {
      return res.status(400).json({
        success: false,
        message: "Story expiry is fixed by admin setting and cannot be changed",
      });
    }

    await story.save();
    await appendAdminHistory(
      `Story updated by merchant user #${userId}. Story #${story.id}.`,
      {
        meta: {
          type: "merchant_story_updated",
          userId,
          merchantId,
          storyId: story.id,
          before,
          after: {
            title: story.title || null,
            isActive: story.isActive,
            expiresAt: story.expiresAt,
          },
        },
      }
    );
    return res.json({ success: true, message: "Story updated", story });
  } catch (e) {

    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * ✅ DELETE /api/stories/:id  (protected, merchant only)
 */
exports.deleteStory = async (req, res) => {
  try {
    const userId = req.user?.id || req.userId;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const merchantId = await getMerchantIdFromUser(userId);
    if (!merchantId) return res.status(403).json({ success: false, message: "Only merchant" });

    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ success: false, message: "Invalid story id" });
    }

    const story = await Story.findByPk(id);
    if (!story || story.merchantId !== merchantId) {
      return res.status(404).json({ success: false, message: "Story not found" });
    }
    const snapshot = {
      storyId: story.id,
      title: story.title || null,
      isActive: story.isActive,
      expiresAt: story.expiresAt,
    };

    await deleteStoryMediaFiles(story);
    await story.destroy();
    await appendAdminHistory(
      `Story deleted by merchant user #${userId}. Story #${snapshot.storyId}.`,
      {
        meta: {
          type: "merchant_story_deleted",
          userId,
          merchantId,
          ...snapshot,
        },
      }
    );
    return res.json({ success: true, message: "Story deleted" });
  } catch (e) {

    return res.status(500).json({ success: false, message: "Server error" });
  }
};
