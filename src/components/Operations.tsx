import React, { useState, useEffect } from 'react';
import { LiveRoster } from './LiveRoster';
import { Breaks } from './Breaks';
import { WellnessFeedback } from './WellnessFeedback';
import LiveMap from './LiveMap';
import { Activity, Coffee, Terminal, Heart, Map as MapIcon, Shield } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../AuthContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, onSnapshot, query } from 'firebase/firestore';

export function Operations() {
  const [activeSubTab, setActiveSubTab] = useState<'live' | 'map' | 'breaks' | 'wellness'>('live');
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });
    return unsubscribe;
  }, []);

  return (
    <div className="space-y-8 pb-20 relative z-10">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-primary/20 pb-8 shadow-[0_4px_30px_rgba(0,240,255,0.05)]">
        <div className="space-y-2">
          <div className="flex items-center gap-3 bg-surface-2 w-max px-4 py-1.5 rounded-full border border-primary/30 shadow-[0_0_15px_rgba(0,240,255,0.15)]">
            <Terminal size={14} className="text-primary animate-pulse shadow-[0_0_8px_rgba(0,240,255,0.8)]" />
            <span className="text-[10px] font-mono text-primary uppercase font-bold tracking-[0.4em] drop-shadow-md">Sector_Operations</span>
          </div>
          <h1 className="text-4xl font-display font-medium tracking-tight text-main-text uppercase text-shadow-md">Pulse Sync</h1>
          <p className="text-main-text-muted text-[11px] font-mono uppercase tracking-[0.2em]">Orchestrating live field telemetry & resource intervals</p>
        </div>

        <div className="flex bg-surface-2/80 backdrop-blur-md border border-primary/20 p-1.5 rounded-xl shadow-[0_0_20px_rgba(0,240,255,0.1)] overflow-x-auto no-scrollbar max-w-full">
          <button 
            onClick={() => setActiveSubTab('live')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-xs font-mono uppercase font-bold tracking-[0.2em] transition-all duration-300 active:scale-95 whitespace-nowrap ${
              activeSubTab === 'live' 
                ? 'bg-primary text-black shadow-[0_0_15px_rgba(0,240,255,0.4)]' 
                : 'text-main-text-muted hover:text-primary hover:bg-primary/10'
            }`}
          >
            <Activity size={14} className={activeSubTab === 'live' ? "animate-pulse" : "opacity-50"} />
            <span>Personnel_Live</span>
          </button>
          <button 
            onClick={() => setActiveSubTab('map')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-xs font-mono uppercase font-bold tracking-[0.2em] transition-all duration-300 active:scale-95 whitespace-nowrap ${
              activeSubTab === 'map' 
                ? 'bg-primary text-black shadow-[0_0_15px_rgba(0,240,255,0.4)]' 
                : 'text-main-text-muted hover:text-primary hover:bg-primary/10'
            }`}
          >
            <MapIcon size={14} className={activeSubTab === 'map' ? "animate-pulse" : "opacity-50"} />
            <span>Tactical_Analysis</span>
          </button>
          <button 
            onClick={() => setActiveSubTab('breaks')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-xs font-mono uppercase font-bold tracking-[0.2em] transition-all duration-300 active:scale-95 whitespace-nowrap ${
              activeSubTab === 'breaks' 
                ? 'bg-primary text-black shadow-[0_0_15px_rgba(0,240,255,0.4)]' 
                : 'text-main-text-muted hover:text-primary hover:bg-primary/10'
            }`}
          >
            <Coffee size={14} className={activeSubTab === 'breaks' ? "animate-bounce" : "opacity-50"} />
            <span>Resource_Interval</span>
          </button>
          <button 
            onClick={() => setActiveSubTab('wellness')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-xs font-mono uppercase font-bold tracking-[0.2em] transition-all duration-300 active:scale-95 whitespace-nowrap ${
              activeSubTab === 'wellness' 
                ? 'bg-primary text-black shadow-[0_0_15px_rgba(0,240,255,0.4)]' 
                : 'text-main-text-muted hover:text-primary hover:bg-primary/10'
            }`}
          >
            <Heart size={14} className={activeSubTab === 'wellness' ? "animate-pulse" : "opacity-50"} />
            <span>Personnel_Health</span>
          </button>
        </div>
      </div>

      <motion.div
        key={activeSubTab}
        initial={{ opacity: 0, y: 10, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        {activeSubTab === 'live' && <LiveRoster />}
        
        {activeSubTab === 'map' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-8">
                <LiveMap users={users} />
              </div>
              <div className="lg:col-span-4 space-y-6">
                <div className="glass-panel border-secondary/30 p-8 group">
                   <div className="absolute top-0 right-0 w-32 h-32 bg-secondary/10 rounded-full blur-3xl group-hover:scale-125 transition-transform duration-1000 -mr-10 -mt-10 pointer-events-none" />
                   
                   <div className="flex items-center gap-3 mb-6 relative z-10">
                      <Shield size={18} className="text-secondary drop-shadow-[0_0_8px_rgba(255,0,234,0.8)]" />
                      <h3 className="text-xs font-mono font-bold uppercase tracking-[0.3em] text-secondary text-shadow-sm">Sector_Intel</h3>
                   </div>
                   
                   <div className="space-y-5 relative z-10">
                      <div className="p-4 bg-surface-2/80 rounded-xl border border-main-border hover:border-success/40 transition-colors shadow-inner">
                         <p className="text-[10px] font-mono text-main-text-muted uppercase tracking-[0.2em] mb-1.5">Incident_Probability</p>
                         <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-success shadow-[0_0_8px_rgba(0,255,102,0.8)] animate-pulse" />
                            <p className="text-sm font-mono font-bold text-success uppercase tracking-widest drop-shadow-sm">Low_Vector_Risk</p>
                         </div>
                      </div>
                      <div className="p-4 bg-surface-2/80 rounded-xl border border-main-border hover:border-warning/40 transition-colors shadow-inner">
                         <p className="text-[10px] font-mono text-main-text-muted uppercase tracking-[0.2em] mb-1.5">Predicted_Density_Peak</p>
                         <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-warning shadow-[0_0_8px_rgba(255,191,0,0.8)]" />
                            <p className="text-sm font-mono font-bold text-warning uppercase tracking-widest drop-shadow-sm">14:00 - 16:30 Zulu</p>
                         </div>
                      </div>
                      <div className="p-5 border border-secondary/30 bg-secondary/10 rounded-xl shadow-[0_0_20px_rgba(255,0,234,0.1)] relative overflow-hidden">
                         <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-[0.05] pointer-events-none mix-blend-overlay"></div>
                         <p className="italic text-xs font-mono text-main-text leading-relaxed font-medium tracking-wide">
                           " AI Analysis suggests shifting two units to Sector Baker to preemptively manage predicted density spikes. "
                         </p>
                      </div>
                   </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {activeSubTab === 'breaks' && <Breaks />}
        
        {activeSubTab === 'wellness' && (
          <div className="max-w-2xl mx-auto">
            <WellnessFeedback />
          </div>
        )}
      </motion.div>
    </div>
  );
}

