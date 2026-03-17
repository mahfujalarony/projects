const express = require("express");
const router = express.Router();

const {
  getMerchantRequests,
  approveMerchant,
  suspendMerchant,
  resumeMerchant,
  deleteAdminProduct,
  rejectMerchant,
  getAdminProducts,
  getProductFilters,
} = require("../controllers/AdminController");

const {
  setSubAdminPermissions,
  getSubAdminPermissions,      
  getSubAdminList,   
} = require("../controllers/subAdminController");

const {
  getSettings,
  updateSettings,
} = require("../controllers/settingController");
const { getHistory } = require("../controllers/adminHistoryController");

// admin only
const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    res.status(403).json({ message: "Admin access required" });
  }
};

const requireAdminOrSubAdminPermission = require("../middleware/requireAdminOrSubAdminPermission");

const protect = require("../middleware/Middleware");

router.get("/products", protect, requireAdminOrSubAdminPermission(), getAdminProducts);
router.get("/products/categories", protect, requireAdminOrSubAdminPermission(), getProductFilters);
router.get("/merchants/requests", protect, requireAdminOrSubAdminPermission("manage_merchant"), getMerchantRequests);
router.patch("/merchants/:id/approve", protect, requireAdminOrSubAdminPermission("manage_merchant"), approveMerchant);
router.patch("/merchants/:id/reject", protect, requireAdminOrSubAdminPermission("manage_merchant"), rejectMerchant);
router.patch("/merchants/:id/suspend", protect, requireAdminOrSubAdminPermission("manage_merchant"), suspendMerchant);
router.patch("/merchants/:id/resume", protect, requireAdminOrSubAdminPermission("manage_merchant"), resumeMerchant);
router.delete("/products/:id", protect, requireAdminOrSubAdminPermission(), deleteAdminProduct);

//  subadmin permission control
router.get("/subadmins", protect, adminOnly, getSubAdminList);
router.get("/subadmins/:id/permissions", protect, adminOnly, getSubAdminPermissions);
router.put("/subadmins/:id/permissions", protect, adminOnly, setSubAdminPermissions);

//  Settings Routes (GET public for checkout, PUT admin only)
router.get("/settings", protect, requireAdminOrSubAdminPermission(), getSettings);
router.put("/settings", protect, requireAdminOrSubAdminPermission(), updateSettings);
router.get("/history", protect, requireAdminOrSubAdminPermission(), getHistory);

module.exports = router;
