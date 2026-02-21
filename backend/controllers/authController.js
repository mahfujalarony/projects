const Merchant = require('../models/MerchantProfile');
const User = require('./../models/Authentication');
const jwt = require('jsonwebtoken');
const { Op } = require("sequelize");
const sequelize = require('../config/db');
const Address = require('../models/Address');
const OrderItem = require('../models/Order');
const bcrypt = require('bcryptjs');
const { OAuth2Client } = require("google-auth-library");
const { sendAuthSuccess, sendError } = require("../utils/authResponse");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeEmail = (value) => {
  const str = String(value || "").trim().toLowerCase();
  if (!str) return null;
  return EMAIL_REGEX.test(str) ? str : null;
};

const normalizePhone = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const cleaned = raw.replace(/[^\d+]/g, "");
  return cleaned || null;
};

const isLikelyEmail = (value) => EMAIL_REGEX.test(String(value || "").trim());
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);


exports.register = async (req, res) => {
  try {
    const { name, email, phone, password, imageUrl } = req.body;
    const normalizedEmail = normalizeEmail(email);
    const normalizedPhone = normalizePhone(phone);

    if (!name || !password) {
      return sendError(res, 400, "name and password required");
    }

    if (!normalizedEmail && !normalizedPhone) {
      return sendError(res, 400, "email or phone number is required");
    }

    if (email && !normalizedEmail) {
      return sendError(res, 400, "Invalid email format");
    }

    if (normalizedEmail) {
      const emailExists = await User.findOne({ where: { email: normalizedEmail } });
      if (emailExists) {
        return sendError(res, 409, "Email already exists");
      }
    }

    if (normalizedPhone) {
      const phoneExists = await User.findOne({ where: { phone: normalizedPhone } });
      if (phoneExists) {
        return sendError(res, 409, "Phone number already exists");
      }
    }

    const hashed = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email: normalizedEmail,
      phone: normalizedPhone,
      password: hashed,
      imageUrl: imageUrl || null,
    });

    // ✅ same format
    return sendAuthSuccess(res, user, "User registered successfully", 201);
  } catch (err) {
    console.error(err);
    return sendError(res, 500, "Server error");
  }
};

exports.login = async (req, res) => {
  try {
    const { emailOrPhone, email, password } = req.body;
    const loginId = String(emailOrPhone || email || "").trim();

    if (!loginId || !password) {
      return sendError(res, 400, "email/phone and password required");
    }

    let whereClause;
    if (isLikelyEmail(loginId)) {
      const normalizedEmail = normalizeEmail(loginId);
      if (!normalizedEmail) return sendError(res, 400, "Invalid email format");
      whereClause = { email: normalizedEmail };
    } else {
      const normalizedPhone = normalizePhone(loginId);
      if (!normalizedPhone) return sendError(res, 400, "Invalid phone number format");
      whereClause = { phone: normalizedPhone };
    }

    const user = await User.findOne({ where: whereClause });
    if (!user) return sendError(res, 401, "Invalid email/phone or password");

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return sendError(res, 401, "Invalid email/phone or password");

    // ✅ same format
    return sendAuthSuccess(res, user, "Login successful", 200);
  } catch (error) {
    console.error(error);
    return sendError(res, 500, "Server error");
  }
};


exports.getMyProfile = async (req, res) => {
  try {
    const userId = req.user?.id || null;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const user = await User.findByPk(userId, {
      attributes: ["id", "name", "email", "phone", "role", "balance", "imageUrl"],
    });

    if (!user) return sendError(res, 404, "User not found");

    return sendAuthSuccess(res, user, "Profile fetched successfully", 200);
  } catch (err) {
    console.error(err);
    return sendError(res, 500, "Server error");
  }
};

