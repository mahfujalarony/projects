const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/MearchantController");
const protect = require("../middleware/Middleware");

router.post("/register", protect, ctrl.merchantRegister);
router.get("/me", protect, ctrl.getMyMerchantProfile);
router.get("/me/balance", protect, ctrl.getMyBalance);
router.get("/admin-products", protect, ctrl.getAdminProductsForMerchant);
router.get("/admin-products/:id", protect, ctrl.getAdminProductDetails);
router.post("/store/pick", protect, ctrl.pickFromAdminToMerchantStore);
router.get("/store", protect, ctrl.getMyStore);
router.patch("/store/:id", protect, ctrl.updateMyStoreProduct);
router.get("/orders", protect, ctrl.getMerchantOrders);
router.get("/stats/top-products", protect, ctrl.getTopSellingProducts);
router.get("/stats/overview", protect, ctrl.getMerchantDashboardOverview);
router.post("/apply", protect, ctrl.applyForMerchant);
router.get('/:id/storefront', ctrl.getMerchantStorefront);

module.exports = router;
