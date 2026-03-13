const { Op } = require("sequelize");
const Offer = require("../models/Offer");
const { deleteUploadFileIfSafe } = require("../utils/uploadFileCleanup");
const { appendAdminHistory } = require("../utils/adminHistory");

const cleanPath = (v) => String(v || "").trim().replace(/\\/g, "/");

const nowWithinWindow = () => {
  const now = new Date();
  return {
    [Op.and]: [
      { [Op.or]: [{ startAt: null }, { startAt: { [Op.lte]: now } }] },
      { [Op.or]: [{ endAt: null }, { endAt: { [Op.gte]: now } }] },
    ],
  };
};


exports.getPublicOffers = async (req, res) => {
  try {
    const type = (req.query.type || "").trim(); // optional filter
    const limit = Math.min(Number(req.query.limit || 50), 200);

    const where = {
      isActive: true,
      ...nowWithinWindow(),
      ...(type ? { type } : {}),
    };

    const rows = await Offer.findAll({
      where,
      order: [
        ["sortOrder", "ASC"],
        ["updatedAt", "DESC"],
      ],
      limit,
    });

    res.json({ success: true, offers: rows });
  } catch (e) {
    res.status(500).json({ success: false, message: "Failed to load offers" });
  }
};


exports.adminListOffers = async (req, res) => {
  try {
    const { q = "", status = "all", type = "all" } = req.query;

    const where = {};
    if (q.trim()) {
      where[Op.or] = [
        { title: { [Op.like]: `%${q.trim()}%` } },
        { subtitle: { [Op.like]: `%${q.trim()}%` } },
        { description: { [Op.like]: `%${q.trim()}%` } },
      ];
    }
    if (status !== "all") where.isActive = status === "active";
    if (type !== "all") where.type = type;

    const rows = await Offer.findAll({
      where,
      order: [
        ["sortOrder", "ASC"],
        ["createdAt", "DESC"],
      ],
    });

    res.json({ success: true, offers: rows });
  } catch (e) {
    res.status(500).json({ success: false, message: "Failed to load offers" });
  }
};


exports.adminCreateOffer = async (req, res) => {
  try {
    const {
      title,
      subtitle,
      description,
      imageUrl,
      linkUrl,
      type = "carousel",
      isActive = true,
      sortOrder = 0,
      startAt = null,
      endAt = null,
    } = req.body;

    if (!title || !imageUrl) {
      return res.status(400).json({
        success: false,
        message: "title and imageUrl are required",
      });
    }

    const row = await Offer.create({
      title: String(title).trim(),
      subtitle: subtitle ? String(subtitle).trim() : null,
      description: description ? String(description) : null,
      imageUrl: cleanPath(imageUrl),
      linkUrl: linkUrl ? String(linkUrl).trim() : null,
      type,
      isActive: Boolean(isActive),
      sortOrder: Number(sortOrder || 0),
      startAt: startAt ? new Date(startAt) : null,
      endAt: endAt ? new Date(endAt) : null,
    });
    const actorId = req.user?.id || req.userId || null;
    await appendAdminHistory(
      `Offer created. Offer #${row.id} (${row.title}) by admin #${actorId || "unknown"}.`,
      {
        meta: {
          type: "offer_created",
          actorId,
          offerId: row.id,
          title: row.title,
          type: row.type,
          isActive: row.isActive,
        },
      }
    );

    res.status(201).json({ success: true, offer: row });
  } catch (e) {
    res.status(500).json({ success: false, message: "Failed to create offer" });
  }
};


exports.adminUpdateOffer = async (req, res) => {
  try {
    const { id } = req.params;

    const row = await Offer.findByPk(id);
    if (!row) return res.status(404).json({ success: false, message: "Offer not found" });
    const actorId = req.user?.id || req.userId || null;
    const before = {
      title: row.title,
      type: row.type,
      isActive: row.isActive,
      sortOrder: row.sortOrder,
    };

    const patch = { ...req.body };
    if (patch.description !== undefined) patch.description = patch.description ? String(patch.description) : null;
    if (patch.subtitle !== undefined && patch.subtitle === "") patch.subtitle = null;
    if (patch.imageUrl !== undefined) patch.imageUrl = cleanPath(patch.imageUrl);
    if (patch.sortOrder !== undefined) patch.sortOrder = Number(patch.sortOrder || 0);
    if (patch.isActive !== undefined) patch.isActive = Boolean(patch.isActive);
    if (patch.startAt !== undefined) patch.startAt = patch.startAt ? new Date(patch.startAt) : null;
    if (patch.endAt !== undefined) patch.endAt = patch.endAt ? new Date(patch.endAt) : null;

    await row.update(patch);
    await appendAdminHistory(
      `Offer updated. Offer #${row.id} (${row.title}) by admin #${actorId || "unknown"}.`,
      {
        meta: {
          type: "offer_updated",
          actorId,
          offerId: row.id,
          before,
          after: {
            title: row.title,
            type: row.type,
            isActive: row.isActive,
            sortOrder: row.sortOrder,
          },
        },
      }
    );

    res.json({ success: true, offer: row });
  } catch (e) {
    res.status(500).json({ success: false, message: "Failed to update offer" });
  }
};


exports.adminDeleteOffer = async (req, res) => {
  try {
    const { id } = req.params;

    const row = await Offer.findByPk(id);
    if (!row) return res.status(404).json({ success: false, message: "Offer not found" });
    const actorId = req.user?.id || req.userId || null;
    const snapshot = {
      offerId: row.id,
      title: row.title,
      type: row.type,
      isActive: row.isActive,
    };

    const imagePath = row.imageUrl;
    await row.destroy();

    let imageRemoved = false;
    if (imagePath) {
      try {
        imageRemoved = await deleteUploadFileIfSafe(imagePath);
      } catch (cleanupErr) {

      }
    }

    await appendAdminHistory(
      `Offer deleted. Offer #${snapshot.offerId} (${snapshot.title}) by admin #${actorId || "unknown"}.`,
      {
        meta: {
          type: "offer_deleted",
          actorId,
          ...snapshot,
        },
      }
    );

    res.json({ success: true, message: "Offer deleted", imageRemoved });
  } catch (e) {
    res.status(500).json({ success: false, message: "Failed to delete offer" });
  }
};
