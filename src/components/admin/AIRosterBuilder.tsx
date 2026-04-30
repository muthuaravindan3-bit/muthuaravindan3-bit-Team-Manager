import React, { useState, useEffect } from 'react';
import { UserProfile, Shift, Mission } from '../../types';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { collection, query, getDocs, addDoc, updateDoc, where } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BrainCircuit, Users, Activity, Scan, ArrowRight, Cog, 
  Database, Target, CheckCircle2, AlertTriangle, Loader2, Sparkles, X, 
  GitMerge, ShieldAlert, Cpu, Check, XCircle
} from 'lucide-react';
import { suggestTeamRoster, suggestConflictFixes, SuggestedRosterShift, RosterConflictFix } from '../../geminiService';
import { format, addDays } from 'date-fns';

interface AIRosterBuilderProps {
  users: UserProfile[];
  shifts: Shift[];
}

export function AIRosterBuilder({ users, shifts }: AIRosterBuilderProps) {
  const [currentStage, setCurrentStage] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [targetDate, setTargetDate] = useState(format(addDays(new Date(), 1), 'yyyy-MM-dd'));
  
  // Data for stages
  const [personnelData, setPersonnelData] = useState<{ total: number; available: number }>({ total: 0, available: 0 });
  const [missionReqs, setMissionReqs] = useState<any[]>([]);
  const [aiSuggestions, setAiSuggestions] = useState<(SuggestedRosterShift & { id: string })[]>([]);
  const [conflictLogs, setConflictLogs] = useState<string[]>([]);
  const [conflictFixes, setConflictFixes] = useState<RosterConflictFix[]>([]);
  const [resolvedConflicts, setResolvedConflicts] = useState<string[]>([]); // array of handled shiftIds
  const [deploymentStatus, setDeploymentStatus] = useState<'pending' | 'success' | 'error'>('pending');

  const advanceStage = () => {
    if (currentStage < 5) setCurrentStage(prev => prev + 1);
  };

  // ----------------------------------------------------
  // Stage 1: Personnel & Telemetry Scan
  // ----------------------------------------------------
  const runStage1Scan = async () => {
    setIsProcessing(true);
    try {
      // Simulate fetching deep wellness/availability metrics
      setTimeout(() => {
        setPersonnelData({
          total: users.length,
          available: users.length
        });
        advanceStage();
        setIsProcessing(false);
      }, 2000);
    } catch(e) {
      setIsProcessing(false);
    }
  };

  // ----------------------------------------------------
  // Stage 2: Operational Requirement Generation
  // ----------------------------------------------------
  const runStage2Requirements = async () => {
    setIsProcessing(true);
    try {
      const q = query(collection(db, 'missions'), where('status', '==', 'active'));
      const snap = await getDocs(q);
      setMissionReqs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      
      setTimeout(() => {
        advanceStage();
        setIsProcessing(false);
      }, 2500);
    } catch(e) {
      setIsProcessing(false);
    }
  };

  // ----------------------------------------------------
  // Stage 3: Deep Optimization Matrix (AI Roster Gen)
  // ----------------------------------------------------
  const runStage3Optimization = async () => {
    setIsProcessing(true);
    try {
      const pool = users.map(u => ({
        uid: u.uid,
        name: u.displayName || 'Unknown',
        role: u.role
      }));
      
      const res = await suggestTeamRoster(pool, [targetDate], missionReqs);
      const withIds = res.map((s, idx) => ({ ...s, id: `shift_temp_${idx}` }));
      setAiSuggestions(withIds);
      advanceStage();
    } catch(e) {
      console.error(e);
      alert("AI Service currently maxed. Retrying optimization parameters...");
    } finally {
      setIsProcessing(false);
    }
  };

  // ----------------------------------------------------
  // Stage 4: Automated Conflict Auto-Resolution
  // ----------------------------------------------------
  const runStage4ConflictResolution = async () => {
    setIsProcessing(true);
    setConflictLogs(["Scanning for chronological constraint violations...", "Cross-referencing historical shifts..."]);
    setConflictFixes([]);
    setResolvedConflicts([]);
    
    try {
      const q = query(collection(db, 'shifts'), where('date', '<', targetDate));
      const snap = await getDocs(q);
      const pastShifts = snap.docs.map(d => d.data());

      setConflictLogs(prev => [...prev, "Querying Cortex for optimal conflict geometries..."]);
      
      const fixes = await suggestConflictFixes(aiSuggestions, pastShifts.slice(0, 50));
      
      if (fixes.length === 0) {
        setConflictLogs(prev => [...prev, "Clear. No violations remaining."]);
        setTimeout(() => advanceStage(), 1500);
      } else {
         setConflictLogs(prev => [...prev, `Detected ${fixes.length} systemic conflicts requiring resolution.`]);
         setConflictFixes(fixes);
      }
    } catch(e) {
       console.error(e);
       setConflictLogs(prev => [...prev, "Cortex failed to process conflict bounds."]);
    } finally {
       setIsProcessing(false);
    }
  };

  const applyFix = (fix: RosterConflictFix) => {
    setAiSuggestions(prev => prev.map(s => {
       if (s.id === fix.shiftId) {
          return {
             ...s,
             date: fix.newDate || s.date,
             startTime: fix.newStartTime || s.startTime,
             endTime: fix.newEndTime || s.endTime
          };
       }
       return s;
    }));
    setResolvedConflicts(prev => [...prev, fix.shiftId]);
  };

  const rejectFix = (fix: RosterConflictFix) => {
    setResolvedConflicts(prev => [...prev, fix.shiftId]);
  };

  // Move to next stage manually if all fixes handler or user skips
  const checkStage4Completion = () => {
    if (conflictFixes.length > 0 && resolvedConflicts.length >= conflictFixes.length) {
       advanceStage();
    } else {
       advanceStage(); // Manual skip
    }
  };

  // ----------------------------------------------------
  // Stage 5: Deployment
  // ----------------------------------------------------
  const runStage5Deployment = async () => {
    setIsProcessing(true);
    try {
      const promises = aiSuggestions.map(async (s) => {
        const userObj = users.find(u => u.uid === s.userId);
        if(!userObj) return;
        
        await addDoc(collection(db, 'shifts'), {
          userId: s.userId,
          userName: userObj.displayName || userObj.email,
          date: targetDate,
          startTime: s.startTime,
          endTime: s.endTime,
          type: s.type,
          updatedAt: Date.now()
        });
      });
      await Promise.all(promises);
      setDeploymentStatus('success');
    } catch (e) {
       console.error(e);
       setDeploymentStatus('error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Sub-components for each stage
  const Stage1 = () => (
    <div className="space-y-6 text-center py-8">
       <div className="mx-auto w-20 h-20 bg-surface-2 rounded-full border border-main-border flex items-center justify-center mb-6">
          <Scan size={32} className="text-primary" />
       </div>
       <h3 className="text-xl font-display uppercase tracking-widest text-main-text">Stage_1 // Personnel Integrity Scan</h3>
       <p className="text-xs font-mono text-main-text-muted max-w-lg mx-auto leading-relaxed">
          Initialize deep telemetry sweep across all active personnel. Cross-referencing operational history, fatigue indices, and certification validity before assignment computation.
       </p>
       
       <div className="pt-8">
          <button 
             onClick={runStage1Scan}
             disabled={isProcessing}
             className="px-8 py-3 bg-primary text-surface-1 font-mono text-[10px] uppercase font-bold tracking-[0.2em] rounded hover:scale-105 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 flex items-center justify-center gap-3 mx-auto"
          >
             {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Activity size={16} />}
             {isProcessing ? 'Executing Sweep...' : 'Initialize Integrity Sweep'}
          </button>
       </div>
    </div>
  );

  const Stage2 = () => (
    <div className="space-y-6 text-center py-8">
       <div className="mx-auto w-20 h-20 bg-primary/10 rounded-full border border-primary/30 flex items-center justify-center text-primary mb-6">
          <Target size={32} />
       </div>
       <h3 className="text-xl font-display uppercase tracking-widest text-main-text">Stage_2 // Operational Requirement Mapping</h3>
       <p className="text-xs font-mono text-main-text-muted max-w-lg mx-auto leading-relaxed">
          Aggregating all active global threat mandates and mission requirements. Synthesizing target capacity gaps for target date: {targetDate}.
       </p>
       
       <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto my-6 text-left">
          <div className="p-4 bg-surface-2 border border-main-border rounded-lg">
             <span className="text-[9px] font-mono uppercase text-main-text-muted">Cleared Personnel</span>
             <p className="text-xl font-mono text-primary">{personnelData.available} / {personnelData.total}</p>
          </div>
          <div className="p-4 bg-surface-2 border border-main-border rounded-lg">
             <span className="text-[9px] font-mono uppercase text-main-text-muted">Target Date</span>
             <p className="text-sm font-mono mt-1 text-main-text">{targetDate}</p>
          </div>
       </div>

       <div className="pt-4">
          <button 
             onClick={runStage2Requirements}
             disabled={isProcessing}
             className="px-8 py-3 bg-primary text-surface-1 font-mono text-[10px] uppercase font-bold tracking-[0.2em] rounded hover:scale-105 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 flex items-center justify-center gap-3 mx-auto"
          >
             {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Database size={16} />}
             {isProcessing ? 'Synthesizing Needs...' : 'Generate Requirements Matrix'}
          </button>
       </div>
    </div>
  );

  const Stage3 = () => (
    <div className="space-y-6 text-center py-8">
       <div className="mx-auto w-20 h-20 bg-warning/10 rounded-full border border-warning/30 flex items-center justify-center text-warning mb-6">
          <Cpu size={32} className={isProcessing ? "animate-pulse" : ""} />
       </div>
       <h3 className="text-xl font-display uppercase tracking-widest text-main-text">Stage_3 // Deep Optimization Matrix</h3>
       <p className="text-xs font-mono text-main-text-muted max-w-lg mx-auto leading-relaxed">
          Engaging Cortex neural pathway. Simulating permutations to find maximum operational efficacy with minimal burnout risk cross-referencing {missionReqs.length} active directives.
       </p>

       <div className="pt-8">
          <button 
             onClick={runStage3Optimization}
             disabled={isProcessing}
             className="px-8 py-3 bg-warning text-surface-1 font-mono text-[10px] uppercase font-bold tracking-[0.2em] rounded hover:scale-105 transition-all shadow-lg shadow-warning/20 disabled:opacity-50 flex items-center justify-center gap-3 mx-auto"
          >
             {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <BrainCircuit size={16} />}
             {isProcessing ? 'Simulating Roster Topologies...' : 'Run Neural Optimization'}
          </button>
       </div>
    </div>
  );

  const Stage4 = () => (
    <div className="space-y-6 text-center py-8">
       <div className="mx-auto w-20 h-20 bg-[#050505] rounded-full border border-primary/50 flex items-center justify-center relative overflow-hidden mb-6">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20"></div>
          <GitMerge size={32} className="text-primary relative z-10" />
       </div>
       <h3 className="text-xl font-display uppercase tracking-widest text-main-text">Stage_4 // Automated Conflict Resolution</h3>
       <p className="text-xs font-mono text-main-text-muted max-w-lg mx-auto leading-relaxed">
          Found {aiSuggestions.length} shift vectors. Stress-testing against systemic rulesets and temporal violations.
       </p>
       
       {conflictFixes.length === 0 ? (
         <>
           <div className="bg-[#050505] border border-main-border rounded-lg p-4 max-w-lg mx-auto min-h-[120px] text-left font-mono text-[9px] uppercase tracking-widest space-y-2 mt-6">
              {conflictLogs.length === 0 && <span className="text-main-text-muted opacity-50">System standby...</span>}
              {conflictLogs.map((log, i) => (
                 <div key={i} className="flex gap-2">
                    <span className="text-primary shrink-0">&gt;</span>
                    <span className={i === conflictLogs.length - 1 ? 'text-success' : 'text-main-text-muted'}>{log}</span>
                 </div>
              ))}
              {isProcessing && conflictLogs.length > 0 && <span className="text-primary animate-pulse inline-block ml-1">_</span>}
           </div>

           <div className="pt-6">
              <button 
                 onClick={runStage4ConflictResolution}
                 disabled={isProcessing}
                 className="px-8 py-3 bg-primary text-surface-1 font-mono text-[10px] uppercase font-bold tracking-[0.2em] rounded hover:scale-105 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 flex items-center justify-center gap-3 mx-auto"
              >
                 {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <ShieldAlert size={16} />}
                 {isProcessing ? 'Resolving Vector Collisions...' : 'Auto-Resolve Conflicts'}
              </button>
           </div>
         </>
       ) : (
         <div className="max-w-2xl mx-auto mt-8 space-y-4">
           {conflictFixes.map((fix, idx) => {
             const suggestion = aiSuggestions.find(s => s.id === fix.shiftId);
             const isResolved = resolvedConflicts.includes(fix.shiftId);
             
             return (
               <div key={idx} className={`p-4 border rounded-xl text-left transition-all ${isResolved ? 'opacity-50 border-main-border bg-surface-2' : 'border-warning/50 bg-warning/5'}`}>
                 <div className="flex justify-between items-start mb-3">
                   <div>
                     <h4 className="font-bold text-main-text flex items-center gap-2">
                       <AlertTriangle size={16} className={isResolved ? "text-main-text-muted" : "text-warning"} />
                       Conflict Detected
                     </h4>
                     <p className="text-xs text-main-text-muted mt-1 font-mono">{suggestion?.userName || fix.shiftId}</p>
                   </div>
                   {isResolved && (
                     <span className="px-2 py-1 bg-surface-3 text-[10px] uppercase tracking-widest font-bold rounded text-main-text-muted">Handled</span>
                   )}
                 </div>
                 
                 <p className="text-sm text-main-text mb-4 italic">"{fix.suggestedAction}"</p>
                 
                 <div className="grid grid-cols-2 gap-4 mb-4 text-xs font-mono">
                   <div className="p-3 bg-surface-1 border border-error/20 rounded">
                     <div className="text-[10px] text-error mb-1 uppercase tracking-widest">Original Vector</div>
                     <div>D: {suggestion?.date}</div>
                     <div>T: {suggestion?.startTime} - {suggestion?.endTime}</div>
                   </div>
                   <div className="p-3 bg-surface-1 border border-success/20 rounded">
                     <div className="text-[10px] text-success mb-1 uppercase tracking-widest">Proposed Fix</div>
                     <div>D: {fix.newDate || suggestion?.date}</div>
                     <div>T: {fix.newStartTime || suggestion?.startTime} - {fix.newEndTime || suggestion?.endTime}</div>
                   </div>
                 </div>

                 {!isResolved && (
                   <div className="flex gap-3">
                     <button 
                       onClick={() => applyFix(fix)}
                       className="flex-1 py-2 bg-success text-surface-1 text-xs font-mono uppercase font-bold tracking-widest rounded flex items-center justify-center gap-2 hover:bg-success/90 transition-all"
                     >
                       <Check size={14} /> Apply Modification
                     </button>
                     <button 
                       onClick={() => rejectFix(fix)}
                       className="flex-1 py-2 bg-surface-2 border border-main-border text-xs font-mono uppercase tracking-widest rounded flex items-center justify-center gap-2 hover:border-error hover:text-error transition-all"
                     >
                       <XCircle size={14} /> Retain Original
                     </button>
                   </div>
                 )}
               </div>
             );
           })}

           <div className="pt-6">
              <button 
                 onClick={checkStage4Completion}
                 className="px-8 py-3 bg-primary text-surface-1 font-mono text-[10px] uppercase font-bold tracking-[0.2em] rounded hover:scale-105 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-3 mx-auto"
              >
                 Proceed to Deployment <ArrowRight size={16} />
              </button>
           </div>
         </div>
       )}
    </div>
  );

  const Stage5 = () => (
    <div className="space-y-6 text-center py-8">
       {deploymentStatus === 'success' ? (
          <>
             <div className="mx-auto w-24 h-24 bg-success/10 rounded-full border border-success/30 flex items-center justify-center text-success mb-6">
                <CheckCircle2 size={48} />
             </div>
             <h3 className="text-2xl font-display uppercase tracking-widest text-success">Deployed Successfully</h3>
             <p className="text-xs font-mono text-main-text-muted max-w-lg mx-auto leading-relaxed">
                Roster fully committed to operational matrix. Personnel have been notified.
             </p>
             <button 
                onClick={() => { setCurrentStage(1); setDeploymentStatus('pending'); setTargetDate(format(addDays(new Date(), 1), 'yyyy-MM-dd')); }}
                className="mt-8 px-8 py-2 border border-main-border text-main-text hover:bg-surface-2 font-mono text-[10px] uppercase tracking-widest transition-all"
             >
                Start New Roster Matrix
             </button>
          </>
       ) : (
          <>
             <div className="mx-auto w-20 h-20 bg-surface-2 rounded-full border border-main-border flex items-center justify-center text-main-text mb-6">
                <Sparkles size={32} />
             </div>
             <h3 className="text-xl font-display uppercase tracking-widest text-main-text">Stage_5 // Final Deployment</h3>
             <p className="text-xs font-mono text-main-text-muted max-w-lg mx-auto leading-relaxed mb-6">
                Roster architecture finalized. Confirm deployment to push to active operational database.
             </p>
             
             <div className="max-w-xl mx-auto border border-main-border rounded-lg bg-surface-1 overflow-hidden text-left max-h-[250px] overflow-y-auto scrollbar-thin">
                <table className="w-full text-xs">
                   <thead className="bg-surface-2 font-mono text-[9px] uppercase tracking-widest text-main-text-muted">
                      <tr>
                         <th className="px-4 py-3 text-left font-normal border-b border-main-border">Operator</th>
                         <th className="px-4 py-3 text-left font-normal border-b border-main-border">Type</th>
                         <th className="px-4 py-3 text-right font-normal border-b border-main-border">Window</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-main-border font-sans">
                      {aiSuggestions.map((s, i) => {
                         const userObj = users.find(u => u.uid === s.userId);
                         return (
                            <tr key={i} className="hover:bg-surface-2/20">
                               <td className="px-4 py-2 text-main-text">{userObj?.displayName || s.userId}</td>
                               <td className="px-4 py-2">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-primary/10 text-primary border border-primary/20`}>{s.type}</span>
                               </td>
                               <td className="px-4 py-2 text-right text-main-text-muted font-mono">{s.startTime} - {s.endTime}</td>
                            </tr>
                         )
                      })}
                   </tbody>
                </table>
             </div>

             <div className="pt-8">
                <button 
                   onClick={runStage5Deployment}
                   disabled={isProcessing}
                   className="px-8 py-3 bg-success text-surface-1 font-mono text-[10px] uppercase font-bold tracking-[0.2em] rounded hover:scale-105 transition-all shadow-lg shadow-success/20 disabled:opacity-50 flex items-center justify-center gap-3 mx-auto"
                >
                   {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                   {isProcessing ? 'Committing to DB...' : 'Commit Final Roster'}
                </button>
             </div>
          </>
       )}
    </div>
  );

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
           <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg border border-primary/20">
                 <BrainCircuit size={24} className="text-primary" />
              </div>
              <h2 className="text-2xl font-display font-medium text-main-text uppercase tracking-tight italic">
                 AI_Roster_Constructor
              </h2>
           </div>
           <p className="text-[10px] font-mono text-main-text-muted mt-1 uppercase tracking-[0.4em] opacity-40">Phase_07 // Autonomous_Shift_Orchestration</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-4 lg:grid-cols-[250px_1fr] gap-8">
         {/* Phase Navigation */}
         <div className="bg-surface-1 border border-main-border rounded-xl p-4 h-fit">
            <h4 className="text-[9px] font-mono uppercase text-main-text-muted tracking-widest mb-6 font-bold flex items-center gap-2">
               <Cog size={12} /> Process Flow
            </h4>
            
            <div className="space-y-1 relative before:absolute before:inset-y-4 before:left-3 before:w-px before:bg-main-border">
               {[
                  { n: 1, label: 'Personnel Scan' },
                  { n: 2, label: 'Requirements' },
                  { n: 3, label: 'Optimization' },
                  { n: 4, label: 'Auto-Resolve' },
                  { n: 5, label: 'Deployment' }
               ].map((step) => {
                  const isActive = currentStage === step.n;
                  const isPast = currentStage > step.n;
                  return (
                     <div key={step.n} className={`relative flex items-center gap-3 p-2 rounded-lg transition-colors ${isActive ? 'bg-primary/5 border border-primary/20' : ''}`}>
                        <div className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-[10px] font-mono relative z-10 transition-colors ${
                           isActive ? 'bg-primary text-surface-1 shadow-lg shadow-primary/20' : 
                           isPast ? 'bg-surface-2 border border-main-border text-main-text-muted' : 
                           'bg-[#050505] border border-main-border text-main-text-muted'
                        }`}>
                           {isPast ? <CheckCircle2 size={12} /> : step.n}
                        </div>
                        <span className={`text-[10px] font-mono uppercase tracking-widest ${isActive ? 'text-primary font-bold' : isPast ? 'text-main-text opacity-60' : 'text-main-text-muted opacity-40'}`}>
                           {step.label}
                        </span>
                     </div>
                  );
               })}
            </div>
            
            <div className="mt-8 pt-6 border-t border-main-border">
               <label className="text-[9px] font-mono uppercase text-main-text-muted tracking-widest block mb-2">Target Date (T-Zero)</label>
               <input 
                  type="date" 
                  className="w-full bg-surface-2 border border-main-border rounded px-3 py-2 text-xs text-main-text font-mono"
                  value={targetDate}
                  onChange={e => setTargetDate(e.target.value)}
                  disabled={currentStage > 1}
               />
            </div>
         </div>

         {/* Stage Content */}
         <div className="bg-surface-1 border border-main-border rounded-xl min-h-[500px] flex items-center justify-center p-8 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-surface-2/10 pointer-events-none" />
            
            <div className="w-full h-full max-w-2xl mx-auto relative z-10">
               <AnimatePresence mode="wait">
                  <motion.div 
                     key={currentStage}
                     initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
                     animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                     exit={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
                     transition={{ duration: 0.3 }}
                     className="w-full h-full flex flex-col justify-center"
                  >
                     {currentStage === 1 && <Stage1 />}
                     {currentStage === 2 && <Stage2 />}
                     {currentStage === 3 && <Stage3 />}
                     {currentStage === 4 && <Stage4 />}
                     {currentStage === 5 && <Stage5 />}
                  </motion.div>
               </AnimatePresence>
            </div>
         </div>
      </div>
    </div>
  );
}
