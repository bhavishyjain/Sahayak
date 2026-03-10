# Sahayak

Sahayak is a municipal complaint management system — citizens report civic issues, workers fix them, and HODs oversee the process.

**Stack:** Node.js + Express + MongoDB (backend) · Expo React Native (mobile)

---

## Roles

| Role     | Description                                                 |
| -------- | ----------------------------------------------------------- |
| `user`   | Citizen — submits and tracks complaints                     |
| `worker` | Field worker — resolves assigned complaints                 |
| `head`   | HOD — manages workers and approves resolutions              |
| `admin`  | System admin — manages users and workers across departments |

---

## Features

### Citizen

- Submit complaints with up to 5 photos, location, and department
- AI-assisted categorization (department, priority, tags)
- Track complaint status with full history timeline
- Upvote similar complaints
- Submit feedback and satisfaction rating on resolved complaints
- Analytics summary + complaint heatmap
- AI chat assistant (Gemini)
- Push notification history + granular preferences

### Worker

- Home screen: active task overview and today's stats
- Assigned and completed complaint views
- Update complaint status with completion photos
- Worker leaderboard (dept ranking by completions)
- Performance analytics: 8-week trend, priority breakdown, status distribution

### HOD (Head of Department)

- Dept overview: open/resolved/SLA counts, performance score, complaint list
- Worker management: view all workers, workload, and individual task histories
- Invite workers via email (expiring token flow)
- Assign single or multiple workers to a complaint, with per-worker tasks
- Approve completed complaints or send back for rework
- Cancel complaints
- AI review queue for complaints flagged by the AI
- Scheduled and on-demand reports (PDF, Excel, CSV, email)
- Worker performance analytics per worker
- View resolved complaint archive

### Notifications

- Expo push notifications for complaint updates, worker assignments, SLA breaches, report delivery
- Per-type notification preferences
- In-app notification history with read/unread state

### Reports

- Generate PDF / Excel / CSV reports with date range and filters
- Schedule recurring email reports
- Dept breakdown and summary stats

### SLA & Escalation

- SLA deadlines per complaint priority
- Auto-escalation on breach (priority bump + HOD alert)
- Festival/event calendar adjusts dynamic priority

---

## Tech Stack

- **Backend:** Express, Mongoose, JWT, Cloudinary, Gemini AI, Resend (email), Expo push
- **Mobile:** Expo Router (file-based), NativeWind (Tailwind), i18n multi-language

## Project Structure

```
backend/    Express API
mobile/     Expo React Native app
```

## Quick Start

```bash
# Backend
cd backend && npm install && npm run dev

# Mobile
cd mobile && npm install && npx expo start
```

## Environment Variables

### `backend/.env`

```env
PORT=6000
MONGO_URI=
JWT_SECRET=
JWT_EXPIRES_IN=7d
ALLOWED_ORIGINS=http://localhost:8081
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
GEMINI_API_KEY=
RESEND_API_KEY=
EMAIL_FROM="Sahayak <noreply@yourdomain.com>"
APP_URL=http://localhost:3000
```

### `mobile/.env`

```env
EXPO_PUBLIC_API_URL=http://localhost:6000/api
```

## Seed Data

```bash
cd backend && node seedData.js
```
