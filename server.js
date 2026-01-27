/** IMPORT
 * All libraries / local exports / packages are imported here
 */

// <-- PACKAGE IMPORTS -->
const express = require('express');
const path = require('path');
const fs = require('fs');
const cookieParser = require('cookie-parser');

// <-- LOCAL EXPORTS IMPORTS -->
const middlewares = require('./functions/middlewares');
const authRoutes = require('./functions/routes/auth');
const db = require('./functions/db');

/** SETUP
 * Global variables neccessary to build the server are defined here
 */
require('dotenv').config();
const app = express();
const PORT = process.env.PORT || 3000;

/** CONFIG
 * All settings for imports are here
 */
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.disable('x-powered-by');
app.use(express.static(path.join(__dirname,'debug','public')));

/** ROUTERS
 * All routers are created here
 */
const authApi = express.Router();

/** ROUTERS -> HANDLER MAPPING
 * All routers are mapped to their handlers
 */
authApi.use(authRoutes);

/** CONFIGURE & START THE SERVER
 * Mount all routers and configure the server, then start it
 */
app.use('/api/auth', authApi);

app.listen(PORT, async () => {
    await db.initializeDB();
    console.log(`Server is running at http://localhost:${PORT}`);
});