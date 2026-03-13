const { getAdminHistory } = require("../utils/adminHistory");

exports.getHistory = async (req, res) => {
  try {
    const limit = Number(req.query?.limit || 100);
    const items = await getAdminHistory({ limit });
    return res.json({ success: true, data: items });
  } catch (_) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
