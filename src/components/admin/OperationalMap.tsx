import React from 'react';
import { UserProfile } from '../../types';
import LiveMap from '../LiveMap';
import { Satellite, Wifi, Target } from 'lucide-react';
import { motion } from 'motion/react';

interface OperationalMapProps {
  users: UserProfile[];
}

export function OperationalMap({ users }: OperationalMapProps) {
  const activeGps = users.filter(u => u.lastLocation).length;

  return (
    <div className="space-y-10 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-white/5 pb-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-white mb-2">Location Services</h1>
          <p className="text-slate-400 font-medium">Real-time personnel positioning and logistics monitoring.</p>
        </div>
        <div className="flex gap-4">
           <div className="px-6 py-3 bg-zinc-900 border border-white/5 rounded-xl flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{activeGps} Active Signals</span>
           </div>
        </div>
      </div>

      <div className="bg-zinc-900 border border-white/5 p-1 rounded-[2.5rem] relative overflow-hidden h-[75vh] shadow-xl">
        <div className="h-full w-full rounded-[2.4rem] overflow-hidden">
          <LiveMap users={users} />
        </div>
        
        {/* Map Overlays */}
        <div className="absolute top-8 left-8 z-20 space-y-4">
           <div className="p-6 bg-zinc-900/90 backdrop-blur-xl border border-white/10 rounded-2xl space-y-5 shadow-2xl min-w-[260px]">
              <div className="flex items-center gap-3 text-slate-500">
                 <Satellite size={14} />
                 <span className="text-[10px] font-bold uppercase tracking-widest">Active Personnel</span>
              </div>
              <div className="space-y-4">
                 {users.filter(u => u.lastLocation).slice(0, 5).map(u => (
                    <div key={u.uid} className="flex items-center justify-between gap-4">
                       <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-indigo-500/10 flex items-center justify-center text-[10px] font-bold text-indigo-400">{(u.displayName || '?').charAt(0)}</div>
                          <span className="text-[11px] font-bold text-slate-300">{u.displayName || u.email}</span>
                       </div>
                       <div className="flex gap-1">
                          {[1, 2, 3].map(i => (
                            <motion.div 
                              key={i}
                              className="w-1 h-3 bg-indigo-500/20 rounded-full"
                              animate={{ backgroundColor: ['rgba(99,102,241,0.2)', 'rgba(99,102,241,0.6)', 'rgba(99,102,241,0.2)'] }}
                              transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
                            />
                          ))}
                       </div>
                    </div>
                 ))}
              </div>
           </div>

           <div className="p-4 bg-zinc-900/90 backdrop-blur-xl border border-white/10 rounded-2xl flex items-center gap-4 shadow-2xl">
              <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-500">
                 <Wifi size={16} />
              </div>
              <div>
                 <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">System Status</p>
                 <p className="text-[11px] font-bold text-slate-300">Sync Active</p>
              </div>
           </div>
        </div>

        <div className="absolute bottom-8 right-8 z-20">
           <div className="px-6 py-3 bg-zinc-900/90 backdrop-blur-xl border border-white/10 rounded-2xl flex items-center gap-4 shadow-2xl">
              <div className="flex items-center gap-2.5 text-slate-600">
                 <Target size={14} />
                 <span className="text-[10px] font-bold uppercase tracking-widest">Update Frequency: 5s</span>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
