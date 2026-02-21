import React, { useEffect, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { Button, Input, Form, Card, message, InputNumber, Typography, Select, Spin } from "antd";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import { API_BASE_URL } from "../../../config/env";
import { UPLOAD_BASE_URL } from "../../../config/env";

const { Text } = Typography;

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_IMAGES = 5;

const API_CATEGORIES = `${API_BASE_URL}/api/categories`;
const UPLOAD_URL = `${UPLOAD_BASE_URL}/upload/image`;
const CREATE_URL = `${API_BASE_URL}/api/products/create`;

const CreateItem = () => {
  const navigate = useNavigate();
  const reduxToken = useSelector((state) => state.auth?.token);
  const localToken = JSON.parse(localStorage.getItem("userInfo") || "null")?.token;
  const token = reduxToken || localToken;

  //  categories from backend
  const [categories, setCategories] = useState([]);
  const [catLoading, setCatLoading] = useState(false);

  //  selected ids
  const [categoryId, setCategoryId] = useState(null);
  const [subCategoryId, setSubCategoryId] = useState(null);

  // images
  const [images, setImages] = useState([]); // File[]
  const [errorMessage, setErrorMessage] = useState("");

  const {
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: { name: "", price: null, oldPrice: null, stock: null, description: "" },
  });

  // load categories (with subCategories)
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

          // default select first
          if (arr.length) {
            setCategoryId(arr[0].id);
            const firstSubs = Array.isArray(arr[0].subCategories) ? arr[0].subCategories : [];
            setSubCategoryId(firstSubs[0]?.id ?? null);
          }
        }
      } catch (e) {
        console.error(e);
        if (!ignore) {
          setCategories([]);
          message.error(e.message || "Category load failed");
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

  const subOptions = useMemo(() => {
    const subs = Array.isArray(selectedCategory?.subCategories) ? selectedCategory.subCategories : [];
    // optional active filter
    return subs.filter((s) => s?.isActive !== false);
  }, [selectedCategory]);

  // if category changes -> reset subcategory
  useEffect(() => {
    if (!categoryId) return;
    const first = subOptions[0]?.id ?? null;
    setSubCategoryId(first);
    // eslint-disable-next-line
  }, [categoryId]);

  /* ---------------- image preview ---------------- */
  const imagePreviews = useMemo(() => images.map((f) => URL.createObjectURL(f)), [images]);

  /* ---------------- image select ---------------- */
  const handleImageChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const valid = files.filter((f) => f.size <= MAX_SIZE);
    if (valid.length !== files.length) message.error("Each image must be 10MB or less");

    const merged = [...images, ...valid].slice(0, MAX_IMAGES);
    setImages(merged);

    e.target.value = "";
  };

  const removeImage = (index) => setImages((prev) => prev.filter((_, i) => i !== index));

  /* ---------------- money helpers ---------------- */
  const moneyFormatter = (v) =>
    v === null || v === undefined || v === "" ? "" : `৳ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const moneyParser = (v) => (v ? v.replace(/[৳,\s]/g, "") : "");

  /* ---------------- quill ---------------- */
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

  /* ---------------- submit ---------------- */
  const onSubmit = async (data) => {
    try {
      setErrorMessage("");

      if (!categoryId) throw new Error("Select a category");
      if (!images.length) throw new Error("Select at least one image");

      // ✅ upload images to 5001
      const uploadPromises = images.map((file) => {
        const fd = new FormData();
        fd.append("file", file);
        return fetch(UPLOAD_URL, { method: "POST", body: fd });
      });

      const uploadResponses = await Promise.all(uploadPromises);

      const uploadJson = await Promise.all(
        uploadResponses.map(async (res) => {
          if (!res.ok) throw new Error("Image upload failed");
          return res.json();
        })
      );

      const imageUrls = uploadJson.flatMap((u) => u.urls || []);
      if (!imageUrls.length) throw new Error("Image upload succeeded but no URL returned");

      // ✅ build payload
      const payload = {
        name: data.name.trim(),
        price: Number(data.price),
        oldPrice: data.oldPrice !== null && data.oldPrice !== "" ? Number(data.oldPrice) : null,
        stock: Number(data.stock),

        // ✅ new ids
        categoryId,
        subCategoryId: subCategoryId || null,

        // ✅ keep string fields too (optional, for old search/filter)
        category: selectedCategory?.slug || selectedCategory?.name || null,
        subCategory:
          subOptions.find((s) => s.id === subCategoryId)?.slug ||
          subOptions.find((s) => s.id === subCategoryId)?.name ||
          null,

        description: data.description,
        imageUrl: imageUrls, // ✅ use this (controller supports images or imageurl)
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
    } catch (err) {
      console.error(err);
      setErrorMessage(err.message);
      message.error(err.message);
    }
  };

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
          {/* Category + SubCategory */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 16,
              marginBottom: 8,
            }}
          >
            <Form.Item label="Category" required>
              {catLoading ? (
                <Spin size="small" />
              ) : (
                <Select
                  value={categoryId}
                  onChange={(v) => setCategoryId(v)}
                  placeholder="Select category"
                  options={categories.map((c) => ({ value: c.id, label: c.name }))}
                />
              )}
            </Form.Item>

            <Form.Item label="Subcategory (optional)">
              <Select
                value={subCategoryId}
                onChange={(v) => setSubCategoryId(v)}
                placeholder={subOptions.length ? "Select subcategory" : "No subcategories"}
                allowClear
                disabled={!subOptions.length}
                options={subOptions.map((s) => ({ value: s.id, label: s.name }))}
              />
            </Form.Item>
          </div>

          {/* Name */}
          <Form.Item
            label="Product Name"
            validateStatus={errors.name ? "error" : ""}
            help={errors.name?.message}
          >
            <Controller
              name="name"
              control={control}
              rules={{ required: "Product name required", minLength: 3 }}
              render={({ field }) => <Input {...field} />}
            />
          </Form.Item>

          {/* Price / Old / Stock */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 16,
            }}
          >
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
            <input type="file" multiple accept="image/*" onChange={handleImageChange} />

            {images.length > 0 && (
              <div
                style={{
                  marginTop: 12,
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                  gap: 12,
                }}
              >
                {imagePreviews.map((src, i) => (
                  <div key={i}>
                    <img src={src} alt="" style={{ width: "100%", height: 110, objectFit: "cover" }} />
                    <Button danger size="small" block onClick={() => removeImage(i)}>
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}
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
                  style={{ height: 200, marginBottom: 50 }}
                />
              )}
            />
          </Form.Item>

          {errorMessage && <div style={{ color: "red", textAlign: "center" }}>{errorMessage}</div>}

          <Button type="primary" htmlType="submit" loading={isSubmitting} block size="large">
            Create Product
          </Button>
        </Form>
      </Card>
    </div>
  );
};

export default CreateItem;
