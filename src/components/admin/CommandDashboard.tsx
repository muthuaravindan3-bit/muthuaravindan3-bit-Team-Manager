import React, { useState, useEffect } from 'react';
import { UserProfile, GlobalSettings } from '../../types';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { collection, addDoc, getDocs, query, where, limit } from 'firebase/firestore';
import { Users, MapPin, ShieldAlert, Activity, ArrowUpRight, AlertTriangle, Terminal, Zap, BrainCircuit, History, Radio, Send, Sparkles, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { generateStrategicForecast, StrategicForecast } from '../../geminiService';

interface ActivityLog {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  message: string;
  timestamp: number;
  user?: string;
}

interface CommandDashboardProps {
  users: UserProfile[];
  globalSettings: GlobalSettings;
  breakLogs: Record<string, any>;
  now: number;
  onNavigate: (tab: any) => void;
  onEndBreak: (uid: string) => Promise<void>;
  formatDuration: (time: any) => string;
}

export function CommandDashboard({ users, globalSettings, breakLogs, now, onNavigate, onEndBreak, formatDuration }: CommandDashboardProps) {
  const [broadcast, setBroadcast] = useState('');
  const [priority, setPriority] = useState<'low' | 'high' | 'urgent'>('low');
  const [forecast, setForecast] = useState<StrategicForecast | null>(null);
  const [isForecasting, setIsForecasting] = useState(false);

  const fetchForecast = async () => {
    setIsForecasting(true);
    try {
      const missionsSnap = await getDocs(query(collection(db, 'missions'), limit(50)));
      const shiftsSnap = await getDocs(query(collection(db, 'shifts'), limit(100)));
      const logsSnap = await getDocs(query(collection(db, 'auditLogs'), limit(50)));

      const result = await generateStrategicForecast({
        missionsLast30d: missionsSnap.size,
        shiftsServed: shiftsSnap.size,
        incidentCount: logsSnap.docs.filter(d => d.data().action?.includes('ERROR') || d.data().action?.includes('VIOLATION')).length
      });
      setForecast(result);
    } catch (e) {
      console.error("Forecasting failed:", e);
    } finally {
      setIsForecasting(false);
    }
  };

  useEffect(() => {
    fetchForecast();
  }, []);

  const sendBroadcast = async () => {
    if (!broadcast.trim()) return;
    try {
      await addDoc(collection(db, 'announcements'), {
        content: broadcast,
        priority,
        createdAt: Date.now()
      });
      setBroadcast('');
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'announcements');
    }
  };

  const activeCount = users.length;
  const onBreakCount = users.filter(u => u.isBreakActive).length;
  const gpsActiveCount = users.filter(u => u.lastLocation).length;
  
  const violations = users.filter(u => {
    const activeLog = u.activeBreakLogId ? breakLogs[u.activeBreakLogId] : null;
    const breakStartTime = u.breakStartTime || (activeLog?.startTime);
    const breakDuration = breakStartTime ? Math.floor((now - breakStartTime) / 1000 / 60) : 0;
    return u.isBreakActive && breakDuration > globalSettings.maxBreakDurationMinutes;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Personnel', value: activeCount, color: 'text-main-text' },
          { label: 'Operational', value: activeCount - onBreakCount, color: 'text-success' },
          { label: 'GPS Active', value: gpsActiveCount, color: 'text-main-text' },
          { label: 'Violations', value: violations.length, color: violations.length > 0 ? 'text-error' : 'text-main-text-muted' },
        ].map((stat, i) => (
          <div key={i} className="bg-surface-1 border border-main-border p-4 rounded-md">
            <p className="text-[10px] font-mono text-main-text-muted uppercase tracking-wider mb-2">{stat.label}</p>
            <h4 className={`text-2xl font-mono ${stat.color}`}>{stat.value}</h4>
          </div>
        ))}
      </div>

      {/* Main Grid: Live Personnel & Alerts */}
      <div className="grid gap-6 xl:grid-cols-12">
        <div className="xl:col-span-8 space-y-6">
           {/* Broadcast Terminal (Feature 23) */}
           <section className="bg-surface-1 border border-main-border rounded-md p-5 space-y-5 relative overflow-hidden shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                   <div className="p-1.5 bg-primary/10 rounded text-primary border border-primary/20">
                      <Radio size={14} className="animate-pulse" />
                   </div>
                   <h3 className="text-[10px] font-mono font-bold text-main-text uppercase tracking-[0.2em]">Broadcast_Link Terminal</h3>
                </div>
                <div className="flex bg-surface-2 p-0.5 rounded border border-main-border">
                   {(['low', 'high', 'urgent'] as const).map(p => (
                      <button
                        key={p}
                        onClick={() => setPriority(p)}
                        className={`px-3 py-1 rounded text-[8px] font-mono uppercase tracking-widest transition-all ${
                          priority === p 
                            ? p === 'urgent' ? 'bg-error text-white' : 'bg-primary text-black font-bold'
                            : 'text-main-text-muted hover:text-main-text'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                </div>
              </div>

              <div className="relative group">
                <textarea 
                  value={broadcast}
                  onChange={(e) => setBroadcast(e.target.value)}
                  placeholder="INPUT_BROADCAST_DATA..."
                  className="w-full bg-surface-2 border border-main-border rounded p-3 text-[10px] font-mono uppercase tracking-widest outline-none focus:border-primary/50 min-h-[60px] text-main-text transition-all"
                />
                <button 
                  onClick={sendBroadcast}
                  disabled={!broadcast.trim()}
                  className="absolute bottom-2 right-2 p-2 bg-primary text-black rounded hover:scale-105 active:scale-95 transition-all disabled:opacity-30 shadow-lg shadow-primary/20"
                >
                  <Send size={12} />
                </button>
              </div>
           </section>

           <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-main-text flex items-center gap-2">
                 <Activity size={16} className="text-main-text-muted" />
                 Live Personnel
              </h2>
              <button 
                onClick={() => onNavigate('map')}
                className="text-[10px] font-mono text-primary hover:text-primary-hover uppercase tracking-wider flex items-center gap-1 transition-colors"
              >
                View Map <ArrowUpRight size={12} />
              </button>
           </div>

           <div className="border border-main-border rounded-md bg-surface-1 overflow-hidden">
             {users.length === 0 ? (
               <div className="p-8 text-center border-b border-main-border">
                 <p className="text-main-text-muted text-sm font-mono">No personnel available.</p>
               </div>
             ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-main-border border-b border-main-border">
                  {users.map((u, idx) => {
                     const activeLog = u.activeBreakLogId ? breakLogs[u.activeBreakLogId] : null;
                     const breakStartTime = u.breakStartTime || (activeLog?.startTime);
                     const breakDuration = breakStartTime ? Math.floor((now - breakStartTime) / 1000 / 60) : 0;
                     const isOverLimit = u.isBreakActive && breakDuration > globalSettings.maxBreakDurationMinutes;
                     const lat = u.lastLocation?.latitude;
                     const lng = u.lastLocation?.longitude;

                     return (
                         <div 
                           key={u.uid} 
                           className={`p-4 transition-colors hover:bg-surface-2 group ${u.isBreakActive ? (isOverLimit ? 'border-l-2 border-l-error' : 'border-l-2 border-l-warning') : 'border-l-2 border-l-success'} border-t md:border-t-0`}
                         >
                            <div className="flex justify-between items-start mb-3">
                               <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded bg-surface-3 flex items-center justify-center font-mono text-xs text-main-text">
                                     {(u.displayName || u.email || '?').charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                     <h4 className="font-medium text-sm text-main-text truncate max-w-[120px]">{u.displayName || u.email}</h4>
                                     <p className="text-[10px] font-mono text-main-text-muted uppercase tracking-wider mt-0.5">{(u.uid).slice(0, 8)}</p>
                                  </div>
                               </div>
                               <div className="text-right">
                                  <p className={`text-[10px] font-mono uppercase tracking-wider ${u.isBreakActive ? (isOverLimit ? 'text-error' : 'text-warning') : 'text-success'}`}>
                                     {u.isBreakActive ? 'BREAK' : 'ACTIVE'}
                                  </p>
                                  {u.isBreakActive && (
                                     <p className="text-[10px] font-mono text-main-text mt-0.5">{formatDuration(breakStartTime)}</p>
                                  )}
                               </div>
                            </div>

                            {u.isBreakActive ? (
                               <div className="space-y-3">
                                  <div className="w-full h-1 bg-surface-3 rounded-none overflow-hidden">
                                     <motion.div 
                                        initial={{ width: 0 }}
                                        animate={{ width: `${Math.min((breakDuration / globalSettings.maxBreakDurationMinutes) * 100, 100)}%` }}
                                        className={`h-full ${isOverLimit ? 'bg-error' : 'bg-warning'}`}
                                     />
                                  </div>
                                  <div className="flex gap-2">
                                     <button 
                                        onClick={() => onEndBreak(u.uid)}
                                        className="flex-1 bg-error-subtle hover:bg-error/20 text-error border border-error/50 py-1.5 rounded text-[10px] font-mono uppercase tracking-wider transition-colors"
                                     >
                                        End Break
                                     </button>
                                     {lat && (
                                        <button 
                                          onClick={() => onNavigate('map')}
                                          className="px-3 bg-surface-2 hover:bg-surface-3 text-main-text rounded border border-main-border transition-colors"
                                        >
                                           <MapPin size={14} />
                                        </button>
                                     )}
                                  </div>
                               </div>
                            ) : lat ? (
                               <div className="bg-surface-2 border border-main-border p-2 rounded flex items-center justify-between">
                                  <div className="flex items-center gap-2 text-main-text-muted">
                                     <MapPin size={12} />
                                     <span className="text-[10px] font-mono text-main-text">{lat.toFixed(4)}, {lng.toFixed(4)}</span>
                                  </div>
                                  <span className="text-[10px] font-mono text-main-text-muted">{new Date(u.lastLocation!.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                               </div>
                            ) : (
                              <div className="h-8 flex items-center justify-center border border-dashed border-main-border rounded">
                                <span className="text-[10px] font-mono text-main-text-muted uppercase tracking-wider">No GPS Data</span>
                              </div>
                            )}
                         </div>
                     );
                  })}
                </div>
             )}
           </div>
        </div>

        <div className="xl:col-span-4 space-y-6">
           {/* Predictive Intelligence Panel (Feature 3) */}
           <div className="bg-surface-1 border border-main-border rounded-md overflow-hidden relative group">
              <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
              <div className="p-4 border-b border-main-border flex items-center justify-between">
                <h2 className="text-sm font-medium text-main-text flex items-center gap-2">
                  <BrainCircuit size={16} className="text-primary animate-pulse" />
                  Predictive_Strategic_Forecast
                </h2>
                <div className="text-[9px] font-mono text-primary uppercase tracking-widest bg-primary/10 px-1.5 py-0.5 rounded">
                  {isForecasting ? 'Calculating...' : 'Analysis_Active'}
                </div>
              </div>
              <div className="p-4 space-y-4">
                {isForecasting ? (
                  <div className="flex flex-col items-center py-8 space-y-4">
                    <Loader2 size={24} className="text-primary animate-spin" />
                    <p className="text-[10px] font-mono text-main-text-muted uppercase animate-pulse">Scanning_Operational_Vectors...</p>
                  </div>
                ) : forecast ? (
                  <div className="space-y-4">
                     <div className="p-3 bg-surface-2 border border-main-border rounded-lg space-y-2">
                        <div className="flex items-center justify-between">
                           <span className="text-[8px] font-mono text-main-text-muted uppercase">Workload_Projection:</span>
                           <span className={`text-[10px] font-mono font-bold uppercase ${
                             forecast.workloadProjection === 'increasing' ? 'text-warning' :
                             forecast.workloadProjection === 'stable' ? 'text-success' : 'text-primary'
                           }`}>{forecast.workloadProjection}</span>
                        </div>
                        <p className="text-[10px] font-mono text-main-text-muted leading-relaxed italic">
                           Burnout risk: {forecast.burnoutRiskTimeline}
                        </p>
                     </div>
                     
                     <div className="space-y-2">
                        <div className="flex items-center gap-2 text-primary">
                           <Sparkles size={10} />
                           <span className="text-[8px] font-mono uppercase font-bold tracking-widest">AIG_Strategic_Recommendations</span>
                        </div>
                        <ul className="space-y-1.5">
                           {forecast.strategicRecommendations.slice(0, 2).map((rec, i) => (
                             <li key={i} className="flex items-start gap-2 text-[9px] font-mono text-main-text-muted leading-tight">
                                <div className="w-1 h-1 rounded-full bg-primary mt-1 flex-shrink-0" />
                                <span>{rec}</span>
                             </li>
                           ))}
                        </ul>
                     </div>

                     <div className="pt-2 border-t border-main-border">
                        <div className="flex items-center justify-between">
                           <span className="text-[8px] font-mono text-main-text-muted uppercase">Bottleneck_Vector:</span>
                           <span className="text-[9px] font-mono text-main-text uppercase font-bold">{forecast.resourceBottleneck}</span>
                        </div>
                     </div>
                  </div>
                ) : (
                  <p className="text-[10px] font-mono text-main-text-muted text-center py-4 uppercase tracking-widest">No_Forecast_Data_Available</p>
                )}
                <button 
                  onClick={fetchForecast}
                  disabled={isForecasting}
                  className="w-full py-2 bg-surface-2 hover:bg-surface-3 border border-main-border rounded text-[9px] font-mono text-main-text uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2"
                >
                  {isForecasting ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
                  Refresh_Vector_Analysis
                </button>
              </div>
           </div>

           {/* System Alerts */}
           <div className="space-y-4">
             <h2 className="text-sm font-medium text-main-text flex items-center gap-2">
               <ShieldAlert size={16} className="text-main-text-muted" />
               Critical_Alerts
               {violations.length > 0 && <span className="text-[10px] font-mono bg-error-subtle border border-error/30 text-error px-1.5 py-0.5 rounded ml-auto">{violations.length}</span>}
             </h2>

             <div className="space-y-3">
                {violations.length === 0 ? (
                   <div className="bg-surface-1 border border-main-border p-6 rounded-md text-center">
                      <p className="text-[10px] font-mono uppercase tracking-wider text-main-text-muted">No active violations</p>
                   </div>
                ) : (
                  violations.map(v => {
                     const activeLog = v.activeBreakLogId ? breakLogs[v.activeBreakLogId] : null;
                     const breakStartTime = v.breakStartTime || (activeLog?.startTime);
                     return (
                      <motion.div 
                        layout
                        key={v.uid} 
                        className="bg-surface-1 border-l-2 border-l-error border border-main-border p-3 rounded-md flex items-center justify-between gap-4"
                      >
                         <div>
                            <div className="flex items-center gap-2 text-main-text mb-0.5">
                               <h5 className="font-medium text-xs font-mono">{v.displayName || v.email}</h5>
                            </div>
                            <p className="text-[10px] font-mono text-error uppercase tracking-wider">
                               Limit_Exceeded: {formatDuration(breakStartTime)}
                            </p>
                         </div>
                         <button 
                           onClick={() => onEndBreak(v.uid)}
                           className="p-1.5 text-main-text-muted hover:text-error transition-colors"
                         >
                           <ShieldAlert size={14} />
                         </button>
                      </motion.div>
                     );
                  })
                )}
             </div>
           </div>

           {/* Real-time Activity Feed (Feature 5) */}
           <div className="space-y-4">
              <h2 className="text-sm font-medium text-main-text flex items-center gap-2">
                <History size={16} className="text-main-text-muted" />
                Live_Activity_Feed
              </h2>
              <div className="bg-surface-1 border border-main-border rounded-md divide-y divide-main-border h-64 overflow-y-auto scrollbar-thin">
                {[
                  { id: '1', type: 'info', user: 'System', message: 'Team_Manager_v2.1 online', timestamp: now - 300000 },
                  { id: '2', type: 'success', user: 'Admin', message: 'Global security policy updated', timestamp: now - 600000 },
                  { id: '3', type: 'warning', user: 'S. Connor', message: 'Break exceeding threshold', timestamp: now - 900000 },
                  { id: '4', type: 'info', user: 'P. Parker', message: 'GPS ping received', timestamp: now - 1200000 },
                  { id: '5', type: 'success', user: 'W. White', message: 'Shift completed successfully', timestamp: now - 1500000 },
                ].map((log) => (
                  <div key={log.id} className="p-3 hover:bg-surface-2 transition-colors">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[9px] font-mono text-primary uppercase font-bold">{log.user}</span>
                      <span className="text-[8px] font-mono text-main-text-muted">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                    </div>
                    <p className="text-[10px] font-mono text-main-text leading-tight">{log.message}</p>
                  </div>
                ))}
              </div>
           </div>

           <div className="bg-surface-1 border border-main-border p-4 rounded-md space-y-3">
              <h5 className="text-[10px] font-mono uppercase tracking-wider text-main-text-muted border-b border-main-border pb-2 flex items-center gap-2">
                <Zap size={10} className="text-warning" />
                Config Summary
              </h5>
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                   <span className="text-main-text-muted font-mono">Max Break</span>
                   <span className="font-mono text-main-text">{globalSettings.maxBreakDurationMinutes}m</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                   <span className="text-main-text-muted font-mono">Base Rate</span>
                   <span className="font-mono text-main-text">${globalSettings.defaultHourlyRate}/h</span>
                </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
