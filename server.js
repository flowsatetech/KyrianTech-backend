/** INJECT ENV VARS
 * Load environment variables from .env file into process.env
 */
require('dotenv').config();

/** IMPORT
 * All libraries / local exports / packages are imported here
 */

// <-- PACKAGE IMPORTS -->
const express = require('express');
const path = require('path');
const fs = require('fs');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const helmet = require('helmet');

// <-- LOCAL EXPORTS IMPORTS -->
const middlewares = require('./functions/middlewares');
const authRoutes = require('./functions/routes/auth');
const userRoutes = require('./functions/routes/user');
const productsRoutes = require('./functions/routes/products');
const miscRoutes = require('./functions/routes/misc');

const db = require('./functions/db');
const { generateToken, logger } = require('./functions/helpers');

/** SETUP
 * Global variables neccessary to build the server are defined here
 */
const app = express();
const PORT = process.env.PORT || 3000;
const corsOpts = {
    origin: process.env.APP_BASE_URL,
    credentials: true
};

/** CONFIG
 * All settings for imports are here
 */
app.use(cors(corsOpts));
app.use(cookieParser());
app.use((req, res, next) => {
    const publicRoutes = ['/api/auth/login', '/api/auth/signup', '/api/auth/google', '/api/products/filter'];
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method) || publicRoutes.some(route => req.path.startsWith(route))) {
        return next();
    }
    const cookieToken = req.cookies['csrf_token'];
    const headerToken = req.headers['x-csrf-token'];
    if (cookieToken === headerToken) {
        next();
    } else {
        logger('SECURITY').warn(`Blocked potential CSRF from: ${req.headers.origin}`);
        res.status(403).json({
            success: false,
            message: 'Security Violation: Missing or mismatched CSRF tokens.'
        });
    }
});
// app.use(helmet());
app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                "default-src": ["'self'"],
                "script-src": ["'self'", "'unsafe-inline'"],
                "connect-src": [
                    "'self'", "https:", "wss:"
                ],
                "img-src": ["'self'", "data:", "https:"],
                "style-src": ["'self'", "'unsafe-inline'"],
            },
        },
    })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.disable('x-powered-by');
app.use(express.static(path.join(__dirname, 'debug', 'public')));
app.set('trust proxy', 1);

/** ROUTERS
 * All routers are created here
 */
const authApi = express.Router();
const userApi = express.Router();
const productsApi = express.Router();
const miscApi = express.Router();

/** ROUTERS -> HANDLER MAPPING
 * All routers are mapped to their handlers
 */
authApi.use(authRoutes);
userApi.use(userRoutes);
productsApi.use(productsRoutes);
miscApi.use(miscRoutes);

/** CONFIGURE & START THE SERVER
 * Mount all routers
 * Initialize the DB
 * configure the server, then start it
 */
app.use('/api/auth', authApi);
app.use('/api/user', middlewares.authMiddleware, userApi);
app.use('/api/products', middlewares.authMiddleware, productsApi);
app.use('/misc', miscApi);

app.listen(PORT, async () => {
    await db.initializeDB();
    logger('SERVER').info(`Server is running at http://localhost:${PORT}`);
});