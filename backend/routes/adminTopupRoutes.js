const router = require("express").Router();
const ctrl = require("../controllers/adminBalanceTopupController");
const protect = require("../middleware/Middleware");
const requireAdminOrSubAdminPermission = require("../middleware/requireAdminOrSubAdminPermission");

const canManageBalanceTopup = requireAdminOrSubAdminPermission("manage_balance_topup");

router.get("/topups", protect, canManageBalanceTopup, ctrl.listTopups);
router.patch("/topups/:id/approve", protect, canManageBalanceTopup, ctrl.approveTopup);
router.patch("/topups/:id/reject", protect, canManageBalanceTopup, ctrl.rejectTopup);

module.exports = router;
