/** IMPORT
 * All libraries / local exports / packages are imported here
 */

// <-- PACKAGE IMPORTS -->
const express = require('express');

// <-- LOCAL EXPORTS IMPORTS -->
const rateLimiters = require('../middlewares/rate_limiters');
const { logger } = require('../helpers');

/** SETUP
 * Global variables referenced in this file are defined here
 */
const router = express.Router();

/** MAIN USER ROUTES */
router.get('/', rateLimiters.fourzerofour, (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: Date.now(),
    message: 'Are you lost? Our site is at https://kyrian-tech-frontend.vercel.app/'
  });
});

router.use(rateLimiters.fourzerofour, (req, res) => {
  logger('404').info(req.originalUrl);
  res.status(404).json({
    status: 'error',
    message: 'Are you lost? Our site is at https://kyrian-tech-frontend.vercel.app/',
    path: req.originalUrl
  });
});

/** EXPORTS
 * Export Routes for use in routers
 */
module.exports = router;