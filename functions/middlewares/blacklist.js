const { ipKeyGenerator } = require('express-rate-limit');
const { logger } = require('../helpers');
const redisClient = require('./utils/redis_client');

const checkBlacklist = async (req, res, next) => {
    try {
        const targetIp = ipKeyGenerator(req.ip);
        const isBlocked = await redisClient.get(`blacklist_ip_${targetIp}`);
        
        if (isBlocked) {
            return res.status(403).json({
                success: false,
                message: 'Your IP has been temporarily banned for suspicious activity.'
            });
        }
        
        next();
    } catch (err) {
        logger('BLACKLIST').error('Redis check error:', err);
        next(); 
    }
};

module.exports = { checkBlacklist };