const sequelize = require("../config/db");
require("../models");

const Product = require("../models/Product");
const MerchentStore = require("../models/MerchentStore");
const Story = require("../models/Story");
const User = require("../models/Authentication");
const MerchantProfile = require("../models/MerchantProfile");
const Order = require("../models/Order");
const Offer = require("../models/Offer");
const Category = require("../models/Category");
const SubCategory = require("../models/SubCategory");
const Review = require("../models/Review");
const Wallet = require("../models/Wallet");
const MobileBanking = require("../models/MobileBanking");
const Notification = require("../models/Notification");
const AppSetting = require("../models/AppSetting");

const toArray = (value) => {
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

const normalizeUploadPath = (value) => {
  if (typeof value !== "string") return value;
  let raw = String(value || "").trim();
  if (!raw) return raw;

  if (/^https?:\/\//i.test(raw)) {
    try {
      const u = new URL(raw);
      const pathname = String(u.pathname || "").replace(/\\/g, "/");
      if (pathname.startsWith("/public/")) {
        raw = pathname;
      } else {
        return value;
      }
    } catch {
      return value;
    }
  }

  let normalized = raw.replace(/\\/g, "/").split("?")[0].trim();
  try {
    normalized = decodeURIComponent(normalized);
  } catch {}
  normalized = normalized.replace(/^\/+/, "");

  if (normalized.startsWith("public/")) {
    return `/${normalized}`;
  }
  return value;
};

const normalizeDeep = (value) => {
  if (typeof value === "string") return normalizeUploadPath(value);
  if (Array.isArray(value)) return value.map(normalizeDeep);
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = normalizeDeep(v);
    return out;
  }
  return value;
};

const stableStringify = (v) => {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
};

async function normalizeStringField(model, fieldName) {
  const rows = await model.findAll({ attributes: ["id", fieldName] });
  let updated = 0;
  for (const row of rows) {
    const before = row.get(fieldName);
    const after = normalizeUploadPath(before);
    if (before !== after) {
      row.set(fieldName, after);
      await row.save({ fields: [fieldName], validate: false, hooks: false });
      updated += 1;
    }
  }
  return updated;
}

async function normalizeArrayField(model, fieldName) {
  const rows = await model.findAll({ attributes: ["id", fieldName] });
  let updated = 0;
  for (const row of rows) {
    const before = toArray(row.get(fieldName));
    const after = before.map(normalizeUploadPath);
    if (stableStringify(before) !== stableStringify(after)) {
      row.set(fieldName, after);
      await row.save({ fields: [fieldName], validate: false, hooks: false });
      updated += 1;
    }
  }
  return updated;
}

async function normalizeJsonField(model, fieldName) {
  const rows = await model.findAll({ attributes: ["id", fieldName] });
  let updated = 0;
  for (const row of rows) {
    const before = row.get(fieldName);
    const after = normalizeDeep(before);
    if (stableStringify(before) !== stableStringify(after)) {
      row.set(fieldName, after);
      await row.save({ fields: [fieldName], validate: false, hooks: false });
      updated += 1;
    }
  }
  return updated;
}

async function run() {
  const summary = [];

  summary.push(["Product.images", await normalizeArrayField(Product, "images")]);
  summary.push(["MerchentStore.images", await normalizeArrayField(MerchentStore, "images")]);
  summary.push(["Story.mediaUrls", await normalizeArrayField(Story, "mediaUrls")]);
  summary.push(["Authentication.imageUrl", await normalizeStringField(User, "imageUrl")]);
  summary.push(["MerchantProfile.idFrontImage", await normalizeStringField(MerchantProfile, "idFrontImage")]);
  summary.push(["MerchantProfile.idBackImage", await normalizeStringField(MerchantProfile, "idBackImage")]);
  summary.push(["Order.imageUrl", await normalizeStringField(Order, "imageUrl")]);
  summary.push(["Offer.imageUrl", await normalizeStringField(Offer, "imageUrl")]);
  summary.push(["Category.imageUrl", await normalizeStringField(Category, "imageUrl")]);
  summary.push(["Category.icon", await normalizeStringField(Category, "icon")]);
  summary.push(["SubCategory.imageUrl", await normalizeStringField(SubCategory, "imageUrl")]);
  summary.push(["Review.images", await normalizeArrayField(Review, "images")]);
  summary.push(["Wallet.imgUrl", await normalizeStringField(Wallet, "imgUrl")]);
  summary.push(["MobileBanking.imgUrl", await normalizeStringField(MobileBanking, "imgUrl")]);
  summary.push(["Notification.meta", await normalizeJsonField(Notification, "meta")]);

  const appSettings = await AppSetting.findAll({ attributes: ["key", "value"] });
  let settingsUpdated = 0;
  for (const row of appSettings) {
    const raw = row.get("value");
    let parsed = raw;
    let parsedAsJson = false;
    if (typeof raw === "string") {
      try {
        parsed = JSON.parse(raw);
        parsedAsJson = true;
      } catch {}
    }
    const normalized = normalizeDeep(parsed);
    const nextValue = parsedAsJson ? JSON.stringify(normalized) : normalizeUploadPath(String(raw || ""));
    if (String(raw) !== String(nextValue)) {
      row.set("value", nextValue);
      await row.save({ fields: ["value"], validate: false, hooks: false });
      settingsUpdated += 1;
    }
  }
  summary.push(["AppSetting.value", settingsUpdated]);

  const total = summary.reduce((sum, [, count]) => sum + Number(count || 0), 0);
  console.log("Media path normalization completed.");
  for (const [name, count] of summary) {
    console.log(`- ${name}: ${count}`);
  }
  console.log(`Total updated rows: ${total}`);
}

run()
  .then(async () => {
    await sequelize.close();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("Failed to normalize media paths:", err?.message || err);
    await sequelize.close();
    process.exit(1);
  });
