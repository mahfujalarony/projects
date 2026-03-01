import React, { useEffect, useMemo, useState } from "react";
import { Button, Card, Input, Popconfirm, Space, Switch, Tree, Typography, message } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import { API_BASE_URL } from "../../../config/env";

const { Text } = Typography;

const API_CATEGORIES = `${API_BASE_URL}/api/categories`;
const API_SUBCATS = `${API_BASE_URL}/api/subcategories`;

const ROOT_KEY = "root";

const buildTreeData = (categories = []) => {
  const mapSub = (sub = []) =>
    (Array.isArray(sub) ? sub : []).map((s) => ({
      key: `sub-${s.id}`,
      title: `${s.name}${s.isActive === false ? " (inactive)" : ""}`,
      nodeType: "subcategory",
      categoryId: s.categoryId,
      subCategoryId: s.id,
      children: mapSub(s.children),
    }));

  return [
    {
      key: ROOT_KEY,
      title: "All Categories",
      nodeType: "root",
      children: (Array.isArray(categories) ? categories : []).map((c) => ({
        key: `cat-${c.id}`,
        title: `${c.name}${c.isActive === false ? " (inactive)" : ""}`,
        nodeType: "category",
        categoryId: c.id,
        children: mapSub(c.subCategories),
      })),
    },
  ];
};

const findNodeByKey = (nodes = [], key) => {
  for (const n of nodes) {
    if (n.key === key) return n;
    if (n.children?.length) {
      const found = findNodeByKey(n.children, key);
      if (found) return found;
    }
  }
  return null;
};

export default function CategoryWithSubAdmin() {
  const [categories, setCategories] = useState([]);
  const [treeLoading, setTreeLoading] = useState(false);

  const [selectedKey, setSelectedKey] = useState(ROOT_KEY);
  const [name, setName] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const treeData = useMemo(() => buildTreeData(categories), [categories]);
  const selectedNode = useMemo(() => findNodeByKey(treeData, selectedKey), [treeData, selectedKey]);

  const loadTree = async () => {
    try {
      setTreeLoading(true);
      const res = await fetch(API_CATEGORIES);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to load category tree");

      setCategories(Array.isArray(data) ? data : []);
    } catch (e) {
      message.error(e.message || "Category tree load failed");
      setCategories([]);
    } finally {
      setTreeLoading(false);
    }
  };

  useEffect(() => {
    loadTree();
  }, []);

  const addNode = async () => {
    if (!name.trim()) return message.error("Name required");

    try {
      setSaving(true);

      if (!selectedNode || selectedNode.nodeType === "root") {
        const res = await fetch(API_CATEGORIES, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), isActive }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || "Failed to add category");
      } else if (selectedNode.nodeType === "category") {
        const res = await fetch(API_SUBCATS, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            categoryId: selectedNode.categoryId,
            parentSubCategoryId: null,
            name: name.trim(),
            isActive,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || "Failed to add subcategory");
      } else {
        const res = await fetch(API_SUBCATS, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            categoryId: selectedNode.categoryId,
            parentSubCategoryId: selectedNode.subCategoryId,
            name: name.trim(),
            isActive,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || "Failed to add nested subcategory");
      }

      message.success("Added");
      setName("");
      setIsActive(true);
      await loadTree();
    } catch (e) {
      message.error(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const deleteSelected = async () => {
    if (!selectedNode || selectedNode.nodeType === "root") return;

    try {
      setDeleting(true);

      if (selectedNode.nodeType === "category") {
        const res = await fetch(`${API_CATEGORIES}/${selectedNode.categoryId}`, { method: "DELETE" });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || "Failed to delete category");
      } else {
        const res = await fetch(`${API_SUBCATS}/${selectedNode.subCategoryId}`, { method: "DELETE" });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || "Failed to delete subcategory");
      }

      message.success("Deleted");
      setSelectedKey(ROOT_KEY);
      await loadTree();
    } catch (e) {
      message.error(e.message || "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  const modeText =
    !selectedNode || selectedNode.nodeType === "root"
      ? "New main category"
      : `Add child under: ${selectedNode.title}`;

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: 12 }}>
      <Card
        title="Category Tree"
        size="small"
        extra={
          <Button icon={<ReloadOutlined />} onClick={loadTree} loading={treeLoading}>
            Refresh
          </Button>
        }
      >
        <Space direction="vertical" style={{ width: "100%" }} size={12}>
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 8 }}>
            <Tree
              defaultExpandAll
              treeData={treeData}
              selectedKeys={[selectedKey]}
              onSelect={(keys) => {
                if (!keys?.length) return;
                setSelectedKey(String(keys[0]));
              }}
              style={{ minHeight: 220 }}
            />
          </div>

          <Text type="secondary">Selected: {modeText}</Text>

          <Input
            placeholder="Enter name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <Space>
            <Text type="secondary">Active</Text>
            <Switch checked={isActive} onChange={setIsActive} />
          </Space>

          <Space>
            <Button type="primary" onClick={addNode} loading={saving}>
              Add Here
            </Button>
            <Popconfirm
              title="Delete selected node?"
              disabled={!selectedNode || selectedNode.nodeType === "root"}
              onConfirm={deleteSelected}
              okText="Delete"
              cancelText="Cancel"
            >
              <Button danger disabled={!selectedNode || selectedNode.nodeType === "root"} loading={deleting}>
                Delete Selected
              </Button>
            </Popconfirm>
          </Space>
        </Space>
      </Card>
    </div>
  );
}
