const SubAdminPermission = require("../models/SubAdminPermission");

function requireAdminOrSubAdminPermission(permKey) {
  return async (req, res, next) => {
    try {
      const role = req.user?.role;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }

      if (role === "admin") return next();

      if (role !== "subadmin") {
        return res.status(403).json({ success: false, message: "Forbidden" });
      }

      // If no specific permission key is provided, any subadmin can pass.
      if (!permKey) {
        return next();
      }

      const found = await SubAdminPermission.findOne({
        where: { userId, permKey },
        attributes: ["id"],
      });

      if (!found) {
        return res.status(403).json({ success: false, message: "Permission denied" });
      }

      return next();
    } catch (err) {

      return res.status(500).json({ success: false, message: "Server error" });
    }
  };
}

module.exports = requireAdminOrSubAdminPermission;
