# Real-time command center scenes

ScenePanel owns viewport visibility, document visibility, reduced-motion detection,
manual pause, modal occlusion, WebGL support checks and the static fallback.
SceneCanvas is imported only for a visible, active panel with WebGL2 support.
It contains geometry and frame animation, with no Firebase operations or app mutations.

TeamHub gets validated directory nodes through useStaffNodes. The current data
model has no staff relationship edges, so the hub draws no relationship lines.
Only the explicitly illustrative login network has connection lines.

SceneProps describes kind, staff nodes, selected record ID and AI lifecycle state.
App connects calendar selection; QuickActionDrawer renders the selected-shift
illustration; approval flows opt into the finite check celebration only after a
successful write; AIChat and Troubleshooter supply actual busy/response state.

The fixed camera has no controls. Geometry uses low tessellation, no textures,
no postprocessing and no shadow maps. Mobile DPR is 1; desktop DPR is capped at
1.5. Offscreen, hidden, paused or modal-covered scenes unmount the Canvas and
release its renderer. The checkmark uses demand rendering and stops requesting
frames after 1.2 seconds. Context loss switches to a static fallback.

All operational labels, pause controls and actions remain HTML. Canvas contents
are decorative and hidden from assistive technology. User data is never fetched
by the Three.js engine. Static figures use the same recorded staff count as the hub.
