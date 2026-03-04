import React, { useMemo, useState } from "react";
import { Dropdown, message } from "antd";
import {
  DownOutlined,
  LogoutOutlined,
  MessageOutlined,
  UserOutlined,
  ShoppingOutlined,
  WalletOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { setAuthState } from "../../redux/authSlice.js";
import { CHAT_BASE_URL } from "../../config/env.js";
import { User } from "lucide-react";
import { normalizeImageUrl } from "../../utils/imageUrl.js";

const UserDropDown = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user, token } = useSelector((state) => state.auth);
  const cartState = useSelector((state) => state.cart);

  const [open, setOpen] = useState(false);

  const cartCount = useMemo(() => {
    const items = cartState?.items || [];
    return items.reduce((sum, it) => sum + Number(it?.qty ?? 0), 0);
  }, [cartState]);
  const balance = Number(user?.balance || 0);

  const go = (path) => {
    setOpen(false);
    navigate(path);
  };

  const logout = () => {
    setOpen(false);
    localStorage.removeItem("userInfo");
    dispatch(setAuthState({ user: null, token: null }));
    navigate("/login");
  };

  const openSupportChat = async () => {
    setOpen(false);
    if (!token) {
      message.error("Please login first");
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
        throw new Error(json?.message || "Failed to open support chat");
      }

      navigate(`/chats/${conversationId}`);
    } catch (error) {
      message.error(error?.message || "Failed to open support chat");
    }
  };

  const menu = (
    <div className="w-[min(92vw,22rem)] sm:w-80 rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden max-h-[min(78vh,34rem)] flex flex-col">
      <div className="px-4 py-4 border-b bg-gradient-to-r from-slate-50 to-blue-50">
        <div className="flex items-center gap-3">
              {user?.imageUrl ? (
                <img
                  src={normalizeImageUrl(user.imageUrl)}
                  alt={user?.name || "User"}
                  className="w-11 h-11 rounded-full object-cover border border-white shadow"
                />
              ) : (
                <div className="w-11 h-11 rounded-full bg-gray-200 flex items-center justify-center border border-white shadow">
                  <User className="w-6 h-6 text-gray-400" />
                </div>
              )}          <div className="min-w-0">
            <p className="font-semibold text-slate-900 truncate">{user?.name || "User"}</p>
            <p className="text-xs text-slate-500 truncate">{user?.email || "Signed in"}</p>
            <span className="inline-flex mt-1 mr-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 capitalize">
              {user?.role || "user"}
            </span>
            <span className="inline-flex mt-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
              Balance: {balance.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      <div className="py-2 overflow-y-auto overscroll-contain touch-pan-y">
        <MenuItem icon={<UserOutlined />} label="Profile" description="Account settings and details" onClick={() => go("/profile")} />
        <MenuItem icon={<WalletOutlined />} label="Add Balance" description="Top up your wallet" onClick={() => go("/add-balance")} />
        <MenuItem
          icon={<ShoppingOutlined />}
          label="Checkout"
          description="Review items and place order"
          badge={cartCount}
          onClick={() => go("/checkout")}
        />
        <MenuItem icon={<ShoppingOutlined />} label="My Orders" description="Track your purchases" onClick={() => go("/orders")} />
        <MenuItem icon={<ShoppingOutlined />} label="Become a Merchant" description="Open your seller dashboard" onClick={() => go("/merchant")} />
        <MenuItem icon={<MessageOutlined />} label="Support Message" description="Start a support conversation" onClick={openSupportChat} />

        <div className="my-2 border-t border-slate-100" />

        <MenuItem icon={<LogoutOutlined />} label="Log out" description="End your current session" danger onClick={logout} />
      </div>
    </div>
  );

  return (
    <Dropdown
      trigger={["click"]}
      placement="bottomRight"
      open={open}
      onOpenChange={setOpen}
      popupRender={() => menu}
    >
      <button
        type="button"
        className="flex items-center gap-2 rounded-full px-1.5 sm:px-2.5 py-1.5 hover:bg-slate-100 active:bg-slate-200 transition
                   focus:outline-none focus:ring-2 focus:ring-slate-200"
      >
        <img
          src={normalizeImageUrl(user?.imageUrl) || fallbackuserImage}
          alt={user?.name || "User"}
          className="w-9 h-9 rounded-full object-cover border border-slate-200"
        />
        <span className="hidden md:block text-sm font-medium text-slate-700 max-w-[120px] lg:max-w-[140px] truncate">
          {user?.name?.split(" ")[0] || "User"}
        </span>
        <DownOutlined className="text-xs text-slate-500 hidden md:block" />
      </button>
    </Dropdown>
  );
};

const MenuItem = ({ icon, label, description, badge, onClick, danger }) => (
  <button
    type="button"
    onClick={onClick}
    className={[
      "w-full text-left flex items-start gap-3 px-4 py-2.5 cursor-pointer select-none",
      "transition hover:bg-slate-50 active:bg-slate-100",
      danger ? "text-red-600 hover:bg-red-50 active:bg-red-100" : "text-slate-700",
    ].join(" ")}
  >
    <span className="text-base w-5 mt-0.5 flex items-center justify-center">{icon}</span>
    <span className="flex-1 min-w-0">
      <span className="text-sm font-medium block">{label}</span>
      {description ? <span className="text-xs text-slate-500 block truncate">{description}</span> : null}
    </span>

    {typeof badge === "number" && badge > 0 ? (
      <span className="bg-red-500 text-white text-[11px] font-bold px-2 py-0.5 rounded-full min-w-5 text-center">
        {badge > 99 ? "99+" : badge}
      </span>
    ) : null}
  </button>
);

export default UserDropDown;
