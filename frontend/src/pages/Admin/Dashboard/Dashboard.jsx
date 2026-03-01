import React, { useEffect, useMemo, useState } from "react";
import { Card, Row, Col, Statistic } from "antd";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
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

  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#EF4444"];
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
        console.error("Failed to load dashboard stats", error);
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
          today: { orders: 0, sales: 0, newUsers: 0, approvedTopupAmount: 0, byStatus: { pending: 0, processing: 0, shipped: 0, delivered: 0, cancelled: 0 } },
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
            <div className="text-lg font-semibold">BDT {Number(stats.today.sales || 0).toLocaleString()}</div>
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

      {/* Stats Cards */}
      <Row gutter={[16, 16]} className="mb-8">
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} className="shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white">
            <Statistic
              title="Total Users"
              value={stats.users}
              prefix={<UsersIcon size={18} className="text-blue-500" />}
              valueStyle={{ fontWeight: "bold" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} className="shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white">
            <Statistic
              title="Total Products"
              value={stats.products}
              prefix={<PackageIcon size={18} className="text-green-500" />}
              valueStyle={{ fontWeight: "bold" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} className="shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 to-white">
            <Statistic
              title="Total Orders"
              value={stats.orders}
              prefix={<ClipboardList size={18} className="text-purple-500" />}
              valueStyle={{ fontWeight: "bold" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} className="shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all rounded-2xl border border-orange-100 bg-gradient-to-br from-orange-50 to-white">
            <Statistic
              title="Merchant Requests"
              value={stats.pendingMerchantRequests}
              prefix={<Store size={18} className="text-orange-500" />}
              valueStyle={{ fontWeight: "bold" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} className="shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white">
            <Statistic
              title="Today's Sales"
              value={stats.today.sales}
              precision={2}
              prefix={<CircleDollarSign size={18} className="text-emerald-500" />}
              valueStyle={{ fontWeight: "bold" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} className="shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white">
            <Statistic
              title="Users Total Balance"
              value={stats.balances.users}
              precision={2}
              prefix={<WalletIcon size={18} className="text-violet-500" />}
              valueStyle={{ fontWeight: "bold" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} className="shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white">
            <Statistic
              title="Low Stock Products"
              value={stats.inventory.lowStockProducts}
              prefix={<Boxes size={18} className="text-amber-500" />}
              valueStyle={{ fontWeight: "bold" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} className="shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all rounded-2xl border border-red-100 bg-gradient-to-br from-red-50 to-white">
            <Statistic
              title="Pending Topups"
              value={stats.pendingTopups}
              prefix={<Zap size={18} className="text-red-500" />}
              valueStyle={{ fontWeight: "bold" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} className="shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 to-white">
            <Statistic
              title="Today's Orders"
              value={stats.today.orders}
              prefix={<ClipboardList size={18} className="text-sky-500" />}
              valueStyle={{ fontWeight: "bold" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} className="shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white">
            <Statistic
              title="New Users Today"
              value={stats.today.newUsers}
              prefix={<UsersIcon size={18} className="text-indigo-500" />}
              valueStyle={{ fontWeight: "bold" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} className="shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all rounded-2xl border border-green-100 bg-gradient-to-br from-green-50 to-white">
            <Statistic
              title="Approved Merchants"
              value={stats.approvedMerchants}
              prefix={<Store size={18} className="text-green-600" />}
              valueStyle={{ fontWeight: "bold" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} className="shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all rounded-2xl border border-rose-100 bg-gradient-to-br from-rose-50 to-white">
            <Statistic
              title="Out Of Stock"
              value={stats.inventory.outOfStockProducts}
              prefix={<Boxes size={18} className="text-rose-500" />}
              valueStyle={{ fontWeight: "bold" }}
            />
          </Card>
        </Col>
      </Row>

      {/* Charts Section */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card title="Today's Order Status" bordered={false} className="shadow-sm rounded-2xl border border-slate-100">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={todayProgressData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="orders" stroke="#2563eb" activeDot={{ r: 8 }} name="Orders" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="Overall Order Breakdown" bordered={false} className="shadow-sm rounded-2xl border border-slate-100">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={orderStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    fill="#8884d8"
                    paddingAngle={5}
                    dataKey="value"
                    label
                  >
                    {orderStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
