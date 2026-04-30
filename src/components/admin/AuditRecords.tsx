import React, { useState } from 'react';
import { AuditLog } from '../../types';
import { format } from 'date-fns';
import { History, Trash2, Search, Filter, Shield, Activity, User, MoreHorizontal, Terminal, ArrowUpRight, Brain, Sparkles, Loader2, X, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, getDocs, deleteDoc, doc, query } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { analyzeAuditLogs, AuditIntelligence } from '../../geminiService';

interface AuditRecordsProps {
  auditLogs: AuditLog[];
  onLogAction: (action: string, targetId: string, targetName: string, details?: string) => Promise<void>;
}

export function AuditRecords({ auditLogs, onLogAction }: AuditRecordsProps) {
  const [viewMode, setViewMode] = useState<'table' | 'terminal'>('table');
  const [filterText, setFilterText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [intelligence, setIntelligence] = useState<AuditIntelligence | null>(null);

  const filteredLogs = auditLogs.filter(log => 
    log.action.toLowerCase().includes(filterText.toLowerCase()) ||
    (log.adminName || '').toLowerCase().includes(filterText.toLowerCase()) ||
    (log.targetName || '').toLowerCase().includes(filterText.toLowerCase())
  );

  const runLogAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const result = await analyzeAuditLogs(auditLogs);
      setIntelligence(result);
    } catch (e) {
      console.error("Analysis failed:", e);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const clearAuditLogs = async () => {
    if (!window.confirm("System purge of all audit history. This record will be erased permanently from the black box. Proceed?")) return;
    try {
      const snapshot = await getDocs(query(collection(db, 'auditLogs')));
      for (const d of snapshot.docs) {
        await deleteDoc(doc(db, 'auditLogs', d.id));
      }
      await onLogAction('PURGE_AUDIT_LOGS', 'system', 'Logic Archive', 'Global erasure executed');
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, 'auditLogs');
    }
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-main-border pb-6">
        <div>
          <h2 className="text-xl font-display font-medium text-main-text flex items-center gap-2">
            <History size={20} />
            Security Audit
          </h2>
          <p className="text-sm text-main-text-muted mt-1 font-sans">Full archive of administrative operations and system events.</p>
        </div>
        <div className="flex gap-4">
           <div className="flex bg-surface-2 p-1 rounded border border-main-border">
              <button 
                onClick={() => setViewMode('table')}
                className={`px-3 py-1 rounded text-[9px] font-mono uppercase tracking-widest transition-all ${viewMode === 'table' ? 'bg-primary text-black font-bold' : 'text-main-text-muted hover:text-main-text'}`}
              >
                Table
              </button>
              <button 
                onClick={() => setViewMode('terminal')}
                className={`px-3 py-1 rounded text-[9px] font-mono uppercase tracking-widest transition-all ${viewMode === 'terminal' ? 'bg-primary text-black font-bold' : 'text-main-text-muted hover:text-main-text'}`}
              >
                Terminal
              </button>
           </div>
           <button 
             onClick={runLogAnalysis}
             disabled={isAnalyzing}
             className="px-4 py-2 bg-surface-2 hover:bg-surface-3 text-primary rounded-md transition-colors font-mono text-[10px] uppercase tracking-widest border border-primary/20 flex items-center gap-2"
           >
              {isAnalyzing ? <Loader2 size={14} className="animate-spin" /> : <Brain size={14} />}
              <span>{isAnalyzing ? 'Analyzing...' : 'Deep_Scan'}</span>
           </button>
           <button 
             onClick={clearAuditLogs}
             className="px-4 py-2 bg-error-subtle text-error rounded-md hover:bg-error hover:text-white transition-colors font-mono text-[10px] uppercase tracking-widest border border-error/20 active:scale-[0.98]"
           >
             Clear Records
           </button>
        </div>
      </div>

      <AnimatePresence>
         {intelligence && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-surface-1 border border-primary/20 rounded-lg overflow-hidden shadow-2xl relative"
            >
               <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-primary/50 to-transparent animate-shimmer" />
               <div className="p-6 space-y-6">
                  <div className="flex justify-between items-start">
                     <div className="flex items-center gap-3">
                        <Sparkles size={18} className="text-primary" />
                        <div>
                           <h3 className="text-sm font-medium text-main-text uppercase tracking-tight italic">Cortex Audit Intelligence</h3>
                           <p className="text-[10px] font-mono text-main-text-muted uppercase">Intelligence_Packet_Ref::{Date.now()}</p>
                        </div>
                     </div>
                     <div className="flex items-center gap-4">
                        <div className="flex flex-col items-end">
                           <span className="text-[8px] font-mono text-main-text-muted uppercase">Global_Risk_Factor</span>
                           <span className={`text-xs font-mono font-bold uppercase ${
                              intelligence.threatLevel === 'high' ? 'text-error' :
                              intelligence.threatLevel === 'moderate' ? 'text-warning' : 'text-success'
                           }`}>
                              {intelligence.threatLevel}_Threat
                           </span>
                        </div>
                        <button onClick={() => setIntelligence(null)} className="text-main-text-muted hover:text-main-text">
                           <X size={16} />
                        </button>
                     </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-8">
                     <div className="space-y-4">
                        <div className="space-y-1">
                           <h4 className="text-[10px] font-mono uppercase text-primary font-bold tracking-widest">ExecutiveSummary</h4>
                           <p className="text-[11px] font-sans text-main-text italic leading-relaxed">"{intelligence.summary}"</p>
                        </div>
                        <div className="space-y-2">
                           <h4 className="text-[10px] font-mono uppercase text-primary font-bold tracking-widest">AnomalyDetection</h4>
                           <div className="space-y-1.5">
                              {intelligence.suspiciousPatterns.map((pattern, i) => (
                                 <div key={i} className="flex items-start gap-2 text-[10px] text-main-text-muted">
                                    <AlertCircle size={10} className="text-warning mt-0.5 shrink-0" />
                                    <span>{pattern}</span>
                                 </div>
                              ))}
                              {intelligence.suspiciousPatterns.length === 0 && (
                                 <p className="text-[10px] font-mono text-success uppercase">No operational anomalies detected.</p>
                              )}
                           </div>
                        </div>
                     </div>
                     <div className="space-y-4 border-l border-main-border pl-8">
                        <h4 className="text-[10px] font-mono uppercase text-primary font-bold tracking-widest">StrategicProtocols</h4>
                        <div className="grid gap-2">
                           {intelligence.recommendations.map((rec, i) => (
                              <div key={i} className="flex items-center gap-3 p-3 bg-surface-2 rounded border border-main-border group hover:border-primary/30 transition-all">
                                 <div className="w-1 h-1 rounded-full bg-primary" />
                                 <span className="text-[10px] font-mono text-main-text uppercase tracking-tight">{rec}</span>
                              </div>
                           ))}
                        </div>
                     </div>
                  </div>
               </div>
            </motion.div>
         )}
      </AnimatePresence>

      <div className="bg-surface-1 border border-main-border rounded-md overflow-hidden min-h-[60vh] flex flex-col">
        <div className="px-6 py-3 border-b border-main-border bg-surface-2 flex items-center justify-between">
           <div className="flex items-center gap-3">
              <Terminal size={14} className="text-main-text-muted" />
              <h4 className="text-[10px] font-mono uppercase tracking-widest text-main-text-muted">Activity Stream</h4>
           </div>
           <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-main-text-muted/30" size={10} />
              <input 
                type="text"
                placeholder="FILTER_ARCHIVE..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                className="bg-surface-1 border border-main-border rounded pl-8 pr-3 py-1 text-[9px] font-mono uppercase tracking-widest outline-none focus:border-primary/50 text-main-text-muted transition-colors"
              />
           </div>
        </div>

        <div className="flex-1 overflow-x-auto overflow-y-auto scrollbar-thin">
           {viewMode === 'table' ? (
             <table className="w-full text-left">
               <thead>
                 <tr className="text-[10px] font-mono uppercase tracking-widest text-main-text-muted border-b border-main-border bg-surface-2/50">
                   <th className="px-8 py-3">Timestamp</th>
                   <th className="px-8 py-3">Actor</th>
                   <th className="px-8 py-3">Operation</th>
                   <th className="px-8 py-3">Subject</th>
                   <th className="px-8 py-3 text-right">Reference</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-main-border">
                 {filteredLogs.length === 0 ? (
                   <tr>
                     <td colSpan={5} className="py-24 text-center">
                        <History className="mx-auto text-main-text-muted/20 mb-4" size={48} />
                        <p className="font-mono text-[10px] uppercase text-main-text-muted/50 tracking-widest">No logs found in archive</p>
                     </td>
                   </tr>
                 ) : (
                   filteredLogs.map((log, idx) => (
                     <motion.tr 
                       initial={{ opacity: 0 }}
                       animate={{ opacity: 1 }}
                       transition={{ delay: idx * 0.01 }}
                       key={log.id} 
                       className="group hover:bg-surface-2 transition-colors"
                     >
                       <td className="px-8 py-4 text-main-text-muted text-[10px] font-mono uppercase whitespace-nowrap">
                         {format(log.timestamp, 'HH:mm')} <span className="opacity-30 mx-1">/</span> {format(log.timestamp, 'dd.MM')}
                       </td>
                       <td className="px-8 py-4">
                          <div className="flex items-center gap-2">
                             <div className="w-5 h-5 rounded bg-surface-3 border border-main-border flex items-center justify-center text-[9px] font-mono text-main-text-muted uppercase">{(log.adminName || '?').charAt(0).toUpperCase()}</div>
                             <span className="text-[10px] uppercase font-medium text-main-text-muted group-hover:text-main-text transition-colors">{log.adminName}</span>
                          </div>
                       </td>
                       <td className="px-8 py-4">
                          <span className={`text-[9px] font-mono uppercase tracking-wider ${
                            log.action.includes('DELETE') || log.action.includes('REJECT') || log.action.includes('PURGE') 
                            ? 'text-error font-bold' :
                            log.action.includes('CREATE') || log.action.includes('APPROVE') 
                            ? 'text-success font-bold' :
                            'text-primary font-bold'
                          }`}>
                            {log.action.replace(/_/g, ' ')}
                          </span>
                       </td>
                       <td className="px-8 py-4">
                          <span className="text-[10px] font-mono uppercase text-main-text-muted whitespace-nowrap">{log.targetName}</span>
                       </td>
                       <td className="px-8 py-4 text-right">
                          <span className="text-[9px] font-mono uppercase text-main-text-muted/50 truncate max-w-[150px] inline-block">{log.details || 'SYSTEM_PROC_EVENT'}</span>
                       </td>
                     </motion.tr>
                   ))
                 )}
               </tbody>
             </table>
           ) : (
             <div className="p-8 font-mono space-y-2 bg-black/10 min-h-full">
                <div className="text-[10px] text-primary/50 mb-6 uppercase tracking-[0.4em] font-bold">-- OMEGA_AUDIT_TERMINAL_V4.2_ONLINE --</div>
                {filteredLogs.map((log, idx) => (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.005 }}
                    key={log.id} 
                    className="text-[10px] flex gap-4 hover:bg-white/5 p-1 rounded-sm transition-colors group cursor-default"
                  >
                     <span className="text-main-text-muted opacity-40 min-w-[120px]">[{format(log.timestamp, 'yyyy-MM-dd HH:mm:ss')}]</span>
                     <span className="text-primary font-bold min-w-[100px]">[{log.adminName}]</span>
                     <span className={`font-bold min-w-[130px] ${
                       log.action.includes('DELETE') || log.action.includes('REJECT') ? 'text-error' : 'text-success'
                     }`}>{log.action}</span>
                     <span className="text-main-text opacity-80 min-w-[150px]">Subject::{log.targetName}</span>
                     <span className="text-main-text-muted italic opacity-0 group-hover:opacity-100 transition-opacity">({log.details})</span>
                  </motion.div>
                ))}
                <div className="flex gap-2 text-[10px] text-primary/30 mt-8">
                  <div className="w-1.5 h-3 bg-primary animate-pulse" />
                  <span className="uppercase tracking-widest font-bold">Awaiting_Input_Vector</span>
                </div>
             </div>
           )}
        </div>
      </div>
    </div>
  );
}
