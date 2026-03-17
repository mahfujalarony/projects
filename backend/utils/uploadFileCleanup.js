const fs = require("fs/promises");
const path = require("path");

const UPLOAD_PROJECT_ROOT = path.resolve(__dirname, "../../upload");
const SAFE_UPLOAD_ROOTS = [
  path.resolve(UPLOAD_PROJECT_ROOT, "public"),
];

const normalizeUploadRelativePath = (value) => {
  if (!value) return null;
  let raw = String(value).trim();
  if (!raw) return null;

  if (/^https?:\/\//i.test(raw)) {
    try {
      raw = new URL(raw).pathname || "";
    } catch {
      return null;
    }
  }

  let normalized = raw.replace(/\\/g, "/").split("?")[0].replace(/^\/+/, "");
  try {
    normalized = decodeURIComponent(normalized);
  } catch {}
  if (!normalized.startsWith("public/")) return null;
  return normalized;
};

const resolveUploadFile = (value) => {
  const rel = normalizeUploadRelativePath(value);
  if (!rel) return null;
  const full = path.resolve(UPLOAD_PROJECT_ROOT, rel);
  if (!SAFE_UPLOAD_ROOTS.some((root) => full.startsWith(root))) return null;
  return { rel, full };
};

const deleteUploadFileIfSafe = async (value) => {
  const file = resolveUploadFile(value);
  if (!file) return false;
  try {
    await fs.unlink(file.full);
    return true;
  } catch (err) {
    if (err?.code === "ENOENT") return false;
    throw err;
  }
};

module.exports = {
  normalizeUploadRelativePath,
  resolveUploadFile,
  deleteUploadFileIfSafe,
};
