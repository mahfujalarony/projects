import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { useSelector } from "react-redux";
import {
  Button,
  Card,
  Collapse,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Spin,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  Upload,
  message,
} from "antd";
import { UploadOutlined } from "@ant-design/icons";
import { API_BASE_URL } from "../../../config/env"
import { UPLOAD_BASE_URL } from "../../../config/env";

const { Title, Text } = Typography;

const API = `${API_BASE_URL}/api`;
const UPLOAD_URL = `${UPLOAD_BASE_URL}/upload/image`;

const safeArr = (v) => (Array.isArray(v) ? v : []);

export default function MobileBankingId() {
  const { mobileBankingId } = useParams();
  const navigate = useNavigate();
  const token = useSelector((state) => state.auth?.token);

  const [provider, setProvider] = useState(null);
  const [wallets, setWallets] = useState([]);
  const [loading, setLoading] = useState(false);

  const [visibilityType, setVisibilityType] = useState("public");
  const [userList, setUserList] = useState([]);
  const [fetchingUsers, setFetchingUsers] = useState(false);

  const [createWalletForm] = Form.useForm();

  // ✅ wallet logo upload states
  const [walletLogoUploading, setWalletLogoUploading] = useState(false);
  const [walletLogoUrl, setWalletLogoUrl] = useState(""); // create form এর imgUrl

  // numbers modal
  const [numbersOpen, setNumbersOpen] = useState(false);
  const [activeWallet, setActiveWallet] = useState(null);
  const [numbersLoading, setNumbersLoading] = useState(false);
  const [numbers, setNumbers] = useState([]);
  const [addNumberForm] = Form.useForm();

  const authHeaders = useMemo(
    () => ({ Authorization: `Bearer ${token}` }),
    [token]
  );

  const searchTimeout = React.useRef(null);

  const fetchUserOptions = async (search) => {
    setFetchingUsers(true);
    try {
      const res = await axios.get(`${API}/admin/users`, {
        params: { q: search, limit: 20 },
        headers: authHeaders,
      });
      const users = res.data?.users || [];
      setUserList(users.map((u) => ({ label: `${u.name} (${u.email})`, value: u.id })));
    } catch (e) {
      console.error(e);
    } finally {
      setFetchingUsers(false);
    }
  };

  const handleSearchUser = (val) => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      fetchUserOptions(val);
    }, 500);
  };

  const loadWallets = async () => {
    try {
      setLoading(true);
      const res = await axios.get(
        `${API}/mobile-banking/${mobileBankingId}/wallets`,
        { headers: authHeaders }
      );
      setProvider(res.data?.data?.provider || null);
      setWallets(safeArr(res.data?.data?.wallets));
    } catch (e) {
      console.error(e);
      message.error(e?.response?.data?.message || "Load failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) loadWallets();
  }, [mobileBankingId, token]);

  // ✅ upload single file to 5001 (your existing server)
  const uploadOneFileTo5001 = async (file) => {
    const fd = new FormData();
    fd.append("file", file);

    const res = await fetch(UPLOAD_URL, { method: "POST", body: fd });
    if (!res.ok) throw new Error("Image upload failed");

    const json = await res.json(); // expected { urls: [...] }
    const urls = safeArr(json?.urls);
    if (!urls.length) throw new Error("Upload succeeded but no URL returned");

    return urls[0];
  };

  // ✅ AntD Upload customRequest handler
  const handleWalletLogoUpload = async ({ file, onSuccess, onError }) => {
    try {
      setWalletLogoUploading(true);
      const url = await uploadOneFileTo5001(file);
      setWalletLogoUrl(url);
      createWalletForm.setFieldsValue({ imgUrl: url }); // form field set
      message.success("Logo uploaded");
      onSuccess?.({ url });
    } catch (err) {
      console.error(err);
      message.error(err?.message || "Upload failed");
      onError?.(err);
    } finally {
      setWalletLogoUploading(false);
    }
  };

  const onCreateWallet = async (values) => {
    try {
      await axios.post(
        `${API}/mobile-banking/${mobileBankingId}/wallets`,
        {
          name: values.name?.trim(),
          visibility: values.visibility,
          note: values.note?.trim() || null,
          sortOrder: values.sortOrder ?? 0,
          isActive: values.isActive ?? true,
          imgUrl: values.imgUrl?.trim() || null, // ✅ logo url send
          ownerUserId: values.visibility === "private" ? values.ownerUserId : null,
        },
        { headers: authHeaders }
      );

      message.success("Wallet created");
      createWalletForm.resetFields();
      setWalletLogoUrl(""); // reset preview
      loadWallets();
    } catch (e) {
      console.error(e);
      message.error(e?.response?.data?.message || "Create wallet failed");
    }
  };

  const onDeleteWallet = async (walletId) => {
    try {
      await axios.delete(`${API}/wallets/${walletId}`, { headers: authHeaders });
      message.success("Wallet deleted");
      loadWallets();
    } catch (e) {
      console.error(e);
      message.error(e?.response?.data?.message || "Delete failed");
    }
  };

  const openNumbersModal = async (wallet) => {
    setActiveWallet(wallet);
    setNumbersOpen(true);
    addNumberForm.resetFields();
    await loadNumbers(wallet.id);
  };

  const loadNumbers = async (walletId) => {
    try {
      setNumbersLoading(true);
      const res = await axios.get(`${API}/wallets/${walletId}/numbers`, {
        headers: authHeaders,
      });
      setNumbers(safeArr(res.data?.data?.numbers));
    } catch (e) {
      console.error(e);
      message.error(e?.response?.data?.message || "Numbers load failed");
    } finally {
      setNumbersLoading(false);
    }
  };

  const onAddNumber = async () => {
    try {
      const values = await addNumberForm.validateFields();
      await axios.post(
        `${API}/wallets/${activeWallet.id}/numbers`,
        {
          number: values.number?.trim(),
          label: values.label?.trim() || null,
          isActive: values.isActive ?? true,
        },
        { headers: authHeaders }
      );
      message.success("Number added");
      addNumberForm.resetFields(["number", "label"]);
      loadNumbers(activeWallet.id);
    } catch (e) {
      if (e?.errorFields) return;
      console.error(e);
      message.error(e?.response?.data?.message || "Add number failed");
    }
  };

  const onDeleteNumber = async (id) => {
    try {
      await axios.delete(`${API}/wallet-numbers/${id}`, { headers: authHeaders });
      message.success("Number deleted");
      loadNumbers(activeWallet.id);
    } catch (e) {
      console.error(e);
      message.error(e?.response?.data?.message || "Delete number failed");
    }
  };

  const walletColumns = useMemo(
    () => [
      { title: "ID", dataIndex: "id", width: 80 },
      {
        title: "Logo",
        dataIndex: "imgUrl",
        width: 90,
        render: (url) =>
          url ? (
            <img
              src={url}
              alt="logo"
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                border: "1px solid #eee",
                objectFit: "cover",
              }}
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
          ) : (
            <span style={{ opacity: 0.6 }}>-</span>
          ),
      },
      { title: "Wallet Name", dataIndex: "name" },
      {
        title: "Visibility",
        dataIndex: "visibility",
        width: 140,
        render: (v) =>
          v === "public" ? <Tag color="green">public</Tag> : <Tag color="blue">private</Tag>,
      },
      {
        title: "Active",
        dataIndex: "isActive",
        width: 100,
        render: (v) => (v ? "Yes" : "No"),
      },
      {
        title: "Actions",
        width: 320,
        render: (_, row) => (
          <Space wrap>
            <Button type="primary" onClick={() => openNumbersModal(row)}>
              Manage Numbers
            </Button>
            <Popconfirm
              title="Delete this wallet?"
              okText="Delete"
              cancelText="Cancel"
              onConfirm={() => onDeleteWallet(row.id)}
            >
              <Button danger>Delete</Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [wallets, activeWallet]
  );

  const numberColumns = useMemo(
    () => [
      { title: "ID", dataIndex: "id", width: 80 },
      { title: "Number", dataIndex: "number" },
      { title: "Label", dataIndex: "label", render: (v) => v || "-" },
      { title: "Active", dataIndex: "isActive", width: 100, render: (v) => (v ? "Yes" : "No") },
      {
        title: "Actions",
        width: 140,
        render: (_, row) => (
          <Popconfirm
            title="Delete this number?"
            okText="Delete"
            cancelText="Cancel"
            onConfirm={() => onDeleteNumber(row.id)}
          >
            <Button danger size="small">
              Delete
            </Button>
          </Popconfirm>
        ),
      },
    ],
    [numbers, activeWallet]
  );

  return (
    <div style={{ maxWidth: 1150, margin: "0 auto", padding: 16 }}>
      <Card style={{ borderRadius: 14 }}>
        <Space style={{ marginBottom: 12 }}>
          <Button onClick={() => navigate(-1)}>Back</Button>
          <Button onClick={loadWallets} loading={loading}>
            Refresh
          </Button>
        </Space>

        <Title level={4} style={{ marginTop: 0 }}>
          Wallet Manager
        </Title>

        <div style={{ marginBottom: 14 }}>
          <Text>
            Mobile Banking ID: <b>{mobileBankingId}</b>
          </Text>

          {provider ? (
            <div style={{ marginTop: 10, display: "flex", gap: 12, alignItems: "center" }}>
              <img
                src={provider.imgUrl}
                alt="logo"
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  border: "1px solid #eee",
                  objectFit: "cover",
                }}
                onError={(e) => (e.currentTarget.style.display = "none")}
              />
              <div>
                <div style={{ fontWeight: 800 }}>{provider.name}</div>
                <div style={{ opacity: 0.7 }}>Active: {provider.isActive ? "Yes" : "No"}</div>
              </div>
            </div>
          ) : (
            <Text type="secondary" style={{ marginLeft: 8 }}>
              Loading provider...
            </Text>
          )}
        </div>

        <Collapse
          defaultActiveKey={["create"]}
          items={[
            {
              key: "create",
              label: "Create Wallet",
              children: (
                <Form
                  layout="vertical"
                  form={createWalletForm}
                  onFinish={onCreateWallet}
                  onValuesChange={(changed) => {
                    if (changed.visibility) setVisibilityType(changed.visibility);
                  }}
                  initialValues={{ visibility: "public", isActive: true, sortOrder: 0, imgUrl: "" }}
                >
                  <Form.Item
                    label="Wallet Name"
                    name="name"
                    rules={[{ required: true, message: "Wallet name required" }]}
                  >
                    <Input placeholder="e.g. bKash Personal, bKash Agent..." />
                  </Form.Item>

                  {/* ✅ wallet logo upload */}
                  <Form.Item label="Wallet Logo" name="imgUrl">
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      <Upload
                        accept="image/*"
                        maxCount={1}
                        showUploadList={false}
                        customRequest={handleWalletLogoUpload}
                      >
                        <Button icon={<UploadOutlined />} loading={walletLogoUploading}>
                          Upload Logo
                        </Button>
                      </Upload>

                      {walletLogoUrl ? (
                        <img
                          src={walletLogoUrl}
                          alt="wallet-logo"
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 12,
                            border: "1px solid #eee",
                            objectFit: "cover",
                          }}
                          onError={(e) => (e.currentTarget.style.display = "none")}
                        />
                      ) : (
                        <Text type="secondary">No logo uploaded</Text>
                      )}

                      {walletLogoUrl ? (
                        <Button
                          danger
                          onClick={() => {
                            setWalletLogoUrl("");
                            createWalletForm.setFieldsValue({ imgUrl: "" });
                          }}
                        >
                          Remove
                        </Button>
                      ) : null}
                    </div>

                    {/* hidden actual url value preview */}
                    {walletLogoUrl ? (
                      <div style={{ marginTop: 6 }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          URL: {walletLogoUrl}
                        </Text>
                      </div>
                    ) : null}
                  </Form.Item>

                  <Form.Item label="Visibility" name="visibility" rules={[{ required: true }]}>
                    <Select
                      options={[
                        { value: "public", label: "Public (everyone)" },
                        { value: "private", label: "Private (single user)" },
                      ]}
                    />
                  </Form.Item>

                  {visibilityType === "private" && (
                    <Form.Item
                      label="Assign User"
                      name="ownerUserId"
                      rules={[{ required: true, message: "Please select a user" }]}
                    >
                      <Select
                        showSearch
                        placeholder="Search user by name/email"
                        filterOption={false}
                        onSearch={handleSearchUser}
                        notFoundContent={fetchingUsers ? <Spin size="small" /> : null}
                        options={userList}
                      />
                    </Form.Item>
                  )}

                  <Form.Item label="Note (optional)" name="note">
                    <Input.TextArea rows={2} placeholder="Optional note/terms..." />
                  </Form.Item>

                  <Form.Item label="Sort Order" name="sortOrder">
                    <InputNumber style={{ width: "100%" }} min={0} />
                  </Form.Item>

                  <Form.Item label="Active" name="isActive" valuePropName="checked">
                    <Switch />
                  </Form.Item>

                  <Button type="primary" htmlType="submit">
                    Create Wallet
                  </Button>
                </Form>
              ),
            },
          ]}
        />

        <div style={{ marginTop: 16 }}>
          <Title level={5} style={{ marginBottom: 10 }}>
            Wallet List
          </Title>
          <Table
            rowKey="id"
            loading={loading}
            columns={walletColumns}
            dataSource={wallets}
            pagination={{ pageSize: 10 }}
          />
        </div>

        <Modal
          title={activeWallet ? `Numbers: ${activeWallet.name}` : "Numbers"}
          open={numbersOpen}
          onCancel={() => {
            setNumbersOpen(false);
            setActiveWallet(null);
            setNumbers([]);
          }}
          footer={null}
          width={900}
        >
          {activeWallet ? (
            <>
              <Card style={{ borderRadius: 12, marginBottom: 12 }}>
                <Form layout="vertical" form={addNumberForm} initialValues={{ isActive: true }}>
                  <Form.Item label="Number" name="number" rules={[{ required: true, message: "Number required" }]}>
                    <Input placeholder="e.g. 01XXXXXXXXX" />
                  </Form.Item>

                  <Form.Item label="Label (optional)" name="label">
                    <Input placeholder="e.g. Personal / Agent / Merchant" />
                  </Form.Item>

                  <Form.Item label="Active" name="isActive" valuePropName="checked">
                    <Switch />
                  </Form.Item>

                  <Button type="primary" onClick={onAddNumber}>
                    Add Number
                  </Button>
                </Form>
              </Card>

              <Table
                rowKey="id"
                loading={numbersLoading}
                columns={numberColumns}
                dataSource={numbers}
                pagination={{ pageSize: 8 }}
              />
            </>
          ) : (
            <Text type="secondary">Select a wallet</Text>
          )}
        </Modal>
      </Card>
    </div>
  );
}
