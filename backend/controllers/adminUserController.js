// controllers/adminUserController.js
const { Op } = require("sequelize");
const User = require("../models/Authentication"); // তোমার User model
const SubAdminPermission = require("../models/SubAdminPermission");
const bcrypt = require("bcryptjs");
const { toMoney2 } = require("../utils/money");
const { appendAdminHistory } = require("../utils/adminHistory");

const ALLOWED_SUBADMIN_PERMISSIONS = new Set([
  "edit_products",
  "create_products",
  "manage_order",
  "manage_offer",
  "manage_catagory",
  "manage_catagoy",
  "manage_merchant",
  "manage_users",
  "manage_support_chat",
  "manage_balance_topup",
  "manage_wallet",
]);

const clampInt = (v, d) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : d;
};

exports.adminGetUsers = async (req, res) => {
  try {
    const page = clampInt(req.query.page, 1);
    const limit = clampInt(req.query.limit, 20);
    const q = (req.query.q || "").trim();
    const role = (req.query.role || "").trim();
    const sort = (req.query.sort || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";
    const offset = (page - 1) * limit;

    const where = {};
    if (role) where.role = role;

    if (q) {
      where[Op.or] = [
        { name: { [Op.like]: `%${q}%` } },
        { email: { [Op.like]: `%${q}%` } },
      ];
    }

    const { count, rows } = await User.findAndCountAll({
      where,
      attributes: [
        "id",
        "name",
        "email",
        "role",
        "balance",
        "imageUrl",
        "topupBlockedUntil",
        "createdAt",
        "updatedAt",
      ],
      order: [["createdAt", sort]],
      limit,
      offset,
    });

    return res.json({
      success: true,
      page,
      limit,
      total: count,
      users: rows,
    });
  } catch (e) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.adminGetUserById = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ success: false, message: "Invalid user id" });
    }

    const user = await User.findByPk(id, {
      attributes: [
        "id",
        "name",
        "email",
        "role",
        "balance",
        "imageUrl",
        "topupBlockedUntil",
        "createdAt",
        "updatedAt",
      ],
    });

    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    return res.json({ success: true, user });
  } catch (e) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.adminUpdateUser = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ success: false, message: "Invalid user id" });
    }

    const { name, email, role, balance, imageUrl, password } = req.body || {};

    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const actorId = req.user?.id || req.userId || null;
    const before = {
      name: user.name,
      email: user.email,
      role: user.role,
      balance: Number(user.balance || 0),
      imageUrl: user.imageUrl || null,
    };
    const oldRole = user.role;

    // ✅ Basic validations
    if (email !== undefined) {
      const em = String(email).trim().toLowerCase();
      if (!em || !em.includes("@")) {
        return res.status(400).json({ success: false, message: "Invalid email" });
      }
      // unique email check (excluding current)
      const exists = await User.findOne({ where: { email: em, id: { [Op.ne]: id } } });
      if (exists) return res.status(409).json({ success: false, message: "Email already in use" });
      user.email = em;
    }

    if (name !== undefined) user.name = String(name).trim();
    if (imageUrl !== undefined) user.imageUrl = String(imageUrl).trim() || null;

    // ✅ Password update logic
    if (password !== undefined && String(password).trim() !== "") {
      user.password = await bcrypt.hash(String(password).trim(), 10);
    }

    if (role !== undefined) {
      const r = String(role).trim();
      const allowed = ["user", "admin", "merchant", "subadmin"];
      if (!allowed.includes(r)) {
        return res.status(400).json({ success: false, message: `Role must be: ${allowed.join(", ")}` });
      }
      user.role = r;
    }

    // ✅ balance direct set (admin)
    if (balance !== undefined) {
      const b = Number(balance);
      if (!Number.isFinite(b) || b < 0) {
        return res.status(400).json({ success: false, message: "Balance must be a non-negative number" });
      }
      const rounded = toMoney2(b);
      if (!rounded) {
        return res.status(400).json({ success: false, message: "Invalid balance" });
      }
      user.balance = rounded;
    }

    await user.save();

    // ✅ Handle SubAdminPermission: delete if demoted (no default permissions created on promotion)
    if (role !== undefined && user.role !== oldRole) {
      // যদি আগে subadmin থাকে এবং এখন রোল চেঞ্জ করে অন্য কিছু করা হয়, তাহলে সব পারমিশন ডিলিট হবে
      if (oldRole === "subadmin") {
        await SubAdminPermission.destroy({ where: { userId: user.id } });
      }
    }

    const after = {
      name: user.name,
      email: user.email,
      role: user.role,
      balance: Number(user.balance || 0),
      imageUrl: user.imageUrl || null,
    };
    await appendAdminHistory(
      `User #${user.id} updated by admin #${actorId || "unknown"}.`,
      {
        meta: {
          type: "admin_user_updated",
          actorId,
          userId: user.id,
          before,
          after,
        },
      }
    );

    return res.json({
      success: true,
      message: "User updated",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        balance: user.balance,
        imageUrl: user.imageUrl,
        topupBlockedUntil: user.topupBlockedUntil,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (e) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getSubAdminPermissions = async (req, res) => {
  try {
    const userId = Number(req.params.id);
    if (!userId) return res.status(400).json({ success: false, message: "Invalid user id" });

    const perms = await SubAdminPermission.findAll({
      where: { userId },
      attributes: ["permKey"],
    });

    return res.json({ success: true, permissions: perms.map((p) => p.permKey) });
  } catch (e) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.setSubAdminPermissions = async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const { permissions } = req.body; // array of strings like ['create_products', ...]

    if (!userId) return res.status(400).json({ success: false, message: "Invalid user id" });
    if (!Array.isArray(permissions)) return res.status(400).json({ success: false, message: "Permissions must be an array" });

    const cleaned = [...new Set(permissions.map((p) => String(p).trim()))].filter((p) =>
      ALLOWED_SUBADMIN_PERMISSIONS.has(p)
    );

    // 1. Delete old permissions
    const actorId = req.user?.id || req.userId || null;
    const previous = await SubAdminPermission.findAll({
      where: { userId },
      attributes: ["permKey"],
      raw: true,
    });
    const previousPermissions = previous.map((x) => x.permKey);

    // 1. Delete old permissions
    await SubAdminPermission.destroy({ where: { userId } });

    // 2. Insert new permissions
    if (cleaned.length > 0) {
      const rows = cleaned.map((p) => ({ userId, permKey: p }));
      await SubAdminPermission.bulkCreate(rows);
    }

    await appendAdminHistory(
      `Subadmin permissions updated for user #${userId} by admin #${actorId || "unknown"}.`,
      {
        meta: {
          type: "subadmin_permissions_updated",
          actorId,
          userId,
          before: previousPermissions,
          after: cleaned,
        },
      }
    );

    return res.json({ success: true, message: "Permissions updated", permissions: cleaned });
  } catch (e) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getSubAdminOwnPermissions = async (req, res) => {
  try {
    // protect middleware থেকে req.user পাওয়া যায়
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const perms = await SubAdminPermission.findAll({
      where: { userId },
      attributes: ["permKey"],
    });

    return res.json({ success: true, permissions: perms.map((p) => p.permKey) });
  } catch (e) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
