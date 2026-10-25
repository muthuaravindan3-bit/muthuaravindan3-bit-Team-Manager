import React, { useState, useMemo } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../AuthContext';
import {
  ParsedTroubleshootingStep,
  StepOutcome,
  generateIncidentTicketNumber,
  detectCurrentShiftLabel,
  formatIncidentTicketOutput,
} from '../utils/troubleshootingUtils';
import {
  X,
  Copy,
  Check,
  Send,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Share2,
  ClipboardCheck,
} from 'lucide-react';

interface IncidentTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  problem: string;
  summary: string;
  level: 'L1' | 'L2' | 'L3';
  handlingTeam: string;
  hasScreenshot?: boolean;
  steps: ParsedTroubleshootingStep[];
  stepOutcomes: Record<number, StepOutcome>;
  checkedSteps: Record<number, boolean>;
  onTicketCreated?: (ticketNumber: string) => void;
}

export default function IncidentTicketModal({
  isOpen,
  onClose,
  problem,
  summary,
  level,
  handlingTeam,
  hasScreenshot,
  steps,
  stepOutcomes,
  checkedSteps,
  onTicketCreated,
}: IncidentTicketModalProps) {
  const { user, isAdmin } = useAuth();
  const [ticketNumber] = useState(() => generateIncidentTicketNumber());
  const fixedStep = useMemo(
    () => steps.find((s) => stepOutcomes[s.stepNumber] === 'fixed'),
    [steps, stepOutcomes]
  );

  const [status, setStatus] = useState<
    'open' | 'investigating' | 'mitigated' | 'resolved'
  >(fixedStep ? 'resolved' : 'open');
  const [tier, setTier] = useState<'L1' | 'L2' | 'L3'>(level);
  const [team, setTeam] = useState(handlingTeam);
  const [shiftType, setShiftType] = useState(() => detectCurrentShiftLabel());
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [format, setFormat] = useState<'markdown' | 'slack' | 'jira'>(
    'markdown'
  );
  const [postToTeamChannel, setPostToTeamChannel] = useState(true);
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [publishedSuccess, setPublishedSuccess] = useState(false);

  if (!isOpen) return null;

  const creatorName = user?.displayName || user?.email || 'Shift Engineer';

  const formattedTicket = formatIncidentTicketOutput(
    {
      ticketNumber,
      title: problem,
      summary,
      tier,
      team,
      status,
      creatorName,
      shiftType,
      hasScreenshot,
      steps,
      stepOutcomes,
      checkedSteps,
      resolutionNotes: resolutionNotes.trim() || undefined,
    },
    format
  );

  const handleCopy = () => {
    navigator.clipboard.writeText(formattedTicket);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePublishTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || submitting) return;
    setSubmitting(true);

    try {
      const stepsTaken = steps
        .filter(
          (s) =>
            checkedSteps[s.stepNumber] ||
            stepOutcomes[s.stepNumber] === 'fixed' ||
            stepOutcomes[s.stepNumber] === 'failed'
        )
        .map((s) => `Step ${s.stepNumber}: ${s.title}`);

      const failedSteps = steps
        .filter((s) => stepOutcomes[s.stepNumber] === 'failed')
        .map((s) => `Step ${s.stepNumber}: ${s.title}`);

      await addDoc(collection(db, 'incidentTickets'), {
        ticketNumber,
        title: problem,
        description: summary || problem,
        tier,
        team,
        status,
        creatorId: user.uid,
        creatorName,
        stepsTaken:
          stepsTaken.length > 0
            ? stepsTaken
            : steps.slice(0, 2).map((s) => `Step ${s.stepNumber}: ${s.title}`),
        failedSteps,
        ...(fixedStep
          ? {
              successfulStep: `Step ${fixedStep.stepNumber}: ${fixedStep.title}`,
            }
          : {}),
        ...(resolutionNotes.trim()
          ? { resolutionNotes: resolutionNotes.trim() }
          : {}),
        shiftType,
        hasScreenshot: Boolean(hasScreenshot),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        ...(status === 'resolved' ? { resolvedAt: Date.now() } : {}),
      });

      if (postToTeamChannel) {
        await addDoc(collection(db, 'messages'), {
          text: `[${ticketNumber}] ${tier} Incident ${
            status === 'resolved' ? 'Resolved' : 'Handover Alert'
          }: "${problem}" (${team} · ${shiftType})${
            fixedStep
              ? ` — Verified fix at Step ${fixedStep.stepNumber}: ${fixedStep.title}.`
              : ' — Added to Live Shift Handover Board.'
          }`,
          userId: user.uid,
          userName: creatorName,
          role: isAdmin ? 'admin' : 'member',
          timestamp: serverTimestamp(),
        });
      }

      setPublishedSuccess(true);
      if (onTicketCreated) {
        onTicketCreated(ticketNumber);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'incidentTickets');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="One-Click Incident Ticket and Handover Generator"
    >
      <div
        className="w-full max-w-2xl bg-surface-2 border border-main-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 bg-surface-3 border-b border-main-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center text-primary">
              <ClipboardCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-display font-bold text-main-text">
                  One-Click Incident Ticket & Shift Handover
                </h2>
                <span className="px-2 py-0.5 rounded bg-primary/15 border border-primary/30 font-mono text-[11px] font-bold text-primary">
                  {ticketNumber}
                </span>
              </div>
              <p className="text-[11px] text-main-text-muted">
                Auto-compiled from your AI troubleshooting checklist & telemetry
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-main-text-muted hover:text-main-text hover:bg-surface-2 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {publishedSuccess ? (
          <div className="p-8 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-success/15 border border-success/30 flex items-center justify-center text-success mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="space-y-1 max-w-md mx-auto">
              <h3 className="text-base font-semibold text-main-text">
                Ticket {ticketNumber} Published to Shift Handover Board
              </h3>
              <p className="text-xs text-main-text-muted leading-relaxed">
                Oncoming shift engineers and leads can now track this incident in real time under <strong>Team & Breaks → Shift Handover Board</strong>.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleCopy}
                className="btn-secondary px-4 py-2 text-xs flex items-center gap-1.5 cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-success" />
                    <span>Copied Ticket</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Ticket Text</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="btn-primary px-5 py-2 text-xs cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={handlePublishTicket}
            className="p-5 overflow-y-auto space-y-4 flex-1"
          >
            {/* Status & Escalation Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-main-text-muted mb-1">
                  Incident Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="input-field w-full text-xs py-2"
                >
                  <option value="open">Open — Needs Shift Handover</option>
                  <option value="investigating">
                    Investigating — L2/L3 Active
                  </option>
                  <option value="mitigated">Mitigated — Monitoring</option>
                  <option value="resolved">Resolved — Fixed via Runbook</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-main-text-muted mb-1">
                  Escalation Tier
                </label>
                <select
                  value={tier}
                  onChange={(e) =>
                    setTier(e.target.value as 'L1' | 'L2' | 'L3')
                  }
                  className="input-field w-full text-xs py-2"
                >
                  <option value="L1">L1 · Frontline / Workstation</option>
                  <option value="L2">L2 · Systems / Network</option>
                  <option value="L3">L3 · Critical Infrastructure / SRE</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-main-text-muted mb-1">
                  Shift Window
                </label>
                <select
                  value={shiftType}
                  onChange={(e) => setShiftType(e.target.value)}
                  className="input-field w-full text-xs py-2"
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-main-text-muted mb-1">
                  Assigned Queue / Team
                </label>
                <input
                  type="text"
                  value={team}
                  onChange={(e) => setTeam(e.target.value)}
                  className="input-field w-full text-xs py-2"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-main-text-muted mb-1">
                  Handover / Resolution Notes (Optional)
                </label>
                <input
                  type="text"
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="e.g. Terminal #4 needs cable swap by 2nd shift..."
                  className="input-field w-full text-xs py-2"
                />
              </div>
            </div>

            {/* Format Switcher & Preview */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  {(
                    [
                      { id: 'markdown', label: 'Markdown Handover' },
                      { id: 'slack', label: 'Slack / Teams' },
                      { id: 'jira', label: 'Jira / ServiceNow' },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setFormat(tab.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                        format === tab.id
                          ? 'bg-primary text-primary-text border-primary'
                          : 'bg-surface-1 text-main-text-muted border-main-border hover:text-main-text'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleCopy}
                  className="btn-secondary py-1 px-2.5 text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-success" />
                      <span className="text-success">Copied to Clipboard</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Ticket Text</span>
                    </>
                  )}
                </button>
              </div>

              <pre className="p-3.5 rounded-xl bg-surface-1 border border-main-border font-mono text-xs text-main-text overflow-x-auto max-h-52 leading-relaxed whitespace-pre-wrap">
                {formattedTicket}
              </pre>
            </div>

            {/* Broadcast Toggle & Submit */}
            <div className="pt-2 border-t border-main-border flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-xs text-main-text cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={postToTeamChannel}
                  onChange={(e) => setPostToTeamChannel(e.target.checked)}
                  className="rounded border-main-border text-primary focus:ring-primary"
                />
                <span>Also post alert to Live Team Channels</span>
              </label>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-secondary px-4 py-2 text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary px-4 py-2 text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>
                    {submitting
                      ? 'Publishing...'
                      : 'Publish to Shift Handover Board'}
                  </span>
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
