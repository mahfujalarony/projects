// backend/controllers/giftCardController.js
const sequelize = require('../config/db');
const GiftCard = require('../models/GiftCard');
const User = require('../models/Authentication');
const { Transaction } = require('sequelize');
const { addMoney2, subMoney2, toMoney2 } = require("../utils/money");
const { appendAdminHistory } = require("../utils/adminHistory");

// Generate a unique gift card code: GIFT-XXXX-XXXX-XXXX
const generateCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const seg = (len) =>
    Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `GIFT-${seg(4)}-${seg(4)}-${seg(4)}`;
};

// POST /api/giftcards/create
const createGiftCard = async (req, res) => {
  const t = await sequelize.transaction({
    isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED,
  });

  try {
    const { amount, message, senderId, expiryDays } = req.body;

    if (!amount || !senderId) {
      await t.rollback();
      return res
        .status(400)
        .json({ success: false, message: "Amount and senderId are required" });
    }

    const amt = parseFloat(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      await t.rollback();
      return res
        .status(400)
        .json({ success: false, message: "Amount must be greater than 0" });
    }
    const amtFixed = toMoney2(amt);
    if (!amtFixed) {
      await t.rollback();
      return res.status(400).json({ success: false, message: "Invalid amount" });
    }

    // ✅ Lock sender row so balance can't be double-spent concurrently
    const sender = await User.findByPk(senderId, {
      transaction: t,
      lock: t.LOCK.UPDATE, // SELECT ... FOR UPDATE
    });

    if (!sender) {
      await t.rollback();
      return res.status(404).json({ success: false, message: "Sender not found" });
    }

    const senderBalance = parseFloat(sender.balance || 0);
    if (!Number.isFinite(senderBalance) || senderBalance < amt) {
      await t.rollback();
      return res
        .status(400)
        .json({ success: false, message: "Insufficient balance" });
    }

    // ✅ Deduct amount from sender balance (within transaction)
      const nextSenderBalance = subMoney2(senderBalance, amtFixed);
    if (!nextSenderBalance) {
      await t.rollback();
      return res.status(400).json({ success: false, message: "Invalid balance calculation" });
    }
    sender.balance = nextSenderBalance;
    await sender.save({ transaction: t });

    // ✅ Generate unique code (retry if collision)
    let code = "";
    for (let i = 0; i < 10; i++) {
      const tryCode = generateCode();
      const exists = await GiftCard.findOne({
        where: { code: tryCode },
        transaction: t,
        lock: t.LOCK.KEY_SHARE, // safe lock for existence check
      });
      if (!exists) {
        code = tryCode;
        break;
      }
    }

    if (!code) {
      await t.rollback();
      return res.status(500).json({
        success: false,
        message: "Failed to generate unique gift card code. Try again.",
      });
    }

    // ✅ Set expiry
    let expiresAt = null;
    const days = parseInt(expiryDays, 10);
    if (Number.isFinite(days) && days > 0) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + days);
    }

    const giftCard = await GiftCard.create(
      {
        code,
        amount: amtFixed,
        message: message || null,
        createdBy: senderId,
        expiresAt,
        status: "active",
      },
      { transaction: t }
    );

    await appendAdminHistory(
      `Gift card created. Card #${giftCard.id}, code ${giftCard.code}, amount ${Number(giftCard.amount || 0).toFixed(
        2
      )}, sender #${senderId}.`,
      {
        transaction: t,
        meta: {
          type: "giftcard_created",
          giftCardId: giftCard.id,
          code: giftCard.code,
          amount: Number(giftCard.amount || 0),
          senderId: Number(senderId),
          expiresAt: giftCard.expiresAt || null,
        },
      }
    );

    // ✅ Commit transaction
    await t.commit();

    return res.status(201).json({
      success: true,
      message: "Gift card created successfully!",
      giftCard: {
        id: giftCard.id,
        code: giftCard.code,
        amount: giftCard.amount,
        message: giftCard.message || null,
        status: giftCard.status,
        expiresAt: giftCard.expiresAt,
        createdAt: giftCard.createdAt,
      },
    });
  } catch (error) {
    try {
      await t.rollback();
    } catch {}
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};


