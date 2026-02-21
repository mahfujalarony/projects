// controllers/mobileBankingController.js
const MobileBanking = require("../models/MobileBanking");

const isNonEmpty = (v) => typeof v === "string" && v.trim().length > 0;

exports.createMobileBanking = async (req, res) => {
  try {
    const { name, imgUrl, isActive } = req.body || {};

    if (!isNonEmpty(name)) {
      return res.status(400).json({ success: false, message: "name is required" });
    }
    if (!isNonEmpty(imgUrl)) {
      return res.status(400).json({ success: false, message: "imgUrl is required" });
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
      isActive: typeof isActive === "boolean" ? isActive : true,
    });

    return res.json({ success: true, data: row });
  } catch (err) {
    console.error("createMobileBanking error:", err);
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
    console.error("getAllMobileBankings error:", err);
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
    console.error("getOneMobileBanking error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.updateMobileBanking = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, imgUrl, isActive } = req.body || {};

    const row = await MobileBanking.findByPk(id);
    if (!row) return res.status(404).json({ success: false, message: "Not found" });

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

    if (typeof isActive === "boolean") row.isActive = isActive;

    await row.save();
    return res.json({ success: true, data: row });
  } catch (err) {
    console.error("updateMobileBanking error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.deleteMobileBanking = async (req, res) => {
  try {
    const { id } = req.params;

    const row = await MobileBanking.findByPk(id);
    if (!row) return res.status(404).json({ success: false, message: "Not found" });

    await row.destroy();
    return res.json({ success: true, message: "Deleted" });
  } catch (err) {
    console.error("deleteMobileBanking error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
