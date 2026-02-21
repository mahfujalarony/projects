import React, { useEffect, useMemo, useState } from "react";
import { Card, Input, Button, Upload, List, Image, message, Switch, Tag, Empty } from "antd";
import { UploadOutlined, DeleteOutlined, ReloadOutlined } from "@ant-design/icons";
import { API_BASE_URL } from "../../../config/env";
import { UPLOAD_BASE_URL } from "../../../config/env";

const API_CATEGORIES = `${API_BASE_URL}/api/categories`;
const API_SUBCATS = `${API_BASE_URL}/api/subcategories`;
const IMAGE_SERVER = `${UPLOAD_BASE_URL}/upload/image`;

const toFormDataUpload = async (fileObj) => {
  const fd = new FormData();
  fd.append("file", fileObj);
  const res = await fetch(IMAGE_SERVER, { method: "POST", body: fd });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.message || "Image upload failed");
  return (json?.urls || [])[0] || null;
};

const fallbackAvatar = (name = "") => {
  const ch = (name.trim()[0] || "?").toUpperCase();
  return (
    <div
      style={{
        width: 40,
        height: 40,
        borderRadius: 10,
        background: "#f5f5f5",
        display: "grid",
        placeItems: "center",
        fontWeight: 800,
        color: "#666",
      }}
    >
      {ch}
    </div>
  );
};

