================================================================================
SAHAYAK — DEEP CODEBASE ANALYSIS & FUTURE ROADMAP
Analysis Date: March 6, 2026
Methodology: Full backend route/controller/service/model scan + full frontend
screen/component/API-call scan, then line-by-line comparison.
================================================================================

================================================================================
SECTION 1 — BACKEND API INVENTORY (what the server can do)
================================================================================

BASE URL: /api

AUTH (/api/auth)
POST /auth/register — citizen signup; also accepts ?token= for worker invite
POST /auth/login — login by username/email/phone + password
GET /auth/me — get own profile
PUT /auth/me — update profile (name, email, phone, password, language)
POST /auth/update-profile — mobile alias of PUT /auth/me

COMPLAINTS (/api/complaints)
POST /complaints — create complaint (up to 5 proof images) → AI analysis + email
GET /complaints — own complaints (paginated, filterable by status)
GET /complaints/:id — complaint detail (access-controlled)
POST /complaints/:id/upvote — toggle upvote; auto-escalates at 100 (Low→Med) / 200 (Med→High)
POST /complaints/:id/feedback — submit 1–5 star rating + comment (resolved only)
GET /complaints/ai-review/pending — complaints with pending AI suggestions [head/admin]
POST /complaints/:id/apply-ai-suggestion — apply AI department/priority suggestion [head/admin]
POST /complaints/:id/completion-photos — upload up to 10 after-work photos [worker]
POST /complaints/:id/satisfaction-vote — thumb up/down vote
GET /complaints/:id/satisfaction — get satisfaction vote counts + own vote

ANALYTICS (/api/analytics)
GET /analytics/summary — personal stats: total/pending/in-progress/resolved + 5 recent
GET /analytics/heatmap — geo heatmap; HOD/worker auto-scoped to own dept

NOTIFICATIONS (/api/notifications)
POST /notifications/register-token — register Expo push token
POST /notifications/test — send test push notification to own device
GET /notifications/history — paginated notification list + unread count
PUT /notifications/read-all — mark all as read
PUT /notifications/:id/read — mark one as read
GET /notifications/preferences — get preferences
PUT /notifications/preferences — update (complaintsUpdates / assignments / escalations / systemAlerts)

CHAT (/api/chat)
POST /chat/message — AI chat (Gemini); ticket lookup, complaint queries, general help
POST /chat/speech-to-text — upload audio file → transcript (Whisper/Gemini STT)

WORKERS (/api/workers)
POST /workers/create — create worker account [admin]
PUT /workers/:workerId — update worker details [admin]
GET /workers — list all workers with metrics [admin/head]
GET /workers/available/:department — list available workers sorted by load [admin/head]
GET /workers/overview — worker dashboard: active assignments + stats
GET /workers/assigned-complaints — active complaints assigned to worker
GET /workers/completed-complaints — resolved complaints history (last 50)
GET /workers/leaderboard — leaderboard (weekly/monthly/yearly)
GET /workers/analytics — worker analytics with badges [self/admin/head]
PUT /workers/status/:workerId — update work location + last-active timestamp
PUT /workers/complaint/:id/status — update complaint status (notes, up to 5 photos)

HOD (/api/hod) — all require head role
GET /hod/overview — full dept overview: complaints + stats + score
GET /hod/workers — dept workers with live metrics
GET /hod/workers/:workerId/complaints — a specific worker's complaints (active/completed)
POST /hod/invite-worker — invite new worker by email (7-day secure token)
GET /hod/invitations — list sent invitations + status
DELETE /hod/invitations/:id — revoke invitation
DELETE /hod/workers/:workerId — demote worker to user (blocked if active complaints)
POST /hod/approve-completion/:id — approve work → resolved + email + worker stat update
POST /hod/needs-rework/:id — reject work → needs-rework
POST /hod/cancel-complaint/:id — cancel unassigned complaint
POST /hod/complaints/:id/assign-workers — assign multiple workers with task descriptions
PUT /hod/complaints/:id/workers/:workerId — update worker task status / notes
GET /hod/complaints/:id/workers — list all workers assigned to a complaint

