const Complaint = require("../../models/Complaint");
const AppError = require("../../core/AppError");
const asyncHandler = require("../../core/asyncHandler");
const { sendSuccess } = require("../../core/response");

exports.voteSatisfaction = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const vote = req.body.voteType || req.body.vote;

  if (!["up", "down"].includes(vote)) {
    throw new AppError("Vote must be 'up' or 'down'", 400);
  }

  const userId = req.user?._id || req.user?.id;
  if (!userId) {
    throw new AppError("Authentication required", 401);
  }

  const complaint = await Complaint.findById(id);
  if (!complaint) {
    throw new AppError("Complaint not found", 404);
  }

  if (complaint.status !== "resolved") {
    throw new AppError("Can only vote on resolved complaints", 400);
  }

  if (!complaint.satisfactionVotes) {
    complaint.satisfactionVotes = {
      thumbsUp: [],
      thumbsDown: [],
      thumbsUpCount: 0,
      thumbsDownCount: 0,
    };
  }

  const userIdString = userId.toString();
  const hasUpvoted = complaint.satisfactionVotes.thumbsUp?.some(
    (entry) => entry.toString() === userIdString,
  );
  const hasDownvoted = complaint.satisfactionVotes.thumbsDown?.some(
    (entry) => entry.toString() === userIdString,
  );
  let userVote = vote;

  if ((vote === "up" && hasUpvoted) || (vote === "down" && hasDownvoted)) {
    userVote = null;
    if (hasUpvoted) {
      complaint.satisfactionVotes.thumbsUp =
        complaint.satisfactionVotes.thumbsUp.filter(
          (entry) => entry.toString() !== userIdString,
        );
    }
    if (hasDownvoted) {
      complaint.satisfactionVotes.thumbsDown =
        complaint.satisfactionVotes.thumbsDown.filter(
          (entry) => entry.toString() !== userIdString,
        );
    }
  } else {
    complaint.satisfactionVotes.thumbsUp =
      complaint.satisfactionVotes.thumbsUp.filter(
        (entry) => entry.toString() !== userIdString,
      );
    complaint.satisfactionVotes.thumbsDown =
      complaint.satisfactionVotes.thumbsDown.filter(
        (entry) => entry.toString() !== userIdString,
      );

    if (vote === "up") {
      complaint.satisfactionVotes.thumbsUp.push(userId);
    } else {
      complaint.satisfactionVotes.thumbsDown.push(userId);
    }
  }

  complaint.satisfactionVotes.thumbsUpCount =
    complaint.satisfactionVotes.thumbsUp.length;
  complaint.satisfactionVotes.thumbsDownCount =
    complaint.satisfactionVotes.thumbsDown.length;

  await complaint.save();

  return sendSuccess(
    res,
    {
      satisfactionVotes: {
        thumbsUpCount: complaint.satisfactionVotes.thumbsUpCount,
        thumbsDownCount: complaint.satisfactionVotes.thumbsDownCount,
        userVote,
      },
    },
    "Vote recorded successfully",
  );
});

exports.getSatisfactionVotes = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const complaint = await Complaint.findById(id);
  if (!complaint) {
    throw new AppError("Complaint not found", 404);
  }

  const userId = req.user?._id || req.user?.id;
  let userVote = null;

  if (userId && complaint.satisfactionVotes) {
    const userIdString = userId.toString();
    const hasUpvoted = complaint.satisfactionVotes.thumbsUp?.some(
      (entry) => entry.toString() === userIdString,
    );
    const hasDownvoted = complaint.satisfactionVotes.thumbsDown?.some(
      (entry) => entry.toString() === userIdString,
    );

    if (hasUpvoted) userVote = "up";
    if (hasDownvoted) userVote = "down";
  }

  return sendSuccess(
    res,
    {
      satisfactionVotes: {
        thumbsUpCount: complaint.satisfactionVotes?.thumbsUpCount || 0,
        thumbsDownCount: complaint.satisfactionVotes?.thumbsDownCount || 0,
        userVote,
      },
    },
    "Satisfaction votes retrieved successfully",
  );
});
