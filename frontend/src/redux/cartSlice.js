import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  items: [], // { id, name, price, imageUrl, merchantId, qty }
};


const cartSlice = createSlice({
  name: "cart",
  initialState,
  reducers: {
    addToCart: (state, action) => {
      const { id, name, price, imageUrl, merchantId, merchant, qty = 1, stock } = action.payload;
      const numericPrice = Number(price);
      const numericQty = Number(qty);
      const maxStock = Number(stock);
      const hasStock = Number.isFinite(maxStock) && maxStock > 0;

      if (!Number.isFinite(numericPrice) || numericPrice < 0) return;
      
      const existing = state.items.find((it) => it.id === id);
      if (existing) {
        const nextQty = existing.qty + numericQty;
        existing.qty = hasStock ? Math.min(nextQty, maxStock) : nextQty;
        if (hasStock) existing.stock = maxStock;
      } else {
        state.items.push({ 
          id, 
          name, 
          price: numericPrice,
          imageUrl, 
          merchantId: merchantId,
          qty: hasStock ? Math.min(numericQty, maxStock) : numericQty,
          ...(hasStock ? { stock: maxStock } : {}),
        });
      }
    },
    updateQty: (state, action) => {
      const { id, qty } = action.payload;
      const existing = state.items.find((it) => it.id === id);
      if (existing && qty > 0) {
        const nextQty = Number(qty);
        const maxStock = Number(existing.stock);
        const hasStock = Number.isFinite(maxStock) && maxStock > 0;
        existing.qty = hasStock ? Math.min(nextQty, maxStock) : nextQty;
      }
    },
    removeFromCart: (state, action) => {
      const { id } = action.payload;
      state.items = state.items.filter((it) => it.id !== id);
    },
    clearCart: (state) => {
      state.items = [];
    },
  },
});

export const { addToCart, updateQty, removeFromCart, clearCart } = cartSlice.actions;
export default cartSlice.reducer;
