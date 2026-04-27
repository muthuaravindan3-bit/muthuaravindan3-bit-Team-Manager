import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot, orderBy, where, limit, updateDoc, doc, addDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Shift, UserProfile, ShiftTemplate, Announcement, AuditLog, GlobalSettings, LeaveRequest } from '../types';
import { 
  Users, Calendar, LayoutDashboard, Map as MapIcon, ClipboardList, 
  BarChart3, Megaphone, History, Settings as SettingsIcon, Package
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Sub-components
import { CommandDashboard } from './admin/CommandDashboard';
import { OperationalMap } from './admin/OperationalMap';
import { UserManagement } from './admin/UserManagement';
import { RosterManagement } from './admin/RosterManagement';
import { LeaveApproval } from './admin/LeaveApproval';
import { AnalyticsHub } from './admin/AnalyticsHub';
import { BroadcastCenter } from './admin/BroadcastCenter';
import { TemplateLibrary } from './admin/TemplateLibrary';
import { AuditRecords } from './admin/AuditRecords';
import { GlobalConfig } from './admin/GlobalConfig';

export function AdminPanel() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'map' | 'users' | 'roster' | 'leaves' | 'analytics' | 'broadcast' | 'templates' | 'audit' | 'settings'>('dashboard');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings>({
    maxBreakDurationMinutes: 15,
    defaultHourlyRate: 20
  });
  const [breakLogs, setBreakLogs] = useState<Record<string, any>>({});
  const [now, setNow] = useState(Date.now());

  // Canonical UID Map: email -> canonical uid
  const uidMap = useMemo(() => {
    const map = new Map<string, string>();
    const emailToCanonical = new Map<string, string>();
    
    users.forEach(u => {
      const email = u.email?.toLowerCase();
      if (email) {
        if (!emailToCanonical.has(email)) {
          emailToCanonical.set(email, u.uid);
        }
        map.set(u.uid, emailToCanonical.get(email)!);
      } else {
        map.set(u.uid, u.uid);
      }
    });
    return map;
  }, [users]);

  const sanitizedShifts = useMemo(() => {
    // Consolidate shifts by canonical ID and date
    const consolidated = new Map<string, Shift>();
    shifts.forEach(s => {
      const canonicalUid = uidMap.get(s.userId) || s.userId;
      const key = `${canonicalUid}_${s.date}_${s.startTime}_${s.endTime}`;
      if (!consolidated.has(key)) {
        consolidated.set(key, { ...s, userId: canonicalUid });
      }
    });
    return Array.from(consolidated.values());
  }, [shifts, uidMap]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      const allUsers = snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile));
      const seen = new Set();
      const uniqueUsers = allUsers.filter(u => {
        const identifier = (u.email || u.uid).toLowerCase();
        if (seen.has(identifier)) return false;
        seen.add(identifier);
        return true;
      });
      setUsers(uniqueUsers);
    });

    // Fetch shifts: today, tomorrow, and yesterday to handle night shifts
    const unsubShifts = onSnapshot(query(collection(db, 'shifts'), orderBy('date', 'desc'), limit(1000)), (snap) => {
      setShifts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Shift)));
    });
    const unsubTemplates = onSnapshot(collection(db, 'shiftTemplates'), (snap) => {
      setTemplates(snap.docs.map(d => ({ id: d.id, ...d.data() } as ShiftTemplate)));
    });
    const unsubAnnouncements = onSnapshot(query(collection(db, 'announcements'), orderBy('createdAt', 'desc'), limit(50)), (snap) => {
      setAnnouncements(snap.docs.map(d => ({ id: d.id, ...d.data() } as Announcement)));
    });
    const unsubAudit = onSnapshot(query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc'), limit(100)), (snap) => {
      setAuditLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as AuditLog)));
    });
    const unsubLeaves = onSnapshot(query(collection(db, 'leaveRequests'), orderBy('createdAt', 'desc')), (snap) => {
      setLeaves(snap.docs.map(d => ({ id: d.id, ...d.data() } as LeaveRequest)));
    });
    const unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (snap) => {
      if (snap.exists()) setGlobalSettings(snap.data() as GlobalSettings);
    });
    const unsubBreakLogs = onSnapshot(query(collection(db, 'breakLogs'), where('endTime', '==', null)), (snap) => {
      const logs: Record<string, any> = {};
      snap.docs.forEach(d => { logs[d.id] = d.data(); });
      setBreakLogs(logs);
    });

    return () => {
      unsubUsers();
      unsubShifts();
      unsubTemplates();
      unsubAnnouncements();
      unsubAudit();
      unsubLeaves();
      unsubSettings();
      unsubBreakLogs();
    };
  }, []);

  const logAction = async (action: string, targetId: string, targetName: string, details?: string) => {
    try {
      await addDoc(collection(db, 'auditLogs'), {
        timestamp: Date.now(),
        adminId: auth.currentUser?.uid || 'system',
        adminName: auth.currentUser?.displayName || auth.currentUser?.email || 'System Admin',
        action,
        targetId,
        targetName,
        details: details || ''
      });
    } catch (err) {
      console.error("Audit logging failed", err);
    }
  };

  const endBreak = async (uid: string) => {
    try {
      const user = users.find(u => u.uid === uid);
      if (!user?.activeBreakLogId) return;
      await updateDoc(doc(db, 'breakLogs', user.activeBreakLogId), { endTime: Date.now() });
      await updateDoc(doc(db, 'users', uid), { isBreakActive: false, activeBreakLogId: null, breakStartTime: null });
      await logAction('FORCE_END_BREAK', uid, user.displayName || user.email || 'User', 'Admin forced break termination');
    } catch (err) {
      console.error("Failed to end break", err);
    }
  };

  const analyticsData = useMemo(() => {
    const pieData = sanitizedShifts.reduce((acc: any[], s) => {
      const existing = acc.find(a => a.name === s.type);
      if (existing) existing.value++;
      else acc.push({ name: s.type, value: 1 });
      return acc;
    }, []);

    const weeklyData = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => ({
      day,
      count: sanitizedShifts.filter(s => {
        const d = new Date(s.date);
        return d.toLocaleDateString('en-US', { weekday: 'short' }) === day;
      }).length
    }));

    return { pieData, weeklyData };
  }, [sanitizedShifts]);

  const payrollData = useMemo(() => {
    const data: Record<string, { hours: number, pay: number }> = {};
    sanitizedShifts.forEach(s => {
      const start = new Date(`${s.date} ${s.startTime}`);
      const end = new Date(`${s.date} ${s.endTime}`);
      if (end < start) end.setDate(end.getDate() + 1);
      const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      if (!data[s.userId]) data[s.userId] = { hours: 0, pay: 0 };
      data[s.userId].hours += hours;
      data[s.userId].pay += hours * (globalSettings.defaultHourlyRate || 20);
    });
    return data;
  }, [sanitizedShifts, globalSettings]);

  const lastBreaks = useMemo(() => {
    const data: Record<string, number> = {};
    users.forEach(u => {
      if (u.breakStartTime) data[u.uid] = u.breakStartTime;
    });
    return data;
  }, [users]);

  const formatDuration = (startTime: number) => {
    const diff = now - startTime;
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    return `${mins}m ${secs}s`;
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'map', label: 'Map', icon: MapIcon },
    { id: 'users', label: 'Personnel', icon: Users },
    { id: 'roster', label: 'Schedule', icon: Calendar },
    { id: 'leaves', label: 'Approvals', icon: ClipboardList },
    { id: 'analytics', label: 'Insights', icon: BarChart3 },
    { id: 'broadcast', label: 'Broadcast', icon: Megaphone },
    { id: 'templates', label: 'Flows', icon: Package },
    { id: 'audit', label: 'Security', icon: History },
    { id: 'settings', label: 'Global', icon: SettingsIcon },
  ];

  return (
    <div className="space-y-10">
      {/* Admin Panel Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b border-white/5 pb-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-white mb-2">Command Center</h1>
          <p className="text-slate-400 font-medium">Full administrative control over the platform systems.</p>
        </div>

        <div className="flex bg-zinc-900 border border-white/5 p-1 rounded-2xl overflow-x-auto no-scrollbar shadow-sm">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                activeTab === item.id 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
                : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <item.icon size={16} />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
           key={activeTab}
           initial={{ opacity: 0, scale: 0.98 }}
           animate={{ opacity: 1, scale: 1 }}
           exit={{ opacity: 0, scale: 0.98 }}
           transition={{ duration: 0.2 }}
        >
          {activeTab === 'dashboard' && (
            <CommandDashboard 
              users={users} 
              globalSettings={globalSettings} 
              breakLogs={breakLogs} 
              now={now} 
              onNavigate={setActiveTab}
              onEndBreak={endBreak}
              formatDuration={formatDuration}
            />
          )}

          {activeTab === 'map' && (
            <OperationalMap users={users} />
          )}

          {activeTab === 'users' && (
            <UserManagement 
              users={users} 
              lastBreaks={lastBreaks} 
              onLogAction={logAction}
            />
          )}

          {activeTab === 'roster' && (
            <RosterManagement 
              users={users} 
              shifts={sanitizedShifts} 
              templates={templates} 
              onLogAction={logAction}
            />
          )}

          {activeTab === 'leaves' && (
            <LeaveApproval 
              leaves={leaves} 
              onLogAction={logAction}
            />
          )}

          {activeTab === 'analytics' && (
            <AnalyticsHub 
              analyticsData={analyticsData} 
              payrollData={payrollData} 
              users={users} 
              globalSettings={globalSettings}
              exportShiftsCSV={() => {}} 
            />
          )}

          {activeTab === 'broadcast' && (
            <BroadcastCenter 
              announcements={announcements} 
              userName={auth.currentUser?.displayName || auth.currentUser?.email || 'Admin'}
              onLogAction={logAction}
            />
          )}

          {activeTab === 'templates' && (
            <TemplateLibrary 
              templates={templates} 
              onLogAction={logAction}
            />
          )}

          {activeTab === 'audit' && (
            <AuditRecords 
              auditLogs={auditLogs} 
              onLogAction={logAction}
            />
          )}

          {activeTab === 'settings' && (
            <GlobalConfig 
              globalSettings={globalSettings} 
              setGlobalSettings={setGlobalSettings}
              saveSettings={async () => {
                try {
                  await updateDoc(doc(db, 'settings', 'global'), { ...globalSettings });
                  await logAction('UPDATE_SETTINGS', 'global', 'System Config', `Rate: ${globalSettings.defaultHourlyRate}, Break: ${globalSettings.maxBreakDurationMinutes}`);
                } catch (e) {
                  console.error(e);
                }
              }}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
