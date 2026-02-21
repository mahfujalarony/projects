// controllers/balanceTopupController.js
const { Op } = require("sequelize");
const MobileBanking = require("../models/MobileBanking");
const Wallet = require("../models/Wallet");
const WalletNumber = require("../models/WalletNumber");
const BalanceTopupRequest = require("../models/BalanceTopupRequest");

const isNonEmpty = (v) => typeof v === "string" && v.trim().length > 0;

const asMoney = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n.toFixed(2);
};

// ✅ client: active mobile bankings
exports.clientListMobileBankings = async (req, res) => {
  try {
    const rows = await MobileBanking.findAll({
      where: { isActive: true },
      order: [["id", "DESC"]],
    });
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("clientListMobileBankings error:", err);
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
    console.error("clientListWalletsByProvider error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ✅ client: create topup request (pending)
exports.createTopupRequest = async (req, res) => {
  try {
    const userId = req.user?.id || req.userId;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

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
    const amt = asMoney(amount);
    if (!amt) return res.status(400).json({ success: false, message: "amount must be > 0" });

    if (!isNonEmpty(transactionId)) {
      return res.status(400).json({ success: false, message: "transactionId is required" });
    }

    // txId unique
    const txExists = await BalanceTopupRequest.findOne({
      where: { transactionId: transactionId.trim() },
    });
    if (txExists) {
      return res.status(409).json({ success: false, message: "This transactionId already submitted" });
    }

    // validate provider/wallet/number chain & active
    const provider = await MobileBanking.findByPk(mobileBankingId);
    if (!provider || !provider.isActive) {
      return res.status(400).json({ success: false, message: "Invalid mobile banking" });
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
      amount: amt,
      transactionId: transactionId.trim(),
      status: "pending",
    });

    res.json({ success: true, message: "Topup request submitted", data: row });
  } catch (err) {
    console.error("createTopupRequest error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


// GET /api/balance/topup/pending
exports.getMyPendingTopups = async (req, res) => {
  try {
    const userId = req.user?.id || req.userId;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const rows = await BalanceTopupRequest.findAll({
      where: { userId, status: "pending" },
      order: [["createdAt", "DESC"]],
      limit: 20,
    });

    const totalAmount = rows.reduce((sum, r) => sum + Number(r.amount || 0), 0);

    return res.json({
      success: true,
      data: {
        count: rows.length,
        totalAmount: Number.isFinite(totalAmount) ? totalAmount : 0,
        latest: rows[0] || null,
        rows,
      },
    });
  } catch (err) {
    console.error("getMyPendingTopups error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
