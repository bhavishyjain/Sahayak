const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
require("dotenv").config();
const User = require("./models/User");
const Complaint = require("./models/Complaint");

// Indore areas with accurate coordinates
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

// Generate random complaint
function generateComplaint(userId, ticketNum, allUsers) {
  const departments = [
    "Road",
    "Water",
    "Electricity",
    "Waste",
    "Drainage",
    "Other",
  ];
  const department =
    departments[Math.floor(Math.random() * departments.length)];
  const templates = complaintTemplates[department];
  const template = templates[Math.floor(Math.random() * templates.length)];
  const description =
    template.descriptions[
      Math.floor(Math.random() * template.descriptions.length)
    ];

  const locationData = getRandomLocation();

  const priorities = ["Low", "Medium", "High"];
  const priority = priorities[Math.floor(Math.random() * priorities.length)];

  const statuses = ["pending", "assigned", "in-progress", "resolved", "closed"];
  const status = statuses[Math.floor(Math.random() * statuses.length)];

  // Generate past date (within last 60 days)
  const daysAgo = Math.floor(Math.random() * 60);
  const createdAt = new Date();
  createdAt.setDate(createdAt.getDate() - daysAgo);

  // Generate upvotes (more for urgent issues and older complaints)
  const upvoteCount =
    Math.floor(Math.random() * 50) + (priority === "High" ? 20 : 0);
  const upvotesArray = [];
  if (allUsers && allUsers.length > 0) {
    const numUpvotes = Math.min(upvoteCount, allUsers.length);
    const shuffledUsers = [...allUsers].sort(() => Math.random() - 0.5);
    for (let i = 0; i < numUpvotes; i++) {
      upvotesArray.push(shuffledUsers[i]._id);
    }
  }

  const complaint = {
    ticketId: `INDORE${String(ticketNum).padStart(4, "0")}`,
    userId: userId,
    rawText: `${template.title}: ${description}`,
    refinedText: description,
    description: description,
    department: department,
    aiSuggestedDepartment: department,
    aiConfidence: 0.85 + Math.random() * 0.15,
    coordinates: { lat: locationData.lat, lng: locationData.lng },
    locationName: `${locationData.name}, Indore`,
    priority: priority,
    status: status,
    upvotes: upvotesArray,
    upvoteCount: upvotesArray.length,
    createdAt: createdAt,
    updatedAt: new Date(),
  };

  // Add history based on status
  complaint.history = [
    {
      status: "pending",
      timestamp: createdAt,
      note: "Complaint registered",
    },
  ];

  if (["assigned", "in-progress", "resolved", "closed"].includes(status)) {
    const assignedDate = new Date(createdAt);
    assignedDate.setHours(
      assignedDate.getHours() + Math.floor(Math.random() * 24),
    );
    complaint.history.push({
      status: "assigned",
      timestamp: assignedDate,
      note: "Assigned to worker",
    });
  }

  if (["in-progress", "resolved", "closed"].includes(status)) {
    const inProgressDate = new Date(
      complaint.history[complaint.history.length - 1].timestamp,
    );
    inProgressDate.setHours(
      inProgressDate.getHours() + Math.floor(Math.random() * 12),
    );
    complaint.history.push({
      status: "in-progress",
      timestamp: inProgressDate,
      note: "Work started",
    });
  }

  if (["resolved", "closed"].includes(status)) {
    const resolvedDate = new Date(
      complaint.history[complaint.history.length - 1].timestamp,
    );
    resolvedDate.setHours(
      resolvedDate.getHours() + Math.floor(Math.random() * 48),
    );
    complaint.history.push({
      status: "resolved",
      timestamp: resolvedDate,
      note: "Issue resolved",
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
        ratedAt: new Date(
          resolvedDate.getTime() + 3600000 * (Math.random() * 24 + 1),
        ), // 1-25 hours after resolution
      };
    }
  }

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
    console.log("✅ Existing data cleared");

    // Create users
    console.log("\n👥 Creating users...");
    const hashedPassword = await bcrypt.hash("password123", 10);
    const users = [];

    // Admin users (2)
    for (let i = 1; i <= 2; i++) {
      users.push({
        username: `admin${i}`,
        password: hashedPassword,
        role: "admin",
        department: "Other",
        email: `admin${i}@indore.gov.in`,
        phone: `91${9000000000 + i}`,
        fullName: `Admin ${i}`,
      });
    }

    // HOD/Head users (5 - one per department)
    const departments = ["Road", "Water", "Electricity", "Waste", "Drainage"];
    departments.forEach((dept, idx) => {
      users.push({
        username: `hod_${dept}`,
        password: hashedPassword,
        role: "head",
        department: dept,
        email: `hod.${dept}@indore.gov.in`,
        phone: `91${9100000000 + idx}`,
        fullName: `HOD ${dept.charAt(0).toUpperCase() + dept.slice(1)}`,
      });
    });

    // Worker users (15 - 3 per department)
    for (let dept of departments) {
      for (let i = 1; i <= 3; i++) {
        users.push({
          username: `worker_${dept}_${i}`,
          password: hashedPassword,
          role: "worker",
          department: dept,
          email: `worker.${dept}.${i}@indore.gov.in`,
          phone: `91${9200000000 + users.length}`,
          fullName: `Worker ${dept.charAt(0).toUpperCase() + dept.slice(1)} ${i}`,
          workStatus: ["available", "busy"][Math.floor(Math.random() * 2)],
          rating: 3.5 + Math.random() * 1.5,
          performanceMetrics: {
            totalCompleted: Math.floor(Math.random() * 50),
            averageCompletionTime: 12 + Math.random() * 24,
            currentWeekCompleted: Math.floor(Math.random() * 10),
          },
        });
      }
    }

    // Regular user accounts (30)
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
    ];

    for (let i = 1; i <= 30; i++) {
      const firstName =
        firstNames[Math.floor(Math.random() * firstNames.length)];
      const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
      users.push({
        username: `user${i}`,
        password: hashedPassword,
        role: "user",
        department: "Other",
        email: `user${i}@example.com`,
        phone: `91${8000000000 + i}`,
        fullName: `${firstName} ${lastName}`,
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

    for (let i = 1; i <= 500; i++) {
      const randomUser =
        regularUsers[Math.floor(Math.random() * regularUsers.length)];
      const complaint = generateComplaint(randomUser._id, i, regularUsers);

      // Assign worker if status is assigned or beyond
      if (
        ["assigned", "in-progress", "resolved", "closed"].includes(
          complaint.status,
        )
      ) {
        const deptWorkers = workers.filter(
          (w) => w.department === complaint.department,
        );
        if (deptWorkers.length > 0) {
          const assignedWorker =
            deptWorkers[Math.floor(Math.random() * deptWorkers.length)];
          complaint.assignedTo = assignedWorker._id;
          complaint.assignedAt = complaint.history.find(
            (h) => h.status === "assigned",
          )?.timestamp;
        }
      }

      complaints.push(complaint);

      if (i % 100 === 0) {
        console.log(`   Created ${i} complaints...`);
      }
    }

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
      `   - ${createdComplaints.filter((c) => c.status === "closed").length} Closed`,
    );

    // Update worker assigned complaints
    console.log("\n🔄 Updating worker assignments...");
    for (const worker of workers) {
      const assignedComplaints = createdComplaints.filter(
        (c) =>
          c.assignedTo && c.assignedTo.toString() === worker._id.toString(),
      );

      worker.assignedComplaints = assignedComplaints
        .filter((c) => ["assigned", "in-progress"].includes(c.status))
        .map((c) => c._id);

      worker.completedComplaints = assignedComplaints
        .filter((c) => ["resolved", "closed"].includes(c.status))
        .map((c) => c._id);

      await worker.save();
    }
    console.log("✅ Worker assignments updated");

    console.log("\n🎉 Database seeded successfully!");
    console.log("\n📝 Sample Login Credentials:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Admin:    username: admin1         password: password123");
    console.log("HOD:      username: hod_Road       password: password123");
    console.log("Worker:   username: worker_Road_1  password: password123");
    console.log("Citizen:  username: user1          password: password123");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  } catch (error) {
    console.error("❌ Error seeding database:", error);
  } finally {
    await mongoose.connection.close();
    console.log("\n👋 Database connection closed");
  }
}

// Run seed
seedDatabase();
