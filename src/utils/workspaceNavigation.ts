import { UI_COPY } from '../constants/uiCopy';

export type WorkspaceId = keyof typeof UI_COPY.modules;
export interface WorkspaceLocation { workspace: WorkspaceId; view: string }
const DEFAULT_VIEWS: Record<WorkspaceId, string> = { dashboard: 'summary', schedule: 'week', requests: 'swaps', operations: 'directory', support: 'troubleshooter', admin: 'planner' };
const LEGACY: Record<string, WorkspaceLocation> = { overview: { workspace: 'dashboard', view: 'summary' }, needs_attention: { workspace: 'dashboard', view: 'attention' }, live_floor: { workspace: 'operations', view: 'tracker' }, operators: { workspace: 'operations', view: 'directory' }, incidents: { workspace: 'support', view: 'handover' }, administration: { workspace: 'admin', view: 'planner' } };
const LEGACY_VIEWS: Record<string, string> = { roster_table: 'list', week_grid: 'week', timeline_24h: 'week', coverage_matrix: 'week', my_requests: 'leaves' };

/** Validates bookmarks, including the original prototype's workspace URLs. */
export function readWorkspaceLocation(search: string): WorkspaceLocation {
  const params = new URLSearchParams(search);
  const value = params.get('workspace') ?? 'dashboard';
  if (LEGACY[value]) return LEGACY[value];
  const workspace = Object.hasOwn(DEFAULT_VIEWS, value) ? value as WorkspaceId : 'dashboard'; // Narrow only after checking the fixed registry.
  const requested = params.get('view') ?? params.get('subview') ?? DEFAULT_VIEWS[workspace];
  const candidate = LEGACY_VIEWS[requested] ?? requested;
  const views: readonly string[] = UI_COPY.views[workspace];
  return { workspace, view: views.includes(candidate) ? candidate : DEFAULT_VIEWS[workspace] };
}
export function defaultWorkspaceView(workspace: WorkspaceId): string { return DEFAULT_VIEWS[workspace]; }

/** Accept one record ID, never an arbitrary database path. */
export function readShiftRecordId(search: string): string | null {
  const value = new URLSearchParams(search).get('shift');
  return value && /^[A-Za-z0-9_-]{1,128}$/.test(value) ? value : null;
}
