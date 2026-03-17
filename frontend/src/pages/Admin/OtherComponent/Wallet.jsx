import React, { useEffect, useMemo, useState } from "react";
import { Avatar, Button, Card, Drawer, Form, Grid, Input, InputNumber, Modal, Popconfirm, Space, Switch, Tabs, message, Upload } from "antd";
import { DeleteOutlined, UploadOutlined } from "@ant-design/icons";
import axios from "axios";
import { useLocation, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { API_BASE_URL } from "../../../config/env";
import { UPLOAD_BASE_URL } from "../../../config/env";

const API_BASE = `${API_BASE_URL}/api/mobile-banking`;
const toSafeUploadName = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

const buildWalletUploadUrl = ({ name, id }) => {
  const params = new URLSearchParams();
  params.set("scope", "wallets");
  const safeName = toSafeUploadName(name) || "wallet";
  params.set("name", safeName);
  if (id) params.set("id", String(id));
  return `${UPLOAD_BASE_URL}/upload/image?${params.toString()}`;
};

const pickUploadedPath = (json) => {
  if (Array.isArray(json?.paths) && json.paths[0]) return json.paths[0];
  return "";
};

export default function MobileBankingManager() {
  const { useBreakpoint } = Grid;
  const screens = useBreakpoint();
  const navigate = useNavigate();
  const location = useLocation();
  const walletBasePath = location.pathname.startsWith("/subadmin") ? "/subadmin/wallets" : "/admin/wallets";
  const token =
    useSelector((state) => state.auth?.token) ||
    JSON.parse(localStorage.getItem("userInfo") || "{}")?.token;
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [walletCountByProvider, setWalletCountByProvider] = useState({});
  const [allWallets, setAllWallets] = useState([]);
  const [walletCountLoading, setWalletCountLoading] = useState(false);
  const [overviewDrawerOpen, setOverviewDrawerOpen] = useState(false);
  const [selectedOverviewWallet, setSelectedOverviewWallet] = useState(null);
  const [overviewWalletNumbers, setOverviewWalletNumbers] = useState([]);
  const [overviewNumbersLoading, setOverviewNumbersLoading] = useState(false);

  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const [fileList, setFileList] = useState([]);
  const [editFileList, setEditFileList] = useState([]);

  const loadOverviewWalletNumbers = async (walletId) => {
    if (!walletId) {
      setOverviewWalletNumbers([]);
      return;
    }

    try {
      setOverviewNumbersLoading(true);
      const res = await axios.get(`${API_BASE_URL}/api/wallets/${walletId}/numbers`, { headers });
      const list = Array.isArray(res?.data?.data?.numbers) ? res.data.data.numbers : [];
      setOverviewWalletNumbers(list);
    } catch (e) {

      setOverviewWalletNumbers([]);
      message.error(e?.response?.data?.message || "Wallet numbers load failed");
    } finally {
      setOverviewNumbersLoading(false);
    }
  };

  const openOverviewWalletDrawer = (wallet) => {
    setSelectedOverviewWallet(wallet);
    setOverviewDrawerOpen(true);
    setOverviewWalletNumbers(Array.isArray(wallet?.numbers) ? wallet.numbers : []);
    loadOverviewWalletNumbers(wallet?.id);
  };

  const fetchWalletCounts = async (providers) => {
    try {
      setWalletCountLoading(true);
      const entries = await Promise.all(
        (providers || []).map(async (p) => {
          try {
            const res = await axios.get(`${API_BASE}/${p.id}/wallets?includeNumbers=1`, { headers });
            const wallets = Array.isArray(res?.data?.data?.wallets) ? res.data.data.wallets : [];
            const count = Number(res?.data?.data?.total ?? wallets.length ?? 0);
            return {
              providerId: p.id,
              count,
              wallets: wallets.map((w) => ({
                ...w,
                providerId: p.id,
              })),
            };
          } catch {
            return { providerId: p.id, count: 0, wallets: [] };
          }
        })
      );
      setWalletCountByProvider(
        Object.fromEntries(entries.map((item) => [String(item.providerId), item.count]))
      );
      setAllWallets(entries.flatMap((item) => item.wallets || []));
    } finally {
      setWalletCountLoading(false);
    }
  };

  const fetchAll = async () => {
    try {
      setLoading(true);
      const res = await axios.get(API_BASE, { headers });
      const list = Array.isArray(res.data?.data) ? res.data.data : [];
      setRows(list);
      fetchWalletCounts(list);
    } catch (e) {

      message.error("Mobile banking load failed");
      setWalletCountByProvider({});
      setAllWallets([]);
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
        const upRes = await fetch(
          buildWalletUploadUrl({ name: values.name }),
          { method: "POST", body: formData }
        );
        const upJson = await upRes.json();
        finalImgUrl = pickUploadedPath(upJson) || finalImgUrl;
      }

      const payload = {
        name: values.name?.trim(),
        imgUrl: finalImgUrl,
        dollarRate: Number(values.dollarRate),
        isActive: values.isActive ?? true,
      };
      await axios.post(API_BASE, payload, { headers });
      message.success("Created");
      createForm.resetFields();
      setFileList([]);
      fetchAll();
    } catch (e) {

      message.error(e?.response?.data?.message || "Create failed");
    }
  };

  const openEdit = (row) => {
    setEditing(row);
    setEditFileList([]);
    editForm.setFieldsValue({
      name: row?.name || "",
      dollarRate: Number(row?.dollarRate || 1),
      isActive: !!row?.isActive,
    });
    setEditOpen(true);
  };

  const onUpdate = async () => {
    try {
      const values = await editForm.validateFields();
      let finalImgUrl = (editing?.imgUrl || "").trim();

      if (editFileList.length > 0) {
        const formData = new FormData();
        formData.append("file", editFileList[0].originFileObj);
        const upRes = await fetch(
          buildWalletUploadUrl({ name: values.name || editing?.name, id: editing?.id }),
          { method: "POST", body: formData }
        );
        const upJson = await upRes.json();
        finalImgUrl = pickUploadedPath(upJson) || finalImgUrl;
      }

      await axios.put(
        `${API_BASE}/${editing.id}`,
        {
          name: values.name?.trim(),
          ...(finalImgUrl ? { imgUrl: finalImgUrl } : {}),
          dollarRate: Number(values.dollarRate),
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

      message.error(e?.response?.data?.message || "Update failed");
    }
  };

  const onDelete = async (id) => {
    const prevRows = rows;
    const prevAllWallets = allWallets;
    const prevCountMap = walletCountByProvider;
    const providerId = String(id);

    setRows((prev) => prev.filter((r) => String(r.id) !== providerId));
    setAllWallets((prev) => prev.filter((w) => String(w.providerId) !== providerId));
    setWalletCountByProvider((prev) => {
      const next = { ...prev };
      delete next[providerId];
      return next;
    });

    try {
      await axios.delete(`${API_BASE}/${id}`, { headers });
      message.success("Deleted");
    } catch (e) {
      setRows(prevRows);
      setAllWallets(prevAllWallets);
      setWalletCountByProvider(prevCountMap);

      message.error(e?.response?.data?.message || "Delete failed");
    }
  };

  const totalWallets = useMemo(
    () =>
      Object.values(walletCountByProvider).reduce(
        (sum, count) => sum + Number(count || 0),
        0
      ),
    [walletCountByProvider]
  );

  const providerById = useMemo(
    () => Object.fromEntries(rows.map((r) => [String(r.id), r])),
    [rows]
  );

  const sortedOverviewWallets = useMemo(() => {
    return [...allWallets].sort((a, b) => {
      const aVis = String(a?.visibility || "").toLowerCase();
      const bVis = String(b?.visibility || "").toLowerCase();
      const aPublic = aVis === "public" ? 0 : 1;
      const bPublic = bVis === "public" ? 0 : 1;
      if (aPublic !== bPublic) return aPublic - bPublic;
      return Number(b?.id || 0) - Number(a?.id || 0);
    });
  }, [allWallets]);

  const resolveImgSrc = (value) => {
    const raw = String(value || "").trim();
    if (!raw) return "";
    if (/^https?:\/\//i.test(raw) || raw.startsWith("data:") || raw.startsWith("blob:")) return raw;
    return `${UPLOAD_BASE_URL}/${raw.replace(/^\/+/, "")}`;
  };

  const onDeleteOverviewWallet = async (walletId) => {
    const prevAllWallets = allWallets;
    const prevCountMap = walletCountByProvider;
    const target = allWallets.find((w) => String(w.id) === String(walletId));

    setAllWallets((prev) => prev.filter((w) => String(w.id) !== String(walletId)));
    if (target?.providerId) {
      const providerKey = String(target.providerId);
      setWalletCountByProvider((prev) => ({
        ...prev,
        [providerKey]: Math.max(0, Number(prev[providerKey] || 0) - 1),
      }));
    }

    try {
      await axios.delete(`${API_BASE_URL}/api/wallets/${walletId}`, { headers });
      message.success("Wallet deleted");
      setOverviewDrawerOpen(false);
      setSelectedOverviewWallet(null);
      setOverviewWalletNumbers([]);
    } catch (e) {
      setAllWallets(prevAllWallets);
      setWalletCountByProvider(prevCountMap);

      message.error(e?.response?.data?.message || "Delete wallet failed");
    }
  };

  const getAssignedUserMeta = (wallet) => ({
    name: wallet?.ownerUser?.name || wallet?.ownerEmail || `User #${wallet?.ownerUserId || "-"}`,
    imageUrl: resolveImgSrc(
      wallet?.ownerUser?.imageUrl ||
      wallet?.ownerUser?.avatar ||
      wallet?.ownerImageUrl ||
      ""
    ),
  });

  return (
    <div
      style={{
        maxWidth: screens.xs ? "100%" : 1100,
        margin: screens.xs ? 0 : "0 auto",
        padding: screens.xs ? 0 : 16,
      }}
    >
      <Card style={{ borderRadius: screens.xs ? 0 : 14, borderColor: "#cbd5e1", borderWidth: 1 }}>
        <Tabs
          items={[
            {
              key: "overview",
              label: "Wallet Overview",
              children: (
                <div>
                  <Card
                    size="small"
                    style={{ marginBottom: 12, borderRadius: 12, background: "#f8fafc", borderColor: "#cbd5e1", borderWidth: 1 }}
                    loading={walletCountLoading}
                  >
                    <div style={{ fontSize: 13, color: "#64748b" }}>All Providers Combined</div>
                    <div style={{ fontWeight: 800, fontSize: 26, lineHeight: 1.2 }}>
                      {totalWallets}
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                      Total wallets across all mobile banking providers
                    </div>
                  </Card>

                  {loading || walletCountLoading ? (
                    <Card loading style={{ borderRadius: 12 }} />
                  ) : allWallets.length === 0 ? (
                    <Card style={{ borderRadius: 12, textAlign: "center", color: "#64748b" }}>
                      No wallets found
                    </Card>
                  ) : (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                        gap: 12,
                      }}
                    >
                      {sortedOverviewWallets.map((w) => {
                        const visibility = String(w?.visibility || "").toLowerCase();
                        const isPublic = visibility === "public";
                        return (
                        <Card
                          key={`${w.providerId}-${w.id}`}
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
                          onClick={() => openOverviewWalletDrawer(w)}
                        >
                          {isPublic ? (
                            <div style={{ marginBottom: 6 }}>
                              <span
                                style={{
                                  fontSize: 11,
                                  padding: "2px 8px",
                                  borderRadius: 999,
                                  border: "1px solid #86efac",
                                  background: "#dcfce7",
                                  color: "#166534",
                                  fontWeight: 700,
                                }}
                              >
                                PUBLIC
                              </span>
                            </div>
                          ) : null}
                          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}>
                            <Popconfirm
                              title="Delete this wallet?"
                              okText="Delete"
                              cancelText="Cancel"
                              onConfirm={(e) => {
                                e?.stopPropagation?.();
                                onDeleteOverviewWallet(w.id);
                              }}
                            >
                              <Button
                                type="text"
                                danger
                                icon={<DeleteOutlined />}
                                size="small"
                                onClick={(e) => e.stopPropagation()}
                              />
                            </Popconfirm>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            {w?.imgUrl ? (
                              <img
                                src={resolveImgSrc(w.imgUrl)}
                                alt={w.name}
                                style={{ width: 42, height: 42, objectFit: "cover", borderRadius: 10, border: "1px solid #eee" }}
                                onError={(e) => (e.currentTarget.style.display = "none")}
                              />
                            ) : (
                              <div
                                style={{
                                  width: 42,
                                  height: 42,
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
                                {w?.name || "-"}
                              </div>
                              <div style={{ marginTop: 2, fontSize: 11, color: "#64748b" }}>
                                {providerById[String(w?.providerId)]?.name || "Mobile Banking"}
                              </div>
                              <div style={{ marginTop: 4 }}>
                                <Space size={6}>
                                  <span
                                    style={{
                                      fontSize: 11,
                                      padding: "2px 7px",
                                      borderRadius: 999,
                                      border: "1px solid #dbeafe",
                                      color: "#1d4ed8",
                                      background: "#eff6ff",
                                    }}
                                  >
                                    {visibility === "private" ? "Private" : "Public"}
                                  </span>
                                  <span
                                    style={{
                                      fontSize: 11,
                                      padding: "2px 7px",
                                      borderRadius: 999,
                                      border: "1px solid #dcfce7",
                                      color: w?.isActive ? "#15803d" : "#6b7280",
                                      background: w?.isActive ? "#f0fdf4" : "#f3f4f6",
                                    }}
                                  >
                                    {w?.isActive ? "Active" : "Inactive"}
                                  </span>
                                </Space>
                              </div>
                              {visibility === "private" ? (
                                <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
                                  <Avatar src={getAssignedUserMeta(w).imageUrl} size={18}>
                                    {String(getAssignedUserMeta(w).name || "U").charAt(0).toUpperCase()}
                                  </Avatar>
                                  <span
                                    style={{
                                      fontSize: 11,
                                      color: "#475569",
                                      maxWidth: 130,
                                      whiteSpace: "nowrap",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                    }}
                                  >
                                    {getAssignedUserMeta(w).name}
                                  </span>
                                </div>
                              ) : null}
                              {Array.isArray(w?.numbers) && w.numbers.length > 0 ? (
                                <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 6 }}>
                                  {w.numbers.slice(0, 2).map((n) => (
                                    <span
                                      key={n.id}
                                      style={{
                                        fontSize: 11,
                                        padding: "2px 7px",
                                        borderRadius: 999,
                                        border: "1px solid #cbd5e1",
                                        background: "#f8fafc",
                                        color: "#334155",
                                      }}
                                    >
                                      {n.number}
                                    </span>
                                  ))}
                                  {w.numbers.length > 2 ? (
                                    <span
                                      style={{
                                        fontSize: 11,
                                        padding: "2px 7px",
                                        borderRadius: 999,
                                        border: "1px solid #cbd5e1",
                                        background: "#fff",
                                        color: "#64748b",
                                      }}
                                    >
                                      +{w.numbers.length - 2} more
                                    </span>
                                  ) : null}
                                </div>
                              ) : (
                                <div style={{ marginTop: 6, fontSize: 11, color: "#94a3b8" }}>No number added</div>
                              )}
                            </div>
                          </div>
                        </Card>
                      )})}
                    </div>
                  )}
                </div>
              ),
            },
            {
              key: "create",
              label: "Create Mobile Banking",
              children: (
                <div>
                  <Card size="small" style={{ marginBottom: 12, borderRadius: 12 }}>
                    <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>
                      Existing Mobile Banking
                    </div>
                    {loading ? (
                      <Card loading size="small" />
                    ) : rows.length === 0 ? (
                      <div style={{ fontSize: 13, color: "#64748b" }}>No mobile banking found</div>
                    ) : (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
                        {rows.map((r) => (
                          <div
                            key={r.id}
                            style={{
                              display: "flex",
                              alignItems: "flex-start",
                              justifyContent: "space-between",
                              gap: 10,
                              border: "1px solid #e5e7eb",
                              boxShadow: "inset 0 0 0 1px #cbd5e1",
                              borderRadius: 12,
                              padding: "10px 12px",
                              background: "#fff",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                              {r?.imgUrl ? (
                                <img
                                  src={resolveImgSrc(r.imgUrl)}
                                  alt={r.name}
                                  style={{ width: 34, height: 34, borderRadius: 999, objectFit: "cover", border: "1px solid #eee" }}
                                  onError={(e) => (e.currentTarget.style.display = "none")}
                                />
                              ) : (
                                <div
                                  style={{
                                    width: 34,
                                    height: 34,
                                    borderRadius: 999,
                                    background: "#f1f5f9",
                                    color: "#64748b",
                                    display: "grid",
                                    placeItems: "center",
                                    fontSize: 12,
                                    fontWeight: 700,
                                  }}
                                >
                                  {(r?.name || "M").slice(0, 1).toUpperCase()}
                                </div>
                              )}
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                  {r?.name || "-"}
                                </div>
                                <div style={{ fontSize: 11, color: r?.isActive ? "#16a34a" : "#64748b", marginTop: 2 }}>
                                  {r?.isActive ? "Active" : "Inactive"}
                                </div>
                                <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                                  Rate: 1 USD = {Number(r?.dollarRate || 1).toFixed(4)}
                                </div>
                              </div>
                            </div>

                            <Space size={6}>
                              <Button size="small" onClick={() => openEdit(r)}>
                                Edit
                              </Button>
                              <Popconfirm
                                title="Delete this provider?"
                                okText="Delete"
                                cancelText="Cancel"
                                onConfirm={() => onDelete(r.id)}
                              >
                                <Button size="small" danger>
                                  Delete
                                </Button>
                              </Popconfirm>
                            </Space>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>

                  <Form
                    layout="vertical"
                    form={createForm}
                    onFinish={onCreate}
                    initialValues={{ isActive: true, dollarRate: 1 }}
                  >
                    <Form.Item
                      label="Name"
                      name="name"
                      rules={[{ required: true, message: "Name required" }]}
                    >
                      <Input placeholder="e.g. bKash, Nagad etc." />
                    </Form.Item>

                    <Form.Item
                      label="Dollar Rate (Local per USD)"
                      name="dollarRate"
                      rules={[{ required: true, message: "Dollar rate required" }]}
                    >
                      <InputNumber style={{ width: "100%" }} min={0.0001} step={0.01} />
                    </Form.Item>

                    <Form.Item label="Upload Logo">
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
                </div>
              ),
            },
            {
              key: "manage",
              label: "Manage",
              children: (
                <div>
                  {loading ? (
                    <Card loading style={{ borderRadius: 12 }} />
                  ) : rows.length === 0 ? (
                    <Card style={{ borderRadius: 12, textAlign: "center", color: "#64748b" }}>
                      No mobile banking found
                    </Card>
                  ) : (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                        gap: 12,
                      }}
                    >
                      {rows.map((r) => (
                        <Card key={r.id} style={{ borderRadius: 12, borderColor: "#cbd5e1", borderWidth: 1 }} bodyStyle={{ padding: 12 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                            {r?.imgUrl ? (
                              <img
                                src={resolveImgSrc(r.imgUrl)}
                                alt={r.name}
                                style={{ width: 40, height: 40, borderRadius: 999, objectFit: "cover", border: "1px solid #eee" }}
                                onError={(e) => (e.currentTarget.style.display = "none")}
                              />
                            ) : (
                              <div
                                style={{
                                  width: 40,
                                  height: 40,
                                  borderRadius: 999,
                                  background: "#f1f5f9",
                                  color: "#64748b",
                                  display: "grid",
                                  placeItems: "center",
                                  fontSize: 12,
                                  fontWeight: 700,
                                }}
                              >
                                {(r?.name || "M").slice(0, 1).toUpperCase()}
                              </div>
                            )}
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {r?.name || "-"}
                              </div>
                              <div style={{ fontSize: 12, color: r?.isActive ? "#16a34a" : "#64748b", marginTop: 2 }}>
                                {r?.isActive ? "Active" : "Inactive"}
                              </div>
                              <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                                Rate: 1 USD = {Number(r?.dollarRate || 1).toFixed(4)}
                              </div>
                            </div>
                          </div>

                          <Button type="primary" block onClick={() => navigate(`${walletBasePath}/${r.id}`)}>
                            Manage Wallets
                          </Button>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              ),
            },
          ]}
        />
      </Card>

      <Drawer
        title={selectedOverviewWallet?.name || "Wallet Details"}
        placement="bottom"
        height={screens.xs ? "78vh" : 520}
        open={overviewDrawerOpen}
        styles={{
          header: { padding: screens.xs ? "10px 14px" : undefined },
          body: { padding: screens.xs ? 12 : 16 },
          content: {
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            overflow: "hidden",
          },
        }}
        onClose={() => {
          setOverviewDrawerOpen(false);
          setSelectedOverviewWallet(null);
          setOverviewWalletNumbers([]);
        }}
      >
        {selectedOverviewWallet ? (
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ fontSize: 13, color: "#64748b" }}>
              Mobile Banking:{" "}
              <b>{providerById[String(selectedOverviewWallet.providerId)]?.name || "-"}</b>
            </div>
            <div style={{ fontSize: 13, color: "#64748b" }}>
              Wallet Name: <b>{selectedOverviewWallet?.name || "-"}</b>
            </div>
            <div style={{ fontSize: 13, color: "#64748b" }}>
              Type: <b>{selectedOverviewWallet?.visibility === "private" ? "Private" : "Public"}</b>
            </div>
            <div style={{ fontSize: 13, color: "#64748b" }}>
              Status: <b>{selectedOverviewWallet?.isActive ? "Active" : "Inactive"}</b>
            </div>
            {selectedOverviewWallet?.visibility === "private" ? (
              <div style={{ fontSize: 13, color: "#64748b", display: "flex", alignItems: "center", gap: 8 }}>
                Assigned User:
                <Avatar src={getAssignedUserMeta(selectedOverviewWallet).imageUrl} size={24}>
                  {String(getAssignedUserMeta(selectedOverviewWallet).name || "U").charAt(0).toUpperCase()}
                </Avatar>
                <b style={{ color: "#111827" }}>{getAssignedUserMeta(selectedOverviewWallet).name}</b>
              </div>
            ) : null}
            <div style={{ fontSize: 13, color: "#64748b" }}>
              Total Numbers:{" "}
              <b>{Number(selectedOverviewWallet?.numbersCount || overviewWalletNumbers.length || 0)}</b>
            </div>

            <div style={{ marginTop: 6 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Numbers</div>
              {overviewNumbersLoading ? (
                <Card loading size="small" />
              ) : overviewWalletNumbers.length === 0 ? (
                <div style={{ fontSize: 13, color: "#64748b" }}>No numbers found</div>
              ) : (
                <div style={{ display: "grid", gap: 8, maxHeight: 220, overflowY: "auto", paddingRight: 4 }}>
                  {overviewWalletNumbers.map((n) => (
                    <div
                      key={n.id}
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: 10,
                        padding: "8px 10px",
                        background: "#fff",
                      }}
                    >
                      <div style={{ fontWeight: 700, wordBreak: "break-all" }}>{n?.number || "-"}</div>
                      <div style={{ marginTop: 3, fontSize: 12, color: "#64748b" }}>
                        Label: {n?.label || "-"} | Status: {n?.isActive ? "Active" : "Inactive"}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Space style={{ marginTop: 8 }}>
              <Button
                type="primary"
                onClick={() => {
                  navigate(`${walletBasePath}/${selectedOverviewWallet.providerId}`);
                  setOverviewDrawerOpen(false);
                  setSelectedOverviewWallet(null);
                }}
              >
                View Full Details
              </Button>
              <Popconfirm
                title="Delete this wallet?"
                okText="Delete"
                cancelText="Cancel"
                onConfirm={() => onDeleteOverviewWallet(selectedOverviewWallet.id)}
              >
                <Button danger>
                  Remove Wallet
                </Button>
              </Popconfirm>
              <Button
                onClick={() => {
                  setOverviewDrawerOpen(false);
                  setSelectedOverviewWallet(null);
                }}
              >
                Close
              </Button>
            </Space>
          </div>
        ) : null}
      </Drawer>

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
            label="Dollar Rate (Local per USD)"
            name="dollarRate"
            rules={[{ required: true, message: "Dollar rate required" }]}
          >
            <InputNumber style={{ width: "100%" }} min={0.0001} step={0.01} />
          </Form.Item>



          <Form.Item label="Upload New Image">
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
