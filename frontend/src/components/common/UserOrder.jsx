import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircleFilled } from "@ant-design/icons";
import { Popconfirm } from "antd";
import { API_BASE_URL } from "../../config/env";
import { normalizeImageUrl } from "../../utils/imageUrl";

const API_URL = API_BASE_URL;

const statusLabel = (s) =>
  ({
    pending: "Pending",
    processing: "Processing",
    shipped: "Shipped",
    delivered: "Delivered",
    cancelled: "Cancelled",
  }[s] || s);

const statusPill = (s) => {
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
};

const OrderStepper = ({ status }) => {
  const steps = ["pending", "processing", "shipped", "delivered"];
  const currentStep = steps.indexOf(status);

  if (status === "cancelled" || currentStep === -1) return null;

  return (
    <div className="mt-6 mb-8 w-full px-2 sm:px-4">
      <div className="relative flex items-center justify-between">
        {/* Background Line */}
        <div className="absolute left-0 top-1/2 h-1 w-full -translate-y-1/2 bg-gray-100 rounded-full"></div>

        {/* Active Line */}
        <div
          className="absolute left-0 top-1/2 h-1 -translate-y-1/2 bg-green-500 rounded-full transition-all duration-500"
          style={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
        ></div>

        {/* Steps */}
        {steps.map((step, index) => {
          const isCompleted = index <= currentStep;

          return (
            <div key={step} className="relative z-10 flex flex-col items-center">
              <div
                className={`flex h-6 w-6 sm:h-8 sm:w-8 items-center justify-center rounded-full border-2 transition-all duration-300 bg-white ${
                  isCompleted
                    ? "border-green-500 bg-green-500 text-white"
                    : "border-gray-200 text-gray-300"
                }`}
              >
                {isCompleted ? (
                  <CheckCircleFilled className="text-[10px] sm:text-sm" />
                ) : (
                  <div className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-gray-300" />
                )}
              </div>
              <span
                className={`absolute -bottom-6 text-[10px] sm:text-xs font-medium capitalize ${
                  isCompleted ? "text-green-700" : "text-gray-400"
                }`}
              >
                {step}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default function MyOrdersUser() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1, limit: 10 });
const getToken = () => {
  try {
    const saved = JSON.parse(localStorage.getItem("userInfo") || "null");
    return saved?.token || null;
  } catch {
    return null;
  }
};


  const query = useMemo(() => {
    const p = new URLSearchParams();
    p.set("page", page);
    p.set("limit", meta.limit);
    if (status) p.set("status", status);
    return p.toString();
  }, [page, status, meta.limit]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      setError("");
      const token = getToken();
      const res = await fetch(`${API_URL}/api/orders/my-orders?${query}`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
      });

      const data = await res.json();
      if (!res.ok || data.ok === false) {
        throw new Error(data.message || "Failed to load orders");
      }

      setRows(data.data || []);
      setMeta({
        total: data.total || 0,
        totalPages: data.totalPages || 1,
        limit: data.limit || 10,
      });
    } catch (e) {
      setError(e.message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const cancelOrder = async (orderId) => {
    // if (!window.confirm("Are you sure you want to cancel this order?")) return;
    //ant design pop confirm is better but let's keep it simple for now
    

    try {
      const token = getToken();

      const res = await fetch(`${API_URL}/api/orders/my-orders/${orderId}/cancel`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
      });

      const data = await res.json();
      if (!res.ok || data.ok === false) {
        throw new Error(data.message || "Cancel failed");
      }

      loadOrders(); // refresh
    } catch (e) {
      alert(e.message);
    }
  };

  useEffect(() => {
    loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  useEffect(() => {
    setPage(1);
  }, [status]);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-5">
      <h2 className="mb-3 text-lg font-semibold">My Orders</h2>

      {/* 🔍 Status Filter (ONLY filter) */}
      <div className="mb-4 flex max-w-xs flex-col gap-1">
        <label className="text-xs font-medium text-gray-600">Filter by status</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm"
        >
          <option value="">All</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="shipped">Shipped</option>
          <option value="delivered">Delivered</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {loading && <div className="p-4 text-sm">Loading...</div>}
      {error && <div className="p-4 text-sm text-red-600">{error}</div>}

      {/* 📦 Orders */}
      <div className="grid grid-cols-1 gap-3">
        {!loading && rows.length === 0 && (
          <div className="rounded-md border bg-white p-4 text-sm">
            No orders found
          </div>
        )}

        {rows.map((r) => (
          <div
            key={r.id}
            className="rounded-xl border border-gray-200 bg-white p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="truncate font-semibold">
                {r.name}
              </div>

              <span
                className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusPill(
                  r.status
                )}`}
              >
                {statusLabel(r.status)}
              </span>
            </div>

            {/* Stepper UI */}
            <OrderStepper status={r.status} />

            <div className="mt-1 text-xs text-gray-500">
              Qty: {Number(r.quantity || 0)} • ${Number(r.price || 0).toFixed(2)}
              {Number(r.deliveryCharge || 0) > 0 && (
                <span> • Delivery: ${Number(r.deliveryCharge || 0).toFixed(2)}</span>
              )}
            </div>

            <div className="mt-1 text-xs font-semibold text-gray-700">
              Total: ${Number((Number(r.price || 0) * Number(r.quantity || 0)) + Number(r.deliveryCharge || 0)).toFixed(2)}
            </div>

            <div className="mt-1 text-xs text-gray-500">
              Payment: {r.paymentMethod} •{" "}
              Paid
            </div>
            <div className="mt-2 flex items-center gap-3 rounded-lg border bg-gray-50 p-2">
              {r.imageUrl ? (
                <img
                  src={normalizeImageUrl(r.imageUrl)}
                  alt={r.name}
                  className="h-14 w-14 rounded-md border object-cover"
                />
              ) : (
                <div className="h-14 w-14 rounded-md border bg-gray-100" />
              )}
              <div className="min-w-0 text-xs text-gray-600">
                <div className="font-semibold text-gray-900 truncate">{r.name}</div>
                <div>Unit: ${Number(r.price || 0).toFixed(2)}</div>
                <div>Qty: {Number(r.quantity || 0)}</div>
              </div>
            </div>
            {r.trackingNumber ? (
              <div className="mt-1 text-xs text-indigo-700">
                Tracking: <b>{r.trackingNumber}</b>
                {r.trackingNote ? <span className="text-gray-600"> ({r.trackingNote})</span> : null}
              </div>
            ) : null}

            <div className="mt-1 text-xs text-gray-500">
              Ordered: {new Date(r.createdAt).toLocaleString()}
            </div>

            {/* ❌ Cancel button — RIGHT PLACE */}
            {r.status === "pending" && (
              <Popconfirm
                title="Cancel this order?"
                okText="Yes, cancel"
                cancelText="No"
                onConfirm={() => cancelOrder(r.id)}
              >
                <button
                  className="mt-3 h-9 rounded-full border border-red-200 bg-red-50 px-4 text-xs font-semibold text-red-700 hover:bg-red-100"
                >
                  Cancel Order
                </button>
              </Popconfirm>
            )}

            {/* ✅ Review Prompt for Delivered Orders */}
            {r.status === "delivered" && (
              <div className="mt-3 rounded-lg border border-indigo-100 bg-indigo-50 p-3 text-center">
                <p className="mb-2 text-xs font-medium text-indigo-800">
                  How was the product? Share your review!
                </p>
                <Link
                  to={`/products/${r.productId}`}
                  className="block w-full rounded-md bg-indigo-600 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
                >
                  Write a Review
                </Link>
              </div>
            )}
          </div>
        ))}
      </div>


      {/* Pagination */}
      <div className="mt-4 flex items-center gap-2 text-sm">
        <button
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          className="rounded-md border px-3 py-1 disabled:opacity-50"
        >
          Prev
        </button>

        <span>
          Page <b>{page}</b> / <b>{meta.totalPages}</b>
        </span>

        <button
          disabled={page >= meta.totalPages}
          onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
          className="rounded-md border px-3 py-1 disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}
