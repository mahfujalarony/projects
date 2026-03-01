import React, { Suspense, lazy, useEffect } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { useDispatch } from "react-redux";
import { setAuthState } from "./redux/authSlice.js";
import ChatSocketBridge from "./components/realtime/ChatSocketBridge.jsx";
import AdminGate from "./components/AdminGate.jsx";
import MerchantDashboardGate from "./components/MerchantDashboardGate.jsx";
import SubAdminModuleGuard from "./components/SubAdminModuleGuard.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import SubAdminGate from "./components/SubAdminGate.jsx";
import { SUBADMIN_PERMS } from "./pages/SubAdmin/permissions.js";
import { API_BASE_URL } from "./config/env";

/* ─── Lazy imports ─── */
const NotFound = lazy(() => import("./components/ui/NotFound.jsx"));
const ChatLayout = lazy(() => import("./pages/chats/ChatLayout.jsx"));
const GuestSupportChat = lazy(() => import("./pages/chats/GuestSupportChat.jsx"));

const CreateItem = lazy(() => import("./pages/Admin/OtherComponent/CreateItem.jsx"));
const Dashboard = lazy(() => import("./pages/Admin/Dashboard/Dashboard.jsx"));
const DashboardLayout = lazy(() => import("./pages/Admin/DashboardLayout.jsx"));
const MarchentJoinRequest = lazy(() => import("./pages/Admin/OtherComponent/MarchentJoinRequest.jsx"));
const Products = lazy(() => import("./pages/Admin/OtherComponent/Products.jsx"));
const Orders = lazy(() => import("./pages/Admin/OtherComponent/Orders.jsx"));
const CategoryManagement = lazy(() => import("./pages/Admin/OtherComponent/CategoryManagement.jsx"));
const AdminOffers = lazy(() => import("./pages/Admin/OtherComponent/AdminOffers.jsx"));
const SubAdminPermition = lazy(() => import("./pages/Admin/OtherComponent/SubAdminPermition.jsx"));
const Settings = lazy(() => import("./pages/Admin/OtherComponent/Settings.jsx"));
const Wallet = lazy(() => import("./pages/Admin/OtherComponent/Wallet.jsx"));
const BalanceTopup = lazy(() => import("./pages/Admin/OtherComponent/BalanceTopup.jsx"));
const MobileBankingId = lazy(() => import("./pages/Admin/OtherComponent/MobileBankingId.jsx"));
const MediaCleanup = lazy(() => import("./pages/Admin/OtherComponent/MediaCleanup.jsx"));
const UserList = lazy(() => import("./pages/Admin/OtherComponent/UserList.jsx"));

const MerchantDashboardLayout = lazy(() => import("./pages/Marchant/MarchantDashboardLayout.jsx"));
const MerchantDashboardContent = lazy(() => import("./pages/Marchant/Dashboard/MarchantDashboardContent.jsx"));
const MyStore = lazy(() => import("./pages/Marchant/OtherComponent/MyStore.jsx"));
const MyOrders = lazy(() => import("./pages/Marchant/OtherComponent/MyOrders.jsx"));
const ProductsMearchent = lazy(() => import("./pages/Marchant/OtherComponent/Products.jsx"));
const MerchantDynamicCategory = lazy(() => import("./pages/Marchant/OtherComponent/category/MerchantDynamicCategory.jsx"));
const CreateStory = lazy(() => import("./pages/Marchant/OtherComponent/CreateStory.jsx"));
const MerchantProfile = lazy(() => import("./pages/Marchant/OtherComponent/MerchantProfile.jsx"));

const Login = lazy(() => import("./features/auth/Login.jsx"));
const Register = lazy(() => import("./features/auth/Register.jsx"));
const HomeLayout = lazy(() => import("./pages/Home/HomeLayout.jsx"));
const HomeContent = lazy(() => import("./pages/Home/HomeContent.jsx"));
const Offers = lazy(() => import("./components/common/Offers.jsx"));
const Profile = lazy(() => import("./components/common/Profile.jsx"));
const UserPublicProfile = lazy(() => import("./components/common/UserPublicProfile.jsx"));
const UserOrder = lazy(() => import("./components/common/UserOrder.jsx"));
const UserCatagoryLayout = lazy(() => import("./components/catagory/UserCatagoryLayout.jsx"));
const FlashSales = lazy(() => import("./components/common/FlashSales.jsx"));
const AllProducts = lazy(() => import("./pages/Home/products/AllProducts.jsx"));
const ProductDetailsById = lazy(() => import("./pages/Home/products/ProductDetailsById.jsx"));
const Saller = lazy(() => import("./components/common/Saller.jsx"));
const Search = lazy(() => import("./components/common/Search.jsx"));
const CheckoutPage = lazy(() => import("./components/layout/CheckOutPage.jsx"));
const AddBalance = lazy(() => import("./components/common/AddBalance.jsx"));
const CreateGiftCard = lazy(() => import("./components/common/CreateGiftCard.jsx"));
const ClaimGiftCard = lazy(() => import("./components/common/ClaimGiftCard.jsx"));
const MyGiftCards = lazy(() => import("./components/common/MyGiftCards.jsx"));

