import React, { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, doc, getDocs, deleteDoc, query, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { Shift, UserProfile, ShiftTemplate, Mission } from '../../types';
import { extractShiftsFromImage, ExtractedShift, suggestTeamRoster, SuggestedRosterShift, suggestConflictFixes, RosterConflictFix } from '../../geminiService';
import { 
  Calendar, Trash2, Shield, AlertTriangle, Upload, Loader2, Sparkles, Plus, X, Search, Filter, ClipboardCheck, Activity, Download, CheckCircle2, XCircle, ShieldAlert, Pen, Brain, ChevronRight, ArrowRightLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, parse, isToday, isTomorrow, startOfWeek, endOfWeek, isWithinInterval, addDays, subDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, subMonths, addMonths } from 'date-fns';
import { useTimezone } from '../../TimezoneContext';

interface RosterManagementProps {
  users: UserProfile[];
  shifts: Shift[];
  templates: ShiftTemplate[];
  onLogAction: (action: string, targetId: string, targetName: string, details?: string) => Promise<void>;
}

export function RosterManagement({ users, shifts: rawShifts, templates, onLogAction }: RosterManagementProps) {
  const { convertToUserTime, convertToAppTime } = useTimezone();
  
  // Map shifts to user timezone for display
  const shifts = React.useMemo(() => {
    return rawShifts.map(s => {
      const start = convertToUserTime(s.date, s.startTime);
      const end = convertToUserTime(s.date, s.endTime);
      return { ...s, date: start.date, startTime: start.time, endTime: end.time };
    });
  }, [rawShifts, convertToUserTime]);

  const [isBulkMode, setIsBulkMode] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [viewMode, setViewMode] = useState<'calendar' | 'timeline' | 'list'>('calendar');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'tomorrow' | 'week'>('all');
  const [timelineDate, setTimelineDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [shiftDate, setShiftDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('18:00');
  const [shiftType, setShiftType] = useState('General');
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
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
  const [scanText, setScanText] = useState('Uploading...');
  const [isAIPlanning, setIsAIPlanning] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<SuggestedRosterShift[]>([]);
  const [showAISuggestions, setShowAISuggestions] = useState(false);
  const [isResolvingConflicts, setIsResolvingConflicts] = useState(false);
  const [conflictFixes, setConflictFixes] = useState<RosterConflictFix[]>([]);
  const [showConflictFixes, setShowConflictFixes] = useState(false);

  useEffect(() => {
    if (!isScanning) return;
    let index = 0;
    const states = ['Uploading...', 'Scanning...', 'Collecting...'];
    setScanText(states[0]);
    const interval = setInterval(() => {
      index = (index + 1) % states.length;
      setScanText(states[index]);
    }, 1500);
    return () => clearInterval(interval);
  }, [isScanning]);
  
  // Hours for timeline (0 to 23)
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const renderGanttShift = (s: Shift) => {
    const [startH, startM] = (s.startTime || '00:00').split(':').map(Number);
    const [endH, endM] = (s.endTime || '00:00').split(':').map(Number);
    
    const startPos = (startH * 60 + startM) / (24 * 60) * 100;
    const endPos = (endH * 60 + endM) / (24 * 60) * 100;
    
    const getBgColor = (type: string) => {
      switch (type) {
        case 'Night': return 'bg-primary border-primary shadow-primary/20 text-main-text';
        case 'Morning': return 'bg-warning border-warning/80 shadow-warning/20 text-main-text';
        case 'WO': return 'bg-success border-success/80 shadow-success/20 text-main-text';
        case 'AL': return 'bg-purple-500 border-purple-400 shadow-purple-500/20 text-main-text';
        case 'CH': return 'bg-rose-500 border-rose-400 shadow-rose-500/20 text-main-text';
        default: return 'bg-info border-info/80 shadow-info/20 text-main-text';
      }
    };

    const colorClass = getBgColor(s.type);

    const renderBlock = (left: string, width: string, isStart: boolean, isEnd: boolean) => (
      <div 
        style={{ left, width }}
        className={`absolute inset-y-1.5 border flex items-center px-2 sm:px-3 overflow-hidden shadow-lg ${colorClass} ${!isStart ? 'rounded-l-none border-l-0' : 'rounded-l-lg'} ${!isEnd ? 'rounded-r-none border-r-0' : 'rounded-r-lg'}`}
        title={`${s.type}: ${s.startTime} - ${s.endTime}`}
        key={`${s.id}-${isStart ? 'start' : 'end'}`}
      >
        <div className={`flex flex-col sm:flex-row sm:items-center truncate ${!isStart && !isEnd ? 'hidden' : ''}`}>
           <span className="text-[10px] font-bold tracking-widest uppercase">
             {s.type}
           </span>
           <span className="opacity-70 font-mono text-[9px] sm:ml-1 mt-0.5 sm:mt-0">
             ({formatTime12(s.startTime)}-{formatTime12(s.endTime)})
           </span>
        </div>
      </div>
    );

    if (endPos < startPos && endPos > 0) {
      // Cross-day shift: render two blocks
      return (
        <React.Fragment key={s.id}>
          {renderBlock(`${startPos}%`, `${100 - startPos}%`, true, false)}
          {renderBlock(`0%`, `${endPos}%`, false, true)}
        </React.Fragment>
      );
    }

    const width = endPos - startPos;
    return renderBlock(`${startPos}%`, `${width}%`, true, true);
  };

  const filteredShifts = shifts.filter(s => {
    const shiftDateObj = parse(s.date || '2000-01-01', 'yyyy-MM-dd', new Date());
    const matchesFilter = filterType === 'All' || s.type === filterType;
    const matchesSearch = (s.userName || '').toLowerCase().includes(shiftSearch.toLowerCase());
    
    let matchesDate = true;
    if (viewMode !== 'calendar') {
      if (dateFilter === 'today') matchesDate = isToday(shiftDateObj);
      else if (dateFilter === 'tomorrow') matchesDate = isTomorrow(shiftDateObj);
      else if (dateFilter === 'week') {
        const start = startOfWeek(new Date(), { weekStartsOn: 1 });
        const end = endOfWeek(new Date(), { weekStartsOn: 1 });
        matchesDate = isWithinInterval(shiftDateObj, { start, end });
      }
    }

    return matchesFilter && matchesSearch && matchesDate;
  }).sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const groupedShifts = filteredShifts.reduce((acc: Record<string, Shift[]>, shift) => {
    const date = shift.date || '2000-01-01';
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

  const getShiftColorClass = (type: string) => {
    switch (type) {
      case 'Night': return 'bg-primary/10 text-primary border border-primary/20';
      case 'Morning': return 'bg-warning/10 text-warning border border-warning/20';
      case 'WO': return 'bg-success/10 text-success border border-success/20';
      case 'AL': return 'bg-purple-500/10 text-purple-400 border border-purple-500/20';
      case 'CH': return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
      default: return 'bg-info/10 text-info border border-info/20';
    }
  };

  const handleEditClick = (s: Shift) => {
    setSelectedUser(s.userId);
    setShiftDate(s.date);
    setStartTime(s.startTime);
    setEndTime(s.endTime);
    setShiftType(s.type);
    setIsBulkMode(false);
    setEditingShiftId(s.id);
    
    // Scroll to form on mobile or desktop
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleUserSelect = (uid: string) => {
    setSelectedUser(uid);
    const userShifts = shifts.filter(s => s.userId === uid).sort((a, b) => b.date.localeCompare(a.date));
    if (userShifts.length > 0) {
      const ls = userShifts[0];
      setStartTime(ls.startTime);
      setEndTime(ls.endTime);
      setShiftType(ls.type);
    }
  };

  const handleShiftTypeChange = (type: string) => {
    setShiftType(type);
    const template = templates.find(t => t.type === type || t.name === type);
    if (template) {
      setStartTime(template.startTime);
      setEndTime(template.endTime);
    } else {
      switch (type) {
        case 'Morning': setStartTime('06:00'); setEndTime('14:00'); break;
        case '2nd Shift': setStartTime('14:00'); setEndTime('22:00'); break;
        case 'Night': setStartTime('22:00'); setEndTime('06:00'); break;
        case 'General': setStartTime('09:00'); setEndTime('18:00'); break;
      }
    }
  };

  const handleCreateShift = async (e: React.FormEvent) => {
    e.preventDefault();
    const userObj = users.find(u => u.uid === selectedUser);
    if (!userObj) return;
    
    if (new Date(shiftDate) < new Date(new Date().setHours(0,0,0,0))) {
       if (!window.confirm('The selected date is in the past. Are you sure you want to proceed?')) {
          return;
       }
    }

    try {
      if (editingShiftId) {
        // Direct edit
        await updateDoc(doc(db, 'shifts', editingShiftId), {
          userId: selectedUser,
          userName: userObj.displayName || userObj.email,
          date: shiftDate,
          startTime,
          endTime,
          type: shiftType,
          updatedAt: Date.now()
        });
        await onLogAction('UPDATE_SHIFT', editingShiftId, userObj.displayName || userObj.email, `Updated shift for ${shiftDate}`);
        setEditingShiftId(null);
        setShiftDate('');
        return;
      }

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

    if (new Date(shiftDate) < new Date(new Date().setHours(0,0,0,0))) {
       if (!window.confirm('The selected date is in the past. Are you sure you want to proceed?')) {
          return;
       }
    }

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

  const updateExtractedShift = (index: number, field: keyof ExtractedShift, value: string) => {
    const updated = [...extractedShifts];
    updated[index] = { ...updated[index], [field]: value };
    setExtractedShifts(updated);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsScanning(true);
    try {
      const { base64, mimeType } = await new Promise<{base64: string, mimeType: string}>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve({
            base64: result.split(',')[1],
            mimeType: file.type || 'image/jpeg'
          });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const teamMembers = users.map(u => ({ uid: u.uid, name: u.displayName || u.email }));
      const result = await extractShiftsFromImage(base64, mimeType, teamMembers);
      console.log("Gemini extracted shifts:", result);
      setExtractedShifts(result);
      setShowReview(true);
    } catch (err: any) {
      console.error("AI Scan failed", err);
      if (err?.message?.includes('429')) {
        alert("The AI service is currently busy or has reached its rate limit. Please try again in a few minutes.");
      } else {
        alert("Failed to extract shifts from image. Please try again or check the console for details.");
      }
    } finally {
      setIsScanning(false);
    }
  };

  const saveExtractedShifts = async () => {
    try {
      const uniqueNewShifts = extractedShifts.reduce((acc: ExtractedShift[], curr) => {
        const key = `${curr.userId}_${curr.date}`;
        if (!acc.find(s => `${s.userId}_${s.date}` === key)) acc.push(curr);
        return acc;
      }, []);

      const promises = uniqueNewShifts.map(async (s) => {
        let uid = s.userId;
        let user = users.find(u => u.uid === uid);
        
        // Try to find user by display name or email (case-insensitive) if id fails
        if (!user && s.userName) {
            user = users.find(u => 
              (u.displayName || '').toLowerCase() === s.userName.toLowerCase() || 
              (u.email || '').toLowerCase() === s.userName.toLowerCase()
            );
            if (user) uid = user.uid;
        }
        
        uid = user?.uid || uid || 'unknown';
        if (uid !== 'unknown' && user) {
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
    setDedupCount(toDelete.length);
    if (toDelete.length === 0) return alert("Clean State: No duplicates detected.");
    setShowDedupConfirm(true);
  };

  const getConflicts = () => {
    const conflicts: any[] = [];
    const dateMap = new Map<string, Shift[]>();
    
    shifts.forEach(s => {
      if (!dateMap.has(s.date)) dateMap.set(s.date, []);
      dateMap.get(s.date)!.push(s);
    });

    dateMap.forEach((dayShifts, date) => {
      const userShifts = new Map<string, Shift[]>();
      dayShifts.forEach(s => {
        if (!userShifts.has(s.userId)) userShifts.set(s.userId, []);
        userShifts.get(s.userId)!.push(s);
      });

      userShifts.forEach((uShifts, userId) => {
        if (uShifts.length > 1) {
          conflicts.push({
            type: 'Double Booking',
            user: uShifts[0].userName,
            date,
            details: `${uShifts.length} shifts assigned`
          });
        }
      });
    });

    return conflicts;
  };

  const autoGenerateRoster = async () => {
    if (!shiftDate || selectedUsers.length === 0) {
      alert("SELECT_BASE_DATE_AND_PERSONNEL_FIRST");
      return;
    }
    
    setIsAIPlanning(true);
    try {
      const targetDate = shiftDate;
      const targetDates = [targetDate]; 
      
      const personnelPool = selectedUsers.map(uid => {
        const u = users.find(usr => usr.uid === uid);
        return {
          uid: u?.uid || '',
          name: u?.displayName || u?.email || 'Unknown',
          role: u?.role || 'member',
          availability: [] 
        };
      });

      const missionsSnap = await getDocs(query(collection(db, 'missions'), where('status', '==', 'active')));
      const activeMissions = missionsSnap.docs.map(d => ({
        title: d.data().title,
        description: d.data().description
      }));

      const suggestions = await suggestTeamRoster(personnelPool, targetDates, activeMissions);
      setAiSuggestions(suggestions);
      setShowAISuggestions(true);
    } catch (e) {
      console.error("AI Planning failed:", e);
    } finally {
      setIsAIPlanning(false);
    }
  };

  const commitAISuggestions = async () => {
    setIsAIPlanning(true);
    try {
      const promises = aiSuggestions.map(async (s) => {
        const userObj = users.find(u => u.uid === s.userId);
        if (!userObj) return;

        const q = query(collection(db, 'shifts'), where('userId', '==', s.userId), where('date', '==', s.date));
        const existing = await getDocs(q);

        if (!existing.empty) {
          await updateDoc(doc(db, 'shifts', existing.docs[0].id), {
            startTime: s.startTime,
            endTime: s.endTime,
            type: s.type,
            userName: userObj.displayName || userObj.email,
            updatedAt: Date.now()
          });
        } else {
          await addDoc(collection(db, 'shifts'), {
            userId: s.userId,
            userName: userObj.displayName || userObj.email,
            date: s.date,
            startTime: s.startTime,
            endTime: s.endTime,
            type: s.type,
            updatedAt: Date.now()
          });
        }
      });

      await Promise.all(promises);
      await onLogAction('AI_ROSTER_OPTIMIZATION', 'multiple', 'Team', `Implemented ${aiSuggestions.length} optimized shifts`);
      setShowAISuggestions(false);
      setAiSuggestions([]);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'shifts');
    } finally {
      setIsAIPlanning(false);
    }
  };

  const handleAutoResolveConflicts = async () => {
    const conflicts = getConflicts();
    if (conflicts.length === 0) {
      alert("No conflicts detected in the current roster.");
      return;
    }

    setIsResolvingConflicts(true);
    try {
      const fixes = await suggestConflictFixes(conflicts, users);
      setConflictFixes(fixes);
      setShowConflictFixes(true);
    } catch (e) {
      console.error("Conflict resolution failed:", e);
    } finally {
      setIsResolvingConflicts(false);
    }
  };

  const applyConflictFixes = async () => {
    setIsResolvingConflicts(true);
    try {
      const promises = conflictFixes.map(async (fix) => {
        if (fix.suggestedAction === 'delete') {
          await deleteDoc(doc(db, 'shifts', fix.shiftId));
        } else if (fix.suggestedAction === 'move' || fix.suggestedAction === 'shorten') {
          const updateData: any = { updatedAt: Date.now() };
          if (fix.newDate) updateData.date = fix.newDate;
          if (fix.newStartTime) updateData.startTime = fix.newStartTime;
          if (fix.newEndTime) updateData.endTime = fix.newEndTime;
          await updateDoc(doc(db, 'shifts', fix.shiftId), updateData);
        }
      });

      await Promise.all(promises);
      await onLogAction('AI_CONFLICT_RESOLUTION', 'multiple', 'System', `Applied AI fixes to ${conflictFixes.length} roster conflicts`);
      setShowConflictFixes(false);
      setConflictFixes([]);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'shifts');
    } finally {
      setIsResolvingConflicts(false);
    }
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

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
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-main-border pb-6 animate-fade-in">
        <div>
          <h2 className="text-xl font-display font-medium text-main-text flex items-center gap-2">
            <Calendar size={20} />
            Shift Roster
          </h2>
          <p className="text-sm text-main-text-muted mt-1">Manage and optimize team schedules with AI-powered scanning.</p>
        </div>
        <div className="flex gap-3">
           <div className="flex bg-surface-1 border border-main-border rounded p-1">
             <button 
               onClick={() => setViewMode('calendar')}
               className={`px-3 py-1.5 rounded text-[10px] font-mono uppercase tracking-wider transition-colors ${viewMode === 'calendar' ? 'bg-surface-2 text-main-text shadow-sm' : 'text-main-text-muted hover:text-main-text'}`}
             >
               Calendar
             </button>
             <button 
               onClick={() => setViewMode('list')}
               className={`px-3 py-1.5 rounded text-[10px] font-mono uppercase tracking-wider transition-colors ${viewMode === 'list' ? 'bg-surface-2 text-main-text shadow-sm' : 'text-main-text-muted hover:text-main-text'}`}
             >
               List
             </button>
             <button 
               onClick={() => setViewMode('timeline')}
               className={`px-3 py-1.5 rounded text-[10px] font-mono uppercase tracking-wider transition-colors ${viewMode === 'timeline' ? 'bg-surface-2 text-main-text shadow-sm' : 'text-main-text-muted hover:text-main-text'}`}
             >
               Timeline
             </button>
           </div>
           <button 
             onClick={exportCSV}
             className="px-4 py-1.5 bg-surface-1 hover:bg-surface-2 text-main-text rounded transition-colors flex items-center gap-2 border border-main-border text-[10px] font-mono uppercase tracking-wider"
           >
             <Download size={14} className="text-main-text-muted" />
             Export
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-10">
        <div className="space-y-6">
           {viewMode === 'calendar' ? (
             <div className="bg-surface-1 border border-main-border rounded-md overflow-hidden flex flex-col">
               <div className="flex items-center justify-between px-4 py-3 border-b border-main-border bg-surface-1">
                 <h2 className="text-sm font-medium text-main-text tracking-widest uppercase">{format(currentMonth, 'MMMM yyyy')}</h2>
                 <div className="flex items-center gap-3">
                    <select 
                      value={filterType}
                      onChange={(e) => setFilterType(e.target.value)}
                      className="bg-surface-2 text-main-text text-[10px] font-mono uppercase tracking-widest py-1.5 pl-3 pr-6 rounded border border-main-border mr-2 outline-none"
                    >
                       <option value="All">All Types</option>
                       <option value="Morning">Morning</option>
                       <option value="Night">Night</option>
                       <option value="WO">WO</option>
                       <option value="AL">Annual Leave</option>
                       <option value="CH">Core Hours</option>
                    </select>

                   <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="px-2 py-1 rounded border border-main-border text-main-text hover:bg-surface-2 transition-colors text-[10px] font-mono uppercase tracking-wider">Prev</button>
                   <input id="timeline-month-filter" name="timeline-month-filter" type="month" value={format(currentMonth, 'yyyy-MM')} onChange={(e) => setCurrentMonth(e.target.value ? new Date(e.target.value) : new Date())} className="bg-surface-2 border border-main-border rounded px-2 py-1 text-main-text text-[10px] uppercase font-mono outline-none" />
                   <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="px-2 py-1 rounded border border-main-border text-main-text hover:bg-surface-2 transition-colors text-[10px] font-mono uppercase tracking-wider">Next</button>
                 </div>
               </div>
               <div className="grid grid-cols-7 border-b border-main-border bg-surface-2">
                 {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                   <div key={day} className="py-2 text-center text-[10px] font-mono text-main-text uppercase tracking-widest border-r border-main-border last:border-0">{day}</div>
                 ))}
               </div>
               <div className="grid grid-cols-7 auto-rows-[minmax(120px,auto)] bg-main-border gap-[1px]">
                 {calendarDays.map((date) => {
                   const dateStr = format(date, 'yyyy-MM-dd');
                   const dayShifts = groupedShifts[dateStr] || [];
                   const isCurrentMonth = isSameMonth(date, currentMonth);
                   const isTodayDate = isToday(date);
                   
                   return (
                     <div key={dateStr} className={`bg-surface-1 flex flex-col p-2 transition-colors hover:bg-surface-2 relative ${!isCurrentMonth ? 'opacity-40' : ''}`}>
                       {isTodayDate && <div className="absolute top-0 left-0 right-0 h-[2px] bg-primary" />}
                       <div className={`text-right text-[10px] font-mono mb-2 ${isTodayDate ? 'text-primary' : 'text-main-text-muted'}`}>
                         {format(date, 'd')}
                       </div>
                       <div className="flex flex-col gap-1.5 overflow-y-auto no-scrollbar flex-1 items-stretch">
                         {dayShifts.map(s => (
                           <div key={s.id} onClick={(e) => { e.stopPropagation(); setSelectedShiftIds(prev => prev.includes(s.id) ? prev.filter(id => id !== s.id) : [...prev, s.id]) }} className={`cursor-pointer px-2 py-1.5 rounded text-[10px] font-mono flex flex-col gap-0.5 truncate transition-all ${selectedShiftIds.includes(s.id) ? 'ring-1 ring-white/50' : ''} ${getShiftColorClass(s.type)}`}>
                             <span className="truncate">{(s.userName || 'Unknown').split(' ')[0]}</span>
                             <span className="opacity-80 text-[8px] uppercase tracking-wider">{s.type}</span>
                           </div>
                         ))}
                       </div>
                     </div>
                   );
                 })}
               </div>
             </div>
           ) : viewMode === 'timeline' ? (
             <div className="bg-surface-1 border border-main-border rounded-md p-6 space-y-6">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <h3 className="text-sm font-medium text-main-text">Daily Timeline</h3>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button onClick={() => setTimelineDate(format(subDays(parse(timelineDate, 'yyyy-MM-dd', new Date()), 1), 'yyyy-MM-dd'))} className="px-2 py-1 rounded border border-main-border text-main-text hover:bg-surface-2 transition-colors text-[10px] font-mono uppercase">&lt;</button>
                    <input 
                      id="timeline-date-filter"
                      name="timeline-date-filter"
                      type="date" 
                      value={timelineDate} 
                      onChange={e => setTimelineDate(e.target.value)}
                      className="bg-surface-2 border border-main-border rounded px-3 py-1.5 text-[10px] text-main-text outline-none font-mono uppercase w-full sm:w-auto"
                    />
                    <button onClick={() => setTimelineDate(format(addDays(parse(timelineDate, 'yyyy-MM-dd', new Date()), 1), 'yyyy-MM-dd'))} className="px-2 py-1 rounded border border-main-border text-main-text hover:bg-surface-2 transition-colors text-[10px] font-mono uppercase">&gt;</button>
                  </div>
                </div>

                <div className="overflow-x-auto no-scrollbar w-full border border-main-border rounded bg-surface-1">
                   <div className="min-w-[800px] flex flex-col relative pt-4 pb-4">
                      {/* Top Header Row */}
                      <div className="flex px-4 border-b border-main-border pb-2">
                         <div className="w-40 flex-shrink-0 mr-4" /> {/* Spacer for User Avatar */}
                         <div className="flex-1 relative h-6">
                             <div className="absolute inset-0 flex">
                                {hours.map(h => (
                                  <div key={h} className="flex-1 flex justify-start items-end" style={{ transform: 'translateX(-50%)' }}>
                                     <span className="text-[9px] font-mono text-main-text-muted uppercase ml-1">
                                       {h % 12 === 0 ? 12 : h % 12}{h < 12 ? 'a' : 'p'}
                                     </span>
                                  </div>
                                ))}
                             </div>
                         </div>
                      </div>
                      
                      {/* Content Rows */}
                      <div className="relative mx-4">
                         {/* Background Grid Full Height */}
                         <div className="absolute inset-0 flex pointer-events-none z-0 mt-3">
                            <div className="w-40 flex-shrink-0 mr-4" />
                            <div className="flex-1 flex">
                               {hours.map(h => (
                                  <div key={h} className="flex-1 relative">
                                     <div className="absolute top-0 bottom-0 left-0 border-l border-main-border border-dashed" />
                                  </div>
                               ))}
                               {/* Final boundary line */}
                               <div className="absolute top-0 bottom-0 right-0 border-r border-main-border border-dashed" />
                            </div>
                         </div>

                         {/* User Rows */}
                         <div className="relative z-10 w-full flex flex-col pt-3 space-y-2">
                            {users.map(u => {
                              const userShifts = shifts.filter(s => s.userId === u.uid && s.date === timelineDate);
                              if (userShifts.length === 0) return null;

                              return (
                                <div key={u.uid} className="flex items-center group bg-surface-1 rounded border border-main-border h-12">
                                  <div className="w-40 px-3 flex-shrink-0 flex items-center gap-2 border-r border-main-border h-full bg-surface-2 rounded-l mr-4 z-20">
                                     <div className="w-6 h-6 rounded bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-mono text-[10px]">
                                       {(u.displayName || 'U').slice(0, 2).toUpperCase()}
                                     </div>
                                     <p className="text-[10px] font-mono text-main-text truncate uppercase">{u.displayName || u.email}</p>
                                  </div>
                                  <div className="flex-1 h-full relative group-hover:bg-surface-2 transition-colors">
                                     {userShifts.map(s => (
                                       <React.Fragment key={s.id}>
                                         {renderGanttShift(s)}
                                       </React.Fragment>
                                     ))}
                                  </div>
                                </div>
                              );
                            })}
                            {users.filter(u => shifts.some(s => s.userId === u.uid && s.date === timelineDate)).length === 0 && (
                              <div className="py-12 text-center relative z-10">
                                <p className="text-[10px] font-mono text-main-text-muted uppercase">No shifts scheduled for this date</p>
                              </div>
                            )}
                         </div>
                      </div>
                   </div>
                </div>
             </div>
           ) : (
             <>
               {/* Date Filters */}
           <div className="flex flex-wrap items-center justify-between gap-4 bg-surface-1 border border-main-border rounded-md p-4">
              <div className="flex items-center gap-4">
                 <div className="flex items-center gap-2">
                     <select 
                       value={dateFilter}
                       onChange={(e) => setDateFilter(e.target.value as any)}
                       className="bg-surface-2 text-main-text text-[10px] font-mono uppercase tracking-wider py-1.5 pl-3 pr-6 rounded border border-main-border outline-none min-w-[120px]"
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
                       className="bg-surface-2 text-main-text text-[10px] font-mono uppercase tracking-wider py-1.5 pl-3 pr-6 rounded border border-main-border outline-none min-w-[120px]"
                     >
                        <option value="All">All Types</option>
                        <option value="Morning">Morning</option>
                        <option value="Night">Night</option>
                        <option value="WO">WO</option>
                     </select>
                 </div>
              </div>
              
              <div className="flex gap-2">
                 <button 
                   onClick={autoGenerateRoster} 
                   disabled={isAIPlanning}
                   className="px-3 py-1.5 rounded bg-primary text-black font-mono text-[10px] uppercase tracking-wider font-bold border border-primary hover:scale-[1.02] transition-all flex items-center gap-2"
                 >
                    {isAIPlanning ? <Loader2 size={12} className="animate-spin" /> : <Brain size={12} />}
                    {isAIPlanning ? 'Processing...' : 'Smart_Generate'}
                 </button>
                 <button 
                   onClick={handleAutoResolveConflicts}
                   disabled={isResolvingConflicts}
                   className="px-3 py-1.5 rounded bg-error/10 text-error font-mono text-[10px] uppercase tracking-wider border border-error/20 hover:bg-error/20 transition-colors flex items-center gap-2"
                 >
                   {isResolvingConflicts ? <Loader2 size={12} className="animate-spin" /> : <ShieldAlert size={12} />}
                   Resolve_Conflicts
                 </button>
                 <button onClick={deduplicateShifts} className="px-3 py-1.5 rounded bg-warning/10 text-warning font-mono text-[10px] uppercase tracking-wider border border-warning/20 hover:bg-warning/20 transition-colors">Optimize</button>
                 <button onClick={() => setShowDeleteConfirm(true)} className="px-3 py-1.5 rounded bg-error-subtle text-error font-mono text-[10px] uppercase tracking-wider border border-error/20 hover:bg-error/20 transition-colors">Purge All</button>
              </div>
           </div>

           <div className="space-y-8">
              {Object.keys(groupedShifts).length === 0 ? (
                <div className="py-16 text-center bg-surface-1 border border-main-border rounded-md border-dashed">
                   <p className="text-[10px] font-mono uppercase tracking-wider text-main-text-muted">No scheduled shifts found</p>
                </div>
              ) : (
                Object.entries(groupedShifts).map(([date, dateShifts]) => (
                  <div key={date} className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="h-px flex-1 bg-main-border" />
                      <h3 className="text-[10px] font-mono uppercase tracking-wider text-main-text-muted bg-surface-1 px-3 py-1 rounded border border-main-border">
                        {isToday(parse(date, 'yyyy-MM-dd', new Date())) ? 'Today' : 
                         isTomorrow(parse(date, 'yyyy-MM-dd', new Date())) ? 'Tomorrow' : 
                         format(parse(date, 'yyyy-MM-dd', new Date()), 'EEEE, MMM do')}
                      </h3>
                      <div className="h-px flex-1 bg-main-border" />
                    </div>
                    
                    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                      {dateShifts.map((s, idx) => (
                        <motion.div 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: idx * 0.01 }}
                          key={s.id} 
                          className={`bg-surface-1 border border-main-border rounded-md p-4 transition-colors group cursor-pointer ${selectedShiftIds.includes(s.id) ? 'ring-2 ring-primary/30 bg-primary/[0.02]' : 'hover:border-primary/20'}`}
                          onClick={() => setSelectedShiftIds(prev => prev.includes(s.id) ? prev.filter(id => id !== s.id) : [...prev, s.id])}
                        >
                           <div className="flex justify-between items-start mb-4">
                              <div className="flex items-center gap-3">
                                 <div className="w-8 h-8 rounded bg-surface-2 border border-main-border flex items-center justify-center font-mono text-[10px] text-main-text group-hover:bg-primary/10 group-hover:text-primary group-hover:border-primary/20 transition-colors">
                                    {(s.userName || 'U').slice(0, 2).toUpperCase()}
                                 </div>
                                 <div className="truncate max-w-[120px]">
                                    <h4 className="font-medium text-sm text-main-text group-hover:text-primary transition-colors truncate">{s.userName || 'Unknown'}</h4>
                                    <p className={`text-[10px] font-mono uppercase tracking-wider mt-0.5 ${
                                      s.type === 'Night' ? 'text-primary' :
                                      s.type === 'Morning' ? 'text-warning' :
                                      s.type === 'WO' ? 'text-success' : 'text-main-text-muted'
                                    }`}>{s.type}</p>
                                 </div>
                              </div>
                           </div>
                           
                           {/* Mini Timeline Visualization */}
                           <div className="mb-4 space-y-1">
                             <div className="flex justify-between text-[8px] font-mono text-main-text-muted uppercase">
                               <span>00</span>
                               <span>06</span>
                               <span>12</span>
                               <span>18</span>
                               <span>24</span>
                             </div>
                             <div className="h-4 w-full bg-surface-2 rounded-sm relative overflow-hidden border border-main-border">
                               {/* Grid ticks */}
                               {[...Array(5)].map((_, i) => (
                                 <div key={i} className="absolute top-0 bottom-0 border-l border-main-border" style={{ left: `${(i / 4) * 100}%` }} />
                               ))}
                               <div 
                                 className={`absolute top-0 bottom-0 rounded-sm opacity-80 ${
                                   s.type === 'Night' ? 'bg-primary' :
                                   s.type === 'Morning' ? 'bg-warning' :
                                   s.type === 'WO' ? 'bg-success' :
                                   s.type === 'AL' ? 'bg-purple-500' :
                                   s.type === 'CH' ? 'bg-rose-500' : 'bg-info'
                                 }`}
                                 style={{
                                    ...(() => {
                                      const start = parse(s.startTime || '00:00', 'HH:mm', new Date());
                                      const end = parse(s.endTime || '00:00', 'HH:mm', new Date());
                                      const startMinutes = start.getHours() * 60 + start.getMinutes();
                                      const endMinutes = end.getHours() * 60 + end.getMinutes();
                                      
                                      if (endMinutes < startMinutes && endMinutes > 0) {
                                        // Overnight shift
                                        return { left: `${(startMinutes / (24 * 60)) * 100}%`, right: '0%' };
                                      }
                                      return {
                                        left: `${(startMinutes / (24 * 60)) * 100}%`,
                                        width: `${((endMinutes - startMinutes) / (24 * 60)) * 100}%`
                                      };
                                    })()
                                 }}
                               />
                               {/* Render second segment for overnight shift (from midnight to end) */}
                               {(() => {
                                  const start = parse(s.startTime || '00:00', 'HH:mm', new Date());
                                  const end = parse(s.endTime || '00:00', 'HH:mm', new Date());
                                  const startMinutes = start.getHours() * 60 + start.getMinutes();
                                  const endMinutes = end.getHours() * 60 + end.getMinutes();
                                  if (endMinutes < startMinutes && endMinutes > 0) {
                                    return (
                                      <div 
                                        className={`absolute top-0 bottom-0 rounded-sm opacity-80 ${
                                          s.type === 'Night' ? 'bg-primary' :
                                          s.type === 'Morning' ? 'bg-warning' :
                                          s.type === 'WO' ? 'bg-success' :
                                          s.type === 'AL' ? 'bg-purple-500' :
                                          s.type === 'CH' ? 'bg-rose-500' : 'bg-info'
                                        }`}
                                        style={{ left: '0%', width: `${(endMinutes / (24 * 60)) * 100}%` }}
                                      />
                                    );
                                  }
                                  return null;
                               })()}
                             </div>
                             <div className="text-center pt-1">
                               <span className="text-[9px] font-mono text-main-text uppercase">{s.startTime} - {s.endTime}</span>
                             </div>
                           </div>
                           
                           <div className="flex justify-between items-center border-t border-main-border pt-3">
                              <div className="flex items-center gap-3">
                                 {selectedShiftIds.includes(s.id) ? (
                                   <div className="flex items-center gap-1.5 outline outline-1 outline-primary/50 px-2 py-0.5 bg-primary/10 rounded-sm">
                                     <CheckCircle2 size={10} className="text-primary" />
                                     <span className="text-[9px] font-mono text-primary uppercase">Selected</span>
                                   </div>
                                 ) : null}
                              </div>
                              <div className="flex items-center gap-2">
                                <button 
                                   onClick={(e) => { e.stopPropagation(); handleEditClick(s); }}
                                   className="text-main-text-muted hover:text-primary transition-colors"
                                >
                                   <Pen size={14} />
                                </button>
                                <button 
                                   onClick={(e) => { e.stopPropagation(); deleteDoc(doc(db, 'shifts', s.id)); onLogAction('DELETE_SHIFT', s.id, s.userName, `Removed manually`); }}
                                   className="text-main-text-muted hover:text-error transition-colors"
                                >
                                   <Trash2 size={14} />
                                </button>
                              </div>
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

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Assignment Terminal */}
        <div className="bg-surface-1 border border-main-border rounded-md p-6 space-y-6">
           <div className="flex justify-between items-center border-b border-main-border pb-4">
              <h3 className="text-sm font-medium text-main-text">{isBulkMode ? 'Bulk Assignment' : 'Single Assignment'}</h3>
              <button onClick={() => setIsBulkMode(!isBulkMode)} className="text-[10px] font-mono uppercase text-primary hover:text-primary-hover transition-colors">
                Switch Mode
              </button>
           </div>

           <form onSubmit={isBulkMode ? handleBulkAssign : handleCreateShift} className="space-y-5">
              {isBulkMode ? (
                <div className="space-y-2">
                   <div className="flex justify-between items-center">
                     <label className="text-[10px] font-mono uppercase tracking-wider text-main-text-muted">Target Team</label>
                     <button type="button" onClick={() => setSelectedUsers(selectedUsers.length === users.length ? [] : users.map(u => u.uid))} className="text-[9px] font-mono uppercase text-primary hover:text-primary-hover">
                        {selectedUsers.length === users.length ? 'Deselect All' : 'Select All'}
                     </button>
                   </div>
                   <div className="max-h-48 overflow-y-auto bg-surface-2 rounded-md p-2 border border-main-border space-y-1 no-scrollbar">
                      {users.map(u => (
                         <label key={u.uid} className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-colors ${selectedUsers.includes(u.uid) ? 'bg-primary/10' : 'hover:bg-surface-2'}`}>
                            <input id={`user-checkbox-${u.uid}`} name="selected-users" type="checkbox" checked={selectedUsers.includes(u.uid)} onChange={e => e.target.checked ? setSelectedUsers([...selectedUsers, u.uid]) : setSelectedUsers(selectedUsers.filter(id => id !== u.uid))} className="w-3.5 h-3.5 bg-transparent border-main-border rounded accent-indigo-500" />
                            <span className="text-[10px] font-mono uppercase text-main-text">{u.displayName || u.email}</span>
                         </label>
                      ))}
                   </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-main-text-muted">Personnel</label>
                  <select required value={selectedUser} onChange={e => handleUserSelect(e.target.value)} className="w-full bg-surface-2 border border-main-border rounded px-3 py-2 text-sm text-main-text outline-none focus:border-primary transition-colors font-mono">
                     <option value="">Choose Staff...</option>
                     {users.map(u => <option key={u.uid} value={u.uid}>{u.displayName || u.email}</option>)}
                  </select>
                </div>
              )}

              <div className="space-y-1.5">
                 <label htmlFor="shift-date-input" className="text-[10px] font-mono uppercase tracking-wider text-main-text-muted">Effective Date</label>
                 <input id="shift-date-input" name="shift-date" type="date" required value={shiftDate} onChange={e => setShiftDate(e.target.value)} className="w-full bg-surface-2 border border-main-border rounded px-3 py-2 text-sm text-main-text outline-none focus:border-primary transition-colors font-mono uppercase" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1.5">
                    <label htmlFor="shift-start-time" className="text-[10px] font-mono uppercase tracking-wider text-main-text-muted">Start</label>
                    <input id="shift-start-time" name="start-time" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full bg-surface-2 border border-main-border rounded px-3 py-2 text-sm text-main-text outline-none focus:border-primary font-mono" />
                 </div>
                 <div className="space-y-1.5">
                    <label htmlFor="shift-end-time" className="text-[10px] font-mono uppercase tracking-wider text-main-text-muted">End</label>
                    <input id="shift-end-time" name="end-time" type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full bg-surface-2 border border-main-border rounded px-3 py-2 text-sm text-main-text outline-none focus:border-primary font-mono" />
                 </div>
              </div>

              <div className="space-y-1.5">
                 <label htmlFor="shift-type-select" className="text-[10px] font-mono uppercase tracking-wider text-main-text-muted">Shift Pattern</label>
                 <select id="shift-type-select" name="shift-type" value={shiftType} onChange={e => handleShiftTypeChange(e.target.value)} className="w-full bg-surface-2 border border-main-border rounded px-3 py-2 text-sm text-main-text outline-none focus:border-primary transition-colors font-mono">
                     {['General', 'Morning', '2nd Shift', 'Night', 'WO', 'CO', 'AL', 'CH'].map(t => <option key={t} value={t}>{t}</option>)}
                 </select>
              </div>

              <button type="submit" className="btn-primary w-full py-3 rounded text-[10px] uppercase font-mono tracking-wider transition-colors">
                 Update Schedule
              </button>
           </form>
        </div>

        {/* AI Scanning Module */}
        <div className="bg-surface-1 border border-main-border rounded-md p-6 relative overflow-hidden group h-fit">
           <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
           <div className="relative z-10 flex flex-col items-center text-center space-y-4">
              <div className="w-12 h-12 rounded bg-surface-2 border border-main-border flex items-center justify-center text-primary group-hover:bg-primary/10 transition-colors">
                 <Sparkles size={20} />
              </div>
              <div className="space-y-1">
                 <h4 className="text-sm font-medium text-main-text">Gemini Vision Scan</h4>
                 <p className="text-[10px] font-mono text-main-text-muted">Extract schedules from image uploads.</p>
              </div>
               <label htmlFor="ai-roster-image-upload" className={`w-full py-3 rounded text-[10px] font-mono uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-2 border ${isScanning ? 'bg-surface-2 text-main-text-muted border-main-border pointer-events-none' : 'bg-surface-2 text-primary border-primary/30 hover:bg-surface-3'}`}>
                 {isScanning ? <Loader2 className="animate-spin" size={14} /> : <Upload size={14} />}
                 <span>{isScanning ? scanText : 'Upload Image'}</span>
                 <input id="ai-roster-image-upload" name="image-upload" type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              </label>
           </div>
        </div>
      </div>

      {/* AI Scan Review Modal */}
      <AnimatePresence>
        {showConflictFixes && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowConflictFixes(false)} className="fixed inset-0 bg-surface-3/80 backdrop-blur-md" />
             <motion.div initial={{ scale: 0.98, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.98, opacity: 0 }} className="bg-surface-1 rounded-md border border-main-border p-8 w-full max-w-2xl relative z-10 shadow-xl overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-error/50 via-error to-error/50 animate-pulse" />
                <div className="flex justify-between items-center mb-8">
                   <div className="flex items-center gap-3">
                      <ShieldAlert size={20} className="text-error" />
                      <div>
                         <h3 className="text-lg font-medium text-main-text mb-1 uppercase tracking-tight italic">Conflict Resolution Matrix</h3>
                         <p className="text-[10px] font-mono text-main-text-muted uppercase tracking-wider">Operational Integrity Protocol_04</p>
                      </div>
                   </div>
                   <button onClick={() => setShowConflictFixes(false)} className="text-main-text-muted hover:text-main-text transition-colors">
                      <X size={20} />
                   </button>
                </div>
                
                <div className="space-y-4 max-h-[50vh] overflow-y-auto no-scrollbar mb-8 pr-2">
                   {conflictFixes.map((fix, idx) => {
                      const shift = shifts.find(s => s.id === fix.shiftId);
                      return (
                         <div key={idx} className="p-4 bg-surface-2 border border-main-border rounded group hover:border-error/30 transition-colors">
                            <div className="flex justify-between items-start mb-3">
                               <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded bg-surface-1 border border-main-border flex items-center justify-center font-mono text-[10px] text-error">
                                     {fix.suggestedAction === 'delete' ? <Trash2 size={12} /> : fix.suggestedAction === 'move' ? <ArrowRightLeft size={12} /> : <AlertTriangle size={12} />}
                                  </div>
                                  <div>
                                     <h4 className="text-[11px] font-mono font-bold text-main-text uppercase">{shift?.userName || 'Unknown Unit'}</h4>
                                     <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-[9px] font-mono text-main-text-muted line-through">{shift?.date}</span>
                                        <ChevronRight size={8} className="text-main-text-muted/30" />
                                        <span className="text-[9px] font-mono text-error font-bold uppercase">{fix.suggestedAction} To {fix.newDate || 'REMOVAL'}</span>
                                     </div>
                                  </div>
                               </div>
                               <span className="text-[8px] font-mono px-1.5 py-0.5 border border-error/20 text-error rounded-sm uppercase tracking-tighter">Conflict Fix</span>
                            </div>
                            <p className="text-[10px] font-sans text-main-text-muted leading-relaxed border-l border-error/20 pl-3">
                               "{fix.rationale}"
                            </p>
                         </div>
                      );
                   })}
                </div>

                <div className="flex gap-4">
                   <button onClick={() => setShowConflictFixes(false)} className="flex-1 py-4 bg-surface-2 hover:bg-surface-3 text-main-text font-mono text-[10px] uppercase tracking-widest transition-colors rounded border border-main-border">Discard</button>
                   <button 
                     onClick={applyConflictFixes} 
                     disabled={isResolvingConflicts}
                     className="flex-1 py-4 bg-error hover:bg-error-dark text-white font-mono text-[10px] uppercase tracking-widest transition-colors rounded font-bold flex items-center justify-center gap-2"
                   >
                     {isResolvingConflicts ? <Loader2 size={12} className="animate-spin" /> : <Shield size={12} />}
                     {isResolvingConflicts ? 'Correcting...' : 'Apply_Corrections'}
                   </button>
                </div>
             </motion.div>
          </div>
        )}

        {showAISuggestions && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAISuggestions(false)} className="fixed inset-0 bg-surface-3/80 backdrop-blur-md" />
             <motion.div initial={{ scale: 0.98, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.98, opacity: 0 }} className="bg-surface-1 rounded-md border border-main-border p-8 w-full max-w-2xl relative z-10 shadow-xl overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/50 via-primary to-primary/50 animate-pulse" />
                <div className="flex justify-between items-center mb-8">
                   <div className="flex items-center gap-3">
                      <Brain size={20} className="text-primary" />
                      <div>
                         <h3 className="text-lg font-medium text-main-text mb-1 uppercase tracking-tight italic">Tactical Roster Optimization</h3>
                         <p className="text-[10px] font-mono text-main-text-muted uppercase tracking-wider">Operational Strategy Protocol_09</p>
                      </div>
                   </div>
                   <button onClick={() => setShowAISuggestions(false)} className="text-main-text-muted hover:text-main-text transition-colors">
                      <X size={20} />
                   </button>
                </div>
                
                <div className="space-y-4 max-h-[50vh] overflow-y-auto no-scrollbar mb-8 pr-2">
                   {aiSuggestions.map((s, idx) => (
                      <div key={idx} className="p-4 bg-surface-2 border border-main-border rounded group hover:border-primary/30 transition-colors">
                         <div className="flex justify-between items-start mb-3">
                            <div className="flex items-center gap-3">
                               <div className="w-8 h-8 rounded bg-surface-1 border border-main-border flex items-center justify-center font-mono text-[10px] text-primary">
                                  {s.userName.slice(0, 2).toUpperCase()}
                               </div>
                               <div>
                                  <h4 className="text-[11px] font-mono font-bold text-main-text uppercase">{s.userName}</h4>
                                  <div className="flex items-center gap-2 mt-0.5">
                                     <span className="text-[9px] font-mono text-main-text-muted">{s.date}</span>
                                     <ChevronRight size={8} className="text-main-text-muted/30" />
                                     <span className="text-[9px] font-mono text-primary font-bold">{s.startTime}-{s.endTime}</span>
                                  </div>
                               </div>
                            </div>
                            <span className="text-[8px] font-mono px-1.5 py-0.5 border border-primary/20 text-primary rounded-sm uppercase tracking-tighter">{s.type}</span>
                         </div>
                         <p className="text-[10px] font-sans text-main-text-muted leading-relaxed border-l border-primary/20 pl-3">
                            "{s.rationale}"
                         </p>
                      </div>
                   ))}
                </div>

                <div className="flex gap-4">
                   <button onClick={() => setShowAISuggestions(false)} className="flex-1 py-4 bg-surface-2 hover:bg-surface-3 text-main-text font-mono text-[10px] uppercase tracking-widest transition-colors rounded border border-main-border">Discard</button>
                   <button 
                     onClick={commitAISuggestions} 
                     disabled={isAIPlanning}
                     className="flex-1 py-4 bg-primary hover:bg-primary-hover text-black font-mono text-[10px] uppercase tracking-widest transition-colors rounded font-bold flex items-center justify-center gap-2"
                   >
                     {isAIPlanning ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                     {isAIPlanning ? 'Deploying...' : 'Deploy_Plan'}
                   </button>
                </div>
             </motion.div>
          </div>
        )}

        {showReview && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowReview(false)} className="fixed inset-0 bg-surface-3/80 backdrop-blur-md" />
             <motion.div initial={{ scale: 0.98, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.98, opacity: 0 }} className="bg-surface-1 rounded-md border border-main-border p-8 w-full max-w-3xl relative z-10 shadow-xl">
                <div className="flex justify-between items-center mb-8">
                   <div>
                      <h3 className="text-lg font-medium text-main-text mb-1">Schedule Review</h3>
                      <p className="text-[10px] font-mono text-main-text-muted uppercase tracking-wider">{extractedShifts.length} assignments detected</p>
                   </div>
                   <button onClick={() => setShowReview(false)} className="text-main-text-muted hover:text-main-text transition-colors">
                      <XCircle size={20} />
                   </button>
                </div>
                <div className="max-h-[50vh] overflow-y-auto w-full no-scrollbar mb-8 overflow-x-auto border border-main-border rounded bg-surface-2">
                   <table className="w-full text-left border-collapse">
                      <thead>
                         <tr className="border-b border-main-border text-[10px] uppercase font-mono tracking-wider text-main-text-muted bg-surface-1">
                            <th className="p-3 font-normal">User Name</th>
                            <th className="p-3 font-normal">Date</th>
                            <th className="p-3 font-normal">Start</th>
                            <th className="p-3 font-normal">End</th>
                            <th className="p-3 font-normal">Type</th>
                            <th className="p-3 text-center font-normal">Conf.</th>
                         </tr>
                      </thead>
                      <tbody>
                         {extractedShifts.map((s, i) => (
                            <tr key={i} className={`border-b border-main-border last:border-0 hover:bg-surface-1 transition-colors ${s.confidenceScore && s.confidenceScore < 80 ? 'bg-warning/5 relative group' : ''}`}
                                title={s.confidenceScore && s.confidenceScore < 80 ? `Low confidence extraction (${s.confidenceScore}%). Please verify this row's accuracy.` : ''}
                            >
                               <td className="p-2 relative min-w-[120px]">
                                  {s.confidenceScore && s.confidenceScore < 80 && (
                                    <div className="absolute left-0 top-1/2 -translate-y-1/2 -ml-2 text-warning hidden group-hover:block" title="Low confidence extraction">
                                       <AlertTriangle size={12} />
                                    </div>
                                  )}
                                  <input 
                                     value={s.userName} 
                                     onChange={(e) => updateExtractedShift(i, 'userName', e.target.value)}
                                     className={`w-full bg-transparent border rounded px-2 py-1.5 text-xs text-main-text focus:border-primary outline-none ${s.confidenceScore && s.confidenceScore < 80 ? 'border-warning/40' : 'border-transparent hover:border-main-border'}`}
                                  />
                               </td>
                               <td className="p-2 min-w-[130px]">
                                  <input 
                                     type="date"
                                     value={s.date} 
                                     onChange={(e) => updateExtractedShift(i, 'date', e.target.value)}
                                     className={`w-full bg-transparent border rounded px-2 py-1.5 text-xs text-main-text focus:border-primary outline-none font-mono uppercase ${s.confidenceScore && s.confidenceScore < 80 ? 'border-warning/40' : 'border-transparent hover:border-main-border'}`}
                                  />
                               </td>
                               <td className="p-2 min-w-[100px]">
                                  <input 
                                     type="time"
                                     value={s.startTime} 
                                     onChange={(e) => updateExtractedShift(i, 'startTime', e.target.value)}
                                     className={`w-full bg-transparent border rounded px-2 py-1.5 text-xs text-main-text focus:border-primary outline-none font-mono uppercase ${s.confidenceScore && s.confidenceScore < 80 ? 'border-warning/40' : 'border-transparent hover:border-main-border'}`}
                                  />
                               </td>
                               <td className="p-2 min-w-[100px]">
                                  <input 
                                     type="time"
                                     value={s.endTime} 
                                     onChange={(e) => updateExtractedShift(i, 'endTime', e.target.value)}
                                     className={`w-full bg-transparent border rounded px-2 py-1.5 text-xs text-main-text focus:border-primary outline-none font-mono uppercase ${s.confidenceScore && s.confidenceScore < 80 ? 'border-warning/40' : 'border-transparent hover:border-main-border'}`}
                                  />
                               </td>
                               <td className="p-2 min-w-[100px]">
                                  <select 
                                     value={s.type} 
                                     onChange={(e) => updateExtractedShift(i, 'type', e.target.value)}
                                     className={`w-full bg-transparent border rounded px-2 py-1.5 text-xs text-main-text focus:border-primary outline-none font-mono ${s.confidenceScore && s.confidenceScore < 80 ? 'border-warning/40' : 'border-transparent hover:border-main-border'}`}
                                  >
                                     {['General', 'Morning', '2nd Shift', 'Night', 'WO', 'CO', 'AL', 'CH'].map(t => <option key={t} value={t} className="bg-surface-2">{t}</option>)}
                                  </select>
                               </td>
                               <td className="p-2 text-center">
                                  {s.confidenceScore ? (
                                    <span className={`px-2 py-1 rounded text-[9px] font-mono uppercase tracking-wider ${s.confidenceScore >= 90 ? 'text-success' : s.confidenceScore >= 70 ? 'text-warning' : 'text-error'}`}>
                                      {s.confidenceScore}%
                                    </span>
                                  ) : (
                                    <span className="text-main-text-muted/70 text-[9px] uppercase font-mono tracking-wider">—</span>
                                  )}
                               </td>
                            </tr>
                         ))}
                      </tbody>
                   </table>
                </div>
                <button onClick={saveExtractedShifts} className="btn-primary w-full py-3 rounded text-[10px] uppercase font-mono tracking-wider">Confirm Import</button>
             </motion.div>
          </div>
         )}
      </AnimatePresence>

      {/* Confirmation Modals */}
      <AnimatePresence>
        {selectedShiftIds.length > 0 && (
           <motion.div 
             initial={{ y: 100, opacity: 0 }}
             animate={{ y: 0, opacity: 1 }}
             exit={{ y: 100, opacity: 0 }}
             className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[90] flex items-center justify-between gap-6 px-6 py-4 glass-card border border-main-border/80 rounded-full shadow-2xl backdrop-blur-xl max-w-lg w-full text-main-text"
           >
             <div className="flex flex-col">
               <span className="text-sm font-bold">{selectedShiftIds.length} shifts selected</span>
               <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Bulk Action</span>
             </div>
             <div className="flex items-center gap-3">
               <button 
                 onClick={() => setSelectedShiftIds([])} 
                 className="px-4 py-2 rounded-xl bg-surface-2 hover:bg-surface-3 text-main-text transition-all text-xs font-bold uppercase tracking-widest"
               >
                 Cancel
               </button>
               <button 
                 onClick={() => setShowBulkDeleteConfirm(true)} 
                 className="px-4 py-2 rounded-xl bg-error hover:bg-error text-main-text transition-all shadow-lg shadow-red-600/30 text-xs font-bold uppercase tracking-widest flex items-center gap-2"
               >
                 <Trash2 size={16} /> Delete
               </button>
             </div>
           </motion.div>
        )}

        {showBulkDeleteConfirm && (
           <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowBulkDeleteConfirm(false)} className="fixed inset-0 bg-surface-3/90 backdrop-blur-xl" />
              <div className="relative z-10 text-center space-y-8 max-w-sm">
                 <div className="w-24 h-24 bg-error-subtle rounded-[3rem] flex items-center justify-center mx-auto text-error border border-error/20 shadow-2xl">
                    <Trash2 size={48} />
                 </div>
                 <h4 className="text-3xl font-black italic text-main-text tracking-tighter uppercase">Delete {selectedShiftIds.length}?</h4>
                 <p className="text-main-text/20 font-black text-[10px] uppercase tracking-widest leading-loose">You are about to delete {selectedShiftIds.length} selected shift{selectedShiftIds.length === 1 ? '' : 's'}. This action cannot be reversed.</p>
                 <div className="flex gap-4">
                    <button onClick={() => setShowBulkDeleteConfirm(false)} className="flex-1 py-5 rounded-3xl bg-surface-2 text-main-text/40 font-black text-[10px] uppercase tracking-widest hover:bg-surface-3 transition-all">Cancel</button>
                    <button onClick={confirmDeleteSelected} className="flex-1 py-5 rounded-3xl bg-error text-main-text font-black text-[10px] uppercase tracking-widest shadow-2xl shadow-red-500/30">Confirm Delete</button>
                 </div>
              </div>
           </div>
        )}

        {showDeleteConfirm && (
           <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowDeleteConfirm(false)} className="fixed inset-0 bg-surface-3/90 backdrop-blur-xl" />
              <div className="relative z-10 text-center space-y-8 max-w-sm">
                 <div className="w-24 h-24 bg-error-subtle rounded-[3rem] flex items-center justify-center mx-auto text-error border border-error/20 shadow-2xl">
                    <Trash2 size={48} />
                 </div>
                 <h4 className="text-3xl font-black italic text-main-text tracking-tighter uppercase">Total Purge?</h4>
                 <p className="text-main-text/20 font-black text-[10px] uppercase tracking-widest leading-loose">Permanent deletion of all personnel roster records. This operation cannot be reversed.</p>
                 <div className="flex gap-4">
                    <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-5 rounded-3xl bg-surface-2 text-main-text/40 font-black text-[10px] uppercase tracking-widest hover:bg-surface-3 transition-all">Abort</button>
                    <button onClick={confirmDeleteAll} className="flex-1 py-5 rounded-3xl bg-error text-main-text font-black text-[10px] uppercase tracking-widest shadow-2xl shadow-red-500/30">Confirm Purge</button>
                 </div>
              </div>
           </div>
        )}

        {showDedupConfirm && (
           <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowDedupConfirm(false)} className="fixed inset-0 bg-surface-3/90 backdrop-blur-xl" />
              <div className="relative z-10 text-center space-y-8 max-w-sm">
                 <div className="w-24 h-24 bg-warning/10 rounded-[3rem] flex items-center justify-center mx-auto text-warning border border-warning/20 shadow-2xl">
                    <ShieldAlert size={48} />
                 </div>
                 <h4 className="text-3xl font-black italic text-main-text tracking-tighter uppercase">Refine Stream?</h4>
                 <p className="text-main-text/20 font-black text-[10px] uppercase tracking-widest leading-loose">Found {dedupCount} overlapping anomalies. Optimize dataset for clean operational flow?</p>
                 <div className="flex gap-4">
                    <button onClick={() => setShowDedupConfirm(false)} className="flex-1 py-5 rounded-3xl bg-surface-2 text-main-text/40 font-black text-[10px] uppercase tracking-widest hover:bg-surface-3 transition-all">Abort</button>
                    <button onClick={confirmDeduplicate} className="flex-1 py-5 rounded-3xl bg-warning text-black font-black text-[10px] uppercase tracking-widest shadow-2xl shadow-amber-500/30">Optimize Map</button>
                 </div>
              </div>
           </div>
        )}
      </AnimatePresence>
    </div>
  );
}
