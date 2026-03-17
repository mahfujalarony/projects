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
  Grid,
} from "antd";
import axios from "axios";
import {
  EditOutlined,
  ReloadOutlined,
  FilterOutlined,
  UpOutlined,
  DownOutlined,
  InfoCircleOutlined,
} from "@ant-design/icons";
import { useSelector } from "react-redux";
import { API_BASE_URL } from "../../../config/env";
import { normalizeImageUrl } from "../../../utils/imageUrl";

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

const API_BASE = `${API_BASE_URL}/api`;
const cleanImg = (url) => normalizeImageUrl(url);
const isTopupBlocked = (u) => {
  const t = u?.topupBlockedUntil ? new Date(u.topupBlockedUntil).getTime() : 0;
  return Number.isFinite(t) && t > Date.now();
};

export default function UserList() {
  const reduxToken = useSelector((s) => s.auth?.token);
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);

  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showPageInfo, setShowPageInfo] = useState(false);
  const [expandedCards, setExpandedCards] = useState({});

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
            {isTopupBlocked(u) ? (
              <div>
                <Tag color="magenta" style={{ marginTop: 4, marginInlineEnd: 0 }}>
                  Blocked till: {new Date(u.topupBlockedUntil).toLocaleString()}
                </Tag>
              </div>
            ) : null}
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
          {isTopupBlocked(u) ? (
            <Button danger onClick={() => unblockTopup(u)}>
              Unblock Topup
            </Button>
          ) : null}
        </Space>
      ),
    },
  ];

  const toggleCardDetails = (id) => {
    setExpandedCards((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  async function unblockTopup(u) {
    const uid = Number(u?.id);
    if (!uid) return;
    try {
      await axios.patch(`${API_BASE}/admin/topups/users/${uid}/unblock`, {}, { headers });
      message.success("Topup block removed");
      await fetchUsers();
    } catch (e) {

      message.error(e.response?.data?.message || "Failed to unblock topup");
    }
  }

  return (
    <Card style={{ borderRadius: 16 }}>
      <div
        style={{
          display: "flex",
          alignItems: isMobile ? "flex-start" : "center",
          justifyContent: "space-between",
          gap: 12,
          flexDirection: isMobile ? "column" : "row",
          width: "100%",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <Title level={4} style={{ marginBottom: 0, fontSize: isMobile ? 20 : undefined }}>
            Users
          </Title>
        </div>

        <Space>
          <Button icon={<InfoCircleOutlined />} onClick={() => setShowPageInfo(true)}>
            Details
          </Button>
          <Button
            icon={<FilterOutlined />}
            onClick={() => setShowFilters((prev) => !prev)}
          >
            Filters {showFilters ? <UpOutlined /> : <DownOutlined />}
          </Button>
          <Button icon={<ReloadOutlined />} onClick={() => fetchUsers({ page: 1 })}>
            Refresh
          </Button>
        </Space>
      </div>

      {showFilters ? (
        <div style={{ marginTop: 16 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "minmax(240px,280px) 180px 160px auto auto",
              gap: 10,
              alignItems: "center",
            }}
          >
            <Input
              placeholder="Search name/email..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onPressEnter={onSearch}
              style={{ width: "100%" }}
              allowClear
            />
            <Select
              value={role}
              onChange={(v) => setRole(v)}
              style={{ width: "100%" }}
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
              style={{ width: "100%" }}
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
          </div>
        </div>
      ) : null}

      <div style={{ marginTop: 16 }}>
        {isMobile ? (
          <div style={{ display: "grid", gap: 10 }}>
            {users.map((u) => (
              <Card key={u.id} size="small" bodyStyle={{ padding: 12 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <Space>
                    <Avatar src={cleanImg(u.imageUrl)}>{(u?.name || "U")[0]}</Avatar>
                    <div style={{ minWidth: 0 }}>
                      <Text strong style={{ display: "block" }}>
                        {u.name || "-"}
                      </Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        ID: {u.id}
                      </Text>
                    </div>
                  </Space>
                  {roleTag(u.role)}
                </div>

                <div style={{ marginTop: 10, display: "grid", gap: 4 }}>
                  <Text style={{ fontSize: 13 }} ellipsis>
                    {u.email || "-"}
                  </Text>
                  <Text style={{ fontSize: 13 }}>
                    <Text type="secondary">Balance: </Text>
                    {Number(u.balance || 0).toFixed(2)}
                  </Text>
                  {isTopupBlocked(u) ? (
                    <Tag color="magenta" style={{ marginInlineEnd: 0, width: "fit-content" }}>
                      Blocked till: {new Date(u.topupBlockedUntil).toLocaleString()}
                    </Tag>
                  ) : null}
                </div>

                {expandedCards[u.id] ? (
                  <div style={{ marginTop: 8, display: "grid", gap: 4 }}>
                    <Text style={{ fontSize: 13 }}>
                      <Text type="secondary">Role: </Text>
                      {String(u.role || "-")}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {u.createdAt ? new Date(u.createdAt).toLocaleString() : "-"}
                    </Text>
                  </div>
                ) : null}

                <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                  <Button onClick={() => toggleCardDetails(u.id)}>
                    {expandedCards[u.id] ? "Less" : "Details"}
                  </Button>
                  <Button block icon={<EditOutlined />} onClick={() => openEdit(u)}>
                    Edit
                  </Button>
                  {isTopupBlocked(u) ? (
                    <Button danger onClick={() => unblockTopup(u)}>
                      Unblock
                    </Button>
                  ) : null}
                </div>
              </Card>
            ))}

            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <Button
                block
                disabled={page <= 1 || loading}
                onClick={() => fetchUsers({ page: page - 1 })}
              >
                Prev
              </Button>
              <Button
                block
                disabled={page * limit >= total || loading}
                onClick={() => fetchUsers({ page: page + 1 })}
              >
                Next
              </Button>
            </div>
            <Text type="secondary" style={{ textAlign: "center", fontSize: 12 }}>
              Page {page} • Total {total}
            </Text>
          </div>
        ) : (
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
        )}
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
            label="Balance ($)"
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

      <Modal
        open={showPageInfo}
        title="Users Page Info"
        footer={null}
        onCancel={() => setShowPageInfo(false)}
      >
        <div style={{ display: "grid", gap: 8 }}>
          <Text>Filters খুলে search/role apply করতে পারবেন।</Text>
          <Text>Mobile card-এ Details click করলে extra info দেখা যাবে।</Text>
          <Text>Edit button থেকে user update করা যাবে।</Text>
        </div>
      </Modal>
    </Card>
  );
}
