# ShiftSync UI refresh: verification and handoff

## Delivered

The existing application now has a coordinated cyan/neutral light and dark UI,
shared typed controls, simpler labels, six-area navigation, record-based Overview,
Needs attention and Personal activity views, My week time off, named saved views,
reviewed changes, failed-save recovery, cover comparison, and page-level lazy loading.
Existing authentication, Firebase collections, roles, and stored statuses remain.

The local development server is at http://localhost:3010. Production deployment
was not performed. Testing used only disposable, in-memory Firebase adapters.

## Checks

- TypeScript: `npm run lint` passes.
- Production: `npm run build` passes for frontend and server.
- Unit checks: two tests pass for validated legacy navigation and overnight shift overlap.
- Browser suite: 18 tests, including workflow checks and light/dark responsive matrices.
- Responsive matrix: 390, 1024, 1440, and 1920 CSS pixels. Covers Overview summary,
  attention and activity; schedule week, list and mine; swaps and leave; people,
  active breaks, break logs and handover; support chat, handover and troubleshooting;
  and Admin planner, approvals, team/payroll and settings.
- Workflow assertions inspect fixture records after assignment, leave approval,
  swap approval, cover reassignment, incident creation, and handover.
- Failure recovery: one injected write failure, followed by one successful retry;
  form entries remain and exactly one new leave request is created.
- Keyboard: review focus containment, Escape, focus return, and unsaved-entry confirmation.
- Navigation: original Needs attention links, Back/Forward, saved views after reload,
  and restoring a shift detail panel.
- Incoming updates: Overview waits for explicit review; the schedule also buffers
  incoming list replacements.

The automated tests exercise actual rendered React components through Edge.
They do not use a separate component-testing library. Browser fixture tests are
not a substitute for Firebase emulator/rules tests or real sign-in testing.

## Local task measurements

Workflow durations are recorded in `artifacts/verification/playwright.json`.
These are automated end-to-end execution times, including page loading; they are
not human usability measurements or evidence of a before/after speed improvement.
The local failure-recovery scenario succeeded with one retry and no duplicate
record. Human task-time and mistake-rate baselines have not been collected.
No external analytics were added.

### Automated task timings

| Scenario | Execution time | Result |
|---|---:|---|
| Overview, old links, and browser Back | 3.25 s | passed |
| A failed leave save retains entries and retry creates one request | 1.53 s | passed |
| Member cannot open admin controls through a direct URL | 0.72 s | passed |
| Admin assignment and time-off review change only the intended records | 2.38 s | passed |
| Review dialogs contain focus and Escape returns to the form | 1.5 s | passed |
| Find cover previews a reassignment before saving it | 1.49 s | passed |
| Incident creation and handover preserve the existing record contracts | 1.68 s | passed |
| Routine incoming changes wait for review | 1.3 s | passed |
| Saved views persist and shift details support browser Back | 2.78 s | passed |
| A reviewed swap updates the request and assignment together through existing operations | 1.32 s | passed |

These timings include browser navigation and assertions. No human mistake-rate inference is made.

## Representative screenshots

- [Overview, desktop light](artifacts/screenshots/overview-1440-light.png)
- [Overview, mobile dark](artifacts/screenshots/overview-390-dark.png)
- [Schedule, desktop light](artifacts/screenshots/schedule-week-1440-light.png)
- [Schedule, mobile dark](artifacts/screenshots/schedule-week-390-dark.png)
- [Requests, desktop light](artifacts/screenshots/requests-leaves-1440-light.png)
- [Team, desktop light](artifacts/screenshots/operations-directory-1440-light.png)
- [Handover, desktop light](artifacts/screenshots/support-handover-1440-light.png)
- [Admin, desktop light](artifacts/screenshots/admin-planner-1440-light.png)

## Remaining limitations

1. The main JavaScript chunk is approximately 268 KB gzipped, down from the earlier
   509 KB monolithic bundle, but still above the 200 KB target. Vite still reports
   a large-chunk warning. Lighthouse, real-device frame rate and 10x-load performance
   have not been measured.
2. WCAG 2.2 AA remains a target, not a certification. Focus, labels, touch targets,
   reduced-motion CSS and responsive checks were improved. A full axe/contrast,
   screen-reader, 200% browser-zoom and Safari/Firefox audit remains outstanding.
3. Actual Google sign-in, session expiry, production Firestore rules, live AI calls,
   external maps, and third-party integrations were not exercised. The adapters
   model record operations; they do not emulate server permissions or concurrency.
4. Existing multi-record operations are not transactional. The UI does not promise
   safe undo after another user's edit. Bulk roster retries skip rows already saved
   during that attempt, but server-side concurrency protection remains unchanged.
5. Full schedule revisions and decision timestamps are not stored. Personal activity
   shows available request statuses and latest shift updates with this limitation
   stated in the UI. My week cannot show per-shift notes absent from the data model.
6. Find cover compares schedule overlap only. It does not certify skills, time off,
   rest limits, consent or eligibility. AI suggestions require explicit review and
   no longer display a fabricated percentage match as evidence.
7. Draft text stays in memory during navigation and is cleared at sign-out or a
   reload. Uploaded files, generated AI previews and every advanced form selection
   are not persisted across page changes. Named views are local to this device.
8. Tests cover main workspace views and selected critical operations, not every
   nested Admin option, error state, empty state, or overlay in both themes. Further
   component-state and accessibility coverage is needed before calling the complete
   acceptance checklist satisfied.
