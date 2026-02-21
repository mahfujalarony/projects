const express = require('express');
const route = express.Router();
const { createProduct, getPublicProductById, getPublicProducts, search } = require('../controllers/productController');
const { getHomeSections } = require('../controllers/Home');
const protect  = require('./../middleware/Middleware')


route.get("/", getPublicProducts);
route.get("/home", getHomeSections);
route.get('/search', search);

// upload a product for admin
route.post('/create', protect, createProduct);
route.get("/:id", getPublicProductById);



module.exports = route;