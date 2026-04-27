import React, { useEffect, useState, useRef } from 'react';
import { collection, doc, updateDoc, addDoc, query, where, orderBy, onSnapshot, arrayUnion } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../AuthContext';
import { Play, Square, MapPin, History, Navigation, ShieldAlert, AlertTriangle, Clock, Activity, Target } from 'lucide-react';
import { motion } from 'motion/react';
import { BreakLog, GlobalSettings } from '../types';

export function Breaks() {
  const { user, profile } = useAuth();
  const [isActive, setIsActive] = useState(false);
  const [currentLogId, setCurrentLogId] = useState<string | null>(null);
  const [path, setPath] = useState<any[]>([]);
  const [history, setHistory] = useState<BreakLog[]>([]);
  const [settings, setSettings] = useState<GlobalSettings>({ maxBreakDurationMinutes: 60 });
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
  const isNearingLimit = isActive && !isOverLimit && (elapsedTime / 60) > (settings.maxBreakDurationMinutes - 5);

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="max-w-3xl">
          <h1 className="text-4xl font-bold tracking-tight text-white mb-2">Break Tracker</h1>
          <p className="text-slate-400 font-medium">Monitor and manage your break sessions with GPS tracking.</p>
        </div>
      </div>

      <div className="grid gap-10 xl:grid-cols-12">
        {/* Main Control Panel */}
        <div className="xl:col-span-12">
          <div className="bg-zinc-900 rounded-[2.5rem] border border-white/5 p-12 md:p-20 flex flex-col items-center text-center relative overflow-hidden shadow-xl">
            <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
            
            <motion.div 
              animate={{ 
                scale: isActive ? [1, 1.05, 1] : 1,
                opacity: isActive ? [0.7, 1, 0.7] : 1
              }}
              transition={{ repeat: Infinity, duration: 3 }}
              className={`inline-flex p-8 rounded-3xl mb-10 transition-all duration-500 shadow-2xl ${
                isActive ? (isOverLimit ? 'bg-red-500' : 'bg-indigo-600') : 'bg-white/5 border border-white/5'
              }`}
            >
              {isActive ? <Activity size={40} className="text-white" /> : <Clock size={40} className="text-slate-700" />}
            </motion.div>

            <div className="space-y-4 mb-12">
              <span className={`text-xs font-bold uppercase tracking-[0.2em] px-3 py-1 rounded-full ${isActive ? 'bg-indigo-500/10 text-indigo-400' : 'bg-slate-500/10 text-slate-500'}`}>
                {isActive ? 'Session Active' : 'System Ready'}
              </span>
               
               {isActive ? (
                 <div className="space-y-6">
                   <p className={`text-7xl sm:text-9xl font-bold tracking-tight font-mono ${isOverLimit ? 'text-red-500' : 'text-white'}`}>
                     {Math.floor(elapsedTime / 60).toString().padStart(2, '0')}<span className="opacity-20">:</span>{(elapsedTime % 60).toString().padStart(2, '0')}
                   </p>
                   <div className="flex items-center justify-center gap-10">
                     <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-1">GPS Points</span>
                        <span className="text-xl font-bold text-indigo-400">{path.length}</span>
                     </div>
                     <div className="w-[1px] h-8 bg-white/5" />
                     <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-1">Status</span>
                        <span className="text-xl font-bold text-emerald-500">Live</span>
                     </div>
                   </div>
                 </div>
               ) : (
                <p className="text-3xl sm:text-5xl font-bold tracking-tight text-white/50 max-w-xl mx-auto leading-tight">
                   Need a break? <br/> <span className="text-white/20">Keep track of your time off here.</span>
                </p>
               )}
            </div>

            <div className="w-full max-w-sm">
              {isActive ? (
                 <button
                    onClick={stopBreak}
                    className="w-full bg-red-600 hover:bg-red-700 text-white py-6 rounded-2xl font-bold text-sm uppercase tracking-widest shadow-xl shadow-red-600/20 active:scale-95 transition-all flex items-center justify-center gap-3"
                  >
                    <Square size={20} fill="currentColor" />
                    End Session
                  </button>
              ) : (
                <button
                    onClick={startBreak}
                    className="btn-primary w-full py-6 rounded-2xl font-bold text-sm uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-3"
                  >
                    <Play size={20} fill="currentColor" />
                    Start Session
                  </button>
              )}
            </div>

            {isOverLimit && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-10 p-5 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-4 text-red-500"
              >
                 <AlertTriangle size={24} className="animate-pulse" />
                 <p className="text-xs font-bold uppercase tracking-wider">Break duration limit reached ({settings.maxBreakDurationMinutes}m)</p>
              </motion.div>
            )}
          </div>
        </div>

        {/* History Panel */}
        <div className="xl:col-span-12 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <History size={18} className="text-slate-500" />
              <h2 className="text-xl font-bold text-white">History</h2>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {loading ? (
              [1,2,3].map(i => <div key={i} className="h-32 glass-card animate-pulse" />)
            ) : history.length === 0 ? (
              <div className="col-span-full py-16 text-center glass-card border-dashed">
                 <p className="text-sm font-medium text-slate-600 italic">No previous break sessions.</p>
              </div>
            ) : (
              history.map((log, idx) => (
                <motion.div 
                  key={log.id} 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="glass-card p-6 flex flex-col justify-between"
                >
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1">
                        {format(new Date(log.startTime), 'MMM dd')}
                      </p>
                      <p className="text-xs font-semibold text-slate-500">
                        {format(new Date(log.startTime), 'HH:mm')} — {log.endTime ? format(new Date(log.endTime), 'HH:mm') : '...' }
                      </p>
                    </div>
                    <MapPin size={16} className="text-slate-700" />
                  </div>
                  
                  <div className="flex items-end justify-between border-t border-white/5 pt-4">
                     <div>
                       <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-0.5">Duration</p>
                       <p className="text-xl font-bold text-white">{formatDuration(log.duration)}</p>
                     </div>
                     <div className="text-right">
                       <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-0.5">GPS</p>
                       <p className="text-xs font-semibold text-slate-400">{log.path.length} pts</p>
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
  if (pattern === 'HH:mm') return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  if (pattern === 'HH:mm:ss') return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  if (pattern === 'MMM dd') return date.toLocaleDateString([], { month: 'short', day: '2-digit' });
  return date.toISOString();
}
