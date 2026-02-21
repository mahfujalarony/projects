import React, { useEffect, useMemo, useState } from "react";
import { Drawer, message as antdMessage } from "antd";
import { useSelector } from "react-redux";
import { API_BASE_URL } from "../../../config/env";

const BASE_URL = API_BASE_URL;
const STATUS_FLOW = ["pending", "processing", "shipped", "delivered"];
const TERMINAL = new Set(["delivered", "cancelled"]);
const ALL_STATUSES = ["pending", "processing", "shipped", "delivered", "cancelled"];

const statusLabel = (s) =>
  ({
    pending: "Pending",
    processing: "Processing",
    shipped: "Shipped",
    delivered: "Delivered",
    cancelled: "Cancelled",
  }[s] || s);

function statusPillClasses(s) {
  switch (s) {
    case "pending":
      return "border-gray-300 bg-gray-100 text-gray-700";
    case "processing":
      return "border-blue-300 bg-blue-50 text-blue-700";
    case "shipped":
      return "border-purple-300 bg-purple-50 text-purple-700";
    case "delivered":
      return "border-green-300 bg-green-50 text-green-700";
    case "cancelled":
      return "border-red-300 bg-red-50 text-red-700";
    default:
      return "border-gray-300 bg-gray-100 text-gray-700";
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

// -------- time ago --------
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

  const yr = Math.floor(mo / 12);
  return `${yr}y ago`;
}

function getOrderTimeRow(o) {
  return o?.createdAt || o?.updatedAt || o?.created_at || o?.updated_at || null;
}

// -------- API --------
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
  return payload; // {rows,count,page,limit}
}

