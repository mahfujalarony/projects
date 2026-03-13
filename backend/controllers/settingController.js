const AppSetting = require("../models/AppSetting");
const { appendAdminHistory } = require("../utils/adminHistory");

const normalizeStoryDuration = (value) => {
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n >= 24 ? n : 24;
};

// GET /api/settings
exports.getSettings = async (req, res) => {
  try {
    const settings = await AppSetting.findAll();
    const data = {};
    settings.forEach((s) => {
      if (s.key === "adminHistoryLogs") return;
      try {
        data[s.key] = JSON.parse(s.value);
      } catch (e) {
        data[s.key] = s.value;
      }
    });
    data.storyDurationHours = normalizeStoryDuration(data.storyDurationHours);
    res.json({ success: true, data });
  } catch (err) {

    res.status(500).json({ success: false, message: "Server error" });
  }
};

// PUT /api/settings
exports.updateSettings = async (req, res) => {
  try {
    const updates = req.body; // { deliveryCharge: 100, ... }
    const changedKeys = [];
    for (const [key, rawVal] of Object.entries(updates)) {
      const val = key === "storyDurationHours" ? normalizeStoryDuration(rawVal) : rawVal;
      await AppSetting.upsert({ key, value: JSON.stringify(val) });
      changedKeys.push(key);
    }
    const actorId = req.user?.id || req.userId || null;
    if (changedKeys.length) {
      await appendAdminHistory(
        `Settings updated by admin/subadmin #${actorId || "unknown"}. Keys: ${changedKeys.join(", ")}.`,
        {
          meta: {
            type: "settings_updated",
            actorId,
            changedKeys,
          },
        }
      );
    }
    res.json({ success: true, message: "Settings updated" });
  } catch (err) {

    res.status(500).json({ success: false, message: "Server error" });
  }
};
