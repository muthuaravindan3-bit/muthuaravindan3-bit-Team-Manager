import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Send,
  User,
  Sparkles,
  Terminal,
  Copy,
  Check,
  FileCode,
  ExternalLink,
  RotateCcw,
  Wrench,
  ImagePlus,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Upload,
} from 'lucide-react';
import { chatWithCortex } from '../geminiService';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAuth } from '../AuthContext';
import {
  collection,
  query,
  where,
  onSnapshot,
  limit,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  ScreenshotAttachment,
  processScreenshotFile,
  extractScreenshotFromClipboard,
  parseRunbookGuide,
} from '../utils/troubleshootingUtils';

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  screenshotPreview?: string;
}

interface AIChatProps {
  initiallyOpen?: boolean;
  onOpenFullWorkbench?: () => void;
}

const QUICK_DRAWER_PROMPTS = [
  'VPN or DNS dropping — give me step-by-step fix',
  'POS register offline & not syncing transactions',
  'Linux / Bash server health & port check commands',
  'Windows PowerShell spooler & network reset commands',
];

export function AIChat({ onOpenFullWorkbench, initiallyOpen = false }: AIChatProps) {
  const [isOpen, setIsOpen] = useState(initiallyOpen);
  const { user, isAdmin } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'model',
      text: 'Describe the problem or add an error screenshot. I can suggest checks and next steps. Review each suggestion before applying it.',
    },
  ]);
  const [input, setInput] = useState('');
  const [logSnippet, setLogSnippet] = useState('');
  const [showLogBox, setShowLogBox] = useState(false);
  const [screenshot, setScreenshot] = useState<ScreenshotAttachment | null>(
    null
  );
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [checkedMsgSteps, setCheckedMsgSteps] = useState<
    Record<string, boolean>
  >({});
  const [expandedMsgTech, setExpandedMsgTech] = useState<
    Record<string, boolean>
  >({});
  const [contextData, setContextData] = useState<{
    currentShifts: any[];
    globalSettings: any;
  }>({
    currentShifts: [],
    globalSettings: { systemStatus: 'optimal' },
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user || !isOpen) return;

    const qShifts = query(
      collection(db, 'shifts'),
      where('userId', '==', user.uid),
      limit(10)
    );
    const unsubShifts = onSnapshot(
      qShifts,
      (snap) => {
        setContextData((prev) => ({
          ...prev,
          currentShifts: snap.docs.map((d) => d.data()),
        }));
      },
      () => {}
    );

    const qSettings = query(collection(db, 'settings'), limit(1));
    const unsubSettings = onSnapshot(
      qSettings,
      (snap) => {
        if (!snap.empty) {
          setContextData((prev) => ({
            ...prev,
            globalSettings: snap.docs[0].data(),
          }));
        }
      },
      () => {}
    );

    return () => {
      unsubShifts();
      unsubSettings();
    };
  }, [user, isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleCopyCode = (codeText: string) => {
    navigator.clipboard.writeText(codeText);
    setCopiedCode(codeText);
    setTimeout(() => {
      setCopiedCode((prev) => (prev === codeText ? null : prev));
    }, 2000);
  };

  const handleFileChange = async (file: File | null | undefined) => {
    if (!file) return;
    try {
      const processed = await processScreenshotFile(file);
      setScreenshot(processed);
    } catch {
      // ignore invalid file
    }
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    try {
      const pasted = await extractScreenshotFromClipboard(e);
      if (pasted) {
        e.preventDefault();
        setScreenshot(pasted);
      }
    } catch {
      // ignore
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file && file.type.startsWith('image/')) {
      await handleFileChange(file);
    }
  };

  const handleSend = async (customQuery?: string) => {
    const rawText = (customQuery ?? input).trim();
    if (
      (!rawText && !logSnippet.trim() && !screenshot) ||
      isLoading ||
      !user
    ) {
      return;
    }

    const attachedShot = screenshot;
    setScreenshot(null);

    const userMessage =
      rawText ||
      (attachedShot
        ? `Analyze this error screenshot (${attachedShot.name}) and give me step-by-step instructions to fix it.`
        : 'Analyze the attached error log / CLI output and provide the fix.');
    if (!customQuery) setInput('');

    const displayMessage = logSnippet.trim()
      ? `${userMessage}\n\n\`\`\`log\n${logSnippet.trim().slice(0, 600)}\n\`\`\``
      : userMessage;

    const nextMessages: ChatMessage[] = [
      ...messages,
      {
        role: 'user',
        text: displayMessage,
        screenshotPreview: attachedShot?.dataUrl,
      },
    ];
    setMessages(nextMessages);
    setIsLoading(true);

    try {
      const history = nextMessages.slice(1, -1).map((m) => ({
        role: m.role,
        text: m.text,
        parts: [{ text: m.text }],
      }));

      const validHistory =
        history.length > 0 && history[0].role === 'model'
          ? history.slice(1)
          : history;

      const responseText = await chatWithCortex(userMessage, validHistory, {
        userName: user.displayName || 'Engineer',
        role: isAdmin ? 'Lead Systems Engineer' : 'Operations Engineer',
        currentShifts: contextData.currentShifts,
        globalSettings: contextData.globalSettings,
        logSnippet: logSnippet.trim(),
        mediaBase64: attachedShot?.base64Data,
        mediaType: attachedShot?.mimeType,
      });

      setMessages((prev) => [...prev, { role: 'model', text: responseText }]);
      if (logSnippet.trim()) {
        setLogSnippet('');
        setShowLogBox(false);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'model',
          text: 'Connection interrupted. Please retry your engineering query.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const markdownComponents = {
    code({ inline, className, children, ...props }: any) {
      const codeStr = String(children).replace(/\n$/, '');
      const isMultiLine =
        codeStr.includes('\n') || className?.includes('language-');

      if (!inline && isMultiLine) {
        const lang = (className || '').replace('language-', '') || 'cli';
        const isCopied = copiedCode === codeStr;
        return (
          <div className="my-2 rounded-lg overflow-hidden border border-main-border bg-surface-1">
            <div className="px-2.5 py-1 bg-surface-3 border-b border-main-border flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-main-text-muted flex items-center gap-1">
                <Terminal className="w-3 h-3 text-primary" />
                <span>{lang}</span>
              </span>
              <button
                type="button"
                onClick={() => handleCopyCode(codeStr)}
                className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-surface-2 hover:bg-primary/15 text-main-text-muted hover:text-primary border border-main-border transition-colors cursor-pointer"
              >
                {isCopied ? (
                  <>
                    <Check className="w-2.5 h-2.5 text-success" />
                    <span className="text-success">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-2.5 h-2.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            <pre className="p-2.5 text-[11px] font-mono text-main-text overflow-x-auto leading-relaxed">
              <code {...props}>{codeStr}</code>
            </pre>
          </div>
        );
      }

      return (
        <code
          className="px-1 py-0.5 rounded bg-surface-1 border border-main-border font-mono text-[11px] text-primary"
          {...props}
        >
          {children}
        </code>
      );
    },
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Open AI Engineering Assistant"
        className="fixed bottom-20 lg:bottom-6 right-4 sm:right-6 z-40 h-12 px-4 rounded-full bg-primary text-primary-text shadow-lg hover:opacity-95 transition-transform active:scale-95 flex items-center gap-2 font-semibold text-xs cursor-pointer"
      >
        <Sparkles className="w-4 h-4" />
        <span>Ask for help</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ duration: 0.2 }}
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
            onDrop={handleDrop}
            className="fixed bottom-36 lg:bottom-20 right-4 sm:right-6 w-[calc(100vw-32px)] sm:w-[460px] h-[580px] max-h-[calc(100vh-150px)] bg-surface-2 border border-main-border rounded-2xl shadow-2xl flex flex-col z-40 overflow-hidden"
          >
            {isDraggingOver && (
              <div className="absolute inset-2 rounded-xl bg-surface-2/95 border-2 border-dashed border-primary z-30 flex flex-col items-center justify-center gap-2 pointer-events-none">
                <Upload className="w-7 h-7 text-primary animate-bounce" />
                <p className="text-xs font-semibold text-main-text">
                  Drop error screenshot here
                </p>
              </div>
            )}

            {/* Header */}
            <div className="px-4 py-3 bg-surface-3 border-b border-main-border flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center text-primary">
                  <Wrench className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-main-text text-xs">
                    AI Engineering Assistant
                  </h3>
                  <p className="text-[10px] text-main-text-muted">
                    Step-by-Step Checklist · Screenshot Vision · CLI
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {onOpenFullWorkbench && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      onOpenFullWorkbench();
                    }}
                    title="Open Full Support Workbench"
                    className="px-2 py-1 rounded-md text-[11px] font-medium text-primary hover:bg-primary/10 flex items-center gap-1 cursor-pointer"
                  >
                    <span>Workbench</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setMessages([
                      {
                        role: 'model',
                        text: 'Conversation reset. Ask any troubleshooting question or upload/paste an error screenshot below.',
                      },
                    ]);
                    setCheckedMsgSteps({});
                    setExpandedMsgTech({});
                  }}
                  title="Reset conversation"
                  className="p-1.5 rounded-lg text-main-text-muted hover:text-main-text hover:bg-surface-2 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  aria-label="Close AI Assistant"
                  className="p-1.5 rounded-lg text-main-text-muted hover:text-main-text hover:bg-surface-2 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Quick Prompt Bar */}
            {messages.length <= 2 && (
              <div className="px-3.5 py-2.5 bg-surface-1 border-b border-main-border flex flex-wrap gap-1.5">
                {QUICK_DRAWER_PROMPTS.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    disabled={isLoading}
                    onClick={() => handleSend(chip)}
                    className="text-[11px] px-2.5 py-1 rounded-md bg-surface-2 border border-main-border hover:border-primary text-main-text-muted hover:text-main-text transition-colors text-left cursor-pointer"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            )}

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg, idx) => {
                const parsed =
                  msg.role === 'model'
                    ? parseRunbookGuide(msg.text)
                    : { summary: '', steps: [], extraCommands: [] };

                return (
                  <div
                    key={idx}
                    className={`flex ${
                      msg.role === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`flex gap-2.5 max-w-[94%] ${
                        msg.role === 'user' ? 'flex-row-reverse' : ''
                      }`}
                    >
                      <div className="mt-0.5 shrink-0">
                        {msg.role === 'user' ? (
                          <div className="w-6 h-6 rounded-md bg-surface-3 border border-main-border flex items-center justify-center text-main-text-muted">
                            <User className="w-3.5 h-3.5" />
                          </div>
                        ) : (
                          <div className="w-6 h-6 rounded-md bg-primary/15 border border-primary/30 flex items-center justify-center text-primary">
                            <Sparkles className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </div>

                      <div
                        className={`p-3 rounded-xl text-xs leading-relaxed ${
                          msg.role === 'user'
                            ? 'bg-primary/15 border border-primary/30 text-main-text'
                            : 'bg-surface-1 border border-main-border text-main-text'
                        }`}
                      >
                        {msg.screenshotPreview && (
                          <div className="mb-2 rounded-lg overflow-hidden border border-main-border max-w-[220px]">
                            <img
                              src={msg.screenshotPreview}
                              alt="Uploaded error screenshot"
                              className="w-full h-auto object-cover"
                            />
                          </div>
                        )}

                        {msg.role === 'model' && parsed.steps.length > 0 ? (
                          <div className="space-y-2.5">
                            {parsed.summary && (
                              <p className="text-xs text-main-text leading-relaxed">
                                {parsed.summary}
                              </p>
                            )}
                            <div className="space-y-2">
                              {parsed.steps.map((step) => {
                                const stepKey = `${idx}-${step.stepNumber}`;
                                const isDone = Boolean(
                                  checkedMsgSteps[stepKey]
                                );
                                const isTechOpen = Boolean(
                                  expandedMsgTech[stepKey]
                                );
                                return (
                                  <div
                                    key={step.stepNumber}
                                    className={`p-2.5 rounded-lg border transition-colors ${
                                      isDone
                                        ? 'bg-success/5 border-success/30'
                                        : 'bg-surface-2 border-main-border'
                                    }`}
                                  >
                                    <div className="flex items-start gap-2">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setCheckedMsgSteps((prev) => ({
                                            ...prev,
                                            [stepKey]: !prev[stepKey],
                                          }))
                                        }
                                        className={`w-5 h-5 rounded font-mono text-[11px] font-bold flex items-center justify-center shrink-0 border cursor-pointer mt-0.5 ${
                                          isDone
                                            ? 'bg-success text-white border-success'
                                            : 'bg-surface-1 text-main-text border-main-border'
                                        }`}
                                      >
                                        {isDone ? (
                                          <Check className="w-3 h-3" />
                                        ) : (
                                          step.stepNumber
                                        )}
                                      </button>
                                      <div className="flex-1 min-w-0 space-y-1">
                                        <p
                                          className={`font-semibold text-xs ${
                                            isDone
                                              ? 'line-through text-main-text-muted'
                                              : 'text-main-text'
                                          }`}
                                        >
                                          Step {step.stepNumber}: {step.title}
                                        </p>
                                        <p className="text-[11px] text-main-text leading-relaxed">
                                          {step.simpleInstruction}
                                        </p>
                                        {step.verification && (
                                          <p className="text-[10px] text-main-text-muted flex items-center gap-1">
                                            <CheckCircle2 className="w-3 h-3 text-success shrink-0" />
                                            <span>
                                              Verify: {step.verification}
                                            </span>
                                          </p>
                                        )}
                                        {step.commands.length > 0 && (
                                          <div className="pt-1">
                                            <button
                                              type="button"
                                              onClick={() =>
                                                setExpandedMsgTech((prev) => ({
                                                  ...prev,
                                                  [stepKey]: !prev[stepKey],
                                                }))
                                              }
                                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface-1 border border-main-border text-[10px] font-medium text-primary cursor-pointer"
                                            >
                                              <Terminal className="w-3 h-3" />
                                              <span>
                                                {isTechOpen
                                                  ? 'Hide Commands'
                                                  : `Show Commands (${step.commands.length})`}
                                              </span>
                                              {isTechOpen ? (
                                                <ChevronUp className="w-3 h-3" />
                                              ) : (
                                                <ChevronDown className="w-3 h-3" />
                                              )}
                                            </button>
                                            {isTechOpen && (
                                              <div className="mt-1.5 space-y-1.5">
                                                {step.commands.map(
                                                  (cmd, cIdx) => {
                                                    const isCopied =
                                                      copiedCode === cmd.code;
                                                    return (
                                                      <div
                                                        key={cIdx}
                                                        className="rounded overflow-hidden border border-main-border bg-surface-1"
                                                      >
                                                        <div className="px-2 py-1 bg-surface-3 border-b border-main-border flex items-center justify-between">
                                                          <span className="text-[9px] font-mono uppercase text-main-text-muted">
                                                            {cmd.language}
                                                          </span>
                                                          <button
                                                            type="button"
                                                            onClick={() =>
                                                              handleCopyCode(
                                                                cmd.code
                                                              )
                                                            }
                                                            className="flex items-center gap-1 text-[10px] text-primary cursor-pointer"
                                                          >
                                                            {isCopied ? (
                                                              <>
                                                                <Check className="w-2.5 h-2.5 text-success" />
                                                                <span>
                                                                  Copied
                                                                </span>
                                                              </>
                                                            ) : (
                                                              <>
                                                                <Copy className="w-2.5 h-2.5" />
                                                                <span>
                                                                  Copy
                                                                </span>
                                                              </>
                                                            )}
                                                          </button>
                                                        </div>
                                                        <pre className="p-2 text-[10px] font-mono overflow-x-auto">
                                                          <code>
                                                            {cmd.code}
                                                          </code>
                                                        </pre>
                                                      </div>
                                                    );
                                                  }
                                                )}
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
                          <div className="markdown-body text-xs leading-relaxed">
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={markdownComponents}
                            >
                              {msg.text}
                            </ReactMarkdown>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="p-3 rounded-xl bg-surface-1 border border-main-border text-xs text-main-text-muted flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-primary animate-spin" />
                    <span>Diagnosing & building numbered steps...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area + Screenshot Preview + Optional Log Snippet */}
            <div className="p-3 bg-surface-3 border-t border-main-border space-y-2">
              {screenshot && (
                <div className="p-2 rounded-lg bg-surface-1 border border-primary/40 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <img
                      src={screenshot.dataUrl}
                      alt={screenshot.name}
                      className="w-10 h-8 rounded object-cover border border-main-border shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium text-main-text truncate">
                        {screenshot.name}
                      </p>
                      <p className="text-[10px] text-main-text-muted">
                        {screenshot.sizeKb} KB · Ready to analyze
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setScreenshot(null)}
                    className="p-1 text-main-text-muted hover:text-error cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {showLogBox && (
                <textarea
                  value={logSnippet}
                  onChange={(e) => setLogSnippet(e.target.value)}
                  onPaste={handlePaste}
                  rows={3}
                  placeholder="Paste error log, stack trace, or CLI output..."
                  className="w-full rounded-lg bg-surface-1 border border-main-border p-2 font-mono text-[11px] text-main-text placeholder:text-main-text-disabled focus:outline-none focus:border-primary"
                />
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                className="flex items-center gap-1.5"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    handleFileChange(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  title="Upload error screenshot (or press Ctrl+V)"
                  className={`p-2 rounded-lg border text-xs transition-colors cursor-pointer ${
                    screenshot
                      ? 'bg-primary/15 border-primary text-primary'
                      : 'bg-surface-1 border-main-border text-main-text-muted hover:text-main-text'
                  }`}
                >
                  <ImagePlus className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setShowLogBox((prev) => !prev)}
                  title="Attach error log or stack trace"
                  className={`p-2 rounded-lg border text-xs transition-colors cursor-pointer ${
                    showLogBox || logSnippet.trim()
                      ? 'bg-primary/15 border-primary text-primary'
                      : 'bg-surface-1 border-main-border text-main-text-muted hover:text-main-text'
                  }`}
                >
                  <FileCode className="w-4 h-4" />
                </button>

                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onPaste={handlePaste}
                  placeholder="Describe issue or press Ctrl+V to paste screenshot..."
                  className="flex-1 bg-surface-1 border border-main-border rounded-lg px-3 py-2 text-xs text-main-text placeholder:text-main-text-disabled focus:outline-none focus:border-primary"
                />

                <button
                  type="submit"
                  disabled={
                    (!input.trim() && !logSnippet.trim() && !screenshot) ||
                    isLoading
                  }
                  className="btn-primary py-2 px-3 text-xs flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send</span>
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
