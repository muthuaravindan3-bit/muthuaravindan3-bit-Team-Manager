import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, addDoc, updateDoc, doc, orderBy, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { Mission, UserProfile, PerformanceMetric } from '../../types';
import { Target, Plus, Shield, Users, Clock, AlertTriangle, CheckCircle2, MoreHorizontal, X, Search, Link as LinkIcon, Crosshair, Sparkles, Brain, Activity, FileText, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { suggestMissionPersonnel, simulateMissionOutcome, SimulationResult, generateMissionDebrief, MissionDebrief } from '../../geminiService';

interface MissionControlProps {
  users: UserProfile[];
  onLogAction: (action: string, targetId: string, targetName: string, details?: string) => Promise<void>;
}

export function MissionControl({ users, onLogAction }: MissionControlProps) {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [isNewMissionOpen, setIsNewMissionOpen] = useState(false);
  const [isAIAnalyzing, setIsAIAnalyzing] = useState(false);
  const [aiRationale, setAiRationale] = useState<string | null>(null);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetric[]>([]);
  const [simulatingMissionId, setSimulatingMissionId] = useState<string | null>(null);
  const [simulationResult, setSimulationResult] = useState<{ id: string, result: SimulationResult } | null>(null);
  const [debriefingMissionId, setDebriefingMissionId] = useState<string | null>(null);
  const [debriefResult, setDebriefResult] = useState<{ id: string, result: MissionDebrief } | null>(null);
  const [newMission, setNewMission] = useState({
    title: '',
    description: '',
    priority: 'low' as Mission['priority'],
    type: 'recon' as Mission['type'],
    assignedTo: [] as string[],
    deadlineHours: 4
  });

  useEffect(() => {
    const q = query(collection(db, 'missions'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMissions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Mission)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'missions');
    });

    const perfUnsubscribe = onSnapshot(collection(db, 'performanceMetrics'), (snapshot) => {
      setPerformanceMetrics(snapshot.docs.map(doc => doc.data() as PerformanceMetric));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'performanceMetrics');
    });

    return () => {
      unsubscribe();
      perfUnsubscribe();
    };
  }, []);

  const runAIRecommendation = async () => {
    if (!newMission.title || !newMission.description) return;
    setIsAIAnalyzing(true);
    setAiRationale(null);
    try {
      const personnelPool = users.map(u => {
        const perf = performanceMetrics.find(p => p.userId === u.uid);
        return {
          uid: u.uid,
          name: u.displayName || u.email,
          role: u.role || 'member',
          score: perf?.efficiency || 80,
          traits: u.role === 'admin' ? ['Leadership', 'Strategic'] : ['Operational', 'Compliance']
        };
      });

      const suggestion = await suggestMissionPersonnel(newMission.title, newMission.description, personnelPool);
      setNewMission(prev => ({ ...prev, assignedTo: suggestion.suggestedUserIds }));
      setAiRationale(suggestion.rationale);
    } catch (e) {
      console.error("AI Suggestion failed:", e);
    } finally {
      setIsAIAnalyzing(false);
    }
  };

  const runMissionSimulation = async (mission: Mission) => {
    setSimulatingMissionId(mission.id);
    try {
      const assigned = mission.assignedTo.map(uid => {
        const u = users.find(usr => usr.uid === uid);
        const perf = performanceMetrics.find(p => p.userId === uid);
        return {
          name: u?.displayName || u?.email || 'Unknown',
          role: u?.role || 'member',
          score: perf?.efficiency || 80
        };
      });

      const result = await simulateMissionOutcome(
        { title: mission.title, description: mission.description },
        assigned
      );
      setSimulationResult({ id: mission.id, result });
    } catch (e) {
      console.error("Simulation failed:", e);
    } finally {
      setSimulatingMissionId(null);
    }
  };

  const runMissionDebrief = async (mission: Mission) => {
    setDebriefingMissionId(mission.id);
    try {
      const personnel = mission.assignedTo.map(uid => users.find(u => u.uid === uid)?.displayName || 'Unknown');
      const result = await generateMissionDebrief(
        { title: mission.title, description: mission.description, type: mission.type },
        mission.status === 'completed' ? 'SUCCESS' : 'FAILURE/ABORTED',
        personnel
      );
      setDebriefResult({ id: mission.id, result });
    } catch (e) {
       console.error("Debrief failed:", e);
    } finally {
      setDebriefingMissionId(null);
    }
  };

  const createMission = async () => {
    if (!newMission.title) return;
    try {
      const missionData = {
        title: newMission.title,
        description: newMission.description,
        status: 'active',
        priority: newMission.priority,
        type: newMission.type,
        assignedTo: newMission.assignedTo,
        createdAt: Date.now(),
        deadline: Date.now() + newMission.deadlineHours * 60 * 60 * 1000
      };
      await addDoc(collection(db, 'missions'), missionData);
      await onLogAction('CREATE_MISSION', 'global', newMission.title, `Assigned to ${newMission.assignedTo.length} units`);
      setIsNewMissionOpen(false);
      setNewMission({ title: '', description: '', priority: 'low', type: 'recon', assignedTo: [], deadlineHours: 4 });
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'missions');
    }
  };

  const updateMissionStatus = async (id: string, status: Mission['status']) => {
    try {
      await updateDoc(doc(db, 'missions', id), { status });
      await onLogAction('UPDATE_MISSION_STATUS', id, 'Mission', `Status changed to ${status}`);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'missions');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
           <h2 className="text-xl font-display font-medium text-main-text uppercase tracking-tight flex items-center gap-2">
             <Target size={20} className="text-primary" />
             Strategic_Objective_Hub
           </h2>
           <p className="text-[10px] font-mono text-main-text-muted uppercase tracking-[0.2em] mt-1">Personnel_Deployment_Vector // Mission_Control</p>
        </div>
        <button 
          onClick={() => setIsNewMissionOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-black font-mono text-[10px] font-bold uppercase tracking-widest rounded-lg hover:scale-105 transition-all shadow-lg shadow-primary/20 cursor-none group relative"
        >
          <Plus size={14} />
          Initialize_Directive
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
         <AnimatePresence mode="popLayout">
           {missions.map(mission => (
             <motion.div
               layout
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.95 }}
               key={mission.id}
               className="p-5 bg-surface-1 border border-main-border rounded-xl space-y-4 hover:border-primary/30 transition-all group relative overflow-hidden"
             >
                <div className={`absolute top-0 right-0 w-32 h-32 -mr-16 -mt-16 blur-3xl opacity-10 pointer-events-none transition-colors ${
                  mission.priority === 'critical' ? 'bg-error' : mission.priority === 'high' ? 'bg-warning' : 'bg-primary'
                }`} />

                <div className="flex items-start justify-between relative z-10">
                   <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                        mission.status === 'active' ? 'bg-success animate-pulse' :
                        mission.status === 'completed' ? 'bg-primary' : 'bg-main-text-muted'
                      }`} />
                      <span className="text-[8px] font-mono text-main-text-muted uppercase tracking-widest">{mission.type} // {mission.id.slice(0, 5)}</span>
                   </div>
                   <div className={`px-2 py-0.5 rounded text-[8px] font-mono uppercase tracking-widest border ${
                     mission.priority === 'critical' ? 'border-error text-error bg-error/5' :
                     mission.priority === 'high' ? 'border-warning text-warning bg-warning/5' :
                     'border-primary text-primary bg-primary/5'
                   }`}>
                      {mission.priority}
                   </div>
                </div>

                <div className="space-y-1 relative z-10">
                   <h3 className="text-sm font-medium text-main-text group-hover:text-primary transition-colors">{mission.title}</h3>
                   <p className="text-[10px] text-main-text-muted leading-relaxed line-clamp-2">{mission.description}</p>
                </div>

                <div className="flex items-center gap-4 relative z-10">
                   <div className="flex -space-x-2">
                     {mission.assignedTo.slice(0, 3).map(uid => {
                       const user = users.find(u => u.uid === uid);
                       return (
                         <div key={uid} className="w-6 h-6 rounded-full bg-surface-2 border border-main-border flex items-center justify-center text-[8px] font-mono text-main-text-muted uppercase" title={user?.displayName}>
                           {user?.displayName?.charAt(0) || '?'}
                         </div>
                       )
                     })}
                     {mission.assignedTo.length > 3 && (
                       <div className="w-6 h-6 rounded-full bg-surface-2 border border-main-border flex items-center justify-center text-[8px] font-mono text-main-text-muted uppercase">
                         +{mission.assignedTo.length - 3}
                       </div>
                     )}
                   </div>
                   <div className="flex items-center gap-1.5 text-main-text-muted">
                      <Clock size={10} />
                      <span className="text-[9px] font-mono uppercase">{format(mission.deadline, 'HH:mm')}</span>
                   </div>
                </div>

                <div className="pt-4 border-t border-main-border flex items-center justify-between relative z-10">
                   <div className="flex items-center gap-2">
                      <LinkIcon size={10} className="text-main-text-muted/30" />
                      <span className="text-[8px] font-mono text-main-text-muted uppercase">System_Link::Verified</span>
                   </div>
                   <div className="flex items-center gap-2">
                      {mission.status === 'active' && (
                        <>
                          <button 
                             onClick={() => runMissionSimulation(mission)}
                             disabled={simulatingMissionId === mission.id}
                             className={`p-1.5 text-main-text-muted hover:text-primary hover:bg-primary/5 rounded transition-all ${simulatingMissionId === mission.id ? 'animate-pulse text-primary' : ''}`}
                             title="Simulate Outcome"
                           >
                              {simulatingMissionId === mission.id ? <Activity size={14} className="animate-spin" /> : <Brain size={14} />}
                           </button>
                           <button 
                            onClick={() => updateMissionStatus(mission.id, 'completed')}
                            className="p-1.5 text-main-text-muted hover:text-success hover:bg-success/5 rounded transition-all"
                          >
                             <CheckCircle2 size={14} />
                          </button>
                        </>
                      )}
                      {mission.status === 'completed' && (
                         <button 
                           onClick={() => runMissionDebrief(mission)}
                           disabled={debriefingMissionId === mission.id}
                           className={`p-1.5 text-main-text-muted hover:text-secondary hover:bg-secondary/5 rounded transition-all ${debriefingMissionId === mission.id ? 'animate-pulse text-secondary' : ''}`}
                           title="Generate Mission Debrief"
                         >
                            {debriefingMissionId === mission.id ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                         </button>
                      )}
                      <button className="p-1.5 text-main-text-muted hover:text-main-text transition-all">
                        <MoreHorizontal size={14} />
                      </button>
                   </div>
                </div>

                <AnimatePresence>
                   {simulationResult?.id === mission.id && (
                     <motion.div 
                       initial={{ opacity: 0, height: 0 }}
                       animate={{ opacity: 1, height: 'auto' }}
                       exit={{ opacity: 0, height: 0 }}
                       className="mt-4 p-4 bg-primary/5 border border-primary/20 rounded-lg space-y-3 relative overflow-hidden"
                     >
                       <div className="absolute top-0 right-0 p-2">
                          <button onClick={() => setSimulationResult(null)} className="text-main-text-muted hover:text-main-text">
                             <X size={10} />
                          </button>
                       </div>
                       <div className="flex items-center justify-between">
                          <span className="text-[8px] font-mono uppercase tracking-widest text-primary font-bold">Simulation_Result</span>
                          <span className={`text-[10px] font-mono font-bold ${simulationResult.result.successProbability > 70 ? 'text-success' : 'text-warning'}`}>
                             {Math.round(simulationResult.result.successProbability)}%_Prob
                          </span>
                       </div>
                       <p className="text-[9px] text-main-text-muted leading-relaxed line-clamp-2">"{simulationResult.result.expectedOutcome}"</p>
                       
                       <div className="flex gap-4">
                          <div className="flex-1 space-y-1">
                             <span className="text-[7px] font-mono text-primary uppercase">Asset_Wear</span>
                             <div className="w-full h-1 bg-surface-2 rounded-full overflow-hidden">
                                <div className="h-full bg-warning" style={{ width: `${simulationResult.result.resourceImpact.degradationFactor}%` }} />
                             </div>
                          </div>
                          <div className="flex-1 space-y-1 text-right">
                             <span className="text-[7px] font-mono text-primary uppercase">Gear_Recs</span>
                             <p className="text-[8px] font-mono text-main-text-muted italic">{simulationResult.result.resourceImpact.recommendedAssets.slice(0, 2).join(", ")}</p>
                          </div>
                       </div>

                       <div className="flex flex-wrap gap-1">
                          {simulationResult.result.risks.slice(0, 2).map((risk, i) => (
                             <span key={i} className="text-[7px] font-mono bg-error/10 text-error px-1.5 py-0.5 rounded-sm uppercase">{risk}</span>
                          ))}
                       </div>
                     </motion.div>
                   )}

                   {debriefResult?.id === mission.id && (
                     <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-4 p-4 bg-secondary/5 border border-secondary/20 rounded-lg space-y-4 relative overflow-hidden"
                     >
                        <div className="absolute top-0 right-0 p-2">
                           <button onClick={() => setDebriefResult(null)} className="text-main-text-muted hover:text-main-text">
                              <X size={10} />
                           </button>
                        </div>
                        <div className="flex justify-between items-center">
                           <div className="flex items-center gap-2">
                              <Sparkles size={12} className="text-secondary" />
                              <span className="text-[8px] font-mono uppercase tracking-widest text-secondary font-bold">Tactical_Debrief_Packet</span>
                           </div>
                           <div className="flex items-center gap-1.5">
                              <span className="text-[8px] font-mono text-main-text-muted uppercase">Rating:</span>
                              <span className="text-[10px] font-mono font-bold text-secondary">{debriefResult.result.tacticalRating}%</span>
                           </div>
                        </div>
                        <div className="space-y-2">
                           <p className="text-[10px] text-main-text leading-relaxed italic border-l border-secondary/30 pl-3">
                              "{debriefResult.result.executiveSummary}"
                           </p>
                           <div className="space-y-1">
                              <span className="text-[7px] font-mono uppercase text-secondary font-bold">Lessons_Learned:</span>
                              <div className="grid gap-1">
                                 {debriefResult.result.lessonsLearned.slice(0, 3).map((l, i) => (
                                    <div key={i} className="flex items-start gap-1.5 text-[8px] text-main-text-muted italic">
                                       <div className="w-0.5 h-0.5 rounded-full bg-secondary mt-1" />
                                       <span>{l}</span>
                                    </div>
                                 ))}
                              </div>
                           </div>
                        </div>
                     </motion.div>
                   )}
                </AnimatePresence>
             </motion.div>
           ))}
         </AnimatePresence>

         {missions.length === 0 && (
           <div className="col-span-full py-20 border-2 border-dashed border-main-border rounded-2xl flex flex-col items-center justify-center space-y-4 opacity-50">
              <Crosshair size={40} className="text-main-text-muted" />
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-main-text-muted">No_Active_Directives_Detected</p>
           </div>
         )}
      </div>

      <AnimatePresence>
        {isNewMissionOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsNewMissionOpen(false)}
              className="absolute inset-0 bg-surface-1/80 backdrop-blur-xl"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-xl bg-surface-1 border border-main-border rounded-2xl shadow-2xl overflow-hidden"
            >
               <div className="p-6 border-b border-main-border bg-surface-2 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Shield size={18} className="text-primary" />
                    <h3 className="text-sm font-mono font-bold text-main-text uppercase tracking-widest">New_System_Directive</h3>
                  </div>
                  <button 
                    onClick={() => setIsNewMissionOpen(false)}
                    className="p-2 text-main-text-muted hover:text-main-text"
                  >
                    <X size={18} />
                  </button>
               </div>

               <div className="p-8 space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono text-main-text-muted uppercase tracking-widest">Directive_Title</label>
                    <input 
                      type="text"
                      value={newMission.title}
                      onChange={e => setNewMission({...newMission, title: e.target.value})}
                      placeholder="SECURE_SECTOR_ALPHA..."
                      className="w-full bg-surface-2 border border-main-border rounded-xl px-4 py-3 text-sm font-sans text-main-text outline-none focus:border-primary/50 transition-all uppercase tracking-tight"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-mono text-main-text-muted uppercase tracking-widest">Operational_Parameters</label>
                    <textarea 
                      value={newMission.description}
                      onChange={e => setNewMission({...newMission, description: e.target.value})}
                      placeholder="Input detailed mission parameters here..."
                      className="w-full bg-surface-2 border border-main-border rounded-xl px-4 py-3 text-sm font-sans text-main-text outline-none focus:border-primary/50 transition-all min-h-[100px]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-4">
                       <div className="space-y-2">
                          <label className="text-[10px] font-mono text-main-text-muted uppercase tracking-widest">Priority_Level</label>
                          <div className="flex bg-surface-2 p-1 rounded-xl border border-main-border">
                             {(['low', 'high', 'critical'] as const).map(p => (
                               <button
                                 key={p}
                                 onClick={() => setNewMission({...newMission, priority: p})}
                                 className={`flex-1 py-1.5 rounded-lg text-[9px] font-mono uppercase tracking-widest transition-all ${
                                   newMission.priority === p 
                                    ? p === 'critical' ? 'bg-error text-white font-bold' : 'bg-primary text-black font-bold'
                                    : 'text-main-text-muted hover:text-main-text'
                                 }`}
                               >
                                 {p}
                               </button>
                             ))}
                          </div>
                       </div>
                       <div className="space-y-2">
                          <label className="text-[10px] font-mono text-main-text-muted uppercase tracking-widest">Mission_Type</label>
                          <select 
                            value={newMission.type}
                            onChange={e => setNewMission({...newMission, type: e.target.value as any})}
                            className="w-full bg-surface-2 border border-main-border rounded-xl px-4 py-2 text-[10px] font-mono text-main-text uppercase tracking-widest outline-none"
                          >
                             <option value="recon">RECONNAISSANCE</option>
                             <option value="security">SECURITY_ENFORCEMENT</option>
                             <option value="logistics">LOGISTICS_OPS</option>
                             <option value="emergency">EMERGENCY_RESPONSE</option>
                          </select>
                       </div>
                    </div>

                  <div className="space-y-6">
                    <div className="space-y-2">
                       <div className="flex items-center justify-between">
                          <label className="text-[10px] font-mono text-main-text-muted uppercase tracking-widest">Assign_Personnel</label>
                          <button 
                            type="button"
                            onClick={runAIRecommendation}
                            disabled={isAIAnalyzing || !newMission.title || !newMission.description}
                            className="flex items-center gap-1 text-[8px] font-mono text-primary uppercase tracking-widest hover:text-primary-hover disabled:opacity-30 transition-all"
                          >
                             {isAIAnalyzing ? <div className="w-2 h-2 border border-primary border-t-transparent rounded-full animate-spin" /> : <Sparkles size={10} />}
                             {isAIAnalyzing ? 'Analyzing...' : 'AI_Optimize'}
                          </button>
                       </div>
                       <div className="bg-surface-2 border border-main-border rounded-xl p-4 max-h-[120px] overflow-y-auto space-y-2 scrollbar-thin">
                          {users.map(u => (
                            <label key={u.uid} className="flex items-center justify-between group cursor-pointer">
                               <div className="flex items-center gap-2">
                                  <span className="text-[9px] font-mono text-main-text-muted group-hover:text-main-text uppercase transition-colors">{u.displayName}</span>
                                  {newMission.assignedTo.includes(u.uid) && <Brain size={8} className="text-primary animate-pulse" />}
                               </div>
                               <input 
                                 type="checkbox"
                                 checked={newMission.assignedTo.includes(u.uid)}
                                 onChange={e => {
                                   const assigned = e.target.checked 
                                     ? [...newMission.assignedTo, u.uid]
                                     : newMission.assignedTo.filter(id => id !== u.uid);
                                   setNewMission({...newMission, assignedTo: assigned});
                                 }}
                                 className="accent-primary"
                               />
                            </label>
                          ))}
                       </div>
                    </div>

                    {aiRationale && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="p-4 bg-primary/5 border border-primary/20 rounded-xl space-y-2"
                      >
                         <div className="flex items-center gap-2 text-primary">
                            <Shield size={10} />
                            <span className="text-[8px] font-mono uppercase tracking-widest font-bold">Strategic_Rationale</span>
                         </div>
                         <p className="text-[9px] text-main-text-muted leading-relaxed line-clamp-3 italic">"{aiRationale}"</p>
                      </motion.div>
                    )}
                  </div>
                  </div>
               </div>

               <div className="p-8 border-t border-main-border bg-surface-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    <span className="text-[8px] font-mono text-main-text-muted uppercase tracking-widest">Protocol::Authorize_Vector</span>
                  </div>
                  <button 
                    onClick={createMission}
                    className="px-8 py-3 bg-primary text-black font-mono text-[10px] font-bold uppercase tracking-widest rounded-xl hover:scale-105 transition-all shadow-xl shadow-primary/20"
                  >
                    Commit_Directive
                  </button>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
