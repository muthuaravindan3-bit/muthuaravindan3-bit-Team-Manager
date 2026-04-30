import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { UserProfile } from '../types';

// Fix for default marker icons in Leaflet
// @ts-ignore
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
// @ts-ignore
import markerIcon from 'leaflet/dist/images/marker-icon.png';
// @ts-ignore
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

interface LiveMapProps {
  users: UserProfile[];
}

const LiveMap: React.FC<LiveMapProps> = ({ users }) => {
  const activeBreakers = users.filter(u => u.isBreakActive && u.lastLocation);
  
  // Default center (can be tuned or set to the average of breakers)
  const defaultCenter: [number, number] = activeBreakers.length > 0 
    ? [activeBreakers[0].lastLocation!.latitude, activeBreakers[0].lastLocation!.longitude]
    : [0, 0];

  return (
    <div className="w-full h-[600px] rounded-md overflow-hidden border border-main-border shadow-[0_12px_24px_rgba(0,0,0,0.2)] bg-surface-1 relative">
      <div className="absolute top-6 left-6 z-[1000] p-4 bg-surface-1/90 backdrop-blur-md border border-main-border rounded shadow-lg pointer-events-none">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <div className="space-y-0.5">
            <h4 className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-main-text">Global_Vector_Stream</h4>
            <p className="text-[8px] font-mono text-main-text-muted uppercase tracking-widest">Active nodes: {activeBreakers.length}</p>
          </div>
        </div>
      </div>

      <MapContainer 
        center={defaultCenter} 
        zoom={13} 
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%', filter: 'grayscale(1) invert(0.9) contrast(0.8)' }}
        className="z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {activeBreakers.map((user) => (
          <Marker 
            key={user.uid} 
            position={[user.lastLocation!.latitude, user.lastLocation!.longitude]}
          >
            <Popup>
              <div className="p-3 bg-surface-1 border border-main-border rounded font-mono">
                <p className="font-bold text-[10px] text-main-text mb-2 uppercase tracking-tight">{user.displayName || user.email}</p>
                <div className="inline-block text-[8px] uppercase font-bold text-primary border border-primary/20 px-2 py-0.5 rounded mb-3">
                  PROTOCOL_ACTIVE
                </div>
                <div className="space-y-1 text-[8px] text-main-text-muted uppercase tracking-tighter">
                  <p>LAT: {user.lastLocation!.latitude.toFixed(6)}</p>
                  <p>LNG: {user.lastLocation!.longitude.toFixed(6)}</p>
                  <p>TX_STAMP: {new Date(user.lastLocation!.timestamp).toLocaleTimeString()}</p>
                </div>
                <a 
                  href={`https://www.google.com/maps/search/?api=1&query=${user.lastLocation!.latitude},${user.lastLocation!.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[9px] text-primary hover:underline block mt-4 font-bold tracking-widest"
                >
                  DECODE_LOCATION_EXTERNAL
                </a>
              </div>
            </Popup>
          </Marker>
        ))}
        {activeBreakers.length === 0 && (
           <div className="absolute inset-0 z-[1000] bg-surface-1/90 backdrop-blur-md flex items-center justify-center pointer-events-none border border-main-border/10">
             <div className="p-8 text-center max-w-sm">
                <div className="w-12 h-12 border border-main-border/30 rounded flex items-center justify-center mx-auto mb-6 opacity-20">
                  <div className="w-2 h-2 bg-main-text animate-ping" />
                </div>
                <h4 className="text-xs font-mono font-bold text-main-text mb-3 uppercase tracking-[0.3em]">No_Active_Signals</h4>
                <p className="text-[10px] font-mono text-main-text-muted uppercase leading-relaxed tracking-wider">
                  System waiting for break protocols to initialize. GPS telemetry will bridge on node activation.
                </p>
                <div className="mt-8 flex justify-center gap-2">
                  <div className="w-1 h-1 bg-main-text-muted/20" />
                  <div className="w-1 h-1 bg-main-text-muted/20" />
                  <div className="w-1 h-1 bg-main-text-muted/20" />
                </div>
             </div>
           </div>
        )}
      </MapContainer>
    </div>
  );
};

export default LiveMap;
