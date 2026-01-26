/** IMPORT
 * All libraries / local exports / packages are imported here
 */

// <-- PACKAGE IMPORTS -->


// <-- LOCAL EXPORTS IMPORTS -->
const authMiddleware = require('./auth');
const { signinValidation, signupValidation } = require('./validations');

module.exports = {
    authMiddleware,
    signinValidation,
    signupValidation
}