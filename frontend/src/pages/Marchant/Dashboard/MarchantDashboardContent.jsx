import React, { useEffect, useMemo, useState } from "react";
import { Card, Row, Col, Statistic, Table, Tag, Alert } from "antd";
import {
  ShoppingOutlined,
  FileTextOutlined,
  WalletOutlined,
  RiseOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  InboxOutlined,
} from "@ant-design/icons";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import axios from "axios";
import { useSelector } from "react-redux";
import { API_BASE_URL } from "../../../config/env";

const API_BASE = `${API_BASE_URL}/api`;

const initialOverview = {
  balance: 0,
  totalEarnings: 0,
  products: { total: 0, lowStock: 0, outOfStock: 0 },
  orders: { total: 0, pending: 0, processing: 0, shipped: 0, delivered: 0, cancelled: 0 },
  today: { orders: 0, deliveredOrders: 0, sales: 0 },
  last7Days: { sales: 0, trend: [] },
  recentOrders: [],
  topProducts: [],
};

const MerchantDashboardContent = () => {
  const token = useSelector((state) => state.auth?.token);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [overview, setOverview] = useState(initialOverview);
  const todayLabel = new Date().toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  useEffect(() => {
    const fetchOverview = async () => {
      if (!token) {
        setLoading(false);
        setError("Authentication token not found");
        return;
      }

      try {
        setLoading(true);
        setError("");

        const { data } = await axios.get(`${API_BASE}/merchant/stats/overview`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const payload = data?.data || {};
        setOverview({
          ...initialOverview,
          ...payload,
          products: { ...initialOverview.products, ...(payload.products || {}) },
          orders: { ...initialOverview.orders, ...(payload.orders || {}) },
          today: { ...initialOverview.today, ...(payload.today || {}) },
          last7Days: { ...initialOverview.last7Days, ...(payload.last7Days || {}) },
          recentOrders: Array.isArray(payload.recentOrders) ? payload.recentOrders : [],
          topProducts: Array.isArray(payload.topProducts) ? payload.topProducts : [],
        });
      } catch (err) {
        console.error("Merchant dashboard load error:", err);
        setError(err?.response?.data?.message || "Failed to load merchant dashboard");
      } finally {
        setLoading(false);
      }
    };

    fetchOverview();
  }, [token]);

  const salesTrend = useMemo(() => {
    return (overview.last7Days?.trend || []).map((item) => {
      const d = new Date(item.date);
      const dayLabel = Number.isNaN(d.getTime())
        ? item.date
        : d.toLocaleDateString(undefined, { weekday: "short" });
      return {
        ...item,
        dayLabel,
        sales: Number(item.sales || 0),
        orders: Number(item.orders || 0),
      };
    });
  }, [overview.last7Days]);

  const recentOrderColumns = [
    {
      title: "Order",
      dataIndex: "id",
      key: "id",
      render: (id) => <span className="font-medium">#{id}</span>,
    },
    {
      title: "Product",
      dataIndex: "name",
      key: "name",
      ellipsis: true,
    },
    {
      title: "Qty",
      dataIndex: "quantity",
      key: "quantity",
      align: "right",
    },
    {
      title: "Amount",
      key: "amount",
      align: "right",
      render: (_, row) => `BDT ${Number(row.price || 0) * Number(row.quantity || 0)}`,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (s) => {
        const status = String(s || "").toLowerCase();
        let color = "default";
        if (status === "pending") color = "orange";
        if (status === "processing") color = "blue";
        if (status === "shipped") color = "purple";
        if (status === "delivered") color = "green";
        if (status === "cancelled") color = "red";
        return <Tag color={color}>{status.toUpperCase()}</Tag>;
      },
    },
  ];

  const topProductColumns = [
    {
      title: "Product",
      dataIndex: "name",
      key: "name",
      render: (text, record) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded bg-gray-100 overflow-hidden shrink-0">
            {record.imageUrl ? (
              <img src={record.imageUrl} alt="" className="w-full h-full object-cover" />
            ) : null}
          </div>
          <span className="font-medium truncate max-w-[200px]" title={text}>
            {text}
          </span>
        </div>
      ),
    },
    {
      title: "Sold",
      dataIndex: "soldCount",
      key: "soldCount",
      align: "right",
      render: (count) => <Tag color="cyan">{Number(count || 0)} sold</Tag>,
    },
  ];

  if (loading) {
    return null;
  }

  return (
    <div className="p-3 md:p-6 bg-slate-50 min-h-screen -m-6">
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-sky-900 via-cyan-800 to-teal-700 p-5 md:p-7 mb-6 text-white shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Merchant Dashboard</h2>
            <p className="text-cyan-100 text-sm mt-1">Sales, inventory and order performance at a glance</p>
          </div>
          <div className="inline-flex items-center rounded-full bg-white/15 px-4 py-2 text-xs md:text-sm">
            {todayLabel}
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
          <div className="rounded-xl bg-white/10 p-3">
            <div className="text-xs text-cyan-100">Today Orders</div>
            <div className="text-lg font-semibold">{Number(overview.today?.orders || 0)}</div>
          </div>
          <div className="rounded-xl bg-white/10 p-3">
            <div className="text-xs text-cyan-100">Today Sales</div>
            <div className="text-lg font-semibold">BDT {Number(overview.today?.sales || 0).toLocaleString()}</div>
          </div>
          <div className="rounded-xl bg-white/10 p-3">
            <div className="text-xs text-cyan-100">Total Earnings</div>
            <div className="text-lg font-semibold">BDT {Number(overview.totalEarnings || 0).toLocaleString()}</div>
          </div>
          <div className="rounded-xl bg-white/10 p-3">
            <div className="text-xs text-cyan-100">Pending Orders</div>
            <div className="text-lg font-semibold">{Number(overview.orders?.pending || 0)}</div>
          </div>
        </div>
      </div>

      {error ? <Alert type="error" showIcon message={error} className="mb-4" /> : null}

      <Row gutter={[16, 16]} className="mb-8">
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} className="shadow-sm rounded-2xl hover:shadow-lg hover:-translate-y-0.5 transition-all border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white">
            <Statistic
              title="Current Balance"
              value={Number(overview.balance || 0)}
              precision={2}
              prefix={<WalletOutlined className="text-indigo-500" />}
              suffix="BDT"
              valueStyle={{ fontWeight: "bold", color: "#4f46e5" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} className="shadow-sm rounded-2xl hover:shadow-lg hover:-translate-y-0.5 transition-all border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white">
            <Statistic
              title="Total Earnings"
              value={Number(overview.totalEarnings || 0)}
              precision={2}
              prefix={<RiseOutlined className="text-emerald-500" />}
              suffix="BDT"
              valueStyle={{ fontWeight: "bold" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} className="shadow-sm rounded-2xl hover:shadow-lg hover:-translate-y-0.5 transition-all border border-blue-100 bg-gradient-to-br from-blue-50 to-white">
            <Statistic
              title="Today Orders"
              value={Number(overview.today?.orders || 0)}
              prefix={<ClockCircleOutlined className="text-blue-500" />}
              valueStyle={{ fontWeight: "bold" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} className="shadow-sm rounded-2xl hover:shadow-lg hover:-translate-y-0.5 transition-all border border-green-100 bg-gradient-to-br from-green-50 to-white">
            <Statistic
              title="Today Sales"
              value={Number(overview.today?.sales || 0)}
              precision={2}
              prefix={<CheckCircleOutlined className="text-green-600" />}
              suffix="BDT"
              valueStyle={{ fontWeight: "bold" }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} className="mb-8">
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} className="shadow-sm rounded-2xl border border-teal-100 bg-gradient-to-br from-teal-50 to-white">
            <Statistic
              title="Total Products"
              value={Number(overview.products?.total || 0)}
              prefix={<ShoppingOutlined className="text-teal-600" />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} className="shadow-sm rounded-2xl border border-orange-100 bg-gradient-to-br from-orange-50 to-white">
            <Statistic
              title="Low Stock"
              value={Number(overview.products?.lowStock || 0)}
              prefix={<WarningOutlined className="text-orange-500" />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} className="shadow-sm rounded-2xl border border-red-100 bg-gradient-to-br from-red-50 to-white">
            <Statistic
              title="Out of Stock"
              value={Number(overview.products?.outOfStock || 0)}
              prefix={<InboxOutlined className="text-red-500" />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} className="shadow-sm rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white">
            <Statistic
              title="Total Orders"
              value={Number(overview.orders?.total || 0)}
              prefix={<FileTextOutlined className="text-indigo-500" />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card title="Last 7 Days Sales" bordered={false} className="shadow-sm rounded-2xl border border-slate-100 mb-6 h-full">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={salesTrend} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="dayLabel" stroke="#888" fontSize={12} />
                  <YAxis stroke="#888" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "8px",
                      border: "none",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="sales"
                    stroke="#4f46e5"
                    strokeWidth={3}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                    name="Sales (BDT)"
                  />
                  <Line
                    type="monotone"
                    dataKey="orders"
                    stroke="#16a34a"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                    name="Orders"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card title="Recent Orders" bordered={false} className="shadow-sm rounded-2xl border border-slate-100 h-full">
            <Table
              dataSource={overview.recentOrders}
              columns={recentOrderColumns}
              rowKey="id"
              pagination={false}
              size="small"
              scroll={{ x: true }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} className="mt-6">
        <Col xs={24} lg={12}>
          <Card title="Order Status Breakdown" bordered={false} className="shadow-sm rounded-2xl border border-slate-100">
            <Row gutter={[12, 12]}>
              <Col span={12}><Tag color="orange">Pending: {Number(overview.orders?.pending || 0)}</Tag></Col>
              <Col span={12}><Tag color="blue">Processing: {Number(overview.orders?.processing || 0)}</Tag></Col>
              <Col span={12}><Tag color="purple">Shipped: {Number(overview.orders?.shipped || 0)}</Tag></Col>
              <Col span={12}><Tag color="green">Delivered: {Number(overview.orders?.delivered || 0)}</Tag></Col>
              <Col span={12}><Tag color="red">Cancelled: {Number(overview.orders?.cancelled || 0)}</Tag></Col>
            </Row>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="Top Selling Products" bordered={false} className="shadow-sm rounded-2xl border border-slate-100">
            <Table
              dataSource={overview.topProducts}
              columns={topProductColumns}
              rowKey="productId"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default MerchantDashboardContent;
