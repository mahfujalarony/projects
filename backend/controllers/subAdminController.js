const User = require("../models/Authentication");
const SubAdminPermission = require("../models/SubAdminPermission");
const { appendAdminHistory } = require("../utils/adminHistory");

const PERMISSIONS = [
  "create_products",
  "edit_products",
  "manage_order",
  "manage_offer",
  "manage_catagory",
  "manage_merchant",
  "manage_users",
  "manage_support_chat",
  "manage_balance_topup",
  "manage_wallet",
];

const VALID = new Set(PERMISSIONS);

// ✅ list subadmins for dropdown
exports.getSubAdminList = async (req, res) => {
  try {
    const rows = await User.findAll({
      where: { role: "subadmin" },
      attributes: ["id", "name", "email"],
      order: [["id", "DESC"]],
    });
    res.json({ rows });
  } catch (e) {

    res.status(500).json({ message: "Server error" });
  }
};

// ✅ get permissions for one subadmin
exports.getSubAdminPermissions = async (req, res) => {
  try {
    const subAdminId = Number(req.params.id);
    const rows = await SubAdminPermission.findAll({
      where: { userId: subAdminId },
      attributes: ["permKey"],
      order: [["permKey", "ASC"]],
    });
    res.json({ permissions: rows.map(r => r.permKey) });
  } catch (e) {

    res.status(500).json({ message: "Server error" });
  }
};

// ✅ set permissions (তোমারটা)
exports.setSubAdminPermissions = async (req, res) => {
  try {
    const subAdminId = Number(req.params.id);
    const incoming = Array.isArray(req.body?.permissions) ? req.body.permissions : [];

    const clean = [...new Set(incoming.map(String))].filter((p) => VALID.has(p));
    const actorId = req.user?.id || req.userId || null;
    const previous = await SubAdminPermission.findAll({
      where: { userId: subAdminId },
      attributes: ["permKey"],
      raw: true,
    });

    const user = await User.findByPk(subAdminId);
    if (!user) return res.status(404).json({ message: "User not found" });

    await SubAdminPermission.destroy({ where: { userId: subAdminId } });

    if (clean.length) {
      await SubAdminPermission.bulkCreate(clean.map((permKey) => ({ userId: subAdminId, permKey })));
    }

    await appendAdminHistory(
      `Subadmin permissions updated for user #${subAdminId} by admin #${actorId || "unknown"}.`,
      {
        meta: {
          type: "subadmin_permissions_updated",
          actorId,
          userId: subAdminId,
          before: previous.map((x) => x.permKey),
          after: clean,
        },
      }
    );

    return res.json({ success: true, userId: subAdminId, permissions: clean });
  } catch (e) {


    if (e?.name === "SequelizeDatabaseError" || e?.name === "SequelizeValidationError") {
      return res.status(400).json({ message: "Invalid permission value" });
    }

    return res.status(500).json({ message: "Server error" });
  }
};
