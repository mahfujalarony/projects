const router = require("express").Router();
const ctrl = require("../controllers/mobileBankingController");
const protect = require("../middleware/Middleware");
const requireAdminOrSubAdminPermission = require("../middleware/requireAdminOrSubAdminPermission");

const canManageWallet = requireAdminOrSubAdminPermission("manage_wallet");

router.post("/", protect, canManageWallet, ctrl.createMobileBanking);
router.get("/", protect, canManageWallet, ctrl.getAllMobileBankings);
router.get("/:id", protect, canManageWallet, ctrl.getOneMobileBanking);
router.put("/:id", protect, canManageWallet, ctrl.updateMobileBanking);
router.delete("/:id", protect, canManageWallet, ctrl.deleteMobileBanking);

module.exports = router;
