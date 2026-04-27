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
    <div className="w-full h-[600px] rounded-3xl overflow-hidden border border-[#141414]/5 shadow-xl">
      <MapContainer 
        center={defaultCenter} 
        zoom={13} 
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%' }}
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
              <div className="p-1">
                <p className="font-bold text-[#141414] mb-1">{user.displayName || user.email}</p>
                <p className="text-[10px] uppercase font-mono text-amber-600 bg-amber-50 px-1 rounded">On Break</p>
                <p className="text-[10px] text-gray-400 mt-2">
                  Last seen: {new Date(user.lastLocation!.timestamp).toLocaleTimeString()}
                </p>
                <a 
                  href={`https://www.google.com/maps/search/?api=1&query=${user.lastLocation!.latitude},${user.lastLocation!.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-blue-500 underline block mt-2"
                >
                  View on Google Maps
                </a>
              </div>
            </Popup>
          </Marker>
        ))}
        {activeBreakers.length === 0 && (
           <div className="absolute inset-0 z-[1000] bg-white/50 backdrop-blur-sm flex items-center justify-center pointer-events-none">
             <div className="bg-white p-6 rounded-2xl shadow-xl text-center max-w-xs border border-gray-100">
               <p className="font-bold text-[#141414] mb-2">No Active Personnel Tracking</p>
               <p className="text-xs text-gray-400">Map will populate when members initialize break protocol with GPS enabled.</p>
             </div>
           </div>
        )}
      </MapContainer>
    </div>
  );
};

export default LiveMap;
