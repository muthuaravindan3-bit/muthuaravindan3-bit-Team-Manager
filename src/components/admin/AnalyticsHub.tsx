import React from 'react';
import { GlobalSettings, UserProfile } from '../../types';
import { 
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
} from 'recharts';
import { Download, TrendingUp, DollarSign, Clock, Users, ArrowUpRight, BarChart3, PieChartIcon } from 'lucide-react';
import { motion } from 'motion/react';

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
  return (
    <div className="space-y-10 pb-20">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-white/5 pb-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-white mb-2">Operations Intelligence</h1>
          <p className="text-slate-400 font-medium">Global resource allocation and financial estimations.</p>
        </div>
        <div className="flex gap-4">
           <button 
             onClick={exportShiftsCSV}
             className="px-5 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl transition-all flex items-center gap-2.5 border border-white/5 text-xs font-bold uppercase tracking-wider"
           >
             <Download size={16} className="text-slate-500" />
             Export Dataset
           </button>
        </div>
      </div>

      {/* KPI Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="bg-zinc-900 border border-white/5 p-8 rounded-3xl shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-4">Gross Operational Est.</p>
            <div className="flex items-baseline gap-2">
               <span className="text-slate-700 font-bold text-2xl tracking-tighter">$</span>
               <h4 className="text-5xl font-bold text-white tracking-tighter">
                  {Object.values(payrollData).reduce((sum, item) => sum + item.pay, 0).toLocaleString()}
               </h4>
            </div>
            <div className="flex items-center gap-2 mt-6 text-indigo-400">
               <TrendingUp size={14} />
               <span className="text-[10px] font-bold uppercase tracking-widest">Rate: ${globalSettings.defaultHourlyRate}/hr</span>
            </div>
         </div>
         <div className="bg-zinc-900 border border-white/5 p-8 rounded-3xl shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-4">Cumulative Man-Hours</p>
            <div className="flex items-baseline gap-2">
               <h4 className="text-5xl font-bold text-white tracking-tighter">
                  {Object.values(payrollData).reduce((sum, item) => sum + item.hours, 0).toFixed(0)}
               </h4>
               <span className="text-slate-700 font-bold text-2xl tracking-tighter">Hrs</span>
            </div>
            <div className="flex items-center gap-2 mt-6 text-emerald-500">
               <Clock size={14} />
               <span className="text-[10px] font-bold uppercase tracking-widest">Cycle: Standard Pay</span>
            </div>
         </div>
         <div className="bg-zinc-900 border border-white/5 p-8 rounded-3xl group overflow-hidden shadow-sm">
            <div className="absolute -right-2 -bottom-2 opacity-5 group-hover:scale-105 transition-transform">
               <Users size={100} />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-4">Total Active Entities</p>
            <h4 className="text-5xl font-bold text-white tracking-tighter">{users.length}</h4>
            <div className="mt-8 flex gap-1">
               {users.slice(0, 5).map((u, i) => (
                  <div key={i} className="w-8 h-8 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-[10px] font-bold text-slate-500">
                     {(u.displayName || u.email || '?').charAt(0).toUpperCase()}
                  </div>
               ))}
               {users.length > 5 && <div className="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center text-[8px] font-bold text-indigo-400">+{users.length - 5}</div>}
            </div>
         </div>
      </div>

      {/* Main Charts Area */}
      <div className="grid lg:grid-cols-2 gap-10">
        <div className="bg-zinc-900 border border-white/5 p-8 rounded-3xl space-y-8 shadow-sm">
           <div className="flex items-center gap-4">
              <div className="p-2.5 bg-amber-500/10 rounded-xl text-amber-500">
                 <PieChartIcon size={20} />
              </div>
              <h4 className="text-sm font-bold text-white tracking-tight">Shift Distribution</h4>
           </div>

           <div className="h-[340px] flex items-center justify-center relative">
              <ResponsiveContainer width="100%" height="100%">
                 <PieChart>
                    <Pie
                       data={analyticsData.pieData}
                       innerRadius={80}
                       outerRadius={120}
                       paddingAngle={8}
                       dataKey="value"
                       stroke="none"
                    >
                       {analyticsData.pieData.map((_entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} opacity={0.8} />
                       ))}
                    </Pie>
                    <RechartsTooltip 
                       contentStyle={{ backgroundColor: '#18181b', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '1rem' }}
                       itemStyle={{ fontSize: '10px', color: '#fff', fontWeight: 'bold', textTransform: 'uppercase' }}
                    />
                 </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                 <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600">Total Patterns</p>
                 <h5 className="text-2xl font-bold text-white">{analyticsData.pieData.length} Type</h5>
              </div>
           </div>

           <div className="flex flex-wrap gap-4 justify-center">
              {analyticsData.pieData.map((d, index) => (
                 <div key={d.name} className="flex items-center space-x-2 bg-black/20 px-3 py-1.5 rounded-xl border border-white/5">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                    <span className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">{d.name}</span>
                    <span className="text-[10px] font-mono text-slate-600 ml-1">{d.value}</span>
                 </div>
              ))}
           </div>
        </div>

        <div className="bg-zinc-900 border border-white/5 p-8 rounded-3xl space-y-8 shadow-sm">
           <div className="flex items-center gap-4">
              <div className="p-2.5 bg-indigo-500/10 rounded-xl text-indigo-500">
                 <BarChart3 size={20} />
              </div>
              <h4 className="text-sm font-bold text-white tracking-tight">Weekly Sequence Flow</h4>
           </div>

           <div className="h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={analyticsData.weeklyData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                    <XAxis 
                       dataKey="day" 
                       axisLine={false} 
                       tickLine={false} 
                       tick={{ fontSize: 10, fontWeight: 'bold', fill: 'rgba(255,255,255,0.3)' }} 
                       dy={10}
                    />
                    <YAxis 
                       axisLine={false} 
                       tickLine={false} 
                       tick={{ fontSize: 10, fontWeight: 'bold', fill: 'rgba(255,255,255,0.3)' }} 
                    />
                    <RechartsTooltip cursor={{ fill: 'rgba(255,255,255,0.02)' }} contentStyle={{ backgroundColor: '#18181b', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '1rem' }} />
                    <Bar dataKey="count" fill="url(#barGradient)" radius={[6, 6, 0, 0]} />
                    <defs>
                       <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#6366F1" />
                          <stop offset="100%" stopColor="#4338CA" />
                       </linearGradient>
                    </defs>
                 </BarChart>
              </ResponsiveContainer>
           </div>
        </div>
      </div>

      {/* Financial Table */}
      <div className="bg-zinc-900 border border-white/5 rounded-[2rem] overflow-hidden shadow-sm">
         <div className="p-8 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
               <h4 className="text-lg font-bold text-white">Financial Reconciliation</h4>
               <p className="text-xs font-medium text-slate-500">Resource calculations based on standard hourly rates.</p>
            </div>
            <div className="flex gap-4">
               <div className="px-5 py-2.5 bg-black/40 border border-white/5 rounded-xl flex items-center gap-3">
                  <span className="text-[10px] font-bold uppercase text-slate-600 tracking-widest">Base Rate:</span>
                  <span className="text-xs font-bold text-white">${globalSettings.defaultHourlyRate}/hr</span>
               </div>
            </div>
         </div>

         <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left">
               <thead>
                  <tr className="text-[10px] font-bold uppercase tracking-widest text-slate-500 bg-black/20">
                     <th className="px-8 py-5">Personnel</th>
                     <th className="px-8 py-5">Temporal Load</th>
                     <th className="px-8 py-5">Estimated Pay</th>
                     <th className="px-8 py-5 text-right">Accounting Status</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-white/5">
                  {Object.entries(payrollData).map(([uid, data], index) => {
                     const user = users.find(u => u.uid === uid);
                     return (
                        <motion.tr 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: index * 0.02 }}
                          key={uid} 
                          className="group hover:bg-white/[0.01] transition-colors"
                        >
                           <td className="px-8 py-6">
                              <div className="flex items-center gap-4">
                                 <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center font-bold text-slate-700">
                                    {(user?.displayName || '?').charAt(0).toUpperCase()}
                                 </div>
                                 <span className="font-bold text-sm text-slate-300 group-hover:text-white transition-colors">{user?.displayName || 'Legacy Profile'}</span>
                              </div>
                           </td>
                           <td className="px-8 py-6">
                              <span className="text-xs font-bold text-slate-500 tracking-tight">{data.hours.toFixed(1)} HRS</span>
                           </td>
                           <td className="px-8 py-6">
                              <div className="flex items-center gap-1.5">
                                 <h5 className="text-lg font-bold text-emerald-500 tracking-tight">${data.pay.toFixed(2)}</h5>
                              </div>
                           </td>
                           <td className="px-8 py-6 text-right">
                              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/40 border border-white/5 text-[9px] font-bold uppercase tracking-widest text-slate-500">
                                 Awaiting Audit
                              </div>
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
