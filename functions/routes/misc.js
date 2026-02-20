/** IMPORT
 * All libraries / local exports / packages are imported here
 */

// <-- PACKAGE IMPORTS -->
const express = require('express');

// <-- LOCAL EXPORTS IMPORTS -->
const { adminOnly, authMiddleware, rateLimiters } = require('../middlewares');
const redis = require('../middlewares/utils/redis_client');
const { logger } = require('../helpers');

/** SETUP
 * Global variables referenced in this file are defined here
 */
const router = express.Router();

/** MAIN USER ROUTES */
router.get('/health', rateLimiters.health, (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: Date.now()
  });
});

router.delete('/redis/flush', authMiddleware, adminOnly, async (req, res) => {
  try {
    await redis.flushAll();

    return res.status(200).json({
      success: true,
      message: 'Redis cache flushed successfully'
    });

  } catch (err) {
    logger('REDIS_FLUSH').error(err);

    return res.status(500).json({
      success: false,
      message: 'Failed to flush Redis'
    });
  }
});


/** EXPORTS
 * Export Routes for use in routers
 */
module.exports = router;