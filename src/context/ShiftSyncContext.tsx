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

  // Core Data State
  const [operators, setOperators] = useState<Operator[]>(INITIAL_OPERATORS);
  const [scopes, setScopes] = useState<Record<string, ScheduleScope>>(INITIAL_SCOPES);
  const [coverageGaps, setCoverageGaps] = useState<CoverageGap[]>(INITIAL_COVERAGE_GAPS);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>(INITIAL_LEAVE_REQUESTS);
  const [shiftTrades, setShiftTrades] = useState<ShiftTrade[]>(INITIAL_SHIFT_TRADES);
  const [incidents, setIncidents] = useState<IncidentRecord[]>(INITIAL_INCIDENTS);
  const [handoverSession, setHandoverSession] = useState<HandoverSession>(INITIAL_HANDOVER_SESSION);
  const [rulesConfig, setRulesConfig] = useState<SchedulingRulesConfig>(INITIAL_RULES_CONFIG);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>(INITIAL_AUDIT_LOG);
  const [broadcasts, setBroadcasts] = useState<BroadcastNotice[]>(INITIAL_BROADCASTS);
  const [fleetUnits] = useState<FleetUnit[]>(INITIAL_FLEET_UNITS);
  const [missions] = useState<MissionRecord[]>(INITIAL_MISSIONS);
  const [notifications, setNotifications] = useState<AppNotification[]>(INITIAL_NOTIFICATIONS);
  const [savedViews, setSavedViews] = useState<SavedViewPreset[]>(INITIAL_SAVED_VIEWS);
  const [favoriteViews, setFavoriteViews] = useState<string[]>(['sv-1', 'sv-2']);

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
    const s = scopes['scope-2026-10-19'];
    return {
      ...s,
      assignments: s.publishedAssignments
    };
  }, [scopes]);

  // Compute validation results across scopes
  const validationResults = useMemo(() => {
    const out: Record<string, ValidationResult> = {};
    Object.values(scopes).forEach((sc) => {
      out[sc.id] = validateScheduleScope(sc, operators, rulesConfig, BOUNDARY_ASSIGNMENTS);
    });
    return out;
  }, [scopes, operators, rulesConfig]);

  const activeValidation = useMemo(
    () => validationResults[activeScope.id] || validateScheduleScope(activeScope, operators, rulesConfig, BOUNDARY_ASSIGNMENTS),
    [validationResults, activeScope, operators, rulesConfig]
  );

  const closeSupportingPanel = useCallback(() => {
    setSupportingPanel((prev) => ({ ...prev, kind: null, entityId: undefined, secondaryId: undefined }));
  }, []);

  const addAuditEntry = useCallback(
    (action: string, scopeLabel: string, detail: string, severity: AuditLogEntry['severity'] = 'info') => {
      const entry: AuditLogEntry = {
        id: `AUD-${Date.now().toString().slice(-4)}`,
        timestampIso: new Date().toISOString(),
        actorName: activePersona.name,
        actorRole: activePersona.permissionRole,
        action,
        scope: scopeLabel,
        detail,
        severity
      };
      setAuditLog((prev) => [entry, ...prev]);
    },
    [activePersona]
  );

  // Update a single assignment in a scope (creates/updates draft and invalidates validation)
  const updateAssignment = useCallback(
    (scopeId: string, operatorId: string, date: string, shiftCode: ShiftCode, note?: string) => {
      setScopes((prev) => {
        const target = prev[scopeId];
        if (!target) return prev;

        // Push to undo stack
        setUndoStack((u) => [
          {
            id: `undo-${Date.now()}`,
            label: `Change ${operatorId} on ${date} to ${shiftCode}`,
            scopeId,
            previousAssignments: target.assignments.map((a) => ({ ...a })),
            previousStatus: target.status
          },
          ...u.slice(0, 14)
        ]);

        const nextAssignments = target.assignments.map((a) =>
          a.operatorId === operatorId && a.date === date
            ? { ...a, shiftCode, isDraftChanged: true, note: note ?? a.note }
            : a
        );

        // If assignment didn't exist yet for that date, add it
        const exists = target.assignments.some((a) => a.operatorId === operatorId && a.date === date);
        if (!exists) {
          const op = operators.find((o) => o.id === operatorId);
          nextAssignments.push({
            operatorId,
            date,
            shiftCode,
            zone: op?.zone || 'Sector A · Core Ops',
            locked: false,
            isDraftChanged: true,
            note
          });
        }

        return {
          ...prev,
          [scopeId]: {
            ...target,
            status: 'Draft',
            assignments: nextAssignments
          }
        };
      });

      const op = operators.find((o) => o.id === operatorId);
      showToast(
        `Draft updated · ${op?.name || operatorId}`,
        `Assigned ${SHIFT_CATALOG[shiftCode].shortLabel} (${SHIFT_CATALOG[shiftCode].timeLabel}) on ${date}. Run Validate before publishing.`,
        'cyan'
      );
    },
    [operators, showToast]
  );

  const bulkUpdateAssignments = useCallback(
    (scopeId: string, cellKeys: string[], shiftCode: ShiftCode) => {
      if (cellKeys.length === 0) return;
      setScopes((prev) => {
        const target = prev[scopeId];
        if (!target) return prev;

        setUndoStack((u) => [
          {
            id: `undo-${Date.now()}`,
            label: `Bulk update ${cellKeys.length} cells to ${shiftCode}`,
            scopeId,
            previousAssignments: target.assignments.map((a) => ({ ...a })),
            previousStatus: target.status
          },
          ...u.slice(0, 14)
        ]);

        const keySet = new Set(cellKeys);
        const nextAssignments = target.assignments.map((a) => {
          const k = `${a.operatorId}__${a.date}`;
          if (keySet.has(k) && !a.locked) {
            return { ...a, shiftCode, isDraftChanged: true };
          }
          return a;
        });

        return {
          ...prev,
          [scopeId]: {
            ...target,
            status: 'Draft',
            assignments: nextAssignments
          }
        };
      });

      setSelectedCellKeys([]);
      showToast(
        `Updated ${cellKeys.length} shift assignments`,
        `Applied ${SHIFT_CATALOG[shiftCode].label} to selected roster cells in draft.`,
        'cyan'
      );
    },
    [showToast]
  );

  // Journey 1: Assign replacement candidate to an open coverage gap
  const assignReplacementToGap = useCallback(
    (gapId: string, operatorId: string) => {
      const gap = coverageGaps.find((g) => g.id === gapId);
      const op = operators.find((o) => o.id === operatorId);
      if (!gap || !op) return;

      // Determine which scope contains gap.date
      const targetScopeId =
        Object.values(scopes).find((s) => s.days.includes(gap.date))?.id || activeScopeId;

      setActiveScopeId(targetScopeId);
      setSelectedDate(gap.date);

      updateAssignment(
        targetScopeId,
        operatorId,
        gap.date,
        gap.shiftCode,
        `Assigned to resolve ${gap.id} (${gap.zone})`
      );

      setCoverageGaps((prev) =>
        prev.map((g) => (g.id === gapId ? { ...g, assignedReplacementId: operatorId } : g))
      );

      // If this gap was created by an approved leave request, mark its replacement operator
      if (gap.sourceLeaveRequestId) {
        setLeaveRequests((prev) =>
          prev.map((lr) =>
            lr.id === gap.sourceLeaveRequestId
              ? { ...lr, replacementOperatorId: operatorId }
              : lr
          )
        );
      }

      addAuditEntry(
        'Coverage Replacement Staged',
        `${gap.date} · ${gap.shiftCode}`,
        `Staged ${op.name} (${op.badgeCode}) for ${gap.roleRequired} in ${gap.zone}. Ready for validation & publication.`,
        'info'
      );

      // Switch supporting panel to Publication Review so user can immediately validate & publish
      setSupportingPanel({
        kind: 'publication_review',
        entityId: targetScopeId,
        widthPx: 430
      });
    },
    [coverageGaps, operators, scopes, activeScopeId, updateAssignment, addAuditEntry]
  );

  const runScheduleValidation = useCallback(
    (scopeId?: string) => {
      const id = scopeId || activeScopeId;
      const target = scopes[id];
      const res = validateScheduleScope(target, operators, rulesConfig, BOUNDARY_ASSIGNMENTS);

      setScopes((prev) => {
        const sc = prev[id];
        if (!sc) return prev;
        const nextStatus =
          sc.status === 'Published' && sc.assignments.every((a) => !a.isDraftChanged)
            ? 'Published'
            : res.canPublish
            ? 'Validated'
            : 'Draft';
        return {
          ...prev,
          [id]: {
            ...sc,
            status: nextStatus
          }
        };
      });

      showToast(
        res.canPublish ? 'Validation Passed · Ready to Publish' : 'Validation Found Blocking Issues',
        `${res.blockingCount} blocking · ${res.advisoryCount} advisory across ${target.label}`,
        res.canPublish ? 'emerald' : 'rose'
      );
      return res;
    },
    [activeScopeId, scopes, operators, rulesConfig, showToast]
  );

  const publishScheduleScope = useCallback(
    (scopeId: string, overrideRationale?: string): { ok: boolean; error?: string } => {
      const target = scopes[scopeId];
      if (!target) return { ok: false, error: 'Schedule scope not found.' };

      const val = validateScheduleScope(target, operators, rulesConfig, BOUNDARY_ASSIGNMENTS);
      if (val.blockingCount > 0 && !overrideRationale?.trim()) {
        return {
          ok: false,
          error: 'Blocking validation rules failed. Resolve blocking issues or provide supervisor override rationale.'
        };
      }

      const nextMajorMinor = target.version.replace('-draft', '');
      const parts = nextMajorMinor.replace('v', '').split('.').map(Number);
      const nextVersion =
        target.status === 'Published'
          ? `v${parts[0]}.${(parts[1] || 0) + 1}`
          : target.version.includes('-draft')
          ? `v${parts[0]}.${(parts[1] || 0) + 1}`
          : `v${parts[0]}.${(parts[1] || 0) + 1}`;

      const cleanAssignments = target.assignments.map((a) => ({
        ...a,
        isDraftChanged: false
      }));

      setScopes((prev) => ({
        ...prev,
        [scopeId]: {
          ...target,
          version: nextVersion,
          status: 'Published',
          publishedAtIso: new Date().toISOString(),
          publishedBy: `${activePersona.name} (${activePersona.jobTitle})`,
          assignments: cleanAssignments,
          publishedAssignments: cleanAssignments.map((a) => ({ ...a }))
        }
      }));

      // Any coverage gap in this scope with an assignedReplacementId is now fully resolved
      setCoverageGaps((prev) =>
        prev.filter((g) => !(target.days.includes(g.date) && g.assignedReplacementId))
      );

      // Any Leave Request in 'Approved — schedule update pending' in this scope with replacement now becomes 'Approved & Published'
      setLeaveRequests((prev) =>
        prev.map((lr) => {
          if (
            lr.status === 'Approved — schedule update pending' &&
            target.days.includes(lr.startDate)
          ) {
            return { ...lr, status: 'Approved & Published' };
          }
          return lr;
        })
      );

      addAuditEntry(
        `Schedule Published (${nextVersion})`,
        target.label,
        overrideRationale
          ? `Published with supervisor rationale: "${overrideRationale}". Notifications dispatched.`
          : `Published clean validated roster (${val.advisoryCount} advisory notes). Affected operators notified.`,
        overrideRationale ? 'warning' : 'info'
      );

      setNotifications((prev) => [
        {
          id: `notif-${Date.now()}`,
          title: `Roster ${nextVersion} Published (${target.label})`,
          body: `Published by ${activePersona.name}. Live Floor Radar and operator shifts are now synchronized.`,
          timestampIso: new Date().toISOString(),
          read: false,
          category: 'publication',
          linkWorkspace: 'schedule'
        },
        ...prev
      ]);

      showToast(
        `Published ${nextVersion} · ${target.label}`,
        'All shift changes are now live on Floor Radar and Operator Dossiers.',
        'emerald'
      );

      return { ok: true };
    },
    [scopes, operators, rulesConfig, activePersona, addAuditEntry, showToast]
  );

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
    setScopes((prev) => ({
      ...prev,
      [activeScopeId]: {
        ...prev[activeScopeId],
        status: 'Draft',
        assignments: sandboxAssignments.map((a) => ({ ...a }))
      }
    }));
    setSandboxActive(false);
    setSandboxAssignments(null);
    showToast(
      'Sandbox promoted to Draft',
      'Review and validate changes before publishing.',
      'emerald'
    );
  }, [sandboxAssignments, activeScopeId, showToast]);

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

  // AI Autopilot Proposal (defaults to Next Week 26 Oct–1 Nov 2026 in isolated proposal state)
  const generateAIAutopilotProposal = useCallback(
    (targetScopeId: string = 'scope-2026-10-26') => {
      setActiveScopeId(targetScopeId);
      setSelectedDate('2026-10-26');
      const proposal = buildDefaultAIProposal();
      setAiProposal(proposal);
      setSupportingPanel({
        kind: 'ai_proposal_review',
        entityId: proposal.id,
        widthPx: 450
      });
      showToast(
        'Autonomous Week Autopilot Ready',
        `Generated isolated proposal for 26 Oct–1 Nov 2026 (${proposal.proposedChanges.length} cell diffs, 0 turnaround violations).`,
        'cyan'
      );
    },
    [showToast]
  );

  const applyAIProposalToDraft = useCallback(
    (selectedChangeKeys?: string[]) => {
      if (!aiProposal) return;
      const targetId = aiProposal.scopeId;
      const allowedSet = selectedChangeKeys ? new Set(selectedChangeKeys) : null;

      setScopes((prev) => {
        const target = prev[targetId];
        if (!target) return prev;

        const changeMap = new Map<string, ShiftCode>();
        aiProposal.proposedChanges.forEach((ch) => {
          const k = `${ch.operatorId}__${ch.date}`;
          if (!allowedSet || allowedSet.has(k)) {
            changeMap.set(k, ch.toShift);
          }
        });

        const nextAssignments = target.assignments.map((a) => {
          const k = `${a.operatorId}__${a.date}`;
          const nextShift = changeMap.get(k);
          if (nextShift) {
            return {
              ...a,
              shiftCode: nextShift,
              isDraftChanged: true,
              note: 'Applied via Autonomous Week Autopilot'
            };
          }
          return a;
        });

        return {
          ...prev,
          [targetId]: {
            ...target,
            status: 'Draft',
            assignments: nextAssignments
          }
        };
      });

      addAuditEntry(
        'AI Autopilot Proposal Applied to Draft',
        '26 Oct–1 Nov 2026',
        `Applied ${selectedChangeKeys ? selectedChangeKeys.length : aiProposal.proposedChanges.length} proposed shift updates into Draft v3.0-draft.`,
        'info'
      );

      setAiProposal(null);
      setSupportingPanel({
        kind: 'publication_review',
        entityId: targetId,
        widthPx: 430
      });
      showToast(
        'AI Proposal applied to Draft',
        'Validate and publish when ready.',
        'emerald'
      );
    },
    [aiProposal, addAuditEntry, showToast]
  );

  const discardAIProposal = useCallback(() => {
    setAiProposal(null);
    closeSupportingPanel();
    showToast('AI Proposal discarded', 'Current draft and published schedules remain unchanged.', 'amber');
  }, [closeSupportingPanel, showToast]);

  // Journey 2: Approve Leave Request -> transitions to 'Approved — schedule update pending', stages WO on draft, opens replacement planning
  const approveLeaveRequest = useCallback(
    (requestId: string, reviewNote: string) => {
      const req = leaveRequests.find((r) => r.id === requestId);
      if (!req) return;
      const op = operators.find((o) => o.id === req.operatorId);

      setLeaveRequests((prev) =>
        prev.map((r) =>
          r.id === requestId
            ? {
                ...r,
                status: 'Approved — schedule update pending',
                reviewerNote: reviewNote || 'Approved by Shift Lead. Replacement coverage staged.'
              }
            : r
        )
      );

      // Find scope for req.startDate (e.g., 2026-10-27 is in scope-2026-10-26)
      const targetScope =
        Object.values(scopes).find((s) => s.days.includes(req.startDate)) ||
        scopes['scope-2026-10-26'];

      // Mark operator's shift on that date as WO in draft and create a coverage gap for replacement
      updateAssignment(
        targetScope.id,
        req.operatorId,
        req.startDate,
        'WO',
        `Approved Leave (${req.id})`
      );

      const newGapId = `GAP-LR-${req.id}`;
      const newGap: CoverageGap = {
        id: newGapId,
        date: req.startDate,
        shiftCode: req.affectedShift,
        zone: op?.zone || 'Sector A · Core Ops',
        roleRequired: op?.jobTitle || 'Systems Operator',
        requiredCert: 'L2-Grid',
        preferredTarget: 9,
        hardMinimum: 8,
        currentStaffed: 8,
        severity: 'advisory',
        reason: `Approved leave ${req.id} for ${op?.name || req.operatorId} on ${req.startDate}. Select replacement before publishing.`,
        sourceLeaveRequestId: req.id,
        candidates: [
          {
            operatorId: 'op-sofia',
            restHoursBefore: 36,
            projectedWeeklyHours: 45,
            certMatch: true,
            availabilityStatus: 'Available (currently on WO)',
            overtimeImpactHours: 0,
            fairnessDelta: '+0.8%',
            ineligibleReason: null
          },
          {
            operatorId: 'op-zoya',
            restHoursBefore: 22,
            projectedWeeklyHours: 44,
            certMatch: true,
            availabilityStatus: 'Available · Cross-zone',
            overtimeImpactHours: 0,
            fairnessDelta: '+0.4%',
            ineligibleReason: null
          }
        ]
      };

      setCoverageGaps((prev) => [newGap, ...prev.filter((g) => g.id !== newGapId)]);
      setActiveScopeId(targetScope.id);
      setSelectedDate(req.startDate);

      addAuditEntry(
        'Leave Request Approved (Pending Schedule Update)',
        `${req.id} · ${op?.name}`,
        `Approved ${req.leaveType} on ${req.startDate}. Coverage gap ${newGapId} created for replacement assignment.`,
        'info'
      );

      // Open replacement candidate selector in Supporting Panel
      setSupportingPanel({
        kind: 'coverage_gap',
        entityId: newGapId,
        widthPx: 440
      });

      showToast(
        `Leave Approved · Schedule Update Pending`,
        `Select a replacement operator for ${op?.name}'s ${req.startDate} shift to publish the updated roster.`,
        'emerald'
      );
    },
    [leaveRequests, operators, scopes, updateAssignment, addAuditEntry, showToast]
  );

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

  const submitNewLeaveRequest = useCallback(
    (payload: {
      operatorId: string;
      leaveType: LeaveRequest['leaveType'];
      startDate: string;
      endDate: string;
      reason: string;
    }) => {
      const newReq: LeaveRequest = {
        id: `LR-2026-${Math.floor(110 + Math.random() * 890)}`,
        operatorId: payload.operatorId,
        leaveType: payload.leaveType,
        startDate: payload.startDate,
        endDate: payload.endDate,
        reason: payload.reason,
        status: 'Pending Approval',
        submittedAtIso: new Date().toISOString(),
        affectedShift: '1ST',
        coverageImpactSummary: 'Pre-validated: 2 qualified replacement operators available with >=11h rest.'
      };
      setLeaveRequests((prev) => [newReq, ...prev]);
      showToast('Leave Request Submitted', `${newReq.id} routed to Shift Lead for approval.`, 'emerald');
    },
    [showToast]
  );

  // Atomic Shift Trade Lifecycle
  const approveAndExecuteShiftTrade = useCallback(
    (tradeId: string, reviewNote?: string): { ok: boolean; message: string } => {
      const trade = shiftTrades.find((t) => t.id === tradeId);
      if (!trade) return { ok: false, message: 'Trade record not found.' };

      const targetScope =
        Object.values(scopes).find((s) => s.days.includes(trade.requesterDate)) ||
        scopes['scope-2026-10-26'];

      // Perform atomic swap on target scope assignments
      setScopes((prev) => {
        const sc = prev[targetScope.id];
        if (!sc) return prev;

        const nextAssignments = sc.assignments.map((a) => {
          if (a.operatorId === trade.requesterId && a.date === trade.requesterDate) {
            return {
              ...a,
              shiftCode: trade.partnerShift,
              isDraftChanged: true,
              note: `Atomic Trade ${trade.id} with ${trade.partnerId}`
            };
          }
          if (a.operatorId === trade.partnerId && a.date === trade.partnerDate) {
            return {
              ...a,
              shiftCode: trade.requesterShift,
              isDraftChanged: true,
              note: `Atomic Trade ${trade.id} with ${trade.requesterId}`
            };
          }
          return a;
        });

        // Validate resulting schedule immediately
        const tempScope: ScheduleScope = { ...sc, assignments: nextAssignments };
        const val = validateScheduleScope(tempScope, operators, rulesConfig, BOUNDARY_ASSIGNMENTS);

        if (val.blockingCount > 0) {
          return prev; // atomic abort if blocking error
        }

        return {
          ...prev,
          [targetScope.id]: {
            ...sc,
            status: 'Validated',
            assignments: nextAssignments
          }
        };
      });

      setShiftTrades((prev) =>
        prev.map((t) =>
          t.id === tradeId
            ? {
                ...t,
                status: 'Approved & Applied',
                validationPassed: true,
                validationNotes: [
                  ...t.validationNotes,
                  reviewNote
                    ? `Supervisor sign-off: ${reviewNote}`
                    : 'Supervisor atomic execution complete — zero rest or certification violations.'
                ]
              }
            : t
        )
      );

      const reqOp = operators.find((o) => o.id === trade.requesterId);
      const partOp = operators.find((o) => o.id === trade.partnerId);

      addAuditEntry(
        'Atomic Shift Trade Approved & Applied',
        `${trade.id} · ${trade.requesterDate}`,
        `Swapped ${reqOp?.name} (${trade.requesterShift} -> ${trade.partnerShift}) and ${partOp?.name} (${trade.partnerShift} -> ${trade.requesterShift}).`,
        'info'
      );

      showToast(
        `Shift Trade ${trade.id} Applied Atomically`,
        `${reqOp?.name} and ${partOp?.name} shifts swapped on ${trade.requesterDate} with 0 rest violations.`,
        'emerald'
      );

      return { ok: true, message: 'Trade applied atomically.' };
    },
    [shiftTrades, scopes, operators, rulesConfig, addAuditEntry, showToast]
  );

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

  const proposeShiftTrade = useCallback(
    (payload: {
      requesterId: string;
      requesterDate: string;
      partnerId: string;
      partnerDate: string;
      reason: string;
    }) => {
      const newTrade: ShiftTrade = {
        id: `TR-2026-${Math.floor(310 + Math.random() * 600)}`,
        requesterId: payload.requesterId,
        requesterDate: payload.requesterDate,
        requesterShift: '1ST',
        partnerId: payload.partnerId,
        partnerDate: payload.partnerDate,
        partnerShift: '2ND',
        status: 'Supervisor Review',
        reason: payload.reason,
        submittedAtIso: new Date().toISOString(),
        validationPassed: true,
        validationNotes: [
          'Rest window check passed (>=11h before and after swap).',
          'Zone certification parity verified.'
        ]
      };
      setShiftTrades((prev) => [newTrade, ...prev]);
      showToast('Shift Trade Proposed', `${newTrade.id} queued for Supervisor Review.`, 'cyan');
    },
    [showToast]
  );

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
        openedAtIso: new Date().toISOString(),
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
      const nowIso = new Date().toISOString();
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
        sentAtIso: new Date().toISOString()
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
    setOperators(INITIAL_OPERATORS);
    setScopes(INITIAL_SCOPES);
    setCoverageGaps(INITIAL_COVERAGE_GAPS);
    setLeaveRequests(INITIAL_LEAVE_REQUESTS);
    setShiftTrades(INITIAL_SHIFT_TRADES);
    setIncidents(INITIAL_INCIDENTS);
    setHandoverSession(INITIAL_HANDOVER_SESSION);
    setRulesConfig(INITIAL_RULES_CONFIG);
    setAuditLog(INITIAL_AUDIT_LOG);
    setBroadcasts(INITIAL_BROADCASTS);
    setNotifications(INITIAL_NOTIFICATIONS);
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

  const value: ShiftSyncContextValue = {
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
    enterWhatIfSandbox,
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
    discardDraftChanges,
    undoStack,
    undoLastScheduleChange,
    activeConflict,
    triggerSimulatedConflict,
    resolveConcurrentConflict,
    approveLeaveRequest,
    declineLeaveRequest,
    submitNewLeaveRequest,
    approveAndExecuteShiftTrade,
    declineShiftTrade,
    proposeShiftTrade,
    toggleIncidentStep,
    updateIncidentOutcomeNote,
    resolveIncident,
    toggleIncidentCarryToHandover,
    createIncident,
    updateHandoverSession,
    sealShiftHandover,
    updateRulesConfig,
    updateOperatorRole,
    sendBroadcastNotice,
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
