import React, { useState, useEffect, useRef } from 'react';
import { collection, query, onSnapshot, addDoc, orderBy, limit, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Hash, Users, Shield, Terminal, Zap, Cpu } from 'lucide-react';
import { format } from 'date-fns';

interface Message {
  id: string;
  text: string;
  userId: string;
  userName: string;
  role: string;
  timestamp: any;
}

export function TeamChat() {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'messages'),
      orderBy('timestamp', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Message)).reverse();
      setMessages(msgs);
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'messages'));

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !user) return;

    const text = input;
    setInput('');

    try {
      await addDoc(collection(db, 'messages'), {
        text,
        userId: user.uid,
        userName: profile?.displayName || profile?.email,
        role: profile?.role || 'member',
        timestamp: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'messages');
    }
  };

  return (
    <div className="h-[calc(100vh-12rem)] flex flex-col bg-surface-1 border border-main-border rounded-2xl overflow-hidden shadow-2xl relative">
      {/* Background Grid Pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(#1a1a1a_1px,transparent_1px)] [background-size:20px_20px] opacity-20 pointer-events-none" />

      <div className="p-4 border-b border-main-border bg-surface-2/30 backdrop-blur-md flex items-center justify-between relative z-10">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1 bg-primary/10 border border-primary/20 rounded-full">
            <Hash size={14} className="text-primary" />
            <span className="text-[10px] font-mono font-bold text-primary uppercase tracking-widest text-main-text">Global_Ops_Comm</span>
          </div>
          <div className="h-4 w-px bg-main-border" />
          <div className="flex items-center gap-2">
            <Users size={14} className="text-main-text-muted" />
            <span className="text-[10px] font-mono text-main-text-muted uppercase tracking-widest">Node_Sync: Active</span>
          </div>
        </div>
        <div className="flex items-center gap-4 text-main-text-muted">
           <div className="flex items-center gap-1.5 border border-main-border px-2 py-0.5 rounded bg-surface-1">
             <Cpu size={10} className="text-success" />
             <span className="text-[8px] font-mono uppercase">ECC_Enabled</span>
           </div>
        </div>
      </div>

      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin relative z-10"
      >
        {messages.map((msg, i) => {
          const isMe = msg.userId === user?.uid;
          const showHeader = i === 0 || messages[i-1].userId !== msg.userId;

          return (
            <motion.div
              layout
              initial={{ opacity: 0, x: isMe ? 20 : -20 }}
              animate={{ opacity: 1, x: 0 }}
              key={msg.id}
              className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
            >
              {showHeader && (
                <div className={`flex items-center gap-2 mb-1.5 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                  <span className="text-[9px] font-mono font-bold text-primary uppercase tracking-widest">{msg.role === 'admin' ? '[L0]' : '[L1]'} {msg.userName}</span>
                  <span className="text-[8px] font-mono text-main-text-muted opacity-50">
                    {msg.timestamp?.seconds ? format(new Date(msg.timestamp.seconds * 1000), 'HH:mm:ss') : 'Just now'}
                  </span>
                </div>
              )}
              <div className={`max-w-[80%] px-4 py-2.5 rounded-xl text-sm font-sans ${
                isMe 
                  ? 'bg-primary text-black font-medium rounded-tr-none' 
                  : 'bg-surface-2 border border-main-border text-main-text rounded-tl-none shadow-sm'
              }`}>
                {msg.text}
              </div>
            </motion.div>
          )
        })}
        {loading && (
          <div className="flex items-center justify-center h-full">
            <Terminal className="text-primary animate-pulse" size={24} />
          </div>
        )}
      </div>

      <div className="p-6 bg-surface-2/30 backdrop-blur-md border-t border-main-border relative z-10">
        <form onSubmit={sendMessage} className="relative flex items-center gap-3">
          <div className="relative flex-1 group">
             <div className="absolute inset-0 bg-primary/5 rounded-xl blur-lg group-focus-within:opacity-100 opacity-0 transition-opacity" />
             <input 
               type="text"
               value={input}
               onChange={(e) => setInput(e.target.value)}
               placeholder="INPUT COMMAND OR MESSAGE..."
               className="w-full bg-surface-1 border border-main-border rounded-xl px-4 py-3 text-xs font-mono uppercase tracking-widest outline-none focus:border-primary/50 transition-all text-main-text relative z-10"
             />
          </div>
          <button 
            type="submit"
            className="p-3 bg-primary text-black rounded-xl hover:scale-105 transition-all shadow-[0_0_15px_rgba(var(--color-primary),0.3)] relative z-10 disabled:opacity-50"
            disabled={!input.trim()}
          >
            <Send size={18} />
          </button>
        </form>
        <div className="mt-3 flex items-center gap-4">
           <div className="flex items-center gap-2">
             <div className="w-1 h-1 rounded-full bg-success shadow-[0_0_5px_rgba(var(--color-success),0.5)]" />
             <span className="text-[7px] font-mono text-main-text-muted uppercase tracking-[0.2em]">Cipher: AES-256-GCM</span>
           </div>
           <div className="flex items-center gap-2">
             <Zap size={8} className="text-warning" />
             <span className="text-[7px] font-mono text-main-text-muted uppercase tracking-[0.2em]">Transmission: Burst_Mode</span>
           </div>
        </div>
      </div>
    </div>
  );
}
