import React, { useState } from 'react';
import { collection, addDoc, updateDoc, doc, getDocs, deleteDoc, query, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { Shift, UserProfile, ShiftTemplate } from '../../types';
import { extractShiftsFromImage, ExtractedShift } from '../../geminiService';
import { 
  Calendar, Trash2, Shield, AlertTriangle, Upload, Loader2, Sparkles, Plus, X, Search, Filter, ClipboardCheck, Activity, Download, CheckCircle2, XCircle, ShieldAlert
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, parse, isToday, isTomorrow, startOfWeek, endOfWeek, isWithinInterval, addDays } from 'date-fns';

interface RosterManagementProps {
  users: UserProfile[];
  shifts: Shift[];
  templates: ShiftTemplate[];
  onLogAction: (action: string, targetId: string, targetName: string, details?: string) => Promise<void>;
}

export function RosterManagement({ users, shifts, templates, onLogAction }: RosterManagementProps) {
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'timeline'>('list');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'tomorrow' | 'week'>('all');
  const [timelineDate, setTimelineDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [shiftDate, setShiftDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('18:00');
  const [shiftType, setShiftType] = useState('General');
  const [isScanning, setIsScanning] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [extractedShifts, setExtractedShifts] = useState<ExtractedShift[]>([]);
  const [shiftSearch, setShiftSearch] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [selectedShiftIds, setSelectedShiftIds] = useState<string[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDedupConfirm, setShowDedupConfirm] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [dedupCount, setDedupCount] = useState(0);
  
  // Hours for timeline (0 to 23)
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const getShiftPosition = (startTime: string, endTime: string) => {
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    
    const startPos = (startH * 60 + startM) / (24 * 60) * 100;
    const endPos = (endH * 60 + endM) / (24 * 60) * 100;
    
    // Handle cross-day shift (simplified for UI)
    const width = endPos < startPos ? (100 - startPos + endPos) : (endPos - startPos);
    return { left: `${startPos}%`, width: `${width}%` };
  };

  const filteredShifts = shifts.filter(s => {
    const shiftDateObj = parse(s.date, 'yyyy-MM-dd', new Date());
    const matchesFilter = filterType === 'All' || s.type === filterType;
    const matchesSearch = s.userName.toLowerCase().includes(shiftSearch.toLowerCase());
    
    let matchesDate = true;
    if (dateFilter === 'today') matchesDate = isToday(shiftDateObj);
    else if (dateFilter === 'tomorrow') matchesDate = isTomorrow(shiftDateObj);
    else if (dateFilter === 'week') {
      const start = startOfWeek(new Date(), { weekStartsOn: 1 });
      const end = endOfWeek(new Date(), { weekStartsOn: 1 });
      matchesDate = isWithinInterval(shiftDateObj, { start, end });
    }

    return matchesFilter && matchesSearch && matchesDate;
  }).sort((a, b) => b.date.localeCompare(a.date));

  const groupedShifts = filteredShifts.reduce((acc: Record<string, Shift[]>, shift) => {
    const date = shift.date;
    if (!acc[date]) acc[date] = [];
    acc[date].push(shift);
    return acc;
  }, {});

  const formatTime12 = (time: string) => {
    try {
      return format(parse(time, 'HH:mm', new Date()), 'hh:mm a');
    } catch (e) {
      return time;
    }
  };

  const handleCreateShift = async (e: React.FormEvent) => {
    e.preventDefault();
    const userObj = users.find(u => u.uid === selectedUser);
    if (!userObj) return;

    try {
      // Find all UIDs associated with this user's email to properly deduplicate
      const userUids = users
        .filter(u => (u.email || u.uid).toLowerCase() === (userObj.email || userObj.uid).toLowerCase())
        .map(u => u.uid);

      const q = query(collection(db, 'shifts'), where('userId', 'in', userUids), where('date', '==', shiftDate));
      const existing = await getDocs(q);
      
      if (!existing.empty) {
        await updateDoc(doc(db, 'shifts', existing.docs[0].id), { 
          startTime, 
          endTime, 
          type: shiftType, 
          userName: userObj.displayName || userObj.email,
          updatedAt: Date.now() 
        });
      } else {
        await addDoc(collection(db, 'shifts'), { 
          userId: selectedUser, 
          userName: userObj.displayName || userObj.email, 
          date: shiftDate, 
          startTime, 
          endTime, 
          type: shiftType, 
          updatedAt: Date.now() 
        });
      }
      await onLogAction('ASSIGN_SHIFT', selectedUser, userObj.displayName || userObj.email, `Assigned ${shiftType} on ${shiftDate}`);
      setShiftDate('');
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'shifts');
    }
  };

  const handleBulkAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedUsers.length === 0 || !shiftDate) return;

    setIsScanning(true);
    try {
      const promises = selectedUsers.map(async (uid) => {
        const userObj = users.find(u => u.uid === uid);
        if (!userObj) return;

        const userUids = users
          .filter(u => (u.email || u.uid).toLowerCase() === (userObj.email || userObj.uid).toLowerCase())
          .map(u => u.uid);

        const q = query(collection(db, 'shifts'), where('userId', 'in', userUids), where('date', '==', shiftDate));
        const existing = await getDocs(q);

        if (!existing.empty) {
          await updateDoc(doc(db, 'shifts', existing.docs[0].id), { 
            startTime, 
            endTime, 
            type: shiftType, 
            userName: userObj.displayName || userObj.email,
            updatedAt: Date.now() 
          });
        } else {
          await addDoc(collection(db, 'shifts'), { 
            userId: uid, 
            userName: userObj.displayName || userObj.email, 
            date: shiftDate, 
            startTime, 
            endTime, 
            type: shiftType, 
            updatedAt: Date.now() 
          });
        }
      });
      await Promise.all(promises);
      await onLogAction('BULK_ASSIGN_SHIFTS', 'multiple', 'Bulk Team', `Assigned ${shiftType} to ${selectedUsers.length} users on ${shiftDate}`);
      setSelectedUsers([]);
      setShiftDate('');
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'shifts');
    } finally {
      setIsScanning(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsScanning(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const teamMembers = users.map(u => ({ uid: u.uid, name: u.displayName || u.email }));
      const result = await extractShiftsFromImage(base64, teamMembers);
      setExtractedShifts(result);
      setShowReview(true);
    } catch (err) {
      console.error("AI Scan failed", err);
    } finally {
      setIsScanning(false);
    }
  };

  const saveExtractedShifts = async () => {
    try {
      const uniqueNewShifts = extractedShifts.reduce((acc: ExtractedShift[], curr) => {
        const key = `${curr.userName}_${curr.date}`;
        if (!acc.find(s => `${s.userName}_${s.date}` === key)) acc.push(curr);
        return acc;
      }, []);

      const promises = uniqueNewShifts.map(async (s) => {
        // Try to find user by display name or email (case-insensitive)
        const user = users.find(u => 
          (u.displayName || '').toLowerCase() === s.userName.toLowerCase() || 
          (u.email || '').toLowerCase() === s.userName.toLowerCase()
        );
        
        const uid = user?.uid || 'unknown';
        if (uid !== 'unknown') {
          const userUids = users
            .filter(u => (u.email || u.uid).toLowerCase() === (user.email || user.uid).toLowerCase())
            .map(u => u.uid);

          const q = query(collection(db, 'shifts'), where('userId', 'in', userUids), where('date', '==', s.date));
          const existing = await getDocs(q);
          if (!existing.empty) {
            return updateDoc(doc(db, 'shifts', existing.docs[0].id), { 
              startTime: s.startTime, 
              endTime: s.endTime, 
              type: s.type, 
              userName: user.displayName || user.email,
              updatedAt: Date.now() 
            });
          }
        }
        return addDoc(collection(db, 'shifts'), { 
          ...s, 
          userId: uid, 
          userName: user ? (user.displayName || user.email) : s.userName,
          updatedAt: Date.now() 
        });
      });
      await Promise.all(promises);
      await onLogAction('BULK_IMPORT_SHIFTS', 'bulk', 'Multiple Users', `Imported ${uniqueNewShifts.length} shifts via Gemini Vision`);
      setExtractedShifts([]);
      setShowReview(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'shifts');
    }
  };

  const confirmDeleteAll = async () => {
    setIsScanning(true);
    setShowDeleteConfirm(false);
    try {
      const snapshot = await getDocs(query(collection(db, 'shifts')));
      const chunks = Array.from({ length: Math.ceil(snapshot.docs.length / 25) }, (_, i) => snapshot.docs.slice(i * 25, i * 25 + 25));
      for (const chunk of chunks) {
        await Promise.all(chunk.map(d => deleteDoc(doc(db, 'shifts', d.id))));
      }
      await onLogAction('DELETE_ALL_SHIFTS', 'global_roster', 'Roster Data', `Purged ${snapshot.docs.length} records`);
      setSelectedShiftIds([]);
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, 'shifts');
    } finally {
      setIsScanning(false);
    }
  };

  const confirmDeleteSelected = async () => {
    if (selectedShiftIds.length === 0) return;
    setIsScanning(true);
    setShowBulkDeleteConfirm(false);
    try {
      const chunks = Array.from({ length: Math.ceil(selectedShiftIds.length / 20) }, (_, i) => selectedShiftIds.slice(i * 20, i * 20 + 20));
      for (const chunk of chunks) {
        await Promise.all(chunk.map(id => deleteDoc(doc(db, 'shifts', id))));
      }
      await onLogAction('BATCH_DELETE_SHIFTS', 'roster', 'Admin', `Deleted ${selectedShiftIds.length} entries`);
      setSelectedShiftIds([]);
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, 'shifts');
    } finally {
      setIsScanning(false);
    }
  };

  const deduplicateShifts = () => {
    const shiftMap = new Map();
    const toDelete: string[] = [];
    shifts.forEach(s => {
      const key = `${s.userId}_${s.date}`;
      if (shiftMap.has(key)) toDelete.push(s.id);
      else shiftMap.set(key, s.id);
    });
    if (toDelete.length === 0) return alert("Clean State: No duplicates detected.");
    setDedupCount(toDelete.length);
    setShowDedupConfirm(true);
  };

  const confirmDeduplicate = async () => {
    const shiftMap = new Map();
    const toDelete: string[] = [];
    shifts.forEach(s => {
      const key = `${s.userId}_${s.date}`;
      if (shiftMap.has(key)) toDelete.push(s.id);
      else shiftMap.set(key, s.id);
    });
    setIsScanning(true);
    setShowDedupConfirm(false);
    try {
      for (const id of toDelete) await deleteDoc(doc(db, 'shifts', id));
      await onLogAction('ROSTER_CLEANUP', 'roster', 'System', `Optimized records: Removed ${toDelete.length} duplicates`);
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, 'shifts');
    } finally {
      setIsScanning(false);
    }
  };

  const exportCSV = () => {
    const headers = ['User', 'Date', 'Start', 'End', 'Type'];
    const rows = shifts.map(s => [s.userName, s.date, s.startTime, s.endTime, s.type]);
    const csvContent = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `ops_roster_${format(new Date(), 'yyyy_MM_dd')}.csv`);
    link.click();
  };

  return (
    <div className="space-y-10 pb-20">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-white/5 pb-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-white mb-2">Personnel Roster</h1>
          <p className="text-slate-400 font-medium">Manage and optimize team schedules with AI-powered scanning.</p>
        </div>
        <div className="flex gap-4">
           <div className="flex bg-zinc-900 border border-white/5 p-1 rounded-xl">
             <button 
               onClick={() => setViewMode('list')}
               className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${viewMode === 'list' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}
             >
               List View
             </button>
             <button 
               onClick={() => setViewMode('timeline')}
               className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${viewMode === 'timeline' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}
             >
               Timeline
             </button>
           </div>
           <button 
             onClick={exportCSV}
             className="px-5 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl transition-all flex items-center gap-2.5 border border-white/5 text-xs font-bold uppercase tracking-wider"
           >
             <Download size={16} className="text-slate-500" />
             Export Data
           </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-10">
        <div className="lg:col-span-4 space-y-8">
           {/* Assignment Terminal */}
           <div className="bg-zinc-900 border border-white/5 rounded-[2rem] p-8 space-y-8 shadow-xl">
              <div className="flex justify-between items-center border-b border-white/5 pb-6">
                 <h3 className="text-sm font-bold uppercase tracking-wider text-white">{isBulkMode ? 'Bulk Assignment' : 'Single Assignment'}</h3>
                 <button onClick={() => setIsBulkMode(!isBulkMode)} className="text-[10px] font-bold uppercase text-indigo-400 hover:text-indigo-300 transition-colors">
                   Switch Mode
                 </button>
              </div>

              <form onSubmit={isBulkMode ? handleBulkAssign : handleCreateShift} className="space-y-6">
                 {isBulkMode ? (
                   <div className="space-y-3">
                      <div className="flex justify-between items-center px-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Target Team</label>
                        <button type="button" onClick={() => setSelectedUsers(selectedUsers.length === users.length ? [] : users.map(u => u.uid))} className="text-[9px] font-bold text-indigo-400 hover:text-indigo-300">
                           {selectedUsers.length === users.length ? 'DESELECT ALL' : 'SELECT ALL'}
                        </button>
                      </div>
                      <div className="max-h-56 overflow-y-auto bg-black/40 rounded-2xl p-3 border border-white/5 space-y-1 no-scrollbar">
                         {users.map(u => (
                            <label key={u.uid} className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all ${selectedUsers.includes(u.uid) ? 'bg-indigo-500/10' : 'hover:bg-white/5'}`}>
                               <input type="checkbox" checked={selectedUsers.includes(u.uid)} onChange={e => e.target.checked ? setSelectedUsers([...selectedUsers, u.uid]) : setSelectedUsers(selectedUsers.filter(id => id !== u.uid))} className="w-4 h-4 bg-transparent border-white/10 rounded accent-indigo-500" />
                               <span className="text-xs font-semibold text-slate-300">{u.displayName || u.email}</span>
                            </label>
                         ))}
                      </div>
                   </div>
                 ) : (
                   <div className="space-y-1.5">
                     <label className="text-xs font-bold text-slate-500 ml-1">Personnel</label>
                     <select required value={selectedUser} onChange={e => setSelectedUser(e.target.value)} className="w-full bg-black/40 border border-white/5 rounded-xl px-5 py-3.5 text-sm text-white outline-none focus:border-indigo-500 transition-all font-bold">
                        <option value="" className="bg-zinc-900">Choose Staff...</option>
                        {users.map(u => <option key={u.uid} value={u.uid} className="bg-zinc-900">{u.displayName || u.email}</option>)}
                     </select>
                   </div>
                 )}

                 <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 ml-1">Effective Date</label>
                    <input type="date" required value={shiftDate} onChange={e => setShiftDate(e.target.value)} className="w-full bg-black/40 border border-white/5 rounded-xl px-5 py-3.5 text-sm text-white outline-none focus:border-indigo-500 transition-all font-mono" />
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                       <label className="text-xs font-bold text-slate-500 ml-1">Start</label>
                       <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full bg-black/40 border border-white/5 rounded-xl px-5 py-3.5 text-sm text-white outline-none focus:border-indigo-500 font-mono" />
                    </div>
                    <div className="space-y-1.5">
                       <label className="text-xs font-bold text-slate-500 ml-1">End</label>
                       <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full bg-black/40 border border-white/5 rounded-xl px-5 py-3.5 text-sm text-white outline-none focus:border-indigo-500 font-mono" />
                    </div>
                 </div>

                 <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 ml-1">Shift Pattern</label>
                    <select value={shiftType} onChange={e => setShiftType(e.target.value)} className="w-full bg-black/40 border border-white/5 rounded-xl px-5 py-3.5 text-sm text-white outline-none focus:border-indigo-500 transition-all font-bold">
                        {['General', 'Morning', '2nd Shift', 'Night', 'WO', 'CO', 'AL', 'CH'].map(t => <option key={t} value={t} className="bg-zinc-900 font-bold">{t}</option>)}
                    </select>
                 </div>

                 <button type="submit" className="btn-primary w-full py-4 rounded-xl font-bold text-xs uppercase tracking-widest active:scale-95 transition-all shadow-xl shadow-indigo-600/20">
                    Update Schedule
                 </button>
              </form>
           </div>

           {/* AI Scanning Module */}
           <div className="bg-zinc-900 border border-white/5 rounded-[2rem] p-8 relative overflow-hidden group shadow-lg">
              <div className="absolute inset-0 bg-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative z-10 flex flex-col items-center text-center space-y-5">
                 <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 group-hover:scale-105 transition-transform shadow-inner">
                    <Sparkles size={24} />
                 </div>
                 <div className="space-y-1">
                    <h4 className="text-lg font-bold text-white">Gemini Vision Scan</h4>
                    <p className="text-xs font-medium text-slate-500 leading-relaxed">Instantly extract schedules from image uploads.</p>
                 </div>
                 <label className={`w-full py-4 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-3 ${isScanning ? 'bg-white/5 text-slate-700 pointer-events-none' : 'bg-white/5 text-indigo-400 hover:bg-white/10 border border-indigo-500/20'}`}>
                    {isScanning ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
                    <span>{isScanning ? 'Scanning...' : 'Upload Image'}</span>
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                 </label>
              </div>
           </div>
        </div>

        <div className="lg:col-span-8 space-y-6">
           {viewMode === 'timeline' ? (
             <div className="bg-zinc-900 border border-white/5 rounded-[2.5rem] p-8 space-y-8 overflow-hidden">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Calendar className="text-indigo-400" size={20} />
                    <h3 className="text-lg font-bold text-white">Daily Timeline</h3>
                  </div>
                  <input 
                    type="date" 
                    value={timelineDate} 
                    onChange={e => setTimelineDate(e.target.value)}
                    className="bg-black/40 border border-white/5 rounded-xl px-4 py-2 text-sm text-white outline-none focus:border-indigo-500 font-mono"
                  />
                </div>

                <div className="relative mt-12 min-w-[800px]">
                   {/* Time Headers */}
                   <div className="grid grid-cols-24 border-b border-white/5 pb-4 mb-4">
                      {hours.map(h => (
                        <div key={h} className="text-[9px] font-bold text-slate-600 text-center uppercase tracking-tighter">
                          {h % 12 === 0 ? 12 : h % 12}{h < 12 ? 'am' : 'pm'}
                        </div>
                      ))}
                   </div>

                   {/* Grid Lines */}
                   <div className="absolute inset-x-0 top-12 bottom-0 pointer-events-none flex">
                      {hours.map(h => (
                        <div key={h} className="flex-1 border-r border-white/5" />
                      ))}
                   </div>

                   {/* User Rows */}
                   <div className="space-y-4 relative z-10">
                      {users.map(u => {
                        const userShifts = shifts.filter(s => s.userId === u.uid && s.date === timelineDate);
                        if (userShifts.length === 0) return null;

                        return (
                          <div key={u.uid} className="flex items-center group">
                            <div className="w-32 pr-4 flex-shrink-0">
                               <p className="text-xs font-bold text-white truncate">{u.displayName || u.email}</p>
                            </div>
                            <div className="flex-1 h-10 bg-white/5 rounded-xl relative border border-white/5">
                               {userShifts.map(s => {
                                 const pos = getShiftPosition(s.startTime, s.endTime);
                                 return (
                                   <div 
                                     key={s.id}
                                     style={pos}
                                     className="absolute top-1 bottom-1 bg-indigo-600/80 border border-indigo-400/30 rounded-lg flex items-center justify-center p-1 overflow-hidden"
                                     title={`${s.type}: ${s.startTime} - ${s.endTime}`}
                                   >
                                      <span className="text-[8px] font-bold text-white uppercase truncate">{s.type}</span>
                                   </div>
                                 );
                               })}
                            </div>
                          </div>
                        );
                      })}
                      {users.filter(u => shifts.some(s => s.userId === u.uid && s.date === timelineDate)).length === 0 && (
                        <div className="py-20 text-center">
                          <Activity className="mx-auto text-slate-800 mb-4" />
                          <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">No shifts for this date</p>
                        </div>
                      )}
                   </div>
                </div>
             </div>
           ) : (
             <>
               {/* Date Filters */}
           <div className="flex flex-wrap items-center justify-between gap-6 bg-zinc-900/50 border border-white/5 rounded-3xl p-4 px-6 shadow-sm">
              <div className="flex items-center gap-4">
                 <div className="flex items-center gap-2">
                     <Filter size={16} className="text-slate-500" />
                     <select 
                       value={dateFilter}
                       onChange={(e) => setDateFilter(e.target.value as any)}
                       className="bg-black/40 text-white text-[10px] font-bold uppercase tracking-widest py-2 pl-4 pr-8 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all border border-white/5"
                       style={{ backgroundImage: "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e\")", backgroundPosition: "right 0.5rem center", backgroundRepeat: "no-repeat", backgroundSize: "1.5em 1.5em" }}
                     >
                        <option value="all">All Time</option>
                        <option value="today">Today</option>
                        <option value="tomorrow">Tomorrow</option>
                        <option value="week">This Week</option>
                     </select>
                 </div>
                 <div className="flex items-center gap-2">
                     <select 
                       value={filterType}
                       onChange={(e) => setFilterType(e.target.value)}
                       className="bg-black/40 text-white text-[10px] font-bold uppercase tracking-widest py-2 pl-4 pr-8 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all border border-white/5"
                       style={{ backgroundImage: "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e\")", backgroundPosition: "right 0.5rem center", backgroundRepeat: "no-repeat", backgroundSize: "1.5em 1.5em" }}
                     >
                        <option value="All">All Types</option>
                        <option value="Morning">Morning</option>
                        <option value="Night">Night</option>
                        <option value="WO">WO</option>
                     </select>
                 </div>
              </div>
              
              <div className="flex gap-3">
                 <button onClick={deduplicateShifts} className="px-4 py-2 rounded-xl bg-amber-500/10 text-amber-500 font-bold text-[10px] uppercase tracking-widest border border-amber-500/20 hover:bg-amber-500/20 transition-all">Optimization</button>
                 <button onClick={() => setShowDeleteConfirm(true)} className="px-4 py-2 rounded-xl bg-red-500/10 text-red-500 font-bold text-[10px] uppercase tracking-widest border border-red-500/20 hover:bg-red-500/20 transition-all">Safe Purge</button>
              </div>
           </div>

           <div className="space-y-12">
              {Object.keys(groupedShifts).length === 0 ? (
                <div className="py-24 text-center bg-zinc-900 rounded-[2.5rem] border border-white/5 border-dashed">
                   <Calendar className="mx-auto text-slate-800 mb-4" size={48} />
                   <p className="text-[10px] font-bold uppercase tracking-widest text-slate-700">No scheduled shifts found</p>
                </div>
              ) : (
                Object.entries(groupedShifts).map(([date, dateShifts]) => (
                  <div key={date} className="space-y-6">
                    <div className="flex items-center gap-4 px-2">
                      <div className="h-px flex-1 bg-white/5" />
                      <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 bg-zinc-900/50 px-4 py-2 rounded-full border border-white/5">
                        {isToday(parse(date, 'yyyy-MM-dd', new Date())) ? 'Today' : 
                         isTomorrow(parse(date, 'yyyy-MM-dd', new Date())) ? 'Tomorrow' : 
                         format(parse(date, 'yyyy-MM-dd', new Date()), 'EEEE, MMM do')}
                      </h3>
                      <div className="h-px flex-1 bg-white/5" />
                    </div>
                    
                    <div className="grid gap-4 sm:grid-cols-2">
                      {dateShifts.map((s, idx) => (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.01 }}
                          key={s.id} 
                          className={`bg-zinc-900 border border-white/5 rounded-[1.8rem] p-6 transition-all duration-300 group cursor-pointer ${selectedShiftIds.includes(s.id) ? 'ring-2 ring-indigo-500/30 bg-indigo-500/[0.02]' : 'hover:border-indigo-500/20 shadow-lg hover:shadow-indigo-500/5'}`}
                          onClick={() => setSelectedShiftIds(prev => prev.includes(s.id) ? prev.filter(id => id !== s.id) : [...prev, s.id])}
                        >
                           <div className="flex justify-between items-start mb-6">
                              <div className="flex items-center gap-4">
                                 <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center font-bold text-slate-600 group-hover:bg-indigo-500/10 group-hover:text-indigo-400 group-hover:border-indigo-500/20 transition-all">
                                    {s.userName.slice(0, 2).toUpperCase()}
                                 </div>
                                 <div>
                                    <h4 className="font-bold text-white group-hover:text-indigo-400 transition-colors tracking-tight text-base">{s.userName}</h4>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <p className={`text-[10px] font-bold uppercase tracking-widest ${
                                        s.type === 'Night' ? 'text-indigo-400' :
                                        s.type === 'Morning' ? 'text-amber-500' :
                                        s.type === 'WO' ? 'text-emerald-500' : 'text-slate-500'
                                      }`}>{s.type}</p>
                                      <span className="w-1 h-1 rounded-full bg-white/10" />
                                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                        {formatTime12(s.startTime)} - {formatTime12(s.endTime)}
                                      </p>
                                    </div>
                                 </div>
                              </div>
                           </div>
                           
                           <div className="flex justify-between items-center border-t border-white/5 pt-4">
                              <div className="flex items-center gap-3">
                                 {selectedShiftIds.includes(s.id) ? (
                                   <div className="flex items-center gap-2 px-3 py-1 bg-indigo-500/10 rounded-full border border-indigo-500/20">
                                     <CheckCircle2 size={10} className="text-indigo-400" />
                                     <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest">Selected</span>
                                   </div>
                                 ) : (
                                   <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/5">
                                      <Activity size={10} className="text-slate-600" />
                                      <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">Awaiting Pulse</span>
                                   </div>
                                 )}
                              </div>
                              <button 
                                 onClick={(e) => { e.stopPropagation(); deleteDoc(doc(db, 'shifts', s.id)); onLogAction('DELETE_SHIFT', s.id, s.userName, `Removed manually`); }}
                                 className="p-2 text-slate-700 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                              >
                                 <Trash2 size={16} />
                              </button>
                           </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                ))
              )}
           </div>
           </>
           )}
        </div>
      </div>

      {/* AI Scan Review Modal */}
      <AnimatePresence>
        {showReview && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowReview(false)} className="fixed inset-0 bg-black/80 backdrop-blur-md" />
             <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-zinc-900 rounded-[2.5rem] border border-white/10 p-10 w-full max-w-2xl relative z-10 shadow-3xl">
                <div className="flex justify-between items-center mb-10">
                   <div>
                      <h3 className="text-2xl font-bold text-white mb-1">Schedule Review</h3>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{extractedShifts.length} assignments detected</p>
                   </div>
                   <button onClick={() => setShowReview(false)} className="text-slate-500 hover:text-white transition-colors">
                      <XCircle size={28} />
                   </button>
                </div>
                <div className="max-h-[50vh] overflow-y-auto space-y-3 no-scrollbar mb-10">
                   {extractedShifts.map((s, i) => (
                      <div key={i} className="bg-black/20 border border-white/5 p-5 rounded-2xl flex justify-between items-center">
                         <div>
                            <p className="font-bold text-white text-sm mb-0.5">{s.userName}</p>
                            <p className="text-xs font-medium text-slate-500">{s.date} • <span className="font-mono text-indigo-400">{formatTime12(s.startTime)}-{formatTime12(s.endTime)}</span></p>
                         </div>
                         <div className="px-3 py-1 rounded-lg bg-indigo-500/10 text-indigo-400 text-[10px] font-bold uppercase tracking-widest">{s.type}</div>
                      </div>
                   ))}
                </div>
                <button onClick={saveExtractedShifts} className="btn-primary w-full py-5 rounded-2xl font-bold text-sm uppercase tracking-widest shadow-2xl shadow-indigo-600/20 active:scale-[0.98] transition-all">Confirm Import</button>
             </motion.div>
          </div>
         )}
      </AnimatePresence>

      {/* Confirmation Modals */}
      <AnimatePresence>
        {showDeleteConfirm && (
           <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowDeleteConfirm(false)} className="fixed inset-0 bg-black/90 backdrop-blur-xl" />
              <div className="relative z-10 text-center space-y-8 max-w-sm">
                 <div className="w-24 h-24 bg-red-500/10 rounded-[3rem] flex items-center justify-center mx-auto text-red-500 border border-red-500/20 shadow-2xl">
                    <Trash2 size={48} />
                 </div>
                 <h4 className="text-3xl font-black italic text-white tracking-tighter uppercase">Total Purge?</h4>
                 <p className="text-white/20 font-black text-[10px] uppercase tracking-widest leading-loose">Permanent deletion of all personnel roster records. This operation cannot be reversed.</p>
                 <div className="flex gap-4">
                    <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-5 rounded-3xl bg-white/5 text-white/40 font-black text-[10px] uppercase tracking-widest hover:bg-white/10 transition-all">Abort</button>
                    <button onClick={confirmDeleteAll} className="flex-1 py-5 rounded-3xl bg-red-600 text-white font-black text-[10px] uppercase tracking-widest shadow-2xl shadow-red-500/30">Confirm Purge</button>
                 </div>
              </div>
           </div>
        )}

        {showDedupConfirm && (
           <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowDedupConfirm(false)} className="fixed inset-0 bg-black/90 backdrop-blur-xl" />
              <div className="relative z-10 text-center space-y-8 max-w-sm">
                 <div className="w-24 h-24 bg-amber-500/10 rounded-[3rem] flex items-center justify-center mx-auto text-amber-500 border border-amber-500/20 shadow-2xl">
                    <ShieldAlert size={48} />
                 </div>
                 <h4 className="text-3xl font-black italic text-white tracking-tighter uppercase">Refine Stream?</h4>
                 <p className="text-white/20 font-black text-[10px] uppercase tracking-widest leading-loose">Found {dedupCount} overlapping anomalies. Optimize dataset for clean operational flow?</p>
                 <div className="flex gap-4">
                    <button onClick={() => setShowDedupConfirm(false)} className="flex-1 py-5 rounded-3xl bg-white/5 text-white/40 font-black text-[10px] uppercase tracking-widest hover:bg-white/10 transition-all">Abort</button>
                    <button onClick={confirmDeduplicate} className="flex-1 py-5 rounded-3xl bg-amber-500 text-black font-black text-[10px] uppercase tracking-widest shadow-2xl shadow-amber-500/30">Optimize Map</button>
                 </div>
              </div>
           </div>
        )}
      </AnimatePresence>
    </div>
  );
}
