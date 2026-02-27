const cloudinary = require("../config/cloudinary");
const streamifier = require("streamifier");

async function uploadFilesToCloudinary(files = [], folder = "completion_photos") {
  const uploads = [];
  for (const file of files) {
    try {
      const result = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          { folder },
          (error, uploadResult) => {
            if (error) reject(error);
            else resolve(uploadResult);
          },
        );
        streamifier.createReadStream(file.buffer).pipe(uploadStream);
      });

      uploads.push({
        url: result.secure_url,
        publicId: result.public_id,
      });
    } catch (error) {
      // Keep request resilient: skip failed file and continue others.
      console.error("Error uploading to Cloudinary:", error.message);
    }
  }
  return uploads;
}

module.exports = {
  uploadFilesToCloudinary,
};
