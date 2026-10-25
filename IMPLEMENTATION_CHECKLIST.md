# ShiftSync implementation checklist

The existing application is being extended in place. No hosting, external accounts, backend, location access, or paid services are in scope.

- [ ] Shared scheduling: exact durations, overnight intervals, cross-week rest, position coverage, leave, certifications, future-only edits.
- [ ] Versioned schedules: immutable scoped snapshots, Changes Pending, validation freshness, advisory acknowledgement, no blocker override.
- [ ] Browser-local persistence: validated hydration, drafts, requests, preferences, saved views, layout, offline recovery.
- [ ] Requests and trades: ownership, counterpart acceptance, linked drafts, atomic publication, stale-term recovery.
- [ ] Explainable AI suggestion: isolated editable proposal, freshness, constraints, alternatives, application and validation.
- [ ] Shared demonstration clock and published operational selectors across overview, floor, dossiers, and handover.
- [ ] Schedule workspace: four views, filter persistence, exports, bulk preview, undo, simulation, future period selection.
- [ ] Shell and search: Appearance, favorites, contextual URLs, Back, accessible menus and command palette.
- [ ] Incidents, handover, administration, and component board: meaningful actions, permissions, explicit simulated connections.
- [ ] Adaptive panels and responsive layouts: desktop side panel, keyboard sizing, tablet overlay, mobile sheet.
- [ ] Domain regression tests, workflow verification on disposable data, build/typecheck, setup documentation, honest limitations.

Progress and verification evidence will be updated as each milestone is completed.
