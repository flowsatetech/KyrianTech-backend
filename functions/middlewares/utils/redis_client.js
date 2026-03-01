const { createClient } = require('redis');
const { logger } = require('../../helpers');

const redisClient = createClient({
  url: process.env.REDIS_URL
});

redisClient.on('error', (err) => {
  logger('REDIS_CLIENT').error('Redis error:', err);
});

redisClient.connect().catch(logger('REDIS_CLIENT').error);

module.exports = redisClient;