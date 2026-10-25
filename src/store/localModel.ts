import { z } from 'zod';
import { useEffect, useMemo, useState, type SetStateAction } from 'react';
import * as seed from '../data/shiftSyncSeed';
import type { AuditLogEntry, BroadcastNotice, CoverageGap, CoverageRequirement, HandoverSession, IncidentRecord, LeaveRequest, Operator, ScheduleScope, SchedulingRulesConfig, ShiftTrade, AppNotification, SavedViewPreset } from '../data/shiftSyncTypes';

export interface LocalModel {
  scopes: Record<string, ScheduleScope>; operators: Operator[]; coverageGaps: CoverageGap[];
  leaveRequests: LeaveRequest[]; shiftTrades: ShiftTrade[]; incidents: IncidentRecord[];
  handoverSession: HandoverSession; rulesConfig: SchedulingRulesConfig; auditLog: AuditLogEntry[];
  broadcasts: BroadcastNotice[]; notifications: AppNotification[]; savedViews: SavedViewPreset[];
  favoriteViews: string[]; coverageRequirements: CoverageRequirement[];
}
const shift = z.enum(['1ST', '2ND', '3RD', 'GEN', 'WO', 'CO']);
const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const assignment = z.object({ operatorId: z.string(), date: isoDay, shiftCode: shift, zone: z.string(), locked: z.boolean(), isDraftChanged: z.boolean().optional(), note: z.string().optional(), positionId: z.string().optional(), requiredCert: z.string().optional(), availability: z.enum(['present', 'break', 'unavailable']).optional() });
const snapshot = z.object({ version: z.string(), publishedAtIso: z.string(), publishedBy: z.string(), assignments: z.array(assignment) });
const scope = snapshot.extend({ id: z.string(), label: z.string(), startDate: isoDay, endDate: isoDay, days: z.array(isoDay), dayLabels: z.array(z.string()), status: z.enum(['Draft', 'Validated', 'Published', 'Changes Pending']), publishedAssignments: z.array(assignment), facility: z.string().optional(), team: z.string().optional(), validatedFingerprint: z.string().optional(), advisoryAcknowledged: z.boolean().optional(), snapshots: z.array(snapshot).optional() });
const operator = z.object({ id: z.string(), badgeCode: z.string(), name: z.string(), jobTitle: z.string(), permissionRole: z.enum(['Shift Lead', 'Operator', 'Administrator']), zone: z.string(), squad: z.string(), certifications: z.array(z.string()), readinessIndex: z.number().min(0).max(100), avatarInitials: z.string(), stationCoords: z.object({ x: z.number(), y: z.number() }) });
const candidate = z.object({ operatorId: z.string(), restHoursBefore: z.number(), projectedWeeklyHours: z.number(), certMatch: z.boolean(), availabilityStatus: z.string(), overtimeImpactHours: z.number(), fairnessDelta: z.string(), ineligibleReason: z.string().nullable() });
const gap = z.object({ id: z.string(), date: isoDay, shiftCode: shift, zone: z.string(), roleRequired: z.string(), requiredCert: z.string(), preferredTarget: z.number(), hardMinimum: z.number(), currentStaffed: z.number(), severity: z.enum(['blocking', 'advisory']), reason: z.string(), candidates: z.array(candidate), assignedReplacementId: z.string().optional(), sourceLeaveRequestId: z.string().optional() });
const leave = z.object({ id: z.string(), operatorId: z.string(), leaveType: z.enum(['Annual Leave', 'Medical / Personal', 'Compensatory Off Request']), startDate: isoDay, endDate: isoDay, reason: z.string(), status: z.enum(['Pending Approval', 'Approved — schedule update pending', 'Approved & Published', 'Declined']), submittedAtIso: z.string(), affectedShift: shift, coverageImpactSummary: z.string(), reviewerNote: z.string().optional(), replacementOperatorId: z.string().optional(), requestedChanges: z.string().optional() });
const trade = z.object({ id: z.string(), requesterId: z.string(), requesterDate: isoDay, requesterShift: shift, partnerId: z.string(), partnerDate: isoDay, partnerShift: shift, status: z.enum(['Awaiting Partner', 'Partner Accepted', 'Supervisor Review', 'Approved & Applied', 'Approved — schedule update pending', 'Changes Requested', 'Declined', 'Expired']), reason: z.string(), submittedAtIso: z.string(), validationPassed: z.boolean(), validationNotes: z.array(z.string()) });
const incident = z.object({ id: z.string(), title: z.string(), severity: z.enum(['L1 · Minor', 'L2 · Elevated', 'L3 · Critical']), status: z.enum(['Open', 'Mitigating', 'Resolved']), zone: z.string(), ownerOperatorId: z.string(), openedAtIso: z.string(), summary: z.string(), outcomeNote: z.string(), carryToHandover: z.boolean(), checklist: z.array(z.object({ id: z.string(), label: z.string(), completed: z.boolean(), completedAtIso: z.string().optional() })) });
const handover = z.object({ id: z.string(), date: isoDay, outgoingShift: shift, incomingShift: shift, overlapWindowLabel: z.string(), outgoingLeadName: z.string(), incomingLeadName: z.string(), systemUptimePct: z.number(), openTicketsCount: z.number(), keyFobTransferred: z.boolean(), summaryNote: z.string(), status: z.enum(['In Progress (Overlap Active)', 'Ready for Sign-Off', 'Signed Off & Sealed']), outgoingSignedAtIso: z.string().optional(), incomingAcknowledgedAtIso: z.string().optional() });
export const rulesSchema = z.object({ minRestHours: z.number().min(1).max(24), weeklyHoursAdvisoryLimit: z.number().min(1).max(168), hardMinimumFloorCoverage: z.number().min(0).max(1000), preferredFloorTarget: z.number().min(0).max(1000), requireCertMatch: z.boolean(), allowOvernightBackToBack: z.boolean() });
const workspace = z.enum(['overview', 'needs_attention', 'schedule', 'live_floor', 'requests', 'incidents', 'operators', 'administration', 'component_board']);
export const savedViewSchema = z.object({ id: z.string(), name: z.string(), workspace, subView: z.enum(['roster_table', 'week_grid', 'coverage_matrix', 'timeline_24h']).optional(), filters: z.object({ zone: z.string().optional(), shiftCode: z.union([shift, z.literal('ALL')]).optional(), searchQuery: z.string().optional() }) });
export const modelSchema: z.ZodType<LocalModel> = z.object({
  scopes: z.record(z.string(), scope), operators: z.array(operator), coverageGaps: z.array(gap), leaveRequests: z.array(leave), shiftTrades: z.array(trade), incidents: z.array(incident), handoverSession: handover, rulesConfig: rulesSchema,
  auditLog: z.array(z.object({ id: z.string(), timestampIso: z.string(), actorName: z.string(), actorRole: z.string(), action: z.string(), scope: z.string(), detail: z.string(), severity: z.enum(['info', 'warning', 'critical']) })),
  broadcasts: z.array(z.object({ id: z.string(), title: z.string(), message: z.string(), severity: z.enum(['info', 'warning', 'urgent']), targetZone: z.string(), sentBy: z.string(), sentAtIso: z.string() })),
  notifications: z.array(z.object({ id: z.string(), title: z.string(), body: z.string(), timestampIso: z.string(), read: z.boolean(), category: z.enum(['approval', 'coverage', 'incident', 'publication']), linkWorkspace: workspace.optional() })),
  savedViews: z.array(savedViewSchema), favoriteViews: z.array(z.string()), coverageRequirements: z.array(z.object({ id: z.string(), date: isoDay, shiftCode: shift, zone: z.string(), role: z.string(), requiredCert: z.string().optional(), hardMinimum: z.number(), preferredTarget: z.number(), startIso: z.string().optional(), endIso: z.string().optional() }))
});

