import React, { useEffect, useMemo, useState, useRef } from "react";
import { Card, Row, Col, Statistic, Popover } from "antd";
import UplotReact from "uplot-react";
import "uplot/dist/uPlot.min.css";
import axios from "axios";
import { useSelector } from "react-redux";
import { API_BASE_URL } from "../../../config/env";
import {
  Users as UsersIcon,
  Package as PackageIcon,
  ClipboardList,
  Store,
  Wallet as WalletIcon,
  CircleDollarSign,
  Boxes,
  Zap,
} from "lucide-react";

const API_BASE = `${API_BASE_URL}/api`;

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

// ─── Donut / Pie chart drawn on a plain <canvas> (no recharts, no uPlot) ──────
const DonutChart = ({ data, colors }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const total = data.reduce((s, d) => s + d.value, 0);
    if (total === 0) {
      ctx.fillStyle = "#e2e8f0";
      ctx.beginPath();
      ctx.arc(W / 2, H / 2, 70, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    let startAngle = -Math.PI / 2;
    const cx = W / 2;
    const cy = H / 2;
    const outerR = 80;
    const innerR = 55;
    const gap = 0.03;

    data.forEach((d, i) => {
      if (d.value === 0) return;
      const slice = (d.value / total) * (Math.PI * 2);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, outerR, startAngle + gap / 2, startAngle + slice - gap / 2);
      ctx.closePath();
      ctx.fillStyle = colors[i % colors.length];
      ctx.fill();

      // cut inner hole
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath();
      ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      startAngle += slice;
    });
  }, [data, colors]);

  return (
    <div className="flex flex-col items-center gap-4">
      <canvas ref={canvasRef} width={200} height={200} />
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
        {data.map((d, i) => (
          <div key={d.name} className="flex items-center gap-1 text-xs text-slate-600">
            <span
              className="inline-block w-3 h-3 rounded-sm"
              style={{ background: colors[i % colors.length] }}
            />
            {d.name} ({d.value})
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Today's Order Status – uPlot line chart ──────────────────────────────────
const TodayOrderChart = ({ data }) => {
  const labels = data.map((d) => d.name);
  const values = data.map((d) => d.orders);

  // uPlot needs numeric x-axis – use index 0..N-1
  const xs = labels.map((_, i) => i);

  const opts = {
    width: 0, // will be overridden by responsive wrapper
    height: 280,
    series: [
      {
        // x-series
        value: (u, v) => labels[v] ?? v,
      },
      {
        label: "Orders",
        stroke: "#2563eb",
        width: 2,
        fill: "rgba(37,99,235,0.07)",
        points: { show: true, size: 8, fill: "#2563eb" },
      },
    ],
    axes: [
      {
        values: (u, vals) => vals.map((v) => labels[v] ?? v),
        gap: 6,
      },
      {
        gap: 6,
      },
    ],
    scales: {
      x: { range: [-0.5, labels.length - 0.5] },
    },
    grid: { stroke: "#e2e8f0", width: 1 },
    cursor: { show: true },
    legend: { show: true },
  };

  return (
    <ResponsiveUplot opts={opts} data={[xs, values]} />
  );
};

// Wrapper that measures container width and passes it to uPlot
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
      {width > 0 && (
        <UplotReact options={finalOpts} data={data} />
      )}
    </div>
  );
};

// ─── Dashboard ────────────────────────────────────────────────────────────────
const Dashboard = () => {
  const reduxToken = useSelector((state) => state.auth?.token);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    users: 0,
    products: 0,
    orders: 0,
    merchants: 0,
    approvedMerchants: 0,
    pendingMerchantRequests: 0,
    pendingTopups: 0,
    activeOffers: 0,
    balances: { users: 0, merchants: 0, admin: 0 },
    inventory: { lowStockProducts: 0, outOfStockProducts: 0 },
    today: {
      orders: 0,
      sales: 0,
      newUsers: 0,
      approvedTopupAmount: 0,
      byStatus: { pending: 0, processing: 0, shipped: 0, delivered: 0, cancelled: 0 },
    },
    ordersByStatus: { pending: 0, processing: 0, shipped: 0, delivered: 0, cancelled: 0 },
  });

  const token = useMemo(() => {
    if (reduxToken) return reduxToken;
    try {
      const saved = JSON.parse(localStorage.getItem("userInfo") || "null");
      return saved?.token || null;
    } catch {
      return null;
    }
  }, [reduxToken]);

  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#EF4444"];

  const orderStatusData = useMemo(
    () => [
      { name: "Pending", value: Number(stats.ordersByStatus?.pending || 0) },
      { name: "Processing", value: Number(stats.ordersByStatus?.processing || 0) },
      { name: "Shipped", value: Number(stats.ordersByStatus?.shipped || 0) },
      { name: "Delivered", value: Number(stats.ordersByStatus?.delivered || 0) },
      { name: "Cancelled", value: Number(stats.ordersByStatus?.cancelled || 0) },
    ],
    [stats.ordersByStatus]
  );

  const todayProgressData = useMemo(
    () => [
      { name: "Pending", orders: Number(stats.today?.byStatus?.pending || 0) },
      { name: "Processing", orders: Number(stats.today?.byStatus?.processing || 0) },
      { name: "Shipped", orders: Number(stats.today?.byStatus?.shipped || 0) },
      { name: "Delivered", orders: Number(stats.today?.byStatus?.delivered || 0) },
      { name: "Cancelled", orders: Number(stats.today?.byStatus?.cancelled || 0) },
    ],
    [stats.today]
  );

  const todayLabel = new Date().toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    const fetchStats = async () => {
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const res = await axios.get(`${API_BASE}/admin/stats`, { headers, timeout: 10000 });
        const next = res?.data?.stats || {};
        setStats({
          users: Number(next.users || 0),
          products: Number(next.products || 0),
          orders: Number(next.orders || 0),
          merchants: Number(next.merchants || 0),
          approvedMerchants: Number(next.approvedMerchants || 0),
          pendingMerchantRequests: Number(next.pendingMerchantRequests || 0),
          pendingTopups: Number(next.pendingTopups || 0),
          activeOffers: Number(next.activeOffers || 0),
          balances: {
            users: Number(next?.balances?.users || 0),
            merchants: Number(next?.balances?.merchants || 0),
            admin: Number(next?.balances?.admin || 0),
          },
          inventory: {
            lowStockProducts: Number(next?.inventory?.lowStockProducts || 0),
            outOfStockProducts: Number(next?.inventory?.outOfStockProducts || 0),
          },
          today: {
            orders: Number(next?.today?.orders || 0),
            sales: Number(next?.today?.sales || 0),
            newUsers: Number(next?.today?.newUsers || 0),
            approvedTopupAmount: Number(next?.today?.approvedTopupAmount || 0),
            byStatus: {
              pending: Number(next?.today?.byStatus?.pending || 0),
              processing: Number(next?.today?.byStatus?.processing || 0),
              shipped: Number(next?.today?.byStatus?.shipped || 0),
              delivered: Number(next?.today?.byStatus?.delivered || 0),
              cancelled: Number(next?.today?.byStatus?.cancelled || 0),
            },
          },
          ordersByStatus: {
            pending: Number(next?.ordersByStatus?.pending || 0),
            processing: Number(next?.ordersByStatus?.processing || 0),
            shipped: Number(next?.ordersByStatus?.shipped || 0),
            delivered: Number(next?.ordersByStatus?.delivered || 0),
            cancelled: Number(next?.ordersByStatus?.cancelled || 0),
          },
        });
      } catch (error) {

        setStats({
          users: 0,
          products: 0,
          orders: 0,
          merchants: 0,
          approvedMerchants: 0,
          pendingMerchantRequests: 0,
          pendingTopups: 0,
          activeOffers: 0,
          balances: { users: 0, merchants: 0, admin: 0 },
          inventory: { lowStockProducts: 0, outOfStockProducts: 0 },
          today: {
            orders: 0,
            sales: 0,
            newUsers: 0,
            approvedTopupAmount: 0,
            byStatus: { pending: 0, processing: 0, shipped: 0, delivered: 0, cancelled: 0 },
          },
          ordersByStatus: { pending: 0, processing: 0, shipped: 0, delivered: 0, cancelled: 0 },
        });
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [token]);

  if (loading) {
    return null;
  }

  return (
    <div className="p-3 md:p-6 bg-slate-50 min-h-screen -m-6">
      {/* ── Header ── */}
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 p-5 md:p-7 mb-6 text-white shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Admin Dashboard</h2>
            <p className="text-slate-200 text-sm mt-1">Live commerce overview and operational health</p>
          </div>
          <div className="inline-flex items-center rounded-full bg-white/15 px-4 py-2 text-xs md:text-sm">
            {todayLabel}
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
          <div className="rounded-xl bg-white/10 p-3">
            <div className="text-xs text-slate-200">Today Orders</div>
            <div className="text-lg font-semibold">{stats.today.orders}</div>
          </div>
          <div className="rounded-xl bg-white/10 p-3">
            <div className="text-xs text-slate-200">Today Sales</div>
            <div className="text-lg font-semibold">{compactWithPopover(stats.today.sales || 0, { currency: true })}</div>
          </div>
          <div className="rounded-xl bg-white/10 p-3">
            <div className="text-xs text-slate-200">Pending Topups</div>
            <div className="text-lg font-semibold">{stats.pendingTopups}</div>
          </div>
          <div className="rounded-xl bg-white/10 p-3">
            <div className="text-xs text-slate-200">Merchant Requests</div>
            <div className="text-lg font-semibold">{stats.pendingMerchantRequests}</div>
          </div>
        </div>
      </div>

      {/* ── Stats Cards ── */}
      <Row gutter={[16, 16]} className="mb-8">
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} className="shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white">
            <Statistic title="Total Users" value={stats.users} formatter={(v) => compactWithPopover(v)} prefix={<UsersIcon size={18} className="text-blue-500" />} valueStyle={{ fontWeight: "bold" }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} className="shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white">
            <Statistic title="Total Products" value={stats.products} formatter={(v) => compactWithPopover(v)} prefix={<PackageIcon size={18} className="text-green-500" />} valueStyle={{ fontWeight: "bold" }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} className="shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 to-white">
            <Statistic title="Total Orders" value={stats.orders} formatter={(v) => compactWithPopover(v)} prefix={<ClipboardList size={18} className="text-purple-500" />} valueStyle={{ fontWeight: "bold" }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} className="shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all rounded-2xl border border-orange-100 bg-gradient-to-br from-orange-50 to-white">
            <Statistic title="Merchant Requests" value={stats.pendingMerchantRequests} formatter={(v) => compactWithPopover(v)} prefix={<Store size={18} className="text-orange-500" />} valueStyle={{ fontWeight: "bold" }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} className="shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white">
            <Statistic title="Today's Sales" value={stats.today.sales} formatter={(v) => compactWithPopover(v, { currency: true })} prefix="$" valueStyle={{ fontWeight: "bold" }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} className="shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white">
            <Statistic title="Users Total Balance" value={stats.balances.users} formatter={(v) => compactWithPopover(v, { currency: true })} prefix="$" valueStyle={{ fontWeight: "bold" }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} className="shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white">
            <Statistic title="Low Stock Products" value={stats.inventory.lowStockProducts} formatter={(v) => compactWithPopover(v)} prefix={<Boxes size={18} className="text-amber-500" />} valueStyle={{ fontWeight: "bold" }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} className="shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all rounded-2xl border border-red-100 bg-gradient-to-br from-red-50 to-white">
            <Statistic title="Pending Topups" value={stats.pendingTopups} formatter={(v) => compactWithPopover(v)} prefix={<Zap size={18} className="text-red-500" />} valueStyle={{ fontWeight: "bold" }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} className="shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 to-white">
            <Statistic title="Today's Orders" value={stats.today.orders} formatter={(v) => compactWithPopover(v)} prefix={<ClipboardList size={18} className="text-sky-500" />} valueStyle={{ fontWeight: "bold" }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} className="shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white">
            <Statistic title="New Users Today" value={stats.today.newUsers} formatter={(v) => compactWithPopover(v)} prefix={<UsersIcon size={18} className="text-indigo-500" />} valueStyle={{ fontWeight: "bold" }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} className="shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all rounded-2xl border border-green-100 bg-gradient-to-br from-green-50 to-white">
            <Statistic title="Approved Merchants" value={stats.approvedMerchants} formatter={(v) => compactWithPopover(v)} prefix={<Store size={18} className="text-green-600" />} valueStyle={{ fontWeight: "bold" }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} className="shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all rounded-2xl border border-rose-100 bg-gradient-to-br from-rose-50 to-white">
            <Statistic title="Out Of Stock" value={stats.inventory.outOfStockProducts} formatter={(v) => compactWithPopover(v)} prefix={<Boxes size={18} className="text-rose-500" />} valueStyle={{ fontWeight: "bold" }} />
          </Card>
        </Col>
      </Row>

      {/* ── Charts ── */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card title="Today's Order Status" bordered={false} className="shadow-sm rounded-2xl border border-slate-100">
            <TodayOrderChart data={todayProgressData} />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="Overall Order Breakdown" bordered={false} className="shadow-sm rounded-2xl border border-slate-100">
            <div className="flex justify-center py-2">
              <DonutChart data={orderStatusData} colors={COLORS} />
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
