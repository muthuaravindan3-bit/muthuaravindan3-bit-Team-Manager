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
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-main-border pb-6">
        <div>
          <h2 className="text-xl font-display font-medium text-main-text flex items-center gap-2">
            <Calendar size={20} />
            Leave Approvals
          </h2>
          <p className="text-sm text-main-text-muted mt-1 font-sans">Review and authorization of personnel absence requests.</p>
        </div>
        <div className="flex gap-4">
           <div className="px-3 py-1.5 bg-surface-1 border border-main-border rounded flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${pendingCount > 0 ? 'bg-warning animate-pulse' : 'bg-surface-3'}`} />
              <span className="text-[9px] font-mono uppercase tracking-widest text-main-text-muted">{pendingCount} Pending Queue</span>
           </div>
        </div>
      </div>

      <div className="grid gap-3">
        {leaves.length === 0 ? (
          <div className="bg-surface-1 border border-main-border border-dashed py-24 text-center rounded-md">
            <ShieldCheck className="mx-auto text-main-text-muted/10 mb-4" size={48} />
            <p className="text-[10px] font-mono uppercase tracking-widest text-main-text-muted/50">All personnel accounted for</p>
          </div>
        ) : (
          <AnimatePresence>
            {leaves.map((req, idx) => (
              <motion.div 
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                key={req.id} 
                className={`bg-surface-1 border rounded-md p-6 transition-all ${req.status === 'pending' ? 'border-primary/30' : 'border-main-border opacity-60'}`}
              >
                 <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                    <div className="flex items-center gap-4">
                       <div className="relative">
                          <div className="w-10 h-10 rounded bg-surface-2 border border-main-border flex items-center justify-center font-mono text-main-text-muted text-sm uppercase">
                             {req.userName.charAt(0)}
                          </div>
                          <div className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border-2 border-surface-1 ${
                            req.status === 'pending' ? 'bg-warning' : 
                            req.status === 'approved' ? 'bg-success' : 'bg-error'
                          }`} />
                       </div>
                       <div className="space-y-1">
                          <h4 className="text-sm font-medium text-main-text uppercase tracking-tight">{req.userName}</h4>
                          <div className="flex items-center gap-4 text-main-text-muted/50 font-mono text-[9px] uppercase tracking-widest">
                             <div className="flex items-center gap-1.5">
                                <Calendar size={10} />
                                <span>{req.startDate} / {req.endDate}</span>
                             </div>
                             <div className="flex items-center gap-1.5">
                                <Clock size={10} />
                                <span>{(new Date(req.endDate).getTime() - new Date(req.startDate).getTime()) / (1000 * 60 * 60 * 24) + 1}D</span>
                             </div>
                          </div>
                       </div>
                    </div>

                    <div className="flex-1 max-w-lg">
                       <div className="bg-surface-2/50 p-4 border border-main-border rounded space-y-2">
                          <div className="flex items-center gap-2 text-main-text-muted/30 uppercase tracking-[0.2em] text-[8px] font-mono">
                             <MessageSquare size={10} />
                             <span>Request Narrative</span>
                          </div>
                          <p className="text-xs text-main-text-muted leading-relaxed font-sans">{req.reason}</p>
                       </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {req.status === 'pending' ? (
                        <>
                          <button 
                            onClick={() => updateStatus(req.id, 'rejected')}
                            className="p-2 text-main-text-muted hover:text-error transition-colors"
                          >
                            <XCircle size={18} />
                          </button>
                          <button 
                            onClick={() => updateStatus(req.id, 'approved')}
                            className="bg-primary hover:bg-primary-hover text-surface-1 px-6 py-1.5 rounded font-mono text-[10px] uppercase tracking-widest transition-colors flex items-center gap-2"
                          >
                            <CheckCircle2 size={12} />
                            <span>Authorize</span>
                          </button>
                        </>
                      ) : (
                        <div className={`flex items-center gap-2 px-3 py-1 rounded font-mono text-[9px] uppercase tracking-widest border border-main-border ${
                          req.status === 'approved' ? 'text-success' : 'text-error'
                        }`}>
                          {req.status}
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
