import React, { useEffect, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import {
  Button, Input, Form, Card, message,
  InputNumber, Typography, Spin, TreeSelect, Select,
} from "antd";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";

import { API_BASE_URL, UPLOAD_BASE_URL } from "../../../config/env";

const { Text } = Typography;

const MAX_SIZE   = 10 * 1024 * 1024;
const MAX_IMAGES = 5;

const API_CATEGORIES = `${API_BASE_URL}/api/categories`;
const UPLOAD_URL     = `${UPLOAD_BASE_URL}/upload/image`;
const CREATE_URL     = `${API_BASE_URL}/api/products/create`;

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const buildSpecTableHtml = (rows = []) => {
  const normalized = rows
    .map((r) => ({
      key: String(r?.key || "").trim(),
      value: String(r?.value || "").trim(),
    }))
    .filter((r) => r.key || r.value);

  if (!normalized.length) return "";

  return `
<div style="width:100%;overflow-x:auto;margin:12px 0;">
  <table style="width:100%;min-width:420px;border-collapse:collapse;">
    <tbody>
      ${normalized
        .map(
          (r) => `
      <tr>
        <td style="border:1px solid #d9d9d9;padding:8px 10px;background:#fafafa;font-weight:600;width:35%;">${escapeHtml(r.key)}</td>
        <td style="border:1px solid #d9d9d9;padding:8px 10px;">${escapeHtml(r.value)}</td>
      </tr>`
        )
        .join("")}
    </tbody>
  </table>
</div>`;
};

const findSubCategoryById = (nodes = [], id) => {
  if (!id) return null;
  for (const node of Array.isArray(nodes) ? nodes : []) {
    if (Number(node.id) === Number(id)) return node;
    const found = findSubCategoryById(node.children, id);
    if (found) return found;
  }
  return null;
};

/* ═══════════════════════════════════════════
   CreateItem
═══════════════════════════════════════════ */
const CreateItem = () => {
  const navigate   = useNavigate();

  const reduxToken = useSelector((state) => state.auth?.token);
  const localToken = JSON.parse(localStorage.getItem("userInfo") || "null")?.token;
  const token      = reduxToken || localToken;

  const [categories,    setCategories]    = useState([]);
  const [catLoading,    setCatLoading]    = useState(false);
  const [categoryId,    setCategoryId]    = useState(null);
  const [subCategoryId, setSubCategoryId] = useState(null);
  const [images,        setImages]        = useState([]);
  const [errorMessage,  setErrorMessage]  = useState("");
  const [specRows,      setSpecRows]      = useState([{ key: "", value: "" }]);

  const {
    handleSubmit, control, reset, setValue, getValues, watch,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: { name: "", price: null, oldPrice: null, stock: null, description: "" },
  });

  /* ── load categories ── */
  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        setCatLoading(true);
        const res  = await fetch(API_CATEGORIES);
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || "Failed to load categories");
        const arr = Array.isArray(data) ? data : [];
        if (!ignore) {
          setCategories(arr);
          if (arr.length) {
            const firstActive = arr.find((c) => c?.isActive !== false) || arr[0];
            const cid = Number(firstActive?.id);
            setCategoryId(cid || null);
            setSubCategoryId(null);
          }
        }
      } catch (e) {
        if (!ignore) { setCategories([]); message.error(e.message); }
      } finally {
        if (!ignore) setCatLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, []);

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === categoryId),
    [categories, categoryId]
  );
  const selectedSubCategory = useMemo(
    () => findSubCategoryById(selectedCategory?.subCategories || [], subCategoryId),
    [selectedCategory, subCategoryId]
  );
  const categoryOptions = useMemo(
    () =>
      (Array.isArray(categories) ? categories : [])
        .filter((c) => c?.isActive !== false)
        .map((c) => ({ label: c.name, value: Number(c.id) })),
    [categories]
  );

  const selectedCategorySubTreeOptions = useMemo(() => {
    const mapSubTree = (catId, nodes = []) =>
      (Array.isArray(nodes) ? nodes : [])
        .filter((n) => n?.isActive !== false)
        .map((n) => ({
          title: n.name,
          value: `sub:${catId}:${n.id}`,
          key: `sub:${catId}:${n.id}`,
          children: mapSubTree(catId, n.children),
        }));

    if (!selectedCategory?.id) return [];
    return mapSubTree(Number(selectedCategory.id), selectedCategory.subCategories);
  }, [selectedCategory]);

  /* ── images ── */
  const imagePreviews = useMemo(() => images.map((f) => URL.createObjectURL(f)), [images]);

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const valid = files.filter((f) => f.size <= MAX_SIZE);
    if (valid.length !== files.length) message.error("Each image must be 10MB or less");
    setImages((prev) => [...prev, ...valid].slice(0, MAX_IMAGES));
    e.target.value = "";
  };
  const removeImage = (i) => setImages((prev) => prev.filter((_, idx) => idx !== i));

  /* option 2: table builder -> submit time e description er sathe merge */
  const updateSpecRow = (index, field, value) => {
    setSpecRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  };
  const addSpecRow = () => setSpecRows((prev) => [...prev, { key: "", value: "" }]);
  const removeSpecRow = (index) => {
    setSpecRows((prev) => (prev.length <= 1 ? [{ key: "", value: "" }] : prev.filter((_, i) => i !== index)));
  };
  const specTableHtml = useMemo(() => buildSpecTableHtml(specRows), [specRows]);

  /* ── money helpers ── */
  const moneyFormatter = (v) =>
    v === null || v === undefined || v === "" ? ""
      : `৳ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const moneyParser = (v) => (v ? v.replace(/[৳,\s]/g, "") : "");

  /* ── quill config ── */
  const modules = useMemo(() => ({
    toolbar: {
      container: [
        [{ header: [1, 2, false] }],
        ["bold", "italic", "underline", "strike"],
        [{ list: "ordered" }, { list: "bullet" }],
        ["link", "image"],
        ["clean"],
      ],
    },
    clipboard: { matchVisual: false },
    history: { delay: 1000, maxStack: 100, userOnly: true },
  }), []);

  const formats = [
    "header", "bold", "italic", "underline", "strike",
    "list", "link", "image",
  ];

  /* ── submit ── */
  const onSubmit = async (data) => {
    try {
      setErrorMessage("");
      if (!categoryId)    throw new Error("Select a category");
      if (!images.length) throw new Error("Select at least one image");

      const uploadResponses = await Promise.all(
        images.map((file) => {
          const fd = new FormData();
          fd.append("file", file);
          return fetch(UPLOAD_URL, { method: "POST", body: fd });
        })
      );
      const uploadJson = await Promise.all(
        uploadResponses.map(async (res) => {
          if (!res.ok) throw new Error("Image upload failed");
          return res.json();
        })
      );
      const imageUrls = uploadJson.flatMap((u) => u.urls || []);
      if (!imageUrls.length) throw new Error("No image URL returned");

      const baseDescription = String(data.description || "");
      const finalDescription =
        `${baseDescription}${specTableHtml ? `${baseDescription ? "<p><br></p>" : ""}${specTableHtml}` : ""}`;

      const payload = {
        name:          data.name.trim(),
        price:         Number(data.price),
        oldPrice:      data.oldPrice != null && data.oldPrice !== "" ? Number(data.oldPrice) : null,
        stock:         Number(data.stock),
        categoryId,
        subCategoryId: subCategoryId || null,
        category:      selectedCategory?.slug || selectedCategory?.name || null,
        subCategory:
          selectedSubCategory?.slug ||
          selectedSubCategory?.name || null,
        description:   finalDescription,
        imageUrl:      imageUrls,
      };

      const response = await fetch(CREATE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      const resJson = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(resJson.message || "Product create failed");

      message.success("Product created successfully!");
      reset();
      setImages([]);
      setSpecRows([{ key: "", value: "" }]);
    } catch (err) {
      console.error(err);
      setErrorMessage(err.message);
      message.error(err.message);
    }
  };

  /* ════════════════════════════════════════
     RENDER
  ════════════════════════════════════════ */
  const descriptionValue = watch("description") || "";
  const finalDescriptionPreview =
    `${descriptionValue}${specTableHtml ? `${descriptionValue ? "<p><br></p>" : ""}${specTableHtml}` : ""}`;

  return (
    <div style={{ maxWidth: 900, margin: "20px auto", padding: "0 12px 50px" }}>
      <Card
        title={
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <span>
              Add Product{" "}
              <Text type="secondary" style={{ fontSize: 12 }}>(Select Category/Subcategory)</Text>
            </span>
            <Button onClick={() => navigate(-1)}>Back</Button>
          </div>
        }
      >
        <Form layout="vertical" onFinish={handleSubmit(onSubmit)}>

          <Form.Item label="Category" required>
            {catLoading ? (
              <Spin size="small" />
            ) : (
              <Select
                value={categoryId}
                onChange={(nextCategoryId) => {
                  const cid = Number(nextCategoryId) || null;
                  setCategoryId(cid);
                  setSubCategoryId(null);
                }}
                options={categoryOptions}
                placeholder="Select category"
                allowClear
              />
            )}
          </Form.Item>

          <Form.Item label="Subcategory (optional)">
            <TreeSelect
              value={subCategoryId ? `sub:${categoryId}:${subCategoryId}` : undefined}
              onChange={(nextValue) => {
                if (!nextValue) {
                  setSubCategoryId(null);
                  return;
                }
                const parts = String(nextValue).split(":");
                if (parts[0] === "sub") setSubCategoryId(Number(parts[2]) || null);
              }}
              treeData={selectedCategorySubTreeOptions}
              placeholder={categoryId ? "Select nested subcategory" : "Select category first"}
              treeDefaultExpandAll
              allowClear
              showSearch
              disabled={!categoryId || !selectedCategorySubTreeOptions.length}
              style={{ width: "100%" }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              Category select korar por oi category-r under er nested subcategory gulo ekhane dekhabe.
            </Text>
          </Form.Item>

          {/* Product Name */}
          <Form.Item label="Product Name" validateStatus={errors.name ? "error" : ""} help={errors.name?.message}>
            <Controller
              name="name" control={control}
              rules={{ required: "Product name required", minLength: 3 }}
              render={({ field }) => <Input {...field} />}
            />
          </Form.Item>

          {/* Price / Old Price / Stock */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
            <Form.Item label="Price">
              <Controller name="price" control={control} rules={{ required: true, min: 0 }}
                render={({ field }) => (
                  <InputNumber {...field} style={{ width: "100%" }} formatter={moneyFormatter} parser={moneyParser} />
                )}
              />
            </Form.Item>
            <Form.Item label="Old Price">
              <Controller name="oldPrice" control={control}
                render={({ field }) => (
                  <InputNumber {...field} style={{ width: "100%" }} formatter={moneyFormatter} parser={moneyParser} />
                )}
              />
            </Form.Item>
            <Form.Item label="Stock">
              <Controller name="stock" control={control} rules={{ required: true, min: 0 }}
                render={({ field }) => <InputNumber {...field} style={{ width: "100%" }} />}
              />
            </Form.Item>
          </div>

          {/* Images */}
          <Form.Item label={`Images (max ${MAX_IMAGES})`}>
            <input type="file" multiple accept="image/*" onChange={handleImageChange} />
            {images.length > 0 && (
              <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12 }}>
                {imagePreviews.map((src, i) => (
                  <div key={i}>
                    <img src={src} alt="" style={{ width: "100%", height: 110, objectFit: "cover", borderRadius: 4 }} />
                    <Button danger size="small" block onClick={() => removeImage(i)} style={{ marginTop: 4 }}>Remove</Button>
                  </div>
                ))}
              </div>
            )}
          </Form.Item>

          <Form.Item label="Specification Table Builder (optional)">
            <div style={{
              border: "1px solid #d9d9d9",
              borderRadius: 8,
              padding: 12,
              background: "#fafafa",
              display: "grid",
              gap: 8,
            }}>
              {specRows.map((row, index) => (
                <div
                  key={index}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                    gap: 8,
                    alignItems: "center",
                  }}
                >
                  <Input
                    placeholder="Field (e.g. Size)"
                    value={row.key}
                    onChange={(e) => updateSpecRow(index, "key", e.target.value)}
                    style={{ minWidth: 0 }}
                  />
                  <Input
                    placeholder="Value (e.g. 42)"
                    value={row.value}
                    onChange={(e) => updateSpecRow(index, "value", e.target.value)}
                    style={{ minWidth: 0 }}
                  />
                  <Button danger block onClick={() => removeSpecRow(index)}>Remove</Button>
                </div>
              ))}

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Button onClick={addSpecRow}>Add Row</Button>
              </div>

              <Text type="secondary" style={{ fontSize: 12 }}>
                Table editor box-e direct na dekhaleo submit-er somoy description-er sathe merge hoye DB te save hobe.
              </Text>
            </div>
          </Form.Item>

          {/* Description */}
          <Form.Item label="Description">
            <Controller
              name="description"
              control={control}
              rules={{ required: true }}
              render={({ field }) => (
                <ReactQuill
                  theme="snow"
                  value={field.value || ""}
                  onChange={field.onChange}
                  modules={modules}
                  formats={formats}
                  style={{
                    height: 260,
                    marginBottom: 50,
                  }}
                />
              )}
            />
          </Form.Item>

          <Form.Item label="Final Description Preview (DB te eta save hobe)">
            <div
              style={{
                border: "1px solid #d9d9d9",
                borderRadius: 8,
                padding: 12,
                background: "#fff",
                minHeight: 120,
                overflowX: "auto",
              }}
              dangerouslySetInnerHTML={{
                __html: finalDescriptionPreview || "<span style='color:#999'>No description yet</span>",
              }}
            />
          </Form.Item>

          {errorMessage && (
            <div style={{ color: "red", textAlign: "center", marginBottom: 12 }}>
              {errorMessage}
            </div>
          )}

          <Button type="primary" htmlType="submit" loading={isSubmitting} block size="large">
            Create Product
          </Button>
        </Form>
      </Card>
    </div>
  );
};

export default CreateItem;
