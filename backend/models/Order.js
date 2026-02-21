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

  status: {
    type: DataTypes.ENUM('pending', 'processing', 'shipped', 'delivered', 'cancelled'),
    defaultValue: 'pending',
  },
}, {
  tableName: 'order_items',  
  timestamps: true,
});

module.exports = OrderItem;
