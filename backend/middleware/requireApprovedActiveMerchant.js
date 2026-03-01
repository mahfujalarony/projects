const Merchant = require("../models/MerchantProfile");

const SUSPEND_MESSAGE =
  "Your merchant account has been suspended. If you want to restore your account access, please contact support. Your previous data can be recovered after verification.";

module.exports = async function requireApprovedActiveMerchant(req, res, next) {
  try {
    const userId = req.user?.id || req.userId || req.user?.userId;
    if (!userId) return res.status(401).json({ ok: false, message: "Unauthorized" });

    const merchant = await Merchant.findOne({
      where: { userId },
      attributes: ["id", "status", "isApproved"],
    });

    if (!merchant) {
      return res.status(403).json({ ok: false, code: "MERCHANT_PROFILE_NOT_FOUND", message: "Merchant profile not found" });
    }

    if (!(merchant.status === "approved" && merchant.isApproved)) {
      return res.status(403).json({ ok: false, code: "MERCHANT_NOT_APPROVED", message: "Merchant approval required" });
    }

    if (req.user?.role !== "merchant") {
      return res.status(403).json({ ok: false, code: "MERCHANT_SUSPENDED", message: SUSPEND_MESSAGE });
    }

    next();
  } catch (err) {
    return res.status(500).json({ ok: false, message: "Server error" });
  }
};
