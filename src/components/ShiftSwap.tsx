import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, addDoc, updateDoc, doc, where, orderBy, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { ShiftSwapRequest, Shift } from '../types';
import { useAuth } from '../AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRightLeft, Clock, Calendar, CheckCircle2, XCircle, AlertCircle, Plus, Search, Filter, Sparkles, Loader2, Terminal } from 'lucide-react';
import { format } from 'date-fns';
import { suggestShiftSwaps } from '../geminiService';

export function ShiftSwap() {
  const { user, profile } = useAuth();
  const [requests, setRequests] = useState<ShiftSwapRequest[]>([]);
  const [myShifts, setMyShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewRequest, setShowNewRequest] = useState(false);
  const [filter, setFilter] = useState<'all' | 'mine' | 'open' | 'matches'>('all');

  const [selectedShiftToSwap, setSelectedShiftToSwap] = useState<Shift | null>(null);
  const [preferredDate, setPreferredDate] = useState('');
  const [preferredType, setPreferredType] = useState('any');
  
  const [aiRecommendations, setAiRecommendations] = useState<{swapRequestId: string; matchScore: number; rationale: string}[] | null>(null);
  const [isSynthesizing, setIsSynthesizing] = useState(false);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'shiftSwaps'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ShiftSwapRequest));
      setRequests(data);
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'shiftSwaps'));

    const shiftsQ = query(
      collection(db, 'shifts'),
      where('userId', '==', user.uid),
      orderBy('date', 'desc'),
      limit(10)
    );

    const unsubscribeShifts = onSnapshot(shiftsQ, (snapshot) => {
      setMyShifts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Shift)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'shifts'));

    return () => {
      unsubscribe();
      unsubscribeShifts();
    };
  }, [user]);

  const handleCreateRequest = async () => {
    if (!selectedShiftToSwap) return;
    try {
      await addDoc(collection(db, 'shiftSwaps'), {
        requesterId: user?.uid,
        requesterName: profile?.displayName || profile?.email,
        shiftId: selectedShiftToSwap.id,
        shiftDate: selectedShiftToSwap.date,
        shiftTime: `${selectedShiftToSwap.startTime} - ${selectedShiftToSwap.endTime}`,
        preferredDates: preferredDate ? [preferredDate] : [],
        preferredTypes: preferredType !== 'any' ? [preferredType] : [],
        status: 'pending',
        createdAt: Date.now()
      });
      setShowNewRequest(false);
      setSelectedShiftToSwap(null);
      setPreferredDate('');
      setPreferredType('any');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'shiftSwaps');
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    const request = requests.find(r => r.id === requestId);
    if (!request) return;

    const hasConflict = myShifts.some(s => s.date === request.shiftDate);
    if (hasConflict) {
      if (!window.confirm("PROTOCOL ALERT: Overlapping temporal markers detected. You already have a shift registered for this cycle. Proceed with override?")) {
        return;
      }
    }

    try {
      await updateDoc(doc(db, 'shiftSwaps', requestId), {
        status: 'accepted',
        targetUserId: user?.uid,
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `shiftSwaps/${requestId}`);
    }
  };

  const checkIsMatch = (request: ShiftSwapRequest) => {
    if (request.status !== 'pending' || request.requesterId === user?.uid) return false;
    if (myShifts.length === 0) return false;
    
    const hasDatePref = request.preferredDates && request.preferredDates.length > 0;
    const hasTypePref = request.preferredTypes && request.preferredTypes.length > 0;

    // If no preferences specified, they accept anything, so any of user's shifts would match
    if (!hasDatePref && !hasTypePref) return true;

    // A request is a match if the current user has a shift that satisfies the requester's preferences
    const matchingShifts = myShifts.filter(myShift => {
      const matchDate = hasDatePref ? request.preferredDates!.includes(myShift.date) : true;
      const matchType = hasTypePref ? request.preferredTypes!.includes(myShift.type) : true;
      return matchDate && matchType; // Must match both if both are specified
    });
    
    return matchingShifts.length > 0;
  };

  const handleGenerateAiMatches = async () => {
    setIsSynthesizing(true);
    try {
      const openSwaps = requests.filter(r => r.status === 'pending' && r.requesterId !== user?.uid);
      const suggestions = await suggestShiftSwaps(myShifts, openSwaps);
      setAiRecommendations(suggestions);
      setFilter('matches');
    } catch(e) {
      console.error(e);
    } finally {
      setIsSynthesizing(false);
    }
  };

  const filteredRequests = requests.filter(r => {
    if (filter === 'mine') return r.requesterId === user?.uid;
    if (filter === 'open') return r.status === 'pending' && r.requesterId !== user?.uid;
    if (filter === 'matches') {
       if (aiRecommendations && aiRecommendations.some(ai => ai.swapRequestId === r.id)) return true;
       return checkIsMatch(r);
    }
    return true;
  }).sort((a, b) => {
    if (filter === 'matches' && aiRecommendations) {
      const scoreA = aiRecommendations.find(ai => ai.swapRequestId === a.id)?.matchScore || 0;
      const scoreB = aiRecommendations.find(ai => ai.swapRequestId === b.id)?.matchScore || 0;
      return scoreB - scoreA;
    }
    return b.createdAt - a.createdAt;
  });

  return (
    <div className="space-y-8 pb-20 relative z-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-primary/20 pb-8 shadow-[0_4px_30px_rgba(0,240,255,0.05)]">
        <div className="space-y-2">
          <div className="flex items-center gap-3 bg-surface-2 w-max px-4 py-1.5 rounded-full border border-primary/30 shadow-[0_0_15px_rgba(0,240,255,0.15)]">
             <ArrowRightLeft size={14} className="text-primary animate-pulse shadow-[0_0_8px_rgba(0,240,255,0.8)]" />
             <span className="text-[10px] font-mono text-primary uppercase font-bold tracking-[0.4em] drop-shadow-md">Trade_Marketplace</span>
          </div>
          <h2 className="text-4xl font-display font-medium text-main-text uppercase tracking-tight text-shadow-md">
            Exchange Alpha
          </h2>
          <p className="text-[11px] font-mono text-main-text-muted mt-1 uppercase tracking-[0.2em]">
            P2P Shift Exchange Protocol // authorized_trading_only
          </p>
        </div>

        <div className="flex flex-col xl:flex-row gap-4 items-stretch xl:items-center w-full md:w-auto">
          <button
            onClick={handleGenerateAiMatches}
            disabled={isSynthesizing}
            className="flex justify-center items-center gap-2 px-6 py-2.5 border border-primary/50 text-black bg-primary/20 hover:bg-primary shadow-[0_0_15px_rgba(0,240,255,0.2)] hover:shadow-[0_0_20px_rgba(0,240,255,0.6)] rounded-lg text-xs font-mono uppercase font-bold tracking-widest transition-all duration-300 disabled:opacity-50 group w-full xl:w-auto"
          >
            {isSynthesizing ? <Loader2 size={16} className="animate-spin text-primary group-hover:text-black" /> : <Sparkles size={16} className="text-primary group-hover:text-black transition-colors" />}
            <span className="text-primary group-hover:text-black transition-colors">AI_Matrix_Match</span>
          </button>
          
          <div className="flex bg-surface-2/80 backdrop-blur-md border border-primary/20 p-1.5 rounded-xl shadow-[0_0_20px_rgba(0,240,255,0.1)] overflow-x-auto no-scrollbar w-full xl:w-auto">
            {(['all', 'mine', 'open', 'matches'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-5 py-2 rounded-lg text-xs font-mono flex items-center justify-center gap-2 uppercase font-bold tracking-[0.2em] transition-all duration-300 active:scale-95 whitespace-nowrap flex-1 xl:flex-none ${
                  filter === f 
                    ? 'bg-primary text-black shadow-[0_0_15px_rgba(0,240,255,0.4)]' 
                    : 'text-main-text-muted hover:text-primary hover:bg-primary/10'
                }`}
              >
                {f === 'matches' && <Sparkles size={12} className={filter === f ? "text-black" : "text-primary"} />}
                {f}
              </button>
            ))}
          </div>
          
          <button 
            onClick={() => { setShowNewRequest(true); setSelectedShiftToSwap(null); }}
            className="flex justify-center items-center gap-2 px-6 py-2.5 bg-primary text-black rounded-lg text-xs font-mono uppercase font-bold tracking-widest hover:scale-[1.02] transition-transform shadow-[0_0_20px_rgba(0,240,255,0.4)] w-full xl:w-auto"
          >
            <Plus size={16} />
            Post_Trade
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {filteredRequests.map((request) => {
            const isMatch = checkIsMatch(request);
            const aiData = aiRecommendations?.find(ai => ai.swapRequestId === request.id);
            
            return (
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
                key={request.id}
                className={`flex flex-col glass-card border p-6 hover:border-primary/50 transition-all duration-300 group relative overflow-hidden ${isMatch || aiData ? 'border-primary shadow-[0_0_30px_rgba(0,240,255,0.15)] bg-surface-1/90' : 'border-main-border/50'}`}
              >
                <div className="absolute top-0 right-0 w-40 h-40 bg-primary/10 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none -mr-20 -mt-20" />
                {(isMatch || aiData) && (
                  <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />
                )}
                
                <div className="flex-1 space-y-5 relative z-10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-2/80 rounded-lg border border-primary/20 shadow-inner">
                      <Clock size={12} className="text-primary animate-pulse" />
                      <span className="text-[10px] font-mono text-main-text uppercase font-bold tracking-[0.2em]">{request.shiftTime}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {aiData && (
                        <span className="px-3 py-1 rounded-full text-[9px] font-mono uppercase font-bold tracking-widest border bg-primary/20 border-primary/50 text-primary flex items-center gap-1.5 shadow-[0_0_10px_rgba(0,240,255,0.2)]">
                          <Sparkles size={10} /> {aiData.matchScore}% AI Match
                        </span>
                      )}
                      {!aiData && isMatch && (
                         <span className="px-3 py-1 rounded-full text-[9px] font-mono uppercase font-bold tracking-widest border bg-primary/20 border-primary/50 text-primary flex items-center gap-1.5 shadow-[0_0_10px_rgba(0,240,255,0.2)]">
                            <Sparkles size={10} /> Match
                         </span>
                      )}
                      <div className={`px-3 py-1 rounded-full text-[9px] font-mono uppercase font-bold tracking-widest border shadow-inner ${
                        request.status === 'pending' ? 'bg-warning/10 border-warning/30 text-warning' :
                        request.status === 'accepted' ? 'bg-secondary/10 border-secondary/30 text-secondary' :
                        'bg-success/10 border-success/30 text-success'
                      }`}>
                        {request.status}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2.5">
                      <Calendar size={16} className="text-main-text-muted group-hover:text-primary transition-colors" />
                      <span className="text-lg font-bold text-main-text tracking-tight text-shadow-sm">{format(new Date(request.shiftDate), 'EEE, MMM d, yyyy')}</span>
                    </div>
                    <p className="text-[11px] font-mono text-main-text-muted uppercase tracking-[0.2em]">
                      Posted by <span className="text-primary font-bold">{request.requesterName}</span>
                    </p>
                  </div>

                  {/* Showing Request Preferences */}
                  {(request.preferredDates?.length > 0 || request.preferredTypes?.length > 0) && (
                    <div className="pt-4 border-t border-primary/20">
                       <p className="text-[9px] font-mono text-primary uppercase font-bold tracking-[0.2em] mb-2 drop-shadow-md">Requested Exchange Parameters</p>
                       <div className="flex flex-wrap gap-2">
                          {request.preferredDates?.map(d => (
                             <span key={d} className="px-2.5 py-1.5 bg-surface-2 border border-main-border rounded-md text-[10px] font-mono text-main-text flex items-center gap-1.5 shadow-inner">
                                <Calendar size={12} className="text-primary" /> {format(new Date(d), 'MMM d')}
                             </span>
                          ))}
                          {request.preferredTypes?.map(t => (
                             <span key={t} className="px-2.5 py-1.5 bg-surface-2 border border-main-border rounded-md text-[10px] font-mono text-main-text uppercase font-medium">
                                TYPE: {t}
                             </span>
                          ))}
                       </div>
                    </div>
                  )}

                  {aiData && (
                    <div className="mt-4 glass-card border border-primary/30 p-4 rounded-xl text-xs font-mono text-main-text relative overflow-hidden">
                      <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-[0.05] pointer-events-none mix-blend-overlay"></div>
                      <p className="text-[10px] font-bold uppercase text-primary mb-2 tracking-[0.3em] flex items-center gap-2">
                        <Terminal size={10} /> Cortex Rationale
                      </p>
                      <span className="italic opacity-90 leading-relaxed font-medium">{aiData.rationale}</span>
                    </div>
                  )}
                </div>

                <div className="mt-6 pt-5 border-t border-primary/20 flex items-center justify-between gap-4 relative z-10">
                  {request.requesterId !== user?.uid && request.status === 'pending' ? (
                    <button 
                      onClick={() => handleAcceptRequest(request.id)}
                      className="flex-1 py-3 bg-primary/20 border border-primary/50 hover:bg-primary hover:text-black text-primary rounded-xl text-[10px] font-mono uppercase tracking-[0.3em] font-bold transition-all duration-300 shadow-[0_0_15px_rgba(0,240,255,0.1)] hover:shadow-[0_0_20px_rgba(0,240,255,0.5)] active:scale-[0.98]"
                    >
                      Accept_Trade
                    </button>
                  ) : (
                    <div className="flex-1 flex items-center justify-center py-3 text-[9px] font-mono text-main-text-muted uppercase tracking-[0.3em] bg-surface-2/60 rounded-xl border border-main-border shadow-inner font-bold">
                      {request.requesterId === user?.uid ? 'Awaiting Traders' : 'Trade Finalized'}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {filteredRequests.length === 0 && !loading && (
          <div className="col-span-full py-24 flex flex-col items-center justify-center text-center space-y-5">
            <div className="w-20 h-20 bg-surface-2/50 border border-primary/20 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(0,240,255,0.05)] relative overflow-hidden">
              <div className="absolute inset-0 bg-primary/5 animate-pulse" />
              <ArrowRightLeft size={32} className="text-primary opacity-50 relative z-10" />
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-mono font-bold uppercase tracking-[0.4em] text-primary text-shadow-sm">No_Trades_Available</h3>
              <p className="text-[11px] font-mono text-main-text-muted uppercase tracking-[0.2em]">Marketplace frequency is currently flatline.</p>
            </div>
          </div>
        )}
      </div>

      {/* New Trade Request Modal */}
      <AnimatePresence>
        {showNewRequest && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
              onClick={() => setShowNewRequest(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 30 }}
              transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="relative w-full max-w-lg glass-panel border-primary/50 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.5),_0_0_40px_rgba(0,240,255,0.15)] overflow-hidden flex flex-col"
            >
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />
              
              <div className="p-6 border-b border-primary/20 flex items-center justify-between bg-surface-2/40">
                <div>
                  <h3 className="text-xl font-display font-medium text-main-text uppercase tracking-tight flex items-center gap-3">
                    <Terminal size={18} className="text-primary animate-pulse" />
                    Initiate_Trade
                  </h3>
                  <p className="text-[10px] font-mono text-main-text-muted uppercase tracking-[0.2em] mt-1 pl-8">
                    {selectedShiftToSwap ? 'Specify trade requirements' : 'Select an active shift to post'}
                  </p>
                </div>
                <button onClick={() => setShowNewRequest(false)} className="p-2 text-main-text-muted hover:text-primary transition-colors hover:rotate-90 duration-300">
                  <XCircle size={24} />
                </button>
              </div>

              {!selectedShiftToSwap ? (
                <div className="p-6 max-h-[400px] overflow-y-auto space-y-4 custom-scrollbar">
                  {myShifts.length > 0 ? (
                    myShifts.map((shift) => (
                      <button
                        key={shift.id}
                        onClick={() => setSelectedShiftToSwap(shift)}
                        className="w-full p-5 glass-card border border-main-border rounded-xl flex items-center justify-between hover:border-primary hover:shadow-[0_0_20px_rgba(0,240,255,0.15)] transition-all duration-300 text-left group overflow-hidden relative"
                      >
                        <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                        <div className="space-y-2 relative z-10">
                          <div className="flex items-center gap-3">
                            <Calendar size={14} className="text-primary" />
                            <span className="text-sm font-mono text-main-text font-bold uppercase tracking-wider">
                              {format(new Date(shift.date), 'MMM d, yyyy')}
                            </span>
                          </div>
                          <p className="text-[11px] font-mono text-main-text-muted uppercase tracking-[0.2em]">
                            {shift.startTime} - {shift.endTime} // <span className="text-secondary">{shift.type}</span>
                          </p>
                        </div>
                        <ArrowRightLeft size={18} className="text-primary opacity-0 group-hover:opacity-100 transition-opacity relative z-10" />
                      </button>
                    ))
                  ) : (
                    <div className="py-12 text-center space-y-4">
                      <div className="w-16 h-16 mx-auto bg-warning/10 rounded-full flex items-center justify-center border border-warning/20">
                         <AlertCircle size={24} className="text-warning animate-pulse" />
                      </div>
                      <div className="space-y-1">
                         <p className="text-xs font-mono font-bold text-warning uppercase tracking-[0.2em]">Zero Active Shifts</p>
                         <p className="text-[10px] font-mono text-main-text-muted uppercase tracking-widest">No verified active shifts linked to your ID.</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-6 space-y-6">
                  <div className="p-5 glass-card border border-primary/30 rounded-xl relative overflow-hidden">
                     <div className="absolute inset-0 bg-primary/5 pointer-events-none" />
                     <p className="text-[10px] font-mono uppercase font-bold tracking-[0.3em] text-primary mb-2 flex items-center gap-2">
                        <CheckCircle2 size={12} /> Selected Draft For Trade
                     </p>
                     <p className="text-lg font-mono font-bold text-main-text uppercase tracking-tight text-shadow-sm">
                        {format(new Date(selectedShiftToSwap.date), 'EEE, MMM d, yyyy')}
                     </p>
                     <p className="text-xs font-mono text-main-text-muted uppercase tracking-[0.2em] mt-1">{selectedShiftToSwap.startTime} - {selectedShiftToSwap.endTime}</p>
                  </div>
                  
                  <div className="space-y-5">
                     <div>
                        <label className="text-[10px] font-mono font-bold uppercase text-main-text-muted tracking-[0.2em] block mb-2">Preferred Trade Date (Optional)</label>
                        <input 
                           type="date" 
                           value={preferredDate}
                           onChange={e => setPreferredDate(e.target.value)}
                           className="w-full bg-surface-2/80 border border-main-border rounded-xl px-4 py-3 text-sm text-main-text font-mono focus:border-primary focus:ring-1 focus:ring-primary/50 focus:outline-none transition-all shadow-inner"
                        />
                     </div>
                     
                     <div>
                        <label className="text-[10px] font-mono font-bold uppercase text-main-text-muted tracking-[0.2em] block mb-2">Preferred Shift Type (Optional)</label>
                        <select
                           value={preferredType}
                           onChange={e => setPreferredType(e.target.value)}
                           className="w-full bg-surface-2/80 border border-main-border rounded-xl px-4 py-3 text-sm text-main-text font-mono focus:border-primary focus:ring-1 focus:ring-primary/50 focus:outline-none transition-all shadow-inner appearance-none"
                           style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 0.5rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.5em 1.5em` }}
                        >
                           <option value="any">Any Shift Type</option>
                           <option value="recon">Reconnaissance</option>
                           <option value="security">Security</option>
                           <option value="logistics">Logistics</option>
                           <option value="emergency">Emergency / Med</option>
                        </select>
                     </div>
                  </div>

                  <div className="flex items-center gap-4 pt-6 mt-4 border-t border-primary/20">
                     <button 
                        onClick={() => setSelectedShiftToSwap(null)}
                        className="flex-1 py-3 text-[11px] font-mono uppercase tracking-[0.3em] font-bold text-main-text-muted hover:text-primary hover:bg-primary/10 rounded-xl transition-all duration-300"
                     >
                        Back
                     </button>
                     <button 
                        onClick={handleCreateRequest}
                        className="flex-1 py-3 bg-primary text-black rounded-xl text-[11px] font-mono uppercase tracking-[0.3em] font-bold hover:scale-[1.02] transition-transform duration-300 flex justify-center items-center gap-2 shadow-[0_0_20px_rgba(0,240,255,0.4)]"
                     >
                        <Plus size={16} /> Commit Trade
                     </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
