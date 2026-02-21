require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { Op } = require("sequelize");
const axios = require("axios");

const { sequelize, Conversation, Message } = require("./src/models");
const chatRoutes = require("./src/routes/chat");

const app = express();
const MAIN_API_BASE = "http://localhost:3001";

const origins = (process.env.FRONTEND_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: origins.length ? origins : true,
    credentials: true,
  })
);

app.use(express.json({ limit: "2mb" }));

app.get("/", (req, res) => res.json({ ok: true }));
app.use("/api/chat", chatRoutes);

const server = http.createServer(app);

const { Server } = require("socket.io");
const io = new Server(server, {
  cors: { origin: origins.length ? origins : true, credentials: true },
});
app.set("io", io);

const convRoom = (id) => `conv:${id}`;
const userRoom = (id) => `user:${id}`;
const isCoreSupportRole = (role) => ["admin", "support"].includes(role);
const isGuestRole = (role) => role === "guest";
const parseUserIdFromRoom = (roomName) =>
  roomName.startsWith("user:") ? roomName.replace("user:", "") : null;
const supportPermCache = new Map();

async function canSubAdminManageSupport(userId, token) {
  const key = String(userId);
  const now = Date.now();
  const cached = supportPermCache.get(key);
  if (cached && cached.expiresAt > now) return cached.allowed;

  try {
    const res = await axios.get(`${MAIN_API_BASE}/api/admin/subadmin/me/permissions`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const allowed = !!res.data?.permissions?.includes("manage_support_chat");
    supportPermCache.set(key, { allowed, expiresAt: now + 30_000 });
    return allowed;
  } catch (e) {
    console.error(`[Chat] Failed subadmin support check for ${userId}:`, e.message);
    supportPermCache.set(key, { allowed: false, expiresAt: now + 5_000 });
    return false;
  }
}

async function canManageSupportSocket(socket) {
  const role = socket.user?.role;
  if (isCoreSupportRole(role)) return true;
  if (role === "subadmin") {
    return canSubAdminManageSupport(socket.user?.id, socket.authToken);
  }
  return false;
}

const isConversationParticipant = (convo, socketUser) => {
  const userId = socketUser?.id;
  const baseParticipant =
    String(convo.customerId) === String(userId) || String(convo.agentId) === String(userId);
  if (!baseParticipant) return false;
  if (!isGuestRole(socketUser?.role)) return true;
  return (
    !!convo.isGuestCustomer &&
    !!socketUser?.guestSessionKey &&
    String(convo.guestSessionKey) === String(socketUser.guestSessionKey)
  );
};

const getOnlineUserIds = () =>
  [...io.sockets.adapter.rooms.keys()]
    .map(parseUserIdFromRoom)
    .filter(Boolean);

const emitOnlineUsers = () => {
  io.emit("online_users", { userIds: [...new Set(getOnlineUserIds())] });
};

const emitSupportPingToTeam = async (conversationId) => {
  const ids = new Set();

  for (const s of io.sockets.sockets.values()) {
    const canManage = await canManageSupportSocket(s);
    if (canManage && s.user?.id) {
      ids.add(String(s.user.id));
    }
  }

  ids.forEach((id) => {
    io.to(userRoom(id)).emit("conversation_ping", { conversationId });
  });
};

// socket auth (uses ecommerce JWT)
io.use((socket, next) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      (socket.handshake.headers.authorization || "").replace("Bearer ", "");

    if (!token) return next(new Error("Unauthorized"));

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (!payload?.id) return next(new Error("Invalid token payload"));

    socket.user = payload;
    socket.authToken = token;
    next();
  } catch {
    next(new Error("Unauthorized"));
  }
});

