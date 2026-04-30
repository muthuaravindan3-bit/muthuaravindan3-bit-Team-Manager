import React, { useMemo } from 'react';
import { Shift } from '../types';
import { startOfWeek, addDays, format, parse, isWithinInterval } from 'date-fns';
import { motion } from 'motion/react';
import { AlertCircle, Calendar } from 'lucide-react';

interface WorkloadHeatmapProps {
  shifts: Shift[];
}

const TIME_BLOCKS = [
  { label: '00:00 - 06:00', start: 0, end: 6 },
  { label: '06:00 - 12:00', start: 6, end: 12 },
  { label: '12:00 - 18:00', start: 12, end: 18 },
  { label: '18:00 - 24:00', start: 18, end: 24 }
];

export function WorkloadHeatmap({ shifts }: WorkloadHeatmapProps) {
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 }); // Monday

  const days = Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i));

  // Generate matrix
  const heatmapData = useMemo(() => {
    return TIME_BLOCKS.map(block => {
      return days.map(day => {
        const dayStr = format(day, 'yyyy-MM-dd');
        
        let personnelCount = 0;
        
        shifts.forEach(shift => {
          if (shift.date === dayStr) {
            try {
              const shiftStartHour = parseInt(shift.startTime.split(':')[0], 10);
              const shiftEndHour = parseInt(shift.endTime.split(':')[0], 10);
              
              const shiftEndsNextDay = shiftEndHour < shiftStartHour;
              
              // Simplistic overlap check
              const blockStart = block.start;
              const blockEnd = block.end;
              
              let isActive = false;
              if (shiftEndsNextDay) {
                if (shiftStartHour < blockEnd || blockStart < (shiftEndHour + 24)) {
                   isActive = true;
                }
              } else {
                if (shiftStartHour < blockEnd && shiftEndHour > blockStart) {
                  isActive = true;
                }
              }

              if (isActive) {
                personnelCount++;
              }
            } catch(e) {}
          }
        });
        
        return {
          day,
          count: personnelCount
        };
      });
    });
  }, [shifts, days]);

  const getHeatmapColor = (count: number) => {
    if (count === 0) return 'bg-surface-2 border-main-border text-main-text-muted'; // Neutral / Empty
    if (count < 2) return 'bg-error/20 border-error/50 text-error'; // Understaffed
    if (count >= 2 && count <= 4) return 'bg-success/20 border-success/50 text-success'; // Optimal
    return 'bg-warning/20 border-warning/50 text-warning hover:bg-warning/30 hover:border-warning/60 hover:text-warning-bold'; // High capacity/Demand
  };

  return (
    <div className="bg-surface-1 border border-main-border rounded-xl p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
         <div className="flex items-center gap-3">
           <div className="w-2 h-2 rounded-full bg-primary" />
           <h2 className="text-[11px] font-mono font-bold text-main-text uppercase tracking-[0.3em]">Workload Density (7-Day)</h2>
         </div>
         
         <div className="flex gap-4 items-center flex-wrap">
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-error/20 border border-error/50 rounded-sm"></div><span className="text-[9px] font-mono uppercase text-main-text-muted">Understaffed</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-success/20 border border-success/50 rounded-sm"></div><span className="text-[9px] font-mono uppercase text-main-text-muted">Optimal</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-warning/20 border border-warning/50 rounded-sm"></div><span className="text-[9px] font-mono uppercase text-main-text-muted">High Demand</span></div>
         </div>
      </div>

      <div className="overflow-x-auto scrollbar-thin pb-4">
        <div className="min-w-[600px]">
          {/* Header row (Days) */}
          <div className="grid grid-cols-[100px_repeat(7,1fr)] gap-2 mb-2">
            <div></div>
            {days.map(d => (
              <div key={d.toISOString()} className="text-center pb-2 border-b border-main-border/50">
                <p className="text-[10px] font-mono text-main-text-muted uppercase tracking-widest">{format(d, 'EEE')}</p>
                <p className="text-xs font-bold text-main-text">{format(d, 'dd')}</p>
              </div>
            ))}
          </div>

          {/* Body rows (Time Blocks) */}
          <div className="space-y-2">
            {TIME_BLOCKS.map((block, rowIdx) => (
              <div key={block.label} className="grid grid-cols-[100px_repeat(7,1fr)] gap-2 items-center">
                <div className="text-[9px] font-mono text-main-text-muted uppercase tracking-wider text-right pr-4">
                  {block.label}
                </div>
                {heatmapData[rowIdx].map((cell, colIdx) => (
                  <motion.div
                    key={`${rowIdx}-${colIdx}`}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: (rowIdx * 0.05) + (colIdx * 0.05) }}
                    className={`h-12 rounded border flex flex-col items-center justify-center transition-all duration-300 group cursor-pointer ${getHeatmapColor(cell.count)}`}
                    title={`${cell.count} personnel active`}
                  >
                    <span className="text-sm font-bold leading-none mb-1">{cell.count}</span>
                    <span className="text-[7px] font-mono uppercase tracking-[0.2em] opacity-60 mix-blend-plus-lighter">Units</span>
                  </motion.div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
