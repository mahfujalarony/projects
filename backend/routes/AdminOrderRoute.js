// routes/adminOrders.js
const router = require("express").Router();
const {
  getAdminOrders,
  updateOrderStatus,
  getAdminOrderDetails
} = require("../controllers/adminOrderController");
const protect = require("../middleware/Middleware");
const requireAdminOrSubAdminPermission = require("../middleware/requireAdminOrSubAdminPermission");


router.get("/orders", protect, requireAdminOrSubAdminPermission(), getAdminOrders);
router.patch("/orders/:id/status", protect, requireAdminOrSubAdminPermission(), updateOrderStatus);
router.get("/orders/:id/details", protect, requireAdminOrSubAdminPermission(), getAdminOrderDetails);

module.exports = router;
