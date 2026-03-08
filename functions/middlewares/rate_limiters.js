const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const redisClient = require('./utils/redis_client');
const { logger } = require('../helpers');

const createStore = (prefixName) => new RedisStore({
    sendCommand: (...args) => redisClient.sendCommand(args),
    prefix: prefixName
});

const keyGenerator = (req) => {
    if (req.user && req.user.userId) {
        return `user_${req.user.userId}`;
    }
    return `ip_${ipKeyGenerator(req.ip)}`;
};

const signup = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5, 
    store: createStore('rl:signup:'),
    message: { success: false, message: 'Too many accounts created from this IP. Please try again later.' }
});

const authLogin = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    store: createStore('rl:authLogin:'),
    keyGenerator: (req) => {
        const email = req.body?.email || ''; 
        return `login_${email}`;
    },
    message: { success: false, message: 'Too many login attempts. Please try again later.' }
});

const authLoginIp = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    store: createStore('rl:authLoginIp:'),
    keyGenerator: (req) => {
        return `login_${ipKeyGenerator(req.ip)}`;
    },
    message: { success: false, message: 'Too many login attempts. Please try again later.' }
});

const forgot_password = rateLimit({
    windowMs: 6 * 60 * 60 * 1000,
    max: 2,
    store: createStore('rl:forgotPassword:'),
    keyGenerator: (req) => {
        return `login_${ipKeyGenerator(req.ip)}`;
    },
    message: { success: false, message: 'Too many password reset attempts. Please try again later.' }
});

const profile = rateLimit({
    windowMs: 30 * 60 * 1000,
    max: 20,
    store: createStore('rl:profile:'),
    keyGenerator: (req) => {
        return `profile_${ipKeyGenerator(req.ip)}`;
    },
    message: { success: false, message: 'Too many requests. Please slow down.' }
});

const cart = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    store: createStore('rl:cart:'),
    keyGenerator: (req) => {
        return `cart_${ipKeyGenerator(req.ip)}`;
    },
    message: { success: false, message: 'Cart update limit reached. Please wait a moment.' }
});

const logout = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 20,
    store: createStore('rl:logout:'),
    keyGenerator: (req) => {
        return `logout_${ipKeyGenerator(req.ip)}`;
    },
    message: { success: false, message: 'Too many logout attempts.' }
});

const products = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    store: createStore('rl:products:'),
    keyGenerator: (req) => {
        return `products_${ipKeyGenerator(req.ip)}`;
    },
    message: { success: false, message: 'Too many requests.' }
});

const reach_out = rateLimit({
    windowMs: 5 * 60 * 60 * 1000,
    max: 2,
    store: createStore('rl:reach_out:'),
    keyGenerator: (req) => {
        return `reach_out_${ipKeyGenerator(req.ip)}`;
    },
    message: { success: false, message: 'You hit 404 too many times.' }
});

const fourzerofour = rateLimit({
    windowMs: 5 * 60 * 60 * 1000,
    max: 3,
    store: createStore('rl:404:'),
    keyGenerator: (req) => {
        return `404_${ipKeyGenerator(req.ip)}`;
    },
    message: { success: false, message: 'Suspicious activity detected. You have been blocked.' },
    
    handler: async (req, res, next, options) => {
        try {
            await redisClient.setEx(`blacklist_ip_${ipKeyGenerator(req.ip)}`, 18000, 'true');
        } catch (err) {
            logger('BLACKLIST').error('Redis blacklist error:', err);
        }
        res.status(options.statusCode || 429).json(options.message);
    }
});

const health = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    store: createStore('rl:health:'),
    keyGenerator: (req) => {
        return `health_${ipKeyGenerator(req.ip)}`;
    },
    message: { success: false, message: 'Too many health checks.' }
});

module.exports = {
    signup,
    authLogin,
    authLoginIp,
    products,
    health,
    profile,
    cart,
    logout,
    reach_out,
    forgot_password,

    fourzerofour
};