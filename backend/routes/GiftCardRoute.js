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

// Gift card routes
router.post('/create', protect, createGiftCard);
router.post('/claim', claimGiftCard);
router.get('/sent', protect, getSentCards);
router.get('/received', protect, getReceivedCards);
router.get('/verify/:code', verifyCode);
router.get('/users/:userId/balance', getUserBalance);

module.exports = router;