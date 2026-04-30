import React, { useState, useEffect } from 'react';
import { Mission, Shift, UserProfile, Resource } from '../../types';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { collection, query, orderBy, limit, onSnapshot, getDocs } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CloudLightning, ShieldAlert, Cpu, Activity, Database, Radar, 
  TerminalSquare, Loader2, ArrowRight, Binary, Crosshair, Users
} from 'lucide-react';
import { simulateMissionOutcome, SimulationResult } from '../../geminiService';

interface AutonomousSimulationProps {
  users: UserProfile[];
  shifts: Shift[];
}

export function AutonomousSimulation({ users, shifts }: AutonomousSimulationProps) {
  const [activeMissions, setActiveMissions] = useState<Mission[]>([]);
  const [selectedMission, setSelectedMission] = useState<string | null>(null);
  const [simulationParams, setSimulationParams] = useState({ threatLevel: 3, environmentalFactors: 'Clear', teamBuffer: 2 });
  const [isSimulating, setIsSimulating] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  
  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'missions'), orderBy('createdAt', 'desc'), limit(15)), (snap) => {
      setActiveMissions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Mission)));
    });
    return () => unsub();
  }, []);

  const addLog = (msg: string) => {
    setLogs(prev => [msg, ...prev].slice(0, 8));
  }

  const runSimulation = async () => {
    if (!selectedMission) return;
    setIsSimulating(true);
    setResult(null);
    setLogs([]);
    
    addLog("INIT // Loading tactical parameters...");
    
    const mission = activeMissions.find(m => m.id === selectedMission);
    if (!mission) {
       setIsSimulating(false);
       return;
    }
    
    setTimeout(() => addLog("INIT // Engaging neural forecast engine..."), 800);
    setTimeout(() => addLog("SCAN // Running multi-variable outcome permutations (N=4,000)..."), 1500);

    try {
      const assignedUsers = users.filter(u => mission.assignedTo.includes(u.uid));
      // Overriding standard prompt to inject tactical parameters
      const reqPayload = { ...mission, __simParams: simulationParams };
      const simResult = await simulateMissionOutcome(reqPayload, assignedUsers);
      
      setTimeout(() => addLog("SUCCESS // Simulation matrix converged."), 500);
      setResult(simResult);
    } catch (e) {
      console.error(e);
      addLog("ERROR // Core simulation failure. Parameters unstable.");
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
           <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg border border-primary/20">
                 <CloudLightning size={24} className="text-primary" />
              </div>
              <h2 className="text-2xl font-display font-medium text-main-text uppercase tracking-tight italic">
                 Autonomous_Simulation_Matrix
              </h2>
           </div>
           <p className="text-[10px] font-mono text-main-text-muted mt-1 uppercase tracking-[0.4em] opacity-40">Phase_04 // Stochastic_Outcome_Forecasting</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-8">
         {/* Config Panel */}
         <div className="lg:col-span-4 bg-surface-1 border border-main-border rounded-xl p-6 space-y-6">
            <div className="flex items-center gap-3 border-b border-main-border pb-4">
               <TerminalSquare size={16} className="text-primary" />
               <h3 className="text-sm font-mono uppercase tracking-widest font-bold">Sim_Parameters</h3>
            </div>

            <div className="space-y-5">
               <div className="space-y-2">
                  <label className="text-[10px] font-mono uppercase text-main-text-muted tracking-widest">Target_Operation</label>
                  <select 
                     value={selectedMission || ''}
                     onChange={(e) => setSelectedMission(e.target.value)}
                     className="w-full bg-surface-2 border border-main-border rounded-lg px-3 py-2 text-xs font-mono uppercase text-main-text focus:border-primary/50 outline-none"
                  >
                     <option value="">-- SELECT OPERATION --</option>
                     {activeMissions.map(m => (
                        <option key={m.id} value={m.id}>{m.title}</option>
                     ))}
                  </select>
               </div>

               <div className="space-y-2">
                  <div className="flex justify-between items-center">
                     <label className="text-[10px] font-mono uppercase text-main-text-muted tracking-widest">Threat_Level_Override</label>
                     <span className="text-[10px] font-mono text-primary font-bold">CLASS {simulationParams.threatLevel}</span>
                  </div>
                  <input 
                     type="range" min="1" max="5" step="1"
                     value={simulationParams.threatLevel}
                     onChange={(e) => setSimulationParams({...simulationParams, threatLevel: parseInt(e.target.value)})}
                     className="w-full accent-primary"
                  />
               </div>

               <div className="space-y-2">
                  <label className="text-[10px] font-mono uppercase text-main-text-muted tracking-widest">Environmental_Factors</label>
                  <select 
                     value={simulationParams.environmentalFactors}
                     onChange={(e) => setSimulationParams({...simulationParams, environmentalFactors: e.target.value})}
                     className="w-full bg-surface-2 border border-main-border rounded-lg px-3 py-2 text-xs font-mono uppercase text-main-text focus:border-primary/50 outline-none"
                  >
                     <option value="Clear">Sub-Optimal (Clear)</option>
                     <option value="Hostile">Hostile Interference</option>
                     <option value="Volatile">Volatile / Changing</option>
                  </select>
               </div>

               <button 
                  onClick={runSimulation}
                  disabled={isSimulating || !selectedMission}
                  className="w-full py-3 bg-primary/10 border border-primary/30 text-primary hover:bg-primary hover:text-surface-1 transition-all rounded-lg font-mono text-[10px] uppercase tracking-[0.2em] font-bold flex items-center justify-center gap-2 disabled:opacity-50"
               >
                  {isSimulating ? <Loader2 size={14} className="animate-spin" /> : <Radar size={14} />}
                  {isSimulating ? 'Processing Matrix...' : 'Initialize Simulation'}
               </button>
            </div>
         </div>

         {/* Visualization & Output Panel */}
         <div className="lg:col-span-8 space-y-6">
            <div className="bg-[#050505] border border-main-border rounded-xl p-1 relative overflow-hidden min-h-[300px]">
               {/* Decorative Background */ }
               <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
                    style={{ backgroundImage: 'linear-gradient(#00FF41 1px, transparent 1px), linear-gradient(90deg, #00FF41 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
               </div>

               {!isSimulating && !result && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-main-text-muted/30">
                     <Binary size={48} className="mb-4 opacity-20" />
                     <p className="text-[11px] font-mono uppercase tracking-[0.3em]">Awaiting execution commands</p>
                  </div>
               )}

               <AnimatePresence>
                  {isSimulating && (
                     <motion.div 
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="absolute inset-0 flex flex-col items-center justify-center bg-[#050505]/80 backdrop-blur-sm z-10"
                     >
                        <Loader2 size={64} className="text-primary animate-spin opacity-50 mb-6" />
                        <div className="w-64 space-y-2">
                           {logs.map((log, i) => (
                              <motion.p 
                                 initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                                 key={i} 
                                 className={`text-[9px] font-mono uppercase tracking-widest ${i === 0 ? 'text-primary' : 'text-main-text-muted/50'}`}
                              >
                                 {log}
                              </motion.p>
                           ))}
                        </div>
                     </motion.div>
                  )}
               </AnimatePresence>

               {result && !isSimulating && (
                  <motion.div 
                     initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                     className="relative z-20 p-6 space-y-8"
                  >
                     <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                           <ShieldAlert size={24} className={result.successProbability > 70 ? 'text-success' : 'text-warning'} />
                           <h3 className="text-xl font-display uppercase tracking-tight text-main-text">Forecast_Confirmed</h3>
                        </div>
                        <div className="text-right">
                           <p className="text-[10px] font-mono uppercase text-main-text-muted tracking-widest">Success_Prob</p>
                           <p className={`text-3xl font-mono ${result.successProbability > 70 ? 'text-success' : 'text-warning'}`}>
                              {result.successProbability}%
                           </p>
                        </div>
                     </div>

                     <div className="grid grid-cols-2 gap-4">
                        <div className="bg-surface-2/30 border border-main-border rounded-lg p-4">
                           <span className="text-[8px] font-mono uppercase text-main-text-muted tracking-widest mb-2 block">Critical_Failure_Points</span>
                           <ul className="space-y-2">
                              {result.riskVectors?.map((pt, i) => (
                                 <li key={i} className="text-[11px] font-sans text-main-text leading-tight flex gap-2">
                                    <Crosshair size={12} className="text-error shrink-0 mt-0.5" />
                                    <span>{pt}</span>
                                 </li>
                              ))}
                           </ul>
                        </div>
                        <div className="bg-surface-2/30 border border-main-border rounded-lg p-4">
                           <span className="text-[8px] font-mono uppercase text-main-text-muted tracking-widest mb-2 block">Resource_Impact_Degradation</span>
                           <div className="flex items-center gap-2 mt-4">
                               <div className="w-full bg-surface-3 rounded-full h-2 overflow-hidden">
                                   <div className="bg-primary h-full" style={{ width: `${(result.resourceImpact?.degradationFactor || 0) * 10}%` }}></div>
                               </div>
                               <span className="text-xs font-mono font-bold text-main-text">{result.resourceImpact?.degradationFactor || 0}/10</span>
                           </div>
                        </div>
                     </div>

                     <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                        <span className="text-[8px] font-mono uppercase text-primary font-bold tracking-[0.2em] mb-2 block flex items-center gap-2">
                           <Cpu size={12} />
                           Cortex_Summary_Analysis
                        </span>
                        <p className="text-[11px] font-sans text-main-text italic leading-relaxed">
                           "{result.expectedOutcome}"
                        </p>
                     </div>
                  </motion.div>
               )}
            </div>
         </div>
      </div>
    </div>
  );
}
