import React, { useEffect, useMemo, useState } from "react";
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Switch,
  InputNumber,
  Select,
  Popconfirm,
  message,
  Tag,
  Image,
  Space,
  Skeleton,
  Upload,
} from "antd";
import { PlusOutlined, UploadOutlined } from "@ant-design/icons";
import { API_BASE_URL } from "../../../config/env";
import { UPLOAD_BASE_URL } from "../../../config/env";
import { useSelector } from "react-redux";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import { normalizeImageUrl } from "../../../utils/imageUrl";

const UPLOAD_ENDPOINT = `${UPLOAD_BASE_URL}/upload/image?scope=offers`;
const UPLOAD_DELETE_ENDPOINT = `${UPLOAD_BASE_URL}/upload/delete`;

const getFullImageUrl = (imgPath) => {
  return normalizeImageUrl(imgPath) || "/placeholder-product.jpg";
};

const uploadImages = async (files = []) => {
  const uploadPromises = files.map((file) => {
    const fd = new FormData();
    fd.append("file", file);
    return fetch(UPLOAD_ENDPOINT, { method: "POST", body: fd });
  });

  const uploadResponses = await Promise.all(uploadPromises);

  const uploadJson = await Promise.all(
    uploadResponses.map(async (res) => {
      if (!res.ok) throw new Error("Image upload failed");
      return res.json();
    })
  );

  const pickUploadedPath = (json) => {
    if (Array.isArray(json?.paths) && json.paths[0]) return json.paths[0];
    return "";
  };

  return uploadJson.map((u) => pickUploadedPath(u)).filter(Boolean);
};

