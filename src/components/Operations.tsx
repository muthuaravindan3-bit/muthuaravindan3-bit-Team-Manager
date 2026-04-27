import React, { useState } from 'react';
import { LiveRoster } from './LiveRoster';
import { Breaks } from './Breaks';
import { Activity, Coffee, ListFilter } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function Operations() {
  const [activeSubTab, setActiveSubTab] = useState<'live' | 'breaks'>('live');

  return (
    <div className="space-y-8">
      {/* Sub-navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 bg-zinc-900/50 border border-white/5 p-4 rounded-[2rem]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600/10 rounded-xl flex items-center justify-center text-indigo-400">
            <Activity size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Team Operations</h1>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Real-time Pulse & Tracking</p>
          </div>
        </div>

        <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
          <button 
            onClick={() => setActiveSubTab('live')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
              activeSubTab === 'live' 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <Activity size={14} />
            Live Roster
          </button>
          <button 
            onClick={() => setActiveSubTab('breaks')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
              activeSubTab === 'breaks' 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <Coffee size={14} />
            Break Logs
          </button>
        </div>
      </div>

      <motion.div
        key={activeSubTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {activeSubTab === 'live' ? <LiveRoster /> : <Breaks />}
      </motion.div>
    </div>
  );
}
