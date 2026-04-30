import React, { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, doc, onSnapshot, query, orderBy, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { Resource } from '../../types';
import { 
  Shield, Truck, Radio, Zap, Settings, AlertTriangle, Plus, Trash2, Search, Filter, Activity, 
  MapPin, Loader2, Sparkles, Brain, CheckCircle2, XCircle, RotateCw, History
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { predictResourceMaintenance } from '../../geminiService';

export function ResourceVault() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [filter, setFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [isAnalyzing, setIsAnalyzing] = useState<string | null>(null);
  const [predictions, setPredictions] = useState<Record<string, any>>({});

  const [newResource, setNewResource] = useState<Partial<Resource>>({
    name: '',
    type: 'equipment',
    status: 'available',
    serialNumber: '',
    health: 100,
    notes: '',
    location: 'HUB_01'
  });

  useEffect(() => {
    const q = query(collection(db, 'resources'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setResources(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Resource)));
      setLoading(false);
    }, (e) => handleFirestoreError(e, OperationType.GET, 'resources'));

    return () => unsubscribe();
  }, []);

  const addResource = async () => {
    if (!newResource.name || !newResource.serialNumber) return;
    try {
      await addDoc(collection(db, 'resources'), {
        ...newResource,
        lastMaintained: Date.now()
      });
      setIsAdding(false);
      setNewResource({ name: '', type: 'equipment', status: 'available', serialNumber: '', health: 100, notes: '', location: 'HUB_01' });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'resources');
    }
  };

  const deleteResource = async (id: string) => {
    if (!window.confirm("Confirm decommissioning of tactical resource?")) return;
    try {
      await deleteDoc(doc(db, 'resources', id));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, 'resources');
    }
  };

  const runMaintenancePrediction = async (resource: Resource) => {
    setIsAnalyzing(resource.id);
    try {
      const result = await predictResourceMaintenance(resource, [
        "Mission Operation Gamma completed",
        "Personnel shift 12 usage logged",
        "Environmental stress exposure moderate"
      ]);
      setPredictions(prev => ({ ...prev, [resource.id]: result }));
    } catch (e) {
      console.error("Prediction failed:", e);
    } finally {
      setIsAnalyzing(null);
    }
  };

  const filtered = resources.filter(r => 
    (r.name.toLowerCase().includes(filter.toLowerCase()) || r.serialNumber.toLowerCase().includes(filter.toLowerCase())) &&
    (typeFilter === 'all' || r.type === typeFilter)
  );

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-main-border pb-6">
        <div>
          <h2 className="text-xl font-display font-medium text-main-text uppercase tracking-tight flex items-center gap-3">
            <Shield className="text-primary" />
            Tactical Resource Vault
          </h2>
          <p className="text-[10px] font-mono text-main-text-muted mt-1 uppercase tracking-widest">Equipment_Status_Grid // Kernel_v4</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="px-4 py-2 bg-primary text-black font-mono text-[10px] uppercase tracking-wider font-bold rounded flex items-center gap-2 hover:scale-[1.02] transition-all"
        >
          <Plus size={14} />
          Register_Asset
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-2 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-main-text-muted/30" size={14} />
          <input 
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="FILTER_BY_NAME_OR_S/N..."
            className="w-full bg-surface-1 border border-main-border rounded-lg pl-10 pr-4 py-2.5 text-xs font-mono text-main-text outline-none focus:border-primary transition-all placeholder:text-main-text-muted/20"
          />
        </div>
        <div className="flex gap-2">
           <select 
             value={typeFilter}
             onChange={(e) => setTypeFilter(e.target.value)}
             className="w-full bg-surface-1 border border-main-border rounded-lg px-4 py-2.5 text-[10px] font-mono text-main-text-muted uppercase outline-none focus:border-primary transition-all appearance-none cursor-pointer"
           >
              <option value="all">Types::All</option>
              <option value="equipment">Equipment</option>
              <option value="vehicle">Vehicle</option>
              <option value="drone">Drone</option>
              <option value="comms">Comms</option>
           </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence>
          {filtered.map((resource) => (
            <motion.div 
              key={resource.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface-1 border border-main-border rounded-xl p-6 space-y-4 hover:border-primary/30 transition-all group relative overflow-hidden shadow-lg"
            >
               <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                     <div className="p-2 bg-surface-2 rounded-lg border border-main-border group-hover:border-primary/50 transition-colors">
                        {resource.type === 'equipment' && <Settings size={18} className="text-secondary" />}
                        {resource.type === 'vehicle' && <Truck size={18} className="text-warning" />}
                        {resource.type === 'drone' && <Activity size={18} className="text-primary" />}
                        {resource.type === 'comms' && <Radio size={18} className="text-success" />}
                     </div>
                     <div>
                        <h3 className="text-sm font-display font-medium text-main-text uppercase tracking-tight">{resource.name}</h3>
                        <p className="text-[9px] font-mono text-main-text-muted uppercase tracking-wider">{resource.serialNumber}</p>
                     </div>
                  </div>
                  <div className={`px-2 py-0.5 rounded text-[8px] font-mono uppercase tracking-widest border ${
                    resource.status === 'available' ? 'border-success text-success bg-success/5' :
                    resource.status === 'deployed' ? 'border-primary text-primary bg-primary/5' :
                    resource.status === 'maintenance' ? 'border-warning text-warning bg-warning/5' :
                    'border-error text-error bg-error/5'
                  }`}>
                    {resource.status}
                  </div>
               </div>

               <div className="space-y-2">
                  <div className="flex justify-between items-center text-[8px] font-mono uppercase text-main-text-muted">
                    <span>Integrity_Status</span>
                    <span className={resource.health < 40 ? 'text-error animate-pulse' : 'text-main-text'}>{resource.health}%</span>
                  </div>
                  <div className="w-full h-1 bg-surface-2 rounded-full overflow-hidden">
                     <motion.div 
                       initial={{ width: 0 }}
                       animate={{ width: `${resource.health}%` }}
                       className={`h-full ${
                         resource.health < 30 ? 'bg-error' :
                         resource.health < 70 ? 'bg-warning' : 'bg-success'
                       }`}
                     />
                  </div>
               </div>

               <div className="flex items-center gap-4 text-[9px] font-mono text-main-text-muted uppercase">
                  <div className="flex items-center gap-1.5 hover:text-main-text transition-colors cursor-default">
                     <MapPin size={10} />
                     <span>{resource.location}</span>
                  </div>
                  <div className="flex items-center gap-1.5 hover:text-main-text transition-colors cursor-default">
                     <History size={10} />
                     <span>{format(resource.lastMaintained, 'MM/dd')}</span>
                  </div>
               </div>

               {predictions[resource.id] && (
                 <motion.div 
                   initial={{ opacity: 0, height: 0 }}
                   animate={{ opacity: 1, height: 'auto' }}
                   className="p-3 bg-primary/5 border border-primary/20 rounded-md space-y-2"
                 >
                    <div className="flex items-center justify-between">
                       <span className="text-[8px] font-mono font-bold text-primary uppercase tracking-widest">Cortex_Maintenance_Advisory</span>
                       <span className={`text-[8px] font-mono font-bold uppercase transition-colors ${predictions[resource.id].maintenanceNeeded ? 'text-error' : 'text-success'}`}>
                          {predictions[resource.id].maintenanceNeeded ? 'Required' : 'Optimal'}
                       </span>
                    </div>
                    <p className="text-[10px] text-main-text leading-relaxed italic">"{predictions[resource.id].rationale}"</p>
                    <div className="text-[8px] font-mono text-main-text-muted uppercase tracking-tighter">Timeline: {predictions[resource.id].timeline}</div>
                 </motion.div>
               )}

               <div className="flex justify-between items-center pt-2 border-t border-main-border">
                  <button 
                    onClick={() => runMaintenancePrediction(resource)}
                    disabled={isAnalyzing === resource.id}
                    className="text-[9px] font-mono text-primary hover:text-primary-hover flex items-center gap-1.5 uppercase transition-colors disabled:opacity-50"
                  >
                    {isAnalyzing === resource.id ? <Loader2 size={12} className="animate-spin" /> : <Brain size={12} />}
                    {isAnalyzing === resource.id ? 'Analyzing...' : 'Run_AI_Diagnostics'}
                  </button>
                  <button 
                    onClick={() => deleteResource(resource.id)}
                    className="p-1.5 text-main-text-muted hover:text-error hover:bg-error/5 rounded transition-all"
                  >
                     <Trash2 size={14} />
                  </button>
               </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
             <motion.div 
               initial={{ opacity: 0 }} 
               animate={{ opacity: 1 }} 
               exit={{ opacity: 0 }} 
               onClick={() => setIsAdding(false)} 
               className="fixed inset-0 bg-surface-3/80 backdrop-blur-md" 
             />
             <motion.div 
               initial={{ scale: 0.98, opacity: 0 }} 
               animate={{ scale: 1, opacity: 1 }} 
               exit={{ scale: 0.98, opacity: 0 }} 
               className="bg-surface-1 rounded-lg border border-main-border p-8 w-full max-w-lg relative z-10 shadow-2xl overflow-hidden"
             >
                <div className="absolute top-0 left-0 w-full h-1 bg-primary animate-pulse" />
                <h3 className="text-lg font-medium text-main-text mb-6 uppercase tracking-tight italic flex items-center gap-3">
                   <Shield className="text-primary" />
                   Register New Tactical Asset
                </h3>

                <div className="space-y-4">
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                         <label className="text-[10px] font-mono text-main-text-muted uppercase">Asset_Name</label>
                         <input 
                           type="text"
                           value={newResource.name}
                           onChange={(e) => setNewResource({...newResource, name: e.target.value})}
                           placeholder="Ex: Drone Alpha X"
                           className="w-full bg-surface-2 border border-main-border rounded px-3 py-2 text-xs font-mono text-main-text outline-none focus:border-primary transition-all"
                         />
                      </div>
                      <div className="space-y-1.5">
                         <label className="text-[10px] font-mono text-main-text-muted uppercase">Serial_Number</label>
                         <input 
                           type="text"
                           value={newResource.serialNumber}
                           onChange={(e) => setNewResource({...newResource, serialNumber: e.target.value})}
                           placeholder="SN-XXXX-XXXX"
                           className="w-full bg-surface-2 border border-main-border rounded px-3 py-2 text-xs font-mono text-main-text outline-none focus:border-primary transition-all"
                         />
                      </div>
                   </div>

                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                         <label className="text-[10px] font-mono text-main-text-muted uppercase">Asset_Type</label>
                         <select 
                           value={newResource.type}
                           onChange={(e) => setNewResource({...newResource, type: e.target.value as any})}
                           className="w-full bg-surface-2 border border-main-border rounded px-3 py-2 text-xs font-mono text-main-text outline-none focus:border-primary transition-all"
                         >
                            <option value="equipment">Equipment</option>
                            <option value="vehicle">Vehicle</option>
                            <option value="drone">Drone</option>
                            <option value="comms">Comms</option>
                         </select>
                      </div>
                      <div className="space-y-1.5">
                         <label className="text-[10px] font-mono text-main-text-muted uppercase">Initial_Hull_Integrity</label>
                         <input 
                           type="number"
                           value={newResource.health}
                           onChange={(e) => setNewResource({...newResource, health: parseInt(e.target.value)})}
                           className="w-full bg-surface-2 border border-main-border rounded px-3 py-2 text-xs font-mono text-main-text outline-none focus:border-primary transition-all"
                         />
                      </div>
                   </div>

                   <div className="space-y-1.5">
                      <label className="text-[10px] font-mono text-main-text-muted uppercase">Base_DeploymentHub</label>
                      <input 
                        type="text"
                        value={newResource.location}
                        onChange={(e) => setNewResource({...newResource, location: e.target.value})}
                        className="w-full bg-surface-2 border border-main-border rounded px-3 py-2 text-xs font-mono text-main-text outline-none focus:border-primary transition-all"
                      />
                   </div>
                </div>

                <div className="flex gap-4 mt-8">
                   <button 
                     onClick={() => setIsAdding(false)}
                     className="flex-1 py-3 bg-surface-2 hover:bg-surface-3 text-main-text font-mono text-[10px] uppercase tracking-widest transition-colors rounded border border-main-border"
                   >
                     Cancel_Procedure
                   </button>
                   <button 
                     onClick={addResource}
                     className="flex-1 py-3 bg-primary hover:bg-primary-hover text-black font-mono text-[10px] uppercase tracking-widest transition-colors rounded font-bold"
                   >
                     Finalize_Registration
                   </button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
