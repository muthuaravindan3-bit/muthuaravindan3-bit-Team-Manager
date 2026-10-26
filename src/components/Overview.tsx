import { z } from 'zod';
import { fromZonedTime } from 'date-fns-tz';
import { useAuth } from '../AuthContext';
import { useTimezone } from '../TimezoneContext';
import { useOverviewRecords, type OverviewRequest } from '../hooks/useOverviewRecords';
import { usePreference } from '../hooks/usePreference';
import { UI_COPY } from '../constants/uiCopy';
import { Button, EmptyState, Feedback, PageHeader, Skeleton, StatusBadge } from './ui/WorkspaceUI';
import type { QuickDrawerType, WorkspaceTab } from './Navigation';
import type { Shift } from '../types';

interface Props { view: string; onNavigate: (workspace: WorkspaceTab, view: string) => void; onOpen: (drawer: QuickDrawerType) => void; onInspect: (shift: Shift) => void }
const guidanceSchema = z.boolean();

/** Overview, attention, and personal history derived only from available records. */
export default function Overview({ view, onNavigate, onOpen, onInspect }: Props) {
  const { user, profile, isAdmin } = useAuth();
  const { userTimezone, appTimezone, convertToUserTime } = useTimezone();
  const data = useOverviewRecords();
  const [guidanceDismissed, setGuidanceDismissed] = usePreference('shiftsync-guidance-v1', false, guidanceSchema);
  const ownShifts = data.shifts.filter((shift) => shift.userId === user?.uid).sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`));
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: userTimezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const nextShift = ownShifts.find((shift) => {
    const endDay = new Date(`${shift.date}T12:00:00Z`);
    if (!Number.isFinite(endDay.getTime())) return false;
    if (shift.endTime <= shift.startTime) endDay.setUTCDate(endDay.getUTCDate() + 1);
    const end = fromZonedTime(`${endDay.toISOString().slice(0, 10)}T${shift.endTime}`, appTimezone);
    return end.getTime() > Date.now();
  });
  const waiting = (request: OverviewRequest) => request.status === 'pending' || request.status === 'accepted';
  const pendingLeaves = data.leaves.filter(waiting);
  const pendingSwaps = data.swaps.filter(waiting);
  const openIncidents = data.incidents.filter((incident) => incident.status !== 'resolved');
  const personalRequests = [...data.leaves.filter((request) => request.userId === user?.uid).map((request) => ({ ...request, kind: 'Time off', view: 'leaves' })), ...data.swaps.filter((request) => request.requesterId === user?.uid).map((request) => ({ ...request, kind: 'Shift swap', view: 'swaps' }))].sort((a, b) => b.createdAt - a.createdAt);
  const title = view === 'attention' ? 'Needs attention' : view === 'activity' ? 'Personal activity' : `Welcome back${profile?.displayName ? `, ${profile.displayName.split(' ')[0]}` : ''}`;
  const requestRows = (requests: OverviewRequest[], kind: 'leaves' | 'swaps') => requests.map((request) => <div className="ui-record" key={request.id}><div><strong>{request.userName ?? request.requesterName ?? 'Your request'}</strong><p>{request.startDate ?? request.shiftDate} {request.endDate && `to ${request.endDate}`}</p><p>{kind === 'leaves' ? 'Time off affects shift availability.' : 'This shift needs a confirmed replacement.'}</p></div><StatusBadge tone="warning">{UI_COPY.status[request.status]}</StatusBadge><Button variant="secondary" onClick={() => onNavigate(isAdmin ? 'admin' : 'requests', isAdmin ? 'approvals' : kind)}>{isAdmin ? 'Review request' : 'View request'}</Button></div>);
  return <div>
    <PageHeader eyebrow="Your workspace" title={title} description={view === 'attention' ? 'Review open work, see who owns it, and choose the next step.' : view === 'activity' ? 'Your requests and the latest available schedule changes.' : 'Your shifts, requests, and team priorities in one place.'} action={{ label: isAdmin ? 'Review schedule' : 'View my week', onClick: () => onNavigate('schedule', isAdmin ? 'week' : 'mine') }} />
    {!guidanceDismissed && <div className="ui-feedback ui-feedback-info"><p>Start with your schedule. Open a shift to see its details. Use Requests when you need a swap or time off.</p><Button variant="ghost" onClick={() => setGuidanceDismissed(true)}>Got it</Button></div>}
    {data.hasUpdates && <div className="ui-feedback ui-feedback-info" role="status"><p>New information is available. Review it when you are ready.</p><Button variant="secondary" onClick={data.review}>Review updates</Button></div>}
    {data.error && <Feedback message="Some records could not be loaded. Counts may be incomplete. Check your connection and try again." onRetry={data.retry} />}
    {data.loading ? <Skeleton /> : view === 'attention' ? <div className="space-y-6">
      <section className="ui-card"><h2>Time off · {pendingLeaves.length}</h2>{pendingLeaves.length ? requestRows(pendingLeaves, 'leaves') : <EmptyState title="No time off waiting" description="Requests needing review will appear here." />}</section>
      <section className="ui-card"><h2>Shift cover · {pendingSwaps.length}</h2>{pendingSwaps.length ? requestRows(pendingSwaps, 'swaps') : <EmptyState title="No swaps waiting" description="Open swap requests will appear here." />}</section>
      <section className="ui-card"><h2>Open incidents · {openIncidents.length}</h2>{openIncidents.map((incident) => <div className="ui-record" key={incident.id}><div><strong>{incident.title}</strong><p>Owner: {incident.assignedToName ?? 'Not assigned'}</p></div><StatusBadge tone="warning">{UI_COPY.status[incident.status]}</StatusBadge><Button variant="secondary" onClick={() => onNavigate('support', 'handover')}>Open handover</Button></div>)}{!openIncidents.length && <EmptyState title="No open incidents" description="New incidents will appear on the handover board." />}</section>
    </div> : view === 'activity' ? <section className="ui-card"><h2>Your available history</h2><p className="text-sm text-main-text-muted">Request dates show when you sent them, not when a decision was made. Full decision and schedule revision history is not stored.</p>{personalRequests.map((request) => <div className="ui-record" key={request.id}><div><strong>{request.kind} · {request.startDate ?? request.shiftDate}</strong><p>Sent {new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeZone: userTimezone }).format(request.createdAt)}</p></div><StatusBadge>{UI_COPY.status[request.status]}</StatusBadge><Button variant="ghost" onClick={() => onNavigate('requests', request.view)}>View request</Button></div>)}{ownShifts.filter((shift) => shift.updatedAt).map((shift) => <div className="ui-record" key={shift.id}><div><strong>Shift updated · {shift.date}</strong><p>Latest saved change: {new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short', timeZone: userTimezone }).format(shift.updatedAt)}</p></div><Button variant="ghost" onClick={() => onInspect(shift)}>View shift</Button></div>)}{!personalRequests.length && !ownShifts.some((shift) => shift.updatedAt) && <EmptyState title="No activity yet" description="Your requests and saved shift changes will appear here." />}</section> : <>
      <div className="ui-metrics">{[{ label: isAdmin ? 'Requests to review' : 'Your open requests', value: pendingLeaves.length + pendingSwaps.length, view: 'attention' }, { label: 'Open incidents', value: openIncidents.length, view: 'attention' }, { label: 'Your scheduled shifts', value: ownShifts.filter((shift) => shift.date >= today).length, view: 'activity' }].map((metric) => <button className="ui-card text-left" key={metric.label} onClick={() => onNavigate('dashboard', metric.view)}><p className="text-sm text-main-text-muted">{metric.label}</p><p className="ui-metric-value">{metric.value}</p><span className="text-sm text-primary">View details →</span></button>)}</div>
      <div className="ui-two-column"><section className="ui-card"><h2>Your next shift</h2>{nextShift ? <><StatusBadge tone="info">{nextShift.type}</StatusBadge><p className="text-xl mt-4">{convertToUserTime(nextShift.date, nextShift.startTime).date}</p><p className="mt-2 text-main-text-muted">{convertToUserTime(nextShift.date, nextShift.startTime).time} – {convertToUserTime(nextShift.date, nextShift.endTime).time} · {userTimezone}</p><div className="ui-actions"><Button onClick={() => onInspect(nextShift)}>View shift</Button></div></> : <EmptyState title="No upcoming shift" description="Check the team schedule or contact your manager about your next assignment." action={{ label: 'Open schedule', onClick: () => onNavigate('schedule', 'week') }} />}</section><section className="ui-card"><h2>Quick actions</h2><div className="grid gap-3"><Button variant="secondary" onClick={() => onOpen('leave')}>Request time off</Button><Button variant="secondary" onClick={() => onOpen('swap')}>Swap shifts</Button><Button variant="secondary" onClick={() => onOpen('break')}>Manage my break</Button></div></section></div>
    </>}
  </div>;
}
