import React, { useState, useEffect, useRef } from 'react';
import { getTroubleshootingSteps, TroubleshootingResult } from '../geminiService';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../AuthContext';
import { 
  History, Sparkles, Terminal, Cpu, Image as ImageIcon, X, Mic, MicOff, Send, MessageSquare, AlertOctagon,
  ShieldCheck, Activity, Target, Layers, Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { TroubleshootingGuide } from '../types';

// Speech Recognition setup fallback
const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

export function Troubleshooter() {
  const { user } = useAuth();
  const [problem, setProblem] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TroubleshootingResult | null>(null);
  const [history, setHistory] = useState<TroubleshootingGuide[]>([]);
  const [media, setMedia] = useState<{ data: string; mimeType: string; preview: string } | null>(null);
  const [isListening, setIsListening] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

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

  useEffect(() => {
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;

      recognitionRef.current.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
          setProblem((prev) => prev + (prev ? ' ' : '') + finalTranscript);
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setIsListening(false);
      };
      
      recognitionRef.current.onend = () => {
         setIsListening(false);
      };
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      setProblem('');
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

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

  const handleTroubleshoot = async (e?: React.FormEvent) => {
    if(e) e.preventDefault();
    if (!problem.trim() || !user) return;
    
    if (isListening) {
        recognitionRef.current?.stop();
        setIsListening(false);
    }

    setLoading(true);
    setResult(null);
    try {
      const systemContext = `Current User: ${user.displayName} (UID: ${user.uid}). 
        System Time: ${new Date().toISOString()}. 
        Recent Operational Events: ${history.slice(0, 3).map(h => h.problem).join(', ')}`;
      
      const aiResult = await getTroubleshootingSteps(
        problem, 
        media ? { data: media.data, mimeType: media.mimeType } : undefined,
        systemContext
      );
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleTroubleshoot();
    }
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex items-end justify-between border-b border-main-border pb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded-lg border border-primary/20">
              <Cpu size={24} className="text-primary" />
            </div>
            <h1 className="text-3xl font-display font-medium text-main-text uppercase tracking-tight italic">
              Diagnostic_Cortex
            </h1>
          </div>
          <p className="text-[10px] font-mono text-main-text-muted mt-1 uppercase tracking-[0.4em] opacity-40">
             System_Anomaly_Resolution // L1-L3 Support Interface
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-8 h-[calc(100vh-250px)] min-h-[600px]">
        {/* Interaction Pane */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* Chat & Prompt Window */}
          <div className="bg-surface-1 border border-main-border rounded-xl flex-1 flex flex-col overflow-hidden relative">
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
              <Sparkles size={80} />
            </div>
            
            <div className="p-4 border-b border-main-border flex items-center gap-3 bg-surface-2/30 relative z-10">
              <Terminal size={14} className="text-primary" />
              <h3 className="text-xs font-mono uppercase tracking-widest font-bold text-main-text">Terminal_Input</h3>
            </div>

            <div className="flex-1 p-6 relative z-10 flex flex-col justify-end">
               {/* Minimal Instruction Label */}
               <div className="mb-6 space-y-4">
                  <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                     <p className="text-xs font-mono text-main-text leading-relaxed">
                        <span className="text-primary font-bold mr-2">&gt;</span> 
                        Provide symptoms, system alerts, or operational anomalies. Use text, voice, or attach telemetry (images) for Cortex analysis.
                     </p>
                  </div>
               </div>

               <AnimatePresence>
                 {media && (
                   <motion.div
                     initial={{ opacity: 0, scale: 0.95 }}
                     animate={{ opacity: 1, scale: 1 }}
                     exit={{ opacity: 0, scale: 0.95 }}
                     className="mb-4 p-3 bg-surface-2 rounded-lg border border-main-border flex items-center gap-4 relative shadow-md"
                   >
                     <img src={media.preview} alt="Preview" className="w-12 h-12 rounded bg-surface-3 object-cover" />
                     <div className="flex-1">
                       <p className="text-[10px] font-mono font-bold text-main-text truncate uppercase tracking-widest text-primary">Media_Attached</p>
                       <p className="text-[9px] font-mono text-main-text-muted truncate">{media.mimeType}</p>
                     </div>
                     <button type="button" onClick={() => setMedia(null)} className="p-1.5 text-main-text-muted hover:text-error transition-colors">
                       <X size={14} />
                     </button>
                   </motion.div>
                 )}
               </AnimatePresence>

               <div className="relative">
                 <textarea
                   id="diagnostic-input"
                   value={problem}
                   onChange={(e) => setProblem(e.target.value)}
                   onKeyDown={handleKeyDown}
                   placeholder={isListening ? "Listening array active..." : "Describe anomaly or ask query..."}
                   rows={4}
                   className={`w-full bg-surface-2/50 border ${isListening ? 'border-primary/50' : 'border-main-border'} rounded-lg p-4 pb-12 text-sm font-sans focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all outline-none resize-none`}
                 />
                 
                 <div className="absolute bottom-2 left-2 flex items-center gap-1">
                   {SpeechRecognition && (
                      <button
                        type="button"
                        onClick={toggleListening}
                        className={`p-2 rounded flex items-center justify-center transition-colors ${isListening ? 'bg-error/20 text-error animate-pulse' : 'hover:bg-surface-3 text-main-text-muted hover:text-primary'}`}
                        title="Toggle Voice Input"
                      >
                        {isListening ? <Mic size={16} /> : <MicOff size={16} />}
                      </button>
                   )}
                   <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                   <button
                     type="button"
                     onClick={() => fileInputRef.current?.click()}
                     className="p-2 hover:bg-surface-3 rounded flex items-center justify-center text-main-text-muted hover:text-primary transition-colors"
                     title="Attach Image"
                   >
                     <ImageIcon size={16} />
                   </button>
                 </div>
                 
                 <button
                   onClick={() => handleTroubleshoot()}
                   disabled={loading || !problem.trim()}
                   className="absolute bottom-2 right-2 p-2 bg-primary text-surface-1 rounded shadow-md hover:scale-105 transition-all disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center"
                 >
                   {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send size={16} />}
                 </button>
               </div>
               
               {isListening && (
                  <p className="text-[9px] font-mono text-primary animate-pulse tracking-widest uppercase mt-2">Awaiting voice telemetry...</p>
               )}
            </div>
          </div>

          {/* History Strip */}
          <div className="bg-surface-1 border border-main-border rounded-xl p-4 h-[200px] flex flex-col">
            <div className="flex items-center gap-2 mb-3">
              <History size={12} className="text-main-text-muted" />
              <h4 className="text-[10px] font-mono uppercase tracking-widest text-main-text-muted">Recent_Diagnostics</h4>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 scrollbar-thin">
              {history.length === 0 ? (
                 <p className="text-[10px] font-mono text-main-text-muted/50 uppercase tracking-widest text-center mt-8">No prior logs</p>
              ) : (
                 history.slice(0, 5).map((item) => (
                   <button
                     key={item.id}
                     onClick={() => setResult({ guide: item.guide, level: item.level, handlingTeam: item.handlingTeam })}
                     className="w-full text-left p-3 rounded-lg bg-surface-2/40 hover:bg-surface-2 border border-transparent hover:border-main-border transition-all flex items-center justify-between group"
                   >
                     <span className="text-xs font-sans text-main-text truncate pr-4">{item.problem}</span>
                     <span className={`text-[8px] font-mono font-bold tracking-widest uppercase px-1.5 py-0.5 rounded shrink-0 ${
                        item.level === 'L3' ? 'bg-error/10 text-error' : 
                        item.level === 'L2' ? 'bg-warning/10 text-warning' : 
                        'bg-primary/10 text-primary'
                     }`}>
                        {item.level}
                     </span>
                   </button>
                 ))
              )}
            </div>
          </div>
        </div>

        {/* Output Diagnostic Feed */}
        <div className="lg:col-span-7 bg-surface-1 border border-main-border rounded-xl flex flex-col overflow-hidden relative">
          <div className="p-4 border-b border-main-border flex flex-wrap items-center justify-between gap-4 bg-surface-2/30 relative z-10">
            <div className="flex items-center gap-3">
              <Activity size={14} className="text-primary" />
              <h3 className="text-xs font-mono uppercase tracking-widest font-bold text-main-text">Cortex_Resolution_Output</h3>
            </div>
            
            {result && (
               <div className="flex items-center gap-3">
                 <div className="flex items-center gap-1.5 px-2 py-1 bg-surface-2 border border-main-border rounded text-[9px] font-mono uppercase tracking-widest text-main-text-muted">
                    <ShieldCheck size={10} className="text-primary" />
                    <span>Team: {result.handlingTeam}</span>
                 </div>
                 <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-[9px] font-mono uppercase tracking-widest font-bold ${
                    result.level === 'L3' ? 'bg-error/10 border border-error/20 text-error' : 
                    result.level === 'L2' ? 'bg-warning/10 border border-warning/20 text-warning' : 
                    'bg-primary/10 border border-primary/20 text-primary'
                 }`}>
                    <AlertOctagon size={10} />
                    <span>Severity {result.level}</span>
                 </div>
               </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-8 relative scrollbar-thin">
            {!result && !loading && (
               <div className="absolute inset-0 flex flex-col items-center justify-center text-main-text-muted/30">
                 <Layers size={64} className="mb-4 opacity-20" />
                 <p className="text-[11px] font-mono uppercase tracking-[0.3em]">Standby // Awaiting Inquiry</p>
               </div>
            )}
            
            {loading && (
               <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface-1/80 backdrop-blur-sm z-20">
                 <Loader2 size={48} className="text-primary animate-spin mb-6 opacity-50" />
                 <p className="text-[10px] font-mono uppercase tracking-widest text-primary animate-pulse">Processing Telemetry & Synthesizing Resolution...</p>
               </div>
            )}

            <AnimatePresence mode="wait">
              {result && !loading && (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="prose prose-invert prose-sm max-w-none prose-headings:font-display prose-headings:tracking-tight prose-a:text-primary prose-code:text-primary prose-code:bg-primary/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded markdown-body !bg-transparent"
                >
                  <Markdown>{result.guide}</Markdown>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

