import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Shift, UserProfile } from '../types';
import { Clock, Users, Calendar, Activity, Battery, Coffee, Brain, Sparkles, AlertTriangle, ShieldCheck, X, ChevronRight, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, isToday, parse, isWithinInterval } from 'date-fns';
import { analyzeRotation } from '../geminiService';
import { useAuth } from '../AuthContext';

export function LiveRoster() {
  const { user: currentUser, isAdmin } = useAuth();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [rotationAdvice, setRotationAdvice] = useState<any>(null);
  const [showAdviceModal, setShowAdviceModal] = useState(false);

  useEffect(() => {
    // ... preexisting useEffect logic ...
    // Fetch last 100 shifts to ensure we cover yesterday's night shifts
    const q = query(collection(db, 'shifts'), orderBy('date', 'desc'), limit(100));
    
    const unsubShifts = onSnapshot(q, (snapshot) => {
      setShifts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Shift)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'shifts');
    });

    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const allUsers = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
      const seen = new Set();
      const uniqueUsers = allUsers.filter(u => {
        const identifier = (u.email || u.uid).toLowerCase();
        if (seen.has(identifier)) return false;
        seen.add(identifier);
        return true;
      });
      setUsers(uniqueUsers);
    }, (error) => {
      // Non-admins cannot see other user statuses
      console.warn('LiveRoster: Could not load user profiles (permission restriction)');
    });

    return () => {
      unsubShifts();
      unsubUsers();
    };
  }, []);

  const isShiftActive = (shift: Shift) => {
    const now = new Date();
    const todayStr = format(now, 'yyyy-MM-dd');
    const yesterdayStr = format(new Date(now.getTime() - 86400000), 'yyyy-MM-dd');
    
    if (shift.date !== todayStr && shift.date !== yesterdayStr) return false;
    
    try {
      const shiftDate = parse(shift.date, 'yyyy-MM-dd', new Date());
      const start = parse(shift.startTime, 'HH:mm', shiftDate);
      let end = parse(shift.endTime, 'HH:mm', shiftDate);
      
      if (end < start) {
        end = new Date(end.getTime() + 86400000); // Ends next day
      }
      
      return isWithinInterval(now, { start, end });
    } catch (e) {
      return false;
    }
  };

  const getShiftProgress = (shift: Shift) => {
    const now = new Date();
    try {
      const shiftDate = parse(shift.date, 'yyyy-MM-dd', new Date());
      const start = parse(shift.startTime, 'HH:mm', shiftDate);
      let end = parse(shift.endTime, 'HH:mm', shiftDate);
      
      if (end < start) {
        end = new Date(end.getTime() + 86400000);
      }
      
      const total = end.getTime() - start.getTime();
      const current = now.getTime() - start.getTime();
      return Math.min(Math.max((current / total) * 100, 0), 100);
    } catch (e) {
      return 0;
    }
  };

  const getStatus = (userId: string, shift: Shift) => {
    const user = users.find(u => u.uid === userId);
    if (!isShiftActive(shift)) return 'Scheduled';
    if (user?.isBreakActive) return 'On Break';
    return 'Active';
  };

  const formatTime12 = (time: string) => {
    try {
      return format(parse(time, 'HH:mm', new Date()), 'HH:mm');
    } catch (e) {
      return time;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse p-4">
        <div className="h-4 w-48 bg-surface-2" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-surface-2 border border-main-border" />
          ))}
        </div>
      </div>
    );
  }

  const getFilteredShifts = () => {
    const now = new Date();
    const todayStr = format(now, 'yyyy-MM-dd');
    const activeShifts = shifts.filter(isShiftActive);
    
    // If show active only, use active list. Otherwise, use all shifts from TODAY.
    const baseList = showActiveOnly ? activeShifts : shifts.filter(s => s.date === todayStr);
    const map = new Map<string, Shift>();
    
    // Sort to prioritize active shifts if multiple exist for a person
    const sorted = [...baseList].sort((a, b) => {
      const aActive = isShiftActive(a) ? 1 : 0;
      const bActive = isShiftActive(b) ? 1 : 0;
      return bActive - aActive;
    });

    sorted.forEach(s => {
      const userProfile = users.find(u => u.uid === s.userId);
      const identifier = (userProfile?.email || s.userId).toLowerCase();
      if (!map.has(identifier)) {
        map.set(identifier, s);
      }
    });
    return Array.from(map.values());
  };

  const filteredShifts = getFilteredShifts();
  const uniqueActiveCount = filteredShifts.filter(isShiftActive).length;

  const activePersonnel = filteredShifts.filter(isShiftActive);

  const handleAIRebalance = async () => {
    if (activePersonnel.length === 0 || isAnalyzing) return;
    setIsAnalyzing(true);
    try {
      // Fetch recent wellness data
      const wellnessSnap = await getDocs(query(collection(db, 'wellness'), orderBy('timestamp', 'desc'), limit(20)));
      const wellness = wellnessSnap.docs.map(d => d.data());
      
      const advice = await analyzeRotation(activePersonnel, wellness);
      setRotationAdvice(advice);
      setShowAdviceModal(true);
    } catch (e) {
      console.error("AI Rotation analysis failed:", e);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-8">
      <AnimatePresence>
        {showAdviceModal && rotationAdvice && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAdviceModal(false)} className="fixed inset-0 bg-surface-3/80 backdrop-blur-md" />
             <motion.div initial={{ scale: 0.98, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.98, opacity: 0 }} className="bg-surface-1 rounded-md border border-main-border p-8 w-full max-w-lg relative z-10 shadow-xl">
                <div className="flex justify-between items-center mb-8">
                   <div className="flex items-center gap-3">
                      <Brain size={20} className="text-primary" />
                      <div>
                         <h3 className="text-lg font-medium text-main-text mb-1 uppercase tracking-tight italic">Rotation_Optimization_Matrix</h3>
                         <p className="text-[10px] font-mono text-main-text-muted uppercase tracking-wider">Kernel Analytical Overlay // Sigma-9</p>
                      </div>
                   </div>
                   <button onClick={() => setShowAdviceModal(false)} className="text-main-text-muted hover:text-main-text transition-colors">
                      <X size={20} />
                   </button>
                </div>
                
                <div className="space-y-6">
                   <div className={`p-4 rounded border flex items-center gap-4 ${
                     rotationAdvice.riskLevel === 'high' ? 'bg-error/5 border-error/20' : 
                     rotationAdvice.riskLevel === 'medium' ? 'bg-warning/5 border-warning/20' : 
                     'bg-success/5 border-success/20'
                   }`}>
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 border-current ${
                        rotationAdvice.riskLevel === 'high' ? 'text-error animate-pulse' : 
                        rotationAdvice.riskLevel === 'medium' ? 'text-warning' : 
                        'text-success'
                      }`}>
                         {rotationAdvice.riskLevel === 'high' ? <AlertTriangle size={20} /> : <ShieldCheck size={20} />}
                      </div>
                      <div className="space-y-1">
                         <span className="text-[9px] font-mono opacity-50 uppercase tracking-[0.2em]">Aggregated_Risk_Index</span>
                         <p className="text-xs font-mono font-bold uppercase">{rotationAdvice.riskLevel}_THREAT_LEVEL</p>
                      </div>
                   </div>

                   <p className="text-[11px] font-sans text-main-text leading-relaxed bg-surface-2 p-4 border border-main-border rounded border-l-primary border-l-2">
                     "{rotationAdvice.rationale}"
                   </p>

                   <div className="space-y-3">
                      <h4 className="text-[10px] font-mono text-main-text-muted uppercase tracking-widest border-b border-main-border pb-2">Tactical_Directives</h4>
                      {rotationAdvice.recommendations && rotationAdvice.recommendations.map((rec: any, i: number) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-surface-2 border border-main-border rounded group hover:border-primary/30 transition-colors">
                           <div className="flex items-center gap-3">
                              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                              <span className="text-[11px] font-mono font-bold text-main-text uppercase">{rec.unitName}</span>
                           </div>
                           <div className="text-right">
                              <span className="text-[9px] font-mono text-primary font-bold uppercase block">{rec.action}</span>
                              <span className="text-[8px] font-mono text-main-text-muted leading-none">{rec.reason}</span>
                           </div>
                        </div>
                      ))}
                   </div>
                </div>

                <div className="mt-8">
                   <button onClick={() => setShowAdviceModal(false)} className="w-full py-4 bg-primary hover:bg-primary-hover text-surface-1 font-mono text-[10px] uppercase tracking-widest transition-all rounded shadow-lg shadow-primary/20 font-bold">Acknowledge_Protocol</button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-main-border pb-6">
        <div className="space-y-1">
          <h2 className="text-xl font-display font-medium text-main-text uppercase tracking-tight">Roster Telemetry</h2>
          <p className="text-[10px] font-mono text-main-text-muted uppercase tracking-widest">Real-time personnel deployment state</p>
        </div>
        <div className="flex flex-wrap items-center gap-6">
          {isAdmin && (
            <button 
              onClick={handleAIRebalance}
              disabled={isAnalyzing || activePersonnel.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/30 text-primary rounded-md text-[10px] font-mono uppercase tracking-widest hover:bg-primary/20 transition-all disabled:opacity-50"
            >
              {isAnalyzing ? <Loader2 size={12} className="animate-spin" /> : <Brain size={12} />}
              AI_Load_Rebalancer
            </button>
          )}
          <div className="flex bg-surface-2 border border-main-border p-1 rounded">
            <button 
              onClick={() => setShowActiveOnly(true)}
              className={`px-4 py-1.5 rounded-sm text-[9px] font-mono uppercase tracking-[0.2em] transition-all group active:scale-95 ${
                showActiveOnly ? 'bg-primary text-surface-1 shadow-md' : 'text-main-text-muted hover:text-main-text hover:bg-surface-3'
              }`}
            >
              Active_Only
            </button>
            <button 
              onClick={() => setShowActiveOnly(false)}
              className={`px-4 py-1.5 rounded-sm text-[9px] font-mono uppercase tracking-[0.2em] transition-all group active:scale-95 ${
                !showActiveOnly ? 'bg-primary text-surface-1 shadow-md' : 'text-main-text-muted hover:text-main-text hover:bg-surface-3'
              }`}
            >
              Sync_All
            </button>
          </div>
          <div className="px-4 py-2 bg-surface-1 border border-main-border rounded flex items-center gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-main-text-muted">
              {uniqueActiveCount.toString().padStart(2, '0')} Units Online
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredShifts.length === 0 ? (
          <div className="col-span-full py-20 text-center bg-surface-1 border border-main-border border-dashed rounded opacity-50">
            <p className="text-[10px] font-mono uppercase tracking-widest text-main-text-muted">
              {showActiveOnly ? "Null records at active coordinate." : "Archive empty for current temporal cycle."}
            </p>
          </div>
        ) : (
          filteredShifts.map((shift, idx) => {
            const status = getStatus(shift.userId, shift);
            const isActive = status === 'Active';
            const onBreak = status === 'On Break';

            return (
              <motion.div
                key={shift.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`p-6 rounded-md border bg-surface-1 transition-all group hover:bg-surface-2/30 ${
                  isActive ? 'border-primary/30' : 
                  onBreak ? 'border-warning/30' : 
                  'border-main-border shadow-sm'
                }`}
              >
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 flex items-center justify-center font-mono text-xs bg-surface-2 border border-main-border rounded text-main-text-muted group-hover:text-primary transition-colors">
                      {shift.userName.charAt(0).toUpperCase()}
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-medium text-main-text text-sm uppercase tracking-tight">{shift.userName}</h3>
                      <div className="flex items-center gap-2">
                        <div className={`w-1 h-1 rounded-full ${isActive ? 'bg-success' : onBreak ? 'bg-warning animate-pulse' : 'bg-main-text-muted/30'}`} />
                        <span className={`text-[8px] font-mono uppercase tracking-[0.2em] ${
                          isActive ? 'text-success' : 
                          onBreak ? 'text-warning' : 
                          'text-main-text-muted/50'
                        }`}>
                          {status.replace(' ', '_')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-5">
                  {isActive && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center px-0.5">
                        <span className="text-[8px] font-mono text-main-text-muted/40 uppercase tracking-[0.2em]">Deployment_Progression</span>
                        <span className="text-[9px] font-mono text-main-text-muted">{Math.round(getShiftProgress(shift))}%</span>
                      </div>
                      <div className="h-1 w-full bg-surface-3 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${getShiftProgress(shift)}%` }}
                          className={`h-full transition-all duration-1000 ${onBreak ? 'bg-warning' : 'bg-primary'}`}
                        />
                      </div>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-6 pt-5 border-t border-main-border/50">
                    <div>
                      <p className="text-[8px] font-mono text-main-text-muted/40 uppercase tracking-[0.2em] mb-1.5">Node_Entry</p>
                      <p className="text-xs font-mono text-main-text font-medium">{formatTime12(shift.startTime)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[8px] font-mono text-main-text-muted/40 uppercase tracking-[0.2em] mb-1.5">Node_Exit</p>
                      <p className="text-xs font-mono text-main-text font-medium">{formatTime12(shift.endTime)}</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
