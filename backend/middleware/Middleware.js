// middleware/protect.js
const jwt = require("jsonwebtoken");
const User = require("../models/Authentication");
const { pickSafeUser, sendError } = require("../utils/authResponse");

const protect = async (req, res, next) => {
  let token;

  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  }

  if (!token) {
    return sendError(res, 401, "Not authorized, no token");
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findByPk(decoded.id);
    if (!user) return sendError(res, 401, "Not authorized, user not found");

    // req.user এ safe user রাখি (password বাদ)
    req.user = pickSafeUser(user);

    return next();
  } catch (error) {
    return sendError(res, 401, "Not authorized, token failed");
  }
};

module.exports = protect;
