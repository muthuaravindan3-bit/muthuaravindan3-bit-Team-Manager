import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
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
    <div className="flex-1 max-w-2xl mx-12 hidden md:block">
      <AnimatePresence mode="wait">
        <motion.div
          key={current.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className={`px-4 py-2 rounded-full border flex items-center justify-between gap-4 transition-colors ${
            current.priority === 'urgent' 
            ? 'bg-red-50 border-red-200 text-red-700' 
            : current.priority === 'high'
            ? 'bg-amber-50 border-amber-200 text-amber-700'
            : 'bg-[#141414]/5 border-[#141414]/10 text-[#141414]/60'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <Megaphone size={14} className={current.priority === 'urgent' ? 'animate-bounce' : ''} />
            <span className="text-[10px] font-bold uppercase tracking-widest whitespace-nowrap">Broadcast:</span>
            <p className="text-xs font-medium truncate">{current.content}</p>
          </div>
          <div className="flex items-center gap-2">
             <span className="text-[9px] font-mono opacity-50 whitespace-nowrap">{announcements.length > 1 && `${currentIndex + 1}/${announcements.length}`}</span>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
