import React, { useEffect, useMemo, useState } from "react";
import { Button, Card, Form, Input, Modal, Popconfirm, Space, Switch, Table, Tabs, message, Upload } from "antd";
import { UploadOutlined } from "@ant-design/icons";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { API_BASE_URL } from "../../../config/env";
import { UPLOAD_BASE_URL } from "../../../config/env";

const API_BASE = `${API_BASE_URL}/api/mobile-banking`;
const UPLOAD_URL = `${UPLOAD_BASE_URL}/upload/image`;

export default function MobileBankingManager() {
  const navigate = useNavigate();
  const token =
    useSelector((state) => state.auth?.token) ||
    JSON.parse(localStorage.getItem("userInfo") || "{}")?.token;
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const [fileList, setFileList] = useState([]);
  const [editFileList, setEditFileList] = useState([]);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const res = await axios.get(API_BASE, { headers });
      setRows(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (e) {
      console.error(e);
      message.error("Mobile banking load failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, [token]);

  const onCreate = async (values) => {
    try {
      let finalImgUrl = values.imgUrl?.trim() || "";

      if (fileList.length > 0) {
        const formData = new FormData();
        formData.append("file", fileList[0].originFileObj);
        const upRes = await fetch(UPLOAD_URL, { method: "POST", body: formData });
        const upJson = await upRes.json();
        if (upJson.urls && upJson.urls.length > 0) {
          finalImgUrl = upJson.urls[0];
        }
      }

      const payload = {
        name: values.name?.trim(),
        imgUrl: finalImgUrl,
        isActive: values.isActive ?? true,
      };
      await axios.post(API_BASE, payload, { headers });
      message.success("Created");
      createForm.resetFields();
      setFileList([]);
      fetchAll();
    } catch (e) {
      console.error(e);
      message.error(e?.response?.data?.message || "Create failed");
    }
  };

  const openEdit = (row) => {
    setEditing(row);
    setEditFileList([]);
    editForm.setFieldsValue({
      name: row?.name || "",
      imgUrl: row?.imgUrl || "",
      isActive: !!row?.isActive,
    });
    setEditOpen(true);
  };

  const onUpdate = async () => {
    try {
      const values = await editForm.validateFields();
      let finalImgUrl = values.imgUrl?.trim() || "";

      if (editFileList.length > 0) {
        const formData = new FormData();
        formData.append("file", editFileList[0].originFileObj);
        const upRes = await fetch(UPLOAD_URL, { method: "POST", body: formData });
        const upJson = await upRes.json();
        if (upJson.urls && upJson.urls.length > 0) {
          finalImgUrl = upJson.urls[0];
        }
      }

      await axios.put(
        `${API_BASE}/${editing.id}`,
        {
          name: values.name?.trim(),
          imgUrl: finalImgUrl,
          isActive: values.isActive,
        },
        { headers }
      );
      message.success("Updated");
      setEditOpen(false);
      setEditing(null);
      setEditFileList([]);
      fetchAll();
    } catch (e) {
      if (e?.errorFields) return; // validation
      console.error(e);
      message.error(e?.response?.data?.message || "Update failed");
    }
  };

  const onDelete = async (id) => {
    try {
      await axios.delete(`${API_BASE}/${id}`, { headers });
      message.success("Deleted");
      fetchAll();
    } catch (e) {
      console.error(e);
      message.error(e?.response?.data?.message || "Delete failed");
    }
  };

  const columns = useMemo(
    () => [
      { title: "ID", dataIndex: "id", width: 80 },
      {
        title: "Logo",
        dataIndex: "imgUrl",
        width: 120,
        render: (url) =>
          url ? (
            <img
              src={url}
              alt="logo"
              style={{ width: 46, height: 46, objectFit: "cover", borderRadius: 10, border: "1px solid #eee" }}
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
          ) : (
            "-"
          ),
      },
      { title: "Name", dataIndex: "name" },
      {
        title: "Active",
        dataIndex: "isActive",
        width: 120,
        render: (v) => (v ? "Yes" : "No"),
      },
      {
        title: "Actions",
        width: 360,
        render: (_, row) => (
          <Space wrap>
            <Button
              type="primary"
              onClick={() => navigate(`/admin/wallets/${row.id}`)}
            >
              Manage Wallets
            </Button>

            <Button onClick={() => openEdit(row)}>Edit</Button>

            <Popconfirm
              title="Delete this provider?"
              okText="Delete"
              cancelText="Cancel"
              onConfirm={() => onDelete(row.id)}
            >
              <Button danger>Delete</Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [navigate]
  );

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 16 }}>
      <Card style={{ borderRadius: 14 }}>
        <Tabs
          items={[
            {
              key: "create",
              label: "Create Mobile Banking",
              children: (
                <Form
                  layout="vertical"
                  form={createForm}
                  onFinish={onCreate}
                  initialValues={{ isActive: true }}
                >
                  <Form.Item
                    label="Name"
                    name="name"
                    rules={[{ required: true, message: "Name required" }]}
                  >
                    <Input placeholder="e.g. bKash, Nagad" />
                  </Form.Item>

                  <Form.Item
                    label="Logo imgUrl"
                    name="imgUrl"
                  >
                    <Input placeholder="https://..." />
                  </Form.Item>

                  <Form.Item label="Or Upload Image">
                    <Upload
                      listType="picture"
                      maxCount={1}
                      fileList={fileList}
                      beforeUpload={() => false}
                      onChange={({ fileList }) => setFileList(fileList)}
                    >
                      <Button icon={<UploadOutlined />}>Select File</Button>
                    </Upload>
                  </Form.Item>

                  <Form.Item label="Active" name="isActive" valuePropName="checked">
                    <Switch />
                  </Form.Item>

                  <Button type="primary" htmlType="submit">
                    Create
                  </Button>
                </Form>
              ),
            },
            {
              key: "manage",
              label: "Manage",
              children: (
                <Table
                  rowKey="id"
                  loading={loading}
                  columns={columns}
                  dataSource={rows}
                  pagination={{ pageSize: 10 }}
                />
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title="Edit Mobile Banking"
        open={editOpen}
        onCancel={() => {
          setEditOpen(false);
          setEditing(null);
        }}
        onOk={onUpdate}
        okText="Save"
      >
        <Form layout="vertical" form={editForm}>
          <Form.Item
            label="Name"
            name="name"
            rules={[{ required: true, message: "Name required" }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            label="Logo imgUrl"
            name="imgUrl"
          >
            <Input />
          </Form.Item>

          <Form.Item label="Or Upload New Image">
            <Upload
              listType="picture"
              maxCount={1}
              fileList={editFileList}
              beforeUpload={() => false}
              onChange={({ fileList }) => setEditFileList(fileList)}
            >
              <Button icon={<UploadOutlined />}>Select File</Button>
            </Upload>
          </Form.Item>

          <Form.Item label="Active" name="isActive" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