const SubAdminDashboardLayout = lazy(() => import("./pages/SubAdmin/SubAdminDashboardLayout.jsx"));
const SubAdminHome = lazy(() => import("./pages/SubAdmin/SubAdminHome.jsx"));

const RouteSkeleton = () => (
  <div className="min-h-screen bg-slate-50 px-3 py-4">
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="h-10 w-56 animate-pulse rounded-xl bg-slate-200" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="h-40 animate-pulse rounded-2xl bg-slate-200 md:col-span-2" />
        <div className="h-40 animate-pulse rounded-2xl bg-slate-200" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-xl bg-slate-200" />
        ))}
      </div>
    </div>
  </div>
);

const HomeRouteSkeleton = () => (
  <div className="min-h-screen bg-gradient-to-b from-orange-50 via-amber-50 to-rose-50 px-3 py-3">
    <div className="h-0.5 w-full animate-pulse bg-gradient-to-r from-orange-400 via-rose-400 to-amber-400" />
    <div className="mt-3 h-12 animate-pulse rounded-2xl bg-white/80" />
    <div className="mt-3 flex gap-2 overflow-hidden">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-8 w-20 animate-pulse rounded-full bg-white/90" />
      ))}
    </div>
    <div className="mt-4 h-44 animate-pulse rounded-2xl bg-orange-100" />
    <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-36 animate-pulse rounded-xl bg-white/90" />
      ))}
    </div>
  </div>
);

const ProductRouteSkeleton = () => (
  <div className="min-h-screen bg-slate-50 px-3 py-4">
    <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 md:grid-cols-2">
      <div className="h-[320px] animate-pulse rounded-2xl bg-slate-200" />
      <div className="space-y-3">
        <div className="h-7 w-3/4 animate-pulse rounded bg-slate-200" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-slate-200" />
        <div className="h-5 w-1/3 animate-pulse rounded bg-slate-200" />
        <div className="h-20 animate-pulse rounded-xl bg-slate-200" />
        <div className="h-11 w-40 animate-pulse rounded-xl bg-slate-200" />
      </div>
    </div>
  </div>
);

// ─────────────────────────────────────────────
// App
// ─────────────────────────────────────────────

