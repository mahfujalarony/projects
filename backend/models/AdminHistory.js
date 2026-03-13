const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const AdminHistory = sequelize.define(
  "AdminHistory",
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    message: {
      type: DataTypes.TEXT("long"),
      allowNull: false,
    },
    meta: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  {
    tableName: "AdminHistories",
    timestamps: true,
    indexes: [
      { fields: ["createdAt"] },
    ],
  }
);

module.exports = AdminHistory;
