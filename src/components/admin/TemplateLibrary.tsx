import React, { useState } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { ShiftTemplate } from '../../types';
import { Sparkles, Trash2, Clock, Grid, Settings as SettingsIcon, ArrowRight } from 'lucide-react';
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
    if (!confirm('Destroy this protocol permanentely?')) return;
    try {
      await deleteDoc(doc(db, 'shiftTemplates', id));
      await onLogAction('DELETE_TEMPLATE', id, name, `Removed from memory`);
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, 'shiftTemplates');
    }
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-main-border pb-6">
        <div>
          <h2 className="text-xl font-display font-medium text-main-text flex items-center gap-2">
            <Grid size={20} />
            Preset Protocols
          </h2>
          <p className="text-sm text-main-text-muted mt-1 font-sans">Global blueprint library for temporal rhythms and shifts.</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-8">
         {/* Config Entry */}
         <div className="lg:col-span-4 lg:sticky lg:top-8 h-fit">
            <div className="bg-surface-1 border border-main-border rounded-md p-6 space-y-8">
               <div className="flex items-center gap-3 text-main-text-muted/30">
                  <SettingsIcon size={14} />
                  <h4 className="text-[9px] font-mono uppercase tracking-[0.2em]">{editingId ? 'Edit Configuration' : 'New Blueprint'}</h4>
               </div>

               <form onSubmit={saveTemplate} className="space-y-6">
                  <div className="space-y-2">
                     <label className="text-[9px] font-mono uppercase tracking-widest text-main-text-muted/40 ml-1">Blueprint Identifier</label>
                     <input 
                       type="text" 
                       required 
                       value={templateName}
                       onChange={e => setTemplateName(e.target.value)}
                       placeholder="ALPHA_MORNING"
                       className="w-full bg-surface-2 border border-main-border rounded px-4 py-2.5 text-sm text-main-text outline-none focus:border-primary/50 transition-all font-medium uppercase tracking-tight"
                     />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-2">
                        <label className="text-[9px] font-mono uppercase tracking-widest text-main-text-muted/40 ml-1">Start Pulse</label>
                        <input type="time" value={templateStartTime} onChange={e => setTemplateStartTime(e.target.value)} className="w-full bg-surface-2 border border-main-border rounded px-4 py-2.5 text-sm text-main-text outline-none font-mono" />
                     </div>
                     <div className="space-y-2">
                        <label className="text-[9px] font-mono uppercase tracking-widest text-main-text-muted/40 ml-1">End Pulse</label>
                        <input type="time" value={templateEndTime} onChange={e => setTemplateEndTime(e.target.value)} className="w-full bg-surface-2 border border-main-border rounded px-4 py-2.5 text-sm text-main-text outline-none font-mono" />
                     </div>
                  </div>

                  <div className="space-y-2">
                     <label className="text-[9px] font-mono uppercase tracking-widest text-main-text-muted/40 ml-1">Protocol Category</label>
                     <select value={templateType} onChange={e => setTemplateType(e.target.value)} className="w-full bg-surface-2 border border-main-border rounded px-4 py-2.5 text-sm text-main-text outline-none focus:border-primary/50 transition-all font-mono uppercase tracking-widest appearance-none">
                        {['General', 'Morning', '2nd Shift', 'Night', 'WO', 'CO', 'AL', 'CH'].map(t => <option key={t} value={t} className="bg-surface-1">{t}</option>)}
                     </select>
                  </div>

                  <div className="flex gap-3 pt-2">
                     {editingId && (
                       <button type="button" onClick={() => { setEditingId(null); setTemplateName(''); }} className="flex-1 px-4 py-2 rounded bg-surface-2 border border-main-border text-main-text-muted font-mono text-[9px] uppercase tracking-widest">Abort</button>
                     )}
                     <button type="submit" className="flex-[2] bg-primary hover:bg-primary-hover text-surface-1 py-2.5 rounded font-mono text-[10px] uppercase tracking-widest transition-colors">
                        {editingId ? 'COMMIT CHANGES' : 'INITIALIZE'}
                     </button>
                  </div>
               </form>
            </div>
         </div>

         {/* Grid View */}
         <div className="lg:col-span-8 space-y-6">
            <div className="flex justify-between items-center px-1">
               <div className="flex items-center gap-3">
                  <Grid size={14} className="text-main-text-muted/20" />
                  <h4 className="text-[10px] font-mono uppercase tracking-[0.2em] text-main-text-muted/40">Stored Protocols</h4>
               </div>
               <div className="flex gap-4">
                  <button onClick={() => setSelectedIds(selectedIds.length === templates.length ? [] : templates.map(t => t.id))} className="text-[8px] font-mono text-main-text-muted/30 hover:text-main-text transition-colors tracking-[0.2em] uppercase">{selectedIds.length === templates.length ? 'Deselect All' : 'Select All Archives'}</button>
               </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
               {templates.length === 0 ? (
                  <div className="col-span-full py-24 text-center bg-surface-1 border border-main-border border-dashed rounded-md">
                     <Sparkles className="mx-auto text-main-text-muted/5 mb-4" size={48} />
                     <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-main-text-muted/30">Archive memory empty</p>
                  </div>
               ) : (
                  templates.map((t, idx) => (
                     <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        key={t.id} 
                        className={`bg-surface-1 border rounded-md p-6 group relative transition-all cursor-pointer ${
                          selectedIds.includes(t.id) ? 'border-primary shadow-[0_0_15px_rgba(99,102,241,0.1)]' : 
                          editingId === t.id ? 'border-warning/50' : 'hover:border-main-border/80 border-main-border'
                        }`}
                        onClick={() => setSelectedIds(prev => prev.includes(t.id) ? prev.filter(id => id !== t.id) : [...prev, t.id])}
                     >
                        <div className="flex justify-between items-start mb-6">
                           <span className={`text-[8px] font-mono uppercase px-2 py-0.5 rounded border ${
                              t.type === 'Night' ? 'border-primary/30 text-primary bg-primary/5' :
                              t.type === 'Morning' ? 'border-warning/30 text-warning bg-warning/5' :
                              'border-main-border text-main-text-muted/40'
                           }`}>
                              {t.type} PROTOCOL
                           </span>
                           <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={(e) => { e.stopPropagation(); setEditingId(t.id); setTemplateName(t.name); setTemplateStartTime(t.startTime); setTemplateEndTime(t.endTime); setTemplateType(t.type); }} className="p-1.5 text-main-text-muted/40 hover:text-main-text transition-colors border border-transparent hover:border-main-border rounded"><SettingsIcon size={12} /></button>
                              <button onClick={(e) => { e.stopPropagation(); deleteOne(t.id, t.name); }} className="p-1.5 text-main-text-muted/40 hover:text-error transition-colors border border-transparent hover:border-error/30 rounded"><Trash2 size={12} /></button>
                           </div>
                        </div>
                        <h4 className="text-lg font-medium text-main-text tracking-tight uppercase mb-4">{t.name}</h4>
                        <div className="flex items-center justify-between text-main-text-muted/40">
                           <div className="flex items-center gap-2">
                              <Clock size={12} />
                              <span className="text-[10px] font-mono">{t.startTime} — {t.endTime}</span>
                           </div>
                           <ArrowRight size={12} className="opacity-20 translate-x-0 group-hover:translate-x-1 transition-transform" />
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
