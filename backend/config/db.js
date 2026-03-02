const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize("shop", "root", '', {
  host: 'localhost',
  dialect: 'mysql' 
});

async function testConnection() {
  try {
    await sequelize.authenticate();
  } catch (error) {

  }
}

testConnection();

module.exports = sequelize;