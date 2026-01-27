/** IMPORT
 * All libraries / local exports / packages are imported here
 */

// <-- PACKAGE IMPORTS -->
const express = require('express');
const { validationResult } = require('express-validator');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// <-- LOCAL EXPORTS IMPORTS -->
const middlewares = require('../middlewares');
const helpers = require('../helpers');
const db = require('../db');


/** SETUP
 * Global variables referenced in this file are defined here
 */
const router = express.Router();

/** MAIN AUTH ROUTES */
router.post('/login', middlewares.signinValidation, async (req, res) => {
    try {
        /** Check for validation errors */
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Couldn\'t Complete Login Request',
                data: {
                    errors: errors.array().map(x => x.msg)
                }
            });
        }

        const { email, password, rememberMe } = req.body;

        /** Check if user doesn't exists in the db / password not matching */
        const user = await db.getUserByEmail(email);
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        /** Prepare new auth cookie and reload stamp to invalidate all old cookies */
        const stamp = `${helpers.generateToken()}_stamp_${Date.now()}`;

        const ms = (days) => days * 24 * 60 * 60 * 1000;
        const duration = rememberMe ? ms(30) : 60 * 60 * 1000;
        const token = jwt.sign(
            { userId: user.userId, email: user.email, fullName: user.fullName, stamp },
            process.env.JWT_SECRET,
            { expiresIn: Math.floor(duration / 1000) }
        );

        /** Update user's last login timestamp and new cookie stamp */
        await db.updateUser(user.userId, {
            lastLogin: Date.now(),
            stamp
        });

        res.cookie("auth_token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: "Strict",
            path: "/",
            maxAge: duration
        });

        res.status(200).json({
            success: true,
            message: 'Signed in successfully',
            user: {
                userId: user.userId,
                fullName: user.fullName,
                email: user.email,
                company: user.company
            }
        });
    } catch (e) {
        helpers.logger('SIGNIN_ERRORS').error(e);
        res.status(400).json({
            success: false, message: 'An unknown error occured'
        })
    }
});

router.post('/signup', middlewares.signupValidation, async (req, res) => {
    try {
        /** Check for validation errors */
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Couldn\'t Complete Signup Request',
                data: {
                    errors: errors.array().map(x => x.msg)
                }
            });
        }

        const { username, email, password, rememberMe } = req.body;

        /** Extra precaution to validate fields */
        const empty = helpers.isEmpty({ username, email, password });
        if (empty) return res.status(400).json({
            success: false,
            message: `${empty} is required but is empty`
        })

        /** Check if user exists in the db */
        const existingUser = await db.getUserByEmail(email);
        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: 'Email already registered'
            });
        }

        /** Generate new user data and hash password */
        const hashedPassword = await bcrypt.hash(password, 10);
        const userId = helpers.generateToken();
        const stamp = `${helpers.generateToken()}_stamp_${Date.now()}`; // <- This is neccessary to invalidate cookies

        const user = {
            userId,
            username,
            email,
            password: hashedPassword,
            createdAt: Date.now(),
            authProvider: 'kyrian',
            lastLogin: Date.now(),
            stamp
        };

        /** Prepare auth cookie */
        const ms = (days) => days * 24 * 60 * 60 * 1000;
        const duration = rememberMe ? ms(30) : 60 * 60 * 1000;
        const token = jwt.sign(
            { userId: user.userId, email: user.email, fullName: user.fullName, stamp },
            process.env.JWT_SECRET,
            { expiresIn: Math.floor(duration / 1000) }
        );

        await db.addUser(user); // Add user to database

        /** Return Cookie and Success message */
        res.cookie("auth_token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: "Strict",
            path: "/",
            maxAge: duration
        });

        res.status(201).json({
            success: true,
            message: 'Account created successfully',
            data: {
                user: { userId, username, email }
            }
        });
    } catch (e) {
        helpers.logger('SIGNUP_ERRORS').error(e);
        res.status(400).json({
            success: false, message: 'An unknown error occured'
        })
    }
});

router.post('/logout', middlewares.authMiddleware, async (req, res) => {
    try {
        res.clearCookie("auth_token", {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: "Strict",
            path: "/"
        });

        await db.updateUser(req.user.userId, { stamp: null })

        res.status(200).json({
            success: true,
            message: 'Logged out successfully'
        });

    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during logout'
        });
    }
});

/** EXPORTS
 * Export Routes for use in routers
 */
module.exports = router;