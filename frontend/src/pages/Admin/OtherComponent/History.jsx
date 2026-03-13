import React, { useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Empty, Input, Pagination, Space, Spin, message } from "antd";
import { ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import axios from "axios";
import { useSelector } from "react-redux";
import { API_BASE_URL } from "../../../config/env";

const API_BASE = `${API_BASE_URL}/api`;
const DEFAULT_HISTORY_RETENTION_DAYS = 15;

const toLocalText = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString();
};

const toAgoText = (iso) => {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const diffMs = Date.now() - t;
  if (diffMs < 0) return "just now";

  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return `${sec}s ago`;

  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;

  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;

  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;

  const month = Math.floor(day / 30);
  if (month < 12) return `${month}mo ago`;

  const year = Math.floor(day / 365);
  return `${year}y ago`;
};

const History = () => {
  const reduxToken = useSelector((state) => state.auth?.token);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [retentionDays, setRetentionDays] = useState(DEFAULT_HISTORY_RETENTION_DAYS);

  const token = useMemo(() => {
    if (reduxToken) return reduxToken;
    try {
      const saved = JSON.parse(localStorage.getItem("userInfo") || "null");
      return saved?.token || null;
    } catch {
      return null;
    }
  }, [reduxToken]);

  const load = async (opts = {}) => {
    if (!token) return;
    const nextPage = Number(opts.page || page || 1);
    const nextLimit = Number(opts.limit || pageSize || 20);
    const nextQ = Object.prototype.hasOwnProperty.call(opts, "q") ? String(opts.q || "") : appliedQ;

    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/admin/history`, {
        params: {
          page: nextPage,
          limit: nextLimit,
          q: nextQ,
        },
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data?.success) {
        const data = res.data?.data || {};
        setItems(Array.isArray(data.rows) ? data.rows : []);
        setPage(Number(data.page || nextPage));
        setPageSize(Number(data.limit || nextLimit));
        setTotal(Number(data.total || 0));
        setRetentionDays(Number(data.retentionDays || DEFAULT_HISTORY_RETENTION_DAYS));
      }
    } catch (err) {
      message.error(err?.response?.data?.message || "Failed to load history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <Card
      title="Admin History"
      bodyStyle={{ padding: 12 }}
      headStyle={{ fontWeight: 700 }}
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message={`History older than ${retentionDays} day(s) is auto-removed.`}
      />

      <Space wrap style={{ width: "100%", marginBottom: 12, justifyContent: "space-between" }}>
        <Input
          allowClear
          placeholder="Search history..."
          prefix={<SearchOutlined />}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onPressEnter={() => {
            const next = String(q || "").trim();
            setAppliedQ(next);
            load({ page: 1, q: next });
          }}
          style={{ width: 300, maxWidth: "100%" }}
        />
        <Space>
          <Button
            icon={<SearchOutlined />}
            onClick={() => {
              const next = String(q || "").trim();
              setAppliedQ(next);
              load({ page: 1, q: next });
            }}
            loading={loading}
          >
            Search
          </Button>
          <Button icon={<ReloadOutlined />} onClick={() => load({ page, limit: pageSize, q: appliedQ })} loading={loading}>
            Refresh
          </Button>
        </Space>
      </Space>

      {loading ? (
        <div className="py-8 text-center">
          <Spin />
        </div>
      ) : items.length === 0 ? (
        <Empty description="No history yet" />
      ) : (
        <div className="space-y-3">
          <div className="space-y-2">
          {items.map((row) => (
            <div key={row.id} className="rounded border border-gray-200 bg-gray-50 px-3 py-2">
              <p className="text-sm text-gray-800">{row.message}</p>
              <p className="text-xs text-gray-500 mt-1">
                {toAgoText(row.createdAt)} {toAgoText(row.createdAt) ? "|" : ""} {toLocalText(row.createdAt)}
              </p>
            </div>
          ))}
          </div>

          <div className="flex justify-center">
            <Pagination
              current={page}
              pageSize={pageSize}
              total={total}
              showSizeChanger
              pageSizeOptions={["10", "20", "50", "100"]}
              onChange={(nextPage, nextPageSize) => {
                load({ page: nextPage, limit: nextPageSize, q: appliedQ });
              }}
            />
          </div>
        </div>
      )}
    </Card>
  );
};

export default History;

