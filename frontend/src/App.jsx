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

const Login = lazy(() => import("./components/auth/Login.jsx"));
const Register = lazy(() => import("./components/auth/Register.jsx"));
const HomeLayout = lazy(() => import("./pages/Home/HomeLayout.jsx"));
const HomeContent = lazy(() => import("./pages/Home/HomeContent.jsx"));
const Offers = lazy(() => import("./components/common/Offers.jsx"));
const Profile = lazy(() => import("./components/common/Profile.jsx"));
const UserPublicProfile = lazy(() => import("./components/common/UserPublicProfile.jsx"));
const UserOrder = lazy(() => import("./components/common/UserOrder.jsx"));
const UserCatagoryLayout = lazy(() => import("./components/catagory/UserCatagoryLayout.jsx"));
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

/* ─── Suspense fallback shimmer (inline — HomeContent CSS not yet loaded) ─── */
const suspenseShimmerStyle = `
@keyframes suspenseShimmer{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}
@keyframes suspenseFadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
.s-block{position:relative;overflow:hidden;background:linear-gradient(135deg,#f0f0f0,#e5e7eb);border-radius:6px}
.s-block::after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,transparent 0%,rgba(255,255,255,.6) 40%,rgba(255,255,255,.6) 60%,transparent 100%);animation:suspenseShimmer 1.6s ease-in-out infinite}
.s-fade{animation:suspenseFadeIn .35s ease-out both}
`;

const RouteSkeleton = () => (
  <div className="min-h-screen bg-slate-50 px-4 py-5">
    <style>{suspenseShimmerStyle}</style>
    <div className="mx-auto max-w-6xl space-y-5">
      {/* Header bar */}
      <div className="flex items-center gap-3">
        <div className="s-block h-9 w-9 rounded-lg" />
        <div className="s-block h-5 w-40 rounded-full" />
        <div className="ml-auto s-block h-8 w-24 rounded-full" />
      </div>
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="s-fade rounded-xl border border-gray-100 bg-white p-4 space-y-2" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="s-block h-3 w-16 rounded-full" />
            <div className="s-block h-6 w-20 rounded-lg" />
          </div>
        ))}
      </div>
      {/* Main content area */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="s-fade md:col-span-2 rounded-2xl border border-gray-100 bg-white p-4 space-y-3" style={{ animationDelay: '200ms' }}>
          <div className="s-block h-4 w-32 rounded-full" />
          <div className="s-block h-44 w-full rounded-xl" />
        </div>
        <div className="s-fade rounded-2xl border border-gray-100 bg-white p-4 space-y-3" style={{ animationDelay: '260ms' }}>
          <div className="s-block h-4 w-24 rounded-full" />
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="s-block h-8 w-8 rounded-full shrink-0" />
                <div className="flex-1 space-y-1">
                  <div className="s-block h-3 w-full rounded-full" />
                  <div className="s-block h-2.5 w-2/3 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
);

