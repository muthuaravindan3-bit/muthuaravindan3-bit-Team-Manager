import { ScenePanel } from './scenes/ScenePanel';
import { useDraftString } from '../hooks/useDraftString';
import { useChangeReview } from '../hooks/useChangeReview';
import { ChangeReview } from './ui/ChangeReview';
import React, { useState, useEffect, useRef } from 'react';
import {
  collection,
  query,
  onSnapshot,
  addDoc,
  doc,
  updateDoc,
} from 'firebase/firestore';
import { db, OperationType } from '../firebase';
import { useAuth } from '../AuthContext';
import { TroubleshootingGuide } from '../types';
import {
  generateTroubleshootingGuideStream,
  chatWithCortex,
} from '../geminiService';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Send,
  Clock,
  Sparkles,
  Terminal,
  Copy,
  Check,
  MessageSquare,
  FileCode,
  Search,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Cpu,
  ImagePlus,
  X,
  CheckCircle2,
  Eye,
  ListChecks,
  FileText,
  Upload,
  ThumbsUp,
  ThumbsDown,
  ClipboardCheck,
  ArrowRight,
  AlertTriangle,
  BookOpen,
} from 'lucide-react';
import { motion } from 'motion/react';
import { safeFormat } from '../utils/dateUtils';
import {
  ScreenshotAttachment,
  processScreenshotFile,
  extractScreenshotFromClipboard,
  parseRunbookGuide,
  StepOutcome,
} from '../utils/troubleshootingUtils';
import IncidentTicketModal from './IncidentTicketModal';

const CATEGORIES = [
  'All Engineering',
  'Network & VPN',
  'POS & Hardware',
  'Server / Cloud / DB',
  'Auth & Security',
  'Performance & OS',
];

const QUICK_PROBLEMS = [
  {
    label: 'POS register offline',
    category: 'POS & Hardware',
    problem:
      'POS terminal or register is offline, local spool is stuck, and card reader is not syncing transactions',
  },
  {
    label: 'VPN / DNS drops',
    category: 'Network & VPN',
    problem:
      'Corporate VPN tunnel and internal DNS resolution keep dropping on port 443 during shift check-in',
  },
  {
    label: 'API 504 timeout',
    category: 'Server / Cloud / DB',
    problem:
      'Backend API returning HTTP 504 Gateway Timeout with database connection pool exhaustion',
  },
  {
    label: '403 Permission loop',
    category: 'Auth & Security',
    problem:
      'Engineer receiving 403 Missing or insufficient permissions / OAuth token refresh loop after role update',
  },
];

interface FollowUpMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  screenshotPreview?: string;
}

interface TroubleshooterProps {
  initialIncidentProblem?: string | null;
  onClearInitialIncident?: () => void;
  onOpenHandoverBoard?: () => void;
}

