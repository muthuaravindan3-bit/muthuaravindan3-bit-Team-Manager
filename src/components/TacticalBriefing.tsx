import React, { useState, useEffect } from 'react';
import { Shield, Radio, Activity, Zap, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { generateTacticalBriefing, TacticalBriefing as TacticalBriefingType } from '../geminiService';
import { collection, query, where, getDocs, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

export function TacticalBriefing() {
  const [briefing, setBriefing] = useState<TacticalBriefingType | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now());

  const fetchBriefing = async () => {
    setLoading(true);
    try {
      // Get some context for the AI
      const missionsSnap = await getDocs(collection(db, 'missions'));
      const activeMissions = missionsSnap.docs.filter(d => d.data().status === 'active').length;
      
      const wellnessSnap = await getDocs(query(collection(db, 'wellness'), limit(20)));
      const avgWellness = wellnessSnap.docs.reduce((acc, d) => acc + (d.data().score || 0), 0) / (wellnessSnap.docs.length || 1);
      
      const announcementsSnap = await getDocs(query(collection(db, 'announcements'), where('priority', '==', 'urgent'), limit(3)));
      const urgent = announcementsSnap.docs.map(d => d.data().content);

      // Estimate on-duty based on local knowledge (simplified)
      const onDutyCount = 5; // Placeholder or calculate from shifts if available

      const result = await generateTacticalBriefing({
        activeMissions,
        onDutyCount,
        avgWellness: avgWellness / 10,
        urgentAnnouncements: urgent
      });

      setBriefing(result);
      setLastUpdate(Date.now());
    } catch (e) {
      console.error("Briefing failed:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBriefing();
    // Auto refresh every 10 minutes
    const interval = setInterval(fetchBriefing, 600000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-surface-2 border border-main-border rounded-xl overflow-hidden shadow-2xl relative group">
      <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-primary/50 to-transparent animate-shimmer" />
      
      <div className="p-4 border-b border-main-border bg-surface-1 flex items-center justify-between">
         <div className="flex items-center gap-3">
            <Radio size={16} className="text-primary animate-pulse" />
            <span className="text-[10px] font-mono font-bold text-main-text uppercase tracking-[0.2em]">CORTEX_TACTICAL_FEED</span>
         </div>
         <button 
           onClick={fetchBriefing}
           disabled={loading}
           className="text-[8px] font-mono text-main-text-muted hover:text-primary uppercase tracking-widest transition-colors flex items-center gap-1"
         >
           {loading ? <Activity size={10} className="animate-spin" /> : <Sparkles size={10} />}
           {loading ? 'Decrypting...' : 'Sync_Feed'}
         </button>
      </div>

      <div className="p-6 relative">
         <AnimatePresence mode="wait">
           {loading ? (
             <motion.div 
               key="loading"
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               className="space-y-4"
             >
                <div className="h-4 w-2/3 bg-surface-3 rounded animate-pulse" />
                <div className="space-y-2">
                   <div className="h-3 w-full bg-surface-3 rounded animate-pulse" />
                   <div className="h-3 w-5/6 bg-surface-3 rounded animate-pulse" />
                </div>
             </motion.div>
           ) : briefing ? (
             <motion.div 
               key="content"
               initial={{ opacity: 0, y: 10 }}
               animate={{ opacity: 1, y: 0 }}
               className="space-y-6"
             >
                <div className="space-y-1">
                   <h3 className="text-sm font-display font-medium text-main-text uppercase tracking-tight leading-tight">
                     {briefing.headline}
                   </h3>
                   <p className="text-[10px] font-mono text-primary/80 uppercase tracking-widest font-bold">
                     Status: {briefing.personnelMorale}
                   </p>
                </div>

                <p className="text-xs text-main-text-muted leading-relaxed italic border-l-2 border-primary/20 pl-4 py-1">
                  "{briefing.situationReport}"
                </p>

                {briefing.criticalAlerts && briefing.criticalAlerts.length > 0 && (
                  <div className="space-y-2">
                     <div className="flex items-center gap-2 text-error">
                        <Zap size={10} />
                        <span className="text-[8px] font-mono uppercase tracking-widest font-bold">Critical_Intelligence</span>
                     </div>
                     <div className="grid gap-2">
                        {briefing.criticalAlerts.map((alert, i) => (
                           <div key={i} className="text-[9px] font-mono text-main-text bg-error/5 border border-error/10 p-2 rounded-sm uppercase tracking-tighter">
                              {alert}
                           </div>
                        ))}
                     </div>
                  </div>
                )}
             </motion.div>
           ) : null}
         </AnimatePresence>
      </div>

      <div className="px-6 py-3 bg-surface-1 border-t border-main-border flex justify-between items-center">
         <span className="text-[8px] font-mono text-main-text-muted/40 uppercase">Kernel_Ref: {lastUpdate}</span>
         <div className="flex gap-1">
            <div className={`w-1 h-1 rounded-full ${loading ? 'bg-primary animate-ping' : 'bg-success'}`} />
            <div className="w-1 h-1 rounded-full bg-main-text-muted/20" />
            <div className="w-1 h-1 rounded-full bg-main-text-muted/20" />
         </div>
      </div>
    </div>
  );
}
