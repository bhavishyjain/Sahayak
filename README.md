# 🏛️ Sahayak - Municipal Complaint Management System

A comprehensive mobile and web-based complaint management system for municipal corporations, enabling citizens to report civic issues, track their resolution, and engage with local authorities efficiently.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D%2018.0.0-brightgreen)
![React Native](https://img.shields.io/badge/React%20Native-0.73-blue)
![Expo](https://img.shields.io/badge/Expo-~50.0-purple)

## 📋 Table of Contents

- [Latest Features](#-latest-features)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Architecture](#-architecture)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Usage](#-usage)
- [API Documentation](#-api-documentation)
- [Screenshots](#-screenshots)
- [Contributing](#-contributing)

## 🚀 Latest Features

### Recently Implemented (February 2026)

**🎯 Predictive ETA System**

- AI-powered completion time estimates based on:
  - Priority level baselines
  - Worker historical performance
  - Similar complaint completion times
  - Current workload analysis
- Prominent ETA display across all complaint cards
- Real-time overdue alerts with color coding

**📸 Before/After Photo Verification**

- Workers must upload completion photos when marking as complete
- Photo gallery view in complaint details
- Quality assurance through visual verification
- Before/after comparison for transparency

**✅ HOD Approval Workflow**

- New "pending-approval" status after worker completion
- HODs review completion photos before final approval
- Ability to reject with notes for rework
- Dashboard tracking of pending approvals
- Performance metrics updated only on HOD approval

**⚡ Bulk Operations for HODs**

- Multi-select complaints with intuitive checkboxes
- Assign multiple complaints to a worker in one action
- Automatic ETA calculation for all assigned complaints
- Smart selection (only unassigned complaints selectable)
- Batch operation confirmation with worker workload display

**🏆 Worker Leaderboard & Gamification**

- Real-time leaderboard with weekly/monthly/yearly views
- 6 Achievement badges:
  - ⚡ Speed Demon (avg completion under 24h)
  - ⭐ Quality Master (4.5+ rating)
  - 🏆 Community Hero (50+ completions)
  - 💯 Century Club (100+ completions)
  - 🔥 Consistent Performer (7+ day streak)
  - 🌟 Rising Star (20+ monthly completions)
- Streak tracking with fire emoji indicators
- Department-wise rankings
- Personalized performance insights

**📊 Enhanced Upvote System**

- Community-driven prioritization
- Auto-escalation thresholds:
  - 100 upvotes: Low → Medium priority
  - 200 upvotes: Medium → High priority
- Real-time upvote count on all complaint cards

## ✨ Features

### Citizen Features

- 📝 **Multi-Channel Complaint Registration**
  - Submit complaints via mobile app
  - Upload up to 5 proof images
  - Auto-capture GPS coordinates for precise location
  - AI-powered department categorization using Gemini

- 👍 **Public Voting & Support**
  - Upvote complaints affecting multiple citizens
  - See how many people are affected by the same issue
  - Auto-escalation when complaints reach 10+ or 25+ upvotes

- ⭐ **Feedback & Rating System**
  - Rate resolution quality (1-5 stars)
  - Provide feedback on worker performance
  - Comment on complaint resolution

- 📍 **Interactive Heatmap**
  - Visual representation of complaint hotspots
  - Complaint clustering for better readability
  - Color-coded by severity and department
  - Real-time location tracking
  - Filter by department, priority, and status

- 🔔 **Real-time Notifications**
  - Push notifications for status updates
  - Assignment notifications
  - Resolution alerts

- 🔍 **Advanced Tracking**
  - Track complaint status in real-time
  - View complete complaint history
  - See timeline of actions taken
  - Search and filter complaints
  - **Predictive ETA**: See estimated resolution time for assigned complaints
  - Color-coded ETA badges (overdue alerts)

### HOD/Admin Features

- 📊 **Comprehensive Dashboard**
  - Overview of all complaints
  - Department-wise filtering
  - Priority-based sorting
  - Performance analytics
  - Pending approval tracking

- 👥 **Worker Management**
  - Assign complaints to workers
  - Bulk assign multiple complaints at once
  - Track worker performance and leaderboard
  - View worker ratings and feedback
  - Monitor worker streaks and badges

- ⚡ **Bulk Operations**
  - Multi-select complaints with checkboxes
  - Bulk assign to single worker
  - Automatic ETA calculation for batch assignments
  - Smart worker selection based on workload

- ✅ **Approval Workflow**
  - Review worker-submitted completions
  - Approve/reject with completion photos
  - Require quality verification before resolution
  - Add rejection notes for revisions
  - Track pending approvals in dashboard

- ⏱️ **SLA Tracking & Auto-Escalation**
  - Automatic SLA calculation based on priority
  - Auto-escalation for overdue complaints
  - Hourly cron job monitoring
  - Escalation notifications

- 📈 **Analytics & Insights**
  - Complaint trends analysis
  - Department performance metrics
  - Seasonal pattern detection
  - Hotspot identification
  - Predictive ETA for all complaints

### Worker Features

- 📋 **Assigned Tasks View**
  - See all assigned complaints
  - Update complaint status
  - Add notes and progress updates
  - Upload completion photos (before/after)

- 🗺️ **Route Optimization**
  - View complaints on map
  - Plan efficient routes

- 🏆 **Gamification & Leaderboard**
  - Real-time leaderboard rankings (weekly/monthly/yearly)
  - Achievement badge system:
    - ⚡ **Speed Demon**: Complete tasks in under 24 hours
    - ⭐ **Quality Master**: Maintain 4.5+ star rating
    - 🏆 **Community Hero**: Resolve 50+ complaints
    - 💯 **Century Club**: Resolve 100+ complaints
    - 🔥 **Consistent Performer**: Maintain 7+ day streak
    - 🌟 **Rising Star**: 20+ completions per month
  - Streak tracking for daily performance
  - Performance metrics dashboard
  - Competitive rankings by department

## 🛠️ Tech Stack

### Mobile App

- **Framework**: React Native with Expo
- **Navigation**: Expo Router (file-based routing)
- **State Management**: React Query (@tanstack/react-query)
- **UI Components**: NativeWind (Tailwind CSS for React Native)
- **Maps**: Leaflet.js via WebView
- **Location**: expo-location
- **Image Handling**: expo-image-picker
- **Notifications**: expo-notifications
- **Authentication**: JWT-based auth
- **Internationalization**: i18next

### Backend

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose
- **Authentication**: Passport.js + JWT
- **File Storage**: Cloudinary
- **AI Integration**: Google Gemini API
- **Session Management**: express-session with MongoDB store

### DevOps & Tools

- **Version Control**: Git
- **Package Manager**: npm
- **Environment Management**: dotenv
- **Image Processing**: Multer
- **CORS**: cors middleware

## 🏗️ Architecture

```
Sahayak/
├── backend/                 # Node.js/Express API
│   ├── app.js              # Express app configuration
│   ├── bin/www             # Server entry point
│   ├── config/             # Configuration files
│   │   ├── cloudinary.js   # Cloudinary setup
│   │   ├── db.js           # MongoDB connection
│   │   └── passport.js     # Passport strategies
│   ├── controllers/        # Route controllers
│   │   ├── authController.js
│   │   ├── complaintController.js
│   │   ├── dashboardController.js
│   │   ├── hodController.js
│   │   └── workerController.js
│   ├── middlewares/        # Custom middlewares
│   │   ├── authMiddleware.js
│   │   ├── jwtAuth.js
│   │   └── multer.js
│   ├── models/             # Mongoose models
│   │   ├── Complaint.js
│   │   └── User.js
│   ├── routes/             # API routes
│   ├── services/           # Business logic
│   │   ├── geminiService.js
│   │   └── pushNotificationService.js
│   └── utils/              # Utility functions
│       ├── slaEscalation.js
│       └── eventPriorityUpdater.js
│
└── mobile/                 # React Native mobile app
    ├── app/                # Expo Router pages
    │   ├── (app)/          # Authenticated routes
    │   │   ├── (tabs)/     # Tab navigator
    │   │   │   ├── home.jsx
    │   │   │   ├── complaints.jsx
    │   │   │   ├── heatmap.jsx
    │   │   │   └── profile.jsx
    │   │   ├── complaints/
    │   │   │   └── complaint-details.jsx
    │   │   └── settings/
    │   └── (auth)/         # Authentication routes
    ├── assets/             # Images, fonts, animations
    ├── components/         # Reusable components
    ├── utils/              # Utility functions
    │   ├── api.js          # API client
    │   ├── context/        # React contexts
    │   └── i18n/           # Translations
    └── url.js              # API endpoints
```

## 📦 Installation

### Prerequisites

- Node.js >= 18.0.0
- npm or yarn
- MongoDB
- Expo CLI (for mobile development)
- Android Studio / Xcode (for mobile testing)

### Backend Setup

1. **Clone the repository**

```bash
git clone https://github.com/yourusername/Sahayak.git
cd Sahayak/backend
```

2. **Install dependencies**

```bash
npm install
```

3. **Create `.env` file**

```env
# Server
PORT=6000
NODE_ENV=development

# Database
MONGO_URI=mongodb://localhost:27017/sahayak

# JWT
JWT_SECRET=your_jwt_secret_key

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Google Gemini
GEMINI_API_KEY=your_gemini_api_key

# Session
SESSION_SECRET=your_session_secret

# CORS
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:8081
```

4. **Start the server**

```bash
npm start
```

The backend will run on `http://localhost:6000`

### Mobile App Setup

1. **Navigate to mobile directory**

```bash
cd ../mobile
```

2. **Install dependencies**

```bash
npm install
```

3. **Create `.env` file**

```env
EXPO_PUBLIC_API_URL=https://sahayak-zqp7.onrender.com/api
```

4. **Start Expo development server**

```bash
npx expo start
```

5. **Run on device/emulator**

- Press `a` for Android emulator
- Press `i` for iOS simulator
- Scan QR code with Expo Go app for physical device

## ⚙️ Configuration

### MongoDB Setup

```bash
# Start MongoDB
mongod --dbpath /path/to/your/data/db

# Or use MongoDB Atlas (cloud)
# Update MONGO_URI in .env with your Atlas connection string
```

### Cloudinary Setup

1. Sign up at [Cloudinary](https://cloudinary.com)
2. Get your credentials from dashboard
3. Update `.env` with your credentials

### Google Gemini API

1. Get API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Add to backend `.env`

### Push Notifications (Optional)

1. Configure Expo push notifications
2. Add notification tokens to user profiles

## 🚀 Usage

### For Citizens

1. **Register/Login**
   - Create account with phone number
   - Verify OTP
   - Login to access features

2. **Submit Complaint**
   - Tap "New Complaint" button
   - Fill in title and description
   - Select department and priority
   - Capture GPS location
   - Upload up to 5 proof images
   - Submit complaint

3. **Track Complaints**
   - View all your complaints
   - Check status updates
   - See complaint history
   - Rate completed work

4. **Support Issues**
   - Upvote complaints affecting you
   - See community support count

### For HODs/Admins

1. **Dashboard Overview**
   - View all complaints
   - Filter by department/status
   - See performance metrics
   - Track pending approvals

2. **Assign Complaints**
   - Single assignment with ETA calculation
   - **Bulk assign**: Select multiple complaints at once
   - View worker workload before assignment
   - Automatic ETA calculation for all assignments

3. **Approve Completions**
   - Review completion photos
   - Approve or reject worker submissions
   - Add approval notes or rejection reasons
   - Track pending approvals in dashboard

4. **Monitor Progress**
   - Track worker performance
   - View SLA compliance
   - Check escalated complaints
   - Access worker leaderboard
   - Monitor badges and streaks

### For Workers

1. **View Assigned Tasks**
   - See all assigned complaints
   - View on map for route planning
   - Check ETA for each complaint

2. **Update Status**
   - Mark as in-progress
   - Add progress notes
   - Upload completion photos (required)

3. **Complete Work**
   - Upload before/after photos (mandatory)
   - Submit for HOD approval
   - Add completion notes

4. **Track Performance**
   - View your rank in leaderboard
   - Monitor your streak
   - Earn achievement badges
   - Compare metrics with peers
   - Filter by weekly/monthly/yearly

## 📡 API Documentation

### Authentication

#### Register User

```http
POST /api/auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "phone": "1234567890",
  "email": "john@example.com",
  "password": "securePassword123"
}
```

#### Login

```http
POST /api/auth/login
Content-Type: application/json

{
  "phone": "1234567890",
  "password": "securePassword123"
}
```

### Complaints

#### Create Complaint

```http
POST /api/complaints
Authorization: Bearer {token}
Content-Type: multipart/form-data

{
  "title": "Broken streetlight",
  "description": "Streetlight not working since 3 days",
  "department": "electricity",
  "locationName": "MG Road, Indore",
  "priority": "Medium",
  "coordinates": "{\"lat\": 22.7196, \"lng\": 75.8577}",
  "images": [File, File, ...]  // Max 5 images
}
```

#### Get My Complaints

```http
GET /api/complaints?status=pending
Authorization: Bearer {token}
```

#### Get Complaint Details

```http
GET /api/complaints/:complaintId
Authorization: Bearer {token}
```

#### Upvote Complaint

```http
POST /api/complaints/:complaintId/upvote
Authorization: Bearer {token}
```

#### Submit Feedback

```http
POST /api/complaints/:complaintId/feedback
Authorization: Bearer {token}
Content-Type: application/json

{
  "rating": 5,
  "comment": "Excellent work, resolved quickly"
}
```

### Dashboard

#### Get Dashboard Summary

```http
GET /api/dashboard/summary
Authorization: Bearer {token}
```

#### Get Heatmap Data

```http
GET /api/dashboard/heatmap
Authorization: Bearer {token}
```

### HOD Operations

#### Assign Complaint

```http
POST /api/hod/assign
Authorization: Bearer {token}
Content-Type: application/json

{
  "complaintId": "64f8a...",
  "workerId": "64f8b...",
  "estimatedTime": 48
}
```

#### Bulk Assign Complaints

```http
POST /api/hod/bulk-assign
Authorization: Bearer {token}
Content-Type: application/json

{
  "complaintIds": ["64f8a...", "64f8b...", "64f8c..."],
  "workerId": "64f8d..."
}
```

**Response**: Returns assigned complaints with calculated ETAs for each

#### Approve Completion

```http
POST /api/hod/approve-completion/:complaintId
Authorization: Bearer {token}
Content-Type: application/json

{
  "notes": "Excellent quality work"
}
```

#### Reject Completion

```http
POST /api/hod/reject-completion/:complaintId
Authorization: Bearer {token}
Content-Type: application/json

{
  "reason": "Photos unclear, please resubmit with better lighting"
}
```

### Worker Operations

#### Get Worker Dashboard

```http
GET /api/workers/dashboard
Authorization: Bearer {token}
```

**Response**: Returns active complaints count, pending approvals, and performance stats

#### Update Complaint Status

```http
PUT /api/workers/complaint/:complaintId/status
Authorization: Bearer {token}
Content-Type: multipart/form-data

{
  "status": "pending-approval",
  "notes": "Work completed, please review",
  "completionPhotos": [File, File, ...]  // Required for pending-approval
}
```

#### Get Leaderboard

```http
GET /api/workers/leaderboard?period=monthly&department=Road
Authorization: Bearer {token}
```

**Query Parameters**:

- `period`: `weekly`, `monthly`, or `yearly` (default: `monthly`)
- `department`: Filter by department (optional)

**Response**: Returns leaderboard with rankings, badges, streaks, and performance metrics

## 📸 Screenshots

> Add screenshots of your application here

```
[Home Screen]  [Heatmap]  [Complaint Details]
[Create Complaint]  [Upvote Feature]  [Feedback Modal]
```

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Coding Standards

- Follow ESLint configuration
- Write meaningful commit messages
- Add comments for complex logic
- Update documentation for new features

## 👥 Team

- **Developer**: [Your Name]
- **Contributors**: [List contributors]

## 🙏 Acknowledgments

- Google Gemini for AI-powered categorization
- Cloudinary for image storage
- Leaflet.js for mapping functionality
- Expo team for amazing mobile development tools

## 📞 Support

For support, email support@sahayak.com or create an issue in this repository.

---

**Made with ❤️ for better civic engagement**
