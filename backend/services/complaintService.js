const cloudinary = require("../config/cloudinary");
const streamifier = require("streamifier");

function parseCoordinates(rawCoordinates) {
  let coordinates = rawCoordinates;

  if (typeof coordinates === "string") {
    try {
      coordinates = JSON.parse(coordinates);
    } catch (_error) {
      coordinates = null;
    }
  }

  if (!coordinates) return undefined;

  const lat = Number(coordinates.lat);
  const lng = Number(coordinates.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return undefined;
  }

  return { lat, lng };
}

async function uploadComplaintImages(files = []) {
  if (!files.length) return [];

  return Promise.all(
    files.map(
      (file) =>
        new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            { folder: "sahayak/complaints", resource_type: "image" },
            (error, result) => {
              if (error) return reject(error);
              return resolve(result.secure_url);
            },
          );
          streamifier.createReadStream(file.buffer).pipe(uploadStream);
        }),
    ),
  );
}

function applyUpvotePolicy(complaint, userId, hasUpvoted) {
  if (hasUpvoted) {
    complaint.upvotes = complaint.upvotes.filter(
      (id) => String(id) !== String(userId),
    );
    complaint.upvoteCount = Math.max(0, complaint.upvoteCount - 1);
    return;
  }

  complaint.upvotes.push(userId);
  complaint.upvoteCount += 1;

  if (complaint.upvoteCount >= 100 && complaint.priority === "Low") {
    complaint.priority = "Medium";
  } else if (complaint.upvoteCount >= 200 && complaint.priority === "Medium") {
    complaint.priority = "High";
  }
}

module.exports = {
  parseCoordinates,
  uploadComplaintImages,
  applyUpvotePolicy,
};
