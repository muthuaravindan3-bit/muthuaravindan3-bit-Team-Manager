import { useChangeReview } from '../hooks/useChangeReview';
import { ChangeReview } from './ui/ChangeReview';
import React, { useState, useEffect, useMemo } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
} from 'firebase/firestore';
import { db, OperationType } from '../firebase';
import { useAuth } from '../AuthContext';
import { UserProfile, BreakLog, GlobalSettings } from '../types';
import {
  Users,
  Coffee,
  Clock,
  MapPin,
  Search,
  Navigation as NavIcon,
  Square,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  Radio,
} from 'lucide-react';
import { safeFormat } from '../utils/dateUtils';
import { QuickDrawerType } from './Navigation';
import LiveMap from './LiveMap';

interface OperationsProps {
  subTab?: 'directory' | 'tracker' | 'breaks';
  onSelectSubTab?: (subTab: 'directory' | 'tracker' | 'breaks') => void;
  onOpenQuickDrawer?: (drawer: QuickDrawerType) => void;
  externalSearchQuery?: string;
  onChangeExternalSearchQuery?: (q: string) => void;
  externalOnlyOnBreak?: boolean;
}

const formatLiveStopwatch = (startTime?: number | null, nowTs: number = Date.now()) => {
  if (!startTime) return '00:00';
  const elapsedSecs = Math.max(0, Math.floor((nowTs - startTime) / 1000));
  const mins = Math.floor(elapsedSecs / 60);
  const secs = elapsedSecs % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

export default function Operations({
  subTab = 'directory',
  onSelectSubTab,
  onOpenQuickDrawer,
  externalSearchQuery,
  onChangeExternalSearchQuery,
  externalOnlyOnBreak = false,
}: OperationsProps) {
  const { user, profile, isAdmin, loading: authLoading } = useAuth();
  const changeReview = useChangeReview();
  const handleFirestoreError = changeReview.reportError;
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [breakLogs, setBreakLogs] = useState<BreakLog[]>([]);
  const [settings, setSettings] = useState<GlobalSettings>({
    maxBreakDurationMinutes: 30,
    defaultHourlyRate: 25,
  });
  const [internalSearchQuery, setInternalSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const [selectedMapUserId, setSelectedMapUserId] = useState<string | null>(
    null
  );
  const [endingBreakUid, setEndingBreakUid] = useState<string | null>(null);

  const searchQuery = externalSearchQuery ?? internalSearchQuery;
  const setSearchQuery = onChangeExternalSearchQuery ?? setInternalSearchQuery;

  // Live 1-second stopwatch tick for active break tracking
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (authLoading || !user) return;

    const unsubUsers = onSnapshot(
      collection(db, 'users'),
      (snap) => {
        setUsers(
          snap.docs.map((d) => ({ uid: d.id, ...d.data() } as UserProfile))
        );
        setLoading(false);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'users')
    );

    const unsubBreaks = onSnapshot(
      collection(db, 'breakLogs'),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as BreakLog))
          .sort(
            (a, b) => (Number(b.startTime) || 0) - (Number(a.startTime) || 0)
          );
        setBreakLogs(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'breakLogs')
    );

    const unsubSettings = onSnapshot(
      doc(db, 'settings', 'global'),
      (docSnap) => {
        if (docSnap.exists()) {
          setSettings(docSnap.data() as GlobalSettings);
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'settings/global')
    );

    return () => {
      unsubUsers();
      unsubBreaks();
      unsubSettings();
    };
  }, [user, isAdmin, authLoading]);

  const activeBreakUsers = useMemo(
    () => users.filter((u) => Boolean(u.isBreakActive)),
    [users]
  );

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (externalOnlyOnBreak && !u.isBreakActive) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        (u.displayName || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.employeeId || '').toLowerCase().includes(q)
      );
    });
  }, [users, searchQuery, externalOnlyOnBreak]);

  const filteredBreakLogs = useMemo(() => {
    return breakLogs.filter((log) => {
      if (!isAdmin && log.userId !== user?.uid && log.endTime) return false;
      if (externalOnlyOnBreak && log.endTime) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const memberName =
        log.userName ||
        users.find((u) => u.uid === log.userId)?.displayName ||
        '';
      return memberName.toLowerCase().includes(q);
    });
  }, [breakLogs, searchQuery, externalOnlyOnBreak, users, isAdmin, user?.uid]);

  const handleEndMemberBreak = async (targetMember: UserProfile) => {
    if (!user || endingBreakUid) return;
    if (!isAdmin && targetMember.uid !== user.uid) return;

    setEndingBreakUid(targetMember.uid);
    try {
      const endTs = Date.now();
      const startTs = targetMember.breakStartTime || endTs;
      const durationMinutes = Math.max(1, Math.round((endTs - startTs) / 60000));

      if (targetMember.activeBreakLogId) {
        await updateDoc(doc(db, 'breakLogs', targetMember.activeBreakLogId), {
          endTime: endTs,
          duration: durationMinutes,
        });
      }

      await updateDoc(doc(db, 'users', targetMember.uid), {
        isBreakActive: false,
        activeBreakLogId: null,
        breakStartTime: null,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${targetMember.uid}`);
    } finally {
      setEndingBreakUid(null);
    }
  };

  const handleFocusMemberOnTracker = (uid: string) => {
    setSelectedMapUserId(uid);
    onSelectSubTab?.('tracker');
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-24 rounded-xl bg-surface-2 border border-main-border animate-pulse" />
        <div className="h-64 rounded-xl bg-surface-2 border border-main-border animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ChangeReview state={changeReview} />
      {/* Header & Quick Break Trigger */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-main-text tracking-tight">
            {subTab === 'directory'
              ? 'Live Floor Directory'
              : subTab === 'tracker'
              ? 'Live Break Tracker & Location map'
              : 'Break Compliance Logs'}
          </h1>
          <p className="text-sm text-main-text-muted mt-0.5">
            {subTab === 'directory'
              ? 'Real-time team availability, local timezones, and active break status.'
              : subTab === 'tracker'
              ? 'Monitor active rest breaks with live ticking timers, overtime alerts, and real-time GPS trails.'
              : 'Historical rest and meal break durations across the workspace.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {subTab !== 'tracker' && (
            <button
              type="button"
              onClick={() => onSelectSubTab?.('tracker')}
              className="btn-secondary flex items-center gap-2"
            >
              <Radio
                className={`w-4 h-4 ${
                  activeBreakUsers.length > 0
                    ? 'text-primary animate-pulse'
                    : 'text-main-text-muted'
                }`}
              />
              <span>Live Break Radar ({activeBreakUsers.length})</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onOpenQuickDrawer?.('break')}
            className="btn-primary flex items-center gap-2"
          >
            <Coffee className="w-4 h-4" />
            <span>
              {profile?.isBreakActive
                ? 'Manage Active Break'
                : 'Start / Manage Break'}
            </span>
          </button>
        </div>
      </div>

      {/* Summary Stat Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-surface-2 border border-main-border flex items-center justify-between">
          <div>
            <p className="text-xs text-main-text-muted">Total Team Members</p>
            <p className="text-2xl font-mono font-bold tabular-nums text-main-text mt-1">
              {users.length}
            </p>
          </div>
          <Users className="w-5 h-5 text-primary" />
        </div>

        <button
          type="button"
          onClick={() => onSelectSubTab?.('tracker')}
          className="p-4 rounded-xl bg-surface-2 border border-main-border hover:border-primary/50 flex items-center justify-between text-left transition-colors cursor-pointer"
        >
          <div>
            <p className="text-xs text-main-text-muted flex items-center gap-1.5">
              <span>Currently on Break</span>
              {activeBreakUsers.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              )}
            </p>
            <p className="text-2xl font-mono font-bold tabular-nums text-primary mt-1">
              {activeBreakUsers.length}
            </p>
          </div>
          <Coffee className="w-5 h-5 text-primary" />
        </button>

        <div className="p-4 rounded-xl bg-surface-2 border border-main-border flex items-center justify-between">
          <div>
            <p className="text-xs text-main-text-muted">Break Allowance</p>
            <p className="text-2xl font-mono font-bold tabular-nums text-main-text mt-1">
              {settings.maxBreakDurationMinutes} min
            </p>
          </div>
          <Clock className="w-5 h-5 text-primary" />
        </div>
      </div>

      {/* ====================================================================
          LIVE BREAK TRACKER & GPS RADAR VIEW (Shown on 'tracker' sub-tab OR when 'Currently On Break Only' filter is active)
         ==================================================================== */}
      {(subTab === 'tracker' || externalOnlyOnBreak) && (
        <div className="space-y-6">
          {/* Active Break Stopwatch Cards */}
          <div className="bg-surface-2 border border-main-border rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-main-border pb-3">
              <div className="flex items-center gap-2">
                <Radio
                  className={`w-4 h-4 ${
                    activeBreakUsers.length > 0
                      ? 'text-primary animate-pulse'
                      : 'text-main-text-muted'
                  }`}
                />
                <h2 className="text-sm font-semibold text-main-text">
                  Active breaks ({activeBreakUsers.length} on break)
                </h2>
              </div>
              <span className="text-xs font-mono tabular-nums text-main-text-muted">
                Break allowance: {settings.maxBreakDurationMinutes}:00
              </span>
            </div>

            {activeBreakUsers.length === 0 ? (
              <div className="py-10 px-4 text-center rounded-xl bg-surface-1 border border-main-border space-y-2">
                <Coffee className="w-7 h-7 text-main-text-disabled mx-auto" />
                <p className="text-sm font-semibold text-main-text">
                  No team members are currently on break
                </p>
                <p className="text-xs text-main-text-muted max-w-md mx-auto">
                  As soon as anyone starts a break, their timer and remaining allowance appear here.
                  Location is shown only when it is available.
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => onOpenQuickDrawer?.('break')}
                    className="btn-primary text-xs py-2 px-4 inline-flex items-center gap-1.5"
                  >
                    <Coffee className="w-3.5 h-3.5" />
                    <span>Start a Break Now</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeBreakUsers.map((member) => {
                  const elapsedSecs = member.breakStartTime
                    ? Math.max(0, Math.floor((now - member.breakStartTime) / 1000))
                    : 0;
                  const allowanceSecs = settings.maxBreakDurationMinutes * 60;
                  const isOvertime = elapsedSecs > allowanceSecs;
                  const progressPct = Math.min(
                    100,
                    Math.round((elapsedSecs / Math.max(1, allowanceSecs)) * 100)
                  );
                  const activeLog = breakLogs.find(
                    (l) =>
                      l.id === member.activeBreakLogId ||
                      (l.userId === member.uid && !l.endTime)
                  );
                  const waypointCount = Array.isArray(activeLog?.path)
                    ? activeLog!.path.length
                    : 0;
                  const canEndBreak = isAdmin || member.uid === user?.uid;

                  return (
                    <div
                      key={member.uid}
                      className={`p-4 rounded-xl border transition-colors space-y-3 ${
                        selectedMapUserId === member.uid
                          ? 'bg-surface-3 border-primary'
                          : isOvertime
                          ? 'bg-error-subtle border-error/40'
                          : 'bg-surface-1 border-main-border'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-main-text truncate">
                              {member.displayName || member.email}
                            </span>
                            {member.uid === user?.uid && (
                              <span className="text-[11px] font-semibold text-primary">
                                · You
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-main-text-muted truncate">
                            {member.email} · Started{' '}
                            {member.breakStartTime
                              ? safeFormat(member.breakStartTime, 'HH:mm:ss')
                              : 'just now'}
                          </p>
                        </div>

                        <div className="text-right shrink-0">
                          <div
                            className={`text-xl font-mono font-bold tabular-nums ${
                              isOvertime ? 'text-error' : 'text-primary'
                            }`}
                          >
                            {formatLiveStopwatch(member.breakStartTime, now)}
                          </div>
                          <div className="text-[11px] font-mono tabular-nums">
                            {isOvertime ? (
                              <span className="text-error font-semibold inline-flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                +{formatLiveStopwatch(
                                  (member.breakStartTime || now) +
                                    allowanceSecs * 1000,
                                  now
                                )}{' '}
                                over
                              </span>
                            ) : (
                              <span className="text-success font-medium inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                Within {settings.maxBreakDurationMinutes}m limit
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full h-1.5 rounded-full bg-surface-3 overflow-hidden">
                        <div
                          className={`h-full transition-transform duration-300 origin-left ${
                            isOvertime ? 'bg-error' : 'bg-primary'
                          }`}
                          style={{
                            transform: `scaleX(${progressPct / 100})`,
                          }}
                        />
                      </div>

                      {/* GPS Telemetry & Quick Actions Row */}
                      <div className="pt-1 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2 text-main-text-muted font-mono tabular-nums">
                          <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                          {member.lastLocation ? (
                            <span>
                              {member.lastLocation.latitude.toFixed(4)},{' '}
                              {member.lastLocation.longitude.toFixed(4)}
                              {waypointCount > 0
                                ? ` · ${waypointCount} pts`
                                : ''}
                            </span>
                          ) : (
                            <span>Awaiting device GPS signal</span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          {member.lastLocation && (
                            <>
                              <button
                                type="button"
                                onClick={() => setSelectedMapUserId(member.uid)}
                                className="btn-secondary py-1 px-2.5 text-[11px] flex items-center gap-1"
                              >
                                <NavIcon className="w-3 h-3 text-primary" />
                                <span>Locate on Map</span>
                              </button>
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query=${member.lastLocation.latitude},${member.lastLocation.longitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn-secondary py-1 px-2 text-[11px] flex items-center gap-1"
                                title="Open in Google Maps"
                              >
                                <ExternalLink className="w-3 h-3 text-primary" />
                              </a>
                            </>
                          )}

                          {canEndBreak && (
                            <button
                              type="button"
                              disabled={endingBreakUid === member.uid}
                              onClick={() => handleEndMemberBreak(member)}
                              className="btn-destructive py-1 px-2.5 text-[11px] flex items-center gap-1"
                            >
                              <Square className="w-3 h-3" />
                              <span>
                                {endingBreakUid === member.uid
                                  ? 'Ending...'
                                  : 'End Break'}
                              </span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Interactive Live GPS Break Map */}
          <LiveMap
            users={users}
            breakLogs={breakLogs}
            selectedUserId={selectedMapUserId}
            maxBreakDurationMinutes={settings.maxBreakDurationMinutes}
            now={now}
          />
        </div>
      )}

      {/* ====================================================================
          LIVE DIRECTORY VIEW
         ==================================================================== */}
      {subTab === 'directory' && (
        <div className="bg-surface-2 border border-main-border rounded-xl overflow-hidden">
          <div className="p-4 border-b border-main-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-main-text">
              Active Workspace Members ({filteredUsers.length})
            </h2>
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-main-text-muted absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, email, or ID..."
                className="w-full bg-surface-1 border border-main-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-main-text placeholder:text-main-text-disabled focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-main-border text-xs font-semibold text-main-text-muted bg-surface-1/60">
                  <th className="py-3 px-4">Member</th>
                  <th className="py-3 px-4">Role & ID</th>
                  <th className="py-3 px-4">Timezone</th>
                  <th className="py-3 px-4">Current Status</th>
                  <th className="py-3 px-4 text-right">Live Location / Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-main-border text-sm">
                {filteredUsers.map((member) => (
                  <tr
                    key={member.uid}
                    className="hover:bg-surface-3/50 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="font-medium text-main-text">
                        {member.displayName || 'Unnamed Member'}
                        {member.uid === user?.uid && (
                          <span className="text-xs text-primary ml-1.5">
                            · You
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-main-text-muted">
                        {member.email}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs text-main-text">
                      <span className="capitalize font-medium">
                        {member.role}
                      </span>
                      {member.employeeId && (
                        <span className="font-mono text-main-text-muted">
                          {' '}
                          · #{member.employeeId}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-main-text-muted">
                      {member.timezone || 'Local Default'}
                    </td>
                    <td className="py-3 px-4 text-xs">
                      {member.isBreakActive ? (
                        <div className="inline-flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-warning animate-pulse" />
                          <span className="text-warning font-semibold">
                            On Break ·{' '}
                            <span className="font-mono tabular-nums">
                              {formatLiveStopwatch(member.breakStartTime, now)}
                            </span>
                          </span>
                        </div>
                      ) : (
                        <span className="text-success font-medium">
                          Available
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-xs tabular-nums text-main-text-muted">
                      <div className="inline-flex items-center justify-end gap-2">
                        {member.lastLocation ? (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-primary" />
                            <span>
                              {member.lastLocation.latitude.toFixed(3)},{' '}
                              {member.lastLocation.longitude.toFixed(3)}
                            </span>
                          </span>
                        ) : (
                          <span>—</span>
                        )}

                        {member.isBreakActive && (
                          <button
                            type="button"
                            onClick={() =>
                              handleFocusMemberOnTracker(member.uid)
                            }
                            className="btn-secondary py-1 px-2.5 text-[11px] font-sans text-primary border-primary/40"
                          >
                            Track Live →
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ====================================================================
          BREAK COMPLIANCE LOGS VIEW
         ==================================================================== */}
      {subTab === 'breaks' && (
        <div className="bg-surface-2 border border-main-border rounded-xl overflow-hidden">
          <div className="p-4 border-b border-main-border flex items-center justify-between">
            <h2 className="text-sm font-semibold text-main-text">
              {isAdmin ? 'All Team Break Logs' : 'Team & Personal Break History'}{' '}
              ({filteredBreakLogs.length})
            </h2>
            <span className="text-xs text-main-text-muted font-mono tabular-nums">
              Standard allowance: {settings.maxBreakDurationMinutes}m
            </span>
          </div>

          {filteredBreakLogs.length === 0 ? (
            <div className="p-12 text-center">
              <Coffee className="w-8 h-8 text-main-text-disabled mx-auto mb-2" />
              <h3 className="text-sm font-semibold text-main-text">
                No breaks match your filter
              </h3>
              <p className="text-xs text-main-text-muted mt-1">
                Start a rest break from the top action bar or break drawer to
                record duration and GPS waypoints.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-main-border text-xs font-semibold text-main-text-muted bg-surface-1/60">
                    <th className="py-3 px-4">Team Member</th>
                    <th className="py-3 px-4">Started</th>
                    <th className="py-3 px-4">Ended</th>
                    <th className="py-3 px-4">GPS Trail</th>
                    <th className="py-3 px-4 text-right">Duration</th>
                    <th className="py-3 px-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-main-border text-sm">
                  {filteredBreakLogs.map((log) => {
                    const liveDurationMins = !log.endTime
                      ? Math.max(1, Math.floor((now - log.startTime) / 60000))
                      : log.duration || 0;
                    const isOvertime =
                      liveDurationMins > settings.maxBreakDurationMinutes;
                    const memberName =
                      log.userName ||
                      users.find((u) => u.uid === log.userId)?.displayName ||
                      'Team Member';
                    const waypointCount = Array.isArray(log.path)
                      ? log.path.length
                      : 0;
                    const lastPoint =
                      waypointCount > 0 ? log.path[waypointCount - 1] : null;

                    return (
                      <tr
                        key={log.id}
                        className="hover:bg-surface-3/50 transition-colors"
                      >
                        <td className="py-3 px-4 font-medium text-main-text">
                          {memberName}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs tabular-nums text-main-text-muted">
                          {safeFormat(log.startTime, 'MMM d, HH:mm')}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs tabular-nums text-main-text-muted">
                          {log.endTime
                            ? safeFormat(log.endTime, 'HH:mm')
                            : 'In progress'}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs tabular-nums text-main-text-muted">
                          {lastPoint ? (
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${lastPoint.latitude},${lastPoint.longitude}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-primary hover:underline"
                            >
                              <MapPin className="w-3 h-3" />
                              <span>{waypointCount} pts</span>
                            </a>
                          ) : (
                            '0 pts'
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs tabular-nums text-right text-main-text">
                          {!log.endTime ? (
                            <span className="text-primary font-semibold">
                              {formatLiveStopwatch(log.startTime, now)}
                            </span>
                          ) : (
                            `${log.duration ?? 1}m`
                          )}
                        </td>
                        <td className="py-3 px-4 text-xs text-right font-semibold">
                          {!log.endTime ? (
                            <button
                              type="button"
                              onClick={() =>
                                handleFocusMemberOnTracker(log.userId)
                              }
                              className="text-primary hover:underline cursor-pointer"
                            >
                              Live Track →
                            </button>
                          ) : isOvertime ? (
                            <span className="text-error">
                              +{liveDurationMins - settings.maxBreakDurationMinutes}
                              m over
                            </span>
                          ) : (
                            <span className="text-success">On Time</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
