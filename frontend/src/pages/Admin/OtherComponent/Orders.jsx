import React, { useEffect, useMemo, useState } from "react";
import { Drawer, Grid, message as antdMessage } from "antd";
import { useSelector } from "react-redux";
import { API_BASE_URL } from "../../../config/env";
import { normalizeImageUrl } from "../../../utils/imageUrl";

const BASE_URL = API_BASE_URL;
const STATUS_FLOW = ["pending", "processing", "shipped", "delivered"];
const TERMINAL = new Set(["delivered", "cancelled"]);
const ALL_STATUSES = ["pending", "processing", "shipped", "delivered", "cancelled"];

const statusLabel = (s) =>
  ({ pending: "Pending", processing: "Processing", shipped: "Shipped", delivered: "Delivered", cancelled: "Cancelled" }[s] || s);

function statusPillClasses(s) {
  switch (s) {
    case "pending":     return "border-amber-200 bg-amber-50 text-amber-700";
    case "processing":  return "border-blue-200 bg-blue-50 text-blue-700";
    case "shipped":     return "border-violet-200 bg-violet-50 text-violet-700";
    case "delivered":   return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "cancelled":   return "border-red-200 bg-red-50 text-red-700";
    default:            return "border-gray-200 bg-gray-50 text-gray-600";
  }
}

function getAllowedNextStatuses(currentStatus) {
  if (TERMINAL.has(currentStatus)) return [];
  const idx = STATUS_FLOW.indexOf(currentStatus);
  const next = [];
  if (idx >= 0 && idx < STATUS_FLOW.length - 1) next.push(STATUS_FLOW[idx + 1]);
  if (currentStatus === "pending" || currentStatus === "processing") next.push("cancelled");
  return next;
}

