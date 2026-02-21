// models/WalletNumber.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const WalletNumber = sequelize.define(
  "WalletNumber",
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },

    // FK -> Wallet.id
    walletId: { type: DataTypes.INTEGER, allowNull: false },

    // bkash/nogod number (string রাখাই ভাল — leading zero থাকতে পারে)
    number: { type: DataTypes.STRING(40), allowNull: false },

    // optional label: "Personal", "Agent", "Merchant", etc.
    label: { type: DataTypes.STRING(80), allowNull: true },

    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  {
    tableName: "WalletNumbers",
    timestamps: true,
    indexes: [
      // same wallet এর মধ্যে number unique
      { unique: true, fields: ["walletId", "number"] },
      { fields: ["walletId"] },
      { fields: ["isActive"] },
    ],
  }
);

module.exports = WalletNumber;
