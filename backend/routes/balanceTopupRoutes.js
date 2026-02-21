const router = require("express").Router();
const ctrl = require("../controllers/balanceTopupController");
const protect = require("../middleware/Middleware");

// client browse options
router.get("/client/mobile-banking", protect, ctrl.clientListMobileBankings);
router.get("/client/mobile-banking/:mobileBankingId/wallets", protect, ctrl.clientListWalletsByProvider);
router.post("/balance/topup", protect , ctrl.createTopupRequest);
router.get("/balance/topup/pending", protect, ctrl.getMyPendingTopups);


module.exports = router;
