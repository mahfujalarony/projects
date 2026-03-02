import React, { useCallback, useEffect, useRef, useState } from "react";
import { Result, Button, message as antdMessage } from "antd";
import { useNavigate, Outlet } from "react-router-dom";
import NewMarchentForm from "../pages/Marchant/OtherComponent/NewMarchentForm";
import { API_BASE_URL, CHAT_BASE_URL } from "../config/env";

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
  const [supportContact, setSupportContact] = useState({ email: "", whatsapp: "" });

  const navigate = useNavigate();
  const loadedOnceRef = useRef(false);

  const openSupportChat = useCallback(async () => {
    const token = getToken();
    if (!token) {
      antdMessage.error("Please log in first.");
      navigate("/login");
      return;
    }

    try {
      const res = await fetch(`${CHAT_BASE_URL}/api/chat/conversations/open`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });

      const json = await res.json().catch(() => null);
      const conversationId = json?.conversation?.id;

      if (!res.ok || !json?.success || !conversationId) {
        throw new Error(json?.message || "Unable to open support chat.");
      }

      navigate(`/chats/${conversationId}`);
    } catch (error) {
      antdMessage.error(error?.message || "Unable to open support chat.");
    }
  }, [navigate]);

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

        return m;
      } catch (e) {
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
    };
  }, [fetchMerchant]);

  useEffect(() => {
    let ignore = false;

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/settings`);
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.success || ignore) return;

        const email = String(json?.data?.supportEmail || "").trim();
        const whatsapp = String(json?.data?.supportWhatsapp || "").trim();
        if (!ignore) setSupportContact({ email, whatsapp });
      } catch {
        // keep empty fallback
      }
    })();

    return () => {
      ignore = true;
    };
  }, []);

  // ✅ Initial full screen loading only once
  if (initialLoading) {
    return null;
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
          subTitle="Admin approval is required. Use Refresh or re-focus this tab to check latest status."
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

  if (merchant.isSuspended) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
        <Result
          status="warning"
          title="Merchant account suspended"
          subTitle={
            <div>
              <div>
                {merchant.suspendMessage ||
                  "Your merchant account has been suspended. If you want to restore your account access, please contact support. Your previous data can be recovered after verification."}
              </div>
              {supportContact.email ? <div style={{ marginTop: 8 }}>Support Email: {supportContact.email}</div> : null}
              {supportContact.whatsapp ? <div>Support WhatsApp: {supportContact.whatsapp}</div> : null}
            </div>
          }
          extra={[
            <Button key="chat" type="primary" onClick={openSupportChat}>
              Open Support Chat
            </Button>,
            <Button key="refresh" type="primary" onClick={() => fetchMerchant(false)}>
              Refresh
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
