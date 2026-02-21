const router = require("express").Router();
const auth = require("../middleware/auth");
const { Conversation, Message } = require("../models");
const { Op, fn, col } = require("sequelize");
const axios = require("axios");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const MAIN_API_BASE = "http://localhost:3001";
const DEFAULT_CONVERSATION_LIMIT = 20;
const MAX_CONVERSATION_LIMIT = 50;
const DEFAULT_MESSAGE_LIMIT = 30;
const MAX_MESSAGE_LIMIT = 100;
const GUEST_TOKEN_EXPIRES_IN = "30d";

const isCoreSupportRole = (role) => ["admin", "support"].includes(role);
const isGuestRole = (role) => role === "guest";

const clampLimit = (raw, fallback, max) => {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), max);
};

const parseConversationCursor = (cursor) => {
  if (!cursor || typeof cursor !== "string") return null;
  const [tsRaw, idRaw] = cursor.split("|");
  const ts = Number(tsRaw);
  const id = Number(idRaw);
  if (!Number.isFinite(ts) || !Number.isFinite(id) || id <= 0) return null;
  return { ts, id };
};

const sanitizeString = (value, max) => {
  const text = String(value || "").trim();
  if (!text) return null;
  return text.slice(0, max);
};

const buildGuestUserId = () => Number(`${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, "0")}`);

const normalizeGuestPayload = (payload = {}) => ({
  name: sanitizeString(payload.name, 120),
  email: sanitizeString(payload.email, 180)?.toLowerCase() || null,
  phone: sanitizeString(payload.phone, 40),
  subject: sanitizeString(payload.subject, 200),
});

const signGuestToken = ({ id, guestSessionKey, conversationId }) =>
  jwt.sign(
    { id, role: "guest", guest: true, guestSessionKey, conversationId },
    process.env.JWT_SECRET,
    { expiresIn: GUEST_TOKEN_EXPIRES_IN }
  );

const convRoom = (id) => `conv:${id}`;
const userRoom = (id) => `user:${id}`;

const isConversationGuestOwner = (conversation, user) =>
  isGuestRole(user?.role) &&
  String(conversation?.customerId) === String(user?.id) &&
  !!conversation?.isGuestCustomer &&
  !!user?.guestSessionKey &&
  String(conversation?.guestSessionKey) === String(user?.guestSessionKey);

const emitConversationStatusChanged = (req, conversation) => {
  const io = req.app.get("io");
  if (!io) return;

  const payload = {
    conversationId: conversation.id,
    isBlocked: !!conversation.isBlocked,
    blockedAt: conversation.blockedAt,
    blockedById: conversation.blockedById,
    blockReason: conversation.blockReason || "",
  };

  io.to(convRoom(conversation.id)).emit("conversation_status_changed", payload);
  io.to(userRoom(String(conversation.customerId))).emit("conversation_status_changed", payload);
  if (conversation.agentId) io.to(userRoom(String(conversation.agentId))).emit("conversation_status_changed", payload);
  io.emit("conversation_status_changed", payload);
};

async function canManageSupport(req) {
  if (isCoreSupportRole(req.user.role)) return true;
  if (req.user.role === "subadmin") {
    return canSubAdminManageSupport(req);
  }
  return false;
}

async function canSubAdminManageSupport(req) {
  if (req.user.role !== "subadmin") return false;
  try {
    const permRes = await axios.get(
      `${MAIN_API_BASE}/api/admin/subadmin/me/permissions`,
      {
        headers: { Authorization: req.headers.authorization },
      }
    );
    return permRes.data?.permissions?.includes("manage_support_chat");
  } catch (e) {
    console.error(`[Chat] Failed to fetch permissions for subadmin ${req.user.id}:`, e.message);
    return false; // Fail safe
  }
}

