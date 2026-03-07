const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const escapeHtml = require('escape-html');


function generateToken(length = 16) {
    return crypto.randomBytes(length).toString('hex');
}

const isEmpty = (inputObj) => {
  for (const [key, value] of Object.entries(inputObj)) {
    if (
      value === undefined || 
      value === null || 
      (typeof value === 'string' && value.trim() === '')
    ) {
      return key;
    }
  }
  return null;
};

function isValidPhone(input) {
  const clean = input.replace(/[^\d+]/g, '');
  return /^\+?[1-9]\d{6,14}$/.test(clean);
}

const handleAuthFailure = (req, res, isApi, message) => {
    if (isApi) {
        return res.status(401).json({ success: false, message });
    }
    
    const currentUrl = req.originalUrl;
    const safeContinue = (currentUrl && currentUrl.startsWith('/') && !currentUrl.startsWith('//'))
        ? encodeURIComponent(currentUrl)
        : '';
        
    const loginUrl = safeContinue
        ? `${process.env.SERVER_BASE_URL}/auth/signin?continue=${safeContinue}`
        : `${process.env.SERVER_BASE_URL}/auth/signin`;

    return res.redirect(loginUrl);
};

function slugify(str) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") 
    .replace(/\s+/g, "-") 
    .replace(/-+/g, "-");
}

function fillTemplate(templateName, data) {
  let filledTemplate = fs.readFileSync(path.join(__dirname, 'templates', `${templateName}.html`), 'utf8');
  
  for (const [key, value] of Object.entries(data)) {
    const safeValue = escapeHtml(String(value));
    filledTemplate = filledTemplate.replaceAll(`{{${key}}}`, safeValue);
  }
  
  return filledTemplate;
}

module.exports = { generateToken, isEmpty, handleAuthFailure, slugify, isValidPhone, fillTemplate }