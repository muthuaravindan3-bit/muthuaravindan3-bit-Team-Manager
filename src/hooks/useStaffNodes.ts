import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { z } from 'zod';
import { db } from '../firebase';
import type { StaffNode } from '../components/scenes/sceneTypes';
const schema = z.object({ displayName: z.string(), isBreakActive: z.boolean().optional() });
/** Reads the existing workspace directory; no inferred relationships are generated. */
export function useStaffNodes() {
  const [nodes, setNodes] = useState<StaffNode[]>([]);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => onSnapshot(collection(db, 'users'), (snapshot) => {
    const next: StaffNode[] = [];
    for (const record of snapshot.docs) { const parsed = schema.safeParse(record.data()); if (!parsed.success) { setUnavailable(true); setNodes([]); return; } next.push({ id: record.id, label: parsed.data.displayName, isOnBreak: parsed.data.isBreakActive === true }); }
    setNodes(next.sort((a, b) => a.label.localeCompare(b.label)).slice(0, 12)); setUnavailable(false);
  }, () => { setNodes([]); setUnavailable(true); }), []);
  return { nodes, unavailable };
}
