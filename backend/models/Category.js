const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Category = sequelize.define(
  "Category",
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING(120), allowNull: false },
    slug: { type: DataTypes.STRING(140), allowNull: false, unique: true },
    imageUrl: { type: DataTypes.STRING(255), allowNull: true },
    icon: { type: DataTypes.STRING(80), allowNull: true },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
  },
  { tableName: "Categories", timestamps: true }
);

module.exports = Category;