io.on("connection", (socket) => {
  const user = socket.user;

  // join personal room
  socket.join(userRoom(user.id));
  emitOnlineUsers();
  io.emit("user_presence", { userId: user.id, online: true });

  socket.on("join_conversation", async ({ conversationId }, ack) => {
    try {
      const convoId = Number(conversationId);
      if (!convoId) return ack?.({ ok: false, message: "conversationId required" });

      const convo = await Conversation.findByPk(convoId);
      if (!convo) return ack?.({ ok: false, message: "Conversation not found" });
      if (convo.contextType !== "support") {
        return ack?.({ ok: false, message: "Only support conversations are allowed" });
      }

      const isParticipant = isConversationParticipant(convo, user);
      const canManageSupport = await canManageSupportSocket(socket);
      const canJoin = isParticipant || canManageSupport;
      if (!canJoin) return ack?.({ ok: false, message: "Forbidden" });

      socket.join(convRoom(convoId));
      ack?.({ ok: true });
    } catch {
      ack?.({ ok: false, message: "Server error" });
    }
  });

  // payload: { conversationId, type, body, mediaUrl, meta }
  socket.on("send_message", async (payload, ack) => {
    try {
      const { conversationId, type = "text", body = null, mediaUrl = null, meta = null } = payload || {};
      const convoId = Number(conversationId);
      if (!convoId) return ack?.({ ok: false, message: "conversationId required" });

      const convo = await Conversation.findByPk(convoId);
      if (!convo) return ack?.({ ok: false, message: "Conversation not found" });
      if (convo.contextType !== "support") {
        return ack?.({ ok: false, message: "Only support conversations are allowed" });
      }

      const isParticipant = isConversationParticipant(convo, user);
      const canManageSupport = await canManageSupportSocket(socket);
      const canSend = isParticipant || canManageSupport;
      if (!canSend) return ack?.({ ok: false, message: "Forbidden" });
      if (convo.isBlocked && !canManageSupport) {
        return ack?.({ ok: false, message: "This chat is blocked by admin" });
      }

      if (type === "text" && (!body || !String(body).trim())) {
        return ack?.({ ok: false, message: "Message body required" });
      }
      if ((type === "image" || type === "file") && !mediaUrl) {
        return ack?.({ ok: false, message: "mediaUrl required" });
      }

      const msg = await Message.create({
        conversationId: convoId,
        senderId: user.id,
        type,
        body: body ? String(body) : null,
        mediaUrl,
        meta,
        deliveredAt: new Date(),
      });

      await convo.update({ lastMessageAt: new Date() });

      // broadcast to room
      io.to(convRoom(convoId)).emit("new_message", { message: msg });

      // ping participants (if not in room)
      io.to(userRoom(String(convo.customerId))).emit("conversation_ping", { conversationId: convoId });
      if (convo.agentId) io.to(userRoom(String(convo.agentId))).emit("conversation_ping", { conversationId: convoId });
      if (convo.contextType === "support") {
        void emitSupportPingToTeam(convoId);
      }

      ack?.({ ok: true, message: msg });
    } catch {
      ack?.({ ok: false, message: "Server error" });
    }
  });

  socket.on("typing", ({ conversationId, isTyping }) => {
    const convoId = Number(conversationId);
    if (!convoId) return;
    socket.to(convRoom(convoId)).emit("typing", {
      conversationId: convoId,
      userId: user.id,
      isTyping: !!isTyping,
    });
  });

  socket.on("mark_read", async ({ conversationId }, ack) => {
    try {
      const convoId = Number(conversationId);
      if (!convoId) return ack?.({ ok: false, message: "conversationId required" });

      const convo = await Conversation.findByPk(convoId);
      if (!convo) return ack?.({ ok: false, message: "Conversation not found" });
      if (convo.contextType !== "support") {
        return ack?.({ ok: false, message: "Only support conversations are allowed" });
      }

      const isParticipant = isConversationParticipant(convo, user);
      const canManageSupport = await canManageSupportSocket(socket);
      const canRead = isParticipant || canManageSupport;
      if (!canRead) return ack?.({ ok: false, message: "Forbidden" });

      const now = new Date();
      await Message.update(
        { readAt: now },
        {
          where: {
            conversationId: convoId,
            senderId: { [Op.ne]: user.id },
            readAt: null,
          },
        }
      );

      io.to(convRoom(convoId)).emit("read_receipt", {
        conversationId: convoId,
        userId: user.id,
        readAt: now,
      });

      ack?.({ ok: true });
    } catch {
      ack?.({ ok: false, message: "Server error" });
    }
  });

  socket.on("disconnect", () => {
    const room = io.sockets.adapter.rooms.get(userRoom(user.id));
    const stillOnline = !!(room && room.size > 0);
    if (!stillOnline) {
      io.emit("user_presence", { userId: user.id, online: false });
      emitOnlineUsers();
    }
  });
});

async function boot() {
  await sequelize.authenticate();

  // dev only: create tables automatically
  // production এ migrate recommended
  await sequelize.sync({ alter: true });

  const port = Number(process.env.PORT || 4000);
  server.listen(port, () => console.log("Chat server running on", port));
}

boot().catch((e) => {
  console.error(e);
  process.exit(1);
});
