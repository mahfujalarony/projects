const { DataTypes } = require("sequelize");
const sequelize = require("../config/db"); 

const Address = sequelize.define("Address", {
    id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  
  label: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  line1: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  city: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  zip: {
    type: DataTypes.STRING,
    allowNull: true,
  },
}, {
  tableName: "addresses", 
  timestamps: false,       
});

module.exports = Address;