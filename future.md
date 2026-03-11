================================================================================
BACKEND — CODE QUALITY & ISSUES
================================================================================

1. No pagination on getHodOverview and getWorkerComplaints
   Returns all complaints in one query — will break at scale

2. No WebSocket / real-time updates
    Clients poll for status changes. Add socket.io or SSE for live complaint
    status, chat messages, and worker position.

3. Multi-language server responses
    preferredLanguage stored on user but all error messages, notification bodies,
    and history notes are hardcoded English

================================================================================
FRONTEND — CODE QUALITY & ISSUES
================================================================================

1. colors.purple and colors.textMuted undefined
   Referenced across screens (hod-overview.jsx, more.jsx, etc.) but absent from
   both lightColors and darkColors in colors.js → renders as undefined

2. Mixed i18n coverage
    t() used on some strings but most screen labels are hardcoded English.
    Complete i18n coverage.