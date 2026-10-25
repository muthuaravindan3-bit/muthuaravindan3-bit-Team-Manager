import { useSyncExternalStore } from 'react';

export function useMediaQuery(query: string): boolean {
  const media = window.matchMedia(query);
  return useSyncExternalStore((notify) => { media.addEventListener('change', notify); return () => media.removeEventListener('change', notify); }, () => media.matches, () => false);
}
