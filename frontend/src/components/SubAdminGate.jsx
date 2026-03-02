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

const SubAdminGate = ({ fallbackTo = "/login" }) => {
  const location = useLocation();
  const auth = getAuth();
  const token = auth?.token;

  const [loading, setLoading] = useState(true);
  const [isSubAdmin, setIsSubAdmin] = useState(false);

  const fetchMe = useCallback(async () => {
    if (!token) {
      setIsSubAdmin(false);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401 || res.status === 403) {
        // token invalid
        setIsSubAdmin(false);
        setLoading(false);
        return;
      }

      const json = await res.json(); // ✅ IMPORTANT
      // ✅ handle multiple response shapes
      const user =
        json?.user || json?.data?.user || json?.data || json?.me || null;

      const role = user?.role;

      setIsSubAdmin(role === "subadmin");
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
      setIsSubAdmin(false);
      setLoading(false);
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

  if (!isSubAdmin) {
    return <Navigate to="/404" replace state={{ from: location }} />;
  }

  return <Outlet />;
};

export default SubAdminGate;
