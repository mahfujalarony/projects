import React, { useEffect, useState } from "react";
import { message } from "antd";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { GoogleLogin, GoogleOAuthProvider } from "@react-oauth/google";
import { CustomerServiceOutlined, ArrowRightOutlined } from "@ant-design/icons";
import { setAuthState } from "../../redux/authSlice.js";
import { API_BASE_URL, GOOGLE_CLIENT_ID } from "../../config/env";
import { UPLOAD_BASE_URL } from "../../config/env";

const Login = () => {
  const dispatch = useDispatch();
  const token = useSelector((state) => state.auth?.token);
  const [emailOrPhone, setEmailOrPhone] = useState("");
  const [password, setPassword] = useState("");
  const [siteLogo, setSiteLogo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    if (token) {
      navigate("/", { replace: true });
    }
  }, [token, navigate]);

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
        const res = await fetch(`${API_BASE_URL}/api/settings`);
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.success || ignore) return;
        setSiteLogo(resolveLogoSrc(json?.data?.siteLogoUrl));
      } catch {
        // no-op: keep empty logo
      }
    })();

    return () => {
      ignore = true;
    };
  }, []);

  if (token) return null;

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailOrPhone, password }),
      });

      const json = await res.json();

      if (!res.ok || !json?.success) {
        throw new Error(json?.message || "Login failed");
      }

      // ✅ backend format: { success, message, data: { user, token } }
      const user = json?.data?.user;
      const token = json?.data?.token;

      if (!token || !user) {
        throw new Error("Invalid server response (missing user/token)");
      }

      const authPayload = { user, token };

      localStorage.setItem("userInfo", JSON.stringify(authPayload));
      dispatch(setAuthState(authPayload));

      message.success(json?.message || "Login successful!");
      setTimeout(() => navigate("/"), 600);
    } catch (err) {
      setError(err.message);
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async (credentialResponse) => {
    const credential = credentialResponse?.credential;
    if (!credential) {
      message.error("Google login failed (missing credential)");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential }),
      });

      const json = await res.json();

      if (!res.ok || !json?.success) {
        throw new Error(json?.message || "Google login failed");
      }

      const user = json?.data?.user;
      const token = json?.data?.token;
      if (!token || !user) {
        throw new Error("Invalid server response (missing user/token)");
      }

      const authPayload = { user, token };
      localStorage.setItem("userInfo", JSON.stringify(authPayload));
      dispatch(setAuthState(authPayload));

      message.success(json?.message || "Google login successful!");
      setTimeout(() => navigate("/"), 600);
    } catch (err) {
      setError(err.message);
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col justify-center py-12 sm:px-6 lg:px-8 bg-gray-50">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {siteLogo ? (
          <img alt="Site Logo" src={siteLogo} className="mx-auto h-12 w-auto rounded-full" />
        ) : null}
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Sign in to your account
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-900">
              Email or phone number
            </label>
            <input
              type="text"
              required
              value={emailOrPhone}
              onChange={(e) => setEmailOrPhone(e.target.value)}
              placeholder="you@example.com or phone number"
              className="mt-2 block w-full rounded-md px-3 py-1.5 border border-gray-300
                         focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600 focus:ring-offset-1 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-2 block w-full rounded-md px-3 py-1.5 border border-gray-300
                         focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600 focus:ring-offset-1 outline-none"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full justify-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white
                       hover:bg-indigo-500 disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-white px-2 text-gray-500">Or continue with</span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-3">
              {GOOGLE_CLIENT_ID ? (
                <div className="flex justify-center">
                  <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
                    <GoogleLogin
                      onSuccess={handleGoogleLogin}
                      onError={() => message.error("Google login popup failed")}
                      useOneTap={false}
                      locale="en"
                      width={320}
                    />
                  </GoogleOAuthProvider>
                </div>
              ) : (
                <p className="text-xs text-amber-700 text-center">
                  Google login disabled. Set `VITE_GOOGLE_CLIENT_ID`.
                </p>
              )}

              <button
                type="button"
                onClick={() => navigate("/support")}
                className="flex w-full items-center justify-center gap-2 rounded-md border border-sky-300 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-700 shadow-sm hover:bg-sky-100"
              >
                <CustomerServiceOutlined />
                Contact Support
              </button>
            </div>
          </div>

          <div className="mt-6 text-center text-sm text-gray-600">
            Don't have an account?
            <button
              type="button"
              onClick={() => navigate("/register")}
              className="ml-2 inline-flex items-center gap-1 font-semibold text-indigo-600 hover:text-indigo-500"
            >
              Sign up <ArrowRightOutlined />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
