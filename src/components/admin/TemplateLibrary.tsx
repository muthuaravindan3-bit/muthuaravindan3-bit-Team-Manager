import React, { useState } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { ShiftTemplate } from '../../types';
import { Sparkles, Trash2, Clock, Plus, X, Search, Settings as SettingsIcon, ClipboardCheck, ArrowRight, Grid } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface TemplateLibraryProps {
  templates: ShiftTemplate[];
  onLogAction: (action: string, targetId: string, targetName: string, details?: string) => Promise<void>;
}

export function TemplateLibrary({ templates, onLogAction }: TemplateLibraryProps) {
  const [templateName, setTemplateName] = useState('');
  const [templateStartTime, setTemplateStartTime] = useState('09:00');
  const [templateEndTime, setTemplateEndTime] = useState('18:00');
  const [templateType, setTemplateType] = useState('General');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);

  const saveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await updateDoc(doc(db, 'shiftTemplates', editingId), { name: templateName, startTime: templateStartTime, endTime: templateEndTime, type: templateType });
        await onLogAction('UPDATE_TEMPLATE', editingId, templateName, `Config updated: ${templateStartTime}-${templateEndTime}`);
      } else {
        const docRef = await addDoc(collection(db, 'shiftTemplates'), { name: templateName, startTime: templateStartTime, endTime: templateEndTime, type: templateType });
        await onLogAction('CREATE_TEMPLATE', docRef.id, templateName, `Configuration: ${templateStartTime}-${templateEndTime}`);
      }
      setTemplateName('');
      setEditingId(null);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'shiftTemplates');
    }
  };

  const deleteOne = async (id: string, name: string) => {
    try {
      await deleteDoc(doc(db, 'shiftTemplates', id));
      await onLogAction('DELETE_TEMPLATE', id, name, `Removed from memory`);
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, 'shiftTemplates');
    }
  };

  return (
    <div className="space-y-12 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 px-2">
        <div className="space-y-4">
           <div className="flex items-center gap-3">
              <div className="w-1.5 h-8 bg-indigo-500 rounded-full shadow-[0_0_15px_rgba(99,102,241,0.5)]" />
              <h2 className="text-4xl md:text-6xl font-black tracking-tighter text-white italic">PRESETS</h2>
           </div>
           <p className="text-white/30 font-black text-[10px] uppercase tracking-[0.4em] ml-5">Global Blueprint Library for Temporal Rhythms</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-12">
         {/* Config Entry */}
         <div className="lg:col-span-4 lg:sticky lg:top-12 h-fit">
            <div className="glass-card p-10 space-y-8 bg-white/[0.01]">
               <div className="flex items-center gap-4">
                  <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-500">
                     <SettingsIcon size={20} />
                  </div>
                  <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">{editingId ? 'Edit Blueprint' : 'New Configuration'}</h4>
               </div>

               <form onSubmit={saveTemplate} className="space-y-8">
                  <div className="space-y-3">
                     <label className="text-[9px] font-black uppercase tracking-widest text-white/20 ml-4">Blueprint Identifier</label>
                     <input 
                       type="text" 
                       required 
                       value={templateName}
                       onChange={e => setTemplateName(e.target.value)}
                       placeholder="e.g. ALPHA_MORNING"
                       className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white outline-none focus:border-white/20 transition-all font-bold tracking-tight"
                     />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-3">
                        <label className="text-[9px] font-black uppercase tracking-widest text-white/20 ml-4">Start Pulse</label>
                        <input type="time" value={templateStartTime} onChange={e => setTemplateStartTime(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white outline-none font-mono" />
                     </div>
                     <div className="space-y-3">
                        <label className="text-[9px] font-black uppercase tracking-widest text-white/20 ml-4">End Pulse</label>
                        <input type="time" value={templateEndTime} onChange={e => setTemplateEndTime(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white outline-none font-mono" />
                     </div>
                  </div>

                  <div className="space-y-3">
                     <label className="text-[9px] font-black uppercase tracking-widest text-white/20 ml-4">Protocol Category</label>
                     <select value={templateType} onChange={e => setTemplateType(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white outline-none focus:border-white/20 transition-all font-black uppercase tracking-widest">
                        {['General', 'Morning', '2nd Shift', 'Night', 'WO', 'CO', 'AL', 'CH'].map(t => <option key={t} value={t} className="bg-[#0a0a0a]">{t}</option>)}
                     </select>
                  </div>

                  <div className="flex gap-4 pt-4">
                     {editingId && (
                       <button type="button" onClick={() => { setEditingId(null); setTemplateName(''); }} className="flex-1 px-4 py-4 rounded-2xl bg-white/5 text-white/40 font-black text-[10px] uppercase tracking-widest">Abort</button>
                     )}
                     <button type="submit" className="flex-[2] bg-white text-black py-5 rounded-[2rem] font-black text-[10px] uppercase tracking-[0.3em] hover:scale-105 active:scale-95 transition-all shadow-xl shadow-white/10">
                        {editingId ? 'Save Update' : 'Initialize'}
                     </button>
                  </div>
               </form>
            </div>
         </div>

         {/* Grid View */}
         <div className="lg:col-span-8 space-y-8">
            <div className="flex justify-between items-center px-4">
               <div className="flex items-center gap-4">
                  <Grid size={16} className="text-white/20" />
                  <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20">Stored Protocols</h4>
               </div>
               <div className="flex gap-4">
                  <button onClick={() => setSelectedIds(selectedIds.length === templates.length ? [] : templates.map(t => t.id))} className="text-[9px] font-black text-white/20 hover:text-white transition-colors">{selectedIds.length === templates.length ? 'DESELECT' : 'SELECT ALL'}</button>
               </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-6">
               {templates.length === 0 ? (
                  <div className="col-span-full py-32 text-center glass-card border-dashed">
                     <Sparkles className="mx-auto text-white/5 mb-6 opacity-20" size={64} />
                     <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/10">Archive Memory Empty</p>
                  </div>
               ) : (
                  templates.map((t, idx) => (
                     <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        key={t.id} 
                        className={`glass-card p-10 group relative transition-all cursor-pointer ${
                          selectedIds.includes(t.id) ? 'border-white/20 bg-white/5' : 
                          editingId === t.id ? 'border-amber-500/40 ring-1 ring-amber-500/20' : 'hover:border-white/10'
                        }`}
                        onClick={() => setSelectedIds(prev => prev.includes(t.id) ? prev.filter(id => id !== t.id) : [...prev, t.id])}
                     >
                        <div className="flex justify-between items-start mb-8">
                           <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-lg ${
                              t.type === 'Night' ? 'bg-indigo-500/10 text-indigo-400' :
                              t.type === 'Morning' ? 'bg-amber-500/10 text-amber-500' :
                              'bg-white/5 text-white/40'
                           }`}>
                              {t.type} PROTOCOL
                           </span>
                           <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={(e) => { e.stopPropagation(); setEditingId(t.id); setTemplateName(t.name); setTemplateStartTime(t.startTime); setTemplateEndTime(t.endTime); setTemplateType(t.type); }} className="p-2 text-white/40 hover:text-white transition-colors"><SettingsIcon size={14} /></button>
                              <button onClick={(e) => { e.stopPropagation(); deleteOne(t.id, t.name); }} className="p-2 text-white/40 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                           </div>
                        </div>
                        <h4 className="text-2xl font-black italic text-white tracking-tighter mb-4 group-hover:text-blue-500 transition-colors">{t.name}</h4>
                        <div className="flex items-center gap-4 text-white/20">
                           <div className="flex items-center gap-2">
                              <Clock size={14} />
                              <span className="text-xs font-mono font-bold">{t.startTime} — {t.endTime}</span>
                           </div>
                           <ArrowRight size={14} className="opacity-40" />
                        </div>
                     </motion.div>
                  ))
               )}
            </div>
         </div>
      </div>
    </div>
  );
}
