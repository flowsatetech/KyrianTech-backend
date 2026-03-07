/** IMPORT
 * All libraries / local exports / packages are imported here
 */

// <-- PACKAGE IMPORTS -->
const express = require('express');
const { validationResult } = require('express-validator');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const { isValidPhoneNumber } = require("libphonenumber-js");


// <-- LOCAL EXPORTS IMPORTS -->
const middlewares = require('../middlewares');
const helpers = require('../helpers');
const { logger, mailer, fillTemplate } = require('../helpers');
const db = require('../db');
const redisClient = require('../middlewares/utils/redis_client');

/** SETUP
 * Global variables referenced in this file are defined here
 */
const router = express.Router();
const { authLoginIp, authLogin, signup, logout, forgot_password } = middlewares.rateLimiters;
const { userAlreadyAuth, authMiddleware, signinValidation, signupValidation } = middlewares;

/** MAIN AUTH ROUTES */
router.post('/login', authLoginIp, authLogin, userAlreadyAuth, signinValidation, async (req, res) => {
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

        const validData = z.object({
            email: z.email(),
            password: z.string().min(8),
            rememberMe: z.boolean().optional()
        }).safeParse(req.body);

        if (!validData.success) {
            return res.status(400).json({
                success: false,
                message: 'Couldn\'t complete login request',
                errors: validData.error.issues.map(issue => {
                    return `${issue.path[0]}: ${issue.message}`;
                })
            })
        }
        const { email, password, rememberMe } = validData.data;

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

        const csrf_token = helpers.generateToken(32);

        res.cookie("auth_token", token, {
            httpOnly: true,
            partitioned: true,
            secure: true,
            sameSite: "lax",
            path: "/",
            maxAge: duration
        });

        res.cookie("csrf_token", csrf_token, {
            httpOnly: true,
            partitioned: true,
            secure: true,
            sameSite: "lax",
            path: "/",
            maxAge: duration
        });

        res.status(200).json({
            success: true,
            message: 'Signed in successfully',
            data: {
                user: {
                    userId: user.userId,
                    fullName: user.fullName,
                    email: user.email,
                    phoneNumber: user.phoneNumber,
                    shippingAddress: user.shippingAddress,
                    csrf_token
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

router.post('/signup', signup, userAlreadyAuth, signupValidation, async (req, res) => {
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

        const validData = z.object({
            fullName: z.string().min(1),
            email: z.email(),
            password: z.string().min(8),
            phoneNumber: z.string().refine((val) => isValidPhoneNumber(val), {
                message: "Please enter a valid international phone number",
            }),
            rememberMe: z.boolean().optional()
        }).safeParse(req.body);

        if (!validData.success) {
            return res.status(400).json({
                success: false,
                message: 'Couldn\'t complete signup request',
                errors: validData.error.issues.map(issue => {
                    return `${issue.path[0]}: ${issue.message}`;
                })
            })
        }

        const { fullName, email, password, phoneNumber, rememberMe } = validData.data;

        /** Extra precaution to validate fields */
        const empty = helpers.isEmpty({ email, password, fullName });
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
            fullName,
            email,
            password: hashedPassword,
            phoneNumber,
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
        const csrf_token = helpers.generateToken(32);

        res.cookie("auth_token", token, {
            httpOnly: true,
            partitioned: true,
            secure: true,
            sameSite: "lax",
            path: "/",
            maxAge: duration
        });

        res.cookie("csrf_token", csrf_token, {
            httpOnly: true,
            partitioned: true,
            secure: true,
            sameSite: "lax",
            path: "/",
            maxAge: duration
        });

        res.status(201).json({
            success: true,
            message: 'Account created successfully',
            data: {
                user: { userId, fullName, email, phoneNumber, csrf_token }
            }
        });
    } catch (e) {
        logger('SIGNUP').error(e);
        res.status(400).json({
            success: false, message: 'An unknown error occured'
        })
    }
});

router.post('/forgot_password', forgot_password, userAlreadyAuth, async (req, res) => {
    try {
        const validData = z.object({
            email: z.email()
        }).safeParse(req.body);

        if (!validData.success) {
            return res.status(400).json({
                success: false,
                message: 'Couldn\'t complete password reset request',
                errors: validData.error.issues.map(issue => {
                    return `${issue.path[0]}: ${issue.message}`;
                })
            })
        }
        const { email } = validData.data;

        const user = await db.getUserByEmail(email);
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Something went wrong. Check if the email address is correct'
            });
        }
        const token = helpers.generateToken(32);
        
        await redisClient.setEx(`magic_link:${token}`, 900, user.userId);
        
        const magic_link = `${process.env.SERVER_BASE_URL}/api/auth/magic_link/${token}`;

        await mailer.send(email, "Let's get you back into your account", fillTemplate('magic_link', {
			email,
            magic_link			
		}));

        res.status(200).json({
            success: true,
            message: 'Magic link has been sent to your email address.'
        });
    } catch (e) {
        logger('FORGOT_PASSWORD').error(e);
        res.status(400).json({
            success: false, message: 'An unknown error occured'
        })
    }
});

router.get('/magic_link/:x_token', async (req, res) => {
    const { x_token } = req.params;
    const rememberMe = true;
    
    if (!x_token) {
        return res.status(400).json({ success: false, message: 'Token is missing.' });
    }
    try {
        const userId = await redisClient.get(`magic_link:${x_token}`);
        if (!userId) {
            return res.status(401).json({ 
                success: false, 
                message: 'This magic link is invalid or has expired. Please request a new one.' 
            });
        }
        const user = await db.getUserById(userId);
        await redisClient.del(`magic_link:${x_token}`);

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

        const csrf_token = helpers.generateToken(32);

        res.cookie("auth_token", token, {
            httpOnly: true,
            partitioned: true,
            secure: true,
            sameSite: "lax",
            path: "/",
            maxAge: duration
        });

        res.cookie("csrf_token", csrf_token, {
            httpOnly: true,
            partitioned: true,
            secure: true,
            sameSite: "lax",
            path: "/",
            maxAge: duration
        });
        
        res.redirect(JSON.parse(process.env.APP_BASE_URL)[0]);
    } catch (error) {
        console.error('Magic link verification error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

router.post('/logout', authMiddleware, logout, async (req, res) => {
    try {
        res.clearCookie("auth_token", {
            httpOnly: true,
            partitioned: true,
            secure: true,
            sameSite: "lax",
            path: "/"
        });

        res.clearCookie("csrf_token", {
            httpOnly: true,
            partitioned: true,
            secure: true,
            sameSite: "lax",
            path: "/"
        });

        await db.updateUser(req.user.userId, { stamp: null })

        res.status(200).json({
            success: true,
            message: 'Logged out successfully'
        });

    } catch (error) {
        logger('LOGOUT').error(error);
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