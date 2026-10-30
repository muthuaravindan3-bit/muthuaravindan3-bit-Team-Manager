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


## UI and workflow refresh

ShiftSync uses a shared light/dark interface with six areas: Overview, Schedule,
Requests, Team, Support, and Admin. Existing Firebase collections, sign-in,
member/admin roles, and stored status values are preserved. There is no new
schedule publishing or versioning system.

- Overview includes Needs attention and Personal activity, based on stored records.
- Schedule includes My week, saved filters, overnight-aware cover comparisons, and reviewed changes.
- Assignments, requests, approvals, AI roster/import commits, and handover have change previews.
- Failed reviewed writes retain their inputs and offer Try again. Routine Overview and schedule updates wait for Review updates.
- Named views are saved on the device. Entered text in major forms is retained in memory during navigation and cleared at sign-out.
- Shared dialogs contain keyboard focus, support Escape, and restore focus. Form labels are connected to their controls.
- Major pages and the help assistant load separately. The assistant loads when opened.

### Run locally on Windows

```powershell
npm ci
$env:PORT = '3010'
npm run dev
```

Open http://localhost:3010. Use the existing Firebase configuration and Google
sign-in. Starting the app does not create test users or replace production data.

### Verify safely

```powershell
npm run lint
npm run test:unit
npm run test:e2e
npm run build
```

The browser suite uses Microsoft Edge and a separate Vite configuration on port
4174. Its Firebase Auth and Firestore imports resolve to in-memory fixtures in
`tests/fixtures`. The production Vite configuration has no fixture aliases or
test sign-in bypass. Browser contexts block remote services during tests. Fixture
writes, failures, role changes, incidents, and handovers affect only disposable
browser memory. Do not point the browser suite at a production server.

See `UX_VERIFICATION.md` for results, measured limitations, and screenshot links.
Raw browser results are in `artifacts/verification/playwright.json`; screenshots
are in `artifacts/screenshots`. Run `npx playwright show-report` for local traces
and failure details after a test run.


## Tactile 3D visual system

The shared stylesheet (`src/index.css`) defines navy/slate and warm ivory
surfaces, teal actions, amber status accents, raised panel shadows, button edge
depth, and inset controls. Space Grotesk headings pair with Source Sans 3 body
text. Theme IDs and saved theme preferences are preserved.

Dimensional effects use CSS gradients, borders, and shadows. Calendar and form
content stays stationary; press feedback uses transforms. MotionConfig respects
the system reduced-motion preference, with CSS interaction animations disabled
under reduced motion. Mobile navigation includes safe-area spacing and controls
retain 44px minimum targets. Operational fixture data is not included in the production application.


## Animated 3D scenes

Pinned Three.js 0.186.0 and React Three Fiber 9.8.2 provide lazily loaded login,
team hub, calendar-selection, approval and AI-orb scenes. See
`src/components/scenes/README.md` for lifecycle and data contracts.

`npm run test:e2e` includes real WebGL screenshot-change checks, mobile/desktop
pixel-ratio caps, pause and modal suspension, context loss, reduced motion,
unavailable WebGL, approval write recovery and AI lifecycle tests. These use
isolated Firebase fixtures and a mocked AI response. See `UX_REALTIME_3D.md` for
performance observations and limitations; physical phones are not emulated GPUs.
