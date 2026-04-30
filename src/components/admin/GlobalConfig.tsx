import React, { useState } from 'react';
import { GlobalSettings } from '../../types';
import { Settings as SettingsIcon, Shield, Hourglass, DollarSign, Database, Save, RotateCcw, Activity, ShieldAlert, Fingerprint, Globe, Bell, Terminal, Sparkles, Loader2, Send, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { interpretTacticalDirective, TacticalDirectiveResponse } from '../../geminiService';

interface GlobalConfigProps {
  globalSettings: GlobalSettings;
  setGlobalSettings: (s: GlobalSettings) => void;
  saveSettings: () => Promise<void>;
}

export function GlobalConfig({ globalSettings, setGlobalSettings, saveSettings }: GlobalConfigProps) {
  const [directive, setDirective] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [aiResponse, setAiResponse] = useState<TacticalDirectiveResponse | null>(null);

  const handleDirective = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!directive.trim()) return;

    setIsProcessing(true);
    try {
      const result = await interpretTacticalDirective(directive, globalSettings);
      setAiResponse(result);
      
      // Update local settings based on AI interpretation
      const newSettings = { ...globalSettings };
      if (result.lockdownActive !== undefined) newSettings.lockdownActive = result.lockdownActive;
      if (result.alertLevel !== undefined) newSettings.alertLevel = result.alertLevel;
      
      setGlobalSettings(newSettings);
      setDirective('');
    } catch (e) {
      console.error("AI Directive failed:", e);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-main-border pb-6">
        <div>
          <h2 className="text-xl font-display font-medium text-main-text flex items-center gap-2">
            <SettingsIcon size={20} />
            Global Settings
          </h2>
          <p className="text-sm text-main-text-muted mt-1 font-sans">Core system parameters and organization thresholds.</p>
        </div>
      </div>

      {/* AI Tactical Command Input */}
      <div className="bg-black/40 border border-primary/20 rounded-lg p-6 space-y-4 shadow-[0_0_20px_rgba(var(--color-primary),0.05)]">
         <div className="flex items-center gap-3 mb-2">
            <Terminal size={16} className="text-primary animate-pulse" />
            <h4 className="text-[10px] font-mono uppercase tracking-[0.2em] text-primary font-bold">Tactical_Override_Terminal</h4>
         </div>
         
         <form onSubmit={handleDirective} className="relative">
            <input 
              type="text"
              value={directive}
              onChange={(e) => setDirective(e.target.value)}
              placeholder="Enter directive (e.g., 'Initiate global lockdown' or 'Lower alert to normal')"
              className="w-full bg-surface-1 border border-main-border rounded-lg pl-4 pr-12 py-3 text-xs font-mono text-main-text outline-none focus:border-primary transition-all placeholder:text-main-text-muted/30"
              disabled={isProcessing}
            />
            <button 
              type="submit"
              disabled={isProcessing || !directive.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-primary hover:text-primary-hover disabled:opacity-30 transition-colors"
            >
               {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
         </form>

         <AnimatePresence>
            {aiResponse && (
               <motion.div 
                 initial={{ opacity: 0, y: -10 }}
                 animate={{ opacity: 1, y: 0 }}
                 exit={{ opacity: 0 }}
                 className="p-4 bg-primary/5 border border-primary/20 rounded relative"
               >
                  <button onClick={() => setAiResponse(null)} className="absolute top-2 right-2 text-main-text-muted hover:text-main-text">
                     <X size={10} />
                  </button>
                  <div className="flex items-start gap-3">
                     <Sparkles size={14} className="text-primary mt-0.5 shrink-0" />
                     <div className="space-y-1">
                        <p className="text-[10px] font-mono text-primary font-bold uppercase">Cortex_Response:</p>
                        <p className="text-[11px] font-sans text-main-text italic leading-relaxed">"{aiResponse.systemMessage}"</p>
                        <div className="flex items-center gap-2 mt-2">
                           <span className="text-[8px] font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded uppercase font-bold">Action: {aiResponse.actionTaken}</span>
                        </div>
                     </div>
                  </div>
               </motion.div>
            )}
         </AnimatePresence>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Security & Access Section (Feature 10 & 49) */}
        <div className="bg-surface-1 border border-main-border rounded-md p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShieldAlert size={14} className="text-error" />
              <h4 className="text-[10px] font-mono uppercase tracking-widest text-main-text">Security_Protocols</h4>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[8px] font-mono text-main-text-muted px-1.5 py-0.5 bg-surface-2 border border-main-border rounded">LEVEL_4_AUTH</span>
            </div>
          </div>

          <div className="space-y-4">
             <div className="flex items-center justify-between p-4 bg-surface-2/30 border border-main-border rounded-lg group hover:border-error/30 transition-all">
                <div className="space-y-1">
                   <div className="flex items-center gap-2">
                      <Shield size={12} className={`transition-colors ${globalSettings.lockdownActive ? 'text-error' : 'text-main-text-muted'}`} />
                      <span className="text-[10px] font-mono uppercase text-main-text tracking-wider">Global_Lockdown</span>
                   </div>
                   <p className="text-[8px] font-mono text-main-text-muted uppercase">Restrict access to root admin only.</p>
                </div>
                <button 
                  onClick={() => setGlobalSettings({ ...globalSettings, lockdownActive: !globalSettings.lockdownActive })}
                  className={`w-10 h-5 rounded-full relative transition-all duration-300 ${globalSettings.lockdownActive ? 'bg-error shadow-[0_0_10px_rgba(var(--color-error),0.3)]' : 'bg-surface-3'}`}
                >
                  <motion.div 
                    animate={{ x: globalSettings.lockdownActive ? 20 : 0 }}
                    className={`absolute top-1 left-1 w-3 h-3 rounded-full shadow-sm transition-colors ${globalSettings.lockdownActive ? 'bg-white' : 'bg-main-text-muted'}`} 
                  />
                </button>
             </div>

             <div className="flex items-center justify-between p-4 bg-surface-2/30 border border-main-border rounded-lg group hover:border-primary/30 transition-all">
                <div className="space-y-1">
                   <div className="flex items-center gap-2">
                      <ShieldAlert size={12} className="text-warning" />
                      <span className="text-[10px] font-mono uppercase text-main-text tracking-wider">Alert_Level</span>
                   </div>
                   <p className="text-[8px] font-mono text-main-text-muted uppercase">Global threat environment intensity.</p>
                </div>
                <select 
                  value={globalSettings.alertLevel || 'normal'}
                  onChange={e => setGlobalSettings({ ...globalSettings, alertLevel: e.target.value as any })}
                  className="bg-surface-3 border border-main-border text-[9px] font-mono uppercase p-1 rounded outline-none"
                >
                   <option value="normal">NORMAL</option>
                   <option value="elevated">ELEVATED</option>
                   <option value="critical">CRITICAL</option>
                </select>
             </div>
          </div>
        </div>

        {/* System Intelligence (Phase 1 Items) */}
        <div className="bg-surface-1 border border-main-border rounded-md p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Globe size={14} className="text-info" />
              <h4 className="text-[10px] font-mono uppercase tracking-widest text-main-text">Node_Intelligence</h4>
            </div>
          </div>

          <div className="space-y-4">
             <div className="flex items-center justify-between p-4 bg-surface-2/30 border border-main-border rounded-lg">
                <div className="space-y-1">
                   <div className="flex items-center gap-2">
                      <Bell size={12} className="text-warning" />
                      <span className="text-[10px] font-mono uppercase text-main-text tracking-wider">Smart_Notifications</span>
                   </div>
                   <p className="text-[8px] font-mono text-main-text-muted uppercase">AI-filtered system alerts intensity.</p>
                </div>
                <select className="bg-surface-3 border border-main-border text-[9px] font-mono uppercase p-1 rounded outline-none">
                  <option>Critical_Only</option>
                  <option>Moderate</option>
                  <option>Exhaustive</option>
                </select>
             </div>

             <div className="flex items-center justify-between p-4 bg-surface-2/30 border border-main-border rounded-lg">
                <div className="space-y-1">
                   <div className="flex items-center gap-2">
                      <Database size={12} className="text-success" />
                      <span className="text-[10px] font-mono uppercase text-main-text tracking-wider">Audit_Retention</span>
                   </div>
                   <p className="text-[8px] font-mono text-main-text-muted uppercase">Global log persistence protocol.</p>
                </div>
                <span className="text-[10px] font-mono text-main-text">365_DAYS</span>
             </div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
         <div className="bg-surface-1 border border-main-border rounded-md p-6 space-y-6">
            <div className="flex items-center gap-3">
               <Hourglass size={14} className="text-primary" />
               <h4 className="text-[10px] font-mono uppercase tracking-widest text-main-text">Time Management</h4>
            </div>

            <div className="space-y-4">
               <div className="space-y-1.5">
                  <label className="text-[9px] font-mono uppercase tracking-wider text-main-text-muted">Max Break (Minutes)</label>
                  <input 
                    type="number"
                    value={globalSettings.maxBreakDurationMinutes}
                    onChange={e => setGlobalSettings({ ...globalSettings, maxBreakDurationMinutes: parseInt(e.target.value) || 0 })}
                    className="w-full bg-surface-2 border border-main-border rounded px-4 py-3 text-xl font-mono text-main-text outline-none focus:border-primary transition-colors"
                  />
                  <p className="text-[9px] font-mono text-main-text-muted/70 uppercase">Threshold for real-time alerts.</p>
               </div>
            </div>
         </div>

         <div className="bg-surface-1 border border-main-border rounded-md p-6 space-y-6">
            <div className="flex items-center gap-3">
               <DollarSign size={14} className="text-success" />
               <h4 className="text-[10px] font-mono uppercase tracking-widest text-main-text">Financials</h4>
            </div>

            <div className="space-y-4">
               <div className="space-y-1.5">
                  <label className="text-[9px] font-mono uppercase tracking-wider text-main-text-muted">Hourly Rate ($)</label>
                  <input 
                    type="number"
                    value={globalSettings.defaultHourlyRate}
                    onChange={e => setGlobalSettings({ ...globalSettings, defaultHourlyRate: parseInt(e.target.value) || 0 })}
                    className="w-full bg-surface-2 border border-main-border rounded px-4 py-3 text-xl font-mono text-main-text outline-none focus:border-primary transition-colors"
                  />
                  <p className="text-[9px] font-mono text-main-text-muted/70 uppercase">Base rate for estimations.</p>
               </div>
            </div>
         </div>

         <div className="bg-surface-1 border border-main-border rounded-md p-6 space-y-6">
            <div className="flex items-center gap-3">
               <Activity size={14} className="text-info" />
               <h4 className="text-[10px] font-mono uppercase tracking-widest text-main-text">Localization</h4>
            </div>

            <div className="space-y-4">
               <div className="space-y-1.5">
                  <label className="text-[9px] font-mono uppercase tracking-wider text-main-text-muted">System Timezone</label>
                  <select
                    value={globalSettings.defaultTimezone || ''}
                    onChange={e => setGlobalSettings({ ...globalSettings, defaultTimezone: e.target.value })}
                    className="w-full bg-surface-2 border border-main-border rounded px-4 py-3 text-xs font-mono text-main-text outline-none focus:border-primary transition-colors appearance-none uppercase"
                  >
                    <option value="">System Local</option>
                    {Intl.supportedValuesOf('timeZone').map(tz => (
                      <option key={tz} value={tz}>{tz}</option>
                    ))}
                  </select>
                  <p className="text-[9px] font-mono text-main-text-muted/70 uppercase">Reference for cloud syncs.</p>
               </div>
            </div>
         </div>
      </div>

      <div className="bg-surface-1 border border-main-border rounded-md p-6 space-y-8">
         <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
               <div className="w-10 h-10 bg-surface-2 border border-main-border flex items-center justify-center text-primary">
                  <Database size={18} />
               </div>
               <div>
                  <h4 className="text-sm font-medium text-main-text uppercase tracking-tight">Cloud Synchronizer</h4>
                  <p className="text-[10px] font-mono text-main-text-muted uppercase">Sync local parameters with production cluster.</p>
               </div>
            </div>
            <div className="flex gap-2">
               <button onClick={() => window.location.reload()} className="p-2.5 text-main-text-muted hover:text-main-text transition-colors bg-surface-2 border border-main-border rounded">
                  <RotateCcw size={16} />
               </button>
               <button 
                  onClick={saveSettings}
                  className="px-6 py-2.5 bg-primary hover:bg-primary-hover text-surface-1 rounded font-mono text-[10px] uppercase tracking-widest transition-colors flex items-center gap-2 active:scale-[0.98]"
               >
                  <Save size={14} />
                  <span>Update Cloud Cluster</span>
               </button>
            </div>
         </div>

         <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6 border-t border-main-border">
            {[
              { label: 'Latency', value: '4ms', color: 'text-success' },
              { label: 'Uptime', value: '99.9%', color: 'text-primary' },
              { label: 'Protocol', value: 'WSS/TLS', color: 'text-main-text-muted' },
              { label: 'Cluster', value: 'REGION-A1', color: 'text-main-text-muted/70' }
            ].map((stat, i) => (
              <div key={i} className="bg-surface-2 p-3 rounded border border-main-border">
                 <p className="text-[8px] font-mono uppercase tracking-widest text-main-text-muted mb-1">{stat.label}</p>
                 <p className={`text-[10px] font-mono ${stat.color} tracking-tight`}>{stat.value}</p>
              </div>
            ))}
         </div>
      </div>
    </div>
  );
}
