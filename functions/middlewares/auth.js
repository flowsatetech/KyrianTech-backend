/** AUTH MIDDLEWARE
 * This is the middleware that allows only users that are logged in to access a route
*/

/** IMPORTS
 * Import all third Party Libraries and variables here
 */
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;
const { handleAuthFailure } = require('../helpers')
const db = require('../db')

/** MIDDLEWARE LOGIC */
const authMiddleware = async (req, res, next) => {
    try {
        const token = req.cookies.auth_token;
        const isApiRequest =
            req.xhr ||
            req.path.startsWith('/api/') ||
            req.headers['content-type'] === 'application/json' ||
            (req.headers.accept && req.headers.accept === 'application/json');

        // 1. Check if token exists
        if (!token) {
            return handleAuthFailure(req, res, isApiRequest, 'Access denied. Please sign in.');
        }

        // 2. Verify JWT structure and expiry
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // 3. Database Check: User existence AND Stamp integrity
        const user = await db.getUserById(decoded.userId);

        if (!user || !user.stamp || user.stamp !== decoded.stamp) {
            // Clear the "poisoned" or expired cookie from their browser
            res.clearCookie("auth_token");
            return handleAuthFailure(req, res, isApiRequest, 'Session expired or invalid. Please sign in again.');
        }

        // 4. Success - Attach user to request
        req.user = decoded;
        next();

    } catch (error) {
        console.error('Auth Middleware Error:', error.message);
        const isApiRequest = req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'));

        // Handle expired or malformed tokens
        res.clearCookie("auth_token");
        return handleAuthFailure(req, res, isApiRequest, 'Invalid session.');
    }
};

module.exports = authMiddleware