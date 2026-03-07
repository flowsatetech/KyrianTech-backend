/** IMPORT
 * All libraries / local exports / packages are imported here
 */

// <-- PACKAGE IMPORTS -->
const { Resend } = require('resend');

// <-- LOCAL EXPORTS IMPORTS -->
const logger = require('../helpers/logger');

/** CONFIG
 * All settings for imports are here
 */
const resend = new Resend(process.env.MAIL_BOX_PASS);


async function send(email, subject, html) {
    try {
        const { data, error } = await resend.emails.send({
            from: 'KyrianTech <communications@sms.kyriantech.net>',
            to: email,
            subject,
            html
        });

        if (error) {
            throw error;
        }
        return data;
    } catch (err) {
        throw err;
    }
}

module.exports = {
    send
}