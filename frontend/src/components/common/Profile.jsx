import React, { useEffect, useMemo, useState } from "react";
import { message } from "antd";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { setAuthState } from "../../redux/authSlice";
import { UPLOAD_BASE_URL } from "../../config/env";
import { API_BASE_URL } from "../../config/env";
import { normalizeImageUrl } from "../../utils/imageUrl";

const API_BASE = API_BASE_URL;
const UPLOAD_URL = `${UPLOAD_BASE_URL}/upload/image?scope=profiles`;

const safeJson = (v, fallback = null) => {
  try {
    return JSON.parse(v);
  } catch {
    return fallback;
  }
};

const getSavedAuth = () => safeJson(localStorage.getItem("userInfo"), null); // { user, token }

const Profile = () => {
  const [profile, setProfile] = useState(null);
  const [ordersCount, setOrdersCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageSaving, setImageSaving] = useState(false);

  const navigate = useNavigate();
  const dispatch = useDispatch();

  // scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // ✅ 1) useSelector MUST be here (top-level)
  const cartState = useSelector((state) => state.cart);
  const cartCount = useMemo(() => {
    const items =
      cartState?.items ||
      cartState?.cartItems ||
      (Array.isArray(cartState) ? cartState : null) ||
      [];

    if (!Array.isArray(items)) return 0;

    return items.reduce(
      (sum, it) => sum + Number(it?.qty ?? it?.quantity ?? 1),
      0
    );
  }, [cartState]);

  const stats = useMemo(
    () => ({
      orders: ordersCount,
      cartItems: cartCount,
    }),
    [ordersCount, cartCount]
  );

  useEffect(() => {
    const loadAll = async () => {
      try {
        const saved = getSavedAuth();
        const token = saved?.token;

        if (!token) {
          message.error("You are not logged in");
          setProfile(null);
          return;
        }

        // 1) Load profile (real)
        const res = await fetch(`${API_BASE}/api/auth/me`, {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
        });

        const json = await res.json().catch(() => null);

        if (!res.ok || !json?.success) {
          throw new Error(json?.message || "Failed to load profile");
        }

        const user = json?.data?.user;
        if (!user) throw new Error("Invalid server response (missing user)");
        setProfile(user);

        // 2) Load orders count
        try {
          const or = await fetch(`${API_BASE}/api/orders/my`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          const oj = await or.json().catch(() => null);

          if (or.ok) {
            const arr =
              oj?.data?.orders ||
              oj?.orders ||
              oj?.data ||
              (Array.isArray(oj) ? oj : null);

            if (Array.isArray(arr)) setOrdersCount(arr.length);
            else if (typeof oj?.data?.count === "number")
              setOrdersCount(oj.data.count);
            else setOrdersCount(0);
          } else {
            setOrdersCount(0);
          }
        } catch {
          setOrdersCount(0);
        }
      } catch (err) {
        message.error(err?.message || "Something went wrong");
      } finally {
        setLoading(false);
      }
    };

    loadAll();
  }, []);

  const isMerchant = profile?.role === "merchant";
  const isAdmin = profile?.role === "admin";

  const goAddBalance = () => navigate("/add-balance");
  const goOrders = () => navigate("/orders");
  const goCart = () => navigate("/checkout");
  const handleBecomeMerchant = () => navigate("/merchant");

  // ✅ NEW: Gift Cards page navigate
  const goGiftCards = () => navigate("/profile/my-giftcards");

  const handleProfileImageChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const saved = getSavedAuth();
    const token = saved?.token;
    if (!token) {
      message.error("Please login first");
      return;
    }

    try {
      setImageUploading(true);
      const fd = new FormData();
      fd.append("file", file);

      const upRes = await fetch(UPLOAD_URL, { method: "POST", body: fd });
      const upJson = await upRes.json().catch(() => null);
      const uploadedPath = upJson?.paths?.[0];
      if (!upRes.ok || !uploadedPath) {
        throw new Error("Image upload failed");
      }

      setImageSaving(true);
      const saveRes = await fetch(`${API_BASE}/api/auth/me/image`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ imageUrl: uploadedPath }),
      });
      const saveJson = await saveRes.json().catch(() => null);
      if (!saveRes.ok || !saveJson?.success) {
        throw new Error(saveJson?.message || "Failed to save profile image");
      }

      setProfile((prev) => ({ ...(prev || {}), imageUrl: uploadedPath }));

      const nextUser = { ...(saved?.user || {}), imageUrl: uploadedPath };
      const nextAuth = { user: nextUser, token };
      localStorage.setItem("userInfo", JSON.stringify(nextAuth));
      dispatch(setAuthState(nextAuth));

      message.success("Profile image updated");
    } catch (err) {
      message.error(err?.message || "Failed to update profile image");
    } finally {
      setImageUploading(false);
      setImageSaving(false);
      e.target.value = "";
    }
  };

  if (loading) return <div className="p-6">Loading profile...</div>;
  if (!profile) return <div className="p-6">No profile found.</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Header */}
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
            <div className="flex flex-col items-start">
              <img
                src={normalizeImageUrl(profile.imageUrl) || "https://via.placeholder.com/120?text=User"}
                alt="profile"
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border"
              />
              <div className="mt-2">
                <label className="px-3 py-1.5 rounded-lg border bg-white hover:bg-gray-50 text-xs font-medium cursor-pointer inline-block">
                  {imageUploading || imageSaving ? "Updating..." : "Change Photo"}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleProfileImageChange}
                    disabled={imageUploading || imageSaving}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            <div className="flex-1">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    {profile.name}
                  </h1>
                  <p className="text-gray-600">{profile.email}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                    Role: {profile.role}
                  </span>
                  {isAdmin && (
                    <span className="text-xs px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-100">
                      Admin Access
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={goOrders}
                  className="px-4 py-2 rounded-lg border bg-white hover:bg-gray-50 text-sm font-medium"
                >
                  Your Orders
                </button>

                <button
                  onClick={goCart}
                  className="px-4 py-2 rounded-lg border bg-white hover:bg-gray-50 text-sm font-medium"
                >
                  Cart
                </button>

                {/* ✅ NEW: Gift Cards quick button */}
                <button
                  onClick={goGiftCards}
                  className="px-4 py-2 rounded-lg border bg-white hover:bg-gray-50 text-sm font-medium"
                >
                  Gift Cards
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left */}
          <div className="lg:col-span-7 space-y-6">
            {/* Balance */}
            <div className="rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-white/80 text-sm">Available Balance</p>
                  <h2 className="text-3xl sm:text-4xl font-extrabold mt-1">
                    ${Number(profile.balance || 0).toFixed(2)}
                  </h2>
                  <p className="text-white/80 text-sm mt-2">
                    Use balance for faster checkout & special offers.
                  </p>
                </div>

                <button
                  onClick={goAddBalance}
                  className="bg-white text-indigo-700 px-4 py-2 rounded-xl text-sm font-semibold hover:opacity-95"
                >
                  Add Balance (Card)
                </button>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-3">
                <div className="bg-white/10 rounded-xl p-3">
                  <p className="text-xs text-white/80">Orders</p>
                  <p className="text-lg font-bold">{stats.orders}</p>
                </div>

                <div className="bg-white/10 rounded-xl p-3">
                  <p className="text-xs text-white/80">Cart Items</p>
                  <p className="text-lg font-bold">{stats.cartItems}</p>
                </div>

                {/* ✅ NEW: Gift Cards stat-like quick tile */}
                <button
                  onClick={goGiftCards}
                  className="bg-white/10 hover:bg-white/15 transition rounded-xl p-3 text-left"
                >
                  <p className="text-xs text-white/80">Gift Cards</p>
                  <p className="text-lg font-bold">Open</p>
                </button>
              </div>
            </div>

            {/* Activity Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl border p-5 hover:shadow-sm transition">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-gray-900">Your Orders</h3>
                  <span className="text-xs px-2 py-1 rounded-full bg-gray-100">
                    {stats.orders} total
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  Track orders, delivery status, invoices and returns.
                </p>
                <button
                  onClick={goOrders}
                  className="mt-4 w-full rounded-xl bg-gray-900 text-white py-2 text-sm font-semibold hover:opacity-95"
                >
                  View Orders
                </button>
              </div>

              <div className="bg-white rounded-2xl border p-5 hover:shadow-sm transition sm:col-span-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-gray-900">Cart</h3>
                  <span className="text-xs px-2 py-1 rounded-full bg-gray-100">
                    {stats.cartItems} items
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  Checkout faster with saved cart items.
                </p>
                <button
                  onClick={goCart}
                  className="mt-4 w-full rounded-xl bg-indigo-600 text-white py-2 text-sm font-semibold hover:bg-indigo-500"
                >
                  Go to Cart
                </button>
              </div>

              {/* ✅ NEW: Gift Cards Card */}
              <div className="bg-white rounded-2xl border p-5 hover:shadow-sm transition sm:col-span-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-gray-900">Gift Cards</h3>
                  <span className="text-xs px-2 py-1 rounded-full bg-violet-50 text-violet-700 border border-violet-100">
                    Send • Claim • Use
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  View your received gift cards, claim new ones and check balance.
                </p>
                <button
                  onClick={goGiftCards}
                  className="mt-4 w-full rounded-xl bg-violet-600 text-white py-2 text-sm font-semibold hover:bg-violet-500"
                >
                  Open My Gift Cards
                </button>
                <p className="text-xs text-gray-500 mt-2">
                  Opens: <span className="font-semibold">/profile/my-giftcard</span>
                </p>
              </div>
            </div>
          </div>

          {/* Right */}
          <div className="lg:col-span-5 space-y-6">
            {/* Merchant Card */}
            <div className="bg-white rounded-2xl border p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">
                  {isMerchant ? "Merchant Dashboard" : "Become a Merchant"}
                </h3>
                <span className="text-xs px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                  Sell & Earn
                </span>
              </div>

              <p className="text-sm text-gray-600 mt-2">
                Start selling your products, manage inventory, and earn more from
                every sale.
              </p>

              {!isMerchant ? (
                <div className="mt-4 space-y-3">
                  <div className="rounded-xl bg-gray-50 p-4 text-sm text-gray-700">
                    ✅ Buy Admin Product for Your Shop <br />
                    ✅ Receive orders & payout <br />
                    ✅ Track earnings
                  </div>

                  <button
                    onClick={handleBecomeMerchant}
                    className="w-full rounded-xl bg-emerald-600 text-white py-2 text-sm font-semibold hover:bg-emerald-500"
                  >
                    Become a Merchant
                  </button>

                  <p className="text-xs text-gray-500">
                    (Later) Admin approval required. You will receive an email
                    once your merchant account is activated.
                  </p>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800 border border-emerald-100">
                    🎉 You are a merchant! Manage products & orders from dashboard.
                  </div>
                  <button
                    onClick={() => navigate("/merchant")}
                    className="w-full rounded-xl bg-gray-900 text-white py-2 text-sm font-semibold hover:opacity-95"
                  >
                    Open Merchant Dashboard
                  </button>
                </div>
              )}
            </div>

            {/* Add Balance CTA */}
            <div className="rounded-2xl border bg-white p-6">
              <h3 className="text-lg font-bold text-gray-900">Top up balance</h3>
              <p className="text-sm text-gray-600 mt-2">
                Add money using card and enjoy quick checkout.
              </p>
              <button
                onClick={goAddBalance}
                className="mt-4 w-full rounded-xl bg-indigo-600 text-white py-2 text-sm font-semibold hover:bg-indigo-500"
              >
                Go to Add Balance
              </button>
              <p className="text-xs text-gray-500 mt-2">
                This will open a new page:{" "}
                <span className="font-semibold">/add-balance</span>
              </p>
            </div>

            {/* ✅ Optional: Right side mini Gift Card CTA (যদি চাই) */}
            <div className="rounded-2xl border bg-white p-6">
              <h3 className="text-lg font-bold text-gray-900">Gift Cards</h3>
              <p className="text-sm text-gray-600 mt-2">
                Manage your gift cards from one place.
              </p>
              <button
                onClick={goGiftCards}
                className="mt-4 w-full rounded-xl bg-violet-600 text-white py-2 text-sm font-semibold hover:bg-violet-500"
              >
                Open Gift Cards
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
