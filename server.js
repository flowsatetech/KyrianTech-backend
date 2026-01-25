/** IMPORT
 * All libraries / local exports / packages are imported here
 */

// <-- PACKAGE IMPORTS -->
const express = require('express');
const path = require('path');
const fs = require('fs');
const cookieParser = require('cookie-parser');

// <-- LOCAL EXPORTS IMPORTS -->
const authRoutes = require('./functions/routes/auth');

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
app.use(express.static('public'));

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
    console.log(`Server is running at http://localhost:${PORT}`);
});