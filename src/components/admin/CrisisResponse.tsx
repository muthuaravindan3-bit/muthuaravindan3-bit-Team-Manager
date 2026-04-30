import React, { useState, useEffect } from 'react';
import { UserProfile, Shift, Mission } from '../../types';
import { db } from '../../firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { 
  AlertOctagon, Radio, ShieldAlert, Zap, Loader2, ArrowRight,
  Target, TerminalSquare, AlertTriangle, Fingerprint, Activity, Siren, X
} from 'lucide-react';

interface CrisisResponseProps {
  users: UserProfile[];
  shifts: Shift[];
}

export function CrisisResponseProtocol({ users, shifts }: CrisisResponseProps) {
  const [isEngaging, setIsEngaging] = useState(false);
  const [containmentState, setContainmentState] = useState<'standby' | 'evaluating' | 'engaged' | 'resolved'>('standby');
  const [activeAnomalies, setActiveAnomalies] = useState<any[]>([]);

  useEffect(() => {
    // Simulated anomalies feed based on shifts/system conditions
    const anomalies = [
      { id: 'ANM-001', type: 'COMM_DROP', location: 'Sector 7G', severity: 8, time: 'T-10m' },
      { id: 'ANM-002', type: 'BIO_SPIKE', location: 'Unit Alpha', severity: 6, time: 'T-4m' },
      { id: 'ANM-003', type: 'SUPPLY_VOID', location: 'Outpost 3', severity: 9, time: 'T-1m' },
    ];
    setActiveAnomalies(anomalies);
  }, []);

  const engageContainment = () => {
    setIsEngaging(true);
    setContainmentState('evaluating');
    
    setTimeout(() => {
      setContainmentState('engaged');
      setTimeout(() => {
        setContainmentState('resolved');
        setIsEngaging(false);
        setActiveAnomalies([]);
      }, 3500);
    }, 2000);
  };

  const resetProtocol = () => {
    setContainmentState('standby');
    setActiveAnomalies([
      { id: 'ANM-004', type: 'RESOURCE_LEAK', location: 'Sector 2B', severity: 7, time: 'T-0m' },
      { id: 'ANM-005', type: 'GRID_FAILURE', location: 'Perimeter', severity: 9, time: 'T-0m' }
    ]);
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
           <div className="flex items-center gap-3">
              <div className="p-2 bg-error/10 rounded-lg border border-error/20">
                 <AlertOctagon size={24} className="text-error animate-pulse" />
              </div>
              <h2 className="text-2xl font-display font-medium text-main-text uppercase tracking-tight italic">
                 Crisis_Response_Protocol
              </h2>
           </div>
           <p className="text-[10px] font-mono text-main-text-muted mt-1 uppercase tracking-[0.4em] opacity-40">Phase_06 // Threat_Containment & Auto_Ops</p>
        </div>
        
        <button 
          onClick={containmentState === 'resolved' ? resetProtocol : engageContainment}
          disabled={isEngaging || containmentState === 'engaged'}
          className={`px-8 py-2.5 rounded-lg font-mono text-[10px] uppercase tracking-widest font-bold flex items-center gap-2 transition-all shadow-lg shadow-error/20 border ${
             containmentState === 'resolved' 
               ? 'bg-surface-2 border-main-border text-main-text hover:bg-surface-3' 
               : 'bg-error/10 border-error/30 text-error hover:bg-error hover:text-surface-1'
          }`}
        >
           {isEngaging ? <Loader2 size={14} className="animate-spin" /> : containmentState === 'resolved' ? <Radio size={14} /> : <Siren size={14} />}
           {isEngaging ? 'Overriding...' : containmentState === 'resolved' ? 'Reset_Sensors' : 'Engage_Containment'}
        </button>
      </div>

      <div className="grid lg:grid-cols-12 gap-8">
        {/* Main Threat Display */}
        <div className={`lg:col-span-4 border rounded-xl p-6 space-y-6 transition-colors duration-1000 ${
           containmentState === 'engaged' ? 'bg-error/20 border-error text-error' : 
           containmentState === 'resolved' ? 'bg-success/10 border-success/30 text-success' :
           'bg-surface-1 border-error/20 text-error/80'
        }`}>
           <div className="flex items-center gap-3 border-b border-current/20 pb-4">
              <TerminalSquare size={16} />
              <h3 className="text-sm font-mono uppercase tracking-widest font-bold">Threat_Level_Matrix</h3>
           </div>

           <div className="flex flex-col items-center justify-center py-8 relative">
              <div className="absolute inset-0 flex items-center justify-center opacity-10">
                 <Radio size={180} className="animate-ping" />
              </div>
              <h1 className="text-8xl font-display italic tracking-tighter relative z-10">
                 {containmentState === 'resolved' ? 'CLR' : 'DF1'}
              </h1>
              <p className="text-[11px] font-mono uppercase tracking-[0.4em] mt-4 relative z-10">
                 {containmentState === 'evaluating' ? 'Analyzing Vectors...' : 
                  containmentState === 'engaged' ? 'Containment Active' : 
                  containmentState === 'resolved' ? 'System Nominal' : 'Critical Anomalies Detected'}
              </p>
           </div>

           <div className="space-y-4 pt-4 border-t border-current/20">
              <div className="flex justify-between items-center text-[10px] font-mono uppercase">
                 <span>Auto_Reroute_Auth</span>
                 <span className="font-bold">{containmentState === 'standby' ? 'PENDING' : 'GRANTED'}</span>
              </div>
              <div className="flex justify-between items-center text-[10px] font-mono uppercase">
                 <span>Comms_Blackout</span>
                 <span className="font-bold">{containmentState === 'engaged' ? 'ACTIVE' : 'OFFLINE'}</span>
              </div>
           </div>
        </div>

        {/* Incident Feed & Matrix */}
        <div className="lg:col-span-8 flex flex-col gap-6">
           {/* Feed */}
           <div className="bg-surface-1 border border-main-border rounded-xl flex-1 p-6 flex flex-col relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                 <ShieldAlert size={120} className="text-error" />
              </div>
              
              <div className="flex items-center justify-between border-b border-main-border pb-4 mb-4 relative z-10">
                 <div className="flex items-center gap-3">
                    <Activity size={16} className="text-primary" />
                    <h3 className="text-sm font-mono uppercase tracking-widest font-bold text-main-text">Live_Incident_Feed</h3>
                 </div>
                 <span className="px-2 py-1 bg-surface-2 rounded text-[8px] font-mono text-main-text-muted">
                    {activeAnomalies.length} ACTIVE INCIDENTS
                 </span>
              </div>

              <div className="flex-1 space-y-3 relative z-10">
                 <AnimatePresence>
                    {activeAnomalies.length === 0 ? (
                       <motion.div 
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                          className="h-full flex flex-col items-center justify-center text-main-text-muted opacity-50 space-y-4"
                       >
                          <Fingerprint size={48} />
                          <p className="text-[10px] font-mono uppercase tracking-[0.2em]">Zero anomalies detected in sector.</p>
                       </motion.div>
                    ) : (
                       activeAnomalies.map((anm, i) => (
                          <motion.div 
                             key={anm.id}
                             initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                             transition={{ delay: i * 0.1 }}
                             className="flex items-center justify-between p-3 bg-surface-2/40 hover:bg-surface-2 border border-main-border rounded-lg"
                          >
                             <div className="flex items-center gap-4">
                                <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${anm.severity >= 8 ? 'bg-error/20 text-error' : 'bg-warning/20 text-warning'}`}>
                                   <AlertTriangle size={16} />
                                </div>
                                <div>
                                   <div className="flex items-center gap-2">
                                      <span className="text-[10px] font-mono text-main-text font-bold">{anm.id}</span>
                                      <span className="text-[8px] font-mono text-main-text-muted px-1.5 py-0.5 border border-main-border rounded uppercase">{anm.type}</span>
                                   </div>
                                   <span className="text-[9px] font-mono text-main-text-muted uppercase">Loc: {anm.location} // Lvl {anm.severity}</span>
                                </div>
                             </div>
                             <div className="text-right">
                                <span className="text-[10px] font-mono text-main-text-muted block">{anm.time}</span>
                             </div>
                          </motion.div>
                       ))
                    )}
                 </AnimatePresence>
              </div>
           </div>

           {/* Containment Resolution Flow */}
           <div className={`p-6 border rounded-xl relative overflow-hidden transition-all duration-500 ${
              containmentState === 'standby' ? 'bg-surface-2/20 border-main-border' :
              containmentState === 'evaluating' ? 'bg-primary/5 border-primary/30' :
              containmentState === 'engaged' ? 'bg-error/10 border-error/50' :
              'bg-success/10 border-success/30'
           }`}>
              <h4 className="text-[10px] font-mono uppercase tracking-[0.2em] font-bold mb-4 flex items-center gap-2">
                 <Zap size={12} className={containmentState === 'engaged' ? 'text-error' : 'text-primary'} />
                 Auto_Ops_Matrix
              </h4>
              <div className="grid grid-cols-3 gap-2">
                 {[
                    { state: 'evaluating', label: 'Isolation', desc: 'Quarantine sectors' },
                    { state: 'engaged', label: 'Surge', desc: 'Deploy reserve units' },
                    { state: 'resolved', label: 'Restoration', desc: 'Normalize comms' }
                 ].map((step, idx) => {
                    const isActive = containmentState === step.state;
                    const isPassed = containmentState === 'resolved' || (containmentState === 'engaged' && step.state === 'evaluating');
                    return (
                       <div key={idx} className={`p-3 border rounded-lg transition-all ${
                          isActive ? (step.state === 'engaged' ? 'bg-error/20 border-error' : 'bg-primary/20 border-primary') : 
                          isPassed ? 'bg-success/20 border-success opacity-80' : 
                          'bg-surface-1 border-main-border opacity-50'
                       }`}>
                          <span className={`text-[8px] font-mono uppercase tracking-widest block mb-1 ${isActive || isPassed ? '' : 'text-main-text-muted'}`}>
                             {step.label}
                          </span>
                          <span className={`text-[9px] font-sans ${isActive || isPassed ? 'text-main-text' : 'text-main-text-muted'}`}>
                             {step.desc}
                          </span>
                       </div>
                    );
                 })}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
