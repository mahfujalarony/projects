const express = require('express');
const router = express.Router();
const {
  createGiftCard,
  claimGiftCard,
  getSentCards,
  getReceivedCards,
  verifyCode,
  getUserBalance,
} = require('../controllers/GiftCardController');
const protect = require('../middleware/Middleware');
const { giftCardClaimLimiter, giftCardVerifyLimiter } = require("../middleware/rateLimits");

// Gift card routes
router.post('/create', protect, createGiftCard);
router.post('/claim', giftCardClaimLimiter, claimGiftCard);
router.get('/sent', protect, getSentCards);
router.get('/received', protect, getReceivedCards);
router.get('/verify/:code', giftCardVerifyLimiter, verifyCode);
router.get('/users/:userId/balance', getUserBalance);

module.exports = router;
