import React from 'react';
import { AuditLog } from '../../types';
import { format } from 'date-fns';
import { History, Trash2, Search, Filter, Shield, Activity, User, MoreHorizontal, Terminal, ArrowUpRight } from 'lucide-react';
import { motion } from 'motion/react';
import { collection, getDocs, deleteDoc, doc, query } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase';

interface AuditRecordsProps {
  auditLogs: AuditLog[];
  onLogAction: (action: string, targetId: string, targetName: string, details?: string) => Promise<void>;
}

export function AuditRecords({ auditLogs, onLogAction }: AuditRecordsProps) {
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
    <div className="space-y-10 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-white/5 pb-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-white mb-2">Security Audit</h1>
          <p className="text-slate-400 font-medium">Comprehensive archive of administrative actions and system events.</p>
        </div>
        <div className="flex gap-4">
           <button 
             onClick={clearAuditLogs}
             className="px-6 py-3 bg-red-600/10 text-red-500 rounded-xl hover:bg-red-600 hover:text-white transition-all font-bold text-xs uppercase tracking-widest border border-red-500/20 active:scale-95"
           >
             Clear Records
           </button>
        </div>
      </div>

      <div className="bg-zinc-900 border border-white/5 rounded-3xl overflow-hidden shadow-sm">
        <div className="p-6 border-b border-white/5 bg-black/20 flex items-center justify-between">
           <div className="flex items-center gap-3">
              <Terminal size={18} className="text-slate-500" />
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Activity Stream</h4>
           </div>
        </div>

        <div className="overflow-x-auto no-scrollbar">
           <table className="w-full text-left">
             <thead>
               <tr className="text-[10px] font-bold uppercase tracking-widest text-slate-500 border-b border-white/5 bg-black/10">
                 <th className="px-10 py-5">Timestamp</th>
                 <th className="px-10 py-5">Actor</th>
                 <th className="px-10 py-5">Operation</th>
                 <th className="px-10 py-5">Subject</th>
                 <th className="px-10 py-5 text-right">Details</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-white/5 font-sans">
               {auditLogs.length === 0 ? (
                 <tr>
                   <td colSpan={5} className="py-24 text-center">
                      <History className="mx-auto text-slate-800 mb-4" size={48} />
                      <p className="font-bold uppercase text-slate-600 tracking-widest text-[10px]">No logs found in archive</p>
                   </td>
                 </tr>
               ) : (
                 auditLogs.map((log, idx) => (
                   <motion.tr 
                     initial={{ opacity: 0, y: 5 }}
                     animate={{ opacity: 1, y: 0 }}
                     transition={{ delay: idx * 0.01 }}
                     key={log.id} 
                     className="group hover:bg-white/[0.01] transition-colors"
                   >
                     <td className="px-10 py-6 text-slate-500 text-[11px] font-medium uppercase whitespace-nowrap">
                       {format(log.timestamp, 'HH:mm:ss')} <span className="opacity-30 mx-1">|</span> {format(log.timestamp, 'dd MMM')}
                     </td>
                     <td className="px-10 py-6">
                        <div className="flex items-center gap-2.5">
                           <div className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center text-[10px] font-bold text-slate-400">{(log.adminName || '?').charAt(0).toUpperCase()}</div>
                           <span className="font-bold text-slate-300 text-sm">{log.adminName}</span>
                        </div>
                     </td>
                     <td className="px-10 py-6">
                       <span className={`px-2 py-1 rounded-lg font-bold text-[9px] uppercase tracking-widest ${
                         log.action.includes('DELETE') || log.action.includes('REJECT') || log.action.includes('PURGE') 
                         ? 'bg-red-500/10 text-red-500' :
                         log.action.includes('CREATE') || log.action.includes('APPROVE') 
                         ? 'bg-emerald-500/10 text-emerald-500' :
                         'bg-indigo-500/10 text-indigo-400'
                       }`}>
                         {log.action.replace(/_/g, ' ')}
                       </span>
                     </td>
                     <td className="px-10 py-6">
                        <span className="font-bold text-slate-400 text-sm whitespace-nowrap">{log.targetName}</span>
                     </td>
                     <td className="px-10 py-6 text-right">
                        <div className="flex flex-col items-end">
                           <p className="text-[11px] text-slate-500 font-medium italic opacity-60 line-clamp-1 max-w-[200px]">{log.details || 'System procedural event'}</p>
                        </div>
                     </td>
                   </motion.tr>
                 ))
               )}
             </tbody>
           </table>
        </div>
      </div>
    </div>
  );
}
