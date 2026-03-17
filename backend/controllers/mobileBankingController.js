// controllers/mobileBankingController.js
const MobileBanking = require("../models/MobileBanking");
const { appendAdminHistory } = require("../utils/adminHistory");
const { deleteUploadFileIfSafe } = require("../utils/uploadFileCleanup");

const isNonEmpty = (v) => typeof v === "string" && v.trim().length > 0;
const asPositiveNumber = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

exports.createMobileBanking = async (req, res) => {
  try {
    const { name, imgUrl, isActive, dollarRate } = req.body || {};

    if (!isNonEmpty(name)) {
      return res.status(400).json({ success: false, message: "name is required" });
    }
    if (!isNonEmpty(imgUrl)) {
      return res.status(400).json({ success: false, message: "imgUrl is required" });
    }

    const rate = asPositiveNumber(dollarRate);
    if (!rate) {
      return res.status(400).json({ success: false, message: "dollarRate must be > 0" });
    }

    // unique name check (case-insensitive safe)
    const exists = await MobileBanking.findOne({ where: { name: name.trim() } });
    if (exists) {
      return res
        .status(409)
        .json({ success: false, message: "This mobile banking name already exists" });
    }

    const row = await MobileBanking.create({
      name: name.trim(),
      imgUrl: imgUrl.trim(),
      dollarRate: rate,
      isActive: typeof isActive === "boolean" ? isActive : true,
    });
    const actorId = req.user?.id || req.userId || null;
    await appendAdminHistory(
      `Mobile banking created. #${row.id} (${row.name}) by admin #${actorId || "unknown"}.`,
      {
        meta: {
          type: "mobile_banking_created",
          actorId,
          mobileBankingId: row.id,
          name: row.name,
          dollarRate: Number(row.dollarRate || 0),
          isActive: row.isActive,
        },
      }
    );

    return res.json({ success: true, data: row });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getAllMobileBankings = async (req, res) => {
  try {
    const rows = await MobileBanking.findAll({
      order: [["id", "DESC"]],
    });
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getOneMobileBanking = async (req, res) => {
  try {
    const { id } = req.params;

    const row = await MobileBanking.findByPk(id);
    if (!row) return res.status(404).json({ success: false, message: "Not found" });

    return res.json({ success: true, data: row });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.updateMobileBanking = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, imgUrl, isActive, dollarRate } = req.body || {};

    const row = await MobileBanking.findByPk(id);
    if (!row) return res.status(404).json({ success: false, message: "Not found" });
    const actorId = req.user?.id || req.userId || null;
    const before = {
      name: row.name,
      dollarRate: Number(row.dollarRate || 0),
      isActive: row.isActive,
      imgUrl: row.imgUrl || null,
    };

    if (name !== undefined) {
      if (!isNonEmpty(name)) {
        return res.status(400).json({ success: false, message: "name cannot be empty" });
      }

      // unique name check excluding current id
      const exists = await MobileBanking.findOne({ where: { name: name.trim() } });
      if (exists && String(exists.id) !== String(id)) {
        return res
          .status(409)
          .json({ success: false, message: "This mobile banking name already exists" });
      }

      row.name = name.trim();
    }

    if (imgUrl !== undefined) {
      if (!isNonEmpty(imgUrl)) {
        return res.status(400).json({ success: false, message: "imgUrl cannot be empty" });
      }
      row.imgUrl = imgUrl.trim();
    }

    if (dollarRate !== undefined) {
      const rate = asPositiveNumber(dollarRate);
      if (!rate) {
        return res.status(400).json({ success: false, message: "dollarRate must be > 0" });
      }
      row.dollarRate = rate;
    }

    if (typeof isActive === "boolean") row.isActive = isActive;

    await row.save();
    await appendAdminHistory(
      `Mobile banking updated. #${row.id} (${row.name}) by admin #${actorId || "unknown"}.`,
      {
        meta: {
          type: "mobile_banking_updated",
          actorId,
          mobileBankingId: row.id,
          before,
          after: {
            name: row.name,
            dollarRate: Number(row.dollarRate || 0),
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

exports.deleteMobileBanking = async (req, res) => {
  try {
    const { id } = req.params;

    const row = await MobileBanking.findByPk(id);
    if (!row) return res.status(404).json({ success: false, message: "Not found" });
    const actorId = req.user?.id || req.userId || null;
    const snapshot = {
      mobileBankingId: row.id,
      name: row.name,
      dollarRate: Number(row.dollarRate || 0),
      isActive: row.isActive,
      imgUrl: row.imgUrl || null,
    };

    await row.destroy();
    await deleteUploadFileIfSafe(snapshot.imgUrl);
    await appendAdminHistory(
      `Mobile banking deleted. #${snapshot.mobileBankingId} (${snapshot.name}) by admin #${actorId || "unknown"}.`,
      {
        meta: {
          type: "mobile_banking_deleted",
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
