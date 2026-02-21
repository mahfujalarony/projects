const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Notification = sequelize.define(
  "Notification",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    // কার notification (user)
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      index: true,
    },

    // order | offer | delivery | wishlist | system etc.
    type: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: "system",
    },

    title: {
      type: DataTypes.STRING(180),
      allowNull: false,
    },

    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },

    // optional extra payload (orderId, productId, route, etc)
    meta: {
      type: DataTypes.JSON,
      allowNull: true,
    },

    // read status
    isRead: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    readAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "Notifications",
    timestamps: true,
  }
);

module.exports = Notification;
