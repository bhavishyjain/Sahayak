const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
require("dotenv").config();
const User = require("./models/User");
const Complaint = require("./models/Complaint");
const ComplaintMessage = require("./models/ComplaintMessage");
const ComplaintSpecialRequest = require("./models/ComplaintSpecialRequest");
const Department = require("./models/Department");
const WorkerInvitation = require("./models/WorkerInvitation");
const Notification = require("./models/Notification");
const ReportSchedule = require("./models/ReportSchedule");
const FestivalEvent = require("./models/FestivalEvent");
const generateTicketId = require("./utils/generateTicketId");

const SEED_DEPARTMENTS = [
  { name: "Road", code: "road" },
  { name: "Water", code: "water" },
  { name: "Electricity", code: "electricity" },
  { name: "Waste", code: "waste" },
  { name: "Drainage", code: "drainage" },
  { name: "Other", code: "other" },
];

// Indore areas with accurate coordinates - Expanded list for better coverage
const indoreAreas = [
  { name: "Vijay Nagar", lat: 22.7532, lng: 75.8937 },
  { name: "Palasia", lat: 22.7242, lng: 75.8694 },
  { name: "Rau", lat: 22.6186, lng: 75.7893 },
  { name: "MR 10", lat: 22.7447, lng: 75.9015 },
  { name: "Sapna Sangeeta Road", lat: 22.7285, lng: 75.8825 },
  { name: "Rajendra Nagar", lat: 22.7177, lng: 75.8574 },
  { name: "AB Road", lat: 22.716, lng: 75.882 },
  { name: "Bhawarkua", lat: 22.6933, lng: 75.8673 },
  { name: "Manik Bagh", lat: 22.7085, lng: 75.8522 },
  { name: "Treasure Island", lat: 22.7538, lng: 75.8682 },
  { name: "Scheme No. 54", lat: 22.7456, lng: 75.8756 },
  { name: "Scheme No. 78", lat: 22.7586, lng: 75.8893 },
  { name: "Scheme No. 94", lat: 22.7612, lng: 75.8945 },
  { name: "Scheme No. 114", lat: 22.7523, lng: 75.9123 },
  { name: "Scheme No. 140", lat: 22.7698, lng: 75.9234 },
  { name: "Bengali Square", lat: 22.7153, lng: 75.8642 },
  { name: "Sarafa Bazaar", lat: 22.7195, lng: 75.8577 },
  { name: "Kanch Mandir", lat: 22.7081, lng: 75.8631 },
  { name: "Rajwada", lat: 22.7196, lng: 75.8577 },
  { name: "Chhoti Gwaltoli", lat: 22.7223, lng: 75.8635 },
  { name: "Old Palasia", lat: 22.7215, lng: 75.8715 },
  { name: "New Palasia", lat: 22.728, lng: 75.8745 },
  { name: "South Tukoganj", lat: 22.7123, lng: 75.8732 },
  { name: "Sneh Nagar", lat: 22.6952, lng: 75.8925 },
  { name: "Vallabh Nagar", lat: 22.7385, lng: 75.8456 },
  { name: "LIG Colony", lat: 22.7008, lng: 75.8785 },
  { name: "Annapurna Road", lat: 22.7325, lng: 75.8612 },
  { name: "Bombay Hospital Road", lat: 22.7195, lng: 75.8812 },
  { name: "Race Course Road", lat: 22.7342, lng: 75.8523 },
  { name: "Khandwa Road", lat: 22.6875, lng: 75.8425 },
  { name: "Dewas Road", lat: 22.7582, lng: 75.8235 },
  { name: "Ujjain Road", lat: 22.7425, lng: 75.8265 },
  { name: "Airport Road", lat: 22.7285, lng: 75.8015 },
  { name: "Kanadiya Road", lat: 22.6423, lng: 75.8156 },
  { name: "Bicholi Mardana", lat: 22.8234, lng: 75.8567 },
  { name: "Khajrana", lat: 22.6856, lng: 75.8945 },
  { name: "Tilak Nagar", lat: 22.7245, lng: 75.8456 },
  { name: "Geeta Bhawan", lat: 22.7156, lng: 75.8734 },
  { name: "Navlakha", lat: 22.7089, lng: 75.8512 },
  { name: "Usha Nagar Extension", lat: 22.7412, lng: 75.8823 },
  { name: "Super Corridor", lat: 22.7634, lng: 75.9012 },
  { name: "Bypass Road", lat: 22.7512, lng: 75.9234 },
  { name: "Nipania", lat: 22.7745, lng: 75.8645 },
  { name: "Pipliya Kumar", lat: 22.7823, lng: 75.8856 },
  { name: "Silicon City", lat: 22.7698, lng: 75.9145 },
  { name: "Sukhliya", lat: 22.7234, lng: 75.9023 },
  { name: "Limbodi", lat: 22.6789, lng: 75.8234 },
  { name: "Lasudia Mori", lat: 22.6523, lng: 75.8645 },
  { name: "Chandan Nagar", lat: 22.7456, lng: 75.8567 },
  { name: "Nanda Nagar", lat: 22.7123, lng: 75.8923 },
];

// Helper: Get location for a specific area with small random offset
function getLocationForArea(areaName) {
  const area = indoreAreas.find((a) => a.name === areaName);
  if (!area) {
    // Fallback to random area if not found
    const randomArea =
      indoreAreas[Math.floor(Math.random() * indoreAreas.length)];
    return {
      name: randomArea.name,
      lat: randomArea.lat,
      lng: randomArea.lng,
    };
  }

  // Add small random offset (±0.002 degrees ≈ ±220 meters) for variety
  const offset = 0.002;
  const latOffset = (Math.random() - 0.5) * offset;
  const lngOffset = (Math.random() - 0.5) * offset;

  return {
    name: area.name,
    lat: parseFloat((area.lat + latOffset).toFixed(6)),
    lng: parseFloat((area.lng + lngOffset).toFixed(6)),
  };
}

// Helper: Get random area location
function getRandomLocation() {
  const area = indoreAreas[Math.floor(Math.random() * indoreAreas.length)];
  return getLocationForArea(area.name);
}

function getDepartmentNames() {
  return SEED_DEPARTMENTS.map((department) => department.name);
}

const LAST_60_DAYS = 60;
const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;
const TOTAL_COMPLAINTS = 2000;

const LANGUAGE_WEIGHTS = [
  { value: "en", weight: 0.56 },
  { value: "hi", weight: 0.34 },
  { value: "mr", weight: 0.05 },
  { value: "gu", weight: 0.03 },
  { value: "ur", weight: 0.02 },
];

function pickWeighted(options = []) {
  const totalWeight = options.reduce(
    (sum, item) => sum + (item.weight || 0),
    0,
  );
  if (totalWeight <= 0) return options[0]?.value;
  const random = Math.random() * totalWeight;
  let running = 0;
  for (const option of options) {
    running += option.weight || 0;
    if (random <= running) return option.value;
  }
  return options[options.length - 1]?.value;
}

function getRandomPreferredLanguage() {
  return pickWeighted(LANGUAGE_WEIGHTS) || "en";
}

function getRandomNotificationPreferences(role = "user") {
  const base = {
    complaintsUpdates: true,
    assignments: role === "worker" || role === "head" || role === "admin",
    escalations: role === "head" || role === "admin",
    systemAlerts: true,
  };

  return {
    complaintsUpdates:
      Math.random() < 0.92 ? base.complaintsUpdates : !base.complaintsUpdates,
    assignments: Math.random() < 0.94 ? base.assignments : !base.assignments,
    escalations: Math.random() < 0.9 ? base.escalations : !base.escalations,
    systemAlerts: Math.random() < 0.96 ? base.systemAlerts : !base.systemAlerts,
  };
}

function buildSeedPushTokens(seedKey, maxDevices = 1) {
  const deviceCount = Math.max(0, Number(maxDevices) || 0);
  return Array.from({ length: deviceCount }, (_, index) => {
    const tokenSeed = crypto
      .createHash("sha256")
      .update(`${seedKey}-push-${index}`)
      .digest("hex")
      .slice(0, 22);
    return `ExponentPushToken[${tokenSeed}]`;
  });
}

function buildSeedRefreshTokens(seedKey, sessionCount = 1, now = new Date()) {
  const safeCount = Math.max(0, Number(sessionCount) || 0);
  return Array.from({ length: safeCount }, (_, index) => ({
    tokenHash: crypto
      .createHash("sha256")
      .update(`${seedKey}-refresh-${index}`)
      .digest("hex"),
    expiresAt: new Date(
      now.getTime() + (7 + Math.floor(Math.random() * 45)) * ONE_DAY_MS,
    ),
  }));
}

function getEstimatedCompletionHours(department, priority) {
  const baseByDepartment = {
    Road: 42,
    Water: 20,
    Electricity: 16,
    Waste: 10,
    Drainage: 28,
    Other: 18,
  };
  const priorityMultiplier =
    priority === "High" ? 0.75 : priority === "Medium" ? 1 : 1.25;
  const variance = 0.85 + Math.random() * 0.35;
  const base = baseByDepartment[department] || baseByDepartment.Other;
  return Math.max(4, Math.round(base * priorityMultiplier * variance));
}

function getDurationHours(startAt, endAt) {
  if (!startAt || !endAt) return null;
  const start = new Date(startAt).getTime();
  const end = new Date(endAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return null;
  }
  return Math.round(((end - start) / ONE_HOUR_MS) * 10) / 10;
}

function createRouteData(screen, params = {}) {
  return {
    screen,
    params: Object.entries(params).reduce((acc, [key, value]) => {
      if (value === undefined || value === null || value === "") return acc;
      acc[key] = String(value);
      return acc;
    }, {}),
  };
}

function toDateOnly(date) {
  return new Date(date).toISOString().slice(0, 10);
}

function getCronExpressionForFrequency(frequency, hour = 9) {
  const safeHour = Math.max(0, Math.min(23, Number(hour) || 9));
  if (frequency === "daily") return `0 ${safeHour} * * *`;
  if (frequency === "weekly") return `0 ${safeHour} * * 1`;
  return `0 ${safeHour} 1 * *`;
}

function getRandomDateBetween(startDate, endDate) {
  const startMs = new Date(startDate).getTime();
  const endMs = new Date(endDate).getTime();

  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    return new Date();
  }

  if (endMs <= startMs) {
    return new Date(startMs);
  }

  return new Date(startMs + Math.random() * (endMs - startMs));
}

function getDateWithinLastDays(minDaysAgo, maxDaysAgo, now = new Date()) {
  const oldest = new Date(now.getTime() - maxDaysAgo * ONE_DAY_MS);
  const newest = new Date(now.getTime() - minDaysAgo * ONE_DAY_MS);
  return getRandomDateBetween(oldest, newest);
}

function getRequiredAgeHoursByStatus(status) {
  if (status === "resolved") return 120;
  if (status === "pending-approval") return 72;
  if (status === "needs-rework") return 72;
  if (status === "in-progress") return 48;
  if (status === "assigned") return 30;
  if (status === "cancelled") return 24;
  return 0;
}

function getComplaintCreatedAt(status, now = new Date()) {
  const bucket = Math.random();
  let minDaysAgo = 0;
  let maxDaysAgo = LAST_60_DAYS - 1;

  if (bucket < 0.45) {
    minDaysAgo = 0;
    maxDaysAgo = 7;
  } else if (bucket < 0.8) {
    minDaysAgo = 8;
    maxDaysAgo = 30;
  } else {
    minDaysAgo = 31;
    maxDaysAgo = LAST_60_DAYS - 1;
  }

  const requiredMinDaysAgo = getRequiredAgeHoursByStatus(status) / 24;
  if (minDaysAgo < requiredMinDaysAgo) {
    minDaysAgo = requiredMinDaysAgo;
    if (maxDaysAgo < minDaysAgo) {
      maxDaysAgo = minDaysAgo;
    }
  }

  const createdAt = getDateWithinLastDays(minDaysAgo, maxDaysAgo, now);
  const ageInDays = Math.floor(
    (now.getTime() - createdAt.getTime()) / ONE_DAY_MS,
  );

  return {
    createdAt,
    daysAgo: Math.max(ageInDays, 0),
  };
}

