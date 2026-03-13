const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const HomeCache = sequelize.define(
  "HomeCache",
  {
    cacheKey: {
      type: DataTypes.STRING(191),
      allowNull: false,
      unique: true,
    },
    payload: {
      type: DataTypes.TEXT("long"),
      allowNull: false,
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    tableName: "home_caches",
    indexes: [{ fields: ["expiresAt"] }],
  }
);

module.exports = HomeCache;
