const express = require("express");
const router = express.Router();

const {
  getMerchantRequests,
  approveMerchant,
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
router.get("/merchants/requests", protect, requireAdminOrSubAdminPermission(), getMerchantRequests);
router.patch("/merchants/:id/approve", protect, requireAdminOrSubAdminPermission(), approveMerchant);
router.patch("/merchants/:id/reject", protect, requireAdminOrSubAdminPermission(), rejectMerchant);
router.delete("/products/:id", protect, requireAdminOrSubAdminPermission(), deleteAdminProduct);

//  subadmin permission control
router.get("/subadmins", protect, adminOnly, getSubAdminList);
router.get("/subadmins/:id/permissions", protect, adminOnly, getSubAdminPermissions);
router.put("/subadmins/:id/permissions", protect, adminOnly, setSubAdminPermissions);

//  Settings Routes (GET public for checkout, PUT admin only)
router.get("/settings", protect, requireAdminOrSubAdminPermission(), getSettings);
router.put("/settings", protect, requireAdminOrSubAdminPermission(), updateSettings);

module.exports = router;
