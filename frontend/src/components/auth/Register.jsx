import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { message } from "antd";
import { useDispatch, useSelector } from "react-redux";
import { GoogleLogin, GoogleOAuthProvider } from "@react-oauth/google";
import { CustomerServiceOutlined, ArrowRightOutlined } from "@ant-design/icons";
import { UploadCloud, Eye, EyeOff } from "lucide-react";
import { setAuthState } from "../../redux/authSlice.js";
import { API_BASE_URL, GOOGLE_CLIENT_ID } from "../../config/env.js";
import { UPLOAD_BASE_URL } from "../../config/env.js";

const Register = () => {
  const token = useSelector((state) => state.auth?.token);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [image, setImage] = useState(null);
  const [siteLogo, setSiteLogo] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const navigate = useNavigate();
  const dispatch = useDispatch();

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
  const passwordTooShort = String(password || "").length > 0 && String(password || "").length < 6;
  const confirmTooShort = String(confirmPassword || "").length > 0 && String(confirmPassword || "").length < 6;
  const passwordMismatch =
    String(confirmPassword || "").length > 0 && String(password || "") !== String(confirmPassword || "");

  const uploadImageToServer = async (file) => {
    const imageserverUrl = `${UPLOAD_BASE_URL}/upload/image`;
    const fd = new FormData();
    fd.append("file", file);

    const res = await fetch(imageserverUrl, { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) throw new Error(data?.message || "Image upload failed");

    const url = data?.urls?.[0] || data?.url;
    if (!url) throw new Error("Image server did not return url");

    return url;
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");

    if (!email.trim() && !phone.trim()) {
      const msg = "Please provide email or phone number";
      setError(msg);
      message.error(msg);
      return;
    }
    if (String(password || "").length < 6) {
      const msg = "Password must be at least 6 characters";
      setError(msg);
      message.error(msg);
      return;
    }
    if (password !== confirmPassword) {
      const msg = "Password and confirm password do not match";
      setError(msg);
      message.error(msg);
      return;
    }

    setLoading(true);

    try {
      let imageUrl = null;
      if (image) imageUrl = await uploadImageToServer(image);

      const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone, password, imageUrl }),
      });

      const json = await res.json();

      if (!res.ok || !json?.success) {
        throw new Error(json?.message || "Registration failed");
      }

      const user = json?.data?.user;
      const token = json?.data?.token;

      if (!token || !user) {
        throw new Error("Invalid server response (missing user/token)");
      }

      const authPayload = { user, token };

      localStorage.setItem("userInfo", JSON.stringify(authPayload));
      dispatch(setAuthState(authPayload));

      message.success(json?.message || "Account created successfully!");
      setTimeout(() => navigate("/"), 600);

      setName("");
      setEmail("");
      setPhone("");
      setPassword("");
      setConfirmPassword("");
      setImage(null);
    } catch (err) {
      setError(err.message);
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleRegister = async (credentialResponse) => {
    const credential = credentialResponse?.credential;
    if (!credential) {
      message.error("Google sign up failed (missing credential)");
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
        throw new Error(json?.message || "Google sign up failed");
      }

      const user = json?.data?.user;
      const token = json?.data?.token;
      if (!token || !user) {
        throw new Error("Invalid server response (missing user/token)");
      }

      const authPayload = { user, token };
      localStorage.setItem("userInfo", JSON.stringify(authPayload));
      dispatch(setAuthState(authPayload));

      message.success(json?.message || "Google sign up successful!");
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
          Create your account
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form onSubmit={handleRegister} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-900">
              Full Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-2 block w-full rounded-md px-3 py-1.5 border border-gray-300
                         focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600 focus:ring-offset-1 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900">
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Optional if phone is provided"
              className="mt-2 block w-full rounded-md px-3 py-1.5 border border-gray-300
                         focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600 focus:ring-offset-1 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900">
              Phone number
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Optional if email is provided"
              className="mt-2 block w-full rounded-md px-3 py-1.5 border border-gray-300
                         focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600 focus:ring-offset-1 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900">
              Password
            </label>
            <div className="mt-2 relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full rounded-md px-3 py-1.5 pr-10 border border-gray-300
                           focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600 focus:ring-offset-1 outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-2 my-auto text-gray-500 hover:text-gray-700"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {passwordTooShort ? (
              <p className="mt-1 text-xs text-red-600">Password must be at least 6 characters.</p>
            ) : null}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900">
              Confirm Password
            </label>
            <div className="mt-2 relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="block w-full rounded-md px-3 py-1.5 pr-10 border border-gray-300
                           focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600 focus:ring-offset-1 outline-none"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((v) => !v)}
                className="absolute inset-y-0 right-2 my-auto text-gray-500 hover:text-gray-700"
                aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {confirmTooShort ? (
              <p className="mt-1 text-xs text-red-600">Confirm password must be at least 6 characters.</p>
            ) : passwordMismatch ? (
              <p className="mt-1 text-xs text-red-600">Password and confirm password do not match.</p>
            ) : null}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900">
              Profile Image
            </label>
            <label
              htmlFor="profile-image-upload"
              className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-sky-300 bg-sky-50 px-3 py-3 text-sm font-medium text-sky-700 hover:bg-sky-100"
            >
              <UploadCloud size={18} />
              <span>{image ? "Change image" : "Click to upload image"}</span>
            </label>
            <input
              id="profile-image-upload"
              type="file"
              accept="image/*"
              onChange={(e) => setImage(e.target.files?.[0] || null)}
              className="sr-only"
            />
          </div>

          {image && (
            <div className="mt-2">
              <img
                src={URL.createObjectURL(image)}
                alt="Preview"
                className="h-20 w-20 object-cover rounded-full"
              />
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full justify-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white
                       hover:bg-indigo-500 disabled:opacity-60"
          >
            {loading ? "Creating account..." : "Sign up"}
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
                      onSuccess={handleGoogleRegister}
                      onError={() => message.error("Google sign up popup failed")}
                      useOneTap={false}
                      text="signup_with"
                      locale="en"
                      width={320}
                    />
                  </GoogleOAuthProvider>
                </div>
              ) : (
                <p className="text-xs text-amber-700 text-center">
                  Google sign up disabled. Set `VITE_GOOGLE_CLIENT_ID`.
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
            Already have an account?
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="ml-2 inline-flex items-center gap-1 font-semibold text-indigo-600 hover:text-indigo-500"
            >
              Sign in <ArrowRightOutlined />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
