import { facilityDay } from '../services/operationalSelectors';
import { leaveInputSchema, tradeInputSchema } from '../services/inputSchemas';
import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import {
  PersonaId,
  WorkspaceId,
  ScheduleSubView,
  LeavesSubView,
  IncidentsSubView,
  AdminSubView,
  Operator,
  ScheduleScope,
  ShiftAssignment,
  ShiftCode,
  LeaveRequest,
  ShiftTrade,
  IncidentRecord,
  HandoverSession,
  SchedulingRulesConfig,
  AppNotification,
  SavedViewPreset,
  SupportingPanelState,
  ValidationResult,
  CoverageGap,
  AIProposal,
  AuditLogEntry,
  BroadcastNotice,
  FleetUnit,
  MissionRecord,
  ConcurrentEditConflict
} from '../data/shiftSyncTypes';
import {
  PERSONAS,
  INITIAL_OPERATORS,
  BOUNDARY_ASSIGNMENTS,
  INITIAL_SCOPES,
  INITIAL_COVERAGE_GAPS,
  INITIAL_LEAVE_REQUESTS,
  INITIAL_SHIFT_TRADES,
  INITIAL_INCIDENTS,
  INITIAL_HANDOVER_SESSION,
  INITIAL_RULES_CONFIG,
  INITIAL_AUDIT_LOG,
  INITIAL_BROADCASTS,
  INITIAL_FLEET_UNITS,
  INITIAL_MISSIONS,
  INITIAL_NOTIFICATIONS,
  INITIAL_SAVED_VIEWS,
  buildDefaultAIProposal
} from '../data/shiftSyncSeed';
import { validateScheduleScope, SHIFT_CATALOG } from '../utils/shiftSyncEngine';
import { useLocalModel, createInitialModel, rulesSchema } from '../store/localModel';
import { editSchedule, publishSchedule, stageTrade, scheduleFingerprint, validateDomainScope, staffingAt, replacementCandidates, type PolicyInputs } from '../services/schedulingPolicy';
import { getShiftEpochBounds, computeOperatorWeeklySummary } from '../utils/shiftSyncEngine';

const STORAGE_KEY = 'shiftsync_ai_v2026_state_v1';

interface UndoEntry {
  id: string;
  label: string;
  scopeId: string;
  previousAssignments: ShiftAssignment[];
  previousStatus: ScheduleScope['status'];
}

interface ShiftSyncContextValue {
  // Persona & Global Demo Clock
  activePersonaId: PersonaId;
  activePersona: typeof PERSONAS[0];
  setActivePersonaId: (id: PersonaId) => void;
  demoNowIso: string;
  setDemoNowIso: (iso: string) => void;

  // Navigation & URL-synced state
  activeWorkspace: WorkspaceId;
  setActiveWorkspace: (ws: WorkspaceId) => void;
  scheduleSubView: ScheduleSubView;
  setScheduleSubView: (view: ScheduleSubView) => void;
  leavesSubView: LeavesSubView;
  setLeavesSubView: (view: LeavesSubView) => void;
  incidentsSubView: IncidentsSubView;
  setIncidentsSubView: (view: IncidentsSubView) => void;
  adminSubView: AdminSubView;
  setAdminSubView: (view: AdminSubView) => void;

  // Active Period & Day
  activeScopeId: string;
  setActiveScopeId: (id: string) => void;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  activeScope: ScheduleScope;
  publishedCurrentScope: ScheduleScope;
  scopes: Record<string, ScheduleScope>;
  validationResults: Record<string, ValidationResult>;
  activeValidation: ValidationResult;
  getPolicyInputs: (scopeId: string) => PolicyInputs;
  acknowledgeAdvisories: (scopeId: string, acknowledged: boolean) => void;
  saveState: 'saved' | 'failed' | 'recovery';
  storageWarning: string | null;
  retryLocalSave: () => void;
  respondToTrade: (tradeId: string, accept: boolean) => void;
  editAIProposal: (operatorId: string, date: string, shiftCode: ShiftCode) => void;
  revalidateAIProposal: () => void;

  // Theme & Shell Preferences
  density: 'comfortable' | 'compact';
  setDensity: (d: 'comfortable' | 'compact') => void;
  highContrast: boolean;
  setHighContrast: (hc: boolean) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (c: boolean) => void;
  supportingPanel: SupportingPanelState;
  setSupportingPanel: (panel: SupportingPanelState) => void;
  closeSupportingPanel: () => void;
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;

  // Core Entities
  operators: Operator[];
  coverageGaps: CoverageGap[];
  leaveRequests: LeaveRequest[];
  shiftTrades: ShiftTrade[];
  incidents: IncidentRecord[];
  handoverSession: HandoverSession;
  rulesConfig: SchedulingRulesConfig;
  auditLog: AuditLogEntry[];
  broadcasts: BroadcastNotice[];
  fleetUnits: FleetUnit[];
  missions: MissionRecord[];
  notifications: AppNotification[];
  savedViews: SavedViewPreset[];
  favoriteViews: string[];
  toggleFavoriteView: (id: string) => void;

  // Selected cells for bulk edit
  selectedCellKeys: string[];
  toggleCellSelection: (key: string) => void;
  clearCellSelection: () => void;
  selectMultipleCells: (keys: string[]) => void;

  // Sandbox & AI Proposal
  sandboxActive: boolean;
  sandboxAssignments: ShiftAssignment[] | null;
  enterWhatIfSandbox: () => void;
  discardWhatIfSandbox: () => void;
  applySandboxToDraft: () => void;
  updateSandboxAssignment: (operatorId: string, date: string, shiftCode: ShiftCode) => void;
  aiProposal: AIProposal | null;
  generateAIAutopilotProposal: (targetScopeId?: string) => void;
  applyAIProposalToDraft: (selectedChangeKeys?: string[]) => void;
  discardAIProposal: () => void;

  // Schedule Actions
  updateAssignment: (scopeId: string, operatorId: string, date: string, shiftCode: ShiftCode, note?: string) => void;
  bulkUpdateAssignments: (scopeId: string, cellKeys: string[], shiftCode: ShiftCode) => void;
  assignReplacementToGap: (gapId: string, operatorId: string) => void;
  runScheduleValidation: (scopeId?: string) => ValidationResult;
  publishScheduleScope: (scopeId: string, overrideRationale?: string) => { ok: boolean; error?: string };
  discardDraftChanges: (scopeId: string) => void;
  undoStack: UndoEntry[];
  undoLastScheduleChange: () => void;

  // Concurrent Conflict Simulation & Resolution
  activeConflict: ConcurrentEditConflict | null;
  triggerSimulatedConflict: (scopeId?: string) => void;
  resolveConcurrentConflict: (strategy: 'reload_theirs' | 'keep_mine_revalidate') => void;

  // Leaves & Trades Actions
  approveLeaveRequest: (requestId: string, reviewNote: string) => void;
  declineLeaveRequest: (requestId: string, reviewNote: string) => void;
  submitNewLeaveRequest: (payload: {
    operatorId: string;
    leaveType: LeaveRequest['leaveType'];
    startDate: string;
    endDate: string;
    reason: string;
  }) => void;
  approveAndExecuteShiftTrade: (tradeId: string, reviewNote?: string) => { ok: boolean; message: string };
  declineShiftTrade: (tradeId: string, reviewNote: string) => void;
  proposeShiftTrade: (payload: {
    requesterId: string;
    requesterDate: string;
    partnerId: string;
    partnerDate: string;
    reason: string;
  }) => void;

