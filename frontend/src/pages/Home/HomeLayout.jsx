import React, { useEffect, useMemo, useState } from "react";
import { Layout, Menu, Grid, Drawer, message } from "antd";
import { TagOutlined } from "@ant-design/icons";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import Navbar from "../../components/common/Navbar";
import CartButton from "../../components/layout/CartButton";
import { Gift, Shapes } from "lucide-react";
import { normalizeImageUrl } from "../../utils/imageUrl";
import { API_BASE_URL } from "../../config/env";

const { Sider, Content } = Layout;
const { useBreakpoint } = Grid;

const API_CATEGORIES = `${API_BASE_URL}/api/categories`;

const fallbackCategoryIcon = () => {
  return (
    <div
      style={{
        width: 18,
        height: 18,
        borderRadius: 6,
        background: "#f0f0f0",
        display: "grid",
        placeItems: "center",
        color: "#6b7280",
      }}
    >
      <Shapes size={12} strokeWidth={2.2} />
    </div>
  );
};

const CategoryIcon = ({ name, imageUrl }) => {
  const [imgError, setImgError] = useState(false);
  const src = imageUrl ? normalizeImageUrl(imageUrl) : "";

  if (!src || imgError) return fallbackCategoryIcon();

  return (
    <img
      src={src}
      alt={name}
      onError={() => setImgError(true)}
      style={{ width: 18, height: 18, borderRadius: 6, objectFit: "cover" }}
    />
  );
};

const CategoryLoadingMenu = () => (
  <div className="px-4 py-2">
    <div className="space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="h-8 rounded-md bg-gray-100 animate-pulse"
        />
      ))}
    </div>
  </div>
);

const MobileCategoryLoading = () => (
  <>
    {Array.from({ length: 5 }).map((_, i) => (
      <div key={i} className="h-9 w-20 rounded-full bg-gray-100 animate-pulse flex-shrink-0" />
    ))}
  </>
);

const HomeLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const screens = useBreakpoint();
  const isMobile = !screens.md;


  const navigate = useNavigate();
  const location = useLocation();

  //  categories state
  const [categories, setCategories] = useState([]);
  const [catLoading, setCatLoading] = useState(false);

  const menuItems = [
    {
      key: "/offers",
      icon: <TagOutlined style={{ color: "#faad14" }} />,
      label: "Special Offers",
    },
    {
      key: "/gift-card",
      icon: <Gift style={{ color: "#eb2f96" }} />,
      label: "Gift Cards",
    }
  ];

  //  load categories from backend (with subCategories)
  useEffect(() => {
    let ignore = false;

    (async () => {
      try {
        setCatLoading(true);
        const res = await fetch(API_CATEGORIES);
        const data = await res.json();

        if (!res.ok) throw new Error(data?.message || "Failed to load categories");

        if (!ignore) setCategories(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error(e);
        if (!ignore) {
          setCategories([]);
          message.error(e.message || "Category load failed");
        }
      } finally {
        if (!ignore) setCatLoading(false);
      }
    })();

    return () => {
      ignore = true;
    };
  }, []);

  const categoryMenuItems = useMemo(() => {
    return (categories || []).map((c) => {
      const catUrl = `/${c.slug}`;

      const catIconNode = <CategoryIcon name={c.name} imageUrl={c.imageUrl} />;

      const children =
        Array.isArray(c.subCategories) && c.subCategories.length
          ? c.subCategories
              .filter((s) => s?.isActive !== false)
              .map((s) => ({
                key: `${catUrl}/${s.slug}`,
                label: (
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <CategoryIcon name={s.name} imageUrl={s.imageUrl} />
                    <span>{s.name}</span>
                  </span>
                ),
              }))
          : undefined;

      return {
        key: catUrl,
        icon: catIconNode,
        label: c.name,
        children,
      };
    });
  }, [categories]);

  const MenuContent = (
    <Menu
      theme="light"
      mode="inline"
      selectedKeys={[location.pathname]}
      onClick={(e) => {
        navigate(e.key);
        if (isMobile) setDrawerOpen(false); // ✅ fixed
      }}
      items={menuItems}
    />
  );

  const CategoryMenu = (
    <div>
      {catLoading ? (
        <CategoryLoadingMenu />
      ) : (
        <Menu
          theme="light"
          mode="inline"
          selectedKeys={[location.pathname]}
          onClick={(e) => {
            navigate(e.key);
            if (isMobile) setDrawerOpen(false); // ✅ fixed
          }}
          items={categoryMenuItems}
        />
      )}
    </div>
  );

  // ✅ Mobile Option-1: only Categories (NO subcategories here)
  const MobileCategoryMenu = (
    <div
      className="flex items-center gap-2 px-3 py-3 bg-white shadow-sm overflow-x-auto
                 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
    >
      <button
        className="flex-shrink-0 px-3 py-2 rounded-full border bg-gray-50 text-xs font-semibold"
        onClick={() => setDrawerOpen(true)}
      >
        All
      </button>

      {catLoading ? (
        <MobileCategoryLoading />
      ) : (
        (categories || []).map((c) => {
          const url = `/${c.slug}`;
          const active = location.pathname === url || location.pathname.startsWith(url + "/");

          const iconNode = <CategoryIcon name={c.name} imageUrl={c.imageUrl} />;

          return (
            <button
              key={c.id}
              className={`flex items-center gap-2 flex-shrink-0 px-4 py-2 rounded-full text-xs font-semibold border transition-all
                ${
                  active
                    ? "bg-yellow-50 border-yellow-400 text-gray-900"
                    : "bg-gray-50 border-gray-100 text-gray-700"
                }`}
              onClick={() => navigate(url)}
            >
              {iconNode}
              <span>{c.name}</span>
            </button>
          );
        })
      )}
    </div>
  );

  return (
    <>
      <Navbar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        openDrawer={() => setDrawerOpen(true)}
        isMobile={isMobile}
      />

      {isMobile && MobileCategoryMenu}

      <Layout>
        {/* Desktop Sider */}
        {!isMobile && (
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
            }}
          >

            {MenuContent}
            <div className="mt-4 mb-2 px-4 text-gray-500 uppercase text-xs font-semibold">
              Categories
            </div>

            {CategoryMenu}
          </Sider>
        )}

        {/* Mobile Drawer */}
        {isMobile && (
          <Drawer
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            placement="left"
            width={260}
            styles={{ body: { padding: 0 } }}
          >

            {MenuContent}
            <div className="mt-4 mb-2 px-4 text-gray-500 uppercase text-xs font-semibold">
              Categories
            </div>
            {CategoryMenu}
          </Drawer>
        )}

        <Layout>
          <Content
            style={{
              margin: "5px 10px",
              padding: 0,
              minHeight: "100vh",
              background: "#fff",
              borderRadius: 8,
            }}
          >
            <Outlet />
            <CartButton />
          </Content>
        </Layout>
      </Layout>
    </>
  );
};

export default HomeLayout;
