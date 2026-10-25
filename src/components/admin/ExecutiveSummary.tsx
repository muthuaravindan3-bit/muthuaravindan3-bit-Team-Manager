import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, where, limit, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { calculateGlobalRisk, generateStrategicForecast, GlobalRiskIndex, StrategicForecast, TacticalBriefing, generateTacticalBriefing } from '../../geminiService';
import { 
  Shield, AlertTriangle, TrendingUp, TrendingDown, Minus, Brain, Sparkles, Loader2, 
  Target, Users, Zap, Activity, Info, ChevronRight, Activity as Pulse, Radio, ShieldAlert
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function ExecutiveSummary() {
  const [riskIndex, setRiskIndex] = useState<GlobalRiskIndex | null>(null);
  const [forecast, setForecast] = useState<StrategicForecast | null>(null);
  const [briefing, setBriefing] = useState<TacticalBriefing | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastAudit, setLastAudit] = useState<number | null>(null);

  const runIntelligenceAudit = async () => {
    setLoading(true);
    try {
      // Collect global context
      const [missionsSnap, usersSnap, shiftsSnap, resourcesSnap, annSnap] = await Promise.all([
        getDocs(query(collection(db, 'missions'), where('status', '==', 'active'))),
        getDocs(collection(db, 'users')),
        getDocs(query(collection(db, 'shifts'), limit(100))),
        getDocs(collection(db, 'resources')),
        getDocs(query(collection(db, 'announcements'), orderBy('createdAt', 'desc'), limit(5)))
      ]);

      const activeMissionsCount = missionsSnap.size;
      const resources = resourcesSnap.docs.map(d => d.data());
      const avgResourceHealth = resources.length > 0 
        ? resources.reduce((acc, r) => acc + (r.health || 0), 0) / resources.length 
        : 100;

      const wellnessSnap = await getDocs(query(collection(db, 'wellness'), limit(50)));
      const avgWellness = wellnessSnap.docs.length > 0
        ? wellnessSnap.docs.reduce((acc, d) => acc + (d.data().score || 0), 0) / wellnessSnap.docs.length
        : 7.5; 

      const risk = await calculateGlobalRisk({
        activeMissions: activeMissionsCount,
        avgWellness: avgWellness,
        auditThreatLevel: 'moderate', 
        resourceHealthAvg: avgResourceHealth,
        unfilledShifts: 2
      });

      const strategic = await generateStrategicForecast({
        missionsLast30d: 12,
        shiftsServed: shiftsSnap.size,
        incidentCount: 1
      });

      const tactical = await generateTacticalBriefing({
        activeMissions: activeMissionsCount,
        onDutyCount: Math.floor(shiftsSnap.size / 4),
        avgWellness: avgWellness,
        urgentAnnouncements: annSnap.docs.map(d => d.data().content)
      });

      setRiskIndex(risk);
      setForecast(strategic);
      setBriefing(tactical);
      setLastAudit(Date.now());
    } catch (e) {
      console.error("Intelligence audit failed:", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-main-border pb-6">
        <div>
          <h2 className="text-xl font-display font-medium text-main-text uppercase tracking-tight flex items-center gap-3">
             <Brain className="text-primary" />
             Strategic Intelligence Center
          </h2>
          <p className="text-[10px] font-mono text-main-text-muted mt-1 uppercase tracking-widest">
             Cortex_Intelligence_Aggregation // Protocol_XE
          </p>
        </div>
        <button 
          onClick={runIntelligenceAudit}
          disabled={loading}
          className="px-6 py-2.5 bg-primary text-black font-mono text-[10px] uppercase tracking-wider font-bold rounded flex items-center gap-2 hover:scale-[1.02] transition-all shadow-[0_0_15px_rgba(var(--color-primary),0.2)] disabled:opacity-50"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {loading ? 'Processing...' : 'Initiate_Global_Audit'}
        </button>
      </div>

      {!riskIndex && !loading && (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
           <div className="w-16 h-16 rounded-full bg-surface-2 border border-main-border flex items-center justify-center text-main-text-muted animate-pulse">
              <Shield size={32} />
           </div>
           <div>
              <p className="text-xs font-mono text-main-text-muted uppercase tracking-widest">Intelligence_Offline</p>
              <p className="text-[10px] text-main-text-muted/50 mt-1 uppercase tracking-tighter">Invoke audit to synchronize operational data</p>
           </div>
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-20 space-y-6">
           <div className="relative">
              <div className="w-20 h-20 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                 <Pulse size={30} className="text-primary animate-pulse" />
              </div>
           </div>
           <div className="text-center">
              <p className="text-[10px] font-mono text-primary uppercase tracking-[0.3em] font-bold">Scanning_Global_Net...</p>
              <div className="mt-2 text-[8px] font-mono text-main-text-muted uppercase space-y-1">
                 <p className="animate-pulse">Analyzing Resource Telemetry...</p>
                 <p className="animate-pulse flex items-center justify-center gap-2" style={{ animationDelay: '0.2s' }}>Aggregating Personnel Wellness...</p>
                 <p className="animate-pulse" style={{ animationDelay: '0.4s' }}>Compiling Mission Risk Vectors...</p>
              </div>
           </div>
        </div>
      )}

      <AnimatePresence>
        {riskIndex && forecast && briefing && !loading && (
           <motion.div 
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
             className="space-y-8"
           >
              {/* Tactical SitDep Section (Top Wide Bar) */}
              <div className="bg-surface-1 border border-primary/20 rounded-xl p-6 relative overflow-hidden group shadow-2xl">
                 <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Radio size={48} className="text-primary animate-pulse" />
                 </div>
                 <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                    <div className="space-y-2 max-w-2xl">
                       <h3 className="text-secondary font-mono text-xs font-bold uppercase tracking-[0.3em] flex items-center gap-2">
                          <Activity size={14} />
                          Live_Operational_SitRep
                       </h3>
                       <h4 className="text-lg font-display font-medium text-main-text uppercase tracking-tight italic">
                          "{briefing.headline}"
                       </h4>
                       <p className="text-[11px] font-sans text-main-text-muted leading-relaxed">
                          {briefing.situationReport}
                       </p>
                    </div>
                    <div className="grid grid-cols-2 gap-4 md:border-l md:border-main-border md:pl-8">
                       <div className="space-y-1">
                          <span className="text-[8px] font-mono text-main-text-muted uppercase tracking-widest">Morale_Index</span>
                          <p className="text-xs font-mono font-bold text-primary uppercase">{briefing.personnelMorale}</p>
                       </div>
                       <div className="space-y-1 text-right md:text-left">
                          <span className="text-[8px] font-mono text-main-text-muted uppercase tracking-widest">Global_Status</span>
                          <p className="text-xs font-mono font-bold text-success uppercase">Combat_Ready</p>
                       </div>
                    </div>
                 </div>

                 {briefing.criticalAlerts.length > 0 && (
                   <div className="mt-6 pt-6 border-t border-main-border grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {briefing.criticalAlerts.map((alert, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 bg-error/5 border border-error/10 rounded group hover:bg-error/10 transition-all">
                           <ShieldAlert size={14} className="text-error shrink-0" />
                           <span className="text-[9px] font-mono text-error uppercase font-bold tracking-tight">{alert}</span>
                        </div>
                      ))}
                   </div>
                 )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Global Risk Index Card */}
              <div className="lg:col-span-2 space-y-8">
                 <div className="bg-surface-1 border border-main-border rounded-xl p-8 relative overflow-hidden shadow-2xl">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                       <Shield size={120} className="text-primary" />
                    </div>
                    
                    <div className="flex justify-between items-start mb-10 relative z-10">
                       <div>
                          <h3 className="text-sm font-mono text-primary font-bold uppercase tracking-widest flex items-center gap-2">
                             Global_Risk_Factor
                             <Info size={12} className="text-main-text-muted" />
                          </h3>
                          <p className="text-[10px] font-mono text-main-text-muted uppercase tracking-tighter mt-1">Audit_Ref: {lastAudit}</p>
                       </div>
                       <div className="text-right">
                          <span className={`text-4xl font-mono font-bold ${
                             riskIndex.overallRisk > 70 ? 'text-error' : 
                             riskIndex.overallRisk > 40 ? 'text-warning' : 'text-success'
                          }`}>
                             {riskIndex.overallRisk}%
                          </span>
                       </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-10 relative z-10">
                       <div className="space-y-6">
                          <div className="space-y-2">
                             <div className="flex justify-between text-[10px] font-mono uppercase text-main-text-muted">
                                <span>Readiness_Rating</span>
                                <span>{riskIndex.readinessRating}%</span>
                             </div>
                             <div className="w-full h-1.5 bg-surface-2 rounded-full overflow-hidden">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${riskIndex.readinessRating}%` }}
                                  className="h-full bg-success shadow-[0_0_10px_rgba(var(--color-success),0.5)]"
                                />
                             </div>
                          </div>
                          <div className="space-y-2">
                             <div className="flex justify-between text-[10px] font-mono uppercase text-main-text-muted">
                                <span>Personnel_Fatigue</span>
                                <span>{riskIndex.fatigueFactor}%</span>
                             </div>
                             <div className="w-full h-1.5 bg-surface-2 rounded-full overflow-hidden">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${riskIndex.fatigueFactor}%` }}
                                  className="h-full bg-warning shadow-[0_0_10px_rgba(var(--color-warning),0.5)]"
                                />
                             </div>
                          </div>
                       </div>

                       <div className="space-y-4">
                          <div className="p-4 bg-black/40 border border-main-border rounded-lg space-y-3">
                             <div className="flex items-center gap-2">
                                <AlertTriangle size={14} className="text-warning" />
                                <span className="text-[10px] font-mono uppercase font-bold text-main-text">Vulnerability_Report</span>
                             </div>
                             <p className="text-[11px] font-sans text-main-text-muted italic leading-relaxed">
                                "{riskIndex.vulnerabilityAssessment}"
                             </p>
                          </div>
                          <div className="flex items-center justify-between p-3 bg-surface-2 rounded border border-main-border">
                             <span className="text-[9px] font-mono uppercase text-main-text-muted">Security_Protocol</span>
                             <span className="text-[10px] font-mono font-bold text-primary uppercase">{riskIndex.securityStatus}</span>
                          </div>
                       </div>
                    </div>
                 </div>

                 {/* Strategic Forecast Section */}
                 <div className="grid md:grid-cols-2 gap-6">
                    <div className="bg-surface-1 border border-main-border rounded-xl p-6 space-y-6">
                       <div className="flex items-center gap-3">
                          <TrendingUp size={18} className="text-primary" />
                          <h4 className="text-[11px] font-mono uppercase tracking-widest text-main-text font-bold">Operational_Trajectory</h4>
                       </div>
                       
                       <div className="flex items-center justify-between p-4 bg-surface-2 rounded-lg border border-main-border">
                          <div className="flex items-center gap-3">
                             {forecast.workloadProjection === 'increasing' ? <TrendingUp className="text-error" /> : 
                              forecast.workloadProjection === 'decreasing' ? <TrendingDown className="text-success" /> : 
                              <Minus className="text-warning" />}
                             <span className="text-xs font-mono uppercase text-main-text">Workload: {forecast.workloadProjection}</span>
                          </div>
                       </div>

                       <div className="space-y-2">
                          <span className="text-[9px] font-mono uppercase text-main-text-muted">Burnout_Risk_Timeline</span>
                          <p className="text-[10px] text-main-text font-medium border-l-2 border-error/50 pl-4 py-1 italic">"{forecast.burnoutRiskTimeline}"</p>
                       </div>
                    </div>

                    <div className="bg-surface-1 border border-main-border rounded-xl p-6 space-y-6">
                       <div className="flex items-center gap-3">
                          <Zap size={18} className="text-secondary" />
                          <h4 className="text-[11px] font-mono uppercase tracking-widest text-main-text font-bold">Critical_Bottleneck</h4>
                       </div>
                       <div className="p-4 bg-secondary/5 border border-secondary/20 rounded-lg">
                          <p className="text-[10px] font-mono text-secondary uppercase font-bold text-center tracking-wider">{forecast.resourceBottleneck}</p>
                       </div>
                       <p className="text-[10px] text-main-text-muted italic leading-relaxed">AI analysis indicates potential system gridlock at this junction if operational load continues current acceleration.</p>
                    </div>
                 </div>
              </div>

              {/* Recommendations Sidebar */}
              <div className="space-y-6">
                 <div className="bg-surface-1 border border-main-border rounded-xl p-6 space-y-6">
                    <div className="flex items-center gap-3">
                       <Target size={18} className="text-primary" />
                       <h4 className="text-[11px] font-mono uppercase tracking-widest text-main-text font-bold">Strategic_Directives</h4>
                    </div>
                    <div className="space-y-3">
                       {forecast.strategicRecommendations.map((rec, i) => (
                          <div key={i} className="group p-4 bg-surface-2 hover:bg-surface-3 border border-main-border hover:border-primary/30 rounded-lg transition-all cursor-default">
                             <div className="flex items-start gap-3">
                                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-primary shrink-0 group-hover:scale-125 transition-transform" />
                                <span className="text-[10px] font-mono text-main-text uppercase tracking-tight leading-normal">{rec}</span>
                             </div>
                          </div>
                       ))}
                    </div>
                 </div>

                 <div className="bg-black/60 border border-primary/20 rounded-xl p-6 space-y-4 shadow-[inset_0_0_20px_rgba(var(--color-primary),0.05)]">
                    <div className="flex items-center gap-2">
                       <Activity size={14} className="text-primary" />
                       <span className="text-[10px] font-mono uppercase font-bold text-primary tracking-widest">RealTime_Metrics</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                       <div className="p-3 bg-surface-1 border border-main-border rounded text-center">
                          <p className="text-[8px] font-mono text-main-text-muted uppercase">Avg_Integrity</p>
                          <p className="text-sm font-mono font-bold text-main-text text-primary">92%</p>
                       </div>
                       <div className="p-3 bg-surface-1 border border-main-border rounded text-center">
                          <p className="text-[8px] font-mono text-main-text-muted uppercase">Comms_Sync</p>
                          <p className="text-sm font-mono font-bold text-main-text text-success">Active</p>
                       </div>
                    </div>
                 </div>
              </div>
            </div>
           </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
