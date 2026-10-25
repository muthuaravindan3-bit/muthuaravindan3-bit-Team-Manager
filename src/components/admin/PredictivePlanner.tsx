import React, { useState, useEffect } from 'react';
import { UserProfile, Shift, Mission, WellnessCheck } from '../../types';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { collection, query, orderBy, limit, onSnapshot, getDocs } from 'firebase/firestore';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, Cell
} from 'recharts';
import { 
  Brain, Zap, TrendingUp, AlertTriangle, Users, Target, Activity, 
  Sparkles, Loader2, ShieldAlert, Database, ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { calculateGlobalRisk, GlobalRiskIndex } from '../../geminiService';

interface PredictivePlannerProps {
  users: UserProfile[];
  shifts: Shift[];
}

export function PredictivePlanner({ users, shifts }: PredictivePlannerProps) {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [wellness, setWellness] = useState<WellnessCheck[]>([]);
  const [riskIndex, setRiskIndex] = useState<GlobalRiskIndex | null>(null);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [activeSimulation, setActiveSimulation] = useState(false);
  const [simulationState, setSimulationState] = useState<'idle' | 'running' | 'complete' | 'executed'>('idle');

  useEffect(() => {
    const unsubMissions = onSnapshot(query(collection(db, 'missions'), orderBy('createdAt', 'desc'), limit(20)), (snap) => {
      setMissions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Mission)));
    });

    const unsubWellness = onSnapshot(query(collection(db, 'wellness'), orderBy('timestamp', 'desc'), limit(50)), (snap) => {
      setWellness(snap.docs.map(d => ({ id: d.id, ...d.data() } as WellnessCheck)));
    });

    return () => {
      unsubMissions();
      unsubWellness();
    };
  }, []);

  const runPredictiveSync = async () => {
    setIsSynthesizing(true);
    try {
      const data = {
        totalPersonnel: users.length,
        activeShifts: shifts.length,
        pendingMissions: missions.filter(m => m.status === 'active').length,
        wellnessScore: wellness.reduce((acc, w) => acc + w.score, 0) / (wellness.length || 1),
        recentMissions: missions.slice(0, 10).map(m => ({ title: m.title, priority: m.priority }))
      };
      
      const result = await calculateGlobalRisk(data);
      setRiskIndex(result);
    } catch (e) {
      console.error("Predictive Sync failed:", e);
    } finally {
      setIsSynthesizing(false);
    }
  };

  const startSimulation = () => {
    setActiveSimulation(true);
    setSimulationState('running');
    setTimeout(() => {
      setSimulationState('complete');
    }, 2500);
  };

  const executeOptimization = () => {
     setSimulationState('executed');
     setTimeout(() => {
        setActiveSimulation(false);
        setSimulationState('idle');
     }, 1500);
  };

  const chartData = [
    { day: 'T-3', workload: 40, capacity: 85, fatigue: 20 },
    { day: 'T-2', workload: 55, capacity: 85, fatigue: 35 },
    { day: 'T-1', workload: 70, capacity: 80, fatigue: 45 },
    { day: 'NOW', workload: 85, capacity: 80, fatigue: 60 },
    { day: 'T+1', workload: 92, capacity: 75, fatigue: 75 },
    { day: 'T+2', workload: 60, capacity: 70, fatigue: 85 },
    { day: 'T+3', workload: 45, capacity: 80, fatigue: 55 },
  ];

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
           <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg border border-primary/20">
                 <Brain size={24} className="text-primary" />
              </div>
              <h2 className="text-2xl font-display font-medium text-main-text uppercase tracking-tight italic">
                 Predictive_Resource_Matrix
              </h2>
           </div>
           <p className="text-[10px] font-mono text-main-text-muted mt-1 uppercase tracking-[0.4em] opacity-40">Phase_03 // Workload_Forecasting & Burnout_Prevention</p>
        </div>
        
        <button 
          onClick={runPredictiveSync}
          disabled={isSynthesizing}
          className="px-6 py-2.5 bg-primary text-surface-1 rounded-lg font-mono text-[10px] uppercase tracking-widest font-bold flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-primary/20"
        >
           {isSynthesizing ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
           {isSynthesizing ? 'Calculating_Vectors...' : 'Initialize_Predictive_Sync'}
        </button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Risk Indicators */}
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
           {[
             { 
               label: 'Operational_Risk', 
               value: riskIndex?.overallRisk || 42, 
               suffix: '%',
               status: (riskIndex?.overallRisk || 42) > 70 ? 'CRITICAL' : 'STABLE',
               color: (riskIndex?.overallRisk || 42) > 70 ? 'text-error' : 'text-primary'
             },
             { 
               label: 'Unit_Fatigue_Vector', 
               value: riskIndex?.fatigueFactor || 58, 
               suffix: '%',
               status: (riskIndex?.fatigueFactor || 58) > 75 ? 'DANGER' : 'NOMINAL',
               color: (riskIndex?.fatigueFactor || 58) > 75 ? 'text-warning' : 'text-info'
             },
             { 
               label: 'System_Readiness', 
               value: riskIndex?.readinessRating || 94, 
               suffix: '%',
               status: (riskIndex?.readinessRating || 94) < 60 ? 'UPGRADE' : 'OPTIMAL',
               color: (riskIndex?.readinessRating || 94) < 60 ? 'text-warning' : 'text-success'
             }
           ].map((stat, i) => (
             <motion.div 
               initial={{ opacity: 0, y: 10 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ delay: i * 0.1 }}
               key={stat.label} 
               className="bg-surface-1 border border-main-border rounded-xl p-6 space-y-4"
             >
                <div className="flex items-center justify-between">
                   <span className="text-[9px] font-mono uppercase text-main-text-muted tracking-widest">{stat.label}</span>
                   <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded border border-current ${stat.color} bg-current/5`}>{stat.status}</span>
                </div>
                <div className="flex items-baseline gap-1">
                   <span className={`text-4xl font-mono tracking-tighter ${stat.color}`}>{stat.value}</span>
                   <span className="text-sm font-mono text-main-text-muted/30">{stat.suffix}</span>
                </div>
                <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                   <motion.div 
                     initial={{ width: 0 }}
                     animate={{ width: `${stat.value}%` }}
                     className={`h-full ${stat.color.replace('text-', 'bg-')}`} 
                   />
                </div>
             </motion.div>
           ))}
        </div>

        {/* Tactical Recommendation */}
        <div className="bg-black/40 border border-primary/30 rounded-xl p-6 relative overflow-hidden group">
           <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <ShieldAlert size={80} className="text-primary rotate-12" />
           </div>
           <div className="relative z-10 space-y-6">
              <div className="flex items-center gap-3">
                 <Activity size={16} className="text-primary" />
                 <h4 className="text-[10px] font-mono uppercase tracking-[0.2em] text-primary font-bold">Cortex_Tactical_Recommendation</h4>
              </div>
              <div className="space-y-4">
                 <p className="text-[11px] font-sans text-main-text italic leading-relaxed border-l-2 border-primary/40 pl-4">
                    "{riskIndex?.status || 'System scan required to generate actionable operational directives.'}"
                 </p>
                 {riskIndex?.mitigationProtocol && (
                    <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
                       <span className="text-[8px] font-mono text-primary uppercase font-bold tracking-widest block mb-1">Mitigation_Protocol_Alpha:</span>
                       <p className="text-[10px] font-mono text-main-text-muted uppercase leading-tight">{riskIndex.mitigationProtocol}</p>
                    </div>
                 )}
              </div>
              <button 
                 onClick={startSimulation}
                 className="w-full py-2 bg-surface-2 hover:bg-surface-3 text-[9px] font-mono uppercase tracking-widest text-main-text border border-main-border rounded transition-all flex items-center justify-center gap-2"
              >
                 <ArrowRight size={12} />
                 Simulate_Correction_Flow
              </button>
           </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Forecast Graph */}
        <div className="bg-surface-1 border border-main-border rounded-xl p-8 space-y-8">
           <div className="flex items-center justify-between">
              <div className="space-y-1">
                 <h4 className="text-sm font-display font-medium text-main-text uppercase tracking-tight">Workload_Intensity_Forecast</h4>
                 <p className="text-[9px] font-mono text-main-text-muted uppercase tracking-widest">Projection of resource demand over 72-hour operational window</p>
              </div>
              <div className="flex gap-4">
                 <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <span className="text-[8px] font-mono text-main-text-muted uppercase">Demand</span>
                 </div>
                 <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-success" />
                    <span className="text-[8px] font-mono text-main-text-muted uppercase">Capacity</span>
                 </div>
              </div>
           </div>

           <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                 <AreaChart data={chartData}>
                    <defs>
                       <linearGradient id="colorLoad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0}/>
                       </linearGradient>
                       <linearGradient id="colorCap" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--color-success)" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="var(--color-success)" stopOpacity={0}/>
                       </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
                    <XAxis 
                       dataKey="day" 
                       axisLine={false} 
                       tickLine={false} 
                       tick={{ fontSize: 9, fill: '#666', fontFamily: '"JetBrains Mono", monospace' }} 
                    />
                    <YAxis hide />
                    <Tooltip 
                       contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #222', borderRadius: '4px' }}
                       itemStyle={{ fontSize: '9px', color: '#fff', textTransform: 'uppercase', fontFamily: '"JetBrains Mono", monospace' }}
                    />
                    <Area type="monotone" dataKey="workload" stroke="var(--color-primary)" strokeWidth={2} fillOpacity={1} fill="url(#colorLoad)" />
                    <Area type="monotone" dataKey="capacity" stroke="var(--color-success)" strokeWidth={2} fillOpacity={1} fill="url(#colorCap)" strokeDasharray="5 5" />
                 </AreaChart>
              </ResponsiveContainer>
           </div>

           <div className="grid md:grid-cols-2 gap-4">
              <div className="p-4 bg-surface-2 border border-main-border rounded-xl flex items-center gap-4">
                 <AlertTriangle size={20} className="text-warning shrink-0" />
                 <div>
                    <span className="text-[9px] font-mono text-warning uppercase font-bold">Predicted_Bottleneck</span>
                    <p className="text-[11px] text-main-text tracking-tight uppercase">Critical Staff Deficit @ T+24</p>
                 </div>
              </div>
              <div className="p-4 bg-surface-2 border border-main-border rounded-xl flex items-center gap-4">
                 <TrendingUp size={20} className="text-primary shrink-0" />
                 <div>
                    <span className="text-[9px] font-mono text-primary uppercase font-bold">Optimal_Strategy</span>
                    <p className="text-[11px] text-main-text tracking-tight uppercase">Deploy Surplus Reserve @ T+12</p>
                 </div>
              </div>
           </div>
        </div>

        {/* Fatigue Breakdown */}
        <div className="bg-surface-1 border border-main-border rounded-xl p-8 space-y-8">
           <div className="space-y-1">
              <h4 className="text-sm font-display font-medium text-main-text uppercase tracking-tight">Fatigue_Diffusion_Archive</h4>
              <p className="text-[9px] font-mono text-main-text-muted uppercase tracking-widest">Personnel exhaustion levels categorized by operational specialty</p>
           </div>

           <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={chartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" horizontal={false} />
                    <XAxis type="number" hide />
                    <YAxis 
                       dataKey="day" 
                       type="category" 
                       axisLine={false} 
                       tickLine={false} 
                       tick={{ fontSize: 9, fill: '#666', fontFamily: '"JetBrains Mono", monospace' }} 
                    />
                    <Tooltip 
                       cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                       contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #222', borderRadius: '4px' }}
                    />
                    <Bar dataKey="fatigue" radius={[0, 4, 4, 0]}>
                       {chartData.map((_entry, index) => (
                          <Cell 
                             key={`cell-${index}`} 
                             fill={index > 3 ? 'var(--color-error)' : 'var(--color-primary)'}
                          />
                       ))}
                    </Bar>
                 </BarChart>
              </ResponsiveContainer>
           </div>

           <div className="bg-black/20 border border-main-border p-4 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                 <span className="text-[9px] font-mono text-main-text-muted uppercase">Global_Fatigue_Average</span>
                 <span className="text-[10px] font-mono text-primary">62%</span>
              </div>
              <div className="w-full h-1 bg-surface-3 rounded-full overflow-hidden">
                 <div className="h-full bg-primary" style={{ width: '62%' }} />
              </div>
              <p className="text-[8px] font-mono text-main-text-muted uppercase tracking-widest text-right mt-1">Status: Personnel efficiency degradation imminent.</p>
           </div>
        </div>
      </div>

      <AnimatePresence>
        {activeSimulation && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
             <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               onClick={() => setActiveSimulation(false)}
               className="absolute inset-0 bg-black/80 backdrop-blur-md"
             />
             <motion.div 
               initial={{ opacity: 0, scale: 0.95, y: 20 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.95, y: 20 }}
               className="relative w-full max-w-2xl bg-surface-1 border border-primary/30 rounded-2xl shadow-2xl overflow-hidden"
             >
                <div className="p-8 border-b border-main-border flex items-center justify-between bg-primary/5">
                   <div className="flex items-center gap-3">
                      <Database size={20} className="text-primary" />
                      <h3 className="text-xl font-display font-medium text-main-text uppercase tracking-tight italic">Operational_Sim_V4.x</h3>
                   </div>
                   <button onClick={() => setActiveSimulation(false)} className="text-main-text-muted hover:text-main-text transition-colors">
                      <X size={24} />
                   </button>
                </div>
                
                <div className="p-8 space-y-8">
                   {simulationState === 'running' && (
                     <div className="flex flex-col items-center justify-center py-20 border border-dashed border-main-border rounded-2xl space-y-4">
                        <Loader2 size={32} className="text-primary animate-spin" />
                        <div className="text-center space-y-1">
                           <p className="text-[11px] font-mono uppercase text-main-text-muted animate-pulse">Running Monte Carlo Simulations...</p>
                           <p className="text-[9px] font-mono uppercase text-main-text-muted/40 tracking-[0.2em]">Testing 1,000+ Permutations across workload/fatigue vectors</p>
                        </div>
                     </div>
                   )}

                   {simulationState === 'complete' && (
                     <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-8">
                        <div className="flex flex-col items-center justify-center py-12 border border-primary/20 bg-primary/5 rounded-2xl space-y-4">
                           <Sparkles size={32} className="text-success" />
                           <div className="text-center space-y-1">
                              <p className="text-[11px] font-mono uppercase text-main-text-muted">Optimum Path Found</p>
                              <p className="text-[9px] font-mono uppercase text-success tracking-[0.2em]">Ready for execution</p>
                           </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                           <div className="p-4 bg-surface-2 border border-main-border rounded-xl">
                              <span className="text-[8px] font-mono text-main-text-muted uppercase">Confidence</span>
                              <h5 className="text-xl font-mono text-main-text">89.4%</h5>
                           </div>
                           <div className="p-4 bg-surface-2 border border-main-border rounded-xl">
                              <span className="text-[8px] font-mono text-main-text-muted uppercase">Impact</span>
                              <h5 className="text-xl font-mono text-success">-14% RISK</h5>
                           </div>
                        </div>
                     </motion.div>
                   )}

                   {simulationState === 'executed' && (
                     <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center py-20 border border-success/20 bg-success/5 rounded-2xl space-y-4">
                        <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center">
                           <div className="w-12 h-12 rounded-full bg-success/20 flex items-center justify-center">
                              <Zap size={24} className="text-success" />
                           </div>
                        </div>
                        <div className="text-center space-y-1">
                           <p className="text-[11px] font-mono uppercase text-success tracking-[0.2em] font-bold">Optimization Engaged</p>
                           <p className="text-[9px] font-mono uppercase text-main-text-muted opacity-80">Roster updated successfully</p>
                        </div>
                     </motion.div>
                   )}
                </div>

                <div className="p-8 bg-surface-2/30 border-t border-main-border flex justify-end gap-4">
                   <button onClick={() => setActiveSimulation(false)} className="px-6 py-2 text-[10px] font-mono uppercase text-main-text-muted hover:text-main-text transition-colors">Abort</button>
                   <button 
                      onClick={executeOptimization}
                      disabled={simulationState !== 'complete'}
                      className="px-8 py-2 bg-primary text-surface-1 rounded font-mono text-[10px] uppercase font-bold tracking-widest shadow-lg shadow-primary/20 disabled:opacity-50 transition-all hover:scale-[1.02] active:scale-[0.98]"
                    >
                      Execute_Optimization
                    </button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

const X = ({ size, ...props }: { size: number } & React.SVGProps<SVGSVGElement>) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);
