import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, Input, message, Pagination, Select, Spin, Tag, Grid, Modal, Empty, Tooltip, InputNumber, TreeSelect } from "antd";
import { EyeOutlined } from "@ant-design/icons";
import { normalizeImageUrl } from "../../../utils/imageUrl";
import { API_BASE_URL } from "../../../config/env";


const API_CATEGORIES = `${API_BASE_URL}/api/categories`;
const API_BALANCE = `${API_BASE_URL}/api/merchant/me/balance`;
const API_ADMIN_PRODUCTS = `${API_BASE_URL}/api/merchant/admin-products`;
const API_PICK = `${API_BASE_URL}/api/merchant/store/pick`;

const { useBreakpoint } = Grid;

const LIMIT = 20;
const CATEGORY_CACHE_KEY = "merchant:categories:v1";
const CATEGORY_CACHE_TTL = 1000 * 60 * 10;

const readCategoryCache = () => {
  try {
    const raw = sessionStorage.getItem(CATEGORY_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.ts || !Array.isArray(parsed?.data)) return null;
    if (Date.now() - Number(parsed.ts) > CATEGORY_CACHE_TTL) return null;
    return parsed.data;
  } catch {
    return null;
  }
};

const writeCategoryCache = (list) => {
  try {
    sessionStorage.setItem(
      CATEGORY_CACHE_KEY,
      JSON.stringify({
        ts: Date.now(),
        data: Array.isArray(list) ? list : [],
      })
    );
  } catch {
    // ignore
  }
};

const getNodeChildren = (node) => {
  if (Array.isArray(node?.children)) return node.children;
  if (Array.isArray(node?.subCategories)) return node.subCategories;
  return [];
};

const findNodeBySlug = (nodes = [], slug = "") => {
  const target = String(slug || "").trim();
  if (!target) return null;
  for (const node of Array.isArray(nodes) ? nodes : []) {
    if (String(node?.slug || "").trim() === target) return node;
    const found = findNodeBySlug(getNodeChildren(node), target);
    if (found) return found;
  }
  return null;
};

