import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where, addDoc, orderBy, updateDoc, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { LeaveRequest } from '../types';
import { useAuth } from '../AuthContext';
import { Plus, X, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function Leaves() {
  const { user, profile } = useAuth();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingRequest, setEditingRequest] = useState<LeaveRequest | null>(null);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'leaveRequests'), 
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LeaveRequest));
      setRequests(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'leaveRequests');
    });

    return () => unsubscribe();
  }, [user]);

  const handleOpenNew = () => {
    setEditingRequest(null);
    setStartDate('');
    setEndDate('');
    setReason('');
    setShowModal(true);
  };

  const handleEdit = (req: LeaveRequest) => {
    setEditingRequest(req);
    setStartDate(req.startDate);
    setEndDate(req.endDate);
    setReason(req.reason);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;
    setSubmitting(true);
    try {
      if (editingRequest) {
        await updateDoc(doc(db, 'leaveRequests', editingRequest.id), {
          startDate,
          endDate,
          reason,
          updatedAt: Date.now()
        });
      } else {
        await addDoc(collection(db, 'leaveRequests'), {
          userId: user.uid,
          userName: profile.displayName || profile.email,
          startDate,
          endDate,
          reason,
          status: 'pending',
          createdAt: Date.now()
        });
      }
      setShowModal(false);
      setStartDate('');
      setEndDate('');
      setReason('');
      setEditingRequest(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'leaveRequests');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="p-10 flex flex-col items-center justify-center space-y-4 relative z-10">
      <div className="w-12 h-12 rounded-full border-t-2 border-primary animate-spin shadow-[0_0_15px_rgba(0,240,255,0.5)]" />
      <div className="font-mono animate-pulse text-primary text-xs uppercase tracking-[0.3em] font-bold drop-shadow-md">
        Synchronizing_Archives...
      </div>
    </div>
  );

  return (
    <div className="space-y-8 pb-20 relative z-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-primary/20 pb-8 shadow-[0_4px_30px_rgba(0,240,255,0.05)]">
        <div className="space-y-2">
          <div className="flex items-center gap-3 bg-surface-2 w-max px-4 py-1.5 rounded-full border border-primary/30 shadow-[0_0_15px_rgba(0,240,255,0.15)]">
             <Calendar size={14} className="text-primary animate-pulse shadow-[0_0_8px_rgba(0,240,255,0.8)]" />
             <span className="text-[10px] font-mono text-primary uppercase font-bold tracking-[0.4em] drop-shadow-md">Time_Off_Archives</span>
          </div>
          <h2 className="text-4xl font-display font-medium text-main-text uppercase tracking-tight text-shadow-md">
             Leave Protocol
          </h2>
          <p className="text-[11px] font-mono text-main-text-muted mt-1 uppercase tracking-[0.2em]">Personal leave request history and status tracking.</p>
        </div>
        <button 
          onClick={handleOpenNew} 
          className="bg-primary hover:bg-white text-black px-6 py-2.5 rounded-lg font-mono text-xs uppercase font-bold tracking-[0.2em] transition-all duration-300 flex items-center gap-2 group active:scale-95 shadow-[0_0_20px_rgba(0,240,255,0.4)]"
        >
          <Plus size={16} className="group-hover:rotate-90 transition-transform duration-300" />
          <span>New Authorization</span>
        </button>
      </div>

      <div className="glass-panel border border-primary/20 rounded-xl overflow-hidden shadow-[0_0_30px_rgba(0,240,255,0.05)]">
        <div className="overflow-x-auto no-scrollbar">
          <div className="min-w-[600px]">
            <div className="grid grid-cols-[80px_80px_1fr_80px] sm:grid-cols-[100px_100px_minmax(200px,1fr)_120px_100px] gap-4 p-5 bg-primary/10 text-[10px] font-mono text-main-text font-bold uppercase tracking-[0.2em] border-b border-primary/20">
              <div>Start</div>
              <div>End</div>
              <div>Narrative_Reason</div>
              <div className="hidden sm:block">Log_Date</div>
              <div className="text-right">Status</div>
            </div>

            {requests.length === 0 ? (
              <div className="p-24 text-center bg-surface-1/50 flex flex-col items-center justify-center space-y-4 relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-[0.05] pointer-events-none mix-blend-overlay"></div>
                <div className="w-16 h-16 bg-surface-2/50 border border-primary/20 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(0,240,255,0.1)] relative z-10">
                  <Calendar size={24} className="text-primary opacity-50" />
                </div>
                <p className="text-[11px] font-mono uppercase text-primary tracking-[0.3em] leading-relaxed font-bold relative z-10">Zero Active Requests.</p>
              </div>
            ) : (
              <div className="divide-y divide-primary/10">
                {requests.map((req) => (
                  <div 
                    key={req.id} 
                    onClick={() => req.status === 'pending' && handleEdit(req)}
                    className={`grid grid-cols-[80px_80px_1fr_80px] sm:grid-cols-[100px_100px_minmax(200px,1fr)_120px_100px] gap-4 p-5 items-center group transition-all duration-300 relative overflow-hidden ${req.status === 'pending' ? 'hover:bg-primary/5 cursor-pointer hover:shadow-inner' : 'opacity-80 bg-surface-1/50'}`}
                  >
                    {req.status === 'pending' && <div className="absolute inset-y-0 left-0 w-1 bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />}
                    <div className="font-mono text-[11px] text-main-text-muted group-hover:text-primary transition-colors uppercase tracking-widest">{req.startDate}</div>
                    <div className="font-mono text-[11px] text-main-text-muted group-hover:text-primary transition-colors uppercase tracking-widest">{req.endDate}</div>
                    <div className="text-sm font-medium text-main-text truncate pr-4 tracking-wide">{req.reason}</div>
                    <div className="hidden sm:block font-mono text-[10px] text-main-text-muted/50 uppercase tracking-widest">
                      {new Date(req.createdAt).toLocaleDateString(undefined, { year: '2-digit', month: '2-digit', day: '2-digit' })}
                    </div>
                    <div className="text-right">
                      <span className={`inline-flex px-3 py-1 rounded-full text-[9px] font-mono uppercase tracking-[0.2em] font-bold border shadow-inner ${
                        req.status === 'approved' ? 'border-success/30 text-success bg-success/10 shadow-[0_0_10px_rgba(0,255,102,0.1)]' :
                        req.status === 'rejected' ? 'border-error/30 text-error bg-error/10 shadow-[0_0_10px_rgba(255,51,102,0.1)]' :
                        'border-warning/30 text-warning bg-warning/10 shadow-[0_0_10px_rgba(255,191,0,0.1)]'
                      }`}>
                        {req.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowModal(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 30 }}
              transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="glass-panel w-full max-w-lg relative z-10 rounded-2xl border border-primary/50 shadow-[0_20px_60px_rgba(0,0,0,0.5),_0_0_40px_rgba(0,240,255,0.15)] overflow-hidden"
            >
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />
              
              <div className="p-8 border-b border-primary/20 bg-surface-2/40 flex justify-between items-center">
                <div className="space-y-2">
                  <h3 className="text-xl font-display font-medium text-main-text uppercase tracking-tight flex items-center gap-3">
                    <Calendar size={18} className="text-primary animate-pulse" />
                    {editingRequest ? 'Modify Authorization' : 'Request Authorization'}
                  </h3>
                  <p className="text-[10px] font-mono text-main-text-muted uppercase tracking-[0.3em] font-bold pl-8">Protocol Definition Interface</p>
                </div>
                <button 
                  onClick={() => setShowModal(false)} 
                  className="w-10 h-10 rounded-xl border border-main-border flex items-center justify-center text-main-text-muted hover:text-primary hover:border-primary/50 transition-all duration-300 hover:rotate-90 bg-surface-2/80 hover:bg-primary/10 hover:shadow-[0_0_15px_rgba(0,240,255,0.2)]"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-8 space-y-8 relative overflow-hidden">
                <div className="absolute inset-0 bg-primary/5 pointer-events-none" />
                <div className="grid grid-cols-2 gap-8 relative z-10">
                  <div className="space-y-3">
                    <label className="text-[10px] font-mono text-primary font-bold uppercase tracking-[0.2em] ml-1 drop-shadow-sm">Commencement</label>
                    <input
                      type="date"
                      required
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full bg-surface-2/80 border border-main-border rounded-xl px-4 py-3 text-sm text-main-text outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all font-mono shadow-inner text-[13px]"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-mono text-primary font-bold uppercase tracking-[0.2em] ml-1 drop-shadow-sm">Termination</label>
                    <input
                      type="date"
                      required
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full bg-surface-2/80 border border-main-border rounded-xl px-4 py-3 text-sm text-main-text outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all font-mono shadow-inner text-[13px]"
                    />
                  </div>
                </div>
                
                <div className="space-y-3 relative z-10">
                  <label className="text-[10px] font-mono text-primary font-bold uppercase tracking-[0.2em] ml-1 drop-shadow-sm">Request Narrative</label>
                  <textarea
                    required
                    rows={4}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Provide detailed justification for leave request..."
                    className="w-full bg-surface-2/80 border border-main-border rounded-xl px-5 py-4 text-sm text-main-text outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all font-sans resize-none h-32 leading-relaxed shadow-inner"
                  />
                </div>
                
                <div className="pt-8 flex justify-between items-center bg-surface-2/80 -mx-8 -mb-8 p-8 border-t border-primary/20 backdrop-blur-md relative z-10 mt-10">
                  <button 
                    type="button" 
                    onClick={() => setShowModal(false)} 
                    className="text-[11px] font-mono text-main-text-muted hover:text-error hover:bg-error/10 px-4 py-2 rounded-lg transition-all duration-300 uppercase tracking-widest font-bold"
                  >
                    Abort_Process
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="bg-primary hover:bg-white text-black px-10 py-3 rounded-xl font-mono text-[11px] uppercase tracking-[0.3em] font-bold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(0,240,255,0.4)] active:scale-95 hover:scale-[1.02]"
                  >
                    {submitting ? 'EXECUTING...' : editingRequest ? 'UPDATE_ENTRY' : 'SUBMIT_PROTOCOL'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
