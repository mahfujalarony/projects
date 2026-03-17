import React, { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  ShoppingBag,
  PlusCircle,
  ClipboardList,
  Tags,
  Shapes,
  UserPlus,
  Wallet,
  DollarSign,
  MessageSquare,
} from "lucide-react";
import { Alert, Badge, Button, Drawer, Layout, Menu, theme, Grid } from "antd";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../../config/env";
import { useSelector } from "react-redux";
import { SUBADMIN_PERMS } from "./permissions";

const { Header, Sider, Content } = Layout;
const { useBreakpoint } = Grid;

const API_BASE = `${API_BASE_URL}/api`;

const ALL_MENU = [
  {
    key: "/subadmin/products",
    label: "Products",
    icon: <ShoppingBag size={18} />,
    perm: SUBADMIN_PERMS.editProducts,
  },
  {
    key: "/subadmin/create-item",
    label: "Create Product",
    icon: <PlusCircle size={18} />,
    perm: SUBADMIN_PERMS.createProducts,
  },
  {
    key: "/subadmin/orders",
    label: "Orders",
    icon: <ClipboardList size={18} />,
    perm: SUBADMIN_PERMS.manageOrder,
  },
  {
    key: "/subadmin/offers",
    label: "Offers",
    icon: <Tags size={18} />,
    perm: SUBADMIN_PERMS.manageOffer,
  },
  {
    key: "/subadmin/category-management",
    label: "Category Management",
    icon: <Shapes size={18} />,
    perm: SUBADMIN_PERMS.manageCatagory,
  },
  {
    key: "/subadmin/merchant-join-requests",
    label: "Merchant Requests",
    icon: <UserPlus size={18} />,
    perm: SUBADMIN_PERMS.manageMerchant,
  },
  {
    key: "/subadmin/wallets",
    label: "Wallet",
    icon: <Wallet size={18} />,
    perm: SUBADMIN_PERMS.manageWallet,
  },
  {
    key: "/subadmin/balance-topup",
    label: "Balance Topup",
    icon: <DollarSign size={18} />,
    perm: SUBADMIN_PERMS.manageBalanceTopup,
  },
  {
    key: "/chats",
    label: "Chats",
    icon: <MessageSquare size={18} />,
    perm: SUBADMIN_PERMS.manageSupportChat,
  },
];

const getToken = (reduxToken) => {
  if (reduxToken) return reduxToken;
  try {
    return JSON.parse(localStorage.getItem("userInfo") || "null")?.token || null;
  } catch {
    return null;
  }
};

