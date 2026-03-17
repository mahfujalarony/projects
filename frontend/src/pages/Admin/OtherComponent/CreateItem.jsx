import React, { useEffect, useMemo, useRef, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import {
  Button,
  Input,
  Form,
  Card,
  message,
  InputNumber,
  Typography,
  Spin,
  TreeSelect,
  Select,
} from "antd";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import {
  CloudUploadOutlined,
  DeleteOutlined,
  DragOutlined,
  CustomerServiceOutlined,
} from "@ant-design/icons";

import { API_BASE_URL, UPLOAD_BASE_URL } from "../../../config/env";

const { Text } = Typography;

const MAX_SIZE = 10 * 1024 * 1024;
const MAX_IMAGES = 5;

const API_CATEGORIES = `${API_BASE_URL}/api/categories`;
const UPLOAD_URL = `${UPLOAD_BASE_URL}/upload/image`;
const CREATE_URL = `${API_BASE_URL}/api/products/create`;
const ADMIN_PRODUCT_UPDATE_BASE = `${API_BASE_URL}/api/admin/products`;

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
        <td style="border:1px solid #d9d9d9;padding:8px 10px;background:#fafafa;font-weight:600;width:35%;">${escapeHtml(
          r.key
        )}</td>
        <td style="border:1px solid #d9d9d9;padding:8px 10px;">${escapeHtml(
          r.value
        )}</td>
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

const buildProductUploadUrl = ({ subCategory, productId, startCount }) => {
  const params = new URLSearchParams();
  params.set("scope", "product");
  params.set("subcategory", String(subCategory || "uncategorized"));
  params.set("productId", String(productId));
  params.set("startCount", String(startCount));
  return `${UPLOAD_URL}?${params.toString()}`;
};

/* ═══════════════════════════════════════════
   CreateItem
═══════════════════════════════════════════ */
const CreateItem = () => {
  const navigate = useNavigate();

  const reduxToken = useSelector((state) => state.auth?.token);
  const localToken = JSON.parse(localStorage.getItem("userInfo") || "null")?.token;
  const token = reduxToken || localToken;

  const [categories, setCategories] = useState([]);
  const [catLoading, setCatLoading] = useState(false);
  const [categoryId, setCategoryId] = useState(null);
  const [subCategoryId, setSubCategoryId] = useState(null);

  // images
  const [images, setImages] = useState([]);
  const [dragIndex, setDragIndex] = useState(null);
  const fileInputRef = useRef(null);

  const [errorMessage, setErrorMessage] = useState("");
  const [specRows, setSpecRows] = useState([{ key: "", value: "" }]);

  // Quill ref
  const quillRef = useRef(null);

  const {
    handleSubmit,
    control,
    reset,
    watch,
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
        const res = await fetch(API_CATEGORIES);
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
        if (!ignore) {
          setCategories([]);
          message.error(e.message);
        }
      } finally {
        if (!ignore) setCatLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
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

  /* ─────────────────────────────────────────
     Images: add + preview + remove + reorder
  ───────────────────────────────────────── */
  const imagePreviews = useMemo(
    () => images.map((f) => ({ file: f, url: URL.createObjectURL(f) })),
    [images]
  );

  useEffect(() => {
    // cleanup object URLs when images change/unmount
    return () => {
      imagePreviews.forEach((p) => URL.revokeObjectURL(p.url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images]);

  const addFiles = (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;

    const onlyImages = files.filter((f) => f.type?.startsWith("image/"));
    if (onlyImages.length !== files.length) message.error("Only image files are allowed.");

    const valid = onlyImages.filter((f) => f.size <= MAX_SIZE);
    if (valid.length !== onlyImages.length) message.error("Each image must be 10MB or less");

    setImages((prev) => [...prev, ...valid].slice(0, MAX_IMAGES));
  };

  const handleImageChange = (e) => {
    addFiles(e.target.files);
    e.target.value = "";
  };

  const removeImage = (i) => setImages((prev) => prev.filter((_, idx) => idx !== i));

  const moveImage = (from, to) => {
    setImages((prev) => {
      const next = [...prev];
      const item = next[from];
      if (!item) return prev;
      next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };

  const onThumbDragStart = (idx) => () => setDragIndex(idx);

  const onThumbDragOver = (idx) => (e) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === idx) return;
    moveImage(dragIndex, idx);
    setDragIndex(idx);
  };

  const onThumbDragEnd = () => setDragIndex(null);

  const onDropZoneDragOver = (e) => e.preventDefault();

  const onDropZoneDrop = (e) => {
    e.preventDefault();
    addFiles(e.dataTransfer.files);
  };

  /* ─────────────────────────────────────────
     Spec Table Builder
  ───────────────────────────────────────── */
  const updateSpecRow = (index, field, value) => {
    setSpecRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  };

  const addSpecRow = () => setSpecRows((prev) => [...prev, { key: "", value: "" }]);

  const removeSpecRow = (index) => {
    setSpecRows((prev) =>
      prev.length <= 1 ? [{ key: "", value: "" }] : prev.filter((_, i) => i !== index)
    );
  };

  const specTableHtml = useMemo(() => buildSpecTableHtml(specRows), [specRows]);

  /* ── money helpers ── */
  const moneyFormatter = (v) =>
    v === null || v === undefined || v === ""
      ? ""
      : `$ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  const moneyParser = (v) => (v ? v.replace(/[$,\s]/g, "") : "");

  /* ─────────────────────────────────────────
     Quill config (NO image button)
  ───────────────────────────────────────── */
  const modules = useMemo(
    () => ({
      toolbar: {
        container: [
          [{ header: [1, 2, false] }],
          ["bold", "italic", "underline", "strike"],
          [{ list: "ordered" }, { list: "bullet" }],
          ["link"], // ✅ image removed
          ["clean"],
        ],
      },
      clipboard: { matchVisual: false },
      history: { delay: 1000, maxStack: 100, userOnly: true },
    }),
    []
  );

  const formats = ["header", "bold", "italic", "underline", "strike", "list", "link"];

  // Block image paste/drop inside Description
  useEffect(() => {
    const editor = quillRef.current?.getEditor?.();
    if (!editor) return;

    const root = editor.root;

    const blockIfImageInClipboard = (e) => {
      const items = e.clipboardData?.items || [];
      for (const it of items) {
        if (it.type?.startsWith("image/")) {
          e.preventDefault();
          message.error("Image paste is disabled in Description.");
          return;
        }
      }
    };

    const blockIfImageDrop = (e) => {
      const files = Array.from(e.dataTransfer?.files || []);
      if (files.some((f) => f.type?.startsWith("image/"))) {
        e.preventDefault();
        message.error("Image drop is disabled in Description.");
      }
    };

    root.addEventListener("paste", blockIfImageInClipboard);
    root.addEventListener("drop", blockIfImageDrop);

    return () => {
      root.removeEventListener("paste", blockIfImageInClipboard);
      root.removeEventListener("drop", blockIfImageDrop);
    };
  }, []);

  /* ─────────────────────────────────────────
     Submit
  ───────────────────────────────────────── */
  const onSubmit = async (data) => {
    try {
      setErrorMessage("");

      if (!categoryId) throw new Error("Select a category");
      if (!images.length) throw new Error("Select at least one image");

      const baseDescription = String(data.description || "");
      const finalDescription = `${baseDescription}${
        specTableHtml ? `${baseDescription ? "<p><br></p>" : ""}${specTableHtml}` : ""
      }`;

      const createPayload = {
        name: data.name.trim(),
        price: Number(data.price),
        oldPrice: data.oldPrice != null && data.oldPrice !== "" ? Number(data.oldPrice) : null,
        stock: Number(data.stock),
        categoryId,
        subCategoryId: subCategoryId || null,
        category: selectedCategory?.slug || selectedCategory?.name || null,
        subCategory: selectedSubCategory?.slug || selectedSubCategory?.name || null,
        description: finalDescription,
        imageUrl: [],
      };

      const createResponse = await fetch(CREATE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(createPayload),
      });

      const createJson = await createResponse.json().catch(() => ({}));
      if (!createResponse.ok) throw new Error(createJson.message || "Product create failed");

      const createdProductId = Number(createJson?.product?.id);
      if (!Number.isFinite(createdProductId) || createdProductId <= 0) {
        throw new Error("Product created but invalid product id returned");
      }

      // Prefer backend-resolved slug so upload folder always matches saved product metadata.
      const uploadSubCategory =
        String(createJson?.product?.subCategory || "").trim() ||
        selectedSubCategory?.slug ||
        selectedSubCategory?.name ||
        selectedCategory?.slug ||
        "uncategorized";

      const uploadJson = await Promise.all(
        images.map(async (file, idx) => {
          const fd = new FormData();
          fd.append("file", file);
          const uploadRes = await fetch(
            buildProductUploadUrl({
              subCategory: uploadSubCategory,
              productId: createdProductId,
              startCount: idx,
            }),
            { method: "POST", body: fd }
          );
          if (!uploadRes.ok) throw new Error("Image upload failed");
          return uploadRes.json();
        })
      );

      const imageUrls = uploadJson.flatMap((u) => u.paths || []);
      if (!imageUrls.length) throw new Error("No image path returned");

      const updateResponse = await fetch(`${ADMIN_PRODUCT_UPDATE_BASE}/${createdProductId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ images: imageUrls }),
      });
      const updateJson = await updateResponse.json().catch(() => ({}));
      if (!updateResponse.ok) throw new Error(updateJson?.message || "Product image save failed");

      message.success("Product created successfully!");
      reset();
      setImages([]);
      setSpecRows([{ key: "", value: "" }]);
    } catch (err) {

      setErrorMessage(err.message);
      message.error(err.message);
    }
  };

  /* ════════════════════════════════════════
     RENDER
  ════════════════════════════════════════ */
  const descriptionValue = watch("description") || "";
  const finalDescriptionPreview = `${descriptionValue}${
    specTableHtml ? `${descriptionValue ? "<p><br></p>" : ""}${specTableHtml}` : ""
  }`;

  return (
    <div style={{ maxWidth: 900, margin: "20px auto", padding: "0 12px 50px" }}>
      <Card
        title={
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <span>
              Add Product{" "}
              <Text type="secondary" style={{ fontSize: 12 }}>
                (Select Category/Subcategory)
              </Text>
            </span>
            <Button onClick={() => navigate(-1)}>Back</Button>
          </div>
        }
      >
        <Form layout="vertical" onFinish={handleSubmit(onSubmit)}>
          {/* Category */}
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

          {/* Subcategory */}
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
              After selecting a category, the nested subcategories under that category will appear here.
            </Text>
          </Form.Item>

          {/* Product Name */}
          <Form.Item label="Product Name" validateStatus={errors.name ? "error" : ""} help={errors.name?.message}>
            <Controller
              name="name"
              control={control}
              rules={{ required: "Product name required", minLength: 3 }}
              render={({ field }) => <Input {...field} />}
            />
          </Form.Item>

          {/* Price / Old Price / Stock */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
            <Form.Item label="Price">
              <Controller
                name="price"
                control={control}
                rules={{ required: true, min: 0 }}
                render={({ field }) => (
                  <InputNumber
                    {...field}
                    style={{ width: "100%" }}
                    formatter={moneyFormatter}
                    parser={moneyParser}
                  />
                )}
              />
            </Form.Item>

            <Form.Item label="Old Price">
              <Controller
                name="oldPrice"
                control={control}
                render={({ field }) => (
                  <InputNumber
                    {...field}
                    style={{ width: "100%" }}
                    formatter={moneyFormatter}
                    parser={moneyParser}
                  />
                )}
              />
            </Form.Item>

            <Form.Item label="Stock">
              <Controller
                name="stock"
                control={control}
                rules={{ required: true, min: 0 }}
                render={({ field }) => <InputNumber {...field} style={{ width: "100%" }} />}
              />
            </Form.Item>
          </div>

          {/* Images */}
          <Form.Item label={`Images (max ${MAX_IMAGES})`}>
            {/* Hidden input */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              onChange={handleImageChange}
              style={{ display: "none" }}
            />

            {/* Dropzone / Cloud button */}
            <div
              onDragOver={onDropZoneDragOver}
              onDrop={onDropZoneDrop}
              style={{
                border: "1px dashed #d9d9d9",
                borderRadius: 10,
                padding: 16,
                background: "#fafafa",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  role="button"
                  title="Upload Images"
                  style={{
                    width: 54,
                    height: 54,
                    borderRadius: 14,
                    display: "grid",
                    placeItems: "center",
                    background: "linear-gradient(135deg, #dbeafe 0%, #cffafe 100%)",
                    color: "#0f766e",
                    cursor: "pointer",
                    userSelect: "none",
                    boxShadow: "0 1px 8px rgba(0,0,0,0.06)",
                  }}
                >
                  <CloudUploadOutlined style={{ fontSize: 24 }} />
                </div>

                <div style={{ lineHeight: 1.35 }}>
                  <Text strong style={{ display: "block" }}>
                    Upload product images
                  </Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Click the cloud icon or drag & drop images here (max {MAX_IMAGES}, 10MB each).
                  </Text>
                </div>
              </div>

              <Button onClick={() => fileInputRef.current?.click()}>Select Files</Button>
            </div>

            {/* Thumbnails + Drag reorder */}
            {images.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Tip: Drag thumbnails to reorder (this order will be used for upload).
                </Text>

                <div
                  style={{
                    marginTop: 10,
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                    gap: 12,
                  }}
                >
                  {imagePreviews.map((p, i) => (
                    <div
                      key={p.url}
                      draggable
                      onDragStart={onThumbDragStart(i)}
                      onDragOver={onThumbDragOver(i)}
                      onDragEnd={onThumbDragEnd}
                      style={{
                        border: "1px solid #eee",
                        borderRadius: 12,
                        overflow: "hidden",
                        background: "#fff",
                        boxShadow: "0 1px 8px rgba(0,0,0,0.05)",
                        cursor: "grab",
                      }}
                      title="Drag to reorder"
                    >
                      <div style={{ position: "relative" }}>
                        <img
                          src={p.url}
                          alt=""
                          style={{ width: "100%", height: 120, objectFit: "cover" }}
                        />
                        <div
                          style={{
                            position: "absolute",
                            top: 8,
                            left: 8,
                            background: "rgba(0,0,0,0.55)",
                            color: "#fff",
                            borderRadius: 10,
                            padding: "3px 8px",
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            fontSize: 12,
                          }}
                        >
                          <DragOutlined />
                          <span>{i + 1}</span>
                        </div>
                      </div>

                      <div style={{ padding: 8 }}>
                        <Button
                          danger
                          icon={<DeleteOutlined />}
                          size="small"
                          block
                          onClick={() => removeImage(i)}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Form.Item>

          {/* Specification Table Builder */}
          <Form.Item label="Specification Table Builder (optional)">
            <div
              style={{
                border: "1px solid #d9d9d9",
                borderRadius: 8,
                padding: 12,
                background: "#fafafa",
                display: "grid",
                gap: 8,
              }}
            >
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
                  <Button danger block onClick={() => removeSpecRow(index)}>
                    Remove
                  </Button>
                </div>
              ))}

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Button onClick={addSpecRow}>Add Row</Button>
              </div>

              <Text type="secondary" style={{ fontSize: 12 }}>
                Even if it’s not shown directly in the editor, the table will be merged with the description and saved to
                the database on submit.
              </Text>
            </div>
          </Form.Item>

          {/* Description */}
          <Form.Item label="Description" required>
            <Controller
              name="description"
              control={control}
              rules={{ required: "Description is required" }}
              render={({ field }) => (
                <ReactQuill
                  ref={quillRef}
                  theme="snow"
                  value={field.value || ""}
                  onChange={field.onChange}
                  modules={modules}
                  formats={formats}
                  style={{ height: 260, marginBottom: 50 }}
                />
              )}
            />
            {/* Optional empty-state helper (kept like your previous style) */}
            {!descriptionValue && (
              <div style={{ marginTop: 10, padding: 12, borderRadius: 10, background: "#f6ffed", border: "1px solid #b7eb8f" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 999,
                      display: "grid",
                      placeItems: "center",
                      background: "linear-gradient(135deg, #dbeafe 0%, #cffafe 100%)",
                      color: "#0f766e",
                      fontSize: 18,
                      flex: "0 0 auto",
                    }}
                  >
                    <CustomerServiceOutlined />
                  </div>
                  <div style={{ lineHeight: 1.35 }}>
                    <Text strong style={{ display: "block" }}>
                      Support Tip
                    </Text>
                    <Text type="secondary" style={{ display: "block", fontSize: 12 }}>
                      Images are disabled in the description editor. Please upload images using the cloud icon above.
                    </Text>
                  </div>
                </div>
              </div>
            )}
          </Form.Item>

          {/* Final Description Preview */}
          <Form.Item label="Final Description Preview (This is what will be saved in DB)">
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
            <div style={{ color: "red", textAlign: "center", marginBottom: 12 }}>{errorMessage}</div>
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
