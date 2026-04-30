import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, limit, addDoc, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Shift, Announcement, UserProfile, WellnessCheck } from '../types';
import { Calendar as CalendarIcon, Clock, Megaphone, Terminal, Activity, Zap, Layers, Users, Circle, Heart, Smile, Meh, Frown, AlertTriangle, ShieldCheck, Brain, Sparkles, ChevronRight, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, isToday, isWithinInterval, parse } from 'date-fns';
import { useTimezone } from '../TimezoneContext';
import { useAuth } from '../AuthContext';
import { TacticalBriefing } from './TacticalBriefing';
import { SystemHealth } from './SystemHealth';
import { generateGeneralInsight } from '../geminiService';
import { WorkloadHeatmap } from './WorkloadHeatmap';

export function Dashboard() {
  const { user, profile, isAdmin } = useAuth();
  const { convertToUserTime } = useTimezone();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [wellnessSubmitting, setWellnessSubmitting] = useState(false);
  const [hasCheckedIn, setHasCheckedIn] = useState(false);
  const [personalInsight, setPersonalInsight] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'shifts'), orderBy('date', 'desc'));
    const unsubShifts = onSnapshot(q, (snapshot) => {
      const shiftData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Shift));
      setShifts(shiftData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'shifts');
    });

    const unsubAnnouncements = onSnapshot(query(collection(db, 'announcements'), orderBy('createdAt', 'desc'), limit(5)), (snapshot) => {
      setAnnouncements(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'announcements');
    });

    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const allUsers = snapshot.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile));
      const seen = new Set();
      const uniqueUsers = allUsers.filter(u => {
        const identifier = (u.email || u.uid).toLowerCase();
        if (seen.has(identifier)) return false;
        seen.add(identifier);
        return true;
      });
      setUsers(uniqueUsers);
    }, (error) => {
      console.warn('Dashboard: Could not load all users (likely permission restriction)');
    });

    if (user) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const qWellness = query(
        collection(db, 'wellness'),
        where('userId', '==', user.uid),
        where('timestamp', '>=', today.getTime())
      );
      const unsubWellness = onSnapshot(qWellness, (snapshot) => {
        if (!snapshot.empty) setHasCheckedIn(true);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'wellness');
      });
      return () => {
        unsubShifts();
        unsubAnnouncements();
        unsubUsers();
        unsubWellness();
      };
    }

    return () => {
      unsubShifts();
      unsubAnnouncements();
      unsubUsers();
    };
  }, [user]);

  const handleWellnessSubmit = async (score: number, status: WellnessCheck['status']) => {
    if (!user || wellnessSubmitting) return;
    setWellnessSubmitting(true);
    try {
      await addDoc(collection(db, 'wellness'), {
        userId: user.uid,
        userName: profile?.displayName || profile?.email,
        score,
        status,
        timestamp: Date.now()
      });
      setHasCheckedIn(true);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'wellness');
    } finally {
      setWellnessSubmitting(false);
    }
  };

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
        end = new Date(end.getTime() + 86400000);
      }
      
      return isWithinInterval(now, { start, end });
    } catch (e) {
      return false;
    }
  };

  const localizedShifts = shifts.map(s => {
    const locStart = convertToUserTime(s.date, s.startTime);
    const locEnd = convertToUserTime(s.date, s.endTime);
    return { ...s, date: locStart.date, startTime: locStart.time, endTime: locEnd.time };
  });

  const sanitizedShifts = localizedShifts.reduce((acc: Shift[], s) => {
    const userProfile = users.find(u => u.uid === s.userId);
    const identifier = (userProfile?.email || s.userId).toLowerCase();
    const key = `${identifier}_${s.date}_${s.startTime}_${s.endTime}`;
    if (!acc.find(prev => {
      const pProfile = users.find(u => u.uid === prev.userId);
      const pIdentifier = (pProfile?.email || prev.userId).toLowerCase();
      return `${pIdentifier}_${prev.date}_${prev.startTime}_${prev.endTime}` === key;
    })) {
      acc.push(s);
    }
    return acc;
  }, []);

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const upcomingShifts = sanitizedShifts
    .filter(s => s.date >= todayStr)
    .sort((a, b) => a.date.localeCompare(b.date));

  const groupedUpcoming = upcomingShifts.reduce((acc: Record<string, Shift[]>, shift) => {
    if (!acc[shift.date]) acc[shift.date] = [];
    acc[shift.date].push(shift);
    return acc;
  }, {});

  const onDutyUsers = sanitizedShifts.filter(isShiftActive).reduce((acc: any[], current) => {
    const userProfile = users.find(u => u.uid === current.userId);
    const identifier = (userProfile?.email || current.userId).toLowerCase();
    
    if (!acc.find(u => {
      const uProfile = users.find(up => up.uid === u.userId);
      return (uProfile?.email || u.userId).toLowerCase() === identifier;
    })) {
      acc.push({
        ...current,
        isBreakActive: userProfile?.isBreakActive
      });
    }
    return acc;
  }, []);

  const userShifts = sanitizedShifts.filter(s => s.userId === user?.uid);

  const fetchPersonalInsight = async () => {
    if (!user || userShifts.length === 0 || isAnalyzing) return;
    setIsAnalyzing(true);
    try {
      const prompt = `Analyze these upcoming shifts for unit ${profile?.displayName || user.email}: ${JSON.stringify(userShifts.slice(0, 5))}. 
      Identify potential fatigue vectors or optimize the transition between duties. CRITICAL: This is a 24/7 continuous operations environment. Do NOT mention standard 9-5 hours, weekends, or any specific 'recovery windows' like '15-hour recovery window'. 
      Return a concise, tactical single-sentence recommendation without markdown formatting. Do NOT use the words 'recovery windows' or 'daytime block'.`;
      
      const response = await generateGeneralInsight(prompt); 
      setPersonalInsight(response || 'Maintain current operational vector.');
    } catch (e) {
      console.error("Personal insight extraction failed:", e);
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
     if (!loading && userShifts.length > 0 && !personalInsight) {
        fetchPersonalInsight();
     }
  }, [loading, userShifts.length]);

  if (loading) {
    return (
      <div className="p-8 space-y-8 animate-pulse">
        <div className="h-12 w-1/4 bg-surface-3/50 rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3].map(i => <div key={i} className="h-48 bg-surface-3/30 rounded-2xl border border-primary/20 shadow-[0_0_15px_rgba(0,240,255,0.1)]" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 font-sans pb-20 relative z-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-primary/20 pb-6 shadow-[0_4px_30px_rgba(0,240,255,0.05)]">
        <div>
          <h1 className="text-3xl font-display font-medium tracking-widest text-primary mb-1 uppercase text-shadow-md">Grid Core</h1>
          <div className="flex items-center gap-2 bg-surface-2 px-3 py-1 rounded border border-main-border w-max">
             <Activity size={12} className="text-success animate-pulse shadow-[0_0_10px_rgba(0,255,102,0.8)]" />
             <p className="text-main-text-muted text-[10px] font-mono tracking-widest uppercase">System Status: Active // Kernel: Stable</p>
          </div>
        </div>
        
        <div className="flex gap-4">
          <div className="glass-card px-5 py-4 min-w-[120px] transition-transform duration-300 hover:-translate-y-1 group">
            <p className="text-[9px] font-mono text-primary uppercase tracking-[0.2em] mb-1">Daily Log</p>
            <p className="text-3xl font-bold text-main-text font-mono tracking-tighter group-hover:text-primary transition-colors text-shadow-sm">
              {sanitizedShifts.filter(s => s.date === todayStr).length.toString().padStart(2, '0')}
            </p>
          </div>
          <div className="glass-card px-5 py-4 min-w-[120px] transition-transform duration-300 hover:-translate-y-1 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-2">
               <div className="w-2 h-2 rounded-full bg-success shadow-[0_0_10px_rgba(0,255,102,0.8)] animate-pulse opacity-75" />
            </div>
            <p className="text-[9px] font-mono text-success uppercase tracking-[0.2em] mb-1">Active Unit</p>
            <p className="text-3xl font-bold text-main-text font-mono tracking-tighter group-hover:text-success transition-colors text-shadow-sm">
              {onDutyUsers.length.toString().padStart(2, '0')}
            </p>
          </div>
        </div>
      </div>

      <SystemHealth />

      {personalInsight && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card bg-primary/5 p-5 flex items-start gap-5 relative overflow-hidden group shadow-[0_0_20px_rgba(0,240,255,0.1)]"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
          <div className="absolute top-0 right-0 p-3 opacity-30">
            <Sparkles size={24} className="text-primary animate-pulse" />
          </div>
          <div className="w-12 h-12 rounded-lg bg-primary/20 border border-primary/50 flex items-center justify-center text-primary flex-shrink-0 shadow-[0_0_15px_rgba(0,240,255,0.3)]">
            <Brain size={24} />
          </div>
          <div className="space-y-2 z-10">
             <div className="flex items-center gap-3">
                <span className="text-[10px] font-mono text-primary uppercase font-bold tracking-widest">Global_AI_Advisory</span>
                {isAnalyzing && <Loader2 size={10} className="animate-spin text-primary" />}
             </div>
             <p className="text-xs font-mono text-main-text uppercase tracking-widest leading-relaxed opacity-90 drop-shadow">
               " {personalInsight} "
             </p>
             <button 
               onClick={fetchPersonalInsight}
               className="text-[9px] font-mono text-primary uppercase hover:bg-primary/20 transition-all flex items-center gap-2 mt-2 px-3 py-1 rounded border border-primary/30 active:scale-95 shadow-[0_0_10px_rgba(0,240,255,0.1)]"
             >
               <Activity size={10} />
               Reanalyze_Vector
             </button>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        <div className="md:col-span-8 space-y-10">
          <section>
            <div className="flex items-center gap-3 mb-6 bg-surface-2 w-max px-4 py-1.5 rounded-full border border-primary/20 shadow-[0_0_15px_rgba(0,240,255,0.1)]">
              <div className="w-2.5 h-2.5 rounded-full bg-primary shadow-[0_0_8px_rgba(0,240,255,0.8)] animate-pulse" />
              <h2 className="text-xs font-mono font-bold text-primary uppercase tracking-[0.3em] text-shadow-sm">Live Personnel Manifest</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {onDutyUsers.length === 0 ? (
                <div className="col-span-full p-16 text-center glass-card border-dashed">
                  <p className="text-main-text-muted text-xs font-mono tracking-widest uppercase">Null Output / No Units Active</p>
                </div>
              ) : (
                <AnimatePresence>
                  {onDutyUsers.map((u, idx) => (
                    <motion.div
                      key={u.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className={`p-5 glass-card relative group shadow-[0_0_15px_rgba(0,255,102,0.05)] ${
                        u.isBreakActive ? 'hover:border-warning/60 hover:shadow-[0_0_20px_rgba(255,191,0,0.2)]' : 'hover:border-success/60 hover:shadow-[0_0_20px_rgba(0,255,102,0.2)]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="space-y-2">
                          <span className="text-sm font-bold text-main-text block uppercase tracking-wider truncate drop-shadow">{u.userName}</span>
                          <div className="flex items-center gap-2">
                             <div className={`w-1.5 h-1.5 rounded-full shadow-[0_0_5px_currentColor] ${u.isBreakActive ? 'bg-warning text-warning animate-pulse' : 'bg-success text-success'}`} />
                             <span className={`text-[9px] font-mono uppercase tracking-[0.2em] font-bold ${
                               u.isBreakActive ? 'text-warning' : 'text-success'
                             }`}>
                               {u.isBreakActive ? 'Standby' : 'Active'}
                             </span>
                          </div>
                        </div>
                        <div className={`w-10 h-10 flex flex-shrink-0 items-center justify-center font-display font-bold text-lg bg-surface-2 border rounded-full transition-all duration-300 ${
                          u.isBreakActive ? 'text-warning border-warning/30 group-hover:bg-warning/10' : 'text-success border-success/30 group-hover:bg-success/10'
                        }`}>
                          {u.userName.charAt(0).toUpperCase()}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>
          </section>

          <section>
            <div className="flex items-center gap-3 mb-6 bg-surface-2 w-max px-4 py-1.5 rounded-full border border-secondary/20 shadow-[0_0_15px_rgba(255,0,234,0.1)]">
              <div className="w-2.5 h-2.5 rounded-full bg-secondary shadow-[0_0_8px_rgba(255,0,234,0.8)]" />
              <h2 className="text-xs font-mono font-bold text-secondary uppercase tracking-[0.3em] text-shadow-sm">Deployment Matrix</h2>
            </div>

            <div className="glass-panel overflow-hidden border-secondary/30">
              <div className="grid grid-cols-[110px_1fr_90px_90px] gap-4 p-5 bg-surface-2 text-[10px] font-mono text-secondary uppercase tracking-[0.3em] border-b border-main-border shadow-inner font-bold">
                <div>Date_ID</div>
                <div>Entity</div>
                <div className="text-center">Start</div>
                <div className="text-center">End</div>
              </div>
              
              <div className="divide-y divide-main-border/50 bg-surface-1/50 backdrop-blur-md">
                {Object.keys(groupedUpcoming).length === 0 ? (
                  <div className="p-16 text-center text-xs font-mono text-main-text-muted/50 uppercase tracking-[0.3em]">
                    Empty Matrix Data
                  </div>
                ) : (
                  Object.entries(groupedUpcoming).map(([date, dateShifts]) => (
                      dateShifts.map((shift, index) => {
                        const isTodayShift = isToday(parse(shift.date, 'yyyy-MM-dd', new Date()));
                        return (
                          <div
                            key={shift.id}
                            className={`grid grid-cols-[110px_1fr_90px_90px] gap-4 px-5 py-4 items-center text-sm transition-all duration-200 ${
                              isTodayShift ? 'bg-primary/5 hover:bg-primary/15' : 'hover:bg-surface-2/80'
                            }`}
                          >
                            <div className={`font-mono text-xs tracking-widest uppercase ${isTodayShift ? 'text-primary font-bold shadow-[0_0_5px_rgba(0,240,255,0.5)]' : 'text-main-text-muted'}`}>
                              {isTodayShift ? '> PRESENT' : format(parse(date, 'yyyy-MM-dd', new Date()), 'MMM dd')}
                            </div>
                            <div className="text-xs font-bold text-main-text uppercase tracking-widest truncate">
                              {shift.userName}
                            </div>
                            <div className="font-mono text-[10px] text-main-text-muted tracking-widest text-center bg-surface-2 py-1 rounded border border-main-border">
                              {shift.startTime}
                            </div>
                            <div className="font-mono text-[10px] text-main-text-muted tracking-widest text-center bg-surface-2 py-1 rounded border border-main-border">
                              {shift.endTime}
                            </div>
                          </div>
                        );
                      })
                  ))
                )}
              </div>
            </div>
          </section>

          <section>
            <WorkloadHeatmap shifts={sanitizedShifts} />
          </section>
        </div>
        
        <div className="md:col-span-4 space-y-10">
          <section>
            <div className="flex items-center gap-3 mb-6 bg-surface-2 w-max px-4 py-1.5 rounded-full border border-info/20 shadow-[0_0_15px_rgba(0,208,255,0.1)]">
              <div className="w-2.5 h-2.5 rounded-full bg-info shadow-[0_0_8px_rgba(0,208,255,0.8)]" />
              <h2 className="text-xs font-mono font-bold text-info uppercase tracking-[0.3em] text-shadow-sm">Sector_Briefing</h2>
            </div>
            <TacticalBriefing />
          </section>

          <section>
             <div className="flex items-center gap-3 mb-6 bg-surface-2 w-max px-4 py-1.5 rounded-full border border-success/20 shadow-[0_0_15px_rgba(0,255,102,0.1)]">
              <div className="w-2.5 h-2.5 rounded-full bg-success shadow-[0_0_8px_rgba(0,255,102,0.8)]" />
              <h2 className="text-xs font-mono font-bold text-success uppercase tracking-[0.3em] text-shadow-sm">Unit_Readiness</h2>
            </div>

            <div className="glass-panel p-6 space-y-6 relative group overflow-hidden border-success/20">
              <div className="absolute top-0 right-0 w-32 h-32 bg-success/10 rounded-full -mr-16 -mt-16 blur-2xl group-hover:scale-150 transition-transform duration-1000 pointer-events-none" />
              
              {!hasCheckedIn ? (
                <div className="space-y-6 relative z-10">
                  <div className="space-y-2">
                    <p className="text-[10px] font-mono text-success uppercase tracking-[0.2em] leading-none font-bold">Sync Health Telemetry</p>
                    <h3 className="text-sm font-display font-medium text-main-text">Upload current status</h3>
                  </div>
                  
                  <div className="grid grid-cols-4 gap-3">
                    {[
                      { icon: Smile, status: 'optimal', score: 10, color: 'text-success', border: 'border-success/30 hover:border-success', glow: 'shadow-[0_0_15px_rgba(0,255,102,0.3)]' },
                      { icon: Meh, status: 'stable', score: 7, color: 'text-info', border: 'border-info/30 hover:border-info', glow: 'shadow-[0_0_15px_rgba(0,208,255,0.3)]' },
                      { icon: Frown, status: 'stress', score: 4, color: 'text-warning', border: 'border-warning/30 hover:border-warning', glow: 'shadow-[0_0_15px_rgba(255,191,0,0.3)]' },
                      { icon: AlertTriangle, status: 'critical', score: 1, color: 'text-error', border: 'border-error/30 hover:border-error', glow: 'shadow-[0_0_15px_rgba(255,42,95,0.3)]' }
                    ].map((item) => (
                      <button
                        key={item.status}
                        onClick={() => handleWellnessSubmit(item.score, item.status as any)}
                        disabled={wellnessSubmitting}
                        className={`flex flex-col items-center gap-2 p-3 bg-surface-2/60 backdrop-blur border ${item.border} rounded-xl transition-all duration-300 hover:bg-surface-3 hover:-translate-y-1 hover:${item.glow} group/btn focus:outline-none`}
                      >
                        <item.icon size={20} className={`${item.color} group-hover/btn:scale-110 drop-shadow-[0_0_5px_currentColor] transition-transform duration-300`} />
                        <span className="text-[8px] font-mono uppercase tracking-[0.1em] opacity-80">{item.status}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-5 py-4 relative z-10">
                  <div className="w-14 h-14 bg-success/15 border border-success/40 rounded-full flex items-center justify-center flex-shrink-0 shadow-[0_0_20px_rgba(0,255,102,0.3)]">
                    <Heart size={28} className="text-success fill-success/40 animate-pulse drop-shadow-[0_0_5px_rgba(0,255,102,0.8)]" />
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="text-sm font-mono text-success uppercase font-bold tracking-[0.2em] text-shadow-sm">Telemetry Logged</h3>
                    <p className="text-[10px] font-mono text-main-text-muted uppercase tracking-widest leading-relaxed">Unit deployment readiness confirmed.</p>
                  </div>
                </div>
              )}
            </div>
          </section>

          <section>
            <div className="flex items-center gap-3 mb-6 bg-surface-2 w-max px-4 py-1.5 rounded-full border border-error/20 shadow-[0_0_15px_rgba(255,42,95,0.1)]">
              <div className="w-2.5 h-2.5 rounded-full bg-error shadow-[0_0_8px_rgba(255,42,95,0.8)]" />
              <h2 className="text-xs font-mono font-bold text-error uppercase tracking-[0.3em] text-shadow-sm">Emergency Broadcasts</h2>
            </div>

            <div className="space-y-4">
              {announcements.length === 0 ? (
                <div className="p-10 glass-card border-dashed text-center">
                   <p className="text-[10px] font-mono text-main-text-muted uppercase tracking-[0.3em]">No Active Broadcasts</p>
                </div>
              ) : (
                announcements.map((a, i) => (
                  <motion.div 
                    key={a.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className={`p-5 rounded-xl border transition-all duration-300 ${
                      a.priority === 'urgent' 
                        ? 'bg-error/10 border-error/40 shadow-[0_0_15px_rgba(255,42,95,0.2)]' 
                        : 'glass-card border-main-border hover:border-primary/30 hover:shadow-[0_0_15px_rgba(0,240,255,0.1)]'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-4">
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-mono px-2 py-1 rounded bg-surface-2 border uppercase tracking-widest font-bold ${
                          a.priority === 'urgent' 
                            ? 'text-error border-error shadow-[0_0_8px_rgba(255,42,95,0.5)]' 
                            : 'text-primary border-primary shadow-[0_0_8px_rgba(0,240,255,0.2)]'
                        }`}>
                          {a.priority}
                        </span>
                      </div>
                      <span className="text-[9px] font-mono text-main-text-muted tracking-widest bg-surface-2 px-2 py-1 rounded border border-main-border">
                        {format(new Date(a.createdAt), 'HH:mm:ss')}
                      </span>
                    </div>
                    <p className="text-sm text-main-text leading-relaxed font-sans font-medium tracking-wide">
                      {a.content}
                    </p>
                  </motion.div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
