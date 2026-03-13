const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const OrderItem = sequelize.define('OrderItem', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },


  addressId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },

  matchMerchantId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },

  orderGroupId: {
    type: DataTypes.STRING(60),
    allowNull: true,
  },

  paymentMethod: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  paymentStatus: {
    type: DataTypes.ENUM('paid'),
    allowNull: false,
    defaultValue: 'paid',
  },

  productId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },

  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },

  deliveryCharge: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00,
  },



  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },

  imageUrl: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  trackingNumber: {
    type: DataTypes.STRING(120),
    allowNull: true,
  },
  trackingNote: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },

  status: {
    type: DataTypes.ENUM('pending', 'processing', 'shipped', 'delivered', 'cancelled'),
    defaultValue: 'pending',
  },

  // Frozen at order-creation time so earnings stay correct even if admin changes the rate later
  commissionPercent: {
    type: DataTypes.DECIMAL(6, 2),
    allowNull: false,
    defaultValue: 0,
  },
  commissionAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
  },
}, {
  tableName: 'order_items',  
  timestamps: true,
});

module.exports = OrderItem;
