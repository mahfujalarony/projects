// MyStore.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useNavigationType } from "react-router-dom";
import { Modal, Form, Input, Button, message, Select, Tag, Pagination } from "antd";
import { EditOutlined } from "@ant-design/icons";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import  { API_BASE_URL } from "../../../config/env";
import { normalizeImageUrl } from "../../../utils/imageUrl";

const API_BASE = `${API_BASE_URL}`;

const moneyUSD = (v) => {
  if (v === null || v === undefined || v === "") return "";
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  return n.toFixed(2);
};

const firstImage = (images) => {
  if (!images) return "";
  if (Array.isArray(images) && images.length > 0) return images[0];
  if (typeof images === "string") return images;
  return "";
};

const normalizeKeywordList = (value) => {
  const input = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];

  const seen = new Set();
  const out = [];
  for (const item of input) {
    const k = String(item || "").trim().toLowerCase();
    if (!k || k.length > 40 || seen.has(k)) continue;
    seen.add(k);
    out.push(k);
    if (out.length >= 10) break;
  }
  return out;
};

const suggestKeywords = (item) => {
  const raw = [item?.name, item?.category, item?.subCategory]
    .filter(Boolean)
    .flatMap((v) => {
      const s = String(v || "").trim();
      return [
        s,
        ...s
          .toLowerCase()
          .replace(/[^a-z0-9\u0980-\u09ff\s-]/g, " ")
          .replace(/[-_]+/g, " ")
          .split(/\s+/)
          .filter(Boolean),
      ];
    });
  return normalizeKeywordList(raw);
};

const modules = {
  toolbar: [
    [{ header: [1, 2, false] }],
    ["bold", "italic", "underline", "strike"],
    [{ list: "ordered" }, { list: "bullet" }],
    ["link", "image"],
    ["clean"],
  ],
};
const formats = ["header", "bold", "italic", "underline", "strike", "list", "link", "image"];

