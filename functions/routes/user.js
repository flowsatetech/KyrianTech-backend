/** IMPORT
 * All libraries / local exports / packages are imported here
 */

// <-- PACKAGE IMPORTS -->
const express = require('express');
const { z } = require('zod');

// <-- LOCAL EXPORTS IMPORTS -->
const middlewares = require('../middlewares');
const { logger, validateAddCartData, normalizeCartRemoveReq } = require('../helpers');
const db = require('../db');


/** SETUP
 * Global variables referenced in this file are defined here
 */
const router = express.Router();
const { profile } = middlewares.rateLimiters;

/** MAIN USER ROUTES */
router.get('/profile', profile, async (req, res) => {
    try {
        const user = req.db_user;
        const cart = await db.getCart(req.user.userId);
        const cart_count = cart.products.length || 0;

        /** Extra validation if user exists in the db */
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid User'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Fetch profile success',
            data: {
                profile: {
                    userId: user.userId,
                    fullName: user.fullName,
                    email: user.email,
                    cart_count
                }
            }
        });
    } catch (e) {
        logger('SIGNIN').error(e);
        res.status(400).json({
            success: false, message: 'An unknown error occured'
        })
    }
});

router.post('/profile/shipping_address', profile, async (req, res) => {
    try {
        const user = req.db_user;
        res.status(200).json({
            success: true,
            message: 'Fetch Shipping address success',
            data: {
                profile: {
                    userId: user.userId,
                    shipping_address: user.shipping_address
                }
            }
        });
    } catch (e) {
        logger('PROFILE_SHIPPING_ADDRESS').error(e);
        res.status(400).json({
            success: false, message: 'An unknown error occured'
        })
    }
});

router.post('/profile/update', profile, async (req, res) => {
    try {
        const userId = req.user.userId;
        const user = req.db_user;
        
        const validData = z.object({
            fullName: z.string().min(1).optional(),
            shipping_address: z.string().optional()
        }).safeParse(req.body);

        if(!validData.success) {
            return res.status(400).json({
                success: false,
                message: 'Invalid Update data'
            })
        }
        
        await db.updateUser(userId, validData.data)
        res.status(200).json({
            success: true,
            message: 'Profile update successfully'
        });
    } catch (e) {
        logger('PROFILE_UPDATE').error(e);
        res.status(400).json({
            success: false, message: 'An unknown error occured'
        })
    }
});

router.get('/cart', middlewares.rateLimiters.cart, async (req, res) => {
    try {
        const userId = req.user.userId;

        /** Fetch Cart Data */
        const cartData = await db.getCartData(userId);
        const cart = cartData.products ?? [];

        if (!cart.length) {
            return res.status(200).json({
                success: true,
                message: 'Cart is empty',
                data: { cart: [] }
            });
        }

        res.status(200).json({
            success: true,
            message: 'Cart retrieved successfully',
            data: { cart }
        });
    } catch (e) {
        logger('GET_CART').error(e);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.patch('/cart/add', middlewares.rateLimiters.cart, async (req, res) => {
    try {
        const validData = z.object({
            items: z.array(
                z.object({
                    productId: z.string().min(1).max(64),
                    count: z.number().int().min(1).max(99)
                })
            ).min(1)
        }).safeParse(req.body);

        if (!validData.success) {
            return res.status(400).json({
                success: false,
                message: 'Invalid request data'
            })
        }

        const { items } = validData.data;
        const userId = req.user.userId;
        const $v = validateAddCartData(items);
        if (!$v.success) return res.status(400).json({
            success: false,
            message: 'An error occured while adding item to cart',
            data: {
                error: $v.reason,
                item: $v.item
            }
        })
        await db.addCartItems(userId, items);
        const cartData = await db.getCartData(userId);
        const cart = cartData.products ?? [];

        res.status(200).json({
            success: true,
            message: 'Item added to cart',
            data: { cart }
        });
    } catch (e) {
        logger('ADD_CART_ITEM').error(e);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.patch('/cart/remove', middlewares.rateLimiters.cart, async (req, res) => {
    try {
        const validData = z.object({
            items: z.array(
                z.object({
                    productId: z.string().min(1).max(64),
                    count: z.number().int().min(1).max(99)
                })
            ).min(1)
        });

        if (!validData.success) {
            return res.status(400).json({
                success: false,
                message: 'Invalid request data'
            })
        }

        const { items } = validData.data;
        const userId = req.user.userId;
        let cartData = await db.getCartData(userId);
        const $n = normalizeCartRemoveReq(items, cartData);
        await db.removeCartItems(userId, $n);

        cartData = await db.getCartData(userId);
        const cart = cartData.products ?? [];

        res.status(200).json({
            success: true,
            message: 'Items removed from cart',
            data: { cart }
        });
    } catch (e) {
        logger('REMOVE_CART_ITEM').error(e);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.delete('/cart/:productId', middlewares.rateLimiters.cart, async (req, res) => {
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
        const userId = req.user.userId;

        await db.removeCartItem(userId, productId);
        const cartData = await db.getCartData(userId);
        const cart = cartData.products ?? [];

        res.status(200).json({
            success: true,
            message: 'Item removed from cart successfully',
            data: { cart }
        });
    } catch (e) {
        logger('GET_CART').error(e);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.delete('/cart', middlewares.rateLimiters.cart, async (req, res) => {
    try {
        const userId = req.user.userId;

        await db.clearCart(userId);
        const cartData = await db.getCartData(userId);
        const cart = cartData.products ?? [];

        res.status(200).json({
            success: true,
            message: 'Cart has been clared',
            data: { cart }
        });
    } catch (e) {
        logger('GET_CART').error(e);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});


/** EXPORTS
 * Export Routes for use in routers
 */
module.exports = router;