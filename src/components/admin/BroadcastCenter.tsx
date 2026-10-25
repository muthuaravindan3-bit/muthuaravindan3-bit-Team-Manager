import React, { useState } from 'react';
import { collection, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { Announcement } from '../../types';
import { format } from 'date-fns';
import { Megaphone, Trash2, Plus, X, Search, Filter, ClipboardCheck, AlertTriangle, ShieldCheck, Clock, MoreHorizontal, Terminal, Sparkles, Brain, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { optimizeBroadcastMessage } from '../../geminiService';

interface BroadcastCenterProps {
  announcements: Announcement[];
  userName: string;
  onLogAction: (action: string, targetId: string, targetName: string, details?: string) => Promise<void>;
}

export function BroadcastCenter({ announcements, userName, onLogAction }: BroadcastCenterProps) {
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState<'low' | 'high' | 'urgent'>('low');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimization, setOptimization] = useState<{ tone: string, impact: number } | null>(null);

  const handleOptimize = async () => {
    if (!content) return;
    setIsOptimizing(true);
    try {
      const geminiPriority = priority === 'urgent' ? 'critical' : priority === 'high' ? 'high' : 'medium';
      const result = await optimizeBroadcastMessage(content, geminiPriority as any);
      setContent(result.refinedMessage);
      setOptimization({ tone: result.toneAnalysis, impact: result.impactRating });
    } catch (e) {
      console.error("Optimization failed:", e);
    } finally {
      setIsOptimizing(false);
    }
  };

  const postAnnouncement = async () => {
    if (!content.trim()) return;
    try {
      const docRef = await addDoc(collection(db, 'announcements'), {
        content: content.trim(),
        priority,
        authorName: userName,
        createdAt: Date.now()
      });
      await onLogAction('POST_ANNOUNCEMENT', docRef.id, 'Global Feed', content.slice(0, 50));
      setContent('');
      setPriority('low');
      setOptimization(null);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'announcements');
    }
  };

  const deleteOne = async (id: string, text: string) => {
    try {
      await deleteDoc(doc(db, 'announcements', id));
      await onLogAction('DELETE_ANNOUNCEMENT', id, 'Global Feed', text.slice(0, 30));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, 'announcements');
    }
  };

  const deleteSelected = async () => {
    try {
      for (const id of selectedIds) {
        await deleteDoc(doc(db, 'announcements', id));
      }
      await onLogAction('BATCH_DELETE_ANNOUNCEMENTS', 'multiple', 'Global Feed', `Removed ${selectedIds.length} entries`);
      setSelectedIds([]);
      setShowBulkConfirm(false);
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, 'announcements');
    }
  };

  return (
    <div className="space-y-8 max-w-4xl pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-main-border pb-6">
        <div>
          <h2 className="text-xl font-display font-medium text-main-text flex items-center gap-2">
            <Megaphone size={20} />
            Broadcast Center
          </h2>
          <p className="text-sm text-main-text-muted mt-1 font-sans">Global Personnel Dispatch & Directives.</p>
        </div>
      </div>

      <div className="bg-surface-1 border border-main-border rounded-md p-6 space-y-6">
        <div className="flex items-center gap-3">
           <Terminal size={14} className="text-main-text-muted" />
           <h4 className="text-[10px] font-mono uppercase tracking-widest text-main-text-muted">Initialize Dispatch</h4>
        </div>

        <div className="space-y-4">
           <textarea 
             id="broadcast-message"
             name="broadcast-message"
             value={content}
             onChange={e => setContent(e.target.value)}
             placeholder="Synchronize directive with active personnel..."
             className="w-full h-32 p-4 bg-surface-2 border border-main-border rounded outline-none focus:border-primary transition-colors resize-none font-mono text-xs text-main-text placeholder:text-main-text-muted/30"
           />

           <AnimatePresence>
              {optimization && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mt-6 mb-2 p-4 bg-primary/5 border border-primary/20 rounded-md space-y-2 relative"
                >
                   <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                         <Sparkles size={12} className="text-primary" />
                         <span className="text-[9px] font-mono uppercase text-primary font-bold">Cortex_Comms_Optimization</span>
                      </div>
                      <div className="flex items-center gap-2">
                         <span className="text-[8px] font-mono text-main-text-muted uppercase">Impact:</span>
                         <span className="text-[10px] font-mono font-bold text-primary">{optimization.impact}%</span>
                      </div>
                   </div>
                   <p className="text-[10px] italic text-main-text leading-relaxed">"{optimization.tone}"</p>
                </motion.div>
              )}
           </AnimatePresence>
           
           <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex bg-surface-2 p-1 rounded border border-main-border w-fit">
                 {['low', 'high', 'urgent'].map(p => (
                   <button 
                     key={p}
                     onClick={() => setPriority(p as any)}
                     className={`px-4 py-1.5 rounded transition-colors font-mono text-[9px] uppercase tracking-widest ${
                       priority === p 
                       ? (p === 'low' ? 'bg-info text-white' : p === 'high' ? 'bg-warning text-white' : 'bg-error text-white')
                       : 'text-main-text-muted hover:text-main-text'
                     }`}
                   >
                     {p}
                   </button>
                 ))}
              </div>
              <div className="flex gap-4 w-full md:w-fit">
                <button 
                  onClick={handleOptimize}
                  disabled={isOptimizing || !content}
                  className="flex-1 md:w-fit bg-surface-2 hover:bg-surface-3 text-primary border border-primary/20 px-6 py-2 rounded font-mono text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                   {isOptimizing ? <Loader2 size={14} className="animate-spin" /> : <Brain size={14} />}
                   <span>{isOptimizing ? 'Optimizing...' : 'Refine_with_AI'}</span>
                </button>
                <button 
                  onClick={postAnnouncement}
                  disabled={!content.trim()}
                  className="flex-1 md:w-fit bg-primary text-surface-1 px-8 py-2 rounded font-mono text-[10px] uppercase tracking-widest hover:bg-primary-hover active:scale-[0.98] transition-colors disabled:opacity-30 flex items-center justify-center gap-2"
                >
                  <Plus size={14} />
                  <span>Publish Directive</span>
                </button>
              </div>
           </div>
        </div>
      </div>

      <div className="space-y-4">
         <div className="flex justify-between items-center px-2">
            <h4 className="text-[10px] font-mono uppercase tracking-widest text-main-text-muted">Archive Transmission Feed</h4>
            {selectedIds.length > 0 && (
               <button 
                 onClick={() => setShowBulkConfirm(true)}
                 className="px-3 py-1 bg-error text-white rounded font-mono text-[9px] uppercase tracking-widest"
               >
                 Terminate {selectedIds.length} Transmission{selectedIds.length > 1 ? 's' : ''}
               </button>
            )}
         </div>

         <div className="space-y-3">
            {announcements.length === 0 ? (
               <div className="bg-surface-1 border border-main-border border-dashed p-12 text-center rounded-md">
                  <Clock className="mx-auto text-main-text-muted/10 mb-4" size={32} />
                  <p className="text-[10px] font-mono uppercase tracking-widest text-main-text-muted/50">No active transmissions in memory</p>
               </div>
            ) : (
               announcements.map((a, idx) => (
                  <motion.div 
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: idx * 0.05 }}
                    key={a.id} 
                    onClick={() => setSelectedIds(prev => prev.includes(a.id) ? prev.filter(id => id !== a.id) : [...prev, a.id])}
                    className={`bg-surface-1 border rounded-md p-4 group transition-all cursor-pointer relative overflow-hidden ${
                       selectedIds.includes(a.id) ? 'border-primary ring-1 ring-primary/20' : 'border-main-border hover:border-main-text-muted/30'
                    }`}
                  >
                     <div className={`absolute left-0 top-0 bottom-0 w-0.5 ${
                       a.priority === 'urgent' ? 'bg-error' : 
                       a.priority === 'high' ? 'bg-warning' : 
                       'bg-info'
                     }`} />
                     
                     <div className="flex justify-between items-start gap-6">
                        <div className="space-y-3 flex-1">
                           <div className="flex items-center gap-3">
                              <span className={`text-[8px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded border ${
                                a.priority === 'urgent' ? 'border-error/20 text-error bg-error/5' : 
                                a.priority === 'high' ? 'border-warning/20 text-warning bg-warning/5' : 
                                'border-info/20 text-info bg-info/5'
                              }`}>
                                {a.priority} STRENGTH
                              </span>
                              <span className="text-[9px] font-mono text-main-text-muted/50 italic">{format(a.createdAt, 'MMM d, HH:mm')}</span>
                           </div>
                           <p className="text-xs text-main-text-muted leading-relaxed group-hover:text-main-text transition-colors">{a.content}</p>
                           <p className="text-[8px] font-mono text-main-text-muted/30 uppercase tracking-widest">Origination: {a.authorName}</p>
                        </div>
                        <button 
                           onClick={(e) => { e.stopPropagation(); deleteOne(a.id, a.content); }}
                           className="p-2 text-main-text-muted hover:text-error transition-colors"
                         >
                           <Trash2 size={14} />
                        </button>
                     </div>
                  </motion.div>
               ))
            )}
         </div>
      </div>

      <AnimatePresence>
         {showBulkConfirm && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowBulkConfirm(false)} className="fixed inset-0 bg-black/80 backdrop-blur-sm" />
               <div className="relative z-10 text-center space-y-6 max-w-sm bg-surface-1 border border-main-border p-8 rounded-md">
                  <div className="w-16 h-16 bg-error/5 rounded-full flex items-center justify-center mx-auto text-error border border-error/10">
                     <AlertTriangle size={32} />
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xl font-display text-main-text uppercase">Scrub Stream?</h4>
                    <p className="text-main-text-muted font-mono text-[10px] uppercase tracking-widest leading-relaxed">Wiping {selectedIds.length} identifiers from memory. Irreversible operation.</p>
                  </div>
                  <div className="flex gap-3">
                     <button onClick={() => setShowBulkConfirm(false)} className="flex-1 py-2 rounded bg-surface-2 text-main-text-muted font-mono text-[10px] uppercase tracking-widest hover:bg-surface-3">Abort</button>
                     <button onClick={deleteSelected} className="flex-1 py-2 rounded bg-error text-white font-mono text-[10px] uppercase tracking-widest hover:bg-error/90 active:scale-[0.98]">Purge Data</button>
                  </div>
               </div>
            </div>
         )}
      </AnimatePresence>
    </div>
  );
}