function createStageTimestamp(
  previousTimestamp,
  minHours,
  maxHours,
  now = new Date(),
) {
  const earliest = new Date(
    previousTimestamp.getTime() + minHours * ONE_HOUR_MS,
  );
  const latestCandidate = new Date(
    previousTimestamp.getTime() + maxHours * ONE_HOUR_MS,
  );
  const latest = latestCandidate > now ? now : latestCandidate;

  if (latest <= earliest) {
    return now > earliest ? earliest : new Date(now);
  }

  return getRandomDateBetween(earliest, latest);
}

function getLatestComplaintTimestamp(complaint, now = new Date()) {
  const values = [];
  const addTimestamp = (value) => {
    if (!value) return;
    const ts = new Date(value);
    if (!Number.isNaN(ts.getTime())) {
      values.push(ts);
    }
  };

  addTimestamp(complaint.createdAt);
  addTimestamp(complaint.assignedAt);
  addTimestamp(complaint.resolvedAt);

  (complaint.history || []).forEach((entry) => addTimestamp(entry.timestamp));
  (complaint.assignedWorkers || []).forEach((entry) => {
    addTimestamp(entry.assignedAt);
    addTimestamp(entry.completedAt);
  });

  if (complaint.feedback) {
    addTimestamp(complaint.feedback.ratedAt);
  }

  if (complaint.sla && Array.isArray(complaint.sla.escalationHistory)) {
    complaint.sla.escalationHistory.forEach((entry) =>
      addTimestamp(entry.escalatedAt),
    );
  }

  if (values.length === 0) {
    return new Date(now);
  }

  const latest = values.reduce(
    (max, value) => (value > max ? value : max),
    values[0],
  );
  return latest > now ? new Date(now) : latest;
}

function syncComplaintTimestamps(complaint, now = new Date()) {
  const resolvedEntry = (complaint.history || []).find(
    (entry) => entry.status === "resolved",
  );
  complaint.resolvedAt = resolvedEntry ? resolvedEntry.timestamp : null;

  if (complaint.sla && Array.isArray(complaint.sla.escalationHistory)) {
    const lastEscalation = complaint.sla.escalationHistory
      .map((entry) => entry.escalatedAt)
      .filter(Boolean)
      .sort((a, b) => new Date(a) - new Date(b))
      .pop();
    complaint.sla.lastEscalatedAt = lastEscalation || null;
  }

  complaint.updatedAt = getLatestComplaintTimestamp(complaint, now);
  return complaint;
}

function getUserSeedTimestamps(now = new Date()) {
  const createdAt = getDateWithinLastDays(0, LAST_60_DAYS - 1, now);
  const updatedAt = getRandomDateBetween(createdAt, now);
  const lastActive = getRandomDateBetween(updatedAt, now);

  return {
    createdAt,
    updatedAt,
    lastActive,
    tokenValidFrom: createdAt,
  };
}

function getInvitationSeedTimeline(status, now = new Date()) {
  let sentAt;
  let acceptedAt = null;
  let revokedAt = null;

  if (status === "pending") {
    sentAt = getDateWithinLastDays(1, 6, now);
  } else if (status === "accepted") {
    sentAt = getDateWithinLastDays(10, 50, now);
    acceptedAt = createStageTimestamp(sentAt, 12, 72, now);
  } else if (status === "expired") {
    sentAt = getDateWithinLastDays(15, LAST_60_DAYS - 1, now);
  } else {
    sentAt = getDateWithinLastDays(5, 40, now);
    revokedAt = createStageTimestamp(sentAt, 12, 96, now);
  }

  let expiresAt = new Date(sentAt.getTime() + 7 * ONE_DAY_MS);
  if (status === "expired" && expiresAt > now) {
    expiresAt = new Date(now.getTime() - ONE_HOUR_MS);
  }

  const updatedAt = revokedAt || acceptedAt || sentAt;

  return {
    sentAt,
    expiresAt,
    acceptedAt,
    revokedAt,
    updatedAt,
  };
}

// Department-specific task descriptions for assigned workers
const taskDescriptionsByDept = {
  Road: [
    "Inspect pothole depth and mark area for patching",
    "Fill and compact damaged road surface using bitumen mix",
    "Install warning signs and barricades around excavation",
    "Survey 200m stretch and document all damage points",
    "Remove debris and clear road surface before repair",
    "Apply cold-mix patching compound to potholes",
    "Restore road markings and reflectors post-repair",
    "Coordinate traffic diversion during repair work",
  ],
  Water: [
    "Locate and mark leaking pipe section on municipal map",
    "Shut off supply valve and replace burst pipe segment",
    "Clear blocked water main and restore pressure",
    "Test water quality at source and distribution point",
    "Inspect overhead tank and clean sediment buildup",
    "Repair damaged water meter and check for tampering",
    "Restore water supply connection to affected households",
    "Log flow readings before and after repair",
  ],
  Electricity: [
    "Inspect faulty transformer and check load readings",
    "Replace damaged street light fitting and ballast",
    "Restore tripped circuit breaker at distribution box",
    "Check underground cable for fault and mark location",
    "Repair broken electric pole and re-tension overhead wire",
    "Test voltage stability at affected feeder point",
    "Install new fuse and restore power supply",
    "Coordinate with MPEB control room for load shedding schedule",
  ],
  Waste: [
    "Collect overflowing waste and transport to processing centre",
    "Clean and disinfect garbage collection point",
    "Replace damaged bins and install new ones at marked spots",
    "Sweep and clear debris from 500m road stretch",
    "Remove illegal dumping and take photographic evidence",
    "Coordinate with vehicle crew for extra pickup rounds",
    "Apply lime and disinfectant to cleared area",
    "Log weight and type of waste collected for records",
  ],
  Drainage: [
    "Desilting of blocked storm drain using suction vehicle",
    "Clear 50m stretch of clogged drainage channel",
    "Repair cracked drain cover and replace broken grate",
    "Inspect drainage outlet near road and remove blockage",
    "Map drainage network in affected area for future reference",
    "Pump out waterlogged area and restore flow",
    "Apply sealant to leaking drain joint",
    "Coordinate with Nagar Nigam for desilting machine deployment",
  ],
  Other: [
    "Assess complaint on-site and document findings",
    "Coordinate with relevant department for resolution",
    "Complete assigned remediation task as per HOD instructions",
    "Take before and after photographs for record",
    "Submit completion report to department office",
  ],
};

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getTaskDescription(dept) {
  const arr = taskDescriptionsByDept[dept] || taskDescriptionsByDept.Other;
  return pickRandom(arr);
}

