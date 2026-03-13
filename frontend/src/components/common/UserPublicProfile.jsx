import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, Avatar, Typography, Spin, Alert, Button, Row, Col, Statistic, List, Tag } from "antd";
import { UserOutlined, ArrowLeftOutlined } from "@ant-design/icons";
import { useSelector } from "react-redux";
import { API_BASE_URL } from "../../config/env";
import { normalizeImageUrl } from "../../utils/imageUrl";

const { Title, Text } = Typography;
const API_BASE = API_BASE_URL;

const UserPublicProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token } = useSelector((state) => state.auth);

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadProfile = async () => {
      if (!token || !id) {
        setError("Unauthorized");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");

        const res = await fetch(`${API_BASE}/api/auth/users/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json().catch(() => null);

        if (!res.ok || !json?.success || !json?.user) {
          throw new Error(json?.message || "Failed to load user profile");
        }

        setProfile(json.user);
        setStats(json.stats || null);
        setRecentOrders(Array.isArray(json.recentOrders) ? json.recentOrders : []);
      } catch (err) {
        setError(err.message || "Failed to load user profile");
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [id, token]);

  if (loading) {
    return (
      <div style={{ minHeight: "60vh", display: "grid", placeItems: "center" }}>
        <Spin size="large" tip="Loading user profile..." />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div style={{ maxWidth: 720, margin: "24px auto", padding: "0 16px" }}>
        <Alert type="error" showIcon message="Error" description={error || "User not found"} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720, margin: "24px auto", padding: "0 16px" }}>
      <Card>
        <Button icon={<ArrowLeftOutlined />} type="text" onClick={() => navigate(-1)} style={{ marginBottom: 12 }}>
          Back
        </Button>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Avatar size={80} src={normalizeImageUrl(profile.imageUrl)} icon={!profile.imageUrl && <UserOutlined />} />
          <div>
            <Title level={3} style={{ margin: 0 }}>
              {profile.name || `User #${profile.id}`}
            </Title>
            <Text type="secondary">Role: {profile.role || "user"}</Text>
            <br />
            <Text type="secondary">
              Joined: {profile.createdAt ? new Date(profile.createdAt).toLocaleDateString() : "N/A"}
            </Text>
          </div>
        </div>
      </Card>

      <Card style={{ marginTop: 16 }}>
        <Row gutter={[12, 12]}>
          <Col xs={12} md={6}>
            <Statistic title="Total Orders" value={stats?.totalOrders || 0} />
          </Col>
          <Col xs={12} md={6}>
            <Statistic title="Delivered" value={stats?.deliveredOrders || 0} />
          </Col>
          <Col xs={12} md={6}>
            <Statistic title="Cancelled" value={stats?.cancelledOrders || 0} />
          </Col>
          <Col xs={12} md={6}>
            <Statistic title="Est. Spent" prefix="$" value={Number(stats?.totalSpent || 0)} precision={2} />
          </Col>
        </Row>
      </Card>

      <Card style={{ marginTop: 16 }} title="Recent Orders">
        <List
          dataSource={recentOrders}
          locale={{ emptyText: "No orders found" }}
          renderItem={(item) => (
            <List.Item>
              <List.Item.Meta
                title={
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <Text strong>{item.name || `Product #${item.productId}`}</Text>
                    <Tag>{item.status || "pending"}</Tag>
                    <Tag color="green">
                      Paid
                    </Tag>
                  </div>
                }
                description={
                  <div>
                    <Text type="secondary">Order #{item.id}</Text>
                    <br />
                    <Text type="secondary">
                      Qty: {item.quantity} | Price: ${Number(item.price || 0).toFixed(2)} | Date:{" "}
                      {item.createdAt ? new Date(item.createdAt).toLocaleString() : "N/A"}
                    </Text>
                  </div>
                }
              />
            </List.Item>
          )}
        />
      </Card>
    </div>
  );
};

export default UserPublicProfile;
