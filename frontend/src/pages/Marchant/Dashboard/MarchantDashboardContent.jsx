import React, { useEffect, useMemo, useState, useRef } from "react";
import {
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Tag,
  Alert,
  Skeleton,
  Empty,
  Button,
  Tooltip as AntTooltip,
  Popover,
} from "antd";
import {
  ShoppingOutlined,
  FileTextOutlined,
  WalletOutlined,
  RiseOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  InboxOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import UplotReact from "uplot-react";
import "uplot/dist/uPlot.min.css";
import axios from "axios";
import { useSelector } from "react-redux";
import { API_BASE_URL } from "../../../config/env";
import { normalizeImageUrl } from "../../../utils/imageUrl";

const API_BASE = `${API_BASE_URL}/api`;

const initialOverview = {
  balance: 0,
  totalEarnings: 0,
  products: { total: 0, lowStock: 0, outOfStock: 0 },
  orders: { total: 0, pending: 0, processing: 0, shipped: 0, delivered: 0, cancelled: 0 },
  today: { orders: 0, deliveredOrders: 0, sales: 0, earnings: 0 },
  last7Days: { sales: 0, trend: [] },
  recentOrders: [],
  topProducts: [],
};

const moneyUSD = (n) =>
  `$${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

const formatCompact = (value, { currency = false } = {}) => {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return value;
  const formatted = Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(n);
  return currency ? `$${formatted}` : formatted;
};

const formatFull = (value, { currency = false } = {}) => {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return value;
  const formatted = Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
  }).format(n);
  return currency ? `$${formatted}` : formatted;
};

const compactWithPopover = (value, { currency = false } = {}) => {
  const compact = formatCompact(value, { currency });
  const full = formatFull(value, { currency });
  if (String(compact) === String(full)) return compact;
  return (
    <Popover content={<span className="font-semibold">{full}</span>} trigger="click">
      <span className="cursor-pointer underline decoration-dotted underline-offset-2">{compact}</span>
    </Popover>
  );
};

const statusTag = (s) => {
  const status = String(s || "").toLowerCase();
  let color = "default";
  if (status === "pending") color = "orange";
  if (status === "processing") color = "blue";
  if (status === "shipped") color = "purple";
  if (status === "delivered") color = "green";
  if (status === "cancelled") color = "red";
  return (
    <Tag color={color} style={{ borderRadius: 999, marginInlineEnd: 0, fontSize: 11, lineHeight: "18px" }}>
      {(status || "open").toUpperCase()}
    </Tag>
  );
};

const MetricCard = ({ title, value, suffix, precision, icon, accent, helper }) => (
  <Card
    variant="borderless"
    className="rounded-2xl shadow-sm border border-slate-100 hover:shadow-md hover:-translate-y-0.5 transition-all"
    styles={{ body: { padding: 16 } }}
  >
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <div
            style={{
              width: 36, height: 36, borderRadius: 14,
              display: "grid", placeItems: "center",
              background: `linear-gradient(135deg, ${accent}22 0%, ${accent}10 100%)`,
              border: `1px solid ${accent}2a`, flexShrink: 0,
            }}
          >
            <span style={{ color: accent, fontSize: 16 }}>{icon}</span>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.2 }}>{title}</div>
            {helper ? <div style={{ fontSize: 11, color: "#94a3b8" }}>{helper}</div> : null}
          </div>
        </div>
        <Statistic
          value={value}
          precision={precision}
          suffix={suffix}
          formatter={(v) => {
            if (suffix === "USD") return compactWithPopover(v, { currency: true });
            return compactWithPopover(v);
          }}
          styles={{
            content: {
              fontWeight: 800, color: accent, fontSize: 22,
              lineHeight: 1.1, wordBreak: "break-word",
            },
          }}
        />
      </div>
    </div>
  </Card>
);

// ─── Responsive uPlot wrapper ─────────────────────────────────────────────────
const ResponsiveUplot = ({ opts, data }) => {
  const wrapRef = useRef(null);
  const [width, setWidth] = useState(600);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width;
      if (w && w > 0) setWidth(Math.floor(w));
    });
    ro.observe(el);
    setWidth(Math.floor(el.getBoundingClientRect().width) || 600);
    return () => ro.disconnect();
  }, []);

  const finalOpts = useMemo(() => ({ ...opts, width }), [opts, width]);

  return (
    <div ref={wrapRef} className="w-full overflow-hidden">
      {width > 0 && <UplotReact options={finalOpts} data={data} />}
    </div>
  );
};

// ─── Last 7 Days Sales Chart (uPlot) ─────────────────────────────────────────
const SalesTrendChart = ({ salesTrend }) => {
  const labels = salesTrend.map((d) => d.dayLabel);
  const xs     = salesTrend.map((_, i) => i);
  const sales  = salesTrend.map((d) => d.sales);
  const orders = salesTrend.map((d) => d.orders);

  const opts = {
    height: 300,
    series: [
      { value: (u, v) => labels[v] ?? v },
      {
        label: "Sales",
        stroke: "#4f46e5",
        width: 3,
        fill: "rgba(79,70,229,0.07)",
        points: { show: false },
        spanGaps: true,
      },
      {
        label: "Orders",
        stroke: "#16a34a",
        width: 2,
        fill: "rgba(22,163,74,0.06)",
        points: { show: false },
        spanGaps: true,
      },
    ],
    axes: [
      {
        values: (u, vals) => vals.map((v) => labels[v] ?? v),
        gap: 6,
        stroke: "#64748b",
        ticks: { stroke: "#e2e8f0" },
      },
      {
        gap: 6,
        stroke: "#64748b",
        ticks: { stroke: "#e2e8f0" },
        values: (u, vals) => vals.map((v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v)),
        side: 3,
      },
    ],
    scales: {
      x: { range: [-0.3, Math.max(labels.length - 0.7, 0.7)] },
    },
    grid: { stroke: "#e2e8f0", width: 1 },
    cursor: { show: true },
    legend: { show: true },
    padding: [10, 16, 8, 0],
  };

  return <ResponsiveUplot opts={opts} data={[xs, sales, orders]} />;
};

// ─── Main Component ───────────────────────────────────────────────────────────
const MerchantDashboardContent = () => {
  const token = useSelector((state) => state.auth?.token);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [overview, setOverview] = useState(initialOverview);

  const todayLabel = new Date().toLocaleDateString(undefined, {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  });

  const fetchOverview = async () => {
    if (!token) { setLoading(false); setError("Authentication token not found"); return; }
    try {
      setLoading(true); setError("");
      const { data } = await axios.get(`${API_BASE}/merchant/stats/overview`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = data?.data || {};
      setOverview({
        ...initialOverview, ...payload,
        products:      { ...initialOverview.products,  ...(payload.products  || {}) },
        orders:        { ...initialOverview.orders,    ...(payload.orders    || {}) },
        today:         { ...initialOverview.today,     ...(payload.today     || {}) },
        last7Days:     { ...initialOverview.last7Days, ...(payload.last7Days || {}) },
        recentOrders:  Array.isArray(payload.recentOrders) ? payload.recentOrders : [],
        topProducts:   Array.isArray(payload.topProducts)  ? payload.topProducts  : [],
      });
    } catch (err) {

      setError(err?.response?.data?.message || "Failed to load merchant dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOverview(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [token]);

  const salesTrend = useMemo(() =>
    (overview.last7Days?.trend || []).map((item) => {
      const d = new Date(item.date);
      const dayLabel = Number.isNaN(d.getTime())
        ? item.date
        : d.toLocaleDateString(undefined, { weekday: "short" });
      return { ...item, dayLabel, sales: Number(item.sales || 0), orders: Number(item.orders || 0) };
    }),
  [overview.last7Days]);

  const recentOrderColumns = useMemo(() => [
    { title: "Order", dataIndex: "id", key: "id", width: 90, render: (id) => <span className="font-semibold text-slate-900">#{id}</span> },
    { title: "Product", dataIndex: "name", key: "name", ellipsis: true, render: (t) => <span className="text-slate-800">{t || "—"}</span> },
    { title: "Qty", dataIndex: "quantity", key: "quantity", align: "right", width: 70 },
    { title: "Amount", key: "amount", align: "right", width: 140, render: (_, row) => <span className="font-medium text-slate-900">{moneyUSD(Number(row.price || 0) * Number(row.quantity || 0))}</span> },
    { title: "Status", dataIndex: "status", key: "status", width: 120, render: (s) => statusTag(s) },
  ], []);

  const topProductColumns = useMemo(() => [
    {
      title: "Product", dataIndex: "name", key: "name",
      render: (text, record) => (
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
            {record.imageUrl
              ? <img src={normalizeImageUrl(record.imageUrl)} alt="" className="w-full h-full object-cover" />
              : <div className="w-full h-full grid place-items-center text-slate-400 text-[10px]">No image</div>}
          </div>
          <div className="min-w-0">
            <div className="font-medium text-slate-900 truncate max-w-[220px]" title={text}>{text || "—"}</div>
            {record?.productId ? <div className="text-xs text-slate-500">ID: {record.productId}</div> : null}
          </div>
        </div>
      ),
    },
    {
      title: "Sold", dataIndex: "soldCount", key: "soldCount", align: "right", width: 120,
      render: (count) => <Tag color="cyan" style={{ borderRadius: 999, marginInlineEnd: 0 }}>{Number(count || 0)} sold</Tag>,
    },
  ], []);

  if (loading) {
    return (
      <div className="p-3 md:p-6 bg-slate-50 min-h-screen -m-0 md:-m-6 overflow-x-hidden">
        <Card variant="borderless" className="rounded-2xl shadow-sm border border-slate-100">
          <Skeleton active paragraph={{ rows: 7 }} />
        </Card>
      </div>
    );
  }

  const total7dSales = Number(overview.last7Days?.sales || 0);

  return (
    <div className="p-3 md:p-6 bg-slate-50 min-h-screen -m-0 md:-m-6 overflow-x-hidden">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-900 via-sky-900 to-teal-800 p-5 md:p-7 mb-6 text-white shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight truncate">Merchant Dashboard</h2>
            <p className="text-white/80 text-sm mt-1">Sales, inventory, and order performance at a glance</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex items-center rounded-full bg-white/15 px-4 py-2 text-xs md:text-sm">{todayLabel}</div>
            <AntTooltip title="Refresh data">
              <Button icon={<ReloadOutlined />} onClick={fetchOverview} className="bg-white/15 text-white border-white/20 hover:bg-white/20" />
            </AntTooltip>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mt-5">
          <div className="rounded-xl bg-white/10 p-3">
            <div className="text-xs text-white/80">Today Orders</div>
            <div className="text-lg font-semibold">{Number(overview.today?.orders || 0)}</div>
          </div>
          <div className="rounded-xl bg-white/10 p-3">
            <div className="text-xs text-white/80">Today Sales</div>
            <div className="text-lg font-semibold">{compactWithPopover(overview.today?.sales || 0, { currency: true })}</div>
          </div>
          <div className="rounded-xl bg-emerald-500/20 border border-emerald-400/30 p-3">
            <div className="text-xs text-emerald-200 font-medium">Today's Earning</div>
            <div className="text-lg font-bold text-emerald-100">{compactWithPopover(overview.today?.earnings || 0, { currency: true })}</div>
          </div>
          <div className="rounded-xl bg-white/10 p-3">
            <div className="text-xs text-white/80">Total Earnings</div>
            <div className="text-lg font-semibold">{compactWithPopover(overview.totalEarnings || 0, { currency: true })}</div>
          </div>
          <div className="rounded-xl bg-white/10 p-3">
            <div className="text-xs text-white/80">Pending Orders</div>
            <div className="text-lg font-semibold">{Number(overview.orders?.pending || 0)}</div>
          </div>
        </div>
      </div>

      {error ? <Alert type="error" showIcon title={error} className="mb-4 rounded-xl border border-rose-200" /> : null}

      {/* KPI Cards Row 1 */}
      <Row gutter={[16, 16]} className="mb-6">
        <Col xs={24} sm={12} lg={5}>
          <MetricCard title="Today's Earning" value={Number(overview.today?.earnings || 0)} precision={2} suffix="USD" icon={<RiseOutlined />} accent="#059669" helper="Delivered today" />
        </Col>
        <Col xs={24} sm={12} lg={5}>
          <MetricCard title="Current Balance" value={Number(overview.balance || 0)} precision={2} suffix="USD" icon={<WalletOutlined />} accent="#4f46e5" helper="Available to withdraw" />
        </Col>
        <Col xs={24} sm={12} lg={5}>
          <MetricCard title="Total Earnings" value={Number(overview.totalEarnings || 0)} precision={2} suffix="USD" icon={<RiseOutlined />} accent="#16a34a" helper="Lifetime earnings" />
        </Col>
        <Col xs={24} sm={12} lg={5}>
          <MetricCard title="Today Orders" value={Number(overview.today?.orders || 0)} icon={<ClockCircleOutlined />} accent="#3b82f6" helper="Orders placed today" />
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <MetricCard title="Today Sales" value={Number(overview.today?.sales || 0)} precision={2} suffix="USD" icon={<CheckCircleOutlined />} accent="#15803d" helper="Sales today" />
        </Col>
      </Row>

      {/* KPI Cards Row 2 */}
      <Row gutter={[16, 16]} className="mb-8">
        <Col xs={24} sm={12} lg={6}>
          <MetricCard title="Total Products" value={Number(overview.products?.total || 0)} icon={<ShoppingOutlined />} accent="#14b8a6" helper="Active items" />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <MetricCard title="Low Stock" value={Number(overview.products?.lowStock || 0)} icon={<WarningOutlined />} accent="#f97316" helper="Needs restock" />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <MetricCard title="Out of Stock" value={Number(overview.products?.outOfStock || 0)} icon={<InboxOutlined />} accent="#dc2626" helper="Unavailable items" />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <MetricCard title="Total Orders" value={Number(overview.orders?.total || 0)} icon={<FileTextOutlined />} accent="#4f46e5" helper="All-time orders" />
        </Col>
      </Row>

      {/* Chart + Recent Orders */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card
            title={
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
                <span className="font-semibold">Last 7 Days Sales</span>
                <span className="text-xs text-slate-500">Total: {compactWithPopover(total7dSales, { currency: true })}</span>
              </div>
            }
            variant="borderless"
            className="shadow-sm rounded-2xl border border-slate-100 mb-6"
            styles={{ body: { padding: 16 } }}
          >
            {salesTrend.length > 0 ? (
              <SalesTrendChart salesTrend={salesTrend} />
            ) : (
              <Empty description="No sales data for last 7 days" />
            )}
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card
            title={<span className="font-semibold">Recent Orders</span>}
            extra={<span className="text-xs text-slate-500">{overview.recentOrders?.length || 0} items</span>}
            variant="borderless"
            className="shadow-sm rounded-2xl border border-slate-100"
            styles={{ body: { padding: 12 } }}
          >
            {overview.recentOrders?.length ? (
              <div className="w-full overflow-x-auto">
                <Table dataSource={overview.recentOrders} columns={recentOrderColumns} rowKey="id" pagination={false} size="small" scroll={{ x: "max-content" }} />
              </div>
            ) : (
              <Empty description="No recent orders" />
            )}
          </Card>
        </Col>
      </Row>

      {/* Bottom section */}
      <Row gutter={[16, 16]} className="mt-6">
        <Col xs={24} lg={12}>
          <Card
            title={<span className="font-semibold">Order Status Breakdown</span>}
            variant="borderless"
            className="shadow-sm rounded-2xl border border-slate-100"
            styles={{ body: { padding: 16 } }}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {["pending","processing","shipped","delivered","cancelled"].map((s) => (
                <div key={s} className="flex items-center justify-between rounded-xl border border-slate-100 bg-white p-3 gap-2">
                  <span className="text-slate-600 text-sm capitalize">{s}</span>
                  <div className="shrink-0">{statusTag(s)}</div>
                  <span className="font-semibold">{Number(overview.orders?.[s] || 0)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-white p-3 gap-2">
                <span className="text-slate-600 text-sm">Total</span>
                <Tag color="geekblue" style={{ borderRadius: 999, marginInlineEnd: 0 }}>TOTAL</Tag>
                <span className="font-semibold">{Number(overview.orders?.total || 0)}</span>
              </div>
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            title={<span className="font-semibold">Top Selling Products</span>}
            extra={<span className="text-xs text-slate-500">{overview.topProducts?.length || 0} items</span>}
            variant="borderless"
            className="shadow-sm rounded-2xl border border-slate-100"
            styles={{ body: { padding: 12 } }}
          >
            {overview.topProducts?.length ? (
              <div className="w-full overflow-x-auto">
                <Table dataSource={overview.topProducts} columns={topProductColumns} rowKey={(r) => r.productId || r.id || r.name} pagination={false} size="small" scroll={{ x: "max-content" }} />
              </div>
            ) : (
              <Empty description="No top products data" />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default MerchantDashboardContent;