const collectDescendantSlugs = (node) => {
  const out = [];
  const walk = (n) => {
    if (!n) return;
    const slug = String(n?.slug || "").trim();
    if (slug) out.push(slug);
    const children = getNodeChildren(n);
    for (const child of children) walk(child);
  };
  walk(node);
  return [...new Set(out)];
};

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
  const isMobile = !screens.md;
  const isSm = !!screens.sm;
  const isXl = !!screens.xl;

  const [balance, setBalance] = useState(0);
  const [balLoading, setBalLoading] = useState(false);

  const [categories, setCategories] = useState([]);
  const categoriesRef = useRef([]);
  const [catLoading, setCatLoading] = useState(false);

  const [catSlug, setCatSlug] = useState(null);
  const [subSlug, setSubSlug] = useState(null);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");

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
  const productsReqRef = useRef(0);

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
      message.error(e.message || "Balance load failed");
    } finally {
      setBalLoading(false);
    }
  };

  const loadCategories = async () => {
    const cached = readCategoryCache();
    setCatLoading(true);
    try {
      // also prime ref from cache so loadProducts can use it immediately
      if (cached?.length) {
        setCategories(cached);
        categoriesRef.current = cached;
        setCatLoading(false);
      }
      const res = await fetch(API_CATEGORIES);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || "Category load failed");
      const next = Array.isArray(json) ? json : [];
      setCategories(next);
      categoriesRef.current = next;
      writeCategoryCache(next);
    } catch (e) {

      message.error(e.message || "Category load failed");
      if (!cached?.length) setCategories([]);
    } finally {
      setCatLoading(false);
    }
  };

  const loadProducts = async ({ silent = false } = {}) => {
    const requestId = ++productsReqRef.current;
    if (!silent) setProdLoading(true);
    try {
      const token = getToken();
      if (!token) throw new Error("Please login first");

      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(LIMIT));
      if (catSlug) {
        params.set("category", catSlug);
        const cats = categoriesRef.current;
        const selectedCategory = cats.find((c) => String(c?.slug || "").trim() === String(catSlug).trim());
        const categoryDescendants = collectDescendantSlugs(selectedCategory);
        if (categoryDescendants.length) {
          params.set("categoryScopes", categoryDescendants.join(","));
        }
      }
      if (subSlug) {
        params.set("subCategory", subSlug);
        const cats = categoriesRef.current;
        const selectedCategory = cats.find((c) => String(c?.slug || "").trim() === String(catSlug).trim());
        const selectedSubNode = findNodeBySlug(getNodeChildren(selectedCategory), subSlug);
        const subDescendants = collectDescendantSlugs(selectedSubNode);
        if (subDescendants.length) {
          params.set("subCategoryScopes", subDescendants.join(","));
        }
      }
      if (appliedSearch.trim()) params.set("search", appliedSearch.trim());

      const res = await fetch(`${API_ADMIN_PRODUCTS}?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || "Product load failed");
      if (requestId !== productsReqRef.current) return;

      const list = Array.isArray(json?.data) ? json.data : [];
      setProducts(list);
      setTotal(Number(json?.meta?.total || 0));
    } catch (e) {
      if (requestId !== productsReqRef.current) return;

      message.error(e.message || "Product load failed");
      setProducts([]);
      setTotal(0);
    } finally {
      if (requestId === productsReqRef.current) {
        setProdLoading(false);
      }
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
  }, [page, catSlug, subSlug, appliedSearch]);

  const currentCat = useMemo(
    () => (categories || []).find((c) => c?.slug === catSlug) || null,
    [categories, catSlug]
  );

  const selectedCategorySubTreeOptions = useMemo(() => {
    const mapSubTree = (nodes = [], parentPath = "") =>
      (Array.isArray(nodes) ? nodes : [])
        .filter((n) => n?.isActive !== false)
        .map((n) => {
          const slug = String(n?.slug || "").trim();
          const path = parentPath ? `${parentPath}/${slug || n?.id || "node"}` : (slug || String(n?.id || "node"));
          return {
            title: n?.name || "Subcategory",
            value: slug,
            key: `sub:${path}`,
            children: mapSubTree(getNodeChildren(n), path),
          };
        })
        .filter((n) => Boolean(n.value));

    if (!currentCat?.slug) return [];
    return mapSubTree(getNodeChildren(currentCat));
  }, [currentCat]);

  const getPickCharge = (product, qty) => {
    const fullCost = Number(product?.price || 0) * Number(qty || 0);
    return Number((fullCost * 0.5).toFixed(2));
  };

  const canAfford = (product, qty) => {
    return balance >= getPickCharge(product, qty);
  };

  const canStock = (product, qty) => Number(product?.stock || 0) >= qty;

  const clampQtyByStock = (value, stock) => {
    const maxStock = Math.max(0, Number(stock || 0));
    if (maxStock <= 0) return 0;
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 1;
    return Math.min(maxStock, Math.max(1, Math.floor(numeric)));
  };

  const handlePick = async (product) => {
    const pid = product.id;
    const qty = clampQtyByStock(qtyMap[pid] || 1, product?.stock);
    if (qtyMap[pid] !== qty) {
      setQtyMap((m) => ({ ...m, [pid]: qty }));
    }
    const unitPrice = Number(product.price || 0);
    const fullCost = unitPrice * qty;
    const charge = getPickCharge(product, qty);
    const remaining = balance - charge;

    if (!canStock(product, qty)) return message.error("Admin stock enough না");
    if (!canAfford(product, qty)) return message.error("Balance কম");

    Modal.confirm({
      title: "Confirm Purchase",
      content: (
        <div>
          <p>Are you sure you want to add this to your store?</p>
          <div style={{ marginTop: 10 }}>
            <div>Current Balance: <b>${Number(balance || 0).toFixed(2)}</b></div>
            <div>
              Quantity: <b>{qty}</b>
            </div>
            <div>
              Unit Price: <b>${Number(unitPrice || 0).toFixed(2)}</b>
            </div>
            <div>
              Product Total: <b>{qty} x ${Number(unitPrice || 0).toFixed(2)} = ${Number(fullCost || 0).toFixed(2)}</b>
            </div>
            <div>Charge (50%): <b style={{ color: "red" }}>${Number(charge || 0).toFixed(2)}</b></div>
            <div style={{ borderTop: "1px solid #eee", marginTop: 5, paddingTop: 5 }}>
              Remaining Balance: <b style={{ color: "green" }}>${Number(remaining || 0).toFixed(2)}</b>
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

          // ✅ refresh balance + products (silent = no spinner flicker)
          await loadBalance();
          await loadProducts({ silent: true });

          // reset qty for that product
          setQtyMap((m) => ({ ...m, [pid]: 1 }));
        } catch (e) {
          message.error(e.message || "Pick failed");
        } finally {
          setPickingId(null);
        }
      },
    });
  };


  const onSearch = () => {
    setPage(1);
    setAppliedSearch(search);
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

    } finally {
      setViewLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: isMd ? 8 : 4 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 6,
          alignItems: isMd ? "center" : "stretch",
          flexDirection: isMd ? "row" : "column",
        }}
      >
        <div>
          <div style={{ fontSize: isMd ? 17 : 15, fontWeight: 800, lineHeight: 1.2 }}>Pick Products (Admin Stock)</div>
          <div
            style={{
              fontSize: 11,
              color: "#666",
              marginTop: 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 6,
              flexWrap: "wrap",
            }}
          >
            <div>
              Balance:{" "}
              {balLoading ? (
                <Spin size="small" />
              ) : (
                <Tag color="green" style={{ marginRight: 0 }}>
                  ${Number(balance || 0).toFixed(2)}
                </Tag>
              )}
            </div>
            <div style={{ whiteSpace: "nowrap" }}>{prodLoading ? "Loading..." : `${total} items`}</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div
        style={{
          marginTop: 6,
          display: "grid",
          gap: 4,
          gridTemplateColumns: isMd ? "1fr 1fr 1.2fr auto" : "1fr 1fr",
          alignItems: "center",
          padding: isMd ? 8 : 6,
          border: "1px solid #f0f0f0",
          borderRadius: 10,
          background: "#fff",
        }}
      >
        <Select
          size="middle"
          loading={catLoading}
          placeholder="Category"
          value={catSlug}
          onChange={(v) => setCatSlug(v || null)}
          allowClear
          style={{ minWidth: 0 }}
          options={(categories || [])
            .filter((c) => c?.isActive !== false)
            .map((c) => ({ label: c.name, value: c.slug }))}
        />
        <TreeSelect
          size="middle"
          placeholder="Subcategory"
          value={subSlug || undefined}
          onChange={(v) => setSubSlug(v || null)}
          treeData={selectedCategorySubTreeOptions}
          treeDefaultExpandAll
          allowClear
          showSearch
          disabled={!catSlug || selectedCategorySubTreeOptions.length === 0}
          style={{ minWidth: 0, width: "100%" }}
        />
        {isMobile ? (
          <Input.Search
            size="middle"
            placeholder="Search..."
            allowClear
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onSearch={onSearch}
            style={{ gridColumn: "1 / -1" }}
          />
        ) : (
          <>
            <Input
              size="middle"
              placeholder="Search..."
              allowClear
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onPressEnter={onSearch}
            />
            <Button size="middle" onClick={onSearch}>
              Search
            </Button>
          </>
        )}
      </div>

      {/* Grid */}
      <div style={{ marginTop: 8 }}>
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
              gridTemplateColumns: isXl
                ? "repeat(5, minmax(0, 1fr))"
                : isMd
                  ? "repeat(4, minmax(0, 1fr))"
                  : isSm
                    ? "repeat(3, minmax(0, 1fr))"
                    : "repeat(2, minmax(0, 1fr))",
            }}
          >
            {products.map((p) => {
              const pid = p.id;
              const selectedQty = Number(qtyMap[pid] || 1);
              const inStoreQty = Number(p?.merchantStoreQty || 0);
              const isInStore = inStoreQty > 0;

              return (
                <Card
                  key={pid}
                  size="small"
                  styles={{ body: { padding: 8 } }}
                  style={{
                    borderRadius: 12,
                    border: isInStore ? "1px solid #22c55e" : "1px solid #f0f0f0",
                    boxShadow: isInStore ? "0 0 0 2px rgba(34, 197, 94, 0.15)" : "none",
                  }}
                >
                  {isInStore && (
                    <div style={{ marginBottom: 6 }}>
                      <Tag color="green" style={{ marginRight: 0, fontSize: 11, fontWeight: 700 }}>
                        IN YOUR STORE: {inStoreQty}
                      </Tag>
                    </div>
                  )}

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
                      style={{
                        fontWeight: 800,
                        fontSize: 13,
                        lineHeight: "16px",
                        flex: 1,
                        cursor: "pointer",
                        display: "-webkit-box",
                        WebkitLineClamp: isMobile ? 1 : 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
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
                    <span style={{ fontWeight: 800 }}>${Number(p.price || 0).toFixed(2)}</span>
                    <span>Stock: {p.stock ?? 0}</span>
                  </div>

                  {isInStore && (
                    <div style={{ marginTop: 4, fontSize: 11, color: "#15803d", fontWeight: 600 }}>
                      You already have {inStoreQty} in your store
                    </div>
                  )}

                  <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
                    <InputNumber
                      size="small"
                      min={p.stock > 0 ? 1 : 0}
                      max={p.stock}
                      value={selectedQty}
                      disabled={Number(p?.stock || 0) <= 0}
                      style={{ width: 88 }}
                      onChange={(v) => {
                        const clamped = clampQtyByStock(v, p?.stock);
                        setQtyMap((m) => ({ ...m, [pid]: clamped }));
                      }}
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
                    Charge (50%): ${getPickCharge(p, selectedQty).toFixed(2)}
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
                <span style={{ color: "#888" }}>Price:</span> <strong>${Number(viewProduct.price || 0).toFixed(2)}</strong>
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
