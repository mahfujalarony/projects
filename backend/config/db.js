const { Sequelize } = require('sequelize');
require('dotenv').config();

const DB_NAME = process.env.DATABASE_NAME || "shop";
const DB_USER = process.env.DATABASE_USER || "root";
const DB_PASSWORD = process.env.DATABASE_PASSWORD || "";
const DB_HOST = process.env.DATABASE_HOST || "localhost";
const DB_DIALECT = process.env.DATABASE_DIALECT || "mysql";

const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASSWORD, {
  host: DB_HOST,
  dialect: DB_DIALECT,
});

async function testConnection() {
  try {
    await sequelize.authenticate();
  } catch (error) {

  }
}

testConnection();

module.exports = sequelize;
