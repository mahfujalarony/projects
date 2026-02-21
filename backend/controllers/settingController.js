const AppSetting = require("../models/AppSetting");

// GET /api/settings
exports.getSettings = async (req, res) => {
  try {
    const settings = await AppSetting.findAll();
    const data = {};
    settings.forEach((s) => {
      try {
        data[s.key] = JSON.parse(s.value);
      } catch (e) {
        data[s.key] = s.value;
      }
    });
    res.json({ success: true, data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// PUT /api/settings
exports.updateSettings = async (req, res) => {
  try {
    const updates = req.body; // { deliveryCharge: 100, ... }
    for (const [key, val] of Object.entries(updates)) {
      await AppSetting.upsert({ key, value: JSON.stringify(val) });
    }
    res.json({ success: true, message: "Settings updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};