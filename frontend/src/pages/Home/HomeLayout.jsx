import React, { useEffect, useState } from "react";
import { Layout, Menu, Grid, Drawer, message } from "antd";
import { TagOutlined, AppstoreOutlined } from "@ant-design/icons";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import Navbar from "../../components/common/Navbar";
import CartButton from "../../components/layout/CartButton";
import { Gift } from "lucide-react";
import { API_BASE_URL, UPLOAD_BASE_URL } from "../../config/env";

const { Sider, Content } = Layout;
const { useBreakpoint } = Grid;

const API_CATEGORIES = `${API_BASE_URL}/api/categories`;
const API_SETTINGS = `${API_BASE_URL}/api/settings`;
const CATEGORY_CACHE_KEY = "home:categories:v1";
const CATEGORY_CACHE_TTL = 1000 * 60 * 10;

const readCategoryCache = () => {
  try {
    const raw = sessionStorage.getItem(CATEGORY_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.ts || !Array.isArray(parsed?.data)) return null;
    if (Date.now() - Number(parsed.ts) > CATEGORY_CACHE_TTL) return null;
    return parsed.data;
  } catch {
    return null;
  }
};

const writeCategoryCache = (list) => {
  try {
    sessionStorage.setItem(
      CATEGORY_CACHE_KEY,
      JSON.stringify({
        ts: Date.now(),
        data: Array.isArray(list) ? list : [],
      })
    );
  } catch {
    // no-op for private mode or quota errors
  }
};

