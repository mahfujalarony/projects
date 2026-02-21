const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const MobileBanking = sequelize.define(
  "MobileBanking",
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING(120), allowNull: false, unique: true },
    imgUrl: { type: DataTypes.STRING(255), allowNull: false },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  {
    tableName: "MobileBankings",
    timestamps: true,
  }
);

module.exports = MobileBanking;
