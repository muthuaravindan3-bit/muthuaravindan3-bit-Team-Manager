import React, { useEffect, useState } from 'react';
import { Command } from 'cmdk';
import { Search, Home, Activity, ClipboardList, Shield, Settings, LogOut, Terminal, Users, Calendar, ArrowRightLeft, MessageSquare, Sparkles, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../AuthContext';
import { interpretIntelligentCommand } from '../geminiService';

interface CommandPaletteProps {
  onSelectTab: (tab: string) => void;
  onOpenSettings: () => void;
}

export function CommandPalette({ onSelectTab, onOpenSettings }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const { isAdmin, logout, user } = useAuth();

  // Toggle the menu when ⌘K is pressed
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const runCommand = (command: () => void) => {
    command();
    setOpen(false);
    setInputValue('');
  };

  const handleAIExecute = async () => {
    if (!inputValue.trim() || isProcessing) return;
    
    // Check if it's likely an AI command (longer, natural language)
    if (inputValue.length < 5) return;

    setIsProcessing(true);
    try {
      const result = await interpretIntelligentCommand(inputValue, isAdmin ? 'admin' : 'member');
      if (result.action === 'nav' && result.targetTab) {
        runCommand(() => onSelectTab(result.targetTab!));
      } else if (result.action === 'search') {
        // Just keep the search query
      } else if (result.action === 'none') {
        console.log("Cortex inference inconclusive:", result.explanation);
      }
    } catch (e) {
      console.error("AI Command failed:", e);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh] px-4 pointer-events-none">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-surface-1/60 backdrop-blur-sm pointer-events-auto"
            onClick={() => {
              setOpen(false);
              setInputValue('');
            }}
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-xl bg-surface-1 border border-main-border rounded-xl shadow-[0_30px_60px_rgba(0,0,0,0.5)] overflow-hidden pointer-events-auto"
          >
            <Command className="flex flex-col">
              <div className="flex items-center px-4 border-b border-main-border bg-surface-2/30">
                {isProcessing ? <Loader2 size={18} className="text-primary animate-spin mr-3" /> : <Search size={18} className="text-main-text-muted mr-3" />}
                <Command.Input 
                  value={inputValue}
                  onValueChange={setInputValue}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && inputValue.trim()) {
                      handleAIExecute();
                    }
                  }}
                  placeholder="Execute command, navigate, or ask Cortex AI..." 
                  className="flex-1 h-12 bg-transparent border-none outline-none text-sm font-mono placeholder:text-main-text-muted/50"
                  autoFocus
                />
                <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 bg-surface-2 rounded border border-main-border">
                  <span className="text-[9px] font-mono text-primary animate-pulse flex items-center gap-1">
                    <Sparkles size={8} />
                    AI_Enabled
                  </span>
                </div>
              </div>

              <Command.List className="max-h-[300px] overflow-y-auto p-2 scrollbar-thin">
                <Command.Empty className="py-6 text-center text-sm font-mono text-main-text-muted">
                  No direct commands found. Press ENTER to let Cortex interpret.
                </Command.Empty>

                <Command.Group heading={<span className="px-2 py-1 text-[9px] font-mono uppercase tracking-[0.3em] text-main-text-muted opacity-50">Navigation</span>}>
                  <Item icon={Home} onSelect={() => runCommand(() => onSelectTab('dashboard'))}>Jump to Overview</Item>
                  <Item icon={Activity} onSelect={() => runCommand(() => onSelectTab('ops'))}>Team Pulse Grid</Item>
                  <Item icon={MessageSquare} onSelect={() => runCommand(() => onSelectTab('chat'))}>Secure Comm Link</Item>
                  <Item icon={ArrowRightLeft} onSelect={() => runCommand(() => onSelectTab('swap'))}>Shift Trade Marketplace</Item>
                  <Item icon={ClipboardList} onSelect={() => runCommand(() => onSelectTab('leaves'))}>Time Off Records</Item>
                  {isAdmin && <Item icon={Shield} onSelect={() => runCommand(() => onSelectTab('admin'))}>Omega Command Center</Item>}
                </Command.Group>

                <Command.Group heading={<span className="px-2 py-1 text-[9px] font-mono uppercase tracking-[0.3em] text-main-text-muted opacity-50">System Configuration</span>}>
                  <Item icon={Settings} onSelect={() => runCommand(onOpenSettings)}>Global Protocols</Item>
                  <Item icon={Terminal} onSelect={() => runCommand(() => onSelectTab('support'))}>AI Support Terminal</Item>
                  <Item icon={LogOut} onSelect={() => runCommand(logout)} className="text-error hover:!text-error">Terminate Session</Item>
                </Command.Group>
                
                {isAdmin && (
                  <Command.Group heading={<span className="px-2 py-1 text-[9px] font-mono uppercase tracking-[0.3em] text-main-text-muted opacity-50">Admin Quick Actions</span>}>
                    <Item icon={Users} onSelect={() => runCommand(() => onSelectTab('admin'))}>User Management Node</Item>
                    <Item icon={Calendar} onSelect={() => runCommand(() => onSelectTab('admin'))}>Open Schedule Grid</Item>
                  </Command.Group>
                )}
              </Command.List>

              <div className="flex items-center justify-between px-4 py-2 border-t border-main-border bg-surface-2/50 text-[9px] font-mono text-main-text-muted uppercase tracking-widest">
                <span>Team_Manager_v2.1_Shell</span>
                <span className="flex items-center gap-4">
                  <span>ENTER to execute</span>
                  <span>↑↓ to navigate</span>
                </span>
              </div>
            </Command>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function Item({ children, icon: Icon, onSelect, className = "" }: { children: React.ReactNode, icon: any, onSelect: () => void, className?: string }) {
  return (
    <Command.Item
      onSelect={onSelect}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer text-sm font-mono transition-all aria-selected:bg-primary/10 aria-selected:text-primary ${className}`}
    >
      <Icon size={16} />
      <span>{children}</span>
    </Command.Item>
  );
}
