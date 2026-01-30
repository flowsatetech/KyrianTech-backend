/** IMPORT
 * All libraries / local exports / packages are imported here
 */

// <-- PACKAGE IMPORTS -->
const express = require('express');

// <-- LOCAL EXPORTS IMPORTS -->
const middlewares = require('../middlewares');
const helpers = require('../helpers');
const { logger } = require('../helpers');
const db = require('../db');


/** SETUP
 * Global variables referenced in this file are defined here
 */
const router = express.Router();
const product_fetch_limit = parseInt(process.env.PRODUCT_FETCH_LIMIT) || 30;

/** MAIN AUTH ROUTES */
router.get('/:productId/info', middlewares.authMiddleware, async (req, res) => {
    try {
        const { productId } = req.params;
        const $d = await db.getProduct(productId);
        if(!$d) return res.status(400).json({
            success: false,
            message: 'Couldn\'t Get product details',
            data: {
                error: 'Product ID is invalid'
            }
        })
        const { _id, ...product } = $d; // Extract mongodb's internal id
        res.status(200).json({
            success: true,
            message: 'Retrieved Product Details',
            data: {
                product
            }
        })
    } catch (e) {
        logger('SIGNIN').error(e);
        res.status(400).json({
            success: false, message: 'An unknown error occured'
        })
    }
});

router.post('/filter', middlewares.authMiddleware, async (req, res) => {
    try {
        const { name, brand, minPrice, maxPrice, category, limit } = req.body;
        const query = {};
        if (name) {
            query.name = name;
        }
        if (brand) {
            query.brand = brand;
        }
        if (category) {
            query.category = category;
        }
        if (minPrice || maxPrice) {
            query.price = {};
            if (minPrice) query.price.$gte = parseFloat(minPrice);
            if (maxPrice) query.price.$lte = parseFloat(maxPrice);
        }
        
        const fetchLimit = Math.min(parseInt(limit) || product_fetch_limit, product_fetch_limit);
        const products = await db.filterProducts(query, fetchLimit);
            
        res.status(200).json({
            success: true,
            message: `Found ${products.length} products matching criteria`,
            data: {
                products: products.map(({ _id, ...rest }) => rest) // Exclude internal Mongo ID
            }
        });

    } catch (e) {
        logger('FILTER_PRODUCTS').error(e);
        res.status(500).json({
            success: false, 
            message: 'An error occurred while filtering products'
        });
    }
});

/** EXPORTS
 * Export Routes for use in routers
 */
module.exports = router;