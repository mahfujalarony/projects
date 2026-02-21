const jwt = require("jsonwebtoken");

const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      role: user.role,
      name: user.name,
      email: user.email ?? null,
      phone: user.phone ?? null,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );
};

const pickSafeUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email ?? null,
  phone: user.phone ?? null,
  role: user.role,
  balance: user.balance,
  imageUrl: user.imageUrl ?? null,
});

const sendAuthSuccess = (res, user, message = "OK", statusCode = 200) => {
  const token = generateToken(user);

  return res.status(statusCode).json({
    success: true,
    message,
    data: {
      user: pickSafeUser(user),
      token,
    },
  });
};

const sendError = (res, statusCode, message, errors = undefined) => {
  return res.status(statusCode).json({
    success: false,
    message,
    ...(errors ? { errors } : {}),
  });
};

module.exports = { generateToken, pickSafeUser, sendAuthSuccess, sendError };