export default function Troubleshooter({
  initialIncidentProblem,
  onClearInitialIncident,
  onOpenHandoverBoard,
}: TroubleshooterProps) {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const changeReview = useChangeReview();
  const handleFirestoreError = changeReview.reportError;
  const [activeSurface, setActiveSurface] = useState<'diagnose' | 'library'>(
    'diagnose'
  );
  const [problem, setProblem] = useDraftString('Troubleshooter-problem', '');
  const [selectedCategory, setSelectedCategory] = useState('All Engineering');
  const [showLogInput, setShowLogInput] = useState(false);
  const [logSnippet, setLogSnippet] = useDraftString('Troubleshooter-logSnippet', '');
  const [generating, setGenerating] = useState(false);

  // Screenshot upload, drag-and-drop, and Ctrl+V paste state
  const [screenshot, setScreenshot] = useState<ScreenshotAttachment | null>(
    null
  );
  const [screenshotError, setScreenshotError] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [currentResult, setCurrentResult] = useState<{
    id?: string;
    problem: string;
    guide: string;
    level: 'L1' | 'L2' | 'L3';
    handlingTeam: string;
    screenshotDataUrl?: string;
    verifiedResolved?: boolean;
    resolvedByStep?: number;
    resolvedByStepTitle?: string;
  } | null>(null);

  // Interactive numbered checklist, "Did this fix it?" outcomes & expandable technical commands
  const [checkedSteps, setCheckedSteps] = useState<Record<number, boolean>>({});
  const [stepOutcomes, setStepOutcomes] = useState<Record<number, StepOutcome>>(
    {}
  );
  const [activeStepFocus, setActiveStepFocus] = useState<number | null>(1);
  const [expandedTechSteps, setExpandedTechSteps] = useState<
    Record<number, boolean>
  >({});
  const [expandAllTech, setExpandAllTech] = useState(false);
  const [viewMode, setViewMode] = useState<'checklist' | 'markdown'>(
    'checklist'
  );
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [lastCreatedTicketNumber, setLastCreatedTicketNumber] = useState<
    string | null
  >(null);

  // Multi-turn follow-up conversation state
  const [followUpMessages, setFollowUpMessages] = useState<FollowUpMessage[]>(
    []
  );
  const [followUpInput, setFollowUpInput] = useDraftString('Troubleshooter-followUpInput', '');
  const [followUpScreenshot, setFollowUpScreenshot] =
    useState<ScreenshotAttachment | null>(null);
  const [isFollowUpLoading, setIsFollowUpLoading] = useState(false);
  const followUpFileInputRef = useRef<HTMLInputElement>(null);
  const followUpEndRef = useRef<HTMLDivElement>(null);
  const stepCardRefs = useRef<Record<number, HTMLDivElement | null>>({});

  // History & filtering state
  const [history, setHistory] = useState<TroubleshootingGuide[]>([]);
  const [historySearch, setHistorySearch] = useDraftString('Troubleshooter-historySearch', '');
  const [historyTierFilter, setHistoryTierFilter] = useState<
    'ALL' | 'L1' | 'L2' | 'L3'
  >('ALL');

  useEffect(() => {
    if (authLoading || !user) return;

    const q = query(collection(db, 'troubleshootingGuides'));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as TroubleshootingGuide))
          .sort(
            (a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0)
          );
        setHistory(list);
      },
      (err) =>
        handleFirestoreError(err, OperationType.LIST, 'troubleshootingGuides')
    );

    return () => unsub();
  }, [user, authLoading]);

  // Automatically trigger diagnosis if jumped from Shift Handover Board
  useEffect(() => {
    if (initialIncidentProblem && user && !generating) {
      setActiveSurface('diagnose');
      setProblem(initialIncidentProblem);
      handleDiagnose(initialIncidentProblem);
      if (onClearInitialIncident) {
        onClearInitialIncident();
      }
    }
  }, [initialIncidentProblem, user]);

  useEffect(() => {
    if (followUpMessages.length > 0) {
      followUpEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [followUpMessages, isFollowUpLoading]);

  const handleCopyCode = (codeText: string) => {
    navigator.clipboard.writeText(codeText);
    setCopiedCode(codeText);
    setTimeout(() => {
      setCopiedCode((prev) => (prev === codeText ? null : prev));
    }, 2000);
  };

  const handleScreenshotFileSelect = async (
    file: File | null | undefined,
    target: 'main' | 'followup' = 'main'
  ) => {
    if (!file) return;
    setScreenshotError(null);
    try {
      const processed = await processScreenshotFile(file);
      if (target === 'main') {
        setScreenshot(processed);
      } else {
        setFollowUpScreenshot(processed);
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Could not attach image. Try a PNG or JPG screenshot.';
      setScreenshotError(msg);
    }
  };

  const handlePasteScreenshot = async (
    e: React.ClipboardEvent,
    target: 'main' | 'followup' = 'main'
  ) => {
    setScreenshotError(null);
    try {
      const pasted = await extractScreenshotFromClipboard(e);
      if (pasted) {
        e.preventDefault();
        if (target === 'main') {
          setScreenshot(pasted);
        } else {
          setFollowUpScreenshot(pasted);
        }
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Failed to paste screenshot from clipboard.';
      setScreenshotError(msg);
    }
  };

  const handleDropScreenshot = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file && file.type.startsWith('image/')) {
      await handleScreenshotFileSelect(file, 'main');
    } else if (file) {
      setScreenshotError('Please drop an image file (PNG, JPG, or WebP).');
    }
  };

  const handleDiagnose = async (
    issueText?: string,
    presetCategory?: string
  ) => {
    const targetProblem = (issueText ?? problem).trim();
    if (
      !user ||
      (!targetProblem && !logSnippet.trim() && !screenshot) ||
      generating
    ) {
      return;
    }
    if (issueText) setProblem(issueText);
    if (presetCategory) setSelectedCategory(presetCategory);
    setActiveSurface('diagnose');

    const activeCategory = presetCategory || selectedCategory;
    const effectiveProblem =
      targetProblem ||
      (screenshot
        ? `Error Screenshot Diagnosis (${screenshot.name})`
        : `Analyze attached ${activeCategory} error log & stack trace`);

    const attachedScreenshotUrl = screenshot?.dataUrl;

    setGenerating(true);
    setCheckedSteps({});
    setStepOutcomes({});
    setActiveStepFocus(1);
    setExpandedTechSteps({});
    setExpandAllTech(false);
    setFollowUpMessages([]);
    setLastCreatedTicketNumber(null);

    try {
      const result = await generateTroubleshootingGuideStream(
        effectiveProblem,
        screenshot?.base64Data,
        screenshot?.mimeType,
        (partialText) => {
          const cleaned = partialText
            .replace(/<thought>[\s\S]*?<\/thought>/g, '')
            .replace(/<thought>[\s\S]*/g, '')
            .trim();
          if (cleaned) {
            setCurrentResult({
              problem: effectiveProblem,
              guide: cleaned,
              level: 'L1',
              handlingTeam: activeCategory,
              screenshotDataUrl: attachedScreenshotUrl,
            });
          }
        },
        {
          category: activeCategory,
          logSnippet: logSnippet.trim(),
        }
      );

      const finalCleanGuide = result.guide
        .replace(/<thought>[\s\S]*?<\/thought>/g, '')
        .trim();

      const docRef = await addDoc(collection(db, 'troubleshootingGuides'), {
        userId: user.uid,
        problem: effectiveProblem,
        ...(screenshot?.mimeType ? { mediaType: screenshot.mimeType } : {}),
        level: result.level,
        handlingTeam: result.handlingTeam,
        guide: finalCleanGuide,
        createdAt: Date.now(),
      });

      setCurrentResult({
        id: docRef.id,
        problem: effectiveProblem,
        guide: finalCleanGuide,
        level: result.level,
        handlingTeam: result.handlingTeam,
        screenshotDataUrl: attachedScreenshotUrl,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'troubleshootingGuides');
    } finally {
      setGenerating(false);
    }
  };

  const handleStepDidFixIt = async (stepNumber: number, stepTitle: string) => {
    setCheckedSteps((prev) => ({ ...prev, [stepNumber]: true }));
    setStepOutcomes((prev) => ({ ...prev, [stepNumber]: 'fixed' }));
    setActiveStepFocus(null);

    if (currentResult?.id && user) {
      try {
        await updateDoc(doc(db, 'troubleshootingGuides', currentResult.id), {
          verifiedResolved: true,
          resolvedByStep: stepNumber,
          resolvedByStepTitle: stepTitle,
          resolvedByName: user.displayName || 'Engineer',
          resolvedAt: Date.now(),
        });
        setCurrentResult((prev) =>
          prev
            ? {
                ...prev,
                verifiedResolved: true,
                resolvedByStep: stepNumber,
                resolvedByStepTitle: stepTitle,
              }
            : null
        );
      } catch {
        // non-blocking update
      }
    }
  };

  const handleStepDidNotWork = (
    stepNumber: number,
    stepTitle: string,
    totalStepsCount: number
  ) => {
    setCheckedSteps((prev) => ({ ...prev, [stepNumber]: true }));
    setStepOutcomes((prev) => ({ ...prev, [stepNumber]: 'failed' }));

    if (stepNumber < totalStepsCount) {
      const nextStep = stepNumber + 1;
      setActiveStepFocus(nextStep);
      setExpandedTechSteps((prev) => ({ ...prev, [nextStep]: true }));
      setTimeout(() => {
        stepCardRefs.current[nextStep]?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        });
      }, 100);
    } else {
      setActiveStepFocus(null);
      handleFollowUpSend(
        `Step ${stepNumber} (${stepTitle}) did not resolve the issue. Please provide deeper L2/L3 root-cause recovery steps and diagnostic commands.`
      );
    }
  };

  const handleFollowUpSend = async (customPrompt?: string) => {
    const queryText = (customPrompt ?? followUpInput).trim();
    if ((!queryText && !followUpScreenshot) || isFollowUpLoading || !user)
      return;
    if (!customPrompt) setFollowUpInput('');

    const attachedFollowUpShot = followUpScreenshot;
    setFollowUpScreenshot(null);

    const effectiveQuery =
      queryText ||
      'Analyze this additional error screenshot and provide the next troubleshooting steps.';

    const updatedUserTurn: FollowUpMessage = {
      role: 'user',
      text: effectiveQuery,
      timestamp: Date.now(),
      screenshotPreview: attachedFollowUpShot?.dataUrl,
    };

    const nextMessages = [...followUpMessages, updatedUserTurn];
    setFollowUpMessages(nextMessages);
    setIsFollowUpLoading(true);

    try {
      const historyPayload = nextMessages.slice(0, -1).map((m) => ({
        role: m.role,
        text: m.text,
        parts: [{ text: m.text }],
      }));

      const reply = await chatWithCortex(effectiveQuery, historyPayload, {
        userName: user.displayName || 'Engineer',
        role: isAdmin ? 'Lead Systems Engineer' : 'Operations Engineer',
        activeRunbook: currentResult,
        logSnippet: logSnippet.trim(),
        mediaBase64: attachedFollowUpShot?.base64Data,
        mediaType: attachedFollowUpShot?.mimeType,
      });

      setFollowUpMessages((prev) => [
        ...prev,
        {
          role: 'model',
          text: reply,
          timestamp: Date.now(),
        },
      ]);
    } catch {
      setFollowUpMessages((prev) => [
        ...prev,
        {
          role: 'model',
          text: 'Unable to reach AI responder. Please retry or check local network status.',
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsFollowUpLoading(false);
    }
  };

  const toggleStep = (stepNumber: number) => {
    setCheckedSteps((prev) => ({ ...prev, [stepNumber]: !prev[stepNumber] }));
  };

  const toggleTechStep = (stepNumber: number) => {
    setExpandedTechSteps((prev) => ({
      ...prev,
      [stepNumber]: !(prev[stepNumber] ?? expandAllTech),
    }));
  };

  const handleToggleExpandAllTech = () => {
    const next = !expandAllTech;
    setExpandAllTech(next);
    const updated: Record<number, boolean> = {};
    parsedRunbook.steps.forEach((s) => {
      updated[s.stepNumber] = next;
    });
    setExpandedTechSteps(updated);
  };

  const filteredHistory = history.filter((item) => {
    const matchesTier =
      historyTierFilter === 'ALL' || item.level === historyTierFilter;
    const matchesQuery =
      !historySearch.trim() ||
      item.problem.toLowerCase().includes(historySearch.toLowerCase()) ||
      item.handlingTeam.toLowerCase().includes(historySearch.toLowerCase()) ||
      item.guide.toLowerCase().includes(historySearch.toLowerCase());
    return matchesTier && matchesQuery;
  });

  const getTierBadgeStyle = (level: 'L1' | 'L2' | 'L3') => {
    if (level === 'L3') {
      return 'bg-error/15 text-error border-error/30';
    }
    if (level === 'L2') {
      return 'bg-warning/15 text-warning border-warning/30';
    }
    return 'bg-success/15 text-success border-success/30';
  };

  const parsedRunbook = currentResult
    ? parseRunbookGuide(currentResult.guide)
    : { summary: '', steps: [], extraCommands: [] };

  const totalSteps = parsedRunbook.steps.length;
  const completedStepsCount = parsedRunbook.steps.filter(
    (s) => checkedSteps[s.stepNumber]
  ).length;
  const fixedStepObj = parsedRunbook.steps.find(
    (s) =>
      stepOutcomes[s.stepNumber] === 'fixed' ||
      currentResult?.resolvedByStep === s.stepNumber
  );
  const failedStepsCount = parsedRunbook.steps.filter(
    (s) => stepOutcomes[s.stepNumber] === 'failed'
  ).length;
  const hasAnyTechCommands =
    parsedRunbook.steps.some((s) => s.commands.length > 0) ||
    parsedRunbook.extraCommands.length > 0;

  const markdownComponents = {
    code({ inline, className, children, ...props }: any) {
      const codeStr = String(children).replace(/\n$/, '');
      const isMultiLine =
        codeStr.includes('\n') || className?.includes('language-');

      if (!inline && isMultiLine) {
        const lang = (className || '').replace('language-', '') || 'cli';
        const isCopied = copiedCode === codeStr;
        return (
          <div className="my-3 rounded-lg overflow-hidden border border-main-border bg-surface-1">
            <div className="px-3 py-1.5 bg-surface-3 border-b border-main-border flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-wider text-main-text-muted flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-primary" />
                <span>{lang}</span>
              </span>
              <button
                type="button"
                onClick={() => handleCopyCode(codeStr)}
                className="flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded bg-surface-2 hover:bg-primary/15 text-main-text-muted hover:text-primary border border-main-border transition-colors cursor-pointer"
              >
                {isCopied ? (
                  <>
                    <Check className="w-3 h-3 text-success" />
                    <span className="text-success">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            <pre className="p-3.5 text-xs font-mono text-main-text overflow-x-auto leading-relaxed">
              <code {...props}>{codeStr}</code>
            </pre>
          </div>
        );
      }

      return (
        <code
          className="px-1.5 py-0.5 rounded bg-surface-1 border border-main-border font-mono text-[12px] text-primary"
          {...props}
        >
          {children}
        </code>
      );
    },
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-16">
      <ScenePanel compact kind="orb" state={generating || isFollowUpLoading ? 'processing' : currentResult ? 'response' : 'idle'} title="AI support" description={generating || isFollowUpLoading ? 'Processing your request.' : currentResult ? 'Response ready. Review the suggested checks below.' : 'Ready for your question.'} />
      <ChangeReview state={changeReview} />
      {/* One-Click Incident Ticket & Shift Handover Modal */}
      {currentResult && (
        <IncidentTicketModal
          isOpen={showTicketModal}
          onClose={() => setShowTicketModal(false)}
          problem={currentResult.problem}
          summary={parsedRunbook.summary}
          level={currentResult.level}
          handlingTeam={currentResult.handlingTeam}
          hasScreenshot={Boolean(currentResult.screenshotDataUrl)}
          steps={parsedRunbook.steps}
          stepOutcomes={stepOutcomes}
          checkedSteps={checkedSteps}
          onTicketCreated={(tNum) => setLastCreatedTicketNumber(tNum)}
        />
      )}

      {/* Lightbox Modal for Screenshot Inspection */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="relative max-w-4xl max-h-[88vh] bg-surface-2 border border-main-border rounded-2xl overflow-hidden shadow-2xl p-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-main-border mb-2">
              <span className="text-xs font-semibold text-main-text">
                Error Screenshot Preview
              </span>
              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                className="p-1 rounded-lg text-main-text-muted hover:text-main-text hover:bg-surface-3 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <img
              src={lightboxImage}
              alt="Uploaded error screenshot"
              className="max-h-[78vh] w-auto mx-auto rounded-lg object-contain"
            />
          </div>
        </div>
      )}

      {/* Top Mode Switcher: Active Diagnostic vs Past Solutions Library */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-main-border pb-3">
        <div className="inline-flex items-center p-1 rounded-xl bg-surface-2 border border-main-border">
          <button
            type="button"
            onClick={() => setActiveSurface('diagnose')}
            className={`relative px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 transition-colors cursor-pointer ${
              activeSurface === 'diagnose'
                ? 'text-primary-text'
                : 'text-main-text-muted hover:text-main-text'
            }`}
          >
            {activeSurface === 'diagnose' && (
              <motion.span
                layoutId="troubleshooter-mode-pill"
                transition={{ type: 'spring', stiffness: 460, damping: 32 }}
                className="absolute inset-0 rounded-lg bg-gradient-to-br from-primary to-primary-active shadow-xs"
              />
            )}
            <Sparkles className="w-3.5 h-3.5 relative z-10" />
            <span className="relative z-10">Active Diagnostic</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSurface('library')}
            className={`relative px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 transition-colors cursor-pointer ${
              activeSurface === 'library'
                ? 'text-primary-text'
                : 'text-main-text-muted hover:text-main-text'
            }`}
          >
            {activeSurface === 'library' && (
              <motion.span
                layoutId="troubleshooter-mode-pill"
                transition={{ type: 'spring', stiffness: 460, damping: 32 }}
                className="absolute inset-0 rounded-lg bg-gradient-to-br from-primary to-primary-active shadow-xs"
              />
            )}
            <BookOpen className="w-3.5 h-3.5 relative z-10" />
            <span className="relative z-10">
              Past Solutions Library ({history.length})
            </span>
          </button>
        </div>

        {currentResult && activeSurface === 'diagnose' && (
          <button
            type="button"
            onClick={() => setShowTicketModal(true)}
            className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5 text-primary border-primary/30 hover:bg-primary/10 cursor-pointer"
          >
            <ClipboardCheck className="w-3.5 h-3.5" />
            <span>Send to Shift Handover</span>
          </button>
        )}
      </div>

      {/* =====================================================================
          SURFACE 1: ACTIVE DIAGNOSTIC (Focused Single Column)
         ===================================================================== */}
      {activeSurface === 'diagnose' ? (
        <div className="space-y-5">
          {/* Clean Input Card */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!isDraggingOver) setIsDraggingOver(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDraggingOver(false);
            }}
            onDrop={handleDropScreenshot}
            className={`p-5 rounded-xl bg-surface-2 border transition-colors space-y-3.5 relative ${
              isDraggingOver
                ? 'border-primary ring-2 ring-primary/25 bg-primary/5'
                : 'border-main-border'
            }`}
          >
            {isDraggingOver && (
              <div className="absolute inset-2 rounded-xl bg-surface-2/95 border-2 border-dashed border-primary z-20 flex flex-col items-center justify-center gap-1.5 pointer-events-none">
                <Upload className="w-6 h-6 text-primary" />
                <p className="text-xs font-semibold text-main-text">
                  Drop error screenshot to attach
                </p>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleDiagnose();
              }}
              className="space-y-3"
            >
              {/* Main Search & Diagnose Row */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <input
                  type="text"
                  value={problem}
                  onChange={(e) => setProblem(e.target.value)}
                  onPaste={(e) => handlePasteScreenshot(e, 'main')}
                  placeholder="Describe the issue or paste an error screenshot (Ctrl+V)..."
                  className="input-field flex-1 text-sm py-2.5 px-3.5"
                />
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  aria-label="Engineering category"
                  className="bg-surface-1 border border-main-border rounded-lg px-3 py-2.5 text-xs font-medium text-main-text focus:outline-none focus:border-primary shrink-0"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={
                    (!problem.trim() && !logSnippet.trim() && !screenshot) ||
                    generating
                  }
                  className="btn-primary px-4 py-2.5 text-xs flex items-center justify-center gap-2 shrink-0 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{generating ? 'Diagnosing...' : 'Diagnose'}</span>
                </button>
              </div>

              {/* Secondary Row: Quick Topics on Left, Attachments on Right */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-main-text-muted mr-0.5">
                    Common:
                  </span>
                  {QUICK_PROBLEMS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() =>
                        handleDiagnose(preset.problem, preset.category)
                      }
                      className="text-xs px-2.5 py-1 rounded-md bg-surface-1 border border-main-border hover:border-primary text-main-text-muted hover:text-main-text transition-colors cursor-pointer"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      handleScreenshotFileSelect(e.target.files?.[0], 'main');
                      e.target.value = '';
                    }}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className={`px-2.5 py-1 rounded-md border text-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
                      screenshot
                        ? 'border-primary text-primary bg-primary/10'
                        : 'border-main-border bg-surface-1 text-main-text-muted hover:text-main-text'
                    }`}
                  >
                    <ImagePlus className="w-3.5 h-3.5 text-primary" />
                    <span>{screenshot ? 'Change Image' : 'Screenshot'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowLogInput((prev) => !prev)}
                    className={`px-2.5 py-1 rounded-md border text-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
                      showLogInput || logSnippet.trim()
                        ? 'border-primary text-primary bg-primary/10'
                        : 'border-main-border bg-surface-1 text-main-text-muted hover:text-main-text'
                    }`}
                  >
                    <FileCode className="w-3.5 h-3.5" />
                    <span>{showLogInput ? 'Hide Log' : 'Paste Log'}</span>
                  </button>
                </div>
              </div>

              {/* Attached Screenshot Preview */}
              {screenshot && (
                <div className="p-2.5 rounded-lg bg-surface-1 border border-primary/40 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => setLightboxImage(screenshot.dataUrl)}
                      className="relative w-12 h-9 rounded overflow-hidden border border-main-border bg-surface-3 shrink-0 group cursor-pointer"
                    >
                      <img
                        src={screenshot.dataUrl}
                        alt={screenshot.name}
                        className="w-full h-full object-cover"
                      />
                    </button>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-main-text truncate">
                        {screenshot.name}
                      </p>
                      <p className="text-[11px] text-main-text-muted">
                        {screenshot.width}×{screenshot.height}px ·{' '}
                        {screenshot.sizeKb} KB
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setScreenshot(null)}
                    className="p-1 rounded text-main-text-muted hover:text-error cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {screenshotError && (
                <div className="px-3 py-2 rounded-lg bg-error/10 border border-error/30 text-xs text-error flex items-center justify-between">
                  <span>{screenshotError}</span>
                  <button
                    type="button"
                    onClick={() => setScreenshotError(null)}
                    className="text-error hover:opacity-80 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {showLogInput && (
                <div className="pt-1">
                  <textarea
                    value={logSnippet}
                    onChange={(e) => setLogSnippet(e.target.value)}
                    onPaste={(e) => handlePasteScreenshot(e, 'main')}
                    rows={3}
                    placeholder="Paste stack trace, terminal output, or HTTP error response..."
                    className="w-full rounded-lg bg-surface-1 border border-main-border p-3 font-mono text-xs text-main-text placeholder:text-main-text-disabled focus:outline-none focus:border-primary"
                  />
                </div>
              )}
            </form>
          </div>

          {/* Active Runbook Output */}
          {currentResult ? (
            <div className="space-y-4">
              <div className="p-5 sm:p-6 rounded-xl bg-surface-2 border border-main-border space-y-5">
                {/* Clean Runbook Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-main-border">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-mono font-bold border ${getTierBadgeStyle(
                        currentResult.level
                      )}`}
                    >
                      {currentResult.level}
                    </span>
                    <h2 className="text-sm font-semibold text-main-text">
                      {currentResult.problem}
                    </h2>
                    <span className="text-xs text-main-text-muted">
                      · {currentResult.handlingTeam}
                    </span>
                    {fixedStepObj && (
                      <span className="px-2 py-0.5 rounded bg-success/15 border border-success/30 text-success text-xs font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Resolved (Step {fixedStepObj.stepNumber})</span>
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {currentResult.screenshotDataUrl && (
                      <button
                        type="button"
                        onClick={() =>
                          setLightboxImage(currentResult.screenshotDataUrl!)
                        }
                        className="btn-secondary py-1.5 px-2.5 text-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-primary" />
                        <span>Screenshot</span>
                      </button>
                    )}

                    {hasAnyTechCommands && viewMode === 'checklist' && (
                      <button
                        type="button"
                        onClick={handleToggleExpandAllTech}
                        className="btn-secondary py-1.5 px-2.5 text-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <Terminal className="w-3.5 h-3.5 text-primary" />
                        <span>
                          {expandAllTech ? 'Hide CLI' : 'Show All CLI'}
                        </span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        setViewMode((prev) =>
                          prev === 'checklist' ? 'markdown' : 'checklist'
                        )
                      }
                      className="btn-secondary py-1.5 px-2.5 text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      {viewMode === 'checklist' ? (
                        <>
                          <FileText className="w-3.5 h-3.5" />
                          <span>Doc View</span>
                        </>
                      ) : (
                        <>
                          <ListChecks className="w-3.5 h-3.5 text-primary" />
                          <span>Checklist</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCopyCode(currentResult.guide)}
                      className="btn-secondary py-1.5 px-2.5 text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      {copiedCode === currentResult.guide ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-success" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowTicketModal(true)}
                      className="btn-primary py-1.5 px-3 text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <ClipboardCheck className="w-3.5 h-3.5" />
                      <span>Create Handover Ticket</span>
                    </button>
                  </div>
                </div>

                {/* Ticket Created Notification */}
                {lastCreatedTicketNumber && (
                  <div className="p-3 rounded-lg bg-primary/10 border border-primary/30 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 text-main-text">
                      <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                      <span>
                        Ticket{' '}
                        <strong className="font-mono text-primary">
                          {lastCreatedTicketNumber}
                        </strong>{' '}
                        logged to the Shift Handover Board.
                      </span>
                    </div>
                    {onOpenHandoverBoard && (
                      <button
                        type="button"
                        onClick={onOpenHandoverBoard}
                        className="font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <span>View Handover Board</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}

                {/* Escalation Notice when 2+ steps fail */}
                {!fixedStepObj && failedStepsCount >= 2 && (
                  <div className="p-3.5 rounded-lg bg-warning/10 border border-warning/30 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
                      <span className="text-main-text">
                        {failedStepsCount} steps attempted without resolution.
                        Ready to escalate to{' '}
                        <strong>{currentResult.handlingTeam}</strong>?
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowTicketModal(true)}
                      className="btn-primary py-1 px-3 text-xs cursor-pointer"
                    >
                      Escalate Ticket
                    </button>
                  </div>
                )}

                {viewMode === 'checklist' && parsedRunbook.steps.length > 0 ? (
                  <div className="space-y-4">
                    {parsedRunbook.summary && (
                      <div className="p-3.5 rounded-lg bg-surface-1 border border-main-border text-sm text-main-text leading-relaxed">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {parsedRunbook.summary}
                        </ReactMarkdown>
                      </div>
                    )}

                    {/* Progress Row */}
                    <div className="flex items-center justify-between text-xs text-main-text-muted">
                      <span className="font-semibold text-main-text">
                        Diagnostic Checklist ({completedStepsCount}/{totalSteps}{' '}
                        completed)
                      </span>
                      <span>Mark whether each step resolved the issue</span>
                    </div>

                    {/* Step List */}
                    <div className="space-y-2.5">
                      {parsedRunbook.steps.map((step) => {
                        const isDone = Boolean(checkedSteps[step.stepNumber]);
                        const outcome =
                          stepOutcomes[step.stepNumber] || 'pending';
                        const isRecommendedActive =
                          activeStepFocus === step.stepNumber && !fixedStepObj;
                        const isTechExpanded = Boolean(
                          expandedTechSteps[step.stepNumber] ?? expandAllTech
                        );

                        return (
                          <div
                            key={step.stepNumber}
                            ref={(el) => {
                              stepCardRefs.current[step.stepNumber] = el;
                            }}
                            className={`p-4 rounded-xl border transition-colors ${
                              outcome === 'fixed'
                                ? 'bg-success/10 border-success/40'
                                : outcome === 'failed'
                                ? 'bg-surface-1/60 border-warning/30'
                                : isRecommendedActive
                                ? 'bg-surface-1 border-primary'
                                : 'bg-surface-1 border-main-border'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <button
                                type="button"
                                onClick={() => toggleStep(step.stepNumber)}
                                className={`w-6 h-6 rounded-md font-mono text-xs font-bold flex items-center justify-center shrink-0 border transition-colors cursor-pointer mt-0.5 ${
                                  outcome === 'fixed' || isDone
                                    ? 'bg-success text-white border-success'
                                    : outcome === 'failed'
                                    ? 'bg-warning/20 text-warning border-warning/40'
                                    : isRecommendedActive
                                    ? 'bg-primary text-primary-text border-primary'
                                    : 'bg-surface-2 text-main-text border-main-border'
                                }`}
                              >
                                {outcome === 'fixed' || isDone ? (
                                  <Check className="w-3.5 h-3.5" />
                                ) : (
                                  step.stepNumber
                                )}
                              </button>

                              <div className="flex-1 min-w-0 space-y-2">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-sm font-semibold text-main-text">
                                      {step.title}
                                    </span>
                                    <span
                                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border ${getTierBadgeStyle(
                                        step.tier
                                      )}`}
                                    >
                                      {step.tier}
                                    </span>
                                  </div>

                                  {/* Compact Feedback Buttons */}
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleStepDidFixIt(
                                          step.stepNumber,
                                          step.title
                                        )
                                      }
                                      className={`px-2.5 py-1 rounded-md text-xs font-medium border flex items-center gap-1 transition-colors cursor-pointer ${
                                        outcome === 'fixed'
                                          ? 'bg-success text-white border-success'
                                          : 'bg-surface-2 border-main-border text-main-text-muted hover:text-success hover:border-success/50'
                                      }`}
                                    >
                                      <ThumbsUp className="w-3 h-3" />
                                      <span>Fixed it</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleStepDidNotWork(
                                          step.stepNumber,
                                          step.title,
                                          totalSteps
                                        )
                                      }
                                      className={`px-2.5 py-1 rounded-md text-xs font-medium border flex items-center gap-1 transition-colors cursor-pointer ${
                                        outcome === 'failed'
                                          ? 'bg-warning/20 text-warning border-warning/50'
                                          : 'bg-surface-2 border-main-border text-main-text-muted hover:text-warning hover:border-warning/50'
                                      }`}
                                    >
                                      <ThumbsDown className="w-3 h-3" />
                                      <span>Didn&apos;t work</span>
                                    </button>
                                  </div>
                                </div>

                                <p className="text-sm text-main-text leading-relaxed">
                                  {step.simpleInstruction}
                                </p>

                                {step.verification && (
                                  <p className="text-xs text-main-text-muted">
                                    <strong className="text-main-text">
                                      Verify:
                                    </strong>{' '}
                                    {step.verification}
                                  </p>
                                )}

                                {step.commands.length > 0 && (
                                  <div className="pt-1">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        toggleTechStep(step.stepNumber)
                                      }
                                      className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline cursor-pointer"
                                    >
                                      <Terminal className="w-3.5 h-3.5" />
                                      <span>
                                        {isTechExpanded
                                          ? 'Hide CLI Commands'
                                          : `Show CLI Commands (${step.commands.length})`}
                                      </span>
                                      {isTechExpanded ? (
                                        <ChevronUp className="w-3.5 h-3.5" />
                                      ) : (
                                        <ChevronDown className="w-3.5 h-3.5" />
                                      )}
                                    </button>

                                    {isTechExpanded && (
                                      <div className="mt-2 space-y-2">
                                        {step.commands.map((cmd, cIdx) => {
                                          const isCopied =
                                            copiedCode === cmd.code;
                                          return (
                                            <div
                                              key={cIdx}
                                              className="rounded-lg overflow-hidden border border-main-border bg-surface-2"
                                            >
                                              <div className="px-3 py-1.5 bg-surface-3 border-b border-main-border flex items-center justify-between">
                                                <span className="text-[11px] font-mono uppercase text-main-text-muted">
                                                  {cmd.language}
                                                </span>
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    handleCopyCode(cmd.code)
                                                  }
                                                  className="flex items-center gap-1 text-[11px] font-medium text-main-text-muted hover:text-primary cursor-pointer"
                                                >
                                                  {isCopied ? (
                                                    <>
                                                      <Check className="w-3 h-3 text-success" />
                                                      <span className="text-success">
                                                        Copied
                                                      </span>
                                                    </>
                                                  ) : (
                                                    <>
                                                      <Copy className="w-3 h-3" />
                                                      <span>Copy</span>
                                                    </>
                                                  )}
                                                </button>
                                              </div>
                                              <pre className="p-3 text-xs font-mono text-main-text overflow-x-auto leading-relaxed">
                                                <code>{cmd.code}</code>
                                              </pre>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="markdown-body text-sm leading-relaxed">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={markdownComponents}
                    >
                      {currentResult.guide}
                    </ReactMarkdown>
                  </div>
                )}

                {/* Compact Follow-Up Bar inside the same card */}
                <div className="pt-4 border-t border-main-border space-y-3">
                  {followUpMessages.length > 0 && (
                    <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-main-text flex items-center gap-1.5">
                          <MessageSquare className="w-3.5 h-3.5 text-primary" />
                          <span>Follow-Up Thread</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setFollowUpMessages([])}
                          className="text-xs text-main-text-muted hover:text-main-text flex items-center gap-1 cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Clear</span>
                        </button>
                      </div>

                      {followUpMessages.map((msg, i) => (
                        <div
                          key={`${msg.timestamp}-${i}`}
                          className={`p-3 rounded-lg border text-xs ${
                            msg.role === 'user'
                              ? 'bg-surface-1 border-main-border ml-8'
                              : 'bg-surface-3/50 border-primary/25 mr-4'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-primary">
                              {msg.role === 'user'
                                ? user?.displayName || 'You'
                                : 'Engineering AI'}
                            </span>
                            <span className="text-[10px] font-mono text-main-text-muted">
                              {safeFormat(msg.timestamp, 'HH:mm')}
                            </span>
                          </div>
                          <div className="markdown-body leading-relaxed">
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={markdownComponents}
                            >
                              {msg.text}
                            </ReactMarkdown>
                          </div>
                        </div>
                      ))}

                      {isFollowUpLoading && (
                        <div className="p-3 rounded-lg bg-surface-1 border border-main-border text-xs text-main-text-muted flex items-center gap-2">
                          <Cpu className="w-3.5 h-3.5 text-primary animate-spin" />
                          <span>Generating follow-up steps...</span>
                        </div>
                      )}
                      <div ref={followUpEndRef} />
                    </div>
                  )}

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleFollowUpSend();
                    }}
                    className="flex items-center gap-2"
                  >
                    <input
                      ref={followUpFileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        handleScreenshotFileSelect(
                          e.target.files?.[0],
                          'followup'
                        );
                        e.target.value = '';
                      }}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => followUpFileInputRef.current?.click()}
                      title="Attach follow-up screenshot"
                      className="btn-secondary p-2 text-xs shrink-0 cursor-pointer"
                    >
                      <ImagePlus className="w-4 h-4 text-primary" />
                    </button>
                    <input
                      type="text"
                      value={followUpInput}
                      onChange={(e) => setFollowUpInput(e.target.value)}
                      onPaste={(e) => handlePasteScreenshot(e, 'followup')}
                      placeholder="Need deeper steps? Ask a follow-up question..."
                      className="input-field flex-1 text-xs py-2"
                    />
                    <button
                      type="submit"
                      disabled={
                        (!followUpInput.trim() && !followUpScreenshot) ||
                        isFollowUpLoading
                      }
                      className="btn-secondary px-3.5 py-2 text-xs font-semibold text-primary border-primary/30 hover:bg-primary/10 shrink-0 cursor-pointer"
                    >
                      Ask Follow-Up
                    </button>
                  </form>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-10 rounded-xl bg-surface-2 border border-main-border text-center space-y-2.5">
              <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mx-auto">
                <Sparkles className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-semibold text-main-text">
                Enter an Issue Above to Generate a Step-by-Step Checklist
              </h3>
              <p className="text-xs text-main-text-muted max-w-md mx-auto leading-relaxed">
                Describe any hardware, POS, VPN, or server issue—or paste an
                error screenshot with <code className="text-primary">Ctrl+V</code>
                —to get an interactive L1–L3 runbook.
              </p>
            </div>
          )}
        </div>
      ) : (
        /* =====================================================================
           SURFACE 2: PAST SOLUTIONS LIBRARY (Full-Width Clean Table/List)
           ===================================================================== */
        <div className="p-5 rounded-xl bg-surface-2 border border-main-border space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-main-border">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-main-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Search saved solutions by symptom, team, or command..."
                className="w-full pl-8 pr-3 py-2 rounded-lg bg-surface-1 border border-main-border text-xs text-main-text placeholder:text-main-text-disabled focus:outline-none focus:border-primary"
              />
            </div>

            <div className="flex items-center gap-1">
              {(['ALL', 'L1', 'L2', 'L3'] as const).map((tier) => (
                <button
                  key={tier}
                  type="button"
                  onClick={() => setHistoryTierFilter(tier)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-colors cursor-pointer ${
                    historyTierFilter === tier
                      ? 'bg-primary text-primary-text border-primary'
                      : 'bg-surface-1 text-main-text-muted border-main-border hover:text-main-text'
                  }`}
                >
                  {tier}
                </button>
              ))}
            </div>
          </div>

          {filteredHistory.length === 0 ? (
            <div className="py-12 text-center text-xs text-main-text-muted">
              <Clock className="w-6 h-6 text-main-text-disabled mx-auto mb-2" />
              {history.length === 0
                ? 'Generated runbooks will be saved here automatically for your team.'
                : 'No saved solutions match your search filter.'}
            </div>
          ) : (
            <div className="divide-y divide-main-border border border-main-border rounded-xl bg-surface-1 overflow-hidden">
              {filteredHistory.map((item) => (
                <div
                  key={item.id}
                  className="p-4 hover:bg-surface-2/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border ${getTierBadgeStyle(
                          item.level
                        )}`}
                      >
                        {item.level}
                      </span>
                      <span className="text-sm font-semibold text-main-text truncate">
                        {item.problem}
                      </span>
                      {item.verifiedResolved && (
                        <span className="px-2 py-0.5 rounded bg-success/15 text-success text-[10px] font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>
                            Verified Fix
                            {item.resolvedByStep
                              ? ` (Step ${item.resolvedByStep})`
                              : ''}
                          </span>
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-main-text-muted">
                      <span>{item.handlingTeam}</span>
                      <span>·</span>
                      <span className="font-mono">
                        {safeFormat(item.createdAt, 'MMM d, HH:mm')}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setProblem(item.problem);
                      setCurrentResult({
                        id: item.id,
                        problem: item.problem,
                        guide: item.guide,
                        level: item.level,
                        handlingTeam: item.handlingTeam,
                        verifiedResolved: item.verifiedResolved,
                        resolvedByStep: item.resolvedByStep,
                        resolvedByStepTitle: item.resolvedByStepTitle,
                      });
                      setCheckedSteps(
                        item.resolvedByStep
                          ? { [item.resolvedByStep]: true }
                          : {}
                      );
                      setStepOutcomes(
                        item.resolvedByStep
                          ? { [item.resolvedByStep]: 'fixed' }
                          : {}
                      );
                      setExpandedTechSteps({});
                      setExpandAllTech(false);
                      setFollowUpMessages([]);
                      setLastCreatedTicketNumber(null);
                      setActiveSurface('diagnose');
                    }}
                    className="btn-secondary py-1.5 px-3 text-xs shrink-0 cursor-pointer"
                  >
                    Open Checklist
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
