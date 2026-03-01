// backend/models/GiftCard.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const GiftCard = sequelize.define('GiftCard', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  code: {
    type: DataTypes.STRING(20),
    allowNull: false,
    unique: true,
    // Format: GIFT-XXXX-XXXX
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: { min: 1 },
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  // Who created this gift card
  createdBy: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'Users', key: 'id' },
  },
  // Who this gift card is sent to (by email - they may not be registered yet)
  recipientEmail: {
    type: DataTypes.STRING(150),
    allowNull: true,
    validate: { isEmail: true },
  },
  // Who claimed it (user id after claim)
  claimedBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'Users', key: 'id' },
  },
  status: {
    type: DataTypes.ENUM('active', 'claimed', 'expired'),
    defaultValue: 'active',
  },
  claimedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'gift_cards',
  timestamps: true,
});

module.exports = GiftCard;
