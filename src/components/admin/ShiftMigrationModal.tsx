import React, { useState, useEffect } from 'react';
import {
  X,
  Database,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCw,
  Sparkles,
  ShieldCheck,
  Search,
} from 'lucide-react';
import { db } from '../../firebase';
import { useAuth } from '../../AuthContext';
import { useToast } from '../../ToastContext';
import {
  planShiftTimingsMigration,
  executeShiftTimingsMigration,
  MigrationSummary,
  OFFICIAL_SHIFT_STANDARDS,
} from '../../utils/shiftMigration';

interface ShiftMigrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMigrationComplete?: () => void;
}

export function ShiftMigrationModal({
  isOpen,
  onClose,
  onMigrationComplete,
}: ShiftMigrationModalProps) {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const isAdmin = profile?.role === 'admin';

  const [isScanning, setIsScanning] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [seedPresets, setSeedPresets] = useState(true);
  const [summary, setSummary] = useState<MigrationSummary | null>(null);
  const [filterQuery, setFilterQuery] = useState('');
  const [progress, setProgress] = useState<{
    completed: number;
    total: number;
    currentItem?: string;
  } | null>(null);
  const [migrationFinished, setMigrationFinished] = useState(false);

  // Auto-scan on modal open
  useEffect(() => {
    if (isOpen) {
      handleRunScan();
    } else {
      setSummary(null);
      setProgress(null);
      setMigrationFinished(false);
    }
  }, [isOpen]);

  const handleRunScan = async () => {
    setIsScanning(true);
    setMigrationFinished(false);
    try {
      const plan = await planShiftTimingsMigration(db, { seedPresets });
      setSummary(plan);
    } catch (err) {
      console.error('Scan error:', err);
      showToast({
        type: 'error',
        title: 'Scan failed',
        description: err instanceof Error ? err.message : 'Database scan error',
      });
    } finally {
      setIsScanning(false);
    }
  };

  const handleExecuteMigration = async () => {
    if (!summary || summary.items.length === 0 || !isAdmin) return;
    setIsMigrating(true);
    setProgress({ completed: 0, total: summary.items.length });

    try {
      const result = await executeShiftTimingsMigration(
        db,
        summary,
        ({ completed, total, currentItem }) => {
          setProgress({ completed, total, currentItem });
        }
      );

      if (result.success) {
        setMigrationFinished(true);
        showToast({
          type: 'success',
          title: `Migration complete: ${result.updatedCount} records updated`,
          description:
            'All existing shifts and preset configurations synchronized to new timings.',
          liveBadge: 'MIGRATED',
        });
        onMigrationComplete?.();
      } else {
        showToast({
          type: 'error',
          title: 'Migration finished with errors',
          description: result.errors[0] || 'Some records failed to update',
        });
      }
    } catch (err) {
      console.error('Migration failed:', err);
      showToast({
        type: 'error',
        title: 'Migration execution halted',
        description: err instanceof Error ? err.message : 'Write failure',
      });
    } finally {
      setIsMigrating(false);
    }
  };

  if (!isOpen) return null;

  const filteredItems = (summary?.items || []).filter(
    (item) =>
      item.label.toLowerCase().includes(filterQuery.toLowerCase()) ||
      item.current.type.toLowerCase().includes(filterQuery.toLowerCase()) ||
      item.proposed.type.toLowerCase().includes(filterQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-surface-1 border border-main-border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-main-border flex items-center justify-between bg-surface-2/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-subtle border border-primary/30 flex items-center justify-center text-primary">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-main-text">
                  Firestore Shift Timings Migration
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-secondary-subtle text-secondary font-medium">
                  Protocol 2026.1
                </span>
              </div>
              <p className="text-xs text-main-text-muted mt-0.5">
                Audit and synchronize all historical shifts and template presets to official operational standards.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-main-text-muted hover:text-main-text rounded-lg hover:bg-surface-3 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Standards Banner */}
        <div className="px-6 py-3 bg-surface-2/70 border-b border-main-border grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
            <span className="font-mono font-medium text-main-text">1ST · Day:</span>
            <span className="font-mono text-cyan-400">07:30–16:30</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            <span className="font-mono font-medium text-main-text">2ND · Swing:</span>
            <span className="font-mono text-emerald-400">12:30–20:30</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-400" />
            <span className="font-mono font-medium text-main-text">3RD · Night:</span>
            <span className="font-mono text-indigo-400">20:30–07:30</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <span className="font-mono font-medium text-main-text">GEN · Day:</span>
            <span className="font-mono text-amber-400">09:00–18:00</span>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Progress / Status banner if migrating */}
          {isMigrating && progress && (
            <div className="p-4 rounded-xl bg-primary-subtle border border-primary/30 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="font-semibold text-primary flex items-center gap-2">
                  <RotateCw className="w-4 h-4 animate-spin" />
                  Writing Batches to Cloud Firestore...
                </span>
                <span className="text-primary font-bold">
                  {Math.round((progress.completed / (progress.total || 1)) * 100)}% ({progress.completed} / {progress.total})
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-surface-3 overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{
                    width: `${Math.round((progress.completed / (progress.total || 1)) * 100)}%`,
                  }}
                />
              </div>
              {progress.currentItem && (
                <p className="text-[11px] font-mono text-main-text-muted truncate">
                  Target: {progress.currentItem}
                </p>
              )}
            </div>
          )}

          {migrationFinished && (
            <div className="p-4 rounded-xl bg-success-subtle border border-success/30 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
              <div>
                <h4 className="text-sm font-semibold text-success">
                  Migration Successfully Committed
                </h4>
                <p className="text-xs text-main-text-muted mt-0.5">
                  All target shifts and preset protocols in Firestore now strictly adhere to standard hours.
                </p>
              </div>
            </div>
          )}

          {/* Metrics Overview Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-surface-2 border border-main-border">
              <span className="text-[10px] font-mono uppercase tracking-wider text-main-text-muted block">
                Total Shifts Scanned
              </span>
              <span className="text-xl font-bold font-mono text-main-text mt-1 block">
                {isScanning ? '...' : summary?.totalScannedShifts ?? 0}
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-surface-2 border border-main-border">
              <span className="text-[10px] font-mono uppercase tracking-wider text-main-text-muted block">
                Shifts Requiring Sync
              </span>
              <span className="text-xl font-bold font-mono text-warning mt-1 block">
                {isScanning ? '...' : summary?.shiftsToUpdate ?? 0}
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-surface-2 border border-main-border">
              <span className="text-[10px] font-mono uppercase tracking-wider text-main-text-muted block">
                Templates to Update
              </span>
              <span className="text-xl font-bold font-mono text-secondary mt-1 block">
                {isScanning ? '...' : summary?.templatesToUpdate ?? 0}
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-surface-2 border border-main-border">
              <span className="text-[10px] font-mono uppercase tracking-wider text-main-text-muted block">
                Presets to Seed
              </span>
              <span className="text-xl font-bold font-mono text-primary mt-1 block">
                {isScanning ? '...' : summary?.templatesCreated ?? 0}
              </span>
            </div>
          </div>

          {/* Options & Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-main-text-muted" />
              <input
                type="text"
                placeholder="Filter planned changes..."
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                className="w-full bg-surface-2 border border-main-border rounded-lg pl-9 pr-3 py-1.5 text-xs text-main-text outline-none focus:border-primary transition-colors"
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-main-text cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={seedPresets}
                  onChange={(e) => setSeedPresets(e.target.checked)}
                  className="rounded border-main-border text-primary focus:ring-0"
                />
                <span>Seed missing standard presets</span>
              </label>
              <button
                type="button"
                onClick={handleRunScan}
                disabled={isScanning || isMigrating}
                className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RotateCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
                <span>Re-Scan</span>
              </button>
            </div>
          </div>

          {/* Planned Mutations Table */}
          <div className="border border-main-border rounded-xl overflow-hidden bg-surface-2/30">
            <div className="px-4 py-2.5 bg-surface-2 border-b border-main-border flex items-center justify-between">
              <span className="text-xs font-semibold text-main-text">
                Planned Mutations ({filteredItems.length} of {summary?.items.length || 0})
              </span>
              <span className="text-[10px] font-mono text-main-text-muted">
                Safe 400-op batch commits
              </span>
            </div>

            {filteredItems.length === 0 ? (
              <div className="py-12 text-center text-xs text-main-text-muted space-y-1">
                {isScanning ? (
                  <p>Auditing records in Firestore...</p>
                ) : summary?.items.length === 0 ? (
                  <div className="flex flex-col items-center gap-2">
                    <ShieldCheck className="w-8 h-8 text-success" />
                    <p className="font-semibold text-main-text">All Database Records Up to Date</p>
                    <p className="text-[11px]">All shifts and templates conform to official timing specifications.</p>
                  </div>
                ) : (
                  <p>No mutations match the active search filter.</p>
                )}
              </div>
            ) : (
              <div className="divide-y divide-main-border max-h-[320px] overflow-y-auto">
                {filteredItems.map((item, idx) => (
                  <div
                    key={item.id + idx}
                    className="p-3 hover:bg-surface-2/60 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-surface-3 border border-main-border text-main-text-muted">
                          {item.collectionName}
                        </span>
                        <span className="font-medium text-main-text">
                          {item.label}
                        </span>
                      </div>
                      <p className="text-[11px] text-main-text-muted">
                        {item.reason}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 font-mono shrink-0">
                      {item.current.startTime ? (
                        <span className="px-2 py-0.5 rounded bg-error-subtle/50 text-error line-through text-[11px]">
                          {item.current.startTime}–{item.current.endTime}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-surface-3 text-main-text-muted text-[11px]">
                          None
                        </span>
                      )}
                      <ArrowRight className="w-3.5 h-3.5 text-main-text-muted" />
                      <span className="px-2 py-0.5 rounded bg-success-subtle text-success font-semibold text-[11px]">
                        {item.proposed.type} ({item.proposed.startTime}–{item.proposed.endTime})
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-main-border bg-surface-2/40 flex items-center justify-between">
          <div className="text-xs text-main-text-muted flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span>Updates timestamps and maintains full relational shift integrity</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary py-1.5 px-3 text-xs cursor-pointer"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleExecuteMigration}
              disabled={
                isScanning ||
                isMigrating ||
                !summary ||
                summary.items.length === 0 ||
                !isAdmin
              }
              className="btn-primary py-1.5 px-4 text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Apply {summary?.items.length || 0} Migrations</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
