// routes/walletRoutes.js
const router = require("express").Router();
const ctrl = require("../controllers/walletController");
const protect = require("../middleware/Middleware");
const requireAdminOrSubAdminPermission = require("../middleware/requireAdminOrSubAdminPermission");

const canManageWallet = requireAdminOrSubAdminPermission("manage_wallet");

// Provider -> Wallets
router.get("/mobile-banking/:mobileBankingId/wallets", protect, canManageWallet, ctrl.listWalletsByProvider);
router.post("/mobile-banking/:mobileBankingId/wallets", protect, canManageWallet, ctrl.createWallet);

// Wallet CRUD
router.put("/wallets/:walletId", protect, canManageWallet, ctrl.updateWallet);
router.delete("/wallets/:walletId", protect, canManageWallet, ctrl.deleteWallet);

// Wallet Numbers
router.get("/wallets/:walletId/numbers", protect, canManageWallet, ctrl.listWalletNumbers);
router.post("/wallets/:walletId/numbers", protect, canManageWallet, ctrl.addWalletNumber);
router.delete("/wallet-numbers/:id", protect, canManageWallet, ctrl.deleteWalletNumber);

module.exports = router;
