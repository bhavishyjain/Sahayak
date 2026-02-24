# Sahayak – Next Gen Assistance (Expo)

React Native Expo client for SevaAI with:
- NativeWind (Tailwind-like styling)
- Runtime dark/light theme switch
- i18n language switch (English/Hindi)
- JWT auth with `/api` endpoints
- Expo push notifications
- Complaint image upload

## Setup

1. Install dependencies:

```bash
npm install
```

2. Configure backend URL:

```bash
export EXPO_PUBLIC_API_URL=http://<your-local-ip>:3000/api
```

3. Start app:

```bash
npm run start
```

Use your local machine IP (not `localhost`) when testing on a physical device.

## Screens

- Welcome/Login/Register
- Dashboard
- New Complaint
- My Complaints
- Settings (Theme + Language + Push + Logout)