// Sample complaint titles and descriptions by department
const complaintTemplates = {
  Road: [
    {
      title: "Deep potholes on main road",
      descriptions: [
        "Large pothole near Sapna Sangeeta causing accidents. Two-wheelers are facing major issues. Water accumulation making it worse during rains.",
        "Multiple potholes on AB Road near traffic signal creating severe hazards. Vehicles getting damaged daily.",
        "Deep potholes filled with rainwater near Vijay Nagar square. Citizens falling due to poor visibility at night.",
        "Road severely damaged due to constant heavy vehicle movement. Surface completely broken in 200m stretch.",
      ],
    },
    {
      title: "Street lights not working",
      descriptions: [
        "All street lights on Bengali Square road not working for 2 weeks. Creating safety issues for women and children.",
        "Multiple street lights from Treasure Island to MR10 damaged since last month. Dark stretch very dangerous.",
        "Street light pole broken and hanging dangerously near school. Urgent repair needed before accident occurs.",
        "Complete darkness after 7 PM on main market road. Several theft incidents already reported.",
      ],
    },
    {
      title: "Road construction incomplete",
      descriptions: [
        "Road dug up 3 months ago for metro work but not filled back. Creating massive traffic jams daily.",
        "Half-completed road near Palasia Square abandoned. Exposed cables and debris everywhere making it unusable.",
        "Uneven road surface after utility work. No proper finishing done. Vehicles getting damaged frequently.",
        "Road widening project started in August but work stopped. Causing inconvenience to 5000+ residents daily.",
      ],
    },
    {
      title: "Traffic signal malfunction",
      descriptions: [
        "Signal at Rau crossing not working properly for last 10 days. Red and green showing together causing confusion.",
        "Timer not visible on traffic lights at Rajwada. Leading to unnecessary delays and traffic chaos.",
      ],
    },
    {
      title: "Road divider damaged",
      descriptions: [
        "Central divider broken near Old Palasia after recent accident. Sharp metal edges dangerous for riders.",
        "Missing divider tiles on Bhawarkua main road allowing wrong-side driving. Very risky situation.",
      ],
    },
    {
      title: "Poor road surface quality",
      descriptions: [
        "Freshly laid road already developing cracks within 2 months. Substandard material used. Needs investigation.",
        "Road surface peeling off in patches. Very uneven. Looks like poor quality tar was used.",
        "New road has depression in middle causing water logging. Poor construction standards evident.",
      ],
    },
    {
      title: "Missing road signs",
      descriptions: [
        "No speed limit board on school zone road. Children crossing without drivers slowing down. Urgent sign needed.",
        "One way sign removed and not replaced for weeks. Vehicles coming from wrong direction daily.",
        "Warning sign for speed breaker missing. Causing accidents especially at night. Several vehicles damaged.",
      ],
    },
    {
      title: "Speed breaker issues",
      descriptions: [
        "Unmarked speed breaker on main road. No reflectors or yellow paint. Very dangerous at night.",
        "Excessive speed breakers in 1km stretch. 7 breakers making commute painful. Unnecessary harassment.",
        "Speed breaker height too much. Scraping vehicle underbody. Not as per BIS standards.",
      ],
    },
    {
      title: "Road shoulder erosion",
      descriptions: [
        "Road edge crumbling after monsoon. Deep drop on side. Dangerous for vehicles taking turns.",
        "Shoulder completely washed away. Vehicles slipping into roadside ditch. Safety barrier needed.",
      ],
    },
    {
      title: "Parking issues",
      descriptions: [
        "No parking enforcement. Vehicles parked on both sides. Single lane created from double lane road.",
        "Illegal parking blocking fire engine access. Multiple complaints but no action. Very risky.",
      ],
    },
  ],
  Water: [
    {
      title: "Continuous water leakage",
      descriptions: [
        "Major pipeline burst on Annapurna Road. Thousands of liters wasting daily. Road getting damaged due to flooding.",
        "Water leaking from underground pipe for 15 days. Creating swamp-like condition. Mosquito breeding increased.",
        "Supply line broken near Vallabh Nagar junction. Water pressure very low in surrounding 20 buildings.",
        "Visible crack in main water line. Small leak now but may burst anytime. Preventive action required urgently.",
      ],
    },
    {
      title: "No water supply",
      descriptions: [
        "Zero water supply in LIG Colony for last 4 days. Tanker arrangements not working. 500+ families suffering.",
        "Extremely irregular water timing. Comes at 2 AM for just 15 minutes. Not possible to collect enough water.",
        "Very low pressure in entire Sneh Nagar area. Water not reaching overhead tanks. Using motor but still insufficient.",
        "No supply during peak morning hours. Tank empty by evening. Municipal water not coming for a week now.",
      ],
    },
    {
      title: "Contaminated water supply",
      descriptions: [
        "Yellow-brown colored water from taps since 3 days. Bad smell. Health department should test immediately.",
        "Water has strong chemical smell and visible particles. Multiple residents complaining of stomach issues.",
        "Sewage mixing in drinking water line suspected. Foul smell and brown color. Major health hazard.",
        "Extremely turbid water after rainfall. Filter getting blocked daily. Not safe for consumption.",
      ],
    },
    {
      title: "Water meter not working",
      descriptions: [
        "Meter showing wrong readings for 2 months. Bill amount doubled without increase in usage. Need recalibration.",
        "Digital meter display blank. Unable to track consumption but bills keep coming.",
      ],
    },
    {
      title: "Poor water pressure",
      descriptions: [
        "Water barely dripping from taps during peak hours. Cannot take bath or fill buckets properly.",
        "Zero pressure in overhead areas. Need to use electric pump but still insufficient water.",
        "Ground floor getting all water. Upper floors getting nothing. Pressure distribution problem.",
      ],
    },
    {
      title: "Water tanker issues",
      descriptions: [
        "Tanker coming irregularly. Sometimes 3 days gap. Cannot plan water usage. Need fixed schedule.",
        "Tanker water quality poor. Has dirt and particles. Not sure if safe for consumption.",
        "Charged Rs 500 for emergency tanker. Too expensive. Need better crisis management.",
      ],
    },
    {
      title: "Borewell problems",
      descriptions: [
        "Community borewell motor not working for 5 days. 50 families dependent on it. Urgent repair needed.",
        "Borewell water level dropped drastically. Needs deeper drilling or new borewell altogether.",
      ],
    },
  ],
  Electricity: [
    {
      title: "Frequent power cuts",
      descriptions: [
        "Power going off 6-7 times daily in Race Course area. Each cut lasting 30-45 minutes. Work from home impossible.",
        "Unannounced load shedding during daytime. Students unable to study for exams. No schedule published.",
        "Electricity failure during peak evening hours 7-10 PM daily. Affecting 100+ houses. Inverters not sufficient.",
        "Too many fluctuations and trips. Appliances getting damaged. Voltage very unstable in entire Bombay Hospital area.",
      ],
    },
    {
      title: "Transformer problem",
      descriptions: [
        "Transformer near Scheme 54 making extremely loud buzzing noise 24/7. Residents unable to sleep. May burst anytime.",
        "Severe voltage fluctuation from colony transformer. Many ACs and refrigerators damaged. Needs immediate replacement.",
        "Oil leaking from main transformer pole. Dangerous for public. Floor slippery and fire hazard present.",
        "Transformer overloaded with new connections. Frequent tripping affecting 200+ homes. Capacity upgrade needed urgently.",
      ],
    },
    {
      title: "Dangerous hanging wires",
      descriptions: [
        "High-tension wire hanging very low after storm. Children can touch it. Extremely dangerous situation.",
        "Broken electrical wire dangling on road near Dewas Naka. Sparking occasionally. Accident waiting to happen.",
        "Illegal connections causing wire web. Fire risk very high. Should be removed and penalties imposed.",
      ],
    },
    {
      title: "Street light electric pole damaged",
      descriptions: [
        "Pole leaning dangerously after truck accident. May fall on road anytime. Wires exposed.",
        "Broken pole with live wires on footpath. Several people got shocks. Needs emergency attention.",
      ],
    },
    {
      title: "Electric meter malfunction",
      descriptions: [
        "Meter running fast. Bill increased by 300% with same usage. Needs urgent inspection and replacement.",
        "Smart meter not recording correctly. Showing zero units but charging fixed amount. Very unfair.",
        "Meter box damaged and exposed to rain. Short circuit risk. Safety hazard needs immediate fixing.",
      ],
    },
    {
      title: "Billing disputes",
      descriptions: [
        "Received bill for 3 months together without prior notice. Amount too high to pay at once.",
        "Wrong meter reading noted. Bill shows 800 units but my actual usage was 250 units only.",
        "Getting neighbor's bill repeatedly. Complained 4 times but still not corrected. Very frustrating.",
      ],
    },
    {
      title: "New connection delay",
      descriptions: [
        "Applied for electricity connection 45 days ago. Paid fees but no action. Need connection urgently.",
        "All documents submitted but file not moving. Told to pay bribe for faster processing. Not acceptable.",
      ],
    },
    {
      title: "Voltage fluctuation",
      descriptions: [
        "Constant voltage variations damaging electronics. Lost TV and refrigerator already. Need stabilizer subsidy.",
        "Low voltage during summer evenings. AC not working properly. Fan running very slow.",
        "High voltage spikes during night. Bulbs bursting frequently. Dangerous situation.",
      ],
    },
  ],
  Waste: [
    {
      title: "Garbage not collected regularly",
      descriptions: [
        "Waste collection van not coming for 5 days. Huge pile accumulated. Stray dogs spreading it everywhere on Khandwa Road.",
        "Municipal garbage truck skipping our street since 2 weeks. Bins overflowing. Unbearable stench affecting everyone.",
        "Irregular timings of waste pickup. Sometimes comes at midnight, sometimes not at all. No fixed schedule.",
        "Collector refusing to take segregated waste. Says no facility to process. Then what's point of segregation?",
      ],
    },
    {
      title: "Illegal garbage dumping",
      descriptions: [
        "Empty plot being used as garbage dump by nearby restaurants. Rotting food waste attracting rats and flies.",
        "Construction debris dumped on main road footpath. Blocking pedestrian movement completely. Been there for a month.",
        "Medical waste from clinic thrown in regular dustbin. Syringes and bandages visible. Major health risk to rag-pickers.",
        "Factory dumping chemical waste in residential area at night. Strong toxic smell. Polluting groundwater possibly.",
      ],
    },
    {
      title: "Overflowing community dustbin",
      descriptions: [
        "Public bin at market square overflowing for days. Waste scattered in 50m radius. Shopkeepers cleaning themselves.",
        "Dustbin broken and garbage spilling on road. Dogs and cows making it worse. Very unhygienic condition.",
      ],
    },
    {
      title: "Burning garbage smoke",
      descriptions: [
        "People burning plastic waste daily at 6 AM. Toxic smoke entering homes. Children and elderly facing breathing problems.",
        "Municipal workers burning leaves and waste. Dangerous for residents with asthma. Better disposal method needed.",
      ],
    },
    {
      title: "Plastic waste accumulation",
      descriptions: [
        "Non-biodegradable waste not being collected separately. All mixed together. Plastic pollution increasing.",
        "Single-use plastic openly sold despite ban. No enforcement. Street vendors using plastic bags freely.",
      ],
    },
    {
      title: "E-waste dumping",
      descriptions: [
        "Old electronics, wires, and batteries dumped in regular bins. Hazardous materials. Need e-waste collection drive.",
        "Repair shops throwing circuit boards on street. Toxic metals leaching into soil. Environmental hazard.",
      ],
    },
    {
      title: "Waste segregation issues",
      descriptions: [
        "Dry and wet waste collection on same vehicle. Defeats purpose of segregation. Need separate vehicles.",
        "Residents not trained in segregation. Need awareness campaign and clear guidelines.",
      ],
    },
    {
      title: "Sanitation worker shortage",
      descriptions: [
        "Only 1 worker for 500 houses. Cannot manage workload. Need more staff allocation urgently.",
        "Workers on leave for weeks. No replacement arranged. Garbage piling up everywhere.",
      ],
    },
  ],
  Drainage: [
    {
      title: "Blocked drainage causing overflow",
      descriptions: [
        "Main drain completely clogged near South Tukoganj. Sewage water flowing on street during every rain. Extremely unhygienic.",
        "Drainage blockage causing sewage backup in houses. Already caused damage in 3 homes. Urgent cleaning required.",
        "Foul smell from blocked drain unbearable. Entire neighborhood affected. Mosquito breeding happening on large scale.",
        "Storm water drain blocked with silt and plastic. Even light rain causes flooding now. Needs de-silting badly.",
      ],
    },
    {
      title: "Open manhole cover missing",
      descriptions: [
        "Manhole cover stolen near school. Deep open pit very dangerous for children. Someone may fall at night.",
        "Broken manhole cover with sharp edges. Two-wheeler fell in it yesterday. Person injured. Replace immediately.",
        "Open drain without any cover in residential area. Child fell last week. Safety hazard that needs priority attention.",
        "Multiple manholes open on Ujjain Road after road work. No warning boards. Accidents happening frequently.",
      ],
    },
    {
      title: "Sewage line leakage",
      descriptions: [
        "Sewage leaking and mixing with groundwater. Hand pump water contaminated. Health risk for entire colony.",
        "Underground sewage pipe broken. Foul smell and wet patches on road. Needs excavation and repair.",
      ],
    },
    {
      title: "Waterlogging during rains",
      descriptions: [
        "Street floods within minutes of rainfall. Water enters ground floor homes. Drainage capacity insufficient.",
        "No proper slope in road design. Water accumulates in low-lying areas for hours. Mosquito breeding spot.",
        "Rain water mixed with sewage backing up into houses. Happened 3 times this monsoon. Nightmare situation.",
      ],
    },
    {
      title: "Storm drain maintenance",
      descriptions: [
        "Pre-monsoon cleaning not done. Drain full of silt. Will overflow in first heavy rain. Clean urgently.",
        "Never been cleaned in 5 years. Completely clogged with plastic and silt. Disaster waiting to happen.",
      ],
    },
    {
      title: "Septic tank overflow",
      descriptions: [
        "Community septic tank overflowing. No sewage line in our area. Tank not emptied for months. Unhygienic emergency.",
        "Septic tank cleaning vehicle not coming despite repeated requests. Tank full and starting to leak.",
      ],
    },
  ],
  Other: [
    {
      title: "Stray dog menace",
      descriptions: [
        "Pack of 15-20 stray dogs near Rajendra Nagar attacking morning walkers. 3 people bitten last week. Sterilization and relocation needed.",
        "Aggressive dogs blocking society entrance. Residents scared to go out after dark. Kids cannot play outside.",
      ],
    },
    {
      title: "Encroachment on footpath",
      descriptions: [
        "Vendors occupied entire footpath at Sarafa. Pedestrians forced to walk on road. Very dangerous with heavy traffic.",
        "Illegal parking and shops blocking public walkway. Senior citizens and disabled persons facing extreme difficulty.",
      ],
    },
    {
      title: "Public urination spot",
      descriptions: [
        "Wall near Chhoti Gwaltoli being used as public toilet. Unbearable smell. Needs public toilet facility or strict action.",
      ],
    },
    {
      title: "Tree falling risk",
      descriptions: [
        "Large old tree leaning badly. May fall on houses anytime. Termite damage visible. Urgent inspection needed.",
        "Dead tree branches hanging over school. Storm may cause them to fall. Children's safety at risk.",
      ],
    },
    {
      title: "Park maintenance",
      descriptions: [
        "Children's park equipment broken and rusted. Swings, slides all damaged. Kids getting injured. Urgent repair needed.",
        "Park lawn not maintained. Overgrown grass and weeds. Snakes spotted. Unsafe for morning walkers.",
        "Park lights not working. Dark after evening. Drug peddlers and anti-social elements gathering. Need security.",
      ],
    },
    {
      title: "Public toilet unavailable",
      descriptions: [
        "No public toilet in market area. Shopkeepers and customers facing major inconvenience. Hygiene issue.",
        "Existing public toilet locked for months. No maintenance. Open defecation increasing as result.",
        "Public toilet in filthy condition. No water, no cleaning. Unusable. Better than having nothing but barely.",
      ],
    },
    {
      title: "Noise pollution",
      descriptions: [
        "Loudspeaker noise from temple till midnight daily. Disturbing students' studies and sleep. Decibel limit violations.",
        "Construction work starting at 6 AM with heavy machinery. Weekends also no peace. Need time restrictions.",
        "Marriage garden noise till 2 AM. Every weekend disturbance. Local residents suffering. Enforce noise rules.",
      ],
    },
    {
      title: "Air pollution",
      descriptions: [
        "Factory emitting black smoke daily. Air quality very poor. Residents facing breathing issues. Need pollution board action.",
        "Dust from construction site spreading everywhere. Houses getting dirty. Health affected. Need dust control measures.",
        "Vehicle pollution at traffic signal unbearable. Need pollution checking drive and stricter norms.",
      ],
    },
    {
      title: "CCTV camera issues",
      descriptions: [
        "Public CCTV cameras not working. Multiple thefts happening. Cameras just for show. Need functional surveillance.",
        "CCTV footage not being monitored. Vandalism happening right under camera. What's the point?",
      ],
    },
    {
      title: "Street animal issues",
      descriptions: [
        "Stray cattle blocking roads. Causing traffic jams. Also aggressive sometimes. Need cattle pound.",
        "Pigs roaming in residential area. Coming from nearby slum. Creating unhygienic conditions. Control needed.",
        "Monkey menace in colony. Entering houses, destroying property. Already bit 2 children. Urgent relocation.",
      ],
    },
    {
      title: "Waterlogged park",
      descriptions: [
        "Park floods during rain. Water stagnant for days. Mosquito breeding. Children cannot play. Drainage needed.",
      ],
    },
    {
      title: "Illegal construction",
      descriptions: [
        "Building being constructed without permission. Blocking our sunlight and air. Violating norms. Stop construction.",
        "Commercial activity in residential zone. Converting house to warehouse. Increased truck traffic. Against rules.",
        "Balcony extended illegally onto road. Municipality approved plan different. Encroachment removal needed.",
      ],
    },
    {
      title: "Bus stop shelter damaged",
      descriptions: [
        "Bus stop roof collapsed. Commuters standing in sun and rain. Needs rebuilding urgently.",
        "No seating, no roof at bus stop. Elderly and women waiting in discomfort. Basic facility required.",
      ],
    },
  ],
};

