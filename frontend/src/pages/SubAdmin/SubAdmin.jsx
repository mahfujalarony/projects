import React, { useEffect, useMemo, useState } from "react";
import { Tabs, Spin, Alert, Empty, message, Grid } from "antd";
import axios from "axios";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";

import Products from "./../Admin/OtherComponent/Products.jsx";
import Orders from "./../Admin/OtherComponent/Orders.jsx";
import CategoryManagement from "./../Admin/OtherComponent/CategoryManagement.jsx";
import AdminOffers from "./../Admin/OtherComponent/AdminOffers.jsx";
import CreateItem from "./../Admin/OtherComponent/CreateItem.jsx";
import MarchentJoinRequest from "./../Admin/OtherComponent/MarchentJoinRequest.jsx";
import Wallet from "./../Admin/OtherComponent/Wallet.jsx";
import BalanceTopup from "./../Admin/OtherComponent/BalanceTopup.jsx";
import { API_BASE_URL } from "../../config/env";

const API_BASE = `${API_BASE_URL}/api`;

export const PERMS = {
  editProducts: "edit_products",
  createProducts: "create_products",
  manageOrder: "manage_order",
  manageOffer: "manage_offer",
  manageCatagory: "manage_catagory",
  manageMerchant: "manage_merchant",
  manageBalanceTopup: "manage_balance_topup",
  manageWallet: "manage_wallet",
  manageSupportChat: "manage_support_chat",
};

export default function SubAdminPanel() {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const token =
    useSelector((state) => state.auth?.token) ||
    JSON.parse(localStorage.getItem("userInfo") || "{}")?.token;
  const totalUnreadCount = useSelector((state) => state.chat?.totalUnreadCount || 0);
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState([]);
  const [activeKey, setActiveKey] = useState(null);

  const ALL_TABS = useMemo(
    () => [
      { key: "editProducts", label: "Edit Products", perm: PERMS.editProducts, element: <Products /> },
      { key: "createProducts", label: "Create Products", perm: PERMS.createProducts, element: <CreateItem /> },
      { key: "manageOrder", label: "Manage Order", perm: PERMS.manageOrder, element: <Orders /> },
      { key: "manageOffer", label: "Manage Offer", perm: PERMS.manageOffer, element: <AdminOffers /> },
      { key: "manageCatagory", label: "Manage Catagory", perm: PERMS.manageCatagory, element: <CategoryManagement /> },
      { key: "manageMerchant", label: "Manage Merchant", perm: PERMS.manageMerchant, element: <MarchentJoinRequest /> },
      { key: "manageWallet", label: "Wallet", perm: PERMS.manageWallet, element: <Wallet /> },
      { key: "manageBalanceTopup", label: "Balance Topup", perm: PERMS.manageBalanceTopup, element: <BalanceTopup /> },
      { key: "manageSupportChat", label: "Chats", perm: PERMS.manageSupportChat, element: null },
    ],
    []
  );

  const allowedTabs = useMemo(() => {
    const set = new Set(permissions || []);
    return ALL_TABS.filter((t) => set.has(t.perm));
  }, [ALL_TABS, permissions]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);
        const res = await axios.get(`${API_BASE}/admin/subadmin/me/permissions`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (!mounted) return;

        const perms = res.data?.permissions || [];
        setPermissions(perms);
        const firstKey = (perms.length && ALL_TABS.find((t) => perms.includes(t.perm))?.key) || null;
        setActiveKey((prev) => prev || firstKey);
      } catch (e) {

        message.error("Permission load failed");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [token]);

  if (loading) {
    return (
      <div style={{ padding: isMobile ? 0 : 12 }}>
        <div
          style={{
            border: "1px solid #e5e7eb",
            background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
            borderRadius: isMobile ? 0 : 16,
            padding: 18,
            display: "flex",
            alignItems: "center",
            gap: 12,
            boxShadow: "0 8px 24px rgba(15, 23, 42, 0.05)",
          }}
        >
          <Spin />
          <div>
            <div style={{ fontWeight: 700, color: "#111827" }}>Loading Sub Admin Panel</div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>Checking module permissions...</div>
          </div>
        </div>
      </div>
    );
  }

  if (!allowedTabs.length) {
    return (
      <div style={{ padding: isMobile ? 0 : 12 }}>
        <div
          style={{
            border: "1px solid #e5e7eb",
            background: "#fff",
            borderRadius: isMobile ? 0 : 16,
            padding: isMobile ? 12 : 16,
            boxShadow: "0 8px 24px rgba(15, 23, 42, 0.05)",
          }}
        >
        <Alert
          type="warning"
          showIcon
          message="No access"
          description="আপনার কোনো module access নেই। Admin permission set করে দিলে এখানে tab দেখাবে।"
        />
        <div style={{ marginTop: 16 }}>
          <Empty description="No modules assigned" />
        </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: isMobile ? 0 : 12 }}>
      <div
        style={{
          marginBottom: 12,
          borderRadius: isMobile ? 0 : 16,
          border: "1px solid #e5e7eb",
          background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 55%, #eef6ff 100%)",
          padding: isMobile ? 12 : 14,
          boxShadow: "0 10px 28px rgba(15, 23, 42, 0.05)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>Sub Admin Panel</div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
              Role-based modules only. Tabs are visible based on your assigned permissions.
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <div
              style={{
                borderRadius: 999,
                border: "1px solid #dbeafe",
                background: "#eff6ff",
                color: "#1d4ed8",
                fontWeight: 700,
                fontSize: 12,
                padding: "6px 10px",
              }}
            >
              Modules: {allowedTabs.length}
            </div>
            {permissions.includes(PERMS.manageSupportChat) ? (
              <div
                style={{
                  borderRadius: 999,
                  border: "1px solid #e9d5ff",
                  background: "#faf5ff",
                  color: "#7e22ce",
                  fontWeight: 700,
                  fontSize: 12,
                  padding: "6px 10px",
                }}
              >
                Chats: {Number(totalUnreadCount || 0)}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div
        style={{
          border: "1px solid #e5e7eb",
          background: "#fff",
          borderRadius: isMobile ? 0 : 16,
          padding: isMobile ? 8 : 12,
          boxShadow: "0 10px 24px rgba(15, 23, 42, 0.04)",
        }}
      >
      <Tabs
        activeKey={activeKey}
        onChange={(key) => {
          if (key === "manageSupportChat") {
            navigate("/chats");
            return;
          }
          setActiveKey(key);
        }}
        items={allowedTabs.map((t) => ({
          key: t.key,
          label: t.key === "manageSupportChat" ? `Chats (${Number(totalUnreadCount || 0)})` : t.label,
          children: <div style={{ marginTop: 8 }}>{t.element}</div>,
        }))}
      />
      </div>
    </div>
  );
}
