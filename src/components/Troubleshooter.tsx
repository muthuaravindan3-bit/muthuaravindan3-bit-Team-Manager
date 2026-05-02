import React, { useState, useEffect, useRef } from 'react';
import { troubleshootStream } from '../geminiService';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../AuthContext';
import { 
  History, Sparkles, Terminal, Cpu, Image as ImageIcon, X, Mic, MicOff, Send, MessageSquare, AlertOctagon,
  ShieldCheck, Activity, Target, Layers, Loader2, AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { TroubleshootingGuide } from '../types';

// Speech Recognition setup fallback
const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

export function Troubleshooter() {
  const { user } = useAuth();
  const [problem, setProblem] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [thoughts, setThoughts] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [history, setHistory] = useState<TroubleshootingGuide[]>([]);
  const [media, setMedia] = useState<{ data: string; mimeType: string; preview: string } | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [activeTab, setActiveTab] = useState<'cortex' | 'kb'>('cortex');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
    setThoughts(null);
    setIsStreaming(true);
    setErrorMsg(null);
    
    try {
      const getTelemetry = () => {
        try {
          return `Browser: ${navigator.userAgent}
Language: ${navigator.language}
Screen: ${window.innerWidth}x${window.innerHeight}
Memory (est): ${((navigator as any).deviceMemory) || 'Unknown'}GB`;
        } catch(e) { return "Telemetry Denied"; }
      };

      const systemContext = `Current User: ${user.displayName} (UID: ${user.uid}). 
System Time: ${new Date().toISOString()}. 
Live Telemetry:
${getTelemetry()}
Recent Operational Events: ${history.slice(0, 3).map(h => h.problem).join(', ')}`;
      
      let fullText = '';
      
      const stream = troubleshootStream(
        problem, 
        media ? { data: media.data, mimeType: media.mimeType } : undefined,
        systemContext
      );
      
      for await (const chunk of stream) {
        setLoading(false);
        fullText += chunk;
        
        // Parse thoughts and result separately
        const thoughtMatch = fullText.match(/<thought>([\\s\\S]*?)(<\/thought>|$)/);
        if (thoughtMatch) {
           setThoughts(thoughtMatch[1]);
        }
        
        const finalMatch = fullText.split('</thought>');
        if (finalMatch.length > 1) {
           setResult(finalMatch[1].trim());
        } else if (!thoughtMatch) {
           setResult(fullText);
        }
      }

      // Determine level / team from output text
      const levelMatch = fullText.match(/(?:Severity(?: Level)?)[^a-zA-Z0-9]*([L][1-3])/i);
      const level = levelMatch ? levelMatch[1] : 'L1';
      const teamMatch = fullText.match(/(?:Handling Team)[^a-zA-Z0-9]*([A-Za-z0-9\\s]+)/i);
      const team = teamMatch ? teamMatch[1].trim() : 'Admin';

      await addDoc(collection(db, 'troubleshootingGuides'), {
        userId: user.uid,
        problem,
        guide: fullText,
        level: level,
        handlingTeam: team,
        mediaType: media?.mimeType || null,
        createdAt: Date.now()
      });

      setProblem('');
      setMedia(null);
    } catch (error: any) {
      console.error(error);
      const message = error.message || String(error);
      if (message.includes('429') || message.includes('RESOURCE_EXHAUSTED') || message.includes('exceeded your current quota')) {
         setErrorMsg("Diagnostic Cortex Rate Limit Exceeded: The AI API quota has been reached. Please wait a moment and try again.");
      } else {
         setErrorMsg("Diagnostic Cortex Error: " + message);
      }
    } finally {
      setLoading(false);
      setIsStreaming(false);
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
        
        <div className="flex bg-surface-2 rounded-lg p-1 border border-main-border">
          <button 
             onClick={() => setActiveTab('cortex')}
             className={`px-4 py-2 rounded-md text-xs font-mono tracking-widest uppercase transition-all ${activeTab === 'cortex' ? 'bg-primary text-surface-1 shadow-sm' : 'text-main-text-muted hover:text-main-text'}`}
          >
             Live Feed
          </button>
          <button 
             onClick={() => setActiveTab('kb')}
             className={`px-4 py-2 rounded-md text-xs font-mono tracking-widest uppercase transition-all ${activeTab === 'kb' ? 'bg-primary text-surface-1 shadow-sm' : 'text-main-text-muted hover:text-main-text'}`}
          >
             Knowledge Base
          </button>
        </div>
      </div>

      {activeTab === 'cortex' && (
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
                     onClick={() => {
                        const finalMatch = item.guide.split('</thought>');
                        const tMatch = item.guide.match(/<thought>([\\s\\S]*?)(<\/thought>|$)/);
                        if (tMatch) setThoughts(tMatch[1]);
                        if (finalMatch.length > 1) setResult(finalMatch[1].trim());
                        else setResult(item.guide);
                     }}
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
            
            {(result || thoughts) && (
               <div className="flex items-center gap-3">
                 <div className="flex items-center gap-1.5 px-2 py-1 bg-surface-2 border border-main-border rounded text-[9px] font-mono uppercase tracking-widest text-main-text-muted">
                    <ShieldCheck size={10} className="text-primary" />
                    <span>Status: RESOLVED</span>
                 </div>
               </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-8 relative scrollbar-thin">
            {!result && !thoughts && !loading && !isStreaming && (
               <div className="absolute inset-0 flex flex-col items-center justify-center text-main-text-muted/30">
                 <Layers size={64} className="mb-4 opacity-20" />
                 <p className="text-[11px] font-mono uppercase tracking-[0.3em]">Standby // Awaiting Inquiry</p>
               </div>
            )}
            
            {loading && !thoughts && !result && !errorMsg && (
               <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface-1/80 backdrop-blur-sm z-20">
                 <Loader2 size={48} className="text-primary animate-spin mb-6 opacity-50" />
                 <p className="text-[10px] font-mono uppercase tracking-widest text-primary animate-pulse">Initializing Diagnostic Matrix...</p>
               </div>
            )}

            {errorMsg && (
               <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface-1/90 backdrop-blur z-20 p-6">
                 <div className="bg-error/10 border border-error/30 rounded-xl p-8 max-w-lg w-full flex flex-col items-center text-center shadow-xl shadow-error/5">
                    <AlertTriangle size={48} className="text-error mb-6" />
                    <h3 className="text-sm font-mono font-bold text-error uppercase tracking-widest mb-3">Diagnostic Failure</h3>
                    <p className="text-sm text-main-text-muted leading-relaxed font-mono">{errorMsg}</p>
                    <button onClick={() => setErrorMsg(null)} className="mt-8 px-6 py-2.5 bg-error/10 border border-error/20 text-error hover:bg-error hover:text-surface-1 rounded-lg transition-all text-xs font-bold uppercase tracking-widest font-mono">Dismiss</button>
                 </div>
               </div>
            )}

            <AnimatePresence mode="wait">
              {(thoughts || result) && (
                <motion.div
                  key="output"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col gap-6"
                >
                  {thoughts && (
                    <div className="bg-surface-2/40 border border-main-border rounded-lg p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <Cpu size={14} className="text-main-text-muted animate-pulse" />
                        <h4 className="text-[10px] font-mono uppercase tracking-widest text-main-text-muted">Cortex Chain of Thought</h4>
                      </div>
                      <div className="text-sm font-mono text-main-text-muted/70 whitespace-pre-wrap leading-relaxed">
                        {thoughts}
                        {isStreaming && !result && <span className="ml-1 animate-pulse">▋</span>}
                      </div>
                    </div>
                  )}

                  {result && (
                    <div className="prose prose-invert prose-sm max-w-none prose-headings:font-display prose-headings:tracking-tight prose-a:text-primary prose-code:text-primary prose-code:bg-primary/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded markdown-body !bg-transparent">
                      <Markdown remarkPlugins={[remarkGfm]}>{result}</Markdown>
                      {isStreaming && <span className="ml-1 animate-pulse text-primary">▋</span>}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
      )}

      {activeTab === 'kb' && (
        <div className="bg-surface-1 border border-main-border rounded-xl h-[calc(100vh-250px)] min-h-[600px] flex flex-col overflow-hidden relative">
          <div className="p-6 border-b border-main-border bg-surface-2/30 relative z-10 flex gap-4 items-center">
            <ShieldCheck size={20} className="text-primary" />
            <div className="flex-1">
              <h3 className="text-sm font-mono uppercase tracking-widest font-bold text-main-text">Global Knowledge Base</h3>
              <p className="text-xs text-main-text-muted mt-1">Verified diagnostic resolutions and operational playbooks</p>
            </div>
            <div className="w-1/3">
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search history, symptoms, or resolutions..."
                className="w-full bg-surface-2 border border-main-border rounded-lg px-4 py-2 text-sm text-main-text focus:border-primary/50 outline-none transition-all"
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 scrollbar-thin grid lg:grid-cols-2 gap-4">
             {history.filter(h => h.problem.toLowerCase().includes(searchQuery.toLowerCase()) || h.guide.toLowerCase().includes(searchQuery.toLowerCase())).map((item) => (
                <div key={item.id} className="bg-surface-2/20 border border-main-border rounded-lg p-5 flex flex-col gap-4">
                   <div className="flex items-start justify-between gap-4">
                      <h4 className="text-sm font-bold text-main-text leading-snug flex-1">{item.problem}</h4>
                      <span className={`text-[9px] font-mono font-bold tracking-widest uppercase px-2 py-1 rounded shrink-0 ${
                          item.level === 'L3' ? 'bg-error/10 text-error border border-error/20' : 
                          item.level === 'L2' ? 'bg-warning/10 text-warning border border-warning/20' : 
                          'bg-primary/10 text-primary border border-primary/20'
                       }`}>
                          {item.level}
                      </span>
                   </div>
                   
                   <div className="flex items-center gap-2 text-[10px] font-mono text-main-text-muted uppercase tracking-widest">
                     <Target size={12} className="text-primary" />
                     Handling Team: {item.handlingTeam}
                   </div>

                   <div className="text-xs text-main-text-muted/80 flex-1 overflow-hidden relative">
                      <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-surface-2/20 to-transparent z-10" />
                      <div className="prose prose-invert prose-xs max-w-none text-[11px] prose-p:leading-tight h-24 overflow-hidden">
                        <Markdown remarkPlugins={[remarkGfm]}>{item.guide.split('</thought>')[1] || item.guide}</Markdown>
                      </div>
                   </div>
                   
                   <div className="pt-4 border-t border-main-border/50 flex justify-between items-center">
                     <span className="text-[10px] text-main-text-muted font-mono">{new Date(item.createdAt).toLocaleDateString()}</span>
                     <button 
                       onClick={() => {
                         setActiveTab('cortex');
                         const finalMatch = item.guide.split('</thought>');
                         const tMatch = item.guide.match(/<thought>([\\s\\S]*?)(<\/thought>|$)/);
                         if (tMatch) setThoughts(tMatch[1]);
                         if (finalMatch.length > 1) setResult(finalMatch[1].trim());
                         else setResult(item.guide);
                       }}
                       className="text-[10px] tracking-widest uppercase font-mono px-3 py-1.5 bg-surface-3 hover:bg-primary hover:text-surface-1 text-main-text rounded transition-colors"
                     >
                        View Full Playbook
                     </button>
                   </div>
                </div>
             ))}
             {history.length === 0 && (
                <div className="col-span-full h-full flex items-center justify-center text-main-text-muted/40">
                   No knowledge base entries found.
                </div>
             )}
          </div>
        </div>
      )}
    </div>
  );
}

