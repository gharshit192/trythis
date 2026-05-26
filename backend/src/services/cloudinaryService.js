const { v2: cloudinary } = require('cloudinary');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadImage = async (source, folder, publicId) => {
  try {
    const options = {
      folder: `trythis/${folder}`,
      resource_type: 'image',
      format: 'jpg',
      transformation: [{ width: 480, height: 480, crop: 'limit', quality: 80 }]
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

const uploadBuffer = async (buffer, mimetype, folder, publicId) => {
  const b64 = buffer.toString('base64');
  const dataUri = `data:${mimetype};base64,${b64}`;
  return uploadImage(dataUri, folder, publicId);
};

module.exports = { uploadImage, uploadBuffer };
