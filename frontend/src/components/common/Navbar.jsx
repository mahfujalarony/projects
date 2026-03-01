import React, { useEffect, useState } from "react";
import { Input, Badge, Button, Dropdown } from "antd";
import {
  MenuOutlined,
  SearchOutlined,
  CloseOutlined,
  MessageOutlined,
  DownOutlined,
  AppstoreOutlined,
  RightOutlined,
  LeftOutlined,
} from "@ant-design/icons";
import UserDropDown from "../ui/UserDropDown";
import NotificationSidebar from "../ui/NotificationSidebar";
import { useNavigate, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { API_BASE_URL, UPLOAD_BASE_URL } from "../../config/env";

const MAX_SITE_NAME_LENGTH = 24;
const clampSiteName = (value, fallback = "") => {
  const text = String(value || "").trim();
  if (!text) return fallback;
  return text.slice(0, MAX_SITE_NAME_LENGTH);
};


const Navbar = ({ collapsed, setCollapsed, openDrawer, isMobile, categories = [], catLoading = false }) => {
  const [notificationCount] = useState(12);
  const [scrolled, setScrolled] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [showMobileCategories, setShowMobileCategories] = useState(false);
  const [mobileCategoryPath, setMobileCategoryPath] = useState([]);
  const navigate = useNavigate();
  const locationPath = useLocation();
  const { user } = useSelector((state) => state.auth);
  const totalUnreadCount = useSelector((state) => state.chat?.totalUnreadCount || 0);
  const [logoSrc, setLogoSrc] = useState("");
  const [siteName, setSiteName] = useState("");
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [showDesktopSuggestions, setShowDesktopSuggestions] = useState(false);
  const [showMobileSuggestions, setShowMobileSuggestions] = useState(false);


  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (locationPath.pathname.startsWith("/search/")) {
      const queryFromUrl = decodeURIComponent(
        locationPath.pathname.split("/search/")[1] || ""
      );
      setSearchValue(queryFromUrl);
    } else if (!locationPath.pathname.startsWith("/search")) {
      setSearchValue("");
    }
  }, [locationPath.pathname]);

  useEffect(() => {
    let ignore = false;

    const toLogoSrc = (value) => {
      const raw = String(value || "").trim();
      if (!raw) return "";
      if (/^https?:\/\//i.test(raw)) return raw;
      return `${UPLOAD_BASE_URL}/${raw.replace(/^\/+/, "")}`;
    };

    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/settings`);
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.success || ignore) return;
        setLogoSrc(toLogoSrc(json?.data?.siteLogoUrl));
        setSiteName(clampSiteName(json?.data?.siteName, ""));
        const rawSuggestions = json?.data?.searchSuggestions;
        const parsedSuggestions = Array.isArray(rawSuggestions)
          ? rawSuggestions
          : String(rawSuggestions || "")
              .split(/\r?\n|,/)
              .map((x) => String(x || "").trim())
              .filter(Boolean);
        setSearchSuggestions([...new Set(parsedSuggestions)].slice(0, 20));
      } catch {
        // keep empty; no default logo/name
      } finally {
        if (!ignore) setSettingsLoaded(true);
      }
    })();

    return () => {
      ignore = true;
    };
  }, []);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setSearchValue(value);
  };

  const handleSearch = (value) => {
    const normalized = String(value || "").trim();
    if (normalized) navigate(`/search/${encodeURIComponent(normalized)}`);
    else navigate(`/search`);
    setShowMobileSearch(false);
    setShowDesktopSuggestions(false);
    setShowMobileSuggestions(false);
  };

  const filteredSuggestions = searchSuggestions
    .filter((item) =>
      searchValue.trim()
        ? item.toLowerCase().includes(searchValue.trim().toLowerCase())
        : true
    )
    .slice(0, 8);

  const selectSuggestion = (item) => {
    setSearchValue(item);
    handleSearch(item);
  };

  const categoryMenuItems = (list = [], parentUrl = "") =>
    (Array.isArray(list) ? list : [])
      .filter((n) => n?.isActive !== false)
      .map((n) => {
        const url = `${parentUrl}/${n.slug}`;
        const children = categoryMenuItems(n.children, url);
        const label = (
          <div title={n.name} className="max-w-[220px] truncate">
            {n.name}
          </div>
        );
        if (children.length) {
          return {
            key: `group-${url}`,
            label,
            children: [{ key: url, label: <div className="max-w-[220px] truncate">{`All ${n.name}`}</div> }, ...children],
          };
        }
        return { key: url, label };
      });

  const categoryDropdownItems = (Array.isArray(categories) ? categories : [])
    .filter((c) => c?.isActive !== false)
    .map((c) => {
      const baseUrl = `/${c.slug}`;
      const children = categoryMenuItems(c.subCategories, baseUrl);
      const label = (
        <div title={c.name} className="max-w-[220px] truncate">
          {c.name}
        </div>
      );
      if (children.length) {
        return {
          key: `group-${baseUrl}`,
          label,
          children: [{ key: baseUrl, label: <div className="max-w-[220px] truncate">{`All ${c.name}`}</div> }, ...children],
        };
      }
      return { key: baseUrl, label };
    });

  const getNodeChildren = (node) => {
    if (Array.isArray(node?.subCategories)) return node.subCategories;
    if (Array.isArray(node?.children)) return node.children;
    return [];
  };

  const mobileNodes = (Array.isArray(categories) ? categories : []).filter((c) => c?.isActive !== false);
  const currentMobileParent = mobileCategoryPath[mobileCategoryPath.length - 1] || null;
  const currentMobileNodes = (currentMobileParent ? getNodeChildren(currentMobileParent) : mobileNodes).filter(
    (n) => n?.isActive !== false
  );
  const currentMobileTitle = currentMobileParent?.name || "All Categories";
  const currentMobileUrl = currentMobileParent
    ? `/${mobileCategoryPath.map((n) => n.slug).join("/")}`
    : "";


  return (
    <div
      className={[
        "w-full sticky top-0 z-50 border-b backdrop-blur-lg transition-all duration-300 relative",
        "bg-white/70",
        scrolled ? "shadow-lg bg-white/85" : "shadow-sm bg-white/60",
      ].join(" ")}
    >
      <style>{`
        .category-dropdown .ant-dropdown-menu,
        .category-dropdown .ant-dropdown-menu-submenu .ant-dropdown-menu {
          max-width: min(92vw, 280px);
          max-height: 70vh;
          overflow: auto;
        }
        .category-dropdown .ant-dropdown-menu-title-content {
          white-space: normal;
          word-break: break-word;
        }
        .category-dropdown .ant-dropdown-menu-submenu-popup {
          left: auto !important;
          right: 100% !important;
        }
      `}</style>
      <div className="h-1 w-full bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400 animate-gradient-x" />
      <div className="max-w-7xl mx-auto px-3 md:px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <LeftSection
            collapsed={collapsed}
            setCollapsed={setCollapsed}
            openDrawer={openDrawer}
            isMobile={isMobile}
            logoSrc={logoSrc}
            siteName={siteName}
            settingsLoaded={settingsLoaded}
          />

          {/* Desktop search */}
          <SearchBar
            searchValue={searchValue}
            setSearchValue={handleInputChange}
            handleSearch={handleSearch}
            suggestions={filteredSuggestions}
            showSuggestions={showDesktopSuggestions}
            setShowSuggestions={setShowDesktopSuggestions}
            onSelectSuggestion={selectSuggestion}
            className="hidden md:block"
          />

          {/* Right side + mobile search icon */}
          <div className="flex items-center gap-2 md:gap-3">
            {isMobile ? (
              <button
                className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-2 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                onClick={() => {
                  setShowMobileCategories((v) => !v);
                  setMobileCategoryPath([]);
                }}
                disabled={catLoading}
              >
                <AppstoreOutlined />
                <span>Cat</span>
                <DownOutlined style={{ fontSize: 11 }} />
              </button>
            ) : (
              <Dropdown
                overlayClassName="category-dropdown"
                trigger={["click"]}
                menu={{
                  items: categoryDropdownItems,
                  onClick: ({ key }) => {
                    if (!String(key).startsWith("group-")) navigate(String(key));
                  },
                  style: { maxHeight: "70vh", overflowY: "auto" },
                }}
              >
                <button
                  className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-2.5 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                  disabled={catLoading}
                >
                  <AppstoreOutlined />
                  <span className="hidden sm:inline">Category</span>
                  <DownOutlined style={{ fontSize: 11 }} />
                </button>
              </Dropdown>
            )}
            {/* Mobile search toggle */}
            <button
              className="md:hidden w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-700"
              onClick={() => setShowMobileSearch((prev) => !prev)}
              aria-label="Search"
            >
              <SearchOutlined className="text-lg" />
            </button>
            <RightSection
              notificationCount={notificationCount}
              user={user}
              totalUnreadCount={totalUnreadCount}
              isMobile={isMobile}
            />
          </div>
        </div>
      </div>

      {/* Mobile search dropdown */}
      {showMobileSearch && (
        <div className="md:hidden absolute left-0 right-0 top-full z-[75] px-3 pt-2 pb-3">
          <div className="relative bg-white rounded-xl shadow-md border border-gray-100 p-2 animate-slideDown">
            <div className="flex items-center gap-2">
              <Input
                size="large"
                placeholder="Search for products..."
                value={searchValue}
                onChange={handleInputChange}
                onFocus={() => setShowMobileSuggestions(true)}
                onBlur={() => setTimeout(() => setShowMobileSuggestions(false), 120)}
                onPressEnter={() => handleSearch(searchValue)}
                suffix={
                  <SearchOutlined
                    className="text-xl text-gray-500 cursor-pointer"
                    onClick={() => handleSearch(searchValue)}
                  />
                }
                className="rounded-lg bg-gray-50 border-gray-200 shadow-sm"
                style={{ padding: "8px 20px" }}
                autoFocus
              />
              <button
                type="button"
                aria-label="Close search"
                onClick={() => {
                  setShowMobileSearch(false);
                  setShowMobileSuggestions(false);
                }}
                className="h-10 w-10 shrink-0 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
              >
                <CloseOutlined />
              </button>
            </div>
            {showMobileSuggestions && filteredSuggestions.length > 0 ? (
              <div className="absolute left-2 right-2 top-full z-[80] mt-2 rounded-lg border border-gray-200 bg-white shadow-lg max-h-56 overflow-auto">
                {filteredSuggestions.map((item) => (
                  <button
                    key={`mobile-suggestion-${item}`}
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-orange-50"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectSuggestion(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {isMobile && showMobileCategories && (
        <div className="md:hidden absolute left-0 right-0 top-full z-[70] px-4 pt-2 pb-3">
          <div className="rounded-xl border border-gray-200 bg-white shadow-lg max-h-[62vh] overflow-auto">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-3 py-2">
              {mobileCategoryPath.length > 0 ? (
                <button
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
                  onClick={() => setMobileCategoryPath((prev) => prev.slice(0, -1))}
                >
                  <LeftOutlined style={{ fontSize: 10 }} />
                  Back
                </button>
              ) : (
                <span className="text-xs text-gray-400">Browse</span>
              )}
              <p className="max-w-[65%] truncate text-sm font-semibold text-gray-800">{currentMobileTitle}</p>
              <button
                className="rounded-md px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100"
                onClick={() => setShowMobileCategories(false)}
              >
                Close
              </button>
            </div>

            {mobileCategoryPath.length > 0 ? (
              <button
                className="block w-full border-b border-orange-100 bg-orange-50 px-4 py-2 text-left text-xs font-semibold text-orange-700"
                onClick={() => {
                  if (currentMobileUrl) navigate(currentMobileUrl);
                  setShowMobileCategories(false);
                }}
              >
                All {currentMobileTitle}
              </button>
            ) : null}

            {currentMobileNodes.map((node) => {
              const children = getNodeChildren(node).filter((n) => n?.isActive !== false);
              const nextUrl = currentMobileUrl ? `${currentMobileUrl}/${node.slug}` : `/${node.slug}`;
              return (
                <button
                  key={nextUrl}
                  className="w-full border-b border-gray-100 last:border-b-0 px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50"
                  onClick={() => {
                    if (children.length > 0) {
                      setMobileCategoryPath((prev) => [...prev, node]);
                    } else {
                      navigate(nextUrl);
                      setShowMobileCategories(false);
                    }
                  }}
                >
                  <span className="inline-flex items-center gap-2">
                    <span className="truncate">{node.name}</span>
                    {children.length > 0 ? <RightOutlined style={{ fontSize: 10, color: "#94a3b8" }} /> : null}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
};

const LeftSection = ({ setCollapsed, openDrawer, isMobile, logoSrc, siteName }) => {
  const navigate = useNavigate();
  const initial = String(siteName || "S").slice(0, 1).toUpperCase();
  return (
    <div className="flex items-center gap-2 md:gap-6 shrink-0">
      <MenuOutlined
        onClick={() => {
          if (isMobile) openDrawer();
          else setCollapsed((prev) => !prev);
        }}
        className="text-xl text-gray-700 cursor-pointer hover:text-orange-500 transition-all duration-300 hover:scale-110"
      />
      <div onClick={() => navigate("/")} className="flex items-center gap-2 cursor-pointer group shrink-0">
        {logoSrc ? (
          <img src={logoSrc} alt="Shop Logo" className="w-9 h-9 md:w-10 md:h-10 object-cover rounded" />
        ) : (
          <div className="w-9 h-9 md:w-10 md:h-10 rounded bg-sky-100 border border-sky-200 text-sky-700 font-bold flex items-center justify-center">
            {initial}
          </div>
        )}
        {siteName ? (
          <span className="max-w-[220px] truncate text-3xl hidden md:block font-bold bg-gradient-to-r select-none from-orange-500 via-rose-500 to-amber-500 bg-clip-text text-transparent tracking-tight font-serif italic group-hover:scale-105 transition-transform duration-300">
            {siteName}
          </span>
        ) : null}
      </div>
    </div>
  );
};

const SearchBar = ({
  searchValue,
  setSearchValue,
  handleSearch,
  suggestions = [],
  showSuggestions = false,
  setShowSuggestions = () => {},
  onSelectSuggestion = () => {},
  className = "",
}) => (
  <div className={`flex-1 max-w-3xl ${className}`}>
    <div className="relative">
      <Input
        size="large"
        placeholder="Search for products..."
        value={searchValue}
        onChange={setSearchValue}
        onFocus={() => setShowSuggestions(true)}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 120)}
        onPressEnter={() => handleSearch(searchValue)}
        suffix={
          <SearchOutlined
            className="text-xl text-gray-500 cursor-pointer"
            onClick={() => handleSearch(searchValue)}
          />
        }
        className="rounded-lg bg-gray-50 border-gray-200 shadow-sm"
        style={{ padding: "8px 20px" }}
      />
      {showSuggestions && suggestions.length > 0 ? (
        <div className="absolute left-0 right-0 mt-2 rounded-lg border border-gray-200 bg-white shadow-lg max-h-64 overflow-auto z-20">
          {suggestions.map((item) => (
            <button
              key={`desktop-suggestion-${item}`}
              type="button"
              className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-orange-50"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onSelectSuggestion(item)}
            >
              {item}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  </div>
);

const RightSection = ({ notificationCount, user, totalUnreadCount, isMobile }) => {
  const navigate = useNavigate();

  if (!user) {
    return (
      <div className="flex items-center gap-1 sm:gap-2">
        <button
          className="w-9 h-9 flex items-center justify-center rounded-full border border-sky-200 bg-sky-50 text-sky-600 hover:bg-sky-100"
          onClick={() => navigate("/support")}
          aria-label="Support chat"
          title="Support chat"
        >
          <MessageOutlined />
        </button>
        <Button
          type="default"
          size={isMobile ? "small" : "middle"}
          className="!px-2 sm:!px-3 !text-xs sm:!text-sm"
          onClick={() => navigate("/login")}
        >
          Login
        </Button>
        <Button
          type="primary"
          size={isMobile ? "small" : "middle"}
          className="!px-2 sm:!px-3 !text-xs sm:!text-sm"
          onClick={() => navigate("/register")}
        >
          Signup
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 sm:gap-5">
      <div
        onClick={() => navigate("/chats")}
        className="cursor-pointer relative hover:scale-110 transition-transform duration-200"
      >
        <Badge count={Number(totalUnreadCount || 0)} offset={[-5, 5]} size="small">
          <div className="bg-gradient-to-br from-blue-100 to-cyan-100 p-2 rounded-full hover:from-blue-200 hover:to-cyan-200 transition-all duration-300">
            <MessageOutlined className="text-xl text-blue-600" />
          </div>
        </Badge>
      </div>
      <NotificationSidebar notificationCount={notificationCount} />
      <UserDropDown />
    </div>
  );
};


export default Navbar;
