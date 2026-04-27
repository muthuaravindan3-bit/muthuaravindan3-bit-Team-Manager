import React, { useState } from 'react';
import { collection, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { Announcement } from '../../types';
import { format } from 'date-fns';
import { Megaphone, Trash2, Plus, X, Search, Filter, ClipboardCheck, AlertTriangle, ShieldCheck, Clock, MoreHorizontal } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

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
    <div className="space-y-12 max-w-5xl mx-auto pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 px-2">
        <div className="space-y-4">
           <div className="flex items-center gap-3">
              <div className="w-1.5 h-8 bg-amber-500 rounded-full shadow-[0_0_15px_rgba(245,158,11,0.5)]" />
              <h2 className="text-4xl md:text-6xl font-black tracking-tighter text-white italic">BROADCAST</h2>
           </div>
           <p className="text-white/30 font-black text-[10px] uppercase tracking-[0.4em] ml-5">Global Personnel Dispatch & Directives</p>
        </div>
      </div>

      <div className="glass-card p-12 bg-white/[0.01] space-y-8">
        <div className="flex items-center gap-4">
           <div className="p-3 bg-amber-500/10 rounded-xl text-amber-500">
              <Megaphone size={20} />
           </div>
           <h4 className="text-sm font-black uppercase tracking-[0.3em] text-white/40">Initialize Dispatch</h4>
        </div>

        <div className="space-y-6">
           <textarea 
             id="broadcast-message"
             name="broadcast-message"
             value={content}
             onChange={e => setContent(e.target.value)}
             placeholder="Synchronize directive with active personnel..."
             className="w-full h-40 p-8 bg-white/[0.02] border border-white/5 rounded-[2rem] outline-none focus:border-white/10 transition-all resize-none font-mono text-sm text-white/80 placeholder:text-white/10"
           />
           
           <div className="flex flex-col md:flex-row justify-between items-center gap-8">
              <div className="flex bg-black p-1 rounded-2xl border border-white/5 w-fit">
                 {['low', 'high', 'urgent'].map(p => (
                   <button 
                     key={p}
                     onClick={() => setPriority(p as any)}
                     className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                       priority === p 
                       ? (p === 'low' ? 'bg-blue-600 text-white' : p === 'high' ? 'bg-amber-600 text-white' : 'bg-red-600 text-white shadow-lg shadow-red-500/20')
                       : 'text-white/20 hover:text-white/40'
                     }`}
                   >
                     {p}
                   </button>
                 ))}
              </div>
              <button 
                onClick={postAnnouncement}
                disabled={!content.trim()}
                className="w-full md:w-fit bg-white text-black px-12 py-5 rounded-[2rem] font-black text-[11px] uppercase tracking-[0.3em] hover:scale-105 active:scale-95 transition-all shadow-xl shadow-white/10 disabled:opacity-30 flex items-center justify-center gap-3"
              >
                <Plus size={16} />
                <span>Publish Directive</span>
              </button>
           </div>
        </div>
      </div>

      <div className="space-y-6">
         <div className="flex justify-between items-center px-4">
            <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20">Archive Transmission Feed</h4>
            {selectedIds.length > 0 && (
               <button 
                 onClick={() => setShowBulkConfirm(true)}
                 className="px-6 py-2 bg-red-500 text-white rounded-xl font-black text-[9px] uppercase tracking-widest animate-pulse"
               >
                 Terminate {selectedIds.length} Transmission{selectedIds.length > 1 ? 's' : ''}
               </button>
            )}
         </div>

         <div className="space-y-4">
            {announcements.length === 0 ? (
               <div className="glass-card p-20 text-center border-dashed">
                  <Clock className="mx-auto text-white/5 mb-6" size={48} />
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/10">No active transmissions in memory</p>
               </div>
            ) : (
               announcements.map((a, idx) => (
                  <motion.div 
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx * 0.05 }}
                    key={a.id} 
                    onClick={() => setSelectedIds(prev => prev.includes(a.id) ? prev.filter(id => id !== a.id) : [...prev, a.id])}
                    className={`glass-card p-8 group transition-all cursor-pointer relative overflow-hidden ${
                       selectedIds.includes(a.id) ? 'border-white/20 bg-white/5' : 'hover:border-white/10'
                    }`}
                  >
                     <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                       a.priority === 'urgent' ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 
                       a.priority === 'high' ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]' : 
                       'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]'
                     }`} />
                     
                     <div className="flex justify-between items-start gap-8">
                        <div className="space-y-4 flex-1">
                           <div className="flex items-center gap-4">
                              <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded ${
                                a.priority === 'urgent' ? 'bg-red-500/10 text-red-500' : 
                                a.priority === 'high' ? 'bg-amber-500/10 text-amber-500' : 
                                'bg-blue-500/10 text-blue-500'
                              }`}>
                                {a.priority} STRENGTH
                              </span>
                              <span className="text-[10px] font-mono text-white/20 italic">{format(a.createdAt, 'MMM d, HH:mm:ss')}</span>
                           </div>
                           <p className="text-sm font-medium text-white/80 leading-relaxed group-hover:text-white transition-colors">{a.content}</p>
                           <div className="flex items-center gap-2 pt-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-white/10" />
                              <p className="text-[10px] font-black text-white/40 uppercase tracking-widest italic opacity-40">System Origination: {a.authorName}</p>
                           </div>
                        </div>
                        <button 
                           onClick={(e) => { e.stopPropagation(); deleteOne(a.id, a.content); }}
                           className="p-3 text-white/10 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                        >
                           <Trash2 size={16} />
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
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowBulkConfirm(false)} className="fixed inset-0 bg-black/90 backdrop-blur-xl" />
               <div className="relative z-10 text-center space-y-8 max-w-sm">
                  <div className="w-24 h-24 bg-red-500/10 rounded-[3rem] flex items-center justify-center mx-auto text-red-500 border border-red-500/20 shadow-2xl">
                     <AlertTriangle size={48} />
                  </div>
                  <h4 className="text-3xl font-black italic text-white tracking-tighter uppercase">Scrub Stream?</h4>
                  <p className="text-white/20 font-black text-[10px] uppercase tracking-widest leading-loose">Wiping {selectedIds.length} dispatches from the active memory archive. These identifiers will be purged globally.</p>
                  <div className="flex gap-4">
                     <button onClick={() => setShowBulkConfirm(false)} className="flex-1 py-5 rounded-3xl bg-white/5 text-white/40 font-black text-[10px] uppercase tracking-widest hover:bg-white/10 transition-all">Abort</button>
                     <button onClick={deleteSelected} className="flex-1 py-5 rounded-3xl bg-red-600 text-white font-black text-[10px] uppercase tracking-widest shadow-2xl shadow-red-500/30">Purge Data</button>
                  </div>
               </div>
            </div>
         )}
      </AnimatePresence>
    </div>
  );
}
