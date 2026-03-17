import React, { useEffect, useMemo, useState } from "react";
import { Drawer } from "antd";
import { API_BASE_URL } from "../../../config/env";
import { normalizeImageUrl } from "../../../utils/imageUrl";

const API_URL = `${API_BASE_URL}`;
const ALL_STATUSES = ["pending", "processing", "shipped", "delivered", "cancelled"];
const toMoney = (n) => Number(Number(n || 0).toFixed(2));

const getSettlementBreakdown = (order) => {
  if (!order || order.status !== "delivered") return null;
  const price = Number(order.price || 0);
  const qty = Number(order.quantity || 0);
  const gross = toMoney(price * qty);
  if (!Number.isFinite(gross) || gross <= 0) return null;

  const baseReturn = toMoney(gross * 0.5);
  const rate = Number(order.commissionPercent || 0);
  const fallbackBonus = toMoney((baseReturn * rate) / 100);
  const rawBonus = Number(order.commissionAmount);
  const bonus = Number.isFinite(rawBonus) ? toMoney(rawBonus) : fallbackBonus;
  const merchantCredit = toMoney(baseReturn + bonus);
  const adminPart = toMoney(Math.max(0, gross - merchantCredit));

  return { gross, baseReturn, rate, bonus, merchantCredit, adminPart };
};

const renderSettlementNote = (order, compact = false) => {
  const s = getSettlementBreakdown(order);
  if (!s) return null;

  return (
    <div className={`rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 ${compact ? "mt-1.5 px-2 py-1.5 text-[11px]" : "mt-2 px-2.5 py-2 text-xs"}`}>
      {compact
        ? `Delivered settlement: Sale $${s.gross.toFixed(2)} -> base $${s.baseReturn.toFixed(2)} + bonus $${s.bonus.toFixed(2)} (${s.rate.toFixed(2)}%) = credit $${s.merchantCredit.toFixed(2)}.`
        : `Delivered: Total sale $${s.gross.toFixed(2)}. Base return $${s.baseReturn.toFixed(2)} (50%) + bonus $${s.bonus.toFixed(2)} (${s.rate.toFixed(2)}%) = $${s.merchantCredit.toFixed(2)} added to your balance. Admin part: $${s.adminPart.toFixed(2)}.`}
    </div>
  );
};

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

function Spinner({ className = "h-4 w-4" }) {
  return (
    <span className={`inline-block ${className} animate-spin rounded-full border-2 border-gray-300 border-t-gray-700`} />
  );
}

const STATUS_CONFIG = {
  delivered:   { dot: "bg-emerald-500", pill: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  cancelled:   { dot: "bg-red-500",     pill: "bg-red-50 text-red-700 ring-red-200" },
  shipped:     { dot: "bg-blue-500",    pill: "bg-blue-50 text-blue-700 ring-blue-200" },
  processing:  { dot: "bg-amber-500",   pill: "bg-amber-50 text-amber-700 ring-amber-200" },
  pending:     { dot: "bg-gray-400",    pill: "bg-gray-50 text-gray-600 ring-gray-200" },
};

function StatusBadge({ status }) {
  const s = status || "pending";
  const cfg = STATUS_CONFIG[s] || STATUS_CONFIG.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset capitalize ${cfg.pill}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {s}
    </span>
  );
}

async function fetchMerchantOrders({ status, search, page, limit, sort, token, signal }) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (search) params.set("search", search);
  params.set("page", String(page || 1));
  params.set("limit", String(limit || 20));
  params.set("sort", sort || "desc");

  const res = await fetch(`${API_URL}/api/merchant/orders?${params.toString()}`, {
    method: "GET",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    signal,
  });

  const ct = res.headers.get("content-type") || "";
  const payload = ct.includes("application/json")
    ? await res.json().catch(() => ({}))
    : await res.text().catch(() => "");

  if (!res.ok || payload?.ok === false) throw new Error(payload?.message || payload || "Failed to fetch orders");
  return payload;
}