// Feedback comments based on rating
const feedbackComments = {
  5: [
    "Excellent work! Problem resolved quickly and professionally. Very satisfied with the service.",
    "Outstanding response time. Worker was courteous and did a thorough job. Highly impressed!",
    "Perfect! Issue fixed permanently. The team went above and beyond expectations.",
    "Superb service! Work completed before deadline. Very happy with the quality and professionalism.",
    "Brilliant job! The problem that troubled us for months is finally solved. Thank you so much!",
    "Fantastic service! Worker was skilled, polite, and efficient. Couldn't ask for better.",
  ],
  4: [
    "Good work overall. Issue resolved satisfactorily. Took a bit longer than expected but quality is fine.",
    "Well done! Problem fixed properly. Would have been perfect if done a day earlier.",
    "Satisfied with the work. Worker was professional. Minor delay but end result is good.",
    "Nice job! Issue resolved as promised. Communication could have been better but work quality is great.",
    "Pretty good service. Work completed well. Small issues initially but resolved in the end.",
    "Happy with the resolution. Took some time but the worker did a careful and proper job.",
  ],
  3: [
    "Average service. Problem fixed but took longer than necessary. Worker was okay.",
    "Decent work. Issue resolved but had to follow up multiple times. Expected better response.",
    "Okay job. Work is done but quality could be improved. Had some concerns but got them fixed.",
    "Acceptable service. Problem solved eventually. Had to call again to get it done properly.",
    "Fair enough. Issue resolved after second visit. First attempt was incomplete.",
    "Moderate satisfaction. Work done but communication and timeliness need improvement.",
  ],
  2: [
    "Not satisfied. Work done but quality is poor. Problem might recur. Expected much better service.",
    "Disappointed with the service. Took too long and result is not up to the mark. Needs rework.",
    "Below expectations. Worker came late and work is not properly finished. Had to compromise.",
    "Poor experience. Issue partially fixed but many problems remain. Very slow response time.",
    "Unsatisfactory work. Had to call multiple times. Final result is mediocre at best.",
    "Not happy at all. Work incomplete and quality questionable. Waste of time and resources.",
  ],
  1: [
    "Terrible service! Problem not solved even after two visits. Completely unsatisfied and frustrated.",
    "Worst experience. Worker never showed up on time. Issue remains unresolved. Total disappointment.",
    "Highly dissatisfied! No proper communication, poor work quality. Problem is still there.",
    "Extremely poor service. Waste of time. Issue not fixed properly and worker was unprofessional.",
    "Pathetic response! Took forever and problem is still not resolved. Very angry with this service.",
    "Absolutely horrible! Multiple visits but issue persists. Incompetent work. Very disappointed.",
  ],
};

const reworkReasonTemplates = [
  "Before/after quality is insufficient. Please repair the remaining damaged portion and re-upload clear completion photos.",
  "Work is incomplete near the complaint location. Complete the pending section and submit fresh completion photos.",
  "Resolution does not match complaint scope. Fix the unresolved part and upload updated completion photos.",
  "Photo evidence is unclear/inadequate. Rework the task properly and submit new completion photos.",
  "Final finish quality is below standard. Rework and upload proper completion photos for review.",
];

function buildComplaintMessageSeeds({
  complaint,
  owner,
  assignedWorkers = [],
  workersById = new Map(),
  hodByDepartment = new Map(),
  now = new Date(),
}) {
  if (!complaint || !owner) return [];

  const messages = [];
  const addMessage = (sender, role, text, createdAt) => {
    if (!sender || !text || !createdAt) return;
    const timestamp = new Date(createdAt);
    if (Number.isNaN(timestamp.getTime())) return;
    messages.push({
      complaintId: complaint._id,
      senderId: sender._id,
      senderName: sender.fullName || sender.username || "User",
      senderRole: role,
      text,
      createdAt: timestamp > now ? now : timestamp,
    });
  };

  const leaderAssignment =
    assignedWorkers.find((assignment) => assignment?.isLeader) ||
    assignedWorkers[0] ||
    null;
  const leaderWorker = leaderAssignment
    ? workersById.get(String(leaderAssignment.workerId))
    : null;
  const departmentHod = hodByDepartment.get(complaint.department);
  const assignedEntry = (complaint.history || []).find(
    (entry) => entry.status === "assigned",
  );
  const pendingApprovalEntry = (complaint.history || []).find(
    (entry) => entry.status === "pending-approval",
  );
  const reworkEntry = (complaint.history || []).find(
    (entry) => entry.status === "needs-rework",
  );
  const resolvedEntry = (complaint.history || []).find(
    (entry) => entry.status === "resolved",
  );

  addMessage(
    owner,
    "user",
    `Please help with ${complaint.locationName}. Ticket ${complaint.ticketId} is affecting daily life here.`,
    new Date(new Date(complaint.createdAt).getTime() + 30 * 60 * 1000),
  );

  if (leaderWorker && assignedEntry?.timestamp) {
    addMessage(
      leaderWorker,
      "worker",
      `I am taking the lead on this ${complaint.department.toLowerCase()} complaint and will coordinate the field work.`,
      new Date(new Date(assignedEntry.timestamp).getTime() + 45 * 60 * 1000),
    );
  }

  if (assignedWorkers.length > 1 && assignedEntry?.timestamp) {
    assignedWorkers
      .filter((assignment) => !assignment?.isLeader)
      .slice(0, 1)
      .forEach((assignment, index) => {
        const worker = workersById.get(String(assignment.workerId));
        if (!worker) return;
        addMessage(
          worker,
          "worker",
          `I have joined this task and will support the leader with on-site execution.`,
          new Date(
            new Date(assignedEntry.timestamp).getTime() +
              (2 + index) * ONE_HOUR_MS,
          ),
        );
      });
  }

  if (departmentHod && assignedEntry?.timestamp && Math.random() < 0.75) {
    addMessage(
      departmentHod,
      "head",
      `Department team assigned. Please use this thread for updates and blocker escalation.`,
      new Date(new Date(assignedEntry.timestamp).getTime() + 90 * 60 * 1000),
    );
  }

  if (pendingApprovalEntry?.timestamp && leaderWorker) {
    addMessage(
      leaderWorker,
      "worker",
      "Field work is completed from our side. Completion photos have been uploaded for approval.",
      new Date(
        new Date(pendingApprovalEntry.timestamp).getTime() + 20 * 60 * 1000,
      ),
    );
  }

  if (reworkEntry?.timestamp && departmentHod) {
    addMessage(
      departmentHod,
      "head",
      String(
        complaint.note ||
          "Please rework the unresolved portion and update once complete.",
      ),
      new Date(new Date(reworkEntry.timestamp).getTime() + 15 * 60 * 1000),
    );
  }

  if (resolvedEntry?.timestamp && owner && Math.random() < 0.65) {
    addMessage(
      owner,
      "user",
      complaint.feedback?.rating >= 4
        ? "The issue looks resolved now. Thank you for the quick action."
        : "I can confirm the issue was attended to. Sharing my feedback separately.",
      new Date(new Date(resolvedEntry.timestamp).getTime() + 2 * ONE_HOUR_MS),
    );
  }

  return messages
    .filter((message) => message.createdAt >= complaint.createdAt)
    .sort((left, right) => left.createdAt - right.createdAt);
}

function getAlternativeDepartment(currentDepartment) {
  const candidates = getDepartmentNames().filter(
    (department) => department !== currentDepartment,
  );
  return pickRandom(candidates);
}

function getAlternativePriority(currentPriority) {
  const candidates = ["Low", "Medium", "High"].filter(
    (priority) => priority !== currentPriority,
  );
  return pickRandom(candidates);
}

