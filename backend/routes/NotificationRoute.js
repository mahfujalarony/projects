const router = require("express").Router();
const protect = require("../middleware/Middleware");
const {
  getMyNotifications,
  createNotification,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearAll,
} = require("../controllers/NotificationController");

// user notifications
router.get("/", protect, getMyNotifications);
router.post("/", protect,  createNotification);
router.patch("/read-all", protect, markAllAsRead);
router.patch("/:id/read", protect, markAsRead);
router.delete("/clear-all", protect, clearAll);
router.delete("/:id", protect, deleteNotification);
 

module.exports = router;
