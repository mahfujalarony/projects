import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  connected: false,
  onlineUserIds: [],
  conversationUnreadMap: {},
  totalUnreadCount: 0,
};

const chatSlice = createSlice({
  name: "chat",
  initialState,
  reducers: {
    setChatConnected: (state, action) => {
      state.connected = !!action.payload;
    },
    setOnlineUserIds: (state, action) => {
      state.onlineUserIds = Array.isArray(action.payload) ? action.payload.map(String) : [];
    },
    upsertOnlineUser: (state, action) => {
      const { userId, online } = action.payload || {};
      if (!userId) return;
      const id = String(userId);
      const exists = state.onlineUserIds.includes(id);
      if (online && !exists) state.onlineUserIds.push(id);
      if (!online && exists) state.onlineUserIds = state.onlineUserIds.filter((x) => x !== id);
    },
    setConversationUnreadMap: (state, action) => {
      const next = action.payload || {};
      state.conversationUnreadMap = next;
      state.totalUnreadCount = Object.values(next).reduce((sum, n) => sum + Number(n || 0), 0);
    },
    resetChatState: () => initialState,
  },
});

export const {
  setChatConnected,
  setOnlineUserIds,
  upsertOnlineUser,
  setConversationUnreadMap,
  resetChatState,
} = chatSlice.actions;

export default chatSlice.reducer;
