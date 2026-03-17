import React, { useEffect, useMemo, useState } from "react";
import { Table, Tag, Button, Space, Select, Modal, Descriptions, message, Input, Grid, Card, Pagination, Image, Tabs } from "antd";
import { FilterOutlined, UpOutlined, DownOutlined } from "@ant-design/icons";
import { API_BASE_PATH } from "../../../config/env";
import { normalizeImageUrl } from "../../../utils/imageUrl";

const API = API_BASE_PATH;
const { useBreakpoint } = Grid;

const getToken = () => {
  try {
    const saved = JSON.parse(localStorage.getItem("userInfo") || "null");
    return saved?.token || null;
  } catch {
    return null;
  }
};

const statusColor = (s) => {
  if (s === "pending") return "gold";
  if (s === "approved") return "green";
  if (s === "rejected") return "red";
  return "default";
};

export default function AdminMerchantRequests() {
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const [status, setStatus] = useState("pending");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [statusCounts, setStatusCounts] = useState({ pending: 0, approved: 0, rejected: 0 });

  const query = useMemo(() => {
    const p = new URLSearchParams();
    p.set("status", status);
    p.set("page", page);
    p.set("limit", limit);
    if (q.trim()) p.set("q", q.trim());
    return p.toString();
  }, [status, page, limit, q]);

  const load = async () => {
    try {
      setLoading(true);
      const token = getToken();
      if (!token) return message.error("No token found. Please login as admin.");

      const res = await fetch(`${API}/admin/merchants/requests?${query}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || data?.ok === false) throw new Error(data?.message || "Failed to load");

      setRows(data?.data || []);
      setTotal(Number(data?.total || 0));
    } catch (e) {
      message.error(e.message);
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  useEffect(() => {
    loadStatusCounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (status === "rejected" && statusCounts.rejected <= 0) {
      setStatus("pending");
      setPage(1);
    }
  }, [status, statusCounts.rejected]);

  const refreshAll = () => {
    load();
    loadStatusCounts();
  };

  const approve = async (id) => {
    try {
      const token = getToken();
      const res = await fetch(`${API}/admin/merchants/${id}/approve`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || data?.ok === false) throw new Error(data?.message || "Approve failed");
      message.success("Approved");
      setOpen(false);
      setActive(null);
      refreshAll();
    } catch (e) {
      message.error(e.message);
    }
  };

  const reject = async (id) => {
    try {
      const token = getToken();
      const res = await fetch(`${API}/admin/merchants/${id}/reject`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || data?.ok === false) throw new Error(data?.message || "Reject failed");
      message.success("Rejected");
      setOpen(false);
      setActive(null);
      refreshAll();
    } catch (e) {
      message.error(e.message);
    }
  };

  const loadStatusCounts = async () => {
    try {
      const token = getToken();
      if (!token) return;

      const fetchCount = async (s) => {
        const p = new URLSearchParams();
        p.set("status", s);
        p.set("page", 1);
        p.set("limit", 1);
        const res = await fetch(`${API}/admin/merchants/requests?${p.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || data?.ok === false) return 0;
        return Number(data?.total || 0);
      };

      const [pending, approved, rejected] = await Promise.all([
        fetchCount("pending"),
        fetchCount("approved"),
        fetchCount("rejected"),
      ]);

      setStatusCounts({ pending, approved, rejected });
    } catch {
      setStatusCounts({ pending: 0, approved: 0, rejected: 0 });
    }
  };

  const suspend = async (id) => {
    try {
      const token = getToken();
      const res = await fetch(`${API}/admin/merchants/${id}/suspend`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || data?.ok === false) throw new Error(data?.message || "Suspend failed");
      message.success("Merchant suspended");
      setOpen(false);
      setActive(null);
      refreshAll();
    } catch (e) {
      message.error(e.message);
    }
  };

  const resume = async (id) => {
    try {
      const token = getToken();
      const res = await fetch(`${API}/admin/merchants/${id}/resume`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || data?.ok === false) throw new Error(data?.message || "Resume failed");
      message.success("Merchant resumed");
      setOpen(false);
      setActive(null);
      refreshAll();
    } catch (e) {
      message.error(e.message);
    }
  };

  const columns = [
    {
      title: "User",
      dataIndex: "user",
      render: (_, r) => (
        <div>
          <div className="font-semibold">{r.user?.name || "-"}</div>
          <div className="text-xs text-gray-500">{r.user?.email || "-"}</div>
        </div>
      ),
    },
    {
      title: "Phone",
      dataIndex: "phoneNumber",
      render: (v) => v || "-",
    },
    {
      title: "Status",
      dataIndex: "status",
      render: (s, r) => {
        const suspended = s === "approved" && r?.isSuspended;
        return (
          <Tag color={suspended ? "orange" : statusColor(s)}>
            {suspended ? "SUSPENDED" : String(s).toUpperCase()}
          </Tag>
        );
      },
    },
    {
      title: "Applied",
      dataIndex: "createdAt",
      render: (v) => (v ? new Date(v).toLocaleString() : "-"),
    },
    {
      title: "Action",
      render: (_, r) => (
        <Space>
          <Button onClick={() => { setActive(r); setOpen(true); }}>View</Button>
          <Button type="primary" disabled={r.status !== "pending"} onClick={() => approve(r.id)}>
            Approve
          </Button>
          <Button danger disabled={r.status !== "pending"} onClick={() => reject(r.id)}>
            Reject
          </Button>
          {r.status === "approved" ? (
            r.isSuspended ? (
              <Button onClick={() => resume(r.id)}>Resume</Button>
            ) : (
              <Button danger onClick={() => suspend(r.id)}>Suspend</Button>
            )
          ) : null}
        </Space>
      ),
    },
  ];

  const tabItems = useMemo(() => {
    const items = [
      { key: "pending", label: isMobile ? `Pending` : `Pending (${statusCounts.pending})` },
      { key: "approved", label: isMobile ? `Approved` : `Approved (${statusCounts.approved})` },
    ];
    if (statusCounts.rejected > 0) {
      items.push({ key: "rejected", label: isMobile ? `Rejected` : `Rejected (${statusCounts.rejected})` });
    }
    return items;
  }, [isMobile, statusCounts.pending, statusCounts.approved, statusCounts.rejected]);

  return (
    <div style={{ maxWidth: 1100, margin: "20px auto", padding: "0 16px" }}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="text-lg font-semibold">Merchant Requests</div>
        <Button
          icon={<FilterOutlined />}
          onClick={() => setShowFilters((prev) => !prev)}
        >
          Filters {showFilters ? <UpOutlined /> : <DownOutlined />}
        </Button>
      </div>

      <Tabs
        activeKey={status}
        onChange={(key) => {
          setStatus(key);
          setPage(1);
        }}
        size={isMobile ? "small" : "middle"}
        tabBarGutter={8}
        items={tabItems}
      />

      {showFilters ? (
        <div style={{ marginBottom: 12 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "1fr 120px",
              gap: 10,
            }}
          >
            <Input
              placeholder="Search name/email"
              value={q}
              onChange={(e) => { setPage(1); setQ(e.target.value); }}
              style={{ width: "100%" }}
            />
            <Select
              value={limit}
              onChange={(v) => { setPage(1); setLimit(v); }}
              style={{ width: "100%" }}
              options={[10, 20, 50].map((x) => ({ value: x, label: `${x}/page` }))}
            />
          </div>
        </div>
      ) : null}

      {isMobile ? (
        <div style={{ display: "grid", gap: 10 }}>
          {rows.map((r) => (
            <Card key={r.id} size="small" bodyStyle={{ padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700 }}>{r.user?.name || "-"}</div>
                  <div style={{ fontSize: 12, color: "#666" }}>{r.user?.email || "-"}</div>
                </div>
                <Tag
                  color={r.status === "approved" && r?.isSuspended ? "orange" : statusColor(r.status)}
                  style={{ marginRight: 0 }}
                >
                  {r.status === "approved" && r?.isSuspended ? "SUSPENDED" : String(r.status || "").toUpperCase()}
                </Tag>
              </div>

              <div style={{ marginTop: 8, display: "grid", gap: 4, fontSize: 13 }}>
                <div><strong>Phone:</strong> {r.phoneNumber || "-"}</div>
                <div><strong>Applied:</strong> {r.createdAt ? new Date(r.createdAt).toLocaleString() : "-"}</div>
              </div>

              <div
                style={{
                  marginTop: 10,
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: 8,
                }}
              >
                <Button block onClick={() => { setActive(r); setOpen(true); }}>View</Button>
                <Button block type="primary" disabled={r.status !== "pending"} onClick={() => approve(r.id)}>
                  Approve
                </Button>
                <Button block danger disabled={r.status !== "pending"} onClick={() => reject(r.id)}>
                  Reject
                </Button>
                {r.status === "approved" ? (
                  r.isSuspended ? (
                    <Button block onClick={() => resume(r.id)}>Resume</Button>
                  ) : (
                    <Button block danger onClick={() => suspend(r.id)}>Suspend</Button>
                  )
                ) : null}
              </div>
            </Card>
          ))}
          <div style={{ display: "flex", justifyContent: "center", marginTop: 4 }}>
            <Pagination
              current={page}
              pageSize={limit}
              total={total}
              size="small"
              showSizeChanger={false}
              onChange={(p) => setPage(p)}
            />
          </div>
        </div>
      ) : (
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={rows}
          pagination={{
            current: page,
            pageSize: limit,
            total,
            onChange: (p) => setPage(p),
            showSizeChanger: false,
          }}
        />
      )}

      <Modal
        open={open}
        onCancel={() => { setOpen(false); setActive(null); }}
        title="Merchant Request Details"
        width={isMobile ? "96%" : 720}
        footer={
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "repeat(2, minmax(0, 1fr))" : "repeat(4, max-content)",
              justifyContent: isMobile ? "stretch" : "end",
              gap: 8,
            }}
          >
            <Button block={isMobile} onClick={() => { setOpen(false); setActive(null); }}>Close</Button>
            <Button
              block={isMobile}
              danger
              disabled={active?.status !== "pending"}
              onClick={() => reject(active?.id)}
            >
              Reject
            </Button>
            <Button
              block={isMobile}
              type="primary"
              disabled={active?.status !== "pending"}
              onClick={() => approve(active?.id)}
            >
              Approve
            </Button>
            {active?.status === "approved"
              ? (active?.isSuspended ? (
                  <Button block={isMobile} onClick={() => resume(active?.id)}>
                    Resume
                  </Button>
                ) : (
                  <Button block={isMobile} danger onClick={() => suspend(active?.id)}>
                    Suspend
                  </Button>
                ))
              : null}
          </div>
        }
      >
        {!active ? null : (
          <Descriptions bordered size="small" column={1}>
            <Descriptions.Item label="User">
              {active.user?.name} - {active.user?.email}
            </Descriptions.Item>
            <Descriptions.Item label="Address">{active.YourAddress}</Descriptions.Item>
            <Descriptions.Item label="Phone">{active.phoneNumber || "-"}</Descriptions.Item>
            <Descriptions.Item label="ID Number">{active.idNumber}</Descriptions.Item>

            <Descriptions.Item label="ID Front">
              {active.idFrontImage ? (
                <Image
                  src={normalizeImageUrl(active.idFrontImage)}
                  alt="ID Front"
                  width={140}
                  style={{ borderRadius: 8, objectFit: "cover" }}
                />
              ) : "-"}
            </Descriptions.Item>

            <Descriptions.Item label="ID Back">
              {active.idBackImage ? (
                <Image
                  src={normalizeImageUrl(active.idBackImage)}
                  alt="ID Back"
                  width={140}
                  style={{ borderRadius: 8, objectFit: "cover" }}
                />
              ) : "-"}
            </Descriptions.Item>

            <Descriptions.Item label="PayPal">{active.paypalEmail || "-"}</Descriptions.Item>
            <Descriptions.Item label="Stripe">{active.stripeAccountId || "-"}</Descriptions.Item>
            <Descriptions.Item label="Bank">
              {active.bankName ? `${active.bankName} / ${active.accountNumber || "-"} / ${active.swiftCode || "-"}` : "-"}
            </Descriptions.Item>

            <Descriptions.Item label="Description">{active.description || "-"}</Descriptions.Item>
            <Descriptions.Item label="Status">
              <Tag color={active.status === "approved" && active?.isSuspended ? "orange" : statusColor(active.status)}>
                {active.status === "approved" && active?.isSuspended ? "suspended" : active.status}
              </Tag>
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
}

