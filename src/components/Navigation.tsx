import React, { useState } from 'react';
import { useAuth } from '../AuthContext';
import { ClipboardList, SearchCheck, LogOut, Shield, Menu, Command, User, Settings, Home, Activity, X, Cpu, Wifi, Database, ArrowRightLeft, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AnnouncementTicker } from './AnnouncementTicker';
import { CommandPalette } from './CommandPalette';

interface TopNavigationProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenSettings: () => void;
}

export function TopNavigation({ activeTab, setActiveTab, onOpenSettings }: TopNavigationProps) {
  const { profile, isAdmin, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { id: 'dashboard', label: 'Overview', icon: Home },
    { id: 'ops', label: 'Team Pulse', icon: Activity },
    { id: 'chat', label: 'Comm Link', icon: MessageSquare },
    { id: 'swap', label: 'Marketplace', icon: ArrowRightLeft },
    { id: 'leaves', label: 'Time Off', icon: ClipboardList },
    { id: 'support', label: 'AI Support', icon: SearchCheck },
  ];

  if (isAdmin) {
    navItems.push({ id: 'admin', label: 'Command', icon: Shield });
  }

  const handleTabClick = (id: string) => {
    setActiveTab(id);
    setMobileMenuOpen(false);
  };

  return (
    <>
      {/* Global Telemetry Bar (Top) */}
      <header className="fixed top-0 left-0 right-0 z-[5000] bg-surface-1/70 backdrop-blur-xl border-b border-primary/20 shadow-[0_4px_30px_rgba(0,240,255,0.05)]">
        <div className="max-w-[1600px] mx-auto px-6">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-4 cursor-pointer group" onClick={() => handleTabClick('dashboard')}>
                <div className="w-8 h-8 bg-surface-2 border border-primary/40 flex items-center justify-center rounded-xl transition-all duration-300 group-hover:scale-105 group-hover:bg-primary/10 shadow-[0_0_15px_rgba(0,240,255,0.15)] overflow-hidden relative">
                  <div className="absolute inset-0 bg-primary/20 animate-pulse pointer-events-none" />
                  <Command size={16} className="text-primary z-10 drop-shadow-[0_0_8px_rgba(0,240,255,0.8)]" />
                </div>
                <div className="flex flex-col">
                  <span className="font-display text-base font-bold text-main-text leading-none tracking-tight uppercase text-shadow-sm">Team_Manager</span>
                  <div className="flex items-center gap-1.5 mt-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-success shadow-[0_0_8px_rgba(0,255,102,0.8)] animate-pulse" />
                    <span className="text-[8px] font-mono text-success uppercase tracking-[0.2em] font-bold">Secure_Sys_Active</span>
                  </div>
                </div>
              </div>

              <div className="hidden lg:flex items-center gap-8 border-l border-primary/20 pl-6 ml-2">
                <div className="flex items-center gap-5">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <Cpu size={10} className="text-secondary opacity-80" />
                      <div className="w-16 h-1 bg-surface-2 rounded-full overflow-hidden shadow-inner">
                        <motion.div 
                          className="h-full bg-secondary shadow-[0_0_8px_rgba(255,0,234,0.8)]"
                          animate={{ width: ["20%", "70%", "30%"] }}
                          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Database size={10} className="text-success opacity-80" />
                      <div className="w-16 h-1 bg-surface-2 rounded-full overflow-hidden shadow-inner">
                        <motion.div 
                          className="h-full bg-success shadow-[0_0_8px_rgba(0,255,102,0.8)]"
                          animate={{ width: ["50%", "90%", "60%"] }}
                          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 bg-success/10 px-3 py-1.5 rounded-lg border border-success/30 shadow-[0_0_10px_rgba(0,255,102,0.1)]">
                    <Wifi size={12} className="text-success animate-pulse shadow-[0_0_8px_rgba(0,255,102,0.8)] drop-shadow-md" />
                    <span className="text-[9px] font-mono text-success uppercase font-bold tracking-widest">12ms</span>
                  </div>
                </div>

                <div className="h-5 w-px bg-primary/20" />
                
                <div className="flex items-center gap-3">
                  <AnnouncementTicker />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-5">
              <div className="flex items-center gap-3 bg-surface-2/80 border border-primary/20 hover:border-primary/50 transition-colors cursor-pointer px-4 py-1.5 rounded-xl shadow-inner group">
                <div className="w-6 h-6 rounded border border-primary/40 bg-primary/20 flex items-center justify-center shadow-[0_0_10px_rgba(0,240,255,0.2)] group-hover:bg-primary group-hover:text-black transition-colors">
                  <User size={12} className="text-primary group-hover:text-black" />
                </div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-main-text truncate max-w-[100px] drop-shadow-sm">
                  {profile?.displayName || profile?.email?.split('@')[0]}
                </span>
                <div className="w-2 h-2 rounded-full bg-success shadow-[0_0_8px_rgba(0,255,102,0.8)] animate-pulse ml-1" />
              </div>

              <div className="flex items-center border-l border-primary/20 pl-5 h-6 gap-2">
                <button 
                  onClick={onOpenSettings} 
                  className="p-2 text-main-text-muted hover:text-primary transition-all hover:bg-primary/10 rounded-lg hover:shadow-[0_0_15px_rgba(0,240,255,0.2)]"
                  title="Settings"
                >
                  <Settings size={16} />
                </button>
                <button 
                  onClick={logout} 
                  className="p-2 text-main-text-muted hover:text-error transition-all hover:bg-error/10 rounded-lg hover:shadow-[0_0_15px_rgba(255,51,102,0.2)]"
                  title="Disconnect"
                >
                  <LogOut size={16} />
                </button>
              </div>

              <div className="hidden sm:flex items-center ml-2 border-l border-primary/20 pl-5">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-2/80 rounded-lg border border-primary/20 shadow-inner text-[9px] font-mono text-main-text-muted uppercase tracking-[0.2em]">
                  <span className="opacity-60">CMD</span>
                  <span className="text-primary font-bold drop-shadow-[0_0_5px_rgba(0,240,255,0.8)]">K</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <CommandPalette onSelectTab={setActiveTab} onOpenSettings={onOpenSettings} />

      {/* Modern Desktop Sidebar Dock */}
      <nav className="fixed left-6 top-1/2 -translate-y-1/2 z-[5000] hidden md:flex flex-col gap-3 p-3 glass-panel border border-primary/30 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5),_0_0_30px_rgba(0,240,255,0.1)]">
        <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-[0.05] pointer-events-none mix-blend-overlay rounded-2xl"></div>
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleTabClick(item.id)}
              className={`relative group p-3.5 rounded-xl transition-all duration-300 flex items-center justify-center ${
                isActive ? 'bg-primary text-black shadow-[0_0_20px_rgba(0,240,255,0.4)]' : 'text-main-text-muted hover:text-primary hover:bg-primary/10'
              }`}
            >
              <item.icon size={20} className={`relative z-10 transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
              
              {/* Tooltip Overlay */}
              <div className="absolute left-full ml-6 px-4 py-2 glass-panel border border-primary/30 rounded-lg font-mono text-[10px] font-bold uppercase tracking-[0.3em] opacity-0 group-hover:opacity-100 translate-x-[-10px] group-hover:translate-x-0 transition-all pointer-events-none whitespace-nowrap z-[70] shadow-[0_5px_20px_rgba(0,240,255,0.2)] text-primary">
                {item.label}
              </div>

              {isActive && (
                <motion.div
                  layoutId="active-nav-dot"
                  className="absolute -right-2 w-1.5 h-6 bg-primary rounded-full shadow-[0_0_10px_rgba(0,240,255,0.8)]"
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Mobile Floating Mission Bar (Bottom) */}
      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[5000] md:hidden w-[calc(100%-48px)] max-w-sm h-16 glass-panel border border-primary/30 rounded-2xl shadow-[0_24px_48px_rgba(0,0,0,0.5),_0_0_30px_rgba(0,240,255,0.1)] flex items-center justify-around px-2 overflow-hidden">
        <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-[0.05] pointer-events-none mix-blend-overlay"></div>
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleTabClick(item.id)}
              className={`flex flex-col items-center gap-1.5 p-2 transition-all duration-300 relative z-10 ${
                isActive ? 'text-primary' : 'text-main-text-muted hover:text-primary'
              }`}
            >
              <item.icon size={isActive ? 22 : 20} className={isActive ? 'drop-shadow-[0_0_8px_rgba(0,240,255,0.8)]' : ''} />
              <span className={`text-[9px] font-mono font-bold uppercase tracking-[0.1em] ${isActive ? 'opacity-100 text-shadow-sm' : 'opacity-60'}`}>
                {item.id === 'dashboard' ? 'Core' : item.label.split(' ')[0]}
              </span>
              
              {isActive && (
                <motion.div
                  layoutId="active-nav-pill-mobile"
                  className="absolute -bottom-1.5 w-8 h-1.5 bg-primary rounded-t-full shadow-[0_0_10px_rgba(0,240,255,0.8)]"
                />
              )}
            </button>
          );
        })}
      </nav>
    </>
  );
}
