module.exports = {
  PORT: 5001,
  BASE_URL: "http://localhost:5001",

  LIMITS: {
    IMAGE: 10 * 1024 * 1024,   // 10MB
    VIDEO: 100 * 1024 * 1024 // 100MB
  },

  ALLOWED_IMAGES: ["image/jpeg", "image/png", "image/webp"],
  ALLOWED_VIDEOS: ["video/mp4", "video/mkv"]
};
