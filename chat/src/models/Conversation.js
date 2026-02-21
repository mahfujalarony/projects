module.exports = (sequelize, DataTypes) => {
  const Conversation = sequelize.define(
    "Conversation",
    {
      id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },

      // ecommerce user id (from JWT payload)
      customerId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      isGuestCustomer: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      guestSessionKey: { type: DataTypes.STRING(120), allowNull: true },
      guestName: { type: DataTypes.STRING(120), allowNull: true },
      guestEmail: { type: DataTypes.STRING(180), allowNull: true },
      guestPhone: { type: DataTypes.STRING(40), allowNull: true },
      guestSubject: { type: DataTypes.STRING(200), allowNull: true },
      isBlocked: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      blockedAt: { type: DataTypes.DATE, allowNull: true },
      blockedById: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
      blockReason: { type: DataTypes.STRING(300), allowNull: true },

      // optional: assigned support/admin (user id)
      agentId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },

      status: { type: DataTypes.ENUM("open", "pending", "closed"), defaultValue: "open" },

      // optional: product chat context
      contextType: { type: DataTypes.ENUM("support", "product"), defaultValue: "support" },
      contextId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true }, // productId

      lastMessageAt: { type: DataTypes.DATE, allowNull: true },
    },
    {
      tableName: "conversations",
      timestamps: true,
      indexes: [
        { fields: ["customerId"] },
        { fields: ["agentId"] },
        { fields: ["status"] },
        { fields: ["isBlocked", "lastMessageAt"] },
        { fields: ["lastMessageAt"] },
        { fields: ["contextType", "contextId"] },
        { fields: ["isGuestCustomer", "guestSessionKey"] },
        { fields: ["contextType", "lastMessageAt", "id"] },
        { fields: ["contextType", "customerId", "lastMessageAt", "id"] },
      ],
    }
  );

  return Conversation;
};