/** Creates disposable or first-run data; callers never mutate the module's seed objects. */
export function createInitialModel(): LocalModel {
  return structuredClone({ scopes: seed.INITIAL_SCOPES, operators: seed.INITIAL_OPERATORS, coverageGaps: seed.INITIAL_COVERAGE_GAPS, leaveRequests: seed.INITIAL_LEAVE_REQUESTS, shiftTrades: seed.INITIAL_SHIFT_TRADES, incidents: seed.INITIAL_INCIDENTS, handoverSession: seed.INITIAL_HANDOVER_SESSION, rulesConfig: seed.INITIAL_RULES_CONFIG, auditLog: seed.INITIAL_AUDIT_LOG, broadcasts: seed.INITIAL_BROADCASTS, notifications: seed.INITIAL_NOTIFICATIONS, savedViews: seed.INITIAL_SAVED_VIEWS, favoriteViews: ['sv-1', 'sv-2'], coverageRequirements: seed.INITIAL_COVERAGE_REQUIREMENTS });
}

const STORAGE_KEY = 'shiftsync_local_model_v2';
/** Schema-checked hydration. Invalid data stays untouched in storage for explicit recovery. */
export function readLocalModel(storage: Pick<Storage, 'getItem'> | null, key = STORAGE_KEY): { model: LocalModel; warning: string | null } {
  try {
    const raw = storage?.getItem(key);
    if (!raw) return { model: createInitialModel(), warning: null };
    const parsed = modelSchema.safeParse(JSON.parse(raw));
    if (parsed.success && parsed.data.scopes['scope-2026-10-19']) return { model: parsed.data, warning: null };
    return { model: createInitialModel(), warning: 'Saved data could not be validated. The original is preserved; export it or reset the demo to recover.' };
  } catch { return { model: createInitialModel(), warning: 'Local storage is unavailable. Work remains in this tab until storage is available.' }; }
}

