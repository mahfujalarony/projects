const express = require("express");
const cors = require("cors");
const sequelize = require("./config/db");
const { getSettings } = require("./controllers/settingController");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use(
  cors({
    origin: ["http://localhost:5173", "http://192.168.0.106:5173"],
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
    console.error("Database connection failed:", err);
  }
}

startServer();
