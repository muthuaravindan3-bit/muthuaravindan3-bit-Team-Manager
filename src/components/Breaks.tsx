import React, { useEffect, useState, useRef } from 'react';
import { collection, doc, updateDoc, addDoc, query, where, orderBy, onSnapshot, arrayUnion } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../AuthContext';
import { Play, Square, MapPin, History, Activity, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { BreakLog, GlobalSettings } from '../types';

export function Breaks() {
  const { user, profile } = useAuth();
  const [isActive, setIsActive] = useState(false);
  const [currentLogId, setCurrentLogId] = useState<string | null>(null);
  const [path, setPath] = useState<any[]>([]);
  const [history, setHistory] = useState<BreakLog[]>([]);
  const [settings, setSettings] = useState<GlobalSettings>({ maxBreakDurationMinutes: 60, defaultHourlyRate: 20 });
  const [loading, setLoading] = useState(true);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [now, setNow] = useState(Date.now());
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!user) return;
    
    // Fetch settings
    const unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (snapshot) => {
      if (snapshot.exists()) {
        setSettings(snapshot.data() as GlobalSettings);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/global');
    });

    const q = query(
      collection(db, 'breakLogs'),
      where('userId', '==', user.uid),
      orderBy('startTime', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BreakLog));
      setHistory(logs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'breakLogs');
    });

    return () => {
      unsubscribe();
      unsubSettings();
      if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, [user]);

  useEffect(() => {
    if (profile?.isBreakActive && profile.activeBreakLogId) {
      setIsActive(true);
      setCurrentLogId(profile.activeBreakLogId);
    } else {
      setIsActive(false);
      setCurrentLogId(null);
    }
  }, [profile]);

  useEffect(() => {
    if (isActive && currentLogId) {
      const activeLog = history.find(h => h.id === currentLogId);
      if (activeLog && activeLog.startTime) {
        setElapsedTime(Math.floor((now - activeLog.startTime) / 1000));
      }
    } else {
      setElapsedTime(0);
    }
  }, [isActive, currentLogId, history, now]);

  const startBreak = async () => {
    if (!user || !profile) return;
    setIsActive(true);
    const startTime = Date.now();
    
    try {
      const logRef = await addDoc(collection(db, 'breakLogs'), {
        userId: user.uid,
        userName: profile.displayName || profile.email,
        startTime,
        endTime: null,
        path: []
      });
      setCurrentLogId(logRef.id);

      await updateDoc(doc(db, 'users', user.uid), {
        isBreakActive: true,
        activeBreakLogId: logRef.id,
        breakStartTime: startTime
      });

      watchIdRef.current = navigator.geolocation.watchPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          const newPoint = { latitude, longitude, timestamp: Date.now() };
          setPath(prev => [...prev, newPoint]);
          
          await updateDoc(doc(db, 'users', user.uid), {
            lastLocation: newPoint
          });

          await updateDoc(doc(db, 'breakLogs', logRef.id), {
            path: arrayUnion(newPoint)
          });
        },
        (error) => console.error("Geolocation error", error),
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );

    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'breakLogs');
    }
  };

  const stopBreak = async () => {
    if (!user || !currentLogId) return;
    
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    const endTime = Date.now();
    try {
      await updateDoc(doc(db, 'breakLogs', currentLogId), {
        endTime,
        duration: endTime - (history.find(h => h.id === currentLogId)?.startTime || endTime)
      });

      await updateDoc(doc(db, 'users', user.uid), {
        isBreakActive: false,
        activeBreakLogId: null,
        breakStartTime: null
      });

      setIsActive(false);
      setCurrentLogId(null);
      setPath([]);

    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'breakLogs');
    }
  };

  const formatDuration = (ms?: number) => {
    if (ms === undefined || ms === null || isNaN(ms)) return '00s';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    return minutes > 0 ? `${minutes}m ${seconds % 60}s` : `${seconds}s`;
  };

  const isOverLimit = isActive && (elapsedTime / 60) > settings.maxBreakDurationMinutes;

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-main-border pb-6">
        <div>
          <h2 className="text-xl font-display font-medium text-main-text flex items-center gap-2">
             <Activity size={20} />
             Break Logs & Control
          </h2>
          <p className="text-sm text-main-text-muted mt-1 font-sans">Active resource monitoring and interval logging protocols.</p>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Main Control Panel */}
        <div className="bg-surface-1 border border-main-border rounded-md p-8">
           <div className="flex flex-col lg:flex-row items-center justify-between gap-12">
              <div className="flex items-center gap-8">
                 <div className={`w-20 h-20 flex items-center justify-center border rounded transition-all duration-500 ${
                    isActive 
                      ? (isOverLimit ? 'bg-error/5 border-error text-error shadow-[0_0_20px_rgba(var(--color-error),0.1)]' : 'bg-primary/5 border-primary text-primary shadow-[0_0_20px_rgba(var(--color-primary),0.1)]') 
                      : 'bg-surface-2 border-main-border text-main-text-muted/30'
                 }`}>
                    <Activity size={32} className={isActive ? "animate-pulse" : ""} />
                 </div>
                 
                 <div className="space-y-1">
                    <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-main-text-muted/40">
                       {isActive ? 'Session_Live' : 'Signal_Ready'}
                    </p>
                    {isActive ? (
                      <p className={`text-6xl font-mono tracking-tighter ${isOverLimit ? 'text-error' : 'text-main-text'}`}>
                        {Math.floor(elapsedTime / 60).toString().padStart(2, '0')}<span className="opacity-30">:</span>{(elapsedTime % 60).toString().padStart(2, '0')}
                      </p>
                    ) : (
                      <p className="text-4xl font-mono text-main-text-muted/20 tracking-tighter">
                        00:00
                      </p>
                    )}
                 </div>
              </div>

              {isActive && (
                <div className="flex gap-12 px-12 border-x border-main-border/50 py-2">
                   <div>
                      <p className="text-[9px] font-mono text-main-text-muted uppercase tracking-[0.2em] mb-2">GPS_Points</p>
                      <p className="text-xl font-mono text-primary leading-none uppercase">{path.length.toString().padStart(2, '0')}</p>
                   </div>
                   <div>
                      <p className="text-[9px] font-mono text-main-text-muted uppercase tracking-[0.2em] mb-2">Threshold</p>
                      <p className="text-xl font-mono text-main-text leading-none uppercase">{settings.maxBreakDurationMinutes}M</p>
                   </div>
                </div>
              )}

              <div className="w-full lg:w-auto">
                 {isActive ? (
                     <button
                       onClick={stopBreak}
                       className="w-full lg:w-64 bg-error hover:bg-error-hover text-surface-1 py-4 px-8 rounded font-mono text-[10px] uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-3 group active:scale-95"
                     >
                       <Square size={14} fill="currentColor" className="group-hover:scale-110 transition-transform" />
                       <span>Terminate Session</span>
                     </button>
                 ) : (
                   <button
                       onClick={startBreak}
                       className="w-full lg:w-64 bg-primary hover:bg-primary-hover text-surface-1 py-4 px-8 rounded font-mono text-[10px] uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-3 group active:scale-95 shadow-xl shadow-primary/10"
                     >
                       <Play size={14} fill="currentColor" className="group-hover:scale-110 transition-transform" />
                       <span>Initialize Shift</span>
                     </button>
                 )}
              </div>
           </div>
           
           {isOverLimit && (
             <motion.div 
               initial={{ opacity: 0, y: 10 }}
               animate={{ opacity: 1, y: 0 }}
               className="mt-8 p-4 bg-error/5 border border-error/20 rounded flex items-center gap-3 text-error"
             >
                 <AlertTriangle size={16} />
                 <p className="text-[10px] font-mono uppercase tracking-[0.2em]">Protocol Violation: Maximum duration threshold exceeded</p>
             </motion.div>
           )}
        </div>

        {/* History Panel */}
        <div className="space-y-6">
           <div className="flex items-center justify-between border-b border-main-border/50 pb-4">
              <div className="flex items-center gap-3">
                 <History size={16} className="text-main-text-muted/30" />
                 <h3 className="text-[11px] font-mono uppercase tracking-[0.3em] text-main-text-muted">Temporal Archives</h3>
              </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
             {loading ? (
               <div className="col-span-full font-mono text-[10px] uppercase text-main-text-muted animate-pulse tracking-widest text-center py-12">Retrieving archival data...</div>
             ) : history.length === 0 ? (
               <div className="col-span-full py-12 text-center bg-surface-1 border border-main-border border-dashed rounded">
                   <p className="text-[10px] font-mono uppercase text-main-text-muted/30 tracking-[0.2em]">No historical telemetry found</p>
               </div>
             ) : (
               history.map((log, idx) => (
                 <motion.div 
                   key={log.id} 
                   initial={{ opacity: 0 }}
                   animate={{ opacity: 1 }}
                   className="bg-surface-1 border border-main-border rounded-md p-5 flex flex-col justify-between group hover:border-primary/30 transition-all hover:bg-surface-2/30"
                 >
                   <div className="flex justify-between items-start mb-6">
                     <div className="space-y-1">
                       <p className="text-[9px] font-mono text-primary uppercase tracking-widest leading-none">
                         {format(new Date(log.startTime), 'MMM dd')}
                       </p>
                       <p className="text-sm font-mono text-main-text-muted font-medium whitespace-nowrap">
                         {format(new Date(log.startTime), 'HH:mm')} — {log.endTime ? format(new Date(log.endTime), 'HH:mm') : 'LOGGING' }
                       </p>
                     </div>
                     <MapPin size={12} className="text-main-text-muted/20 group-hover:text-primary/50 transition-colors" />
                   </div>
                   
                   <div className="flex justify-between border-t border-main-border/50 pt-3">
                       <div>
                         <p className="text-[8px] font-mono text-main-text-muted/40 uppercase tracking-[0.1em] mb-1">Interval</p>
                         <p className="text-xs font-mono text-main-text-muted font-medium">{formatDuration(log.duration)}</p>
                       </div>
                       <div className="text-right">
                         <p className="text-[8px] font-mono text-main-text-muted/40 uppercase tracking-[0.1em] mb-1">Nodes</p>
                         <p className="text-xs font-mono text-main-text-muted font-medium">{log.path.length.toString().padStart(2, '0')}</p>
                       </div>
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

function format(date: Date, pattern: string) {
  // Simple custom format for now
  if (pattern === 'HH:mm') return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  if (pattern === 'HH:mm:ss') return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  if (pattern === 'MMM dd') return date.toLocaleDateString([], { month: 'short', day: '2-digit' });
  return date.toISOString();
}
