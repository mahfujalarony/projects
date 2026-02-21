const trimSlash = (v = "") => String(v || "").replace(/\/+$/, "");

export const API_BASE_URL = trimSlash(
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3001"
);

export const API_BASE_PATH = trimSlash(
  import.meta.env.VITE_API_BASE_PATH || `${API_BASE_URL}/api`
);
  
export const CHAT_BASE_URL = trimSlash(
  import.meta.env.VITE_CHAT_BASE_URL || "http://localhost:4000"
);

export const CHAT_API_BASE_URL = trimSlash(
  import.meta.env.VITE_CHAT_API_BASE_URL || `${CHAT_BASE_URL}/api/chat`
);

export const UPLOAD_BASE_URL = trimSlash(
  import.meta.env.VITE_UPLOAD_BASE_URL || "http://localhost:5001"
);

export const UPLOAD_IMAGE_URL = trimSlash(
  import.meta.env.VITE_UPLOAD_IMAGE_URL || `${UPLOAD_BASE_URL}/upload/image`
);

export const GOOGLE_CLIENT_ID = String(
  import.meta.env.VITE_GOOGLE_CLIENT_ID || ""
).trim();

export const LOCAL_BASE_MAPPINGS = [
  { from: "http://localhost:3001/api", to: API_BASE_PATH },
  { from: "http://localhost:3001", to: API_BASE_URL },
  { from: "http://localhost:4000/api/chat", to: CHAT_API_BASE_URL },
  { from: "http://localhost:4000", to: CHAT_BASE_URL },
  { from: "http://localhost:5001/upload/image", to: UPLOAD_IMAGE_URL },
  { from: "http://localhost:5001", to: UPLOAD_BASE_URL },
];

export const rewriteKnownApiUrl = (input) => {
  if (typeof input !== "string" || !input) return input;
  let out = input;
  for (const pair of LOCAL_BASE_MAPPINGS) {
    if (out.startsWith(pair.from)) {
      out = pair.to + out.slice(pair.from.length);
      break;
    }
  }
  return out;
};
