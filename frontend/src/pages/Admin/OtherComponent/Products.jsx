import React, { useEffect, useMemo, useState } from "react";
import {
  Button,
  Empty,
  Input,
  Modal,
  Pagination,
  Popconfirm,
  Select,
  Spin,
  Table,
  Tag,
  message,
  Grid,
  Row,
  Col,
  Form,
  InputNumber,
  Upload,
} from "antd";
import {
  DeleteOutlined,
  EditOutlined,
  UploadOutlined,
  EyeOutlined,
  FilterOutlined,
  UpOutlined,
  DownOutlined,
  InfoCircleOutlined,
} from "@ant-design/icons";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import { normalizeImageUrl } from "../../../utils/imageUrl";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../../../config/env";
import { UPLOAD_BASE_URL } from "../../../config/env";

const API_CATEGORIES = `${API_BASE_URL}/api/categories`;
const API_ADMIN_PRODUCTS = `${API_BASE_URL}/api/admin/products`;
const UPLOAD_URL = `${UPLOAD_BASE_URL}/upload/image`;

const buildProductUploadUrl = ({ subCategory, productId, startCount }) => {
  const params = new URLSearchParams();
  params.set("scope", "product");
  params.set("subcategory", String(subCategory || "uncategorized"));
  params.set("productId", String(productId));
  params.set("startCount", String(startCount));
  return `${UPLOAD_URL}?${params.toString()}`;
};

const { useBreakpoint } = Grid;

const clamp = (n, a, b) => Math.min(Math.max(n, a), b);
const pickUploadedPath = (json) => {
  if (Array.isArray(json?.paths) && json.paths[0]) return json.paths[0];
  return "";
};

const parseImageList = (input) => {
  if (!input) return [];
  let list = input;
  if (typeof list === "string") {
    try {
      list = list.trim().startsWith("[") ? JSON.parse(list) : [list];
    } catch {
      list = [list];
    }
  }
  return (Array.isArray(list) ? list : [list]).filter(Boolean).map((x) => String(x).trim()).filter(Boolean);
};

