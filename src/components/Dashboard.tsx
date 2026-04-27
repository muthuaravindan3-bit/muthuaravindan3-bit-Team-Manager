import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Shift, Announcement, UserProfile } from '../types';
import { Calendar as CalendarIcon, Clock, Megaphone, Terminal, Activity, Zap, Layers, Users, Circle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, isToday, isWithinInterval, parse } from 'date-fns';

export function Dashboard() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'shifts'), orderBy('date', 'desc'));
    const unsubShifts = onSnapshot(q, (snapshot) => {
      const shiftData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Shift));
      setShifts(shiftData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'shifts');
    });

    const unsubAnnouncements = onSnapshot(query(collection(db, 'announcements'), orderBy('createdAt', 'desc'), limit(5)), (snapshot) => {
      setAnnouncements(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any)));
    });

    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const allUsers = snapshot.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile));
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
      unsubAnnouncements();
      unsubUsers();
    };
  }, []);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  };

  const isShiftActive = (shift: Shift) => {
    const now = new Date();
    const todayStr = format(now, 'yyyy-MM-dd');
    const yesterdayStr = format(new Date(now.getTime() - 86400000), 'yyyy-MM-dd');
    
    // Check if shift is from today or yesterday
    if (shift.date !== todayStr && shift.date !== yesterdayStr) return false;
    
    try {
      const shiftDate = parse(shift.date, 'yyyy-MM-dd', new Date());
      const start = parse(shift.startTime, 'HH:mm', shiftDate);
      let end = parse(shift.endTime, 'HH:mm', shiftDate);
      
      if (end < start) {
        // Night shift ends next day
        end = new Date(end.getTime() + 86400000);
      }
      
      return isWithinInterval(now, { start, end });
    } catch (e) {
      return false;
    }
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
      <div className="p-8 space-y-8 animate-pulse">
        <div className="h-12 w-1/4 bg-white/5 rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3].map(i => <div key={i} className="h-48 bg-white/5 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  // Deduplicate all shifts by person + date + time
  const sanitizedShifts = shifts.reduce((acc: Shift[], s) => {
    const userProfile = users.find(u => u.uid === s.userId);
    const identifier = (userProfile?.email || s.userId).toLowerCase();
    const key = `${identifier}_${s.date}_${s.startTime}_${s.endTime}`;
    if (!acc.find(prev => {
      const pProfile = users.find(u => u.uid === prev.userId);
      const pIdentifier = (pProfile?.email || prev.userId).toLowerCase();
      return `${pIdentifier}_${prev.date}_${prev.startTime}_${prev.endTime}` === key;
    })) {
      acc.push(s);
    }
    return acc;
  }, []);

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const upcomingShifts = sanitizedShifts
    .filter(s => s.date >= todayStr)
    .sort((a, b) => a.date.localeCompare(b.date));

  const groupedUpcoming = upcomingShifts.reduce((acc: Record<string, Shift[]>, shift) => {
    if (!acc[shift.date]) acc[shift.date] = [];
    acc[shift.date].push(shift);
    return acc;
  }, {});

  // Active users (deduplicated by person)
  const onDutyUsers = sanitizedShifts.filter(isShiftActive).reduce((acc: any[], current) => {
    const userProfile = users.find(u => u.uid === current.userId);
    const identifier = (userProfile?.email || current.userId).toLowerCase();
    
    if (!acc.find(u => {
      const uProfile = users.find(up => up.uid === u.userId);
      return (uProfile?.email || u.userId).toLowerCase() === identifier;
    })) {
      acc.push({
        ...current,
        isBreakActive: userProfile?.isBreakActive
      });
    }
    return acc;
  }, []);

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-white mb-2">Team Dashboard</h1>
          <p className="text-slate-400 font-medium">Overview of current schedules and announcements.</p>
        </div>
        
          <div className="flex gap-4">
            <div className="bg-zinc-900 border border-white/5 px-6 py-3 rounded-2xl shadow-sm">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Today's Shifts</p>
              <p className="text-2xl font-bold text-white">{sanitizedShifts.filter(s => s.date === todayStr).length}</p>
            </div>
            <div className="bg-zinc-900 border border-white/5 px-6 py-3 rounded-2xl shadow-sm">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">On Duty Now</p>
              <p className="text-2xl font-bold text-indigo-500">{onDutyUsers.length}</p>
            </div>
          </div>
      </div>

      {/* Live Personnel */}
      <div className="bg-zinc-900/50 border border-white/5 rounded-[2.5rem] p-8 lg:p-10">
        <div className="flex items-center justify-between mb-8">
           <div className="flex items-center gap-3">
              <Users className="text-indigo-500" size={24} />
              <h2 className="text-2xl font-bold text-white">Live Personnel</h2>
           </div>
           <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Real-time Feed</span>
           </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
           {onDutyUsers.length === 0 ? (
             <div className="col-span-full py-12 text-center border-2 border-dashed border-white/5 rounded-3xl">
                <p className="text-slate-600 font-medium italic">No personnel currently on active shift.</p>
             </div>
           ) : (
             <AnimatePresence>
               {onDutyUsers.map((user, idx) => (
                 <motion.div
                   key={user.id}
                   initial={{ opacity: 0, scale: 0.9 }}
                   animate={{ opacity: 1, scale: 1 }}
                   transition={{ delay: idx * 0.05 }}
                   className="relative group flex flex-col items-center"
                 >
                   <div className="relative mb-3">
                      <div className={`w-20 h-20 rounded-[2.5rem] bg-zinc-800 border-2 flex items-center justify-center font-bold text-2xl transition-all ${
                        user.isBreakActive ? 'border-amber-500/40 text-amber-500 bg-amber-500/5' : 'border-indigo-500/40 text-white group-hover:scale-105 shadow-lg shadow-indigo-500/10'
                      }`}>
                         {user.userName.charAt(0).toUpperCase()}
                      </div>
                      <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-4 border-zinc-900 flex items-center justify-center ${
                        user.isBreakActive ? 'bg-amber-500' : 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]'
                      }`}>
                         {user.isBreakActive ? <Clock size={12} className="text-black" /> : <Zap size={12} className="text-white" />}
                      </div>
                   </div>
                   <span className="text-sm font-bold text-white text-center leading-tight">{user.userName}</span>
                   <span className={`text-[9px] font-bold uppercase tracking-widest mt-1 ${
                     user.isBreakActive ? 'text-amber-500' : 'text-emerald-500'
                   }`}>
                     {user.isBreakActive ? 'ON BREAK' : 'ACTIVE'}
                   </span>
                 </motion.div>
               ))}
             </AnimatePresence>
           )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
        {/* Weekly Roster */}
        <div className="xl:col-span-8 space-y-8">
          <div className="flex items-center gap-3">
            <CalendarIcon className="text-indigo-500" size={20} />
            <h2 className="text-xl font-bold text-white">Upcoming Roster</h2>
          </div>

          <div className="space-y-12">
            {Object.keys(groupedUpcoming).length === 0 ? (
              <div className="py-20 text-center glass-card">
                <Terminal className="mx-auto text-slate-700 mb-4" size={40} />
                <p className="text-slate-500 font-medium italic">No upcoming shifts scheduled.</p>
              </div>
            ) : (
              Object.entries(groupedUpcoming).map(([date, dateShifts]) => (
                <div key={date} className="space-y-6">
                  <div className="flex items-center gap-4">
                    <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 bg-zinc-900/50 px-4 py-2 rounded-full border border-white/5">
                      {isToday(parse(date, 'yyyy-MM-dd', new Date())) ? 'Today' : format(parse(date, 'yyyy-MM-dd', new Date()), 'EEEE, MMM do')}
                    </h3>
                    <div className="h-px flex-1 bg-white/5" />
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    {dateShifts.map((shift, index) => {
                      const isTodayShift = isToday(parse(shift.date, 'yyyy-MM-dd', new Date()));
                      return (
                        <motion.div
                          key={shift.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className={`flex flex-col sm:flex-row sm:items-center justify-between p-6 bg-zinc-900 border border-white/5 rounded-3xl group transition-all hover:bg-zinc-800/50 ${isTodayShift ? 'border-indigo-500/30' : ''}`}
                        >
                          <div className="flex items-center gap-5 mb-4 sm:mb-0">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg shadow-sm ${
                              isTodayShift ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-500'
                            }`}>
                              {shift.userName.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                               <h4 className="font-bold text-white text-lg leading-tight">{shift.userName}</h4>
                               <div className="flex items-center gap-2 mt-1">
                                  <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded ${
                                    shift.type === 'Night' ? 'bg-indigo-500/10 text-indigo-400' :
                                    shift.type === 'Morning' ? 'bg-amber-500/10 text-amber-500' :
                                    'bg-white/5 text-slate-500'
                                  }`}>
                                     {shift.type}
                                  </span>
                                  <div className="w-1 h-1 rounded-full bg-white/10" />
                                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Rotation</span>
                               </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-4 sm:gap-8">
                             <div className="flex flex-col items-end">
                                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-1">Time Slots</p>
                                <div className="flex items-center gap-3">
                                   <span className="text-sm font-bold text-white tabular-nums">{formatTime12(shift.startTime)}</span>
                                   <div className="w-4 h-px bg-white/10" />
                                   <span className="text-sm font-bold text-white tabular-nums">{formatTime12(shift.endTime)}</span>
                                </div>
                             </div>
                             <div className={`p-3 rounded-2xl ${isTodayShift ? 'bg-indigo-500/10 text-indigo-400' : 'bg-white/5 text-slate-600'}`}>
                                <Clock size={18} />
                             </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Announcements */}
        <div className="xl:col-span-4 space-y-6">
          <div className="flex items-center gap-3">
            <Megaphone className="text-amber-500" size={20} />
            <h2 className="text-xl font-bold text-white">Announcements</h2>
          </div>

          <div className="space-y-4">
            {announcements.map((a, i) => (
              <motion.div 
                key={a.id}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className={`p-5 rounded-2xl border transition-all ${
                  a.priority === 'urgent' ? 'bg-red-500/5 border-red-500/20' : 'bg-zinc-900 border-white/5'
                }`}
              >
                <div className="flex justify-between items-center mb-3">
                  <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                    a.priority === 'urgent' ? 'bg-red-500 text-white' : 'bg-white/10 text-slate-400'
                  }`}>
                    {a.priority}
                  </span>
                  <span className="text-[10px] font-medium text-slate-600">
                    {format(a.createdAt, 'MMM d, hh:mm a')}
                  </span>
                </div>
                <p className="text-sm font-semibold text-white/90 leading-relaxed mb-4">
                  {a.content}
                </p>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold text-slate-400">
                    {a.authorName.charAt(0)}
                  </div>
                  <span className="text-xs font-bold text-slate-500">{a.authorName}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
