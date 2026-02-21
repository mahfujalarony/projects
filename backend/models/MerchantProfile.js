const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");
// const merchantStore = require("./MerchentStore");

const MerchantProfile = sequelize.define(
  "Merchant",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.INTEGER, allowNull: false, unique: true },

    YourAddress: { type: DataTypes.STRING, allowNull: false },

    idNumber: { type: DataTypes.STRING, allowNull: false },
    idFrontImage: { type: DataTypes.STRING, allowNull: false },
    idBackImage: { type: DataTypes.STRING, allowNull: false },

    paypalEmail: { type: DataTypes.STRING, allowNull: true, validate: { isEmail: true } },
    stripeAccountId: { type: DataTypes.STRING, allowNull: true },
    bankName: { type: DataTypes.STRING, allowNull: true },
    accountNumber: { type: DataTypes.STRING, allowNull: true },
    swiftCode: { type: DataTypes.STRING, allowNull: true },

    status: { type: DataTypes.ENUM("pending", "approved", "rejected"), defaultValue: "pending" },
    isApproved: { type: DataTypes.BOOLEAN, defaultValue: false },

    description: { type: DataTypes.TEXT, allowNull: true },
    socialLinks: { type: DataTypes.JSON, allowNull: true },
    phoneNumber: { type: DataTypes.STRING, allowNull: true },

    averageRating: { type: DataTypes.FLOAT, defaultValue: 0 },
    totalReviews: { type: DataTypes.INTEGER, defaultValue: 0 },
  },
  {
    timestamps: true,
    validate: {
      atLeastOnePaymentMethod() {
        if (!this.paypalEmail && !this.stripeAccountId && !this.bankName) {
          throw new Error("At least one payment method is required (PayPal, Stripe, or Bank)");
        }
      },
    },
  }
);

// rejected হলে auto delete
MerchantProfile.addHook("beforeUpdate", async (merchant, options) => {
  if (merchant.changed("status") && merchant.status === "rejected") {
    await merchant.destroy({ transaction: options.transaction });
  }
});

// merchantStore.belongsTo(User, { foreignKey: "merchantId", as: "merchant" });
// User.hasMany(merchantStore, { foreignKey: "merchantId", as: "products" });

module.exports = MerchantProfile;