const AdminOffers = () => {
  const reduxToken = useSelector((s) => s.auth?.token);
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(false);

  const [fileList, setFileList] = useState([]);


  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null); // offer row
  const [saving, setSaving] = useState(false);

  // image preview
  const [localPreview, setLocalPreview] = useState(null); // selected file preview
  const [keepExisting, setKeepExisting] = useState(true); // edit mode: keep current image by default

  const [form] = Form.useForm();
  const quillModules = useMemo(
    () => ({
      toolbar: [
        [{ header: [1, 2, false] }],
        ["bold", "italic", "underline"],
        [{ list: "ordered" }, { list: "bullet" }],
        ["link"],
        ["clean"],
      ],
    }),
    []
  );
  const token = useMemo(() => {
    if (reduxToken) return reduxToken;
    try {
      const saved = JSON.parse(localStorage.getItem("userInfo") || "null");
      return saved?.token || null;
    } catch {
      return null;
    }
  }, [reduxToken]);

  const authHeaders = useMemo(() => {
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [token]);

  const resetModalState = () => {
    form.resetFields();
    setLocalPreview(null);
    setKeepExisting(true);
    setEditing(null);
    setFileList([]);
  };

  // ✅ Load offers
  const loadOffers = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/offers/admin`, {
        headers: authHeaders,
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        message.error(data?.message || "Failed to load offers");
        setOffers([]);
        return;
      }
      setOffers(Array.isArray(data.offers) ? data.offers : []);
    } catch (e) {
      message.error("Failed to load offers");
      setOffers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    loadOffers();
  }, [token]);

  // ✅ Open create
  const openCreate = () => {
    resetModalState();
    setOpen(true);
    form.setFieldsValue({
      title: "",
      description: "",
      type: "carousel",
      sortOrder: 0,
      isActive: true,
      imageUrl: "", // fallback manual
      imageFile: [],
    });
  };

  // ✅ Open edit
  const openEdit = (row) => {
    resetModalState();
    setEditing(row);
    setOpen(true);

    form.setFieldsValue({
      title: row.title || "",
      description: row.description || "",
      type: row.type || "carousel",
      sortOrder: Number(row.sortOrder || 0),
      isActive: !!row.isActive,
      imageUrl: row.imageUrl || "",
      imageFile: [],
    });

    // edit mode এ default: existing image রাখবো
    setKeepExisting(true);
  };

  const onSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      let finalImageUrl = values.imageUrl?.trim() || "";

    const selectedFiles = fileList.map((f) => f.originFileObj).filter(Boolean);

      // Create: image required => either file upload OR imageUrl typed
      if (!editing) {
        if (selectedFiles.length > 0) {
          const urls = await uploadImages(selectedFiles);
          if (!urls.length) throw new Error("Image upload failed");
          finalImageUrl = urls[0];
        }

        if (!finalImageUrl) {
          message.error("Please upload an image or provide imageUrl");
          return;
        }
      }

      // Edit: if keepExisting true and no new upload, keep old
      if (editing) {
        if (keepExisting && selectedFiles.length === 0) {
          finalImageUrl = editing.imageUrl;
        } else {
          // replace image if selected
          if (selectedFiles.length > 0) {
            const urls = await uploadImages(selectedFiles);
            if (!urls.length) throw new Error("Image upload failed");
            finalImageUrl = urls[0];
          }

          // if admin unchecked keepExisting AND did not upload AND left imageUrl empty => error
          if (!keepExisting && selectedFiles.length === 0 && !finalImageUrl) {
            message.error("Please upload a new image or provide imageUrl");
            return;
          }
        }
      }

      const payload = {
        title: values.title?.trim(),
        subtitle: null,
        description: values.description || null,
        imageUrl: finalImageUrl,
        type: values.type || "carousel",
        sortOrder: Number(values.sortOrder || 0),
        isActive: !!values.isActive,
      };

      const url = editing
        ? `${API_BASE_URL}/api/offers/admin/${editing.id}`
        : `${API_BASE_URL}/api/offers/admin`;

      const method = editing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data?.success) {
        message.error(data?.message || "Save failed");
        return;
      }

      if (editing?.imageUrl && finalImageUrl && editing.imageUrl !== finalImageUrl) {
        await fetch(UPLOAD_DELETE_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: editing.imageUrl }),
        }).catch(() => {});
      }

      message.success(editing ? "Offer updated" : "Offer created");
      setOpen(false);
      resetModalState();
      loadOffers();
    } catch (e) {
      // validation errors ignored
      if (String(e?.message || "").includes("Image upload failed")) {
        message.error("Image upload failed");
      }
    } finally {
      setSaving(false);
    }
  };

  // ✅ Delete
  const onDelete = async (row) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/offers/admin/${row.id}`, {
        method: "DELETE",
        headers: authHeaders,
      });
      const data = await res.json();

      if (!res.ok || !data?.success) {
        message.error(data?.message || "Delete failed");
        return;
      }

      if (row?.imageUrl) {
        await fetch(UPLOAD_DELETE_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: row.imageUrl }),
        }).catch(() => {});
      }

      message.success("Offer deleted");
      loadOffers();
    } catch {
      message.error("Delete failed");
    }
  };

  const columns = useMemo(
    () => [
      {
        title: "Preview",
        dataIndex: "imageUrl",
        width: 120,
        render: (v) =>
          v ? (
            <Image
              src={getFullImageUrl(v)}
              width={90}
              height={55}
              style={{ objectFit: "cover", borderRadius: 8 }}
              placeholder={<Skeleton.Image active style={{ width: 90, height: 55 }} />}
            />
          ) : (
            <div className="w-[90px] h-[55px] rounded-md bg-gray-100 border" />
          ),
      },
      {
        title: "Title",
        dataIndex: "title",
        render: (v, row) => (
          <div>
            <div className="font-semibold">{v}</div>
            {row?.description ? (
              <div
                className="text-xs text-gray-500 line-clamp-2 mt-1"
                dangerouslySetInnerHTML={{ __html: row.description }}
              />
            ) : null}
          </div>
        ),
      },
      {
        title: "Type",
        dataIndex: "type",
        width: 110,
        render: (v) => <Tag color="blue">{String(v || "").toUpperCase()}</Tag>,
      },
      {
        title: "Order",
        dataIndex: "sortOrder",
        width: 80,
      },
      {
        title: "Status",
        dataIndex: "isActive",
        width: 110,
        render: (v) => (v ? <Tag color="green">Active</Tag> : <Tag color="red">Inactive</Tag>),
      },
      {
        title: "Action",
        width: 180,
        render: (_, row) => (
          <Space>
            <Button size="small" onClick={() => openEdit(row)}>
              Edit
            </Button>
            <Popconfirm title="Delete this offer?" onConfirm={() => onDelete(row)}>
              <Button danger size="small">
                Delete
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [offers]
  );

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Manage Offers</h2>
          <p className="text-xs text-gray-500">Create / update / delete offers and control homepage preview</p>
          <p className="mt-1 text-xs text-gray-500">
            Banner items appear at the top of the homepage. All other offers show in the Offers section.
          </p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          Add Offer
        </Button>
      </div>

      <div className="md:hidden space-y-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, idx) => (
            <div key={idx} className="rounded-xl border bg-white p-3">
              <Skeleton active avatar paragraph={{ rows: 2 }} />
            </div>
          ))
        ) : offers.length === 0 ? (
          <div className="rounded-xl border bg-white p-4 text-sm text-gray-500">No offers found</div>
        ) : (
          offers.map((row) => (
            <div key={row.id} className="rounded-xl border bg-white p-3 shadow-sm">
              <div className="flex gap-3">
                <div className="shrink-0">
                  {row.imageUrl ? (
                    <Image
                      src={getFullImageUrl(row.imageUrl)}
                      width={92}
                      height={64}
                      style={{ objectFit: "cover", borderRadius: 8 }}
                      placeholder={<Skeleton.Image active style={{ width: 92, height: 64 }} />}
                    />
                  ) : (
                    <div className="w-[92px] h-[64px] rounded-md bg-gray-100 border" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-semibold text-sm text-gray-800 line-clamp-2">{row.title}</div>
                    <Tag color={row.isActive ? "green" : "red"} className="m-0">
                      {row.isActive ? "Active" : "Inactive"}
                    </Tag>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Tag color="blue" className="m-0">
                      {String(row.type || "").toUpperCase()}
                    </Tag>
                    <Tag className="m-0">Order: {Number(row.sortOrder || 0)}</Tag>
                  </div>
                </div>
              </div>

              {row?.description ? (
                <div
                  className="mt-2 text-xs text-gray-500 line-clamp-3"
                  dangerouslySetInnerHTML={{ __html: row.description }}
                />
              ) : null}

              <div className="mt-3 flex gap-2">
                <Button size="small" onClick={() => openEdit(row)} className="flex-1">
                  Edit
                </Button>
                <Popconfirm title="Delete this offer?" onConfirm={() => onDelete(row)}>
                  <Button danger size="small" className="flex-1">
                    Delete
                  </Button>
                </Popconfirm>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="hidden md:block">
        <Table
          rowKey="id"
          columns={columns}
          dataSource={offers}
          loading={loading}
          bordered
          scroll={{ x: 920 }}
          pagination={{ pageSize: 10, responsive: true }}
        />
      </div>

      <Modal
        open={open}
        onCancel={() => {
          setOpen(false);
          resetModalState();
        }}
        onOk={onSubmit}
        okText={saving ? "Saving..." : "Save"}
        confirmLoading={saving}
        title={editing ? `Edit Offer #${editing.id}` : "Create Offer"}
        width={720}
        style={{ maxWidth: "calc(100vw - 24px)" }}
      >
        <Form layout="vertical" form={form}>
          <Form.Item
            name="title"
            label="Title"
            rules={[{ required: true, message: "Title required" }]}
          >
            <Input placeholder="Mega Discount" />
          </Form.Item>

          <Form.Item name="description" label="Description">
            <ReactQuill theme="snow" modules={quillModules} value={form.getFieldValue("description") || ""} onChange={(v) => form.setFieldValue("description", v)} style={{ height: 180, marginBottom: 42 }} />
          </Form.Item>

          {/* Existing image preview (edit mode) */}
          {editing?.imageUrl ? (
            <div className="mb-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-600">Current Image</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Keep</span>
                  <Switch checked={keepExisting} onChange={setKeepExisting} />
                </div>
              </div>

              <div className="rounded-lg overflow-hidden border">
                <img
                  src={getFullImageUrl(editing.imageUrl)}
                  alt="current"
                  className="w-full h-40 object-cover"
                />
              </div>

              {!keepExisting ? (
                <div className="text-xs text-amber-600 mt-1">
                  You turned off “Keep”. Please upload a new image or provide imageUrl below.
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Upload */}
            <Form.Item label="Upload Image (recommended)">
            <Upload
                beforeUpload={() => false}
                maxCount={1}
                listType="picture"
                fileList={fileList}
                onChange={(info) => {
                const latest = info.fileList.slice(-1); // only 1 file
                setFileList(latest);

                const file = latest?.[0]?.originFileObj;
                if (file) {
                    setLocalPreview(URL.createObjectURL(file));
                    if (editing) setKeepExisting(false);
                } else {
                    setLocalPreview(null);
                }
                }}
            >
                <Button icon={<UploadOutlined />}>Select Image</Button>
            </Upload>
            </Form.Item>


          {/* Local preview */}
          {localPreview ? (
            <div className="mb-3 rounded-lg overflow-hidden border">
              <img src={localPreview} alt="preview" className="w-full h-40 object-cover" />
              <div className="px-3 py-2 text-xs text-gray-500 bg-gray-50 border-t">
                Selected image preview (will be uploaded)
              </div>
            </div>
          ) : null}


          <Form.Item name="type" label="Type" initialValue="carousel">
            <Select
              options={[
                { label: "Carousel", value: "carousel" },
                { label: "Banner", value: "banner" },
              ]}
            />
          </Form.Item>

          <Form.Item name="sortOrder" label="Sort Order" initialValue={0}>
            <InputNumber min={0} className="w-full" />
          </Form.Item>

          <Form.Item name="isActive" label="Active" valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>
        </Form>

      </Modal>
    </div>
  );
};

export default AdminOffers;
