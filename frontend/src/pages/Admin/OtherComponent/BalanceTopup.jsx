import React, { useEffect, useMemo, useState } from "react";
import { Card, Tabs, Table, Space, Button, Tag, Typography, Input, Modal, Form, message, Avatar, Dropdown, Select, Grid } from "antd";
import axios from "axios";
import { useSelector } from "react-redux";
import { API_BASE_URL } from "../../../config/env";
import { normalizeImageUrl } from "../../../utils/imageUrl";

const { Title, Text } = Typography;
const API = `${API_BASE_URL}/api`;
const CUSTOM_REASON = "__custom__";
const REJECT_REASON_OPTIONS = [
  { label: "We cannot find your payment", value: "We cannot find your payment" },
  { label: "Your sent amount does not match", value: "Your sent amount does not match" },
  { label: "Transaction ID is invalid", value: "Transaction ID is invalid" },
  { label: "Sender number does not match", value: "Sender number does not match" },
  { label: "Payment proof is incomplete", value: "Payment proof is incomplete" },
  { label: "Other (write custom reason)", value: CUSTOM_REASON },
];

const money = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return "-";
  return n.toFixed(2);
};

const timeAgo = (value) => {
  if (!value) return "-";
  const t = new Date(value).getTime();
  if (!Number.isFinite(t)) return "-";
  const diffMs = Date.now() - t;
  if (diffMs < 0) return "just now";

  const m = Math.floor(diffMs / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;

  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;

  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;

  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;

  const y = Math.floor(d / 365);
  return `${y}y ago`;
};

const timeAgoColor = (value) => {
  if (!value) return "default";
  const t = new Date(value).getTime();
  if (!Number.isFinite(t)) return "default";
  const diffMs = Date.now() - t;
  if (diffMs < 60 * 60 * 1000) return "red";
  if (diffMs < 24 * 60 * 60 * 1000) return "orange";
  return "blue";
};

const isTopupBlocked = (u) => {
  const t = u?.topupBlockedUntil ? new Date(u.topupBlockedUntil).getTime() : 0;
  return Number.isFinite(t) && t > Date.now();
};

export default function BalanceTopup() {
  const token = useSelector((s) => s.auth?.token);
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;

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

  const fetchList = async (page = meta.page, limitOverride) => {
    const reqLimit = Math.min(Number(limitOverride || meta.limit || 20), 50);
    try {
      setLoading(true);
      const res = await axios.get(`${API}/admin/topups`, {
        params: { status, page, limit: reqLimit, q },
        headers,
      });

      const data = res.data?.data || {};
      setRows(Array.isArray(data.rows) ? data.rows : []);
      setMeta({
        page: data.page || page,
        limit: data.limit || reqLimit,
        total: data.total || 0,
      });
    } catch (e) {

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
      const values = actionType === "reject" ? await form.validateFields() : {};
      setActionLoading(true);

      const endpoint =
        actionType === "approve"
          ? `${API}/admin/topups/${activeRow.id}/approve`
          : `${API}/admin/topups/${activeRow.id}/reject`;

      const rejectNote =
        actionType === "reject"
          ? values.presetReason === CUSTOM_REASON
            ? String(values.adminNote || "").trim()
            : String(values.presetReason || "").trim()
          : "";

      await axios.patch(
        endpoint,
        actionType === "reject" ? { adminNote: rejectNote } : {},
        { headers }
      );

      message.success(actionType === "approve" ? "Approved" : "Rejected");
      setActionOpen(false);
      setActiveRow(null);
      setActionType(null);

      fetchList(meta.page);
    } catch (e) {
      if (e?.errorFields) return;

      message.error(e?.response?.data?.message || "Action failed");
    } finally {
      setActionLoading(false);
    }
  };

  const blockUser = async (row, days) => {
    const uid = Number(row?.userId);
    if (!uid || ![1, 2, 3, 4, 5].includes(Number(days))) return;
    try {
      await axios.patch(`${API}/admin/topups/users/${uid}/block`, { days: Number(days) }, { headers });
      message.success(`User blocked for ${days} day(s)`);
      fetchList(meta.page);
    } catch (e) {

      message.error(e?.response?.data?.message || "Failed to block user");
    }
  };

  const unblockUser = async (row) => {
    const uid = Number(row?.userId);
    if (!uid) return;
    try {
      await axios.patch(`${API}/admin/topups/users/${uid}/unblock`, {}, { headers });
      message.success("User block removed");
      fetchList(meta.page);
    } catch (e) {

      message.error(e?.response?.data?.message || "Failed to unblock user");
    }
  };

  const deleteTopup = async (row) => {
    const id = Number(row?.id);
    if (!id) return;
    try {
      await axios.delete(`${API}/admin/topups/${id}`, { headers });
      message.success("Topup deleted");
      const nextPage = rows.length === 1 && meta.page > 1 ? meta.page - 1 : meta.page;
      fetchList(nextPage);
    } catch (e) {

      message.error(e?.response?.data?.message || "Delete failed");
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
              <Avatar src={normalizeImageUrl(u.imageUrl)} />
              <div>
                <div style={{ fontWeight: 700 }}>
                  {u.name || "User"} <Text type="secondary">#{u.id}</Text>
                </div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>{u.email}</div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>Balance: {money(u.balance)}</div>
                {Number(r.userRejectedCount || 0) > 0 ? (
                  <Tag color="red" style={{ marginTop: 4, marginInlineEnd: 0, fontSize: 11 }}>
                    Previous Rejected: {Number(r.userRejectedCount || 0)}
                  </Tag>
                ) : null}
                {isTopupBlocked(u) ? (
                  <Tag color="magenta" style={{ marginTop: 4, marginInlineEnd: 0, fontSize: 11, whiteSpace: "normal", maxWidth: 220 }}>
                    Blocked till: {new Date(u.topupBlockedUntil).toLocaleString()}
                  </Tag>
                ) : null}
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
              <Avatar shape="square" size={36} src={normalizeImageUrl(p?.imgUrl)} />
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
        width: 360,
        render: (_, r) => {
          const blocked = isTopupBlocked(r.user);
          return (
            <div
              style={{
                border: "1px solid #d9d9d9",
                borderRadius: 10,
                padding: 8,
                background: "#fafafa",
              }}
            >
              <Space wrap size={8}>
                <Button
                  type="primary"
                  size="small"
                  disabled={r.status !== "pending"}
                  onClick={() => openAction("approve", r)}
                >
                  Approve
                </Button>
                <Button
                  danger
                  size="small"
                  disabled={r.status !== "pending"}
                  onClick={() => openAction("reject", r)}
                >
                  Reject
                </Button>
                {blocked ? (
                  <Button size="small" danger onClick={() => unblockUser(r)}>
                    Unblock
                  </Button>
                ) : (
                  <Dropdown
                    trigger={["click"]}
                    menu={{
                      items: [
                        { key: "1", label: "Block 1 day" },
                        { key: "2", label: "Block 2 days" },
                        { key: "3", label: "Block 3 days" },
                        { key: "4", label: "Block 4 days" },
                        { key: "5", label: "Block 5 days" },
                      ],
                      onClick: ({ key }) => blockUser(r, Number(key)),
                    }}
                  >
                    <Button size="small">Block</Button>
                  </Dropdown>
                )}
              </Space>
            </div>
          );
        },
      },
    ],
    [status, meta.page]
  );

  return (
    <div style={{ maxWidth: 1250, margin: "0 auto", padding: isMobile ? 8 : 16 }}>
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
              style={{ width: isMobile ? "100%" : 280 }}
              allowClear
            />
            <Button onClick={onSearch}>Search</Button>
            <Button onClick={() => fetchList(meta.page)} loading={loading}>
              Refresh
            </Button>
          </Space>
        </Space>

        <div className="hidden">
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
              onShowSizeChange: (_, size) => fetchList(1, size),
            }}
          />
        </div>

        {/* Card View (All Devices) */}
        <div className="flex flex-col gap-3 md:grid md:grid-cols-2 xl:grid-cols-3">
          {loading && rows.length === 0 ? (
            <div style={{ textAlign: "center", padding: 20 }}>Loading...</div>
          ) : (
            rows.map((r) => (
              <div
                key={r.id}
                style={{
                  border: "1px solid #d9d9d9",
                  borderRadius: 12,
                  padding: 10,
                  background: "#fff",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <div style={{ display: "flex", gap: 10 }}>
                    <Avatar src={normalizeImageUrl(r.user?.imageUrl)} />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{r.user?.name || "User"}</div>
                      <div style={{ fontSize: 12, color: "#888" }}>
                        ID: {r.userId} • Bal: {money(r.user?.balance)}
                      </div>
                      {Number(r.userRejectedCount || 0) > 0 ? (
                        <Tag color="red" style={{ marginTop: 4, marginInlineEnd: 0, fontSize: 10 }}>
                          Rejected Before: {Number(r.userRejectedCount || 0)}
                        </Tag>
                      ) : null}
                      {isTopupBlocked(r.user) ? (
                        <Tag color="magenta" style={{ marginTop: 4, marginInlineEnd: 0, fontSize: 10, whiteSpace: "normal", maxWidth: 210 }}>
                          Blocked till: {new Date(r.user.topupBlockedUntil).toLocaleString()}
                        </Tag>
                      ) : null}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 800, fontSize: 16, color: "#1677ff" }}>{money(r.amount)}</div>
                    <Tag color={timeAgoColor(r.createdAt)} style={{ margin: "4px 0 0 0", fontSize: 10 }}>
                      {timeAgo(r.createdAt)}
                    </Tag>
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
                      <Avatar shape="square" size={16} src={normalizeImageUrl(r.provider?.imgUrl)} />
                      <b>{r.provider?.name}</b>
                    </div>
                  </div>
                  <div style={{ marginBottom: 4 }}>
                    <span style={{ color: "#888" }}>To:</span>{" "}
                    <span style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}>
                      {r.wallet?.name} ({r.walletNumber?.number})
                    </span>
                  </div>
                  <div style={{ marginBottom: 4 }}>
                    <span style={{ color: "#888" }}>From:</span>{" "}
                    <b style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}>{r.senderNumber}</b>
                  </div>
                  <div style={{ marginBottom: 4 }}>
                    <span style={{ color: "#888" }}>TX ID:</span>{" "}
                    <span
                      style={{
                        fontFamily: "monospace",
                        background: "#eee",
                        padding: "0 4px",
                        borderRadius: 4,
                        overflowWrap: "anywhere",
                        wordBreak: "break-all",
                      }}
                    >
                      {r.transactionId}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: "#888" }}>Time:</span> {r.createdAt ? new Date(r.createdAt).toLocaleString() : "-"}
                  </div>
                </div>

                {r.status === "pending" && (
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      marginTop: 12,
                      border: "1px solid #d9d9d9",
                      borderRadius: 10,
                      padding: 8,
                      background: "#fafafa",
                    }}
                  >
                    <Button type="primary" block onClick={() => openAction("approve", r)}>
                      Approve
                    </Button>
                    <Button danger block onClick={() => openAction("reject", r)}>
                      Reject
                    </Button>
                  </div>
                )}
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    marginTop: 8,
                    flexWrap: "wrap",
                    border: "1px solid #d9d9d9",
                    borderRadius: 10,
                    padding: 8,
                    background: "#fafafa",
                  }}
                >
                  {isTopupBlocked(r.user) ? (
                    <Button size="small" danger onClick={() => unblockUser(r)}>
                      Unblock
                    </Button>
                  ) : (
                    [1, 2, 3, 4, 5].map((d) => (
                      <Button key={d} size="small" onClick={() => blockUser(r, d)}>
                        Block {d}d
                      </Button>
                    ))
                  )}
                  <Button size="small" danger onClick={() => deleteTopup(r)}>
                    Delete
                  </Button>
                </div>
              </div>
            ))
          )}

          {/* Pagination */}
          {meta.total > meta.limit && (
            <div className="md:col-span-2 xl:col-span-3" style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 10 }}>
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

          {actionType === "reject" ? (
            <Form layout="vertical" form={form}>
              <Form.Item
                label="Quick Reject Reason"
                name="presetReason"
                rules={[{ required: true, message: "Please select a reason" }]}
              >
                <Select
                  placeholder="Select reason"
                  options={REJECT_REASON_OPTIONS}
                  onChange={(v) => {
                    if (v === CUSTOM_REASON) {
                      form.setFieldValue("adminNote", "");
                    } else {
                      form.setFieldValue("adminNote", v);
                    }
                  }}
                />
              </Form.Item>
              <Form.Item shouldUpdate noStyle>
                {() =>
                  form.getFieldValue("presetReason") === CUSTOM_REASON ? (
                    <Form.Item
                      label="Reject Reason"
                      name="adminNote"
                      rules={[{ required: true, message: "Reject reason is required" }]}
                    >
                      <Input.TextArea rows={3} placeholder="Why rejected? (user will see this)" />
                    </Form.Item>
                  ) : null
                }
              </Form.Item>
            </Form>
          ) : null}
        </Modal>
      </Card>
    </div>
  );
}