  // Incidents & Handover Actions
  toggleIncidentStep: (incidentId: string, stepId: string) => void;
  updateIncidentOutcomeNote: (incidentId: string, note: string) => void;
  resolveIncident: (incidentId: string, note?: string) => void;
  toggleIncidentCarryToHandover: (incidentId: string) => void;
  createIncident: (payload: {
    title: string;
    severity: IncidentRecord['severity'];
    zone: string;
    summary: string;
  }) => void;
  updateHandoverSession: (patch: Partial<HandoverSession>) => void;
  sealShiftHandover: (incomingLeadSignOffName: string) => void;

  // Admin & Notifications Actions
  updateRulesConfig: (patch: Partial<SchedulingRulesConfig>) => void;
  updateOperatorRole: (operatorId: string, newRole: PersonaId) => void;
  sendBroadcastNotice: (title: string, message: string, severity: BroadcastNotice['severity'], targetZone: string) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  saveCustomViewPreset: (name: string, filters: SavedViewPreset['filters']) => void;
  resetDemoState: () => void;
  toastMessage: { id: string; title: string; detail?: string; tone: 'cyan' | 'emerald' | 'amber' | 'rose' } | null;
  dismissToast: () => void;
  showToast: (title: string, detail?: string, tone?: 'cyan' | 'emerald' | 'amber' | 'rose') => void;
}

const ShiftSyncContext = createContext<ShiftSyncContextValue | null>(null);

