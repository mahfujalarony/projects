const User = require('./Authentication');
const Address = require('./Address');
const Order = require('./Order');
const OrderItem = require('./OrderItem');
const MobileBanking = require('./MobileBanking');
const Wallet = require('./Wallet');
const WalletNumber = require('./WalletNumber');

// User ↔ Address
User.hasMany(Address, { foreignKey: 'userId' });
Address.belongsTo(User, { foreignKey: 'userId' });

// User ↔ Order
User.hasMany(Order, { foreignKey: 'userId' });
Order.belongsTo(User, { foreignKey: 'userId' });

// Address ↔ Order
Address.hasMany(Order, { foreignKey: 'addressId' });
Order.belongsTo(Address, { foreignKey: 'addressId' });

// Order ↔ OrderItem
Order.hasMany(OrderItem, { foreignKey: 'orderId' });
OrderItem.belongsTo(Order, { foreignKey: 'orderId' });

// MobileBanking -> Wallet
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

// Wallet -> WalletNumber
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

// User -> Wallet (private owner)
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

module.exports = { User, Address, Order, OrderItem, MobileBanking, Wallet, WalletNumber };