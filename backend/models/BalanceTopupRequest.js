// models/BalanceTopupRequest.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const BalanceTopupRequest = sequelize.define(
  "BalanceTopupRequest",
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },

    userId: { type: DataTypes.INTEGER, allowNull: false },

    mobileBankingId: { type: DataTypes.INTEGER, allowNull: false },
    walletId: { type: DataTypes.INTEGER, allowNull: false },
    walletNumberId: { type: DataTypes.INTEGER, allowNull: false },

    // user যেই নাম্বার থেকে পাঠিয়েছে
    senderNumber: { type: DataTypes.STRING(40), allowNull: false },

    amount: { type: DataTypes.DECIMAL(18, 2), allowNull: false },

    transactionId: { type: DataTypes.STRING(120), allowNull: false },

    status: {
      type: DataTypes.ENUM("pending", "approved", "rejected"),
      allowNull: false,
      defaultValue: "pending",
    },

    adminNote: { type: DataTypes.STRING(500), allowNull: true },
  },
  {
    tableName: "BalanceTopupRequests",
    timestamps: true,
    indexes: [
      { fields: ["createdAt"] },
      { fields: ["status", "createdAt"] },
      { fields: ["transactionId"] },
      { fields: ["senderNumber"] },
      { fields: ["userId"] },
      { fields: ["mobileBankingId"] },
      { fields: ["walletId"] },
      { fields: ["walletNumberId"] },
      { fields: ["status"] },
    ],
  }
);
module.exports = BalanceTopupRequest;

