const { uploadFilesToCloudinary } = require("./mediaUploadService");

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
  const uploads = await uploadFilesToCloudinary(files, "sahayak/complaints");
  return uploads.map((upload) => upload.url).filter(Boolean);
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