REPORTS (/api/reports) — head/admin only
GET /reports/excel — download styled .xlsx (up to 5000 rows)
GET /reports/pdf — download .pdf (up to 1500 rows)
GET /reports/csv — download .csv (up to 5000 rows)
GET /reports/stats — dashboard statistics (status/priority/dept + avg time)
GET /reports/department-breakdown — per-department breakdown (totals, status, priority)
POST /reports/email — send one-off report as email attachment
POST /reports/schedule — create/update scheduled report (daily/weekly/monthly)
GET /reports/schedule — list active schedules
DELETE /reports/schedule/:id — cancel schedule

USERS (/api/users) — admin only
GET /users — list users by role/department (with optional stats)
GET /users/:id — get single user
POST /users — create any-role user
PUT /users/:id — update username/role/department
DELETE /users/:id — delete user account

HEALTH
GET /health — server health check

================================================================================
SECTION 2 — FRONTEND SCREEN INVENTORY (what the mobile app implements)
================================================================================

NAVIGATION STRUCTURE:
/ (index.jsx) → role-based redirect or → login
user → /(app)/(tabs)/home
worker → /(app)/(tabs)/worker-home
head → /(app)/(tabs)/hod-overview
admin → ❌ NO ROUTE (crashes / falls through to login)

AUTH SCREENS
login.jsx POST /auth/login
register.jsx POST /auth/register (always citizen; no invite token handling)
logout.jsx Clears storage, plays animation, redirects

CITIZEN TABS [home | complaints | assistant▲ | heatmap | more]
home.jsx GET /dashboard/summary ⚠️ WRONG URL GET /dashboard/heatmap ⚠️ WRONG URL
complaints.jsx GET /complaints POST /complaints (multipart, GPS, up to 5 images)
assistant.jsx POST /chat/message (text only, no audio)
heatmap.jsx GET /analytics/heatmap (Leaflet in WebView, filters, user location)
more.jsx Settings/profile menu, role-conditional items

WORKER TABS [worker-home | worker-assigned | leaderboard▲ | heatmap | more]
worker-home.jsx GET /workers/overview
worker-assigned.jsx GET /workers/assigned-complaints (search + date/priority/status filters)
worker-leaderboard.jsx GET /workers/leaderboard?period=&department=
heatmap.jsx (shared)
more.jsx (shared)

HOD TABS [hod-overview | hod-workers | hod-complaints▲ | heatmap | more]
hod-overview.jsx GET /hod/overview
hod-workers.jsx GET /hod/workers
hod-complaints.jsx GET /hod/overview GET /hod/workers POST /hod/complaints/:id/assign-workers
heatmap.jsx (shared)
more.jsx (shared)

STACK SCREENS (no tab bar)
complaints/complaint-details.jsx
GET /complaints/:id
GET /complaints/:id/satisfaction
POST /complaints/:id/upvote (citizen)
POST /complaints/:id/feedback (citizen, resolved only)
POST /complaints/:id/completion-photos (worker)
PUT /workers/complaint/:id/status (worker)
POST /complaints/:id/satisfaction-vote (all)
POST /hod/approve-completion/:id (HOD)
POST /hod/needs-rework/:id (HOD)
POST /hod/cancel-complaint/:id (HOD)

hod/ai-review.jsx
GET /complaints/ai-review/pending
POST /complaints/:id/apply-ai-suggestion

hod/worker-assignment.jsx
GET /complaints/:id
GET /hod/complaints/:id/workers
GET /hod/workers
POST /hod/complaints/:id/assign-workers
PUT /hod/complaints/:id/workers/:workerId

