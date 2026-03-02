const fs = require("fs/promises");
const path = require("path");
const Product = require("../models/Product");
const MerchentStore = require("../models/MerchentStore");
const Story = require("../models/Story");
const User = require("../models/Authentication");
const MerchantProfile = require("../models/MerchantProfile");
const OrderItem = require("../models/Order");
const Offer = require("../models/Offer");
const Category = require("../models/Category");
const SubCategory = require("../models/SubCategory");
const Review = require("../models/Review");
const Wallet = require("../models/Wallet");
const MobileBanking = require("../models/MobileBanking");
const Notification = require("../models/Notification");
const AppSetting = require("../models/AppSetting");

const UPLOAD_PROJECT_ROOT = path.resolve(__dirname, "../../upload");
const UPLOADS_ROOT = path.resolve(UPLOAD_PROJECT_ROOT, "uploads");
const IMAGES_ROOT = path.resolve(UPLOADS_ROOT, "images");

const toPosix = (v) => String(v || "").replace(/\\/g, "/");

const parseArray = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const visitStringsDeep = (value, cb) => {
  if (value == null) return;
  if (typeof value === "string") {
    cb(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) visitStringsDeep(item, cb);
    return;
  }
  if (typeof value === "object") {
    for (const v of Object.values(value)) visitStringsDeep(v, cb);
  }
};

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

  const normalized = toPosix(raw).split("?")[0].replace(/^\/+/, "");
  let out = normalized;
  try {
    out = decodeURIComponent(out);
  } catch {}
  out = out.replace(/^upload\/+/, "uploads/");
  if (!out.startsWith("uploads/")) return null;
  return out;
};

const safeResolveFromRelative = (relativePath) => {
  const rel = normalizeUploadRelativePath(relativePath);
  if (!rel) return null;
  const full = path.resolve(UPLOAD_PROJECT_ROOT, rel);
  if (!full.startsWith(UPLOADS_ROOT)) return null;
  return { rel, full };
};

async function walkFiles(dir) {
  const out = [];
  let entries = [];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (err?.code === "ENOENT") return out;
    throw err;
  }

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walkFiles(full)));
    } else if (entry.isFile()) {
      out.push(full);
    }
  }
  return out;
}

async function collectUsedImagePaths() {
  const [
    products,
    merchantProducts,
    stories,
    users,
    merchants,
    orders,
    offers,
    categories,
    subCategories,
    reviews,
    wallets,
    mobileBankings,
    notifications,
    appSettings,
  ] = await Promise.all([
    Product.findAll({ attributes: ["images"], raw: true }),
    MerchentStore.findAll({ attributes: ["images"], raw: true }),
    Story.findAll({ attributes: ["mediaUrls"], raw: true }),
    User.findAll({ attributes: ["imageUrl"], raw: true }),
    MerchantProfile.findAll({ attributes: ["idFrontImage", "idBackImage"], raw: true }),
    OrderItem.findAll({ attributes: ["imageUrl"], raw: true }),
    Offer.findAll({ attributes: ["imageUrl"], raw: true }),
    Category.findAll({ attributes: ["imageUrl", "icon"], raw: true }),
    SubCategory.findAll({ attributes: ["imageUrl"], raw: true }),
    Review.findAll({ attributes: ["images"], raw: true }),
    Wallet.findAll({ attributes: ["imgUrl"], raw: true }),
    MobileBanking.findAll({ attributes: ["imgUrl"], raw: true }),
    Notification.findAll({ attributes: ["meta"], raw: true }),
    AppSetting.findAll({ attributes: ["key", "value"], raw: true }),
  ]);

  const used = new Set();

  for (const row of products) {
    for (const img of parseArray(row.images)) {
      const rel = normalizeUploadRelativePath(img);
      if (rel) used.add(rel);
    }
  }
  for (const row of merchantProducts) {
    for (const img of parseArray(row.images)) {
      const rel = normalizeUploadRelativePath(img);
      if (rel) used.add(rel);
    }
  }
  for (const row of stories) {
    for (const img of parseArray(row.mediaUrls)) {
      const rel = normalizeUploadRelativePath(img);
      if (rel) used.add(rel);
    }
  }
  for (const row of users) {
    const rel = normalizeUploadRelativePath(row.imageUrl);
    if (rel) used.add(rel);
  }
  for (const row of merchants) {
    for (const key of ["idFrontImage", "idBackImage"]) {
      const rel = normalizeUploadRelativePath(row[key]);
      if (rel) used.add(rel);
    }
  }
  for (const row of orders) {
    const rel = normalizeUploadRelativePath(row.imageUrl);
    if (rel) used.add(rel);
  }
  for (const row of offers) {
    const rel = normalizeUploadRelativePath(row.imageUrl);
    if (rel) used.add(rel);
  }
  for (const row of categories) {
    for (const key of ["imageUrl", "icon"]) {
      const rel = normalizeUploadRelativePath(row[key]);
      if (rel) used.add(rel);
    }
  }
  for (const row of subCategories) {
    const rel = normalizeUploadRelativePath(row.imageUrl);
    if (rel) used.add(rel);
  }
  for (const row of reviews) {
    for (const img of parseArray(row.images)) {
      const rel = normalizeUploadRelativePath(img);
      if (rel) used.add(rel);
    }
  }
  for (const row of wallets) {
    const rel = normalizeUploadRelativePath(row.imgUrl);
    if (rel) used.add(rel);
  }
  for (const row of mobileBankings) {
    const rel = normalizeUploadRelativePath(row.imgUrl);
    if (rel) used.add(rel);
  }
  for (const row of notifications) {
    visitStringsDeep(row.meta, (s) => {
      const rel = normalizeUploadRelativePath(s);
      if (rel) used.add(rel);
    });
  }
  for (const row of appSettings) {
    let parsed = row?.value;
    if (typeof parsed === "string") {
      try {
        parsed = JSON.parse(parsed);
      } catch {
        parsed = row.value;
      }
    }
    visitStringsDeep(parsed, (s) => {
      const rel = normalizeUploadRelativePath(s);
      if (rel) used.add(rel);
    });
  }

  return used;
}

