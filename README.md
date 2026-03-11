# Sahayak

Municipal complaint management system. Citizens report civic issues, field workers resolve them, HODs oversee departments, and admins manage the system.

**Stack:** Node.js + Express + MongoDB · Expo React Native

---

## Roles

| Role     | Description                                                       |
| -------- | ----------------------------------------------------------------- |
| `user`   | Citizen — files and tracks complaints                             |
| `worker` | Field worker — resolves assigned complaints                       |
| `head`   | HOD — manages workers, approves completions, oversees department  |
| `admin`  | System admin — manages all users and workers across departments   |

---

## What's Built

### Citizen
- File complaints with up to 5 photos, GPS location, category templates
- Gemini AI auto-categorizes department, priority, and tags on submission
- Track status with full timeline history and SLA countdown
- Upvote complaints (auto-escalates priority at vote thresholds)
- Submit feedback and satisfaction vote on resolved complaints
- Threaded per-complaint messaging with workers/HOD
- Analytics summary + interactive complaint heatmap (Leaflet)
- AI chat assistant (Gemini) — ticket lookup, complaint queries
- Push notifications + per-type notification preferences
- Offline complaint draft queue (flushes on reconnect)
- Hindi / English i18n

### Worker
- Dashboard: active assignments, weekly performance, pending-approval alerts
- Update complaint status with completion photos (up to 10)
- Multi-worker assignments with per-worker task descriptions
- Performance analytics: 8-week trend, priority breakdown, status distribution
- Leaderboard with badges and streaks across departments

### HOD
- Department overview: open/resolved/SLA stats, performance score
- Worker management: view workload, invite via email (expiring token), remove workers
- Assign multiple workers to complaints with task notes
- Approve completions or send back for rework; cancel complaints
- AI review queue: approve/reject Gemini-suggested department/priority changes
- Resolved complaint archive
- Reports: PDF, Excel, CSV with date/department filters
- Scheduled email reports (daily/weekly/monthly)
- Worker performance analytics per worker

### Admin
- Full user CRUD across all roles and departments
- Create and update worker accounts
- Access all workers and reports across departments

### Platform
- SLA deadlines per priority; hourly auto-escalation (priority bump + HOD alert)
- Festival/event calendar for dynamic priority near key locations
- Expo push notifications; email on complaint filed and resolved
- In-app notification history with read/unread state
- Self-ping cron to keep free-tier hosting alive

---

## Tech Stack

| Layer    | Libraries |
| -------- | --------- |
| Backend  | Express, Mongoose, JWT, Cloudinary, Gemini AI, Resend, Expo Notifications |
| Mobile   | Expo Router, NativeWind, React Query, i18n, Lottie, Leaflet (WebView) |

---

## Quick Start

```bash
# Backend
cd backend && npm install && npm run dev

# Mobile
cd mobile && npm install && npx expo start
```

## Environment Variables

**`backend/.env`**
```
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
OPENAI_API_KEY=
```

**`mobile/.env`**
```
EXPO_PUBLIC_API_URL=http://localhost:6000/api
```

## Seed Data

```bash
cd backend && node seedData.js
```
