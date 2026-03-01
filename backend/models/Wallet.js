// models/Wallet.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Wallet = sequelize.define(
  "Wallet",
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },

    // FK -> MobileBanking.id
    mobileBankingId: { type: DataTypes.INTEGER, allowNull: false },

    // wallet name under a provider (unique per provider)
    name: { type: DataTypes.STRING(120), allowNull: false },

    // public = everyone sees, private = only one user sees
    visibility: {
      type: DataTypes.ENUM("public", "private"),
      allowNull: false,
      defaultValue: "public",
    },

    imgUrl: { type: DataTypes.STRING(500), allowNull: true },

    // private wallet হলে ownerUserId লাগবে
    // FK -> Authentication/User table
    ownerUserId: { type: DataTypes.INTEGER, allowNull: true },

    // optional note/terms/description
    note: { type: DataTypes.STRING(500), allowNull: true },

    sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },

    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  {
    tableName: "Wallets",
    timestamps: true,
    indexes: [
      // wallet name unique within same mobile banking provider
      { unique: true, fields: ["mobileBankingId", "name"] },

      // useful filters
      { fields: ["mobileBankingId"] },
      { fields: ["visibility"] },
      { fields: ["ownerUserId"] },
      { fields: ["isActive"] },
    ],
    validate: {
      privateWalletMustHaveOwner() {
        if (this.visibility === "private" && !this.ownerUserId) {
          throw new Error("Private wallet ownerUserId needs to be set");
        }
        if (this.visibility === "public" && this.ownerUserId) {
          throw new Error("Public wallet should not have ownerUserId sets");
        }
      },
    },
  }
);


module.exports = Wallet;