// Generate random complaint
function generateComplaint(userId, allUsers) {
  const departments = getDepartmentNames();
  const department =
    departments[Math.floor(Math.random() * departments.length)];
  const templates = complaintTemplates[department];
  const template = templates[Math.floor(Math.random() * templates.length)];
  const description =
    template.descriptions[
      Math.floor(Math.random() * template.descriptions.length)
    ];

  const locationData = getRandomLocation();

  // More realistic priority distribution
  // High: 15%, Medium: 45%, Low: 40%
  const priorityRandom = Math.random();
  let priority;
  if (priorityRandom < 0.15) {
    priority = "High";
  } else if (priorityRandom < 0.6) {
    priority = "Medium";
  } else {
    priority = "Low";
  }

  // More realistic status distribution
  // pending: 34%, assigned: 20%, in-progress: 17%, pending-approval: 10%, needs-rework: 4%, resolved: 12%, cancelled: 3%
  const statusRandom = Math.random();
  let status;
  if (statusRandom < 0.34) {
    status = "pending";
  } else if (statusRandom < 0.54) {
    status = "assigned";
  } else if (statusRandom < 0.71) {
    status = "in-progress";
  } else if (statusRandom < 0.81) {
    status = "pending-approval";
  } else if (statusRandom < 0.85) {
    status = "needs-rework";
  } else if (statusRandom < 0.97) {
    status = "resolved";
  } else {
    status = "cancelled";
  }

  const now = new Date();
  const { createdAt, daysAgo } = getComplaintCreatedAt(status, now);

  // More realistic upvote distribution
  // Recent and high priority complaints get more upvotes
  const baseUpvotes = Math.floor(Math.random() * 15);
  const priorityBonus =
    priority === "High" ? 30 : priority === "Medium" ? 10 : 0;
  const ageBonus = daysAgo > 7 ? Math.floor(daysAgo / 3) : 0; // Older complaints accumulate upvotes
  const upvoteCount = baseUpvotes + priorityBonus + ageBonus;
  const upvotesArray = [];
  if (allUsers && allUsers.length > 0) {
    const numUpvotes = Math.min(upvoteCount, allUsers.length);
    const shuffledUsers = [...allUsers].sort(() => Math.random() - 0.5);
    for (let i = 0; i < numUpvotes; i++) {
      upvotesArray.push(shuffledUsers[i]._id);
    }
  }

  const complaint = {
    ticketId: generateTicketId(),
    userId: userId,
    rawText: `${template.title}: ${description}`,
    refinedText: description,
    department: department,
    coordinates: { lat: locationData.lat, lng: locationData.lng },
    locationName: `${locationData.name}, Indore`,
    priority: priority,
    status: status,
    upvotes: upvotesArray,
    upvoteCount: upvotesArray.length,
    createdAt: createdAt,
    updatedAt: createdAt,
    proofImage: [], // Will be populated below
  };

  // ── AI Analysis ──────────────────────────────────────────────────────
  const AI_DEPT_KEYWORDS = {
    Road: ["pothole", "road damage", "crack", "tarring", "speed bump"],
    Water: [
      "water leakage",
      "pipe burst",
      "shortage",
      "contaminated water",
      "tanker",
    ],
    Electricity: [
      "power outage",
      "streetlight",
      "exposed wire",
      "pole damage",
      "transformer",
    ],
    Waste: [
      "garbage",
      "overflowing bin",
      "littering",
      "sanitation",
      "waste collection",
    ],
    Drainage: [
      "blocked drain",
      "waterlogging",
      "sewage overflow",
      "manhole",
      "flooding",
    ],
    Other: ["noise", "encroachment", "stray animals", "tree fall", "vandalism"],
  };
  const AI_REASONING = {
    Road: "Road infrastructure complaint with clear indicators of physical damage needing civic attention.",
    Water:
      "Water supply issue identified from description keywords indicating supply chain or pipeline problem.",
    Electricity:
      "Electrical infrastructure concern requiring immediate assessment for safety.",
    Waste:
      "Waste management issue detected — affects public health and sanitation standards.",
    Drainage:
      "Drainage/sewage concern with potential flooding or public health risk.",
    Other:
      "General civic complaint routed to the appropriate municipal department.",
  };

  // Sentiment correlates with priority
  const aiSentiment =
    priority === "High"
      ? Math.random() < 0.55
        ? "angry"
        : "frustrated"
      : priority === "Medium"
        ? Math.random() < 0.6
          ? "frustrated"
          : "calm"
        : Math.random() < 0.7
          ? "calm"
          : "frustrated";

  const aiUrgency =
    priority === "High"
      ? 7 + Math.floor(Math.random() * 3) // 7-9
      : priority === "Medium"
        ? 4 + Math.floor(Math.random() * 3) // 4-6
        : 1 + Math.floor(Math.random() * 3); // 1-3

  const allKw = AI_DEPT_KEYWORDS[department] || AI_DEPT_KEYWORDS.Other;
  const shuffledKw = [...allKw].sort(() => Math.random() - 0.5);
  const aiKeywords = shuffledKw.slice(0, 2 + Math.floor(Math.random() * 2));

  const aiAffectedCount =
    priority === "High"
      ? 20 + Math.floor(Math.random() * 80)
      : priority === "Medium"
        ? 5 + Math.floor(Math.random() * 20)
        : 1 + Math.floor(Math.random() * 5);

  // ~30% chance AI disagrees on priority
  const priorityOptions = ["Low", "Medium", "High"];
  const aiSuggestedPriority =
    Math.random() < 0.3
      ? priorityOptions[
          (priorityOptions.indexOf(priority) +
            1 +
            Math.floor(Math.random() * 2)) %
            3
        ]
      : priority;

  complaint.aiAnalysis = {
    sentiment: aiSentiment,
    urgency: aiUrgency,
    keywords: aiKeywords,
    affectedCount: aiAffectedCount,
    suggestedPriority: aiSuggestedPriority,
    reasoning: AI_REASONING[department] || AI_REASONING.Other,
    department: department,
    confidence: 0.85 + Math.random() * 0.15,
  };

  // ~20% chance AI suggests a different department (creates review candidates)
  if (Math.random() < 0.2) {
    const altDepts = getDepartmentNames().filter((d) => d !== department);
    complaint.aiAnalysis.department =
      altDepts[Math.floor(Math.random() * altDepts.length)];
    complaint.aiAnalysis.confidence = 0.7 + Math.random() * 0.2; // 70-90% when dept differs
  }
  // ─────────────────────────────────────────────────────────────────────

  // Add proof images (before photos) - 60% chance
  if (Math.random() < 0.6) {
    const photoCount = Math.floor(Math.random() * 3) + 1; // 1-3 photos
    const sampleProofPhotos = [
      "https://images.unsplash.com/photo-1549560443-7f6b4b13d6d3?w=800",
      "https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=800",
      "https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?w=800",
      "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800",
      "https://images.unsplash.com/photo-1581092918484-8313e1f7f53d?w=800",
    ];
    for (let j = 0; j < photoCount; j++) {
      complaint.proofImage.push(
        sampleProofPhotos[Math.floor(Math.random() * sampleProofPhotos.length)],
      );
    }
  }

  // Add history based on status
  complaint.history = [
    {
      status: "pending",
      updatedBy: userId,
      timestamp: createdAt,
      note: "Complaint registered by citizen",
    },
  ];

  if (
    [
      "assigned",
      "in-progress",
      "pending-approval",
      "needs-rework",
      "resolved",
    ].includes(status)
  ) {
    const assignedDate = createStageTimestamp(createdAt, 1, 24, now);
    complaint.history.push({
      status: "assigned",
      updatedBy: null, // patched in main loop with actual HOD/worker id
      timestamp: assignedDate,
      note: "Assigned to worker by Head of Department",
    });
  }

  if (
    ["in-progress", "pending-approval", "needs-rework", "resolved"].includes(
      status,
    )
  ) {
    const inProgressDate = createStageTimestamp(
      complaint.history[complaint.history.length - 1].timestamp,
      1,
      12,
      now,
    );
    complaint.history.push({
      status: "in-progress",
      updatedBy: null, // patched in main loop with worker id
      timestamp: inProgressDate,
      note: "Worker started working on the issue",
    });
  }

  if (status === "needs-rework") {
    const reworkReason = pickRandom(reworkReasonTemplates);
    complaint.note = reworkReason;

    const approvalDate = createStageTimestamp(
      complaint.history[complaint.history.length - 1].timestamp,
      1,
      12,
      now,
    );
    complaint.history.push({
      status: "pending-approval",
      updatedBy: null, // worker submitted
      timestamp: approvalDate,
      note: "Worker submitted work for HOD approval",
    });
    const reworkDate = createStageTimestamp(approvalDate, 1, 12, now);
    complaint.history.push({
      status: "needs-rework",
      updatedBy: null, // HOD rejected
      timestamp: reworkDate,
      note: `Marked as needs-rework by HOD: ${reworkReason}`,
    });
  }

  if (status === "pending-approval") {
    const approvalDate = createStageTimestamp(
      complaint.history[complaint.history.length - 1].timestamp,
      1,
      12,
      now,
    );
    complaint.history.push({
      status: "pending-approval",
      updatedBy: null,
      timestamp: approvalDate,
      note: "Worker submitted completion photos for HOD approval",
    });
  }

  if (status === "resolved") {
    const approvalDate = createStageTimestamp(
      complaint.history[complaint.history.length - 1].timestamp,
      1,
      12,
      now,
    );
    complaint.history.push({
      status: "pending-approval",
      updatedBy: null,
      timestamp: approvalDate,
      note: "Worker submitted completion photos for HOD approval",
    });

    const resolvedDate = createStageTimestamp(
      complaint.history[complaint.history.length - 1].timestamp,
      1,
      48,
      now,
    );
    complaint.history.push({
      status: "resolved",
      updatedBy: null, // HOD approved
      timestamp: resolvedDate,
      note: "HOD approved completion — issue resolved",
    });

    // Add feedback for resolved complaints (70% chance)
    if (Math.random() > 0.3) {
      // Rating distribution: mostly 4-5, some 3, fewer 1-2
      const ratingRandom = Math.random();
      let rating;
      if (ratingRandom < 0.5) {
        rating = 5; // 50% get 5 stars
      } else if (ratingRandom < 0.8) {
        rating = 4; // 30% get 4 stars
      } else if (ratingRandom < 0.93) {
        rating = 3; // 13% get 3 stars
      } else if (ratingRandom < 0.97) {
        rating = 2; // 4% get 2 stars
      } else {
        rating = 1; // 3% get 1 star
      }

      const comments = feedbackComments[rating];
      const randomComment =
        comments[Math.floor(Math.random() * comments.length)];

      complaint.feedback = {
        rating: rating,
        comment: randomComment,
        ratedBy: userId,
        ratedAt: createStageTimestamp(resolvedDate, 1, 25, now),
      };
    }
  }

  if (status === "cancelled") {
    const cancelledDate = createStageTimestamp(createdAt, 1, 12, now);
    complaint.history.push({
      status: "cancelled",
      updatedBy: null,
      timestamp: cancelledDate,
      note: "Complaint cancelled by HOD before assignment",
    });
  }

  // ── SLA ──────────────────────────────────────────────────────────────
  // SLA window: High = 24 h, Medium = 72 h, Low = 168 h (7 days)
  const slaHours = priority === "High" ? 24 : priority === "Medium" ? 72 : 168;
  const slaDeadline = new Date(createdAt);
  slaDeadline.setHours(slaDeadline.getHours() + slaHours);

  const isTerminal = status === "resolved" || status === "cancelled";
  const isOverdue = !isTerminal && slaDeadline < now;
  // escalate overdue active complaints (not all at once — ~70% actually escalated)
  const shouldEscalate = isOverdue && Math.random() < 0.7;
  const escalationLevel = shouldEscalate ? (Math.random() < 0.3 ? 2 : 1) : 0;

  complaint.sla = {
    dueDate: slaDeadline,
    isOverdue: isOverdue,
    escalated: shouldEscalate,
    escalationLevel: escalationLevel,
    // escalationHistory is patched in main loop (needs HOD id)
    escalationHistory: [],
  };

  syncComplaintTimestamps(complaint, now);
  // ─────────────────────────────────────────────────────────────────────

  return complaint;
}

