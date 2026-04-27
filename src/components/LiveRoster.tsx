import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { Shift, UserProfile } from '../types';
import { Clock, User as UserIcon, Calendar, Activity, Zap, Coffee } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, isToday, parse, isWithinInterval } from 'date-fns';

export function LiveRoster() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const [showActiveOnly, setShowActiveOnly] = useState(true);

  useEffect(() => {
    // Fetch last 100 shifts to ensure we cover yesterday's night shifts
    const q = query(collection(db, 'shifts'), orderBy('date', 'desc'), limit(100));
    
    const unsubShifts = onSnapshot(q, (snapshot) => {
      setShifts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Shift)));
      setLoading(false);
    });

    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const allUsers = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
      const seen = new Set();
      const uniqueUsers = allUsers.filter(u => {
        const identifier = (u.email || u.uid).toLowerCase();
        if (seen.has(identifier)) return false;
        seen.add(identifier);
        return true;
      });
      setUsers(uniqueUsers);
    });

    return () => {
      unsubShifts();
      unsubUsers();
    };
  }, []);

  const isShiftActive = (shift: Shift) => {
    const now = new Date();
    const todayStr = format(now, 'yyyy-MM-dd');
    const yesterdayStr = format(new Date(now.getTime() - 86400000), 'yyyy-MM-dd');
    
    if (shift.date !== todayStr && shift.date !== yesterdayStr) return false;
    
    try {
      const shiftDate = parse(shift.date, 'yyyy-MM-dd', new Date());
      const start = parse(shift.startTime, 'HH:mm', shiftDate);
      let end = parse(shift.endTime, 'HH:mm', shiftDate);
      
      if (end < start) {
        end = new Date(end.getTime() + 86400000); // Ends next day
      }
      
      return isWithinInterval(now, { start, end });
    } catch (e) {
      return false;
    }
  };

  const getShiftProgress = (shift: Shift) => {
    const now = new Date();
    try {
      const shiftDate = parse(shift.date, 'yyyy-MM-dd', new Date());
      const start = parse(shift.startTime, 'HH:mm', shiftDate);
      let end = parse(shift.endTime, 'HH:mm', shiftDate);
      
      if (end < start) {
        end = new Date(end.getTime() + 86400000);
      }
      
      const total = end.getTime() - start.getTime();
      const current = now.getTime() - start.getTime();
      return Math.min(Math.max((current / total) * 100, 0), 100);
    } catch (e) {
      return 0;
    }
  };

  const getStatus = (userId: string, shift: Shift) => {
    const user = users.find(u => u.uid === userId);
    if (!isShiftActive(shift)) return 'Scheduled';
    if (user?.isBreakActive) return 'On Break';
    return 'Active';
  };

  const formatTime12 = (time: string) => {
    try {
      return format(parse(time, 'HH:mm', new Date()), 'hh:mm a');
    } catch (e) {
      return time;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 w-48 bg-white/5 rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-32 bg-white/5 rounded-2xl border border-white/5" />
          ))}
        </div>
      </div>
    );
  }

  const getFilteredShifts = () => {
    const now = new Date();
    const todayStr = format(now, 'yyyy-MM-dd');
    const activeShifts = shifts.filter(isShiftActive);
    
    // If show active only, use active list. Otherwise, use all shifts from TODAY.
    const baseList = showActiveOnly ? activeShifts : shifts.filter(s => s.date === todayStr);
    const map = new Map<string, Shift>();
    
    // Sort to prioritize active shifts if multiple exist for a person
    const sorted = [...baseList].sort((a, b) => {
      const aActive = isShiftActive(a) ? 1 : 0;
      const bActive = isShiftActive(b) ? 1 : 0;
      return bActive - aActive;
    });

    sorted.forEach(s => {
      const userProfile = users.find(u => u.uid === s.userId);
      const identifier = (userProfile?.email || s.userId).toLowerCase();
      if (!map.has(identifier)) {
        map.set(identifier, s);
      }
    });
    return Array.from(map.values());
  };

  const filteredShifts = getFilteredShifts();
  const uniqueActiveCount = filteredShifts.filter(isShiftActive).length;

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-white/5 pb-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-white mb-2">Live Roster</h1>
          <p className="text-slate-400 font-medium">Real-time status of personnel currently on-shift.</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex bg-zinc-900 border border-white/5 rounded-xl">
             <select
               value={showActiveOnly ? "active" : "all"}
               onChange={(e) => setShowActiveOnly(e.target.value === "active")}
               className="bg-transparent text-white text-xs font-bold uppercase tracking-wider py-3 pl-4 pr-10 rounded-xl appearance-none cursor-pointer focus:outline-none focus:border-indigo-500 transition-colors"
               style={{ backgroundImage: "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e\")", backgroundPosition: "right 0.5rem center", backgroundRepeat: "no-repeat", backgroundSize: "1.5em 1.5em" }}
             >
               <option value="active">Active Only</option>
               <option value="all">Show All Today</option>
             </select>
          </div>
          <div className="px-6 py-3 bg-zinc-900 border border-white/5 rounded-xl flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              {uniqueActiveCount} Operational
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredShifts.length === 0 ? (
          <div className="col-span-full py-24 text-center glass-card border-dashed">
            <Activity className="mx-auto text-slate-700 mb-4" size={48} />
            <p className="text-slate-500 font-medium italic">
              {showActiveOnly ? "No personnel currently on an active shift." : "No shifts scheduled for today."}
            </p>
          </div>
        ) : (
          filteredShifts.map((shift, idx) => {
            const status = getStatus(shift.userId, shift);
            const isActive = status === 'Active';
            const onBreak = status === 'On Break';

            return (
              <motion.div
                key={shift.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className={`p-6 rounded-[2rem] border transition-all duration-300 relative overflow-hidden group ${
                  isActive ? 'bg-indigo-600/10 border-indigo-500/30' : 
                  onBreak ? 'bg-amber-500/10 border-amber-500/30' : 
                  'bg-zinc-900 border-white/5'
                }`}
              >
                {/* Visual Status indicator for active */}
                {isActive && (
                  <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 blur-3xl -mr-12 -mt-12 group-hover:bg-indigo-500/20 transition-all" />
                )}

                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg shadow-sm transition-transform group-hover:scale-105 ${
                      isActive ? 'bg-indigo-600 text-white' : 
                      onBreak ? 'bg-amber-500 text-black' : 
                      'bg-zinc-800 text-slate-400'
                    }`}>
                      {shift.userName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-lg leading-tight">{shift.userName}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[10px] font-bold uppercase tracking-[0.15em] ${
                          isActive ? 'text-indigo-400' : 
                          onBreak ? 'text-amber-500' : 
                          'text-slate-500'
                        }`}>
                          {status}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {isActive && (
                    <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
                      <Zap size={16} />
                    </div>
                  )}
                  {onBreak && (
                    <div className="p-2 bg-amber-500/10 rounded-lg text-amber-500">
                      <Coffee size={16} />
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  {isActive && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center px-1">
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Shift Completion</span>
                        <span className="text-[10px] font-bold text-white">{Math.round(getShiftProgress(shift))}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${getShiftProgress(shift)}%` }}
                          className={`h-full ${onBreak ? 'bg-amber-500' : 'bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.4)]'}`}
                        />
                      </div>
                    </div>
                  )}
                  <div className="flex items-center justify-between p-4 bg-black/20 rounded-2xl border border-white/5">
                    <div className="text-center flex-1">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Start</p>
                      <p className="text-sm font-bold text-white">{formatTime12(shift.startTime)}</p>
                    </div>
                    <div className="w-px h-6 bg-white/10" />
                    <div className="text-center flex-1">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">End</p>
                      <p className="text-sm font-bold text-white">{formatTime12(shift.endTime)}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-slate-600">
                    <Clock size={14} />
                    <span className="text-[11px] font-bold uppercase tracking-widest">{shift.type} Shift</span>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
