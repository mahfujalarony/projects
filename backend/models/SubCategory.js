// models/SubCategory.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const SubCategory = sequelize.define(
  "SubCategory",
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },

    categoryId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    parentSubCategoryId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    name: { type: DataTypes.STRING(120), allowNull: false },

    slug: { type: DataTypes.STRING(160), allowNull: false },
    imageUrl: { type: DataTypes.STRING(500), allowNull: true },

    isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
  },
  {
    tableName: "SubCategories",
    timestamps: true,
    indexes: [
      { unique: true, fields: ["categoryId", "slug"] },
      { fields: ["parentSubCategoryId"] },
    ],
  }
);

module.exports = SubCategory;
