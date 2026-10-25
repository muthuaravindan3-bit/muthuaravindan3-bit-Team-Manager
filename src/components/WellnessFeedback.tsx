import React, { useState } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../AuthContext';
import { collection, addDoc } from 'firebase/firestore';
import { Smile, Frown, Meh, AlertCircle, Heart, Send, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function WellnessFeedback() {
  const { user } = useAuth();
  const [status, setStatus] = useState<'optimal' | 'stable' | 'stressed' | 'critical' | null>(null);
  const [score, setScore] = useState(100);
  const [notes, setNotes] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (!user || !status) return;
    setIsLoading(true);
    try {
      await addDoc(collection(db, 'wellness'), {
        userId: user.uid,
        userName: user.displayName || user.email,
        status,
        score,
        notes,
        timestamp: Date.now()
      });
      setIsSubmitted(true);
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'wellness');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-surface-2 border border-primary/20 rounded-2xl p-8 text-center space-y-4"
      >
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto text-primary">
          <Check size={32} />
        </div>
        <h3 className="text-sm font-mono font-bold text-main-text uppercase tracking-widest">Telemetry_Synchronized</h3>
        <p className="text-[10px] font-mono text-main-text-muted uppercase tracking-widest">Your wellness status has been logged in the secure personnel manifest.</p>
        <button 
          onClick={() => setIsSubmitted(false)}
          className="text-[9px] font-mono text-primary uppercase underline tracking-widest"
        >
          Submit_Update
        </button>
      </motion.div>
    );
  }

  return (
    <div className="bg-surface-1 border border-main-border rounded-2xl overflow-hidden shadow-xl">
      <div className="p-6 border-b border-main-border bg-surface-2/50 flex items-center justify-between">
         <div className="flex items-center gap-3">
            <Heart size={18} className="text-primary" />
            <h3 className="text-sm font-mono font-bold text-main-text uppercase tracking-widest">Personnel_Wellness_Check</h3>
         </div>
         <div className="flex gap-1">
            <div className="w-1 h-1 rounded-full bg-primary animate-pulse" />
            <div className="w-1 h-1 rounded-full bg-primary/50" />
            <div className="w-1 h-1 rounded-full bg-primary/20" />
         </div>
      </div>

      <div className="p-8 space-y-8">
         <div className="space-y-4">
            <label className="text-[10px] font-mono text-main-text-muted uppercase tracking-widest font-bold">Select_Operational_State</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
               {[
                 { id: 'optimal', icon: Smile, color: 'text-success', bg: 'bg-success/5' },
                 { id: 'stable', icon: Meh, color: 'text-primary', bg: 'bg-primary/5' },
                 { id: 'stressed', icon: Frown, color: 'text-warning', bg: 'bg-warning/5' },
                 { id: 'critical', icon: AlertCircle, color: 'text-error', bg: 'bg-error/5' }
               ].map(item => (
                 <button
                   key={item.id}
                   onClick={() => {
                     setStatus(item.id as any);
                     setScore(item.id === 'optimal' ? 100 : item.id === 'stable' ? 80 : item.id === 'stressed' ? 50 : 20);
                   }}
                   className={`flex flex-col items-center gap-3 p-4 rounded-xl border transition-all ${
                     status === item.id 
                       ? `border-primary bg-primary/10 shadow-lg shadow-primary/5` 
                       : 'border-main-border bg-surface-2 hover:border-main-border-strong hover:bg-surface-3'
                   }`}
                 >
                    <item.icon size={24} className={status === item.id ? 'text-primary' : 'text-main-text-muted'} />
                    <span className={`text-[9px] font-mono uppercase font-bold ${status === item.id ? 'text-primary' : 'text-main-text-muted'}`}>{item.id}</span>
                 </button>
               ))}
            </div>
         </div>

         <div className="space-y-4">
            <div className="flex items-center justify-between">
               <label className="text-[10px] font-mono text-main-text-muted uppercase tracking-widest font-bold">Status_Notes</label>
               <span className="text-[8px] font-mono text-main-text-muted/40 uppercase">Optional_Context</span>
            </div>
            <textarea 
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Describe any factors impacting operational readiness..."
              className="w-full bg-surface-2 border border-main-border rounded-xl p-4 text-xs text-main-text outline-none focus:border-primary/50 transition-all min-h-[100px] resize-none"
            />
         </div>

         <button 
           onClick={handleSubmit}
           disabled={!status || isLoading}
           className="w-full py-4 bg-primary text-black font-mono text-[11px] font-bold uppercase tracking-[0.3em] rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-primary/20 flex items-center justify-center gap-3 disabled:opacity-50"
         >
            {isLoading ? <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" /> : <Send size={16} />}
            Synchronize_Telemetry
         </button>
      </div>
      
      <div className="px-8 py-4 bg-surface-2 border-t border-main-border">
         <p className="text-[8px] font-mono text-main-text-muted/50 uppercase tracking-widest text-center leading-relaxed">
            NOTICE: Data submitted via this terminal is used solely for workload balancing and resource allocation optimization.
         </p>
      </div>
    </div>
  );
}
