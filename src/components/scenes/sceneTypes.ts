export type SceneKind = 'network' | 'hub' | 'calendar' | 'check' | 'orb';
export type OrbState = 'idle' | 'processing' | 'response';
export interface StaffNode { id: string; label: string; isOnBreak: boolean }
export interface SceneProps { kind: SceneKind; nodes?: StaffNode[]; selectedId?: string | null; state?: OrbState }
export const SCENE_MATERIALS = { navy: '#15263e', teal: '#50d8bb', amber: '#f4b960', white: '#e6f6f4' } as const;
