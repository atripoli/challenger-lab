const { cloudinary } = require('../config/cloudinary');

const CHAMPION_FOLDER = 'challenger-lab/champions';

async function uploadChampionBuffer(buffer, { filename } = {}) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: CHAMPION_FOLDER,
        resource_type: 'image',
        public_id: filename ? filename.replace(/\.[^.]+$/, '') : undefined,
        overwrite: false,
        unique_filename: true,
      },
      (err, result) => {
        if (err) return reject(err);
        resolve({
          url: result.secure_url,
          public_id: result.public_id,
          width: result.width,
          height: result.height,
          format: result.format,
          bytes: result.bytes,
        });
      },
    );
    stream.end(buffer);
  });
}

async function destroyPublicId(publicId) {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.warn('[uploads] destroy failed', publicId, err.message);
  }
}

module.exports = { uploadChampionBuffer, destroyPublicId };