export const ShiftSyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Load initial preferences from localStorage or URL
  const getInitialUrlParams = () => {
    if (typeof window === 'undefined') return {};
    const params = new URLSearchParams(window.location.search);
    return {
      workspace: params.get('workspace') as WorkspaceId | null,
      subview: params.get('subview'),
      scope: params.get('scope'),
      date: params.get('date'),
      persona: params.get('persona') as PersonaId | null
    };
  };

  const urlInit = getInitialUrlParams();

  const [activePersonaId, setActivePersonaId] = useState<PersonaId>(urlInit.persona || 'shift_lead');
  const [demoNowIso, setDemoNowIso] = useState<string>('2026-10-25T14:00:00+05:30');
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceId>(urlInit.workspace || 'overview');
  const [scheduleSubView, setScheduleSubView] = useState<ScheduleSubView>(
    (urlInit.subview as ScheduleSubView) || 'roster_table'
  );
  const [leavesSubView, setLeavesSubView] = useState<LeavesSubView>('requests');
  const [incidentsSubView, setIncidentsSubView] = useState<IncidentsSubView>('incidents');
  const [adminSubView, setAdminSubView] = useState<AdminSubView>('members_roles');

  const [activeScopeId, setActiveScopeId] = useState<string>(urlInit.scope || 'scope-2026-10-19');
  const [selectedDate, setSelectedDate] = useState<string>(urlInit.date || '2026-10-25');

  const [density, setDensity] = useState<'comfortable' | 'compact'>(() => {
    try {
      const saved = localStorage.getItem('shiftsync_density');
      return saved === 'compact' ? 'compact' : 'comfortable';
    } catch {
      return 'comfortable';
    }
  });

  const [highContrast, setHighContrast] = useState<boolean>(() => {
    try {
      return localStorage.getItem('shiftsync_contrast') === 'high';
    } catch {
      return false;
    }
  });

  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('shiftsync_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const [supportingPanel, setSupportingPanel] = useState<SupportingPanelState>({
    kind: null,
    widthPx: 430
  });
  const [commandPaletteOpen, setCommandPaletteOpen] = useState<boolean>(false);

  const {
    operators, setOperators, scopes, setScopes, coverageGaps: storedCoverageGaps, setCoverageGaps,
    leaveRequests, setLeaveRequests, shiftTrades, setShiftTrades, incidents, setIncidents,
    handoverSession, setHandoverSession, rulesConfig, setRulesConfig, auditLog, setAuditLog,
    broadcasts, setBroadcasts, notifications, setNotifications, savedViews, setSavedViews,
    favoriteViews, setFavoriteViews, coverageRequirements, setCoverageRequirements,
    saveState, storageWarning, retryLocalSave, replaceModel
  } = useLocalModel();
  const fleetUnits = INITIAL_FLEET_UNITS;
  const missions = INITIAL_MISSIONS;
  const [selectedCellKeys, setSelectedCellKeys] = useState<string[]>([]);
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const [sandboxActive, setSandboxActive] = useState<boolean>(false);
  const [sandboxAssignments, setSandboxAssignments] = useState<ShiftAssignment[] | null>(null);
  const [aiProposal, setAiProposal] = useState<AIProposal | null>(null);
  const [activeConflict, setActiveConflict] = useState<ConcurrentEditConflict | null>(null);
  const [toastMessage, setToastMessage] = useState<{
    id: string;
    title: string;
    detail?: string;
    tone: 'cyan' | 'emerald' | 'amber' | 'rose';
  } | null>(null);

  const showToast = useCallback(
    (title: string, detail?: string, tone: 'cyan' | 'emerald' | 'amber' | 'rose' = 'cyan') => {
      setToastMessage({
        id: `toast-${Date.now()}`,
        title,
        detail,
        tone
      });
    },
    []
  );

  const dismissToast = useCallback(() => setToastMessage(null), []);

  // Auto-dismiss toast after 4.5 seconds
  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => setToastMessage(null), 4500);
    return () => clearTimeout(t);
  }, [toastMessage]);

  // Apply density & highContrast attributes to documentElement
  useEffect(() => {
    document.documentElement.setAttribute('data-density', density);
    try {
      localStorage.setItem('shiftsync_density', density);
    } catch {
      // ignore storage errors
    }
  }, [density]);

  useEffect(() => {
    document.documentElement.setAttribute('data-contrast', highContrast ? 'high' : 'normal');
    try {
      localStorage.setItem('shiftsync_contrast', highContrast ? 'high' : 'normal');
    } catch {
      // ignore
    }
  }, [highContrast]);

  useEffect(() => {
    try {
      localStorage.setItem('shiftsync_sidebar_collapsed', String(sidebarCollapsed));
    } catch {
      // ignore
    }
  }, [sidebarCollapsed]);

  // Sync URL query params for shareable workspace / date / scope
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    params.set('workspace', activeWorkspace);
    params.set('scope', activeScopeId);
    params.set('date', selectedDate);
    params.set('persona', activePersonaId);
    if (activeWorkspace === 'schedule') {
      params.set('subview', scheduleSubView);
    }
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newUrl);
  }, [activeWorkspace, activeScopeId, selectedDate, activePersonaId, scheduleSubView]);

  // Keyboard shortcut Ctrl/Cmd + K for Command Palette & Escape for Supporting Panel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        if (commandPaletteOpen) {
          setCommandPaletteOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [commandPaletteOpen]);

  const activePersona = useMemo(
    () => PERSONAS.find((p) => p.id === activePersonaId) || PERSONAS[0],
    [activePersonaId]
  );

  const activeScope = useMemo(
    () => scopes[activeScopeId] || scopes['scope-2026-10-19'],
    [scopes, activeScopeId]
  );

  // Published current scope for Live Floor Radar (strictly reads published assignments, never unpublished draft)
  const publishedCurrentScope = useMemo(() => {
    const s = Object.values(scopes).find((scope) => scope.days.includes(facilityDay(demoNowIso))) ?? scopes['scope-2026-10-19'];
    return {
      ...s,
      assignments: s.publishedAssignments
    };
  }, [scopes, demoNowIso]);

  const getPolicyInputs = useCallback((scopeId: string): PolicyInputs => ({
    nowIso: demoNowIso, operators, rules: rulesConfig, leaveRequests,
    requirements: coverageRequirements.map((requirement) => requirement.id === 'baseline-overlap' ? { ...requirement, hardMinimum: rulesConfig.hardMinimumFloorCoverage, preferredTarget: rulesConfig.preferredFloorTarget } : requirement),
    boundaryAssignments: [...BOUNDARY_ASSIGNMENTS, ...Object.values(scopes).filter((scope) => scope.id !== scopeId).flatMap((scope) => scope.assignments)]
  }), [demoNowIso, operators, rulesConfig, leaveRequests, coverageRequirements, scopes]);
  const coverageGaps = useMemo(() => storedCoverageGaps.map((gap) => {
    const scope = Object.values(scopes).find((item) => item.days.includes(gap.date));
    if (!scope) return gap;
    const bounds = getShiftEpochBounds(gap.date, gap.shiftCode);
    return { ...gap, currentStaffed: bounds ? staffingAt(scope.assignments, operators, bounds.startMs, gap.zone, gap.requiredCert) : 0,
      candidates: replacementCandidates(scope, gap, getPolicyInputs(scope.id), activePersona) };
  }), [storedCoverageGaps, scopes, operators, getPolicyInputs, activePersona]);  const validationResults = useMemo(() => Object.fromEntries(Object.values(scopes).map((scope) => [scope.id, validateDomainScope(scope, getPolicyInputs(scope.id))])), [scopes, getPolicyInputs]);
  const activeValidation = validationResults[activeScope.id];
  const acknowledgeAdvisories = useCallback((scopeId: string, acknowledged: boolean) => {
    setScopes((previous) => ({ ...previous, [scopeId]: { ...previous[scopeId], advisoryAcknowledged: acknowledged } }));
  }, [setScopes]);
  const closeSupportingPanel = useCallback(() => {
    setSupportingPanel((prev) => ({ ...prev, kind: null, entityId: undefined, secondaryId: undefined }));
  }, []);

  const addAuditEntry = useCallback(
    (action: string, scopeLabel: string, detail: string, severity: AuditLogEntry['severity'] = 'info') => {
      const entry: AuditLogEntry = {
        id: `AUD-${Date.now().toString().slice(-4)}`,
        timestampIso: demoNowIso,
        actorName: activePersona.name,
        actorRole: activePersona.permissionRole,
        action,
        scope: scopeLabel,
        detail,
        severity
      };
      setAuditLog((prev) => [entry, ...prev]);
    },
    [activePersona, demoNowIso]
  );

  const updateAssignment = useCallback((scopeId: string, operatorId: string, date: string, shiftCode: ShiftCode, note?: string) => {
    const target = scopes[scopeId];
    if (!target || !operators.some((operator) => operator.id === operatorId)) return;
    const result = editSchedule(target, [{ operatorId, date, shiftCode, note }], activePersona, demoNowIso);
    if (!result.ok) { showToast('Assignment unchanged', result.error, 'rose'); return; }
    setUndoStack((previous) => [{ id: crypto.randomUUID(), label: `Edit ${date} ${operatorId}`, scopeId, previousAssignments: target.assignments, previousStatus: target.status }, ...previous.slice(0, 14)]);
    setScopes((previous) => ({ ...previous, [scopeId]: result.value }));
    setShiftTrades((previous) => previous.map((trade) => trade.status === 'Approved — schedule update pending' && ((trade.requesterId === operatorId && trade.requesterDate === date) || (trade.partnerId === operatorId && trade.partnerDate === date)) ? { ...trade, status: 'Changes Requested', validationPassed: false, validationNotes: ['Agreed assignment changed. Counterpart must review new terms.'] } : trade));
    addAuditEntry('Assignment changed in local draft', target.label, `${operatorId} · ${date} → ${shiftCode}`);
    showToast('Changes Pending', 'Saved locally. Validate the latest draft before publication.', 'cyan');
  }, [scopes, operators, activePersona, demoNowIso, setScopes, setShiftTrades, addAuditEntry, showToast]);

  const bulkUpdateAssignments = useCallback((scopeId: string, cellKeys: string[], shiftCode: ShiftCode) => {
    const target = scopes[scopeId];
    if (!target) return;
    const edits = cellKeys.map((key) => { const [operatorId, date] = key.split('__'); return { operatorId, date, shiftCode }; });
    const result = editSchedule(target, edits, activePersona, demoNowIso);
    if (!result.ok) { showToast('Bulk edit not applied', result.error, 'rose'); return; }
    setUndoStack((previous) => [{ id: crypto.randomUUID(), label: `Bulk edit ${edits.length} assignments`, scopeId, previousAssignments: target.assignments, previousStatus: target.status }, ...previous.slice(0, 14)]);
    setScopes((previous) => ({ ...previous, [scopeId]: result.value }));
    setSelectedCellKeys([]);
    showToast('Bulk changes staged', `${edits.length} assignments updated together. Validation Required.`, 'cyan');
  }, [scopes, activePersona, demoNowIso, setScopes, showToast]);
  const assignReplacementToGap = useCallback((gapId: string, operatorId: string) => {
    const gap = coverageGaps.find((item) => item.id === gapId);
    const target = gap && Object.values(scopes).find((scope) => scope.days.includes(gap.date));
    const candidate = gap?.candidates.find((item) => item.operatorId === operatorId);
    if (!gap || !target || !candidate || candidate.ineligibleReason) { showToast('Replacement not staged', candidate?.ineligibleReason ?? 'Choose an eligible candidate.', 'rose'); return; }
    const result = editSchedule(target, [{ operatorId, date: gap.date, shiftCode: gap.shiftCode, zone: gap.zone, note: gap.id }], activePersona, demoNowIso);
    if (!result.ok) { showToast('Replacement not staged', result.error, 'rose'); return; }
    result.value.assignments = result.value.assignments.map((assignment) => assignment.operatorId === operatorId && assignment.date === gap.date ? { ...assignment, requiredCert: gap.requiredCert } : assignment);
    setScopes((previous) => ({ ...previous, [target.id]: result.value }));
    setCoverageGaps((previous) => previous.map((item) => item.id === gapId ? { ...item, assignedReplacementId: operatorId } : item));
    if (gap.sourceLeaveRequestId) setLeaveRequests((previous) => previous.map((request) => request.id === gap.sourceLeaveRequestId ? { ...request, replacementOperatorId: operatorId } : request));
    addAuditEntry('Replacement applied to draft', target.label, `${operatorId} covers ${gap.date} ${gap.shiftCode} in ${gap.zone}`);
    setSupportingPanel({ kind: 'publication_review', entityId: target.id, widthPx: 480 });
    showToast('Replacement staged', 'Published assignments are unchanged. Validate and review before publication.', 'cyan');
  }, [coverageGaps, scopes, activePersona, demoNowIso, setScopes, setCoverageGaps, setLeaveRequests, addAuditEntry, showToast]);
  const runScheduleValidation = useCallback((scopeId?: string) => {
    const id = scopeId ?? activeScopeId;
    const target = scopes[id];
    const result = validateDomainScope(target, getPolicyInputs(id));
    setScopes((previous) => ({ ...previous, [id]: { ...previous[id], validatedFingerprint: result.inputFingerprint, advisoryAcknowledged: false } }));
    showToast(result.canPublish ? 'Validation complete' : 'Blocking errors found', `${result.blockingCount} blocking · ${result.advisoryCount} advisory`, result.canPublish ? 'emerald' : 'rose');
    return result;
  }, [activeScopeId, scopes, getPolicyInputs, setScopes, showToast]);

  const publishScheduleScope = useCallback((scopeId: string): { ok: boolean; error?: string } => {
    const target = scopes[scopeId];
    if (!target) return { ok: false, error: 'Schedule period unavailable.' };
    const result = publishSchedule(target, activePersona, getPolicyInputs(scopeId), shiftTrades);
    if (!result.ok) { showToast('Publication blocked', result.error, 'rose'); return result; }
    const nextScopes = { ...scopes, [scopeId]: result.value };
    setScopes(nextScopes);
    setCoverageGaps((previous) => previous.filter((gap) => !(target.days.includes(gap.date) && gap.assignedReplacementId && result.value.publishedAssignments.some((assignment) => assignment.operatorId === gap.assignedReplacementId && assignment.date === gap.date && assignment.shiftCode === gap.shiftCode))));
    setLeaveRequests((previous) => previous.map((request) => {
      if (request.status !== 'Approved — schedule update pending') return request;
      const affected = Object.values(nextScopes).flatMap((scope) => scope.publishedAssignments).filter((assignment) => assignment.operatorId === request.operatorId && assignment.date >= request.startDate && assignment.date <= request.endDate);
      return affected.length && affected.every((assignment) => ['WO', 'CO'].includes(assignment.shiftCode)) ? { ...request, status: 'Approved & Published' } : request;
    }));
    setShiftTrades((previous) => previous.map((trade) => trade.status === 'Approved — schedule update pending' && target.days.includes(trade.requesterDate) ? { ...trade, status: 'Approved & Applied', validationPassed: true } : trade));
    addAuditEntry(`Schedule ${result.value.version} published`, target.label, `Published locally by ${activePersona.name}. Previous snapshot retained.`);
    showToast(`Published ${result.value.version}`, `${target.label}. Forecast updated; current operations keep their applicable published period.`, 'emerald');
    return { ok: true };
  }, [scopes, activePersona, getPolicyInputs, shiftTrades, setScopes, setCoverageGaps, setLeaveRequests, setShiftTrades, addAuditEntry, showToast]);
  const discardDraftChanges = useCallback(
    (scopeId: string) => {
      setScopes((prev) => {
        const target = prev[scopeId];
        if (!target) return prev;
        return {
          ...prev,
          [scopeId]: {
            ...target,
            status: 'Published',
            assignments: target.publishedAssignments.map((a) => ({ ...a, isDraftChanged: false }))
          }
        };
      });
      showToast('Draft changes discarded', 'Reverted to last published snapshot.', 'amber');
    },
    [showToast]
  );

  const undoLastScheduleChange = useCallback(() => {
    if (undoStack.length === 0) return;
    const [latest, ...rest] = undoStack;
    setUndoStack(rest);
    setScopes((prev) => {
      const target = prev[latest.scopeId];
      if (!target) return prev;
      return {
        ...prev,
        [latest.scopeId]: {
          ...target,
          status: latest.previousStatus,
          assignments: latest.previousAssignments
        }
      };
    });
    showToast('Undid last change', latest.label, 'cyan');
  }, [undoStack, showToast]);

  // What-If Sandbox
  const enterWhatIfSandbox = useCallback(() => {
    setSandboxActive(true);
    setSandboxAssignments(activeScope.assignments.map((a) => ({ ...a })));
    showToast(
      'What-If Sandbox Active',
      'Experiment freely with shift assignments and stress probes. Published schedule is untouched.',
      'amber'
    );
  }, [activeScope, showToast]);

  const discardWhatIfSandbox = useCallback(() => {
    setSandboxActive(false);
    setSandboxAssignments(null);
    showToast('Exited What-If Sandbox', 'Sandbox experiments discarded.', 'cyan');
  }, [showToast]);

  const applySandboxToDraft = useCallback(() => {
    if (!sandboxAssignments) return;
    const changes = sandboxAssignments.filter((assignment) => activeScope.assignments.find((original) => original.operatorId === assignment.operatorId && original.date === assignment.date)?.shiftCode !== assignment.shiftCode);
    const result = editSchedule(activeScope, changes, activePersona, demoNowIso);
    if (!result.ok) { showToast('Simulation not applied', result.error, 'rose'); return; }
    setScopes((previous) => ({ ...previous, [activeScopeId]: result.value }));
    setSandboxActive(false); setSandboxAssignments(null);
    showToast('Simulation applied to draft', 'Validate the draft before publication.', 'cyan');
  }, [sandboxAssignments, activeScope, activeScopeId, activePersona, demoNowIso, setScopes, showToast]);
  const updateSandboxAssignment = useCallback(
    (operatorId: string, date: string, shiftCode: ShiftCode) => {
      setSandboxAssignments((prev) => {
        if (!prev) return prev;
        return prev.map((a) =>
          a.operatorId === operatorId && a.date === date
            ? { ...a, shiftCode, isDraftChanged: true }
            : a
        );
      });
    },
    []
  );

  const generateAIAutopilotProposal = useCallback((targetScopeId = 'scope-2026-10-26') => {
    const target = scopes[targetScopeId];
    if (!target || activePersona.permissionRole === 'Operator' || Date.parse(`${target.startDate}T00:00:00+05:30`) <= Date.parse(demoNowIso)) { showToast('Planning period unavailable', 'Choose an unstarted future week with scheduling permission.', 'rose'); return; }
    const template = buildDefaultAIProposal();
    const proposal: AIProposal = { ...template, id: crypto.randomUUID(), scopeId: target.id, generatedAtIso: demoNowIso,
      title: `AI suggestion · ${target.label}`, summary: 'Deterministic local demonstration: add qualified cover to preferred openings. Review constraints, alternatives, and workload advisories before applying.',
      inputFingerprint: scheduleFingerprint(target, getPolicyInputs(target.id)),
      proposedChanges: template.proposedChanges.filter((change) => target.days.includes(change.date)).map((change) => ({ ...change, fromShift: target.assignments.find((assignment) => assignment.operatorId === change.operatorId && assignment.date === change.date)?.shiftCode ?? 'WO', rationale: 'Adds qualified coverage at the preferred target. Compare actual rest and weekly hours in the review; equity is illustrative.' })) };
    const preview = editSchedule(target, proposal.proposedChanges.map((change) => ({ operatorId: change.operatorId, date: change.date, shiftCode: change.toShift, zone: change.zone })), activePersona, demoNowIso);
    if (preview.ok) proposal.validation = validateDomainScope(preview.value, getPolicyInputs(target.id));
    setAiProposal(proposal);
    setSupportingPanel({ kind: 'ai_proposal_review', entityId: proposal.id, widthPx: 520 });
  }, [scopes, activePersona, demoNowIso, getPolicyInputs, showToast]);

  const editAIProposal = useCallback((operatorId: string, date: string, shiftCode: ShiftCode) => {
    setAiProposal((previous) => previous ? { ...previous, validation: undefined, proposedChanges: previous.proposedChanges.map((change) => change.operatorId === operatorId && change.date === date ? { ...change, toShift: shiftCode } : change) } : previous);
  }, []);
  const revalidateAIProposal = useCallback(() => {
    if (!aiProposal) return;
    const target = scopes[aiProposal.scopeId];
    const updated = aiProposal.proposedChanges.map((change) => ({ ...change, fromShift: target.assignments.find((assignment) => assignment.operatorId === change.operatorId && assignment.date === change.date)?.shiftCode ?? 'WO' }));
    const result = editSchedule(target, updated.map((change) => ({ operatorId: change.operatorId, date: change.date, shiftCode: change.toShift, zone: change.zone })), activePersona, demoNowIso);
    if (!result.ok) { showToast('Proposal requires changes', result.error, 'rose'); return; }
    setAiProposal({ ...aiProposal, proposedChanges: updated, generatedAtIso: demoNowIso, inputFingerprint: scheduleFingerprint(target, getPolicyInputs(target.id)), validation: validateDomainScope(result.value, getPolicyInputs(target.id)) });
  }, [aiProposal, scopes, activePersona, demoNowIso, getPolicyInputs, showToast]);

  const applyAIProposalToDraft = useCallback((selectedChangeKeys?: string[]) => {
    if (!aiProposal) return;
    const target = scopes[aiProposal.scopeId];
    const inputs = getPolicyInputs(target.id);
    if (aiProposal.inputFingerprint !== scheduleFingerprint(target, inputs) || !aiProposal.validation) { showToast('Proposal is stale or unchecked', 'Revalidate the proposal against current assignments and rules.', 'rose'); return; }
    const changes = aiProposal.proposedChanges.filter((change) => !selectedChangeKeys || selectedChangeKeys.includes(`${change.operatorId}__${change.date}`));
    const result = editSchedule(target, changes.map((change) => ({ operatorId: change.operatorId, date: change.date, shiftCode: change.toShift, zone: change.zone })), activePersona, demoNowIso);
    if (!result.ok) { showToast('Proposal not applied', result.error, 'rose'); return; }
    const validation = validateDomainScope(result.value, inputs);
    if (!validation.canPublish) { showToast('Proposal has blocking conflicts', 'Edit the proposal and revalidate before applying.', 'rose'); return; }
    setUndoStack((previous) => [{ id: crypto.randomUUID(), label: 'Apply AI suggestion', scopeId: target.id, previousAssignments: target.assignments, previousStatus: target.status }, ...previous.slice(0, 14)]);
    setScopes((previous) => ({ ...previous, [target.id]: result.value }));
    setAiProposal(null);
    setSupportingPanel({ kind: 'publication_review', entityId: target.id, widthPx: 480 });
    addAuditEntry('AI suggestion applied to local draft', target.label, `${changes.length} reviewed edits applied. Published snapshot unchanged.`);
    showToast('AI suggestion applied to draft', 'Validate the new draft and acknowledge advisories before publication.', 'cyan');
  }, [aiProposal, scopes, activePersona, demoNowIso, getPolicyInputs, setScopes, addAuditEntry, showToast]);
  const discardAIProposal = useCallback(() => { setAiProposal(null); closeSupportingPanel(); showToast('AI suggestion dismissed', 'Draft and published assignments are unchanged.', 'cyan'); }, [closeSupportingPanel, showToast]);

  const approveLeaveRequest = useCallback((requestId: string, reviewNote: string) => {
    if (activePersona.permissionRole === 'Operator') { showToast('Restricted action', 'A Shift Lead must review team requests.', 'rose'); return; }
    const request = leaveRequests.find((item) => item.id === requestId && item.status === 'Pending Approval');
    if (!request) return;
    const nextScopes = { ...scopes };
    const newGaps: CoverageGap[] = [];
    for (const scope of Object.values(scopes)) {
      const affected = scope.assignments.filter((assignment) => assignment.operatorId === request.operatorId && assignment.date >= request.startDate && assignment.date <= request.endDate && !['WO', 'CO'].includes(assignment.shiftCode));
      if (!affected.length) continue;
      const result = editSchedule(scope, affected.map((assignment) => ({ operatorId: request.operatorId, date: assignment.date, shiftCode: 'WO', note: request.id })), activePersona, demoNowIso);
      if (!result.ok) { showToast('Leave not approved', result.error, 'rose'); return; }
      nextScopes[scope.id] = result.value;
      affected.forEach((assignment) => {
        const bounds = getShiftEpochBounds(assignment.date, assignment.shiftCode);
        const count = bounds ? staffingAt(scope.assignments, operators, bounds.startMs, assignment.zone) : 1;
        newGaps.push({ id: newGaps.length ? `GAP-LR-${request.id}-${assignment.date}` : `GAP-LR-${request.id}`, date: assignment.date, shiftCode: assignment.shiftCode, zone: assignment.zone, roleRequired: 'Qualified operations replacement', requiredCert: assignment.requiredCert ?? (assignment.zone.includes('Substation') ? 'Cryo-Safe' : 'L2-Grid'), preferredTarget: count, hardMinimum: count, currentStaffed: Math.max(0, count - 1), severity: 'blocking', reason: `Replacement for approved leave ${request.id}. Published assignment remains effective until publication.`, candidates: [], sourceLeaveRequestId: request.id });
      });
    }
    if (!newGaps.length) { showToast('No future working assignment affected', 'Choose an unstarted working day for leave.', 'amber'); return; }
    setScopes(nextScopes);
    setLeaveRequests((previous) => previous.map((item) => item.id === requestId ? { ...item, status: 'Approved — schedule update pending', reviewerNote: reviewNote.trim() || `Approved by ${activePersona.name}` } : item));
    setCoverageGaps((previous) => [...newGaps, ...previous]);
    setSupportingPanel({ kind: 'coverage_gap', entityId: newGaps[0].id, widthPx: 520 });
    addAuditEntry('Leave approved; schedule update pending', request.id, `${newGaps.length} linked absence assignments staged by ${activePersona.name}`);
    showToast('Approved — schedule update pending', 'Plan replacements, validate, and publish each affected period.', 'cyan');
  }, [activePersona, demoNowIso, leaveRequests, scopes, operators, setScopes, setLeaveRequests, setCoverageGaps, addAuditEntry, showToast]);
  const declineLeaveRequest = useCallback(
    (requestId: string, reviewNote: string) => {
      if (!reviewNote.trim()) {
        showToast('Reason required', 'Please enter a rationale before declining a request.', 'rose');
        return;
      }
      setLeaveRequests((prev) =>
        prev.map((r) =>
          r.id === requestId
            ? { ...r, status: 'Declined', reviewerNote: reviewNote }
            : r
        )
      );
      addAuditEntry('Leave Request Declined', requestId, `Rationale: ${reviewNote}`, 'warning');
      showToast('Leave Request Declined', `Request ${requestId} updated with supervisor note.`, 'amber');
    },
    [addAuditEntry, showToast]
  );

  const submitNewLeaveRequest = useCallback((payload: { operatorId: string; leaveType: LeaveRequest['leaveType']; startDate: string; endDate: string; reason: string }) => {
    const parsed = leaveInputSchema.safeParse(payload);
    if (!parsed.success || payload.operatorId !== activePersona.operatorId || payload.startDate < demoNowIso.slice(0, 10)) { showToast('Request not submitted', parsed.error?.issues[0]?.message ?? 'Choose your own future assignments.', 'rose'); return; }
    const affected = Object.values(scopes).flatMap((scope) => scope.publishedAssignments).filter((assignment) => assignment.operatorId === payload.operatorId && assignment.date >= payload.startDate && assignment.date <= payload.endDate && !['WO', 'CO'].includes(assignment.shiftCode));
    if (!affected.length || affected.some((assignment) => (getShiftEpochBounds(assignment.date, assignment.shiftCode)?.startMs ?? 0) <= Date.parse(demoNowIso))) { showToast('Request not submitted', 'Choose an unstarted working assignment in the available planning periods.', 'rose'); return; }
    if (leaveRequests.some((request) => request.operatorId === payload.operatorId && request.status !== 'Declined' && request.startDate <= payload.endDate && request.endDate >= payload.startDate)) { showToast('Request already exists', 'Review your existing request for these dates.', 'amber'); return; }
    const request: LeaveRequest = { ...parsed.data, id: `LR-${crypto.randomUUID().slice(0, 8)}`, status: 'Pending Approval', submittedAtIso: demoNowIso, affectedShift: affected[0].shiftCode, coverageImpactSummary: `${affected.length} working assignments affected. Qualified replacement availability will be validated against the current draft.` };
    setLeaveRequests((previous) => [request, ...previous]);
    showToast('Leave request submitted', 'Pending review. No assignment has changed.', 'emerald');
  }, [activePersona, demoNowIso, scopes, leaveRequests, setLeaveRequests, showToast]);

  const approveAndExecuteShiftTrade = useCallback((tradeId: string, reviewNote?: string): { ok: boolean; message: string } => {
    const trade = shiftTrades.find((item) => item.id === tradeId);
    const scope = trade && Object.values(scopes).find((item) => item.days.includes(trade.requesterDate) && item.days.includes(trade.partnerDate));
    if (!trade || !scope) return { ok: false, message: 'Both assignments must belong to one available publication period.' };
    const result = stageTrade(scope, trade, activePersona, getPolicyInputs(scope.id));
    if (!result.ok) { showToast('Trade not approved', result.error, 'rose'); return { ok: false, message: result.error }; }
    setScopes((previous) => ({ ...previous, [scope.id]: result.value }));
    setShiftTrades((previous) => previous.map((item) => item.id === tradeId ? { ...item, status: 'Approved — schedule update pending', validationPassed: true, validationNotes: [`Reviewed by ${activePersona.name}. Both sides staged; published assignments unchanged.`, reviewNote ?? 'Validate and publish the linked pair together.'] } : item));
    setSupportingPanel({ kind: 'publication_review', entityId: scope.id, widthPx: 520 });
    addAuditEntry('Trade approved; publication pending', tradeId, `Both linked assignments staged by ${activePersona.name}`);
    showToast('Approved — schedule update pending', 'Both published assignments remain unchanged until the publication gate passes.', 'cyan');
    return { ok: true, message: 'Both trade assignments staged in the draft.' };
  }, [shiftTrades, scopes, activePersona, getPolicyInputs, setScopes, setShiftTrades, addAuditEntry, showToast]);

  const respondToTrade = useCallback((tradeId: string, accept: boolean) => {
    const trade = shiftTrades.find((item) => item.id === tradeId);
    if (!trade || trade.partnerId !== activePersona.operatorId || !['Awaiting Partner', 'Changes Requested'].includes(trade.status)) { showToast('Counterpart response required', 'Only the named counterpart can accept or reject this proposal.', 'rose'); return; }
    setShiftTrades((previous) => previous.map((item) => item.id === tradeId ? { ...item, status: accept ? 'Supervisor Review' : 'Declined', validationPassed: false, validationNotes: [`${activePersona.name} ${accept ? 'accepted' : 'rejected'} the proposed terms at ${demoNowIso}.`] } : item));
    showToast(accept ? 'Counterpart accepted' : 'Trade rejected', accept ? 'The trade is ready for Shift Lead review.' : 'No assignments were changed.', 'cyan');
  }, [shiftTrades, activePersona, demoNowIso, setShiftTrades, showToast]);
  const declineShiftTrade = useCallback(
    (tradeId: string, reviewNote: string) => {
      setShiftTrades((prev) =>
        prev.map((t) =>
          t.id === tradeId
            ? {
                ...t,
                status: 'Declined',
                validationNotes: [...t.validationNotes, `Declined: ${reviewNote || 'Supervisor declined swap.'}`]
              }
            : t
        )
      );
      showToast(`Shift Trade ${tradeId} Declined`, reviewNote, 'amber');
    },
    [showToast]
  );

  const proposeShiftTrade = useCallback((payload: { requesterId: string; requesterDate: string; partnerId: string; partnerDate: string; reason: string }) => {
    const parsed = tradeInputSchema.safeParse(payload);
    if (!parsed.success || payload.requesterId !== activePersona.operatorId) { showToast('Trade not proposed', parsed.error?.issues[0]?.message ?? 'You can propose trades only for your own assignments.', 'rose'); return; }
    const scope = Object.values(scopes).find((item) => item.days.includes(payload.requesterDate) && item.days.includes(payload.partnerDate));
    const left = scope?.publishedAssignments.find((assignment) => assignment.operatorId === payload.requesterId && assignment.date === payload.requesterDate);
    const right = scope?.publishedAssignments.find((assignment) => assignment.operatorId === payload.partnerId && assignment.date === payload.partnerDate);
    if (!left || !right || !getShiftEpochBounds(left.date, left.shiftCode) || !getShiftEpochBounds(right.date, right.shiftCode) || (getShiftEpochBounds(left.date, left.shiftCode)?.startMs ?? 0) <= Date.parse(demoNowIso) || (getShiftEpochBounds(right.date, right.shiftCode)?.startMs ?? 0) <= Date.parse(demoNowIso)) { showToast('Trade not proposed', 'Choose two unstarted working assignments in the same period.', 'rose'); return; }
    const trade: ShiftTrade = { ...parsed.data, id: `TR-${crypto.randomUUID().slice(0, 8)}`, requesterShift: left.shiftCode, partnerShift: right.shiftCode, status: 'Awaiting Partner', submittedAtIso: demoNowIso, validationPassed: false, validationNotes: ['Awaiting counterpart acceptance. No assignments changed.'] };
    setShiftTrades((previous) => [trade, ...previous]);
    showToast('Trade proposed', 'Counterpart acceptance is required before Shift Lead review.', 'cyan');
  }, [scopes, activePersona, demoNowIso, setShiftTrades, showToast]);

  // Journey 4: Incidents & Handover
  const toggleIncidentStep = useCallback((incidentId: string, stepId: string) => {
    setIncidents((prev) =>
      prev.map((inc) => {
        if (inc.id !== incidentId) return inc;
        return {
          ...inc,
          status: inc.status === 'Resolved' ? 'Resolved' : 'Mitigating',
          checklist: inc.checklist.map((st) =>
            st.id === stepId
              ? {
                  ...st,
                  completed: !st.completed,
                  completedAtIso: !st.completed ? '14:04 IST' : undefined
                }
              : st
          )
        };
      })
    );
  }, []);

  const updateIncidentOutcomeNote = useCallback((incidentId: string, note: string) => {
    setIncidents((prev) =>
      prev.map((inc) => (inc.id === incidentId ? { ...inc, outcomeNote: note } : inc))
    );
  }, []);

  const resolveIncident = useCallback(
    (incidentId: string, note?: string) => {
      setIncidents((prev) =>
        prev.map((inc) =>
          inc.id === incidentId
            ? {
                ...inc,
                status: 'Resolved',
                outcomeNote:
                  note !== undefined
                    ? note
                    : inc.outcomeNote || 'Mitigation verified and telemetry nominal.',
                checklist: inc.checklist.map((c) => ({
                  ...c,
                  completed: true,
                  completedAtIso: c.completedAtIso || '14:05 IST'
                }))
              }
            : inc
        )
      );
      addAuditEntry('Incident Resolved', incidentId, note || 'Mitigation steps completed and verified.', 'info');
      showToast(`Incident ${incidentId} Resolved`, 'Logged to shift handover packet.', 'emerald');
    },
    [addAuditEntry, showToast]
  );

  const toggleIncidentCarryToHandover = useCallback((incidentId: string) => {
    setIncidents((prev) =>
      prev.map((inc) =>
        inc.id === incidentId ? { ...inc, carryToHandover: !inc.carryToHandover } : inc
      )
    );
  }, []);

  const createIncident = useCallback(
    (payload: {
      title: string;
      severity: IncidentRecord['severity'];
      zone: string;
      summary: string;
    }) => {
      const newInc: IncidentRecord = {
        id: `INC-2026-${Math.floor(850 + Math.random() * 140)}`,
        title: payload.title,
        severity: payload.severity,
        status: 'Open',
        zone: payload.zone,
        ownerOperatorId: activePersona.operatorId,
        openedAtIso: demoNowIso,
        summary: payload.summary,
        outcomeNote: '',
        carryToHandover: true,
        checklist: [
          { id: 'c-1', label: 'Isolate affected telemetry channel and verify redundancy', completed: false },
          { id: 'c-2', label: 'Notify zone lead and log mitigation parameters', completed: false },
          { id: 'c-3', label: 'Confirm return to nominal threshold before closure', completed: false }
        ]
      };
      setIncidents((prev) => [newInc, ...prev]);
      showToast(`Incident ${newInc.id} Logged`, newInc.title, 'amber');
    },
    [activePersona, showToast]
  );

  const updateHandoverSession = useCallback((patch: Partial<HandoverSession>) => {
    setHandoverSession((prev) => ({ ...prev, ...patch }));
  }, []);

  const sealShiftHandover = useCallback(
    (incomingLeadSignOffName: string) => {
      const nowIso = demoNowIso;
      setHandoverSession((prev) => ({
        ...prev,
        status: 'Signed Off & Sealed',
        outgoingSignedAtIso: nowIso,
        incomingAcknowledgedAtIso: nowIso,
        incomingLeadName: incomingLeadSignOffName || prev.incomingLeadName
      }));
      addAuditEntry(
        'Shift Handover Signed Off & Sealed',
        `${handoverSession.id} · ${handoverSession.date}`,
        `Outgoing: ${handoverSession.outgoingLeadName} -> Incoming: ${incomingLeadSignOffName || handoverSession.incomingLeadName}. Overlap window 12:30–16:30 verified.`,
        'info'
      );
      showToast(
        'Shift Handover Sealed',
        `Outgoing & incoming leads signed off for ${handoverSession.date}.`,
        'emerald'
      );
    },
    [handoverSession, addAuditEntry, showToast]
  );

  // Concurrent conflict simulation & recovery
  const triggerSimulatedConflict = useCallback(
    (scopeId?: string) => {
      const id = scopeId || activeScopeId;
      const conflict: ConcurrentEditConflict = {
        scopeId: id,
        localBaseVersion: scopes[id]?.version || 'v2.4',
        remoteVersion: 'v2.5-remote',
        remoteActor: 'Elena Petrova (Operations Coordinator)',
        remoteTimestampIso: '2026-10-25T14:02:10+05:30',
        conflictingCells: [
          {
            operatorId: 'op-marcus',
            operatorName: 'Marcus Chen',
            date: '2026-10-25',
            yourShift: '1ST',
            theirShift: '2ND'
          },
          {
            operatorId: 'op-sofia',
            operatorName: 'Sofia Reyes',
            date: '2026-10-25',
            yourShift: '3RD',
            theirShift: 'WO'
          }
        ]
      };
      setActiveConflict(conflict);
      setSupportingPanel({
        kind: 'conflict_resolution',
        entityId: id,
        widthPx: 450
      });
    },
    [activeScopeId, scopes]
  );

  const resolveConcurrentConflict = useCallback(
    (strategy: 'reload_theirs' | 'keep_mine_revalidate') => {
      if (!activeConflict) return;
      if (strategy === 'reload_theirs') {
        setActiveConflict(null);
        closeSupportingPanel();
        showToast(
          'Loaded Latest Remote Schedule',
          `Synchronized with ${activeConflict.remoteVersion} by ${activeConflict.remoteActor}.`,
          'cyan'
        );
      } else {
        setActiveConflict(null);
        runScheduleValidation(activeConflict.scopeId);
        setSupportingPanel({
          kind: 'publication_review',
          entityId: activeConflict.scopeId,
          widthPx: 430
        });
        showToast(
          'Re-applied Local Changes & Re-validated',
          'Conflicts resolved on top of remote base version.',
          'emerald'
        );
      }
    },
    [activeConflict, closeSupportingPanel, runScheduleValidation, showToast]
  );

  const updateRulesConfig = useCallback(
    (patch: Partial<SchedulingRulesConfig>) => {
      setRulesConfig((prev) => ({ ...prev, ...patch }));
      addAuditEntry(
        'Scheduling Rules Updated',
        'Global Guardrails',
        `Updated policy parameters: ${Object.keys(patch).join(', ')}`,
        'warning'
      );
      showToast('Scheduling Rules Saved', 'Active schedule scopes re-evaluated against updated guardrails.', 'emerald');
    },
    [addAuditEntry, showToast]
  );

  const updateOperatorRole = useCallback(
    (operatorId: string, newRole: PersonaId) => {
      const labelMap: Record<PersonaId, Operator['permissionRole']> = {
        shift_lead: 'Shift Lead',
        operator: 'Operator',
        admin: 'Administrator'
      };
      const mappedRole = labelMap[newRole];
      setOperators((prev) =>
        prev.map((op) => (op.id === operatorId ? { ...op, permissionRole: mappedRole } : op))
      );
      const op = operators.find((o) => o.id === operatorId);
      addAuditEntry(
        'Permission Role Updated',
        op?.name || operatorId,
        `Permission role changed to ${mappedRole}`,
        'warning'
      );
      showToast('Member Role Updated', `${op?.name} is now assigned role: ${mappedRole}.`, 'cyan');
    },
    [operators, addAuditEntry, showToast]
  );

  const sendBroadcastNotice = useCallback(
    (title: string, message: string, severity: BroadcastNotice['severity'], targetZone: string) => {
      const b: BroadcastNotice = {
        id: `BC-${Date.now().toString().slice(-4)}`,
        title,
        message,
        severity,
        targetZone,
        sentBy: `${activePersona.name} (${activePersona.jobTitle})`,
        sentAtIso: demoNowIso
      };
      setBroadcasts((prev) => [b, ...prev]);
      addAuditEntry('Floor Broadcast Dispatched', targetZone, `${title}: ${message}`, 'info');
      showToast('Broadcast Dispatched', `Sent to ${targetZone}`, 'emerald');
    },
    [activePersona, addAuditEntry, showToast]
  );

  const markNotificationRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const saveCustomViewPreset = useCallback(
    (name: string, filters: SavedViewPreset['filters']) => {
      const preset: SavedViewPreset = {
        id: `sv-${Date.now()}`,
        name,
        workspace: activeWorkspace,
        subView: activeWorkspace === 'schedule' ? scheduleSubView : undefined,
        filters
      };
      setSavedViews((prev) => [...prev, preset]);
      showToast('Saved View Preset', `"${name}" added to quick filters.`, 'emerald');
    },
    [activeWorkspace, scheduleSubView, showToast]
  );

  const toggleFavoriteView = useCallback((id: string) => {
    setFavoriteViews((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }, []);

  const toggleCellSelection = useCallback((key: string) => {
    setSelectedCellKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }, []);

  const clearCellSelection = useCallback(() => setSelectedCellKeys([]), []);

  const selectMultipleCells = useCallback((keys: string[]) => {
    setSelectedCellKeys(keys);
  }, []);

  const resetDemoState = useCallback(() => {
    if (!window.confirm('Reset all local demo assignments, requests, incidents, and preferences to the seed? This cannot be undone.')) return;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setActivePersonaId('shift_lead');
    setDemoNowIso('2026-10-25T14:00:00+05:30');
    setActiveWorkspace('overview');
    setScheduleSubView('roster_table');
    setActiveScopeId('scope-2026-10-19');
    setSelectedDate('2026-10-25');
    replaceModel(createInitialModel());










    setSandboxActive(false);
    setSandboxAssignments(null);
    setAiProposal(null);
    setActiveConflict(null);
    setUndoStack([]);
    setSelectedCellKeys([]);
    closeSupportingPanel();
    showToast(
      'Demo Reset to Baseline (v2.4)',
      'Restored Sunday 25 Oct 2026 · 14:00 IST with 18/20 floor coverage and 0 turnaround violations.',
      'cyan'
    );
  }, [closeSupportingPanel, showToast]);

  const permitLead = (action: () => void) => {
    if (activePersona.permissionRole === 'Operator') { showToast('Restricted action', 'This operation requires a Shift Lead or Administrator.', 'rose'); return; }
    action();
  };
  const permitAdmin = (action: () => void) => {
    if (activePersona.permissionRole !== 'Administrator') { showToast('Restricted action', 'Administrator permission is required.', 'rose'); return; }
    action();
  };  const value: ShiftSyncContextValue = {
    activePersonaId,
    activePersona,
    setActivePersonaId,
    demoNowIso,
    setDemoNowIso,
    activeWorkspace,
    setActiveWorkspace,
    scheduleSubView,
    setScheduleSubView,
    leavesSubView,
    setLeavesSubView,
    incidentsSubView,
    setIncidentsSubView,
    adminSubView,
    setAdminSubView,
    activeScopeId,
    setActiveScopeId,
    selectedDate,
    setSelectedDate,
    activeScope,
    publishedCurrentScope,
    scopes,
    validationResults,
    activeValidation,
    getPolicyInputs, acknowledgeAdvisories, saveState, storageWarning, retryLocalSave, respondToTrade, editAIProposal, revalidateAIProposal,
    density,
    setDensity,
    highContrast,
    setHighContrast,
    sidebarCollapsed,
    setSidebarCollapsed,
    supportingPanel,
    setSupportingPanel,
    closeSupportingPanel,
    commandPaletteOpen,
    setCommandPaletteOpen,
    operators,
    coverageGaps,
    leaveRequests,
    shiftTrades,
    incidents,
    handoverSession,
    rulesConfig,
    auditLog,
    broadcasts,
    fleetUnits,
    missions,
    notifications,
    savedViews,
    favoriteViews,
    toggleFavoriteView,
    selectedCellKeys,
    toggleCellSelection,
    clearCellSelection,
    selectMultipleCells,
    sandboxActive,
    sandboxAssignments,
    enterWhatIfSandbox: (...args) => permitLead(() => enterWhatIfSandbox(...args)),
    discardWhatIfSandbox,
    applySandboxToDraft,
    updateSandboxAssignment,
    aiProposal,
    generateAIAutopilotProposal,
    applyAIProposalToDraft,
    discardAIProposal,
    updateAssignment,
    bulkUpdateAssignments,
    assignReplacementToGap,
    runScheduleValidation,
    publishScheduleScope,
    discardDraftChanges: (...args) => permitLead(() => discardDraftChanges(...args)),
    undoStack,
    undoLastScheduleChange: (...args) => permitLead(() => undoLastScheduleChange(...args)),
    activeConflict,
    triggerSimulatedConflict: (...args) => permitLead(() => triggerSimulatedConflict(...args)),
    resolveConcurrentConflict: (...args) => permitLead(() => resolveConcurrentConflict(...args)),
    approveLeaveRequest,
    declineLeaveRequest: (...args) => permitLead(() => declineLeaveRequest(...args)),
    submitNewLeaveRequest,
    approveAndExecuteShiftTrade,
    declineShiftTrade: (...args) => permitLead(() => declineShiftTrade(...args)),
    proposeShiftTrade,
    toggleIncidentStep: (...args) => permitLead(() => toggleIncidentStep(...args)),
    updateIncidentOutcomeNote: (...args) => permitLead(() => updateIncidentOutcomeNote(...args)),
    resolveIncident: (...args) => permitLead(() => resolveIncident(...args)),
    toggleIncidentCarryToHandover: (...args) => permitLead(() => toggleIncidentCarryToHandover(...args)),
    createIncident,
    updateHandoverSession: (...args) => permitLead(() => updateHandoverSession(...args)),
    sealShiftHandover: (...args) => permitLead(() => sealShiftHandover(...args)),
    updateRulesConfig: (...args) => permitAdmin(() => updateRulesConfig(...args)),
    updateOperatorRole: (...args) => permitAdmin(() => updateOperatorRole(...args)),
    sendBroadcastNotice: (...args) => permitLead(() => sendBroadcastNotice(...args)),
    markNotificationRead,
    markAllNotificationsRead,
    saveCustomViewPreset,
    resetDemoState,
    toastMessage,
    dismissToast,
    showToast
  };

  return <ShiftSyncContext.Provider value={value}>{children}</ShiftSyncContext.Provider>;
};

export const useShiftSync = () => {
  const ctx = useContext(ShiftSyncContext);
  if (!ctx) throw new Error('useShiftSync must be used within a ShiftSyncProvider');
  return ctx;
};
