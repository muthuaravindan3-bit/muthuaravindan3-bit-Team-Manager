# Interaction hooks

`useAttentionQueue` derives a single operations inbox from ShiftSync records. Filters are local UI state; counts and completion are computed from the same queue. Review actions enter existing supporting panels and do not execute decisions automatically.

`useDialogFocus` manages keyboard containment, scroll locking, and focus restoration for the inspection drawer. Escape dismissal remains owned by the drawer.
