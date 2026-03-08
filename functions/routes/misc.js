/** IMPORT
 * All libraries / local exports / packages are imported here
 */

// <-- PACKAGE IMPORTS -->
const express = require('express');
const { z } = require('zod');


// <-- LOCAL EXPORTS IMPORTS -->
const { adminOnly, authMiddleware, rateLimiters } = require('../middlewares');
const redis = require('../middlewares/utils/redis_client');
const { logger, mailer, fillTemplate } = require('../helpers');

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

router.get('/debug-ratelimit', (req, res) => {
    res.json({
        express_ip: req.ip,
        cloudflare_ip: req.headers['cf-connecting-ip'] || 'None',
		render_ip: req.headers['true-client-ip'] || 'None',
        x_forwarded: req.headers['x-forwarded-for'] || 'None',
        redis_status: redis.isReady ? 'CONNECTED' : 'DISCONNECTED' 
    });
});

router.post('/reach_out', rateLimiters.reach_out, async (req, res) => {
	try {
		const validData = z.object({
			name: z.string().min(1),
			email: z.email(),
			message: z.string().min(1).max(10000)
		}).safeParse(req.body);

		if (!validData.success) {
			return res.status(400).json({
				success: false,
				message: 'Couldn\'t complete login request',
				errors: validData.error.issues.map(issue => {
					return `${issue.path[0]}: ${issue.message}`;
				})
			})
		}
		const { email, name, message } = validData.data;
		await mailer.send(process.env.ADMIN_EMAIL_ADDRESS, "New Query on Kyrian Tech Contact Form", fillTemplate('contact_form', {
			name,
			email,
			message
		}));
		res.status(200).json({
			success: true, 
			message: 'Message delivered succesfully'
		})
	} catch (e) {
		logger('REACH_OUT').error(e);
		res.status(500).json({
			success: false, 
			message: 'An unknown error occured'
		})
	}

})

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