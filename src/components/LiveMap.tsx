import React, { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { UserProfile, BreakLog } from '../types';
import { MapPin } from 'lucide-react';

interface LiveMapProps {
  users: UserProfile[];
  breakLogs?: BreakLog[];
  selectedUserId?: string | null;
  maxBreakDurationMinutes?: number;
  now?: number;
}

const formatElapsed = (startTime?: number | null, nowTs: number = Date.now()) => {
  if (!startTime) return '00:00';
  const totalSeconds = Math.max(0, Math.floor((nowTs - startTime) / 1000));
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

const escapeHtml = (unsafe: string) =>
  unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const LiveMap: React.FC<LiveMapProps> = ({
  users,
  breakLogs = [],
  selectedUserId = null,
  maxBreakDurationMinutes = 30,
  now = Date.now(),
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersGroupRef = useRef<L.LayerGroup | null>(null);
  const lastFocusedUserRef = useRef<string | null>(null);

  const activeBreakersWithGps = users.filter(
    (u) => Boolean(u.isBreakActive && u.lastLocation)
  );
  const allActiveBreakers = users.filter((u) => Boolean(u.isBreakActive));

  // Initialize Leaflet Map instance cleanly inside useEffect (StrictMode safe)
  useEffect(() => {
    const el = containerRef.current;
    if (!el || mapRef.current) return;

    const initialCenter: [number, number] =
      activeBreakersWithGps.length > 0 && activeBreakersWithGps[0].lastLocation
        ? [
            activeBreakersWithGps[0].lastLocation.latitude,
            activeBreakersWithGps[0].lastLocation.longitude,
          ]
        : [13.0827, 80.2707];

    const map = L.map(el, {
      center: initialCenter,
      zoom: activeBreakersWithGps.length > 0 ? 14 : 4,
      scrollWheelZoom: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    const layerGroup = L.layerGroup().addTo(map);
    mapRef.current = map;
    layersGroupRef.current = layerGroup;

    // Ensure proper sizing if inside animated/tab container
    const resizeTimer = window.setTimeout(() => {
      map.invalidateSize();
    }, 150);

    return () => {
      window.clearTimeout(resizeTimer);
      map.remove();
      mapRef.current = null;
      layersGroupRef.current = null;
    };
  }, []);

  // Synchronize markers and movement polylines on telemetry updates
  useEffect(() => {
    const map = mapRef.current;
    const layerGroup = layersGroupRef.current;
    if (!map || !layerGroup) return;

    layerGroup.clearLayers();

    activeBreakersWithGps.forEach((member) => {
      const loc = member.lastLocation;
      if (!loc) return;

      const activeLog = breakLogs.find(
        (l) =>
          l.id === member.activeBreakLogId ||
          (l.userId === member.uid && !l.endTime)
      );

      const trailPositions: [number, number][] = Array.isArray(activeLog?.path)
        ? activeLog!.path
            .filter(
              (pt) =>
                typeof pt.latitude === 'number' &&
                typeof pt.longitude === 'number'
            )
            .map((pt) => [pt.latitude, pt.longitude])
        : [];

      const elapsedSeconds = member.breakStartTime
        ? Math.max(0, Math.floor((now - member.breakStartTime) / 1000))
        : 0;
      const isOvertime = elapsedSeconds / 60 > maxBreakDurationMinutes;
      const accentHex = isOvertime ? '#ef4444' : '#f59e0b';

      if (trailPositions.length > 1) {
        L.polyline(trailPositions, {
          color: accentHex,
          weight: 4,
          opacity: 0.85,
        }).addTo(layerGroup);
      }

      const initials = escapeHtml(
        (member.displayName || member.email || 'TM')
          .slice(0, 2)
          .toUpperCase()
      );

      const customIcon = L.divIcon({
        className: 'shiftsync-gps-marker',
        html: `<div style="
          width: 32px;
          height: 32px;
          border-radius: 9999px;
          background: ${accentHex};
          color: #0c0b09;
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-weight: 700;
          font-size: 11px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid #ffffff;
          box-shadow: 0 4px 12px rgba(0,0,0,0.35);
        ">${initials}</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -16],
      });

      const safeName = escapeHtml(member.displayName || member.email || 'Member');
      const timerText = formatElapsed(member.breakStartTime, now);
      const updatedStr = new Date(loc.timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      const popupHtml = `
        <div style="min-width: 190px; font-family: 'Plus Jakarta Sans', sans-serif; padding: 2px;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; margin-bottom: 6px;">
            <strong style="font-size: 12px; color: #111827;">${safeName}</strong>
            <span style="font-family: monospace; font-size: 11px; font-weight: 700; padding: 2px 6px; border-radius: 4px; background: ${
              isOvertime ? '#fee2e2' : '#fef3c7'
            }; color: ${isOvertime ? '#b91c1c' : '#92400e'};">${timerText}</span>
          </div>
          <div style="font-family: monospace; font-size: 11px; color: #4b5563; line-height: 1.5;">
            <div>GPS: ${loc.latitude.toFixed(5)}, ${loc.longitude.toFixed(5)}</div>
            <div>Updated: ${escapeHtml(updatedStr)}</div>
            ${
              trailPositions.length > 0
                ? `<div>Waypoints: ${trailPositions.length}</div>`
                : ''
            }
          </div>
          <div style="margin-top: 8px;">
            <a href="https://www.google.com/maps/search/?api=1&query=${loc.latitude},${loc.longitude}" target="_blank" rel="noopener noreferrer" style="font-size: 11px; font-weight: 600; color: #b45309; text-decoration: underline;">
              Open in Google Maps ↗
            </a>
          </div>
        </div>
      `;

      const marker = L.marker([loc.latitude, loc.longitude], {
        icon: customIcon,
      })
        .bindPopup(popupHtml)
        .addTo(layerGroup);

      if (selectedUserId && member.uid === selectedUserId) {
        marker.openPopup();
      }
    });

    // Pan smoothly when user clicks "Locate on Map" or "Track Live"
    if (selectedUserId && selectedUserId !== lastFocusedUserRef.current) {
      const targetUser = activeBreakersWithGps.find(
        (u) => u.uid === selectedUserId
      );
      if (targetUser?.lastLocation) {
        map.setView(
          [
            targetUser.lastLocation.latitude,
            targetUser.lastLocation.longitude,
          ],
          15,
          { animate: true }
        );
        lastFocusedUserRef.current = selectedUserId;
      }
    } else if (
      !lastFocusedUserRef.current &&
      activeBreakersWithGps.length > 0 &&
      activeBreakersWithGps[0].lastLocation
    ) {
      map.setView(
        [
          activeBreakersWithGps[0].lastLocation.latitude,
          activeBreakersWithGps[0].lastLocation.longitude,
        ],
        14
      );
      lastFocusedUserRef.current = activeBreakersWithGps[0].uid;
    }
  }, [
    activeBreakersWithGps,
    breakLogs,
    selectedUserId,
    maxBreakDurationMinutes,
    now,
  ]);

  return (
    <div className="w-full h-[420px] rounded-xl overflow-hidden border border-main-border bg-surface-2 relative">
      {/* Top Floating Telemetry Status Pill */}
      <div className="absolute top-3 left-3 z-[400] px-3 py-2 bg-surface-2/95 backdrop-blur-md border border-main-border rounded-lg shadow-md flex items-center gap-2.5 pointer-events-none">
        <span
          className={`w-2 h-2 rounded-full ${
            allActiveBreakers.length > 0
              ? 'bg-primary animate-pulse'
              : 'bg-main-text-disabled'
          }`}
        />
        <div className="text-xs">
          <span className="font-semibold text-main-text">
            Live GPS Break Radar
          </span>
          <span className="text-main-text-muted font-mono tabular-nums ml-2">
            {activeBreakersWithGps.length} GPS signal
            {activeBreakersWithGps.length === 1 ? '' : 's'} ·{' '}
            {allActiveBreakers.length} on break
          </span>
        </div>
      </div>

      {/* Leaflet Canvas Mount */}
      <div ref={containerRef} className="w-full h-full z-0" />

      {activeBreakersWithGps.length === 0 && (
        <div className="absolute inset-x-4 bottom-4 z-[400] p-3.5 rounded-xl bg-surface-2/95 backdrop-blur-md border border-main-border shadow-lg flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <MapPin className="w-4 h-4 text-primary shrink-0" />
            <div className="text-xs">
              <p className="font-semibold text-main-text">
                {allActiveBreakers.length > 0
                  ? `${allActiveBreakers.length} member(s) on break — awaiting browser GPS coordinates`
                  : 'No team members are currently on an active break'}
              </p>
              <p className="text-main-text-muted text-[11px]">
                {allActiveBreakers.length > 0
                  ? 'Live timers are running in the tracker panel above. Click "Sync My GPS" in the Break Drawer to broadcast coordinates.'
                  : 'When a team member starts a break, their live timer, GPS pin, and movement trail appear here automatically.'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveMap;
