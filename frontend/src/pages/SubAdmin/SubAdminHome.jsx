import React from "react";
import { Card, Col, Row, Statistic } from "antd";
import { useOutletContext } from "react-router-dom";
import { ShieldCheck, Boxes, MessageSquare } from "lucide-react";

export default function SubAdminHome() {
  const ctx = useOutletContext() || {};
  const permissions = Array.isArray(ctx.permissions) ? ctx.permissions : [];
  const totalUnreadCount = Number(ctx.totalUnreadCount || 0);

  return (
    <div style={{ padding: 0 }}>
      <div style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#0f172a" }}>Sub Admin Dashboard</h2>
        <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 13 }}>
          Sidebar modules are enabled based on your assigned permissions.
        </p>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={8}>
          <Card bordered={false} style={{ border: "1px solid #e2e8f0" }}>
            <Statistic
              title="Assigned Modules"
              value={permissions.length}
              prefix={<Boxes size={18} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card bordered={false} style={{ border: "1px solid #e2e8f0" }}>
            <Statistic
              title="Chat Unread"
              value={totalUnreadCount}
              prefix={<MessageSquare size={18} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card bordered={false} style={{ border: "1px solid #e2e8f0" }}>
            <Statistic
              title="Role"
              value="SubAdmin"
              prefix={<ShieldCheck size={18} />}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
