const { uploadImage } = require('./cloudinary')
const logger = require('./logger')
const mailer = require('./mailer')
const { generateToken, isEmpty, handleAuthFailure, slugify, isValidPhone, fillTemplate } = require('./utils')
const { validateAddCartData, normalizeCartRemoveReq } = require('./validators')

module.exports = { logger, generateToken, isEmpty, handleAuthFailure, validateAddCartData, normalizeCartRemoveReq, slugify, uploadImage, isValidPhone, mailer, fillTemplate }