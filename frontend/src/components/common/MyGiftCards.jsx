// src/pages/MyGiftCards.jsx
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Card,
  Tabs,
  Tag,
  Table,
  Empty,
  Spin,
  Tooltip,
  Popover,
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
import { normalizeImageUrl } from "../../utils/imageUrl";

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
function StatCard({ icon, title, value, prefix = "$", highlight = false }) {
  const displayValue =
    typeof value === "number"
      ? prefix
        ? `${value.toFixed(2)}`
        : `${value}`
      : value;

  return (
    <div className={`relative overflow-hidden rounded-3xl border border-zinc-100 shadow-sm hover:shadow-md transition-all duration-300 transform hover:-translate-y-1 ${highlight ? "bg-zinc-900" : "bg-white"}`}>
      <div className="absolute inset-0 -z-10 gc-soft-grid opacity-[0.24]" />
      {highlight && (
        <>
          <div className="absolute inset-0 -z-10 bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950" />
          <div className="absolute inset-0 -z-10 gc-diagonal-pattern opacity-[0.08]" />
          <div className="absolute -top-20 -right-20 h-56 w-56 rounded-full bg-fuchsia-500/20 blur-3xl -z-10" />
          <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-amber-500/15 blur-3xl -z-10" />
        </>
      )}

      <div className="p-5 sm:p-6">
        <div className="flex items-center gap-4">
          <div
            className={[
              "w-12 h-12 rounded-2xl flex items-center justify-center text-xl shrink-0 border shadow-sm",
              highlight
                ? "bg-white/10 border-white/20 text-white"
                : "bg-zinc-50 border-zinc-200 text-zinc-700",
            ].join(" ")}
          >
            {icon}
          </div>

          <div className="min-w-0 flex-1">
            <p
              className={[
                "text-[11px] sm:text-xs uppercase tracking-[0.18em] font-bold mb-1",
                highlight ? "text-white/60" : "text-zinc-500",
              ].join(" ")}
            >
              {title}
            </p>

            <div className="flex items-baseline gap-1">
              {typeof value === "number" && prefix ? (
                <span
                  className={[
                    "text-2xl sm:text-3xl font-black tracking-tight",
                    highlight ? "text-white" : "text-zinc-900",
                  ].join(" ")}
                >
                  <span className="text-lg font-bold mr-1">{prefix}</span>
                  {value.toFixed(2)}
                </span>
              ) : (
                <span
                  className={[
                    "text-2xl sm:text-3xl font-black tracking-tight",
                    highlight ? "text-white" : "text-zinc-900",
                  ].join(" ")}
                >
                  {displayValue}
                </span>
              )}
            </div>
          </div>

          {highlight && (
            <span className="hidden sm:inline-block text-[10px] uppercase font-bold tracking-wider px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white/90">
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
    <div className="px-5 py-4 bg-zinc-50 rounded-2xl space-y-4 text-sm text-zinc-700 border border-zinc-200/60 shadow-inner">
      <GiftCardVisual record={record} compact />
      {record.message && (
        <div className="flex items-start gap-3 bg-white p-3 rounded-xl border border-zinc-100">
          <MessageOutlined className="text-amber-500 mt-1 shrink-0 text-base" />
          <span className="italic text-zinc-600 font-medium">"{record.message}"</span>
        </div>
      )}
      <div className="flex flex-wrap gap-x-6 gap-y-2 pt-1">
        <span className="flex items-center gap-1.5 text-zinc-500 font-medium">
          <CalendarOutlined className="text-zinc-400" />
          Created: <span className="text-zinc-800">{new Date(record.createdAt).toLocaleDateString("en-GB")}</span>
        </span>
        {record.expiresAt && (
          <span className="flex items-center gap-1.5 text-zinc-500 font-medium">
            <CalendarOutlined className="text-zinc-400" />
            Expires: <span className="text-zinc-800">{new Date(record.expiresAt).toLocaleDateString("en-GB")}</span>
          </span>
        )}
        {record.claimedAt && (
          <span className="flex items-center gap-1.5 text-zinc-500 font-medium">
            <CalendarOutlined className="text-zinc-400" />
            Claimed: <span className="text-zinc-800">{new Date(record.claimedAt).toLocaleDateString("en-GB")}</span>
          </span>
        )}
      </div>
    </div>
  );
}

function GiftCardVisual({ record, compact = false }) {
  const status = STATUS_CONFIG[record.status] || STATUS_CONFIG.active;
  const amount = Number(record.amount || 0);
  const fromName = record.creator?.name || record.creatorName || "Gift Sender";
  const toLabel = record.recipientEmail || (record.claimer?.email ? record.claimer.email : "Manual share");

  return (
    <div className={`relative overflow-hidden rounded-3xl border border-white/10 bg-zinc-950 shadow-2xl ${compact ? "p-4" : "p-6"}`}>
      <div className="absolute inset-0 bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950" />
      <div className="absolute inset-0 gc-diagonal-pattern opacity-[0.12]" />
      <div className="absolute -top-20 -right-20 h-56 w-56 rounded-full bg-fuchsia-500/20 blur-3xl" />
      <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-amber-500/15 blur-3xl" />

      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-white/5 border border-white/10">
              <GiftOutlined className="text-white/80" />
            </span>
            <div className="leading-tight">
              <p className="text-xs uppercase tracking-[0.22em] text-white/50">
                GiftFlow
              </p>
              <p className="text-sm font-semibold text-white/90">
                Digital Gift Card
              </p>
            </div>
          </div>

          <span className="inline-flex items-center rounded-full bg-white/5 border border-white/10 px-3 py-1 text-xs text-white/70">
            {status.label}
          </span>
        </div>

        <div className="mt-6">
          <p className={`${compact ? "text-4xl" : "text-5xl"} font-extrabold tracking-tight text-white leading-none`}>
            ${amount.toFixed(2)}
          </p>

          {record.message ? (
            <div className="mt-4 rounded-2xl bg-white/5 border border-white/10 px-4 py-3">
              <p className="text-sm text-white/70 italic leading-relaxed">
                “{record.message}”
              </p>
            </div>
          ) : (
            <p className="mt-4 text-sm text-white/45">
              No message included.
            </p>
          )}
        </div>

        <div className="mt-5 flex items-end justify-between gap-4 flex-wrap">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-[0.18em] text-white/40">
              Code
            </span>
            <span className="inline-flex items-center gap-2 rounded-2xl bg-white/5 border border-white/10 px-4 py-2">
              <span className="font-mono text-xs sm:text-sm tracking-widest text-white/90">
                {record.code}
              </span>
              <span className="h-2 w-2 rounded-full bg-emerald-400/80" />
            </span>
          </div>

          <div className="text-right">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">
              From
            </p>
            <p className="text-sm font-medium text-white/80">
              {fromName}
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between text-xs text-white/50">
          <span>To: {toLabel}</span>
          <span>{new Date(record.createdAt).toLocaleDateString("en-GB")}</span>
        </div>

        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(255,255,255,0.10),transparent_45%)]" />
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
  const [isMobileView, setIsMobileView] = useState(false);

  // scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const onResize = () => setIsMobileView(window.innerWidth < 768);
    onResize();
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // redeem link builder
  const buildRedeemUrl = useCallback((code) => {
    const origin = window.location.origin;
    return `${origin}/gift-card/claim/redeem?code=${encodeURIComponent(code)}`;
  }, []);

  const copyToClipboard = useCallback(async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      message.success("Copied to clipboard!");
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
        <Tooltip title="Click to copy" placement="topLeft">
          <span 
            onClick={() => copyToClipboard(code)}
            className="font-mono text-sm font-extrabold bg-zinc-100 border border-zinc-200 px-3 py-1.5 rounded-lg text-zinc-800 whitespace-nowrap tracking-widest cursor-pointer hover:bg-zinc-200 transition-colors"
          >
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
        <span className="font-black text-zinc-900 text-base">
          ${parseFloat(amt).toFixed(2)}
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
        return (
          <Tag color={cfg.color} className="px-3 py-0.5 rounded-full font-semibold uppercase text-[10px] tracking-wider border-none">
            {cfg.label}
          </Tag>
        );
      },
    },
    {
      title: "Date",
      dataIndex: "createdAt",
      key: "createdAt",
      sorter: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
      render: (date) => (
        <span className="text-zinc-500 text-sm font-medium whitespace-nowrap">
          {new Date(date).toLocaleDateString("en-GB")}
        </span>
      ),
    },
  ];

  // Action column for sharing active cards
  const shareColumn = {
    title: "Share",
    key: "share",
    width: 250,
    render: (_, record) => {
      const isActive = record.status === "active";
      const redeemUrl = buildRedeemUrl(record.code);

      const waText = `Here is your gift card 🎁\nCode: ${record.code}\nRedeem: ${redeemUrl}`;
      const waLink = `https://wa.me/?text=${encodeURIComponent(waText)}`;

      return (
        <div className="flex items-center gap-2 flex-nowrap">
          <Tooltip title={isActive ? "Copy redeem link" : "Only active cards can be shared"}>
            <Button
              size="small"
              icon={<LinkOutlined />}
              className="rounded-lg border-zinc-200 hover:border-zinc-400"
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
              className="rounded-lg border-zinc-200 hover:border-zinc-400"
              onClick={() => copyToClipboard(record.code)}
            >
              Code
            </Button>
          </Tooltip>

          <Tooltip title={isActive ? "Share WhatsApp" : "Only active cards can be shared"}>
            <Button
              size="small"
              icon={<WhatsAppOutlined />}
              className="rounded-lg border-green-200 text-green-600 hover:border-green-400 hover:text-green-700 bg-green-50"
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
      render: (email) => (
        <span className="text-zinc-700 text-sm font-medium flex items-center gap-2 truncate max-w-[200px]">
          <MailOutlined className="shrink-0 text-zinc-400" /> {email || "Manual share"}
        </span>
      ),
    },
    ...baseColumns.slice(1, 3),
    {
      title: "Claimed By",
      key: "claimedBy",
      render: (_, record) => {
        if (record.status !== "claimed" || !record.claimer) {
          return <span className="text-xs text-zinc-400">—</span>;
        }
        return (
          <Popover
            title="Claimed By"
            content={
              <div className="text-xs space-y-1">
                <div className="font-semibold text-zinc-900">{record.claimer.name}</div>
                <div className="text-zinc-500">{record.claimer.email}</div>
                {record.claimedAt && (
                  <div className="text-zinc-500">
                    Claimed: {new Date(record.claimedAt).toLocaleDateString("en-GB")}
                  </div>
                )}
              </div>
            }
            trigger="click"
          >
            <Button size="small" type="link" className="px-0 font-semibold">
              View
            </Button>
          </Popover>
        );
      },
    },
    ...baseColumns.slice(3),
    shareColumn,
  ];

  // Received columns
  const receivedColumns = [
    ...baseColumns.slice(0, 1),
    {
      title: "From",
      key: "creator",
      render: (_, record) => (
        <span className="text-zinc-700 text-sm font-semibold flex items-center gap-2 truncate max-w-[240px]">
          {record.creator?.imageUrl ? (
            <img
              src={normalizeImageUrl(record.creator.imageUrl)}
              alt={record.creator?.name || "Sender"}
              className="h-6 w-6 rounded-full object-cover border border-zinc-200"
            />
          ) : (
            <span className="h-6 w-6 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center text-[10px] text-zinc-500">
              {String(record.creator?.name || record.creatorName || "G").slice(0, 1).toUpperCase()}
            </span>
          )}
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
        <span className="flex items-center gap-2 px-2 py-1 font-semibold">
          <SendOutlined />
          <span>Sent</span>
          <Badge count={sentCards.length} color="#18181b" size="small" />
        </span>
      ),
      children: isMobileView ? (
        <div className="space-y-3 p-2">
          {sentCards.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={<span className="text-zinc-500">You haven't sent any gift cards yet</span>}
            />
          ) : (
            sentCards.map((record) => (
              <div key={record.id} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm space-y-3">
                <GiftCardVisual record={record} />
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-zinc-400">Code</p>
                    <p className="font-mono text-sm font-bold tracking-widest text-zinc-900">
                      {record.code}
                    </p>
                  </div>
                  <Tag color={(STATUS_CONFIG[record.status] || STATUS_CONFIG.active).color} className="m-0">
                    {(STATUS_CONFIG[record.status] || STATUS_CONFIG.active).label}
                  </Tag>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <p className="text-xs text-zinc-500">Amount</p>
                  <p className="text-base font-black text-zinc-900">
                    ${parseFloat(record.amount).toFixed(2)}
                  </p>
                </div>

                <div className="mt-2 text-xs text-zinc-500">
                  {new Date(record.createdAt).toLocaleDateString("en-GB")}
                </div>

                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  <Button
                    size="small"
                    className="rounded-lg border-zinc-200"
                    onClick={() => copyToClipboard(record.code)}
                  >
                    Copy Code
                  </Button>
                  {record.status === "active" ? (
                    <Button
                      size="small"
                      className="rounded-lg border-zinc-200"
                      onClick={() => copyToClipboard(buildRedeemUrl(record.code))}
                    >
                      Copy Link
                    </Button>
                  ) : null}
                  {record.status === "claimed" && record.claimer ? (
                    <Popover
                      title="Claimed By"
                      content={
                        <div className="text-xs space-y-1">
                          <div className="font-semibold text-zinc-900">{record.claimer.name}</div>
                          <div className="text-zinc-500">{record.claimer.email}</div>
                          {record.claimedAt && (
                            <div className="text-zinc-500">
                              Claimed: {new Date(record.claimedAt).toLocaleDateString("en-GB")}
                            </div>
                          )}
                        </div>
                      }
                      trigger="click"
                    >
                      <Button size="small" type="link" className="px-0 font-semibold">
                        Claimed By
                      </Button>
                    </Popover>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="p-1">
          <Table
            columns={sentColumns}
            dataSource={sentCards}
            rowKey="id"
            pagination={{ pageSize: 8, hideOnSinglePage: true, size: "small" }}
            scroll={{ x: 'max-content' }} // <-- Critical for mobile responsiveness
            expandable={{
              expandedRowRender: (record) => <ExpandedRow record={record} />,
              rowExpandable: (record) =>
                !!(record.message || record.expiresAt || record.claimedAt),
            }}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={<span className="text-zinc-500">You haven't sent any gift cards yet</span>}
                />
              ),
            }}
            className="rounded-xl overflow-hidden"
            size="middle"
          />
        </div>
      ),
    },
    {
      key: "received",
      label: (
        <span className="flex items-center gap-2 px-2 py-1 font-semibold">
          <InboxOutlined />
          <span>Received</span>
          <Badge count={receivedCards.length} color="#c9a840" size="small" />
        </span>
      ),
      children: isMobileView ? (
        <div className="space-y-3 p-2">
          {receivedCards.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={<span className="text-zinc-500">No gift cards received yet</span>}
            />
          ) : (
            receivedCards.map((record) => (
              <div key={record.id} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm space-y-3">
                <div className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2">
                  {record.creator?.imageUrl ? (
                    <img
                      src={normalizeImageUrl(record.creator.imageUrl)}
                      alt={record.creator?.name || "Sender"}
                      className="h-9 w-9 rounded-full object-cover border border-zinc-200"
                    />
                  ) : (
                    <span className="h-9 w-9 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center text-xs text-zinc-500">
                      {String(record.creator?.name || record.creatorName || "G").slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-wider text-zinc-400">From</p>
                    <p className="text-sm font-semibold text-zinc-900 truncate">
                      {record.creator?.name || record.creatorName || "—"}
                    </p>
                  </div>
                </div>

                <GiftCardVisual record={record} />
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-zinc-400">Code</p>
                    <p className="font-mono text-sm font-bold tracking-widest text-zinc-900">
                      {record.code}
                    </p>
                  </div>
                  <Tag color={(STATUS_CONFIG[record.status] || STATUS_CONFIG.active).color} className="m-0">
                    {(STATUS_CONFIG[record.status] || STATUS_CONFIG.active).label}
                  </Tag>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <p className="text-xs text-zinc-500">Amount</p>
                  <p className="text-base font-black text-zinc-900">
                    ${parseFloat(record.amount).toFixed(2)}
                  </p>
                </div>

                <div className="mt-2 text-xs text-zinc-500">
                  {record.creator?.name || record.creatorName || "—"}
                </div>

                <div className="mt-2 text-xs text-zinc-500">
                  {new Date(record.createdAt).toLocaleDateString("en-GB")}
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="p-1">
          <Table
            columns={receivedColumns}
            dataSource={receivedCards}
            rowKey="id"
            pagination={{ pageSize: 8, hideOnSinglePage: true, size: "small" }}
            scroll={{ x: 'max-content' }} // <-- Critical for mobile responsiveness
            expandable={{
              expandedRowRender: (record) => <ExpandedRow record={record} />,
              rowExpandable: (record) =>
                !!(record.message || record.expiresAt || record.claimedAt),
            }}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={<span className="text-zinc-500">No gift cards received yet</span>}
                />
              ),
            }}
            className="rounded-xl overflow-hidden"
            size="middle"
          />
        </div>
      ),
    },
  ];

  const actionsDisabled = !currentUser || !token;

  return (
    <div className="relative min-h-screen">
      {/* Background styling */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-zinc-50 via-white to-zinc-50" />
      <div className="absolute inset-0 -z-10 gc-soft-grid opacity-[0.28]" />

      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        
        {/* Responsive Header Section */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10">
          <div>
            <h1 className="text-3xl sm:text-4xl font-black text-zinc-900 tracking-tight">
              My Gift Cards
            </h1>
            <p className="text-zinc-500 mt-2 text-sm sm:text-base font-medium">
              {currentUser
                ? `Manage and track your gift card activity, ${currentUser.name}`
                : "Please login to view your history"}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            {/* Overview Badge - Hidden on very small screens for better button layout */}
            <div className="hidden sm:inline-flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-2.5 shadow-sm">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-900 text-white shadow-sm">
                <GiftOutlined />
              </span>
              <div className="leading-tight pr-2">
                <p className="text-[10px] uppercase font-bold tracking-wider text-zinc-400">Overview</p>
                <p className="text-sm font-black text-zinc-900">
                  {currentUser ? "Gift Wallet" : "Guest"}
                </p>
              </div>
            </div>

            <Tooltip title="Claim a gift card you received">
              <Button
                size="large"
                className="rounded-2xl font-semibold shadow-sm border-zinc-200"
                onClick={goClaimGiftCard}
                disabled={actionsDisabled}
              >
                Claim Card
              </Button>
            </Tooltip>

            <Tooltip title="Send a new gift card to anyone">
              <Button
                type="primary"
                size="large"
                className="rounded-2xl font-semibold shadow-md bg-zinc-900 hover:bg-zinc-800"
                onClick={goSendGiftCard}
                disabled={actionsDisabled}
                icon={<SendOutlined />}
              >
                Send Gift Card
              </Button>
            </Tooltip>
          </div>
        </div>

        <Spin spinning={loading} tip="Loading your wallet...">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6 mb-10">
            <StatCard
              icon={<SendOutlined className="text-blue-500" />}
              title="Cards Sent"
              value={sentCards.length}
              prefix=""
            />
            <StatCard
              icon={<GiftOutlined className="text-emerald-500" />}
              title="Active Cards"
              value={activeCount}
              prefix=""
            />
            <StatCard
              icon={<InboxOutlined className="text-amber-500" />}
              title="Total Sent"
              value={totalSentAmount}
              prefix="$"
            />
            <StatCard
              icon={<WalletOutlined />}
              title="Current Balance"
              value={parseFloat(currentUser?.balance || 0)}
              prefix="$"
              highlight
            />
          </div>

          {/* Tabs Container */}
          <div className="rounded-3xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
            <div className="px-2 sm:px-6 pt-4">
              <Tabs 
                items={tabItems} 
                tabBarStyle={{ marginBottom: 0 }} 
                className="gc-custom-tabs"
              />
            </div>
          </div>

          {/* Received summary footer */}
          {totalReceivedAmount > 0 && (
            <div className="mt-6 flex justify-end items-center gap-2 text-sm text-zinc-500 font-medium bg-zinc-100/50 py-3 px-5 rounded-2xl w-max ml-auto border border-zinc-200/60">
              Total received & claimed:
              <strong className="text-zinc-900 text-base font-black tracking-tight">
                ${totalReceivedAmount.toFixed(2)}
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
            linear-gradient(to right, rgba(0,0,0,0.03) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(0,0,0,0.03) 1px, transparent 1px);
          background-size: 32px 32px;
        }
        /* Custom Tab Styling for Ant Design */
        .gc-custom-tabs .ant-tabs-nav::before {
          border-bottom: 1px solid #f4f4f5; 
        }
        .gc-custom-tabs .ant-tabs-tab {
          padding: 12px 0;
          transition: all 0.3s;
        }
        .gc-custom-tabs .ant-tabs-tab-active .ant-tabs-tab-btn {
          color: #18181b !important;
        }
        .gc-custom-tabs .ant-tabs-ink-bar {
          background: #18181b;
          height: 3px !important;
          border-radius: 3px 3px 0 0;
        }
      `}</style>
    </div>
  );
}
