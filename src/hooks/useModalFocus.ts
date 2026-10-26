import { useEffect, useRef } from 'react';

/** Supports stacked overlays, Escape dismissal, focus containment, and return to the trigger. */
export function useModalFocus<T extends HTMLElement>(open: boolean, onClose: () => void) {
  const ref = useRef<T>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    const root = ref.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const elements = () => Array.from(root?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]') ?? []).filter((node) => node.getClientRects().length > 0);
    (elements()[0] ?? root)?.focus();
    const topmost = () => Array.from(document.querySelectorAll('[data-focus-scope="modal"]')).at(-1) === root;
    const handleKey = (event: KeyboardEvent) => {
      if (!topmost()) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); closeRef.current(); return; }
      if (event.key !== 'Tab') return;
      const list = elements(); const first = list[0]; const last = list.at(-1);
      if (!first || !last) { event.preventDefault(); root?.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || !root?.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !root?.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    const observer = new MutationObserver(() => { if (topmost() && !root?.contains(document.activeElement)) (elements()[0] ?? root)?.focus(); });
    if (root) observer.observe(root, { childList: true, subtree: true });
    document.addEventListener('keydown', handleKey, true);
    return () => { observer.disconnect(); document.removeEventListener('keydown', handleKey, true); document.body.style.overflow = previousOverflow; if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); };
  }, [open]);
  return ref;
}
