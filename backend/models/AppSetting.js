const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const AppSetting = sequelize.define("AppSetting", {
  key: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    primaryKey: true,
  },
  value: {
    type: DataTypes.TEXT, // JSON string হিসেবে ভ্যালু রাখব
    allowNull: true,
  },
}, {
  tableName: "AppSettings",
  timestamps: false,
});

module.exports = AppSetting;