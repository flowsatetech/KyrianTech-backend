/** IMPORT
 * All libraries / local exports / packages are imported here
 */

// <-- PACKAGE IMPORTS -->
const express = require('express');

// <-- LOCAL EXPORTS IMPORTS -->

/** SETUP
 * Global variables referenced in this file are defined here
 */
const router = express.Router();

/** MAIN USER ROUTES */
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: Date.now()
  });
});

/** EXPORTS
 * Export Routes for use in routers
 */
module.exports = router;