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

/** MAIN PRODUCTS ROUTES */
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
        const { name, brand, minPrice, maxPrice, category, limit, page = 1 } = req.body;
        if(typeof page !== 'number' || page < 1 || !Number.isInteger(page)) return res.status(400).json({
            success: false, message: 'Page number must be a positive integer'
        })
        const query = {};

        if (name) query.name = { $regex: name, $options: 'i' };
        if (brand) query.brand = brand;
        if (category) query.category = category;
        
        if (minPrice || maxPrice) {
            query.price = {};
            if (minPrice) query.price.$gte = parseFloat(minPrice);
            if (maxPrice) query.price.$lte = parseFloat(maxPrice);
        }
        
        const currentPage = Math.max(1, parseInt(page) || 1);
        const fetchLimit = Math.min(parseInt(limit) || product_fetch_limit, product_fetch_limit);
        const skip = (currentPage - 1) * fetchLimit;
        
        const { products, total } = await db.filterProducts(query, fetchLimit, skip);
            
        res.status(200).json({
            success: true,
            message: `Found ${products.length} products`,
            data: {
                products: products.map(({ _id, ...rest }) => rest),
                pagination: {
                    totalResults: total,
                    totalPages: Math.ceil(total / fetchLimit),
                    currentPage: currentPage,
                    pageSize: products.length
                }
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