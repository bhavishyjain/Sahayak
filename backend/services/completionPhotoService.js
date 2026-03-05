const { uploadFilesToCloudinary } = require("./mediaUploadService");

async function appendCompletionPhotos(complaint, files = []) {
  const uploads = await uploadFilesToCloudinary(files, "completion_photos");
  const photoUrls = uploads.map((item) => item.url).filter(Boolean);

  if (photoUrls.length > 0) {
    complaint.completionPhotos = [
      ...(complaint.completionPhotos || []),
      ...photoUrls,
    ];
  }

  return photoUrls;
}

module.exports = {
  appendCompletionPhotos,
};
