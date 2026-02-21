module.exports = (sequelize, DataTypes) => {
  const Message = sequelize.define(
    "Message",
    {
      id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },

      conversationId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      senderId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false }, 

      type: { type: DataTypes.ENUM("text", "image", "file"), defaultValue: "text" },

      body: { type: DataTypes.TEXT("long"), allowNull: true },
      mediaUrl: { type: DataTypes.STRING(500), allowNull: true },
      meta: { type: DataTypes.JSON, allowNull: true },

      deliveredAt: { type: DataTypes.DATE, allowNull: true },
      readAt: { type: DataTypes.DATE, allowNull: true },
    },
    {
      tableName: "messages",
      timestamps: true,
      indexes: [
        { fields: ["conversationId"] },
        { fields: ["senderId"] },
        { fields: ["createdAt"] },
        { fields: ["conversationId", "id"] },
        { fields: ["conversationId", "senderId", "readAt"] },
      ],
    }
  );

  return Message;
};
