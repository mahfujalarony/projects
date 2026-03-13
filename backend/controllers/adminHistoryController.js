const { getAdminHistory, getAdminHistoryRetentionDays } = require("../utils/adminHistory");

exports.getHistory = async (req, res) => {
  try {
    const limit = Number(req.query?.limit || 20);
    const page = Number(req.query?.page || 1);
    const q = String(req.query?.q || "").trim();
    const data = await getAdminHistory({ page, limit, q });
    data.retentionDays = Number(getAdminHistoryRetentionDays() || 15);
    return res.json({ success: true, data });
  } catch (_) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
