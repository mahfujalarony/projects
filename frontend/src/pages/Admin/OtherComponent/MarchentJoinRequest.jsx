import React, { useEffect, useMemo, useState } from "react";
import { Table, Tag, Button, Space, Select, Modal, Descriptions, message, Input } from "antd";
import { API_BASE_PATH } from "../../../config/env";

const API = API_BASE_PATH;

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
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const [status, setStatus] = useState("pending");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(null);

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
      load();
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
      load();
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
          <div className="font-semibold">{r.user?.name || "—"}</div>
          <div className="text-xs text-gray-500">{r.user?.email || "—"}</div>
        </div>
      ),
    },
    {
      title: "Phone",
      dataIndex: "phoneNumber",
      render: (v) => v || "—",
    },
    {
      title: "Status",
      dataIndex: "status",
      render: (s) => <Tag color={statusColor(s)}>{String(s).toUpperCase()}</Tag>,
    },
    {
      title: "Applied",
      dataIndex: "createdAt",
      render: (v) => (v ? new Date(v).toLocaleString() : "—"),
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
        </Space>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 1100, margin: "20px auto", padding: "0 16px" }}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="text-lg font-semibold">Merchant Requests</div>

        <Space wrap>
          <Input
            placeholder="Search name/email"
            value={q}
            onChange={(e) => { setPage(1); setQ(e.target.value); }}
            style={{ width: 220 }}
          />
          <Select
            value={status}
            onChange={(v) => { setPage(1); setStatus(v); }}
            style={{ width: 160 }}
            options={[
              { value: "pending", label: "Pending" },
              { value: "approved", label: "Approved" },
              { value: "rejected", label: "Rejected" },
            ]}
          />
          <Select
            value={limit}
            onChange={(v) => { setPage(1); setLimit(v); }}
            style={{ width: 110 }}
            options={[10, 20, 50].map((x) => ({ value: x, label: `${x}/page` }))}
          />
        </Space>
      </div>

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

      <Modal
        open={open}
        onCancel={() => { setOpen(false); setActive(null); }}
        title="Merchant Request Details"
        footer={[
          <Button key="close" onClick={() => { setOpen(false); setActive(null); }}>Close</Button>,
          <Button
            key="reject"
            danger
            disabled={active?.status !== "pending"}
            onClick={() => reject(active?.id)}
          >
            Reject
          </Button>,
          <Button
            key="approve"
            type="primary"
            disabled={active?.status !== "pending"}
            onClick={() => approve(active?.id)}
          >
            Approve
          </Button>,
        ]}
      >
        {!active ? null : (
          <Descriptions bordered size="small" column={1}>
            <Descriptions.Item label="User">
              {active.user?.name} — {active.user?.email}
            </Descriptions.Item>
            <Descriptions.Item label="Address">{active.YourAddress}</Descriptions.Item>
            <Descriptions.Item label="Phone">{active.phoneNumber || "—"}</Descriptions.Item>
            <Descriptions.Item label="ID Number">{active.idNumber}</Descriptions.Item>

            <Descriptions.Item label="ID Front">
              {active.idFrontImage ? (
                <a href={active.idFrontImage} target="_blank" rel="noreferrer">Open</a>
              ) : "—"}
            </Descriptions.Item>

            <Descriptions.Item label="ID Back">
              {active.idBackImage ? (
                <a href={active.idBackImage} target="_blank" rel="noreferrer">Open</a>
              ) : "—"}
            </Descriptions.Item>

            <Descriptions.Item label="PayPal">{active.paypalEmail || "—"}</Descriptions.Item>
            <Descriptions.Item label="Stripe">{active.stripeAccountId || "—"}</Descriptions.Item>
            <Descriptions.Item label="Bank">
              {active.bankName ? `${active.bankName} / ${active.accountNumber || "—"} / ${active.swiftCode || "—"}` : "—"}
            </Descriptions.Item>

            <Descriptions.Item label="Description">{active.description || "—"}</Descriptions.Item>
            <Descriptions.Item label="Status">
              <Tag color={statusColor(active.status)}>{active.status}</Tag>
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
}
