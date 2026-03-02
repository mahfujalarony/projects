import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Image,
  InputNumber,
  Popconfirm,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import { DeleteOutlined, ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import axios from "axios";
import { useSelector } from "react-redux";
import { API_BASE_URL, UPLOAD_BASE_URL } from "../../../config/env";

const { Text, Title } = Typography;
const API_BASE = `${API_BASE_URL}/api`;

const bytesToText = (bytes) => {
  const n = Number(bytes || 0);
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = n;
  let idx = 0;
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024;
    idx += 1;
  }
  return `${value.toFixed(idx === 0 ? 0 : 2)} ${units[idx]}`;
};

const toPreviewUrl = (relPath) => {
  const p = String(relPath || "").replace(/\\/g, "/").replace(/^\/+/, "");
  if (!p) return "";
  if (/^https?:\/\//i.test(p)) return p;
  return `${UPLOAD_BASE_URL}/${p}`;
};

export default function MediaCleanup() {
  const reduxToken = useSelector((s) => s.auth?.token);
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [minAgeMinutes, setMinAgeMinutes] = useState(0);

  const token = useMemo(() => {
    if (reduxToken) return reduxToken;
    try {
      return JSON.parse(localStorage.getItem("userInfo") || "null")?.token || null;
    } catch {
      return null;
    }
  }, [reduxToken]);

  const headers = useMemo(
    () => (token ? { Authorization: `Bearer ${token}` } : {}),
    [token]
  );

  const fetchOrphans = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/admin/media/orphans`, {
        headers,
        params: { minAgeMinutes: Number(minAgeMinutes || 0) },
      });
      const data = res.data?.data || {};
      setItems(Array.isArray(data.items) ? data.items : []);
      setSummary(data.summary || null);
      setSelectedRowKeys([]);
    } catch (err) {

      message.error(err?.response?.data?.message || "Failed to scan orphan images");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrphans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const deleteOrphans = async (paths) => {
    if (!token) return;
    setDeleting(true);
    try {
      const res = await axios.delete(`${API_BASE}/admin/media/orphans`, {
        headers,
        data: {
          minAgeMinutes: Number(minAgeMinutes || 0),
          paths: Array.isArray(paths) && paths.length ? paths : undefined,
        },
      });
      const deleted = Number(res.data?.data?.deleted || 0);
      const skipped = Array.isArray(res.data?.data?.skipped) ? res.data.data.skipped.length : 0;
      message.success(`Deleted ${deleted} orphan image(s)${skipped ? `, skipped ${skipped}` : ""}`);
      await fetchOrphans();
    } catch (err) {

      message.error(err?.response?.data?.message || "Failed to delete orphan images");
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    {
      title: "Preview",
      dataIndex: "path",
      key: "preview",
      width: 92,
      render: (p) => (
        <Image
          src={toPreviewUrl(p)}
          width={56}
          height={56}
          style={{ objectFit: "cover", borderRadius: 8 }}
          fallback="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="
        />
      ),
    },
    {
      title: "Path",
      dataIndex: "path",
      key: "path",
      render: (p) => <Text code>{p}</Text>,
    },
    {
      title: "Size",
      dataIndex: "size",
      key: "size",
      width: 120,
      render: (v) => <Tag>{bytesToText(v)}</Tag>,
    },
    {
      title: "Modified",
      dataIndex: "modifiedAt",
      key: "modifiedAt",
      width: 200,
      render: (v) => (v ? new Date(v).toLocaleString() : "-"),
    },
  ];

  const totalSelectedBytes = useMemo(
    () =>
      items
        .filter((x) => selectedRowKeys.includes(x.path))
        .reduce((sum, x) => sum + Number(x.size || 0), 0),
    [items, selectedRowKeys]
  );

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      <Card bordered={false}>
        <Space direction="vertical" style={{ width: "100%" }} size="middle">
          <div>
            <Title level={4} style={{ marginBottom: 4 }}>
              Unused Upload Images Cleanup
            </Title>
            <Text type="secondary">
              Scans `upload/uploads/images` and lists files not referenced by admin products, merchant store,
              stories, or user avatars.
            </Text>
          </div>

          <Alert
            type="info"
            showIcon
            message="Safe cleanup workflow"
            description="This page only deletes files currently not referenced in database records. Set Min Age > 0 if you want to protect very recent uploads."
          />

          <Space wrap>
            <Text strong>Min Age (minutes)</Text>
            <InputNumber
              min={0}
              step={5}
              value={minAgeMinutes}
              onChange={(v) => setMinAgeMinutes(Number(v || 0))}
            />
            <Button icon={<SearchOutlined />} onClick={fetchOrphans} loading={loading}>
              Scan
            </Button>
            <Button icon={<ReloadOutlined />} onClick={fetchOrphans} disabled={loading}>
              Refresh
            </Button>
            <Popconfirm
              title="Delete all listed orphan images?"
              onConfirm={() => deleteOrphans()}
              okButtonProps={{ danger: true, loading: deleting }}
              disabled={!items.length}
            >
              <Button danger icon={<DeleteOutlined />} loading={deleting} disabled={!items.length}>
                Delete All Listed
              </Button>
            </Popconfirm>
            <Popconfirm
              title={`Delete ${selectedRowKeys.length} selected orphan image(s)?`}
              onConfirm={() => deleteOrphans(selectedRowKeys)}
              okButtonProps={{ danger: true, loading: deleting }}
              disabled={!selectedRowKeys.length}
            >
              <Button
                danger
                type="primary"
                ghost
                icon={<DeleteOutlined />}
                loading={deleting}
                disabled={!selectedRowKeys.length}
              >
                Delete Selected
              </Button>
            </Popconfirm>
          </Space>

          <Space wrap>
            <Tag color="blue">Orphans: {Number(summary?.totalFiles || items.length)}</Tag>
            <Tag color="purple">Recoverable: {bytesToText(summary?.totalBytes || 0)}</Tag>
            <Tag>Used Refs Seen: {Number(summary?.usedRefs || 0)}</Tag>
            {selectedRowKeys.length ? (
              <Tag color="red">
                Selected: {selectedRowKeys.length} ({bytesToText(totalSelectedBytes)})
              </Tag>
            ) : null}
          </Space>

          <Table
            rowKey="path"
            loading={loading}
            columns={columns}
            dataSource={items}
            rowSelection={{
              selectedRowKeys,
              onChange: setSelectedRowKeys,
            }}
            pagination={{ pageSize: 10, showSizeChanger: true }}
            scroll={{ x: 900 }}
            locale={{ emptyText: "No orphan images found" }}
          />
        </Space>
      </Card>
    </div>
  );
}
