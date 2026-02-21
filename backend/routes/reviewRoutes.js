// routes/reviewRoutes.js
const router = require("express").Router();
const protect = require("../middleware/Middleware"); 
const review = require("../controllers/reviewController");

router.get("/product/:productId", review.getProductReviews);
router.get("/eligibility/:productId", protect, review.getReviewEligibility);
router.post("/", protect, review.createReview);
router.patch("/:id", protect, review.updateReview);

module.exports = router;
