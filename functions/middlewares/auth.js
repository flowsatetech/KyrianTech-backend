/** AUTH MIDDLEWARE
 * This is the middleware that allows only users that are logged in to access a route
*/

/** IMPORTS
 * Import all third Party Libraries and variables here
 */
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;

/** MIDDLEWARE LOGIC */
const authMiddleware = async (req, res, next) => {
    try {
        const token = req.cookies.auth_token;
        // Detect if request is from a browser navigation or an API call
        const isApiRequest = req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'));
        // Target the root path specifically
        const isHomePage = req.method === 'GET' && (req.path === '/' || req.originalUrl === '/');

        if (!token) {
            // IF NO TOKEN: Let them through if it's the home page, otherwise redirect
            if (isHomePage) return next();
            if (isApiRequest) {
                return res.status(401).json({
                    success: false,
                    message: 'Access denied. No token provided.',
                    redirect: `${process.env.SERVER_BASE_URL}/auth/signin`
                });
            } else {
                // 1. Capture the URL they wanted to visit
                const currentUrl = req.originalUrl;
                // 2. Sanitize: We only allow paths starting with "/" to prevent external redirects
                const safeContinue = (currentUrl && currentUrl.startsWith('/') && !currentUrl.startsWith('//'))
                    ? encodeURIComponent(currentUrl)
                    : '';
                const loginUrl = safeContinue
                    ? `${process.env.SERVER_BASE_URL}/auth/signin?continue=${safeContinue}`
                    : `${process.env.SERVER_BASE_URL}/auth/signin`;
                return res.redirect(loginUrl);
            }
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await db.getUser({ userId: decoded.userId });

        if (!user || user.cookieStep !== decoded.cookieStep) {
            // IF TOKEN IS INVALID/USER DELETED: Let them see home as a guest, else redirect
            if (isHomePage && !isApiRequest) return next();

            if (isApiRequest) return res.status(400).json({ success: false, message: 'User Not Found' });
            return res.redirect(`${process.env.SERVER_BASE_URL}/auth/signin`);
        }

        // Token is valid - attach user and proceed
        req.user = decoded;
        next();

    } catch (error) {
        console.error('Auth Error:', error.message);
        const isApiRequest = req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'));
        const isHomePage = req.method === 'GET' && (req.path === '/' || req.originalUrl === '/');

        if (isApiRequest) {
            return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
        } else {
            // IF TOKEN IS EXPIRED: Don't crash or redirect if they are just on the home page
            if (isHomePage) return next();
            
            return res.redirect(`${process.env.SERVER_BASE_URL}/auth/signin`);
        }
    }
};

module.exports = authMiddleware