# 🏛️ Sahayak - Municipal Complaint Management System

A comprehensive mobile and web-based complaint management system for municipal corporations, enabling citizens to report civic issues, track their resolution, and engage with local authorities efficiently.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D%2018.0.0-brightgreen)
![React Native](https://img.shields.io/badge/React%20Native-0.73-blue)
![Expo](https://img.shields.io/badge/Expo-~50.0-purple)

## 📋 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Architecture](#-architecture)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Usage](#-usage)
- [API Documentation](#-api-documentation)
- [Screenshots](#-screenshots)
- [Contributing](#-contributing)

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

### HOD/Admin Features
- 📊 **Comprehensive Dashboard**
  - Overview of all complaints
  - Department-wise filtering
  - Priority-based sorting
  - Performance analytics

- 👥 **Worker Management**
  - Assign complaints to workers
  - Track worker performance
  - View worker ratings and feedback

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

### Worker Features
- 📋 **Assigned Tasks View**
  - See all assigned complaints
  - Update complaint status
  - Add notes and progress updates
  - Upload completion photos

- 🗺️ **Route Optimization**
  - View complaints on map
  - Plan efficient routes

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
EXPO_PUBLIC_API_URL=http://your-backend-ip:6000/api
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

2. **Assign Complaints**
   - Select complaint
   - Assign to available worker
   - Set estimated completion time

3. **Monitor Progress**
   - Track worker performance
   - View SLA compliance
   - Check escalated complaints

### For Workers

1. **View Assigned Tasks**
   - See all assigned complaints
   - View on map for route planning

2. **Update Status**
   - Mark as in-progress
   - Add progress notes
   - Upload completion photos

3. **Complete Work**
   - Upload before/after photos
   - Mark as resolved
   - Add completion notes

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
