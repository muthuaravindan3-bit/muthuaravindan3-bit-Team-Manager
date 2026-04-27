import React from 'react';
import { useAuth } from '../AuthContext';
import { Calendar, ClipboardList, MapPin, SearchCheck, LogOut, Shield, Menu, X, Command, User, Settings, Home, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AnnouncementTicker } from './AnnouncementTicker';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export function Sidebar({ activeTab, setActiveTab, isOpen, setIsOpen }: SidebarProps) {
  const { profile, isAdmin, logout } = useAuth();

  const navItems = [
    { id: 'dashboard', label: 'Home View', icon: Home },
    { id: 'ops', label: 'Team Pulse', icon: Activity },
    { id: 'leaves', label: 'Leave Center', icon: ClipboardList },
    { id: 'support', label: 'AI Assistant', icon: SearchCheck },
  ];

  if (isAdmin) {
    navItems.push({ id: 'admin', label: 'System Ops', icon: Shield });
  }

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] lg:hidden"
          />
        )}
      </AnimatePresence>

      <motion.aside
        initial={false}
        animate={{ x: isOpen ? 0 : (window.innerWidth < 1024 ? -350 : 0) }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className={`fixed inset-y-0 left-0 w-72 bg-zinc-950 text-white z-[70] lg:relative lg:block border-r border-white/5 shadow-2xl`}
      >
        <div className="flex flex-col h-full">
          <div className="p-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <Command size={20} />
              </div>
              <h1 className="text-lg font-bold tracking-tight">Manager</h1>
            </div>
          </div>

          <nav className="flex-1 px-4 space-y-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                  activeTab === item.id 
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <item.icon size={18} />
                <span className="text-sm font-semibold">{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="p-4 border-t border-white/5">
            <div className="bg-zinc-900/50 rounded-2xl p-4 border border-white/5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center font-bold text-indigo-400">
                  {profile?.displayName?.charAt(0) || profile?.email?.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{profile?.displayName || 'User'}</p>
                  <p className="text-xs text-slate-500">{profile?.role || 'Team Member'}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button className="flex items-center justify-center h-10 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-slate-400">
                  <Settings size={16} />
                </button>
                <button onClick={logout} className="flex items-center justify-center h-10 rounded-lg bg-red-500/10 hover:bg-red-500/20 transition-colors text-red-500">
                  <LogOut size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.aside>
    </>
  );
}

export function BottomNav({ activeTab, setActiveTab }: { activeTab: string; setActiveTab: (t: string) => void }) {
  const { isAdmin } = useAuth();
  const items = [
    { id: 'dashboard', icon: Home, label: 'Home' },
    { id: 'ops', icon: Activity, label: 'Pulse' },
    { id: 'leaves', icon: ClipboardList, label: 'Leaves' },
    { id: 'support', icon: SearchCheck, label: 'AI' }
  ];
  if (isAdmin) items.push({ id: 'admin', icon: Shield, label: 'Ops' });

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#09090b]/80 backdrop-blur-xl border-t border-white/5 px-6 pb-8 pt-3">
      <div className="flex justify-between items-center max-w-md mx-auto">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`flex flex-col items-center gap-1.5 transition-all outline-none ${
              activeTab === item.id ? 'text-indigo-500' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <item.icon size={20} strokeWidth={activeTab === item.id ? 2.5 : 2} />
            <span className="text-[10px] font-bold tracking-wide">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

export function Header({ setIsOpen }: { setIsOpen: (v: boolean) => void }) {
  const { profile } = useAuth();
  
  return (
    <header className="h-20 flex items-center justify-between px-6 lg:px-8 relative z-20">
      <div className="flex items-center gap-4">
        <button onClick={() => setIsOpen(true)} className="lg:hidden p-2 text-slate-400 hover:text-white transition-colors">
          <Menu size={22} />
        </button>
        <div className="hidden sm:flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-semibold text-emerald-500 tracking-wide">Connected</span>
        </div>
      </div>

      <div className="flex-1 max-w-xl mx-8 hidden lg:block">
        <AnnouncementTicker />
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3 bg-zinc-900/80 px-4 py-2 rounded-xl border border-white/5">
          <User size={16} className="text-slate-400" />
          <span className="text-sm font-semibold">{profile?.displayName || profile?.email?.split('@')[0]}</span>
        </div>
      </div>
    </header>
  );
}