router.post("/guest/session", async (req, res) => {
  try {
    const guest = normalizeGuestPayload(req.body);
    if (!guest.name) {
      return res.status(400).json({ success: false, message: "Name is required" });
    }
    if (!guest.email && !guest.phone) {
      return res.status(400).json({ success: false, message: "Email or phone is required" });
    }

    const guestSessionKey = crypto.randomBytes(24).toString("hex");
    const customerId = buildGuestUserId();

    const conversation = await Conversation.create({
      customerId,
      agentId: null,
      contextType: "support",
      contextId: null,
      status: "open",
      lastMessageAt: new Date(),
      isGuestCustomer: true,
      guestSessionKey,
      guestName: guest.name,
      guestEmail: guest.email,
      guestPhone: guest.phone,
      guestSubject: guest.subject,
    });

    const token = signGuestToken({ id: customerId, guestSessionKey, conversationId: conversation.id });
    res.json({ success: true, token, conversation });
  } catch (error) {
    console.error("[Chat] Error in /guest/session:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

router.patch("/conversations/:id/block", auth, async (req, res) => {
  try {
    if (req.user?.role !== "admin") {
      return res.status(403).json({ success: false, message: "Only admin can block/unblock chats" });
    }

    const convoId = Number(req.params.id);
    if (!Number.isFinite(convoId) || convoId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid conversation id" });
    }

    const conversation = await Conversation.findByPk(convoId);
    if (!conversation || conversation.contextType !== "support") {
      return res.status(404).json({ success: false, message: "Conversation not found" });
    }

    await conversation.update({
      isBlocked: true,
      blockedAt: new Date(),
      blockedById: req.user.id,
      blockReason: sanitizeString(req.body?.reason, 300),
    });

    emitConversationStatusChanged(req, conversation);
    return res.json({ success: true, conversation });
  } catch (error) {
    console.error(`[Chat] Error in /conversations/${req.params.id}/block:`, error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
});

router.patch("/conversations/:id/unblock", auth, async (req, res) => {
  try {
    if (req.user?.role !== "admin") {
      return res.status(403).json({ success: false, message: "Only admin can block/unblock chats" });
    }

    const convoId = Number(req.params.id);
    if (!Number.isFinite(convoId) || convoId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid conversation id" });
    }

    const conversation = await Conversation.findByPk(convoId);
    if (!conversation || conversation.contextType !== "support") {
      return res.status(404).json({ success: false, message: "Conversation not found" });
    }

    await conversation.update({
      isBlocked: false,
      blockedAt: null,
      blockedById: null,
      blockReason: null,
    });

    emitConversationStatusChanged(req, conversation);
    return res.json({ success: true, conversation });
  } catch (error) {
    console.error(`[Chat] Error in /conversations/${req.params.id}/unblock:`, error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Customer: open or reuse an active support conversation
router.post("/conversations/open", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    if (isGuestRole(req.user.role)) {
      const guestSessionKey = req.user?.guestSessionKey;
      if (!guestSessionKey) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }

      const convo = await Conversation.findOne({
        where: {
          id: req.user?.conversationId || null,
          customerId: userId,
          contextType: "support",
          isGuestCustomer: true,
          guestSessionKey,
          status: { [Op.ne]: "closed" },
        },
      });

      if (!convo) {
        return res.status(404).json({ success: false, message: "Conversation not found" });
      }

      return res.json({ success: true, conversation: convo });
    }

    const where = {
      customerId: userId,
      status: { [Op.ne]: "closed" },
      contextType: "support",
    };

    let convo = await Conversation.findOne({
      where,
      order: [["createdAt", "DESC"]],
    });

    if (!convo) {
      convo = await Conversation.create({
        customerId: userId,
        agentId: null,
        contextType: "support",
        contextId: null,
        status: "open",
        lastMessageAt: new Date(),
      });
    }

    res.json({ success: true, conversation: convo });
  } catch (error) {
    console.error("[Chat] Error in /conversations/open:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Get my conversations (support only)
router.get("/conversations/my", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = clampLimit(req.query.limit, DEFAULT_CONVERSATION_LIMIT, MAX_CONVERSATION_LIMIT);
    const cursor = parseConversationCursor(req.query.cursor);
    const canViewAllSupport = await canManageSupport(req);
    const isGuest = isGuestRole(req.user.role);
    const guestSessionKey = req.user?.guestSessionKey;
    if (isGuest && !guestSessionKey) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const baseWhere = canViewAllSupport
      ? { contextType: "support" }
      : isGuest
      ? {
          contextType: "support",
          customerId: userId,
          isGuestCustomer: true,
          guestSessionKey,
        }
      : { contextType: "support", customerId: userId };
    const where = cursor
      ? {
          [Op.and]: [
            baseWhere,
            {
              [Op.or]: [
                { lastMessageAt: { [Op.lt]: new Date(cursor.ts) } },
                { lastMessageAt: new Date(cursor.ts), id: { [Op.lt]: cursor.id } },
              ],
            },
          ],
        }
      : baseWhere;

    const rows = await Conversation.findAll({
      where,
      order: [
        ["lastMessageAt", "DESC"],
        ["id", "DESC"],
      ],
      limit: limit + 1,
    });
    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;

    const conversationIds = pageRows.map((r) => r.id);
    const unreadRows = conversationIds.length
      ? await Message.findAll({
          attributes: ["conversationId", [fn("COUNT", col("id")), "cnt"]],
          where: {
            conversationId: { [Op.in]: conversationIds },
            senderId: { [Op.ne]: userId },
            readAt: null,
          },
          group: ["conversationId"],
          raw: true,
        })
      : [];
    const unreadMap = unreadRows.reduce((acc, row) => {
      acc[String(row.conversationId)] = Number(row.cnt || 0);
      return acc;
    }, {});

    const rowsWithUnread = pageRows.map((row) => ({
      ...row.toJSON(),
      unreadCount: unreadMap[String(row.id)] || 0,
    }));

    const lastRow = pageRows[pageRows.length - 1];
    const lastTime = lastRow?.lastMessageAt || lastRow?.createdAt || new Date();
    const nextCursor = hasMore && lastRow
      ? `${new Date(lastTime).getTime()}|${lastRow.id}`
      : null;

    res.json({ success: true, rows: rowsWithUnread, hasMore, nextCursor });
  } catch (error) {
    console.error("[Chat] Error in /conversations/my:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Admin/Support: list all conversations (simple role check from token)
router.get("/conversations", auth, async (req, res) => {
  try {
    const canView = await canManageSupport(req);

    if (!canView) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    // This route should only show support conversations
    const rows = await Conversation.findAll({
      where: { contextType: "support" },
      order: [["lastMessageAt", "DESC"]],
      limit: 200,
    });
    res.json({ success: true, rows });
  } catch (error) {
    console.error("[Chat] Error in /conversations:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// History
router.get("/conversations/:id/messages", auth, async (req, res) => {
  try {
    const convoId = Number(req.params.id);
    const limit = clampLimit(req.query.limit, DEFAULT_MESSAGE_LIMIT, MAX_MESSAGE_LIMIT);
    const beforeId = Number(req.query.beforeId);
    const hasBefore = Number.isFinite(beforeId) && beforeId > 0;
    const user = req.user;

    const convo = await Conversation.findByPk(convoId);
    if (!convo) return res.status(404).json({ success: false, message: "Conversation not found" });
    if (convo.contextType !== "support") {
      return res.status(404).json({ success: false, message: "Conversation not found" });
    }

    const isParticipant =
      String(convo.customerId) === String(user.id) ||
      String(convo.agentId) === String(user.id) ||
      isConversationGuestOwner(convo, user);
    const canReadSupportChat = await canManageSupport(req);

    if (!isParticipant && !canReadSupportChat) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const where = hasBefore
      ? { conversationId: convoId, id: { [Op.lt]: beforeId } }
      : { conversationId: convoId };

    const rowsDesc = await Message.findAll({
      where,
      order: [["id", "DESC"]],
      limit: limit + 1,
    });

    const hasMore = rowsDesc.length > limit;
    const pageDesc = hasMore ? rowsDesc.slice(0, limit) : rowsDesc;
    const rows = pageDesc.reverse();
    const nextBeforeId = hasMore && rows.length ? rows[0].id : null;

    res.json({ success: true, rows, hasMore, nextBeforeId });
  } catch (error) {
    console.error(`[Chat] Error in /conversations/${req.params.id}/messages:`, error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

module.exports = router;
