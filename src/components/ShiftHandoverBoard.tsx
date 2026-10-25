import React, { useState, useEffect } from 'react';
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../AuthContext';
import { IncidentTicket, ShiftHandoverReport } from '../types';
import {
  CheckCircle2,
  Wrench,
  Plus,
  UserCheck,
  Copy,
  Check,
  ClipboardCheck,
  Sparkles,
  ArrowRight,
  FileCheck2,
  X,
  Search,
} from 'lucide-react';
import { motion } from 'motion/react';
import { safeFormat } from '../utils/dateUtils';
import {
  generateIncidentTicketNumber,
  detectCurrentShiftLabel,
} from '../utils/troubleshootingUtils';

interface ShiftHandoverBoardProps {
  onDiagnoseIncident?: (problem: string) => void;
}

const HANDOVER_CHECKLIST_ITEMS = [
  {
    id: 'incidents_reviewed',
    label: 'All open L1–L3 incidents reviewed & assigned to oncoming shift',
  },
  {
    id: 'hardware_verified',
    label: 'POS terminals, network links & badge controllers verified nominal',
  },
  {
    id: 'breaks_covered',
    label: 'Active operator rest breaks & floor coverage balanced',
  },
  {
    id: 'swaps_checked',
    label: 'Next-shift roster & pending shift swaps confirmed',
  },
];

