# Contemporary identity and three-mode verification

## Implemented

Porcelain, Graphite and AMOLED use the requested page/card/elevated/text/accent
values. Semantic status, control border and focus colors are defined per mode.
Legacy saved light/dark IDs are preserved; AMOLED adds the `amoled` preference.
Settings lists the three labeled modes and the header offers a native select.
The system preference is used on first visit; saved selection is applied by an
inline head script before stylesheet loading and before React mounts.

AMOLED page, navigation, large empty regions and WebGL clear/background colors
are pure black. Panels are near-black with borders. No environment map, fog or
bloom is used. Renderer exposure updates when switching modes without a reload.
Dialogs, fields, feedback, dropdowns, native options, scrollbar, table/calendar
surfaces and chart tooltip/label styles use the shared palette.

Space Grotesk and Source Sans 3 remain the heading/body fonts. The desktop summary
sits beside the compact sculpture; phones show operational summary first. Calendar
day headers are keyboard-operable buttons and focus the dimensional illustration.
The login orbital sculpture responds gently to pointer movement. Confirmed saves
show dimensional success feedback; AI pending/response state remains connected
to actual requests. Mobile and low-core-count devices use lower mesh detail.

## Checks run

- TypeScript and three unit tests pass.
- Production frontend and server builds pass.
- A full 40-test browser run passed with all workspace views at 375, 390, 1024,
  1440 and 1920px across Light, Dark and AMOLED.
- After final layout refinements, 17 scene/theme checks and 14 targeted layout,
  focus, retry and selection checks passed. A final seven-check run passed for
  control contrast, live theme exposure, actual black WebGL clear color and mobile
  low-detail/pause/fallback behavior.
- Foreground tokens are compared to actual computed CSS values; primary/secondary
  text, accents and semantic text are checked against page/card/raised surfaces
  at 4.5:1 or higher. Accent-button text passes 4.5:1. Input/control boundary colors
  pass 3:1 against the defined surfaces. Disabled controls are not certified by
  these checks; a full accessibility audit remains separate.
- Pre-React preference behavior is tested with the entry module intentionally
  replaced by an empty module, proving the system theme applies without React.
- Existing authentication, Firebase collections, roles, permissions and Gemini
  contracts are unchanged. Tests use disposable data and a mocked AI response.

## Performance

45 requestAnimationFrame samples while the WebGL hub was active in local headless
Edge. This measures frame scheduling, not physical-phone GPU/battery performance.
- Live hub renders, animates, and pauses at 375px: average 8.27 ms, maximum 8.50 ms.
- Live hub renders, animates, and pauses at 1440px: average 8.16 ms, maximum 8.40 ms.

The initial JavaScript chunk remains about 272 KB gzipped; the lazily loaded
3D chunk is about 252 KB gzipped. The existing large-bundle warning remains.
No claim of Lighthouse or physical-device certification is made.

## Evidence and remaining limits

- artifacts/screenshots/refined-amoled-1440.png
- artifacts/screenshots/refined-amoled-375.png
- artifacts/screenshots/refined-warm-obsidian-light-1440.png
- artifacts/screenshots/refined-warm-obsidian-dark-1440.png
- artifacts/screenshots/amoled-live.png
- artifacts/verification/playwright.json (the full 40-test run)

Physical iOS/Android devices, Safari/Firefox, assistive-technology audits, live
Gemini behavior, production security-rule concurrency, external map tiles and
long-session GPU/battery behavior remain unverified. Native browser popups and
third-party map imagery may follow platform/vendor appearance. This is not a
blanket WCAG certification. Current OS reduced-motion preferences still select
static previews by default. No deployment or Git push was performed for this change.
