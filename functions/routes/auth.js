/** IMPORT
 * All libraries / local exports / packages are imported here
 */

// <-- PACKAGE IMPORTS -->
const express = require('express');
const { validationResult } = require('express-validator');
const logger = require('../helpers/logger')

// <-- LOCAL EXPORTS IMPORTS -->
const middlewares = require('../middlewares');


/** SETUP
 * Global variables referenced in this file are defined here
 */
const router = express.Router();

/** MAIN AUTH ROUTES */
router.post('/login', middlewares.signinValidation, (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Couldn\'t Complete Login Request',
                data: {
                    errors: errors.array().map(x=>x.msg)
                }
            });
        }
        res.status(200).json({ success: true, message: "Login Successful" });
    } catch (e) {
        logger('SIGNIN_ERRORS').error(e);
        res.status(400).json({
            success: false, message: 'An unknown error occured'
        })
    }
});

router.post('/signup', middlewares.signupValidation, (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Couldn\'t Complete Login Request',
                data: {
                    errors: errors.array().map(x=>x.msg)
                }
            });
        }
        res.status(200).json({ success: true, message: "Signup Successful" });
    } catch (e) {
        logger('SIGNUP_ERRORS').error(e);
        res.status(400).json({
            success: false, message: 'An unknown error occured'
        })
    }
});

/** EXPORTS
 * Export Routes for use in routers
 */
module.exports = router;