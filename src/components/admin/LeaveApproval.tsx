import React from 'react';
import { LeaveRequest } from '../../types';
import { CheckCircle2, XCircle, Clock, Calendar, MessageSquare, User, FileText, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { updateDoc, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase';

interface LeaveApprovalProps {
  leaves: LeaveRequest[];
  onLogAction: (action: string, targetId: string, targetName: string, details?: string) => Promise<void>;
}

export function LeaveApproval({ leaves, onLogAction }: LeaveApprovalProps) {
  const updateStatus = async (id: string, status: 'approved' | 'rejected') => {
    const req = leaves.find(l => l.id === id);
    try {
      await updateDoc(doc(db, 'leaveRequests', id), { status });
      await onLogAction(
        status === 'approved' ? 'APPROVE_LEAVE' : 'REJECT_LEAVE',
        id,
        req?.userName || 'Unknown User',
        `Duration: ${req?.startDate} to ${req?.endDate}`
      );
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'leaveRequests');
    }
  };

  const pendingCount = leaves.filter(l => l.status === 'pending').length;

  return (
    <div className="space-y-10 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-white/5 pb-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-white mb-2">Leave Approvals</h1>
          <p className="text-slate-400 font-medium">Review and authorization of personnel absence requests.</p>
        </div>
        <div className="flex gap-4">
           <div className="px-6 py-3 bg-zinc-900 border border-white/5 rounded-xl flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full ${pendingCount > 0 ? 'bg-amber-500 animate-pulse' : 'bg-slate-800'}`} />
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{pendingCount} Pending Queue</span>
           </div>
        </div>
      </div>

      <div className="grid gap-5">
        {leaves.length === 0 ? (
          <div className="bg-zinc-900 py-32 text-center rounded-[2.5rem] border border-white/5 border-dashed">
            <ShieldCheck className="mx-auto text-slate-800 mb-6" size={60} />
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600">All personnel accounted for</p>
          </div>
        ) : (
          <AnimatePresence>
            {leaves.map((req, idx) => (
              <motion.div 
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ delay: idx * 0.05 }}
                key={req.id} 
                className={`bg-zinc-900 border border-white/5 rounded-[2rem] p-8 transition-all duration-300 ${req.status === 'pending' ? 'ring-1 ring-indigo-500/10' : 'opacity-60'}`}
              >
                 <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                    <div className="flex items-center gap-6">
                       <div className="relative">
                          <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center font-bold text-indigo-400 text-xl">
                             {req.userName.slice(0, 1).toUpperCase()}
                          </div>
                          <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-4 border-zinc-900 ${
                            req.status === 'pending' ? 'bg-amber-500' : 
                            req.status === 'approved' ? 'bg-emerald-500' : 'bg-red-500'
                          }`} />
                       </div>
                       <div className="space-y-1">
                          <div className="flex items-center gap-3">
                             <h4 className="font-bold text-lg text-white leading-tight">{req.userName}</h4>
                          </div>
                          <div className="flex items-center gap-4 text-slate-500">
                             <div className="flex items-center gap-2">
                                <Calendar size={13} />
                                <span className="text-[11px] font-bold tracking-tight">{req.startDate} — {req.endDate}</span>
                             </div>
                             <div className="flex items-center gap-2">
                                <Clock size={13} />
                                <span className="text-[11px] font-bold tracking-tight">{(new Date(req.endDate).getTime() - new Date(req.startDate).getTime()) / (1000 * 60 * 60 * 24) + 1} DAYS</span>
                             </div>
                          </div>
                       </div>
                    </div>

                    <div className="flex-1 max-w-xl">
                       <div className="bg-black/20 border border-white/5 p-4 rounded-2xl space-y-2">
                          <div className="flex items-center gap-2 text-slate-600 uppercase tracking-widest text-[9px] font-bold">
                             <FileText size={12} />
                             <span>Request Narrative</span>
                          </div>
                          <p className="text-sm font-medium text-slate-400 leading-relaxed italic">"{req.reason}"</p>
                       </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      {req.status === 'pending' ? (
                        <>
                          <button 
                            onClick={() => updateStatus(req.id, 'rejected')}
                            className="p-3 bg-zinc-800 text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                          >
                            <XCircle size={22} />
                          </button>
                          <button 
                            onClick={() => updateStatus(req.id, 'approved')}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-lg shadow-indigo-600/20 flex items-center gap-2 active:scale-95"
                          >
                            <CheckCircle2 size={16} />
                            <span>Approve</span>
                          </button>
                        </>
                      ) : (
                        <div className={`flex items-center gap-2.5 px-6 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest ${
                          req.status === 'approved' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'
                        }`}>
                          {req.status === 'approved' ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                          <span>{req.status}</span>
                        </div>
                      )}
                    </div>
                 </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
