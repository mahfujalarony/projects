const { Sequelize, DataTypes } = require("sequelize");

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    host: process.env.DB_HOST,
    dialect: process.env.DB_DIALECT || "mysql",
    logging: false,
  }
);

const Conversation = require("./Conversation")(sequelize, DataTypes);
const Message = require("./Message")(sequelize, DataTypes);

// relations
Conversation.hasMany(Message, { as: "messages", foreignKey: "conversationId" });
Message.belongsTo(Conversation, { as: "conversation", foreignKey: "conversationId" });

module.exports = { sequelize, Conversation, Message };
