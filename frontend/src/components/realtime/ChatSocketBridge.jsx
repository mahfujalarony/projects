import { useEffect, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import axios from "axios";
import {
  setChatConnected,
  setOnlineUserIds,
  upsertOnlineUser,
  setConversationUnreadMap,
  resetChatState,
} from "../../redux/chatSlice";
import { connectChatSocket, disconnectChatSocket, getChatSocket } from "../../realtime/chatSocket";
import { CHAT_BASE_URL } from "../../config/env";
import { message } from "antd";

const CHAT_API_BASE = CHAT_BASE_URL;

const ChatSocketBridge = () => {
  const dispatch = useDispatch();
  const { token, user } = useSelector((state) => state.auth);

  const refreshUnread = useCallback(async () => {
    if (!token) {
      dispatch(setConversationUnreadMap({}));
      return;
    }

    try {
      const res = await axios.get(`${CHAT_API_BASE}/api/chat/conversations/my`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const rows = res.data?.rows || [];
      const unreadMap = rows.reduce((acc, row) => {
        acc[String(row.id)] = Number(row.unreadCount || 0);
        return acc;
      }, {});
      dispatch(setConversationUnreadMap(unreadMap));
    } catch (error) {
      message.error(error.response?.data?.message || error.message || "Failed to load conversations");
    }
  }, [dispatch, token]);

  useEffect(() => {
    if (!token || !user?.id) {
      disconnectChatSocket();
      dispatch(resetChatState());
      return;
    }

    const socket = connectChatSocket(token);
    if (!socket) return;

    const onConnect = () => {
      dispatch(setChatConnected(true));
      refreshUnread();
    };
    const onDisconnect = () => {
      dispatch(setChatConnected(false));
    };
    const onOnlineUsers = ({ userIds }) => {
      dispatch(setOnlineUserIds(Array.isArray(userIds) ? userIds : []));
    };
    const onUserPresence = ({ userId, online }) => {
      dispatch(upsertOnlineUser({ userId, online: !!online }));
    };
    const onConversationPing = () => {
      refreshUnread();
    };
    const onNewMessage = () => {
      refreshUnread();
    };
    const onReadReceipt = () => {
      refreshUnread();
    };
    const onConversationStatusChanged = () => {
      refreshUnread();
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("online_users", onOnlineUsers);
    socket.on("user_presence", onUserPresence);
    socket.on("conversation_ping", onConversationPing);
    socket.on("new_message", onNewMessage);
    socket.on("read_receipt", onReadReceipt);
    socket.on("conversation_status_changed", onConversationStatusChanged);

    dispatch(setChatConnected(getChatSocket()?.connected || false));
    refreshUnread();

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("online_users", onOnlineUsers);
      socket.off("user_presence", onUserPresence);
      socket.off("conversation_ping", onConversationPing);
      socket.off("new_message", onNewMessage);
      socket.off("read_receipt", onReadReceipt);
      socket.off("conversation_status_changed", onConversationStatusChanged);
    };
  }, [dispatch, token, user?.id, refreshUnread]);

  return null;
};

export default ChatSocketBridge;
