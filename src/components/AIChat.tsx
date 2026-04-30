import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, X, Send, Bot, User, Sparkles, Loader2, Brain, Activity } from 'lucide-react';
import { chatWithCortex } from '../geminiService';
import Markdown from 'react-markdown';
import { useAuth } from '../AuthContext';
import { collection, query, where, getDocs, onSnapshot, limit, orderBy } from 'firebase/firestore';
import { db } from '../firebase';

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export function AIChat() {
  const [isOpen, setIsOpen] = useState(false);
  const { user, isAdmin } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', text: 'Cortex System Online. Ready for tactical inquiries.' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [contextData, setContextData] = useState<{
    currentShifts: any[];
    activeMissions: any[];
    globalSettings: any;
  }>({
    currentShifts: [],
    activeMissions: [],
    globalSettings: { systemStatus: 'optimal' }
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load contextual data for the AI
  useEffect(() => {
    if (!user || !isOpen) return;

    // Fetch user shifts
    const qShifts = query(collection(db, 'shifts'), where('userId', '==', user.uid), limit(10));
    const unsubShifts = onSnapshot(qShifts, (snap) => {
      setContextData(prev => ({ ...prev, currentShifts: snap.docs.map(d => d.data()) }));
    });

    // Fetch active missions
    const qMissions = query(collection(db, 'missions'), where('status', '==', 'active'), limit(5));
    const unsubMissions = onSnapshot(qMissions, (snap) => {
      setContextData(prev => ({ ...prev, activeMissions: snap.docs.map(d => d.data()) }));
    });

    // Fetch global settings
    const qSettings = query(collection(db, 'settings'), limit(1));
    const unsubSettings = onSnapshot(qSettings, (snap) => {
      if (!snap.empty) {
        setContextData(prev => ({ ...prev, globalSettings: snap.docs[0].data() }));
      }
    });

    return () => {
      unsubShifts();
      unsubMissions();
      unsubSettings();
    };
  }, [user, isOpen]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading || !user) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsLoading(true);

    try {
      const history = messages
        .filter((_, i) => i > 0)
        .map(m => ({
          role: m.role,
          parts: [{ text: m.text }]
        }));

      // Adjust history for Gemini SDK requirements (must start with user)
      const validHistory = history.length > 0 && history[0].role === 'model' ? history.slice(1) : history;

      const responseText = await chatWithCortex(
        userMessage,
        validHistory,
        {
          userName: user.displayName || 'Technician',
          role: isAdmin ? 'Administrator' : 'Team Member',
          currentShifts: contextData.currentShifts,
          activeMissions: contextData.activeMissions,
          globalSettings: contextData.globalSettings
        }
      );
      
      setMessages(prev => [...prev, { role: 'model', text: responseText }]);
    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => [...prev, { role: 'model', text: 'Alert: Synaptic link failed. Please retry transmission.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 lg:bottom-10 lg:right-10 w-14 h-14 bg-black border border-primary/40 text-primary rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(var(--color-primary),0.3)] transition-all hover:scale-105 hover:border-primary z-40 group overflow-hidden"
      >
        <motion.div 
           animate={{ rotate: 360 }}
           transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
           className="absolute inset-0 bg-[radial-gradient(circle,rgba(var(--color-primary),0.1)_0%,transparent_70%)]"
        />
        <Brain size={24} className="group-hover:scale-110 transition-transform relative z-10" />
        {isLoading && (
          <motion.div 
            className="absolute inset-0 border-2 border-primary border-t-transparent rounded-full"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          />
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-24 right-6 lg:bottom-28 lg:right-10 w-[350px] sm:w-[400px] h-[500px] sm:h-[600px] max-h-[80vh] bg-surface-1 border border-primary/20 rounded-xl shadow-2xl flex flex-col z-50 overflow-hidden backdrop-blur-xl"
          >
            {/* Header */}
            <div className="bg-black/80 backdrop-blur p-4 border-b border-primary/20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                    <Brain size={18} />
                  </div>
                  <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-success rounded-full border-2 border-black" />
                </div>
                <div>
                  <h3 className="font-bold text-main-text text-xs font-mono uppercase tracking-[0.2em]">Cortex_Interface</h3>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                    <p className="text-[8px] text-main-text-muted font-mono uppercase tracking-widest leading-none">Synaptic_Link::Active</p>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5 text-main-text-muted hover:text-main-text transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6 no-scrollbar bg-[radial-gradient(circle_at_50%_0%,rgba(var(--color-primary),0.05)_0%,transparent_50%)]">
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex gap-3 max-w-[90%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    <div className={`mt-1 flex-shrink-0 flex items-center justify-center`}>
                      {msg.role === 'user' ? (
                        <div className="w-6 h-6 rounded bg-surface-2 border border-main-border flex items-center justify-center text-main-text-muted">
                          <User size={12} />
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded bg-primary/20 border border-primary/40 flex items-center justify-center text-primary">
                          <Brain size={12} />
                        </div>
                      )}
                    </div>
                    <div className={`p-4 rounded-lg relative ${
                      msg.role === 'user' 
                        ? 'bg-surface-2 text-main-text border border-main-border shadow-md' 
                        : 'bg-black/40 border border-primary/20 text-main-text'
                    }`}>
                      {msg.role === 'user' ? (
                        <p className="text-[11px] font-sans leading-relaxed">{msg.text}</p>
                      ) : (
                        <div className="prose prose-invert prose-sm max-w-none">
                            <div className="markdown-body font-sans text-[11px] leading-relaxed text-main-text selection:bg-primary/30">
                                <Markdown>{msg.text}</Markdown>
                            </div>
                        </div>
                      )}
                      
                      {/* Scanlines Effect for Bot Messages */}
                      {msg.role === 'model' && (
                        <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%]" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex justify-start">
                  <div className="flex gap-3 max-w-[85%]">
                    <div className="w-6 h-6 rounded bg-primary/20 border border-primary/40 flex items-center justify-center text-primary mt-1">
                      <Brain size={12} className="animate-pulse" />
                    </div>
                    <div className="p-4 rounded-lg bg-black/40 border border-primary/30 flex items-center gap-3">
                       <div className="flex gap-1">
                        <motion.div animate={{ opacity: [0.3, 1, 0.3], scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0 }} className="w-1.5 h-1.5 bg-primary rounded-full blur-[1px]" />
                        <motion.div animate={{ opacity: [0.3, 1, 0.3], scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1.5 h-1.5 bg-primary rounded-full blur-[1px]" />
                        <motion.div animate={{ opacity: [0.3, 1, 0.3], scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1.5 h-1.5 bg-primary rounded-full blur-[1px]" />
                       </div>
                       <span className="text-[8px] font-mono text-primary uppercase tracking-[0.2em] animate-pulse">Contextualizing...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-black/40 border-t border-primary/20 backdrop-blur-md">
              <form onSubmit={handleSend} className="relative">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Initiate Command Sequence..."
                  className="w-full bg-surface-2/50 border border-main-border rounded-lg pl-4 pr-12 py-4 text-[11px] text-main-text placeholder:text-main-text-muted/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all font-mono uppercase tracking-tight"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-primary/10 hover:bg-primary/20 disabled:opacity-30 text-primary rounded border border-primary/20 transition-all"
                >
                  <Send size={14} />
                </button>
              </form>
              <div className="mt-3 flex items-center justify-between px-1">
                 <div className="flex items-center gap-2">
                    <Activity size={10} className="text-secondary animate-pulse" />
                    <span className="text-[8px] font-mono text-main-text-muted uppercase tracking-tighter">Security_Clearance: {isAdmin ? 'L5_ADMIN' : 'L2_MEMBER'}</span>
                 </div>
                 <span className="text-[8px] font-mono text-main-text-muted uppercase">Omega_OS_v4.2</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
