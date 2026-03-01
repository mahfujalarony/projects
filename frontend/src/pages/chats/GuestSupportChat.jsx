import React, { useEffect, useRef, useState } from "react";
import { Alert, Button, Empty, Form, Input, List, Tag, Typography } from "antd";
import { MessageOutlined, SendOutlined } from "@ant-design/icons";
import axios from "axios";
import { io } from "socket.io-client";
import { CHAT_BASE_URL } from "../../config/env";

const CHAT_API = CHAT_BASE_URL;
const STORAGE_KEY = "guestSupportSession";
const { Text, Title } = Typography;

const GuestSupportChat = () => {
  const [form] = Form.useForm();
  const [session, setSession] = useState(null);
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState("");
  const wrapRef = useRef(null);

  const conversationId = session?.conversation?.id;
  const token = session?.token;
  const isBlocked = !!session?.conversation?.isBlocked;

  const clearGuestSession = () => {
    localStorage.removeItem(STORAGE_KEY);
    setSession(null);
    setMessages([]);
    setText("");
    form.resetFields();
    setError("");
  };

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (saved?.token && saved?.conversation?.id) {
        setSession(saved);
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    const s = io(CHAT_API, { auth: { token } });
    setSocket(s);
    return () => {
      s.disconnect();
      setSocket(null);
    };
  }, [token]);

  useEffect(() => {
    if (!socket || !conversationId) return;

    socket.emit("join_conversation", { conversationId: Number(conversationId) });
    const onNewMessage = ({ message }) => {
      if (!message || String(message.conversationId) !== String(conversationId)) return;
      setMessages((prev) => (prev.some((m) => String(m.id) === String(message.id)) ? prev : [...prev, message]));
    };
    const onConversationStatusChanged = ({ conversationId: eventConversationId, isBlocked: eventBlocked, blockedAt, blockedById, blockReason }) => {
      if (String(eventConversationId) !== String(conversationId)) return;
      setSession((prev) => {
        if (!prev?.conversation) return prev;
        const next = {
          ...prev,
          conversation: {
            ...prev.conversation,
            isBlocked: !!eventBlocked,
            blockedAt: blockedAt || null,
            blockedById: blockedById || null,
            blockReason: blockReason || null,
          },
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    };
    socket.on("new_message", onNewMessage);
    socket.on("conversation_status_changed", onConversationStatusChanged);

    return () => {
      socket.off("new_message", onNewMessage);
      socket.off("conversation_status_changed", onConversationStatusChanged);
    };
  }, [socket, conversationId]);

  useEffect(() => {
    if (!token || !conversationId) return;
    axios
      .post(
        `${CHAT_API}/api/chat/conversations/open`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      )
      .then((res) => {
        const convo = res.data?.conversation;
        if (!convo?.id) return;
        setSession((prev) => {
          if (!prev) return prev;
          const next = { ...prev, conversation: convo };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
          return next;
        });
      })
      .catch((err) => {
        const status = Number(err?.response?.status || 0);
        const msg = String(err?.response?.data?.message || err?.message || "").toLowerCase();
        if (status === 404 || msg.includes("conversation not found")) {
          clearGuestSession();
        }
      });

    setLoadingMessages(true);
    axios
      .get(`${CHAT_API}/api/chat/conversations/${conversationId}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { limit: 40 },
      })
      .then((res) => {
        if (res.data?.success) setMessages(res.data.rows || []);
      })
      .catch((err) => {
        const status = Number(err?.response?.status || 0);
        const msg = String(err?.response?.data?.message || err?.message || "").toLowerCase();
        if (status === 404 || msg.includes("conversation not found")) {
          clearGuestSession();
          return;
        }
        setError("Failed to load support messages");
      })
      .finally(() => setLoadingMessages(false));
  }, [conversationId, token]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  const startSupport = async (values) => {
    setBusy(true);
    setError("");
    try {
      const res = await axios.post(`${CHAT_API}/api/chat/guest/session`, values);
      if (!res.data?.success || !res.data?.token || !res.data?.conversation?.id) {
        throw new Error("Unable to start support chat");
      }
      const next = { token: res.data.token, conversation: res.data.conversation };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setSession(next);
      setMessages([]);
    } catch (e) {
      setError(e?.response?.data?.message || e.message || "Failed to start support chat");
    } finally {
      setBusy(false);
    }
  };

  const sendMessage = () => {
    const body = String(text || "").trim();
    if (!body || !socket || !conversationId) return;
    if (isBlocked) {
      setError("This chat is blocked by admin");
      return;
    }
    socket.emit("send_message", { conversationId: Number(conversationId), type: "text", body }, (ack) => {
      if (!ack?.ok || !ack?.message) {
        const ackMsg = String(ack?.message || "").toLowerCase();
        if (ackMsg.includes("conversation not found")) {
          clearGuestSession();
          return;
        }
        setError(ack?.message || "Failed to send message");
        return;
      }
      setMessages((prev) => (prev.some((m) => String(m.id) === String(ack.message.id)) ? prev : [...prev, ack.message]));
      setText("");
      setError("");
    });
  };

  return (
    <div
      style={{
        maxWidth: 980,
        margin: "0 auto",
        padding: 0,
        height: "calc(100dvh - 76px)",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              borderBottom: "1px solid #f0f0f0",
              padding: "10px 12px",
              flexShrink: 0,
              background: "#fff",
            }}
          >
            <MessageOutlined style={{ fontSize: 20, color: "#1677ff" }} />
            <Title level={4} style={{ margin: 0 }}>
              Support Chat
            </Title>
          </div>

          {error && <Alert type="error" message={error} showIcon style={{ margin: 8 }} />}

          {!session ? (
            <Form form={form} layout="vertical" onFinish={startSupport} style={{ padding: 12 }}>
              <Form.Item name="name" label="Name" rules={[{ required: true, message: "Name is required" }]}>
                <Input placeholder="Your name" />
              </Form.Item>
              <Form.Item name="email" label="Email">
                <Input placeholder="you@example.com" />
              </Form.Item>
              <Form.Item name="phone" label="Phone">
                <Input placeholder="01XXXXXXXXX" />
              </Form.Item>
              <Form.Item name="subject" label="Subject">
                <Input placeholder="What do you need help with?" />
              </Form.Item>
              <Button type="primary" htmlType="submit" loading={busy} icon={<MessageOutlined />}>
                Start Support Chat
              </Button>
            </Form>
          ) : (
            <>
              {isBlocked && <Tag color="red">Blocked</Tag>}
              {isBlocked && (
                <Alert
                  type="warning"
                  showIcon
                  message="This chat is blocked by admin. You cannot send new messages now."
                  style={{ margin: 8 }}
                />
              )}

                <div
                  style={{
                    flex: 1,
                    minHeight: 0,
                  background: "#f8fafc",
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                }}
              >
                <div
                  ref={wrapRef}
                  style={{
                    flex: 1,
                    overflowY: "auto",
                    padding: "10px 12px",
                  }}
                >
                  {loadingMessages ? (
                    <Text type="secondary">Loading messages...</Text>
                  ) : !messages.length ? (
                    <Empty description="Start a conversation" />
                  ) : (
                    <List
                      dataSource={messages}
                      renderItem={(msg) => {
                        const isMine = String(msg.senderId) === String(session?.conversation?.customerId);
                        return (
                          <List.Item
                            style={{
                              justifyContent: isMine ? "flex-end" : "flex-start",
                              border: "none",
                              padding: "5px 0",
                            }}
                          >
                            {isMine ? (
                              <div
                                style={{
                                  background: "linear-gradient(135deg, #1677ff 0%, #1d4ed8 100%)",
                                  color: "#ffffff",
                                  padding: "9px 12px",
                                  borderRadius: "14px 14px 4px 14px",
                                  maxWidth: "82%",
                                  wordBreak: "break-word",
                                  lineHeight: 1.4,
                                }}
                              >
                                {msg.body}
                              </div>
                            ) : (
                              <div style={{ display: "flex", alignItems: "flex-end", gap: 8, maxWidth: "84%" }}>
                                <div
                                  style={{
                                    width: 24,
                                    height: 24,
                                    borderRadius: "50%",
                                    background: "#dbeafe",
                                    color: "#1d4ed8",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: 12,
                                    fontWeight: 700,
                                    flexShrink: 0,
                                  }}
                                >
                                  S
                                </div>
                                <div
                                  style={{
                                    background: "#eef2f7",
                                    color: "#111827",
                                    padding: "9px 12px",
                                    borderRadius: "14px 14px 14px 4px",
                                    border: "1px solid #dbe3ee",
                                    wordBreak: "break-word",
                                    lineHeight: 1.45,
                                  }}
                                >
                                  {msg.body}
                                </div>
                              </div>
                            )}
                          </List.Item>
                        );
                      }}
                    />
                  )}
                </div>

                <div
                  style={{
                    padding: 8,
                    borderTop: "1px solid #e5e7eb",
                    background: "#ffffff",
                    flexShrink: 0,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Input.TextArea
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      placeholder="Type a message..."
                      onPressEnter={(e) => {
                        if (!e.shiftKey) {
                          e.preventDefault();
                          sendMessage();
                        }
                      }}
                      disabled={isBlocked}
                      autoSize={{ minRows: 1, maxRows: 5 }}
                      style={{ flex: 1, minWidth: 0 }}
                    />
                    <Button
                      type="primary"
                      icon={<SendOutlined />}
                      onClick={sendMessage}
                      disabled={!String(text || "").trim() || isBlocked}
                      style={{ width: 92, alignSelf: "flex-end" }}
                    >
                      Send
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
      </div>
    </div>
  );
};

export default GuestSupportChat;
