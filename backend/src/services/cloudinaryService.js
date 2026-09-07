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

module.exports = { uploadImage, uploadBuffer, deleteImage };
