import React, { useEffect, useMemo, useState } from "react";
import { Card, Tabs, Table, Space, Button, Tag, Typography, Input, Modal, Form, message, Avatar } from "antd";
import axios from "axios";
import { useSelector } from "react-redux";
import { API_BASE_URL } from "../../../config/env";

const { Title, Text } = Typography;
const API = `${API_BASE_URL}/api`;

const money = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return "-";
  return n.toFixed(2);
};

export default function BalanceTopup() {
  const token = useSelector((s) => s.auth?.token);

  const [status, setStatus] = useState("pending");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0 });

  const [loading, setLoading] = useState(false);

  // action modal
  const [actionOpen, setActionOpen] = useState(false);
  const [actionType, setActionType] = useState(null); // "approve" | "reject"
  const [activeRow, setActiveRow] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [form] = Form.useForm();

  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const fetchList = async (page = meta.page) => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/admin/topups`, {
        params: { status, page, limit: meta.limit, q },
        headers,
      });

      const data = res.data?.data || {};
      setRows(Array.isArray(data.rows) ? data.rows : []);
      setMeta({
        page: data.page || page,
        limit: data.limit || meta.limit,
        total: data.total || 0,
      });
    } catch (e) {
      console.error(e);
      message.error(e?.response?.data?.message || "Load failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchList(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, status]);

  const onSearch = () => fetchList(1);

  const openAction = (type, row) => {
    setActionType(type);
    setActiveRow(row);
    setActionOpen(true);
    form.resetFields();
  };

  const doAction = async () => {
    try {
      const values = await form.validateFields();
      setActionLoading(true);

      const endpoint =
        actionType === "approve"
          ? `${API}/admin/topups/${activeRow.id}/approve`
          : `${API}/admin/topups/${activeRow.id}/reject`;

      await axios.patch(
        endpoint,
        { adminNote: values.adminNote || "" },
        { headers }
      );

      message.success(actionType === "approve" ? "Approved" : "Rejected");
      setActionOpen(false);
      setActiveRow(null);
      setActionType(null);

      fetchList(meta.page);
    } catch (e) {
      if (e?.errorFields) return;
      console.error(e);
      message.error(e?.response?.data?.message || "Action failed");
    } finally {
      setActionLoading(false);
    }
  };

  const columns = useMemo(
    () => [
      { title: "ID", dataIndex: "id", width: 80 },

      {
        title: "User",
        width: 280,
        render: (_, r) => {
          const u = r.user;
          if (!u) return "-";
          return (
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <Avatar src={u.imageUrl} />
              <div>
                <div style={{ fontWeight: 700 }}>
                  {u.name || "User"} <Text type="secondary">#{u.id}</Text>
                </div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>{u.email}</div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>Balance: {money(u.balance)}</div>
              </div>
            </div>
          );
        },
      },

      {
        title: "Send Money To",
        width: 260,
        render: (_, r) => {
          const p = r.provider;
          const w = r.wallet;
          const n = r.walletNumber;
          return (
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <Avatar shape="square" size={36} src={p?.imgUrl} />
              <div>
                <div style={{ fontWeight: 700 }}>{p?.name || "-"}</div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>
                  {w?.name || "-"} {n?.number ? `→ ${n.number}` : ""}
                </div>
              </div>
            </div>
          );
        },
      },

      {
        title: "Sender",
        dataIndex: "senderNumber",
        width: 150,
      },

      {
        title: "Amount",
        dataIndex: "amount",
        width: 120,
        render: (v) => <b>{money(v)}</b>,
      },

      {
        title: "TX ID",
        dataIndex: "transactionId",
        width: 220,
        render: (v) => <span style={{ fontFamily: "monospace" }}>{v}</span>,
      },

      {
        title: "Status",
        dataIndex: "status",
        width: 130,
        render: (v) =>
          v === "pending" ? (
            <Tag color="orange">pending</Tag>
          ) : v === "approved" ? (
            <Tag color="green">approved</Tag>
          ) : (
            <Tag color="red">rejected</Tag>
          ),
      },

      {
        title: "Created",
        dataIndex: "createdAt",
        width: 180,
        render: (v) => (v ? new Date(v).toLocaleString() : "-"),
      },

      {
        title: "Actions",
        fixed: "right",
        width: 220,
        render: (_, r) => (
          <Space>
            <Button
              type="primary"
              disabled={r.status !== "pending"}
              onClick={() => openAction("approve", r)}
            >
              Approve
            </Button>
            <Button
              danger
              disabled={r.status !== "pending"}
              onClick={() => openAction("reject", r)}
            >
              Reject
            </Button>
          </Space>
        ),
      },
    ],
    [status]
  );

  return (
    <div style={{ maxWidth: 1250, margin: "0 auto", padding: 16 }}>
      <Card style={{ borderRadius: 14 }}>
        <Title level={4} style={{ marginTop: 0 }}>
          Balance Topup Requests
        </Title>

        <Space wrap style={{ marginBottom: 12, width: "100%", justifyContent: "space-between" }}>
          <Tabs
            activeKey={status}
            onChange={(k) => setStatus(k)}
            items={[
              { key: "pending", label: "Pending" },
              { key: "approved", label: "Approved" },
              { key: "rejected", label: "Rejected" },
            ]}
          />

          <Space>
            <Input
              placeholder="Search: TX / sender / userId"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onPressEnter={onSearch}
              style={{ width: 280 }}
              allowClear
            />
            <Button onClick={onSearch}>Search</Button>
            <Button onClick={() => fetchList(meta.page)} loading={loading}>
              Refresh
            </Button>
          </Space>
        </Space>

        <div className="hidden md:block">
          <Table
            rowKey="id"
            loading={loading}
            columns={columns}
            dataSource={rows}
            scroll={{ x: 1200 }}
            pagination={{
              current: meta.page,
              pageSize: meta.limit,
              total: meta.total,
              onChange: (p) => fetchList(p),
              showSizeChanger: true,
              onShowSizeChange: (_, size) => setMeta((m) => ({ ...m, limit: size, page: 1 })),
            }}
          />
        </div>

        {/* Mobile View */}
        <div className="md:hidden flex flex-col gap-3">
          {loading && rows.length === 0 ? (
            <div style={{ textAlign: "center", padding: 20 }}>Loading...</div>
          ) : (
            rows.map((r) => (
              <div
                key={r.id}
                style={{
                  border: "1px solid #f0f0f0",
                  borderRadius: 12,
                  padding: 12,
                  background: "#fff",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <div style={{ display: "flex", gap: 10 }}>
                    <Avatar src={r.user?.imageUrl} />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{r.user?.name || "User"}</div>
                      <div style={{ fontSize: 12, color: "#888" }}>
                        ID: {r.userId} • Bal: {money(r.user?.balance)}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 800, fontSize: 16, color: "#1677ff" }}>{money(r.amount)}</div>
                    <Tag
                      color={r.status === "pending" ? "orange" : r.status === "approved" ? "green" : "red"}
                      style={{ margin: 0, fontSize: 10 }}
                    >
                      {r.status.toUpperCase()}
                    </Tag>
                  </div>
                </div>

                <div style={{ background: "#f9f9f9", padding: 10, borderRadius: 8, fontSize: 13, color: "#444" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ color: "#888" }}>Method:</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <Avatar shape="square" size={16} src={r.provider?.imgUrl} />
                      <b>{r.provider?.name}</b>
                    </div>
                  </div>
                  <div style={{ marginBottom: 4 }}>
                    <span style={{ color: "#888" }}>To:</span> {r.wallet?.name} ({r.walletNumber?.number})
                  </div>
                  <div style={{ marginBottom: 4 }}>
                    <span style={{ color: "#888" }}>From:</span> <b>{r.senderNumber}</b>
                  </div>
                  <div style={{ marginBottom: 4 }}>
                    <span style={{ color: "#888" }}>TX ID:</span> <span style={{ fontFamily: "monospace", background: "#eee", padding: "0 4px", borderRadius: 4 }}>{r.transactionId}</span>
                  </div>
                  <div>
                    <span style={{ color: "#888" }}>Time:</span> {r.createdAt ? new Date(r.createdAt).toLocaleString() : "-"}
                  </div>
                </div>

                {r.status === "pending" && (
                  <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                    <Button type="primary" block onClick={() => openAction("approve", r)}>
                      Approve
                    </Button>
                    <Button danger block onClick={() => openAction("reject", r)}>
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}

          {/* Mobile Pagination */}
          {meta.total > meta.limit && (
            <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 10 }}>
              <Button disabled={meta.page <= 1} onClick={() => fetchList(meta.page - 1)}>
                Prev
              </Button>
              <span style={{ lineHeight: "32px", fontWeight: "bold" }}>{meta.page}</span>
              <Button disabled={meta.page * meta.limit >= meta.total} onClick={() => fetchList(meta.page + 1)}>
                Next
              </Button>
            </div>
          )}
        </div>

        <Modal
          open={actionOpen}
          title={actionType === "approve" ? "Approve Topup" : "Reject Topup"}
          onCancel={() => {
            setActionOpen(false);
            setActiveRow(null);
            setActionType(null);
          }}
          onOk={doAction}
          confirmLoading={actionLoading}
          okText={actionType === "approve" ? "Approve" : "Reject"}
          okButtonProps={actionType === "reject" ? { danger: true } : {}}
        >
          {activeRow ? (
            <div style={{ marginBottom: 10 }}>
              <Text>
                TX: <b style={{ fontFamily: "monospace" }}>{activeRow.transactionId}</b>
              </Text>
              <br />
              <Text>
                Amount: <b>{money(activeRow.amount)}</b>
              </Text>
            </div>
          ) : null}

          <Form layout="vertical" form={form}>
            <Form.Item label="Admin Note (optional)" name="adminNote">
              <Input.TextArea rows={3} placeholder="Optional note..." />
            </Form.Item>
          </Form>
        </Modal>
      </Card>
    </div>
  );
}
