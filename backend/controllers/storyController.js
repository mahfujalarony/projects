// controllers/storyController.js
const { Op } = require("sequelize");
const Story = require("../models/Story");
const Merchant = require("../models/MerchantProfile");
const User = require("../models/Authentication");

const now = () => new Date();

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

/**
 * ✅ POST /api/stories  (protected, merchant only)
 * body: { title?, mediaUrls:[], expiryHours? }
 */
exports.createStory = async (req, res) => {
  try {
    const userId = req.user?.id || req.userId;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const merchantId = await getMerchantIdFromUser(userId);
    if (!merchantId) {
      return res.status(403).json({ success: false, message: "Only merchant can create story" });
    }

    const { title, mediaUrls, expiryHours = 24 } = req.body || {};
    const urls = Array.isArray(mediaUrls) ? mediaUrls.filter(Boolean) : [];

    if (!urls.length) {
      return res.status(400).json({ success: false, message: "mediaUrls is required" });
    }

    const hours = clampInt(expiryHours, 24);
    const safeHours = Math.min(Math.max(hours, 1), 168); // 1h - 7days
    const expiresAt = new Date(Date.now() + safeHours * 60 * 60 * 1000);

    const story = await Story.create({
      merchantId,
      title: title?.trim() || null,
      mediaUrls: urls,
      expiresAt,
      isActive: true,
    });

    return res.json({ success: true, message: "Story created", story });
  } catch (e) {
    console.error("createStory error:", e);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * ✅ GET /api/stories?limit=50
 * Public feed: active + not expired
 */
exports.getStoryFeed = async (req, res) => {
  try {
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
    console.error("getStoryFeed error:", e);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * ✅ GET /api/stories/me  (protected, merchant only)
 * merchant own stories (expired + inactive সহ সব)
 */
exports.getMyStories = async (req, res) => {
  try {
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
    console.error("getMyStories error:", e);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * ✅ PATCH /api/stories/:id  (protected, merchant only)
 * body: { isActive?, title?, expiresAt? }
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

    if (isActive !== undefined) story.isActive = !!isActive;
    if (title !== undefined) story.title = String(title).trim() || null;

    if (expiresAt !== undefined) {
      const dt = new Date(expiresAt);
      if (Number.isNaN(dt.getTime())) {
        return res.status(400).json({ success: false, message: "Invalid expiresAt" });
      }
      story.expiresAt = dt;
    }

    await story.save();
    return res.json({ success: true, message: "Story updated", story });
  } catch (e) {
    console.error("updateStory error:", e);
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

    await story.destroy();
    return res.json({ success: true, message: "Story deleted" });
  } catch (e) {
    console.error("deleteStory error:", e);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
