import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  ReactNode,
} from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  X,
  RotateCcw,
} from 'lucide-react';

export type ToastType = 'success' | 'info' | 'warning' | 'error';

export interface ToastInput {
  type?: ToastType;
  title: string;
  description?: string;
  durationMs?: number;
  liveBadge?: string;
  onUndo?: () => Promise<void> | void;
}

export interface ToastMessage extends ToastInput {
  id: string;
  createdAt: number;
  type: ToastType;
  durationMs: number;
}

interface ToastContextType {
  showToast: (toast: ToastInput) => string;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType>({
  showToast: () => '',
  dismissToast: () => {},
});

export const useToast = () => useContext(ToastContext);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [undoingId, setUndoingId] = useState<string | null>(null);
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const dismissToast = useCallback((id: string) => {
    if (timersRef.current[id]) {
      clearTimeout(timersRef.current[id]);
      delete timersRef.current[id];
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (input: ToastInput): string => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const durationMs =
        input.durationMs ?? (input.onUndo ? 6500 : 4200);
      const newToast: ToastMessage = {
        id,
        createdAt: Date.now(),
        type: input.type || 'success',
        title: input.title,
        description: input.description,
        durationMs,
        liveBadge: input.liveBadge,
        onUndo: input.onUndo,
      };

      setToasts((prev) => [newToast, ...prev.slice(0, 2)]);

      timersRef.current[id] = setTimeout(() => {
        dismissToast(id);
      }, durationMs);

      return id;
    },
    [dismissToast]
  );

  const handleTriggerUndo = async (toast: ToastMessage) => {
    if (!toast.onUndo || undoingId === toast.id) return;
    setUndoingId(toast.id);
    if (timersRef.current[toast.id]) {
      clearTimeout(timersRef.current[toast.id]);
      delete timersRef.current[toast.id];
    }
    try {
      await toast.onUndo();
      dismissToast(toast.id);
      showToast({
        type: 'info',
        title: 'Action reversed',
        description: `Undid: ${toast.title}`,
        liveBadge: 'REVERTED',
        durationMs: 3200,
      });
    } catch {
      dismissToast(toast.id);
      showToast({
        type: 'error',
        title: 'Could not undo action',
        description: 'Please refresh and verify the workspace state.',
        durationMs: 4000,
      });
    } finally {
      setUndoingId(null);
    }
  };

  return (
    <ToastContext.Provider value={{ showToast, dismissToast }}>
      {children}

      {/* Global 2026 Spring Toast Stack */}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 flex flex-col gap-2.5 w-[calc(100vw-32px)] sm:w-96 pointer-events-none"
      >
        <AnimatePresence initial={false}>
          {toasts.map((t) => {
            const Icon =
              t.type === 'success'
                ? CheckCircle2
                : t.type === 'warning'
                ? AlertTriangle
                : t.type === 'error'
                ? AlertCircle
                : Info;

            const iconColor =
              t.type === 'success'
                ? 'text-success bg-success-subtle border-success/30'
                : t.type === 'warning'
                ? 'text-warning bg-warning-subtle border-warning/30'
                : t.type === 'error'
                ? 'text-error bg-error-subtle border-error/30'
                : 'text-primary bg-primary-subtle border-primary/30';

            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{
                  type: 'spring',
                  stiffness: 420,
                  damping: 30,
                }}
                className="pointer-events-auto relative overflow-hidden rounded-xl bg-surface-2/95 backdrop-blur-xl border border-main-border shadow-xl p-3.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 ${iconColor}`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs font-display font-bold text-main-text">
                          {t.title}
                        </p>
                        {t.liveBadge && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-surface-3 border border-main-border font-mono text-[10px] font-semibold text-secondary tabular-nums">
                            <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
                            {t.liveBadge}
                          </span>
                        )}
                      </div>
                      {t.description && (
                        <p className="text-[11px] text-main-text-muted mt-0.5 leading-snug">
                          {t.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {t.onUndo && (
                      <button
                        type="button"
                        disabled={undoingId === t.id}
                        onClick={() => handleTriggerUndo(t)}
                        className="px-2.5 py-1 rounded-lg bg-primary-subtle hover:bg-primary text-primary hover:text-primary-text border border-primary/30 text-[11px] font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>{undoingId === t.id ? 'Undoing…' : 'Undo'}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => dismissToast(t.id)}
                      aria-label="Dismiss notification"
                      className="p-1 rounded-lg text-main-text-muted hover:text-main-text hover:bg-surface-3 transition-colors cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Compositor-safe scaleX countdown progress bar */}
                <motion.div
                  initial={{ scaleX: 1 }}
                  animate={{ scaleX: 0 }}
                  transition={{
                    duration: t.durationMs / 1000,
                    ease: 'linear',
                  }}
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary/50 origin-left"
                />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};
