# Team Manager

An intelligent team management platform for staff scheduling, leave tracking, and smart troubleshooting.

## Features

- **AI-Powered Troubleshooting**: Get detailed technical guides for system issues using Gemini.
- **Roster Management**: Extract and manage staff shifts from images automatically.
- **Break Tracking**: GPS-integrated break logging for staff.
- **Leave Management**: Comprehensive leave request and approval system.
- **Admin Dashboard**: Centralized control for team managers.

## Tech Stack

- **Frontend**: React 19, Vite, Tailwind CSS, Lucide React, Motion.
- **Backend**: Firebase Firestore, Firebase Authentication.
- **AI**: Google Gemini Pro (via @google/genai).

## Getting Started

1. Clone the repository.
2. Install dependencies: `npm install`.
3. Set up environment variables:
   - Copy `.env.example` to `.env`.
   - Provide your `GEMINI_API_KEY`.
4. Configure Firebase:
   - Update `firebase-applet-config.json` with your Firebase project credentials.
5. Start development server: `npm run dev`.

## Environment Variables

- `GEMINI_API_KEY`: Your Google Gemini API Key.
