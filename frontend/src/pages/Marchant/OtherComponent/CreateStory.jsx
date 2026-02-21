// src/pages/merchant/CreateStory.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Card,
  Typography,
  Space,
  Upload,
  Button,
  Input,
  InputNumber,
  message,
  Tag,
  List,
  Image,
  Popconfirm,
  Switch,
  Divider,
  Empty,
  Skeleton,
} from "antd";
import { PlusOutlined, DeleteOutlined, UploadOutlined, ReloadOutlined } from "@ant-design/icons";
import axios from "axios";
import { useSelector } from "react-redux";
import { API_BASE_URL } from "../../../config/env";
import { UPLOAD_BASE_URL } from "../../../config/env";

const { Title, Text } = Typography;

const API_BASE = `${API_BASE_URL}`;
const UPLOAD_URL = `${UPLOAD_BASE_URL}/upload/image`;

const clean = (u) => (u ? String(u).replace(/\\/g, "/") : "");

const isExpired = (expiresAt) => {
  if (!expiresAt) return false;
  const t = new Date(expiresAt).getTime();
  return Number.isFinite(t) && t <= Date.now();
};

export default function CreateStory() {
  const token = useSelector((s) => s.auth?.token);

  const [title, setTitle] = useState("");
  const [expiryHours, setExpiryHours] = useState(24);

  const [fileList, setFileList] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const [myStories, setMyStories] = useState([]);
  const [loading, setLoading] = useState(false);

  const headers = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);

  const MAX_IMAGES = 8;
  const MAX_MB = 6;

  const beforeUpload = (file) => {
    const isImg = file.type?.startsWith("image/");
    if (!isImg) {
      message.error("Only image files allowed");
      return Upload.LIST_IGNORE;
    }
    const ok = file.size / 1024 / 1024 < MAX_MB;
    if (!ok) {
      message.error(`Image must be smaller than ${MAX_MB}MB`);
      return Upload.LIST_IGNORE;
    }
    return false; // stop auto upload
  };

  const fetchMyStories = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE}/api/stories/me`, { headers });
      if (res.data?.success) {
        setMyStories(Array.isArray(res.data.stories) ? res.data.stories : []);
      } else {
        setMyStories([]);
      }
    } catch (e) {
      console.error(e);
      setMyStories([]);
      message.error(e.response?.data?.message || "Failed to load stories");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyStories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const uploadTo5001 = async () => {
    const files = fileList.map((f) => f.originFileObj).filter(Boolean);
    if (!files.length) return [];

    const uploadPromises = files.map((file) => {
      const fd = new FormData();
      fd.append("file", file); // ✅ field name "file"
      return fetch(UPLOAD_URL, { method: "POST", body: fd });
    });

    const uploadResponses = await Promise.all(uploadPromises);

    const uploadJson = await Promise.all(
      uploadResponses.map(async (res) => {
        if (!res.ok) throw new Error("Image upload failed");
        return res.json();
      })
    );

    const urls = uploadJson.flatMap((u) => u.urls || []);
    return urls.map(clean);
  };

  const handleCreate = async () => {
    if (!token) return message.info("Login required");
    if (!fileList.length) return message.error("Select at least 1 image");

    try {
      setSubmitting(true);

      // 1) upload images to 5001
      const mediaUrls = await uploadTo5001();
      if (!mediaUrls.length) {
        message.error("Upload failed");
        return;
      }

      // 2) create story on 3001
      const payload = {
        title: title.trim() || null,
        mediaUrls,
        expiryHours: Number(expiryHours || 24),
      };

      const res = await axios.post(`${API_BASE}/api/stories`, payload, { headers });
      if (res.data?.success) {
        message.success("Story created!");
        setTitle("");
        setExpiryHours(24);
        setFileList([]);
        await fetchMyStories();
      } else {
        message.error(res.data?.message || "Failed");
      }
    } catch (e) {
      console.error(e);
      message.error(e.response?.data?.message || e.message || "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (story, checked) => {
    try {
      const res = await axios.patch(
        `${API_BASE}/api/stories/${story.id}`,
        { isActive: checked },
        { headers }
      );
      if (res.data?.success) {
        message.success("Updated");
        setMyStories((prev) =>
          prev.map((s) => (s.id === story.id ? { ...s, isActive: checked } : s))
        );
      } else {
        message.error(res.data?.message || "Failed");
      }
    } catch (e) {
      console.error(e);
      message.error(e.response?.data?.message || "Failed");
    }
  };

  const deleteStory = async (storyId) => {
    try {
      const res = await axios.delete(`${API_BASE}/api/stories/${storyId}`, { headers });
      if (res.data?.success) {
        message.success("Deleted");
        setMyStories((prev) => prev.filter((s) => s.id !== storyId));
      } else {
        message.error(res.data?.message || "Failed");
      }
    } catch (e) {
      console.error(e);
      message.error(e.response?.data?.message || "Failed");
    }
  };

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <Card style={{ borderRadius: 16 }}>
          <Space style={{ width: "100%", justifyContent: "space-between" }} align="start">
            <div>
              <Title level={4} style={{ marginBottom: 0 }}>
                Create Story
              </Title>
              <Text type="secondary">
                Upload images to 5001, then create a 24h story for your shop.
              </Text>
            </div>
          </Space>

          <Divider />

          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Story title (optional)"
              maxLength={120}
            />

            <div>
              <Text strong>Expiry (hours)</Text>
              <div style={{ marginTop: 6 }}>
                <InputNumber
                  min={1}
                  max={168}
                  value={expiryHours}
                  onChange={setExpiryHours}
                />
                <Text type="secondary" style={{ marginLeft: 10 }}>
                  (default 24 hours)
                </Text>
              </div>
            </div>

            <div>
              <Text strong>Story Images</Text>
              <div style={{ marginTop: 8 }}>
                <Upload
                  listType="picture-card"
                  multiple
                  accept="image/*"
                  beforeUpload={beforeUpload}
                  fileList={fileList}
                  onChange={({ fileList: fl }) => setFileList(fl.slice(0, MAX_IMAGES))}
                >
                  {fileList.length >= MAX_IMAGES ? null : (
                    <div>
                      <PlusOutlined />
                      <div style={{ marginTop: 8 }}>Select</div>
                    </div>
                  )}
                </Upload>
              </div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Max {MAX_IMAGES} images, {MAX_MB}MB each.
              </Text>
            </div>

            <Button
              type="primary"
              icon={<UploadOutlined />}
              loading={submitting}
              onClick={handleCreate}
            >
              Create Story
            </Button>
          </Space>
        </Card>

        <Card style={{ borderRadius: 16, marginTop: 16 }}>
          <Space style={{ width: "100%", justifyContent: "space-between" }}>
            <Title level={5} style={{ margin: 0 }}>
              My Stories
            </Title>
            <Button icon={<ReloadOutlined />} onClick={fetchMyStories}>
              Refresh
            </Button>
          </Space>

          <Divider style={{ margin: "12px 0" }} />

          {loading ? (
            <div>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} style={{ marginBottom: 12 }}>
                  <Skeleton active paragraph={{ rows: 2 }} />
                </div>
              ))}
            </div>
          ) : myStories.length === 0 ? (
            <Empty description="No stories yet" />
          ) : (
            <List
              itemLayout="vertical"
              dataSource={myStories}
              renderItem={(s) => {
                const expired = isExpired(s.expiresAt);
                const cover = Array.isArray(s.mediaUrls) ? clean(s.mediaUrls[0]) : "";
                return (
                  <List.Item
                    key={s.id}
                    extra={
                      cover ? (
                        <Image
                          src={cover}
                          width={120}
                          height={90}
                          style={{ objectFit: "cover", borderRadius: 12 }}
                        />
                      ) : null
                    }
                  >
                    <Space direction="vertical" style={{ width: "100%" }} size={6}>
                      <Space wrap style={{ justifyContent: "space-between", width: "100%" }}>
                        <Space wrap>
                          <Text strong>
                            {s.title || "Untitled Story"}{" "}
                            <Text type="secondary">#{s.id}</Text>
                          </Text>
                          {expired ? <Tag color="default">Expired</Tag> : <Tag color="green">Live</Tag>}
                          {s.isActive ? <Tag color="blue">Active</Tag> : <Tag color="red">Inactive</Tag>}
                        </Space>

                        <Space>
                          <Space size={6}>
                            <Text type="secondary">Active</Text>
                            <Switch
                              checked={!!s.isActive}
                              onChange={(checked) => toggleActive(s, checked)}
                            />
                          </Space>

                          <Popconfirm
                            title="Delete this story?"
                            okText="Delete"
                            okButtonProps={{ danger: true }}
                            onConfirm={() => deleteStory(s.id)}
                          >
                            <Button danger icon={<DeleteOutlined />}>
                              Delete
                            </Button>
                          </Popconfirm>
                        </Space>
                      </Space>

                      <Text type="secondary" style={{ fontSize: 12 }}>
                        Created: {s.createdAt ? new Date(s.createdAt).toLocaleString() : "—"} •
                        Expires: {s.expiresAt ? new Date(s.expiresAt).toLocaleString() : "—"}
                      </Text>

                      {Array.isArray(s.mediaUrls) && s.mediaUrls.length > 0 ? (
                        <Space wrap>
                          {s.mediaUrls.slice(0, 6).map((u, i) => (
                            <Image
                              key={i}
                              src={clean(u)}
                              width={64}
                              height={64}
                              style={{ objectFit: "cover", borderRadius: 10 }}
                            />
                          ))}
                          {s.mediaUrls.length > 6 ? (
                            <Tag>+{s.mediaUrls.length - 6} more</Tag>
                          ) : null}
                        </Space>
                      ) : null}
                    </Space>
                  </List.Item>
                );
              }}
            />
          )}
        </Card>
      </div>
    </div>
  );
}
