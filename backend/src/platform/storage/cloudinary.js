const { v2: cloudinary } = require('cloudinary');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// A screenshot is the document. Capping it at 480px turned a photographed
// letter into 360x480 pixels before anything read it — handwritten dates came
// out as "13/1/1३६" because the digits were three pixels tall. Media that gets
// read keeps its resolution; thumbnails ask for the small transform explicitly.
const uploadImage = async (source, folder, publicId, { maxSide = 2400, quality = 'auto:good' } = {}) => {
  try {
    const options = {
      folder: `trythis/${folder}`,
      resource_type: 'image',
      format: 'jpg',
      transformation: [{ width: maxSide, height: maxSide, crop: 'limit', quality }]
    };
    if (publicId) options.public_id = publicId;

    const result = await cloudinary.uploader.upload(source, options);
    return {
      url: result.secure_url,
      publicId: result.public_id,
      width: result.width,
      height: result.height
    };
  } catch (err) {
    console.error('[cloudinary] upload failed:', err.message);
    return null;
  }
};

const uploadBuffer = async (buffer, mimetype, folder, publicId, opts) => {
  const b64 = buffer.toString('base64');
  const dataUri = `data:${mimetype};base64,${b64}`;
  return uploadImage(dataUri, folder, publicId, opts);
};

const deleteImage = async (publicId) => {
  if (!publicId) return false;
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result.result === 'ok' || result.result === 'not found';
  } catch (err) {
    console.error('[cloudinary] delete failed:', err.message);
    return false;
  }
};

/**
 * Parameters for a browser/app upload that goes straight to Cloudinary
 * (technical PRD §37: large files should bypass the application server).
 *
 * Today every screenshot is base64'd through this process, which costs the
 * request's memory and the dyno's bandwidth twice. Signing here keeps the secret
 * server-side while the bytes never touch us.
 *
 * The signature covers folder, public_id and timestamp, so a client cannot
 * redirect the upload somewhere else or replay it indefinitely — Cloudinary
 * rejects a stale timestamp.
 */
const configured = () => !!(process.env.CLOUDINARY_CLOUD_NAME
  && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);

const signedUploadParams = ({ folder, publicId }) => {
  if (!configured()) return null;
  const timestamp = Math.floor(Date.now() / 1000);
  const toSign = { timestamp, folder, ...(publicId ? { public_id: publicId } : {}) };
  return {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    timestamp,
    folder,
    ...(publicId ? { publicId } : {}),
    signature: cloudinary.utils.api_sign_request(toSign, process.env.CLOUDINARY_API_SECRET),
    uploadUrl: `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/auto/upload`,
  };
};

module.exports = { uploadImage, uploadBuffer, deleteImage, signedUploadParams, configured };
