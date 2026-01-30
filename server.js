/** IMPORT
 * All libraries / local exports / packages are imported here
 */

// <-- PACKAGE IMPORTS -->
const express = require('express');
const path = require('path');
const fs = require('fs');
const cookieParser = require('cookie-parser');
const cors = require('cors');

// <-- LOCAL EXPORTS IMPORTS -->
const middlewares = require('./functions/middlewares');
const authRoutes = require('./functions/routes/auth');
const userRoutes = require('./functions/routes/user');
const productsRoutes = require('./functions/routes/products');
const miscRoutes = require('./functions/routes/misc');

const db = require('./functions/db');
const { logger } = require('./functions/helpers');

/** SETUP
 * Global variables neccessary to build the server are defined here
 */
require('dotenv').config();
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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.disable('x-powered-by');
app.use(express.static(path.join(__dirname,'debug','public')));
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