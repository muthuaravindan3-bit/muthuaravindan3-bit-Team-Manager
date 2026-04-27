import React, { useState, useEffect } from 'react';
import { getTroubleshootingSteps, TroubleshootingResult } from '../geminiService';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../AuthContext';
import { HelpCircle, Send, ShieldAlert, Users, ListOrdered, History, Sparkles, Terminal, Cpu, Info, Image as ImageIcon, Video, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { TroubleshootingGuide } from '../types';
import { useRef } from 'react';

export function Troubleshooter() {
  const { user } = useAuth();
  const [problem, setProblem] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TroubleshootingResult | null>(null);
  const [history, setHistory] = useState<TroubleshootingGuide[]>([]);
  const [media, setMedia] = useState<{ data: string; mimeType: string; preview: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'troubleshootingGuides'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TroubleshootingGuide));
      setHistory(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'troubleshootingGuides');
    });
    return () => unsubscribe();
  }, [user]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = (event.target?.result as string).split(',')[1];
      setMedia({
        data: base64,
        mimeType: file.type,
        preview: URL.createObjectURL(file)
      });
    };
    reader.readAsDataURL(file);
  };

  const handleTroubleshoot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!problem.trim() || !user) return;

    setLoading(true);
    setResult(null);
    try {
      const aiResult = await getTroubleshootingSteps(problem, media ? { data: media.data, mimeType: media.mimeType } : undefined);
      setResult(aiResult);

      await addDoc(collection(db, 'troubleshootingGuides'), {
        userId: user.uid,
        problem,
        ...aiResult,
        mediaType: media?.mimeType || null,
        createdAt: Date.now()
      });

      setProblem('');
      setMedia(null);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-10">
      <div className="max-w-3xl">
        <h1 className="text-4xl font-bold tracking-tight text-white mb-2">AI Assistant</h1>
        <p className="text-slate-400 font-medium">Ask questions or report issues to get helpful AI-driven solutions.</p>
      </div>

      <div className="grid gap-10 lg:grid-cols-2">
        <div className="space-y-8">
          <div className="glass-card p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-indigo-600/10 rounded-xl flex items-center justify-center text-indigo-400">
                <Sparkles size={20} />
              </div>
              <h3 className="text-lg font-bold text-white">Ask AI</h3>
            </div>
             
            <form onSubmit={handleTroubleshoot} className="space-y-6">
              <div className="space-y-4">
                <div className="relative">
                  <textarea
                    value={problem}
                    onChange={(e) => setProblem(e.target.value)}
                    placeholder="Describe the issue or ask a question..."
                    rows={5}
                    className="w-full bg-zinc-900 border border-white/5 rounded-2xl p-5 text-sm font-medium focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all outline-none resize-none"
                  />
                  
                  <div className="absolute bottom-3 right-3">
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*,video/*" className="hidden" />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2.5 bg-white/5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-all"
                    >
                      <ImageIcon size={18} />
                    </button>
                  </div>
                </div>

                <AnimatePresence>
                  {media && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="p-3 bg-white/5 rounded-2xl border border-white/10 flex items-center gap-4 relative"
                    >
                      <img src={media.preview} alt="Preview" className="w-12 h-12 rounded-lg object-cover" />
                      <div className="flex-1">
                        <p className="text-xs font-bold text-white truncate">{media.mimeType.split('/')[1].toUpperCase()} Added</p>
                      </div>
                      <button type="button" onClick={() => setMedia(null)} className="p-1.5 text-slate-500 hover:text-red-500">
                        <X size={16} />
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <button
                disabled={loading || !problem.trim()}
                className="btn-primary w-full flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {loading ? <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <Cpu size={18} />}
                {loading ? 'Thinking...' : 'Get AI Solution'}
              </button>
            </form>
          </div>

          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-6">
              <History className="text-slate-500" size={18} />
              <h3 className="text-lg font-bold text-white">Recent Activity</h3>
            </div>
            <div className="space-y-3">
              {history.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setResult({ guide: item.guide, level: item.level, handlingTeam: item.handlingTeam })}
                  className="w-full text-left p-4 rounded-xl bg-white/5 border border-white/5 hover:border-indigo-500/30 transition-all flex items-center justify-between group"
                >
                  <p className="text-sm font-semibold text-slate-300 truncate max-w-[200px]">{item.problem}</p>
                  <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">{item.level}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="relative">
          <AnimatePresence mode="wait">
            {result ? (
              <motion.div
                key="result"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="glass-card p-8 min-h-[500px] flex flex-col"
              >
                <div className="flex gap-3 mb-8">
                  <div className="bg-indigo-500/10 text-indigo-400 px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider">
                    {result.level} Intensity
                  </div>
                  <div className="bg-slate-500/10 text-slate-400 px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider">
                    {result.handlingTeam}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto no-scrollbar prose prose-invert prose-indigo prose-sm max-w-none">
                  <div className="markdown-body">
                    <Markdown>{result.guide}</Markdown>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="glass-card p-12 h-full flex flex-col items-center justify-center text-center border-dashed">
                <HelpCircle size={48} className="text-slate-800 mb-6" />
                <h4 className="text-xl font-bold text-slate-500 mb-2">Ready to help</h4>
                <p className="text-sm text-slate-600 max-w-xs">Ask a question above and the AI solution will appear here.</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
