const express = require('express');
const route = express.Router();
const { register, login, googleLogin, getMyBalance , pendingMerchants, approveOrRejectMerchant, getMerchantUsers, getRejectedMerchants,  addAddress, getCurrentUserAddresses, deleteAddress, getMyProfile, updateMyProfileImage, getPublicUserProfileById, getPublicUsersBatch } = require('../controllers/authController');
const  protect  = require('./../middleware/Middleware')
const { loginLimiter } = require("../middleware/rateLimits");


route.post('/register', register);
route.post('/login', loginLimiter, login);
route.post('/google', googleLogin);
route.post('/me/address', protect, addAddress);
route.get('/me', protect, getMyProfile);
route.patch('/me/image', protect, updateMyProfileImage);
route.get('/users/:id', protect, getPublicUserProfileById);
route.get('/users', protect, getPublicUsersBatch);
route.get('/me/address',  protect, getCurrentUserAddresses);
route.delete('/me/address/:id', protect, deleteAddress);
route.get('/me/balance',  protect, getMyBalance);


module.exports = route; 
