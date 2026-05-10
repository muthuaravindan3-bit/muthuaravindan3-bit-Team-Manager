import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot, orderBy, where, limit, updateDoc, doc, addDoc, setDoc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { Shift, UserProfile, ShiftTemplate, Announcement, AuditLog, GlobalSettings, LeaveRequest } from '../types';
import { 
  Users, Calendar, LayoutDashboard, Map as MapIcon, ClipboardList, 
  BarChart3, Megaphone, History, Settings as SettingsIcon, Package, Shield, Target, Brain, Zap, Activity, Dna, Siren, Sparkles
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
import { MissionControl } from './admin/MissionControl';
import { ResourceVault } from './admin/ResourceVault';
import { ExecutiveSummary } from './admin/ExecutiveSummary';
import { PredictivePlanner } from './admin/PredictivePlanner';
import { AutonomousSimulation } from './admin/AutonomousGrid';
import { CognitiveBalancer } from './admin/CognitiveBalancer';
import { CrisisResponseProtocol } from './admin/CrisisResponse';
import { AIRosterBuilder } from './admin/AIRosterBuilder';

export function AdminPanel() {
  const [activeTab, setActiveTab] = useState<'strategy' | 'dashboard' | 'map' | 'users' | 'roster' | 'ai-builder' | 'leaves' | 'analytics' | 'missions' | 'resources' | 'broadcast' | 'templates' | 'predictive' | 'simulation' | 'bio' | 'crisis' | 'audit' | 'settings'>('strategy');
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
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    // Fetch shifts: today, tomorrow, and yesterday to handle night shifts
    const unsubShifts = onSnapshot(query(collection(db, 'shifts'), orderBy('date', 'desc'), limit(1000)), (snap) => {
      setShifts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Shift)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'shifts');
    });
    const unsubTemplates = onSnapshot(collection(db, 'shiftTemplates'), (snap) => {
      setTemplates(snap.docs.map(d => ({ id: d.id, ...d.data() } as ShiftTemplate)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'shiftTemplates');
    });
    const unsubAnnouncements = onSnapshot(query(collection(db, 'announcements'), orderBy('createdAt', 'desc'), limit(50)), (snap) => {
      setAnnouncements(snap.docs.map(d => ({ id: d.id, ...d.data() } as Announcement)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'announcements');
    });
    const unsubAudit = onSnapshot(query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc'), limit(100)), (snap) => {
      setAuditLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as AuditLog)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'auditLogs');
    });
    const unsubLeaves = onSnapshot(query(collection(db, 'leaveRequests'), orderBy('createdAt', 'desc')), (snap) => {
      setLeaves(snap.docs.map(d => ({ id: d.id, ...d.data() } as LeaveRequest)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'leaveRequests');
    });
    const unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (snap) => {
      if (snap.exists()) setGlobalSettings(snap.data() as GlobalSettings);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/global');
    });
    const unsubBreakLogs = onSnapshot(query(collection(db, 'breakLogs'), where('endTime', '==', null)), (snap) => {
      const logs: Record<string, any> = {};
      snap.docs.forEach(d => { logs[d.id] = d.data(); });
      setBreakLogs(logs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'breakLogs');
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
    { id: 'strategy', label: 'Strategy', icon: Brain },
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'map', label: 'Map', icon: MapIcon },
    { id: 'users', label: 'Personnel', icon: Users },
    { id: 'roster', label: 'Schedule', icon: Calendar },
    { id: 'ai-builder', label: 'AI Builder', icon: Sparkles },
    { id: 'leaves', label: 'Approvals', icon: ClipboardList },
    { id: 'analytics', label: 'Insights', icon: BarChart3 },
    { id: 'missions', label: 'Operations', icon: Target },
    { id: 'resources', label: 'Res. Vault', icon: Package },
    { id: 'broadcast', label: 'Broadcast', icon: Megaphone },
    { id: 'templates', label: 'Flows', icon: Package },
    { id: 'predictive', label: 'Predictive', icon: Zap },
    { id: 'simulation', label: 'Simulation', icon: Activity },
    { id: 'bio', label: 'Bio-Sync', icon: Dna },
    { id: 'crisis', label: 'Crisis Mode', icon: Siren },
    { id: 'audit', label: 'Security', icon: History },
    { id: 'settings', label: 'Global', icon: SettingsIcon },
  ];

  return (
    <div className="space-y-12 pb-20">
      {/* Admin Panel Header & Sub-Nav */}
      <div className="flex flex-col gap-8">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary/10 rounded-lg border border-primary/20">
                <Shield size={24} className="text-primary" />
              </div>
              <h2 className="text-4xl font-display font-medium text-main-text tracking-tighter uppercase italic">
                Control_Grid
              </h2>
            </div>
            <p className="text-[10px] font-mono text-main-text-muted mt-1 uppercase tracking-[0.4em] opacity-40">Administrative node #01 // Root_Level_Access</p>
          </div>
          
          <div className="hidden lg:block">
            <div className="flex items-center gap-4">
              {/* Cortex Monitor */}
              <div className="px-4 py-2 bg-black/50 backdrop-blur-xl border border-primary/20 rounded-lg flex items-center gap-6 group hover:border-primary/40 transition-all cursor-default">
                 <div className="flex items-center gap-3">
                    <div className="relative">
                       <Brain size={18} className="text-primary animate-pulse" />
                       <motion.div 
                         animate={{ scale: [1, 1.2, 1] }}
                         transition={{ duration: 2, repeat: Infinity }}
                         className="absolute inset-0 bg-primary/20 blur-md rounded-full -z-10"
                       />
                    </div>
                    <div className="flex flex-col">
                       <span className="text-[9px] font-mono text-primary uppercase font-bold tracking-[0.2em]">Cortex_Link</span>
                       <span className="text-[8px] font-mono text-success uppercase">Synaptic_Sync::OK</span>
                    </div>
                 </div>
                 <div className="w-px h-8 bg-main-border/30" />
                 <div className="flex flex-col">
                    <span className="text-[9px] font-mono text-main-text-muted uppercase tracking-widest">Global_Risk</span>
                    <span className="text-[10px] font-mono text-success uppercase font-bold">Low_Probability</span>
                 </div>
              </div>

              <div className="px-6 py-3 bg-surface-2/30 backdrop-blur-md border border-main-border rounded flex items-center gap-4">
                <div className="flex flex-col items-end">
                  <span className="text-[9px] font-mono text-main-text-muted uppercase tracking-widest">Protocol_State</span>
                  <span className="text-[10px] font-mono text-success uppercase font-bold tracking-tighter">Authorized_Session</span>
                </div>
                <div className="w-1.5 h-8 bg-success/20 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ height: 0 }}
                    animate={{ height: "100%" }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="w-full bg-success shadow-[0_0_10px_rgba(var(--color-success),0.5)]" 
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <nav className="flex flex-wrap gap-2 p-1.5 bg-surface-2/40 backdrop-blur-md border border-main-border rounded-xl">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                className={`relative flex items-center gap-2 px-5 py-2.5 rounded-lg text-[9px] font-mono uppercase tracking-[0.25em] transition-all duration-300 group overflow-hidden ${
                  isActive 
                  ? 'text-primary' 
                  : 'text-main-text-muted hover:text-main-text hover:bg-surface-2'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="admin-nav-bg"
                    className="absolute inset-0 bg-primary/5 border border-primary/20 rounded-lg"
                    initial={false}
                    transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                  />
                )}
                <item.icon size={13} className={`relative z-10 ${isActive ? 'text-primary' : 'opacity-40 group-hover:opacity-100'}`} />
                <span className="relative z-10">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
           key={activeTab}
           initial={{ opacity: 0, scale: 0.98 }}
           animate={{ opacity: 1, scale: 1 }}
           exit={{ opacity: 0, scale: 0.98 }}
           transition={{ duration: 0.2 }}
        >
          {activeTab === 'strategy' && (
            <ExecutiveSummary />
          )}

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

          {activeTab === 'ai-builder' && (
             <AIRosterBuilder 
                users={users}
                shifts={sanitizedShifts}
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

          {activeTab === 'missions' && (
            <MissionControl users={users} onLogAction={logAction} />
          )}
          
          {activeTab === 'resources' && (
            <ResourceVault />
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

          {activeTab === 'predictive' && (
            <PredictivePlanner 
              users={users}
              shifts={sanitizedShifts}
            />
          )}

          {activeTab === 'simulation' && (
             <AutonomousSimulation 
                users={users}
                shifts={sanitizedShifts}
             />
          )}

          {activeTab === 'bio' && (
             <CognitiveBalancer 
                users={users}
                shifts={sanitizedShifts}
             />
          )}

          {activeTab === 'crisis' && (
             <CrisisResponseProtocol 
                users={users}
                shifts={sanitizedShifts}
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
                  await setDoc(doc(db, 'settings', 'global'), { ...globalSettings }, { merge: true });
                  await setDoc(doc(db, 'system', 'state'), { 
                    lockdownActive: globalSettings.lockdownActive || false,
                    alertLevel: globalSettings.alertLevel || 'normal',
                    updatedAt: Date.now(),
                    updatedBy: auth.currentUser?.uid || 'admin'
                  }, { merge: true });
                  await logAction('UPDATE_SETTINGS', 'global', 'System Config', `Rate: ${globalSettings.defaultHourlyRate}, Lockdown: ${globalSettings.lockdownActive}`);
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
