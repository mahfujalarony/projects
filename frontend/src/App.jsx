import React, { useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import { useDispatch } from "react-redux";
import { setAuthState } from "./redux/authSlice.js";
import ChatSocketBridge from "./components/realtime/ChatSocketBridge.jsx";

// 403
import Forbidden from "./components/ui/Forbidden.jsx";



/* ===================== Chats ===================== */
import ChatLayout from "./pages/chats/ChatLayout.jsx";
import GuestSupportChat from "./pages/chats/GuestSupportChat.jsx";

/* ===================== Admin ===================== */
import CreateItem from "./pages/Admin/OtherComponent/CreateItem.jsx";
import Dashboard from "./pages/Admin/Dashboard/Dashboard.jsx";
import DashboardLayout from "./pages/Admin/DashboardLayout.jsx";
import MarchentJoinRequest from "./pages/Admin/OtherComponent/MarchentJoinRequest.jsx";
import Products from "./pages/Admin/OtherComponent/Products.jsx";
import Orders from "./pages/Admin/OtherComponent/Orders.jsx";
import CategoryManagement from "./pages/Admin/OtherComponent/CategoryManagement.jsx";
import AdminOffers from "./pages/Admin/OtherComponent/AdminOffers.jsx";
import AdminGate from "./components/AdminGate.jsx";
import SubAdminPermition from "./pages/Admin/OtherComponent/SubAdminPermition.jsx";
import Settings from "./pages/Admin/OtherComponent/Settings.jsx";
import Wallet from "./pages/Admin/OtherComponent/Wallet.jsx";
import BalanceTopup from "./pages/Admin/OtherComponent/BalanceTopup.jsx";

/* ===================== Merchant ===================== */
import MerchantDashboardGate from "./components/MerchantDashboardGate.jsx";
import MerchantDashboardLayout from "./pages/Marchant/MarchantDashboardLayout.jsx";
import MerchantDashboardContent from "./pages/Marchant/Dashboard/MarchantDashboardContent.jsx";
import MyStore from "./pages/Marchant/OtherComponent/MyStore.jsx";
import MyOrders from "./pages/Marchant/OtherComponent/MyOrders.jsx";
import ProductsMearchent from "./pages/Marchant/OtherComponent/Products.jsx";
import MerchantDynamicCategory from "./pages/Marchant/OtherComponent/category/MerchantDynamicCategory.jsx";
import CreateStory from "./pages/Marchant/OtherComponent/CreateStory.jsx";
import MerchantProfile from "./pages/Marchant/OtherComponent/MerchantProfile.jsx";

/* ===================== User ===================== */
import Login from "./features/auth/Login.jsx";
import Register from "./features/auth/Register.jsx";
import HomeLayout from "./pages/Home/HomeLayout.jsx";
import HomeContent from "./pages/Home/HomeContent.jsx";
import Offers from "./components/common/Offers.jsx";
import Profile from "./components/common/Profile.jsx";
import UserPublicProfile from "./components/common/UserPublicProfile.jsx";
import UserOrder from "./components/common/UserOrder.jsx";
import UserCatagoryLayout from "./components/catagory/UserCatagoryLayout.jsx";
import FlashSales from "./components/common/FlashSales.jsx";
import AllProducts from "./pages/Home/products/AllProducts.jsx";
import ProductDetailsById from "./pages/Home/products/ProductDetailsById.jsx";
import Saller from "./components/common/Saller.jsx";
import Search from "./components/common/Search.jsx";
import CheckoutPage from "./components/layout/CheckOutPage.jsx";
import AddBalance from "./components/common/AddBalance.jsx";
import CreateGiftCard from "./components/common/CreateGiftCard.jsx";
import ClaimGiftCard from "./components/common/ClaimGiftCard.jsx";
import MyGiftCards from "./components/common/MyGiftCards.jsx";
import UserList from "./pages/Admin/OtherComponent/UserList.jsx";


/* ===================== SubAdmin ===================== */
import SubAdmin from "./pages/SubAdmin/SubAdmin.jsx";


/* ===================== Protected ===================== */
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import SubAdminGate from "./components/SubAdminGate.jsx";
import MobileBankingId from "./pages/Admin/OtherComponent/MobileBankingId.jsx";

/* ===================== API ===================== */
import { API_BASE_URL } from "./config/env";



function App() {
  const dispatch = useDispatch();

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
      <Routes>
       {/* ===================== Chats Routes ===================== */}
       <Route path="/chats/*" element={<ChatLayout />} />
       <Route path="/support" element={<GuestSupportChat />} />


      {/* ===================== Admin Routes ===================== */}
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
          <Route  path="balance-topup" element={<BalanceTopup />} />
       </Route>
      </Route>

      {/* ===================== SubAdmin Routes ===================== */}
      <Route path="/subadmin" element={<SubAdminGate />}>
        <Route path="" element={<SubAdmin />} />
      </Route>

      {/* ===================== Merchant Routes ===================== */}
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

      {/* ===================== User Routes ===================== */}
      <Route path="/" element={<HomeLayout />}>
        <Route path="403" element={<Forbidden />} />
        <Route index element={<HomeContent />} />
        <Route path="gift-card" element={<CreateGiftCard />} />
        <Route path="gift-card/claim" element={<ClaimGiftCard />} />
        <Route path="gift-card/claim/redeem" element={<ClaimGiftCard />} />
        <Route path="profile/my-giftcards" element={<MyGiftCards />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />

        <Route
          path="add-balance"
          element={
            <ProtectedRoute>
              <AddBalance />
            </ProtectedRoute>
          }
        />

        <Route path="offers" element={<Offers />} />

        <Route
          path="profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />
        <Route
          path="users/:id"
          element={
            <ProtectedRoute>
              <UserPublicProfile />
            </ProtectedRoute>
          }
        />

        <Route path="orders" element={<UserOrder />} />

        <Route path=":categoryName" element={<UserCatagoryLayout />} />
        {/* nested category routes can be added here */}
        <Route path=":categoryName/:subCategoryName" element={<UserCatagoryLayout />} />

        <Route path="flash-sales" element={<FlashSales />} />
        <Route path="products" element={<AllProducts />} />

        <Route path="search/:query?" element={<Search />} />
        <Route path="products/:id" element={<ProductDetailsById />} />
        <Route path="saller/:merchantId" element={<Saller />} />
        <Route path="checkout" element={<CheckoutPage />} />
      </Route>
      </Routes>
    </>
  );
}

export default App;
