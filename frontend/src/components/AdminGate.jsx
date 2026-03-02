import React, { useEffect, useState, useCallback } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { API_BASE_URL } from "../config/env";

const API_BASE = API_BASE_URL;

const getAuth = () => {
  try {
    return JSON.parse(localStorage.getItem("userInfo") || "null");
  } catch {
    return null;
  }
};

const AdminGate = ({ fallbackTo = "/login" }) => {
  const location = useLocation();
  const auth = getAuth();
  const token = auth?.token;

  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const fetchMe = useCallback(async () => {
    if (!token) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });

      if (res.status === 401 || res.status === 403) {
        // token invalid
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      const json = await res.json(); // ✅ IMPORTANT
      // ✅ handle multiple response shapes
      const user =
        json?.user || json?.data?.user || json?.data || json?.me || null;

      const role = user?.role;

      setIsAdmin(role === "admin");
      setLoading(false);

      // optional: sync role back to localStorage
      const prev = getAuth();
      if (prev?.user && role && prev.user.role !== role) {
        localStorage.setItem(
          "userInfo",
          JSON.stringify({ ...prev, user: { ...prev.user, role } })
        );
      }
    } catch (e) {
      setIsAdmin(false);
      setLoading(false);
    } finally {
      clearTimeout(timeoutId);
    }
  }, [token]);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  // ✅ polling (realtime-ish)
  useEffect(() => {
    if (!token) return;
    const onFocus = () => fetchMe();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [token, fetchMe]);

  if (!token) {
    return <Navigate to={fallbackTo} replace state={{ from: location }} />;
  }

  if (loading) {
    return null;
  }

  if (!isAdmin) {
    return <Navigate to="/404" replace state={{ from: location }} />;
  }

  return <Outlet />;
};

export default AdminGate;
