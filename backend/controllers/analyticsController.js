const Complaint = require("../models/Complaint");
const User = require("../models/User");
const AppError = require("../core/AppError");
const asyncHandler = require("../core/asyncHandler");
const { sendSuccess } = require("../core/response");
const { buildComplaintView } = require("../utils/complaintView");

function severityFromIntensity(intensity) {
  if (intensity >= 12) return "very-high";
  if (intensity >= 8) return "high";
  if (intensity >= 4) return "medium";
  return "low";
}

exports.summary = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  const [total, pending, inProgress, resolved, recentComplaints, resolvedComplaints, departmentStats, monthlyData] =
    await Promise.all([
      Complaint.countDocuments({ userId }),
      Complaint.countDocuments({ userId, status: "pending" }),
      Complaint.countDocuments({ userId, status: "in-progress" }),
      Complaint.countDocuments({ userId, status: "resolved" }),
      Complaint.find({ userId })
        .sort({ createdAt: -1 })
        .limit(5)
        .select(
          "ticketId rawText refinedText department priority status locationName createdAt",
        ),
      Complaint.find({ userId, status: "resolved", resolvedAt: { $ne: null } })
        .select("createdAt resolvedAt")
        .lean(),
      Complaint.aggregate([
        { $match: { userId } },
        { $group: { _id: "$department", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 1 },
      ]),
      Complaint.aggregate([
        { $match: { userId, createdAt: { $gte: sixMonthsAgo } } },
        {
          $group: {
            _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
            count: { $sum: 1 },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ]),
    ]);

  let avgResolutionTime = null;
  if (resolvedComplaints.length > 0) {
    const totalHours = resolvedComplaints.reduce((sum, c) => {
      const hrs = (new Date(c.resolvedAt) - new Date(c.createdAt)) / (1000 * 60 * 60);
      return sum + (Number.isFinite(hrs) && hrs >= 0 ? hrs : 0);
    }, 0);
    avgResolutionTime = Math.round(totalHours / resolvedComplaints.length);
  }

  const mostActiveDepartment = departmentStats[0]?._id || null;

  const monthlyTrend = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const found = monthlyData.find(
      (m) => m._id.year === year && m._id.month === month,
    );
    monthlyTrend.push({ year, month, count: found?.count || 0 });
  }

  return sendSuccess(res, {
    stats: {
      total,
      pending,
      inProgress,
      resolved,
    },
    avgResolutionTime,
    mostActiveDepartment,
    monthlyTrend,
    recent: recentComplaints.map((item) => buildComplaintView(item)),
  });
});

exports.heatmap = asyncHandler(async (req, res) => {
  // Parse filters from query params
  const { department, priority, timeframe } = req.query;
  const role = req.user?.role;

  // Calculate time window based on timeframe filter
  const windowStart = new Date();
  switch (timeframe) {
    case "7days":
      windowStart.setDate(windowStart.getDate() - 7);
      break;
    case "3months":
      windowStart.setMonth(windowStart.getMonth() - 3);
      break;
    case "6months":
      windowStart.setMonth(windowStart.getMonth() - 6);
      break;
    case "30days":
    default:
      windowStart.setDate(windowStart.getDate() - 30);
      break;
  }

  // Build query filters
  const query = {
    createdAt: { $gte: windowStart },
  };

  if (role === "head" || role === "worker") {
    const actor = await User.findById(req.user._id).select("role department");
    if (!actor || actor.role !== role) {
      throw new AppError("Forbidden", 403);
    }
    query.department = actor.department;
  } else if (department && department !== "all") {
    query.department = department;
  }

  if (priority && priority !== "all") {
    query.priority = priority;
  }

  const complaints = await Complaint.find(query).select(
    "locationName coordinates status priority department createdAt",
  );

  const spotsByKey = new Map();

  for (const complaint of complaints) {
    const lat = Number(complaint.coordinates?.lat);
    const lng = Number(complaint.coordinates?.lng);
    const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
    const locationName = complaint.locationName?.trim() || null;
    const normalizedLocation = locationName?.toLowerCase();

    let key = null;
    if (hasCoords) {
      key = `coords:${lat.toFixed(3)},${lng.toFixed(3)}`;
    } else if (normalizedLocation) {
      key = `name:${normalizedLocation}`;
    }

    if (!key) continue;

    const isOpen = ["pending", "assigned", "in-progress"].includes(
      complaint.status,
    );
    const isHighPriority = complaint.priority === "High";

    if (!spotsByKey.has(key)) {
      spotsByKey.set(key, {
        locationName:
          locationName ||
          (hasCoords ? `${lat.toFixed(3)}, ${lng.toFixed(3)}` : "Unknown"),
        latSum: 0,
        lngSum: 0,
        coordCount: 0,
        totalComplaints: 0,
        openComplaints: 0,
        highPriorityComplaints: 0,
        departments: {},
        lastReportedAt: complaint.createdAt,
      });
    }

    const spot = spotsByKey.get(key);
    spot.totalComplaints += 1;
    if (isOpen) spot.openComplaints += 1;
    if (isHighPriority) spot.highPriorityComplaints += 1;

    spot.departments[complaint.department] =
      (spot.departments[complaint.department] || 0) + 1;

    if (complaint.createdAt > spot.lastReportedAt) {
      spot.lastReportedAt = complaint.createdAt;
    }

    if (hasCoords) {
      spot.latSum += lat;
      spot.lngSum += lng;
      spot.coordCount += 1;
    }
  }

  const spots = Array.from(spotsByKey.values())
    .map((spot) => {
      const intensity =
        spot.totalComplaints * 2 +
        spot.openComplaints +
        spot.highPriorityComplaints;

      const topDepartment =
        Object.entries(spot.departments).sort((a, b) => b[1] - a[1])[0]?.[0] ||
        "other";

      return {
        locationName: spot.locationName,
        coordinates:
          spot.coordCount > 0
            ? {
                lat: Number((spot.latSum / spot.coordCount).toFixed(6)),
                lng: Number((spot.lngSum / spot.coordCount).toFixed(6)),
              }
            : null,
        totalComplaints: spot.totalComplaints,
        openComplaints: spot.openComplaints,
        highPriorityComplaints: spot.highPriorityComplaints,
        topDepartment,
        intensity,
        severity: severityFromIntensity(intensity),
        lastReportedAt: spot.lastReportedAt,
      };
    })
    .sort((a, b) => b.intensity - a.intensity);
  // Removed .slice(0, 50) to show all spots

  return sendSuccess(res, {
    updatedAt: new Date().toISOString(),
    windowDays: timeframe || "30days",
    totalSpots: spots.length,
    spots,
  });
});