export default function MyStore() {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({
    total: 0,
    page: 1,
    limit: 12,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const navigationType = useNavigationType();
  const isBackNav = navigationType === "POP";

        let saved = null;
      try {
        saved = JSON.parse(localStorage.getItem("userInfo") || "null");
      } catch {
        saved = null;
      }

      const token = saved?.token;

  // ✅ Initialize state from sessionStorage to persist pagination/search
  const [page, setPage] = useState(() => Number(sessionStorage.getItem("ms_page") || 1));
  const [limit, setLimit] = useState(() => Number(sessionStorage.getItem("ms_limit") || 12));
  const [searchInput, setSearchInput] = useState(() => sessionStorage.getItem("ms_search") || "");
  const [search, setSearch] = useState(() => sessionStorage.getItem("ms_search") || "");
  const scrollKey = `ms_scroll:${location.pathname}`;
  const [scrollRestored, setScrollRestored] = useState(false);
  const canPersistScrollRef = useRef(!isBackNav);

  useEffect(() => {
    sessionStorage.setItem("ms_page", page);
    sessionStorage.setItem("ms_limit", limit);
    sessionStorage.setItem("ms_search", search);
  }, [page, limit, search]);

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form] = Form.useForm();
  const [updating, setUpdating] = useState(false);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    p.set("page", String(page));
    p.set("limit", String(limit));
    if (search.trim()) p.set("search", search.trim());
    p.set("sortBy", "createdAt");
    p.set("order", "DESC");
    return p.toString();
  }, [page, limit, search]);

  const loadMyStore = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/merchant/store?${query}`, {
        method: "GET",
        credentials: "include",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const j = await r.json();

      if (!r.ok) {

        setRows([]);
        setMeta({ total: 0, page: 1, limit, totalPages: 1, hasNext: false, hasPrev: false });
        return;
      }

      setRows(j?.data || []);
      setMeta(j?.meta || { total: 0, page, limit, totalPages: 1, hasNext: false, hasPrev: page > 1 });
    } catch (e) {

      setRows([]);
      setMeta({ total: 0, page: 1, limit, totalPages: 1, hasNext: false, hasPrev: false });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = window.setTimeout(() => {
      // Only update and reset page if search actually changed
      if (searchInput !== search) {
        setSearch(searchInput);
        setPage(1);
      }
    }, 350);
    return () => window.clearTimeout(t);
  }, [searchInput, search]);

  useEffect(() => {
    loadMyStore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const totalPages = meta?.totalPages || 1;

  const handleProductClick = (id) => {
    sessionStorage.setItem("ms_page", String(page));
    sessionStorage.setItem("ms_limit", String(limit));
    sessionStorage.setItem("ms_search", search);
    sessionStorage.setItem(scrollKey, String(window.scrollY || 0));
    navigate(`/products/${id}`);
  };

  useEffect(() => {
    let timer = null;
    const onScroll = () => {
      if (!canPersistScrollRef.current) return;
      if (timer) return;
      timer = window.setTimeout(() => {
        timer = null;
        sessionStorage.setItem(scrollKey, String(window.scrollY || 0));
      }, 120);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (canPersistScrollRef.current) {
        sessionStorage.setItem(scrollKey, String(window.scrollY || 0));
      }
      if (timer) window.clearTimeout(timer);
    };
  }, [scrollKey]);

  useEffect(() => {
    if (!isBackNav || scrollRestored || loading) return;
    if (rows.length === 0) return;

    const y = Number(sessionStorage.getItem(scrollKey) || 0);
    if (Number.isFinite(y) && y > 0) {
      let attempts = 0;
      const maxAttempts = 18;
      const tryRestore = () => {
        attempts += 1;
        window.scrollTo({ top: y, behavior: "auto" });
        const current = window.scrollY || 0;
        const reached = Math.abs(current - y) < 80;
        if (!reached && attempts < maxAttempts) {
          window.setTimeout(tryRestore, 90);
        }
      };
      requestAnimationFrame(tryRestore);
    }
    canPersistScrollRef.current = true;
    setScrollRestored(true);
  }, [isBackNav, scrollRestored, loading, rows.length, scrollKey]);

  const onEditClick = (item) => {
    setEditingItem(item);
    form.setFieldsValue({
      name: item.name,
      description: item.description || "",
      keywords: normalizeKeywordList(item.keywords || suggestKeywords(item)),
    });
    setIsEditModalOpen(true);
  };

  const handleUpdate = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        ...values,
        keywords: normalizeKeywordList(values.keywords || []),
      };
      if ((payload.keywords || []).length > 10) throw new Error("Maximum 10 keywords allowed");
      setUpdating(true);
      
      const res = await fetch(`${API_BASE}/api/merchant/store/${editingItem.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const text = await res.text();
      let json;
      try {
        json = JSON.parse(text);
      } catch (e) {

        throw new Error("Server returned HTML instead of JSON. Check backend route.");
      }

      if (res.ok && json.success) {
        message.success("Product updated successfully");
        setIsEditModalOpen(false);
        setEditingItem(null);
        loadMyStore(); // Refresh list
      } else {
        message.error(json.message || "Update failed");
      }
    } catch (e) {

      message.error(e.message || "Something went wrong");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-3 py-2 sm:px-4 sm:py-3">
      {/* Top bar */}
      <div className="mb-3 rounded-xl border border-gray-200 bg-white p-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">My Store</h2>
            <p className="text-xs text-gray-500">Manage your products (view only)</p>
          </div>

          <div className="grid w-full grid-cols-2 gap-2 md:ml-auto md:flex md:w-auto md:grid-cols-none md:flex-row md:items-center">
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by name/category..."
              className="col-span-2 h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-gray-400 md:h-10 md:w-[280px]"
            />

            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-gray-400 md:h-10 md:w-[120px]"
            >
              {[8, 12, 16, 24].map((n) => (
                <option key={n} value={n}>
                  {n}/page
                </option>
              ))}
            </select>

            <div className="flex h-9 items-center rounded-md border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700 md:ml-2 md:h-10 md:whitespace-nowrap">
              Total: <span className="font-semibold">{meta?.total || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="rounded-md border border-gray-200 bg-white p-4 text-sm text-gray-700">
          Loading...
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-md border border-gray-200 bg-white p-4 text-sm text-gray-600">
          No products found in your store.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {rows.map((p) => {
            const img = firstImage(p.images);

            return (
              <div
                key={p.id}
                className="overflow-hidden rounded-xl border border-gray-200 bg-white hover:shadow-sm cursor-pointer"
                onClick={() => handleProductClick(p.id)}
              >
                {/* Image */}
                <div className="aspect-square w-full bg-gray-100">
                  {img ? (
                    <img src={normalizeImageUrl(img)} alt={p.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-gray-500">
                      No Image
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-3">
                  <div className="min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <div className="truncate text-sm font-semibold text-gray-900 flex-1">
                        {p.name}
                      </div>
                      <Button
                        type="text"
                        size="small"
                        icon={<EditOutlined />}
                        className="text-blue-600 hover:text-blue-800"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditClick(p);
                        }}
                      />
                    </div>
                    <div className="truncate text-xs text-gray-500">
                      {p.category || "-"}
                    </div>
                    {Array.isArray(p.keywords) && p.keywords.length > 0 ? (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {p.keywords.slice(0, 3).map((k) => (
                          <Tag key={k} style={{ marginInlineEnd: 0 }} color="blue">
                            {k}
                          </Tag>
                        ))}
                        {p.keywords.length > 3 ? (
                          <Tag style={{ marginInlineEnd: 0 }}>+{p.keywords.length - 3}</Tag>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-gray-900 whitespace-nowrap">
                      ${moneyUSD(p.price)}
                    </div>
                    <div className="text-xs font-medium text-gray-700 whitespace-nowrap">
                      Stock: {p.stock ?? 0}
                    </div>
                  </div>

                  <div className="mt-2 text-[11px] text-gray-400 truncate">
                    ProductId: {p.productId ?? "-"} â€¢ ID: {p.id}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {meta?.total > limit && (
        <div style={{ marginTop: 10, display: "flex", justifyContent: "center" }}>
          <Pagination
            size="small"
            current={page}
            pageSize={limit}
            total={meta?.total || 0}
            onChange={(p) => setPage(p)}
            showSizeChanger={false}
          />
        </div>
      )}

      {/* Edit Modal */}
      <Modal
        title="Edit Product Details"
        open={isEditModalOpen}
        onCancel={() => setIsEditModalOpen(false)}
        onOk={handleUpdate}
        confirmLoading={updating}
        okText="Update"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="Product Title"
            rules={[{ required: true, message: "Title is required" }]}
          >
            <Input placeholder="Enter product title" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <ReactQuill
              theme="snow"
              modules={modules}
              formats={formats}
              style={{ height: 200, marginBottom: 50 }}
            />
          </Form.Item>
          <Form.Item
            name="keywords"
            label="Keywords (max 10)"
            extra="Search/filter better korar jonno comma/tag diye add korun"
          >
            <Select
              mode="tags"
              tokenSeparators={[","]}
              maxTagCount={6}
              placeholder="e.g. gaming phone, budget, samsung"
              onChange={(vals) => {
                const clean = normalizeKeywordList(vals);
                if (vals.length > 10) message.warning("Maximum 10 keywords");
                form.setFieldValue("keywords", clean);
              }}
              options={normalizeKeywordList(suggestKeywords(editingItem || {})).map((k) => ({
                label: k,
                value: k,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
