import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Avatar, Button, Card, Empty, Form, Input, List, Space, Tag, Typography } from "antd";
import { MessageOutlined, SendOutlined, UserOutlined } from "@ant-design/icons";
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

  const guestLabel = useMemo(() => {
    const c = session?.conversation;
    if (!c) return "";
    return c.guestName || c.guestEmail || c.guestPhone || "Guest";
  }, [session]);

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
      .catch(() => {});

    setLoadingMessages(true);
    axios
      .get(`${CHAT_API}/api/chat/conversations/${conversationId}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { limit: 40 },
      })
      .then((res) => {
        if (res.data?.success) setMessages(res.data.rows || []);
      })
      .catch(() => setError("Failed to load support messages"))
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
        setError(ack?.message || "Failed to send message");
        return;
      }
      setMessages((prev) => (prev.some((m) => String(m.id) === String(ack.message.id)) ? prev : [...prev, ack.message]));
      setText("");
      setError("");
    });
  };

  const resetGuestChat = () => {
    localStorage.removeItem(STORAGE_KEY);
    setSession(null);
    setMessages([]);
    setText("");
    form.resetFields();
  };

  return (
    <div style={{ maxWidth: 860, margin: "24px auto", padding: "0 12px" }}>
      <Card>
        <Space direction="vertical" size={14} style={{ width: "100%" }}>
          <Title level={4} style={{ margin: 0 }}>
            Support Chat
          </Title>
          <Text type="secondary">Login/Register chara support team er sathe chat korte parben.</Text>

          {error && <Alert type="error" message={error} showIcon />}

          {!session ? (
            <Form form={form} layout="vertical" onFinish={startSupport}>
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
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <Space>
                  <Avatar icon={<UserOutlined />} />
                  <Text strong>{guestLabel}</Text>
                  <Tag color="blue">Guest Session</Tag>
                  {isBlocked && <Tag color="red">Blocked</Tag>}
                </Space>
                <Button danger type="text" onClick={resetGuestChat}>
                  End Session
                </Button>
              </div>
              {isBlocked && (
                <Alert
                  type="warning"
                  showIcon
                  message="This chat is blocked by admin. You cannot send new messages now."
                />
              )}

              <div
                ref={wrapRef}
                style={{
                  maxHeight: "56vh",
                  overflowY: "auto",
                  background: "#f7f7f8",
                  border: "1px solid #f0f0f0",
                  borderRadius: 10,
                  padding: 12,
                }}
              >
                {loadingMessages ? (
                  <Text type="secondary">Loading messages...</Text>
                ) : !messages.length ? (
                  <Empty description="No message yet" />
                ) : (
                  <List
                    dataSource={messages}
                    renderItem={(msg) => {
                      const isMine = String(msg.senderId) === String(session?.conversation?.customerId);
                      return (
                        <List.Item style={{ justifyContent: isMine ? "flex-end" : "flex-start", border: "none", padding: "4px 0" }}>
                          <div
                            style={{
                              background: isMine ? "#1677ff" : "#fff",
                              color: isMine ? "#fff" : "#111827",
                              padding: "8px 12px",
                              borderRadius: 10,
                              maxWidth: "80%",
                            }}
                          >
                            {msg.body}
                          </div>
                        </List.Item>
                      );
                    }}
                  />
                )}
              </div>

              <Space.Compact style={{ width: "100%" }}>
                <Input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Type message..."
                  onPressEnter={sendMessage}
                  disabled={isBlocked}
                />
                <Button type="primary" icon={<SendOutlined />} onClick={sendMessage} disabled={!String(text || "").trim() || isBlocked}>
                  Send
                </Button>
              </Space.Compact>
            </>
          )}
        </Space>
      </Card>
    </div>
  );
};

export default GuestSupportChat;
