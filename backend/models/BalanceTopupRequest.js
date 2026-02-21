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

    amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },

    transactionId: { type: DataTypes.STRING(120), allowNull: false, unique: true },

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
      { fields: ["userId"] },
      { fields: ["mobileBankingId"] },
      { fields: ["walletId"] },
      { fields: ["walletNumberId"] },
      { fields: ["status"] },
    ],
  }
);


const User = require("./Authentication");
const MobileBanking = require("./MobileBanking");
const Wallet = require("./Wallet");
const WalletNumber = require("./WalletNumber");

// Associations for admin include queries
if (!BalanceTopupRequest.associations.user) {
  BalanceTopupRequest.belongsTo(User, { as: "user", foreignKey: "userId" });
}
if (!BalanceTopupRequest.associations.provider) {
  BalanceTopupRequest.belongsTo(MobileBanking, { as: "provider", foreignKey: "mobileBankingId" });
}
if (!BalanceTopupRequest.associations.wallet) {
  BalanceTopupRequest.belongsTo(Wallet, { as: "wallet", foreignKey: "walletId" });
}
if (!BalanceTopupRequest.associations.walletNumber) {
  BalanceTopupRequest.belongsTo(WalletNumber, { as: "walletNumber", foreignKey: "walletNumberId" });
}
module.exports = BalanceTopupRequest;

