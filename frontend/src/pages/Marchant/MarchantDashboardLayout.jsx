import React, { useEffect, useState, useCallback } from "react";
import { Button, Layout, Menu, theme, Drawer, Grid, Space, Tag } from "antd";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  Store,
  Package,
  BookImage,
  ShoppingCart,
  UserCircle,
  Wallet,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCcw,
  PlusCircle,
  X,
  Home,
} from "lucide-react";
import { API_BASE_URL, UPLOAD_BASE_URL } from "../../config/env";

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
  const [siteMeta, setSiteMeta] = useState({ name: "", logo: "" });

  const navigate = useNavigate();
  const location = useLocation();
  const screens = useBreakpoint();
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

    const onFocus = () => loadBalance();
    window.addEventListener("focus", onFocus);

    return () => {
      window.removeEventListener("focus", onFocus);
    };
  }, [loadBalance]);

  useEffect(() => {
    let ignore = false;

    const resolveLogoSrc = (value = "") => {
      const raw = String(value || "").trim();
      if (!raw) return "";
      if (/^https?:\/\//i.test(raw)) return raw;
      return `${UPLOAD_BASE_URL}/${raw.replace(/^\/+/, "")}`;
    };

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/settings`);
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.success || ignore) return;
        const name = String(json?.data?.siteName || "").trim();
        const logo = resolveLogoSrc(json?.data?.siteLogoUrl);
        setSiteMeta({ name, logo });
      } catch {
        // no-op: keep fallback
      }
    })();

    return () => {
      ignore = true;
    };
  }, []);

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
      style={{ borderInlineEnd: 0, background: "transparent" }}
      selectedKeys={[location.pathname]}
      onClick={(e) => {
        navigate(e.key);
        if (!screens.md) setDrawerVisible(false);
      }}
      items={menuItems}
    />
  );

  const LogoSection = ({ isCollapsed = false, closeDrawer = false }) => (
    <div style={{ padding: 12 }}>
      <div
        onClick={() => {
          if (closeDrawer) setDrawerVisible(false);
          navigate("/");
        }}
        style={{
          borderRadius: 16,
          border: "1px solid #bae6fd",
          background: "linear-gradient(90deg, #e0f2fe 0%, #cffafe 45%, #dbeafe 100%)",
          padding: "10px 12px",
          boxShadow: "0 1px 3px rgba(15, 23, 42, 0.08)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: isCollapsed ? 0 : 10,
          justifyContent: isCollapsed ? "center" : "flex-start",
        }}
      >
        {siteMeta.logo ? (
          <img
            src={siteMeta.logo}
            alt={siteMeta.name || "Shop"}
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              objectFit: "cover",
              border: "1px solid rgba(255,255,255,0.8)",
              background: "#fff",
            }}
          />
        ) : (
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: "rgba(255,255,255,0.8)",
              border: "1px solid rgba(255,255,255,0.8)",
              display: "grid",
              placeItems: "center",
              fontWeight: 700,
              color: "#0369a1",
            }}
          >
            {(siteMeta.name || "M").slice(0, 1).toUpperCase()}
          </div>
        )}

        {!isCollapsed ? (
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "#0284c7", fontWeight: 600 }}>
              Welcome
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#1f2937", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 140 }}>
              {siteMeta.name || "Merchant"}
            </div>
          </div>
        ) : null}
      </div>
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
          <LogoSection isCollapsed={collapsed} />
          {renderMenu()}
        </Sider>
      ) : (
        <Drawer
          title={null}
          closable={false}
          placement="left"
          onClose={() => setDrawerVisible(false)}
          open={drawerVisible}
          styles={{
            header: { display: "none" },
            body: { padding: 10, background: "#f5f7fb" },
            content: {
              borderTopRightRadius: 18,
              borderBottomRightRadius: 18,
              overflow: "hidden",
            },
          }}
          size={220}
          
        >
          <div
            style={{
              borderRadius: 14,
              padding: "8px 8px 10px",
              background: "linear-gradient(135deg, #ffffff 0%, #f8fbff 100%)",
              border: "1px solid #e8eef7",
              boxShadow: "0 8px 24px rgba(15, 23, 42, 0.06)",
              marginBottom: 10,
            }}
          >
            <LogoSection closeDrawer />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", lineHeight: 1.1 }}>Merchant Panel</div>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>Manage store, orders and products</div>
              </div>

              <Button
                type="text"
                size="small"
                onClick={() => setDrawerVisible(false)}
                icon={<X size={16} />}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background: "#fff",
                  border: "1px solid #e8eef7",
                }}
              />
            </div>
          </div>

          <div
            style={{
              borderRadius: 14,
              padding: 6,
              background: "#ffffff",
              border: "1px solid #e8eef7",
              boxShadow: "0 8px 24px rgba(15, 23, 42, 0.04)",
            }}
          >
            {renderMenu()}
          </div>
        </Drawer>
      )}

      <Layout>
      <Header
        style={{
          padding: screens.sm ? "0 20px" : "0 12px",
          position: "sticky",
          top: 0,
          zIndex: 1000,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          height: 64,
          
          // Enhanced glass + gradient background
          background: "linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(241,245,249,0.92) 50%, rgba(224,242,254,0.88) 100%)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(203,213,225,0.3)",
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.03), 0 2px 6px rgba(15, 23, 42, 0.05)",
        }}
      >
        {/* LEFT SECTION */}
        <div style={{ 
          display: "flex", 
          alignItems: "center", 
          gap: screens.sm ? 12 : 6,
          flexShrink: 0,
        }}>
          <Button
            type="text"
            icon={collapsed ? <PanelLeftOpen size={screens.sm ? 18 : 16} /> : <PanelLeftClose size={screens.sm ? 18 : 16} />}
            onClick={() => {
              if (screens.md) setCollapsed(!collapsed);
              else setDrawerVisible(true);
            }}
            style={{
              width: screens.sm ? 42 : 36,
              height: screens.sm ? 42 : 36,
              borderRadius: 10,
              background: "rgba(255,255,255,0.8)",
              border: "1px solid rgba(226,232,240,0.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.2s ease",
              boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
            }}
            className="hover-scale"
          />

          <Button
            type="text"
            icon={<Home size={screens.sm ? 18 : 16} />}
            onClick={() => navigate("/")}
            style={{
              width: screens.sm ? 42 : 36,
              height: screens.sm ? 42 : 36,
              borderRadius: 10,
              background: "rgba(255,255,255,0.8)",
              border: "1px solid rgba(226,232,240,0.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.2s ease",
              boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
            }}
            className="hover-scale"
            aria-label="Home"
            title="Home"
          />
        </div>

        {/* SPACER */}
        <div style={{ flex: 1, minWidth: 16 }} />

        {/* RIGHT SECTION */}
        <div style={{ 
          display: "flex", 
          alignItems: "center", 
          gap: screens.sm ? 8 : 4,
          flexShrink: 0,
          maxWidth: screens.md ? "50%" : "70%",
          flexWrap: "nowrap",
          whiteSpace: "nowrap",
        }}>
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: screens.sm ? 6 : 4,
          padding: screens.sm ? "4px 12px" : "2px 8px",
          height: screens.sm ? 32 : 28,
          borderRadius: 20,
          background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)",
          border: "1px solid rgba(74,222,128,0.3)",
          color: "#166534",
          fontWeight: 600,
          fontSize: screens.sm ? 12 : 11,
          lineHeight: 1,
          whiteSpace: "nowrap",
          maxWidth: screens.sm ? 220 : 120,
          overflow: "hidden",
          textOverflow: "ellipsis",
          boxSizing: "border-box",
          flexShrink: 0,
        }}
        title={`Balance: USD ${balanceLoading ? "..." : Number(balance || 0).toFixed(2)}`}
      >
        <Wallet size={screens.sm ? 13 : 11} /> 
        {screens.sm ? (
          <>USD {balanceLoading ? "..." : Number(balance || 0).toFixed(2)}</>
        ) : (
          <>{balanceLoading ? "..." : Number(balance || 0).toFixed(2)}</>
        )}
      </div>
          <div style={{ 
            display: "flex", 
            gap: screens.sm ? 6 : 4,
          }}>
            <Button
              type="primary"
              onClick={() => navigate("/add-balance")}
              icon={<PlusCircle size={screens.sm ? 18 : 16} />}
              style={{
                width: screens.sm ? 42 : 36,
                height: screens.sm ? 42 : 36,
                borderRadius: 10,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                border: "none",
                boxShadow: "0 4px 10px rgba(59,130,246,0.3)",
                transition: "all 0.2s ease",
              }}
              className="hover-scale"
              aria-label="Add Balance"
              title="Add Balance"
            />

            <Button
              onClick={loadBalance}
              icon={<RefreshCcw size={screens.sm ? 18 : 16} />}
              style={{
                width: screens.sm ? 42 : 36,
                height: screens.sm ? 42 : 36,
                borderRadius: 10,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(255,255,255,0.8)",
                border: "1px solid rgba(226,232,240,0.6)",
                transition: "all 0.2s ease",
                boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
              }}
              className="hover-scale"
              aria-label="Refresh"
              title="Refresh"
            />
          </div>
        </div>
      </Header>


        <Content
          style={{
            margin: screens.md ? "24px 16px" : 0,
            padding: screens.md ? 24 : 0,
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