export default function ShiftHandoverBoard({
  onDiagnoseIncident,
}: ShiftHandoverBoardProps) {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [tickets, setTickets] = useState<IncidentTicket[]>([]);
  const [handovers, setHandovers] = useState<ShiftHandoverReport[]>([]);
  const [activeView, setActiveView] = useState<
    'active' | 'resolved' | 'handovers'
  >('active');
  const [tierFilter, setTierFilter] = useState<'ALL' | 'L1' | 'L2' | 'L3'>(
    'ALL'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modals State
  const [showNewIncidentModal, setShowNewIncidentModal] = useState(false);
  const [showSignOffModal, setShowSignOffModal] = useState(false);

  // Quick New Incident Modal State
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newTier, setNewTier] = useState<'L1' | 'L2' | 'L3'>('L2');
  const [newTeam, setNewTeam] = useState('Systems & Network Engineering');
  const [creatingIncident, setCreatingIncident] = useState(false);

  // Shift Handover Sign-Off Modal State
  const [outgoingShift, setOutgoingShift] = useState(() =>
    detectCurrentShiftLabel()
  );
  const [incomingShift, setIncomingShift] = useState(
    '2nd Shift (14:00–22:00)'
  );
  const [handoverNotes, setHandoverNotes] = useState('');
  const [checklist, setChecklist] = useState<Record<string, boolean>>({
    incidents_reviewed: true,
    hardware_verified: true,
    breaks_covered: true,
    swaps_checked: true,
  });
  const [signingOff, setSigningOff] = useState(false);
  const [signOffSuccessBanner, setSignOffSuccessBanner] = useState(false);

  useEffect(() => {
    if (authLoading || !user) return;

    const unsubTickets = onSnapshot(
      collection(db, 'incidentTickets'),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as IncidentTicket))
          .sort(
            (a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0)
          );
        setTickets(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'incidentTickets')
    );

    const unsubHandovers = onSnapshot(
      collection(db, 'shiftHandovers'),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as ShiftHandoverReport))
          .sort(
            (a, b) =>
              (Number(b.signOffTimestamp) || 0) -
              (Number(a.signOffTimestamp) || 0)
          );
        setHandovers(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'shiftHandovers')
    );

    return () => {
      unsubTickets();
      unsubHandovers();
    };
  }, [user, authLoading]);

  const activeTickets = tickets.filter((t) => t.status !== 'resolved');
  const resolvedTickets = tickets.filter((t) => t.status === 'resolved');
  const criticalL3Count = activeTickets.filter((t) => t.tier === 'L3').length;

  const filteredTickets = tickets.filter((t) => {
    const matchesStatus =
      activeView === 'resolved'
        ? t.status === 'resolved'
        : t.status !== 'resolved';
    const matchesTier = tierFilter === 'ALL' || t.tier === tierFilter;
    const q = searchQuery.trim().toLowerCase();
    const matchesQuery =
      !q ||
      t.title.toLowerCase().includes(q) ||
      t.ticketNumber.toLowerCase().includes(q) ||
      t.team.toLowerCase().includes(q) ||
      (t.description || '').toLowerCase().includes(q);
    return matchesStatus && matchesTier && matchesQuery;
  });

  const getTierBadgeStyle = (tier: 'L1' | 'L2' | 'L3') => {
    if (tier === 'L3') return 'bg-error/15 text-error border-error/30';
    if (tier === 'L2') return 'bg-warning/15 text-warning border-warning/30';
    return 'bg-success/15 text-success border-success/30';
  };

  const getStatusBadgeStyle = (status: IncidentTicket['status']) => {
    if (status === 'resolved')
      return 'bg-success/15 text-success border-success/30';
    if (status === 'investigating')
      return 'bg-primary/15 text-primary border-primary/30';
    if (status === 'mitigated')
      return 'bg-info/15 text-info border-info/30';
    return 'bg-warning/15 text-warning border-warning/30';
  };

  const handleClaimTicket = async (ticket: IncidentTicket) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'incidentTickets', ticket.id), {
        assignedToId: user.uid,
        assignedToName: user.displayName || user.email || 'Engineer',
        status: ticket.status === 'open' ? 'investigating' : ticket.status,
        updatedAt: Date.now(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'incidentTickets');
    }
  };

  const handleResolveTicket = async (ticket: IncidentTicket) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'incidentTickets', ticket.id), {
        status: 'resolved',
        resolvedAt: Date.now(),
        updatedAt: Date.now(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'incidentTickets');
    }
  };

  const handleCopyTicket = (ticket: IncidentTicket) => {
    const text = `[${ticket.ticketNumber}] ${ticket.tier} (${ticket.status.toUpperCase()}) — ${ticket.title}\nQueue: ${ticket.team} | Shift: ${ticket.shiftType}\nSummary: ${ticket.description}`;
    navigator.clipboard.writeText(text);
    setCopiedId(ticket.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCreateQuickIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newTitle.trim() || creatingIncident) return;
    setCreatingIncident(true);
    try {
      const ticketNumber = generateIncidentTicketNumber();
      await addDoc(collection(db, 'incidentTickets'), {
        ticketNumber,
        title: newTitle.trim(),
        description: newDesc.trim() || newTitle.trim(),
        tier: newTier,
        team: newTeam,
        status: 'open',
        creatorId: user.uid,
        creatorName: user.displayName || user.email || 'Engineer',
        stepsTaken: ['Logged on Shift Handover Board'],
        shiftType: detectCurrentShiftLabel(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      setNewTitle('');
      setNewDesc('');
      setShowNewIncidentModal(false);
      setActiveView('active');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'incidentTickets');
    } finally {
      setCreatingIncident(false);
    }
  };

  const handleAutoFillHandoverNotes = () => {
    if (activeTickets.length === 0) {
      setHandoverNotes(
        'All shift systems nominal. Zero unresolved L1–L3 incidents at handover. Standard monitoring in effect for oncoming shift.'
      );
      return;
    }
    const summaryLines = activeTickets.slice(0, 5).map(
      (t) =>
        `• [${t.ticketNumber} · ${t.tier}] ${t.title} (${t.status.toUpperCase()} — Assigned: ${
          t.assignedToName || t.team
        })`
    );
    setHandoverNotes(
      `Handing over ${activeTickets.length} active incident(s) to ${incomingShift}:\n${summaryLines.join(
        '\n'
      )}`
    );
  };

  const handleSignOffHandover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || signingOff) return;
    setSigningOff(true);
    try {
      const leadName = user.displayName || user.email || 'Shift Lead';
      const finalNotes =
        handoverNotes.trim() ||
        (activeTickets.length > 0
          ? `${activeTickets.length} open incident(s) transferred to ${incomingShift}.`
          : 'All stations nominal. Clean shift handover completed.');

      await addDoc(collection(db, 'shiftHandovers'), {
        outgoingShift,
        incomingShift,
        leadEngineerId: user.uid,
        leadEngineerName: leadName,
        notes: finalNotes,
        openIncidentsCount: activeTickets.length,
        criticalAlerts: activeTickets
          .filter((t) => t.tier === 'L3' || t.tier === 'L2')
          .map((t) => `${t.ticketNumber}: ${t.title}`),
        verifiedChecklist: checklist,
        signOffTimestamp: Date.now(),
      });

      await addDoc(collection(db, 'messages'), {
        text: `[SHIFT HANDOVER SIGN-OFF] ${outgoingShift} → ${incomingShift} signed off by ${leadName}. Open Incidents: ${activeTickets.length}. Notes: ${finalNotes}`,
        userId: user.uid,
        userName: leadName,
        role: isAdmin ? 'admin' : 'member',
        timestamp: serverTimestamp(),
      });

      setHandoverNotes('');
      setShowSignOffModal(false);
      setSignOffSuccessBanner(true);
      setTimeout(() => setSignOffSuccessBanner(false), 4000);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'shiftHandovers');
    } finally {
      setSigningOff(false);
    }
  };

  return (
    <div className="space-y-5 pb-16">
      {/* Top Mode Bar & Modal Triggers */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-main-border pb-3">
        <div className="inline-flex items-center p-1 rounded-xl bg-surface-2 border border-main-border">
          {(
            [
              {
                id: 'active',
                label: `Active Incidents (${activeTickets.length})`,
              },
              {
                id: 'resolved',
                label: `Resolved (${resolvedTickets.length})`,
              },
              {
                id: 'handovers',
                label: `Handover Logs (${handovers.length})`,
              },
            ] as const
          ).map((tab) => {
            const isActive = activeView === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveView(tab.id)}
                className={`relative px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  isActive
                    ? 'text-primary-text'
                    : 'text-main-text-muted hover:text-main-text'
                }`}
              >
                {isActive && (
                  <motion.span
                    layoutId="handover-mode-pill"
                    transition={{
                      type: 'spring',
                      stiffness: 460,
                      damping: 32,
                    }}
                    className="absolute inset-0 rounded-lg bg-gradient-to-br from-primary to-primary-active shadow-xs"
                  />
                )}
                <span className="relative z-10">{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowNewIncidentModal(true)}
            className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-primary" />
            <span>Log Incident</span>
          </button>

          <button
            type="button"
            onClick={() => setShowSignOffModal(true)}
            className="btn-primary py-1.5 px-3.5 text-xs flex items-center gap-1.5 cursor-pointer"
          >
            <ClipboardCheck className="w-3.5 h-3.5" />
            <span>Complete Shift Sign-Off</span>
          </button>
        </div>
      </div>

      {/* Compact Single-Line Status Strip */}
      <div className="px-4 py-2.5 rounded-xl bg-surface-2 border border-main-border flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3 text-main-text-muted">
          <span>
            Current Shift:{' '}
            <strong className="text-main-text">
              {detectCurrentShiftLabel()}
            </strong>
          </span>
          <span>·</span>
          <span>
            Open Incidents:{' '}
            <strong className="font-mono text-main-text">
              {activeTickets.length}
            </strong>
          </span>
          {criticalL3Count > 0 && (
            <>
              <span>·</span>
              <span className="text-error font-semibold">
                {criticalL3Count} Critical L3
              </span>
            </>
          )}
        </div>

        {handovers[0] && (
          <span className="text-main-text-muted">
            Last Sign-Off:{' '}
            <strong className="text-main-text">
              {handovers[0].leadEngineerName}
            </strong>{' '}
            ({safeFormat(handovers[0].signOffTimestamp, 'MMM d, HH:mm')})
          </span>
        )}
      </div>

      {signOffSuccessBanner && (
        <div className="p-3.5 rounded-xl bg-success/15 border border-success/30 text-xs text-success flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>
              Shift handover signed off and shared to Team Channels!
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSignOffSuccessBanner(false)}
            className="text-success hover:opacity-80 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* =====================================================================
          VIEW 1 & 2: CLEAN INCIDENT TABLE (Active or Resolved)
         ===================================================================== */}
      {activeView !== 'handovers' ? (
        <div className="bg-surface-2 border border-main-border rounded-xl overflow-hidden">
          {/* Table Filter Bar */}
          <div className="p-4 border-b border-main-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-3.5 h-3.5 text-main-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search incidents by ticket ID, title, or team..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-surface-1 border border-main-border text-xs text-main-text placeholder:text-main-text-disabled focus:outline-none focus:border-primary"
              />
            </div>

            <div className="flex items-center gap-1">
              {(['ALL', 'L1', 'L2', 'L3'] as const).map((tier) => (
                <button
                  key={tier}
                  type="button"
                  onClick={() => setTierFilter(tier)}
                  className={`px-3 py-1 rounded-md text-xs font-mono font-semibold border transition-colors cursor-pointer ${
                    tierFilter === tier
                      ? 'bg-primary text-primary-text border-primary'
                      : 'bg-surface-1 text-main-text-muted border-main-border hover:text-main-text'
                  }`}
                >
                  {tier}
                </button>
              ))}
            </div>
          </div>

          {filteredTickets.length === 0 ? (
            <div className="py-14 text-center space-y-2 px-4">
              <CheckCircle2 className="w-7 h-7 text-success mx-auto" />
              <h3 className="text-sm font-semibold text-main-text">
                {activeView === 'active'
                  ? 'No Active Shift Incidents'
                  : 'No Resolved Incidents Found'}
              </h3>
              <p className="text-xs text-main-text-muted max-w-sm mx-auto">
                {activeView === 'active'
                  ? 'All systems are running smoothly. Use "Log Incident" above or generate a ticket from the AI Troubleshooter if an issue arises.'
                  : 'Resolved shift incidents will appear here.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-main-border text-xs font-semibold text-main-text-muted bg-surface-1/60">
                    <th className="py-3 px-4">Incident & Details</th>
                    <th className="py-3 px-4">Team & Shift</th>
                    <th className="py-3 px-4">Status & Owner</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-main-border text-xs">
                  {filteredTickets.map((ticket) => {
                    const isCopied = copiedId === ticket.id;
                    return (
                      <tr
                        key={ticket.id}
                        className="hover:bg-surface-3/40 transition-colors align-top"
                      >
                        <td className="py-3.5 px-4 max-w-md space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono font-bold text-primary">
                              {ticket.ticketNumber}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border ${getTierBadgeStyle(
                                ticket.tier
                              )}`}
                            >
                              {ticket.tier}
                            </span>
                            <span className="font-semibold text-sm text-main-text">
                              {ticket.title}
                            </span>
                          </div>
                          {ticket.description &&
                            ticket.description !== ticket.title && (
                              <p className="text-main-text-muted line-clamp-2 leading-relaxed">
                                {ticket.description}
                              </p>
                            )}
                          {ticket.resolutionNotes && (
                            <p className="text-primary font-medium">
                              Note: {ticket.resolutionNotes}
                            </p>
                          )}
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap space-y-1">
                          <p className="font-medium text-main-text">
                            {ticket.team}
                          </p>
                          <p className="text-main-text-muted">
                            {ticket.shiftType} ·{' '}
                            {safeFormat(ticket.createdAt, 'MMM d, HH:mm')}
                          </p>
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap space-y-1.5">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase border ${getStatusBadgeStyle(
                              ticket.status
                            )}`}
                          >
                            {ticket.status}
                          </span>
                          <p className="text-main-text-muted">
                            {ticket.assignedToName
                              ? `Owner: ${ticket.assignedToName}`
                              : `Reported: ${ticket.creatorName}`}
                          </p>
                        </td>

                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            {ticket.status !== 'resolved' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleClaimTicket(ticket)}
                                  className="btn-secondary py-1 px-2.5 text-xs flex items-center gap-1 cursor-pointer"
                                  title="Claim incident"
                                >
                                  <UserCheck className="w-3.5 h-3.5 text-primary" />
                                  <span>
                                    {ticket.assignedToId === user?.uid
                                      ? 'Claimed'
                                      : 'Claim'}
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleResolveTicket(ticket)}
                                  className="btn-secondary py-1 px-2.5 text-xs flex items-center gap-1 text-success border-success/30 hover:bg-success/10 cursor-pointer"
                                  title="Mark resolved"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Resolve</span>
                                </button>
                              </>
                            )}

                            {onDiagnoseIncident && (
                              <button
                                type="button"
                                onClick={() => onDiagnoseIncident(ticket.title)}
                                className="btn-secondary py-1 px-2.5 text-xs flex items-center gap-1 text-primary cursor-pointer"
                                title="Diagnose in AI Troubleshooter"
                              >
                                <Wrench className="w-3.5 h-3.5" />
                                <span className="hidden xl:inline">
                                  Diagnose
                                </span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleCopyTicket(ticket)}
                              className="p-1.5 rounded-lg border border-main-border bg-surface-1 text-main-text-muted hover:text-main-text cursor-pointer"
                              title="Copy incident summary"
                            >
                              {isCopied ? (
                                <Check className="w-3.5 h-3.5 text-success" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* =====================================================================
           VIEW 3: HANDOVER SIGN-OFF LOGS TABLE
           ===================================================================== */
        <div className="bg-surface-2 border border-main-border rounded-xl overflow-hidden">
          <div className="p-4 border-b border-main-border flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-main-text">
                Completed Shift Handover Sign-Offs
              </h2>
              <p className="text-xs text-main-text-muted">
                Formal shift transition records and safety checklist verifications
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowSignOffModal(true)}
              className="btn-primary py-1.5 px-3 text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <ClipboardCheck className="w-3.5 h-3.5" />
              <span>New Sign-Off</span>
            </button>
          </div>

          {handovers.length === 0 ? (
            <div className="py-12 text-center text-xs text-main-text-muted">
              No shift handovers have been signed off yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-main-border text-xs font-semibold text-main-text-muted bg-surface-1/60">
                    <th className="py-3 px-4">Shift Transition</th>
                    <th className="py-3 px-4">Summary Notes</th>
                    <th className="py-3 px-4">Signed By</th>
                    <th className="py-3 px-4 text-right">Open Incidents</th>
                    <th className="py-3 px-4 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-main-border text-xs">
                  {handovers.map((h) => (
                    <tr
                      key={h.id}
                      className="hover:bg-surface-3/40 transition-colors"
                    >
                      <td className="py-3.5 px-4 font-semibold text-main-text whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span>{h.outgoingShift.split(' ')[0]}</span>
                          <ArrowRight className="w-3.5 h-3.5 text-primary" />
                          <span>{h.incomingShift.split(' ')[0]} Shift</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-main-text-muted max-w-md">
                        {h.notes}
                      </td>
                      <td className="py-3.5 px-4 text-main-text whitespace-nowrap">
                        {h.leadEngineerName}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-primary whitespace-nowrap">
                        {h.openIncidentsCount}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-main-text-muted whitespace-nowrap">
                        {safeFormat(h.signOffTimestamp, 'MMM d, HH:mm')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          MODAL 1: LOG NEW INCIDENT
         ===================================================================== */}
      {showNewIncidentModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowNewIncidentModal(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-md bg-surface-2 border border-main-border rounded-xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-main-border flex items-center justify-between">
              <h3 className="text-sm font-semibold text-main-text">
                Log Shift Incident
              </h3>
              <button
                type="button"
                onClick={() => setShowNewIncidentModal(false)}
                className="p-1 rounded-lg text-main-text-muted hover:text-main-text cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={handleCreateQuickIncident}
              className="p-5 space-y-3.5"
            >
              <div>
                <label className="block text-xs font-medium text-main-text mb-1">
                  Incident Title
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Register #2 card reader offline"
                  className="input-field text-xs py-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-main-text mb-1">
                    Severity Tier
                  </label>
                  <select
                    value={newTier}
                    onChange={(e) =>
                      setNewTier(e.target.value as 'L1' | 'L2' | 'L3')
                    }
                    className="input-field text-xs py-2"
                  >
                    <option value="L1">L1 · Frontline</option>
                    <option value="L2">L2 · Systems</option>
                    <option value="L3">L3 · Critical SRE</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-main-text mb-1">
                    Assigned Queue
                  </label>
                  <input
                    type="text"
                    value={newTeam}
                    onChange={(e) => setNewTeam(e.target.value)}
                    className="input-field text-xs py-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-main-text mb-1">
                  Handover Context / Notes
                </label>
                <textarea
                  rows={3}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="What was tried and what does the next shift need to know?"
                  className="input-field text-xs"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewIncidentModal(false)}
                  className="btn-secondary py-2 px-3 text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newTitle.trim() || creatingIncident}
                  className="btn-primary py-2 px-4 text-xs cursor-pointer"
                >
                  {creatingIncident ? 'Logging...' : 'Post Incident'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 2: SHIFT HANDOVER SIGN-OFF
         ===================================================================== */}
      {showSignOffModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowSignOffModal(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-lg bg-surface-2 border border-main-border rounded-xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-main-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-main-text">
                  Complete Shift Handover Sign-Off
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSignOffModal(false)}
                className="p-1 rounded-lg text-main-text-muted hover:text-main-text cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSignOffHandover} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-main-text mb-1">
                    Outgoing Shift
                  </label>
                  <select
                    value={outgoingShift}
                    onChange={(e) => setOutgoingShift(e.target.value)}
                    className="input-field text-xs py-2"
                  >
                    <option value="1st Shift (06:00–14:00)">
                      1st Shift (06:00–14:00)
                    </option>
                    <option value="2nd Shift (14:00–22:00)">
                      2nd Shift (14:00–22:00)
                    </option>
                    <option value="3rd Shift (22:00–06:00)">
                      3rd Shift (22:00–06:00)
                    </option>
                    <option value="General Shift (09:00–18:00)">
                      General Shift (09:00–18:00)
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-main-text mb-1">
                    Incoming Shift
                  </label>
                  <select
                    value={incomingShift}
                    onChange={(e) => setIncomingShift(e.target.value)}
                    className="input-field text-xs py-2"
                  >
                    <option value="1st Shift (06:00–14:00)">
                      1st Shift (06:00–14:00)
                    </option>
                    <option value="2nd Shift (14:00–22:00)">
                      2nd Shift (14:00–22:00)
                    </option>
                    <option value="3rd Shift (22:00–06:00)">
                      3rd Shift (22:00–06:00)
                    </option>
                    <option value="General Shift (09:00–18:00)">
                      General Shift (09:00–18:00)
                    </option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-xs font-medium text-main-text block">
                  Pre-Handover Checklist
                </span>
                {HANDOVER_CHECKLIST_ITEMS.map((item) => (
                  <label
                    key={item.id}
                    className="flex items-start gap-2.5 p-2.5 rounded-lg bg-surface-1 border border-main-border text-xs text-main-text cursor-pointer select-none"
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(checklist[item.id])}
                      onChange={(e) =>
                        setChecklist((prev) => ({
                          ...prev,
                          [item.id]: e.target.checked,
                        }))
                      }
                      className="mt-0.5 rounded border-main-border text-primary focus:ring-primary"
                    />
                    <span className="leading-snug">{item.label}</span>
                  </label>
                ))}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-main-text">
                    Shift Handover Summary
                  </label>
                  <button
                    type="button"
                    onClick={handleAutoFillHandoverNotes}
                    className="text-xs text-primary hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Auto-Fill Active Incidents</span>
                  </button>
                </div>
                <textarea
                  value={handoverNotes}
                  onChange={(e) => setHandoverNotes(e.target.value)}
                  rows={3}
                  placeholder="Summarize key floor updates or open tickets for the incoming shift..."
                  className="input-field text-xs"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowSignOffModal(false)}
                  className="btn-secondary py-2 px-3 text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={signingOff}
                  className="btn-primary py-2 px-4 text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <ClipboardCheck className="w-3.5 h-3.5" />
                  <span>
                    {signingOff
                      ? 'Signing Off...'
                      : `Sign Off Handover (${activeTickets.length} Open)`}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
