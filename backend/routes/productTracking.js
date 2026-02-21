const router = require("express").Router();
const ctrl = require("../controllers/productTracking");

// public routes (no auth needed; but rate limit + basic protection recommended)
router.post("/view/:productId", ctrl.trackView);
router.post("/add-to-cart/:productId", ctrl.trackAddToCart);


module.exports = router;
