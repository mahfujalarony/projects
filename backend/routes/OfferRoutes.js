// routes/offerRoutes.js
const router = require("express").Router();
const offerCtrl = require("../controllers/OfferController");
const protect = require("../middleware/Middleware");

router.get("/", offerCtrl.getPublicOffers);
router.get("/admin", protect, offerCtrl.adminListOffers);
router.post("/admin", protect, offerCtrl.adminCreateOffer);
router.put("/admin/:id", protect, offerCtrl.adminUpdateOffer);
router.delete("/admin/:id", protect, offerCtrl.adminDeleteOffer);

module.exports = router;
