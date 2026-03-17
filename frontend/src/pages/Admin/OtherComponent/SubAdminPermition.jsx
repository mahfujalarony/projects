import React, { useEffect, useState } from "react";
import {
  Card,
  Select,
  Checkbox,
  Button,
  message,
  Spin,
  Typography,
  Divider,
  Empty,
  Alert,
} from "antd";
import axios from "axios";
import { useSelector } from "react-redux";
import { API_BASE_URL } from "../../../config/env";

const { Title, Text } = Typography;

const API_BASE = `${API_BASE_URL}/api`;

// ব্যাকএন্ডের PERMISSIONS লিস্ট অনুযায়ী অপশনগুলো
const PERMISSIONS_OPTIONS = [
  { label: "Create Products", value: "create_products" },
  { label: "Edit Products", value: "edit_products" },
  { label: "Manage Orders", value: "manage_order" },
  { label: "Manage Offers", value: "manage_offer" },
  { label: "Manage Categories", value: "manage_catagory" },
  { label: "Manage Merchant Requests", value: "manage_merchant" },
  { label: "Manage Support Chats", value: "manage_support_chat" },
  { label: "Manage Users", value: "manage_users" },
  { label: "Manage Balance Topup", value: "manage_balance_topup" },
  { label: "Manage Wallet", value: "manage_wallet" },
];

const SubAdminPermition = () => {
  const token = useSelector((state) => state.auth?.token);
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  const [subAdmins, setSubAdmins] = useState([]);
  const [loadingList, setLoadingList] = useState(false);

  const [selectedSubAdmin, setSelectedSubAdmin] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [loadingPerms, setLoadingPerms] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSubAdmins();
  }, []);

  const fetchSubAdmins = async () => {
    try {
      setLoadingList(true);
      const res = await axios.get(`${API_BASE}/admin/users`, {
        headers,
        params: { role: "subadmin", limit: 100 },
      });
      if (res.data?.success) {
        setSubAdmins(res.data.users || []);
      }
    } catch (error) {

      message.error("Failed to load sub-admins");
    } finally {
      setLoadingList(false);
    }
  };

  const handleSelectUser = async (userId) => {
    setSelectedSubAdmin(userId);
    setPermissions([]);
    if (!userId) return;

    try {
      setLoadingPerms(true);
      const res = await axios.get(`${API_BASE}/admin/subadmin-permissions/${userId}`, {
        headers,
      });

      if (res.data?.permissions) {
        setPermissions(res.data.permissions);
      }
    } catch (error) {

      // যদি রাউট না থাকে বা এরর হয়
      message.error("Failed to load permissions. Check backend route.");
    } finally {
      setLoadingPerms(false);
    }
  };

  // ৩. পারমিশন সেভ করা
  const handleSave = async () => {
    if (!selectedSubAdmin) return;

    try {
      setSaving(true);
      const res = await axios.post(
        `${API_BASE}/admin/subadmin-permissions/${selectedSubAdmin}`,
        { permissions },
        { headers }
      );

      if (res.data?.success) {
        message.success("Permissions updated successfully!");
      } else {
        message.error(res.data?.message || "Failed to update");
      }
    } catch (error) {

      message.error(error.response?.data?.message || "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const onPermissionChange = (checkedValues) => {
    setPermissions(checkedValues);
  };

  return (
    <Card style={{ maxWidth: 800, margin: "20px auto", borderRadius: 12 }}>
      <Title level={4}>Sub-Admin Permission Management</Title>
      <Text type="secondary">
        Select a sub-admin and assign specific access modules.
      </Text>
      
      <Divider />

      {/* User Selection */}
      <div style={{ marginBottom: 24 }}>
        <Text strong style={{ display: "block", marginBottom: 8 }}>
          Select Sub-Admin:
        </Text>
        <Select
          style={{ width: "100%", maxWidth: 400 }}
          placeholder="Choose a sub-admin"
          loading={loadingList}
          onChange={handleSelectUser}
          value={selectedSubAdmin}
          allowClear
          options={subAdmins.map((u) => ({
            label: `${u.name} (${u.email})`,
            value: u.id,
          }))}
        />
      </div>

      {/* Permissions Area */}
      {selectedSubAdmin ? (
        <div style={{ background: "#f9f9f9", padding: 20, borderRadius: 8 }}>
          {loadingPerms ? (
            <div style={{ textAlign: "center", padding: 20 }}>
              <Spin />
              <div style={{ marginTop: 8 }}>Loading permissions...</div>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 16 }}>
                <Text strong>Access Control:</Text>
              </div>
              
              <Checkbox.Group
                options={PERMISSIONS_OPTIONS}
                value={permissions}
                onChange={onPermissionChange}
                style={{ display: "flex", flexDirection: "column", gap: 10 }}
              />

              <Divider />

              <Button
                type="primary"
                onClick={handleSave}
                loading={saving}
                size="large"
                style={{ width: 150 }}
              >
                Save Changes
              </Button>
            </>
          )}
        </div>
      ) : (
        <Empty description="Please select a sub-admin to view permissions" />
      )}

    </Card>
  );
};

export default SubAdminPermition;
