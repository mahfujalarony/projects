// models/Story.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Story = sequelize.define(
  "Story",
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },

    merchantId: { type: DataTypes.INTEGER, allowNull: false },

    // story slides (image urls)
    mediaUrls: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },

    title: { type: DataTypes.STRING(120), allowNull: true },
    productId: { type: DataTypes.INTEGER, allowNull: true },

    isActive: { type: DataTypes.BOOLEAN, defaultValue: true },

    // 24h expiry
    expiresAt: { type: DataTypes.DATE, allowNull: false },
  },
  { tableName: "Stories", timestamps: true }
);

module.exports = Story;
