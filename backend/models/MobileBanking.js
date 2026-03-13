const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const MobileBanking = sequelize.define(
  "MobileBanking",
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING(120), allowNull: false, unique: true },
    imgUrl: { type: DataTypes.STRING(255), allowNull: false },
    // Local currency per 1 USD (e.g., 1 USD = 110.50 BDT)
    dollarRate: { type: DataTypes.DECIMAL(12, 6), allowNull: false, defaultValue: 1 },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  {
    tableName: "MobileBankings",
    timestamps: true,
  }
);

module.exports = MobileBanking;
