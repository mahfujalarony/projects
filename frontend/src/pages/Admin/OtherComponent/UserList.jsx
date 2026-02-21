// src/pages/admin/UserList.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Card,
  Table,
  Space,
  Typography,
  Input,
  Select,
  Button,
  Modal,
  Form,
  InputNumber,
  Avatar,
  Tag,
  message,
  Popconfirm,
} from "antd";
import axios from "axios";
import { EditOutlined, ReloadOutlined } from "@ant-design/icons";
import { useSelector } from "react-redux";
import { API_BASE_URL } from "../../../config/env";

const { Title, Text } = Typography;

const API_BASE = `${API_BASE_URL}/api`;
const cleanImg = (url) => (url ? String(url).replace(/\\/g, "/") : null);

export default function UserList() {
  const reduxToken = useSelector((s) => s.auth?.token);

  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);

  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const [q, setQ] = useState("");
  const [role, setRole] = useState("");

  // edit modal
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeUser, setActiveUser] = useState(null);
  const [form] = Form.useForm();

  const token = useMemo(() => {
    if (reduxToken) return reduxToken;
    try {
      const saved = JSON.parse(localStorage.getItem("userInfo") || "null");
      return saved?.token || null;
    } catch {
      return null;
    }
  }, [reduxToken]);

  const headers = useMemo(() => {
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [token]);

  const fetchUsers = async (opts = {}) => {
    const nextPage = opts.page ?? page;
    const nextLimit = opts.limit ?? limit;

    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE}/admin/users`, {
        headers,
        params: {
          page: nextPage,
          limit: nextLimit,
          q: q.trim() || undefined,
          role: role || undefined,
          sort: "desc",
        },
      });

      if (res.data?.success) {
        setUsers(res.data.users || []);
        setTotal(Number(res.data.total || 0));
        setPage(Number(res.data.page || nextPage));
        setLimit(Number(res.data.limit || nextLimit));
      } else {
        message.error(res.data?.message || "Failed to load users");
      }
    } catch (e) {
      console.error(e);
      message.error(e.response?.data?.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers({ page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSearch = () => fetchUsers({ page: 1 });

  const openEdit = (u) => {
    setActiveUser(u);
    form.setFieldsValue({
      name: u?.name || "",
      email: u?.email || "",
      role: u?.role || "user",
      balance: u?.balance ?? 0,
      password: "",
    });
    setOpen(true);
  };

  const saveEdit = async () => {
    try {
      const values = await form.validateFields();
      if (!activeUser?.id) return;

      setSaving(true);
      
      const payload = {
        name: values.name,
        email: values.email,
        role: values.role,
        balance: values.balance,
      };
      if (values.password) payload.password = values.password;

      const res = await axios.patch(
        `${API_BASE}/admin/users/${activeUser.id}`,
        payload,
        { headers }
      );

      if (res.data?.success) {
        message.success("User updated");
        setOpen(false);
        setActiveUser(null);
        await fetchUsers();
      } else {
        message.error(res.data?.message || "Update failed");
      }
    } catch (e) {
      if (e?.errorFields) return; // antd validation
      console.error(e);
      message.error(e.response?.data?.message || "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const roleTag = (r) => {
    if (r === "admin") return <Tag color="red">admin</Tag>;
    if (r === "merchant") return <Tag color="blue">merchant</Tag>;
    if (r === "subadmin") return <Tag color="green">subadmin</Tag>;
    return <Tag color="default">user</Tag>;
  };

  const columns = [
    {
      title: "User",
      key: "user",
      render: (_, u) => (
        <Space>
          <Avatar src={cleanImg(u.imageUrl)}>{(u?.name || "U")[0]}</Avatar>
          <div style={{ lineHeight: 1.2 }}>
            <Text strong>{u.name || "—"}</Text>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                ID: {u.id}
              </Text>
            </div>
          </div>
        </Space>
      ),
    },
    {
      title: "Email",
      dataIndex: "email",
      key: "email",
      render: (v) => <Text>{v || "—"}</Text>,
    },
    {
      title: "Role",
      dataIndex: "role",
      key: "role",
      render: (v) => roleTag(v),
    },
    {
      title: "Balance",
      dataIndex: "balance",
      key: "balance",
      sorter: (a, b) => Number(a.balance || 0) - Number(b.balance || 0),
      render: (v) => <Text strong>{Number(v || 0).toFixed(2)}</Text>,
    },
    {
      title: "Created",
      dataIndex: "createdAt",
      key: "createdAt",
      render: (v) => (
        <Text type="secondary">
          {v ? new Date(v).toLocaleString() : "—"}
        </Text>
      ),
    },
    {
      title: "Action",
      key: "action",
      fixed: "right",
      width: 220,
      render: (_, u) => (
        <Space>
          <Button icon={<EditOutlined />} onClick={() => openEdit(u)}>
            Edit
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Card style={{ borderRadius: 16 }}>
      <Space style={{ width: "100%", justifyContent: "space-between" }} align="start">
        <div>
          <Title level={4} style={{ marginBottom: 0 }}>
            Users
          </Title>
          <Text type="secondary">Admin can view & edit user details (including balance).</Text>
        </div>

        <Button icon={<ReloadOutlined />} onClick={() => fetchUsers({ page: 1 })}>
          Refresh
        </Button>
      </Space>

      <div style={{ marginTop: 16 }}>
        <Space wrap>
          <Input
            placeholder="Search name/email..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onPressEnter={onSearch}
            style={{ width: 280 }}
            allowClear
          />
          <Select
            value={role}
            onChange={(v) => setRole(v)}
            style={{ width: 180 }}
            allowClear
            placeholder="Filter role"
            options={[
              { value: "user", label: "User" },
              { value: "subadmin", label: "SubAdmin" },
              { value: "admin", label: "Admin" },
            ]}
          />
          <Select
            value={limit}
            onChange={(v) => setLimit(v)}
            style={{ width: 160 }}
            options={[
              { value: 10, label: "Show 10" },
              { value: 20, label: "Show 20" },
              { value: 50, label: "Show 50" },
            ]}
          />
          <Button type="primary" onClick={onSearch}>
            Apply
          </Button>
          <Button
            onClick={() => {
              setQ("");
              setRole("");
              setLimit(10);
              setPage(1);
              setTimeout(() => fetchUsers({ page: 1, limit: 10 }), 0);
            }}
          >
            Reset
          </Button>
        </Space>
      </div>

      <div style={{ marginTop: 16 }}>
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={users}
          scroll={{ x: 900 }}
          pagination={{
            current: page,
            pageSize: limit,
            total,
            showSizeChanger: false,
            onChange: (p) => fetchUsers({ page: p }),
          }}
        />
      </div>

      {/* Edit Modal */}
      <Modal
        open={open}
        title={`Edit User #${activeUser?.id || ""}`}
        onCancel={() => setOpen(false)}
        onOk={saveEdit}
        okText="Save"
        confirmLoading={saving}
        destroyOnHidden
      >
        <Form layout="vertical" form={form}>
          <Form.Item
            label="Name"
            name="name"
            rules={[{ required: true, message: "Name is required" }]}
          >
            <Input placeholder="User name" />
          </Form.Item>

          <Form.Item
            label="Email"
            name="email"
            rules={[
              { required: true, message: "Email is required" },
              { type: "email", message: "Invalid email" },
            ]}
          >
            <Input placeholder="user@email.com" />
          </Form.Item>

          <Form.Item label="Role" name="role" rules={[{ required: true }]}>
            <Select
              options={[
                { value: "user", label: "User" },
                { value: "subadmin", label: "SubAdmin" },
              ]}
            />
          </Form.Item>

          <Form.Item
            label="Balance (৳)"
            name="balance"
            rules={[{ required: true, message: "Balance is required" }]}
            help="Admin can directly set the user's balance."
          >
            <InputNumber style={{ width: "100%" }} min={0} />
          </Form.Item>

          <Form.Item label="New Password" name="password" help="Leave empty to keep current password">
            <Input.Password placeholder="Enter new password" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
