import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { API_BASE_URL } from "../../../../config/env";
import { normalizeImageUrl } from "../../../../utils/imageUrl";

const API = `${API_BASE_URL}`;

const money = (v) => {
  const n = Number(v || 0);
  return Number.isNaN(n) ? "0.00" : n.toFixed(2);
};

const firstImage = (images) => {
  if (!images) return "";
  if (Array.isArray(images) && images.length) return images[0];
  if (typeof images === "string") return images;
  return "";
};

export default function MerchantPickProducts({ mainCategory }) {
  const { slug } = useParams();
  const categorySlug = (mainCategory || slug || "").trim().toLowerCase();

  const [balance, setBalance] = useState(0);
  const [search, setSearch] = useState("");
  const [qty, setQty] = useState(1);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(12);

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1 });

  useEffect(() => setPage(1), [categorySlug, search, limit]);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (categorySlug) p.set("category", categorySlug);
    if (search.trim()) p.set("search", search.trim());
    p.set("page", String(page));
    p.set("limit", String(limit));
    return p.toString();
  }, [categorySlug, search, page, limit]);

  const loadBalance = async () => {
    const r = await fetch(`${API}/api/merchant/me/balance`, { credentials: "include" });
    const j = await r.json();
    setBalance(Number(j?.data?.balance || 0));
  };

  const loadProducts = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/merchant/admin-products?${query}`, { credentials: "include" });
      const j = await r.json();
      setRows(j?.data || []);
      setMeta(j?.meta || { total: 0, totalPages: 1 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBalance();
  }, []);

  useEffect(() => {
    loadProducts();
  }, [query]);

  const pick = async (productId) => {
    const r = await fetch(`${API}/api/merchant/store/pick`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ productId, qty }),
    });

    const j = await r.json();
    if (!r.ok) {
      alert(j?.message || "Failed");
      return;
    }

    // refresh both
    await loadBalance();
    await loadProducts();
  };

  const totalPages = meta?.totalPages || 1;

  return (
    <div style={{ padding: 10 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ fontWeight: 700 }}>Balance: $ {money(balance)}</div>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search..."
          style={{ padding: 7, border: "1px solid #ddd", borderRadius: 8, flex: "1 1 200px" }}
        />

        <select value={qty} onChange={(e) => setQty(Number(e.target.value))} style={{ padding: 7, borderRadius: 8 }}>
          {[1, 3, 5].map((n) => (
            <option key={n} value={n}>
              Qty {n}
            </option>
          ))}
        </select>

        <select value={limit} onChange={(e) => setLimit(Number(e.target.value))} style={{ padding: 7, borderRadius: 8 }}>
          {[12, 24, 36].map((n) => (
            <option key={n} value={n}>
              {n}/page
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginTop: 8, fontSize: 12, color: "#666", display: "flex", justifyContent: "space-between" }}>
        <div>Total: {meta?.total || 0}</div>
        <div>
          Page {page}/{totalPages}
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 12 }}>Loading...</div>
      ) : (
        <div
          style={{
            marginTop: 10,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
            gap: 10,
          }}
        >
          {rows.map((p) => {
            const img = firstImage(p.images);
            const unit = Number(p.price || 0);
            const cost = unit * qty;

            const notEnoughBalance = balance < cost;
            const notEnoughStock = (p.stock || 0) < qty;

            return (
              <div
                key={p.id}
                style={{
                  border: "1px solid #e6e6e6",
                  borderRadius: 10,
                  overflow: "hidden",
                  background: "#fff",
                }}
              >
                <div style={{ height: 110, background: "#f2f2f2" }}>
                  {img ? (
                    <img src={normalizeImageUrl(img)} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : null}
                </div>

                <div style={{ padding: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, lineHeight: "16px", height: 32, overflow: "hidden" }}>
                    {p.name}
                  </div>

                  <div style={{ fontSize: 12, color: "#555", marginTop: 4 }}>
                    $ {money(p.price)}{" "}
                    {p.oldPrice ? (
                      <span style={{ textDecoration: "line-through", color: "#999" }}>$ {money(p.oldPrice)}</span>
                    ) : null}
                  </div>

                  <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
                    Stock: {p.stock} • Cost({qty}): $ {money(cost)}
                  </div>

                  <button
                    onClick={() => pick(p.id)}
                    disabled={notEnoughBalance || notEnoughStock}
                    style={{
                      marginTop: 8,
                      width: "100%",
                      padding: "8px 10px",
                      border: "none",
                      borderRadius: 8,
                      cursor: notEnoughBalance || notEnoughStock ? "not-allowed" : "pointer",
                      background: notEnoughBalance || notEnoughStock ? "#cfcfcf" : "#0d6efd",
                      color: "#fff",
                      fontWeight: 700,
                    }}
                    title={
                      notEnoughStock
                        ? "Admin stock not enough"
                        : notEnoughBalance
                        ? "Insufficient balance"
                        : "Add to my store"
                    }
                  >
                    Add to My Store
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
        <button disabled={page <= 1} onClick={() => setPage((x) => Math.max(1, x - 1))}>
          Prev
        </button>
        <button disabled={page >= totalPages} onClick={() => setPage((x) => Math.min(totalPages, x + 1))}>
          Next
        </button>
      </div>
    </div>
  );
}
