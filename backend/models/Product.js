const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const parseJsonArray = (value) => {
  const normalize = (arr) =>
    arr.map((item) => (typeof item === "string" ? item.replace(/\\/g, "/") : item));

  if (Array.isArray(value)) return normalize(value);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? normalize(parsed) : [];
    } catch {
      return [];
    }
  }
  return [];
};

const Product = sequelize.define(
  "Product",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

    name: { type: DataTypes.STRING, allowNull: false },

    description: { type: DataTypes.TEXT, allowNull: true },

    price: { type: DataTypes.DECIMAL(10, 2), allowNull: false },

    oldPrice: { type: DataTypes.DECIMAL(10, 2), allowNull: true },

    stock: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },

    //  OLD (keep for compatibility / search)
    category: { type: DataTypes.STRING, allowNull: true },
    subCategory: { type: DataTypes.STRING, allowNull: true },


    soldCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },


    soldBy: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
      get() {
        return parseJsonArray(this.getDataValue("soldBy"));
      },
      set(value) {
        this.setDataValue("soldBy", parseJsonArray(value));
      },
    },

    images: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
      get() {
        return parseJsonArray(this.getDataValue("images"));
      },
      set(value) {
        this.setDataValue("images", parseJsonArray(value));
      },
    },

  },
  { timestamps: true }
);

module.exports = Product;
