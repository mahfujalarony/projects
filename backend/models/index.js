const User = require("./Authentication");
const Address = require("./Address");
const OrderItem = require("./Order");
const MerchantProfile = require("./MerchantProfile");
const Product = require("./Product");
const MerchentStore = require("./MerchentStore");
const ProductDailyStat = require("./ProductDailyStat");
const Review = require("./Review");
const Story = require("./Story");
const Category = require("./Category");
const SubCategory = require("./SubCategory");
const MobileBanking = require("./MobileBanking");
const Wallet = require("./Wallet");
const WalletNumber = require("./WalletNumber");
const BalanceTopupRequest = require("./BalanceTopupRequest");
const GiftCard = require("./GiftCard");
const AppSetting = require("./AppSetting");
const Notification = require("./Notification");
const Offer = require("./Offer");
const SubAdminPermission = require("./SubAdminPermission");
const HomeCache = require("./HomeCache");
const AdminHistory = require("./AdminHistory");

// User <-> Address
User.hasMany(Address, { foreignKey: "userId" });
Address.belongsTo(User, { foreignKey: "userId" });

// User <-> OrderItem
User.hasMany(OrderItem, { foreignKey: "userId" });
OrderItem.belongsTo(User, { foreignKey: "userId" });

// Address <-> OrderItem
Address.hasMany(OrderItem, { foreignKey: "addressId" });
OrderItem.belongsTo(Address, { foreignKey: "addressId" });

// User <-> MerchantProfile
User.hasOne(MerchantProfile, { foreignKey: "userId", as: "merchantProfile" });
MerchantProfile.belongsTo(User, { foreignKey: "userId", as: "user" });

// Merchant(User) <-> MerchentStore
User.hasMany(MerchentStore, { foreignKey: "merchantId", as: "products" });
MerchentStore.belongsTo(User, { foreignKey: "merchantId", as: "merchant" });

// MerchentStore <-> Review
MerchentStore.hasMany(Review, { foreignKey: "productId", as: "reviews" });
Review.belongsTo(MerchentStore, { foreignKey: "productId", as: "product" });

// User <-> Review
User.hasMany(Review, { foreignKey: "userId", as: "reviews" });
Review.belongsTo(User, { foreignKey: "userId", as: "user" });

// MerchentStore <-> ProductDailyStat
MerchentStore.hasMany(ProductDailyStat, { foreignKey: "productId", as: "stats" });
ProductDailyStat.belongsTo(MerchentStore, { foreignKey: "productId", as: "product" });

// Category <-> SubCategory
Category.hasMany(SubCategory, {
  foreignKey: "categoryId",
  as: "subCategories",
  onDelete: "CASCADE",
});
SubCategory.belongsTo(Category, {
  foreignKey: "categoryId",
  as: "category",
});

// SubCategory tree (self relation)
SubCategory.hasMany(SubCategory, {
  foreignKey: "parentSubCategoryId",
  as: "children",
  onDelete: "CASCADE",
});
SubCategory.belongsTo(SubCategory, {
  foreignKey: "parentSubCategoryId",
  as: "parent",
});

// MobileBanking <-> Wallet
MobileBanking.hasMany(Wallet, {
  as: "wallets",
  foreignKey: "mobileBankingId",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});
Wallet.belongsTo(MobileBanking, {
  as: "provider",
  foreignKey: "mobileBankingId",
});

// Wallet <-> WalletNumber
Wallet.hasMany(WalletNumber, {
  as: "numbers",
  foreignKey: "walletId",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});
WalletNumber.belongsTo(Wallet, {
  as: "wallet",
  foreignKey: "walletId",
});

// User <-> Wallet (private owner)
User.hasMany(Wallet, {
  as: "myWallets",
  foreignKey: "ownerUserId",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});
Wallet.belongsTo(User, {
  as: "owner",
  foreignKey: "ownerUserId",
});

// Topup relations
BalanceTopupRequest.belongsTo(User, { as: "user", foreignKey: "userId" });
BalanceTopupRequest.belongsTo(MobileBanking, { as: "provider", foreignKey: "mobileBankingId" });
BalanceTopupRequest.belongsTo(Wallet, { as: "wallet", foreignKey: "walletId" });
BalanceTopupRequest.belongsTo(WalletNumber, { as: "walletNumber", foreignKey: "walletNumberId" });

// GiftCard relations
GiftCard.belongsTo(User, { foreignKey: "createdBy", as: "creator" });
GiftCard.belongsTo(User, { foreignKey: "claimedBy", as: "claimer" });

// Story relations
Story.belongsTo(MerchantProfile, { as: "merchant", foreignKey: "merchantId" });
MerchantProfile.hasMany(Story, { as: "stories", foreignKey: "merchantId" });

module.exports = {
  User,
  Address,
  OrderItem,
  MerchantProfile,
  Product,
  MerchentStore,
  ProductDailyStat,
  Review,
  Story,
  Category,
  SubCategory,
  MobileBanking,
  Wallet,
  WalletNumber,
  BalanceTopupRequest,
  GiftCard,
  AppSetting,
  Notification,
  Offer,
  SubAdminPermission,
  HomeCache,
  AdminHistory,
};
