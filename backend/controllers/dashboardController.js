const Complaint = require("../models/Complaint");

exports.summary = async (req, res) => {
  try {
    const userId = req.user._id;

    const [total, pending, inProgress, resolved, recentComplaints] =
      await Promise.all([
        Complaint.countDocuments({ userId }),
        Complaint.countDocuments({ userId, status: "pending" }),
        Complaint.countDocuments({ userId, status: "in-progress" }),
        Complaint.countDocuments({ userId, status: "resolved" }),
        Complaint.find({ userId })
          .sort({ createdAt: -1 })
          .limit(5)
          .select(
            "ticketId rawText refinedText department priority status locationName createdAt"
          ),
      ]);

    return res.status(200).json({
      stats: {
        total,
        pending,
        inProgress,
        resolved,
      },
      recent: recentComplaints.map((item) => ({
        id: item._id,
        ticketId: item.ticketId,
        title: item.rawText?.split(":")[0] || "Complaint",
        description: item.refinedText || item.rawText,
        department: item.department,
        priority: item.priority,
        status: item.status,
        locationName: item.locationName,
        createdAt: item.createdAt,
      })),
    });
  } catch (error) {
    console.error("dashboard summary error", error);
    return res.status(500).json({ message: "Server error" });
  }
};

function severityFromIntensity(intensity) {
  if (intensity >= 12) return "very-high";
  if (intensity >= 8) return "high";
  if (intensity >= 4) return "medium";
  return "low";
}

exports.heatmap = async (_req, res) => {
  try {
    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - 60);

    const complaints = await Complaint.find({
      createdAt: { $gte: windowStart },
    }).select("locationName coordinates status priority department createdAt");

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

      if (!key) {
        continue;
      }

      const isOpen = ["pending", "assigned", "in-progress"].includes(
        complaint.status
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
      if (isOpen) {
        spot.openComplaints += 1;
      }
      if (isHighPriority) {
        spot.highPriorityComplaints += 1;
      }
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
      .sort((a, b) => b.intensity - a.intensity)
      .slice(0, 50);

    return res.status(200).json({
      updatedAt: new Date().toISOString(),
      windowDays: 60,
      totalSpots: spots.length,
      spots,
    });
  } catch (error) {
    console.error("dashboard heatmap error", error);
    return res.status(500).json({ message: "Server error" });
  }
};
