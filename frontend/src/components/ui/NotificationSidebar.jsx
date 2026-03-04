import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Drawer, Badge, Button, message as antdMessage, Spin, Tooltip } from "antd";
import { useNavigate } from "react-router-dom";
import {
  BellOutlined,
  ShoppingOutlined,
  GiftOutlined,
  TruckOutlined,
  CheckCircleOutlined,
  CloseOutlined,
  HeartOutlined,
  StarOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import {  API_BASE_URL } from "../../config/env";

/**
 * Backend -> Frontend mapping:
 * backend: { id, type, title, message, isRead, createdAt, meta }
 * frontend expects: read (boolean) so we map: read = isRead
 */

const API_BASE = API_BASE_URL;

const getToken = () => {
  try {
    const u = JSON.parse(localStorage.getItem("userInfo") || "null");
    return u?.token || "";
  } catch {
    return "";
  }
};

const getCurrentRole = () => {
  try {
    const u = JSON.parse(localStorage.getItem("userInfo") || "null");
    return String(u?.user?.role || "user").toLowerCase();
  } catch {
    return "user";
  }
};

const iconByType = (type) => {
  const t = String(type || "").toLowerCase();
  if (t === "order") return { icon: <ShoppingOutlined />, color: "orange" };
  if (t === "offer") return { icon: <GiftOutlined />, color: "pink" };
  if (t === "delivery") return { icon: <CheckCircleOutlined />, color: "green" };
  if (t === "shipped") return { icon: <TruckOutlined />, color: "blue" };
  if (t === "wishlist") return { icon: <HeartOutlined />, color: "red" };
  if (t === "review") return { icon: <StarOutlined />, color: "purple" };
  return { icon: <BellOutlined />, color: "blue" };
};

// simple "time ago" formatter
const timeAgo = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (!Number.isFinite(diff)) return "";
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
};

async function apiFetch(path, { method = "GET", body } = {}) {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: token ? `Bearer ${token}` : "",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.message || "Request failed";
    throw new Error(msg);
  }
  return data;
}

