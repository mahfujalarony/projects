import { configureStore } from "@reduxjs/toolkit";
import cartReducer from "./../cartSlice";
import authReducer from "../authSlice";
import chatReducer from "../chatSlice";

const CART_KEY_LEGACY = "cartItems";
const CART_KEY_PREFIX = "cartItems:user:";

const getSavedAuthUserId = () => {
  try {
    const saved = JSON.parse(localStorage.getItem("userInfo") || "null");
    return saved?.user?.id ?? null;
  } catch {
    return null;
  }
};

const loadCartFromLocalStorage = () => {
  try {
    const userId = getSavedAuthUserId();
    if (!userId) {
      // Don't auto-load guest cart; prevents unwanted items showing up by default.
      localStorage.removeItem(CART_KEY_LEGACY);
      return [];
    }

    const userKey = `${CART_KEY_PREFIX}${userId}`;
    const data = localStorage.getItem(userKey);
    if (data) return JSON.parse(data);

    // Migrate legacy cart if present
    const legacy = localStorage.getItem(CART_KEY_LEGACY);
    if (legacy) {
      localStorage.setItem(userKey, legacy);
      localStorage.removeItem(CART_KEY_LEGACY);
      return JSON.parse(legacy);
    }

    return [];
  } catch {
    return [];
  }
};



export const store = configureStore({
  reducer: {
    cart: cartReducer,
    auth: authReducer,
    chat: chatReducer,
  },
  preloadedState: {
    cart: {
      items: loadCartFromLocalStorage(),
    },
  },
});



store.subscribe(() => {
  try {
    const state = store.getState();
    const userId = state.auth?.user?.id ?? null;
    if (!userId) {
      // No user => don't persist cart
      localStorage.removeItem(CART_KEY_LEGACY);
      return;
    }
    localStorage.setItem(`${CART_KEY_PREFIX}${userId}`, JSON.stringify(state.cart.items));
  } catch {
    // ignore
  }
});



export const selectCartItems = (state) => state.cart.items;

export default store;
