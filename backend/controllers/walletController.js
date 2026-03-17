// controllers/walletController.js
const { Op } = require("sequelize");
const Wallet = require("../models/Wallet");
const WalletNumber = require("../models/WalletNumber");
const MobileBanking = require("../models/MobileBanking");
const { appendAdminHistory } = require("../utils/adminHistory");
const { deleteUploadFileIfSafe } = require("../utils/uploadFileCleanup");

const isNonEmpty = (v) => typeof v === "string" && v.trim().length > 0;

const clampInt = (v, d) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.floor(n) : d;
};

// GET /api/mobile-banking/:mobileBankingId/wallets?includeNumbers=1
exports.listWalletsByProvider = async (req, res) => {
  try {
    const { mobileBankingId } = req.params;
    const includeNumbers = String(req.query.includeNumbers || "") === "1";

    const provider = await MobileBanking.findByPk(mobileBankingId);
    if (!provider) return res.status(404).json({ success: false, message: "Mobile banking not found" });

    const include = [
      {
        association: "owner",
        attributes: ["id", "name", "email", "imageUrl"],
        required: false,
      },
    ];

    if (includeNumbers) {
      include.push({
        model: WalletNumber,
        as: "numbers",
        required: false,
      });
    }

    const wallets = await Wallet.findAll({
      where: { mobileBankingId: Number(mobileBankingId) },
      include,
      order: [
        ["sortOrder", "ASC"],
        ["id", "DESC"],
      ],
    });
    const normalizedWallets = wallets.map((row) => {
      const json = row.toJSON();
      return {
        ...json,
        ownerUser: json.owner || null,
      };
    });

    return res.json({ success: true, data: { provider, wallets: normalizedWallets } });
  } catch (err) {

    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// POST /api/mobile-banking/:mobileBankingId/wallets
// body: { name, visibility, note, sortOrder, isActive, imgUrl }
exports.createWallet = async (req, res) => {
  try {
    const { mobileBankingId } = req.params;
    const { name, visibility = "public", note, sortOrder, isActive, imgUrl, ownerUserId: bodyOwnerId } = req.body || {};

    if (!isNonEmpty(name)) {
      return res.status(400).json({ success: false, message: "Wallet name is required" });
    }

    const provider = await MobileBanking.findByPk(mobileBankingId);
    if (!provider) return res.status(404).json({ success: false, message: "Mobile banking not found" });

    if (!["public", "private"].includes(visibility)) {
      return res.status(400).json({ success: false, message: "visibility must be public/private" });
    }

    // private wallet হলে logged in user দরকার (আপনার auth middleware থাকলে)
    let ownerUserId = null;
    if (visibility === "private") {
      if (bodyOwnerId) {
        ownerUserId = bodyOwnerId;
      } else {
        const uid = req.user?.id || req.userId;
        if (!uid) return res.status(401).json({ success: false, message: "Unauthorized for private wallet" });
        ownerUserId = uid;
      }
    }

    // unique per provider check (optional — index থাকলেও human msg দেয়)
    const exists = await Wallet.findOne({
      where: {
        mobileBankingId: Number(mobileBankingId),
        name: name.trim(),
      },
    });
    if (exists) {
      return res.status(409).json({ success: false, message: "This wallet name already exists under this provider" });
    }

    const row = await Wallet.create({
      mobileBankingId: Number(mobileBankingId),
      name: name.trim(),
      imgUrl: imgUrl && String(imgUrl).trim() ? String(imgUrl).trim() : null,
      visibility,
      ownerUserId,
      note: isNonEmpty(note) ? note.trim() : null,
      sortOrder: Number.isFinite(Number(sortOrder)) ? clampInt(sortOrder, 0) : 0,
      isActive: typeof isActive === "boolean" ? isActive : true,
    });

    const actorId = req.user?.id || req.userId || null;
    await appendAdminHistory(
      `Wallet created. Wallet #${row.id} (${row.name}) under provider #${row.mobileBankingId} by admin #${actorId || "unknown"}.`,
      {
        meta: {
          type: "wallet_created",
          actorId,
          walletId: row.id,
          mobileBankingId: row.mobileBankingId,
          name: row.name,
          visibility: row.visibility,
          ownerUserId: row.ownerUserId || null,
          isActive: row.isActive,
        },
      }
    );

    return res.json({ success: true, data: row });
  } catch (err) {

    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// PUT /api/wallets/:walletId
exports.updateWallet = async (req, res) => {
  try {
    const { walletId } = req.params;
    const { name, visibility, note, sortOrder, isActive, imgUrl } = req.body || {};

    const row = await Wallet.findByPk(walletId);
    if (!row) return res.status(404).json({ success: false, message: "Wallet not found" });
    const actorId = req.user?.id || req.userId || null;
    const before = {
      name: row.name,
      visibility: row.visibility,
      ownerUserId: row.ownerUserId || null,
      sortOrder: row.sortOrder,
      isActive: row.isActive,
      imgUrl: row.imgUrl || null,
    };

    if (name !== undefined) {
      if (!isNonEmpty(name)) return res.status(400).json({ success: false, message: "name cannot be empty" });

      const exists = await Wallet.findOne({
        where: {
          mobileBankingId: row.mobileBankingId,
          name: name.trim(),
          id: { [Op.ne]: row.id },
        },
      });
      if (exists) return res.status(409).json({ success: false, message: "Wallet name already exists" });

      row.name = name.trim();
    }

    if (visibility !== undefined) {
      if (!["public", "private"].includes(visibility)) {
        return res.status(400).json({ success: false, message: "visibility must be public/private" });
      }

      if (visibility === "private") {
        const uid = req.user?.id || req.userId;
        if (!uid) return res.status(401).json({ success: false, message: "Unauthorized for private wallet" });
        if (imgUrl !== undefined) {
         row.imgUrl = isNonEmpty(imgUrl) ? imgUrl.trim() : null;
        }
        row.visibility = "private";
        row.ownerUserId = uid;
      } else {
        row.visibility = "public";
        row.ownerUserId = null;
        row.imgUrl = null;
      }
    }

    if (note !== undefined) row.note = isNonEmpty(note) ? note.trim() : null;
    if (sortOrder !== undefined) row.sortOrder = clampInt(sortOrder, 0);
    if (typeof isActive === "boolean") row.isActive = isActive;
    if (imgUrl !== undefined && visibility === undefined) {
      row.imgUrl = isNonEmpty(imgUrl) ? imgUrl.trim() : null;
    }

    await row.save();
    await appendAdminHistory(
      `Wallet updated. Wallet #${row.id} (${row.name}) by admin #${actorId || "unknown"}.`,
      {
        meta: {
          type: "wallet_updated",
          actorId,
          walletId: row.id,
          before,
          after: {
            name: row.name,
            visibility: row.visibility,
            ownerUserId: row.ownerUserId || null,
            sortOrder: row.sortOrder,
            isActive: row.isActive,
            imgUrl: row.imgUrl || null,
          },
        },
      }
    );
    return res.json({ success: true, data: row });
  } catch (err) {

    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// DELETE /api/wallets/:walletId
exports.deleteWallet = async (req, res) => {
  try {
    const { walletId } = req.params;
    const row = await Wallet.findByPk(walletId);
    if (!row) return res.status(404).json({ success: false, message: "Wallet not found" });
    const actorId = req.user?.id || req.userId || null;
    const snapshot = {
      walletId: row.id,
      mobileBankingId: row.mobileBankingId,
      name: row.name,
      visibility: row.visibility,
      ownerUserId: row.ownerUserId || null,
      imgUrl: row.imgUrl || null,
    };

    await row.destroy();
    await deleteUploadFileIfSafe(snapshot.imgUrl);
    await appendAdminHistory(
      `Wallet deleted. Wallet #${snapshot.walletId} (${snapshot.name}) by admin #${actorId || "unknown"}.`,
      {
        meta: {
          type: "wallet_deleted",
          actorId,
          ...snapshot,
        },
      }
    );
    return res.json({ success: true, message: "Deleted" });
  } catch (err) {

    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// GET /api/wallets/:walletId/numbers
exports.listWalletNumbers = async (req, res) => {
  try {
    const { walletId } = req.params;

    const wallet = await Wallet.findByPk(walletId);
    if (!wallet) return res.status(404).json({ success: false, message: "Wallet not found" });

    const numbers = await WalletNumber.findAll({
      where: { walletId: Number(walletId) },
      order: [["id", "DESC"]],
    });

    return res.json({ success: true, data: { wallet, numbers } });
  } catch (err) {

    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// POST /api/wallets/:walletId/numbers
// body: { number, label, isActive }
exports.addWalletNumber = async (req, res) => {
  try {
    const { walletId } = req.params;
    const { number, label, isActive } = req.body || {};

    const wallet = await Wallet.findByPk(walletId);
    if (!wallet) return res.status(404).json({ success: false, message: "Wallet not found" });

    if (!isNonEmpty(number)) {
      return res.status(400).json({ success: false, message: "number is required" });
    }

    const numStr = number.trim();

    // unique within same wallet
    const exists = await WalletNumber.findOne({
      where: { walletId: Number(walletId), number: numStr },
    });
    if (exists) {
      return res.status(409).json({ success: false, message: "This number already exists in this wallet" });
    }

    const row = await WalletNumber.create({
      walletId: Number(walletId),
      number: numStr,
      label: isNonEmpty(label) ? label.trim() : null,
      isActive: typeof isActive === "boolean" ? isActive : true,
    });

    const actorId = req.user?.id || req.userId || null;
    await appendAdminHistory(
      `Wallet number added. Wallet #${wallet.id}, number #${row.id}, by admin #${actorId || "unknown"}.`,
      {
        meta: {
          type: "wallet_number_added",
          actorId,
          walletId: wallet.id,
          walletNumberId: row.id,
          number: row.number,
          label: row.label || null,
          isActive: row.isActive,
        },
      }
    );

    return res.json({ success: true, data: row });
  } catch (err) {

    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// DELETE /api/wallet-numbers/:id
exports.deleteWalletNumber = async (req, res) => {
  try {
    const { id } = req.params;

    const row = await WalletNumber.findByPk(id);
    if (!row) return res.status(404).json({ success: false, message: "Number not found" });
    const actorId = req.user?.id || req.userId || null;
    const snapshot = {
      walletNumberId: row.id,
      walletId: row.walletId,
      number: row.number,
      label: row.label || null,
      isActive: row.isActive,
    };

    await row.destroy();
    await appendAdminHistory(
      `Wallet number deleted. Number #${snapshot.walletNumberId} from wallet #${snapshot.walletId} by admin #${actorId || "unknown"}.`,
      {
        meta: {
          type: "wallet_number_deleted",
          actorId,
          ...snapshot,
        },
      }
    );
    return res.json({ success: true, message: "Deleted" });
  } catch (err) {

    return res.status(500).json({ success: false, message: "Server error" });
  }
};
