import React, { useState } from 'react';
import { useAuth } from '../AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { X, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface UserSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UserSettings({ isOpen, onClose }: UserSettingsProps) {
  const { profile, user } = useAuth();
  const [saving, setSaving] = useState(false);
  
  const [timezone, setTimezone] = useState(profile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        timezone
      });
      onClose();
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'users');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-surface-1/95 backdrop-blur-md"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="bg-surface-1 border border-main-border w-full max-w-lg rounded-md overflow-hidden relative z-10 shadow-[0_24px_48px_rgba(0,0,0,0.4)]"
          >
            <div className="flex justify-between items-center p-8 border-b border-main-border bg-surface-2">
              <div className="space-y-1">
                <h3 className="text-xl font-display font-medium text-main-text uppercase tracking-tight">Identity Configuration</h3>
                <p className="text-[9px] font-mono text-main-text-muted uppercase tracking-[0.3em]">Personal preference adjustments</p>
              </div>
              <button 
                onClick={onClose} 
                className="w-10 h-10 border border-main-border flex items-center justify-center text-main-text-muted hover:text-main-text hover:border-main-text/50 transition-all rounded"
              >
                <X size={16} />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-8 space-y-10">
              <div className="space-y-4">
                <label className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-main-text-muted flex items-center gap-3">
                  <Globe size={14} className="text-primary" /> 
                  Temporal Localization
                </label>
                <div className="relative group">
                  <select
                    value={timezone}
                    onChange={e => setTimezone(e.target.value)}
                    className="w-full bg-surface-2 border border-main-border rounded px-5 py-4 text-sm font-mono text-main-text outline-none focus:border-primary/50 transition-all appearance-none cursor-pointer group-hover:border-main-border-strong"
                  >
                    <option value="">NODE_DEFAULT_SYSTEM</option>
                    {Intl.supportedValuesOf('timeZone').map(tz => (
                      <option key={tz} value={tz}>{tz.toUpperCase().replace(/\//g, ' // ')}</option>
                    ))}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-20 group-hover:opacity-100 transition-opacity">
                    <Globe size={12} />
                  </div>
                </div>
                <div className="p-4 bg-surface-2/50 border border-main-border/30 rounded flex gap-4">
                  <div className="text-primary mt-0.5 whitespace-nowrap text-[10px] font-mono">[!]</div>
                  <p className="text-[10px] font-mono text-main-text-muted leading-relaxed uppercase tracking-tight">
                    Temporal persistence logic: all system logs and operational manifests will synchronize to this localization coordinate.
                  </p>
                </div>
              </div>

              <div className="pt-6 border-t border-main-border flex justify-between items-center -mx-8 -mb-8 p-8 bg-surface-2">
                <button 
                  type="button" 
                  onClick={onClose} 
                  className="text-[10px] font-mono text-main-text-muted/40 hover:text-error transition-colors uppercase tracking-widest"
                >
                  Abort_Sync
                </button>
                <button 
                  type="submit" 
                  disabled={saving || !user}
                  className="bg-primary hover:bg-primary-hover text-surface-1 px-12 py-3 rounded font-mono text-[10px] uppercase tracking-[0.4em] transition-all disabled:opacity-50 shadow-xl shadow-primary/10 active:scale-95"
                >
                  {saving ? 'EXECUTING_SYNC...' : 'Push_Settings'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
