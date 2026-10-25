import React, { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { ShieldAlert, Terminal, Lock, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SystemState {
  lockdownActive: boolean;
  alertLevel: 'normal' | 'elevated' | 'critical';
  updatedAt: number;
}

export function SystemGuardian() {
  const [state, setState] = useState<SystemState | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'system', 'state'), (snap) => {
      if (snap.exists()) {
        setState(snap.data() as SystemState);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'system/state');
    });
    return unsub;
  }, []);

  if (!state?.lockdownActive) return null;

  return (
    <div className="fixed inset-0 z-[1000] pointer-events-none">
      <AnimatePresence>
        {state.lockdownActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-error/20 backdrop-blur-md flex items-center justify-center pointer-events-auto"
          >
             {/* Scanning lines */}
             <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
                <div className="w-full h-[1px] bg-error absolute animate-scan" style={{ top: '20%' }} />
                <div className="w-full h-[1px] bg-error absolute animate-scan" style={{ top: '50%' }} />
                <div className="w-full h-[1px] bg-error absolute animate-scan" style={{ top: '80%' }} />
             </div>

             <motion.div 
               initial={{ scale: 0.9, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               className="max-w-md w-full bg-black border-2 border-error p-8 space-y-6 text-center m-4 shadow-[0_0_50px_rgba(var(--color-error),0.3)]"
             >
                <div className="flex justify-center">
                   <div className="w-20 h-20 rounded-full bg-error/10 flex items-center justify-center border border-error animate-pulse">
                      <ShieldAlert size={40} className="text-error" />
                   </div>
                </div>

                <div className="space-y-2">
                   <h1 className="text-2xl font-mono font-bold text-error uppercase tracking-[0.2em]">PROTOCOL_LOCKDOWN</h1>
                   <p className="text-[10px] font-mono text-error/60 uppercase tracking-widest">Administrative_Override_Active</p>
                </div>

                <div className="p-4 bg-error/5 border border-error/20 rounded divide-y divide-error/10">
                   <div className="py-2 flex justify-between items-center text-[10px] font-mono">
                      <span className="text-error/40 uppercase">System_State</span>
                      <span className="text-error font-bold uppercase">Enforced</span>
                   </div>
                   <div className="py-2 flex justify-between items-center text-[10px] font-mono">
                      <span className="text-error/40 uppercase">Node_Access</span>
                      <span className="text-error font-bold uppercase">Restricted</span>
                   </div>
                   <div className="py-2 flex justify-between items-center text-[10px] font-mono">
                      <span className="text-error/40 uppercase">Personnel_Status</span>
                      <span className="text-error font-bold uppercase">Hold_Station</span>
                   </div>
                </div>

                <div className="flex items-center gap-3 bg-error/10 p-3 border border-error/30">
                   <AlertTriangle size={16} className="text-error animate-bounce" />
                   <p className="text-[9px] font-mono text-error uppercase leading-tight text-left italic">
                     Terminal access suspended by high-level authority. Await further directives via encrypted channels.
                   </p>
                </div>

                <div className="pt-4 flex justify-center gap-4">
                   <div className="flex items-center gap-2 text-[8px] font-mono text-error/30 uppercase tracking-[0.3em]">
                      <Terminal size={10} />
                      Monitoring_Active
                   </div>
                   <div className="flex items-center gap-2 text-[8px] font-mono text-error/30 uppercase tracking-[0.3em]">
                      <Lock size={10} />
                      Secure_Link
                   </div>
                </div>
             </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
