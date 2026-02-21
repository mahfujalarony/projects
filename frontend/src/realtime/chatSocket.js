import { io } from "socket.io-client";
import { CHAT_BASE_URL } from "../config/env";

const CHAT_API_BASE = CHAT_BASE_URL;

let socketRef = null;
let tokenRef = null;

export const connectChatSocket = (token) => {
  if (!token) return null;

  if (socketRef && tokenRef === token && socketRef.connected) {
    return socketRef;
  }

  if (socketRef && tokenRef !== token) {
    socketRef.disconnect();
    socketRef = null;
  }

  if (!socketRef) {
    tokenRef = token;
    socketRef = io(CHAT_API_BASE, { auth: { token } });
  }

  return socketRef;
};

export const getChatSocket = () => socketRef;

export const disconnectChatSocket = () => {
  if (socketRef) {
    socketRef.disconnect();
    socketRef = null;
    tokenRef = null;
  }
};
