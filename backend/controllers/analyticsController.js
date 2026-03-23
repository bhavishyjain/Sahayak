const Complaint = require("../models/Complaint");
const User = require("../models/User");
const AppError = require("../core/AppError");
const asyncHandler = require("../core/asyncHandler");
const { sendSuccess } = require("../core/response");
const { buildComplaintView } = require("../utils/complaintView");
const {
  ANALYTICS_STATUS_BUCKETS,
  getTimeframeWindowStart,
  monthsAgoStart,
} = require("../services/analyticsMetricsService");
const {
  normalizeAnalyticsFilters,
  applyAnalyticsComplaintFilters,
} = require("../services/filterContractService");
const { buildSummaryPayload } = require("../services/responseViewService");
const {
  getComplaintMetricSnapshot,
} = require("../services/complaintAnalyticsService");

function severityFromIntensity(intensity) {
  if (intensity >= 100) return "critical";
  if (intensity >= 50) return "high";
  if (intensity >= 25) return "medium";
  return "low";
}

exports.summary = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const analyticsFilters = await normalizeAnalyticsFilters(req.query, {
    allowDepartment: false,
    defaultTimeframe: null,
  });
  const summaryQuery = { userId };
  applyAnalyticsComplaintFilters(summaryQuery, analyticsFilters, "createdAt");
  const trendStart =
    summaryQuery.createdAt?.$gte ?? monthsAgoStart(5);

  const [
    snapshot,
    recentComplaints,
    monthlyData,
  ] = await Promise.all([
    getComplaintMetricSnapshot(summaryQuery),
    Complaint.find(summaryQuery)
      .sort({ createdAt: -1 })
      .limit(5)
      .select(
        "ticketId rawText refinedText department priority status locationName createdAt",
      ),
    Complaint.aggregate([
      { $match: { ...summaryQuery, createdAt: { $gte: trendStart } } },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]),
  ]);
  const avgResolutionTime = snapshot.avgResolutionTime || null;
  const departmentBreakdown = snapshot.departmentRows;

  const mostActiveDepartment = departmentBreakdown[0]?.department || null;

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

  const summary = {
    stats: {
      total: snapshot.total || 0,
      pending: snapshot.byStatus.pending || 0,
      assigned: snapshot.byStatus.assigned || 0,
      inProgress: snapshot.byStatus["in-progress"] || 0,
      resolved: snapshot.byStatus.resolved || 0,
    },
    avgResolutionTime,
    mostActiveDepartment,
    departmentBreakdown,
    monthlyTrend,
    recent: recentComplaints.map((item) => buildComplaintView(item)),
  };

  return sendSuccess(res, buildSummaryPayload(summary, "summary", summary));
});

exports.heatmap = asyncHandler(async (req, res) => {
  const {
    timeframe,
    granularity,
    ...analyticsFilters
  } = await normalizeAnalyticsFilters(req.query, {
    allowDepartment: req.user?.role !== "head" && req.user?.role !== "worker",
  });
  const role = req.user?.role;
  const complaintLevel = granularity === "complaint";

  // Calculate time window based on timeframe filter
  const windowStart = getTimeframeWindowStart(timeframe);

  // Build query filters
  const query = {};

  if (role === "head" || role === "worker") {
    const actor = await User.findById(req.user._id).select("role department");
    if (!actor || actor.role !== role) {
      throw new AppError("Forbidden", 403);
    }
    query.department = actor.department;
  }
  applyAnalyticsComplaintFilters(query, { ...analyticsFilters, timeframe }, "createdAt");

  const complaints = await Complaint.find(query).select(
    "locationName coordinates status priority department createdAt",
  );

  if (complaintLevel) {
    const spots = complaints
      .map((complaint) => {
        const lat = Number(complaint.coordinates?.lat);
        const lng = Number(complaint.coordinates?.lng);
        const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);

        if (!hasCoords) return null;

        const isOpen = ANALYTICS_STATUS_BUCKETS.backlog.includes(complaint.status);
        const isHighPriority = complaint.priority === "High";
        const intensity = (isOpen ? 8 : 2) + (isHighPriority ? 4 : 0);

        return {
          locationName:
            complaint.locationName?.trim() ||
            `${lat.toFixed(3)}, ${lng.toFixed(3)}`,
          coordinates: {
            lat: Number(lat.toFixed(6)),
            lng: Number(lng.toFixed(6)),
          },
          totalComplaints: 1,
          openComplaints: isOpen ? 1 : 0,
          unresolvedComplaints: isOpen ? 1 : 0,
          highPriorityComplaints: isHighPriority ? 1 : 0,
          topDepartment: complaint.department || "other",
          intensity,
          severity: severityFromIntensity(intensity),
          lastReportedAt: complaint.createdAt,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.intensity - a.intensity);

    return sendSuccess(res, {
      updatedAt: new Date().toISOString(),
      windowDays: timeframe,
      totalSpots: spots.length,
      granularity: "complaint",
      spots,
    });
  }

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

    const isOpen = ANALYTICS_STATUS_BUCKETS.backlog.includes(complaint.status);
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
        unresolvedComplaints: spot.openComplaints,
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
    windowDays: timeframe,
    totalSpots: spots.length,
    granularity: "cluster",
    spots,
  });
});