// POST /api/giftcards/claim
const claimGiftCard = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { code, userId } = req.body;

    if (!code || !userId) {
      await t.rollback();
      return res.status(400).json({ success: false, message: 'Code and userId are required' });
    }

    const giftCard = await GiftCard.findOne({ where: { code: code.toUpperCase().trim() }, transaction: t });

    if (!giftCard) {
      await t.rollback();
      return res.status(404).json({ success: false, message: 'Gift card not found' });
    }

    if (giftCard.status === 'claimed') {
      await t.rollback();
      return res.status(400).json({ success: false, message: 'This gift card has already been claimed' });
    }

    if (giftCard.status === 'expired') {
      await t.rollback();
      return res.status(400).json({ success: false, message: 'This gift card has expired' });
    }

    // Check expiry
    if (giftCard.expiresAt && new Date() > new Date(giftCard.expiresAt)) {
      await giftCard.update({ status: 'expired' }, { transaction: t });
      await t.rollback();
      return res.status(400).json({ success: false, message: 'This gift card has expired' });
    }

    // Cannot claim own gift card
    if (giftCard.createdBy === parseInt(userId)) {
      await t.rollback();
      return res.status(400).json({ success: false, message: 'You cannot claim your own gift card' });
    }

    // Get claimer
    const claimer = await User.findByPk(userId, { transaction: t });
    if (!claimer) {
      await t.rollback();
      return res.status(404).json({ success: false, message: 'User Not Found' });
    }

    // Update gift card status
    await giftCard.update({
      status: 'claimed',
      claimedBy: userId,
      claimedAt: new Date(),
    }, { transaction: t });

    // Add balance to user
    const newBalance = addMoney2(claimer.balance, giftCard.amount);
    if (!newBalance) {
      await t.rollback();
      return res.status(400).json({ success: false, message: "Invalid balance calculation" });
    }
    await claimer.update({ balance: newBalance }, { transaction: t });

    await appendAdminHistory(
      `Gift card claimed. Card #${giftCard.id}, amount ${Number(giftCard.amount || 0).toFixed(
        2
      )}, claimer #${userId}, sender #${giftCard.createdBy}.`,
      {
        transaction: t,
        meta: {
          type: "giftcard_claimed",
          giftCardId: giftCard.id,
          code: giftCard.code,
          amount: Number(giftCard.amount || 0),
          claimerId: Number(userId),
          senderId: Number(giftCard.createdBy || 0),
        },
      }
    );

    await t.commit();

    return res.status(200).json({
      success: true,
      message: `🎉 Gift card claimed successfully! $${parseFloat(giftCard.amount).toFixed(2)} has been added to your account.`,
      claimedAmount: parseFloat(giftCard.amount),
      newBalance: newBalance,
    });
  } catch (error) {
    await t.rollback();
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// GET /api/giftcards/sent/:userId  — cards the user created
const getSentCards = async (req, res) => {
  try {
    const userId = req.user.id;
    const cards = await GiftCard.findAll({
      where: { createdBy: userId },
      include: [{ model: User, as: "claimer", attributes: ["id", "name", "email"] }],
      order: [['createdAt', 'DESC']],
    });
    return res.json({ success: true, cards });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/giftcards/received/:email  — cards sent to an email
const getReceivedCards = async (req, res) => {
  try {
    const userId = req.user.id;
    const cards = await GiftCard.findAll({
      where: { claimedBy: userId },
      include: [{ model: User, as: 'creator', attributes: ['name', 'email', 'imageUrl'] }],
      order: [['createdAt', 'DESC']],
    });
    return res.json({ success: true, cards });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/giftcards/verify/:code  — check if a code is valid
const verifyCode = async (req, res) => {
  try {
    const { code } = req.params;
    const giftCard = await GiftCard.findOne({
      where: { code: code.toUpperCase().trim() },
      include: [{ model: User, as: 'creator', attributes: ['name'] }],
    });

    if (!giftCard) {
      return res.status(400).json({ success: false, valid: false, message: 'Wrong gift card code' });
    }

    // Check expiry
    if (giftCard.expiresAt && new Date() > new Date(giftCard.expiresAt)) {
      return res.status(400).json({
        success: false,
        valid: false,
        status: 'expired',
        message: 'Wrong gift card code',
      });
    }

    // Check if already claimed - return 400 so rate limiter counts it
    if (giftCard.status === 'claimed') {
      return res.status(400).json({
        success: false,
        valid: false,
        status: 'claimed',
        message: 'Wrong gift card code',
      });
    }

    // Only active cards return 200 (successful request - not counted by rate limiter)
    if (giftCard.status === 'active') {
      return res.status(200).json({
        success: true,
        valid: true,
        status: 'active',
        amount: giftCard.amount,
        message: giftCard.message || null,
        creatorName: giftCard.creator?.name,
        expiresAt: giftCard.expiresAt,
      });
    }

    // Any other status is invalid
    return res.status(400).json({
      success: false,
      valid: false,
      status: giftCard.status,
      message: 'Wrong gift card code',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/users/:userId/balance
const getUserBalance = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.userId, {
      attributes: ['id', 'name', 'email', 'balance'],
    });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    return res.json({ success: true, user });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createGiftCard,
  claimGiftCard,
  getSentCards,
  getReceivedCards,
  verifyCode,
  getUserBalance,
};