const HomeLayout = () => {
  const [collapsed, setCollapsed] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const navigate = useNavigate();
  const location = useLocation();
  const isChatLikeRoute =
    location.pathname.startsWith("/chats") || location.pathname.startsWith("/support");

  const [categories, setCategories] = useState([]);
  const [catLoading, setCatLoading] = useState(false);
  const [siteMeta, setSiteMeta] = useState({ name: "", logo: "", loaded: false });

  const menuItems = [
    {
      key: "/products",
      icon: <AppstoreOutlined style={{ color: "#0ea5e9" }} />,
      label: "Products",
    },
    {
      key: "/offers",
      icon: <TagOutlined style={{ color: "#f97316" }} />,
      label: "Special Offers",
    },
    {
      key: "/gift-card",
      icon: <Gift style={{ color: "#e11d48" }} />,
      label: "Gift Cards",
    },
  ];

  const resolveLogoSrc = (value = "") => {
    const raw = String(value || "").trim();
    if (!raw) return "";
    if (/^https?:\/\//i.test(raw)) return raw;
    return `${UPLOAD_BASE_URL}/${raw.replace(/^\/+/, "")}`;
  };

  useEffect(() => {
    let ignore = false;
    const cachedCategories = readCategoryCache();
    if (cachedCategories?.length) {
      setCategories(cachedCategories);
      setCatLoading(false);
    }

    (async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 9000);
      try {
        if (!cachedCategories?.length) setCatLoading(true);
        const res = await fetch(API_CATEGORIES, { signal: controller.signal });
        const data = await res.json();

        if (!res.ok) throw new Error(data?.message || "Failed to load categories");

        if (!ignore) {
          const next = Array.isArray(data) ? data : [];
          setCategories(next);
          writeCategoryCache(next);
        }
      } catch (e) {
        const isAbortError = e?.name === "AbortError";
        if (isAbortError) return;

        if (!ignore) {
          if (!cachedCategories?.length) setCategories([]);
          if (!cachedCategories?.length) message.error(e.message || "Category load failed");
        }
      } finally {
        clearTimeout(timeoutId);
        if (!ignore) setCatLoading(false);
      }
    })();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;
    const applySiteMeta = (settings = {}) => {
      const name = String(settings?.siteName || "").trim();
      const logo = resolveLogoSrc(settings?.siteLogoUrl);
      if (!ignore) setSiteMeta({ name, logo, loaded: true });
    };

    (async () => {
      try {
        const res = await fetch(API_SETTINGS, { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.success || ignore) return;
        applySiteMeta(data?.data || {});
      } catch {
        if (!ignore) setSiteMeta((prev) => ({ ...prev, loaded: true }));
      }
    })();

    const handleSettingsUpdate = (event) => applySiteMeta(event?.detail || {});
    window.addEventListener("app-settings-updated", handleSettingsUpdate);

    return () => {
      ignore = true;
      window.removeEventListener("app-settings-updated", handleSettingsUpdate);
    };
  }, []);

  const menuClassName =
    "bg-transparent border-none px-2 [&_.ant-menu-item]:rounded-xl [&_.ant-menu-item]:mb-1 [&_.ant-menu-submenu-title]:rounded-xl [&_.ant-menu-item]:transition-all [&_.ant-menu-item]:duration-200 [&_.ant-menu-item]:hover:translate-x-[2px] [&_.ant-menu-item]:hover:bg-sky-50 [&_.ant-menu-submenu-title]:hover:bg-sky-50 [&_.ant-menu-item-selected]:!bg-gradient-to-r [&_.ant-menu-item-selected]:!from-sky-100 [&_.ant-menu-item-selected]:!to-cyan-100 [&_.ant-menu-item-selected]:!text-sky-700";

  const MenuContent = (
    <Menu
      theme="light"
      mode="inline"
      className={menuClassName}
      selectedKeys={[location.pathname]}
      onClick={(e) => {
        navigate(e.key);
        if (isMobile) setDrawerOpen(false);
      }}
      items={menuItems}
    />
  );

  const BrandBlock = ({ isCollapsed = false }) => (
    <div className="p-3">
      <div
        className={`rounded-2xl border border-sky-200 bg-gradient-to-r from-sky-100 via-cyan-100 to-blue-100 p-2.5 shadow-sm transition-all ${
          isCollapsed ? "flex justify-center" : "flex items-center gap-2.5"
        }`}
      >
        {siteMeta.logo ? (
          <img src={siteMeta.logo} alt={siteMeta.name || "Shop"} className="h-10 w-10 rounded-xl object-cover border border-white/70" />
        ) : (
          <div className="h-10 w-10 rounded-xl bg-white/80 border border-white/70 flex items-center justify-center text-sky-600 font-bold">
            {(siteMeta.name || "S").slice(0, 1).toUpperCase()}
          </div>
        )}
        {!isCollapsed ? (
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.14em] text-sky-600 font-semibold">Welcome</p>
            <p className="text-sm font-bold text-gray-800 truncate">{siteMeta.name || "Shop"}</p>
          </div>
        ) : null}
      </div>
    </div>
  );

  return (
    <>
      <Navbar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        openDrawer={() => setDrawerOpen(true)}
        isMobile={isMobile}
        categories={categories}
        catLoading={catLoading}
      />

      <Layout>
        {!isMobile && (
          <Sider
            theme="light"
            trigger={null}
            collapsible
            collapsed={collapsed}
            collapsedWidth={80}
            style={{
              overflow: "auto",
              height: "100vh",
              position: "sticky",
              top: 0,
              background:
                "linear-gradient(180deg, rgba(236,253,255,1) 0%, rgba(255,255,255,1) 42%, rgba(240,249,255,1) 100%)",
              borderRight: "1px solid #bfdbfe",
            }}
          >
            <BrandBlock isCollapsed={collapsed} />
            {MenuContent}
          </Sider>
        )}

        {isMobile && (
          <Drawer
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            placement="left"
            size={220}
            mask
            maskClosable
            styles={{
              mask: {
                background: "transparent",
                backdropFilter: "none",
                WebkitBackdropFilter: "none",
              },
              body: {
                padding: 0,
                background:
                  "linear-gradient(180deg, rgba(236,253,255,1) 0%, rgba(255,255,255,1) 42%, rgba(240,249,255,1) 100%)",
              },
            }}
          >
            <BrandBlock />
            {MenuContent}
          </Drawer>
        )}

        <Layout>
          <Content
            style={{
              margin: isChatLikeRoute ? 0 : "5px 10px",
              padding: 0,
              minHeight: isChatLikeRoute ? "calc(100dvh - 76px)" : "100vh",
              background: "#fff",
              borderRadius: isChatLikeRoute ? 0 : 8,
              overflow: isChatLikeRoute ? "hidden" : "visible",
            }}
          >
            <Outlet />
            {!isChatLikeRoute ? <CartButton /> : null}
          </Content>
        </Layout>
      </Layout>
    </>
  );
};

export default HomeLayout;

