const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");
const bcrypt = require("bcryptjs");

const User = sequelize.define(
  "User",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: true, unique: true },
    phone: { type: DataTypes.STRING, allowNull: true, unique: true },
    balance: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    password: { type: DataTypes.STRING, allowNull: false },
    imageUrl: { type: DataTypes.STRING, allowNull: true },
    role: {
      type: DataTypes.ENUM("admin", "merchant", "user", "subadmin"),
      allowNull: false,
      defaultValue: "user",
    }, 
  },
  { timestamps: true }
);

User.prototype.matchPassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

try {
  const MerchantProfile = require("./MerchantProfile");
  User.hasOne(MerchantProfile, { foreignKey: "userId", as: "merchantProfile" });
  MerchantProfile.belongsTo(User, { foreignKey: "userId", as: "user" });
} catch (e) {}

module.exports = User;
