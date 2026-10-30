# ShiftSync real-time 3D command center

## Integrated scenes

- Login: slowly rotating, connected illustrative people. Clearly labeled as an illustration.
- Overview: validated staff directory nodes, up to 12 people, with recorded break state and an accessible HTML legend. The current schema has no staff relationship edges, so none are invented or drawn.
- Schedule: illustrative calendar tiles lift on actual shift selection. A selected-shift scene appears in the existing detail panel, with actual person, date, time and timezone labels in HTML.
- Requests: finite 1.2-second checkmark after a successful approved decision. Failed saves and declines do not trigger it.
- Support and floating AI chat: orb states follow actual idle, pending request and received response state. AI tests use a mocked local response.

## Rendering and accessibility

Three.js 0.186.0, React Three Fiber 9.8.2 and matching Three types are pinned.
The Canvas engine is dynamically imported only when a panel is visible and motion
is allowed. Reduced motion, manual pause, offscreen panels, hidden documents and
modal-covered panels remove the active canvas. Unsupported WebGL2, rendering
errors and lost contexts use static previews. HTML controls remain usable.

Mobile DPR is 1; desktop DPR is capped at 1.5. Shapes have bounded tessellation;
there are no remote assets, textures, postprocessing or dynamic shadow maps.
The fixed camera has no orbit controls, scrolling handlers or camera animation.
Checkmarks use demand rendering and stop requesting frames after completion.

The current in-app browser reports reduced motion. Its static previews are
intentional and explain this setting; normal-motion WebGL browsers animate.

## Verification

- TypeScript: passed.
- Unit tests: 3 passed.
- Final browser run: 30 passed, 0 failed. See artifacts/verification/playwright.json.
- Responsive checks: 375, 390, 1024, 1440, 1920px in both themes.
- Real WebGL: successive canvas screenshots changed at mobile and desktop widths.
- GPU resolution caps, manual pause/resume, modal suspension, context-loss recovery,
  reduced-motion lazy-load avoidance, unavailable WebGL, selection, approval failure
  and retry, and actual AI request/response lifecycle all passed.
- Existing scheduling, leave, swaps, handover, role restrictions, focus, keyboard,
  history and form-recovery checks passed using disposable Firebase adapters.
- Production frontend and server builds passed. Three engine chunk is approximately
  252 KB gzipped and lazy loaded; initial app chunk remains approximately 272 KB
  gzipped. Vite continues to warn about large bundles.

### Local frame sampling

These are 45 requestAnimationFrame interval samples while the hub rendered in
local headless Edge. They measure browser frame scheduling, not GPU draw duration,
battery use, physical phone performance or a guaranteed device frame rate.

| Scenario | Average interval | Maximum interval |
|---|---:|---:|
| Live hub renders, animates, and pauses at 375px | 8.24 ms | 8.40 ms |
| Live hub renders, animates, and pauses at 1440px | 8.25 ms | 8.40 ms |

## Evidence and remaining limits

- Live WebGL preview: artifacts/screenshots/live-hub-1440.png
- Mobile preview: artifacts/screenshots/live-hub-375.png
- Paused static previews: artifacts/screenshots/live-hub-paused-1440.png and live-hub-paused-375.png
- Physical iOS/Android GPUs, Safari, long-session GPU memory, battery impact and
  production Gemini responses were not tested. These remain device/release checks.
- Automated viewport checks are not physical mobile-device certification.
- npm audit reports 18 findings in the dependency tree; none are attributed to
  Three.js, React Three Fiber or Three types. Details are recorded in
  artifacts/verification/dependency-audit.json. Unrelated package upgrades were not applied.
- Existing authentication, Firestore schemas, permissions and Gemini contracts are preserved.
