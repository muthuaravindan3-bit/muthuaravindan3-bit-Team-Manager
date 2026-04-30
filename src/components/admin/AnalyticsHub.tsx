import React, { useState, useEffect } from 'react';
import { GlobalSettings, UserProfile } from '../../types';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { 
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, AreaChart, Area
} from 'recharts';
import { Download, TrendingUp, DollarSign, Clock, Users, ArrowUpRight, BarChart3, PieChartIcon, Sparkles, Shield, AlertTriangle, CheckCircle, Activity, X, Brain, Loader2, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { generateOperationalInsights, OperationalInsight, generateStrategicForecast, StrategicForecast } from '../../geminiService';

interface AnalyticsHubProps {
  analyticsData: {
    pieData: { name: string, value: number }[];
    weeklyData: { day: string, count: number }[];
  };
  payrollData: Record<string, { hours: number, pay: number }>;
  users: UserProfile[];
  globalSettings: GlobalSettings;
  exportShiftsCSV: () => void;
}

const COLORS = ['#F27D26', '#3B82F6', '#10B981', '#6366F1', '#A855F7', '#EF4444', '#F59E0B'];

export function AnalyticsHub({ analyticsData, payrollData, users, globalSettings, exportShiftsCSV }: AnalyticsHubProps) {
  const [projectionData] = useState([
    { time: '08:00', load: 45, capacity: 50 },
    { time: '10:00', load: 78, capacity: 80 },
    { time: '12:00', load: 92, capacity: 85 },
    { time: '14:00', load: 65, capacity: 85 },
    { time: '16:00', load: 40, capacity: 85 },
    { time: '18:00', load: 30, capacity: 50 },
  ]);

  const [wellnessData, setWellnessData] = useState<any[]>([]);
  const [insight, setInsight] = useState<OperationalInsight | null>(null);
  const [forecast, setForecast] = useState<StrategicForecast | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'wellness'), orderBy('timestamp', 'desc'), limit(10));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setWellnessData(snapshot.docs.map(doc => doc.data()));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'wellness');
    });
    return unsubscribe;
  }, []);

  const runAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const data = {
        payroll: payrollData,
        shifts: analyticsData.pieData,
        wellness: wellnessData
      };
      
      const [insightResult, forecastResult] = await Promise.all([
        generateOperationalInsights(data),
        generateStrategicForecast({
          missionsLast30d: 15, // Mocked for now, in real app would be queried
          shiftsServed: Object.values(payrollData).reduce((sum, d) => sum + d.hours, 0),
          incidentCount: 2
        })
      ]);

      setInsight(insightResult);
      setForecast(forecastResult);
    } catch (e) {
      console.error("Analysis failed:", e);
    } finally {
      setIsAnalyzing(false);
    }
  };
  return (
    <div className="space-y-12 pb-20">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-main-border pb-6">
        <div>
          <h2 className="text-xl font-display font-medium text-main-text flex items-center gap-2">
            <BarChart3 size={20} />
            Operations Intelligence
          </h2>
          <p className="text-sm text-main-text-muted mt-1 font-sans">Global resource allocation and financial metrics.</p>
        </div>
        <div className="flex gap-4">
           <button 
             onClick={runAnalysis}
             disabled={isAnalyzing}
             className="px-4 py-2 bg-primary text-black rounded-md transition-all flex items-center gap-2 border border-primary/50 text-[10px] font-mono uppercase tracking-wider font-bold shadow-lg shadow-primary/20 hover:scale-105"
           >
             {isAnalyzing ? <div className="w-3 h-3 border-2 border-black border-t-transparent rounded-full animate-spin" /> : <Sparkles size={14} />}
             {isAnalyzing ? 'Analyzing_Vectors...' : 'Synthesize_Insights'}
           </button>
           <button 
             onClick={exportShiftsCSV}
             className="px-4 py-2 bg-surface-1 hover:bg-surface-2 text-main-text rounded-md transition-colors flex items-center gap-2 border border-main-border text-[10px] font-mono uppercase tracking-wider"
           >
             <Download size={14} />
             Export Dataset
           </button>
        </div>
      </div>

      <AnimatePresence>
        {insight && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="p-8 bg-surface-1 border border-primary/30 rounded-xl space-y-8 relative overflow-hidden"
          >
             <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
             <div className="flex items-start justify-between">
                <div className="space-y-4 max-w-3xl">
                   <div className="flex items-center gap-3">
                      <Shield size={18} className="text-primary" />
                      <h3 className="text-sm font-mono font-bold text-main-text uppercase tracking-widest">Tactical_Intelligence_Report</h3>
                   </div>
                   <p className="text-xs leading-relaxed text-main-text-muted italic">"{insight.summary}"</p>
                </div>
                <div className={`px-4 py-2 rounded-lg border font-mono text-[10px] uppercase tracking-[0.2em] font-bold ${
                  insight.riskLevel === 'high' ? 'border-error text-error bg-error/5' :
                  insight.riskLevel === 'medium' ? 'border-warning text-warning bg-warning/5' :
                  'border-success text-success bg-success/5'
                }`}>
                   Risk_Level::{insight.riskLevel}
                </div>
             </div>

             <div className="grid md:grid-cols-2 gap-8 pt-6 border-t border-main-border">
                <div className="space-y-4">
                   <div className="flex items-center gap-2">
                      <TrendingUp size={14} className="text-primary" />
                      <span className="text-[10px] font-mono uppercase tracking-widest text-main-text">Actionable_Recommendations</span>
                   </div>
                   <div className="space-y-3">
                      {insight.recommendations.map((rec, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 bg-surface-2 border border-main-border rounded-lg group hover:border-primary/30 transition-all">
                           <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 group-hover:scale-125 transition-transform" />
                           <span className="text-[10px] font-mono text-main-text-muted leading-relaxed uppercase tracking-tight">{rec}</span>
                        </div>
                      ))}
                   </div>
                </div>

                <div className="space-y-4">
                   <div className="flex items-center gap-2">
                      <Activity size={14} className="text-primary" />
                      <span className="text-[10px] font-mono uppercase tracking-widest text-main-text">Vector_Diagnostics</span>
                   </div>
                   <div className="p-6 bg-surface-2 border border-main-border rounded-xl flex items-center justify-center min-h-[150px]">
                      <div className="text-center space-y-4">
                         <div className="flex items-center justify-center gap-4">
                            <div className="flex flex-col items-center">
                               <span className="text-2xl font-mono text-main-text">88%</span>
                               <span className="text-[8px] font-mono text-main-text-muted uppercase">Efficiency</span>
                            </div>
                            <div className="w-px h-10 bg-main-border" />
                            <div className="flex flex-col items-center">
                               <span className="text-2xl font-mono text-main-text">12%</span>
                               <span className="text-[8px] font-mono text-main-text-muted uppercase">Latency</span>
                            </div>
                         </div>
                         <p className="text-[8px] font-mono text-main-text-muted uppercase tracking-widest">Confidence Interval: 94.2% // Alpha_Sync: ACTIVE</p>
                      </div>
                   </div>
                </div>
             </div>
             
             <button 
               onClick={() => setInsight(null)}
               className="absolute top-4 right-4 p-2 text-main-text-muted hover:text-main-text"
             >
                <X size={14} />
             </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* KPI Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
         <div className="bg-surface-1 border border-main-border p-6 rounded-md">
            <p className="text-[10px] font-mono uppercase tracking-widest text-main-text-muted mb-4 font-bold">Gross Operational Est.</p>
            <div className="flex items-baseline gap-2">
               <span className="text-main-text-muted/50 font-mono text-xl">$</span>
               <h4 className="text-3xl font-mono text-main-text tracking-tighter">
                  {Object.values(payrollData).reduce((sum, item) => sum + item.pay, 0).toLocaleString()}
               </h4>
            </div>
            <div className="flex items-center gap-2 mt-4 text-primary">
               <TrendingUp size={12} />
               <span className="text-[9px] font-mono uppercase tracking-widest">Rate: ${globalSettings.defaultHourlyRate}/hr</span>
            </div>
         </div>
         <div className="bg-surface-1 border border-main-border p-6 rounded-md">
            <p className="text-[10px] font-mono uppercase tracking-widest text-main-text-muted mb-4 font-bold">Cumulative Man-Hours</p>
            <div className="flex items-baseline gap-2">
               <h4 className="text-3xl font-mono text-main-text tracking-tighter">
                  {Object.values(payrollData).reduce((sum, item) => sum + item.hours, 0).toFixed(0)}
               </h4>
               <span className="text-main-text-muted/50 font-mono text-xl ml-1">HRS</span>
            </div>
            <div className="flex items-center gap-2 mt-4 text-success font-bold">
               <Clock size={12} />
               <span className="text-[9px] font-mono uppercase tracking-widest">Cycle: Standard Pay</span>
            </div>
         </div>
         <div className="bg-surface-1 border border-main-border p-6 rounded-md group relative overflow-hidden">
            <p className="text-[10px] font-mono uppercase tracking-widest text-main-text-muted mb-4 font-bold">Active Entities</p>
            <h4 className="text-3xl font-mono text-main-text tracking-tighter">{users.length}</h4>
            <div className="mt-6 flex gap-1 relative z-10">
               {users.slice(0, 8).map((u, i) => (
                  <div key={i} className="w-5 h-5 rounded bg-surface-2 border border-main-border flex items-center justify-center text-[8px] font-mono text-main-text-muted">
                     {(u.displayName || u.email || '?').charAt(0).toUpperCase()}
                  </div>
               ))}
               {users.length > 8 && <div className="w-5 h-5 rounded bg-primary/10 border border-primary/20 flex items-center justify-center text-[7px] font-mono text-primary">+{users.length - 8}</div>}
            </div>
         </div>
         <div className="bg-surface-1 border border-main-border p-6 rounded-md border-l-2 border-l-primary">
            <p className="text-[10px] font-mono uppercase tracking-widest text-main-text-muted mb-4 font-bold">Performance Index</p>
            <div className="flex items-baseline gap-1">
               <h4 className="text-3xl font-mono text-primary tracking-tighter">94.2</h4>
               <span className="text-[10px] font-mono text-primary/50">%</span>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <div className="flex -space-x-2">
                {[1,2,3].map(i => (
                  <div key={i} className="w-5 h-5 rounded-full bg-surface-2 border border-main-border flex items-center justify-center text-[7px] font-mono">MVP</div>
                ))}
              </div>
              <span className="text-[8px] font-mono text-main-text-muted uppercase">Elite Tier Personnel</span>
            </div>
         </div>
      </div>

      {/* Main Charts Area */}
      <div className="grid lg:grid-cols-2 gap-8">
        <div className="bg-surface-1 border border-main-border p-6 rounded-md space-y-6">
           <div className="flex items-center gap-3">
              <PieChartIcon size={14} className="text-warning" />
              <h4 className="text-[10px] font-mono uppercase tracking-widest text-main-text">Shift Distribution</h4>
           </div>

           <div className="h-[300px] flex items-center justify-center relative">
              <ResponsiveContainer width="100%" height="100%">
                 <PieChart>
                    <Pie
                       data={analyticsData.pieData}
                       innerRadius={70}
                       outerRadius={100}
                       paddingAngle={4}
                       dataKey="value"
                       stroke="none"
                    >
                       {analyticsData.pieData.map((_entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                       ))}
                    </Pie>
                    <RechartsTooltip 
                       contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #222', borderRadius: '4px' }}
                       itemStyle={{ fontSize: '9px', color: '#fff', fontWeight: 'bold', textTransform: 'uppercase', fontFamily: '"JetBrains Mono", monospace' }}
                    />
                 </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                 <p className="text-[8px] font-mono uppercase tracking-widest text-main-text-muted">Patterns</p>
                 <h5 className="text-xl font-mono text-main-text">{analyticsData.pieData.length}</h5>
              </div>
           </div>

           <div className="flex flex-wrap gap-2 justify-center">
              {analyticsData.pieData.map((d, index) => (
                 <div key={d.name} className="flex items-center gap-2 bg-surface-2 px-2 py-1 rounded border border-main-border">
                    <div className="w-1 h-1 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                    <span className="text-[9px] font-mono uppercase text-main-text-muted">{d.name}</span>
                    <span className="text-[9px] font-mono text-main-text/50 ml-1">{d.value}</span>
                 </div>
              ))}
           </div>
        </div>

        <div className="bg-surface-1 border border-main-border p-6 rounded-md space-y-6">
           <div className="flex items-center gap-3">
              <BarChart3 size={14} className="text-primary" />
              <h4 className="text-[10px] font-mono uppercase tracking-widest text-main-text">Sequence Flow</h4>
           </div>

           <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={analyticsData.weeklyData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1a1a1a" />
                    <XAxis 
                       dataKey="day" 
                       axisLine={false} 
                       tickLine={false} 
                       tick={{ fontSize: 9, fill: '#666', fontFamily: '"JetBrains Mono", monospace' }} 
                       dy={10}
                    />
                    <YAxis 
                       axisLine={false} 
                       tickLine={false} 
                       tick={{ fontSize: 9, fill: '#666', fontFamily: '"JetBrains Mono", monospace' }} 
                    />
                    <RechartsTooltip cursor={{ fill: 'rgba(255,255,255,0.02)' }} contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #222', borderRadius: '4px' }} />
                    <Bar dataKey="count" fill="#ededed" radius={[2, 2, 0, 0]} />
                 </BarChart>
              </ResponsiveContainer>
           </div>
        </div>
      </div>

      {/* AI Insights & Projections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
         <motion.div 
           initial={{ opacity: 0, x: -20 }}
           animate={{ opacity: 1, x: 0 }}
           className="bg-surface-1 border border-main-border rounded-xl p-6 space-y-6"
         >
            <div className="flex items-center justify-between">
               <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg border border-primary/20">
                     <Brain size={18} className="text-primary" />
                  </div>
                  <h3 className="font-display font-medium text-main-text uppercase tracking-tight">Cortex_Analytics_Synthesis</h3>
               </div>
               <button 
                 onClick={runAnalysis}
                 disabled={isAnalyzing}
                 className="px-4 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary text-[9px] font-mono uppercase tracking-[0.2em] rounded border border-primary/20 transition-all flex items-center gap-2 group"
               >
                  {isAnalyzing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} className="group-hover:animate-pulse" />}
                  {isAnalyzing ? 'Processing...' : 'Run_Synthesis'}
               </button>
            </div>

            {insight ? (
              <div className="space-y-6">
                 <div className="p-4 bg-surface-2 border border-main-border rounded-lg relative overflow-hidden group">
                    <div className={`absolute top-0 right-0 w-24 h-24 -mr-12 -mt-12 blur-3xl opacity-20 pointer-events-none transition-colors ${
                       insight.riskLevel === 'high' ? 'bg-error' : insight.riskLevel === 'medium' ? 'bg-warning' : 'bg-success'
                    }`} />
                    <div className="flex justify-between items-start mb-3">
                       <span className="text-[10px] font-mono text-primary uppercase font-bold tracking-widest">Executive_Summary</span>
                       <span className={`px-2 py-0.5 rounded text-[8px] font-mono uppercase font-bold border ${
                          insight.riskLevel === 'high' ? 'border-error text-error bg-error/5' :
                          insight.riskLevel === 'medium' ? 'border-warning text-warning bg-warning/5' :
                          'border-success text-success bg-success/5'
                       }`}>{insight.riskLevel}_Threat_Vector</span>
                    </div>
                    <p className="text-[11px] font-sans text-main-text italic leading-relaxed">"{insight.summary}"</p>
                 </div>

                 <div className="space-y-3">
                    <h4 className="text-[9px] font-mono text-main-text-muted uppercase tracking-[0.3em]">Actionable_Intelligence</h4>
                    <div className="grid gap-2">
                       {insight.recommendations.map((rec, i) => (
                          <motion.div 
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.1 }}
                            key={i} 
                            className="p-3 bg-surface-2 border border-main-border rounded-lg flex items-start gap-3 group hover:border-primary/50 transition-all"
                          >
                             <div className="mt-1 w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                             <p className="text-[10px] font-mono text-main-text uppercase tracking-tight leading-relaxed">{rec}</p>
                          </motion.div>
                       ))}
                    </div>
                 </div>
              </div>
            ) : (
              <div className="py-20 text-center space-y-4 opacity-40">
                 <Activity size={40} className="mx-auto text-main-text-muted" />
                 <p className="text-[10px] font-mono uppercase tracking-[0.3em]">Awaiting Data Synthesis Command</p>
              </div>
            )}
         </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-surface-1 border border-main-border rounded-xl p-6 space-y-6"
          >
             <div className="flex items-center gap-3">
                <div className="p-2 bg-secondary/10 rounded-lg border border-secondary/20">
                   <Zap size={18} className="text-secondary" />
                </div>
                <h3 className="font-display font-medium text-main-text uppercase tracking-tight">Strategic_Forecast_Matrix</h3>
             </div>

             <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                   <div className="p-4 bg-surface-2 border border-main-border rounded-lg space-y-2">
                      <span className="text-[8px] font-mono text-main-text-muted uppercase tracking-widest">Projection_Vector</span>
                      <div className="flex items-center justify-between">
                         <span className="text-sm font-mono font-bold text-secondary uppercase tracking-tight">{forecast?.workloadProjection || 'calculating...'}</span>
                         {forecast?.workloadProjection === 'increasing' ? <TrendingUp size={14} className="text-error" /> : <ArrowUpRight size={14} className="text-success" />}
                      </div>
                   </div>
                   <div className="p-4 bg-surface-2 border border-main-border rounded-lg space-y-2">
                      <span className="text-[8px] font-mono text-main-text-muted uppercase tracking-widest">Bottleneck_Node</span>
                      <div className="flex items-center justify-between">
                         <span className="text-sm font-mono font-bold text-warning truncate max-w-[100px]">{forecast?.resourceBottleneck || 'Scanning...'}</span>
                         <AlertTriangle size={14} className="text-warning" />
                      </div>
                   </div>
                </div>

                <div className="p-5 bg-secondary/5 border border-secondary/20 rounded-xl space-y-4">
                   <div className="h-32 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                         <AreaChart data={projectionData}>
                            <defs>
                               <linearGradient id="colorLoad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="var(--color-secondary)" stopOpacity={0.3}/>
                                  <stop offset="95%" stopColor="var(--color-secondary)" stopOpacity={0}/>
                               </linearGradient>
                            </defs>
                            <XAxis dataKey="time" hide />
                            <YAxis hide />
                            <Area type="monotone" dataKey="load" stroke="var(--color-secondary)" fillOpacity={1} fill="url(#colorLoad)" />
                         </AreaChart>
                      </ResponsiveContainer>
                   </div>
                   <p className="text-[10px] font-mono text-main-text-muted leading-relaxed uppercase tracking-tighter text-center">
                     {forecast ? `Burnout Risk: ${forecast.burnoutRiskTimeline}` : 'AI_Projection: Estimated Operational Intensity Vector'}
                   </p>
                </div>

                <div className="flex items-center justify-between p-3 bg-surface-2 border border-main-border rounded text-[9px] font-mono uppercase text-main-text-muted">
                   <span>Strategic_Recommendations</span>
                   <span className="text-secondary font-bold">{forecast?.strategicRecommendations.length || 0} Nodes</span>
                </div>
                
                {forecast && forecast.strategicRecommendations.length > 0 && (
                  <div className="space-y-2">
                    {forecast.strategicRecommendations.slice(0, 2).map((rec, i) => (
                      <div key={i} className="text-[9px] font-mono text-main-text-muted p-2 bg-black/20 border border-main-border rounded italic">
                        " {rec} "
                      </div>
                    ))}
                  </div>
                )}
             </div>
          </motion.div>
      </div>

      {/* Financial Table */}
      <div className="bg-surface-1 border border-main-border rounded-md overflow-hidden">
         <div className="p-6 border-b border-main-border flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
               <h4 className="text-sm font-medium text-main-text uppercase tracking-tight">Financial Reconciliation</h4>
               <p className="text-[10px] font-mono uppercase text-main-text-muted mt-1">Resource calculations against base organizational rates.</p>
            </div>
            <div className="flex gap-4">
               <div className="px-3 py-1.5 bg-surface-2 border border-main-border rounded flex items-center gap-2">
                  <span className="text-[9px] font-mono uppercase text-main-text-muted">Base Rate:</span>
                  <span className="text-[10px] font-mono text-main-text">${globalSettings.defaultHourlyRate}/HR</span>
               </div>
            </div>
         </div>

         <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left">
               <thead>
                  <tr className="text-[9px] font-mono uppercase tracking-widest text-main-text-muted bg-surface-2">
                     <th className="px-6 py-4">Personnel</th>
                     <th className="px-6 py-4">Temporal Load</th>
                     <th className="px-6 py-4">Estimated Pay</th>
                     <th className="px-6 py-4 text-right">Accounting Status</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-main-border">
                  {Object.entries(payrollData).map(([uid, data], index) => {
                     const user = users.find(u => u.uid === uid);
                     return (
                        <motion.tr 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: index * 0.02 }}
                          key={uid} 
                          className="group hover:bg-surface-2 transition-colors"
                        >
                           <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                 <div className="w-8 h-8 rounded bg-surface-2 border border-main-border flex items-center justify-center font-mono text-xs text-main-text-muted group-hover:text-main-text">
                                    {(user?.displayName || '?').charAt(0).toUpperCase()}
                                 </div>
                                 <span className="text-xs text-main-text uppercase tracking-tight">{user?.displayName || 'Legacy Profile'}</span>
                              </div>
                           </td>
                           <td className="px-6 py-4">
                              <span className="text-[10px] font-mono text-main-text uppercase">{data.hours.toFixed(1)} HRS</span>
                           </td>
                           <td className="px-6 py-4">
                              <span className="text-[10px] font-mono text-success uppercase tracking-tighter">${data.pay.toFixed(2)}</span>
                           </td>
                           <td className="px-6 py-4 text-right">
                              <span className="text-[9px] font-mono uppercase text-main-text-muted border border-main-border px-2 py-0.5 rounded">
                                 Awaiting Audit
                              </span>
                           </td>
                        </motion.tr>
                     );
                  })}
               </tbody>
            </table>
         </div>
      </div>
    </div>
  );
}
