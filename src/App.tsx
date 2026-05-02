/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import { TimezoneProvider } from './TimezoneContext';
import { TopNavigation } from './components/Navigation';
import { Dashboard } from './components/Dashboard';
import { Leaves } from './components/Leaves';
import { Operations } from './components/Operations';
import { Troubleshooter } from './components/Troubleshooter';
import { AdminPanel } from './components/AdminPanel';
import { SystemGuardian } from './components/SystemGuardian';
import { ShiftSwap } from './components/ShiftSwap';
import { TeamChat } from './components/TeamChat';
import { AIChat } from './components/AIChat';
import { UserSettings } from './components/UserSettings';
import { LogIn, Database, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

function LandingPage() {
  const { signIn } = useAuth();
  
  return (
    <div className="min-h-screen bg-surface-1 flex items-center justify-center p-6 lg:p-12 relative overflow-hidden font-sans">
      {/* Heavy Neon Glow Effects */}
      <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-[0.05] top-0 left-0 pointer-events-none mix-blend-overlay"></div>
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-primary/20 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-secondary/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute top-[20%] right-[20%] w-[30%] h-[30%] bg-info/10 blur-[100px] rounded-full pointer-events-none" />
      
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="max-w-5xl w-full text-center relative z-10 space-y-10"
      >
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="inline-flex items-center space-x-2 bg-surface-2/80 backdrop-blur-md border border-primary/30 text-primary px-5 py-2 rounded-full shadow-[0_0_15px_rgba(0,240,255,0.2)]"
        >
          <Sparkles size={16} className="animate-pulse" />
          <span className="text-xs font-mono font-bold tracking-[0.2em] uppercase">System Override V.2026</span>
        </motion.div>
        
        <h1 className="text-5xl sm:text-7xl lg:text-8xl font-display font-bold tracking-tight text-main-text leading-[1.1] text-shadow-lg">
          Sync Your <span className="text-transparent bg-clip-text bg-gradient-to-br from-primary via-info to-secondary">Workforce</span>
          <br/>
          In Real Time.
        </h1>
        
        <p className="text-lg md:text-xl text-main-text-muted max-w-3xl mx-auto font-mono leading-relaxed tracking-wide">
          The ultimate grid for staff scheduling, anomaly troubleshooting, and autonomous shift matrix matching. Dive into the datastream.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-8">
          <button 
            onClick={signIn}
            className="group w-full sm:w-auto px-10 py-5 bg-primary text-black rounded-lg font-mono font-bold text-base tracking-[0.2em] uppercase hover:bg-primary-hover active:scale-[0.98] transition-all shadow-[0_0_30px_rgba(0,240,255,0.4)] flex items-center justify-center gap-4 relative overflow-hidden"
          >
            <div className="absolute inset-0 w-full h-full bg-white/20 group-hover:translate-x-full transition-transform duration-500 ease-out -translate-x-full skew-x-12" />
            <LogIn size={22} />
            Initialize Link
          </button>
          
          <button className="w-full sm:w-auto px-10 py-5 bg-surface-2 text-main-text rounded-lg font-mono font-bold text-base tracking-[0.2em] uppercase border border-main-border hover:border-secondary/50 hover:bg-secondary/10 hover:shadow-[0_0_20px_rgba(255,0,234,0.2)] transition-all flex items-center justify-center gap-4 active:scale-[0.98]">
            <Database size={20} className="text-secondary" />
            Access Docs
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function MainApp() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard />;
      case 'ops': return <Operations />;
      case 'chat': return <TeamChat />;
      case 'swap': return <ShiftSwap />;
      case 'leaves': return <Leaves />;
      case 'support': return <Troubleshooter />;
      case 'admin': return <AdminPanel />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-surface-1 text-main-text font-sans flex flex-col selection:bg-primary/20">
      <TopNavigation activeTab={activeTab} setActiveTab={setActiveTab} onOpenSettings={() => setIsSettingsOpen(true)} />
      <SystemGuardian />
      
      <main className="flex-1 w-full max-w-[1600px] mx-auto md:pl-28 md:pr-12 pt-20 pb-24 md:pb-12">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, scale: 0.99, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.99, y: -10 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="w-full h-full"
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </main>

      <AIChat />
      <UserSettings isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen bg-surface-1 flex flex-col items-center justify-center font-mono space-y-6">
        <div className="w-12 h-12 border-4 border-surface-3 border-t-primary rounded-full animate-spin"></div>
        <span className="text-xs font-bold tracking-[0.2em] uppercase text-main-text-muted">Loading System...</span>
      </div>
    );
  }

  return user ? <MainApp /> : <LandingPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <TimezoneProvider>
        <AppContent />
      </TimezoneProvider>
    </AuthProvider>
  );
}

