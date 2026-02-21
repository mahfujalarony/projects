import React, { useEffect, useMemo, useState } from "react";
import { Button, Card, Input, message, Pagination, Select, Spin, Tag, Grid, Modal, Empty, Tooltip, InputNumber } from "antd";
import { EyeOutlined } from "@ant-design/icons";
import { normalizeImageUrl } from "../../../utils/imageUrl";
import { API_BASE_URL } from "../../../config/env";


const API_CATEGORIES = `${API_BASE_URL}/api/categories`;
const API_BALANCE = `${API_BASE_URL}/api/merchant/me/balance`;
const API_ADMIN_PRODUCTS = `${API_BASE_URL}/api/merchant/admin-products`;
const API_PICK = `${API_BASE_URL}/api/merchant/store/pick`;

const { useBreakpoint } = Grid;

const LIMIT = 12;

const getToken = () => {
  try {
    return JSON.parse(localStorage.getItem("userInfo") || "null")?.token || null;
  } catch {
    return null;
  }
};

const MerchantPickProducts = () => {
  const screens = useBreakpoint();
  const isMd = !!screens.md;

  const [balance, setBalance] = useState(0);
  const [balLoading, setBalLoading] = useState(false);

  const [categories, setCategories] = useState([]);
  const [catLoading, setCatLoading] = useState(false);

  const [catSlug, setCatSlug] = useState(null);
  const [subSlug, setSubSlug] = useState(null);
  const [search, setSearch] = useState("");

  const [products, setProducts] = useState([]);
  const [prodLoading, setProdLoading] = useState(false);

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  // per-product selected qty
  const [qtyMap, setQtyMap] = useState({}); // { [productId]: qty }
  const [pickingId, setPickingId] = useState(null);

  // View Modal
  const [viewOpen, setViewOpen] = useState(false);
  const [viewProduct, setViewProduct] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);

  const loadBalance = async () => {
    setBalLoading(true);
    try {
      const token = getToken();
      if (!token) throw new Error("Please login first");

      const res = await fetch(API_BALANCE, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || "Balance load failed");
      setBalance(Number(json?.data?.balance || 0));
    } catch (e) {
      console.error(e);
      message.error(e.message || "Balance load failed");
    } finally {
      setBalLoading(false);
    }
  };

  const loadCategories = async () => {
    setCatLoading(true);
    try {
      const res = await fetch(API_CATEGORIES);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || "Category load failed");
      setCategories(Array.isArray(json) ? json : []);
    } catch (e) {
      console.error(e);
      message.error(e.message || "Category load failed");
      setCategories([]);
    } finally {
      setCatLoading(false);
    }
  };

  const loadProducts = async () => {
    setProdLoading(true);
    try {
      const token = getToken();
      if (!token) throw new Error("Please login first");

      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(LIMIT));
      if (catSlug) params.set("category", catSlug);
      if (subSlug) params.set("subCategory", subSlug);
      if (search.trim()) params.set("search", search.trim());

      const res = await fetch(`${API_ADMIN_PRODUCTS}?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || "Product load failed");

      const list = Array.isArray(json?.data) ? json.data : [];
      setProducts(list);
      setTotal(Number(json?.meta?.total || 0));
    } catch (e) {
      console.error(e);
      message.error(e.message || "Product load failed");
      setProducts([]);
      setTotal(0);
    } finally {
      setProdLoading(false);
    }
  };

  useEffect(() => {
    loadBalance();
    loadCategories();
  }, []);

  useEffect(() => {
    setSubSlug(null);
    setPage(1);
  }, [catSlug]);

  useEffect(() => {
    setPage(1);
  }, [subSlug]);

  useEffect(() => {
    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, catSlug, subSlug]);

  const currentCat = useMemo(
    () => (categories || []).find((c) => c?.slug === catSlug) || null,
    [categories, catSlug]
  );

  const subCategories = useMemo(() => {
    const arr = currentCat?.subCategories || [];
    return Array.isArray(arr) ? arr.filter((s) => s?.isActive !== false) : [];
  }, [currentCat]);

  const canAfford = (product, qty) => {
    const unit = Number(product?.price || 0);
    return balance >= unit * qty;
  };

  const canStock = (product, qty) => Number(product?.stock || 0) >= qty;

  const handlePick = async (product) => {
    const pid = product.id;
    const qty = Number(qtyMap[pid] || 1);
    const cost = Number(product.price || 0) * qty;
    const remaining = balance - cost;

    if (!canStock(product, qty)) return message.error("Admin stock enough না");
    if (!canAfford(product, qty)) return message.error("Balance কম");

    Modal.confirm({
      title: "Confirm Purchase",
      content: (
        <div>
          <p>Are you sure you want to add this to your store?</p>
          <div style={{ marginTop: 10 }}>
            <div>Current Balance: <b>৳{balance.toLocaleString()}</b></div>
            <div>Total Cost: <b style={{ color: "red" }}>৳{cost.toLocaleString()}</b></div>
            <div style={{ borderTop: "1px solid #eee", marginTop: 5, paddingTop: 5 }}>
              Remaining Balance: <b style={{ color: "green" }}>৳{remaining.toLocaleString()}</b>
            </div>
          </div>
        </div>
      ),
      onOk: async () => {
        setPickingId(pid);
        try {
          const token = getToken();
          if (!token) throw new Error("Please login first");

          const res = await fetch(API_PICK, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ productId: pid, qty }),
          });
          const json = await res.json();
          if (!res.ok) throw new Error(json?.message || "Pick failed");

          message.success("Added to your store");

          // ✅ refresh balance + products
          await loadBalance();
          await loadProducts();

          // reset qty for that product
          setQtyMap((m) => ({ ...m, [pid]: 1 }));
        } catch (e) {
          console.error(e);
          message.error(e.message || "Pick failed");
        } finally {
          setPickingId(null);
        }
      },
    });
  };

  const onSearch = () => {
    setPage(1);
    loadProducts();
  };

  const openView = async (product) => {
    setViewOpen(true);
    setViewProduct(null);
    setViewLoading(true);
    try {
      const token = getToken();
      const res = await fetch(`${API_ADMIN_PRODUCTS}/${product.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success && json.data) {
        setViewProduct(json.data);
      } else {
        message.error("Failed to load details");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setViewLoading(false);
    }
  };

  return (
    <div style={{ padding: isMd ? 12 : 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
        <div>
          <div style={{ fontSize: isMd ? 18 : 16, fontWeight: 800 }}>Pick Products (Admin Stock)</div>
          <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>
            Balance:{" "}
            {balLoading ? (
              <Spin size="small" />
            ) : (
              <Tag color="green" style={{ marginRight: 0 }}>
                ৳{Number(balance || 0).toLocaleString()}
              </Tag>
            )}
          </div>
        </div>

        <div style={{ fontSize: 12, color: "#666" }}>{prodLoading ? "Loading..." : `${total} items`}</div>
      </div>

      {/* Filters */}
      <div style={{ marginTop: 10, display: "grid", gap: 8, gridTemplateColumns: isMd ? "1fr 1fr 1.2fr auto" : "1fr" }}>
        <Select
          size="small"
          loading={catLoading}
          placeholder="Category"
          value={catSlug}
          onChange={(v) => setCatSlug(v || null)}
          allowClear
          options={(categories || [])
            .filter((c) => c?.isActive !== false)
            .map((c) => ({ label: c.name, value: c.slug }))}
        />
        <Select
          size="small"
          placeholder="Subcategory"
          value={subSlug}
          onChange={(v) => setSubSlug(v || null)}
          allowClear
          disabled={!catSlug || subCategories.length === 0}
          options={subCategories.map((s) => ({ label: s.name, value: s.slug }))}
        />
        <Input size="small" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} onPressEnter={onSearch} />
        <Button size="small" onClick={onSearch}>
          Search
        </Button>
      </div>

      {/* Grid */}
      <div style={{ marginTop: 10 }}>
        {prodLoading ? (
          <div style={{ padding: 18, display: "grid", placeItems: "center" }}>
            <Spin />
          </div>
        ) : products.length === 0 ? (
          <div style={{ padding: 18, textAlign: "center", color: "#666" }}>No products</div>
        ) : (
          <div
            style={{
              display: "grid",
              gap: 8,
              gridTemplateColumns: isMd ? "repeat(4, minmax(0, 1fr))" : "repeat(2, minmax(0, 1fr))",
            }}
          >
            {products.map((p) => {
              const pid = p.id;
              const selectedQty = Number(qtyMap[pid] || 1);

              return (
                <Card
                  key={pid}
                  size="small"
                  styles={{ body: { padding: 10 } }}
                  style={{ borderRadius: 12 }}
                >
                  <div 
                    style={{ width: "100%", aspectRatio: "1/1", background: "#f5f5f5", borderRadius: 10, overflow: "hidden", cursor: "pointer" }}
                    onClick={() => openView(p)}
                  >
                    <img
                      src={normalizeImageUrl(p.images?.[0]) || "https://via.placeholder.com/400"}
                      alt={p.name}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      loading="lazy"
                    />
                  </div>

                  <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "start", gap: 4 }}>
                    <div 
                      style={{ fontWeight: 800, fontSize: 13, lineHeight: "16px", flex: 1, cursor: "pointer" }}
                      onClick={() => openView(p)}
                    >
                      {p.name}
                    </div>
                    <Tooltip title="View Details">
                      <Button 
                        size="small" 
                        icon={<EyeOutlined />} 
                        type="text" 
                        onClick={() => openView(p)} 
                      />
                    </Tooltip>
                  </div>

                  <div style={{ marginTop: 6, display: "flex", justifyContent: "space-between", fontSize: 12, color: "#444" }}>
                    <span style={{ fontWeight: 800 }}>৳{Number(p.price || 0).toLocaleString()}</span>
                    <span>Stock: {p.stock ?? 0}</span>
                  </div>

                  <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
                    <InputNumber
                      size="small"
                      min={1}
                      max={p.stock}
                      value={selectedQty}
                      style={{ width: 88 }}
                      onChange={(v) => setQtyMap((m) => ({ ...m, [pid]: Number(v) }))}
                    />
                    <Button
                      size="small"
                      type="primary"
                      block
                      loading={pickingId === pid}
                      disabled={!canStock(p, selectedQty) || !canAfford(p, selectedQty)}
                      onClick={() => handlePick(p)}
                    >
                      Pick
                    </Button>
                  </div>

                  <div style={{ marginTop: 6, fontSize: 11, color: "#777" }}>
                    Cost: ৳{(Number(p.price || 0) * selectedQty).toLocaleString()}
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {total > LIMIT && (
          <div style={{ marginTop: 10, display: "flex", justifyContent: "center" }}>
            <Pagination size="small" current={page} pageSize={LIMIT} total={total} onChange={(p) => setPage(p)} showSizeChanger={false} />
          </div>
        )}
      </div>

      {/* View Details Modal */}
      <Modal
        open={viewOpen}
        title={viewProduct?.name || "Product Details"}
        onCancel={() => setViewOpen(false)}
        footer={null}
        width={700}
        centered
      >
        {viewLoading ? (
          <div style={{ textAlign: "center", padding: 40 }}>
            <Spin size="large" />
          </div>
        ) : viewProduct ? (
          <div>
            {/* Images */}
            <div style={{ marginBottom: 20 }}>
              <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Images</h4>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {(Array.isArray(viewProduct.images) ? viewProduct.images : [viewProduct.imageUrl]).flat().filter(Boolean).map((img, i) => (
                  <div key={i} style={{ width: 100, height: 100, border: "1px solid #eee", borderRadius: 8, overflow: "hidden" }}>
                    <img 
                      src={normalizeImageUrl(img)} 
                      alt="" 
                      style={{ width: "100%", height: "100%", objectFit: "cover" }} 
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Description */}
            <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Description</h4>
            <div 
              style={{ background: "#f9f9f9", padding: 15, borderRadius: 8, fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}
              dangerouslySetInnerHTML={{ __html: viewProduct.description || "No description available." }}
            />

            {/* Extra Info */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 13 }}>
              <div style={{ background: "#fff", border: "1px solid #eee", padding: 8, borderRadius: 6 }}>
                <span style={{ color: "#888" }}>Category:</span> <strong>{viewProduct.category || "N/A"}</strong>
              </div>
              <div style={{ background: "#fff", border: "1px solid #eee", padding: 8, borderRadius: 6 }}>
                <span style={{ color: "#888" }}>Subcategory:</span> <strong>{viewProduct.subCategory || "N/A"}</strong>
              </div>
              <div style={{ background: "#fff", border: "1px solid #eee", padding: 8, borderRadius: 6 }}>
                <span style={{ color: "#888" }}>Price:</span> <strong>৳{Number(viewProduct.price || 0).toLocaleString()}</strong>
              </div>
              <div style={{ background: "#fff", border: "1px solid #eee", padding: 8, borderRadius: 6 }}>
                <span style={{ color: "#888" }}>Stock:</span> <strong>{viewProduct.stock}</strong>
              </div>
            </div>
          </div>
        ) : (
          <Empty description="No details found" />
        )}
      </Modal>
    </div>
  );
};

export default MerchantPickProducts;
