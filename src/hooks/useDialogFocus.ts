import { useEffect, useRef } from 'react';

/** Keeps keyboard focus in an active drawer and restores the invoking control. */
export function useDialogFocus(isOpen: boolean) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const dialog = ref.current;
    const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>(
      'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]'
    ) ?? []).filter((element) => element.getClientRects().length > 0);
    (focusable()[0] ?? dialog)?.focus();
    const observer = new MutationObserver(() => {
      // A successful action can remove its own button while the drawer stays open.
      if (dialog && !dialog.contains(document.activeElement)) (focusable()[0] ?? dialog).focus();
    });
    if (dialog) observer.observe(dialog, { childList: true, subtree: true });
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const elements = focusable();
      const first = elements[0];
      const last = elements.at(-1);
      if (!first || !last) { event.preventDefault(); dialog?.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || !dialog?.contains(document.activeElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog?.contains(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      observer.disconnect();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
      else document.querySelector<HTMLElement>('#workspace')?.focus();
    };
  }, [isOpen]);
  return ref;
}
