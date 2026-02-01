/** IMPORT
 * All libraries / local exports / packages are imported here
 */

// <-- PACKAGE IMPORTS -->
const express = require('express');
const { z } = require('zod');

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
        const validData = z.object({
            productId: z.string().min(1)
        }).safeParse(req.params);

        if (!validData.success) {
            return res.status(400).json({
                success: false,
                message: 'Couldn\'t get product details'
            })
        }
        const { productId } = validData.data;
        
        const $d = await db.getProduct(productId);
        if (!$d) return res.status(400).json({
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
        const validData = z.object({
            name: z.string().optional(),
            brand: z.string().optional(),
            minPrice: z.number().optional(),
            maxPrice: z.number().optional(),
            category: z.string().optional(),
            limit: z.number().optional(),
            page: z.number().optional()
        }).safeParse(req.body);

        if (!validData.success) {
            return res.status(400).json({
                success: false,
                message: 'Invalid request data'
            })
        }
        
        const { name, brand, minPrice, maxPrice, category, limit, page = 1 } = validData.data;
        
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