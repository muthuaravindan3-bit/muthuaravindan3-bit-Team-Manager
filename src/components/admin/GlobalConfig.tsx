import React from 'react';
import { GlobalSettings } from '../../types';
import { Settings as SettingsIcon, Shield, Hourglass, DollarSign, Database, Save, RotateCcw, Activity } from 'lucide-react';
import { motion } from 'motion/react';

interface GlobalConfigProps {
  globalSettings: GlobalSettings;
  setGlobalSettings: (s: GlobalSettings) => void;
  saveSettings: () => Promise<void>;
}

export function GlobalConfig({ globalSettings, setGlobalSettings, saveSettings }: GlobalConfigProps) {
  return (
    <div className="space-y-10 max-w-4xl pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-white/5 pb-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-white mb-2">Global Configuration</h1>
          <p className="text-slate-400 font-medium">Core system parameters and organizational thresholds.</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
         <div className="bg-zinc-900 border border-white/5 p-8 rounded-3xl space-y-8 shadow-sm">
            <div className="flex items-center gap-4">
               <div className="p-2.5 bg-indigo-500/10 rounded-xl text-indigo-400">
                  <Hourglass size={20} />
               </div>
               <div className="space-y-0.5">
                  <h4 className="text-sm font-bold text-white tracking-tight">Time Management</h4>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600">Operational limits</p>
               </div>
            </div>

            <div className="space-y-6">
               <div className="space-y-2.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-2">Max Break Duration (Minutes)</label>
                  <div className="relative">
                     <input 
                       type="number"
                       value={globalSettings.maxBreakDurationMinutes}
                       onChange={e => setGlobalSettings({ ...globalSettings, maxBreakDurationMinutes: parseInt(e.target.value) || 0 })}
                       className="w-full bg-black/20 border border-white/5 rounded-2xl px-6 py-4 text-2xl font-bold text-white outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                     />
                  </div>
                  <p className="text-[10px] font-medium text-slate-600 px-2 italic line-clamp-1">System highlights personnel exceeding this duration in real-time.</p>
               </div>
            </div>
         </div>

         <div className="bg-zinc-900 border border-white/5 p-8 rounded-3xl space-y-8 shadow-sm">
            <div className="flex items-center gap-4">
               <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-500">
                  <DollarSign size={20} />
               </div>
               <div className="space-y-0.5">
                  <h4 className="text-sm font-bold text-white tracking-tight">Financial Parameters</h4>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600">Payroll calculations</p>
               </div>
            </div>

            <div className="space-y-6">
               <div className="space-y-2.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-2">Default Hourly Rate ($)</label>
                  <div className="relative">
                     <input 
                       type="number"
                       value={globalSettings.defaultHourlyRate}
                       onChange={e => setGlobalSettings({ ...globalSettings, defaultHourlyRate: parseInt(e.target.value) || 0 })}
                       className="w-full bg-black/20 border border-white/5 rounded-2xl px-6 py-4 text-2xl font-bold text-white outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                     />
                  </div>
                  <p className="text-[10px] font-medium text-slate-600 px-2 italic line-clamp-1">Base rate applied for automated payroll estimations.</p>
               </div>
            </div>
         </div>
      </div>

      <div className="bg-zinc-900 border border-white/5 p-10 rounded-[2.5rem] space-y-8 shadow-md">
         <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
            <div className="flex items-center gap-6">
               <div className="p-4 bg-indigo-600/10 rounded-2xl text-indigo-400">
                  <Database size={24} />
               </div>
               <div>
                  <h4 className="text-xl font-bold text-white tracking-tight">Central Data Sync</h4>
                  <p className="text-sm font-medium text-slate-500">Synchronize local configuration changes with the cloud database.</p>
               </div>
            </div>
            <div className="flex gap-4">
               <button onClick={() => window.location.reload()} className="p-4 text-slate-500 hover:text-white transition-colors bg-white/5 rounded-2xl">
                  <RotateCcw size={20} />
               </button>
               <button 
                  onClick={saveSettings}
                  className="px-10 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-xs uppercase tracking-widest transition-all shadow-xl shadow-indigo-600/20 flex items-center gap-3 active:scale-95"
               >
                  <Save size={18} />
                  <span>Update Cloud Config</span>
               </button>
            </div>
         </div>

         <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-8 border-t border-white/5">
            {[
              { label: 'Latency', value: '4ms', color: 'text-emerald-500' },
              { label: 'Cloud Status', value: '99.9%', color: 'text-indigo-400' },
              { label: 'Protocol', value: 'WSS/SSL', color: 'text-slate-400' },
              { label: 'Region', value: 'GCP-North', color: 'text-slate-500' }
            ].map((stat, i) => (
              <div key={i} className="bg-black/20 p-4 rounded-2xl border border-white/5">
                 <p className="text-[9px] font-bold uppercase tracking-widest text-slate-600 mb-1">{stat.label}</p>
                 <p className={`text-xs font-bold ${stat.color} tracking-tight`}>{stat.value}</p>
              </div>
            ))}
         </div>
      </div>
    </div>
  );
}
