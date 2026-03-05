const log_service = require('./analytics/log_service');

const logger = (type) => {
  return {
    info: (message) => {
      console.log(`[${type}_INFO]`, message);
      log_service.sendAlert(type, 'INFO', message);
    },
    warn: (message) => {
      console.warn(`[${type}_WARNING]`, message);
      log_service.sendAlert(type, 'WARN', message);
    },
    error: (message) => {
      console.error(`[${type}_ERROR]`, message);
      log_service.sendAlert(type, 'ERROR', message);
    },
  };
};

module.exports = logger;