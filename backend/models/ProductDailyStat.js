const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const ProductDailyStat = sequelize.define(
  "ProductDailyStat",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

    productId: { type: DataTypes.INTEGER, allowNull: false },

    // YYYY-MM-DD (BD time)
    statDate: { type: DataTypes.DATEONLY, allowNull: false },

    views: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    addToCart: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },

    purchases: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }, // order count
    soldQty: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },   // total qty sold
    revenue: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
  },
  {
    timestamps: true,
    indexes: [
      { fields: ["productId", "statDate"], unique: true },
      { fields: ["statDate"] },
      { fields: ["productId"] },
    ],
  }
);

module.exports = ProductDailyStat;
