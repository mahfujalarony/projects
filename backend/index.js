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


async function startServer() {
  try {
    await sequelize.sync({ force: false });
    console.log(" Database synced!");

    app.listen(PORT, () => {
      console.log(`Server running: http://localhost:${PORT}`);
    });
  } catch (err) {

  }
}

startServer();
