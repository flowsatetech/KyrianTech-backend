/** IMPORT
 * All libraries / local exports / packages are imported here
 */

// <-- PACKAGE IMPORTS -->
const express = require('express');
const { z } = require('zod');
const multer = require('multer');

// <-- LOCAL EXPORTS IMPORTS -->
const middlewares = require('../middlewares');
const helpers = require('../helpers');
const { slugify, logger } = require('../helpers');
const db = require('../db');


/** SETUP
 * Global variables referenced in this file are defined here
 */
const router = express.Router();
const product_fetch_limit = parseInt(process.env.PRODUCT_FETCH_LIMIT) || 30;

const upload = multer({
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'), false);
        }
    },
    storage: multer.memoryStorage()
});

const uploadMiddlewareHandler = upload.array('files');
const uploadMiddleware = (req, res, next) => {
    uploadMiddlewareHandler(req, res, (err) => {
        if (err) {
            return res.status(400).json({
                success: false,
                message: 'An error occured while uploading the image for this product',
                data: {
                    error: err.message
                }
            });
        }
        next();
    });
};

/** MAIN PRODUCTS ROUTES */
router.get('/:productId/info', middlewares.rateLimiters.products, async (req, res) => {
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

router.post('/filter', middlewares.rateLimiters.products, async (req, res) => {
    try {
        const validData = z.object({
            name: z.string().optional(),
            brand: z.string().optional(),
            minPrice: z.number().optional(),
            maxPrice: z.number().optional(),
            category: z.string().optional(),
            limit: z.number().optional(),
            page: z.number().optional(),
            sort: z.object().loose().optional()
        }).safeParse(req.body);

        if (!validData.success) {
            return res.status(400).json({
                success: false,
                message: 'Invalid request data'
            })
        }

        const { name, brand, minPrice, maxPrice, category, limit, page = 1, sort } = validData.data;

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

        if (sort) {
            let sortValue = {};
            const sortValues = {
                descending: -1,
                ascending: 1
            }
            Object.entries(sort).forEach(([key, value]) => {
                sortValue[key] = sortValues[value] || 1;
            })

            const products = await db.sortProducts(sortValue, fetchLimit);

            return res.status(200).json({
                success: true,
                message: `Found ${products.length} products`,
                data: {
                    products: products.map(({ _id, ...rest }) => rest)
                }
            });
        }

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

router.patch('/:productId/images', middlewares.authMiddleware, middlewares.adminOnly, uploadMiddleware, async (req, res) => {
    try {
        const { productId } = req.params;
        let product = await db.getProduct(productId);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }
        const slug = product.slug;
        if (!req.files || req.files.length === 0) {
            return res.json({
                success: false,
                message: 'No image file uploaded'
            })
        }
        const uploaded = await helpers.uploadImage(req.files, slug);

        await db.updateProductImages(productId, uploaded);
        const { _id, ...$product } = await db.getProduct(productId);

        res.status(201).json({
            success: true,
            message: 'Image added successfully',
            data: {
                product: $product
            }
        });
    } catch (e) {
        logger('ADD_PRODUCT_IMAGE').error(e);
        res.status(500).json({
            success: false,
            message: 'An error occurred while adding products'
        });
    }
});

router.post('/add', middlewares.authMiddleware, middlewares.adminOnly, async (req, res) => {
    try {
        const validData = z.array(
            z.object({
                name: z.string().min(1),
                description: z.string().min(1),
                brand: z.string().min(1),
                category: z.string().min(1),
                price: z.number().min(0),
                tags: z.array(z.string().min(1)).default([]),
                stock: z.number().int().min(0),
                rating: z.number().min(0).max(5).default(0),
                specs: z.object({}).loose()
            })
        ).safeParse(req.body);

        if (!validData.success) {
            return res.status(400).json({
                success: false,
                message: 'Invalid request data',
                data: {
                    errors: validData.error.flatten()
                }
            })
        }

        const finalData = validData.data.map(product => ({
            ...product,
            productId: helpers.generateToken(),
            createdAt: new Date(),
            slug: `${slugify(product.name)}-${slugify(product.category)}-${helpers.generateToken(6)}`
        }))

        await db.addProducts(finalData);

        res.status(201).json({
            success: true,
            message: 'Product added successfully',
            data: {
                products: finalData.map(({ _id, ...final }) => final)
            }
        });

    } catch (e) {
        logger('ADD_PRODUCTS').error(e);
        res.status(500).json({
            success: false,
            message: 'An error occurred while adding products'
        });
    }
});

/** EXPORTS
 * Export Routes for use in routers
 */
module.exports = router;