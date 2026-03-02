# Blue Whale Client Mobile App (Expo RN)

Cross‑platform (Android + iOS) client mobile app built from the **Blue Whale Mobile App (client) Development Plan**

## Features (MVP)
- Auth: Login / Register / Forgot password
- Jobs: list + details + search
- Apply to job: CV upload + note
- My Applications: status list
- Invoices: list + details + PDF open
- Payments: submit proof (reference + slip upload) + optional gateway link
- Chat: list admins + chat room (polling) + attachments
- Inquiries: create + list + details (status + replies)
- Profile: view/update + change password + logout + delete account

## Tech
- Expo (React Native) + TypeScript
- React Navigation (stack + bottom tabs)
- Axios API client (Bearer token)
- Expo SecureStore token storage
- Expo Document Picker for CV/slip/attachments
- Expo WebBrowser for opening PDFs and payment gateway

## Setup

### 1) Install
```bash
npm install
```

### 2) Configure API URL
Create a `.env` file (copy from `.env.example`) and set your backend URL:

```bash
EXPO_PUBLIC_API_URL=http://YOUR_SERVER_IP:3001
EXPO_PUBLIC_LAN_IP=YOUR_SERVER_IP
```

> IMPORTANT: Use your LAN IP (e.g., `192.168.x.x`) for testing on a phone.

### 3) Run
```bash
npm run start
```

## Backend route notes
Your backend exposes many routes (admins, agent, sales-admin...). This mobile app is **client-side**, so it focuses on:
- `/api/users/*` for auth/profile
- `/api/jobs`, `/api/applications/*`
- `/api/sales-admin/invoices/*` for invoices
- `/api/chats/*` for user ↔ admin chat
- `/api/inquiries/*`

If your invoice routes differ for client users, update `src/api/endpoints.ts` and `src/api/services.ts`.

## Build (EAS)
```bash
npm i -g eas-cli
# login once
# eas login

eas build -p android
# eas build -p ios
```

---

Made to match the web app brand colors (Primary `#1B3890`, Secondary `#0F79C5`).
