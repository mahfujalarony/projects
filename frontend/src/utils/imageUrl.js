import { UPLOAD_BASE_URL } from "../config/env";

export const normalizeImageUrl = (input) => {
  if (!input) return "";

  const url = String(input).trim().replace(/\\/g, "/");
  if (!url) return "";

  if (/^(https?:)?\/\//i.test(url) || url.startsWith("data:") || url.startsWith("blob:")) {
    return url;
  }

  if (url.startsWith("/public") || url.startsWith("public/")) {
    const normalizedPath = url.startsWith("/") ? url : `/${url}`;
    return `${UPLOAD_BASE_URL}${normalizedPath}`;
  }

  return url;
};