export default function MerchantOrders() {
  const [loading, setLoading]         = useState(true);
  const [rows, setRows]               = useState([]);
  const [meta, setMeta]               = useState({ total: 0, totalPages: 1, page: 1, limit: 20 });
  const [toast, setToast]             = useState({ type: "", text: "" });
  const [error, setError]             = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [status, setStatus]           = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const token = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("userInfo") || "null")?.token || null; }
    catch { return null; }
  }, []);

  const [query, setQuery] = useState({ status: "", search: "", page: 1, limit: 20, sort: "desc" });

  const showToast = (type, text) => {
    setToast({ type, text });
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast({ type: "", text: "" }), 2200);
  };

  const pages = useMemo(() => Math.max(1, Number(meta.totalPages || 1)), [meta.totalPages]);
  const page  = query.page;
  const from  = meta.total === 0 ? 0 : (page - 1) * query.limit + 1;
  const to    = Math.min(page * query.limit, meta.total);

  const load = async () => {
    const controller = new AbortController();
    try {
      setLoading(true); setError("");
      const data = await fetchMerchantOrders({ ...query, token, signal: controller.signal });
      setRows(Array.isArray(data?.data) ? data.data : []);
      setMeta({ total: Number(data.total || 0), totalPages: Number(data.totalPages || 1), page: Number(data.page || 1), limit: Number(data.limit || query.limit) });
    } catch (e) {
      if (String(e?.name) !== "AbortError") { setError(e.message || "Something went wrong"); showToast("error", e.message || "Failed"); }
    } finally { setLoading(false); }
    return () => controller.abort();
  };

  useEffect(() => {
    let cleanup = null;
    (async () => { cleanup = await load(); })();
    return () => cleanup?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const applyFilters = () => setQuery((p) => ({ ...p, status, search: searchDraft.trim(), page: 1 }));
  const clearFilters = () => { setStatus(""); setSearchDraft(""); setQuery((p) => ({ ...p, status: "", search: "", page: 1 })); };
  const changePage   = (p) => setQuery((prev) => ({ ...prev, page: Math.max(1, Math.min(pages, p)) }));
  const changeLimit  = (n) => setQuery((p) => ({ ...p, limit: Number(n) || 20, page: 1 }));

  return (
    <div className="mx-auto w-full max-w-6xl px-3 py-3 sm:px-5 sm:py-5 space-y-3">

      {/* Toast */}
      {toast.text && (
        <div className={`rounded-lg border px-4 py-2.5 text-sm font-medium shadow-sm
          ${toast.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" :
            toast.type === "error"   ? "border-red-200 bg-red-50 text-red-800" :
                                       "border-amber-200 bg-amber-50 text-amber-800"}`}>
          {toast.text}
        </div>
      )}

      {/* ── Compact Header ── */}
      <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-2.5 shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-900 text-white">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-gray-900 leading-none">Merchant Orders</h2>
            <p className="mt-0.5 text-[11px] text-gray-400 leading-none">Read-only · Admin controls status</p>
          </div>
          {meta.total > 0 && (
            <span className="hidden sm:inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
              {meta.total} total
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Mobile filter toggle */}
          <button
            onClick={() => setShowFilters((v) => !v)}
            className="md:hidden inline-flex h-8 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M6 12h12M9 20h6" />
            </svg>
            Filters
          </button>

          <button
            onClick={() => load()}
            disabled={loading}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {loading ? <Spinner className="h-3 w-3" /> : (
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
            Refresh
          </button>
        </div>
      </div>

      {/* ── Filters Bar ── */}
      <div className={`rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm ${showFilters ? "block" : "hidden"} md:block`}>
        <div className="flex flex-wrap items-end gap-2.5">
          {/* Status */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium uppercase tracking-wide text-gray-400">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-8 rounded-lg border border-gray-300 bg-white px-2.5 text-xs font-medium text-gray-700 outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-300 transition-colors"
            >
              <option value="">All statuses</option>
              {ALL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Search */}
          <div className="flex flex-col gap-1 flex-1 min-w-40">
            <label className="text-[11px] font-medium uppercase tracking-wide text-gray-400">Search</label>
            <input
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
              placeholder="Name or product ID..."
              className="h-8 rounded-lg border border-gray-300 px-2.5 text-xs text-gray-700 placeholder-gray-400 outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-300 transition-colors"
            />
          </div>

          {/* Per page */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium uppercase tracking-wide text-gray-400">Per page</label>
            <select
              value={query.limit}
              onChange={(e) => changeLimit(e.target.value)}
              className="h-8 rounded-lg border border-gray-300 bg-white px-2.5 text-xs font-medium text-gray-700 outline-none focus:border-gray-500 transition-colors"
            >
              {[10, 20, 50, 100, 200].map((n) => <option key={n} value={n}>{n}/page</option>)}
            </select>
          </div>

          {/* Buttons + count */}
          <div className="flex items-center gap-2">
            <button
              onClick={applyFilters}
              className="h-8 rounded-lg bg-gray-900 px-3.5 text-xs font-semibold text-white hover:bg-gray-800 transition-colors"
            >
              Apply
            </button>
            <button
              onClick={clearFilters}
              className="h-8 rounded-lg border border-gray-300 bg-white px-3 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Clear
            </button>
          </div>

          {meta.total > 0 && (
            <div className="ml-auto text-xs text-gray-500 whitespace-nowrap">
              <b className="text-gray-700">{from}</b>–<b className="text-gray-700">{to}</b> of <b className="text-gray-700">{meta.total}</b>
            </div>
          )}
        </div>
      </div>

      {/* ── Table / Cards ── */}
      <div className="relative">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/70 backdrop-blur-[2px]">
            <div className="flex items-center gap-2.5 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium shadow-md">
              <Spinner className="h-4 w-4" /> Loading orders…
            </div>
          </div>
        )}

        {error && !loading && (
          <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {/* Mobile cards */}
        <div className="grid grid-cols-1 gap-2 md:hidden">
          {!loading && rows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-gray-400">No orders found</div>
          ) : rows.map((r) => (
            <div key={r.id} className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3">
                {r.imageUrl
                  ? <img src={normalizeImageUrl(r.imageUrl)} alt={r.name} className="h-11 w-11 shrink-0 rounded-lg border object-cover" />
                  : <div className="h-11 w-11 shrink-0 rounded-lg border bg-gray-100" />}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm font-semibold text-gray-900 line-clamp-2 break-words max-w-[220px]">
                      #{r.id} · {r.name}
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                  <div className="mt-1 text-[11px] text-gray-400">
                    P:{r.productId} · U:{r.userId} · {timeAgo(r.createdAt)}
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex gap-1.5 text-[11px]">
                      <span className="rounded-full border bg-gray-50 px-2 py-0.5 font-medium text-gray-600">×{r.quantity}</span>
                      <span className="rounded-full border bg-gray-50 px-2 py-0.5 font-medium text-gray-600">${Number(r.price || 0).toFixed(2)}</span>
                    </div>
                    <button
                      onClick={() => { setSelectedOrder(r); setDetailsOpen(true); }}
                      className="h-7 rounded-lg border border-gray-300 bg-white px-2.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      Details
                    </button>
                  </div>
                  {renderSettlementNote(r)}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block">
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-[900px] w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/70">
                    {["ID", "Product", "Qty", "Price (USD)", "Status", "Created"].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {!loading && rows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-14 text-center text-sm text-gray-400">
                        <div className="flex flex-col items-center gap-2">
                          <svg className="h-8 w-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                          No orders found
                        </div>
                      </td>
                    </tr>
                  ) : rows.map((r) => (
                    <tr
                      key={r.id}
                      className="hover:bg-gray-50/50 transition-colors cursor-pointer"
                      onClick={() => { setSelectedOrder(r); setDetailsOpen(true); }}
                    >
                      <td className="px-4 py-3 whitespace-nowrap text-xs font-mono text-gray-500">#{r.id}</td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {r.imageUrl
                            ? <img src={normalizeImageUrl(r.imageUrl)} alt={r.name} className="h-9 w-9 shrink-0 rounded-lg border object-cover" />
                            : <div className="h-9 w-9 shrink-0 rounded-lg border bg-gray-100" />}
                          <div className="min-w-0">
                          <div className="line-clamp-2 break-words max-w-[320px] font-medium text-gray-900 text-sm">
                            {r.name}
                          </div>
                            <div className="text-[11px] text-gray-400">P:{r.productId} · U:{r.userId}</div>
                            {r.productMeta && (
                              <div className="text-[11px] text-gray-400">
                                {r.productMeta.category || "-"} · stock:{r.productMeta.stock} · sold:{r.productMeta.soldCount}
                              </div>
                            )}
                            {renderSettlementNote(r, true)}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-700">{r.quantity}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-700">${Number(r.price || 0).toFixed(2)}</td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <StatusBadge status={r.status} />
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-700">{timeAgo(r.createdAt)}</div>
                        <div className="text-[11px] text-gray-400">{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "-"}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* ── Pagination ── */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2.5 shadow-sm">
        {[
          { label: "«", action: () => changePage(1),        disabled: page <= 1 },
          { label: "‹", action: () => changePage(page - 1), disabled: page <= 1 },
        ].map(({ label, action, disabled }) => (
          <button key={label} onClick={action} disabled={disabled || loading}
            className="h-8 w-8 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors">
            {label}
          </button>
        ))}

        <div className="h-8 rounded-lg border border-gray-200 bg-gray-50 px-3 text-xs flex items-center gap-1.5 text-gray-600 font-medium">
          {page} <span className="text-gray-300">/</span> {pages}
        </div>

        {[
          { label: "›", action: () => changePage(page + 1), disabled: page >= pages },
          { label: "»", action: () => changePage(pages),    disabled: page >= pages },
        ].map(({ label, action, disabled }) => (
          <button key={label} onClick={action} disabled={disabled || loading}
            className="h-8 w-8 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors">
            {label}
          </button>
        ))}

        {meta.total > 0 && (
          <span className="ml-auto text-xs text-gray-400">
            {from}–{to} of {meta.total}
          </span>
        )}
      </div>

      {/* ── Drawer ── */}
      <Drawer
        title={
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-900">
              {selectedOrder ? `Order #${selectedOrder.id}` : "Order Details"}
            </span>
            {selectedOrder && <StatusBadge status={selectedOrder.status} />}
          </div>
        }
        placement="bottom"
        size={300}
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        styles={{ body: { padding: "16px" } }}
      >
        {selectedOrder && (
          <div className="space-y-3 text-sm max-w-lg mx-auto">
            <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3">
              {selectedOrder.imageUrl
                ? <img src={normalizeImageUrl(selectedOrder.imageUrl)} alt={selectedOrder.name} className="h-14 w-14 shrink-0 rounded-lg border object-cover" />
                : <div className="h-14 w-14 shrink-0 rounded-lg border bg-white" />}
              <div>
                <div className="font-semibold text-gray-900">{selectedOrder.name}</div>
                <div className="mt-0.5 text-xs text-gray-400">{selectedOrder.createdAt ? new Date(selectedOrder.createdAt).toLocaleString() : "-"}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Product ID", value: selectedOrder.productId },
                { label: "User ID",    value: selectedOrder.userId },
                { label: "Quantity",   value: selectedOrder.quantity },
                { label: "Unit Price", value: `$${Number(selectedOrder.price || 0).toFixed(2)}` },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-lg border border-gray-100 bg-gray-50 p-2.5">
                  <div className="text-[11px] font-medium uppercase tracking-wide text-gray-400">{label}</div>
                  <div className="mt-0.5 font-semibold text-gray-800">{value}</div>
                </div>
              ))}
            </div>
            {renderSettlementNote(selectedOrder)}

            {selectedOrder.productMeta && (
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-2.5">
                <div className="text-[11px] font-medium uppercase tracking-wide text-gray-400 mb-1">Product Meta</div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
                  <span>Category: <b className="text-gray-800">{selectedOrder.productMeta.category || "—"}</b></span>
                  <span>Sub: <b className="text-gray-800">{selectedOrder.productMeta.subCategory || "—"}</b></span>
                  <span>Stock: <b className="text-gray-800">{selectedOrder.productMeta.stock}</b></span>
                  <span>Sold: <b className="text-gray-800">{selectedOrder.productMeta.soldCount}</b></span>
                </div>
              </div>
            )}

            <p className="text-center text-[11px] text-gray-400">Status can only be updated by an admin</p>
          </div>
        )}
      </Drawer>
    </div>
  );
}

