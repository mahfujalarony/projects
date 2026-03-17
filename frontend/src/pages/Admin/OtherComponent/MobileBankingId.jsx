import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { useSelector } from "react-redux";
import {
  Alert,
  Avatar,
  Button,
  Card,
  Form,
  Grid,
  Input,
  Modal,
  Popconfirm,
  Select,
  Spin,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
  Upload,
  message,
} from "antd";
import { UploadOutlined } from "@ant-design/icons";
import { API_BASE_URL } from "../../../config/env"
import { UPLOAD_BASE_URL } from "../../../config/env";
import { normalizeImageUrl } from "../../../utils/imageUrl";

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

const API = `${API_BASE_URL}/api`;
const buildUploadUrl = (providerId) => {
  const params = new URLSearchParams();
  params.set("scope", "wallets");
  if (providerId) params.set("id", String(providerId));
  return `${UPLOAD_BASE_URL}/upload/image?${params.toString()}`;
};

const safeArr = (v) => (Array.isArray(v) ? v : []);
const pickUploadedPath = (json) => {
  if (Array.isArray(json?.paths) && json.paths[0]) return json.paths[0];
  return "";
};

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
  const selectedOwnerUserId = Form.useWatch("ownerUserId", createWalletForm);

  // ✅ wallet logo upload states
  const [walletLogoUploading, setWalletLogoUploading] = useState(false);
  const [walletLogoRemoving, setWalletLogoRemoving] = useState(false);
  const [walletLogoUrl, setWalletLogoUrl] = useState(""); // create form এর imgUrl

  // numbers modal
  const [numbersOpen, setNumbersOpen] = useState(false);
  const [activeWallet, setActiveWallet] = useState(null);
  const [numbersLoading, setNumbersLoading] = useState(false);
  const [numbers, setNumbers] = useState([]);
  const [deletingNumberIds, setDeletingNumberIds] = useState([]);
  const [addNumberForm] = Form.useForm();
  const screens = useBreakpoint();

  const authHeaders = useMemo(
    () => ({ Authorization: `Bearer ${token}` }),
    [token]
  );

  const searchTimeout = React.useRef(null);

  const walletSummary = useMemo(() => {
    const list = safeArr(wallets);
    const total = list.length;
    const active = list.filter((w) => !!w?.isActive).length;
    const publicCount = list.filter((w) => w?.visibility === "public").length;
    const privateCount = list.filter((w) => w?.visibility === "private").length;
    const totalNumbers = list.reduce((sum, w) => sum + Number(w?.numbersCount || w?.numberCount || 0), 0);
    return { total, active, publicCount, privateCount, totalNumbers };
  }, [wallets]);

  const selectedOwnerOption = useMemo(
    () => userList.find((u) => String(u.value) === String(selectedOwnerUserId)) || null,
    [userList, selectedOwnerUserId]
  );

  const renderUserOptionLabel = (u) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <Avatar src={normalizeImageUrl(u.imageUrl)} size={24}>
        {(u.name || "U").charAt(0)}
      </Avatar>
      <div style={{ minWidth: 0, lineHeight: 1.15 }}>
        <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {u.name || "User"}
        </div>
        <div style={{ fontSize: 12, color: "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {u.email || `ID: ${u.id}`}
        </div>
      </div>
    </div>
  );

  const fetchUserOptions = async (search) => {
    const keyword = String(search || "").trim();
    if (keyword.length < 2) {
      setUserList([]);
      return;
    }

    setFetchingUsers(true);
    try {
      const res = await axios.get(`${API}/admin/users`, {
        params: { q: keyword, limit: 20 },
        headers: authHeaders,
      });
      const users = res.data?.users || [];
      setUserList(
        users.map((u) => ({
          value: u.id,
          name: u.name || "User",
          email: u.email || "",
          imageUrl: u.imageUrl || "",
          label: renderUserOptionLabel(u),
        }))
      );
    } catch (e) {

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
        `${API}/mobile-banking/${mobileBankingId}/wallets?includeNumbers=1`,
        { headers: authHeaders }
      );
      setProvider(res.data?.data?.provider || null);
      setWallets(safeArr(res.data?.data?.wallets));
    } catch (e) {

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

    const res = await fetch(buildUploadUrl(mobileBankingId), { method: "POST", body: fd });
    if (!res.ok) throw new Error("Image upload failed");

    const json = await res.json();
    const uploaded = pickUploadedPath(json);
    if (!uploaded) throw new Error("Upload succeeded but no URL returned");

    return uploaded;
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

      message.error(err?.message || "Upload failed");
      onError?.(err);
    } finally {
      setWalletLogoUploading(false);
    }
  };

  const handleRemoveWalletLogo = async () => {
    const target = String(walletLogoUrl || createWalletForm.getFieldValue("imgUrl") || "").trim();
    setWalletLogoUploading(false);
    setWalletLogoRemoving(true);
    try {
      if (target) {
        await fetch(`${UPLOAD_BASE_URL}/upload/delete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: target }),
        });
      }
    } catch {
      // ignore cleanup error, still clear UI state
    } finally {
      setWalletLogoUrl("");
      createWalletForm.setFieldsValue({ imgUrl: "" });
      setWalletLogoRemoving(false);
    }
  };

  const onCreateWallet = async (values) => {
    try {
      const nextVisibility = values.visibility || visibilityType || "public";
      await axios.post(
        `${API}/mobile-banking/${mobileBankingId}/wallets`,
        {
          name: values.name?.trim(),
          visibility: nextVisibility,
          isActive: values.isActive ?? true,
          imgUrl: values.imgUrl?.trim() || null, // ✅ logo url send
          ownerUserId: nextVisibility === "private" ? values.ownerUserId : null,
        },
        { headers: authHeaders }
      );

      message.success("Wallet created");
      createWalletForm.resetFields();
      setWalletLogoUrl(""); // reset preview
      setVisibilityType("public");
      createWalletForm.setFieldsValue({ visibility: "public", ownerUserId: undefined });
      loadWallets();
    } catch (e) {

      message.error(e?.response?.data?.message || "Create wallet failed");
    }
  };

  const onDeleteWallet = async (walletId) => {
    const prevWallets = wallets;
    setWallets((prev) => prev.filter((w) => String(w.id) !== String(walletId)));

    try {
      await axios.delete(`${API}/wallets/${walletId}`, { headers: authHeaders });
      message.success("Wallet deleted");
      if (String(activeWallet?.id || "") === String(walletId)) {
        setNumbersOpen(false);
        setActiveWallet(null);
        setNumbers([]);
      }
    } catch (e) {
      setWallets(prevWallets);

      message.error(e?.response?.data?.message || "Delete failed");
    }
  };

  const openNumbersModal = async (wallet) => {
    setActiveWallet(wallet);
    setNumbersOpen(true);
    addNumberForm.resetFields();
    await loadNumbers(wallet.id);
  };

  const loadNumbers = async (walletId, options = {}) => {
    const { silent = false } = options;
    try {
      setNumbersLoading(true);
      const res = await axios.get(`${API}/wallets/${walletId}/numbers`, {
        headers: authHeaders,
      });
      setNumbers(safeArr(res.data?.data?.numbers));
    } catch (e) {

      if (!silent) {
        message.error(e?.response?.data?.message || "Numbers load failed");
      }
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

      message.error(e?.response?.data?.message || "Add number failed");
    }
  };

  const onDeleteNumber = async (id) => {
    const idKey = String(id);
    if (deletingNumberIds.includes(idKey)) return;
    setDeletingNumberIds((prev) => [...prev, idKey]);

    try {
      await axios.delete(`${API}/wallet-numbers/${id}`, { headers: authHeaders });
      setNumbers((prev) => prev.filter((n) => String(n.id) !== idKey));
      message.success("Number deleted");

      if (activeWallet?.id) {
        await loadNumbers(activeWallet.id, { silent: true });
      }
    } catch (e) {
      const status = Number(e?.response?.status || 0);
      if (status === 404) {
        setNumbers((prev) => prev.filter((n) => String(n.id) !== idKey));
        message.success("Number deleted");
        return;
      }

      message.error(e?.response?.data?.message || "Delete number failed");
    } finally {
      setDeletingNumberIds((prev) => prev.filter((x) => x !== idKey));
    }
  };

  const openAssignedUser = (wallet) => {
    const uid = Number(wallet?.ownerUser?.id || wallet?.ownerUserId || 0);
    if (!uid) {
      message.warning("No assigned user found for this private wallet.");
      return;
    }
    navigate(`/users/${uid}`);
  };

  const getAssignedUserMeta = (wallet) => {
    const name = wallet?.ownerUser?.name || wallet?.ownerEmail || `User #${wallet?.ownerUserId || "-"}`;
    const imageUrl = wallet?.ownerUser?.imageUrl || "";
    return { name, imageUrl };
  };

  const walletCards = useMemo(
    () => {
      const sortedWallets = [...wallets].sort((a, b) => {
        const aVis = String(a?.visibility || "").toLowerCase();
        const bVis = String(b?.visibility || "").toLowerCase();
        const aPublic = aVis === "public" ? 0 : 1;
        const bPublic = bVis === "public" ? 0 : 1;
        if (aPublic !== bPublic) return aPublic - bPublic;
        return Number(b?.id || 0) - Number(a?.id || 0);
      });

      return sortedWallets.map((w) => {
        const walletNumbers = safeArr(w?.numbers);
        const numbersCount = Number(w?.numbersCount || w?.numberCount || walletNumbers.length || 0);
        const visibility = String(w?.visibility || "").toLowerCase();
        const isPublic = visibility === "public";
        return (
          <Card
            key={w.id}
            hoverable
            style={{
              borderRadius: 12,
              borderColor: isPublic ? "#22c55e" : "#cbd5e1",
              borderWidth: 1,
              boxShadow: isPublic
                ? "inset 0 0 0 1px #86efac"
                : "inset 0 0 0 1px #e2e8f0",
              background: isPublic
                ? "linear-gradient(180deg, #f0fdf4 0%, #ffffff 72%)"
                : "#ffffff",
            }}
            bodyStyle={{ padding: 12 }}
            onClick={() => openNumbersModal(w)}
          >
            {isPublic ? (
              <div style={{ marginBottom: 6 }}>
                <Tag
                  style={{
                    marginRight: 0,
                    borderColor: "#86efac",
                    background: "#dcfce7",
                    color: "#166534",
                    fontWeight: 700,
                  }}
                >
                  PUBLIC
                </Tag>
              </div>
            ) : null}
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              {w.imgUrl ? (
                <img
                  src={normalizeImageUrl(w.imgUrl)}
                  alt={w.name}
                  style={{ width: 40, height: 40, borderRadius: 10, border: "1px solid #eee", objectFit: "cover" }}
                  onError={(e) => (e.currentTarget.style.display = "none")}
                />
              ) : (
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    border: "1px solid #e5e7eb",
                    display: "grid",
                    placeItems: "center",
                    color: "#64748b",
                    fontWeight: 700,
                  }}
                >
                  W
                </div>
              )}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {w.name}
                </div>
                <div style={{ marginTop: 4 }}>
                  <Tag color={visibility === "private" ? "blue" : "green"} style={{ marginRight: 6 }}>
                    {visibility === "private" ? "Private" : "Public"}
                  </Tag>
                  <Tag color={w.isActive ? "success" : "default"}>{w.isActive ? "Active" : "Inactive"}</Tag>
                </div>
              </div>
            </div>
            {visibility === "private" ? (
              <div style={{ marginTop: 8, fontSize: 12 }}>
                Assigned:{" "}
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Avatar src={normalizeImageUrl(getAssignedUserMeta(w).imageUrl)} size={20}>
                    {String(getAssignedUserMeta(w).name || "U").charAt(0).toUpperCase()}
                  </Avatar>
                  <Button
                    type="link"
                    size="small"
                    style={{ padding: 0, height: "auto" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      openAssignedUser(w);
                    }}
                  >
                    {getAssignedUserMeta(w).name}
                  </Button>
                </span>
              </div>
            ) : null}
            <div style={{ marginTop: 8, fontSize: 12, color: "#64748b" }}>Numbers: {numbersCount}</div>
            {walletNumbers.length > 0 ? (
              <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 6 }}>
                {walletNumbers.slice(0, 2).map((n) => (
                  <Tag key={n.id} style={{ marginRight: 0 }}>
                    {n.number}
                  </Tag>
                ))}
                {walletNumbers.length > 2 ? (
                  <Tag style={{ marginRight: 0, color: "#64748b" }}>+{walletNumbers.length - 2} more</Tag>
                ) : null}
              </div>
            ) : (
              <div style={{ marginTop: 6, fontSize: 12, color: "#94a3b8" }}>No number added</div>
            )}
            <Button
              size="small"
              style={{ marginTop: 10 }}
              onClick={(e) => {
                e.stopPropagation();
                openNumbersModal(w);
              }}
            >
              View Details
            </Button>
          </Card>
        );
      });
    },
    [wallets]
  );

  const numberColumns = useMemo(
    () => [
      { title: "ID", dataIndex: "id", width: 80, responsive: ["md"] },
      {
        title: "Number",
        dataIndex: "number",
        render: (v) => (
          <span
            style={{
              display: "inline-block",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              whiteSpace: "normal",
              wordBreak: "break-all",
              lineHeight: 1.35,
            }}
          >
            {v || "-"}
          </span>
        ),
      },
      { title: "Label", dataIndex: "label", render: (v) => v || "-", responsive: ["sm"] },
      { title: "Active", dataIndex: "isActive", width: 100, render: (v) => (v ? "Yes" : "No"), responsive: ["sm"] },
      {
        title: "Actions",
        width: screens.xs ? 110 : 140,
        render: (_, row) => (
          <Popconfirm
            title="Delete this number?"
            okText="Delete"
            cancelText="Cancel"
            disabled={deletingNumberIds.includes(String(row.id))}
            onConfirm={() => onDeleteNumber(row.id)}
          >
            <Button danger size="small" loading={deletingNumberIds.includes(String(row.id))}>
              {screens.xs ? "Del" : "Delete"}
            </Button>
          </Popconfirm>
        ),
      },
    ],
    [screens.xs, deletingNumberIds]
  );

  return (
    <div
      style={{
        maxWidth: screens.xs ? "100%" : 1150,
        margin: screens.xs ? "0 auto" : "0 auto",
        padding: screens.xs ? 8 : 16,
      }}
    >
      <Card
        style={{
          borderRadius: screens.xs ? 0 : 14,
          borderColor: "#cbd5e1",
          borderWidth: 1,
        }}
        bodyStyle={{ padding: screens.xs ? 10 : 24 }}
      >
        <Space style={{ marginBottom: 12 }}>
          <Button onClick={() => navigate(-1)} >Back</Button>
          <Button onClick={loadWallets} loading={loading}>
            Refresh
          </Button>
        </Space>

        <Card
          size="small"
          style={{
            marginBottom: 14,
            borderRadius: 14,
            borderColor: "#bfdbfe",
            borderWidth: 1,
            boxShadow: "inset 0 0 0 1px #dbeafe",
            background: "linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%)",
          }}
        >
          {provider ? (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                {provider.imgUrl ? (
                  <img
                    src={normalizeImageUrl(provider.imgUrl)}
                    alt="logo"
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 14,
                      border: "1px solid #bfdbfe",
                      objectFit: "cover",
                      background: "#fff",
                    }}
                    onError={(e) => (e.currentTarget.style.display = "none")}
                  />
                ) : (
                  <div
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 14,
                      border: "1px solid #bfdbfe",
                      background: "#fff",
                      display: "grid",
                      placeItems: "center",
                      color: "#2563eb",
                      fontWeight: 800,
                    }}
                  >
                    {(provider?.name || "M").slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: "#64748b", marginBottom: 2 }}>Mobile Banking</div>
                  <div style={{ fontWeight: 800, fontSize: 18, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {provider.name}
                  </div>
                  <div style={{ marginTop: 4 }}>
                    <Tag color={provider.isActive ? "success" : "default"} style={{ marginRight: 0 }}>
                      {provider.isActive ? "Active" : "Inactive"}
                    </Tag>
                  </div>
                </div>
              </div>

              <div style={{ fontSize: 12, color: "#475569" }}>
                ID: <b>{mobileBankingId}</b>
              </div>
            </div>
          ) : (
            <Text type="secondary">Loading provider...</Text>
          )}
        </Card>

        <div style={{ marginBottom: 16 }}>
          <Title level={5} style={{ marginBottom: 8 }}>
            Wallet Cards ({walletSummary.total})
          </Title>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: 12,
            }}
          >
            {walletCards}
          </div>
        </div>

        <Card
          size="small"
          style={{
            marginBottom: 12,
            borderRadius: 12,
            borderColor: "#cbd5e1",
            borderWidth: 1,
            boxShadow: "inset 0 0 0 1px #e2e8f0",
            background: "#fcfdff",
          }}
        >
          <Tabs
          defaultActiveKey="create"
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
                  initialValues={{ visibility: "public", isActive: true, imgUrl: "" }}
                >
                  <Form.Item name="visibility" hidden>
                    <Input />
                  </Form.Item>

                  <Form.Item
                    label="Wallet Name"
                    name="name"
                    rules={[{ required: true, message: "Wallet name required" }]}
                  >
                    <Input placeholder="e.g. Personal Wallet, Agent Wallet" />
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
                          src={normalizeImageUrl(walletLogoUrl)}
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
                          loading={walletLogoRemoving}
                          onClick={handleRemoveWalletLogo}
                        >
                          Remove
                        </Button>
                      ) : null}
                    </div>

                  </Form.Item>

                  <Form.Item label="Wallet Type" required>
                    <Tabs
                      activeKey={visibilityType}
                      onChange={(key) => {
                        setVisibilityType(key);
                        createWalletForm.setFieldsValue({ visibility: key, ownerUserId: undefined });
                        if (key !== "private") setUserList([]);
                      }}
                      size="small"
                      items={[
                        { key: "public", label: "Public" },
                        { key: "private", label: "Private" },
                      ]}
                    />
                  </Form.Item>

                  <div style={{ marginTop: -8, marginBottom: 10 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Public wallets are visible to all users. Private wallets are visible only to the selected user.
                    </Text>
                  </div>

                  {visibilityType === "private" && (
                    <Form.Item
                      label="Assign User"
                      name="ownerUserId"
                      extra={
                        selectedOwnerOption ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <Avatar src={normalizeImageUrl(selectedOwnerOption.imageUrl)} size={24}>
                              {(selectedOwnerOption.name || "U").charAt(0)}
                            </Avatar>
                            <span>
                              Selected: {selectedOwnerOption.name}
                              {selectedOwnerOption.email ? ` (${selectedOwnerOption.email})` : ""}
                            </span>
                          </div>
                        ) : (
                          "Type at least 2 characters to search by name or email."
                        )
                      }
                      rules={[{ required: true, message: "Please select a user" }]}
                    >
                      <Select
                        showSearch
                        placeholder="Search user by name/email"
                        filterOption={false}
                        onSearch={handleSearchUser}
                        notFoundContent={fetchingUsers ? <Spin size="small" /> : null}
                        options={userList}
                        optionLabelProp="label"
                      />
                    </Form.Item>
                  )}

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
        </Card>

        <Modal
          title={activeWallet ? `Numbers: ${activeWallet.name}` : "Numbers"}
          open={numbersOpen}
          onCancel={() => {
            setNumbersOpen(false);
            setActiveWallet(null);
            setNumbers([]);
          }}
          footer={null}
          width={screens.md ? 900 : "calc(100vw - 24px)"}
        >
          {activeWallet ? (
            <>
              <Card
                size="small"
                style={{
                  borderRadius: 12,
                  marginBottom: 12,
                  background: "#fafcff",
                  borderColor: "#cbd5e1",
                  borderWidth: 1,
                  boxShadow: "inset 0 0 0 1px #e2e8f0",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15 }}>{activeWallet.name}</div>
                    <div style={{ marginTop: 4 }}>
                      {activeWallet.visibility === "private" ? (
                        <Tag color="blue">Private (single user)</Tag>
                      ) : (
                        <Tag color="green">Public (all users)</Tag>
                      )}
                      <Tag color={activeWallet.isActive ? "success" : "default"}>
                        {activeWallet.isActive ? "Active" : "Inactive"}
                      </Tag>
                    </div>
                    <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                      {activeWallet.visibility === "private" ? (
                        <>
                          Assigned User:{" "}
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, verticalAlign: "middle" }}>
                            <Avatar src={normalizeImageUrl(getAssignedUserMeta(activeWallet).imageUrl)} size={20}>
                              {String(getAssignedUserMeta(activeWallet).name || "U").charAt(0).toUpperCase()}
                            </Avatar>
                            <Button
                              type="link"
                              size="small"
                              style={{ padding: 0, height: "auto" }}
                              onClick={() => openAssignedUser(activeWallet)}
                            >
                              {getAssignedUserMeta(activeWallet).name}
                            </Button>
                          </span>
                        </>
                      ) : (
                        "Assigned User: Not required (public wallet)"
                      )}
                    </div>
                  </div>
                  <div style={{ alignSelf: "center", fontSize: 12, color: "#666" }}>
                    Current numbers: <b>{numbers.length}</b>
                  </div>
                </div>
              </Card>

              <Card
                style={{
                  borderRadius: 12,
                  marginBottom: 12,
                  borderColor: "#cbd5e1",
                  borderWidth: 1,
                  boxShadow: "inset 0 0 0 1px #e2e8f0",
                }}
              >
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
                size={screens.xs ? "small" : "middle"}
                scroll={screens.xs ? undefined : { x: 640 }}
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
