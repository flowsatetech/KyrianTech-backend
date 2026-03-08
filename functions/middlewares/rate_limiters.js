const rateLimit = require("express-rate-limit");
const { RedisStore } = require("rate-limit-redis");
const redisClient = require("./utils/redis_client");
const { logger } = require("../helpers");

const getClientIp = (req) => {
  return rateLimit.ipKeyGenerator(
    req.headers["true-client-ip"] || req.headers["cf-connecting-ip"] || req.ip,
  );
};

const createStore = (prefixName) =>
  new RedisStore({
    sendCommand: (...args) => redisClient.sendCommand(args),
    prefix: prefixName,
  });

const createBlacklistHandler = (blacklistDuration = 3600) => {
  return async (req, res, next, options) => {
    try {
      const ip = getClientIp(req);
      await redisClient.setEx(`blacklist_ip_${ip}`, blacklistDuration, "true");
    } catch (err) {
      logger("BLACKLIST").error("Redis blacklist error:", err);
    }
    res.status(options.statusCode || 429).json(options.message);
  };
};

const buildLimiter = ({
  name,
  windowMs,
  max,
  message,
  keyGenerator,
  shouldBlacklist = true,
  blacklistDuration = 3600,
}) => {
  const options = {
    windowMs,
    max,
    store: createStore(`rl:${name}:`),
    message: { success: false, message },
    keyGenerator: keyGenerator || ((req) => {
        if (req.db_user && req.db_user.userId) {
            return `${name}_user_${req.db_user.userId}`;
        }
        return `${name}_ip_${getClientIp(req)}`;
    })
  };

  if (shouldBlacklist) {
    options.handler = createBlacklistHandler(blacklistDuration);
  }

  return rateLimit(options);
};

const globalLimiter = buildLimiter({
  name: "global",
  windowMs: 15 * 60 * 1000,
  max: 500,
  shouldBlacklist: false,
  message: "Too many requests from this IP. Please wait a moment.",
});

const signup = buildLimiter({
  name: "signup",
  windowMs: 60 * 60 * 1000,
  max: 5,
  blacklistDuration: 7200,
  message: "Too many accounts created from this IP. Please try again later.",
});

const authLogin = buildLimiter({
  name: "authLogin",
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => `login_${req.body?.email || ""}`,
  message: "Too many login attempts. Please try again later.",
});

const authLoginIp = buildLimiter({
  name: "authLoginIp",
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => `login_${getClientIp(req)}`,
  message: "Too many login attempts from this network. Please try again later.",
});

const forgot_password = buildLimiter({
  name: "forgotPassword",
  windowMs: 2 * 60 * 60 * 1000,
  max: 5,
  blacklistDuration: 7200,
  message: "Too many password reset attempts. Please try again later.",
});

const profile = buildLimiter({
  name: "profile",
  windowMs: 30 * 60 * 1000,
  max: 30,
  message: "Too many profile requests. Please slow down.",
});

const cart = buildLimiter({
  name: "cart",
  windowMs: 60 * 1000,
  max: 30,
  shouldBlacklist: false,
  message: "Cart update limit reached. Please wait a moment.",
});

const logout = buildLimiter({
  name: "logout",
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: "Too many logout attempts.",
});

const products = buildLimiter({
  name: "products",
  windowMs: 60 * 1000,
  max: 60,
  shouldBlacklist: false,
  message: "Too many requests. Please slow down your browsing.",
});

const reach_out = buildLimiter({
  name: "reach_out",
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: "You have submitted too many contact requests.",
});

const fourzerofour = buildLimiter({
  name: "404",
  windowMs: 15 * 60 * 1000,
  max: 20,
  blacklistDuration: 1800,
  message: "Suspicious activity detected. You have been temporarily blocked.",
});

const health = buildLimiter({
  name: "health",
  windowMs: 60 * 1000,
  max: 10,
  shouldBlacklist: false,
  message: "Too many health checks.",
});

module.exports = {
  globalLimiter,
  signup,
  authLogin,
  authLoginIp,
  products,
  health,
  profile,
  cart,
  logout,
  reach_out,
  forgot_password,
  fourzerofour,
};
