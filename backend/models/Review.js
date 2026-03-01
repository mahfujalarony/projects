// models/Review.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const parseJsonArray = (value) => {
  const normalize = (arr) =>
    arr.map((item) => (typeof item === "string" ? item.replace(/\\/g, "/") : item));

  if (Array.isArray(value)) return normalize(value);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? normalize(parsed) : [];
    } catch {
      return [];
    }
  }
  return [];
};

const Review = sequelize.define(
  "Review",
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },

    userId: { type: DataTypes.INTEGER, allowNull: false },
    productId: { type: DataTypes.INTEGER, allowNull: false },

    rating: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { min: 1, max: 5 },
    },

    title: { type: DataTypes.STRING(120), allowNull: true },
    comment: { type: DataTypes.TEXT, allowNull: true },

    // optional: review images
    images: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
      get() {
        return parseJsonArray(this.getDataValue("images"));
      },
      set(value) {
        this.setDataValue("images", parseJsonArray(value));
      },
    },

    isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
  },
  {
    tableName: "reviews",
    timestamps: true,
    indexes: [
      // user same product এ ১টাই review (simple rule)
      { unique: true, fields: ["userId", "productId"] },
      { fields: ["productId"] },
      { fields: ["userId"] },
    ],
  }
);

module.exports = Review;
