import React, { useEffect, useMemo, useState } from "react";
import { Drawer } from "antd";
import { API_BASE_URL } from "../../../config/env";

const API_URL = `${API_BASE_URL}`;
const ALL_STATUSES = ["pending", "processing", "shipped", "delivered", "cancelled"];

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

function Spinner({ className = "h-4 w-4" }) {
  return (
    <span
      className={`inline-block ${className} animate-spin rounded-full border-2 border-gray-300 border-t-gray-900`}
    />
  );
}

function StatusBadge({ status }) {
  const s = status || "pending";
  const cls =
    s === "delivered"
      ? "border-green-300 bg-green-50 text-green-700"
      : s === "cancelled"
      ? "border-red-300 bg-red-50 text-red-700"
      : s === "shipped"
      ? "border-blue-300 bg-blue-50 text-blue-700"
      : s === "processing"
      ? "border-amber-300 bg-amber-50 text-amber-700"
      : "border-gray-300 bg-gray-100 text-gray-700";

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${cls}`}>
      {s}
    </span>
  );
}

function Th({ children }) {
  return <th className="px-4 py-3 whitespace-nowrap">{children}</th>;
}
function Td({ children, className = "" }) {
  return <td className={`px-4 py-3 align-top ${className}`}>{children}</td>;
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
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    signal,
  });

  const ct = res.headers.get("content-type") || "";
  const isJson = ct.includes("application/json");
  const payload = isJson ? await res.json().catch(() => ({})) : await res.text().catch(() => "");

  if (!res.ok || payload?.ok === false) {
    throw new Error(payload?.message || payload || "Failed to fetch orders");
  }

  return payload;
}

export default function MerchantOrders() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1, page: 1, limit: 20 });
  const [toast, setToast] = useState({ type: "", text: "" });
  const [error, setError] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const [status, setStatus] = useState("");
  const [searchDraft, setSearchDraft] = useState("");

  const token = useMemo(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("userInfo") || "null");
      return saved?.token || null;
    } catch {
      return null;
    }
  }, []);

  const [query, setQuery] = useState({
    status: "",
    search: "",
    page: 1,
    limit: 20,
    sort: "desc",
  });

  const showToast = (type, text) => {
    setToast({ type, text });
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast({ type: "", text: "" }), 2200);
  };

  const pages = useMemo(() => Math.max(1, Number(meta.totalPages || 1)), [meta.totalPages]);
  const page = query.page;

  const from = meta.total === 0 ? 0 : (page - 1) * query.limit + 1;
  const to = Math.min(page * query.limit, meta.total);

  const load = async () => {
    const controller = new AbortController();
    try {
      setLoading(true);
      setError("");

      const data = await fetchMerchantOrders({
        ...query,
        token,
        signal: controller.signal,
      });

      setRows(Array.isArray(data?.data) ? data.data : []);
      setMeta({
        total: Number(data.total || 0),
        totalPages: Number(data.totalPages || 1),
        page: Number(data.page || 1),
        limit: Number(data.limit || query.limit),
      });
    } catch (e) {
      if (String(e?.name) !== "AbortError") {
        setError(e.message || "Something went wrong");
        showToast("error", e.message || "Failed");
      }
    } finally {
      setLoading(false);
    }

    return () => controller.abort();
  };

  useEffect(() => {
    let cleanup = null;
    (async () => {
      cleanup = await load();
    })();
    return () => cleanup?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const applyFilters = () => {
    setQuery((prev) => ({
      ...prev,
      status,
      search: searchDraft.trim(),
      page: 1,
    }));
  };

  const clearFilters = () => {
    setStatus("");
    setSearchDraft("");
    setQuery((prev) => ({
      ...prev,
      status: "",
      search: "",
      page: 1,
    }));
  };

  const changePage = (p) => {
    const next = Math.max(1, Math.min(pages, p));
    setQuery((prev) => ({ ...prev, page: next }));
  };

  const changeLimit = (n) => {
    const nextLimit = Number(n) || 20;
    setQuery((prev) => ({ ...prev, limit: nextLimit, page: 1 }));
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-3 py-4 sm:px-4 sm:py-5">
      {toast.text && (
        <div className="mb-4">
          <div
            className={[
              "rounded-md border p-3 text-sm",
              toast.type === "success" && "border-green-200 bg-green-50 text-green-800",
              toast.type === "error" && "border-red-200 bg-red-50 text-red-800",
              toast.type === "warn" && "border-amber-200 bg-amber-50 text-amber-800",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {toast.text}
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold sm:text-lg">Merchant Orders</h2>
          <p className="text-xs text-gray-500">Read-only view (Admin controls status)</p>
        </div>

        <button
          onClick={() => load()}
          disabled={loading}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-3 text-sm font-medium hover:bg-gray-50 disabled:opacity-60"
        >
          {loading ? (
            <>
              <Spinner />
              Refreshing...
            </>
          ) : (
            "Refresh"
          )}
        </button>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-6">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-gray-400"
          >
            <option value="">All</option>
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1 lg:col-span-3">
          <label className="text-xs font-medium text-gray-600">Search</label>
          <input
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            placeholder="name or productId"
            className="h-10 rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-gray-400"
            onKeyDown={(e) => {
              if (e.key === "Enter") applyFilters();
            }}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Per page</label>
          <select
            value={query.limit}
            onChange={(e) => changeLimit(e.target.value)}
            className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-gray-400"
          >
            {[10, 20, 50, 100, 200].map((n) => (
              <option key={n} value={n}>
                {n} / page
              </option>
            ))}
          </select>
        </div>

        <div className="lg:col-span-6 flex flex-wrap gap-2">
          <button
            onClick={applyFilters}
            className="inline-flex h-10 items-center justify-center rounded-md bg-black px-4 text-sm font-semibold text-white hover:bg-gray-900"
          >
            Apply
          </button>
          <button
            onClick={clearFilters}
            className="inline-flex h-10 items-center justify-center rounded-md border border-gray-300 bg-white px-4 text-sm font-medium hover:bg-gray-50"
          >
            Clear
          </button>

          <div className="ml-auto flex items-center text-sm text-gray-700">
            {meta.total ? (
              <>Showing <b className="mx-1">{from}</b>-<b className="mx-1">{to}</b> of <b className="mx-1">{meta.total}</b></>
            ) : (
              "No orders"
            )}
          </div>
        </div>
      </div>

      <div className="relative">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-white/60 backdrop-blur-[1px]">
            <div className="flex items-center gap-2 rounded-lg border bg-white px-4 py-2 text-sm">
              <Spinner />
              Loading...
            </div>
          </div>
        )}

        {error && !loading && (
          <div className="mb-3 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
        )}

        <div className="grid grid-cols-1 gap-2 md:hidden">
          {!loading && !error && rows.length === 0 ? (
            <div className="rounded-md border border-gray-200 bg-white p-4 text-sm text-gray-600">No orders found</div>
          ) : (
            rows.map((r) => (
              <div key={r.id} className="rounded-lg border border-gray-200 bg-white p-3 transition-shadow hover:shadow-sm">
                <div className="flex items-start gap-2.5">
                  {r.imageUrl ? (
                    <img src={r.imageUrl} alt={r.name} className="h-12 w-12 rounded-md border object-cover" />
                  ) : (
                    <div className="h-12 w-12 rounded-md border bg-gray-50" />
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="truncate text-sm font-semibold text-gray-900">#{r.id} - {r.name}</div>
                      <StatusBadge status={r.status} />
                    </div>

                    <div className="mt-0.5 text-[11px] text-gray-500">
                      productId: {r.productId} | userId: {r.userId} | {timeAgo(r.createdAt)}
                    </div>

                    <div className="mt-2 flex items-center justify-between gap-2 text-sm">
                      <div className="flex items-center gap-2 text-xs text-gray-700">
                        <span className="rounded border bg-gray-50 px-2 py-0.5">Qty: {r.quantity}</span>
                        <span className="rounded border bg-gray-50 px-2 py-0.5">BDT {Number(r.price || 0).toFixed(2)}</span>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedOrder(r);
                          setDetailsOpen(true);
                        }}
                        className="inline-flex h-8 items-center rounded-md border border-gray-300 bg-white px-2.5 text-xs font-medium hover:bg-gray-50"
                      >
                        Details
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="hidden md:block">
          <div className="rounded-lg border border-gray-200 bg-white">
            <div className="overflow-x-auto">
              <table className="min-w-[980px] w-full border-collapse text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
                  <tr>
                    <Th>ID</Th>
                    <Th>Product</Th>
                    <Th>Qty</Th>
                    <Th>Price</Th>
                    <Th>Status</Th>
                    <Th>Created</Th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {!loading && !error && rows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-5 text-center text-gray-600">
                        No orders found
                      </td>
                    </tr>
                  ) : (
                    rows.map((r) => (
                      <tr key={r.id} className="hover:bg-gray-50/50">
                        <Td className="whitespace-nowrap">{r.id}</Td>

                        <Td>
                          <div className="flex items-center gap-3">
                            {r.imageUrl ? (
                              <img
                                src={r.imageUrl}
                                alt={r.name}
                                className="h-11 w-11 rounded-md object-cover border"
                              />
                            ) : (
                              <div className="h-11 w-11 rounded-md bg-gray-100 border" />
                            )}

                            <div className="min-w-0">
                              <div className="truncate font-medium text-gray-900">{r.name}</div>
                              <div className="mt-0.5 text-xs text-gray-500">
                                productId: {r.productId} | userId: {r.userId}
                              </div>

                              {r.productMeta && (
                                <div className="mt-0.5 text-xs text-gray-500">
                                  category: {r.productMeta.category || "-"} | stock: {r.productMeta.stock} | sold: {r.productMeta.soldCount}
                                </div>
                              )}
                            </div>
                          </div>
                        </Td>

                        <Td className="whitespace-nowrap">{r.quantity}</Td>
                        <Td className="whitespace-nowrap">{Number(r.price || 0).toFixed(2)}</Td>

                        <Td className="whitespace-nowrap">
                          <StatusBadge status={r.status} />
                          <div className="mt-1 text-[11px] text-gray-400">Only admin can change</div>
                        </Td>

                        <Td className="whitespace-nowrap text-gray-700">
                          <div className="flex flex-col">
                            <span className="font-medium text-gray-800">{timeAgo(r.createdAt)}</span>
                            <span className="text-xs text-gray-400">
                              {r.createdAt ? new Date(r.createdAt).toLocaleString() : "-"}
                            </span>
                          </div>
                        </Td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          disabled={page <= 1 || loading}
          onClick={() => changePage(1)}
          className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm font-medium hover:bg-gray-50 disabled:opacity-60"
        >
          First
        </button>

        <button
          disabled={page <= 1 || loading}
          onClick={() => changePage(page - 1)}
          className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm font-medium hover:bg-gray-50 disabled:opacity-60"
        >
          Prev
        </button>

        <div className="h-9 rounded-md border border-gray-200 bg-white px-3 text-sm flex items-center gap-2">
          <span className="text-gray-500">Page</span>
          <b>{page}</b>
          <span className="text-gray-400">/</span>
          <b>{pages}</b>
        </div>

        <button
          disabled={page >= pages || loading}
          onClick={() => changePage(page + 1)}
          className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm font-medium hover:bg-gray-50 disabled:opacity-60"
        >
          Next
        </button>

        <button
          disabled={page >= pages || loading}
          onClick={() => changePage(pages)}
          className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm font-medium hover:bg-gray-50 disabled:opacity-60"
        >
          Last
        </button>
      </div>

      <Drawer
        title={selectedOrder ? `Order #${selectedOrder.id}` : "Order Details"}
        placement="bottom"
        height="78vh"
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
      >
        {selectedOrder ? (
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3">
              {selectedOrder.imageUrl ? (
                <img
                  src={selectedOrder.imageUrl}
                  alt={selectedOrder.name}
                  className="h-16 w-16 rounded-md border object-cover"
                />
              ) : (
                <div className="h-16 w-16 rounded-md border bg-gray-100" />
              )}
              <div className="min-w-0">
                <div className="font-semibold text-gray-900">{selectedOrder.name}</div>
                <div className="mt-1 text-xs text-gray-500">
                  Created: {selectedOrder.createdAt ? new Date(selectedOrder.createdAt).toLocaleString() : "-"}
                </div>
                <div className="mt-2">
                  <StatusBadge status={selectedOrder.status} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-md border bg-gray-50 p-2">
                <div className="text-xs text-gray-500">Product ID</div>
                <div className="font-medium">{selectedOrder.productId}</div>
              </div>
              <div className="rounded-md border bg-gray-50 p-2">
                <div className="text-xs text-gray-500">User ID</div>
                <div className="font-medium">{selectedOrder.userId}</div>
              </div>
              <div className="rounded-md border bg-gray-50 p-2">
                <div className="text-xs text-gray-500">Quantity</div>
                <div className="font-medium">{selectedOrder.quantity}</div>
              </div>
              <div className="rounded-md border bg-gray-50 p-2">
                <div className="text-xs text-gray-500">Unit Price</div>
                <div className="font-medium">BDT {Number(selectedOrder.price || 0).toFixed(2)}</div>
              </div>
            </div>

            {selectedOrder.productMeta ? (
              <div className="rounded-md border bg-white p-3">
                <div className="text-xs text-gray-500">Product Meta</div>
                <div className="mt-1 text-sm text-gray-700">
                  Category: {selectedOrder.productMeta.category || "-"} | Subcategory: {selectedOrder.productMeta.subCategory || "-"} | Stock: {selectedOrder.productMeta.stock} | Sold: {selectedOrder.productMeta.soldCount}
                </div>
              </div>
            ) : null}

            <div className="text-xs text-gray-500">Only admin can update status.</div>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}
