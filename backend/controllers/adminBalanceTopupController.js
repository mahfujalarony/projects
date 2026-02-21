const { Op } = require("sequelize");
const BalanceTopupRequest = require("../models/BalanceTopupRequest");
const User = require("../models/Authentication");
const MobileBanking = require("../models/MobileBanking");
const Wallet = require("../models/Wallet");
const WalletNumber = require("../models/WalletNumber");
const sequelize = require("../config/db");

const clampInt = (v, d) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : d;
};

exports.listTopups = async (req, res) => {
  try {
    // /api/admin/topups?status=pending&page=1&limit=20&q=trx
    const status = (req.query.status || "pending").trim();
    const page = clampInt(req.query.page, 1);
    const limit = clampInt(req.query.limit, 20);
    const q = (req.query.q || "").trim();

    const where = {};
    if (status && ["pending", "approved", "rejected"].includes(status)) {
      where.status = status;
    }

    if (q) {
      where[Op.or] = [
        { transactionId: { [Op.like]: `%${q}%` } },
        { senderNumber: { [Op.like]: `%${q}%` } },
        // numeric search → userId
        ...(Number.isFinite(Number(q)) ? [{ userId: Number(q) }] : []),
      ];
    }

    const { count, rows } = await BalanceTopupRequest.findAndCountAll({
      where,
      include: [
        { model: User, as: "user", attributes: ["id", "name", "email", "balance", "role", "imageUrl"], required: false },
        { model: MobileBanking, as: "provider", attributes: ["id", "name", "imgUrl"], required: false },
        { model: Wallet, as: "wallet", attributes: ["id", "name", "imgUrl", "visibility"], required: false },
        { model: WalletNumber, as: "walletNumber", attributes: ["id", "number", "label"], required: false },
      ],
      order: [["createdAt", "DESC"]],
      offset: (page - 1) * limit,
      limit,
    });

    return res.json({
      success: true,
      data: {
        page,
        limit,
        total: count,
        rows,
      },
    });
  } catch (err) {
    console.error("listTopups error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.approveTopup = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const adminId = req.user?.id || req.userId || null;
    const { id } = req.params;

    const row = await BalanceTopupRequest.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!row) {
      await t.rollback();
      return res.status(404).json({ success: false, message: "Topup request not found" });
    }

    if (row.status !== "pending") {
      await t.rollback();
      return res.status(400).json({ success: false, message: `Already ${row.status}` });
    }

    const user = await User.findByPk(row.userId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!user) {
      await t.rollback();
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const amt = Number(row.amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      await t.rollback();
      return res.status(400).json({ success: false, message: "Invalid amount" });
    }

    // balance add
    user.balance = Number(user.balance || 0) + amt;
    await user.save({ transaction: t });

    // update request status
    row.status = "approved";
    row.adminNote = req.body?.adminNote ? String(req.body.adminNote).trim() : row.adminNote;
    row.approvedByAdminId = adminId; // optional column থাকলে
    await row.save({ transaction: t });

    await t.commit();
    return res.json({ success: true, message: "Approved & balance added", data: { request: row, userBalance: user.balance } });
  } catch (err) {
    console.error("approveTopup error:", err);
    await t.rollback();
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.rejectTopup = async (req, res) => {
  try {
    const { id } = req.params;
    const adminNote = req.body?.adminNote ? String(req.body.adminNote).trim() : "";

    const row = await BalanceTopupRequest.findByPk(id);
    if (!row) return res.status(404).json({ success: false, message: "Topup request not found" });

    if (row.status !== "pending") {
      return res.status(400).json({ success: false, message: `Already ${row.status}` });
    }

    row.status = "rejected";
    row.adminNote = adminNote || row.adminNote || null;
    await row.save();

    return res.json({ success: true, message: "Rejected", data: row });
  } catch (err) {
    console.error("rejectTopup error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