function App() {
  const dispatch = useDispatch();
  const location = useLocation();
  const isHomePath = location.pathname === "/";
  const isProductDetailsPath = /^\/products\/[^/]+$/.test(location.pathname);

  useEffect(() => {
    const loadUserFromToken = async () => {
      let saved = null;
      try {
        saved = JSON.parse(localStorage.getItem("userInfo") || "null");
      } catch {
        saved = null;
      }

      const savedToken = saved?.token;
      if (!savedToken) {
        localStorage.removeItem("userInfo");
        dispatch(setAuthState({ user: null, token: null }));
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${savedToken}` },
        });
        const data = await response.json();
        const user = data?.data?.user || data?.user || null;
        const tokenFromApi = data?.data?.token || savedToken;

        if (response.ok && user) {
          const authPayload = { user, token: tokenFromApi };
          dispatch(setAuthState(authPayload));
          localStorage.setItem("userInfo", JSON.stringify(authPayload));
        } else {
          dispatch(setAuthState({ user: null, token: null }));
          localStorage.removeItem("userInfo");
        }
      } catch (error) {
        console.error("Error loading user from token:", error);
        dispatch(setAuthState({ user: null, token: null }));
        localStorage.removeItem("userInfo");
      }
    };

    loadUserFromToken();
  }, [dispatch]);

  return (
    <>
      <ChatSocketBridge />

      <Suspense
        fallback={
          isHomePath ? <HomeRouteSkeleton /> : isProductDetailsPath ? null : <RouteSkeleton />
        }
      >
        <Routes>
          {/* ── Chats ── */}

          {/* ── Admin ── */}
          <Route path="/admin" element={<AdminGate />}>
            <Route path="" element={<DashboardLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="merchant-join-requests" element={<MarchentJoinRequest />} />
              <Route path="products" element={<Products />} />
              <Route path="offers" element={<AdminOffers />} />
              <Route path="orders" element={<Orders />} />
              <Route path="category-management" element={<CategoryManagement />} />
              <Route path="create-item" element={<CreateItem />} />
              <Route path="users" element={<UserList />} />
              <Route path="subadmins" element={<SubAdminPermition />} />
              <Route path="settings" element={<Settings />} />
              <Route path="wallets" element={<Wallet />} />
              <Route path="wallets/:mobileBankingId" element={<MobileBankingId />} />
              <Route path="balance-topup" element={<BalanceTopup />} />
              <Route path="media-cleanup" element={<MediaCleanup />} />
            </Route>
          </Route>

          {/* ── SubAdmin ── */}
          <Route path="/subadmin" element={<SubAdminGate />}>
            <Route path="" element={<SubAdminDashboardLayout />}>
              <Route index element={<SubAdminHome />} />
              <Route path="products" element={<SubAdminModuleGuard perm={SUBADMIN_PERMS.editProducts}><Products /></SubAdminModuleGuard>} />
              <Route path="create-item" element={<SubAdminModuleGuard perm={SUBADMIN_PERMS.createProducts}><CreateItem /></SubAdminModuleGuard>} />
              <Route path="orders" element={<SubAdminModuleGuard perm={SUBADMIN_PERMS.manageOrder}><Orders /></SubAdminModuleGuard>} />
              <Route path="offers" element={<SubAdminModuleGuard perm={SUBADMIN_PERMS.manageOffer}><AdminOffers /></SubAdminModuleGuard>} />
              <Route path="category-management" element={<SubAdminModuleGuard perm={SUBADMIN_PERMS.manageCatagory}><CategoryManagement /></SubAdminModuleGuard>} />
              <Route path="merchant-join-requests" element={<SubAdminModuleGuard perm={SUBADMIN_PERMS.manageMerchant}><MarchentJoinRequest /></SubAdminModuleGuard>} />
              <Route path="wallets" element={<SubAdminModuleGuard perm={SUBADMIN_PERMS.manageWallet}><Wallet /></SubAdminModuleGuard>} />
              <Route path="wallets/:mobileBankingId" element={<SubAdminModuleGuard perm={SUBADMIN_PERMS.manageWallet}><MobileBankingId /></SubAdminModuleGuard>} />
              <Route path="balance-topup" element={<SubAdminModuleGuard perm={SUBADMIN_PERMS.manageBalanceTopup}><BalanceTopup /></SubAdminModuleGuard>} />
              <Route path="media-cleanup" element={<SubAdminModuleGuard perm={SUBADMIN_PERMS.manageMediaCleanup}><MediaCleanup /></SubAdminModuleGuard>} />
            </Route>
          </Route>

          {/* ── Merchant ── */}
          <Route path="/merchant" element={<MerchantDashboardGate />}>
            <Route path="" element={<MerchantDashboardLayout />}>
              <Route index element={<MerchantDashboardContent />} />
              <Route path="my-store" element={<MyStore />} />
              <Route path="my-orders" element={<MyOrders />} />
              <Route path="create-story" element={<CreateStory />} />
              <Route path="my-profile" element={<MerchantProfile />} />
              <Route path="products" element={<ProductsMearchent />} />
              <Route path="products/:slug" element={<MerchantDynamicCategory />} />
            </Route>
          </Route>

          {/* ── User / Home ── */}
          <Route path="/" element={<HomeLayout />}>
            <Route path="403" element={<NotFound />} />
            <Route path="404" element={<NotFound />} />
            <Route index element={<HomeContent />} />
            <Route path="gift-card" element={<CreateGiftCard />} />
            <Route path="gift-card/claim" element={<ClaimGiftCard />} />
            <Route path="gift-card/claim/redeem" element={<ClaimGiftCard />} />
            <Route path="profile/my-giftcards" element={<MyGiftCards />} />
            <Route path="login" element={<Login />} />
            <Route path="register" element={<Register />} />
            <Route path="add-balance" element={<ProtectedRoute><AddBalance /></ProtectedRoute>} />
            <Route path="offers" element={<Offers />} />
            <Route path="profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="users/:id" element={<ProtectedRoute><UserPublicProfile /></ProtectedRoute>} />
            <Route path="orders" element={<UserOrder />} />
            <Route path="flash-sales" element={<FlashSales />} />
            <Route path="products" element={<AllProducts />} />
            <Route path="search/:query?" element={<Search />} />
            <Route path="chats/*" element={<ChatLayout />} />
            <Route path="support" element={<GuestSupportChat />} />
            <Route path="products/:id" element={<ProductDetailsById />} />
            <Route path="saller/:merchantId" element={<Saller />} />
            <Route path="checkout" element={<CheckoutPage />} />
            <Route path=":categoryName/*" element={<UserCatagoryLayout />} />
            <Route path="*" element={<NotFound />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </>
  );
}

export default App;
