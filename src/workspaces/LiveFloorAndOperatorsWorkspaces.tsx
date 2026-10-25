import { activeAssignments, publishedAssignments, facilityDay, facilityTime, isDaySwingOverlap } from '../services/operationalSelectors';
import { staffingAt } from '../services/schedulingPolicy';
import React, { useState, useMemo } from 'react';
import {
  Radar,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Users,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Navigation,
  Award,
  Activity,
  Search,
  Clock,
  Shield
} from 'lucide-react';
import { useShiftSync } from '../context/ShiftSyncContext';
import { ShiftBadge } from '../components/ShiftBadge';
import { computeOperatorWeeklySummary } from '../utils/shiftSyncEngine';
import { BOUNDARY_ASSIGNMENTS } from '../data/shiftSyncSeed';

export const LiveFloorRadarWorkspace: React.FC = () => {
  const {
    publishedCurrentScope, demoNowIso, scopes,
    operators,
    incidents,
    fleetUnits,
    missions,
    setSupportingPanel
  } = useShiftSync();

  const [zoom, setZoom] = useState<number>(1);
  const [selectedSector, setSelectedSector] = useState<string>('ALL');
  const [secondaryTab, setSecondaryTab] = useState<'stations' | 'fleet' | 'missions'>('stations');

  const publishedToday = useMemo(() => publishedAssignments(scopes, BOUNDARY_ASSIGNMENTS), [scopes]);
  const currentAssignments = useMemo(() => activeAssignments(publishedToday, demoNowIso), [publishedToday, demoNowIso]);
  const activeFloorOperators = useMemo(() => operators.map((op) => {
    const assign = currentAssignments.find((assignment) => assignment.operatorId === op.id);
    return { op, assign, isOnFloorNow: Boolean(assign && (assign.availability ?? 'present') === 'present') };
  }).filter((item) => selectedSector === 'ALL' || (item.assign?.zone ?? item.op.zone) === selectedSector), [operators, currentAssignments, selectedSector]);
  const sectors = [
    {
      name: 'Sector A · Core Ops',
      x: 40,
      y: 40,
      w: 320,
      h: 210,
      target: 9,
      min: 8,
      accent: '#06B6D4'
    },
    {
      name: 'Sector B · Substation',
      x: 390,
      y: 40,
      w: 320,
      h: 210,
      target: 6,
      min: 5,
      accent: '#10B981'
    },
    {
      name: 'Sector C · Telemetry',
      x: 40,
      y: 280,
      w: 320,
      h: 190,
      target: 3,
      min: 3,
      accent: '#818CF8'
    },
    {
      name: 'Sector D · Dispatch',
      x: 390,
      y: 280,
      w: 320,
      h: 190,
      target: 2,
      min: 2,
      accent: '#F59E0B'
    }
  ];

  const activeTotalCount = staffingAt(publishedToday, operators, Date.parse(demoNowIso), undefined, undefined, true);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="p-4 rounded-2xl bg-[#0D1117] border border-slate-800/90 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/40 font-mono text-[10px] text-emerald-300">
              PUBLISHED ROSTER ({publishedCurrentScope.version}) ONLY
            </span>
            <h1 className="font-display text-xl font-bold text-slate-100">
              Live Floor Radar · Facility Sector Map
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {facilityDay(demoNowIso)} · {facilityTime(demoNowIso)} IST · {isDaySwingOverlap(demoNowIso) ? 'Day/Swing overlap active' : 'Day/Swing overlap inactive'} · Simulated local activity ·{' '}
            <strong className="font-mono text-[#22D3EE]">{activeTotalCount}/20 positions staffed</strong>
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {['ALL', ...sectors.map((s) => s.name)].map((sec) => (
            <button
              key={sec}
              onClick={() => setSelectedSector(sec)}
              className={`px-3 py-1.5 rounded-xl font-mono text-xs border transition-colors ${
                selectedSector === sec
                  ? 'bg-[#06B6D4]/20 border-[#06B6D4] text-[#22D3EE] font-semibold'
                  : 'bg-[#151B24] border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              {sec === 'ALL' ? 'All Sectors' : sec.split('·')[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Main Split: Dark Vector Facility Map (7 cols) + Accessible Station/Fleet/Missions Panel (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Vector Map */}
        <div className="lg:col-span-7 rounded-2xl bg-[#0D1117] border border-slate-800/90 p-4 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-mono text-slate-300 flex items-center gap-2">
              <Radar className="w-4 h-4 text-[#06B6D4]" />
              <span>Interactive Sector Schematic (Click operator node to inspect dossier)</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setZoom((z) => Math.min(1.35, +(z + 0.15).toFixed(2)))}
                aria-label="Zoom in facility map"
                className="p-1.5 rounded-lg bg-[#151B24] hover:bg-slate-800 border border-slate-700 text-slate-200"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setZoom((z) => Math.max(0.85, +(z - 0.15).toFixed(2)))}
                aria-label="Zoom out facility map"
                className="p-1.5 rounded-lg bg-[#151B24] hover:bg-slate-800 border border-slate-700 text-slate-200"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  setZoom(1);
                  setSelectedSector('ALL');
                }}
                aria-label="Reset facility map view"
                className="p-1.5 rounded-lg bg-[#151B24] hover:bg-slate-800 border border-slate-700 text-slate-200"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="relative rounded-xl bg-[#07090E] border border-slate-800 overflow-hidden flex items-center justify-center min-h-[430px]">
            <svg
              viewBox="0 0 750 510"
              style={{ transform: `scale(${zoom})`, transition: 'transform 200ms ease-out' }}
              className="w-full h-auto max-h-[460px]"
              role="img"
              aria-label="Interactive facility floor map showing Sectors A, B, C, and D with live operator station markers"
            >
              {/* Subtle Grid Lines */}
              <defs>
                <pattern id="hud-grid" width="30" height="30" patternUnits="userSpaceOnUse">
                  <path
                    d="M 30 0 L 0 0 0 30"
                    fill="none"
                    stroke="rgba(148,163,184,0.06)"
                    strokeWidth="1"
                  />
                </pattern>
              </defs>
              <rect width="750" height="510" fill="url(#hud-grid)" />

              {/* Sector Zones */}
              {sectors.map((sec) => {
                const isSelected = selectedSector === 'ALL' || selectedSector === sec.name;
                const activeInSector = publishedToday.filter((a) => {
                  const op = operators.find((o) => o.id === a.operatorId);
                  return (
                    op?.zone === sec.name && ['1ST', '2ND', 'GEN'].includes(a.shiftCode)
                  );
                }).length;
                const sectorIncidents = incidents.filter(
                  (i) => i.zone === sec.name && i.status !== 'Resolved'
                );

                return (
                  <g
                    key={sec.name}
                    onClick={() =>
                      setSelectedSector(selectedSector === sec.name ? 'ALL' : sec.name)
                    }
                    className="cursor-pointer"
                    opacity={isSelected ? 1 : 0.35}
                  >
                    <rect
                      x={sec.x}
                      y={sec.y}
                      width={sec.w}
                      height={sec.h}
                      rx="14"
                      fill="#0D1117"
                      stroke={sectorIncidents.length > 0 ? '#F59E0B' : sec.accent}
                      strokeWidth="2"
                    />
                    <text
                      x={sec.x + 16}
                      y={sec.y + 28}
                      className="fill-slate-100 font-display text-sm font-bold"
                    >
                      {sec.name}
                    </text>
                    <text
                      x={sec.x + sec.w - 16}
                      y={sec.y + 28}
                      textAnchor="end"
                      className="fill-[#22D3EE] font-mono text-xs font-bold"
                    >
                      {activeInSector}/{sec.target} staffed
                    </text>

                    {sectorIncidents.length > 0 && (
                      <g
                        onClick={(e) => {
                          e.stopPropagation();
                          setSupportingPanel({
                            kind: 'incident_detail',
                            entityId: sectorIncidents[0].id,
                            widthPx: 430
                          });
                        }}
                      >
                        <rect
                          x={sec.x + 16}
                          y={sec.y + 38}
                          width="175"
                          height="20"
                          rx="4"
                          fill="rgba(245,158,11,0.2)"
                          stroke="#F59E0B"
                        />
                        <text
                          x={sec.x + 24}
                          y={sec.y + 52}
                          className="fill-amber-300 font-mono text-[10px] font-bold"
                        >
                          ⚠ {sectorIncidents[0].id} ACTIVE
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}

              {/* Operator Station Markers */}
              {operators.map((op) => {
                const assign = publishedToday.find((a) => a.operatorId === op.id);
                const isOnFloor = assign
                  ? ['1ST', '2ND', 'GEN'].includes(assign.shiftCode)
                  : false;
                const px = (op.stationCoords.x / 100) * 700 + 25;
                const py = (op.stationCoords.y / 100) * 440 + 35;

                const color = !isOnFloor
                  ? '#475569'
                  : assign?.shiftCode === '1ST'
                  ? '#06B6D4'
                  : assign?.shiftCode === '2ND'
                  ? '#10B981'
                  : '#F59E0B';

                return (
                  <g
                    key={op.id}
                    onClick={() =>
                      setSupportingPanel({
                        kind: 'operator_dossier',
                        entityId: op.id,
                        widthPx: 430
                      })
                    }
                    className="cursor-pointer"
                  >
                    {isOnFloor && (
                      <circle cx={px} cy={py} r="15" fill={color} opacity="0.2" />
                    )}
                    <circle
                      cx={px}
                      cy={py}
                      r="10"
                      fill="#07090E"
                      stroke={color}
                      strokeWidth="2.5"
                    />
                    <text
                      x={px}
                      y={py + 3.5}
                      textAnchor="middle"
                      className="fill-slate-100 font-mono text-[8px] font-bold"
                    >
                      {op.avatarInitials}
                    </text>
                    <text
                      x={px}
                      y={py + 22}
                      textAnchor="middle"
                      className="fill-slate-300 font-mono text-[9px]"
                    >
                      {op.badgeCode}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
            <div className="flex items-center gap-3 font-mono">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#06B6D4]" /> 1ST · Day (07:30–16:30)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]" /> 2ND · Swing (12:30–20:30)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" /> GEN · General (09:00–18:00)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-600" /> Off / Upcoming 3RD
              </span>
            </div>
          </div>
        </div>

        {/* Keyboard-Accessible Station List & Secondary Fleet/Missions Tabs */}
        <div className="lg:col-span-5 rounded-2xl bg-[#0D1117] border border-slate-800/90 p-4 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <div className="inline-flex rounded-xl bg-[#151B24] p-1 border border-slate-800">
              {(
                [
                  { id: 'stations', label: `Stations (${activeFloorOperators.length})` },
                  { id: 'fleet', label: `Fleet (${fleetUnits.length})` },
                  { id: 'missions', label: `Missions (${missions.length})` }
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setSecondaryTab(tab.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                    secondaryTab === tab.id
                      ? 'bg-slate-800 text-[#22D3EE] border border-[#06B6D4]/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {secondaryTab === 'stations' && (
            <div className="space-y-2 max-h-[430px] overflow-y-auto pr-1">
              {activeFloorOperators.map(({ op, assign, isOnFloorNow }) => (
                <button
                  key={op.id}
                  onClick={() =>
                    setSupportingPanel({
                      kind: 'operator_dossier',
                      entityId: op.id,
                      widthPx: 430
                    })
                  }
                  className="w-full p-3 rounded-xl bg-[#151B24]/80 hover:bg-[#151B24] border border-slate-800 text-left flex items-center justify-between gap-3 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-display font-bold text-xs text-slate-100">
                        {op.name}
                      </span>
                      <span className="font-mono text-[11px] text-[#22D3EE]">{op.badgeCode}</span>
                      {isOnFloorNow ? (
                        <span className="px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-300 font-mono text-[9px]">
                          ON FLOOR
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono text-[9px]">
                          OFF / LATER
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {op.jobTitle} · {op.zone}
                    </div>
                  </div>
                  {assign && <ShiftBadge shiftCode={assign.shiftCode} size="xs" />}
                </button>
              ))}
            </div>
          )}

          {secondaryTab === 'fleet' && (
            <div className="space-y-2.5">
              <div className="text-[11px] text-slate-400 bg-[#151B24]/60 p-2.5 rounded-lg border border-slate-800">
                Simulated autonomous telemetry units paired with on-duty floor operators.
              </div>
              {fleetUnits.map((unit) => {
                const op = operators.find((o) => o.id === unit.assignedOperatorId);
                return (
                  <div
                    key={unit.id}
                    className="p-3 rounded-xl bg-[#151B24] border border-slate-800 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-display font-bold text-xs text-slate-100">
                        {unit.name} ({unit.id})
                      </span>
                      <span className="font-mono text-xs text-[#34D399]">{unit.batteryPct}% BAT</span>
                    </div>
                    <div className="text-xs text-slate-300">
                      Status: <strong className="text-[#22D3EE]">{unit.status}</strong> · {unit.zone}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Assigned Controller: {op?.name} ({op?.badgeCode})
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {secondaryTab === 'missions' && (
            <div className="space-y-2.5">
              <div className="text-[11px] text-slate-400 bg-[#151B24]/60 p-2.5 rounded-lg border border-slate-800">
                Active shift operational tasks linked to published floor squads.
              </div>
              {missions.map((msn) => {
                const op = operators.find((o) => o.id === msn.leadOperatorId);
                return (
                  <div
                    key={msn.id}
                    className="p-3 rounded-xl bg-[#151B24] border border-slate-800 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-[#22D3EE]">{msn.id}</span>
                      <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 font-mono text-[10px] text-slate-200">
                        {msn.status} · ETA {msn.etaLabel}
                      </span>
                    </div>
                    <div className="font-display font-bold text-xs text-slate-100">{msn.title}</div>
                    <div className="text-[11px] text-slate-400">
                      {msn.zone} · Lead: {op?.name} ({op?.badgeCode})
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const OperatorDossiersWorkspace: React.FC = () => {
  const { operators, activeScope, scopes, demoNowIso, setSupportingPanel } = useShiftSync();
  const [search, setSearch] = useState('');
  const [selectedCert, setSelectedCert] = useState<string>('ALL');

  const allCerts = useMemo(() => {
    const set = new Set<string>();
    operators.forEach((op) => op.certifications.forEach((c) => set.add(c)));
    return ['ALL', ...Array.from(set)];
  }, [operators]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return operators.filter((op) => {
      if (selectedCert !== 'ALL' && !op.certifications.includes(selectedCert)) return false;
      if (!q) return true;
      return (
        op.name.toLowerCase().includes(q) ||
        op.badgeCode.toLowerCase().includes(q) ||
        op.jobTitle.toLowerCase().includes(q) ||
        op.zone.toLowerCase().includes(q)
      );
    });
  }, [operators, search, selectedCert]);

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-2xl bg-[#0D1117] border border-slate-800/90 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-bold text-slate-100">
            Operator Dossiers · Workforce Directory ({filtered.length})
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Inspect active certifications, scheduled vs paid hours, minimum turnaround windows, and simulated readiness indices.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, #OP-XXXX, role..."
              aria-label="Search operators"
              className="pl-8 pr-3 py-1.5 rounded-xl bg-[#151B24] border border-slate-800 text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:border-[#06B6D4]"
            />
          </div>

          <select
            aria-label="Filter by certification"
            value={selectedCert}
            onChange={(e) => setSelectedCert(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-[#151B24] border border-slate-800 text-xs font-mono text-slate-200"
          >
            {allCerts.map((c) => (
              <option key={c} value={c}>
                {c === 'ALL' ? 'All Certifications' : `Cert: ${c}`}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((op) => {
          const summary = computeOperatorWeeklySummary(
            op.id,
            activeScope.days,
            activeScope.publishedAssignments,
            BOUNDARY_ASSIGNMENTS
          );
          const todayAssign = activeAssignments(publishedAssignments(scopes, BOUNDARY_ASSIGNMENTS), demoNowIso).find((a) => a.operatorId === op.id);

          return (
            <div
              key={op.id}
              onClick={() =>
                setSupportingPanel({
                  kind: 'operator_dossier',
                  entityId: op.id,
                  widthPx: 430
                })
              }
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  setSupportingPanel({
                    kind: 'operator_dossier',
                    entityId: op.id,
                    widthPx: 430
                  });
                }
              }}
              className="p-4 rounded-2xl bg-[#0D1117] hover:bg-[#151B24]/90 border border-slate-800/90 hover:border-[#06B6D4]/50 transition-all cursor-pointer space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#06B6D4]/15 border border-[#06B6D4]/40 flex items-center justify-center font-display font-bold text-[#22D3EE]">
                    {op.avatarInitials}
                  </div>
                  <div>
                    <div className="font-display font-bold text-sm text-slate-100">{op.name}</div>
                    <div className="text-xs text-slate-400">
                      {op.jobTitle} · <span className="text-slate-300">{op.permissionRole}</span>
                    </div>
                  </div>
                </div>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-[#22D3EE]">
                  {op.badgeCode}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-300 bg-[#151B24] p-2.5 rounded-xl border border-slate-800">
                <span className="truncate">{op.zone}</span>
                {todayAssign && <ShiftBadge shiftCode={todayAssign.shiftCode} size="xs" />}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {op.certifications.map((c) => (
                  <span
                    key={c}
                    className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 font-mono text-[11px] text-slate-300"
                  >
                    {c}
                  </span>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/80 font-mono text-xs">
                <div>
                  <div className="text-[10px] text-slate-400">Sched / Paid</div>
                  <div className="font-bold text-slate-100 tabular-nums">
                    {summary.totalScheduledHours}h / {summary.totalPaidHours}h
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400">Min Turnaround</div>
                  <div className="font-bold text-[#22D3EE] tabular-nums">
                    {summary.minRestHours === 99 ? '≥24h' : `${summary.minRestHours}h`}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400">Readiness (Demo)</div>
                  <div className="font-bold text-emerald-400 tabular-nums">
                    {op.readinessIndex}%
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
