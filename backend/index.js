const express = require("express");
const cors = require("cors");
const sequelize = require("./config/db");
require("./models");
const { getSettings } = require("./controllers/settingController");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow server-to-server / same-origin requests without Origin header.
      if (!origin) return callback(null, true);

      const allowList = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://192.168.0.106:5173",
      ];

      const isLocalOrLan =
        /^http:\/\/localhost(?::\d+)?$/.test(origin) ||
        /^http:\/\/127\.0\.0\.1(?::\d+)?$/.test(origin) ||
        /^http:\/\/192\.168\.\d{1,3}\.\d{1,3}(?::\d+)?$/.test(origin);

      if (allowList.includes(origin) || isLocalOrLan) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

app.get("/", (_, res) => res.send("Server is running and Database connected!"));


// ===== Public APIs =====
app.use("/api/products", require("./routes/ProductRoute"));
app.use("/api/auth", require("./routes/AuthenticationRoute"));
app.use("/api/reviews", require("./routes/reviewRoutes"));

app.use("/api/orders", require("./routes/OrderRoute"));
app.use("/api/merchant", require("./routes/MerchantRoute"));

app.use("/api/track", require("./routes/productTracking"));
app.use("/api/categories", require("./routes/categoryRoutes"));
app.use("/api/subcategories", require("./routes/subCategoryRoutes"));

app.use("/api/stories", require("./routes/storyRoutes"));
app.use("/api/mobile-banking", require("./routes/mobileBankingRoutes"));

app.use("/api/giftcards", require("./routes/GiftCardRoute"));
app.use("/api/notifications", require("./routes/NotificationRoute"));

app.use("/api", require("./routes/walletRoutes"));
app.use("/api", require("./routes/balanceTopupRoutes"));
app.get("/api/settings", getSettings);

// ===== Admin APIs =====
app.use("/api/admin", require("./routes/AdminOrderRoute"));
app.use("/api/admin", require("./routes/AdminRoute"));
app.use("/api/admin", require("./routes/AdminUserManageMent"));
app.use("/api/admin", require("./routes/adminTopupRoutes"));

app.use("/api/offers", require("./routes/OfferRoutes"));

async function dropLegacyTopupTxUniqueIndex() {
  const qi = sequelize.getQueryInterface();
  try {
    const indexes = await qi.showIndex("BalanceTopupRequests");
    const target = (indexes || []).find((idx) => {
      if (!idx?.unique) return false;
      const fields = (idx.fields || []).map((f) => f.attribute || f.name).filter(Boolean);
      return fields.length === 1 && fields[0] === "transactionId";
    });

    if (target?.name) {
      await qi.removeIndex("BalanceTopupRequests", target.name);
      console.log(`Dropped legacy unique index: ${target.name}`);
    }
  } catch (err) {
    console.warn("Topup txId unique index check skipped:", err?.message || err);
  }
}

async function ensureTopupBlockedColumn() {
  const qi = sequelize.getQueryInterface();
  try {
    const table = await qi.describeTable("Users");
    if (!table?.topupBlockedUntil) {
      await qi.addColumn("Users", "topupBlockedUntil", {
        type: sequelize.Sequelize.DATE,
        allowNull: true,
      });
      console.log("Added Users.topupBlockedUntil column");
    }
  } catch (err) {
    console.warn("Users.topupBlockedUntil column check skipped:", err?.message || err);
  }
}

async function ensureSubAdminPermissionEnumValues() {
  const qi = sequelize.getQueryInterface();
  const ENUM_VALUES = [
    "edit_products",
    "create_products",
    "manage_order",
    "manage_offer",
    "manage_catagory",
    "manage_catagoy",
    "manage_merchant",
    "manage_media_cleanup",
    "manage_users",
    "manage_support_chat",
    "manage_balance_topup",
    "manage_wallet",
  ];

  try {
    await qi.changeColumn("SubAdminPermissions", "permKey", {
      type: sequelize.Sequelize.ENUM(...ENUM_VALUES),
      allowNull: false,
    });
  } catch (err) {
    console.warn("SubAdminPermissions.permKey enum update skipped:", err?.message || err);
  }
}

async function ensureSubCategoryTreeColumn() {
  const qi = sequelize.getQueryInterface();
  try {
    const table = await qi.describeTable("SubCategories");
    if (!table?.parentSubCategoryId) {
      await qi.addColumn("SubCategories", "parentSubCategoryId", {
        type: sequelize.Sequelize.INTEGER,
        allowNull: true,
      });
      await qi.addIndex("SubCategories", ["parentSubCategoryId"]);
      console.log("Added SubCategories.parentSubCategoryId column");
    }
  } catch (err) {
    console.warn("SubCategories.parentSubCategoryId column check skipped:", err?.message || err);
  }
}

async function ensureStoryProductColumn() {
  const qi = sequelize.getQueryInterface();
  try {
    const table = await qi.describeTable("Stories");
    if (!table?.productId) {
      await qi.addColumn("Stories", "productId", {
        type: sequelize.Sequelize.INTEGER,
        allowNull: true,
      });
      await qi.addIndex("Stories", ["productId"]);
      console.log("Added Stories.productId column");
    }
  } catch (err) {
    console.warn("Stories.productId column check skipped:", err?.message || err);
  }
}

async function ensureOrderTrackingColumns() {
  const qi = sequelize.getQueryInterface();
  try {
    const table = await qi.describeTable("order_items");
    if (!table?.trackingNumber) {
      await qi.addColumn("order_items", "trackingNumber", {
        type: sequelize.Sequelize.STRING(120),
        allowNull: true,
      });
      console.log("Added order_items.trackingNumber column");
    }
    if (!table?.trackingNote) {
      await qi.addColumn("order_items", "trackingNote", {
        type: sequelize.Sequelize.STRING(255),
        allowNull: true,
      });
      console.log("Added order_items.trackingNote column");
    }
  } catch (err) {
    console.warn("order_items tracking column check skipped:", err?.message || err);
  }
}

async function startServer() {
  try {
    await sequelize.sync({ force: false });
    await ensureTopupBlockedColumn();
    await ensureSubAdminPermissionEnumValues();
    await ensureSubCategoryTreeColumn();
    await ensureStoryProductColumn();
    await ensureOrderTrackingColumns();
    await dropLegacyTopupTxUniqueIndex();
    console.log(" Database synced!");

    app.listen(PORT, () => {
      console.log(`Server running: http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("Database connection failed:", err);
  }
}

startServer();
