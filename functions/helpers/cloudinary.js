/** IMPORT
 * All libraries / local exports / packages are imported here
 */

// <-- PACKAGE IMPORTS -->
const { v2: cloudinary } = require('cloudinary');

// <-- LOCAL EXPORTS IMPORTS -->
const logger = require('../helpers/logger');

/** CONFIG
 * All settings for imports are here
 */
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

async function uploadImage(files, slug) {
    try {
        const result = [];
        for (const file of files) {
            const uploadResult = await cloudinary.uploader
                .upload(
                    `data:${file.mimetype};base64,${file.buffer.toString('base64')}`, 
                    { 
                        public_id: `${slug}_m_${Date.now()}`,
                        folder: 'kyriantech'
                    }
                )

            result.push(uploadResult);
        }
        return result;
    } catch (error) {
        logger('CLOUDINARY_UPLOAD').error(error);
        throw new Error('Failed to upload image to Cloudinary');
    }
}

module.exports = { uploadImage };