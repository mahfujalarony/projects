const Notification = require("../models/Notification");
const { Op } = require("sequelize");

// helper: safe int
const toInt = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

//  GET /api/notifications?unread=true&page=1&limit=20
exports.getMyNotifications = async (req, res) => {
  try {
    const userId = req.user?.id; // protect middleware must set req.user
    const unread = String(req.query.unread || "") === "true";
    const page = Math.max(1, toInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, toInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const where = { userId };
    if (unread) where.isRead = false;

    const { rows, count } = await Notification.findAndCountAll({
      where,
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });

    // unread count (for badge)
    const unreadCount = await Notification.count({
      where: { userId, isRead: false },
    });

    res.json({
      ok: true,
      data: rows,
      meta: {
        page,
        limit,
        total: count,
        unreadCount,
      },
    });
  } catch (err) {
    res.status(500).json({ ok: false, message: "Server error" });
  }
};


//  POST /api/notifications (create for a user)
// Body: { userId, type, title, message, meta }
exports.createNotification = async (req, res) => {
  try {
    const { userId, type, title, message, meta } = req.body;

    if (!userId || !title || !message) {
      return res
        .status(400)
        .json({ ok: false, message: "userId, title, message are required" });
    }

    const notif = await Notification.create({
      userId,
      type: type || "system",
      title,
      message,
      meta: meta || null,
      isRead: false,
      readAt: null,
    });

    res.status(201).json({ ok: true, data: notif });
  } catch (err) {
    res.status(500).json({ ok: false, message: "Server error" });
  }
};

//  PATCH /api/notifications/:id/read
exports.markAsRead = async (req, res) => {
  try {
    const userId = req.user?.id;
    const id = toInt(req.params.id);

    const notif = await Notification.findOne({ where: { id, userId } });
    if (!notif) return res.status(404).json({ ok: false, message: "Not found" });

    if (!notif.isRead) {
      notif.isRead = true;
      notif.readAt = new Date();
      await notif.save();
    }

    res.json({ ok: true, data: notif });
  } catch (err) {
    res.status(500).json({ ok: false, message: "Server error" });
  }
};

//  PATCH /api/notifications/read-all
exports.markAllAsRead = async (req, res) => {
  try {
    const userId = req.user?.id;

    const [updated] = await Notification.update(
      { isRead: true, readAt: new Date() },
      { where: { userId, isRead: false } }
    );

    res.json({ ok: true, updated });
  } catch (err) {
    res.status(500).json({ ok: false, message: "Server error" });
  }
};

// DELETE /api/notifications/:id
exports.deleteNotification = async (req, res) => {
  try {
    const userId = req.user?.id;
    const id = toInt(req.params.id);

    const deleted = await Notification.destroy({ where: { id, userId } });
    if (!deleted) return res.status(404).json({ ok: false, message: "Not found" });

    res.json({ ok: true, deleted: true });
  } catch (err) {
    res.status(500).json({ ok: false, message: "Server error" });
  }
};

// DELETE /api/notifications/clear-all
exports.clearAll = async (req, res) => {
  try {
    const userId = req.user?.id;
    const deleted = await Notification.destroy({ where: { userId } });
    res.json({ ok: true, deletedCount: deleted });
  } catch (err) {
    res.status(500).json({ ok: false, message: "Server error" });
  }
};
