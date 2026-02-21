const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize("shop", "root", '', {
  host: 'localhost',
  dialect: 'mysql' 
});

async function testConnection() {
  try {
    await sequelize.authenticate();
    console.log('Connection has been established successfully.');
  } catch (error) {
    console.error('Unable to connect to the database:', error);
  }
}

testConnection();

module.exports = sequelize;