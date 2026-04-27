import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where, addDoc, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { LeaveRequest } from '../types';
import { useAuth } from '../AuthContext';
import { Plus, Clock, CheckCircle2, XCircle, AlertCircle, Calendar, FileText, ArrowRight } from 'lucide-react';
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

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'leaveRequests'), 
      where('userId', '==', user.uid)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LeaveRequest));
      data.sort((a, b) => b.createdAt - a.createdAt);
      setRequests(data);
      setLoading(false);
    }, (error) => {
      console.error(error);
      setLoading(false);
      handleFirestoreError(error, OperationType.LIST, 'leaveRequests');
    });

    return () => unsubscribe();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'leaveRequests'), {
        userId: user.uid,
        userName: profile.displayName || profile.email,
        startDate,
        endDate,
        reason,
        status: 'pending',
        createdAt: Date.now()
      });
      setShowModal(false);
      setStartDate('');
      setEndDate('');
      setReason('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'leaveRequests');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'approved': return { bg: 'bg-emerald-500/10', text: 'text-emerald-500', icon: <CheckCircle2 size={16} /> };
      case 'rejected': return { bg: 'bg-red-500/10', text: 'text-red-500', icon: <XCircle size={16} /> };
      default: return { bg: 'bg-amber-500/10', text: 'text-amber-500', icon: <Clock size={16} /> };
    }
  };

  if (loading) return (
    <div className="p-12 space-y-8 animate-pulse">
       <div className="h-20 w-1/4 bg-white/5 rounded-[2rem]" />
       <div className="space-y-4">
         {[1,2,3].map(i => <div key={i} className="h-24 bg-white/5 rounded-3xl" />)}
       </div>
    </div>
  );

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="max-w-3xl">
          <h1 className="text-4xl font-bold tracking-tight text-white mb-2">Leave Requests</h1>
          <p className="text-slate-400 font-medium">Manage and monitor your time-off applications.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={18} />
          <span>New Request</span>
        </button>
      </div>

      <div className="grid gap-4">
        {requests.length === 0 ? (
          <div className="py-20 text-center glass-card border-dashed">
            <AlertCircle className="mx-auto text-slate-700 mb-4" size={48} />
            <p className="text-slate-500 font-medium italic">No leave requests found.</p>
          </div>
        ) : (
          requests.map((req, idx) => {
            const style = getStatusStyle(req.status);
            return (
              <motion.div 
                key={req.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="glass-card p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 group"
              >
                <div className="flex items-center gap-5">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${style.bg} ${style.text}`}>
                    {style.icon}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white mb-1">{req.reason}</h3>
                    <div className="flex items-center gap-3 text-xs font-semibold text-slate-500">
                      <Calendar size={14} />
                      <span>{req.startDate}</span>
                      <ArrowRight size={14} className="text-slate-700" />
                      <span>{req.endDate}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-8">
                  <div className="text-right hidden sm:block">
                    <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Requested On</p>
                    <p className="text-xs font-semibold text-slate-400">{new Date(req.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border border-white/5 ${style.bg} ${style.text}`}>
                    {req.status}
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowModal(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-zinc-900 p-8 w-full max-w-lg relative z-10 rounded-[2rem] border border-white/5 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="text-2xl font-bold text-white">New Request</h3>
                  <p className="text-sm font-medium text-slate-500">Fill in the details for your leave.</p>
                </div>
                <button onClick={() => setShowModal(false)} className="text-slate-500 hover:text-white transition-colors">
                  <XCircle size={24} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Start Date</label>
                    <input
                      type="date"
                      required
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full bg-zinc-950 border border-white/5 px-4 py-3 rounded-xl text-white outline-none focus:border-indigo-500/50 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">End Date</label>
                    <input
                      type="date"
                      required
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full bg-zinc-950 border border-white/5 px-4 py-3 rounded-xl text-white outline-none focus:border-indigo-500/50 transition-all"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Reason</label>
                  <textarea
                    required
                    rows={4}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Provide a brief explanation..."
                    className="w-full bg-zinc-950 border border-white/5 px-4 py-3 rounded-xl text-white outline-none focus:border-indigo-500/50 transition-all resize-none font-medium"
                  />
                </div>
                
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary w-full py-4 text-sm font-bold uppercase tracking-widest disabled:opacity-50"
                >
                  {submitting ? 'Submitting...' : 'Submit Request'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
