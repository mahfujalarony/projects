// src/pages/MyGiftCards.jsx
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Card,
  Tabs,
  Tag,
  Table,
  Statistic,
  Empty,
  Spin,
  Tooltip,
  Badge,
  Button,
  message,
  Divider,
} from "antd";
import {
  SendOutlined,
  InboxOutlined,
  WalletOutlined,
  GiftOutlined,
  CalendarOutlined,
  UserOutlined,
  MailOutlined,
  MessageOutlined,
  LinkOutlined,
  CopyOutlined,
  WhatsAppOutlined,
} from "@ant-design/icons";
import axios from "axios";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../../config/env";

const API = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: { "Content-Type": "application/json" },
});

// Maps card status → Ant Design Tag color + label
const STATUS_CONFIG = {
  active: { color: "success", label: "Active" },
  claimed: { color: "processing", label: "Claimed" },
  expired: { color: "error", label: "Expired" },
};

// Premium stat card
function StatCard({ icon, title, value, prefix = "৳", highlight = false }) {
  const displayValue =
    typeof value === "number"
      ? prefix
        ? `${value.toFixed(2)}`
        : `${value}`
      : value;

  return (
    <div className="relative overflow-hidden rounded-3xl border border-zinc-100 bg-white shadow-sm hover:shadow-md transition-shadow">
      <div className="absolute inset-0 -z-10 gc-soft-grid opacity-[0.24]" />
      {highlight && (
        <>
          <div className="absolute inset-0 -z-10 bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950" />
          <div className="absolute inset-0 -z-10 gc-diagonal-pattern opacity-[0.08]" />
          <div className="absolute -top-20 -right-20 h-56 w-56 rounded-full bg-fuchsia-500/20 blur-3xl -z-10" />
          <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-amber-500/15 blur-3xl -z-10" />
        </>
      )}

      <div className="p-5">
        <div className="flex items-center gap-3">
          <div
            className={[
              "w-11 h-11 rounded-2xl flex items-center justify-center text-lg shrink-0 border",
              highlight
                ? "bg-white/5 border-white/10 text-white"
                : "bg-zinc-50 border-zinc-200 text-zinc-700",
            ].join(" ")}
          >
            {icon}
          </div>

          <div className="min-w-0 flex-1">
            <p
              className={[
                "text-[11px] uppercase tracking-[0.18em] font-semibold",
                highlight ? "text-white/55" : "text-zinc-500",
              ].join(" ")}
            >
              {title}
            </p>

            <div className="mt-1 flex items-baseline gap-2">
              {typeof value === "number" && prefix ? (
                <span
                  className={[
                    "text-2xl font-extrabold tracking-tight",
                    highlight ? "text-white" : "text-zinc-900",
                  ].join(" ")}
                >
                  {prefix}
                  {value.toFixed(2)}
                </span>
              ) : (
                <span
                  className={[
                    "text-2xl font-extrabold tracking-tight",
                    highlight ? "text-white" : "text-zinc-900",
                  ].join(" ")}
                >
                  {displayValue}
                </span>
              )}
            </div>
          </div>

          {highlight && (
            <span className="text-[11px] px-3 py-1 rounded-full bg-white/5 border border-white/10 text-white/70">
              Live
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// Expandable row for extra details (message + dates)
function ExpandedRow({ record }) {
  return (
    <div className="px-4 py-3 bg-zinc-50 rounded-2xl space-y-2 text-sm text-zinc-700 border border-zinc-200">
      {record.message && (
        <p className="flex items-start gap-2">
          <MessageOutlined className="text-zinc-400 mt-0.5 shrink-0" />
          <span className="italic">"{record.message}"</span>
        </p>
      )}
      <div className="flex flex-wrap gap-4">
        <span className="flex items-center gap-1 text-zinc-500 text-xs">
          <CalendarOutlined />
          Created: {new Date(record.createdAt).toLocaleDateString("en-GB")}
        </span>
        {record.expiresAt && (
          <span className="flex items-center gap-1 text-zinc-500 text-xs">
            <CalendarOutlined />
            Expires: {new Date(record.expiresAt).toLocaleDateString("en-GB")}
          </span>
        )}
        {record.claimedAt && (
          <span className="flex items-center gap-1 text-zinc-500 text-xs">
            <CalendarOutlined />
            Claimed: {new Date(record.claimedAt).toLocaleDateString("en-GB")}
          </span>
        )}
      </div>
    </div>
  );
}

export default function MyGiftCards() {
  const currentUser = useSelector((state) => state.auth.user);
  const token = useSelector((state) => state.auth.token) || "";

  const navigate = useNavigate();
  const goSendGiftCard = () => navigate("/gift-card");
  const goClaimGiftCard = () => navigate("/gift-card/claim");

  const [sentCards, setSentCards] = useState([]);
  const [receivedCards, setReceivedCards] = useState([]);
  const [loading, setLoading] = useState(false);

  // scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // redeem link builder
  const buildRedeemUrl = useCallback((code) => {
    const origin = window.location.origin;
    return `${origin}/gift-card/claim/redeem?code=${encodeURIComponent(code)}`;
  }, []);

  const copyToClipboard = useCallback(async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      message.success("Copied!");
    } catch {
      message.error("Copy failed.");
    }
  }, []);

  // Fetch both sent and received cards whenever the active user changes
  const fetchCards = useCallback(async () => {
    if (!currentUser) return;

    setLoading(true);
    try {
      const [sentRes, recvRes] = await Promise.all([
        API.get(`/giftcards/sent`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        API.get(`/giftcards/received`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      setSentCards(sentRes.data.cards || []);
      setReceivedCards(recvRes.data.cards || []);
    } catch {
      // keep previous state
    } finally {
      setLoading(false);
    }
  }, [currentUser, token]);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  // Derived stats
  const totalSentAmount = useMemo(
    () => sentCards.reduce((acc, c) => acc + parseFloat(c.amount), 0),
    [sentCards]
  );

  const totalReceivedAmount = useMemo(
    () =>
      receivedCards
        .filter((c) => c.status === "claimed")
        .reduce((acc, c) => acc + parseFloat(c.amount), 0),
    [receivedCards]
  );

  const activeCount = useMemo(
    () => sentCards.filter((c) => c.status === "active").length,
    [sentCards]
  );

  const baseColumns = [
    {
      title: "Code",
      dataIndex: "code",
      key: "code",
      render: (code) => (
        <Tooltip title="Gift card code">
          <span className="font-mono text-xs font-extrabold bg-zinc-100 border border-zinc-200 px-2.5 py-1 rounded-xl text-zinc-800 whitespace-nowrap tracking-widest">
            {code}
          </span>
        </Tooltip>
      ),
    },
    {
      title: "Amount",
      dataIndex: "amount",
      key: "amount",
      sorter: (a, b) => parseFloat(a.amount) - parseFloat(b.amount),
      render: (amt) => (
        <span className="font-extrabold text-zinc-900 text-base">
          ৳{parseFloat(amt).toFixed(2)}
        </span>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      filters: [
        { text: "Active", value: "active" },
        { text: "Claimed", value: "claimed" },
        { text: "Expired", value: "expired" },
      ],
      onFilter: (value, record) => record.status === value,
      render: (status) => {
        const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.active;
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: "Date",
      dataIndex: "createdAt",
      key: "createdAt",
      responsive: ["sm"],
      sorter: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
      render: (date) => (
        <span className="text-zinc-500 text-xs whitespace-nowrap">
          {new Date(date).toLocaleDateString("en-GB")}
        </span>
      ),
    },
  ];

  // ✅ Action column for sharing active cards
  const shareColumn = {
    title: "Share",
    key: "share",
    width: 220,
    render: (_, record) => {
      const isActive = record.status === "active";
      const redeemUrl = buildRedeemUrl(record.code);

      const waText = `Here is your gift card 🎁\nCode: ${record.code}\nRedeem: ${redeemUrl}`;
      const waLink = `https://wa.me/?text=${encodeURIComponent(waText)}`;

      return (
        <div className="flex items-center gap-2 flex-wrap">
          <Tooltip
            title={isActive ? "Copy redeem link" : "Only active cards can be shared"}
          >
            <Button
              size="small"
              icon={<LinkOutlined />}
              className="rounded-xl"
              disabled={!isActive}
              onClick={() => copyToClipboard(redeemUrl)}
            >
              Link
            </Button>
          </Tooltip>

          <Tooltip title="Copy code">
            <Button
              size="small"
              icon={<CopyOutlined />}
              className="rounded-xl"
              onClick={() => copyToClipboard(record.code)}
            >
              Code
            </Button>
          </Tooltip>

          <Tooltip title={isActive ? "Share WhatsApp" : "Only active cards can be shared"}>
            <Button
              size="small"
              icon={<WhatsAppOutlined />}
              className="rounded-xl"
              disabled={!isActive}
              onClick={() => window.open(waLink, "_blank")}
            >
              WA
            </Button>
          </Tooltip>
        </div>
      );
    },
  };

  // Sent columns
  const sentColumns = [
    ...baseColumns.slice(0, 1),
    {
      title: "To",
      dataIndex: "recipientEmail",
      key: "recipientEmail",
      responsive: ["md"],
      render: (email) => (
        <span className="text-zinc-600 text-xs flex items-center gap-1 truncate max-w-[180px]">
          <MailOutlined className="shrink-0 text-zinc-400" /> {email || "Manual share"}
        </span>
      ),
    },
    ...baseColumns.slice(1),
    shareColumn,
  ];

  // Received columns
  const receivedColumns = [
    ...baseColumns.slice(0, 1),
    {
      title: "From",
      key: "creator",
      responsive: ["md"],
      render: (_, record) => (
        <span className="text-zinc-600 text-xs flex items-center gap-1">
          <UserOutlined className="text-zinc-400" />
          {record.creator?.name || record.creatorName || "—"}
        </span>
      ),
    },
    ...baseColumns.slice(1),
  ];

  const tabItems = [
    {
      key: "sent",
      label: (
        <span className="flex items-center gap-2">
          <SendOutlined />
          <span className="hidden sm:inline">Sent</span>
          <Badge count={sentCards.length} color="#0a0a0a" size="small" />
        </span>
      ),
      children: (
        <Table
          columns={sentColumns}
          dataSource={sentCards}
          rowKey="id"
          pagination={{ pageSize: 8, hideOnSinglePage: true, size: "small" }}
          expandable={{
            expandedRowRender: (record) => <ExpandedRow record={record} />,
            rowExpandable: (record) =>
              !!(record.message || record.expiresAt || record.claimedAt),
          }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="You haven't sent any gift cards yet"
              />
            ),
          }}
          className="rounded-2xl overflow-hidden"
          size="middle"
        />
      ),
    },
    {
      key: "received",
      label: (
        <span className="flex items-center gap-2">
          <InboxOutlined />
          <span className="hidden sm:inline">Received</span>
          <Badge count={receivedCards.length} color="#c9a840" size="small" />
        </span>
      ),
      children: (
        <Table
          columns={receivedColumns}
          dataSource={receivedCards}
          rowKey="id"
          pagination={{ pageSize: 8, hideOnSinglePage: true, size: "small" }}
          expandable={{
            expandedRowRender: (record) => <ExpandedRow record={record} />,
            rowExpandable: (record) =>
              !!(record.message || record.expiresAt || record.claimedAt),
          }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="No gift cards received yet"
              />
            ),
          }}
          className="rounded-2xl overflow-hidden"
          size="middle"
        />
      ),
    },
  ];

  const actionsDisabled = !currentUser || !token;

  return (
    <div className="relative">
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-zinc-50 via-white to-zinc-50" />
      <div className="absolute inset-0 -z-10 gc-soft-grid opacity-[0.28]" />

      <div className="max-w-6xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-7 sm:mb-9 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900">
              My Gift Cards
            </h1>
            <p className="text-zinc-600 mt-2">
              {currentUser
                ? `All gift card activity for ${currentUser.name}`
                : "Please login to view history"}
            </p>
          </div>

          {/* ✅ NEW: 2 Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <Tooltip title="Send a new gift card to anyone">
              <Button
                type="primary"
                icon={<SendOutlined />}
                className="rounded-2xl"
                onClick={goSendGiftCard}
                disabled={actionsDisabled}
              >
                Send Gift Card
              </Button>
            </Tooltip>

            <Tooltip title="Claim a gift card you received">
              <Button
                icon={<InboxOutlined />}
                className="rounded-2xl"
                onClick={goClaimGiftCard}
                disabled={actionsDisabled}
              >
                Claim Gift Card
              </Button>
            </Tooltip>

            <div className="inline-flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-3 py-2 shadow-sm">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-900 text-white">
                <GiftOutlined />
              </span>
              <div className="leading-tight">
                <p className="text-xs text-zinc-500">Overview</p>
                <p className="text-sm font-semibold text-zinc-900">
                  {currentUser ? "Gift Wallet" : "Guest"}
                </p>
              </div>
            </div>
          </div>
        </div>

        <Spin spinning={loading} tip="Loading...">
          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
            <StatCard
              icon={<SendOutlined />}
              title="Cards Sent"
              value={sentCards.length}
              prefix=""
            />
            <StatCard
              icon={<GiftOutlined />}
              title="Active Cards"
              value={activeCount}
              prefix=""
            />
            <StatCard
              icon={<InboxOutlined />}
              title="Total Sent"
              value={totalSentAmount}
              prefix="৳"
            />
            <StatCard
              icon={<WalletOutlined />}
              title="Current Balance"
              value={parseFloat(currentUser?.balance || 0)}
              prefix="৳"
              highlight
            />
          </div>

          {/* Tabs */}
          <div className="rounded-3xl border border-zinc-100 bg-white shadow-sm overflow-hidden">
            <div className="px-5 pt-3">
              <Tabs items={tabItems} tabBarStyle={{ marginBottom: 0 }} />
            </div>
            <Divider className="m-0" />
          </div>

          {/* Received summary */}
          {totalReceivedAmount > 0 && (
            <div className="mt-4 text-right text-xs text-zinc-500">
              Total received & claimed:
              <strong className="text-zinc-800 ml-1">
                ৳{totalReceivedAmount.toFixed(2)}
              </strong>
            </div>
          )}
        </Spin>
      </div>

      <style>{`
        .gc-diagonal-pattern{
          background-image: repeating-linear-gradient(
            135deg,
            rgba(255,255,255,0.9) 0px,
            rgba(255,255,255,0.9) 1px,
            transparent 1px,
            transparent 14px
          );
        }
        .gc-soft-grid{
          background-image:
            linear-gradient(to right, rgba(0,0,0,0.04) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(0,0,0,0.04) 1px, transparent 1px);
          background-size: 28px 28px;
        }
      `}</style>
    </div>
  );
}
