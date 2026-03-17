import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Layout,
  List,
  Avatar,
  Typography,
  Input,
  Button,
  Grid,
  Drawer,
  Tag,
  Divider,
  Skeleton,
  Empty,
  Card,
  Spin,
  message as antdMessage,
} from "antd";
import {
  UserOutlined,
  CustomerServiceOutlined,
  SendOutlined,
  ArrowLeftOutlined,
  HomeOutlined,
  DeleteOutlined,
  InfoCircleOutlined,
  MessageOutlined,
} from "@ant-design/icons";
import { useNavigate, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { getChatSocket } from "../../realtime/chatSocket";
import { CHAT_BASE_URL, API_BASE_URL } from "../../config/env";
import { normalizeImageUrl } from "../../utils/imageUrl";
import ChatConversationList from "./components/ChatConversationList";

const { Sider, Content } = Layout;
const { Title, Text } = Typography;
const { useBreakpoint } = Grid;
const { TextArea } = Input;

const API_BASE = CHAT_BASE_URL;
const MAIN_API = API_BASE_URL;
const CHAT_PAGE_SIZE = 20;
const MESSAGE_PAGE_SIZE = 30;

const ChatLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const screens = useBreakpoint();
  const { user, token } = useSelector((state) => state.auth);
  const queryClient = useQueryClient();
  const onlineUserIds = useSelector((state) => state.chat?.onlineUserIds || []);
  const chatConnected = useSelector((state) => state.chat?.connected || false);

  const [socket, setSocket] = useState(null);
  const [chatList, setChatList] = useState([]);
  const [messages, setMessages] = useState([]);
  const [currentConversation, setCurrentConversation] = useState(null);
  const [listUsers, setListUsers] = useState({});
  const [chatSearch, setChatSearch] = useState("");
  const [composerText, setComposerText] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [conversationInfoOpen, setConversationInfoOpen] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileData, setProfileData] = useState(null);
  const [blockBusy, setBlockBusy] = useState(false);
  const [supportOpenBusy, setSupportOpenBusy] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedChatIds, setSelectedChatIds] = useState([]);
  const [deletingBulk, setDeletingBulk] = useState(false);
  const [deletingChatIds, setDeletingChatIds] = useState([]);
  const [debouncedChatSearch, setDebouncedChatSearch] = useState("");
  const [conversationPreviewMap, setConversationPreviewMap] = useState({});

  const [messageCursor, setMessageCursor] = useState(null);
  const [messageHasMore, setMessageHasMore] = useState(true);
  const [messageLoading, setMessageLoading] = useState(false);
  const [messageLoadingMore, setMessageLoadingMore] = useState(false);

  const messageWrapRef = useRef(null);
  const keepScrollOnPrependRef = useRef(false);
  const previousHeightRef = useRef(0);
  const previousTopRef = useRef(0);
  const shouldSnapToBottomRef = useRef(false);
  const forceScrollToBottomRef = useRef(false);
  const refreshTimerRef = useRef(null);
  const fetchConversationsRef = useRef(null);
  const previewLookupInFlightRef = useRef(new Set());
  const chatListScrollTopRef = useRef(0);
  const messageCursorRef = useRef(null);
  const messageHasMoreRef = useRef(true);
  const messageLoadingRef = useRef(false);
  const messageLoadingMoreRef = useRef(false);

  const pathParts = location.pathname.split("/");
  const chatId = pathParts[2];
  const isDesktop = screens.md;
  const isSupportViewer = ["admin", "support", "subadmin"].includes(String(user?.role || ""));
  const isAdminOrSubAdmin = ["admin", "subadmin"].includes(String(user?.role || ""));
  const isEndUserSupportOnlyMode = !isSupportViewer;
  const canDeleteConversations = !!token;
  const canManageConversations = isSupportViewer;
  const canBlockConversation = String(user?.role || "") === "admin";

  const getAvatarUrl = useCallback((url) => {
    const normalized = normalizeImageUrl(url);
    return normalized || null;
  }, []);

  const formatTime = (value) => {
    if (!value) return "";
    return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatRelativeAgo = (value) => {
    if (!value) return "";
    const ts = new Date(value).getTime();
    if (!Number.isFinite(ts)) return "";
    const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));

    if (diffSec < 60) return "just now";
    if (diffSec < 60 * 60) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 60 * 60 * 24) return `${Math.floor(diffSec / (60 * 60))}h ago`;
    if (diffSec < 60 * 60 * 24 * 30) return `${Math.floor(diffSec / (60 * 60 * 24))}d ago`;
    if (diffSec < 60 * 60 * 24 * 365) return `${Math.floor(diffSec / (60 * 60 * 24 * 30))}m ago`;
    return `${Math.floor(diffSec / (60 * 60 * 24 * 365))}y ago`;
  };

  const isNearBottom = () => {
    const el = messageWrapRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  const scrollToBottom = () => {
    const el = messageWrapRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  };

  const mergeById = (prev, next) => {
    const map = new Map(prev.map((x) => [String(x.id), x]));
    next.forEach((x) => map.set(String(x.id), x));
    return Array.from(map.values());
  };

  useEffect(() => {
    messageCursorRef.current = messageCursor;
  }, [messageCursor]);
  useEffect(() => {
    messageHasMoreRef.current = messageHasMore;
  }, [messageHasMore]);
  useEffect(() => {
    messageLoadingRef.current = messageLoading;
  }, [messageLoading]);
  useEffect(() => {
    messageLoadingMoreRef.current = messageLoadingMore;
  }, [messageLoadingMore]);

  useEffect(() => {
    setSelectedChatIds((prev) => prev.filter((id) => chatList.some((c) => String(c.id) === String(id))));
  }, [chatList]);

  const conversationsQuery = useInfiniteQuery({
    queryKey: ["chat-conversations", token],
    enabled: !!token,
    initialPageParam: null,
    queryFn: async ({ pageParam }) => {
      const params = { limit: CHAT_PAGE_SIZE };
      if (pageParam) params.cursor = pageParam;
      const res = await axios.get(`${API_BASE}/api/chat/conversations/my`, {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });
      if (!res.data?.success) throw new Error("Failed to fetch conversations");
      return {
        rows: (res.data.rows || []).filter((x) => x.contextType === "support"),
        nextCursor: res.data?.nextCursor || null,
        hasMore: Boolean(res.data?.hasMore),
      };
    },
    getNextPageParam: (lastPage) => (lastPage?.hasMore ? lastPage?.nextCursor || undefined : undefined),
    staleTime: 1000 * 20,
    gcTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    const pages = conversationsQuery.data?.pages || [];
    if (!pages.length) {
      setChatList([]);
      return;
    }
    const flattened = pages.flatMap((p) => p?.rows || []);
    setChatList((prev) => mergeById(prev, flattened));
  }, [conversationsQuery.data]);

  const chatLoading = conversationsQuery.status === "pending";
  const chatLoadingMore = conversationsQuery.isFetchingNextPage;
  const chatHasMore = Boolean(conversationsQuery.hasNextPage);

  const fetchConversations = useCallback(
    async ({ reset = false } = {}) => {
      if (!token) return;
      if (reset) {
        try {
          const res = await axios.get(`${API_BASE}/api/chat/conversations/my`, {
            headers: { Authorization: `Bearer ${token}` },
            params: { limit: CHAT_PAGE_SIZE },
          });
          if (!res.data?.success) return;
          const firstPage = {
            rows: (res.data.rows || []).filter((x) => x.contextType === "support"),
            nextCursor: res.data?.nextCursor || null,
            hasMore: Boolean(res.data?.hasMore),
          };
          queryClient.setQueryData(["chat-conversations", token], {
            pages: [firstPage],
            pageParams: [null],
          });
          setChatList(firstPage.rows);
        } catch (error) {

        }
        return;
      }
      if (!chatHasMore || conversationsQuery.isFetchingNextPage) return;
      await conversationsQuery.fetchNextPage();
    },
    [token, queryClient, chatHasMore, conversationsQuery]
  );

  useEffect(() => {
    fetchConversationsRef.current = fetchConversations;
  }, [fetchConversations]);

  const fetchMessages = useCallback(
    async ({ reset = false } = {}) => {
      if (!chatId || !token) return;
      if (reset ? messageLoadingRef.current : messageLoadingMoreRef.current) return;
      if (!reset && !messageHasMoreRef.current) return;

      try {
        if (reset) {
          messageLoadingRef.current = true;
          setMessageLoading(true);
        } else {
          messageLoadingMoreRef.current = true;
          setMessageLoadingMore(true);
          const el = messageWrapRef.current;
          if (el) {
            keepScrollOnPrependRef.current = true;
            previousHeightRef.current = el.scrollHeight;
            previousTopRef.current = el.scrollTop;
          }
        }

        const params = { limit: MESSAGE_PAGE_SIZE };
        if (!reset && messageCursorRef.current) params.beforeId = messageCursorRef.current;

        const res = await axios.get(`${API_BASE}/api/chat/conversations/${chatId}/messages`, {
          headers: { Authorization: `Bearer ${token}` },
          params,
        });

        if (!res.data?.success) return;
        const rows = res.data.rows || [];

        setMessages((prev) => {
          if (reset) return rows;
          const existing = new Set(prev.map((m) => String(m.id)));
          const older = rows.filter((m) => !existing.has(String(m.id)));
          return [...older, ...prev];
        });

        const nextBeforeId = res.data?.nextBeforeId || null;
        const hasMore = Boolean(res.data?.hasMore);
        setMessageCursor(nextBeforeId);
        setMessageHasMore(hasMore);
        messageCursorRef.current = nextBeforeId;
        messageHasMoreRef.current = hasMore;
      } catch (error) {

      } finally {
        if (reset) {
          messageLoadingRef.current = false;
          setMessageLoading(false);
        } else {
          messageLoadingMoreRef.current = false;
          setMessageLoadingMore(false);
        }
      }
    },
    [chatId, token]
  );

  const scheduleConversationRefresh = useCallback(() => {
    if (refreshTimerRef.current) return;
    refreshTimerRef.current = setTimeout(() => {
      refreshTimerRef.current = null;
      fetchConversationsRef.current?.({ reset: true });
    }, 250);
  }, []);

  const getPartnerMeta = useCallback(
    (conversation) => {
      if (!conversation) return { id: null, isGuest: false, name: "", imageUrl: null, email: "", phone: "" };
      const mine = String(conversation.customerId) === String(user?.id);
      const pid = mine ? conversation.agentId : conversation.customerId;
      const isSupportChat = String(conversation.contextType || "").toLowerCase() === "support";
      if (isEndUserSupportOnlyMode && isSupportChat) {
        return {
          id: pid || null,
          isGuest: false,
          name: "Support Chat",
          imageUrl: null,
          email: "",
          phone: "",
        };
      }
      const guestActive = isSupportViewer && !mine && conversation.isGuestCustomer;
      if (guestActive) {
        return {
          id: pid,
          isGuest: true,
          name: conversation.guestName || conversation.guestEmail || conversation.guestPhone || `Guest #${pid}`,
          imageUrl: null,
          email: conversation.guestEmail || "",
          phone: conversation.guestPhone || "",
        };
      }

      const p = listUsers[String(pid)];
      return {
        id: pid,
        isGuest: false,
        name: p?.name || `User #${pid || conversation.customerId}`,
        imageUrl: p?.imageUrl || null,
        email: p?.email || "",
        phone: p?.phone || "",
      };
    },
    [isSupportViewer, isEndUserSupportOnlyMode, listUsers, user?.id]
  );

  const openProfile = async () => {
    const meta = getPartnerMeta(currentConversation);
    if (!meta?.id) return;
    setProfileOpen(true);
    setProfileLoading(true);

    if (meta.isGuest) {
      setProfileData({
        guest: true,
        user: {
          name: meta.name,
          email: meta.email,
          phone: meta.phone,
          createdAt: currentConversation?.createdAt,
          subject: currentConversation?.guestSubject || "",
        },
      });
      setProfileLoading(false);
      return;
    }

    if (!token) {
      setProfileData(null);
      setProfileLoading(false);
      return;
    }

    try {
      const res = await axios.get(`${MAIN_API}/api/auth/users/${meta.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProfileData(res.data || null);
    } catch (error) {

      setProfileData(null);
    } finally {
      setProfileLoading(false);
    }
  };

  useEffect(() => {
    setSocket(getChatSocket());
  }, [chatConnected, token, user?.id]);

  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!chatId || !token) {
      setCurrentConversation(null);
      return;
    }
    const convo = chatList.find((c) => String(c.id) === String(chatId));
    setCurrentConversation(convo || null);
  }, [chatId, token, chatList]);

  useEffect(() => {
    if (!chatId || !token) {
      setMessages([]);
      setMessageCursor(null);
      setMessageHasMore(true);
      shouldSnapToBottomRef.current = false;
      return;
    }

    setMessageCursor(null);
    setMessageHasMore(true);
    setMessages([]);
    shouldSnapToBottomRef.current = true;
    fetchMessages({ reset: true });

    if (socket) socket.emit("join_conversation", { conversationId: Number(chatId) });
  }, [chatId, token, socket, fetchMessages]);

  useEffect(() => {
    if (!chatList.length || !token || !user?.id) return;
    if (isEndUserSupportOnlyMode) return;

    const allIds = [
      ...new Set(
        chatList
          .map((item) => {
            const mine = String(item.customerId) === String(user.id);
            if (!mine && isSupportViewer && item.isGuestCustomer) return null;
            return mine ? item.agentId : item.customerId;
          })
          .filter(Boolean)
      ),
    ];
    const missingIds = allIds.filter((id) => !Object.prototype.hasOwnProperty.call(listUsers, String(id)));
    if (!missingIds.length) return;

    const chunkSize = 80;
    const chunks = [];
    for (let i = 0; i < missingIds.length; i += chunkSize) {
      chunks.push(missingIds.slice(i, i + chunkSize));
    }

    Promise.all(
      chunks.map(async (chunk) => {
        try {
          const res = await axios.get(`${MAIN_API}/api/auth/users`, {
            headers: { Authorization: `Bearer ${token}` },
            params: { ids: chunk.join(",") },
          });
          const rows = res.data?.users || [];
          return rows.map((u) => [String(u.id), u]);
        } catch {
          return chunk.map((id) => [String(id), null]);
        }
      })
    ).then((allPairs) => {
      const flat = allPairs.flat();
      if (!flat.length) return;
      setListUsers((prev) => ({ ...prev, ...Object.fromEntries(flat) }));
    });
  }, [chatList, token, user?.id, listUsers, isSupportViewer, isEndUserSupportOnlyMode]);

  useEffect(() => {
    if (!socket) return;

    const onNewMessage = ({ message }) => {
      if (!message) return;
      setChatList((prev) =>
        prev.map((item) =>
          String(item.id) === String(message.conversationId)
            ? {
                ...item,
                lastMessageAt: message.createdAt || new Date().toISOString(),
                updatedAt: message.createdAt || new Date().toISOString(),
              }
            : item
        )
      );
      if (String(message.conversationId) === String(chatId)) {
        const shouldStick = isNearBottom();
        setMessages((prev) => {
          if (prev.some((m) => String(m.id) === String(message.id))) return prev;
          return [...prev, message];
        });
        if (shouldStick) forceScrollToBottomRef.current = true;
      }
      scheduleConversationRefresh();
    };

    const onConversationPing = () => scheduleConversationRefresh();

    const onReadReceipt = ({ conversationId, readAt, userId: readerId }) => {
      if (String(conversationId) !== String(chatId)) return;
      if (String(readerId) === String(user?.id)) return;

      setMessages((prev) =>
        prev.map((m) => {
          const isMine = String(m.senderId) === String(user?.id);
          if (!isMine || m.readAt) return m;
          return { ...m, readAt };
        })
      );
    };
    const onConversationStatusChanged = ({ conversationId, isBlocked, blockedAt, blockedById, blockReason }) => {
      if (!conversationId) return;
      setChatList((prev) =>
        prev.map((c) =>
          String(c.id) === String(conversationId)
            ? {
                ...c,
                isBlocked: !!isBlocked,
                blockedAt: blockedAt || null,
                blockedById: blockedById || null,
                blockReason: blockReason || null,
              }
            : c
        )
      );
    };

    socket.on("new_message", onNewMessage);
    socket.on("conversation_ping", onConversationPing);
    socket.on("read_receipt", onReadReceipt);
    socket.on("conversation_status_changed", onConversationStatusChanged);

    return () => {
      socket.off("new_message", onNewMessage);
      socket.off("conversation_ping", onConversationPing);
      socket.off("read_receipt", onReadReceipt);
      socket.off("conversation_status_changed", onConversationStatusChanged);
    };
  }, [socket, chatId, user?.id, scheduleConversationRefresh]);

  useEffect(() => {
    if (!socket || !chatId || !messages.length || !user?.id) return;
    const hasUnreadIncoming = messages.some((m) => String(m.senderId) !== String(user.id) && !m.readAt);
    if (!hasUnreadIncoming) return;
    socket.emit("mark_read", { conversationId: Number(chatId) });
  }, [socket, chatId, messages, user?.id]);

  useEffect(() => {
    if (keepScrollOnPrependRef.current) {
      const el = messageWrapRef.current;
      if (el) {
        const diff = el.scrollHeight - previousHeightRef.current;
        el.scrollTop = previousTopRef.current + diff;
      }
      keepScrollOnPrependRef.current = false;
      return;
    }

    if (shouldSnapToBottomRef.current && !messageLoading) {
      requestAnimationFrame(() => {
        scrollToBottom();
        shouldSnapToBottomRef.current = false;
      });
      return;
    }

    if (forceScrollToBottomRef.current && !messageLoading) {
      requestAnimationFrame(() => {
        scrollToBottom();
        forceScrollToBottomRef.current = false;
      });
    }
  }, [messages, messageLoading]);

  const handleSendMessage = (raw) => {
    const text = String(raw || "").trim();
    if (!text || !socket || !chatId) return;
    if (currentConversation?.isBlocked && !isSupportViewer) {
      antdMessage.error("This chat is blocked by admin");
      return;
    }

    socket.emit(
      "send_message",
      { conversationId: Number(chatId), type: "text", body: text },
      (ack) => {
        if (!ack?.ok || !ack?.message) {
          if (ack?.message) antdMessage.error(ack.message);
          return;
        }
        setMessages((prev) => {
          if (prev.some((m) => String(m.id) === String(ack.message.id))) return prev;
          return [...prev, ack.message];
        });
        setComposerText("");
        forceScrollToBottomRef.current = true;
        scheduleConversationRefresh();
      }
    );
  };

  const handleToggleBlock = async () => {
    if (!canBlockConversation || !currentConversation?.id || !token || blockBusy) return;
    setBlockBusy(true);
    const isBlocked = !!currentConversation?.isBlocked;
    const endpoint = isBlocked ? "unblock" : "block";
    try {
      const res = await axios.patch(
        `${API_BASE}/api/chat/conversations/${currentConversation.id}/${endpoint}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const updated = res.data?.conversation;
      if (updated) {
        setChatList((prev) => prev.map((c) => (String(c.id) === String(updated.id) ? updated : c)));
      }
      antdMessage.success(isBlocked ? "Chat unblocked" : "Chat blocked");
      scheduleConversationRefresh();
    } catch (error) {
      antdMessage.error(error?.response?.data?.message || "Action failed");
    } finally {
      setBlockBusy(false);
    }
  };

  const handleOpenSupportConversation = useCallback(async () => {
    if (!token || supportOpenBusy) return;
    setSupportOpenBusy(true);
    try {
      const res = await axios.post(
        `${API_BASE}/api/chat/conversations/open`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const convo = res.data?.conversation;
      if (!res.data?.success || !convo?.id) {
        throw new Error(res.data?.message || "Failed to open support conversation");
      }

      setChatList((prev) => mergeById(prev, [convo]));
      navigate(`/chats/${convo.id}`);
    } catch (error) {
      antdMessage.error(error?.response?.data?.message || error?.message || "Failed to open support conversation");
    } finally {
      setSupportOpenBusy(false);
    }
  }, [token, supportOpenBusy, navigate]);

  const currentPartnerMeta = useMemo(
    () => getPartnerMeta(currentConversation),
    [currentConversation, getPartnerMeta]
  );
  const onlineUserIdSet = useMemo(() => new Set(onlineUserIds.map((id) => String(id))), [onlineUserIds]);
  const currentPartnerId = currentPartnerMeta?.id;
  const isCurrentPartnerOnline = currentPartnerId ? onlineUserIdSet.has(String(currentPartnerId)) : false;
  const partnerName = currentPartnerMeta?.name || (String(currentConversation?.customerId) === String(user?.id) ? "Support Team" : `User #${currentConversation?.customerId || chatId}`);
  const isSupportConversation = String(currentConversation?.contextType || "").toLowerCase() === "support";
  const headerDisplayName = !isSupportViewer && isSupportConversation ? "Support Chat" : partnerName;
  const currentAvatarSrc = getAvatarUrl(currentPartnerMeta?.imageUrl);
  const useSupportHeaderAvatar = isEndUserSupportOnlyMode && isSupportConversation;
  const useCompactSupportHeader = isSupportViewer && !isDesktop;

  const getConversationPreview = useCallback(
    (item) => {
      const cached = conversationPreviewMap[String(item?.id || "")];
      if (cached) return cached;
      const raw =
        item?.lastMessageBody ||
        item?.lastMessageText ||
        item?.lastMessagePreview ||
        item?.last_message_body ||
        item?.last_message_text ||
        item?.previewText ||
        item?.snippet ||
        item?.latestMessage?.body ||
        item?.latestMessage?.text ||
        item?.lastMessage?.body ||
        item?.lastMessage?.text ||
        item?.lastMessage ||
        item?.messagePreview ||
        item?.message ||
        "";
      const safeRaw = typeof raw === "string" || typeof raw === "number" ? raw : "";
      const text = String(safeRaw || "").replace(/\s+/g, " ").trim();
      if (!text) {
        const hasActivity = !!(item?.lastMessageAt || item?.updatedAt);
        return hasActivity
          ? (isEndUserSupportOnlyMode ? "Open chat to view latest message" : "Latest message available")
          : "No messages yet";
      }

      const senderId =
        item?.lastMessageSenderId || item?.lastMessage?.senderId || item?.messageSenderId || item?.senderId;
      const byMe = String(senderId || "") === String(user?.id || "");
      return `${byMe ? "You: " : ""}${text}`;
    },
    [user?.id, conversationPreviewMap, isEndUserSupportOnlyMode]
  );

  useEffect(() => {
    if (!chatId || !messages.length) return;
    const latest = messages[messages.length - 1];
    const text = String(latest?.body || "").replace(/\s+/g, " ").trim();
    if (!text) return;
    const byMe = String(latest?.senderId || "") === String(user?.id || "");
    const preview = `${byMe ? "You: " : ""}${text}`;
    setConversationPreviewMap((prev) => {
      const key = String(chatId);
      if (prev[key] === preview) return prev;
      return { ...prev, [key]: preview };
    });
  }, [chatId, messages, user?.id]);

  useEffect(() => {
    if (!token || !chatList.length) return;
    if (isEndUserSupportOnlyMode) return;
    const missing = chatList
      .filter((item) => {
        const id = String(item?.id || "");
        if (!id || conversationPreviewMap[id] || previewLookupInFlightRef.current.has(id)) return false;
        const raw =
          item?.lastMessageBody ||
          item?.lastMessageText ||
          item?.lastMessagePreview ||
          item?.last_message_body ||
          item?.last_message_text ||
          item?.previewText ||
          item?.snippet ||
          item?.latestMessage?.body ||
          item?.latestMessage?.text ||
          item?.lastMessage?.body ||
          item?.lastMessage?.text ||
          item?.lastMessage ||
          item?.messagePreview ||
          item?.message ||
          "";
        const safeRaw = typeof raw === "string" || typeof raw === "number" ? raw : "";
        return !String(safeRaw || "").trim();
      })
      .slice(0, 5);

    if (!missing.length) return;
    let cancelled = false;

    missing.forEach((item) => {
      const id = String(item.id);
      previewLookupInFlightRef.current.add(id);
      axios
        .get(`${API_BASE}/api/chat/conversations/${item.id}/messages`, {
          headers: { Authorization: `Bearer ${token}` },
          params: { limit: 1 },
        })
        .then((res) => {
          if (cancelled) return;
          const rows = res.data?.rows || [];
          const msg = rows[rows.length - 1] || rows[0] || null;
          const body = String(msg?.body || "").replace(/\s+/g, " ").trim();
          if (!body) return;
          setConversationPreviewMap((prev) => ({ ...prev, [id]: body }));
        })
        .catch(() => {})
        .finally(() => {
          previewLookupInFlightRef.current.delete(id);
        });
    });

    return () => {
      cancelled = true;
    };
  }, [chatList, token, conversationPreviewMap, isEndUserSupportOnlyMode]);

  const filteredChatList = useMemo(() => {
    const needle = String(debouncedChatSearch || "").trim().toLowerCase();
    const prepared = !needle
      ? chatList
      : chatList.filter((item) => {
          const meta = getPartnerMeta(item);
          const name = meta?.name || "";
          const status = item?.status || "";
          const preview = getConversationPreview(item);
          return (
            name.toLowerCase().includes(needle) ||
            String(meta?.email || "").toLowerCase().includes(needle) ||
            String(meta?.phone || "").toLowerCase().includes(needle) ||
            String(item.id).includes(needle) ||
            status.toLowerCase().includes(needle) ||
            preview.toLowerCase().includes(needle) ||
            "support chat".includes(needle)
          );
        });

    return [...prepared].sort((a, b) => {
      const aIsSupport = String(a.contextType || "").toLowerCase() === "support" ? 1 : 0;
      const bIsSupport = String(b.contextType || "").toLowerCase() === "support" ? 1 : 0;
      if (aIsSupport !== bIsSupport) return bIsSupport - aIsSupport;

      const aTs = new Date(a.lastMessageAt || a.updatedAt || a.createdAt || 0).getTime();
      const bTs = new Date(b.lastMessageAt || b.updatedAt || b.createdAt || 0).getTime();

      if (isAdminOrSubAdmin && aTs !== bTs) return bTs - aTs;

      const aUnread = Number(a.unreadCount || 0);
      const bUnread = Number(b.unreadCount || 0);
      if (aUnread !== bUnread) return bUnread - aUnread;

      return bTs - aTs;
    });
  }, [debouncedChatSearch, chatList, getPartnerMeta, getConversationPreview, isAdminOrSubAdmin]);

  const handleChatListScroll = (e) => {
    const el = e.currentTarget;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (nearBottom) fetchConversations({ reset: false });
  };

  const handleMessageScroll = (e) => {
    const el = e.currentTarget;
    if (el.scrollTop < 80) fetchMessages({ reset: false });
  };

  const applyDeletedConversationsLocally = useCallback((ids = []) => {
    const idSet = new Set(ids.map((x) => String(x)));
    setChatList((prev) => prev.filter((c) => !idSet.has(String(c.id))));
    setSelectedChatIds((prev) => prev.filter((id) => !idSet.has(String(id))));
    if (chatId && idSet.has(String(chatId))) {
      navigate("/chats");
      setCurrentConversation(null);
      setMessages([]);
    }
  }, [chatId, navigate]);

  const handleDeleteChat = useCallback(async (conversationId) => {
    if (!canDeleteConversations || !token) return;

    setDeletingChatIds((prev) => [...prev, conversationId]);
    try {
      const res = await axios.delete(`${API_BASE}/api/chat/conversations/${conversationId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.data?.success) throw new Error(res.data?.message || "Delete failed");
      applyDeletedConversationsLocally(res.data.deletedIds || [conversationId]);
      antdMessage.success("Chat deleted");
      fetchConversationsRef.current?.({ reset: true });
    } catch (error) {
      antdMessage.error(error?.response?.data?.message || error?.message || "Delete failed");
    } finally {
      setDeletingChatIds((prev) => prev.filter((id) => String(id) !== String(conversationId)));
    }
  }, [canDeleteConversations, token, applyDeletedConversationsLocally]);

  const handleDeleteSelected = useCallback(async () => {
    if (!canManageConversations || !token || !selectedChatIds.length) return;

    setDeletingBulk(true);
    try {
      const res = await axios.post(
        `${API_BASE}/api/chat/conversations/bulk-delete`,
        { ids: selectedChatIds },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.data?.success) throw new Error(res.data?.message || "Bulk delete failed");
      const deletedIds = Array.isArray(res.data.deletedIds) ? res.data.deletedIds : selectedChatIds;
      applyDeletedConversationsLocally(deletedIds);
      setSelectionMode(false);
      antdMessage.success(`${deletedIds.length} chat deleted`);
      fetchConversationsRef.current?.({ reset: true });
    } catch (error) {
      antdMessage.error(error?.response?.data?.message || error?.message || "Bulk delete failed");
    } finally {
      setDeletingBulk(false);
    }
  }, [canManageConversations, token, selectedChatIds, applyDeletedConversationsLocally]);

  return (
    <Layout style={{ height: "100dvh", background: "#f8fafc" }}>
      {(isDesktop || !chatId) && (
        <Sider
          width={isDesktop ? 360 : "100%"}
          theme="light"
          style={{ borderRight: "1px solid #e5e7eb", height: "100%", zIndex: 1 }}
        >
          <ChatConversationList
            chatId={chatId}
            chatLoading={chatLoading}
            chatLoadingMore={chatLoadingMore}
            filteredChatList={filteredChatList}
            chatSearch={chatSearch}
            onSearchChange={setChatSearch}
            onSearchSubmit={(value) => setDebouncedChatSearch(String(value || ""))}
            onChatListScroll={handleChatListScroll}
            onOpenChat={(id) => navigate(`/chats/${id}`)}
            getPartnerMeta={getPartnerMeta}
            getAvatarUrl={getAvatarUrl}
            getConversationPreview={getConversationPreview}
            formatRelativeAgo={formatRelativeAgo}
            isSupportViewer={isSupportViewer}
            onHeaderClick={() => navigate("/")}
            onBackClick={() => navigate(-1)}
            isSupportOnlyMode={isEndUserSupportOnlyMode}
            showGlobalSearchLabel={!isEndUserSupportOnlyMode}
            onStartSupport={handleOpenSupportConversation}
            supportOpenBusy={supportOpenBusy}
            canDeleteConversations={canDeleteConversations}
            canManageConversations={canManageConversations}
            selectionMode={selectionMode}
            selectedChatIds={selectedChatIds}
            onToggleSelectionMode={() => {
              setSelectionMode((v) => !v);
              setSelectedChatIds([]);
            }}
            onToggleSelectChat={(id, checked) =>
              setSelectedChatIds((prev) =>
                checked ? [...new Set([...prev, id])] : prev.filter((x) => String(x) !== String(id))
              )
            }
            onDeleteChat={handleDeleteChat}
            onDeleteSelected={handleDeleteSelected}
            deletingChatIds={deletingChatIds}
            deletingBulk={deletingBulk}
            initialScrollTop={chatListScrollTopRef.current}
            onListScrollTopChange={(v) => { chatListScrollTopRef.current = v; }}
          />
        </Sider>
      )}

      {(isDesktop || chatId) && (
        <Content style={{ height: "100%", display: "flex", flexDirection: "column" }}>
          {chatId ? (
            <>
              <div
                style={{
                  padding: isDesktop ? "0 14px" : "0 10px",
                  borderBottom: "1px solid #e5e7eb",
                  display: "flex",
                  alignItems: "center",
                  gap: isDesktop ? "12px" : "8px",
                  minHeight: isDesktop ? "68px" : "58px",
                  background: "#fff",
                }}
              >
                {!isDesktop && <Button icon={<ArrowLeftOutlined />} type="text" onClick={() => navigate("/chats")} />}
                <Avatar
                  src={useSupportHeaderAvatar ? null : currentAvatarSrc}
                  icon={useSupportHeaderAvatar ? <CustomerServiceOutlined /> : !currentAvatarSrc && <UserOutlined />}
                  style={
                    useSupportHeaderAvatar
                      ? {
                          cursor: "default",
                          background: "linear-gradient(135deg, #2563eb 0%, #0ea5e9 100%)",
                          color: "#fff",
                        }
                      : { cursor: currentPartnerId ? "pointer" : "default" }
                  }
                  onClick={useSupportHeaderAvatar ? undefined : openProfile}
                />
                <div style={{ minWidth: 0, flex: 1 }}>
              <Button type="link" style={{ padding: 0, height: "auto", lineHeight: 1, maxWidth: "100%" }} onClick={openProfile} disabled={!currentPartnerId || useSupportHeaderAvatar}>
                <Text strong style={{ fontSize: isDesktop ? 16 : 14 }}>
                  {headerDisplayName}
                </Text>
                  </Button>
                  {!useCompactSupportHeader ? (
                    <div style={{ display: "flex", alignItems: "center", gap: isDesktop ? 8 : 6, flexWrap: "wrap" }}>
                      <Tag
                        color="cyan"
                        icon={<MessageOutlined />}
                        style={{ marginInlineEnd: 0, fontSize: 11, paddingInline: 6 }}
                      >
                        {isDesktop ? "Support Chat" : "Support"}
                      </Tag>
                      <Tag color={isCurrentPartnerOnline ? "green" : "default"} style={{ marginInlineEnd: 0 }}>
                        {isCurrentPartnerOnline ? "Online" : "Offline"}
                      </Tag>
                      <Tag color={(currentConversation?.status || "open") === "open" ? "blue" : "default"} style={{ marginInlineEnd: 0 }}>
                        {currentConversation?.status || "open"}
                      </Tag>
                      {!!currentConversation?.isBlocked && (
                        <Tag color="red" style={{ marginInlineEnd: 0 }}>
                          Blocked
                        </Tag>
                      )}
                    </div>
                  ) : (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {isCurrentPartnerOnline ? "Online" : "Offline"}
                    </Text>
                  )}
                </div>
                {canBlockConversation && !useCompactSupportHeader && (
                  <Button
                    danger={!currentConversation?.isBlocked}
                    loading={blockBusy}
                    onClick={handleToggleBlock}
                    size={isDesktop ? "middle" : "small"}
                  >
                    {currentConversation?.isBlocked ? "Unblock" : "Block"}
                  </Button>
                )}
                {!useSupportHeaderAvatar && !useCompactSupportHeader && (
                  <Button
                    type="text"
                    size={isDesktop ? "middle" : "small"}
                    icon={<InfoCircleOutlined />}
                    onClick={openProfile}
                    disabled={!currentPartnerId}
                  />
                )}
                {canDeleteConversations && currentConversation?.id && !useCompactSupportHeader && (
                  <Button
                    type="text"
                    danger
                    size={isDesktop ? "middle" : "small"}
                    icon={<DeleteOutlined />}
                    loading={deletingChatIds.includes(currentConversation.id)}
                    onClick={() => handleDeleteChat(currentConversation.id)}
                    aria-label="Delete Chat"
                  />
                )}
                {!useCompactSupportHeader ? (
                  <Button
                    type="text"
                    size={isDesktop ? "middle" : "small"}
                    icon={<HomeOutlined />}
                    onClick={() => navigate("/")}
                    aria-label="Go Home"
                  />
                ) : (
                  <Button
                    type="text"
                    size="small"
                    icon={<InfoCircleOutlined />}
                    onClick={() => setConversationInfoOpen(true)}
                    aria-label="Conversation details"
                  />
                )}
              </div>

              {useCompactSupportHeader && (
                <Drawer
                  placement="bottom"
                  size={200}
                  open={conversationInfoOpen}
                  onClose={() => setConversationInfoOpen(false)}
                  title="Conversation Details"
                >
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                    <Tag color="cyan" icon={<MessageOutlined />}>Support</Tag>
                    <Tag color={isCurrentPartnerOnline ? "green" : "default"}>
                      {isCurrentPartnerOnline ? "Online" : "Offline"}
                    </Tag>
                    <Tag color={(currentConversation?.status || "open") === "open" ? "blue" : "default"}>
                      {currentConversation?.status || "open"}
                    </Tag>
                    {!!currentConversation?.isBlocked && <Tag color="red">Blocked</Tag>}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {canBlockConversation && (
                      <Button
                        danger={!currentConversation?.isBlocked}
                        loading={blockBusy}
                        onClick={handleToggleBlock}
                        size="small"
                      >
                        {currentConversation?.isBlocked ? "Unblock" : "Block"}
                      </Button>
                    )}
                    {!useSupportHeaderAvatar && (
                      <Button size="small" icon={<InfoCircleOutlined />} onClick={openProfile} disabled={!currentPartnerId}>
                        Profile
                      </Button>
                    )}
                    {canDeleteConversations && currentConversation?.id && (
                      <Button
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                        loading={deletingChatIds.includes(currentConversation.id)}
                        onClick={() => handleDeleteChat(currentConversation.id)}
                      >
                        Delete
                      </Button>
                    )}
                    <Button size="small" icon={<HomeOutlined />} onClick={() => navigate("/")}>
                      Home
                    </Button>
                  </div>
                </Drawer>
              )}

              <div
                ref={messageWrapRef}
                onScroll={handleMessageScroll}
                style={{ flex: 1, padding: isDesktop ? "20px" : "14px", overflowY: "auto", background: "#f3f4f6" }}
              >
                {(messageLoading || messageLoadingMore) && (
                  <div style={{ textAlign: "center", marginBottom: 12 }}>
                    <Spin size="small" />
                  </div>
                )}

                {!messageLoading && !messages.length && <Empty description="No messages yet" />}

                {messages.map((msg) => {
                  const isMyMessage = String(msg.senderId) === String(user?.id);
                  return (
                    <div
                      key={msg.id || `${msg.senderId}-${msg.createdAt}`}
                      style={{
                        display: "flex",
                        justifyContent: isMyMessage ? "flex-end" : "flex-start",
                        marginBottom: "12px",
                      }}
                    >
                      <div
                        style={{
                          background: isMyMessage ? "#1677ff" : "#fff",
                          padding: "10px 14px",
                          borderRadius: isMyMessage ? "12px 4px 12px 12px" : "4px 12px 12px 12px",
                          maxWidth: isDesktop ? "70%" : "86%",
                          color: isMyMessage ? "#fff" : "inherit",
                          boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
                        }}
                      >
                        <Text style={{ color: isMyMessage ? "#fff" : "inherit", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                          {msg.body || ""}
                        </Text>
                        <div
                          style={{
                            fontSize: 10,
                            marginTop: 5,
                            opacity: 0.78,
                            display: "flex",
                            justifyContent: "flex-end",
                            gap: 8,
                          }}
                        >
                          <span>{formatRelativeAgo(msg.createdAt)}</span>
                          {isMyMessage && <span>{msg.readAt ? "Read" : "Delivered"}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ padding: isDesktop ? "14px 16px" : "10px 12px", borderTop: "1px solid #e5e7eb", background: "#fff" }}>
                {!!currentConversation?.isBlocked && !isSupportViewer && (
                  <Text type="danger" style={{ display: "block", marginBottom: 8 }}>
                    This chat is blocked by admin. You can only read previous messages.
                  </Text>
                )}
                <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                  <TextArea
                    value={composerText}
                    autoSize={{ minRows: 1, maxRows: 4 }}
                    placeholder="Type your message..."
                    onChange={(e) => setComposerText(e.target.value)}
                    onPressEnter={(e) => {
                      if (e.shiftKey) return;
                      e.preventDefault();
                      handleSendMessage(composerText);
                    }}
                  />
                  <Button
                    type="primary"
                    icon={<SendOutlined />}
                    onClick={() => handleSendMessage(composerText)}
                    disabled={!String(composerText || "").trim() || (!!currentConversation?.isBlocked && !isSupportViewer)}
                  >
                    {isDesktop ? "Send" : null}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                background: "#f8fafc",
                flexDirection: "column",
                padding: 16,
              }}
            >
              {!isSupportViewer ? (
                <Card
                  bordered={false}
                  style={{
                    width: "100%",
                    maxWidth: 520,
                    borderRadius: 16,
                    boxShadow: "0 10px 30px rgba(15,23,42,0.06)",
                  }}
                  bodyStyle={{ padding: isDesktop ? 28 : 20, textAlign: "center" }}
                >
                  <div
                    style={{
                      width: 76,
                      height: 76,
                      borderRadius: 999,
                      margin: "0 auto 14px",
                      display: "grid",
                      placeItems: "center",
                      background: "linear-gradient(135deg, #dbeafe 0%, #cffafe 100%)",
                      color: "#0f766e",
                      fontSize: 30,
                    }}
                  >
                    <CustomerServiceOutlined />
                  </div>
                  <Title level={4} style={{ marginBottom: 8 }}>
                    Support Chat
                  </Title>
                  <Text type="secondary" style={{ display: "block", lineHeight: 1.6 }}>
                    If you face any issues, message the admin/support team to get help.
                  </Text>
                  <Button
                    type="primary"
                    size="large"
                    icon={<MessageOutlined />}
                    style={{ marginTop: 16 }}
                    loading={supportOpenBusy}
                    onClick={handleOpenSupportConversation}
                  >
                    Click to Start Chat
                  </Button>
                </Card>
              ) : (
                <>
                  <UserOutlined style={{ fontSize: 56, marginBottom: 14, opacity: 0.15 }} />
                  <Text type="secondary" style={{ fontSize: 16, textAlign: "center" }}>
                    Select a support conversation
                  </Text>
                </>
              )}
            </div>
          )}
        </Content>
      )}

      <Drawer
        title="User Details"
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        placement={isDesktop ? "right" : "bottom"}
        size={isDesktop ? 420 : 300}
      >
        {profileLoading ? (
          <Skeleton active avatar paragraph={{ rows: 6 }} />
                ) : !profileData?.user ? (
                  <Empty description="No details found" />
                ) : profileData?.guest ? (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <Avatar size={64} icon={<UserOutlined />} />
                      <div>
                        <Title level={5} style={{ margin: 0 }}>
                          {profileData.user.name || "Guest User"}
                        </Title>
                        <Text type="secondary">Guest Support User</Text>
                        <br />
                        <Text type="secondary">Email: {profileData.user.email || "N/A"}</Text>
                        <br />
                        <Text type="secondary">Phone: {profileData.user.phone || "N/A"}</Text>
                        <br />
                        <Text type="secondary">Subject: {profileData.user.subject || "N/A"}</Text>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Avatar size={64} src={getAvatarUrl(profileData.user.imageUrl)} icon={<UserOutlined />} />
              <div>
                <Title level={5} style={{ margin: 0 }}>
                  {profileData.user.name}
                </Title>
                <Text type="secondary">Role: {profileData.user.role || "user"}</Text>
                <br />
                <Text type="secondary">Balance: {Number(profileData.user.balance || 0).toFixed(2)}</Text>
                <br />
                <Text type="secondary">Joined: {new Date(profileData.user.createdAt).toLocaleDateString()}</Text>
              </div>
            </div>

            <Divider />

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
              <Tag color="blue">Total Orders: {Number(profileData?.stats?.totalOrders || 0)}</Tag>
              <Tag color="green">Delivered: {Number(profileData?.stats?.deliveredOrders || 0)}</Tag>
              <Tag color="red">Cancelled: {Number(profileData?.stats?.cancelledOrders || 0)}</Tag>
            </div>

            <Card size="small" style={{ marginBottom: 14 }}>
              <Text strong>Total Spent: </Text>
              <Text>{Number(profileData?.stats?.totalSpent || 0).toFixed(2)}</Text>
            </Card>

            <Title level={5}>Recent Orders</Title>
            {!Array.isArray(profileData?.recentOrders) || !profileData.recentOrders.length ? (
              <Empty description="No recent orders" />
            ) : (
              <div className="space-y-2">
                {profileData.recentOrders.slice(0, 8).map((item) => (
                  <div
                    key={item?.id}
                    className="p-2 rounded border bg-white"
                    style={{ display: "flex", gap: 12 }}
                  >
                    <div style={{ flex: 1 }}>
                      <div>
                        <Text strong>{item?.name || `Order #${item?.id}`}</Text>
                      </div>

                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                        <Tag>{item?.status || "pending"}</Tag>
                        <Tag>Qty: {Number(item?.quantity || 0)}</Tag>
                        <Tag>Price: {Number(item?.price || 0).toFixed(2)}</Tag>

                        <Text type="secondary">
                          {new Date(item?.createdAt).toLocaleDateString()}
                        </Text>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </Drawer>
    </Layout>
  );
};

export default ChatLayout;