// Main seed function
async function seedDatabase() {
  try {
    console.log("🔄 Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Clear existing data
    console.log("\n🗑️  Clearing existing data...");
    await User.deleteMany({});
    await Complaint.deleteMany({});
    await ComplaintMessage.deleteMany({});
    await ComplaintSpecialRequest.deleteMany({});
    await Department.deleteMany({});
    await WorkerInvitation.deleteMany({});
    await Notification.deleteMany({});
    await ReportSchedule.deleteMany({});
    await FestivalEvent.deleteMany({});
    console.log("✅ Existing data cleared");

    console.log("\n🏢 Creating departments...");
    const createdDepartments = await Department.insertMany(
      SEED_DEPARTMENTS.map((department) => ({
        ...department,
        isActive: true,
      })),
    );
    console.log(`✅ Created ${createdDepartments.length} departments`);

    // Create users
    console.log("\n👥 Creating users...");
    const hashedPassword = await bcrypt.hash("password123", 10);
    const users = [];

    // Admin users (2)
    for (let i = 1; i <= 2; i++) {
      const username = `admin${i}`;
      users.push({
        username,
        password: hashedPassword,
        role: "admin",
        department: "Other",
        email: `admin${i}@indore.gov.in`,
        phone: `91${9000000000 + i}`,
        fullName: `Admin ${i}`,
        emailVerified: true,
        preferredLanguage: "en",
        notificationPreferences: getRandomNotificationPreferences("admin"),
        pushTokens: buildSeedPushTokens(username, 1),
        refreshTokens: buildSeedRefreshTokens(username, 2),
        ...getUserSeedTimestamps(),
      });
    }

    // HOD/Head users
    const departments = getDepartmentNames().filter(
      (department) => department !== "Other",
    );
    const hodSeedPlan = [
      { department: "Road", variant: "primary" },
      { department: "Road", variant: "operations" },
      { department: "Water", variant: "primary" },
      { department: "Water", variant: "field" },
      { department: "Electricity", variant: "primary" },
      { department: "Electricity", variant: "support" },
      { department: "Waste", variant: "primary" },
      { department: "Drainage", variant: "primary" },
    ];
    hodSeedPlan.forEach(({ department: dept, variant }, idx) => {
      const username =
        variant === "primary"
          ? `hod_${dept.toLowerCase()}`
          : `hod_${dept.toLowerCase()}_${variant}`;
      const fullNameSuffix =
        variant === "primary"
          ? ""
          : ` ${variant.charAt(0).toUpperCase() + variant.slice(1)}`;
      users.push({
        username,
        password: hashedPassword,
        role: "head",
        department: dept,
        email:
          variant === "primary"
            ? `hod.${dept.toLowerCase()}@indore.gov.in`
            : `hod.${dept.toLowerCase()}.${variant}@indore.gov.in`,
        phone: `91${9100000000 + idx}`,
        fullName: `HOD ${dept}${fullNameSuffix}`,
        emailVerified: true,
        preferredLanguage: Math.random() < 0.65 ? "hi" : "en",
        notificationPreferences: getRandomNotificationPreferences("head"),
        pushTokens: buildSeedPushTokens(username, Math.random() < 0.4 ? 2 : 1),
        refreshTokens: buildSeedRefreshTokens(
          username,
          Math.random() < 0.5 ? 2 : 1,
        ),
        ...getUserSeedTimestamps(),
      });
    });

    // Worker users (30 - 6 per department for better load distribution)
    for (let dept of departments) {
      for (let i = 1; i <= 6; i++) {
        const location = getRandomLocation();
        const username = `worker_${dept.toLowerCase()}_${i}`;
        users.push({
          username,
          password: hashedPassword,
          role: "worker",
          department: dept,
          email: `worker.${dept}.${i}@indore.gov.in`,
          phone: `91${9200000000 + users.length}`,
          fullName: `Worker ${dept.charAt(0).toUpperCase() + dept.slice(1)} ${i}`,
          rating: 3.5 + Math.random() * 1.5,
          performanceMetrics: {
            totalCompleted: Math.floor(Math.random() * 50),
            averageCompletionTime: 12 + Math.random() * 24,
            currentWeekCompleted: Math.floor(Math.random() * 10),
            customerRating: 3.8 + Math.random() * 1.2,
          },
          workLocation: {
            lat: location.lat,
            lng: location.lng,
            address: `${location.name}, Indore`,
          },
          emailVerified: true,
          preferredLanguage: Math.random() < 0.7 ? "hi" : "en",
          notificationPreferences: getRandomNotificationPreferences("worker"),
          pushTokens: buildSeedPushTokens(
            username,
            Math.random() < 0.3 ? 2 : 1,
          ),
          refreshTokens: buildSeedRefreshTokens(
            username,
            1 + Math.floor(Math.random() * 2),
          ),
          ...getUserSeedTimestamps(),
        });
      }
    }

    // Regular user accounts (150 citizens for realistic complaint spread)
    const firstNames = [
      "Rahul",
      "Priya",
      "Amit",
      "Sneha",
      "Rajesh",
      "Anjali",
      "Vikram",
      "Pooja",
      "Suresh",
      "Kavita",
      "Anil",
      "Ritu",
      "Deepak",
      "Neha",
      "Sanjay",
      "Meera",
      "Arjun",
      "Divya",
      "Manoj",
      "Swati",
      "Karan",
      "Nisha",
      "Vishal",
      "Aarti",
      "Rohit",
      "Simran",
      "Aakash",
      "Riya",
      "Nitin",
      "Pallavi",
      "Gaurav",
      "Shruti",
      "Ashish",
      "Megha",
      "Santosh",
      "Preeti",
      "Hemant",
      "Jyoti",
      "Pankaj",
      "Seema",
      "Ramesh",
      "Sunita",
      "Dinesh",
      "Rekha",
      "Mahesh",
      "Geeta",
      "Prakash",
      "Manju",
      "Sachin",
      "Anita",
      "Ravi",
      "Sangeeta",
      "Ajay",
      "Alka",
      "Vijay",
      "Vandana",
    ];
    const lastNames = [
      "Sharma",
      "Patel",
      "Singh",
      "Verma",
      "Kumar",
      "Gupta",
      "Yadav",
      "Jain",
      "Tiwari",
      "Agarwal",
      "Mishra",
      "Pandey",
      "Chauhan",
      "Rajput",
      "Parmar",
      "Malhotra",
      "Shukla",
      "Saxena",
      "Mehta",
      "Soni",
      "Joshi",
      "Desai",
      "Reddy",
      "Nair",
      "Iyer",
      "Kulkarni",
      "Menon",
      "Rao",
      "Varma",
      "Bhatia",
    ];

    for (let i = 1; i <= 150; i++) {
      const firstName =
        firstNames[Math.floor(Math.random() * firstNames.length)];
      const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
      const username = `user${i}`;
      users.push({
        username,
        password: hashedPassword,
        role: "user",
        department: "Other",
        email: `user${i}@example.com`,
        phone: `91${8000000000 + i}`,
        fullName: `${firstName} ${lastName}`,
        emailVerified: true,
        preferredLanguage: getRandomPreferredLanguage(),
        notificationPreferences: getRandomNotificationPreferences("user"),
        pushTokens:
          Math.random() < 0.7
            ? buildSeedPushTokens(username, Math.random() < 0.2 ? 2 : 1)
            : [],
        refreshTokens: buildSeedRefreshTokens(
          username,
          Math.random() < 0.55 ? 1 : 0,
        ),
        ...getUserSeedTimestamps(),
      });
    }

    const createdUsers = await User.insertMany(users);
    console.log(`✅ Created ${createdUsers.length} users:`);
    console.log(
      `   - ${createdUsers.filter((u) => u.role === "admin").length} Admins`,
    );
    console.log(
      `   - ${createdUsers.filter((u) => u.role === "head").length} HODs`,
    );
    console.log(
      `   - ${createdUsers.filter((u) => u.role === "worker").length} Workers`,
    );
    console.log(
      `   - ${createdUsers.filter((u) => u.role === "user").length} Citizens`,
    );

    // Create complaints
    console.log("\n📋 Creating complaints...");
    const complaints = [];
    const regularUsers = createdUsers.filter((u) => u.role === "user");
    const workers = createdUsers.filter((u) => u.role === "worker");
    const hods = createdUsers.filter((u) => u.role === "head");

    // Generate complaints with realistic distribution
    let multiWorkerCount = 0;
    for (let i = 1; i <= TOTAL_COMPLAINTS; i++) {
      const randomUser =
        regularUsers[Math.floor(Math.random() * regularUsers.length)];
      const complaint = generateComplaint(randomUser._id, regularUsers);

      // Assign worker if status is assigned or beyond
      if (
        [
          "assigned",
          "in-progress",
          "pending-approval",
          "needs-rework",
          "resolved",
        ].includes(complaint.status)
      ) {
        const deptWorkers = workers.filter(
          (w) => w.department === complaint.department,
        );
        if (deptWorkers.length > 0) {
          const assignedWorker =
            deptWorkers[Math.floor(Math.random() * deptWorkers.length)];
          complaint.assignedAt = complaint.history.find(
            (h) => h.status === "assigned",
          )?.timestamp;

          // Pick a HOD for this department to patch history updatedBy
          const deptHod = hods.find(
            (h) => h.department === complaint.department,
          );
          complaint.assignedBy = deptHod?._id || null;
          complaint.estimatedCompletionTime = getEstimatedCompletionHours(
            complaint.department,
            complaint.priority,
          );

          // Patch updatedBy in history entries
          complaint.history.forEach((h) => {
            if (
              h.status === "assigned" ||
              h.status === "needs-rework" ||
              h.status === "resolved" ||
              h.status === "cancelled"
            ) {
              if (deptHod) h.updatedBy = deptHod._id;
            } else if (
              h.status === "in-progress" ||
              h.status === "pending-approval"
            ) {
              h.updatedBy = assignedWorker._id;
            }
          });

          // Initialize assignedWorkers array
          const primaryTaskStatus =
            complaint.status === "resolved"
              ? "completed"
              : complaint.status === "pending-approval"
                ? "completed"
                : complaint.status === "needs-rework"
                  ? "needs-rework"
                  : complaint.status === "in-progress"
                    ? "in-progress"
                    : "assigned";

          const completedAtTimestamp = [
            "resolved",
            "pending-approval",
          ].includes(complaint.status)
            ? complaint.history.find((h) => h.status === "pending-approval")
                ?.timestamp ||
              complaint.history.find((h) => h.status === "resolved")?.timestamp
            : null;

          complaint.assignedWorkers = [
            {
              workerId: assignedWorker._id,
              assignedAt: complaint.assignedAt,
              taskDescription: getTaskDescription(complaint.department),
              status: primaryTaskStatus,
              isLeader: true,
              completedAt: completedAtTimestamp,
            },
          ];

          // 15% chance of multi-worker assignment for medium/high priority
          if (
            (complaint.priority === "Medium" ||
              complaint.priority === "High") &&
            Math.random() < 0.15 &&
            deptWorkers.length > 1
          ) {
            const secondWorker = deptWorkers.find(
              (w) => w._id.toString() !== assignedWorker._id.toString(),
            );
            if (secondWorker) {
              const secondTaskStatus =
                complaint.status === "resolved"
                  ? "completed"
                  : complaint.status === "pending-approval"
                    ? "completed"
                    : complaint.status === "needs-rework"
                      ? "needs-rework"
                      : complaint.status === "in-progress"
                        ? "in-progress"
                        : "assigned";
              complaint.assignedWorkers.push({
                workerId: secondWorker._id,
                assignedAt: complaint.assignedAt,
                taskDescription: getTaskDescription(complaint.department),
                status: secondTaskStatus,
                isLeader: false,
                completedAt: completedAtTimestamp,
              });

              multiWorkerCount++;
            }
          }
        }
      }

      // Patch updatedBy for cancelled complaints (no worker, just HOD)
      if (complaint.status === "cancelled") {
        const deptHod = hods.find((h) => h.department === complaint.department);
        if (deptHod) {
          const cancelledEntry = complaint.history.find(
            (h) => h.status === "cancelled",
          );
          if (cancelledEntry) cancelledEntry.updatedBy = deptHod._id;
        }
      }

      // Patch SLA escalationHistory with real HOD id
      if (complaint.sla && complaint.sla.escalationLevel > 0) {
        const deptHod = hods.find((h) => h.department === complaint.department);
        if (deptHod) {
          const slaDeadline = complaint.sla.dueDate;
          complaint.sla.escalationHistory = [];
          for (let lvl = 1; lvl <= complaint.sla.escalationLevel; lvl++) {
            const escalatedAt = new Date(slaDeadline);
            // Each escalation step happens a few hours after the previous
            escalatedAt.setHours(
              escalatedAt.getHours() +
                (lvl - 1) * 12 +
                Math.floor(Math.random() * 6),
            );
            complaint.sla.escalationHistory.push({
              level: lvl,
              escalatedAt: escalatedAt > new Date() ? new Date() : escalatedAt,
              escalatedTo: deptHod._id,
            });
          }
        }
      }

      // Add completion photos for pending-approval and resolved complaints
      if (["pending-approval", "resolved"].includes(complaint.status)) {
        const photoCount = Math.floor(Math.random() * 3) + 1; // 1-3 photos
        complaint.completionPhotos = [];
        const samplePhotos = [
          "https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=800",
          "https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?w=800",
          "https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=800",
          "https://images.unsplash.com/photo-1486718448742-163732cd1544?w=800",
          "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=800",
        ];
        for (let j = 0; j < photoCount; j++) {
          complaint.completionPhotos.push(
            samplePhotos[Math.floor(Math.random() * samplePhotos.length)],
          );
        }
      } else if (complaint.status === "needs-rework") {
        // Rework flow clears old completion photos; worker must upload fresh photos again
        complaint.completionPhotos = [];
      }

      // Add satisfaction votes for resolved complaints (60% chance)
      if (complaint.status === "resolved" && Math.random() < 0.6) {
        complaint.satisfactionVotes = {
          thumbsUp: [],
          thumbsDown: [],
        };

        // Add random votes (more thumbs up than down for realistic data)
        const voteCount = Math.floor(Math.random() * 15) + 1; // 1-15 votes
        const availableVoters = regularUsers.filter(
          (u) => u._id.toString() !== complaint.userId.toString(),
        );

        for (let v = 0; v < Math.min(voteCount, availableVoters.length); v++) {
          const voter =
            availableVoters[Math.floor(Math.random() * availableVoters.length)];
          const isPositive = Math.random() < 0.75; // 75% positive votes

          if (isPositive) {
            complaint.satisfactionVotes.thumbsUp.push(voter._id);
          } else {
            complaint.satisfactionVotes.thumbsDown.push(voter._id);
          }

          // Remove voter from available voters to avoid duplicate votes
          availableVoters.splice(availableVoters.indexOf(voter), 1);
        }
      }

      syncComplaintTimestamps(complaint);
      if (complaint.status === "resolved") {
        complaint.actualCompletionTime =
          getDurationHours(complaint.assignedAt, complaint.resolvedAt) ||
          complaint.estimatedCompletionTime ||
          null;
      } else {
        complaint.actualCompletionTime = null;
      }

      complaints.push(complaint);

      if (i % 200 === 0) {
        console.log(`   Generated ${i}/${TOTAL_COMPLAINTS} complaints...`);
      }
    }

    console.log(
      `   Created ${multiWorkerCount} multi-worker assignments in memory`,
    );

    const createdComplaints = await Complaint.insertMany(complaints);
    console.log(
      `✅ Created ${createdComplaints.length} complaints around Indore`,
    );
    console.log(
      `   - ${createdComplaints.filter((c) => c.status === "pending").length} Pending`,
    );
    console.log(
      `   - ${createdComplaints.filter((c) => c.status === "assigned").length} Assigned`,
    );
    console.log(
      `   - ${createdComplaints.filter((c) => c.status === "in-progress").length} In Progress`,
    );
    console.log(
      `   - ${createdComplaints.filter((c) => c.status === "resolved").length} Resolved`,
    );
    console.log(
      `   - ${createdComplaints.filter((c) => c.status === "needs-rework").length} Needs Rework`,
    );
    console.log(
      `   - ${createdComplaints.filter((c) => c.status === "cancelled").length} Cancelled`,
    );
    console.log(
      `   - ${createdComplaints.filter((c) => c.assignedWorkers && c.assignedWorkers.length > 1).length} Multi-worker assignments`,
    );
    console.log(
      `   - ${createdComplaints.filter((c) => c.completionPhotos && c.completionPhotos.length > 0).length} With completion photos`,
    );
    console.log(
      `   - ${createdComplaints.filter((c) => c.satisfactionVotes && ((c.satisfactionVotes.thumbsUp || []).length > 0 || (c.satisfactionVotes.thumbsDown || []).length > 0)).length} With satisfaction votes`,
    );

    console.log("\n💬 Seeding complaint chat threads...");
    const workersById = new Map(
      workers.map((worker) => [String(worker._id), worker]),
    );
    const hodByDepartment = new Map(hods.map((hod) => [hod.department, hod]));
    const usersById = new Map(
      regularUsers.map((user) => [String(user._id), user]),
    );
    const now = new Date();
    const complaintMessageRows = [];
    createdComplaints.forEach((complaint) => {
      if (Math.random() > 0.42) return;
      const owner = usersById.get(String(complaint.userId));
      const threadMessages = buildComplaintMessageSeeds({
        complaint,
        owner,
        assignedWorkers: complaint.assignedWorkers || [],
        workersById,
        hodByDepartment,
        now,
      });
      complaintMessageRows.push(...threadMessages);
    });
    if (complaintMessageRows.length > 0) {
      await ComplaintMessage.insertMany(complaintMessageRows);
    }
    console.log(`✅ Created ${complaintMessageRows.length} complaint messages`);

    console.log("\n🗃️  Creating recycle-bin sample complaints...");
    const softDeletedComplaints = createdComplaints
      .filter(
        (complaint) =>
          complaint.status === "pending" &&
          (!Array.isArray(complaint.assignedWorkers) ||
            complaint.assignedWorkers.length === 0) &&
          complaint.createdAt < new Date(now.getTime() - 10 * ONE_DAY_MS),
      )
      .sort((left, right) => left.createdAt - right.createdAt)
      .slice(0, 18);
    for (const complaint of softDeletedComplaints) {
      const deletedAt = createStageTimestamp(
        new Date(complaint.updatedAt),
        12,
        120,
        now,
      );
      await Complaint.updateOne(
        { _id: complaint._id },
        {
          $set: { deleted: true, deletedAt },
          $push: {
            history: {
              status: complaint.status,
              updatedBy: complaint.userId,
              timestamp: deletedAt,
              note: "Soft-deleted by admin while pending and unassigned",
            },
          },
        },
      );
    }
    console.log(
      `✅ Marked ${softDeletedComplaints.length} complaints as soft-deleted for admin recovery flows`,
    );

    console.log("\n📝 Seeding complaint special requests...");
    const admins = createdUsers.filter((user) => user.role === "admin");
    const primaryAdmin = admins[0];
    const usedSpecialRequestComplaintIds = new Set();
    const specialRequestRows = [];
    const complaintUpdateOps = [];

    const takeComplaint = (items, matcher) => {
      const complaint = items.find((item) => {
        if (!item || usedSpecialRequestComplaintIds.has(String(item._id))) {
          return false;
        }
        return matcher(item);
      });
      if (!complaint) return null;
      usedSpecialRequestComplaintIds.add(String(complaint._id));
      return complaint;
    };

    const eligibleUpdateComplaints = createdComplaints.filter(
      (complaint) => !complaint.deleted && complaint.status !== "cancelled",
    );
    const eligibleDeleteComplaints = createdComplaints.filter(
      (complaint) =>
        !complaint.deleted &&
        complaint.status === "pending" &&
        (!Array.isArray(complaint.assignedWorkers) ||
          complaint.assignedWorkers.length === 0),
    );

    const addComplaintHistoryUpdate = (complaint, historyEntries, updates = {}) => {
      complaint.history = [...(complaint.history || []), ...historyEntries];
      Object.assign(complaint, updates);
      complaint.updatedAt =
        historyEntries[historyEntries.length - 1]?.timestamp || complaint.updatedAt;
      complaintUpdateOps.push({
        updateOne: {
          filter: { _id: complaint._id },
          update: {
            $set: {
              ...updates,
              updatedAt: complaint.updatedAt,
            },
            $push: {
              history: {
                $each: historyEntries,
              },
            },
          },
        },
      });
    };

    const createUpdateRequestSeed = ({
      complaint,
      hod,
      status = "pending",
      reviewNote = null,
    }) => {
      if (!complaint || !hod) return;
      const requestCreatedAt = createStageTimestamp(
        new Date(complaint.updatedAt),
        4,
        72,
        now,
      );
      const requestedDepartment =
        Math.random() < 0.6
          ? getAlternativeDepartment(complaint.department)
          : complaint.department;
      const requestedPriority =
        requestedDepartment === complaint.department
          ? getAlternativePriority(complaint.priority)
          : Math.random() < 0.5
            ? getAlternativePriority(complaint.priority)
            : complaint.priority;
      const reason = pickRandom([
        "Citizen follow-up and field review suggest this should be handled by a different team.",
        "Priority needs correction after on-site inspection from the department office.",
        "Escalation review indicates the complaint was triaged under the wrong department.",
      ]);

      const row = {
        complaintId: complaint._id,
        ticketId: complaint.ticketId,
        department: complaint.department,
        requestType: "update",
        currentDepartment: complaint.department,
        requestedDepartment,
        currentPriority: complaint.priority,
        requestedPriority,
        reason,
        requestedBy: hod._id,
        status,
        createdAt: requestCreatedAt,
        updatedAt: requestCreatedAt,
      };

      const createNoteParts = [];
      if (requestedDepartment !== complaint.department) {
        createNoteParts.push(
          `change department from ${complaint.department} to ${requestedDepartment}`,
        );
      }
      if (requestedPriority !== complaint.priority) {
        createNoteParts.push(
          `change priority from ${complaint.priority} to ${requestedPriority}`,
        );
      }
      const createNote = `Special request submitted by HOD - ${createNoteParts.join(" and ")} - ${reason}`;

      const historyEntries = [
        {
          status: complaint.status,
          updatedBy: hod._id,
          timestamp: requestCreatedAt,
          note: createNote,
        },
      ];

      if (status === "approved" && primaryAdmin) {
        const reviewedAt = createStageTimestamp(requestCreatedAt, 2, 36, now);
        row.reviewedBy = primaryAdmin._id;
        row.reviewedAt = reviewedAt;
        row.reviewNote =
          reviewNote ||
          "Approved after verifying routing and urgency with admin desk.";
        row.updatedAt = reviewedAt;

        historyEntries.push({
          status: complaint.status,
          updatedBy: primaryAdmin._id,
          timestamp: reviewedAt,
          note: `Special request approved by admin - ${createNoteParts.join(" and ")} - ${row.reviewNote}`,
        });

        const nextFields = {};
        if (requestedDepartment !== complaint.department) {
          nextFields.department = requestedDepartment;
          if (complaint.aiAnalysis && typeof complaint.aiAnalysis === "object") {
            nextFields.aiAnalysis = {
              ...complaint.aiAnalysis,
              department: requestedDepartment,
            };
          }
        }
        if (requestedPriority !== complaint.priority) {
          nextFields.priority = requestedPriority;
        }
        addComplaintHistoryUpdate(complaint, historyEntries, nextFields);
      } else if (status === "rejected" && primaryAdmin) {
        const reviewedAt = createStageTimestamp(requestCreatedAt, 2, 36, now);
        row.reviewedBy = primaryAdmin._id;
        row.reviewedAt = reviewedAt;
        row.reviewNote =
          reviewNote ||
          "Rejected because current routing and priority are already correct.";
        row.updatedAt = reviewedAt;

        historyEntries.push({
          status: complaint.status,
          updatedBy: primaryAdmin._id,
          timestamp: reviewedAt,
          note: `Special request rejected by admin - ${row.reviewNote}`,
        });
        addComplaintHistoryUpdate(complaint, historyEntries);
      } else {
        addComplaintHistoryUpdate(complaint, historyEntries);
      }

      specialRequestRows.push(row);
    };

    const createDeleteRequestSeed = ({
      complaint,
      hod,
      status = "pending",
      reviewNote = null,
    }) => {
      if (!complaint || !hod) return;
      const requestCreatedAt = createStageTimestamp(
        new Date(complaint.updatedAt),
        4,
        72,
        now,
      );
      const reason = pickRandom([
        "Citizen reported duplicate complaint and requested removal.",
        "Complaint was created against the wrong location and should be removed.",
        "Field team confirmed this pending complaint is a duplicate of another active ticket.",
      ]);

      const row = {
        complaintId: complaint._id,
        ticketId: complaint.ticketId,
        department: complaint.department,
        requestType: "delete",
        currentDepartment: complaint.department,
        requestedDepartment: null,
        currentPriority: complaint.priority,
        requestedPriority: null,
        reason,
        requestedBy: hod._id,
        status,
        createdAt: requestCreatedAt,
        updatedAt: requestCreatedAt,
      };

      const historyEntries = [
        {
          status: complaint.status,
          updatedBy: hod._id,
          timestamp: requestCreatedAt,
          note: `Special delete request submitted by HOD - ${reason}`,
        },
      ];

      if (status === "approved" && primaryAdmin) {
        const reviewedAt = createStageTimestamp(requestCreatedAt, 2, 36, now);
        row.reviewedBy = primaryAdmin._id;
        row.reviewedAt = reviewedAt;
        row.reviewNote =
          reviewNote ||
          "Approved because the complaint is still pending and unassigned.";
        row.updatedAt = reviewedAt;

        historyEntries.push({
          status: complaint.status,
          updatedBy: primaryAdmin._id,
          timestamp: reviewedAt,
          note: `Special delete request approved by admin - ${row.reviewNote}`,
        });
        addComplaintHistoryUpdate(complaint, historyEntries, {
          deleted: true,
          deletedAt: reviewedAt,
        });
      } else if (status === "rejected" && primaryAdmin) {
        const reviewedAt = createStageTimestamp(requestCreatedAt, 2, 36, now);
        row.reviewedBy = primaryAdmin._id;
        row.reviewedAt = reviewedAt;
        row.reviewNote =
          reviewNote ||
          "Rejected because this complaint still needs to remain in the queue.";
        row.updatedAt = reviewedAt;

        historyEntries.push({
          status: complaint.status,
          updatedBy: primaryAdmin._id,
          timestamp: reviewedAt,
          note: `Special request rejected by admin - ${row.reviewNote}`,
        });
        addComplaintHistoryUpdate(complaint, historyEntries);
      } else {
        addComplaintHistoryUpdate(complaint, historyEntries);
      }

      specialRequestRows.push(row);
    };

    const roadOrWaterHod = hods.find(
      (hod) => hod.department === "Road" || hod.department === "Water",
    );

    for (let index = 0; index < 8; index += 1) {
      const complaint = takeComplaint(
        eligibleUpdateComplaints,
        (item) => item.status !== "resolved",
      );
      if (!complaint) break;
      const hod = hods.find((user) => user.department === complaint.department);
      createUpdateRequestSeed({ complaint, hod, status: "pending" });
    }

    for (let index = 0; index < 4; index += 1) {
      const complaint = takeComplaint(
        eligibleDeleteComplaints,
        (item) => !item.deleted,
      );
      if (!complaint) break;
      const hod = hods.find((user) => user.department === complaint.department);
      createDeleteRequestSeed({ complaint, hod, status: "pending" });
    }

    for (let index = 0; index < 5; index += 1) {
      const complaint = takeComplaint(
        eligibleUpdateComplaints,
        (item) => item.status !== "cancelled",
      );
      if (!complaint) break;
      const hod = hods.find((user) => user.department === complaint.department);
      createUpdateRequestSeed({ complaint, hod, status: "approved" });
    }

    for (let index = 0; index < 3; index += 1) {
      const complaint = takeComplaint(
        eligibleUpdateComplaints,
        (item) => item.status !== "resolved",
      );
      if (!complaint) break;
      const hod =
        hods.find((user) => user.department === complaint.department) ||
        roadOrWaterHod;
      createUpdateRequestSeed({ complaint, hod, status: "rejected" });
    }

    for (let index = 0; index < 2; index += 1) {
      const complaint = takeComplaint(
        eligibleDeleteComplaints,
        (item) => !item.deleted,
      );
      if (!complaint) break;
      const hod = hods.find((user) => user.department === complaint.department);
      createDeleteRequestSeed({ complaint, hod, status: "approved" });
    }

    if (complaintUpdateOps.length > 0) {
      await Complaint.bulkWrite(complaintUpdateOps);
    }
    if (specialRequestRows.length > 0) {
      await ComplaintSpecialRequest.insertMany(specialRequestRows);
    }
    console.log(
      `✅ Created ${specialRequestRows.length} special requests (${specialRequestRows.filter((item) => item.status === "pending").length} pending, ${specialRequestRows.filter((item) => item.status === "approved").length} approved, ${specialRequestRows.filter((item) => item.status === "rejected").length} rejected)`,
    );

    // ── Seed Worker Invitations ────────────────────────────────────────
    console.log("\n📧 Seeding worker invitations...");

    const invitationTemplates = [
      // pending
      { status: "pending", emailPrefix: "priya.sharma" },
      { status: "pending", emailPrefix: "rahul.verma" },
      { status: "pending", emailPrefix: "amit.joshi" },
      { status: "pending", emailPrefix: "neha.gupta" },
      { status: "pending", emailPrefix: "suresh.patel" },
      // accepted
      { status: "accepted", emailPrefix: "kavita.singh" },
      { status: "accepted", emailPrefix: "manish.tiwari" },
      { status: "accepted", emailPrefix: "pooja.mishra" },
      // expired
      { status: "expired", emailPrefix: "dinesh.yadav" },
      { status: "expired", emailPrefix: "sunita.pandey" },
      // revoked
      { status: "revoked", emailPrefix: "vikas.rawat" },
      { status: "revoked", emailPrefix: "anita.chauhan" },
    ];

    const invitations = [];
    for (const hod of hods) {
      const hodIdx = hods.indexOf(hod);
      const slice = invitationTemplates.filter(
        (_, i) => i % hods.length === hodIdx,
      );
      for (const tpl of slice) {
        const timeline = getInvitationSeedTimeline(tpl.status, now);

        const inv = {
          email: `${tpl.emailPrefix}.${hod.department.toLowerCase()}@gmail.com`,
          department: hod.department,
          invitedBy: hod._id,
          tokenHash: crypto
            .createHash("sha256")
            .update(`${hod._id}-${tpl.emailPrefix}-${hodIdx}-${Math.random()}`)
            .digest("hex"),
          expiresAt: timeline.expiresAt,
          createdAt: timeline.sentAt,
          updatedAt: timeline.updatedAt,
          acceptedAt: timeline.acceptedAt,
          revokedAt: timeline.revokedAt,
        };

        invitations.push(inv);
      }
    }

    await WorkerInvitation.insertMany(invitations);
    const pendingCount = invitations.filter(
      (i) => !i.acceptedAt && !i.revokedAt && i.expiresAt > now,
    ).length;
    const acceptedCount = invitations.filter((i) => i.acceptedAt).length;
    const revokedCount = invitations.filter((i) => i.revokedAt).length;
    const expiredCount = invitations.filter(
      (i) => !i.acceptedAt && !i.revokedAt && i.expiresAt <= now,
    ).length;
    console.log(
      `✅ Created ${invitations.length} worker invitations (${pendingCount} pending, ${acceptedCount} accepted, ${revokedCount} revoked, ${expiredCount} expired)`,
    );

    // ── Seed Festival Events ───────────────────────────────────────────
    console.log("\n🎊 Seeding festival events...");
    const currentYear = new Date().getFullYear();
    const festivalEvents = [
      {
        name: "Holi Celebration",
        startDate: `${currentYear}-03-12`,
        endDate: `${currentYear}-03-16`,
        highPriorityLocations: ["Rajwada", "Sarafa Bazaar", "Bhawarkua"],
        priority: "High",
        isActive: true,
      },
      {
        name: "Rang Panchami Procession",
        startDate: `${currentYear}-03-19`,
        endDate: `${currentYear}-03-20`,
        highPriorityLocations: ["Rajwada", "Chhoti Gwaltoli"],
        priority: "Critical",
        isActive: true,
      },
      {
        name: "Navratri Garba",
        startDate: `${currentYear}-10-01`,
        endDate: `${currentYear}-10-10`,
        highPriorityLocations: ["Vijay Nagar", "Scheme No. 54", "Tilak Nagar"],
        priority: "High",
        isActive: true,
      },
      {
        name: "Diwali Festival Week",
        startDate: `${currentYear}-10-28`,
        endDate: `${currentYear}-11-03`,
        highPriorityLocations: ["Rajwada", "Sarafa Bazaar", "Treasure Island"],
        priority: "Critical",
        isActive: true,
      },
      {
        name: "Ganesh Visarjan",
        startDate: `${currentYear}-09-08`,
        endDate: `${currentYear}-09-12`,
        highPriorityLocations: ["Annapurna Road", "Palasia", "Bengali Square"],
        priority: "High",
        isActive: true,
      },
      {
        name: "City Marathon",
        startDate: `${currentYear}-12-07`,
        endDate: `${currentYear}-12-08`,
        highPriorityLocations: ["Race Course Road", "AB Road", "Vijay Nagar"],
        priority: "Medium",
        isActive: true,
      },
      {
        name: "Monsoon Preparedness Drive",
        startDate: `${currentYear}-06-01`,
        endDate: `${currentYear}-06-30`,
        highPriorityLocations: ["South Tukoganj", "LIG Colony", "Khandwa Road"],
        priority: "High",
        isActive: true,
      },
      {
        name: "Republic Day Parade",
        startDate: `${currentYear}-01-24`,
        endDate: `${currentYear}-01-27`,
        highPriorityLocations: ["Rajwada", "Geeta Bhawan"],
        priority: "Medium",
        isActive: false,
      },
    ];
    await FestivalEvent.insertMany(festivalEvents);
    console.log(`✅ Created ${festivalEvents.length} festival events`);

    // ── Seed Report Schedules ──────────────────────────────────────────
    console.log("\n📈 Seeding report schedules...");
    const scheduleRows = [];
    for (const hod of hods) {
      const frequency =
        Math.random() < 0.5
          ? "weekly"
          : Math.random() < 0.8
            ? "daily"
            : "monthly";
      const format =
        Math.random() < 0.4 ? "pdf" : Math.random() < 0.75 ? "excel" : "csv";
      const hour = 8 + Math.floor(Math.random() * 3);
      const createdAt = getDateWithinLastDays(4, 40, now);
      const lastAttemptAt =
        Math.random() < 0.9 ? getRandomDateBetween(createdAt, now) : null;
      const hasRecentFailure = lastAttemptAt && Math.random() < 0.2;
      const lastFailureAt = hasRecentFailure
        ? getRandomDateBetween(lastAttemptAt, now)
        : null;
      const lastSentAt =
        hasRecentFailure || !lastAttemptAt
          ? getRandomDateBetween(createdAt, now)
          : getRandomDateBetween(lastAttemptAt, now);
      scheduleRows.push({
        userId: hod._id,
        email: hod.email,
        frequency,
        format,
        cronExpression: getCronExpressionForFrequency(frequency, hour),
        department: hod.department,
        filters: { department: hod.department },
        timezone: process.env.REPORT_SCHEDULE_TIMEZONE || "Asia/Kolkata",
        hour,
        isActive: Math.random() < 0.88,
        lastSentAt,
        lastAttemptAt,
        lastFailureAt,
        lastError: hasRecentFailure
          ? pickRandom([
              "PDF generation timed out for large report",
              "SMTP delivery was rejected by remote server",
              "Temporary filesystem write failure during report export",
            ])
          : null,
        lastErrorStage: hasRecentFailure
          ? pickRandom(["generation", "delivery"])
          : null,
        createdAt,
        updatedAt: now,
      });
    }
    await ReportSchedule.insertMany(scheduleRows);
    console.log(`✅ Created ${scheduleRows.length} report schedules`);

    // ── Seed Notification History ──────────────────────────────────────
    console.log("\n🔔 Seeding notifications...");
    const notificationRows = [];

    for (const complaint of createdComplaints) {
      const owner = regularUsers.find(
        (user) => String(user._id) === String(complaint.userId),
      );

      if (owner && Math.random() < 0.8) {
        notificationRows.push({
          userId: owner._id,
          title: `Update on ${complaint.ticketId}`,
          body:
            complaint.status === "resolved"
              ? "Your complaint has been resolved. Please add feedback."
              : `Complaint is currently ${complaint.status}.`,
          type: "complaint-update",
          data: {
            complaintId: String(complaint._id),
            ticketId: complaint.ticketId,
            status: complaint.status,
            type: "complaint-update",
            route: createRouteData("complaint-detail", {
              complaintId: complaint._id,
              ticketId: complaint.ticketId,
            }),
          },
          readAt:
            Math.random() < 0.55 ? getDateWithinLastDays(0, 14, now) : null,
          createdAt: getDateWithinLastDays(0, 20, now),
          updatedAt: now,
        });
      }

      (complaint.assignedWorkers || []).forEach((assignment) => {
        if (Math.random() < 0.75) {
          notificationRows.push({
            userId: assignment.workerId,
            title: `Assignment: ${complaint.ticketId}`,
            body: `You were assigned a ${complaint.department} complaint in ${complaint.locationName || "Indore"}.`,
            type: "assignment",
            data: {
              complaintId: String(complaint._id),
              ticketId: complaint.ticketId,
              department: complaint.department,
              type: "assignment",
              route: createRouteData("complaint-detail", {
                complaintId: complaint._id,
                ticketId: complaint.ticketId,
              }),
            },
            readAt:
              Math.random() < 0.7 ? getDateWithinLastDays(0, 10, now) : null,
            createdAt: getDateWithinLastDays(0, 25, now),
            updatedAt: now,
          });
        }
      });

      if (complaint.sla?.escalated) {
        const deptHod = hods.find((h) => h.department === complaint.department);
        if (deptHod && Math.random() < 0.9) {
          notificationRows.push({
            userId: deptHod._id,
            title: `SLA escalation: ${complaint.ticketId}`,
            body: "Complaint crossed SLA threshold and needs urgent action.",
            type: "escalation",
            data: {
              complaintId: String(complaint._id),
              ticketId: complaint.ticketId,
              escalationLevel: complaint.sla.escalationLevel,
              type: "escalation",
              route: createRouteData("complaint-detail", {
                complaintId: complaint._id,
                ticketId: complaint.ticketId,
              }),
            },
            readAt:
              Math.random() < 0.45 ? getDateWithinLastDays(0, 10, now) : null,
            createdAt: getDateWithinLastDays(0, 15, now),
            updatedAt: now,
          });
        }
      }

      if (Math.random() < 0.15) {
        const deptHod = hods.find((h) => h.department === complaint.department);
        if (deptHod) {
          notificationRows.push({
            userId: deptHod._id,
            title: `AI review suggestion for ${complaint.ticketId}`,
            body: "A complaint in your department has a strong AI department or priority suggestion.",
            type: "system",
            data: {
              complaintId: String(complaint._id),
              ticketId: complaint.ticketId,
              type: "system",
              route: createRouteData("ai-review", {
                complaintId: complaint._id,
                ticketId: complaint.ticketId,
              }),
            },
            readAt:
              Math.random() < 0.4 ? getDateWithinLastDays(0, 10, now) : null,
            createdAt: getDateWithinLastDays(0, 12, now),
            updatedAt: now,
          });
        }
      }
    }

    createdUsers
      .filter((user) => user.role === "admin" || user.role === "head")
      .forEach((user) => {
        if (Math.random() < 0.75) {
          notificationRows.push({
            userId: user._id,
            title: "Daily system digest available",
            body: "Review pending approvals, escalations, schedules, and unresolved backlog from the operations dashboard.",
            type: "system",
            data: {
              type: "system",
            },
            readAt:
              Math.random() < 0.35 ? getDateWithinLastDays(0, 6, now) : null,
            createdAt: getDateWithinLastDays(0, 6, now),
            updatedAt: now,
          });
        }
      });

    if (notificationRows.length > 0) {
      await Notification.insertMany(notificationRows);
    }
    console.log(`✅ Created ${notificationRows.length} notifications`);

    console.log("\n🎉 Database seeded successfully!");
    console.log("\n📝 Sample Login Credentials:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Admin:    username: admin1         password: password123");
    console.log("HOD:      username: hod_road       password: password123");
    console.log("Worker:   username: worker_road_1  password: password123");
    console.log("Citizen:  username: user1          password: password123");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  } catch (error) {
    console.error("❌ Error seeding database:", error);
  } finally {
    await mongoose.connection.close();
    console.log("\n👋 Database disconnected");
  }
}

// Run seed
seedDatabase();
