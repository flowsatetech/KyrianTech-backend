/** FOR ERROR ANALYTICS, UPDATE LATER */
const logger = (type) => {
  return {
    info: (info) => console.log(`[${type}]`, info),
    warn: (err) => console.warn(`[${type}]`, err),
    error: (err) => console.error(`[${type}]`, err),
  }
}

module.exports = logger