const HomeRouteSkeleton = () => (
  <div className="min-h-screen bg-gradient-to-b from-orange-50 via-rose-50 to-sky-50 overflow-hidden">
    <style>{suspenseShimmerStyle}</style>

    {/* Navbar placeholder */}
    <div className="h-14 bg-white/80 border-b border-gray-100 flex items-center px-4 gap-3">
      <div className="s-block h-8 w-8 rounded-lg" />
      <div className="s-block h-4 w-28 rounded-full" />
      <div className="flex-1" />
      <div className="s-block h-8 w-48 rounded-full hidden sm:block" />
      <div className="s-block h-8 w-8 rounded-full ml-2" />
    </div>

    <div className="px-4 md:px-6">
      {/* Stories row */}
      <div className="mt-4 mb-4 flex gap-3 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="s-fade shrink-0 w-[130px] sm:w-[170px] md:w-[190px]" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="s-block w-full aspect-[9/16] rounded-2xl" />
            <div className="s-block mt-2 h-3 w-2/3 rounded-full" />
          </div>
        ))}
      </div>

      {/* Banner */}
      <div className="s-fade mb-5 rounded-2xl overflow-hidden shadow-sm" style={{ animationDelay: '100ms' }}>
        <div className="relative h-[200px] sm:h-[290px] md:h-[370px] lg:h-[460px]" style={{ background: 'linear-gradient(135deg,#1e293b,#334155,#1e293b)' }}>
          <div className="absolute inset-x-0 bottom-0 p-4 sm:p-6 md:p-10 space-y-2.5">
            <div className="h-5 w-20 rounded-full" style={{ background: 'rgba(255,255,255,.12)' }} />
            <div className="h-8 md:h-10 w-2/3 rounded-xl" style={{ background: 'rgba(255,255,255,.10)' }} />
            <div className="h-3 w-1/2 rounded-full" style={{ background: 'rgba(255,255,255,.08)' }} />
            <div className="h-9 w-28 rounded-full mt-1" style={{ background: 'rgba(255,255,255,.12)' }} />
          </div>
        </div>
      </div>

      {/* Trending section */}
      <div className="mt-6 mb-2 flex items-end justify-between">
        <div>
          <div className="s-block h-6 w-40 rounded-lg" />
          <div className="s-block mt-1.5 h-3 w-52 rounded-full" />
        </div>
        <div className="s-block h-4 w-16 rounded-full" />
      </div>
      <div className="flex gap-4 overflow-hidden pb-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="s-fade shrink-0 w-[170px] rounded-xl border border-gray-100 bg-white overflow-hidden" style={{ animationDelay: `${i * 70}ms` }}>
            <div className="s-block h-40 w-full" style={{ borderRadius: 0 }} />
            <div className="p-3 space-y-1.5">
              <div className="s-block h-2 w-12 rounded-full" />
              <div className="s-block h-3 w-full rounded-full" />
              <div className="s-block h-3 w-3/5 rounded-full" />
              <div className="flex justify-between items-center pt-1">
                <div className="s-block h-4 w-14 rounded-full" />
                <div className="s-block h-4 w-12 rounded" />
              </div>
              <div className="s-block h-7 w-full rounded-lg mt-1" />
            </div>
          </div>
        ))}
      </div>

      {/* Our Products grid */}
      <div className="s-fade mt-4 rounded-2xl border border-white/80 bg-white/75 p-3 md:p-4" style={{ animationDelay: '200ms' }}>
        <div className="flex justify-between items-end mb-4">
          <div>
            <div className="s-block h-5 w-36 rounded-lg" />
            <div className="s-block mt-1 h-3 w-52 rounded-full" />
          </div>
          <div className="s-block h-4 w-16 rounded-full" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 md:gap-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="s-fade rounded-lg border border-gray-100 bg-white overflow-hidden" style={{ animationDelay: `${200 + i * 50}ms` }}>
              <div className="s-block h-28 md:h-32 w-full" style={{ borderRadius: 0 }} />
              <div className="p-2 space-y-1">
                <div className="s-block h-2 w-10 rounded-full" />
                <div className="s-block h-2.5 w-full rounded-full" />
                <div className="s-block h-2.5 w-2/3 rounded-full" />
                <div className="flex justify-between pt-1">
                  <div className="s-block h-3.5 w-12 rounded-full" />
                  <div className="s-block h-2.5 w-8 rounded-full" />
                </div>
                <div className="flex gap-1 mt-1">
                  <div className="s-block h-7 w-8 rounded" />
                  <div className="s-block h-7 flex-1 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
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

  // Browser tab title & favicon — backend settings থেকে
  useEffect(() => {
    const loadAppMeta = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/settings`);
        const json = await res.json();
        if (json?.success && json?.data) {
          const { siteName, siteLogoUrl } = json.data;
          if (siteName) document.title = siteName;
          if (siteLogoUrl) {
            let link = document.querySelector("link[rel~='icon']");
            if (!link) {
              link = document.createElement("link");
              link.rel = "icon";
              document.head.appendChild(link);
            }
            link.href = siteLogoUrl;
          }
        }
      } catch (err) {

      }
    };
    loadAppMeta();
  }, []);

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
