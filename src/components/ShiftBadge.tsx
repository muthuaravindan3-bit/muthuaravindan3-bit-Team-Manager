import React from 'react';
import { ShiftCode } from '../data/shiftSyncTypes';
import { SHIFT_CATALOG } from '../utils/shiftSyncEngine';

interface ShiftBadgeProps {
  shiftCode: ShiftCode;
  showTime?: boolean;
  size?: 'xs' | 'sm' | 'md';
  isDraftChanged?: boolean;
  isLocked?: boolean;
  className?: string;
}

export const ShiftBadge: React.FC<ShiftBadgeProps> = ({
  shiftCode,
  showTime = false,
  size = 'sm',
  isDraftChanged = false,
  isLocked = false,
  className = ''
}) => {
  const meta = SHIFT_CATALOG[shiftCode];
  if (!meta) return null;

  const sizeClasses =
    size === 'xs'
      ? 'px-1.5 py-0.5 text-[11px] gap-1'
      : size === 'sm'
      ? 'px-2 py-0.5 text-xs gap-1.5'
      : 'px-2.5 py-1 text-xs gap-2';

  return (
    <span
      className={`inline-flex items-center rounded-md border font-mono font-semibold tracking-tight select-none ${meta.bgClass} ${meta.borderClass} ${meta.textClass} ${sizeClasses} ${
        isDraftChanged ? 'ring-1 ring-[#06B6D4] ring-offset-1 ring-offset-[#07090E]' : ''
      } ${className}`}
      title={`${meta.label} (${meta.timeLabel}) · ${meta.scheduledHours}h scheduled`}
    >
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: meta.accentHex }}
        aria-hidden="true"
      />
      <span>{meta.code}</span>
      {showTime && (
        <span className="text-[11px] opacity-85 font-normal tabular-nums">
          · {meta.timeLabel}{meta.crossesMidnight ? ' · Next day' : ''}
        </span>
      )}
      {isDraftChanged && (
        <span
          className="ml-0.5 px-1 rounded bg-[#06B6D4]/25 text-[#22D3EE] text-[9px] uppercase tracking-wider"
          title="Unpublished draft modification"
        >
          Draft
        </span>
      )}
      {isLocked && (
        <span className="text-[10px] opacity-75" title="Locked assignment">
          🔒
        </span>
      )}
    </span>
  );
};
