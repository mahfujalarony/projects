import React, { useEffect, useMemo, useState } from "react";
import { Card, Descriptions, Tag, Typography, Button, message, Space, Divider } from "antd";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL, CHAT_BASE_URL } from "../../../config/env";

const { Title, Text } = Typography;
const API_BASE = API_BASE_URL;
const CHAT_BASE = CHAT_BASE_URL;

const statusColor = (s) => {
  if (s === "approved") return "green";
  if (s === "pending") return "gold";
  if (s === "rejected") return "red";
  return "default";
};

export default function MerchantProfile() {
  const reduxToken = useSelector((state) => state.auth?.token);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [merchant, setMerchant] = useState(null);
  const [balance, setBalance] = useState(0);
  const [supportContact, setSupportContact] = useState({ email: "", whatsapp: "" });

  const token = useMemo(() => {
    if (reduxToken) return reduxToken;
    try {
      const saved = JSON.parse(localStorage.getItem("userInfo") || "null");
      return saved?.token || null;
    } catch {
      return null;
    }
  }, [reduxToken]);

  const openSupportChat = async () => {
    if (!token) {
      message.error("Please log in first.");
      navigate("/login");
      return;
    }
    try {
      const res = await fetch(`${CHAT_BASE}/api/chat/conversations/open`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      const conversationId = data?.conversation?.id;
      if (!res.ok || !data?.success || !conversationId) {
        throw new Error(data?.message || "Unable to open support chat");
      }
      navigate(`/chats/${conversationId}`);
    } catch (e) {
      message.error(e?.message || "Unable to open support chat");
    }
  };

  const toWhatsappHref = (v) => {
    const raw = String(v || "").trim();
    if (!raw) return "";
    const digits = raw.replace(/[^\d]/g, "");
    if (!digits) return "";
    return `https://wa.me/${digits}`;
  };

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      try {
        const [merchantRes, balanceRes, settingsRes] = await Promise.all([
          fetch(`${API_BASE}/api/merchant/me`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_BASE}/api/merchant/me/balance`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_BASE}/api/settings`),
        ]);

        const merchantData = await merchantRes.json().catch(() => null);
        if (!merchantRes.ok || !merchantData?.success) {
          throw new Error(merchantData?.message || "Failed to load merchant profile");
        }
        setMerchant(merchantData?.data?.merchant || null);

        const balanceData = await balanceRes.json().catch(() => ({}));
        if (balanceRes.ok) {
          setBalance(Number(balanceData?.data?.balance || 0));
        } else {
          setBalance(0);
        }

        const settingsData = await settingsRes.json().catch(() => ({}));
        if (settingsRes.ok && settingsData?.success) {
          setSupportContact({
            email: String(settingsData?.data?.supportEmail || "").trim(),
            whatsapp: String(settingsData?.data?.supportWhatsapp || "").trim(),
          });
        } else {
          setSupportContact({ email: "", whatsapp: "" });
        }
      } catch (e) {
        message.error(e?.message || "Failed to load merchant profile");
        setMerchant(null);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [token]);

  if (loading) return <div className="p-4">Loading merchant profile...</div>;

  if (!merchant) {
    return (
      <Card>
        <Title level={4} style={{ marginTop: 0 }}>Merchant Profile</Title>
        <Text type="secondary">No merchant profile found.</Text>
        <div style={{ marginTop: 12 }}>
          <Button type="primary" onClick={() => navigate("/merchant")}>
            Back To Dashboard
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <Title level={4} style={{ marginTop: 0 }}>Merchant Profile</Title>
      <Descriptions bordered column={1} size="middle">
        <Descriptions.Item label="Status">
          <Tag color={statusColor(merchant.status)}>{String(merchant.status || "unknown").toUpperCase()}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Approved">
          {merchant.isApproved ? <Tag color="green">YES</Tag> : <Tag>NO</Tag>}
        </Descriptions.Item>
        <Descriptions.Item label="Phone">{merchant.phoneNumber || "N/A"}</Descriptions.Item>
        <Descriptions.Item label="Address">{merchant.YourAddress || "N/A"}</Descriptions.Item>
        <Descriptions.Item label="ID Number">{merchant.idNumber || "N/A"}</Descriptions.Item>
        <Descriptions.Item label="PayPal">{merchant.paypalEmail || "N/A"}</Descriptions.Item>
        <Descriptions.Item label="Stripe">{merchant.stripeAccountId || "N/A"}</Descriptions.Item>
        <Descriptions.Item label="Bank">
          {merchant.bankName ? `${merchant.bankName} / ${merchant.accountNumber || "N/A"} / ${merchant.swiftCode || "N/A"}` : "N/A"}
        </Descriptions.Item>
        <Descriptions.Item label="Description">{merchant.description || "N/A"}</Descriptions.Item>
        <Descriptions.Item label="Rating">
          {Number(merchant.averageRating || 0).toFixed(2)} ({Number(merchant.totalReviews || 0)} reviews)
        </Descriptions.Item>
      </Descriptions>

      <Divider />

      <Card
        type="inner"
        title="Balance Withdraw"
        style={{ borderRadius: 12, background: "#fafafa" }}
      >
        <Space direction="vertical" size={8} style={{ width: "100%" }}>
          <Text>
            Current Balance: <Text strong>${Number(balance || 0).toFixed(2)}</Text>
          </Text>
          <Text type="secondary">
            To request a withdrawal, please contact Support Chat or use the WhatsApp/Email set in admin settings.
          </Text>

          <Space wrap>
            <Button type="primary" onClick={openSupportChat}>
              Open Support Chat
            </Button>
            {supportContact.whatsapp ? (
              <Button href={toWhatsappHref(supportContact.whatsapp)} target="_blank" rel="noreferrer">
                WhatsApp: {supportContact.whatsapp}
              </Button>
            ) : null}
            {supportContact.email ? (
              <Button href={`mailto:${supportContact.email}`}>
                Email: {supportContact.email}
              </Button>
            ) : null}
          </Space>

          {!supportContact.whatsapp && !supportContact.email ? (
            <Text type="warning">
              WhatsApp/Email contact এখনও set করা নেই. আপাতত Support Chat ব্যবহার করুন।
            </Text>
          ) : null}
        </Space>
      </Card>
    </Card>
  );
}