function timeAgo(input) {
  if (!input) return "-";
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return "-";
  const diffMs = Date.now() - d.getTime();
  if (diffMs < 0) return "just now";
  const sec = Math.floor(diffMs / 1000);
  if (sec < 10) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

function getOrderTimeRow(o) {
  return o?.createdAt || o?.updatedAt || o?.created_at || o?.updated_at || null;
}

async function apiGetOrders({ page, limit, q, status, signal, token } = {}) {
  const params = new URLSearchParams();
  params.set("page", String(page || 1));
  params.set("limit", String(limit || 20));
  if (q && q.trim()) params.set("q", q.trim());
  if (status && status !== "all") params.set("status", status);
  const res = await fetch(`${BASE_URL}/api/admin/orders?${params.toString()}`, {
    signal,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const ct = res.headers.get("content-type") || "";
  const isJson = ct.includes("application/json");
  const payload = isJson ? await res.json().catch(() => ({})) : await res.text().catch(() => "");
  if (!res.ok) throw new Error(payload?.message || payload || "Failed to fetch orders");
  return payload;
}

async function apiUpdateStatus(orderId, payload, token) {
  const res = await fetch(`${BASE_URL}/api/admin/orders/${orderId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(payload),
  });
  const ct = res.headers.get("content-type") || "";
  const isJson = ct.includes("application/json");
  const responseData = isJson ? await res.json().catch(() => ({})) : await res.text().catch(() => "");
  if (!res.ok) throw new Error(responseData?.message || responseData || `Failed (HTTP ${res.status})`);
  return responseData;
}

async function apiGetOrderDetails(orderId, { signal, token } = {}) {
  const res = await fetch(`${BASE_URL}/api/admin/orders/${orderId}/details`, {
    signal,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const ct = res.headers.get("content-type") || "";
  const isJson = ct.includes("application/json");
  const payload = isJson ? await res.json().catch(() => ({})) : await res.text().catch(() => "");
  if (!res.ok) throw new Error(payload?.message || payload || "Failed to load order details");
  return payload;
}

function Spinner({ className = "h-4 w-4" }) {
  return (
    <span className={`inline-block ${className} animate-spin rounded-full border-2 border-gray-300 border-t-gray-700`} />
  );
}

function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

// ─── Status badge chip for filter tabs ───
function StatusTab({ value, active, count, onClick }) {
  const colors = {
    all:        active ? "bg-gray-900 text-white border-gray-900" : "border-gray-200 text-gray-600 hover:border-gray-400",
    pending:    active ? "bg-amber-500 text-white border-amber-500" : "border-amber-200 text-amber-700 hover:border-amber-400",
    processing: active ? "bg-blue-600 text-white border-blue-600" : "border-blue-200 text-blue-700 hover:border-blue-400",
    shipped:    active ? "bg-violet-600 text-white border-violet-600" : "border-violet-200 text-violet-700 hover:border-violet-400",
    delivered:  active ? "bg-emerald-600 text-white border-emerald-600" : "border-emerald-200 text-emerald-700 hover:border-emerald-400",
    cancelled:  active ? "bg-red-600 text-white border-red-600" : "border-red-200 text-red-700 hover:border-red-400",
  };
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all duration-150 md:gap-1.5 md:px-3 md:py-1.5 md:text-xs ${colors[value] || colors.all}`}
    >
      {value === "all" ? "All" : statusLabel(value)}
    </button>
  );
}

export default function Orders() {
  const reduxToken = useSelector((s) => s.auth?.token);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(0);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [draftStatusById, setDraftStatusById] = useState({});
  const [draftTrackingNumberById, setDraftTrackingNumberById] = useState({});
  const [draftTrackingNoteById, setDraftTrackingNoteById] = useState({});
  const [groupDraftStatusByKey, setGroupDraftStatusByKey] = useState({});
  const [groupTrackingNumberByKey, setGroupTrackingNumberByKey] = useState({});
  const [groupTrackingNoteByKey, setGroupTrackingNoteByKey] = useState({});
  const [groupUpdatingKey, setGroupUpdatingKey] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [details, setDetails] = useState(null);
  const [detailsError, setDetailsError] = useState("");
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const token = useMemo(() => {
    if (reduxToken) return reduxToken;
    try { return JSON.parse(localStorage.getItem("userInfo") || "null")?.token || null; }
    catch { return null; }
  }, [reduxToken]);

  const pages = useMemo(() => Math.max(1, Math.ceil((count || 0) / (limit || 20))), [count, limit]);
  const userOrderCountMap = useMemo(() =>
    rows.reduce((acc, row) => {
      const key = String(row?.userId || "unknown");
      acc[key] = Number(acc[key] || 0) + 1;
      return acc;
    }, {}), [rows]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const r of rows) {
      const rawKey = String(r.orderGroupId || r.id);
      const key = rawKey.includes(":") ? rawKey.split(":")[0] : rawKey;
      if (!map.has(key)) {
        map.set(key, { key, items: [], totalQty: 0, totalAmount: 0, createdAt: r.createdAt });
      }
      const g = map.get(key);
      g.items.push(r);
      g.totalQty += Number(r.quantity || 0);
      g.totalAmount += Number(r.price || 0) * Number(r.quantity || 0) + Number(r.deliveryCharge || 0);
      if (r.createdAt && (!g.createdAt || new Date(r.createdAt) < new Date(g.createdAt))) {
        g.createdAt = r.createdAt;
      }
    }
    return Array.from(map.values());
  }, [rows]);

  const showToast = (type, text) => {
    if (!text) return;
    if (type === "success") return antdMessage.success(text);
    if (type === "warn") return antdMessage.warning(text);
    return antdMessage.error(text);
  };

  const getGroupAllowed = (items = []) => {
    if (!items.length) return [];
    const lists = items.map((r) => getAllowedNextStatuses(r.status));
    return lists.reduce((acc, list) => acc.filter((s) => list.includes(s)), lists[0] || []);
  };

  useEffect(() => { setPage(1); }, [q, statusFilter, limit]);

  const load = async ({ useSignal = true, silent = false } = {}) => {
    const controller = useSignal ? new AbortController() : null;
    if (!silent) setLoading(true);
    try {
      const data = await apiGetOrders({ page, limit, q, status: statusFilter, signal: controller?.signal, token });
      setRows(Array.isArray(data?.rows) ? data.rows : Array.isArray(data) ? data : []);
      setCount(Number(data?.count || 0));
    } catch (e) {
      if (String(e?.name) !== "AbortError") showToast("error", e.message || "Order load failed");
    } finally { if (!silent) setLoading(false); }
    return () => controller?.abort?.();
  };

  useEffect(() => {
    let cleanup = null;
    (async () => { cleanup = await load(); })();
    return () => cleanup?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, statusFilter, token]);

  const applySearch = () => { setPage(1); load({ useSignal: false }); };
  const clearSearch = () => { setQ(""); setPage(1); load({ useSignal: false }); };
  const handleChangeDraft = (orderId, nextStatus) => setDraftStatusById((prev) => ({ ...prev, [orderId]: nextStatus }));
  const handleTrackingNumberChange = (orderId, value) =>
    setDraftTrackingNumberById((prev) => ({ ...prev, [orderId]: value }));
  const handleTrackingNoteChange = (orderId, value) =>
    setDraftTrackingNoteById((prev) => ({ ...prev, [orderId]: value }));

  const handleGroupChangeDraft = (groupKey, nextStatus) =>
    setGroupDraftStatusByKey((prev) => ({ ...prev, [groupKey]: nextStatus }));
  const handleGroupTrackingNumberChange = (groupKey, value) =>
    setGroupTrackingNumberByKey((prev) => ({ ...prev, [groupKey]: value }));
  const handleGroupTrackingNoteChange = (groupKey, value) =>
    setGroupTrackingNoteByKey((prev) => ({ ...prev, [groupKey]: value }));

  const handleGroupUpdate = async (group) => {
    const nextStatus = groupDraftStatusByKey[group.key];
    if (!nextStatus) return showToast("warn", "Please select a status for the group");
    const allowed = getGroupAllowed(group.items);
    if (!allowed.includes(nextStatus)) {
      return showToast("error", `Invalid transition for group. Allowed: ${allowed.map(statusLabel).join(", ") || "None"}`);
    }
    const trackingNumber = String(groupTrackingNumberByKey[group.key] || "").trim();
    const trackingNote = String(groupTrackingNoteByKey[group.key] || "").trim();
    const payload = { status: nextStatus };
    if (nextStatus === "processing" || nextStatus === "shipped") {
      if (trackingNumber) payload.trackingNumber = trackingNumber;
      if (trackingNote) payload.trackingNote = trackingNote;
    }
    setGroupUpdatingKey(group.key);
    try {
      for (const row of group.items) {
        await apiUpdateStatus(row.id, payload, token);
      }
      showToast("success", "Group status updated ✅");
      setGroupDraftStatusByKey((prev) => { const n = { ...prev }; delete n[group.key]; return n; });
      setGroupTrackingNumberByKey((prev) => { const n = { ...prev }; delete n[group.key]; return n; });
      setGroupTrackingNoteByKey((prev) => { const n = { ...prev }; delete n[group.key]; return n; });
      load({ useSignal: false, silent: true });
    } catch (e) {
      showToast("error", e.message || "Group update failed");
    } finally {
      setGroupUpdatingKey(null);
    }
  };

  const handleUpdate = async (order) => {
    const orderId = order.id;
    const nextStatus = draftStatusById[orderId];
    if (!nextStatus) return showToast("warn", "Please select a status first");
    const allowed = getAllowedNextStatuses(order.status);
    if (!allowed.includes(nextStatus)) return showToast("error", `Invalid transition. Allowed: ${allowed.map(statusLabel).join(", ") || "None"}`);
    const trackingNumber = String(draftTrackingNumberById[orderId] || "").trim();
    const trackingNote = String(draftTrackingNoteById[orderId] || "").trim();
    const payload = { status: nextStatus };
    if (nextStatus === "processing" || nextStatus === "shipped") {
      if (trackingNumber) payload.trackingNumber = trackingNumber;
      if (trackingNote) payload.trackingNote = trackingNote;
    }
    setUpdatingId(orderId);
    try {
      await apiUpdateStatus(orderId, payload, token);
      setRows((prev) =>
        prev
          .map((r) =>
            String(r.id) === String(orderId)
              ? {
                  ...r,
                  status: nextStatus,
                  trackingNumber: payload.trackingNumber || r.trackingNumber || null,
                  trackingNote: payload.trackingNote || r.trackingNote || null,
                }
              : r
          )
          .filter((r) => statusFilter === "all" || r.status === statusFilter)
      );
      if (statusFilter !== "all" && nextStatus !== statusFilter) {
        setCount((c) => Math.max(0, Number(c || 0) - 1));
      }
      setDetails((prev) => {
        if (!prev) return prev;
        const currentDetailsId = prev?.order?.id || prev?.id;
        if (String(currentDetailsId) !== String(orderId)) return prev;
        if (prev.order) {
          return {
            ...prev,
            order: {
              ...prev.order,
              status: nextStatus,
              trackingNumber: payload.trackingNumber || prev.order.trackingNumber || null,
              trackingNote: payload.trackingNote || prev.order.trackingNote || null,
            },
          };
        }
        return {
          ...prev,
          status: nextStatus,
          trackingNumber: payload.trackingNumber || prev.trackingNumber || null,
          trackingNote: payload.trackingNote || prev.trackingNote || null,
        };
      });
      showToast("success", "Status updated ✅");
      load({ useSignal: false, silent: true });
      setDraftStatusById((prev) => { const n = { ...prev }; delete n[orderId]; return n; });
      setDraftTrackingNumberById((prev) => { const n = { ...prev }; delete n[orderId]; return n; });
      setDraftTrackingNoteById((prev) => { const n = { ...prev }; delete n[orderId]; return n; });
    } catch (e) { showToast("error", e.message || "Status update failed"); }
    finally { setUpdatingId(null); }
  };

  const openDetails = async (orderId) => {
    setDetailsOpen(true); setDetails(null); setDetailsError(""); setDetailsLoading(true);
    try { setDetails(await apiGetOrderDetails(orderId, { token })); }
    catch (e) { setDetailsError(e.message || "Failed to load details"); }
    finally { setDetailsLoading(false); }
  };

  const closeDetails = () => { setDetailsOpen(false); setDetails(null); setDetailsError(""); setDetailsLoading(false); };

  const from = count === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, count || 0);
  const goPage = (p) => setPage(clamp(p, 1, pages));

  return (
    <div className="mx-auto w-full max-w-6xl px-2 py-3 sm:px-4 sm:py-5">

      {/* ── Header ── */}
      <div className="mb-4 flex items-start justify-between gap-2">
        {/* <div className="min-w-0">
          <h2 className="text-base font-semibold text-gray-900">Order Manager</h2>
          <p className="text-xs text-gray-400 mt-0.5">Server-side pagination · safe for 50k+ rows</p>
        </div> */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setShowMobileFilters((v) => !v)}
            className="inline-flex h-7 items-center rounded-md border border-gray-200 bg-white px-2 text-[11px] font-medium text-gray-600 md:hidden"
          >
            {showMobileFilters ? "Hide" : "Filters"}
          </button>
          <button
            onClick={() => load({ useSignal: false })}
            disabled={loading}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-gray-200 bg-white px-2.5 text-[11px] font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-60 transition md:h-8 md:gap-1.5 md:px-3 md:text-xs"
          >
            {loading ? <><Spinner className="h-3.5 w-3.5" /> Refreshing...</> : (
              <><svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>Refresh</>
            )}
          </button>
        </div>
      </div>

      {/* Compact Toolbar */}
      <div className={`mb-4 rounded-xl border border-gray-100 bg-white shadow-sm ${showMobileFilters ? "block" : "hidden"} md:block`}>

        {/* Row 1: Search + Per page */}
        <div className="border-b border-gray-100 px-3 py-2.5">
          <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-gray-400 md:hidden">Search & Page Size</div>
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            {/* Search */}
            <div className="relative flex-1">
              <svg className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
              </svg>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applySearch()}
                placeholder="Search order ID or product..."
                className="h-8 w-full rounded-md border border-gray-200 pl-8 pr-3 text-[11px] outline-none transition focus:border-gray-400 focus:ring-2 focus:ring-gray-100 md:text-xs"
              />
              {q && (
                <button onClick={clearSearch} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-600 transition">
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            <button
              onClick={applySearch}
              className="h-8 rounded-md bg-gray-900 px-3 text-[11px] font-semibold text-white hover:bg-gray-700 transition md:shrink-0 md:text-xs"
            >
              Search
            </button>

            <div className="hidden md:block mx-1 h-5 w-px bg-gray-200" />

            {/* Per page */}
            <div className="flex items-center justify-between gap-2 rounded-md border border-gray-100 bg-gray-50 px-2 py-1.5 md:border-0 md:bg-transparent md:p-0 shrink-0">
              <span className="text-[11px] text-gray-500 md:text-xs md:text-gray-400">Per page</span>
              <select
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value) || 20)}
                className="h-8 rounded-md border border-gray-200 bg-white pl-2 pr-6 text-[11px] outline-none transition focus:border-gray-400 md:text-xs"
              >
                {[10, 20, 50, 100, 200].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Row 2: Status tabs */}
        <div className="px-3 py-2.5">
          <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-gray-400 md:hidden">Filter by Status</div>
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
            {["all", ...ALL_STATUSES].map((s) => (
              <StatusTab
                key={s}
                value={s}
                active={statusFilter === s}
                onClick={() => setStatusFilter(s)}
              />
            ))}
          </div>
        </div>
      </div>
      {/* ── Meta + Pagination ── */}
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs text-gray-500">
          {count ? <><b className="text-gray-800">{from}–{to}</b> of <b className="text-gray-800">{count}</b> orders</> : "No orders found"}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { label: "«", action: () => goPage(1), disabled: page <= 1 },
            { label: "‹", action: () => goPage(page - 1), disabled: page <= 1 },
          ].map(({ label, action, disabled }) => (
            <button key={label} onClick={action} disabled={disabled || loading}
              className="h-6 w-6 rounded border border-gray-200 bg-white text-[11px] font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition md:h-7 md:w-7 md:text-xs">
              {label}
            </button>
          ))}

          <div className="flex h-6 items-center gap-1 rounded border border-gray-200 bg-white px-2 text-[11px] md:h-7 md:px-2.5 md:text-xs">
            <b>{page}</b><span className="text-gray-300">/</span><span className="text-gray-500">{pages}</span>
          </div>

          {[
            { label: "›", action: () => goPage(page + 1), disabled: page >= pages },
            { label: "»", action: () => goPage(pages), disabled: page >= pages },
          ].map(({ label, action, disabled }) => (
            <button key={label} onClick={action} disabled={disabled || loading}
              className="h-6 w-6 rounded border border-gray-200 bg-white text-[11px] font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition md:h-7 md:w-7 md:text-xs">
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Table/Cards ── */}
      <div className="relative">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/70 backdrop-blur-[2px]">
            <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs font-medium shadow-sm">
              <Spinner className="h-3.5 w-3.5" /> Loading…
            </div>
          </div>
        )}

        {/* Mobile Cards */}
        <div className="grid grid-cols-1 gap-2.5 md:hidden">
          {rows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-white p-6 text-center text-sm text-gray-400">No orders found</div>
          ) : grouped.map((g) => (
            <div
              key={g.key}
              className={`space-y-2 ${
                g.items.length > 1
                  ? "rounded-2xl border-2 border-indigo-300 bg-indigo-50/70 p-3 shadow-[0_2px_10px_rgba(99,102,241,0.08)] mb-4"
                  : ""
              }`}
            >
              {g.items.length > 1 ? (
                <div className="rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs text-gray-600">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 border border-indigo-200">
                        Same Cart Group
                      </span>{" "}
                      Group: <b title={g.key}>{g.key.slice(0, 8)}</b> · User: <b>{g.items[0]?.userId ?? "-"}</b> · {timeAgo(g.createdAt)}
                      {" "}· Items: <b>{g.items.length}</b> · Qty: <b>{g.totalQty}</b>
                    </div>
                    <div>Total: <b>${Number(g.totalAmount || 0).toFixed(2)}</b></div>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <select
                      value={groupDraftStatusByKey[g.key] || ""}
                      onChange={(e) => handleGroupChangeDraft(g.key, e.target.value)}
                      className="h-8 rounded-md border border-gray-200 bg-white px-2 text-[11px] outline-none w-36"
                    >
                      <option value="">Set group status</option>
                      {getGroupAllowed(g.items).map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
                    </select>
                    <button
                      type="button"
                      onClick={() => handleGroupUpdate(g)}
                      disabled={!groupDraftStatusByKey[g.key] || groupUpdatingKey === g.key}
                      className="inline-flex h-8 items-center gap-1 rounded-md bg-gray-900 px-2.5 text-[11px] font-semibold text-white hover:bg-gray-700 disabled:opacity-50 transition"
                    >
                      {groupUpdatingKey === g.key ? <><Spinner className="h-3.5 w-3.5 border-gray-500 border-t-white" />…</> : "Update All"}
                    </button>
                  </div>
                </div>
              ) : null}
              {g.items.map((row) => {
                const current = row.status;
                const allowed = getAllowedNextStatuses(current);
                const locked = TERMINAL.has(current);
                const draft = draftStatusById[row.id];
                const t = getOrderTimeRow(row);
                return (
                  <div
                    key={row.id}
                    onClick={() => openDetails(row.id)}
                    className={`cursor-pointer rounded-xl border border-gray-100 bg-white p-3.5 shadow-sm transition hover:shadow-md active:scale-[0.99] ${
                      g.items.length > 1 ? "border-l-4 border-indigo-400" : ""
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {row.imageUrl
                        ? <img src={normalizeImageUrl(row.imageUrl)} alt={row.name} className="h-11 w-11 shrink-0 rounded-lg border object-cover" />
                        : <div className="h-11 w-11 shrink-0 rounded-lg border bg-gray-50" />}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <span className="line-clamp-2 break-words text-sm font-semibold text-gray-900 max-w-[240px]">
                            #{row.id} — {row.name}
                          </span>
                          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${statusPillClasses(current)}`}>
                            {statusLabel(current)}
                          </span>
                        </div>
                        <div className="mt-0.5 text-xs text-gray-400">
                          UID:{row.userId} · Qty:{row.quantity} · ${row.price} · {timeAgo(t)}
                          {Number(userOrderCountMap[String(row.userId)] || 0) > 1 && (
                            <span className="ml-1.5 font-semibold text-blue-600">×{userOrderCountMap[String(row.userId)]}</span>
                          )}
                        </div>
                        {row.trackingNumber ? (
                          <div className="mt-1 text-[11px] text-indigo-700">
                            Tracking: <b>{row.trackingNumber}</b>
                            {row.trackingNote ? <span className="text-gray-600"> ({row.trackingNote})</span> : null}
                          </div>
                        ) : null}
                        <div className="mt-2.5 flex gap-1.5 sm:gap-2">
                          <select value={draft || ""} onClick={(e) => e.stopPropagation()}
                            onChange={(e) => handleChangeDraft(row.id, e.target.value)}
                            disabled={locked || allowed.length === 0}
                            className="h-8 min-w-0 flex-1 rounded-md border border-gray-200 bg-white px-2 text-[11px] outline-none disabled:opacity-50 md:text-xs">
                            <option value="">{locked ? "Locked" : "Next status"}</option>
                            {allowed.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
                          </select>
                          <button type="button" onClick={(e) => { e.stopPropagation(); handleUpdate(row); }}
                            disabled={locked || !draft || updatingId === row.id}
                            className="inline-flex h-8 items-center gap-1 rounded-md bg-gray-900 px-2.5 text-[11px] font-semibold text-white hover:bg-gray-700 disabled:opacity-50 transition md:gap-1.5 md:px-3 md:text-xs">
                            {updatingId === row.id ? <><Spinner className="h-3.5 w-3.5 border-gray-500 border-t-white" />…</> : "Update"}
                          </button>
                        </div>
                        {draft === "processing" && !row.trackingNumber ? (
                          <div className="mt-2 grid grid-cols-1 gap-1.5">
                            <input
                              value={draftTrackingNumberById[row.id] || ""}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => handleTrackingNumberChange(row.id, e.target.value)}
                              placeholder="Tracking number (optional)"
                              className="h-8 rounded-md border border-indigo-200 px-2 text-[11px] outline-none focus:border-indigo-400"
                            />
                            <input
                              value={draftTrackingNoteById[row.id] || ""}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => handleTrackingNoteChange(row.id, e.target.value)}
                              placeholder="Tracking note (optional)"
                              className="h-8 rounded-md border border-gray-200 px-2 text-[11px] outline-none focus:border-gray-400"
                            />
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block">
          <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-[900px] w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/70 text-xs font-semibold uppercase tracking-wide text-gray-400">
                    <Th>Order</Th>
                    <Th>Status</Th>
                    <Th>Action</Th>
                    <Th>Time</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {rows.length === 0 ? (
                      <tr><td colSpan={4} className="p-8 text-center text-sm text-gray-400">No orders found</td></tr>
                  ) : grouped.flatMap((g) => {
                    const groupHeader = g.items.length > 1
                      ? [
                          <tr key={`g-${g.key}`} className="bg-indigo-50/70">
                            <td colSpan={4} className="px-4 py-2 text-xs text-gray-600">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                  <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 border border-indigo-200">
                                    Same Cart Group
                                  </span>{" "}
                                  Group: <b title={g.key}>{g.key.slice(0, 8)}</b> · User: <b>{g.items[0]?.userId ?? "-"}</b> · {timeAgo(g.createdAt)}
                                  {" "}· Items: <b>{g.items.length}</b> · Qty: <b>{g.totalQty}</b> · Total: <b>${Number(g.totalAmount || 0).toFixed(2)}</b>
                                </div>
                                <div className="flex items-center gap-2">
                                  <select
                                    value={groupDraftStatusByKey[g.key] || ""}
                                    onChange={(e) => handleGroupChangeDraft(g.key, e.target.value)}
                                    className="h-8 rounded-md border border-gray-200 bg-white px-2 text-[11px] outline-none w-36"
                                  >
                                    <option value="">Set group status</option>
                                    {getGroupAllowed(g.items).map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
                                  </select>
                                  <button
                                    type="button"
                                    onClick={() => handleGroupUpdate(g)}
                                    disabled={!groupDraftStatusByKey[g.key] || groupUpdatingKey === g.key}
                                    className="inline-flex h-8 items-center gap-1 rounded-md bg-gray-900 px-2.5 text-[11px] font-semibold text-white hover:bg-gray-700 disabled:opacity-50 transition"
                                  >
                                    {groupUpdatingKey === g.key ? <><Spinner className="h-3.5 w-3.5 border-gray-500 border-t-white" />…</> : "Update All"}
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>,
                        ]
                      : [];
                    return [
                      ...groupHeader,
                      ...g.items.map((row) => {
                        const current = row.status;
                        const allowed = getAllowedNextStatuses(current);
                        const locked = TERMINAL.has(current);
                        const draft = draftStatusById[row.id];
                        const t = getOrderTimeRow(row);
                        return (
                          <tr key={row.id} onClick={() => openDetails(row.id)}
                            className={`cursor-pointer transition-colors hover:bg-gray-50/60 ${g.items.length > 1 ? "border-l-4 border-indigo-300" : ""}`}>
                            <Td>
                              <div className="flex items-center gap-3">
                                {row.imageUrl
                                  ? <img src={normalizeImageUrl(row.imageUrl)} alt={row.name} className="h-9 w-9 shrink-0 rounded-lg border object-cover" />
                                  : <div className="h-9 w-9 shrink-0 rounded-lg border bg-gray-50" />}
                                <div className="min-w-0">
                                  <div className="line-clamp-2 break-words font-semibold text-gray-900 max-w-[360px]">
                                    #{row.id} — {row.name}
                                  </div>
                                  <div className="mt-0.5 text-xs text-gray-400">
                                    UID:{row.userId} · Qty:{row.quantity} · ${row.price}
                                    {Number(userOrderCountMap[String(row.userId)] || 0) > 1 && (
                                      <span className="ml-1.5 font-semibold text-blue-600">×{userOrderCountMap[String(row.userId)]}</span>
                                    )}
                                  </div>
                                  {row.trackingNumber ? (
                                    <div className="mt-1 text-[11px] text-indigo-700">
                                      Tracking: <b>{row.trackingNumber}</b>
                                      {row.trackingNote ? <span className="text-gray-600"> ({row.trackingNote})</span> : null}
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            </Td>
                            <Td>
                              <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${statusPillClasses(current)}`}>
                                {statusLabel(current)}
                              </span>
                            </Td>
                            <Td onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center gap-2">
                                <select value={draft || ""} onChange={(e) => handleChangeDraft(row.id, e.target.value)}
                                  disabled={locked || allowed.length === 0}
                                  className="h-8 rounded-md border border-gray-200 bg-white px-2 text-[11px] outline-none focus:border-gray-400 disabled:opacity-50 w-32 lg:w-40 md:text-xs">
                                  <option value="">{locked ? "Locked" : "Select next"}</option>
                                  {allowed.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
                                </select>
                                <button type="button" onClick={() => handleUpdate(row)}
                                  disabled={locked || !draft || updatingId === row.id}
                                  className="inline-flex h-8 items-center gap-1 rounded-md bg-gray-900 px-2.5 text-[11px] font-semibold text-white hover:bg-gray-700 disabled:opacity-50 transition md:gap-1.5 md:px-3 md:text-xs">
                                  {updatingId === row.id ? <><Spinner className="h-3.5 w-3.5 border-gray-500 border-t-white" />…</> : "Update"}
                                </button>
                              </div>
                              {draft === "processing" && !row.trackingNumber ? (
                                <div className="mt-1.5 grid grid-cols-1 gap-1.5">
                                  <input
                                    value={draftTrackingNumberById[row.id] || ""}
                                    onChange={(e) => handleTrackingNumberChange(row.id, e.target.value)}
                                    placeholder="Tracking number (optional)"
                                    className="h-8 rounded-md border border-indigo-200 px-2 text-[11px] outline-none focus:border-indigo-400"
                                  />
                                  <input
                                    value={draftTrackingNoteById[row.id] || ""}
                                    onChange={(e) => handleTrackingNoteChange(row.id, e.target.value)}
                                    placeholder="Tracking note (optional)"
                                    className="h-8 rounded-md border border-gray-200 px-2 text-[11px] outline-none focus:border-gray-400"
                                  />
                                </div>
                              ) : null}
                            </Td>
                            <Td>
                              <div className="text-xs">
                                <div className="font-medium text-gray-800">{timeAgo(t)}</div>
                                <div className="text-gray-400">{t ? new Date(t).toLocaleString() : "—"}</div>
                              </div>
                            </Td>
                          </tr>
                        );
                      }),
                    ];
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <OrderDetailsDrawer open={detailsOpen} loading={detailsLoading} error={detailsError} data={details} onClose={closeDetails} />
    </div>
  );
}

function Th({ children }) {
  return <th className="px-4 py-3 whitespace-nowrap">{children}</th>;
}

function Td({ children, className = "", onClick }) {
  return <td onClick={onClick} className={`px-4 py-3 align-middle ${className}`}>{children}</td>;
}

function OrderDetailsDrawer({ open, loading, error, data, onClose }) {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const order = data?.order || null;
  const address = data?.address || null;
  const user = data?.user || null;
  const t = order ? order.createdAt || order.updatedAt || order.created_at || order.updated_at : null;

  return (
    <Drawer
      title="Order Details"
      placement={isMobile ? "bottom" : "right"}
      width={isMobile ? undefined : 760}
      height={isMobile ? "82vh" : undefined}
      open={open}
      onClose={onClose}
      destroyOnClose
    >
      <div className="text-xs text-gray-400 mb-4">User + Delivery Address · {t ? timeAgo(t) : "—"}</div>
      {loading ? (
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-6 text-center text-sm text-gray-400">Loading details…</div>
      ) : error ? (
        <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : !order ? (
        <div className="rounded-xl border border-gray-100 bg-white p-4 text-sm text-gray-500">No data available</div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-gray-100 bg-white p-4">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Order Information</div>
            <div className="space-y-1.5 text-sm text-gray-800">
              <Row label="Order ID" value={`#${order.id}`} />
              <Row label="User" value={`${user?.name || "—"} (${user?.email || "—"})`} />
              <Row label="User ID" value={user?.id ?? order.userId} />
              <Row label="Product" value={order.name} />
              <Row label="Qty" value={order.quantity} />
              <Row label="Price" value={`$${order.price}`} />
              <div className="pt-1">
                <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${statusPillClasses(order.status)}`}>
                  {statusLabel(order.status)}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-100 bg-white p-4">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Delivery Address</div>
            {!address ? (
              <div className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-sm text-amber-700">
                No address linked for ID: {order.addressId}
              </div>
            ) : (
              <div className="space-y-1.5 text-sm text-gray-800">
                <Row label="Label" value={address.label || "Home"} />
                <Row label="Name" value={address.name || "—"} />
                <Row label="Phone" value={address.phone || "—"} />
                <Row label="Line" value={address.line1 || "—"} />
                <Row label="City" value={address.city || "—"} />
                <Row label="ZIP" value={address.zip || "—"} />
              </div>
            )}
          </div>

          <div className="md:col-span-2 rounded-xl border border-gray-100 bg-gray-50 p-4">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Payment</div>
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs">Method: <b>{order.paymentMethod || "balance"}</b></span>
              <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs">Merchant ID: <b>{order.matchMerchantId || "N/A"}</b></span>
              {order.trackingNumber ? (
                <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs text-indigo-700">
                  Tracking: <b>{order.trackingNumber}</b>
                </span>
              ) : null}
              {order.trackingNote ? (
                <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs">
                  Note: <b>{order.trackingNote}</b>
                </span>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </Drawer>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-start gap-1">
      <span className="w-20 shrink-0 text-gray-400">{label}:</span>
      <span className="text-gray-800">{value}</span>
    </div>
  );
}
