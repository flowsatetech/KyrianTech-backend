/** IMPORT
 * All libraries / local exports / packages are imported here
 */

// <-- PACKAGE IMPORTS -->
const express = require('express');

// <-- LOCAL EXPORTS IMPORTS -->
const middlewares = require('../middlewares');
const { logger } = require('../helpers');
const db = require('../db');


/** SETUP
 * Global variables referenced in this file are defined here
 */
const router = express.Router();

/** MAIN USER ROUTES */
router.get('/profile', async (req, res) => {
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
                    username: user.username,
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

router.get('/cart', async (req, res) => {
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


/** EXPORTS
 * Export Routes for use in routers
 */
module.exports = router;