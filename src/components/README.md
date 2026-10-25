# Interaction components

`AttentionInbox` presents the priority queue, search, category filters, completed work, and recommended next review. Its typed props come from `useAttentionQueue`; it owns no domain state.

`SupportingPanel` displays existing review workflows in a modal side drawer. It overlays the canvas to preserve reading width, becomes full width on mobile, and restores keyboard focus when dismissed.

Inbox styles use the existing theme tokens in `src/index.css`, including reduced motion and high contrast preferences.