hod/worker-details.jsx
GET /hod/workers (then finds by id — no dedicated endpoint)
GET /hod/workers/:id/complaints?status=active
GET /hod/workers/:id/complaints?status=completed
DELETE /hod/workers/:id

more/hod-reports.jsx
GET/POST/DELETE /reports/schedule
GET /reports/pdf|excel|csv (FileSystem download + sharing)
POST /reports/email

more/hod-resolved.jsx
GET /hod/overview (filters resolved client-side)

more/hod-manage-invitations.jsx
GET /hod/invitations
POST /hod/invite-worker
DELETE /hod/invitations/:id

more/worker-analytics.jsx GET /workers/analytics[?workerId=]
more/worker-completed.jsx GET /workers/completed-complaints
more/notifications.jsx Full notifications + preferences UI
more/update-profile.jsx POST /auth/update-profile
more/theme.jsx Local only

================================================================================
SECTION 3 — BACKEND → FRONTEND GAP ANALYSIS (Missing in Frontend)
================================================================================

────────────────────────────────────────────────────────────────────────────────
[CRITICAL] 1. ADMIN ROLE — ENTIRELY MISSING IN FRONTEND
────────────────────────────────────────────────────────────────────────────────
Backend has: admin role with full access to /api/users (CRUD), all /api/workers
across all departments, all /api/reports, all /api/analytics,
and /api/hod endpoints for any department.
Frontend has: index.jsx does NOT route admin anywhere → app crashes on admin login.
No admin screens, no admin tab bar, no user management UI whatsoever.

What's missing:

- Admin tab navigation setup in index.jsx + (tabs)/\_layout.jsx
- /api/users CRUD screen (list, create, edit, delete user)
- Cross-department HOD-style overview
- Admin reports screen (same as hod-reports but for all depts)
- Admin worker creation screen (POST /workers/create)
- Admin worker edit screen (PUT /workers/:id)

────────────────────────────────────────────────────────────────────────────────
[HIGH] 2. SPEECH-TO-TEXT IN CHAT — NOT IMPLEMENTED
────────────────────────────────────────────────────────────────────────────────
Backend has: POST /chat/speech-to-text (Whisper API or Gemini STT)
Frontend: assistant.jsx only has a text input. No microphone button.
Impact: Citizens with low literacy can't use voice to file complaints.
The backend STT infrastructure is completely unused.
Fix: Add microphone button to assistant screen; record audio with
expo-av; upload as FormData to /chat/speech-to-text; fill
text input with transcript.

────────────────────────────────────────────────────────────────────────────────
[HIGH] 3. DEPARTMENT BREAKDOWN — ENTIRELY MISSING IN FRONTEND
────────────────────────────────────────────────────────────────────────────────
Backend has: GET /reports/department-breakdown → per-dept totals, status counts,
priority counts.
Frontend: Never called by any screen.
Fix: Add department comparison section to hod-reports.jsx or
hod-overview.jsx using a horizontal bar chart.

────────────────────────────────────────────────────────────────────────────────
[MEDIUM] 4. MULTI-LANGUAGE SUPPORT — ONLY 2 OF 11 LANGUAGES
────────────────────────────────────────────────────────────────────────────────
Backend has: preferredLanguage supports en/hi/mr/gu/ta/te/bn/kn/ml/pa/ur
AI responses are in the user's preferred language.
Frontend: Only English and Hindi language files exist.
Other 9 languages (Marathi, Gujarati, Tamil, Telugu, Bengali,
Kannada, Malayalam, Punjabi, Urdu) are never offered.
Fix: Create translation files for remaining 9 languages.
Expand LanguagePicker to show all 11 options.

────────────────────────────────────────────────────────────────────────────────
[LOW] 5. UNUSED COMPONENTS — DEAD CODE
────────────────────────────────────────────────────────────────────────────────
These components exist but are imported by no screen:

