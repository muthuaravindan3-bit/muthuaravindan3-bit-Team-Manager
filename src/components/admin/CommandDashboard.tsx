import React from 'react';
import { UserProfile, GlobalSettings } from '../../types';
import { Users, Clock, MapPin, ShieldAlert, Activity, ArrowUpRight, Search, ClipboardCheck, AlertTriangle } from 'lucide-react';
import { motion } from 'motion/react';

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
    <div className="space-y-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Total Personnel', value: activeCount, icon: Users, color: 'text-indigo-500', trend: 'Live' },
          { label: 'Operational', value: activeCount - onBreakCount, icon: Activity, color: 'text-emerald-500', trend: 'Flowing' },
          { label: 'GPS Active', value: gpsActiveCount, icon: MapPin, color: 'text-amber-500', trend: 'Stable' },
          { label: 'Time Violations', value: violations.length, icon: ShieldAlert, color: 'text-red-500', trend: 'Critical' },
        ].map((stat, i) => (
          <div key={i} className="bg-zinc-900 border border-white/5 p-8 rounded-3xl group hover:border-indigo-500/20 transition-all flex flex-col justify-between shadow-sm">
             <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-2xl bg-white/[0.02] border border-white/5 ${stat.color}`}>
                   <stat.icon size={20} />
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md ${
                  stat.trend === 'Critical' && stat.value > 0 ? 'bg-red-500/10 text-red-500' : 'bg-white/5 text-slate-500'
                }`}>
                  {stat.trend}
                </span>
             </div>
             <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">{stat.label}</p>
                <div className="flex items-center gap-3">
                   <h4 className="text-4xl font-bold text-white tracking-tight">{stat.value}</h4>
                </div>
             </div>
          </div>
        ))}
      </div>

      {/* Main Grid: Live Personnel & Alerts */}
      <div className="grid gap-10 xl:grid-cols-12">
        <div className="xl:col-span-8 space-y-6">
           <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white flex items-center gap-3">
                 Live Personnel Flow
                 <span className="text-[10px] bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-widest">Active Ops</span>
              </h2>
              <button 
                onClick={() => onNavigate('map')}
                className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors uppercase tracking-widest flex items-center gap-1.5"
              >
                Launch Satellite Map <ArrowUpRight size={14} />
              </button>
           </div>

           <div className="grid gap-5 md:grid-cols-2">
              {users.map((u, idx) => {
                 const activeLog = u.activeBreakLogId ? breakLogs[u.activeBreakLogId] : null;
                 const breakStartTime = u.breakStartTime || (activeLog?.startTime);
                 const breakDuration = breakStartTime ? Math.floor((now - breakStartTime) / 1000 / 60) : 0;
                 const isOverLimit = u.isBreakActive && breakDuration > globalSettings.maxBreakDurationMinutes;
                 const lat = u.lastLocation?.latitude;
                 const lng = u.lastLocation?.longitude;

                 return (
                    <motion.div 
                      key={u.uid} 
                      className={`bg-zinc-900 border border-white/5 rounded-3xl p-6 transition-all duration-300 ${u.isBreakActive ? 'ring-2 ring-indigo-500/10' : ''}`}
                    >
                       <div className="flex justify-between items-start mb-6">
                          <div className="flex items-center gap-4">
                             <div className="relative">
                                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center font-bold text-indigo-400">
                                   {(u.displayName || u.email || '?').charAt(0).toUpperCase()}
                                </div>
                                <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-4 border-zinc-900 ${u.isBreakActive ? (isOverLimit ? 'bg-red-500' : 'bg-amber-500') : 'bg-emerald-500'}`} />
                             </div>
                             <div>
                                <h4 className="font-bold text-white leading-tight">{u.displayName || u.email}</h4>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">{(u.uid).slice(0, 8)} • Staff</p>
                             </div>
                          </div>
                          <div className="text-right">
                             <p className={`text-[10px] font-bold uppercase tracking-widest ${u.isBreakActive ? (isOverLimit ? 'text-red-500' : 'text-amber-500') : 'text-emerald-500/60'}`}>
                                {u.isBreakActive ? 'On Break' : 'Available'}
                             </p>
                             {u.isBreakActive && (
                                <p className="text-xs font-bold text-white mt-0.5 font-mono">{formatDuration(breakStartTime)}</p>
                             )}
                          </div>
                       </div>

                       {u.isBreakActive ? (
                          <div className="space-y-4">
                             <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                                <motion.div 
                                   initial={{ width: 0 }}
                                   animate={{ width: `${Math.min((breakDuration / globalSettings.maxBreakDurationMinutes) * 100, 100)}%` }}
                                   className={`h-full ${isOverLimit ? 'bg-red-500' : 'bg-indigo-500'}`}
                                />
                             </div>
                             <div className="flex gap-3">
                                <button 
                                   onClick={() => onEndBreak(u.uid)}
                                   className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-[0.2em] transition-all active:scale-95"
                                >
                                   Force End
                                </button>
                                {lat && (
                                   <button 
                                     onClick={() => onNavigate('map')}
                                     className="px-4 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-all border border-white/5"
                                   >
                                      <MapPin size={16} />
                                   </button>
                                )}
                             </div>
                          </div>
                       ) : lat ? (
                          <div className="bg-white/[0.02] border border-white/5 p-3 rounded-2xl flex items-center justify-between">
                             <div className="flex items-center gap-2 text-slate-600">
                                <MapPin size={12} />
                                <span className="text-[10px] font-mono font-bold tracking-tight">{lat.toFixed(4)}, {lng.toFixed(4)}</span>
                             </div>
                             <span className="text-[10px] font-bold text-slate-700 uppercase">{new Date(u.lastLocation!.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                       ) : (
                         <div className="h-[43px] flex items-center justify-center border border-dashed border-white/5 rounded-2xl">
                           <span className="text-[10px] font-bold text-slate-800 uppercase tracking-widest">No Active Telemetry</span>
                         </div>
                       )}
                    </motion.div>
                 );
              })}
           </div>
        </div>

        <div className="xl:col-span-4 space-y-6">
           <h2 className="text-xl font-bold text-white flex items-center gap-3">
             System Alerts
             <span className="text-[10px] bg-red-500/10 text-red-500 px-2 py-0.5 rounded-full font-bold uppercase tracking-widest">{violations.length} Active</span>
           </h2>

           <div className="space-y-4">
              {violations.length === 0 ? (
                 <div className="bg-zinc-900 border border-white/5 border-dashed p-10 rounded-3xl text-center">
                    <ClipboardCheck className="mx-auto text-slate-800 mb-3" size={40} />
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600">No active violations</p>
                 </div>
              ) : (
                violations.map(v => {
                   const activeLog = v.activeBreakLogId ? breakLogs[v.activeBreakLogId] : null;
                   const breakStartTime = v.breakStartTime || (activeLog?.startTime);
                   return (
                    <motion.div 
                      layout
                      key={v.uid} 
                      className="bg-red-500/5 border border-red-500/20 p-5 rounded-2.5xl flex items-center justify-between gap-4"
                    >
                       <div className="space-y-1">
                          <div className="flex items-center gap-2.5 text-red-500">
                             <AlertTriangle size={16} className="animate-pulse" />
                             <h5 className="font-bold text-sm tracking-tight">{v.displayName || v.email}</h5>
                          </div>
                          <p className="text-[10px] font-bold text-red-500/40 uppercase tracking-widest ml-6">
                             Session time: {formatDuration(breakStartTime)}
                          </p>
                       </div>
                       <button 
                         onClick={() => onEndBreak(v.uid)}
                         className="p-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all shadow-lg shadow-red-600/20"
                       >
                         <ShieldAlert size={16} />
                       </button>
                    </motion.div>
                   );
                })
              )}
           </div>

           {/* Quick Settings Insights */}
           <div className="bg-zinc-900 border border-white/5 p-6 rounded-3xl space-y-4">
              <h5 className="text-[10px] font-bold uppercase tracking-widest text-slate-600 border-b border-white/5 pb-3">System Constants</h5>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                   <span className="text-xs font-semibold text-slate-500">Break Limit</span>
                   <span className="text-xs font-bold text-white bg-white/5 px-2 py-0.5 rounded">{globalSettings.maxBreakDurationMinutes}m</span>
                </div>
                <div className="flex justify-between items-center">
                   <span className="text-xs font-semibold text-slate-500">Hourly Rate</span>
                   <span className="text-xs font-bold text-white bg-white/5 px-2 py-0.5 rounded">${globalSettings.defaultHourlyRate}/hr</span>
                </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
