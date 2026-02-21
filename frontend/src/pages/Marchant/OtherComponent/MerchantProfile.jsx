import React, { useEffect, useMemo, useState } from "react";
import { Card, Descriptions, Tag, Typography, Button, message } from "antd";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../../../config/env";

const { Title, Text } = Typography;
const API_BASE = API_BASE_URL;

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

  const token = useMemo(() => {
    if (reduxToken) return reduxToken;
    try {
      const saved = JSON.parse(localStorage.getItem("userInfo") || "null");
      return saved?.token || null;
    } catch {
      return null;
    }
  }, [reduxToken]);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/merchant/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.success) {
          throw new Error(data?.message || "Failed to load merchant profile");
        }
        setMerchant(data?.data?.merchant || null);
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
    </Card>
  );
}
