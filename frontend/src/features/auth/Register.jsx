import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { message } from "antd";
import logo from "./../../public/logo.jpg";
import { useDispatch, useSelector } from "react-redux";
import { GoogleLogin, GoogleOAuthProvider } from "@react-oauth/google";
import { setAuthState } from "../../redux/authSlice.js";
import { API_BASE_URL, GOOGLE_CLIENT_ID } from "../../config/env";
import { UPLOAD_BASE_URL } from "../../config/env";

const Register = () => {
  const token = useSelector((state) => state.auth?.token);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [image, setImage] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const navigate = useNavigate();
  const dispatch = useDispatch();

  useEffect(() => {
    if (token) {
      navigate("/", { replace: true });
    }
  }, [token, navigate]);

  if (token) return null;

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
        <img alt="Your Company" src={logo} className="mx-auto h-12 w-auto rounded-full" />
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
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-2 block w-full rounded-md px-3 py-1.5 border border-gray-300
                         focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600 focus:ring-offset-1 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900">
              Profile Image (optional)
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setImage(e.target.files?.[0] || null)}
              className="mt-2 block w-full"
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
                      width="100%"
                    />
                  </GoogleOAuthProvider>
                </div>
              ) : (
                <p className="text-xs text-amber-700 text-center">
                  Google sign up disabled. Set `VITE_GOOGLE_CLIENT_ID`.
                </p>
              )}

              <button
                onClick={() => navigate("/support")}
                className="flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
              >
                Contact Support
              </button>
            </div>
          </div>

          <p className="mt-6 text-center text-sm text-gray-600">
            Already have an account?{" "}
            <span
              onClick={() => navigate("/login")}
              className="font-medium text-indigo-600 hover:text-indigo-500 cursor-pointer"
            >
              Sign in
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
