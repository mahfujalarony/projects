// models/Offer.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Offer = sequelize.define(
  "Offer",
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },

    title: { type: DataTypes.STRING(120), allowNull: false },

    subtitle: { type: DataTypes.STRING(200), allowNull: true },
    description: { type: DataTypes.TEXT, allowNull: true },

    imageUrl: { type: DataTypes.STRING(500), allowNull: false },

    linkUrl: { type: DataTypes.STRING(500), allowNull: true },

    type: {
      type: DataTypes.ENUM("banner", "carousel", "popup"),
      allowNull: false,
      defaultValue: "carousel",
    },

    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },

    sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },


    startAt: { type: DataTypes.DATE, allowNull: true },
    endAt: { type: DataTypes.DATE, allowNull: true },
  },
  {
    tableName: "Offers",
    timestamps: true,
  }
);

module.exports = Offer;
