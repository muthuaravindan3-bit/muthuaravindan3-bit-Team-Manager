import React, { useState } from 'react';
import { doc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { UserProfile } from '../../types';
import { Users, Plus, Trash2, Shield, User, Mail, Hash, MoreHorizontal, X, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';

interface UserManagementProps {
  users: UserProfile[];
  lastBreaks: Record<string, number>;
  onLogAction: (action: string, targetId: string, targetName: string, details?: string) => Promise<void>;
}

export function UserManagement({ users, lastBreaks, onLogAction }: UserManagementProps) {
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', employeeId: '', role: 'member' });
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

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
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex flex-col gap-3 flex-1 max-w-xl">
          <div className="flex gap-4">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="bg-black/40 border border-white/5 rounded-xl px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-300 focus:border-indigo-500 outline-none transition-all cursor-pointer appearance-none"
              style={{ backgroundImage: "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e\")", backgroundPosition: "right 0.5rem center", backgroundRepeat: "no-repeat", backgroundSize: "1.5em 1.5em", paddingRight: "2.5rem" }}
            >
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="member">Staff</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-black/40 border border-white/5 rounded-xl px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-300 focus:border-indigo-500 outline-none transition-all cursor-pointer appearance-none"
              style={{ backgroundImage: "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e\")", backgroundPosition: "right 0.5rem center", backgroundRepeat: "no-repeat", backgroundSize: "1.5em 1.5em", paddingRight: "2.5rem" }}
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input 
              type="text"
              placeholder="Search personnel..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-900 border border-white/5 rounded-2xl pl-12 pr-6 py-3.5 text-sm font-medium focus:border-indigo-500 outline-none transition-all placeholder:text-slate-600"
            />
          </div>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => setIsAddUserOpen(true)}
            className="btn-primary flex items-center gap-2.5"
          >
            <Plus size={18} />
            <span>Add Personnel</span>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isAddUserOpen && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }} 
            animate={{ height: 'auto', opacity: 1 }} 
            exit={{ height: 0, opacity: 0 }} 
            className="overflow-hidden"
          >
            <div className="bg-zinc-900 border border-indigo-500/20 rounded-2.5xl p-8 space-y-6 mb-6">
              <div className="flex justify-between items-center">
                 <h4 className="text-lg font-bold text-white">Personnel Registration</h4>
                 <button onClick={() => setIsAddUserOpen(false)} className="text-slate-500 hover:text-white transition-colors">
                   <X size={20} />
                 </button>
              </div>
              <div className="grid md:grid-cols-4 gap-6">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 ml-1">Full Name</label>
                  <input 
                    type="text" 
                    value={newUser.name}
                    onChange={e => setNewUser({...newUser, name: e.target.value})}
                    className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-500 transition-all"
                    placeholder="Jane Doe"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 ml-1">Email Address</label>
                  <input 
                    type="email" 
                    value={newUser.email}
                    onChange={e => setNewUser({...newUser, email: e.target.value})}
                    className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-500 transition-all"
                    placeholder="jane@company.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 ml-1">Personnel ID</label>
                  <input 
                    type="text" 
                    value={newUser.employeeId}
                    onChange={e => setNewUser({...newUser, employeeId: e.target.value})}
                    className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-500 font-mono transition-all"
                    placeholder="EMP-001"
                  />
                </div>
                <div className="flex items-end">
                  <button onClick={addUser} className="btn-primary w-full py-3.5 rounded-xl font-bold text-xs uppercase tracking-widest active:scale-95 transition-all">
                    Register Person
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-zinc-900 border border-white/5 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto overflow-y-auto max-h-[700px] no-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-zinc-900/90 backdrop-blur-xl">
              <tr className="border-b border-white/5">
                <th className="px-8 py-5 text-xs font-bold uppercase tracking-widest text-slate-500">Employee ID</th>
                <th className="px-8 py-5 text-xs font-bold uppercase tracking-widest text-slate-500">Name & Email</th>
                <th className="px-8 py-5 text-xs font-bold uppercase tracking-widest text-slate-500">Access Level</th>
                <th className="px-8 py-5 text-xs font-bold uppercase tracking-widest text-slate-500">Last Activity</th>
                <th className="px-8 py-5 text-xs font-bold uppercase tracking-widest text-slate-500">Status</th>
                <th className="px-8 py-5 text-xs font-bold uppercase tracking-widest text-slate-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredUsers.map((u, idx) => (
                <motion.tr 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: idx * 0.01 }}
                  key={u.uid} 
                  className="group hover:bg-white/[0.01] transition-colors"
                >
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                       <Hash size={14} className="text-slate-700" />
                       <input 
                         type="text"
                         defaultValue={u.employeeId || u.uid.slice(0, 6).toUpperCase()}
                         onBlur={(e) => updateField(u.uid, 'employeeId', e.target.value)}
                         className="text-xs font-mono bg-transparent text-slate-400 border-none outline-none w-24 focus:text-white focus:bg-black/20 rounded px-1 transition-all"
                       />
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/10 flex items-center justify-center font-bold text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition-all">
                        {(u.displayName || u.email || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-sm text-white group-hover:text-indigo-400 transition-colors tracking-tight">{u.displayName || 'No Name'}</span>
                        <input 
                          type="text"
                          defaultValue={u.email}
                          onBlur={(e) => updateField(u.uid, 'email', e.target.value.toLowerCase())}
                          className="text-xs text-slate-500 bg-transparent outline-none w-full max-w-[200px] focus:text-white transition-colors"
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <select 
                      value={u.role || 'member'} 
                      onChange={(e) => updateUserRole(u.uid, e.target.value)}
                      className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg border border-white/5 bg-black/40 text-slate-400 outline-none cursor-pointer focus:border-indigo-500 transition-all ${
                        u.role === 'admin' ? 'text-indigo-400 border-indigo-500/20' : ''
                      }`}
                    >
                      <option value="member">Staff</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="px-8 py-5">
                    {lastBreaks[u.uid] ? (
                      <div className="flex items-center space-x-2 text-xs font-medium text-slate-400">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                        <span>{format(lastBreaks[u.uid], 'MMM d, hh:mm a')}</span>
                      </div>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-700 uppercase italic tracking-widest">Inert</span>
                    )}
                  </td>
                  <td className="px-8 py-5">
                    {u.uid.length > 20 ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-500 uppercase tracking-widest">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-500/10 text-slate-500 uppercase tracking-widest">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-8 py-5 text-right">
                    <button 
                      onClick={() => deleteUser(u.uid)}
                      className="p-2 text-slate-700 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
