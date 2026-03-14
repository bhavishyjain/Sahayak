# Sahayak Roadmap (Next)

## P0 — Reliability / Scale

1. No pagination on getHodOverview and getWorkerComplaints
   Returns all complaints in one query — will break at scale

2. No WebSocket / real-time updates
    Clients poll for status changes. Add socket.io or SSE for live complaint
    status, chat messages, and worker position.

3. Multi-language server responses
    preferredLanguage stored on user but all error messages, notification bodies,
    and history notes are hardcoded English

1. Add pagination + filters for heavy HOD/worker endpoints (`/hod/overview`, worker complaint lists).
2. Add missing indexes for common queries:
    - complaints by `assignedWorkers.workerId`
    - notifications by `userId + createdAt`
    - users by `role + department`
3. Refactor chat controller to shared error pipeline (`asyncHandler` + `AppError`) for consistent API errors.
4. Standardize response/error localization strategy (use `preferredLanguage` in notifications and key messages).

## P1 — Code Health / Duplication

1. Centralize shared enums/constants (departments, priorities, statuses) to remove repeated literals.
2. Consolidate repeated complaint list mapping and query patterns into reusable service/helper functions.
3. Add common pagination helper for controllers to avoid repeated page/limit logic.
4. Reduce console-based logging noise and adopt structured logger with request context.

## P1 — Frontend Completion

1. Add Festival Events screen for HOD/Admin (list/create/update/delete).
2. Finish notification deep-link navigation to complaint details from push taps.
3. Replace incorrect/legacy URL constants and audit all endpoint mappings.
4. Unify repeated loading/filter logic in complaint-related tabs into shared hooks.
5. Complete i18n coverage for all visible labels and toasts.

## P2 — Product Enhancements

1. Real-time updates (SSE or WebSocket) for complaint status, messages, assignment updates.
2. Bulk assignment endpoint for HOD operations (`assign-batch`) with atomic validation.
3. Add delivery tracking and retry visibility for email/push notification outcomes.
4. Add complaint clustering insights (location hotspots + event-aware workload hints).