export default function CategoryWithSubAdmin() {
  // -------------------- CATEGORIES --------------------
  const [categories, setCategories] = useState([]);
  const [selectedCatId, setSelectedCatId] = useState(null);
  const [loadingCats, setLoadingCats] = useState(false);

  const selectedCat = useMemo(
    () => categories.find((c) => c.id === selectedCatId),
    [categories, selectedCatId]
  );

  const loadCategories = async () => {
    try {
      setLoadingCats(true);
      const res = await fetch(API_CATEGORIES);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to load categories");

      const arr = Array.isArray(data) ? data : [];
      setCategories(arr);

      if (!selectedCatId && arr.length) setSelectedCatId(arr[0].id);

      // selected delete হয়ে গেলে fallback
      if (selectedCatId && arr.length && !arr.find((c) => c.id === selectedCatId)) {
        setSelectedCatId(arr[0].id);
      }
    } catch (e) {
      message.error(e.message || "Category load failed");
      setCategories([]);
    } finally {
      setLoadingCats(false);
    }
  };

  useEffect(() => {
    loadCategories();
    // eslint-disable-next-line
  }, []);

  // ---------- Add Category ----------
  const [catName, setCatName] = useState("");
  const [catFileList, setCatFileList] = useState([]);
  const [catIsActive, setCatIsActive] = useState(true);
  const [catLoading, setCatLoading] = useState(false);

  const addCategory = async () => {
    if (!catName.trim()) return message.error("Category name required");

    try {
      setCatLoading(true);

      let imageUrl = null;
      if (catFileList.length) {
        imageUrl = await toFormDataUpload(catFileList[0].originFileObj);
      }

      const res = await fetch(API_CATEGORIES, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: catName.trim(),
          imageUrl,
          isActive: catIsActive,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to add category");

      message.success("Category added");
      setCatName("");
      setCatFileList([]);
      setCatIsActive(true);
      await loadCategories();
    } catch (e) {
      message.error(e.message);
    } finally {
      setCatLoading(false);
    }
  };

  const deleteCategory = async (id) => {
    try {
      const res = await fetch(`${API_CATEGORIES}/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to delete category");

      message.success("Category deleted");
      await loadCategories();
    } catch (e) {
      message.error(e.message);
    }
  };

  // -------------------- SUBCATEGORIES (selected category) --------------------
  const [subcats, setSubcats] = useState([]);
  const [loadingSubList, setLoadingSubList] = useState(false);

  const loadSubCats = async (catId) => {
    if (!catId) return;
    try {
      setLoadingSubList(true);
      const res = await fetch(`${API_SUBCATS}?categoryId=${catId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to load subcategories");

      setSubcats(Array.isArray(data) ? data : []);
    } catch (e) {
      message.error(e.message || "Subcategory load failed");
      setSubcats([]);
    } finally {
      setLoadingSubList(false);
    }
  };

  useEffect(() => {
    if (selectedCatId) loadSubCats(selectedCatId);
    else setSubcats([]);
    // eslint-disable-next-line
  }, [selectedCatId]);

  // ---------- Add SubCategory ----------
  const [subName, setSubName] = useState("");
  const [subFileList, setSubFileList] = useState([]);
  const [subIsActive, setSubIsActive] = useState(true);
  const [subLoading, setSubLoading] = useState(false);

  const addSubCategory = async () => {
    if (!selectedCatId) return message.error("Select a category first");
    if (!subName.trim()) return message.error("Subcategory name required");

    try {
      setSubLoading(true);

      let imageUrl = null;
      if (subFileList.length) {
        imageUrl = await toFormDataUpload(subFileList[0].originFileObj);
      }

      const res = await fetch(API_SUBCATS, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId: selectedCatId,
          name: subName.trim(),
          imageUrl,
          isActive: subIsActive,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to add subcategory");

      message.success(`Subcategory added to "${selectedCat?.name || ""}"`);
      setSubName("");
      setSubFileList([]);
      setSubIsActive(true);
      await loadSubCats(selectedCatId);
    } catch (e) {
      message.error(e.message);
    } finally {
      setSubLoading(false);
    }
  };

  const toggleSubActive = async (id, next) => {
    try {
      const res = await fetch(`${API_SUBCATS}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed");

      setSubcats((prev) => prev.map((s) => (s.id === id ? { ...s, isActive: next } : s)));
    } catch (e) {
      message.error(e.message);
    }
  };

  const deleteSubCategory = async (id) => {
    try {
      const res = await fetch(`${API_SUBCATS}/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to delete subcategory");

      message.success("Subcategory deleted");
      await loadSubCats(selectedCatId);
    } catch (e) {
      message.error(e.message);
    }
  };

  // -------------------- UI --------------------
  return (
    <div style={{ maxWidth: 1040, margin: "0 auto", padding: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {/* LEFT: CATEGORY */}
        <div>
          <Card
            title="Add Category (Image only)"
            size="small"
            extra={
              <Button size="small" icon={<ReloadOutlined />} loading={loadingCats} onClick={loadCategories}>
                Refresh
              </Button>
            }
          >
            <Input
              placeholder="Category name"
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
              style={{ marginBottom: 8 }}
            />

            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 12, color: "#666" }}>Active</span>
              <Switch checked={catIsActive} onChange={setCatIsActive} />
            </div>

            <Upload
              listType="picture"
              fileList={catFileList}
              beforeUpload={() => false}
              onChange={({ fileList }) => setCatFileList(fileList)}
              maxCount={1}
            >
              <Button icon={<UploadOutlined />}>Select Category Image</Button>
            </Upload>

            <Button type="primary" block loading={catLoading} onClick={addCategory} style={{ marginTop: 10 }}>
              Add Category
            </Button>
          </Card>

          <Card title="Categories (Click to manage Subcategories)" size="small" style={{ marginTop: 12 }} loading={loadingCats}>
            <List
              dataSource={categories}
              locale={{ emptyText: "No categories" }}
              renderItem={(c) => {
                const isSelected = c.id === selectedCatId;

                return (
                  <List.Item
                    onClick={() => setSelectedCatId(c.id)}
                    style={{
                      cursor: "pointer",
                      borderRadius: 10,
                      padding: 10,
                      background: isSelected ? "#f0f5ff" : "transparent",
                    }}
                    actions={[
                      <Button
                        danger
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteCategory(c.id);
                        }}
                      />,
                    ]}
                  >
                    <List.Item.Meta
                      avatar={
                        c.imageUrl ? (
                          <Image
                            src={c.imageUrl}
                            width={40}
                            height={40}
                            style={{ objectFit: "cover", borderRadius: 10 }}
                            preview={false}
                          />
                        ) : (
                          fallbackAvatar(c.name)
                        )
                      }
                      title={
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 14, fontWeight: 700 }}>{c.name}</span>
                          {isSelected && <Tag color="blue">Selected</Tag>}
                        </div>
                      }
                      description={<span style={{ fontSize: 12, color: "#888" }}>{c.slug}</span>}
                    />
                  </List.Item>
                );
              }}
            />
          </Card>
        </div>

        {/* RIGHT: SUBCATEGORY for selected */}
        <div>
          <Card
            title="Subcategories (Image only)"
            size="small"
            extra={selectedCat ? <Tag color="blue">{selectedCat.name}</Tag> : <Tag>Select a category</Tag>}
          >
            {!selectedCat ? (
              <Empty description="Click a category from the left list" />
            ) : (
              <>
                <Input
                  placeholder={`Subcategory name under "${selectedCat.name}"`}
                  value={subName}
                  onChange={(e) => setSubName(e.target.value)}
                  style={{ marginBottom: 8 }}
                />

                <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
                  <span style={{ fontSize: 12, color: "#666" }}>Active</span>
                  <Switch checked={subIsActive} onChange={setSubIsActive} />
                  <Button
                    size="small"
                    icon={<ReloadOutlined />}
                    loading={loadingSubList}
                    onClick={() => loadSubCats(selectedCatId)}
                    style={{ marginLeft: "auto" }}
                  >
                    Refresh
                  </Button>
                </div>

                <Upload
                  listType="picture"
                  fileList={subFileList}
                  beforeUpload={() => false}
                  onChange={({ fileList }) => setSubFileList(fileList)}
                  maxCount={1}
                >
                  <Button icon={<UploadOutlined />}>Select Subcategory Image</Button>
                </Upload>

                <Button
                  type="primary"
                  block
                  loading={subLoading}
                  onClick={addSubCategory}
                  style={{ marginTop: 10 }}
                >
                  Add Subcategory
                </Button>

                <Card size="small" title={`List for "${selectedCat.name}"`} style={{ marginTop: 12 }} loading={loadingSubList}>
                  <List
                    dataSource={subcats}
                    locale={{ emptyText: "No subcategories" }}
                    renderItem={(s) => (
                      <List.Item
                        actions={[
                          <Switch checked={!!s.isActive} onChange={(v) => toggleSubActive(s.id, v)} />,
                          <Button danger size="small" icon={<DeleteOutlined />} onClick={() => deleteSubCategory(s.id)} />,
                        ]}
                      >
                        <List.Item.Meta
                          avatar={
                            s.imageUrl ? (
                              <Image
                                src={s.imageUrl}
                                width={40}
                                height={40}
                                style={{ objectFit: "cover", borderRadius: 10 }}
                                preview={false}
                              />
                            ) : (
                              fallbackAvatar(s.name)
                            )
                          }
                          title={<span style={{ fontSize: 14, fontWeight: 600 }}>{s.name}</span>}
                          description={<span style={{ fontSize: 12, color: "#888" }}>slug: {s.slug}</span>}
                        />
                      </List.Item>
                    )}
                  />
                </Card>
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
