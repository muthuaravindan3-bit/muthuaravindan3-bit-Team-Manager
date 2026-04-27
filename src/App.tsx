/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import { Sidebar, Header, BottomNav } from './components/Navigation';
import { Dashboard } from './components/Dashboard';
import { Leaves } from './components/Leaves';
import { Operations } from './components/Operations';
import { Troubleshooter } from './components/Troubleshooter';
import { AdminPanel } from './components/AdminPanel';
import { LogIn, Database, ShieldCheck, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

function LandingPage() {
  const { signIn } = useAuth();

  return (
    <div className="min-h-screen bg-[#09090b] flex items-center justify-center p-6 lg:p-12 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-500/5 blur-[100px] rounded-full pointer-events-none" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-4xl w-full text-center relative z-10"
      >
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="inline-flex items-center space-x-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 px-4 py-1.5 rounded-full mb-8"
        >
          <Sparkles size={14} />
          <span className="text-[11px] font-bold tracking-wider uppercase">Now with AI Insights</span>
        </motion.div>
        
        <h1 className="text-6xl sm:text-7xl lg:text-9xl font-bold tracking-tight text-white mb-8 leading-tight">
          Manage your team <span className="text-indigo-500">efficiently.</span>
        </h1>
        
        <p className="text-xl md:text-2xl text-slate-400 mb-12 max-w-2xl mx-auto font-medium">
          The all-in-one platform for staff schedules, leave requests, and intelligent troubleshooting.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
          <button 
            onClick={signIn}
            className="w-full sm:w-auto px-10 py-5 bg-white text-black rounded-2xl font-bold text-lg hover:bg-slate-100 transition-all shadow-2xl shadow-white/5 flex items-center justify-center gap-3"
          >
            <LogIn size={20} />
            Get Started
          </button>
          
          <button className="text-slate-400 hover:text-white font-semibold transition-colors flex items-center gap-2">
            View Documentation <Database size={16} />
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function MainApp() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard />;
      case 'ops': return <Operations />;
      case 'leaves': return <Leaves />;
      case 'support': return <Troubleshooter />;
      case 'admin': return <AdminPanel />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen bg-[#09090b] text-slate-200">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      
      <div className="flex-1 flex flex-col min-w-0 bg-[#0c0c0e] border-l border-white/5 mx-2 my-2 rounded-[2rem] overflow-hidden shadow-2xl relative">
        <Header setIsOpen={setIsSidebarOpen} />
        
        <main className="flex-1 overflow-y-auto no-scrollbar pb-32 lg:pb-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="p-6 lg:p-10 max-w-7xl mx-auto"
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </main>
        
        <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
      </div>
    </div>
  );
}

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen bg-[#050505] flex flex-col items-center justify-center font-mono">
        <motion.div 
          animate={{ 
            scale: [1, 1.1, 1],
            opacity: [0.3, 1, 0.3]
          }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="w-12 h-12 bg-[#F27D26] rounded-2xl shadow-[0_0_50px_rgba(242,125,38,0.3)] mb-12"
        />
        <div className="relative w-64 h-[1px] bg-white/10 overflow-hidden">
          <motion.div 
            animate={{ x: [-300, 300] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
            className="absolute inset-0 w-1/3 bg-gradient-to-r from-transparent via-[#F27D26] to-transparent shadow-[0_0_20px_rgba(242,125,38,0.5)]"
          />
        </div>
        <span className="mt-8 text-[10px] font-black tracking-[0.4em] uppercase text-white/30">Loading System...</span>
      </div>
    );
  }

  return user ? <MainApp /> : <LandingPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
