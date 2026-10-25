import React, { useState } from 'react';
import { UserProfile } from '../../types';
import LiveMap from '../LiveMap';
import { Satellite, Wifi, Target, Shield, AlertTriangle, Crosshair } from 'lucide-react';
import { motion } from 'motion/react';

interface OperationalMapProps {
  users: UserProfile[];
}

export function OperationalMap({ users }: OperationalMapProps) {
  const [activeFences] = useState([
    { id: '1', name: 'SEC_A1_ALPHA', radius: '500m', status: 'secure' },
    { id: '2', name: 'LOGISTICS_HUB', radius: '1.2km', status: 'violation' }
  ]);
  const activeGps = users.filter(u => u.lastLocation).length;

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-main-border pb-6">
        <div>
          <h2 className="text-xl font-display font-medium text-main-text flex items-center gap-2">
            <Target size={20} />
            Location Services
          </h2>
          <p className="text-sm text-main-text-muted mt-1 font-sans">Real-time personnel positioning and logistics monitoring.</p>
        </div>
        <div className="flex gap-4">
           <div className="px-3 py-1.5 bg-surface-1 border border-main-border rounded flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              <span className="text-[9px] font-mono uppercase tracking-widest text-main-text-muted">{activeGps} Active Signals</span>
           </div>
        </div>
      </div>

      <div className="bg-surface-1 border border-main-border rounded-md p-1 relative overflow-hidden h-[70vh]">
        <div className="h-full w-full rounded overflow-hidden">
          <LiveMap users={users} />
        </div>
        
        {/* Map Overlays */}
        <div className="absolute top-6 left-6 z-20 space-y-3 pointer-events-none">
           <div className="p-4 bg-surface-1/90 backdrop-blur-md border border-main-border rounded-md space-y-6 shadow-2xl min-w-[200px] pointer-events-auto">
              <div className="flex items-center gap-3 text-main-text-muted">
                 <Satellite size={12} />
                 <span className="text-[9px] font-mono uppercase tracking-widest">Active Personnel</span>
              </div>
              <div className="space-y-3">
                 {users.filter(u => u.lastLocation).slice(0, 5).map(u => (
                    <div key={u.uid} className="flex items-center justify-between gap-4">
                       <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded bg-surface-2 border border-main-border flex items-center justify-center text-[9px] font-mono text-main-text-muted uppercase">{(u.displayName || '?').charAt(0)}</div>
                          <span className="text-[10px] uppercase font-medium text-main-text-muted/80">{u.displayName || u.email}</span>
                       </div>
                       <div className="flex gap-0.5">
                          {[1, 2, 3].map(i => (
                             <motion.div 
                               key={i}
                               className="w-0.5 h-2.5 bg-primary rounded-full"
                               animate={{ opacity: [0.1, 0.4, 0.1] }}
                               transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
                             />
                          ))}
                       </div>
                    </div>
                 ))}
                 {users.filter(u => u.lastLocation).length === 0 && (
                    <p className="text-[8px] font-mono uppercase text-main-text-muted/30">No active signals detected</p>
                 )}
              </div>
           </div>

           <div className="p-3 bg-surface-1/90 backdrop-blur-md border border-main-border rounded-md flex items-center gap-3 shadow-2xl pointer-events-auto">
              <Wifi size={12} className="text-success" />
              <div>
                 <p className="text-[8px] font-mono uppercase tracking-widest text-main-text-muted/50">System Status</p>
                 <p className="text-[9px] font-mono uppercase text-main-text-muted">Sync Active</p>
              </div>
           </div>
        </div>

        {/* Feature 21: Geo-fencing Manager Overlay */}
        <div className="absolute top-6 right-6 z-20 w-64 pointer-events-none">
           <div className="p-5 bg-surface-1/90 backdrop-blur-md border border-main-border rounded-xl space-y-6 shadow-2xl pointer-events-auto">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-main-text">
                   <Shield size={14} className="text-primary" />
                   <span className="text-[10px] font-mono uppercase tracking-[0.2em] font-bold">Geo_Fence_Auth</span>
                </div>
                <div className="w-2 h-2 rounded-full bg-primary animate-ping" />
              </div>

              <div className="space-y-4">
                 {activeFences.map(fence => (
                   <div key={fence.id} className="p-3 bg-surface-2 border border-main-border rounded-lg space-y-2 group transition-all hover:border-primary/30">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-mono text-main-text uppercase tracking-widest">{fence.name}</span>
                        {fence.status === 'violation' && <AlertTriangle size={10} className="text-error animate-pulse" />}
                      </div>
                      <div className="flex items-center justify-between text-[8px] font-mono text-main-text-muted/60">
                        <span>Radius: {fence.radius}</span>
                        <span className={fence.status === 'violation' ? 'text-error font-bold' : 'text-success'}>
                          {fence.status.toUpperCase()}
                        </span>
                      </div>
                   </div>
                 ))}
              </div>

              <button className="w-full py-2 bg-surface-2 border border-main-border rounded text-[9px] font-mono uppercase text-main-text-muted hover:text-primary hover:border-primary/50 transition-all flex items-center justify-center gap-2">
                <Crosshair size={12} />
                Deploy_New_Fence
              </button>
           </div>
        </div>

        <div className="absolute bottom-6 left-6 z-20 pointer-events-none">
           <div className="p-3 bg-surface-1/90 backdrop-blur-md border border-main-border rounded-lg flex items-center gap-4 shadow-2xl pointer-events-auto">
              <div className="flex flex-col">
                <span className="text-[7px] font-mono uppercase text-main-text-muted tracking-widest">Protocol</span>
                <span className="text-[9px] font-mono uppercase text-primary font-bold">Vector_Containment</span>
              </div>
              <div className="w-px h-6 bg-main-border" />
              <div className="flex flex-col">
                <span className="text-[7px] font-mono uppercase text-main-text-muted tracking-widest">Breach_Alerts</span>
                <span className="text-[9px] font-mono uppercase text-error font-bold">Enabled</span>
              </div>
           </div>
        </div>

        <div className="absolute bottom-6 right-6 z-20">
           <div className="px-4 py-2 bg-surface-1/90 backdrop-blur-md border border-main-border rounded-md flex items-center gap-3 shadow-2xl">
              <Target size={12} className="text-main-text-muted/50" />
              <span className="text-[9px] font-mono uppercase tracking-widest text-main-text-muted">Frequency: 5s / HZ</span>
           </div>
        </div>
      </div>
    </div>
  );
}
