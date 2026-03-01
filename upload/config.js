module.exports = {
  PORT: 5001,
  BASE_URL: "http://localhost:5001",

  LIMITS: {
    IMAGE: 10 * 1024 * 1024 // 10MB
  },

  ALLOWED_IMAGES: ["image/jpeg", "image/png", "image/webp"]
};
