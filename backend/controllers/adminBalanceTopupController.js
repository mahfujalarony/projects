const { Op } = require("sequelize");
const BalanceTopupRequest = require("../models/BalanceTopupRequest");
const User = require("../models/Authentication");
const MobileBanking = require("../models/MobileBanking");
const Wallet = require("../models/Wallet");
const WalletNumber = require("../models/WalletNumber");
const sequelize = require("../config/db");
const { addMoney2 } = require("../utils/money");
const Notification = require("../models/Notification");
const { appendAdminHistory } = require("../utils/adminHistory");

const clampInt = (v, d) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : d;
};

exports.listTopups = async (req, res) => {
  try {
    // /api/admin/topups?status=pending&page=1&limit=20&q=trx
    const status = (req.query.status || "pending").trim();
    const page = clampInt(req.query.page, 1);
    const limit = Math.min(clampInt(req.query.limit, 20), 50);
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
        {
          model: User,
          as: "user",
          attributes: ["id", "name", "email", "balance", "role", "imageUrl", "topupBlockedUntil"],
          required: false,
        },
        { model: MobileBanking, as: "provider", attributes: ["id", "name", "imgUrl"], required: false },
        { model: Wallet, as: "wallet", attributes: ["id", "name", "imgUrl", "visibility"], required: false },
        { model: WalletNumber, as: "walletNumber", attributes: ["id", "number", "label"], required: false },
      ],
      order: [["createdAt", "DESC"]],
      offset: (page - 1) * limit,
      limit,
    });

    const userIds = Array.from(
      new Set(
        (rows || [])
          .map((r) => Number(r?.userId || 0))
          .filter((id) => Number.isFinite(id) && id > 0)
      )
    );

    let rejectedByUser = {};
    if (userIds.length) {
      const rejectedRows = await BalanceTopupRequest.findAll({
        attributes: [
          "userId",
          [sequelize.fn("COUNT", sequelize.col("id")), "rejectedCount"],
        ],
        where: {
          userId: { [Op.in]: userIds },
          status: "rejected",
        },
        group: ["userId"],
        raw: true,
      });

      rejectedByUser = Object.fromEntries(
        (rejectedRows || []).map((r) => [String(r.userId), Number(r.rejectedCount || 0)])
      );
    }

    const rowsWithMeta = (rows || []).map((r) => {
      const json = r.toJSON();
      return {
        ...json,
        userRejectedCount: Number(rejectedByUser[String(json.userId)] || 0),
      };
    });

    return res.json({
      success: true,
      data: {
        page,
        limit,
        total: count,
        rows: rowsWithMeta,
      },
    });
  } catch (err) {
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
    const nextBalance = addMoney2(user.balance, amt);
    if (!nextBalance) {
      await t.rollback();
      return res.status(400).json({ success: false, message: "Invalid balance calculation" });
    }
    user.balance = nextBalance;
    await user.save({ transaction: t });

    // update request status
    row.status = "approved";
    row.adminNote = req.body?.adminNote ? String(req.body.adminNote).trim() : row.adminNote;
    row.approvedByAdminId = adminId; // optional column থাকলে
    await row.save({ transaction: t });

    await appendAdminHistory(
      `Topup approved. Request #${row.id}, user #${row.userId}, amount ${Number(row.amount || 0).toFixed(
        2
      )}, tx ${row.transactionId}.`,
      {
        transaction: t,
        meta: {
          type: "topup_approved",
          topupId: row.id,
          userId: row.userId,
          amount: Number(row.amount || 0),
          transactionId: row.transactionId,
          adminNote: row.adminNote || null,
          status: row.status,
        },
      }
    );

    await Notification.create(
      {
        userId: row.userId,
        type: "balance",
        title: "Balance Topup Approved",
        message: `Your balance topup has been approved. Amount: $${Number(row.amount || 0).toFixed(2)}.`,
        meta: {
          topupId: row.id,
          mobileBankingId: row.mobileBankingId,
          walletId: row.walletId,
          walletNumberId: row.walletNumberId,
          transactionId: row.transactionId,
        },
      },
      { transaction: t }
    );

    await t.commit();
    return res.json({ success: true, message: "Approved & balance added", data: { request: row, userBalance: user.balance } });
  } catch (err) {
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
    if (!adminNote) {
      return res.status(400).json({ success: false, message: "Reject reason is required" });
    }

    row.status = "rejected";
    row.adminNote = adminNote;
    await row.save();

    await appendAdminHistory(
      `Topup rejected. Request #${row.id}, user #${row.userId}, amount ${Number(row.amount || 0).toFixed(
        2
      )}, tx ${row.transactionId}. Reason: ${adminNote}`,
      {
        meta: {
          type: "topup_rejected",
          topupId: row.id,
          userId: row.userId,
          amount: Number(row.amount || 0),
          transactionId: row.transactionId,
          adminNote,
          status: row.status,
        },
      }
    );

    await Notification.create({
      userId: row.userId,
      type: "balance",
      title: "Balance Topup Rejected",
      message: `Your balance topup was rejected. Reason: ${adminNote}.`,
      meta: {
        topupId: row.id,
        mobileBankingId: row.mobileBankingId,
        walletId: row.walletId,
        walletNumberId: row.walletNumberId,
        transactionId: row.transactionId,
      },
    });

    return res.json({ success: true, message: "Rejected", data: row });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.blockUserTopup = async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const days = Number(req.body?.days);
    if (!Number.isFinite(userId) || userId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid userId" });
    }
    if (![1, 2, 3, 4, 5].includes(days)) {
      return res.status(400).json({ success: false, message: "days must be one of 1,2,3,4,5" });
    }

    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const now = new Date();
    const base = user.topupBlockedUntil && new Date(user.topupBlockedUntil) > now
      ? new Date(user.topupBlockedUntil)
      : now;
    base.setDate(base.getDate() + days);
    user.topupBlockedUntil = base;
    await user.save();

    await appendAdminHistory(
      `Topup blocked for user #${user.id} by ${days} day(s). Until: ${new Date(user.topupBlockedUntil).toISOString()}.`,
      {
        meta: {
          type: "topup_user_blocked",
          userId: user.id,
          days,
          topupBlockedUntil: user.topupBlockedUntil,
        },
      }
    );

    return res.json({
      success: true,
      message: `Topup blocked for ${days} day(s)`,
      data: { userId: user.id, topupBlockedUntil: user.topupBlockedUntil },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.unblockUserTopup = async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    if (!Number.isFinite(userId) || userId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid userId" });
    }

    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    user.topupBlockedUntil = null;
    await user.save();

    await appendAdminHistory(
      `Topup block removed for user #${user.id}.`,
      {
        meta: {
          type: "topup_user_unblocked",
          userId: user.id,
        },
      }
    );

    return res.json({
      success: true,
      message: "Topup block removed",
      data: { userId: user.id, topupBlockedUntil: null },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.deleteTopup = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ success: false, message: "Invalid topup id" });
    }

    const row = await BalanceTopupRequest.findByPk(id);
    if (!row) {
      return res.status(404).json({ success: false, message: "Topup request not found" });
    }
    const actorId = req.user?.id || req.userId || null;
    const snapshot = {
      topupId: row.id,
      userId: row.userId,
      amount: Number(row.amount || 0),
      transactionId: row.transactionId || null,
      status: row.status || null,
    };

    await row.destroy();
    await appendAdminHistory(
      `Topup request deleted. Request #${snapshot.topupId}, user #${snapshot.userId}, by admin #${actorId || "unknown"}.`,
      {
        meta: {
          type: "topup_deleted",
          actorId,
          ...snapshot,
        },
      }
    );
    return res.json({ success: true, message: "Topup request deleted" });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
