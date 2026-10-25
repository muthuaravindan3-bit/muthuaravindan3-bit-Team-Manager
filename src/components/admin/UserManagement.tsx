import React, { useState, useEffect } from 'react';
import { doc, updateDoc, deleteDoc, setDoc, collection, query, where, onSnapshot, orderBy, limit, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { UserProfile, PerformanceMetric, Shift, Mission } from '../../types';
import { Users, Plus, Trash2, Shield, User, Mail, Hash, MoreHorizontal, X, Search, FileText, Star, Brain, Award, Zap, Activity, Loader2, Sparkles, Command, Edit2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { generatePersonnelDossier, PersonnelDossier } from '../../geminiService';

interface UserManagementProps {
  users: UserProfile[];
  lastBreaks: Record<string, number>;
  onLogAction: (action: string, targetId: string, targetName: string, details?: string) => Promise<void>;
}

export function UserManagement({ users, lastBreaks, onLogAction }: UserManagementProps) {
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [newUser, setNewUser] = useState({ name: '', email: '', employeeId: '', role: 'member' });
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [adminNote, setAdminNote] = useState('');
  const [performance, setPerformance] = useState<PerformanceMetric | null>(null);
  const [wellnessEntry, setWellnessEntry] = useState<any | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingDossier, setIsGeneratingDossier] = useState(false);
  const [dossier, setDossier] = useState<PersonnelDossier | null>(null);

  useEffect(() => {
    if (!selectedUser) {
      setPerformance(null);
      setAdminNote('');
      setDossier(null);
      return;
    }

    const q = query(
      collection(db, 'performanceMetrics'),
      where('userId', '==', selectedUser.uid),
      orderBy('month', 'desc'),
      limit(1)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setPerformance({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as PerformanceMetric);
      } else {
        setPerformance({
          id: '',
          userId: selectedUser.uid,
          efficiency: 85 + Math.floor(Math.random() * 10),
          attendance: 90 + Math.floor(Math.random() * 10),
          compliance: 95,
          month: format(new Date(), 'yyyy-MM')
        });
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'performanceMetrics');
    });

    const wellnessQ = query(
      collection(db, 'wellness'),
      where('userId', '==', selectedUser.uid),
      orderBy('timestamp', 'desc'),
      limit(1)
    );

    const wellnessUnsubscribe = onSnapshot(wellnessQ, (snapshot) => {
      if (!snapshot.empty) {
        setWellnessEntry(snapshot.docs[0].data());
      } else {
        setWellnessEntry(null);
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'wellness');
    });

    return () => {
      unsubscribe();
      wellnessUnsubscribe();
    };
  }, [selectedUser]);

  const savePersonnelChanges = async () => {
    if (!selectedUser || isSaving) return;
    setIsSaving(true);
    try {
      if (adminNote.trim()) {
        await onLogAction('ADD_PERSONNEL_NOTE', selectedUser.uid, selectedUser.displayName || selectedUser.email, adminNote);
        setAdminNote('');
      }
      
      const metricRef = performance?.id 
        ? doc(db, 'performanceMetrics', performance.id)
        : doc(collection(db, 'performanceMetrics'));
        
      await setDoc(metricRef, {
        ...performance,
        userId: selectedUser.uid,
        month: format(new Date(), 'yyyy-MM')
      }, { merge: true });

      await onLogAction('UPDATE_PERFORMANCE', selectedUser.uid, selectedUser.displayName || selectedUser.email, 'Performance data synchronized');
      setSelectedUser(null);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'performanceMetrics');
    } finally {
      setIsSaving(false);
    }
  };

  const addUser = async () => {
    if (!newUser.name) return;
    try {
      const slug = newUser.name.toLowerCase().replace(/\s+/g, '_') + '_' + Math.random().toString(36).substring(2, 5);
      await setDoc(doc(db, 'users', slug), {
        displayName: newUser.name,
        email: newUser.email.toLowerCase(),
        employeeId: newUser.employeeId,
        role: newUser.role,
        createdAt: Date.now()
      });
      await onLogAction('CREATE_USER', slug, newUser.name, `Added via Admin Console`);
      setIsAddUserOpen(false);
      setNewUser({ name: '', email: '', employeeId: '', role: 'member' });
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'users');
    }
  };

  const deleteUser = async (uid: string) => {
    const user = users.find(u => u.uid === uid);
    if (!window.confirm("Permanent erasure of this profile. This operation is irreversible. Proceed?")) return;
    try {
      await deleteDoc(doc(db, 'users', uid));
      await onLogAction('DELETE_USER', uid, user?.displayName || user?.email || 'Unknown', 'System removal');
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, 'users');
    }
  };

  const updateUserRole = async (uid: string, role: string) => {
    const user = users.find(u => u.uid === uid);
    try {
      await updateDoc(doc(db, 'users', uid), { role });
      await onLogAction('UPDATE_ROLE', uid, user?.displayName || user?.email || 'Unknown', `Security clearance: ${role}`);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'users');
    }
  };

  const updateField = async (uid: string, field: string, value: string) => {
    try {
      await updateDoc(doc(db, 'users', uid), { [field]: value });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'users');
    }
  };

  const fetchPersonnelDossier = async () => {
    if (!selectedUser) return;
    setIsGeneratingDossier(true);
    try {
      // Get some history
      const shiftsSnap = await getDocs(query(collection(db, 'shifts'), where('userId', '==', selectedUser.uid), limit(50)));
      const missionsSnap = await getDocs(query(collection(db, 'missions'), where('assignedTo', 'array-contains', selectedUser.uid), limit(10)));
      
      const missions = missionsSnap.docs.map(d => d.data().title);
      
      const result = await generatePersonnelDossier(
        { name: selectedUser.displayName || selectedUser.email, role: selectedUser.role || 'member' },
        { 
          shifts: shiftsSnap.size, 
          wellness: wellnessEntry?.score || 8, 
          missions 
        }
      );
      setDossier(result);
    } catch (e) {
      console.error("Dossier generation failed:", e);
    } finally {
      setIsGeneratingDossier(false);
    }
  };

  const saveUserEdits = async () => {
    if (!editingUser) return;
    try {
      if (!editingUser.displayName || !editingUser.email) {
         alert("Required fields cannot be empty.");
         return;
      }
      await updateDoc(doc(db, 'users', editingUser.uid), {
        displayName: editingUser.displayName,
        email: editingUser.email.toLowerCase(),
        employeeId: editingUser.employeeId || '',
        role: editingUser.role,
        timezone: editingUser.timezone || ''
      });
      await onLogAction('UPDATE_USER', editingUser.uid, editingUser.displayName, `Profile updated manually`);
      setEditingUser(null);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'users');
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = (u.displayName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (u.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (u.employeeId || '').toLowerCase().includes(searchQuery.toLowerCase());
                          
    const matchesRole = roleFilter === 'all' || (u.role || 'member') === roleFilter;
    
    let matchesStatus = true;
    if (statusFilter === 'active') matchesStatus = u.uid.length > 20;
    if (statusFilter === 'inactive') matchesStatus = u.uid.length <= 20;

    return matchesSearch && matchesRole && matchesStatus;
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex flex-col sm:flex-row gap-4 flex-1 max-w-2xl">
          <div className="flex gap-1 bg-surface-2 p-1 rounded border border-main-border">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="bg-transparent text-[9px] font-mono whitespace-nowrap uppercase tracking-widest text-main-text-muted px-3 py-1 outline-none cursor-pointer hover:text-main-text transition-colors"
            >
              <option value="all">F_Clearance: ALL</option>
              <option value="admin">F_Clearance: L0</option>
              <option value="member">F_Clearance: L1</option>
            </select>
            <div className="w-px bg-main-border/50 my-1" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-[9px] font-mono whitespace-nowrap uppercase tracking-widest text-main-text-muted px-3 py-1 outline-none cursor-pointer hover:text-main-text transition-colors"
            >
              <option value="all">S_Vector: ALL</option>
              <option value="active">S_Vector: ONLINE</option>
              <option value="inactive">S_Vector: OFFLINE</option>
            </select>
          </div>
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-main-text-muted/30 group-focus-within:text-primary transition-colors" size={14} />
            <input 
              type="text"
              placeholder="SEARCH PERSONNEL ARCHIVE..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-surface-1 border border-main-border rounded pl-11 pr-4 py-2.5 text-[10px] font-mono uppercase tracking-[0.2em] focus:border-primary/50 outline-none placeholder:text-main-text-muted/30 text-main-text-muted hover:bg-surface-2 transition-all"
            />
          </div>
        </div>
        <button 
          onClick={() => setIsAddUserOpen(true)}
          className="px-6 py-2.5 bg-primary hover:bg-primary-hover text-surface-1 rounded transition-all flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.3em] shadow-lg shadow-primary/10 active:scale-95"
        >
          <Plus size={14} />
          <span>Register Unit</span>
        </button>
      </div>

      <AnimatePresence>
        {isAddUserOpen && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }} 
            animate={{ height: 'auto', opacity: 1 }} 
            exit={{ height: 0, opacity: 0 }} 
            className="overflow-hidden"
          >
            <div className="bg-surface-2 border border-main-border rounded-md p-8 space-y-8 mb-8">
              <div className="flex justify-between items-center border-b border-main-border pb-4">
                 <div className="space-y-1">
                   <h4 className="text-sm font-display font-medium text-main-text uppercase tracking-tight">Personnel Onboarding Terminal</h4>
                   <p className="text-[9px] font-mono text-main-text-muted uppercase tracking-widest">Entry of new resource identifier into the persistent manifest</p>
                 </div>
                 <button onClick={() => setIsAddUserOpen(false)} className="w-8 h-8 rounded border border-main-border flex items-center justify-center text-main-text-muted hover:text-main-text hover:border-main-text transition-all">
                   <X size={14} />
                 </button>
              </div>
              <div className="grid md:grid-cols-4 gap-8">
                <div className="space-y-2">
                  <label className="text-[9px] font-mono uppercase tracking-[0.2em] text-main-text-muted/50 ml-1">Identity_Alpha</label>
                  <input 
                    type="text" 
                    value={newUser.name}
                    onChange={e => setNewUser({...newUser, name: e.target.value})}
                    className="w-full bg-surface-1 border border-main-border rounded px-4 py-3 text-[11px] font-mono uppercase outline-none focus:border-primary/50 transition-colors text-main-text"
                    placeholder="NAME.SURNAME"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-mono uppercase tracking-[0.2em] text-main-text-muted/50 ml-1">Sync_Comms</label>
                  <input 
                    type="email" 
                    value={newUser.email}
                    onChange={e => setNewUser({...newUser, email: e.target.value})}
                    className="w-full bg-surface-1 border border-main-border rounded px-4 py-3 text-[11px] font-mono uppercase outline-none focus:border-primary/50 transition-colors text-main-text"
                    placeholder="UNIT@SECTOR.COM"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-mono uppercase tracking-[0.2em] text-main-text-muted/50 ml-1">Resource_CID</label>
                  <input 
                    type="text" 
                    value={newUser.employeeId}
                    onChange={e => setNewUser({...newUser, employeeId: e.target.value})}
                    className="w-full bg-surface-1 border border-main-border rounded px-4 py-3 text-[11px] outline-none focus:border-primary/50 font-mono transition-colors text-main-text"
                    placeholder="EMP_IDENT_01"
                  />
                </div>
                <div className="flex items-end">
                  <button onClick={addUser} className="w-full bg-primary hover:bg-primary-hover text-surface-1 py-3.5 rounded text-[10px] uppercase font-mono tracking-[0.3em] transition-all shadow-xl shadow-primary/10 active:scale-95">
                    Execute_Registration
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingUser && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }} 
            animate={{ height: 'auto', opacity: 1 }} 
            exit={{ height: 0, opacity: 0 }} 
            className="overflow-hidden"
          >
            <div className="bg-surface-2 border border-main-border rounded-md p-8 space-y-8 mb-8 relative">
              <div className="flex justify-between items-center border-b border-main-border pb-4">
                 <div className="space-y-1">
                   <h4 className="text-sm font-display font-medium text-main-text uppercase tracking-tight">Personnel Modification Terminal</h4>
                   <p className="text-[9px] font-mono text-warning uppercase tracking-widest">Altering persistent manifest for {editingUser.uid}</p>
                 </div>
                 <button onClick={() => setEditingUser(null)} className="w-8 h-8 rounded border border-main-border flex items-center justify-center text-main-text-muted hover:text-main-text hover:border-main-text transition-all">
                   <X size={14} />
                 </button>
              </div>
              <div className="grid md:grid-cols-5 gap-6">
                <div className="space-y-2">
                  <label className="text-[9px] font-mono uppercase tracking-[0.2em] text-main-text-muted/50 ml-1">Identity_Alpha</label>
                  <input 
                    type="text" 
                    value={editingUser.displayName || ''}
                    onChange={e => setEditingUser({...editingUser, displayName: e.target.value})}
                    className="w-full bg-surface-1 border border-main-border rounded px-4 py-3 text-[11px] font-mono uppercase outline-none focus:border-primary/50 transition-colors text-main-text"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-mono uppercase tracking-[0.2em] text-main-text-muted/50 ml-1">Sync_Comms</label>
                  <input 
                    type="email" 
                    value={editingUser.email || ''}
                    onChange={e => setEditingUser({...editingUser, email: e.target.value})}
                    className="w-full bg-surface-1 border border-main-border rounded px-4 py-3 text-[11px] font-mono uppercase outline-none focus:border-primary/50 transition-colors text-main-text"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-mono uppercase tracking-[0.2em] text-main-text-muted/50 ml-1">Resource_CID</label>
                  <input 
                    type="text" 
                    value={editingUser.employeeId || ''}
                    onChange={e => setEditingUser({...editingUser, employeeId: e.target.value})}
                    className="w-full bg-surface-1 border border-main-border rounded px-4 py-3 text-[11px] outline-none focus:border-primary/50 font-mono transition-colors text-main-text"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-mono uppercase tracking-[0.2em] text-main-text-muted/50 ml-1">Security_Level</label>
                  <select 
                    value={editingUser.role || 'member'}
                    onChange={e => setEditingUser({...editingUser, role: e.target.value as 'admin'|'member'})}
                    className="w-full bg-surface-1 border border-main-border rounded px-4 py-3 text-[11px] outline-none focus:border-primary/50 font-mono transition-colors text-main-text cursor-pointer appearance-none"
                  >
                    <option value="member">Staff_L1</option>
                    <option value="admin">Admin_L0</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button onClick={saveUserEdits} className="w-full bg-warning hover:bg-warning/80 text-surface-1 py-3.5 rounded text-[10px] uppercase font-mono tracking-[0.3em] font-bold transition-all shadow-xl shadow-warning/10 active:scale-95">
                    Save_Edits
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-surface-1 border border-main-border rounded-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-main-border bg-surface-2">
                <th className="px-6 py-4 text-[9px] font-mono uppercase tracking-[0.3em] text-main-text-muted">CID_Ident</th>
                <th className="px-6 py-4 text-[9px] font-mono uppercase tracking-[0.3em] text-main-text-muted">Identity_Stream</th>
                <th className="px-6 py-4 text-[9px] font-mono uppercase tracking-[0.3em] text-main-text-muted">Security_Level</th>
                <th className="px-6 py-4 text-[9px] font-mono uppercase tracking-[0.3em] text-main-text-muted">Temporal_Telemetry</th>
                <th className="px-6 py-4 text-[9px] font-mono uppercase tracking-[0.3em] text-main-text-muted">Vector_State</th>
                <th className="px-6 py-4 text-[9px] font-mono uppercase tracking-[0.3em] text-main-text-muted text-right">Ops</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-main-border/50">
              {filteredUsers.map((u, idx) => (
                <motion.tr 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  key={u.uid} 
                  onDoubleClick={() => setSelectedUser(u)}
                  className="group hover:bg-surface-2/30 transition-colors cursor-pointer"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                       <Hash size={10} className="text-main-text-muted/30" />
                       <input 
                         type="text"
                         defaultValue={u.employeeId || u.uid.slice(0, 8).toUpperCase()}
                         onBlur={(e) => updateField(u.uid, 'employeeId', e.target.value)}
                         className="text-[10px] font-mono bg-transparent text-main-text-muted/60 border-none outline-none w-32 focus:text-primary transition-colors uppercase tracking-tight"
                       />
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4">
                      <div className="w-9 h-9 rounded bg-surface-2 border border-main-border flex items-center justify-center font-mono text-xs text-main-text-muted group-hover:text-primary group-hover:border-primary/30 transition-all">
                        {(u.displayName || u.email || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="flex flex-col space-y-0.5">
                        <span className="font-medium text-xs text-main-text uppercase tracking-tight">{u.displayName || 'UNNAMED_UNIT'}</span>
                        <input 
                          type="text"
                          defaultValue={u.email}
                          onBlur={(e) => updateField(u.uid, 'email', e.target.value.toLowerCase())}
                          className="text-[9px] font-mono text-main-text-muted/40 bg-transparent outline-none w-full max-w-[200px] focus:text-primary transition-colors uppercase tracking-widest"
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <select 
                      value={u.role || 'member'} 
                      onChange={(e) => updateUserRole(u.uid, e.target.value)}
                      className={`text-[8px] font-mono uppercase tracking-[0.2em] px-3 py-1.5 rounded border border-main-border bg-surface-2 text-main-text-muted/60 outline-none cursor-pointer focus:border-primary/50 transition-colors ${
                        u.role === 'admin' ? 'text-primary border-primary/20' : ''
                      }`}
                    >
                      <option value="member">Staff_L1</option>
                      <option value="admin">Admin_L0</option>
                    </select>
                  </td>
                  <td className="px-6 py-4">
                    {lastBreaks[u.uid] ? (
                      <div className="flex items-center space-x-3">
                        <div className="w-1 h-1 rounded-full bg-primary animate-pulse" />
                        <span className="text-[10px] font-mono uppercase text-main-text-muted/60 whitespace-nowrap">
                          {format(lastBreaks[u.uid], 'MMM d // HH:mm')}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[8px] font-mono text-main-text-muted/20 uppercase tracking-widest">Temporal_Void</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                       <div className={`w-1 h-1 rounded-full ${u.uid.length > 20 ? 'bg-success shadow-[0_0_8px_rgba(var(--color-success),0.5)]' : 'bg-main-text-muted/20'}`} />
                       <span className={`text-[9px] font-mono uppercase tracking-[0.25em] ${
                         u.uid.length > 20 ? 'text-success' : 'text-main-text-muted/30'
                       }`}>
                         {u.uid.length > 20 ? 'Online' : 'Offline'}
                       </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-1">
                      <button 
                        onClick={(e) => { e.stopPropagation(); setEditingUser(u); }}
                        className="p-2 text-main-text-muted/20 hover:text-primary hover:bg-primary/5 rounded transition-all active:scale-90"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); deleteUser(u.uid); }}
                        className="p-2 text-main-text-muted/20 hover:text-error hover:bg-error/5 rounded transition-all active:scale-90"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Personnel Details Sidebar (Feature 14, 15, 13 overlap) */}
      <AnimatePresence>
        {selectedUser && (
          <div className="fixed inset-0 z-[100] flex justify-end">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-surface-1/60 backdrop-blur-sm"
              onClick={() => setSelectedUser(null)}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative w-full max-w-lg bg-surface-1 border-l border-main-border shadow-2xl h-full flex flex-col"
            >
               <div className="p-8 border-b border-main-border flex items-center justify-between bg-surface-2/30">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary/10 border border-primary/20 rounded-xl flex items-center justify-center font-mono text-xl text-primary font-bold">
                       {selectedUser.displayName?.charAt(0)}
                    </div>
                    <div>
                      <h3 className="text-lg font-display font-medium text-main-text uppercase tracking-tight">{selectedUser.displayName}</h3>
                      <p className="text-[10px] font-mono text-primary uppercase tracking-[0.2em] font-bold">Personnel_File // UID_{selectedUser.uid.slice(0, 8)}</p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedUser(null)} className="p-2 text-main-text-muted hover:text-main-text transition-colors">
                    <X size={20} />
                  </button>
               </div>

               <div className="flex-1 overflow-y-auto p-8 space-y-10 scrollbar-thin">
                  {/* AI Personnel Dossier (Phase Next Feature) */}
                  <section className="space-y-4">
                     <div className="flex items-center justify-between">
                        <h4 className="text-[10px] font-mono uppercase tracking-[0.3em] text-primary font-bold">Tactical_Intelligence_Dossier</h4>
                        <button 
                          onClick={fetchPersonnelDossier}
                          disabled={isGeneratingDossier}
                          className="px-3 py-1 bg-primary/10 border border-primary/20 text-primary rounded-sm text-[8px] font-mono uppercase tracking-widest flex items-center gap-1.5 hover:bg-primary/20 transition-all disabled:opacity-50"
                        >
                           {isGeneratingDossier ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                           {isGeneratingDossier ? 'Scanning...' : 'Generate_Dossier'}
                        </button>
                     </div>

                     <AnimatePresence>
                        {dossier && (
                           <motion.div 
                             initial={{ opacity: 0, y: 10 }}
                             animate={{ opacity: 1, y: 0 }}
                             className="bg-black/40 border border-primary/20 rounded-xl p-5 space-y-4 relative overflow-hidden"
                           >
                              <div className="absolute top-0 right-0 p-3 opacity-10">
                                 <Command size={40} className="text-primary rotate-12" />
                              </div>
                              <div className="space-y-2 relative z-10">
                                 <div className="flex items-center gap-2">
                                    <span className="text-[8px] font-mono text-primary uppercase font-bold tracking-widest">Reliability_Score:</span>
                                    <span className="text-[10px] font-mono font-bold text-main-text">{dossier.reliabilityScore}%</span>
                                    <div className="flex-1 h-1 bg-surface-3 rounded-full overflow-hidden">
                                       <div className="h-full bg-primary" style={{ width: `${dossier.reliabilityScore}%` }} />
                                    </div>
                                 </div>
                                 <p className="text-[11px] font-sans text-main-text leading-relaxed italic border-l-2 border-primary/40 pl-4 py-1">
                                    "{dossier.summary}"
                                 </p>
                              </div>
                              <div className="space-y-2">
                                 <span className="text-[8px] font-mono text-primary uppercase font-bold tracking-widest">Psychological_Profile</span>
                                 <p className="text-[10px] text-main-text-muted leading-relaxed font-mono uppercase tracking-tighter opacity-80">{dossier.psychologicalProfile}</p>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                 {dossier.traits.map((trait, i) => (
                                    <span key={i} className="px-2 py-0.5 bg-primary/10 border border-primary/10 text-[9px] font-mono text-primary uppercase rounded-sm">{trait}</span>
                                 ))}
                              </div>
                           </motion.div>
                        )}
                     </AnimatePresence>
                  </section>

                  {/* Performance Scorecard (Feature 13) */}
                  <section className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[10px] font-mono uppercase tracking-[0.3em] text-main-text font-bold">Performance_Scorecard</h4>
                      <div className="flex items-center gap-1">
                        <Award size={10} className="text-warning" />
                        <span className="text-[9px] font-mono text-warning uppercase">Elite_Status</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                       {[
                         { label: 'Efficiency', value: performance?.efficiency || 0, color: 'bg-success' },
                         { label: 'Compliance', value: performance?.compliance || 0, color: 'bg-primary' },
                         { label: 'Attendance', value: performance?.attendance || 0, color: 'bg-info' }
                       ].map(m => (
                         <div key={m.label} className="p-4 bg-surface-2/50 border border-main-border rounded-xl space-y-2">
                           <span className="text-[8px] font-mono uppercase text-main-text-muted">{m.label}</span>
                           <div className="flex items-end gap-1">
                             <span className="text-xl font-mono text-main-text leading-none">{m.value}</span>
                             <span className="text-[8px] font-mono text-main-text-muted">%</span>
                           </div>
                           <div className="h-1 bg-surface-3 rounded-full overflow-hidden">
                             <motion.div initial={{ width: 0 }} animate={{ width: `${m.value}%` }} className={`h-full ${m.color}`} />
                           </div>
                         </div>
                       ))}
                    </div>
                  </section>

                  {/* Personnel Wellness (Feature 14) */}
                  <section className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[10px] font-mono uppercase tracking-[0.3em] text-main-text font-bold">Wellness_Status_Telemetry</h4>
                      {wellnessEntry && (
                        <div className={`px-2 py-0.5 rounded text-[8px] font-mono uppercase tracking-widest border ${
                          wellnessEntry.status === 'optimal' ? 'border-success text-success' :
                          wellnessEntry.status === 'stable' ? 'border-primary text-primary' :
                          wellnessEntry.status === 'stressed' ? 'border-warning text-warning' :
                          'border-error text-error'
                        }`}>
                          {wellnessEntry.status}
                        </div>
                      )}
                    </div>
                    {wellnessEntry ? (
                      <div className="p-4 bg-surface-2/30 border border-main-border rounded-xl space-y-3">
                         <div className="flex items-center justify-between">
                            <span className="text-[8px] font-mono text-main-text-muted uppercase">Last_Check: {format(wellnessEntry.timestamp, 'yyyy.MM.dd HH:mm')}</span>
                            <div className="flex gap-0.5">
                               {[...Array(5)].map((_, i) => (
                                 <div key={i} className={`w-1 h-3 rounded-full ${i < (wellnessEntry.score / 20) ? 'bg-primary' : 'bg-surface-3'}`} />
                               ))}
                            </div>
                         </div>
                         {wellnessEntry.notes && (
                           <p className="text-[10px] text-main-text-muted leading-relaxed italic border-l border-primary/30 pl-3">"{wellnessEntry.notes}"</p>
                         )}
                      </div>
                    ) : (
                      <div className="p-6 border border-dashed border-main-border rounded-xl text-center">
                         <p className="text-[8px] font-mono text-main-text-muted/40 uppercase tracking-widest">No_Wellness_Data_Available</p>
                      </div>
                    )}
                  </section>

                  {/* Skill Matrix (Feature 15) */}
                  <section className="space-y-4">
                    <h4 className="text-[10px] font-mono uppercase tracking-[0.3em] text-main-text font-bold">Skill_Matrix_Validation</h4>
                    <div className="flex flex-wrap gap-2">
                       {['Surveillance', 'Crisis_Mgmt', 'Logistics', 'Advanced_Comms', 'Rapid_Response'].map(skill => (
                         <div key={skill} className="px-3 py-1.5 bg-surface-2 border border-main-border rounded flex items-center gap-2 group hover:border-primary/50 transition-all cursor-crosshair">
                           <Brain size={10} className="text-primary opacity-50 group-hover:opacity-100" />
                           <span className="text-[9px] font-mono text-main-text-muted uppercase tracking-widest">{skill}</span>
                         </div>
                       ))}
                       <button className="px-3 py-1.5 border border-dashed border-main-border rounded text-[9px] font-mono text-main-text-muted hover:border-primary hover:text-primary transition-all">
                         + Add_Certification
                       </button>
                    </div>
                  </section>

                  {/* System Notes (Feature 14) */}
                  <section className="space-y-4">
                    <h4 className="text-[10px] font-mono uppercase tracking-[0.3em] text-main-text font-bold">Personnel_Encrypted_Logs</h4>
                    <div className="space-y-3">
                       <div className="p-4 bg-surface-2/30 border border-main-border rounded-xl space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[8px] font-mono text-primary uppercase font-bold text-main-text-muted">Admin Note // {format(new Date(), 'yyyy.MM.dd')}</span>
                            <Zap size={10} className="text-primary" />
                          </div>
                          <p className="text-xs text-main-text-muted leading-relaxed italic">"Unit demonstrated exceptional operational agility during Sector 7 power fluctuation. Recommendation: L0 clearance eligibility."</p>
                       </div>
                       <textarea 
                         placeholder="INPUT NEW PERSISTENT LOG ENTRY..."
                         value={adminNote}
                         onChange={(e) => setAdminNote(e.target.value)}
                         className="w-full bg-surface-2 border border-dashed border-main-border rounded-xl p-4 text-[10px] font-mono uppercase tracking-widest outline-none focus:border-primary/50 min-h-[100px] text-main-text-muted transition-all"
                       />
                    </div>
                  </section>
               </div>

               <div className="p-8 border-t border-main-border bg-surface-2/30 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${isSaving ? 'bg-warning animate-spin' : 'bg-success'} animate-pulse`} />
                    <span className="text-[8px] font-mono text-main-text-muted uppercase tracking-widest leading-none">
                      {isSaving ? 'Synchronizing_Data...' : 'Security_Audit_Clear'}
                    </span>
                  </div>
                  <button 
                    onClick={savePersonnelChanges}
                    disabled={isSaving}
                    className="px-6 py-2 bg-primary text-surface-1 rounded-lg text-[10px] font-mono uppercase font-bold tracking-widest hover:scale-105 transition-all disabled:opacity-50"
                  >
                    Commit_Changes
                  </button>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