async function scanOrphanImages({ minAgeMinutes = 30 } = {}) {
  const used = await collectUsedImagePaths();
  const files = await walkFiles(IMAGES_ROOT);
  const now = Date.now();
  const minAgeMs = Math.max(0, Number(minAgeMinutes || 0)) * 60 * 1000;
  const orphans = [];

  for (const full of files) {
    const stat = await fs.stat(full);
    const rel = toPosix(path.relative(UPLOAD_PROJECT_ROOT, full));
    const ageMs = now - new Date(stat.mtime).getTime();

    if (!rel.startsWith("uploads/")) continue;
    if (used.has(rel)) continue;
    if (ageMs < minAgeMs) continue;

    orphans.push({
      path: rel,
      name: path.basename(full),
      size: Number(stat.size || 0),
      modifiedAt: stat.mtime,
    });
  }

  orphans.sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime());
  return { orphans, usedCount: used.size };
}

exports.getOrphanImages = async (req, res) => {
  try {
    const minAgeMinutes = Math.max(Number(req.query.minAgeMinutes || 30), 0);
    const { orphans, usedCount } = await scanOrphanImages({ minAgeMinutes });

    const totalBytes = orphans.reduce((sum, x) => sum + Number(x.size || 0), 0);
    return res.json({
      success: true,
      data: {
        items: orphans,
        summary: {
          totalFiles: orphans.length,
          totalBytes,
          usedRefs: usedCount,
          minAgeMinutes,
        },
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to scan orphan images" });
  }
};

exports.deleteOrphanImages = async (req, res) => {
  try {
    const minAgeMinutes = Math.max(Number(req.body?.minAgeMinutes || 30), 0);
    const selectedPaths = Array.isArray(req.body?.paths)
      ? req.body.paths.map((p) => String(p || "")).filter(Boolean)
      : null;

    const { orphans } = await scanOrphanImages({ minAgeMinutes });
    const orphanSet = new Set(orphans.map((x) => x.path));
    const targetPaths = selectedPaths?.length
      ? selectedPaths.filter((p) => orphanSet.has(p))
      : Array.from(orphanSet);

    let deleted = 0;
    const skipped = [];

    for (const rel of targetPaths) {
      const resolved = safeResolveFromRelative(rel);
      if (!resolved) {
        skipped.push({ path: rel, reason: "Invalid path" });
        continue;
      }

      try {
        await fs.unlink(resolved.full);
        deleted += 1;
      } catch (err) {
        if (err?.code === "ENOENT") {
          skipped.push({ path: rel, reason: "Already missing" });
        } else {
          skipped.push({ path: rel, reason: err.message || "Delete failed" });
        }
      }
    }

    return res.json({
      success: true,
      message: "Cleanup completed",
      data: {
        requested: targetPaths.length,
        deleted,
        skipped,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to delete orphan images" });
  }
};
