const rateLimit = require("express-rate-limit");

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const loginLimiter = rateLimit({
  windowMs: TWO_HOURS_MS,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    message: "Too many login attempts. Please try again after 2 hours.",
  },
});

const giftCardClaimLimiter = rateLimit({
  windowMs: ONE_DAY_MS,
  max: 4,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => {
    // Get userId from body (for POST requests)
    const uid = req.body?.userId || req.user?.id || req.userId;
    if (uid) return `gift-claim:user:${uid}`;
    // Fallback to IP if no userId
    const ip = req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress;
    return `gift-claim:ip:${ip}`;
  },
  message: {
    success: false,
    message: "Too many failed gift card attempts. Please try again after 24 hours.",
  },
});

const giftCardVerifyLimiter = rateLimit({
  windowMs: ONE_DAY_MS,
  max: 4,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => {
    // Get userId from query (for GET requests)
    const uid = req.query?.userId || req.user?.id || req.userId;
    if (uid) return `gift-verify:user:${uid}`;
    // Fallback to IP if no userId
    const ip = req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress;
    return `gift-verify:ip:${ip}`;
  },
  message: {
    success: false,
    message: "Too many failed gift card attempts. Please try again after 24 hours.",
  },
});

module.exports = {
  loginLimiter,
  giftCardClaimLimiter,
  giftCardVerifyLimiter,
};
