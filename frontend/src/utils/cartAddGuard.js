const lastAddById = new Map();

export const canAddToCart = (id, debounceMs = 10000) => {
  const key = String(id ?? "");
  if (!key) return false;
  const now = Date.now();
  const last = lastAddById.get(key) || 0;
  if (now - last < debounceMs) return false;
  lastAddById.set(key, now);
  return true;
};