async function apiUpdateStatus(orderId, status, token) {
  const res = await fetch(`${BASE_URL}/api/admin/orders/${orderId}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ status }),
  });

  const ct = res.headers.get("content-type") || "";
  const isJson = ct.includes("application/json");
  const payload = isJson ? await res.json().catch(() => ({})) : await res.text().catch(() => "");

  if (!res.ok) throw new Error(payload?.message || payload || `Failed (HTTP ${res.status})`);
  return payload;
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

// -------- UI helpers --------
function Spinner({ className = "h-4 w-4" }) {
  return (
    <span className={`inline-block ${className} animate-spin rounded-full border-2 border-gray-300 border-t-gray-900`} />
  );
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

export default function Orders() {
  const reduxToken = useSelector((s) => s.auth?.token);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(0);

  // filters
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  // draft status
  const [draftStatusById, setDraftStatusById] = useState({});
  const [updatingId, setUpdatingId] = useState(null);

  // details modal
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [details, setDetails] = useState(null);
  const [detailsError, setDetailsError] = useState("");
  const token = useMemo(() => {
    if (reduxToken) return reduxToken;
    try {
      const saved = JSON.parse(localStorage.getItem("userInfo") || "null");
      return saved?.token || null;
    } catch {
      return null;
    }
  }, [reduxToken]);

  const pages = useMemo(() => Math.max(1, Math.ceil((count || 0) / (limit || 20))), [count, limit]);
  const userOrderCountMap = useMemo(
    () =>
      rows.reduce((acc, row) => {
        const key = String(row?.userId || "unknown");
        acc[key] = Number(acc[key] || 0) + 1;
        return acc;
      }, {}),
    [rows]
  );

  const showToast = (type, text) => {
    if (!text) return;
    if (type === "success") return antdMessage.success(text);
    if (type === "warn") return antdMessage.warning(text);
    return antdMessage.error(text);
  };

  // when filter changes -> reset to page 1
  useEffect(() => {
    setPage(1);
  }, [q, statusFilter, limit]);

  const load = async ({ useSignal = true } = {}) => {
    const controller = useSignal ? new AbortController() : null;
    setLoading(true);
    try {
      const data = await apiGetOrders({
        page,
        limit,
        q,
        status: statusFilter,
        signal: controller?.signal,
        token,
      });
      setRows(Array.isArray(data?.rows) ? data.rows : Array.isArray(data) ? data : []);
      setCount(Number(data?.count || 0));
    } catch (e) {
      if (String(e?.name) !== "AbortError") showToast("error", e.message || "Order load failed");
    } finally {
      setLoading(false);
    }
    return () => controller?.abort?.();
  };

  useEffect(() => {
    let cleanup = null;
    (async () => {
      cleanup = await load();
    })();
    return () => cleanup?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, statusFilter, token]); // q is handled via "Apply" button to reduce spam fetch

  // search apply (smooth)
  const applySearch = () => {
    setPage(1);
    // trigger load manually because q is not in dependency
    load({ useSignal: false });
  };

  const clearSearch = () => {
    setQ("");
    setPage(1);
    load({ useSignal: false });
  };

  const handleChangeDraft = (orderId, nextStatus) => {
    setDraftStatusById((prev) => ({ ...prev, [orderId]: nextStatus }));
  };

  const handleUpdate = async (order) => {
    const orderId = order.id;
    const nextStatus = draftStatusById[orderId];
    if (!nextStatus) return showToast("warn", "Please select a status first");

    const allowed = getAllowedNextStatuses(order.status);
    if (!allowed.includes(nextStatus)) {
      return showToast("error", `Invalid transition. Allowed: ${allowed.map(statusLabel).join(", ") || "None"}`);
    }

    setUpdatingId(orderId);
    try {
      await apiUpdateStatus(orderId, nextStatus, token);
      showToast("success", "Status updated ✅");
      await load({ useSignal: false });
      setDraftStatusById((prev) => {
        const n = { ...prev };
        delete n[orderId];
        return n;
      });
    } catch (e) {
      showToast("error", e.message || "Status update failed");
    } finally {
      setUpdatingId(null);
    }
  };

  const openDetails = async (orderId) => {
    setDetailsOpen(true);
    setDetails(null);
    setDetailsError("");
    setDetailsLoading(true);
    try {
      const data = await apiGetOrderDetails(orderId, { token });
      setDetails(data);
    } catch (e) {
      setDetailsError(e.message || "Failed to load details");
    } finally {
      setDetailsLoading(false);
    }
  };

  const closeDetails = () => {
    setDetailsOpen(false);
    setDetails(null);
    setDetailsError("");
    setDetailsLoading(false);
  };

  const from = count === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, count || 0);

  const goPage = (p) => setPage(clamp(p, 1, pages));

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-5">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">Admin Order Manager</h2>
          <p className="text-xs text-gray-500">Server-side pagination (safe for 50k+ rows)</p>
        </div>

        <button
          onClick={() => load({ useSignal: false })}
          disabled={loading}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-3 text-sm font-medium hover:bg-gray-50 disabled:opacity-60"
        >
          {loading ? (
            <>
              <Spinner className="h-4 w-4" />
              Refreshing...
            </>
          ) : (
            "Refresh"
          )}
        </button>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="flex flex-col gap-1 md:col-span-2">
          <label className="text-xs font-medium text-gray-600">Search</label>
          <div className="flex gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search: Order ID / Product"
              className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm outline-none transition focus:border-gray-400"
              onKeyDown={(e) => {
                if (e.key === "Enter") applySearch();
              }}
            />
            <button
              onClick={applySearch}
              className="h-10 rounded-md bg-black px-4 text-sm font-semibold text-white hover:bg-gray-900"
            >
              Apply
            </button>
            <button
              onClick={clearSearch}
              className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm font-medium hover:bg-gray-50"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm outline-none transition focus:border-gray-400"
          >
            <option value="all">All Status</option>
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Per page</label>
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value) || 20)}
            className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm outline-none transition focus:border-gray-400"
          >
            {[2, 10, 20, 50, 100, 200].map((n) => (
              <option key={n} value={n}>
                {n} / page
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* meta */}
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-gray-700">
          {count ? (
            <>
              Showing <b>{from}</b>–<b>{to}</b> of <b>{count}</b>
            </>
          ) : (
            "No orders"
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => goPage(1)}
            disabled={page <= 1 || loading}
            className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm font-medium hover:bg-gray-50 disabled:opacity-60"
          >
            First
          </button>
          <button
            onClick={() => goPage(page - 1)}
            disabled={page <= 1 || loading}
            className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm font-medium hover:bg-gray-50 disabled:opacity-60"
          >
            Prev
          </button>

          <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 h-9 text-sm">
            <span className="text-gray-500">Page</span>
            <b>{page}</b>
            <span className="text-gray-400">/</span>
            <b>{pages}</b>
          </div>

          <button
            onClick={() => goPage(page + 1)}
            disabled={page >= pages || loading}
            className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm font-medium hover:bg-gray-50 disabled:opacity-60"
          >
            Next
          </button>
          <button
            onClick={() => goPage(pages)}
            disabled={page >= pages || loading}
            className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm font-medium hover:bg-gray-50 disabled:opacity-60"
          >
            Last
          </button>
        </div>
      </div>

      {/* loading overlay (smooth) */}
      <div className="relative">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-white/60 backdrop-blur-[1px]">
            <div className="flex items-center gap-2 rounded-lg border bg-white px-4 py-2 text-sm">
              <Spinner />
              Loading...
            </div>
          </div>
        )}

        {/* Mobile cards */}
        <div className="grid grid-cols-1 gap-3 md:hidden">
          {rows.length === 0 ? (
            <div className="rounded-md border border-gray-200 bg-white p-4 text-sm text-gray-600">No orders found</div>
          ) : (
            rows.map((row) => {
              const current = row.status;
              const allowed = getAllowedNextStatuses(current);
              const locked = TERMINAL.has(current);
              const draft = draftStatusById[row.id];
              const t = getOrderTimeRow(row);

              return (
                <div
                  key={row.id}
                  onClick={() => openDetails(row.id)}
                  className="cursor-pointer rounded-xl border border-gray-200 bg-white p-4 transition hover:bg-gray-50/60 active:scale-[0.99]"
                >
                  <div className="flex items-start gap-3">
                    {row.imageUrl ? (
                      <img src={row.imageUrl} alt={row.name} className="h-12 w-12 rounded-lg border object-cover" />
                    ) : (
                      <div className="h-12 w-12 rounded-lg border bg-gray-50" />
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="truncate font-semibold text-gray-900">
                          #{row.id} — {row.name}
                        </div>
                        <span
                          className={[
                            "whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium capitalize",
                            statusPillClasses(current),
                          ].join(" ")}
                        >
                          {statusLabel(current)}
                        </span>
                      </div>

                      <div className="mt-1 text-xs text-gray-500">
                        UID: {row.userId} • Qty: {row.quantity} • ৳{row.price} • {timeAgo(t)}
                        {Number(userOrderCountMap[String(row.userId)] || 0) > 1 && (
                          <span style={{ marginLeft: 8, color: "#2563eb", fontWeight: 600 }}>
                            Same User x{userOrderCountMap[String(row.userId)]}
                          </span>
                        )}
                      </div>

                      <div className="mt-3 flex flex-col gap-2">
                        <select
                          value={draft || ""}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => handleChangeDraft(row.id, e.target.value)}
                          disabled={locked || allowed.length === 0}
                          className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm outline-none transition focus:border-gray-400 disabled:opacity-60"
                        >
                          <option value="">{locked ? "Locked" : "Select next status"}</option>
                          {allowed.map((s) => (
                            <option key={s} value={s}>
                              {statusLabel(s)}
                            </option>
                          ))}
                        </select>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUpdate(row);
                          }}
                          disabled={locked || !draft || updatingId === row.id}
                          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-black px-4 text-sm font-semibold text-white transition hover:bg-gray-900 disabled:opacity-60"
                        >
                          {updatingId === row.id ? (
                            <>
                              <Spinner className="h-4 w-4 border-gray-500 border-t-white" />
                              Updating...
                            </>
                          ) : (
                            "Update"
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block">
          <div className="rounded-lg border border-gray-200 bg-white">
            <div className="overflow-x-auto">
              <table className="min-w-[980px] w-full border-collapse text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
                  <tr>
                    <Th>Order</Th>
                    <Th>Payment</Th>
                    <Th>Status</Th>
                    <Th>Action</Th>
                    <Th>Time</Th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-5 text-center text-gray-600">
                        No orders found
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => {
                      const current = row.status;
                      const allowed = getAllowedNextStatuses(current);
                      const locked = TERMINAL.has(current);
                      const draft = draftStatusById[row.id];
                      const t = getOrderTimeRow(row);

                      return (
                        <tr
                          key={row.id}
                          className="cursor-pointer transition hover:bg-gray-50/50"
                          onClick={() => openDetails(row.id)}
                        >
                          <Td>
                            <div className="flex items-center gap-3">
                              {row.imageUrl ? (
                                <img
                                  src={row.imageUrl}
                                  alt={row.name}
                                  className="h-10 w-10 rounded-lg border object-cover"
                                />
                              ) : (
                                <div className="h-10 w-10 rounded-lg border bg-gray-50" />
                              )}

                              <div className="min-w-0">
                                <div className="truncate font-semibold text-gray-900">
                                  #{row.id} — {row.name}
                                </div>
                                <div className="mt-0.5 text-xs text-gray-500">
                                  UID: {row.userId} • Qty: {row.quantity} • ৳{row.price}
                                  {Number(userOrderCountMap[String(row.userId)] || 0) > 1 && (
                                    <span style={{ marginLeft: 8, color: "#2563eb", fontWeight: 600 }}>
                                      Same User x{userOrderCountMap[String(row.userId)]}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </Td>

                          {/* paymentStatus বাদ */}
                          <Td>
                            <div className="min-w-0">
                              <div className="truncate text-gray-700">{row.paymentMethod || "-"}</div>
                              <div className="mt-1 text-xs text-gray-500">—</div>
                            </div>
                          </Td>

                          <Td className="whitespace-nowrap">
                            <span
                              className={[
                                "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium capitalize",
                                statusPillClasses(current),
                              ].join(" ")}
                            >
                              {statusLabel(current)}
                            </span>
                          </Td>

                          <Td onClick={(e) => e.stopPropagation()}>
                            <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
                              <select
                                value={draft || ""}
                                onChange={(e) => handleChangeDraft(row.id, e.target.value)}
                                disabled={locked || allowed.length === 0}
                                className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm outline-none transition focus:border-gray-400 disabled:opacity-60 lg:w-52"
                              >
                                <option value="">{locked ? "Locked" : "Select next"}</option>
                                {allowed.map((s) => (
                                  <option key={s} value={s}>
                                    {statusLabel(s)}
                                  </option>
                                ))}
                              </select>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUpdate(row);
                                }}
                                disabled={locked || !draft || updatingId === row.id}
                                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-black px-4 text-sm font-semibold text-white transition hover:bg-gray-900 disabled:opacity-60 lg:w-auto"
                              >
                                {updatingId === row.id ? (
                                  <>
                                    <Spinner className="h-4 w-4 border-gray-500 border-t-white" />
                                    Updating...
                                  </>
                                ) : (
                                  "Update"
                                )}
                              </button>
                            </div>
                          </Td>

                          <Td className="whitespace-nowrap text-gray-600">
                            <div className="flex flex-col">
                              <span className="font-medium text-gray-800">{timeAgo(t)}</span>
                              <span className="text-xs text-gray-400">{t ? new Date(t).toLocaleString() : "-"}</span>
                            </div>
                          </Td>
                        </tr>
                      );
                    })
                  )}
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
  return (
    <td onClick={onClick} className={`px-4 py-3 align-top ${className}`}>
      {children}
    </td>
  );
}

function OrderDetailsDrawer({ open, loading, error, data, onClose }) {
  const order = data?.order || null;
  const address = data?.address || null;
  const user = data?.user || null;
  const t = order ? order.createdAt || order.updatedAt || order.created_at || order.updated_at : null;

  return (
    <Drawer
      title="Order Details"
      placement="right"
      width={760}
      open={open}
      onClose={onClose}
      destroyOnClose
    >
      <div className="text-xs text-gray-500 mb-3">User + Selected Address • {t ? timeAgo(t) : "-"}</div>
      {loading ? (
        <div className="rounded-md border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700 text-center">Loading details...</div>
      ) : error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>
      ) : !order ? (
        <div className="rounded-md border border-gray-200 bg-white p-4 text-sm text-gray-700">No data available</div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="text-xs font-semibold text-gray-900">Order Information</div>
            <div className="mt-2 space-y-1 text-sm text-gray-800">
              <div><span className="text-gray-500">Order ID:</span> #{order.id}</div>
              <div><span className="text-gray-500">User:</span> {user?.name || "-"} ({user?.email || "-"})</div>
              <div><span className="text-gray-500">User ID:</span> {user?.id ?? order.userId}</div>
              <div><span className="text-gray-500">Product:</span> {order.name}</div>
              <div><span className="text-gray-500">Qty:</span> {order.quantity}</div>
              <div><span className="text-gray-500">Price:</span> ৳{order.price}</div>
              <div className="pt-2">
                <span className={["inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium capitalize", statusPillClasses(order.status)].join(" ")}>
                  {statusLabel(order.status)}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="text-xs font-semibold text-gray-900">Delivery Address</div>
            {!address ? (
              <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                No address linked for ID: {order.addressId}
              </div>
            ) : (
              <div className="mt-2 space-y-1 text-sm text-gray-800">
                <div><span className="text-gray-500">Label:</span> {address.label || "Home"}</div>
                <div><span className="text-gray-500">Name:</span> {address.name || "-"}</div>
                <div><span className="text-gray-500">Phone:</span> {address.phone || "-"}</div>
                <div><span className="text-gray-500">Line:</span> {address.line1 || "-"}</div>
                <div><span className="text-gray-500">City:</span> {address.city || "-"}</div>
                <div><span className="text-gray-500">ZIP:</span> {address.zip || "-"}</div>
              </div>
            )}
          </div>

          <div className="md:col-span-2 rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div className="text-xs font-semibold text-gray-900">Payment</div>
            <div className="mt-2 flex flex-wrap gap-2 text-sm">
              <span className="rounded-full border bg-white px-3 py-1">
                Method: <b>{order.paymentMethod || "balance"}</b>
              </span>
              <span className="rounded-full border bg-white px-3 py-1">
                Merchant ID: <b>{order.matchMerchantId || "N/A"}</b>
              </span>
            </div>
          </div>
        </div>
      )}
    </Drawer>
  );
}