- ImageUploadBox.jsx (presigned URL upload — legacy)
- SwipeButton.jsx (swipe-to-confirm — never used)
- InfoCard.jsx (generic card — never used)
- ColorHelper.jsx (color helper — never used)
- CustomSwitch.jsx (toggle switch — never used)
- assets/data/country-codes.json (no country phone picker exists)

Fix: Either wire these into screens that need them, or remove to
reduce bundle size.

[6] REACT QUERY ADOPTION
Most screens still use raw useState/useEffect + apiCall.
Migrate to @tanstack/react-query for: - Automatic caching and background refetch - Consistent loading/error states - Fewer manual pull-to-refresh implementations

================================================================================
SECTION 4 — ENTIRELY NEW FEATURES (not in backend OR frontend yet)
================================================================================

[A] 🎤 VOICE COMPLAINT FILING
Citizens speak their complaint in their language; AI transcribes + classifies.
Backend additions: enhance /chat/speech-to-text to return parsed complaint
fields (department, priority, location) not just raw text.

[G] 🔐 2FA FOR HOD/ADMIN ACCOUNTS
OTP via email on login for head/admin roles.
Backend: Add POST /auth/verify-otp endpoint.
Frontend: After login, redirect HOD/admin to an OTP screen if required.

[H] 📈 PREDICTIVE ANALYTICS DASHBOARD
For admin: ML-based complaint volume prediction by dept/month/season.
Show a "next month forecast" chart on admin home.
Backend: Aggregate historical data and run simple trend analysis.

================================================================================
SECTION 5 — TECHNICAL DEBT & ARCHITECTURE ISSUES
================================================================================

[T2] STATE MANAGEMENT INCONSISTENCY
Mix of raw useState+useEffect and React Query across screens.
Screens without React Query have no caching, stale data issues,
and duplicate API calls on every navigation.
Recommended: adopt React Query uniformly across all screens.

[T3] NO ERROR BOUNDARIES
A single screen crash can kill the entire app.
Wrap each tab with a React ErrorBoundary fallback component.

[T4] NO RETRY / EXPONENTIAL BACKOFF ON API CALLS
api.js has no retry logic. A single flaky request permanently
shows an error state. React Query's built-in retry covers this
when fully adopted.

[T5] HARDCODED INDORE CENTER COORDINATES
Heatmap defaults to Indore (22.7196, 75.8577).
Make this a configurable constant or auto-center on user location.

[T6] ANDROID STORAGE ACCESS FOR REPORT DOWNLOADS
hod-reports.jsx uses StorageAccessFramework for Android downloads,
but there's no handling for Android 9 and below. Needs SDK version check.

[T7] ADMIN ROLE MISSING FROM ALL ROUTING AND NAVIGATION GUARDS
index.jsx switch-case has user/worker/head but not admin.
Any admin logging in on mobile gets no route and likely sees a blank screen.

[T8] NO LOADING SKELETON ON ALL SCREENS
AutoSkeleton component exists and works well. Several screens (especially
HOD screens) still use plain ActivityIndicator or no loader at all.
Apply AutoSkeleton consistently for a polished feel.

================================================================================
## AREAS FOR IMPROVEMENT:
================================================================================ 

⚠️ Inconsistent error messages - Some in English, some hardcoded
⚠️ Limited input validation on frontend - Rely heavily on backend
⚠️ No API response caching - Could improve performance
⚠️ Missing API versioning - Future-proofing concern
⚠️ No rate limiting visible - Consider adding rate limiters
⚠️ Frontend state management - Could benefit from Zustand/Redux for complex state

================================================================================
📦 RECOMMENDED TECH ADDITIONS
================================================================================

1. Socket.IO - Real-time updates
2. React Query - Better API state management (already partially used)
3. Zod - Runtime type validation
4. Redis - Caching and session management
5. Bull/BullMQ - Job queue for background tasks
6. Winston - Better logging
7. Sentry - Error tracking
8. Firebase Analytics - User behavior insights

================================================================================
END OF ANALYSIS
================================================================================ 