const NotificationSidebar = ({ autoRefreshMs = 30000 }) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const role = useMemo(() => getCurrentRole(), []);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const normalize = (row) => {
    const { icon, color } = iconByType(row.type);
    return {
      id: row.id,
      type: row.type,
      icon,
      color,
      title: row.title,
      message: row.message,
      time: timeAgo(row.createdAt),
      read: !!row.isRead,
      meta: row.meta || null,
      createdAt: row.createdAt,
    };
  };

  const loadNotifications = useCallback(
    async ({ silent = false } = {}) => {
      try {
        if (!silent) setLoading(true);
        const res = await apiFetch(`/api/notifications?limit=50&page=1`);
        const list = (res?.data || []).map(normalize);
        setNotifications(list);
      } catch (err) {
        if (!silent) antdMessage.error(err.message || "Failed to load notifications");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    []
  );

  const refresh = async () => {
    try {
      setRefreshing(true);
      await loadNotifications({ silent: true });
      antdMessage.success("Refreshed");
    } catch (e) {
      antdMessage.error(e.message || "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  };

  const showDrawer = async () => {
    setOpen(true);
    // drawer open করলে latest টেনে আনবে
    await loadNotifications();
  };

  const onClose = () => setOpen(false);

  const markAsRead = async (id) => {
    // optimistic UI
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );

    try {
      await apiFetch(`/api/notifications/${id}/read`, { method: "PATCH" });
    } catch (err) {
      // rollback
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: false } : n))
      );
      antdMessage.error(err.message || "Failed to mark as read");
    }
  };

  const resolveNotificationRoute = (notif) => {
    const route = notif?.meta?.route;
    if (typeof route === "string" && route.trim()) return route;

    const type = String(notif?.type || "").toLowerCase();
    if (type === "order") return role === "merchant" ? "/merchant/my-orders" : "/orders";
    if (type === "review" && role === "merchant") return "/merchant/my-store";
    if (type === "system" && ["approved", "rejected"].includes(String(notif?.meta?.status || "").toLowerCase())) {
      return "/merchant";
    }
    return null;
  };

  const onNotificationClick = async (notif) => {
    await markAsRead(notif.id);
    const target = resolveNotificationRoute(notif);
    if (target) {
      setOpen(false);
      navigate(target);
    }
  };

  const markAllAsRead = async () => {
    // optimistic
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

    try {
      await apiFetch(`/api/notifications/read-all`, { method: "PATCH" });
      antdMessage.success("All marked as read");
    } catch (err) {
      // reload to be safe
      await loadNotifications({ silent: true });
      antdMessage.error(err.message || "Failed to mark all");
    }
  };

  const deleteNotification = async (id) => {
    const backup = notifications;
    setNotifications((prev) => prev.filter((n) => n.id !== id));

    try {
      await apiFetch(`/api/notifications/${id}`, { method: "DELETE" });
      antdMessage.success("Deleted");
    } catch (err) {
      setNotifications(backup);
      antdMessage.error(err.message || "Delete failed");
    }
  };

  const clearAll = async () => {
    const backup = notifications;
    setNotifications([]);

    try {
      await apiFetch(`/api/notifications/clear-all`, { method: "DELETE" });
      antdMessage.success("Cleared all");
    } catch (err) {
      setNotifications(backup);
      antdMessage.error(err.message || "Clear all failed");
    }
  };

  // initial load on mount — badge count দেখানোর জন্য
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    loadNotifications({ silent: true });
  }, [loadNotifications]);

  // optional auto refresh (REST polling) — drawer বন্ধ থাকলেও badge update হবে
  useEffect(() => {
    if (!autoRefreshMs || autoRefreshMs < 3000) return; // min 3s
    const t = setInterval(() => {
      if (document.visibilityState === "visible") loadNotifications({ silent: true });
    }, autoRefreshMs);
    return () => clearInterval(t);
  }, [autoRefreshMs, loadNotifications]);

  return (
    <>
      {/* Notification Bell Button */}
      <div
        onClick={showDrawer}
        className="cursor-pointer relative hover:scale-110 transition-transform duration-200"
      >
        <Badge count={unreadCount} overflowCount={9} offset={[-5, 5]} size="small">
          <div className="bg-linier-to-br from-orange-100 to-yellow-100 p-2 rounded-full hover:from-orange-200 hover:to-yellow-200 transition-all duration-300">
            <BellOutlined className="text-xl text-orange-600" />
          </div>
        </Badge>
      </div>

      {/* Drawer */}
      <Drawer
        title={
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-gray-800">Notifications</h3>
              {unreadCount > 0 && (
                <p className="text-xs text-gray-500">{unreadCount} unread</p>
              )}
            </div>

            {/* actions */}
            <div className="flex items-center gap-2">
              <Tooltip title="Refresh">
                <Button
                  size="small"
                  onClick={refresh}
                  loading={refreshing}
                  icon={<ReloadOutlined />}
                />
              </Tooltip>

              {notifications.length > 0 && (
                <>
                  {unreadCount > 0 && (
                    <Button
                      size="small"
                      type="link"
                      onClick={markAllAsRead}
                      className="text-xs text-blue-600"
                    >
                      Mark all
                    </Button>
                  )}
                  <Button
                    size="small"
                    type="link"
                    onClick={clearAll}
                    className="text-xs text-red-600"
                  >
                    Clear all
                  </Button>
                </>
              )}
            </div>
          </div>
        }
        placement="right"
        onClose={onClose}
        open={open}
        width={380}
        className="notification-drawer"
      >
        {loading ? (
          <div className="flex justify-center py-10">
            <Spin />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[70vh] text-center px-4">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4 border border-gray-100">
              <BellOutlined style={{ fontSize: 28, color: "#cbd5e1" }} />
            </div>
            <h3 className="text-base font-semibold text-gray-700">All caught up!</h3>
            <p className="text-xs text-gray-500 mt-1.5 leading-relaxed max-w-[200px]">
              You have no new notifications at the moment.
            </p>
            <Button 
              type="text" 
              size="small" 
              onClick={refresh} 
              icon={<ReloadOutlined />} 
              className="mt-4 text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            >
              Check again
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((notif) => (
              <NotificationItem
                key={notif.id}
                {...notif}
                onOpen={() => onNotificationClick(notif)}
                onDelete={() => deleteNotification(notif.id)}
              />
            ))}
          </div>
        )}
      </Drawer>
    </>
  );
};

// Notification Item Component
const NotificationItem = ({ icon, title, message, time, read, color, onOpen, onDelete }) => {
  const colorClasses = {
    blue: "bg-blue-100 text-blue-600",
    pink: "bg-pink-100 text-pink-600",
    green: "bg-green-100 text-green-600",
    orange: "bg-orange-100 text-orange-600",
    purple: "bg-purple-100 text-purple-600",
    red: "bg-red-100 text-red-600",
  };

  return (
    <div
      onClick={onOpen}
      className={`
        p-4 rounded-lg cursor-pointer transition-all border-l-4 group relative
        ${read ? "bg-white border-transparent hover:bg-gray-50" : "bg-blue-50 border-blue-500 hover:bg-blue-100"}
      `}
    >
      <div className="flex gap-3">
        {/* Icon */}
        <div
          className={`
            w-10 h-10 rounded-full flex items-center justify-center shrink-0
            ${colorClasses[color] || colorClasses.blue}
          `}
        >
          {icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4 className={`text-sm font-semibold ${read ? "text-gray-700" : "text-gray-900"}`}>
              {title}
            </h4>
            {!read && (
              <span className="w-2 h-2 bg-blue-600 rounded-full shrink-0 mt-1.5"></span>
            )}
          </div>
          <p className="text-xs text-gray-600 mt-1 leading-relaxed">{message}</p>
          <p className="text-xs text-gray-400 mt-2">{time}</p>
        </div>

        {/* Delete Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-600 bg-white rounded-full p-1 shadow-sm"
        >
          <CloseOutlined className="text-xs" />
        </button>
      </div>
    </div>
  );
};

export default NotificationSidebar;
