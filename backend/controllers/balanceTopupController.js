// controllers/balanceTopupController.js
const { Op } = require("sequelize");
const MobileBanking = require("../models/MobileBanking");
const Wallet = require("../models/Wallet");
const WalletNumber = require("../models/WalletNumber");
const BalanceTopupRequest = require("../models/BalanceTopupRequest");
const User = require("../models/Authentication");
const { appendAdminHistory } = require("../utils/adminHistory");

const isNonEmpty = (v) => typeof v === "string" && v.trim().length > 0;
const asPositiveNumber = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const asMoney = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n.toFixed(2);
};

const normalizeTransactionId = (value) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase();

// ✅ client: active mobile bankings
exports.clientListMobileBankings = async (req, res) => {
  try {
    const rows = await MobileBanking.findAll({
      where: { isActive: true },
      order: [["id", "DESC"]],
    });
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ✅ client: wallets + numbers (only active, and public OR private owned by this user)
exports.clientListWalletsByProvider = async (req, res) => {
  try {
    const { mobileBankingId } = req.params;
    const userId = req.user?.id || req.userId || null;

    const provider = await MobileBanking.findByPk(mobileBankingId);
    if (!provider || !provider.isActive) {
      return res.status(404).json({ success: false, message: "Mobile banking not found" });
    }

    let wallets = [];

    // 1. If user exists, check for private wallets first
    if (userId) {
      wallets = await Wallet.findAll({
        where: {
          mobileBankingId: Number(mobileBankingId),
          isActive: true,
          visibility: "private",
          ownerUserId: userId,
        },
        include: [
          { model: WalletNumber, as: "numbers", required: false, where: { isActive: true } },
        ],
        order: [["sortOrder", "ASC"], ["id", "DESC"]],
      });
    }

    // 2. If no private wallets found (or no user), get public ones
    if (!wallets.length) {
      wallets = await Wallet.findAll({
        where: {
          mobileBankingId: Number(mobileBankingId),
          isActive: true,
          visibility: "public",
        },
        include: [
          { model: WalletNumber, as: "numbers", required: false, where: { isActive: true } },
        ],
        order: [["sortOrder", "ASC"], ["id", "DESC"]],
      });
    }

    res.json({ success: true, data: { provider, wallets } });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ✅ client: create topup request (pending)
exports.createTopupRequest = async (req, res) => {
  try {
    const userId = req.user?.id || req.userId;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const me = await User.findByPk(userId, {
      attributes: ["id", "topupBlockedUntil"],
    });
    if (!me) return res.status(401).json({ success: false, message: "Unauthorized" });

    const blockedUntil = me.topupBlockedUntil ? new Date(me.topupBlockedUntil) : null;
    if (blockedUntil && blockedUntil.getTime() > Date.now()) {
      return res.status(403).json({
        success: false,
        message: `Topup request is blocked until ${blockedUntil.toLocaleString()}`,
        data: { topupBlockedUntil: blockedUntil },
      });
    }

    const {
      mobileBankingId,
      walletId,
      walletNumberId,
      senderNumber,
      amount,
      transactionId,
    } = req.body || {};

    if (!mobileBankingId || !walletId || !walletNumberId) {
      return res.status(400).json({ success: false, message: "mobileBankingId, walletId, walletNumberId are required" });
    }
    if (!isNonEmpty(senderNumber)) {
      return res.status(400).json({ success: false, message: "senderNumber is required" });
    }
    const localAmountNum = asPositiveNumber(amount);
    if (!localAmountNum) {
      return res.status(400).json({ success: false, message: "amount must be > 0" });
    }

    if (!isNonEmpty(transactionId)) {
      return res.status(400).json({ success: false, message: "transactionId is required" });
    }
    const txId = normalizeTransactionId(transactionId);
    if (!txId) {
      return res.status(400).json({ success: false, message: "transactionId is required" });
    }

    // Same TX ID can be reused only if previous requests are rejected.
    // Any existing pending/approved record with same TX ID blocks new request.
    const txExists = await BalanceTopupRequest.findOne({
      where: {
        transactionId: txId,
        mobileBankingId: Number(mobileBankingId),
        status: { [Op.in]: ["pending", "approved"] },
      },
    });
    if (txExists) {
      return res.status(409).json({
        success: false,
        message: "This transaction ID is already used in a pending/approved request for this provider",
      });
    }

    // validate provider/wallet/number chain & active
    const provider = await MobileBanking.findByPk(mobileBankingId);
    if (!provider || !provider.isActive) {
      return res.status(400).json({ success: false, message: "Invalid mobile banking" });
    }
    const rateNum = asPositiveNumber(provider?.dollarRate);
    if (!rateNum) {
      return res.status(400).json({ success: false, message: "Invalid mobile banking dollar rate" });
    }
    const usdAmount = asMoney(localAmountNum / rateNum);
    if (!usdAmount) {
      return res.status(400).json({ success: false, message: "Converted amount must be > 0" });
    }

    const wallet = await Wallet.findOne({
      where: { id: walletId, mobileBankingId: provider.id, isActive: true },
    });
    if (!wallet) {
      return res.status(400).json({ success: false, message: "Invalid wallet for this provider" });
    }

    // client visible check (public OR private owner)
    if (wallet.visibility === "private" && String(wallet.ownerUserId) !== String(userId)) {
      return res.status(403).json({ success: false, message: "This wallet is not accessible" });
    }

    const wnum = await WalletNumber.findOne({
      where: { id: walletNumberId, walletId: wallet.id, isActive: true },
    });
    if (!wnum) {
      return res.status(400).json({ success: false, message: "Invalid wallet number" });
    }

    const row = await BalanceTopupRequest.create({
      userId,
      mobileBankingId: provider.id,
      walletId: wallet.id,
      walletNumberId: wnum.id,
      senderNumber: senderNumber.trim(),
      amount: usdAmount,
      transactionId: txId,
      status: "pending",
    });

    await appendAdminHistory(
      `Balance topup request submitted. User #${userId}, request #${row.id}, amount ${Number(row.amount || 0).toFixed(
        2
      )}, tx ${row.transactionId}.`,
      {
        meta: {
          type: "topup_request_created",
          userId,
          topupId: row.id,
          amount: Number(row.amount || 0),
          transactionId: row.transactionId,
          mobileBankingId: row.mobileBankingId,
          walletId: row.walletId,
          walletNumberId: row.walletNumberId,
          status: row.status,
        },
      }
    );

    res.json({ success: true, message: "Topup request submitted", data: row });
  } catch (err) {
    if (err?.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({
        success: false,
        message: "This transaction ID is already used in a pending/approved request",
      });
    }
    res.status(500).json({ success: false, message: "Server error" });
  }
};


// GET /api/balance/topup/pending
exports.getMyPendingTopups = async (req, res) => {
  try {
    const userId = req.user?.id || req.userId;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });
    const me = await User.findByPk(userId, {
      attributes: ["id", "topupBlockedUntil"],
    });

    const rows = await BalanceTopupRequest.findAll({
      where: { userId, status: "pending" },
      order: [["createdAt", "DESC"]],
      limit: 20,
    });
    const rejectedCount = await BalanceTopupRequest.count({
      where: { userId, status: "rejected" },
    });
    const latestRejected = await BalanceTopupRequest.findOne({
      where: {
        userId,
        status: "rejected",
        adminNote: { [Op.ne]: null },
      },
      attributes: ["id", "transactionId", "amount", "adminNote", "createdAt", "updatedAt"],
      order: [["updatedAt", "DESC"]],
    });

    const totalAmount = rows.reduce((sum, r) => sum + Number(r.amount || 0), 0);
    const blockedUntil = me?.topupBlockedUntil ? new Date(me.topupBlockedUntil) : null;
    const isTopupBlocked = Boolean(blockedUntil && blockedUntil.getTime() > Date.now());
    const blockedDaysLeft = isTopupBlocked
      ? Math.max(1, Math.ceil((blockedUntil.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
      : 0;

    return res.json({
      success: true,
      data: {
        topupBlockedUntil: blockedUntil || null,
        isTopupBlocked,
        blockedDaysLeft,
        count: rows.length,
        totalAmount: Number.isFinite(totalAmount) ? totalAmount : 0,
        rejectedCount: Number(rejectedCount || 0),
        latestRejected: latestRejected || null,
        latest: rows[0] || null,
        rows,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
