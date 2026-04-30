import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Activity, Zap, Shield, ShieldAlert, Cpu, Database, Network } from 'lucide-react';

export function SystemHealth() {
  const [metrics, setMetrics] = useState({
    cpu: 18,
    memory: 42,
    latency: 12,
    integrity: 98
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(prev => ({
        cpu: Math.max(10, Math.min(95, prev.cpu + (Math.random() * 6 - 3))),
        memory: Math.max(30, Math.min(85, prev.memory + (Math.random() * 2 - 1))),
        latency: Math.max(5, Math.min(150, prev.latency + (Math.random() * 10 - 5))),
        integrity: Math.max(90, Math.min(100, prev.integrity + (Math.random() * 0.2 - 0.1)))
      }));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard 
        label="Synaptic_Load" 
        value={`${metrics.cpu.toFixed(1)}%`} 
        icon={Cpu} 
        color="text-primary"
        trend={metrics.cpu > 70 ? 'critical' : 'normal'}
      />
      <MetricCard 
        label="Memory_Buffer" 
        value={`${metrics.memory.toFixed(1)}%`} 
        icon={Database} 
        color="text-secondary"
      />
      <MetricCard 
        label="Nodal_Latency" 
        value={`${metrics.latency.toFixed(0)}ms`} 
        icon={Network} 
        color="text-warning"
        trend={metrics.latency > 100 ? 'elevated' : 'normal'}
      />
      <MetricCard 
        label="Core_Integrity" 
        value={`${metrics.integrity.toFixed(2)}%`} 
        icon={Shield} 
        color="text-success"
      />
    </div>
  );
}

function MetricCard({ label, value, icon: Icon, color, trend = 'normal' }: any) {
  return (
    <div className="bg-surface-1 border border-main-border rounded-lg p-3 relative overflow-hidden group">
      <div className={`absolute top-0 left-0 w-1 h-full ${trend === 'critical' ? 'bg-error' : trend === 'elevated' ? 'bg-warning' : 'bg-primary/20'}`} />
      <div className="flex items-center gap-2 mb-2">
        <Icon size={12} className={color} />
        <span className="text-[8px] font-mono text-main-text-muted uppercase tracking-widest leading-none">{label}</span>
      </div>
      <div className="flex items-end justify-between">
        <span className="text-sm font-mono font-bold text-main-text tracking-tighter">{value}</span>
        {trend !== 'normal' && (
          <motion.div 
            animate={{ opacity: [0, 1, 0] }}
            transition={{ repeat: Infinity, duration: 1 }}
          >
            <ShieldAlert size={10} className={trend === 'critical' ? 'text-error' : 'text-warning'} />
          </motion.div>
        )}
      </div>
      
      {/* Background decoration */}
      <div className="absolute -bottom-2 -right-2 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity">
        <Icon size={40} />
      </div>
    </div>
  );
}
