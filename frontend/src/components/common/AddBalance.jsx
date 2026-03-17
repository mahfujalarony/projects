import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Card,
  Typography,
  Space,
  Select,
  List,
  Button,
  Form,
  Input,
  InputNumber,
  Tag,
  message,
} from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import axios from "axios";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { getChatSocket } from "../../realtime/chatSocket";
import { API_BASE_URL } from "../../config/env";
import { CHAT_API_BASE_URL } from "../../config/env";
import { normalizeImageUrl } from "../../utils/imageUrl";

const { Title, Text } = Typography;
const API = `${API_BASE_URL}/api`;
const CHAT_API = CHAT_API_BASE_URL;
const safeArr = (v) => (Array.isArray(v) ? v : []);
const normalizeTransactionId = (value) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase();

export default function AddBalance() {
  const reduxToken = useSelector((state) => state.auth?.token);
  const navigate = useNavigate();

  const [providers, setProviders] = useState([]);
  const [wallets, setWallets] = useState([]);

  const [loadingProviders, setLoadingProviders] = useState(false);
  const [loadingWallets, setLoadingWallets] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [providerId, setProviderId] = useState(null);
  const [walletId, setWalletId] = useState(null);
  const [walletNumberId, setWalletNumberId] = useState(null);

  const [selectedWallet, setSelectedWallet] = useState(null);

  // ✅ pending info
  const [pendingInfo, setPendingInfo] = useState({
    topupBlockedUntil: null,
    isTopupBlocked: false,
    blockedDaysLeft: 0,
    count: 0,
    totalAmount: 0,
    latest: null,
    rejectedCount: 0,
    latestRejected: null,
  });
  const [pendingLoading, setPendingLoading] = useState(false);
  const [supportMessage, setSupportMessage] = useState("");
  const [sendingSupport, setSendingSupport] = useState(false);

  const [form] = Form.useForm();
  const watchAmount = Form.useWatch("amount", form);

  const token = useMemo(() => {
    if (reduxToken) return reduxToken;
    try {
      const saved = JSON.parse(localStorage.getItem("userInfo") || "null");
      return saved?.token || null;
    } catch {
      return null;
    }
  }, [reduxToken]);

  const authHeaders = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);
  const blockedActive = Boolean(pendingInfo?.isTopupBlocked);

  const selectedProvider = useMemo(() => {
    return providers.find((p) => String(p.id) === String(providerId)) || null;
  }, [providers, providerId]);

  const providerRate = useMemo(() => {
    const n = Number(selectedProvider?.dollarRate);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [selectedProvider]);

  const usdPreview = useMemo(() => {
    const amt = Number(watchAmount);
    if (!providerRate || !Number.isFinite(amt) || amt <= 0) return null;
    return (amt / providerRate).toFixed(2);
  }, [providerRate, watchAmount]);

  const minLocalAmount = useMemo(() => {
    return providerRate || 1;
  }, [providerRate]);

  const selectedNumbers = useMemo(() => {
    if (!selectedWallet) return [];
    return safeArr(selectedWallet.numbers);
  }, [selectedWallet]);

  const loadProviders = async () => {
    try {
      setLoadingProviders(true);
      const res = await axios.get(`${API}/client/mobile-banking`, { headers: authHeaders });
      setProviders(safeArr(res.data?.data));
    } catch (e) {
      message.error(e?.response?.data?.message || "Mobile banking load failed");
    } finally {
      setLoadingProviders(false);
    }
  };

  const loadWallets = async (mbId) => {
    try {
      setLoadingWallets(true);
      const res = await axios.get(`${API}/client/mobile-banking/${mbId}/wallets`, {
        headers: authHeaders, // private wallet দেখাতে token লাগতে পারে
      });
      setWallets(safeArr(res.data?.data?.wallets));
    } catch (e) {
      message.error(e?.response?.data?.message || "Wallets load failed");
      setWallets([]);
    } finally {
      setLoadingWallets(false);
    }
  };

  // ✅ pending check
  const loadPending = async () => {
    if (!token) {
      setPendingInfo({
        topupBlockedUntil: null,
        isTopupBlocked: false,
        blockedDaysLeft: 0,
        count: 0,
        totalAmount: 0,
        latest: null,
        rejectedCount: 0,
        latestRejected: null,
      });
      return;
    }
    try {
      setPendingLoading(true);
      const res = await axios.get(`${API}/balance/topup/pending`, { headers: authHeaders });
      setPendingInfo(
        res.data?.data || {
          topupBlockedUntil: null,
          isTopupBlocked: false,
          blockedDaysLeft: 0,
          count: 0,
          totalAmount: 0,
          latest: null,
          rejectedCount: 0,
          latestRejected: null,
        }
      );
    } catch (e) {
      setPendingInfo({
        topupBlockedUntil: null,
        isTopupBlocked: false,
        blockedDaysLeft: 0,
        count: 0,
        totalAmount: 0,
        latest: null,
        rejectedCount: 0,
        latestRejected: null,
      });
    } finally {
      setPendingLoading(false);
    }
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (!token) return;
    loadProviders();
  }, [token]);

  useEffect(() => {
    loadPending();
  }, [token]);

  const providerOptions = useMemo(
    () =>
      providers.map((p) => ({
        value: p.id,
        // ✅ label এ logo + name
        label: (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            {p.imgUrl ? (
              <img
                src={normalizeImageUrl(p.imgUrl)}
                alt={p.name}
                style={{ width: 18, height: 18, borderRadius: 6, objectFit: "cover" }}
                onError={(e) => (e.currentTarget.style.display = "none")}
              />
            ) : null}
            <span>{p.name}</span>
          </span>
        ),
      })),
    [providers]
  );

  const walletOptions = useMemo(
    () =>
      wallets.map((w) => ({
        value: w.id,
        // ✅ wallet logo + name
        label: (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            {w.imgUrl ? (
              <img
                src={normalizeImageUrl(w.imgUrl)}
                alt={w.name}
                style={{ width: 18, height: 18, borderRadius: 6, objectFit: "cover" }}
                onError={(e) => (e.currentTarget.style.display = "none")}
              />
            ) : null}
            <span>
              {w.name} <span style={{ opacity: 0.7 }}>({w.visibility})</span>
            </span>
          </span>
        ),
      })),
    [wallets]
  );

  const onPickProvider = async (id) => {
    setProviderId(id || null);
    setWalletId(null);
    setWalletNumberId(null);
    setSelectedWallet(null);
    form.resetFields(["senderNumber", "amount", "transactionId"]);
    if (id) await loadWallets(id);
    else setWallets([]);
  };

  const onPickWallet = (id) => {
    setWalletId(id || null);
    setWalletNumberId(null);
    const w = wallets.find((x) => String(x.id) === String(id)) || null;
    setSelectedWallet(w);
  };

  const onPickWalletNumber = (id) => setWalletNumberId(id);

  const copyText = async (t) => {
    try {
      await navigator.clipboard.writeText(String(t || ""));
      message.success("Copied");
    } catch {
      message.info("Copy failed (browser permission)");
    }
  };

  const submit = async (values) => {
    if (blockedActive) {
      const untilText = pendingInfo?.topupBlockedUntil
        ? new Date(pendingInfo.topupBlockedUntil).toLocaleString()
        : "later";
      message.error(`Topup is blocked until ${untilText}`);
      return;
    }
    if (!providerId || !walletId || !walletNumberId) {
      message.error("Please select Mobile Banking → Wallet → Number first");
      return;
    }

    try {
      setSubmitting(true);
      const txId = normalizeTransactionId(values.transactionId);
      await axios.post(
        `${API}/balance/topup`,
        {
          mobileBankingId: providerId,
          walletId,
          walletNumberId,
          senderNumber: values.senderNumber?.trim(),
          amount: values.amount,
          transactionId: txId,
        },
        { headers: authHeaders }
      );

      message.success("Submitted! Balance will be added after Admin verification.");
      form.resetFields();
      setWalletNumberId(null);

      // ✅ submit এর পর pending refresh
      loadPending();
    } catch (e) {
      if (Number(e?.response?.status) === 409) {
        message.error(
          e?.response?.data?.message ||
            "This transaction ID is already used in pending/approved request. Rejected one can be resubmitted."
        );
      } else {
        message.error(e?.response?.data?.message || "Submit failed");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const sendSupportMessage = async () => {
    const body = String(supportMessage || "").trim();
    if (!token) {
      message.error("Please login first");
      return;
    }
    if (!body) {
      message.error("Please write a support message");
      return;
    }

    try {
      setSendingSupport(true);

      const res = await axios.post(
        `${CHAT_API}/conversations/open`,
        {},
        { headers: authHeaders }
      );

      const conversationId = res.data?.conversation?.id;
      if (!conversationId) {
        throw new Error("Failed to open support conversation");
      }

      const socket = getChatSocket();
      if (!socket?.connected) {
        message.info("Chat is reconnecting, opening support inbox...");
        navigate(`/chats/${conversationId}`);
        return;
      }

      await new Promise((resolve, reject) => {
        socket.emit(
          "send_message",
          { conversationId: Number(conversationId), type: "text", body },
          (ack) => {
            if (ack?.ok) resolve(ack);
            else reject(new Error(ack?.message || "Support message send failed"));
          }
        );
      });

      message.success("Support message sent");
      setSupportMessage("");
      navigate(`/chats/${conversationId}`);
    } catch (e) {
      message.error(e?.message || "Failed to send support message");
    } finally {
      setSendingSupport(false);
    }
  };

  return (
    <div style={{ maxWidth: 1050, margin: "0 auto", padding: 16 }}>
      <Card style={{ borderRadius: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <Title level={4} style={{ marginTop: 0, marginBottom: 0 }}>
            Add Balance (Send Money)
          </Title>
          <Button
            icon={<ReloadOutlined />}
            onClick={async () => {
              await Promise.all([loadProviders(), loadPending()]);
              if (providerId) await loadWallets(providerId);
              message.success("Refreshed");
            }}
          >
            Refresh
          </Button>
        </div>

        {/* ✅ Pending Banner */}
        <div style={{ marginTop: 14 }}>
          {blockedActive ? (
            <Alert
              type="error"
              showIcon
              style={{ marginBottom: 10 }}
              message={`Topup is blocked for ${Number(pendingInfo?.blockedDaysLeft || 0)} day(s)`}
              description={
                <div>
                  You cannot submit balance topup now. Block ends at{" "}
                  <b>
                    {pendingInfo?.topupBlockedUntil
                      ? new Date(pendingInfo.topupBlockedUntil).toLocaleString()
                      : "-"}
                  </b>
                  .
                </div>
              }
            />
          ) : null}
          {pendingInfo?.count > 0 ? (
            <Alert
              type="warning"
              showIcon
              message={`You have ${pendingInfo.count} pending topup(s)`}
              description={
                <div style={{ marginTop: 6 }}>
                  <div>
                    Total pending amount: <b>{Number(pendingInfo.totalAmount || 0).toFixed(2)} USD</b>
                  </div>
                  {pendingInfo.latest ? (
                    <div style={{ marginTop: 6, opacity: 0.9 }}>
                      Latest TX: <b>{pendingInfo.latest.transactionId}</b>, Amount:{" "}
                      <b>{Number(pendingInfo.latest.amount || 0).toFixed(2)} USD</b>
                    </div>
                  ) : null}
                </div>
              }
            />
          ) : (
            <Alert
              type="success"
              showIcon
              message={pendingLoading ? "Checking pending payments..." : "No pending topup"}
            />
          )}
          {pendingInfo?.latestRejected?.adminNote ? (
            <Alert
              type="error"
              showIcon
              style={{ marginTop: 10 }}
              message={`Latest rejected reason${pendingInfo?.rejectedCount ? ` (${pendingInfo.rejectedCount} rejected)` : ""}`}
              description={
                <div>
                  <div>
                    TX: <b>{pendingInfo.latestRejected.transactionId}</b>, Amount:{" "}
                    <b>{Number(pendingInfo.latestRejected.amount || 0).toFixed(2)} USD</b>
                  </div>
                  <div style={{ marginTop: 4 }}>
                    Reason: <b>{pendingInfo.latestRejected.adminNote}</b>
                  </div>
                </div>
              }
            />
          ) : null}
        </div>

        <div
          style={{
            marginTop: 16,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
            width: "100%",
          }}
        >
            <div style={{ minWidth: 0, width: "100%" }}>
              <Text style={{ display: "block", marginBottom: 6 }}>Mobile Banking</Text>
              <Select
                style={{ width: "100%" }}
                placeholder="Select mobile banking"
                loading={loadingProviders}
                options={providerOptions}
                value={providerId}
                onChange={onPickProvider}
                allowClear
              />
            </div>

            <div style={{ minWidth: 0, width: "100%" }}>
              <Text style={{ display: "block", marginBottom: 6 }}>Wallet</Text>
              <Select
                style={{ width: "100%" }}
                placeholder="Select wallet"
                loading={loadingWallets}
                options={walletOptions}
                value={walletId}
                onChange={onPickWallet}
                disabled={!providerId}
                allowClear
              />
            </div>
        </div>

        {/* ✅ Selected logos preview */}
        <div style={{ marginTop: 14, display: "flex", gap: 12, flexWrap: "wrap" }}>
          {selectedProvider ? (
            <Card size="small" style={{ borderRadius: 12 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                {selectedProvider.imgUrl ? (
                  <img
                    src={normalizeImageUrl(selectedProvider.imgUrl)}
                    alt={selectedProvider.name}
                    style={{ width: 40, height: 40, borderRadius: 12, objectFit: "cover", border: "1px solid #eee" }}
                    onError={(e) => (e.currentTarget.style.display = "none")}
                  />
                ) : null}
                <div>
                  <div style={{ fontWeight: 800 }}>{selectedProvider.name}</div>
                  <div style={{ opacity: 0.7 }}>Provider</div>
                  {providerRate ? (
                    <div style={{ marginTop: 4, fontSize: 12, opacity: 0.8 }}>
                      Rate: 1 USD = {providerRate.toFixed(4)}
                    </div>
                  ) : null}
                </div>
              </div>
            </Card>
          ) : null}

          {selectedWallet ? (
            <Card size="small" style={{ borderRadius: 12 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                {selectedWallet.imgUrl ? (
                  <img
                    src={normalizeImageUrl(selectedWallet.imgUrl)}
                    alt={selectedWallet.name}
                    style={{ width: 40, height: 40, borderRadius: 12, objectFit: "cover", border: "1px solid #eee" }}
                    onError={(e) => (e.currentTarget.style.display = "none")}
                  />
                ) : null}
                <div>
                  <div style={{ fontWeight: 800 }}>
                    {selectedWallet.name}{" "}
                    <Tag style={{ marginLeft: 6 }}>{selectedWallet.visibility}</Tag>
                  </div>
                  <div style={{ opacity: 0.7 }}>Wallet</div>
                </div>
              </div>
            </Card>
          ) : null}
        </div>

        <div style={{ marginTop: 16 }}>
          <Title level={5} style={{ marginBottom: 8 }}>
            Receiving Numbers
          </Title>

          {!walletId ? (
            <Text type="secondary">Numbers will appear after selecting a Wallet</Text>
          ) : selectedNumbers.length === 0 ? (
            <Text type="secondary">No active number in this wallet</Text>
          ) : (
            <List
              bordered
              dataSource={selectedNumbers}
              renderItem={(n) => {
                const active = String(walletNumberId) === String(n.id);
                return (
                  <List.Item
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "stretch",
                      flexDirection: "column",
                    }}
                  >
                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", minWidth: 0 }}>
                      <Button
                        type={active ? "primary" : "default"}
                        size="small"
                        onClick={() => onPickWalletNumber(n.id)}
                      >
                        {active ? "Selected" : "Select"}
                      </Button>

                      <div>
                        <div style={{ fontWeight: 700 }}>{n.number}</div>
                        <div style={{ opacity: 0.7 }}>{n.label || "-"}</div>
                      </div>

                      {active ? <Tag color="green">Use this</Tag> : null}
                    </div>

                    <div>
                      <Button size="small" onClick={() => copyText(n.number)}>
                        Copy
                      </Button>
                    </div>
                  </List.Item>
                );
              }}
            />
          )}
        </div>

        <div style={{ marginTop: 18 }}>
          <Title level={5} style={{ marginBottom: 8 }}>
            Submit Send Money Info
          </Title>

          <Form layout="vertical" form={form} onFinish={submit}>
            <Form.Item
              label="Your Sender Number (The number you sent from)"
              name="senderNumber"
              rules={[{ required: true, message: "Sender number required" }]}
            >
              <Input placeholder="01XXXXXXXXX" />
            </Form.Item>

            <Form.Item
              label="Amount (Local Currency)"
              name="amount"
              rules={[
                { required: true, message: "Amount required" },
                {
                  validator: (_, value) => {
                    if (value === undefined || value === null || value === "") return Promise.resolve();
                    const n = Number(value);
                    if (!Number.isFinite(n) || n <= 0) {
                      return Promise.reject(new Error("Amount must be > 0"));
                    }
                    if (providerRate && n < providerRate) {
                      return Promise.reject(new Error(`Minimum amount is ${providerRate} (to credit at least 1 USD)`));
                    }
                    return Promise.resolve();
                  },
                },
              ]}
            >
              <InputNumber style={{ width: "100%" }} min={minLocalAmount} />
            </Form.Item>
            {providerRate ? (
              <div style={{ marginTop: -8, marginBottom: 12 }}>
                <Text type="secondary">
                  Minimum: {providerRate.toFixed(4)} local = 1 USD. Rate: 1 USD = {providerRate.toFixed(4)}.{" "}
                  {usdPreview ? `USD credit: ${usdPreview}` : "Enter an amount to preview USD."}
                </Text>
              </div>
            ) : null}

            <Form.Item
              label="Transaction ID"
              name="transactionId"
              rules={[
                { required: true, message: "Transaction ID required" },
                {
                  validator: (_, value) => {
                    const txId = normalizeTransactionId(value);
                    if (!txId) return Promise.reject(new Error("Transaction ID required"));
                    if (txId.length < 6) return Promise.reject(new Error("Transaction ID too short"));
                    if (txId.length > 120) return Promise.reject(new Error("Transaction ID too long"));
                    return Promise.resolve();
                  },
                },
              ]}
            >
              <Input
                placeholder="e.g. 9F8A7B..."
                onBlur={(e) => {
                  const txId = normalizeTransactionId(e.target.value);
                  form.setFieldValue("transactionId", txId);
                }}
              />
            </Form.Item>

            <Button
              type="primary"
              htmlType="submit"
              loading={submitting}
              disabled={blockedActive || !providerId || !walletId || !walletNumberId}
            >
              Submit
            </Button>

            {blockedActive ? (
              <div style={{ marginTop: 10 }}>
                <Text type="danger">
                  Your topup is temporarily blocked. Please try after block period ends.
                </Text>
              </div>
            ) : null}

            {!blockedActive && (!providerId || !walletId || !walletNumberId) ? (
              <div style={{ marginTop: 10 }}>
                <Text type="secondary">You need to select Mobile Banking + Wallet + Receiving Number to submit.</Text>
              </div>
            ) : null}
          </Form>
        </div>

        <div style={{ marginTop: 18 }}>
          <Text type="secondary">
            Payment Submission Guide: 1) Select your Mobile Banking provider. 2) Select the appropriate Wallet. 3) Choose the receiving wallet number to which you sent the payment. 4) Enter your sender number (the number used to send the payment). 5) Enter the exact amount sent in local currency. 6) Enter the transaction ID received after payment. Your wallet balance is credited in USD using the provider’s configured rate. Please provide accurate information only; incorrect or misleading details may result in rejection of your request.
          </Text>
        </div>

        <div style={{ marginTop: 18 }}>
          <Title level={5} style={{ marginBottom: 8 }}>
            Need Help? Message Support
          </Title>
          <Text type="secondary" style={{ display: "block", marginBottom: 8 }}>
            If you send a message from here, the admin/subadmin support team can view and reply in the conversation.
          </Text>
          <Input.TextArea
            rows={4}
            placeholder="Write details of your problem..."
            value={supportMessage}
            onChange={(e) => setSupportMessage(e.target.value)}
          />
          <div style={{ marginTop: 10 }}>
            <Button type="primary" loading={sendingSupport} onClick={sendSupportMessage}>
              Send To Support
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
