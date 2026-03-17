// models/SubAdminPermission.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");
const PERMISSIONS = [
  "edit_products",
  "create_products",
  "manage_order",
  "manage_offer",
  "manage_catagory",
  "manage_catagoy",
  "manage_merchant",
  "manage_users",
  "manage_support_chat",
  "manage_balance_topup",
  "manage_wallet",
];
const SubAdminPermission = sequelize.define(
  "SubAdminPermission",
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },

    userId: { type: DataTypes.INTEGER, allowNull: false },

    //  ENUM: permission type safe
    permKey: {
      type: DataTypes.ENUM(...PERMISSIONS),
      allowNull: false,
    },
  },
  {
    tableName: "SubAdminPermissions",
    timestamps: true,
    indexes: [{ unique: true, fields: ["userId", "permKey"] }],
  }
);

module.exports = SubAdminPermission;