const AdminProducts = () => {
  const screens = useBreakpoint();
  const isMd = !!screens.md;
  const token = useSelector((state) => state.auth?.token);
  const currentUser = useSelector((state) => state.auth?.user);
  const isSubAdmin = currentUser?.role === "subadmin";
  const navigate = useNavigate();

  // categories
  const [categories, setCategories] = useState([]);
  const [catLoading, setCatLoading] = useState(false);

  // filters
  const [catSlug, setCatSlug] = useState(null);
  const [subSlug, setSubSlug] = useState(null);
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showPageInfo, setShowPageInfo] = useState(false);

  // products
  const [products, setProducts] = useState([]);
  const [prodLoading, setProdLoading] = useState(false);

  // pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);

  // sort
  const [sortBy, setSortBy] = useState("createdAt");
  const [order, setOrder] = useState("DESC");

  // sold modal
  const [soldModalOpen, setSoldModalOpen] = useState(false);
  const [soldModalProduct, setSoldModalProduct] = useState(null);

  // edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingProduct, setEditingProduct] = useState(null);
  const [existingImages, setExistingImages] = useState([]); // ✅ State for managing existing images
  const [removedImages, setRemovedImages] = useState([]);
  const [editForm] = Form.useForm();

  // view modal
  const [viewOpen, setViewOpen] = useState(false);
  const [viewData, setViewData] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);

  // 1) load categories
  useEffect(() => {
    let ignore = false;

    (async () => {
      try {
        setCatLoading(true);
        const res = await fetch(API_CATEGORIES);
        const data = await res.json();

        if (!res.ok) throw new Error(data?.message || "Failed to load categories");
        if (!ignore) setCategories(Array.isArray(data) ? data : []);
      } catch (e) {

        if (!ignore) {
          setCategories([]);
          message.error(e.message || "Category load failed");
        }
      } finally {
        if (!ignore) setCatLoading(false);
      }
    })();

    return () => (ignore = true);
  }, []);

  const currentCat = useMemo(
    () => (categories || []).find((c) => c?.slug === catSlug) || null,
    [categories, catSlug]
  );

  const subCategories = useMemo(() => {
    const arr = currentCat?.subCategories || [];
    return Array.isArray(arr) ? arr.filter((s) => s?.isActive !== false) : [];
  }, [currentCat]);

  // reset on filter changes
  useEffect(() => {
    setSubSlug(null);
    setPage(1);
  }, [catSlug]);

  useEffect(() => {
    setPage(1);
  }, [subSlug, limit, sortBy, order]);

  const fetchProducts = async () => {
    setProdLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));
      params.set("sortBy", sortBy);
      params.set("order", order);

      if (catSlug) params.set("category", catSlug);
      if (subSlug) params.set("subCategory", subSlug);
      if (search.trim()) params.set("search", search.trim());

      const url = `${API_ADMIN_PRODUCTS}?${params.toString()}`;
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        cache: "no-store",
      });
      const json = await res.json();

      if (!res.ok) throw new Error(json?.message || "Failed to load products");

      const list = Array.isArray(json?.data) ? json.data : [];
      const t = Number(json?.meta?.total ?? 0);

      setProducts(list);
      setTotal(Number.isFinite(t) ? t : 0);
    } catch (e) {

      setProducts([]);
      setTotal(0);
      message.error(e.message || "Product load failed");
    } finally {
      setProdLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catSlug, subSlug, page, limit, sortBy, order, token]);

  const onSearch = () => {
    setPage(1);
    fetchProducts();
  };

  const deleteProduct = async (row) => {
    const id = Number(row?.id);
    try {
      const res = await fetch(`${API_ADMIN_PRODUCTS}/${id}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || "Delete failed");

      message.success("Deleted");
      // যদি last page এ শেষ item delete হয়, page কমিয়ে দেই
      const nextTotal = Math.max(total - 1, 0);
      const lastPage = Math.max(Math.ceil(nextTotal / limit), 1);
      setPage((p) => Math.min(p, lastPage));
      fetchProducts();
    } catch (e) {

      message.error(e.message || "Delete failed");
    }
  };

  // --- View Logic ---
  const openView = async (id) => {
    setViewOpen(true);
    setViewData(null);
    setViewLoading(true);
    try {
      const res = await fetch(`${API_ADMIN_PRODUCTS}/${id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json();
      if (json.data) {
        setViewData(json.data);
      }
    } catch (e) {

      message.error("Failed to load details");
    } finally {
      setViewLoading(false);
    }
  };

  // --- Edit Logic ---
  const openEdit = (product) => {
    setEditingId(product.id);
    setEditingProduct(product);
    setRemovedImages([]);
    setEditOpen(true);
  };

  // Populate form when modal opens
  useEffect(() => {
    if (editOpen && editingProduct) {
      setRemovedImages([]);
      editForm.resetFields();
      editForm.setFieldsValue({
        name: editingProduct.name,
        price: editingProduct.price,
        stock: editingProduct.stock,
        category: editingProduct.category,
        subCategory: editingProduct.subCategory,
        description: "",
        images: [],
      });

      // ✅ Fix: Initialize images from row data immediately (prevents "No images" flash)
      let initImgs = editingProduct.images || editingProduct.imageUrl || [];
      if (typeof initImgs === "string") { try { initImgs = JSON.parse(initImgs); } catch { initImgs = [initImgs]; } }
      if (!Array.isArray(initImgs)) initImgs = [initImgs].filter(Boolean);
      setExistingImages(initImgs);

      // Fetch full details (for description)
      fetch(`${API_ADMIN_PRODUCTS}/${editingProduct.id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        cache: "no-store",
      })
        .then((res) => res.json())
        .then((json) => {
          if (json.data) {
            editForm.setFieldsValue({
              description: json.data.description || "",
              name: json.data.name,
              price: json.data.price,
              stock: json.data.stock,
            });

            // ✅ Handle existing images from fresh data
            let imgs = json.data.images || json.data.imageUrl || [];
            if (typeof imgs === "string") try { imgs = JSON.parse(imgs); } catch { imgs = [imgs]; }
            if (!Array.isArray(imgs)) imgs = [imgs].filter(Boolean);
            setExistingImages(imgs);
          }
        })
        .catch((e) => console.error("Failed to fetch details", e));
    }
  }, [editOpen, editingProduct, editForm, token]);

  const saveEdit = async () => {
    let uploadedThisAttempt = [];
    try {
      const values = await editForm.validateFields();
      setEditLoading(true);

      // 1. Upload new images if present (support multiple)
      let newImagePaths = [];
      if (values.images && values.images.length > 0) {
        const uploadPromises = values.images.map((fileItem, idx) => {
          const fd = new FormData();
          fd.append("file", fileItem.originFileObj);
          const uploadEndpoint = buildProductUploadUrl({
            subCategory: values.subCategory || values.category || editingProduct?.subCategory || "uncategorized",
            productId: editingId,
            startCount: existingImages.length + idx,
          });
          return fetch(uploadEndpoint, { method: "POST", body: fd }).then((r) => r.json());
        });

        const responses = await Promise.all(uploadPromises);
        newImagePaths = responses.map((r) => pickUploadedPath(r)).filter(Boolean);
        uploadedThisAttempt = [...newImagePaths];
      }

      // 2. Prepare payload
      const payload = {
        name: values.name,
        price: Number(values.price),
        stock: Number(values.stock),
        description: values.description,
        category: values.category,
        subCategory: values.subCategory,
        // ✅ Merge existing (kept) images + new uploaded images
        images: [...existingImages, ...newImagePaths],
      };


      // 3. Update
      const res = await fetch(`${API_ADMIN_PRODUCTS}/${editingId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || "Update failed");

      message.success("Product updated");
      setEditOpen(false);
      setRemovedImages([]);
      fetchProducts();
    } catch (e) {
      if (uploadedThisAttempt.length > 0) {
        await Promise.allSettled(
          uploadedThisAttempt.map((path) =>
            fetch(UPLOAD_DELETE_URL, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ path }),
            })
          )
        );
      }

      message.error(e.message || "Update failed");
    } finally {
      setEditLoading(false);
    }
  };

  const columns = [
    {
      title: "Img",
      dataIndex: "images",
      key: "image",
      width: 56,
      render: (images, row) => {
        const src = normalizeImageUrl(row?.images?.[0] || row?.imageUrl);
        return (
          <div style={{ width: 40, height: 40, borderRadius: 10, overflow: "hidden", background: "#f5f5f5" }}>
            <img
              src={src || "https://via.placeholder.com/80"}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              loading="lazy"
            />
          </div>
        );
      },
    },
    { title: "Name", dataIndex: "name", key: "name", ellipsis: true },
    {
      title: "Cat",
      key: "category",
      width: isMd ? 240 : 180,
      render: (_, r) => (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {r.category ? <Tag>{r.category}</Tag> : <Tag>-</Tag>}
          {r.subCategory ? <Tag color="blue">{r.subCategory}</Tag> : null}
        </div>
      ),
    },
    {
      title: "Sold",
      dataIndex: "soldCount",
      key: "soldCount",
      width: 90,
      render: (v, r) => (
        <Button
          size="small"
          type="text"
          onClick={() => {
            setSoldModalProduct(r);
            setSoldModalOpen(true);
          }}
        >
          <Tag color={Number(v || 0) > 0 ? "green" : "default"} style={{ marginRight: 0 }}>
            {Number(v || 0)}
          </Tag>
        </Button>
      ),
      sorter: true,
    },
    {
      title: "Price",
      dataIndex: "price",
      key: "price",
      width: 95,
      render: (v) => `$${Number(v || 0).toFixed(2)}`,
      sorter: true,
    },
    {
      title: "Stock",
      dataIndex: "stock",
      key: "stock",
      width: 80,
      sorter: true,
    },
    {
      title: "",
      key: "actions",
      width: 90,
      render: (_, r) => (
        <div style={{ display: "flex", gap: 4 }}>
        <Button size="small" icon={<EyeOutlined />} onClick={() => openView(r.id)} />
        <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
        
        <Popconfirm
          title="Delete this product?"
          description="This action cannot be undone."
          okText="Delete"
          okButtonProps={{ danger: true }}
          onConfirm={() => deleteProduct(r)}
        >
          <Button danger size="small" type="text" icon={<DeleteOutlined />} />
        </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <div style={{ padding: isMd ? 12 : 8 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div>
          <h2 style={{ fontSize: isMd ? 18 : 16, fontWeight: 800, margin: 0 }}>Products</h2>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Button size="small" icon={<InfoCircleOutlined />} onClick={() => setShowPageInfo(true)}>
            Details
          </Button>
          <Button
            size="small"
            icon={<FilterOutlined />}
            onClick={() => setShowFilters((prev) => !prev)}
          >
            Filters {showFilters ? <UpOutlined /> : <DownOutlined />}
          </Button>
        </div>
      </div>

      {/* Filters (responsive) */}
      {showFilters ? (
        <div style={{ marginTop: 10 }}>
        <Row gutter={[8, 8]}>
          <Col xs={24} sm={12} md={6}>
            {catLoading ? (
              <Spin size="small" />
            ) : (
              <Select
                size="small"
                style={{ width: "100%" }}
                placeholder="Category"
                value={catSlug}
                onChange={(v) => setCatSlug(v || null)}
                allowClear
                options={(categories || [])
                  .filter((c) => c?.isActive !== false)
                  .map((c) => ({ label: c.name, value: c.slug }))}
              />
            )}
          </Col>

          <Col xs={24} sm={12} md={6}>
            <Select
              size="small"
              style={{ width: "100%" }}
              placeholder="Subcategory"
              value={subSlug}
              onChange={(v) => setSubSlug(v || null)}
              allowClear
              disabled={!catSlug || subCategories.length === 0}
              options={subCategories.map((s) => ({ label: s.name, value: s.slug }))}
            />
          </Col>

          <Col xs={24} sm={12} md={7}>
            <Input
              size="small"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onPressEnter={onSearch}
              allowClear
            />
          </Col>

          <Col xs={24} sm={12} md={5}>
            <div style={{ display: "flex", gap: 8 }}>
              <Button size="small" onClick={onSearch}>
                Search
              </Button>

              <Select
                size="small"
                style={{ flex: 1 }}
                value={`${sortBy}:${order}`}
                onChange={(v) => {
                  const [sb, od] = String(v).split(":");
                  setSortBy(sb);
                  setOrder(od);
                }}
                options={[
                  { label: "Newest", value: "createdAt:DESC" },
                  { label: "Oldest", value: "createdAt:ASC" },
                  { label: "Sold ↓", value: "soldCount:DESC" },
                  { label: "Sold ↑", value: "soldCount:ASC" },
                  { label: "Price ↓", value: "price:DESC" },
                  { label: "Price ↑", value: "price:ASC" },
                  { label: "Stock ↓", value: "stock:DESC" },
                  { label: "Stock ↑", value: "stock:ASC" },
                ]}
              />
            </div>
          </Col>

          <Col xs={24} sm={12} md={4}>
            <Select
              size="small"
              style={{ width: "100%" }}
              value={limit}
              onChange={(v) => setLimit(clamp(Number(v) || 10, 1, 100))}
              options={[10, 20, 30, 50].map((n) => ({ label: `${n}/page`, value: n }))}
            />
          </Col>
        </Row>
      </div>
      ) : null}

      {/* Table */}
      <div style={{ marginTop: 10 }}>
        {prodLoading ? (
          <div style={{ padding: 18, display: "grid", placeItems: "center" }}>
            <Spin />
          </div>
        ) : products.length === 0 ? (
          <Empty description="No products found" />
        ) : (
          isMd ? (
            <Table
              rowKey="id"
              size="small"
              columns={columns}
              dataSource={products}
              pagination={false}
              onChange={(pagination, filters, sorter) => {
                if (sorter?.field && sorter?.order) {
                  setSortBy(sorter.field);
                  setOrder(sorter.order === "ascend" ? "ASC" : "DESC");
                }
              }}
            />
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {products.map((r) => {
                const src = normalizeImageUrl(r?.images?.[0] || r?.imageUrl);
                return (
                  <div
                    key={r.id}
                    style={{
                      border: "1px solid #eee",
                      borderRadius: 12,
                      padding: 10,
                      background: "#fff",
                    }}
                  >
                    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <div
                        style={{
                          width: 56,
                          height: 56,
                          borderRadius: 10,
                          overflow: "hidden",
                          background: "#f5f5f5",
                          flexShrink: 0,
                        }}
                      >
                        <img
                          src={src || "https://via.placeholder.com/80"}
                          alt=""
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          loading="lazy"
                        />
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ marginTop: 4, display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {r.category ? <Tag style={{ marginRight: 0 }}>{r.category}</Tag> : <Tag style={{ marginRight: 0 }}>-</Tag>}
                          {r.subCategory ? <Tag color="blue" style={{ marginRight: 0 }}>{r.subCategory}</Tag> : null}
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: 8, display: "grid", gap: 4, fontSize: 13 }}>
                      <div><strong>Price:</strong> Tk {Number(r.price || 0).toFixed(2)}</div>
                      <div><strong>Stock:</strong> {Number(r.stock || 0)}</div>
                      <div>
                        <strong>Sold:</strong>{" "}
                        <Button
                          size="small"
                          type="text"
                          style={{ padding: 0, height: "auto" }}
                          onClick={() => {
                            setSoldModalProduct(r);
                            setSoldModalOpen(true);
                          }}
                        >
                          <Tag color={Number(r.soldCount || 0) > 0 ? "green" : "default"} style={{ marginRight: 0 }}>
                            {Number(r.soldCount || 0)}
                          </Tag>
                        </Button>
                      </div>
                    </div>

                    <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                      <Button size="small" icon={<EyeOutlined />} onClick={() => openView(r.id)}>
                        View
                      </Button>
                      <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>
                        Edit
                      </Button>
                      <Popconfirm
                        title="Delete this product?"
                        description="This action cannot be undone."
                        okText="Delete"
                        okButtonProps={{ danger: true }}
                        onConfirm={() => deleteProduct(r)}
                      >
                        <Button danger size="small" type="text" icon={<DeleteOutlined />} />
                      </Popconfirm>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        {total > limit && (
          <div style={{ marginTop: 10, display: "flex", justifyContent: "center" }}>
            <Pagination
              size="small"
              current={page}
              pageSize={limit}
              total={total}
              onChange={(p) => setPage(p)}
              showSizeChanger={false}
            />
          </div>
        )}
      </div>

      {/* Sold breakdown modal */}
      <Modal
        open={soldModalOpen}
        onCancel={() => setSoldModalOpen(false)}
        title={soldModalProduct ? `Sold by merchants — ${soldModalProduct.name}` : "Sold by merchants"}
        footer={null}
      >
        {(() => {
          const arr = soldModalProduct?.soldBy;
          const list = Array.isArray(arr) ? arr : [];
          if (!soldModalProduct) return null;
          if (!list.length) return <Empty description="No merchant sales yet" />;

          return (
            <div style={{ display: "grid", gap: 8 }}>
              {list
                .slice()
                .sort((a, b) => Number(b?.qty || 0) - Number(a?.qty || 0))
                .map((x, idx) => (
                  <div
                    key={`${x.merchantId}-${idx}`}
                    style={{
                      border: "1px solid #eee",
                      borderRadius: 10,
                      padding: 10,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Button
                      type="link"
                      style={{ padding: 0, fontWeight: 700 }}
                      onClick={() => {
                        if (!x?.merchantId) return;
                        navigate(`/saller/${x.merchantId}`);
                        setSoldModalOpen(false);
                      }}
                    >
                      Merchant ID: {x.merchantId}
                    </Button>
                    <Tag color="blue" style={{ marginRight: 0 }}>
                      Qty: {x.qty}
                    </Tag>
                  </div>
                ))}
            </div>
          );
        })()}
      </Modal>

      {/* Edit Modal */}
      <Modal
        open={editOpen}
        title={`Edit Product #${editingId}`}
        onCancel={() => {
          setEditOpen(false);
          setEditingProduct(null);
          setRemovedImages([]);
        }}
        onOk={saveEdit}
        confirmLoading={editLoading}
        width={800}
      >
        <Form layout="vertical" form={editForm}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="name" label="Name" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="category" label="Category">
                <Select
                  disabled={isSubAdmin}
                  options={(categories || []).map((c) => ({ label: c.name, value: c.slug }))}
                  onChange={() => editForm.setFieldValue("subCategory", null)}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="price" label="Price" rules={[{ required: true }]}>
                <InputNumber style={{ width: "100%" }} min={0} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="stock" label="Stock" rules={[{ required: true }]}>
                <InputNumber style={{ width: "100%" }} min={0} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="subCategory" label="SubCategory">
                <Select
                  disabled={isSubAdmin}
                  options={(() => {
                    const cSlug = editForm.getFieldValue("category");
                    const cat = categories.find((c) => c.slug === cSlug);
                    return (cat?.subCategories || []).map((s) => ({ label: s.name, value: s.slug }));
                  })()}
                />
              </Form.Item>
            </Col>
          </Row>

          {isSubAdmin ? (
            <div style={{ marginBottom: 12, fontSize: 12, color: "#8c8c8c" }}>
              Subadmin users cannot change category or subcategory from this page.
            </div>
          ) : null}

          {/* ✅ Existing Images Management */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 8, fontWeight: 500 }}>Current Images:</div>
            {existingImages.length === 0 ? (
              <div style={{ color: "#999", fontSize: 12, fontStyle: "italic" }}>No images</div>
            ) : (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {existingImages.map((url, idx) => (
                  <div key={idx} style={{ position: "relative", width: 70, height: 70, border: "1px solid #eee", borderRadius: 6 }}>
                    <img
                      src={normalizeImageUrl(url)}
                      alt=""
                      style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 6 }}
                    />
                    <Button
                      size="small"
                      danger
                      type="primary"
                      shape="circle"
                      icon={<DeleteOutlined />}
                      style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, minWidth: 20, fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center" }}
                      onClick={() =>
                        setExistingImages((prev) => {
                          const removed = prev[idx];
                          if (removed) setRemovedImages((old) => [...old, removed]);
                          return prev.filter((_, i) => i !== idx);
                        })
                      }
                      title="Remove this image"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <Form.Item name="images" label="Add New Images" valuePropName="fileList" getValueFromEvent={(e) => (Array.isArray(e) ? e : e?.fileList)}>
            <Upload beforeUpload={() => false} multiple listType="picture">
              <Button icon={<UploadOutlined />}>Select Images</Button>
            </Upload>
          </Form.Item>

          <Form.Item name="description" label="Description">
            <ReactQuill theme="snow" style={{ height: 200, marginBottom: 50 }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* View Description Modal */}
      <Modal
        open={viewOpen}
        title={viewData?.name || "Product Details"}
        onCancel={() => setViewOpen(false)}
        footer={null}
        width={700}
      >
        {viewLoading ? (
          <div style={{ textAlign: "center", padding: 20 }}>
            <Spin />
          </div>
        ) : (
          <div>
            {/* Images Gallery */}
            {(() => {
              let imgs = viewData?.images || viewData?.imageUrl;
              if (!imgs) return null;
              if (typeof imgs === "string") {
                try {
                  imgs = imgs.trim().startsWith("[") ? JSON.parse(imgs) : [imgs];
                } catch {
                  imgs = [imgs];
                }
              }
              if (!Array.isArray(imgs)) imgs = [imgs];
              if (imgs.length === 0) return null;

              return (
                <div style={{ marginBottom: 20 }}>
                  <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Images</h4>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {imgs.map((img, i) => (
                      <div key={i} style={{ width: 100, height: 100, border: "1px solid #eee", borderRadius: 8, overflow: "hidden" }}>
                        <img src={normalizeImageUrl(img)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Description</h4>
            {viewData?.description ? (
              <div
                dangerouslySetInnerHTML={{ __html: viewData.description }}
                style={{ border: "1px solid #f0f0f0", padding: 12, borderRadius: 8, background: "#fafafa" }}
              />
            ) : (
              <Empty description="No description" />
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={showPageInfo}
        title="Products Page Info"
        footer={null}
        onCancel={() => setShowPageInfo(false)}
      >
        <div style={{ display: "grid", gap: 8 }}>
          <div>Total Items: {prodLoading ? "Loading..." : total}</div>
          <div>Filters খুলে category/subcategory/search apply করতে পারবেন।</div>
          <div>Mobile এ card view, desktop এ table view।</div>
        </div>
      </Modal>
    </div>
  );
};

export default AdminProducts;




