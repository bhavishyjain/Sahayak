const Complaint = require("../../models/Complaint");
const User = require("../../models/User");
const AppError = require("../../core/AppError");
const asyncHandler = require("../../core/asyncHandler");
const { sendSuccess } = require("../../core/response");
const { appendCompletionPhotos } = require("../../services/completionPhotoService");

exports.uploadCompletionPhotos = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const files = req.files;

  if (!files || files.length === 0) {
    throw new AppError("At least one photo is required", 400);
  }

  const userId = req.user?._id || req.user?.id;
  const user = await User.findById(userId);

  if (!user || user.role !== "worker") {
    throw new AppError("Only workers can upload completion photos", 403);
  }

  const complaint = await Complaint.findById(id);
  if (!complaint) {
    throw new AppError("Complaint not found", 404);
  }

  const isAssigned = complaint.assignedWorkers?.some(
    (w) => w.workerId.toString() === userId.toString(),
  );

  if (!isAssigned) {
    throw new AppError("You are not assigned to this complaint", 403);
  }

  const photoUrls = await appendCompletionPhotos(complaint, files);

  complaint.history.push({
    status: complaint.status,
    updatedBy: userId,
    timestamp: new Date(),
    note: `${photoUrls.length} completion photo(s) uploaded by ${user.fullName || user.username}`,
  });

  await complaint.save();

  return sendSuccess(
    res,
    {
      complaint: {
        id: complaint._id,
        completionPhotos: complaint.completionPhotos,
      },
    },
    "Completion photos uploaded successfully",
  );
});