exports.googleLogin = async (req, res) => {
  try {
    const credential = String(req.body?.credential || "").trim();
    if (!credential) {
      return sendError(res, 400, "Google credential is required");
    }

    if (!process.env.GOOGLE_CLIENT_ID) {
      return sendError(res, 500, "GOOGLE_CLIENT_ID is not configured");
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const email = normalizeEmail(payload?.email);
    const emailVerified = Boolean(payload?.email_verified);

    if (!email || !emailVerified) {
      return sendError(res, 401, "Google account email is not verified");
    }

    let user = await User.findOne({ where: { email } });

    if (!user) {
      const fallbackPassword = await bcrypt.hash(`google_${payload?.sub || Date.now()}`, 10);
      user = await User.create({
        name: String(payload?.name || email.split("@")[0] || "Google User").trim(),
        email,
        phone: null,
        password: fallbackPassword,
        imageUrl: payload?.picture || null,
      });
    } else if (!user.imageUrl && payload?.picture) {
      user.imageUrl = payload.picture;
      await user.save();
    }

    return sendAuthSuccess(res, user, "Google login successful", 200);
  } catch (error) {
    console.error("Google login error:", error);
    return sendError(res, 401, "Invalid Google credential");
  }
};

exports.updateMyProfileImage = async (req, res) => {
  try {
    const userId = req.user?.id || null;
    if (!userId) return sendError(res, 401, "Unauthorized");

    const imageUrl = String(req.body?.imageUrl || "").trim();
    if (!imageUrl) return sendError(res, 400, "imageUrl is required");

    const user = await User.findByPk(userId);
    if (!user) return sendError(res, 404, "User not found");

    user.imageUrl = imageUrl;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Profile image updated",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        balance: user.balance,
        imageUrl: user.imageUrl,
      },
    });
  } catch (err) {
    console.error(err);
    return sendError(res, 500, "Server error");
  }
};

exports.getPublicUserProfileById = async (req, res) => {
  try {
    const userId = Number(req.params.id);
    if (!userId) return sendError(res, 400, "Invalid user id");

    const user = await User.findByPk(userId, {
      attributes: ["id", "name", "role", "imageUrl", "balance", "createdAt"],
    });

    if (!user) return sendError(res, 404, "User not found");

    const orders = await OrderItem.findAll({
      where: { userId },
      attributes: [
        "id",
        "productId",
        "name",
        "price",
        "quantity",
        "status",
        "paymentStatus",
        "createdAt",
      ],
      order: [["createdAt", "DESC"]],
      limit: 20,
    });

    const totalOrders = await OrderItem.count({ where: { userId } });
    const deliveredOrders = await OrderItem.count({ where: { userId, status: "delivered" } });
    const cancelledOrders = await OrderItem.count({ where: { userId, status: "cancelled" } });

    const totalSpent = orders.reduce((sum, o) => {
      const price = Number(o.price || 0);
      const qty = Number(o.quantity || 0);
      return sum + price * qty;
    }, 0);

    return res.status(200).json({
      success: true,
      user,
      stats: {
        totalOrders,
        deliveredOrders,
        cancelledOrders,
        totalSpent,
      },
      recentOrders: orders,
    });
  } catch (err) {
    console.error(err);
    return sendError(res, 500, "Server error");
  }
};

exports.getPublicUsersBatch = async (req, res) => {
  try {
    const rawIds = String(req.query.ids || "")
      .split(",")
      .map((x) => Number(x.trim()))
      .filter((x) => Number.isFinite(x) && x > 0);

    const ids = [...new Set(rawIds)].slice(0, 100);
    if (!ids.length) {
      return res.status(200).json({ success: true, users: [] });
    }

    const users = await User.findAll({
      where: { id: { [Op.in]: ids } },
      attributes: ["id", "name", "role", "imageUrl", "createdAt"],
    });

    return res.status(200).json({ success: true, users });
  } catch (err) {
    console.error(err);
    return sendError(res, 500, "Server error");
  }
};

exports.getMyBalance = async (req, res) => {
  const userId = req.user?.id || req.userId;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const user = await User.findByPk(userId);
  if (!user) return res.status(404).json({ message: "User not found" });

  return res.json({ success: true, data: { balance: Number(user.balance || 0) } });
};



//address add korar jonno
exports.addAddress = async (req, res) => {
    try {
        const userId = req.user.id;
        console.log('Add Address Request for User ID:', userId);
        const { label, name, phone, line1, city, zip } = req.body;
        console.log('Address Data Received:', req.body);

        if(!phone || phone.trim() === '') {
            return res.status(400).json({ success: false, message: 'Phone number is required' });
        }

        if (!line1 || !city || !zip) {
            return res.status(400).json({ success: false, message: 'Line1, city, and zip are required' });
        }

        const newAddress = await Address.create({
            userId,
            label: label ? label.trim() : null,
            name: name ? name.trim() : null,
            phone: phone.trim(),
            line1: line1.trim(),
            city: city.trim(),
            zip: zip.trim(),
        });

        return res.status(201).json({
            success: true,
            message: 'Address added successfully',
            address: newAddress,
        });
    } catch (error) {
        console.error('ADD ADDRESS ERROR:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};


// get current user addresses
exports.getCurrentUserAddresses = async (req, res) => {
    try {
        const userId = req.user.id;
        console.log('Get Addresses Request for User ID:', userId);
        const addresses = await Address.findAll({
            where: { userId },
        });
        return res.status(200).json({
            success: true,
            addresses,
        });
    } catch (error) {
        console.error('GET ADDRESSES ERROR:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};