export default function SubAdminDashboardLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [permLoading, setPermLoading] = useState(true);
  const [permissions, setPermissions] = useState([]);

  const screens = useBreakpoint();
  const isMobile = !screens.lg;
  const navigate = useNavigate();
  const location = useLocation();
  const reduxToken = useSelector((state) => state.auth?.token);
  const totalUnreadCount = useSelector((state) => state.chat?.totalUnreadCount || 0);

  const token = useMemo(() => getToken(reduxToken), [reduxToken]);

  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  useEffect(() => {
    let mounted = true;

    const loadPermissions = async () => {
      if (!token) {
        if (mounted) {
          setPermissions([]);
          setPermLoading(false);
        }
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/admin/subadmin/me/permissions`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.message || "Permission load failed");
        if (!mounted) return;
        setPermissions(Array.isArray(json?.permissions) ? json.permissions : []);
      } catch (e) {
        if (!mounted) return;
        setPermissions([]);
      } finally {
        if (mounted) setPermLoading(false);
      }
    };

    loadPermissions();
    return () => {
      mounted = false;
    };
  }, [token]);

  const allowedMenuItems = useMemo(() => {
    const set = new Set(permissions || []);
    const allowed = ALL_MENU.filter((m) => set.has(m.perm));
    return [{ key: "/subadmin", icon: <LayoutDashboard size={18} />, label: "Dashboard" }, ...allowed];
  }, [permissions]);

  const headerTitle = useMemo(() => {
    const current = allowedMenuItems.find((x) => x.key === location.pathname);
    return current?.label || "Sub Admin Dashboard";
  }, [allowedMenuItems, location.pathname]);

  const menuSelectedKey = useMemo(() => {
    const found = allowedMenuItems.find((item) => location.pathname.startsWith(item.key));
    return found ? [found.key] : ["/subadmin"];
  }, [allowedMenuItems, location.pathname]);

  const MenuContent = () => (
    <Menu
      theme="light"
      mode="inline"
      selectedKeys={menuSelectedKey}
      onClick={({ key }) => {
        navigate(key);
        if (isMobile) setDrawerVisible(false);
      }}
      items={allowedMenuItems}
      style={{ borderRight: 0, height: "100%", background: "transparent" }}
    />
  );

  return (
    <Layout style={{ minHeight: "100vh" }}>
      {!isMobile && (
        <Sider
          theme="light"
          trigger={null}
          collapsible
          collapsed={collapsed}
          width={220}
          collapsedWidth={80}
          style={{
            overflow: "auto",
            height: "100vh",
            position: "fixed",
            left: 0,
            top: 0,
            bottom: 0,
            zIndex: 1000,
            background: colorBgContainer,
            boxShadow: "2px 0 8px rgba(0,21,41,0.08)",
          }}
        >
          <div
            style={{
              height: "64px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: collapsed ? "14px" : "18px",
              fontWeight: 700,
              color: "#001529",
              borderBottom: "1px solid #f0f0f0",
            }}
          >
            {collapsed ? "SA" : "Sub Admin Panel"}
          </div>
          <MenuContent />
        </Sider>
      )}

      {isMobile && (
        <Drawer
          title="Sub Admin Panel"
          placement="left"
          onClose={() => setDrawerVisible(false)}
          open={drawerVisible}
          width={280}
          styles={{ body: { padding: 0 } }}
        >
          <MenuContent />
        </Drawer>
      )}

      <Layout
        style={{
          marginLeft: !isMobile ? (collapsed ? 80 : 220) : 0,
          transition: "margin-left 0.2s",
        }}
      >
        <Header
          style={{
            padding: isMobile ? "0 12px" : "0 24px",
            background: colorBgContainer,
            position: "fixed",
            top: 0,
            left: !isMobile ? (collapsed ? 80 : 220) : 0,
            right: 0,
            zIndex: 999,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            boxShadow: "0 1px 2px 0 rgba(0,0,0,.03), 0 1px 6px -1px rgba(0,0,0,.02), 0 2px 4px 0 rgba(0,0,0,.02)",
            height: 64,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {isMobile ? (
              <Button type="text" icon={<PanelLeftOpen size={20} />} onClick={() => setDrawerVisible(true)} />
            ) : (
              <Button
                type="text"
                icon={collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
                onClick={() => setCollapsed((v) => !v)}
              />
            )}
            <div style={{ fontSize: isMobile ? 16 : 18, fontWeight: 700 }}>{headerTitle}</div>
          </div>

          <Badge count={Number(totalUnreadCount || 0)} size="small">
            <Button type="text" icon={<MessageSquare size={20} />} onClick={() => navigate("/chats")} />
          </Badge>
        </Header>

        <Content
          style={{
            marginTop: 64,
            padding: isMobile ? "8px 6px" : "24px 16px",
            minHeight: "calc(100vh - 64px)",
            background: "#f0f2f5",
          }}
        >
          <div
            style={{
              padding: isMobile ? 10 : 24,
              background: colorBgContainer,
              borderRadius: isMobile ? 10 : borderRadiusLG,
              minHeight: "100%",
            }}
          >
            {permLoading ? (
              null
            ) : permissions.length === 0 ? (
              <Alert
                type="warning"
                showIcon
                message="No module assigned"
                description="Admin has not assigned any module permission for this subadmin yet."
              />
            ) : (
              <Outlet context={{ permissions, permLoading, totalUnreadCount }} />
            )}
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}
