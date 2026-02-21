import React, { useEffect, useState, useCallback } from "react";
import { Button, Layout, Menu, theme, Drawer, Grid, Space, Tag, Badge } from "antd";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import logo from "./../../public/logo.jpg";
import {
  LayoutDashboard,
  Store,
  Package,
  BookImage,
  ShoppingCart,
  UserCircle,
  MessageCircle,
  Wallet,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCcw,
  PlusCircle,
} from "lucide-react";
import { useSelector } from "react-redux";
import { API_BASE_URL } from "../../config/env";

const { Header, Sider, Content } = Layout;
const { useBreakpoint } = Grid;
const API_BASE = API_BASE_URL;

const safeJson = (s, fallback = null) => {
  try {
    return JSON.parse(s);
  } catch {
    return fallback;
  }
};

const getToken = () => safeJson(localStorage.getItem("userInfo"), null)?.token || null;

const iconSize = 17;

const MerchantDashboardLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);

  const [balance, setBalance] = useState(0);
  const [balanceLoading, setBalanceLoading] = useState(true);

  const navigate = useNavigate();
  const location = useLocation();
  const screens = useBreakpoint();
  const totalUnreadCount = useSelector((state) => state.chat?.totalUnreadCount || 0);

  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const loadBalance = useCallback(async () => {
    const token = getToken();

    if (!token) {
      setBalance(0);
      setBalanceLoading(false);
      return;
    }

    setBalanceLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/merchant/me/balance`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });

      const j = await r.json().catch(() => ({}));

      if (!r.ok) {
        setBalance(0);
        return;
      }

      const b = j?.data?.balance ?? j?.balance ?? 0;
      setBalance(Number(b || 0));
    } catch {
      setBalance(0);
    } finally {
      setBalanceLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBalance();

    const interval = setInterval(loadBalance, 20000);
    const onFocus = () => loadBalance();
    window.addEventListener("focus", onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [loadBalance]);

  const menuItems = [
    { key: "/merchant", icon: <LayoutDashboard size={iconSize} />, label: "Dashboard" },
    { key: "/merchant/my-store", icon: <Store size={iconSize} />, label: "My Store" },
    { key: "/merchant/products", icon: <Package size={iconSize} />, label: "Products" },
    { key: "/merchant/create-story", icon: <BookImage size={iconSize} />, label: "Create Story" },
    { key: "/merchant/my-orders", icon: <ShoppingCart size={iconSize} />, label: "My Orders" },
    { key: "/merchant/my-profile", icon: <UserCircle size={iconSize} />, label: "My Profile" },
  ];

  const renderMenu = () => (
    <Menu
      theme="light"
      mode="inline"
      selectedKeys={[location.pathname]}
      onClick={(e) => {
        navigate(e.key);
        if (!screens.md) setDrawerVisible(false);
      }}
      items={menuItems}
    />
  );

  const LogoSection = () => (
    <div
      style={{
        height: 64,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderBottom: "1px solid #f0f0f0",
        margin: "0 10px 10px 10px",
        cursor: "pointer",
      }}
      onClick={() => navigate("/merchant/my-store")}
    >
      <img src={logo} alt="Logo" style={{ height: 40 }} />
    </div>
  );

  return (
    <Layout style={{ minHeight: "100vh" }}>
      {screens.md ? (
        <Sider
          theme="light"
          trigger={null}
          collapsible
          collapsed={collapsed}
          style={{
            overflow: "auto",
            height: "100vh",
            position: "sticky",
            top: 0,
            zIndex: 1001,
          }}
        >
          <LogoSection />
          {renderMenu()}
        </Sider>
      ) : (
        <Drawer
          title={<LogoSection />}
          placement="left"
          onClose={() => setDrawerVisible(false)}
          open={drawerVisible}
          styles={{ body: { padding: 0 } }}
          width={250}
        >
          {renderMenu()}
        </Drawer>
      )}

      <Layout>
        <Header
          style={{
            padding: 0,
            background: colorBgContainer,
            position: "sticky",
            top: 0,
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            boxShadow: "0 1px 4px rgba(0,21,41,0.08)",
          }}
        >
          <Button
            type="text"
            icon={collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            onClick={() => {
              if (screens.md) setCollapsed(!collapsed);
              else setDrawerVisible(true);
            }}
            style={{ fontSize: 16, width: 64, height: 64 }}
          />

          <div style={{ flex: 1 }} />

          <Space style={{ paddingRight: 16 }}>
            <Badge count={Number(totalUnreadCount || 0)} size="small">
              <Button
                type="text"
                icon={<MessageCircle size={18} />}
                onClick={() => navigate("/chats")}
              />
            </Badge>

            <Tag
              icon={<Wallet size={14} />}
              color="green"
              style={{
                padding: "6px 12px",
                borderRadius: 999,
                fontWeight: 600,
                fontSize: 13,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              Balance: BDT {balanceLoading ? "..." : balance}
            </Tag>

            <Button
              type="primary"
              size="small"
              icon={<PlusCircle size={14} />}
              onClick={() => navigate("/add-balance")}
            >
              {screens.sm ? "Add Balance" : null}
            </Button>

            <Button onClick={loadBalance} size="small" icon={<RefreshCcw size={14} />}>
              Refresh
            </Button>
          </Space>
        </Header>

        <Content
          style={{
            margin: "24px 16px",
            padding: 24,
            minHeight: 280,
            background: colorBgContainer,
            borderRadius: borderRadiusLG,
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default MerchantDashboardLayout;
