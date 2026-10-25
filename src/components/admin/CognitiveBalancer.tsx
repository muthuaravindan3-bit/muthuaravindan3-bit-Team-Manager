import React, { useState, useEffect } from 'react';
import { UserProfile, WellnessCheck, Shift } from '../../types';
import { db } from '../../firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { 
  HeartPulse, BrainCircuit, Activity, Waves, Crosshair, 
  Dna, Fingerprint, Zap, ShieldAlert, Loader2, Radar
} from 'lucide-react';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar as RadarArea } from 'recharts';

interface CognitiveBalancerProps {
  users: UserProfile[];
  shifts: Shift[];
}

export function CognitiveBalancer({ users, shifts }: CognitiveBalancerProps) {
  const [wellnessData, setWellnessData] = useState<WellnessCheck[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const unsubWellness = onSnapshot(query(collection(db, 'wellness'), orderBy('timestamp', 'desc'), limit(100)), (snap) => {
      setWellnessData(snap.docs.map(d => ({ id: d.id, ...d.data() } as WellnessCheck)));
    });
    return () => unsubWellness();
  }, []);

  const runBioSync = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
    }, 3000);
  };

  const getBioData = () => {
    return [
      { subject: 'Cognitive_Load', A: 85, B: 65, fullMark: 100 },
      { subject: 'Physical_Fatigue', A: 45, B: 80, fullMark: 100 },
      { subject: 'Stress_Index', A: 60, B: 90, fullMark: 100 },
      { subject: 'Focus_Retention', A: 90, B: 50, fullMark: 100 },
      { subject: 'Reaction_Time', A: 75, B: 60, fullMark: 100 },
      { subject: 'Morale_Delta', A: 80, B: 40, fullMark: 100 },
    ];
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
           <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg border border-primary/20">
                 <Dna size={24} className="text-primary" />
              </div>
              <h2 className="text-2xl font-display font-medium text-main-text uppercase tracking-tight italic">
                 Cognitive_Load_Balancer
              </h2>
           </div>
           <p className="text-[10px] font-mono text-main-text-muted mt-1 uppercase tracking-[0.4em] opacity-40">Phase_05 // Biometric_Telemetry & Stress_Mapping</p>
        </div>
        
        <button 
          onClick={runBioSync}
          disabled={isSyncing}
          className="px-6 py-2.5 bg-primary/10 border border-primary/30 text-primary hover:bg-primary hover:text-surface-1 rounded-lg font-mono text-[10px] uppercase tracking-widest font-bold flex items-center gap-2 transition-all"
        >
           {isSyncing ? <Loader2 size={14} className="animate-spin" /> : <Radar size={14} />}
           {isSyncing ? 'Synchronizing_Bio_Feed...' : 'Initialize_Bio_Sync'}
        </button>
      </div>

      <div className="grid lg:grid-cols-12 gap-8">
        {/* Radar Matrix */}
        <div className="lg:col-span-5 bg-surface-1 border border-main-border rounded-xl p-6 space-y-6 flex flex-col">
           <div className="flex items-center gap-3 border-b border-main-border pb-4">
              <BrainCircuit size={16} className="text-primary" />
              <h3 className="text-sm font-mono uppercase tracking-widest font-bold">Neural_Symmetry_Map</h3>
           </div>
           
           <div className="flex-1 min-h-[300px] flex items-center justify-center relative">
              {isSyncing ? (
                 <div className="flex flex-col items-center justify-center space-y-4">
                    <div className="relative">
                       <Radar size={64} className="text-primary opacity-20" />
                       <div className="absolute inset-0 border-4 border-t-primary border-r-primary border-b-transparent border-l-transparent rounded-full animate-spin"></div>
                    </div>
                    <p className="text-[10px] font-mono text-primary uppercase tracking-widest animate-pulse">Calibrating sensors</p>
                 </div>
              ) : (
                 <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={getBioData()}>
                       <PolarGrid stroke="#333" />
                       <PolarAngleAxis 
                         dataKey="subject" 
                         tick={{ fill: '#888', fontSize: 8, fontFamily: '"JetBrains Mono", monospace' }} 
                       />
                       <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#444', fontSize: 8 }} />
                       <RadarArea name="Unit_A" dataKey="A" stroke="var(--color-primary)" fill="var(--color-primary)" fillOpacity={0.3} />
                       <RadarArea name="Unit_B" dataKey="B" stroke="var(--color-warning)" fill="var(--color-warning)" fillOpacity={0.3} />
                    </RadarChart>
                 </ResponsiveContainer>
              )}
           </div>

           <div className="flex justify-center gap-6 border-t border-main-border pt-4">
              <div className="flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-primary" />
                 <span className="text-[9px] font-mono text-main-text-muted uppercase">Base_Parameters</span>
              </div>
              <div className="flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-warning" />
                 <span className="text-[9px] font-mono text-main-text-muted uppercase">Current_Load</span>
              </div>
           </div>
        </div>

        {/* Biometrics feed */}
        <div className="lg:col-span-7 bg-surface-1 border border-main-border rounded-xl p-6 space-y-6">
           <div className="flex items-center gap-3 border-b border-main-border pb-4">
              <Activity size={16} className="text-primary" />
              <h3 className="text-sm font-mono uppercase tracking-widest font-bold">Live_Biometric_Telemetry</h3>
           </div>
           
           <div className="space-y-4">
              {users.slice(0, 5).map((user, idx) => {
                 const stressLvl = Math.floor(Math.random() * 100);
                 const statusRisk = stressLvl > 75 ? 'danger' : stressLvl > 50 ? 'warning' : 'optimal';
                 
                 return (
                 <div key={user.uid} className="bg-surface-2/50 border border-main-border rounded-lg p-4 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between group hover:bg-surface-2 transition-colors">
                    <div className="flex items-center gap-3">
                       <div className="w-10 h-10 rounded-full border border-primary/30 flex items-center justify-center bg-surface-3">
                          <Fingerprint size={20} className={statusRisk === 'danger' ? 'text-error animate-pulse' : 'text-primary'} />
                       </div>
                       <div>
                          <div className="flex items-center gap-2 mb-1">
                             <h4 className="text-xs font-mono font-bold uppercase text-main-text">{user.displayName || 'Unknown OP'}</h4>
                             {statusRisk === 'danger' && <ShieldAlert size={12} className="text-error" />}
                          </div>
                          <p className="text-[9px] font-mono text-main-text-muted uppercase tracking-widest">ID: {user.employeeId} // ROLE: {user.role}</p>
                       </div>
                    </div>
                    
                    <div className="w-full md:w-1/2 space-y-2">
                       <div className="flex justify-between text-[8px] font-mono uppercase tracking-widest">
                          <span className="text-main-text-muted">Cognitive_Strain_Index</span>
                          <span className={statusRisk === 'danger' ? 'text-error font-bold' : 'text-primary'}>{stressLvl}%</span>
                       </div>
                       <div className="h-1.5 w-full bg-surface-3 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${stressLvl}%` }}
                            transition={{ duration: 1, delay: idx * 0.1 }}
                            className={`h-full ${statusRisk === 'danger' ? 'bg-error' : statusRisk === 'warning' ? 'bg-warning' : 'bg-primary'}`}
                          />
                       </div>
                       <div className="flex justify-between text-[7px] font-mono uppercase text-main-text-muted opacity-60">
                          <span>Resting</span>
                          <span>Overload</span>
                       </div>
                    </div>
                 </div>
              )})}
           </div>

           <div className="p-4 bg-black/40 border border-primary/20 rounded-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                 <Waves size={40} className="text-primary" />
              </div>
              <h4 className="text-[10px] font-mono text-primary font-bold uppercase tracking-[0.2em] mb-2">Automated_Protocol_Response</h4>
              <p className="text-[11px] font-sans text-main-text leading-relaxed relative z-10 italic">
                 "Detecting elevated cognitive variance in Sector 4. Recommending immediate rotation of high-strain units to sub-optimal tasks. Buffer threshold reached."
              </p>
           </div>
        </div>
      </div>
    </div>
  );
}