/** One serialized document makes linked assignment/request updates persist together. */
export function useLocalModel() {
  const [storageKey] = useState(() => {
    const testSession = new URLSearchParams(window.location.search).get('testSession');
    return testSession && /^[a-zA-Z0-9-]{1,80}$/.test(testSession) ? `${STORAGE_KEY}_test_${testSession}` : STORAGE_KEY;
  });
  const [initial] = useState(() => readLocalModel(typeof localStorage === 'undefined' ? null : localStorage, storageKey));
  const [model, setModel] = useState(initial.model);
  const [saveState, setSaveState] = useState<'saved' | 'failed' | 'recovery'>(initial.warning ? 'recovery' : 'saved');
  useEffect(() => {
    if (saveState === 'recovery') return;
    try { localStorage.setItem(storageKey, JSON.stringify(model)); setSaveState('saved'); }
    catch { setSaveState('failed'); }
  }, [model, saveState, storageKey]);
  const setters = useMemo(() => {
    function setter<K extends keyof LocalModel>(key: K) {
      return (value: SetStateAction<LocalModel[K]>) => setModel((previous) => ({ ...previous, [key]: typeof value === 'function' ? value(previous[key]) : value }));
    }
    return { setScopes: setter('scopes'), setOperators: setter('operators'), setCoverageGaps: setter('coverageGaps'), setLeaveRequests: setter('leaveRequests'), setShiftTrades: setter('shiftTrades'), setIncidents: setter('incidents'), setHandoverSession: setter('handoverSession'), setRulesConfig: setter('rulesConfig'), setAuditLog: setter('auditLog'), setBroadcasts: setter('broadcasts'), setNotifications: setter('notifications'), setSavedViews: setter('savedViews'), setFavoriteViews: setter('favoriteViews'), setCoverageRequirements: setter('coverageRequirements') };
  }, []);
  return { ...model, ...setters, saveState, storageWarning: initial.warning, retryLocalSave: () => setSaveState('saved'), replaceModel: setModel };
}
