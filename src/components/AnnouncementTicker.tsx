import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Announcement } from '../types';
import { Megaphone, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function AnnouncementTicker() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const q = query(
      collection(db, 'announcements'),
      orderBy('createdAt', 'desc'),
      limit(5)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      setAnnouncements(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'announcements');
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    if (announcements.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % announcements.length);
    }, 8000);
    return () => clearInterval(timer);
  }, [announcements.length]);

  if (announcements.length === 0) return null;

  const current = announcements[currentIndex];

  return (
    <div className="flex-1 max-w-2xl mx-12 hidden lg:block">
      <AnimatePresence mode="wait">
        <motion.div
          key={current.id}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 10 }}
          className={`px-4 py-1.5 border flex items-center justify-between gap-4 transition-all duration-500 overflow-hidden ${
            current.priority === 'urgent' 
            ? 'bg-error text-surface-1 border-transparent shadow-[0_0_15px_rgba(var(--color-error),0.2)]' 
            : current.priority === 'high'
            ? 'bg-warning/10 border-warning text-warning'
            : 'bg-surface-2 border-main-border text-main-text-muted'
          }`}
        >
          <div className="flex items-center gap-4 min-w-0">
            <div className="flex items-center gap-2">
               <div className={`w-1.5 h-1.5 rounded-full ${current.priority === 'urgent' ? 'bg-surface-1 animate-ping' : 'bg-current opacity-30'}`} />
               <span className="text-[10px] font-mono font-bold uppercase tracking-[0.3em] whitespace-nowrap">Broadcast_Link</span>
            </div>
            <div className="h-4 w-px bg-current opacity-20" />
            <p className="text-[11px] font-sans font-medium truncate uppercase tracking-tight">{current.content}</p>
          </div>
          <div className="flex items-center gap-4">
             <div className="flex gap-1">
                {announcements.map((_, idx) => (
                  <div 
                    key={idx} 
                    className={`h-1 transition-all duration-300 ${
                      idx === currentIndex 
                        ? 'w-4 bg-current' 
                        : 'w-1 bg-current opacity-20'
                    }`} 
                  />
                ))}
             </div>
             <span className="text-[9px] font-mono opacity-50 font-bold">
               {currentIndex + 1} // {announcements.length}
             </span>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
