import React, { useCallback, useEffect, useRef, useState } from "react";
import { Spin, Result, Button } from "antd";
import { useNavigate, Outlet } from "react-router-dom";
import NewMarchentForm from "../pages/Marchant/OtherComponent/NewMarchentForm";
import { API_BASE_URL } from "../config/env";

const API_BASE = API_BASE_URL;

const safeJson = (s, fallback = null) => {
  try {
    return JSON.parse(s);
  } catch {
    return fallback;
  }
};

const getToken = () => safeJson(localStorage.getItem("userInfo"), null)?.token || null;

const MerchantDashboardGate = () => {
  const [merchant, setMerchant] = useState(null); // MerchantProfile row OR null
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [serverError, setServerError] = useState("");

  const navigate = useNavigate();
  const pollingIdRef = useRef(null);
  const loadedOnceRef = useRef(false);

  const stopPolling = () => {
    if (pollingIdRef.current) {
      clearInterval(pollingIdRef.current);
      pollingIdRef.current = null;
    }
  };

  const startPollingIfPending = (m) => {
    stopPolling();
    if (m && m.status === "pending" && !m.isApproved) {
      pollingIdRef.current = setInterval(() => {
        fetchMerchant(true);
      }, 60000); // ✅ 60s
    }
  };

  const fetchMerchant = useCallback(
    async (isBackground = false) => {
      const token = getToken();
      if (!token) {
        navigate("/login");
        return null;
      }

      // ✅ only initial load shows full page loading
      if (!loadedOnceRef.current) setInitialLoading(true);
      else if (isBackground) setRefreshing(true);

      setServerError("");

      try {
        const res = await fetch(`${API_BASE}/api/merchant/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const json = await res.json().catch(() => ({}));

        // expected: { success:true, data:{ merchant } }
        if (!res.ok) {
          // যদি backend এখনো 404 দেয়, সেটাকেও "no request" হিসেবে ধরতে পারো
          if (res.status === 404) {
            setMerchant(null);
            loadedOnceRef.current = true;
            return null;
          }
          throw new Error(json?.message || "Failed to load merchant status");
        }

        // allow multiple shapes:
        const m = json?.data?.merchant ?? json?.merchant ?? null;

        setMerchant(m);
        loadedOnceRef.current = true;

        // ✅ approved হলে polling বন্ধ
        if (m && (m.status === "approved" || m.isApproved)) {
          stopPolling();
        } else {
          // ✅ pending হলে polling start
          startPollingIfPending(m);
        }

        return m;
      } catch (e) {
        console.error(e);
        // initial load fail হলে UI তে error দেখাই
        if (!loadedOnceRef.current) setServerError(e.message || "Server error");
        return null;
      } finally {
        if (!loadedOnceRef.current) setInitialLoading(false);
        setRefreshing(false);
        setInitialLoading(false);
      }
    },
    [navigate]
  );

  useEffect(() => {
    // initial load
    fetchMerchant(false);

    // focus refresh (background)
    const onFocus = () => fetchMerchant(true);
    window.addEventListener("focus", onFocus);

    return () => {
      window.removeEventListener("focus", onFocus);
      stopPolling();
    };
  }, [fetchMerchant]);

  // ✅ Initial full screen loading only once
  if (initialLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Spin size="large" tip="Checking merchant status..." />
      </div>
    );
  }

  // ✅ server error screen (only when initial load fails)
  if (serverError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
        <Result
          status="error"
          title="Failed to load merchant status"
          subTitle={serverError}
          extra={[
            <Button key="retry" type="primary" onClick={() => fetchMerchant(false)}>
              Retry
            </Button>,
            <Button key="home" onClick={() => navigate("/")}>
              Go Home
            </Button>,
          ]}
        />
      </div>
    );
  }

  // ✅ no request => show apply form
  if (!merchant) {
    return <NewMarchentForm />;
  }

  // ✅ pending => wait screen
  if (merchant.status === "pending" && merchant.isApproved === false) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
        <Result
          status="info"
          title="Your merchant request is pending"
          subTitle="Admin approval is required. This page will auto-check every 60 seconds."
          extra={[
            <Button key="refresh" type="primary" onClick={() => fetchMerchant(false)}>
              Refresh Now {refreshing ? "..." : ""}
            </Button>,
            <Button key="home" onClick={() => navigate("/")}>
              Go Home
            </Button>,
          ]}
        />
      </div>
    );
  }

  // ✅ approved => allow dashboard routes
  if (merchant.status === "approved" || merchant.isApproved === true) {
    return <Outlet />;
  }

  // fallback
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
      <Result
        status="warning"
        title="Merchant access unavailable"
        subTitle="Your merchant status is not approved yet."
        extra={[
          <Button key="refresh" type="primary" onClick={() => fetchMerchant(false)}>
            Refresh
          </Button>,
        ]}
      />
    </div>
  );
};

export default MerchantDashboardGate;
