const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/MearchantController");
const protect = require("../middleware/Middleware");
const requireApprovedActiveMerchant = require("../middleware/requireApprovedActiveMerchant");

router.post("/register", protect, ctrl.merchantRegister);
router.get("/me", protect, ctrl.getMyMerchantProfile);
router.get("/me/balance", protect, requireApprovedActiveMerchant, ctrl.getMyBalance);
router.get("/admin-products", protect, requireApprovedActiveMerchant, ctrl.getAdminProductsForMerchant);
router.get("/admin-products/:id", protect, requireApprovedActiveMerchant, ctrl.getAdminProductDetails);
router.post("/store/pick", protect, requireApprovedActiveMerchant, ctrl.pickFromAdminToMerchantStore);
router.get("/store", protect, requireApprovedActiveMerchant, ctrl.getMyStore);
router.patch("/store/:id", protect, requireApprovedActiveMerchant, ctrl.updateMyStoreProduct);
router.get("/orders", protect, requireApprovedActiveMerchant, ctrl.getMerchantOrders);
router.get("/stats/top-products", protect, requireApprovedActiveMerchant, ctrl.getTopSellingProducts);
router.get("/stats/overview", protect, requireApprovedActiveMerchant, ctrl.getMerchantDashboardOverview);
router.post("/apply", protect, ctrl.applyForMerchant);
router.get('/:id/storefront', ctrl.getMerchantStorefront);

module.exports = router;
