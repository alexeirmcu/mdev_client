import { useState } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";

const markerIcon = L.divIcon({
  className: "",
  html: '<div style="background:#3b82f6;width:20px;height:20px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

function ClickHandler({ onMove }) {
  useMapEvents({ click: (e) => onMove([e.latlng.lat, e.latlng.lng]) });
  return null;
}

export default function MapPicker({ lat, lng, onConfirm, onClose }) {
  const [pos, setPos] = useState(lat != null && lng != null ? [lat, lng] : [40.4168, -3.7038]);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-[90vw] max-w-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="h-[400px]">
          <MapContainer center={pos} zoom={13} className="h-full w-full" scrollWheelZoom={true}>
            <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <ClickHandler onMove={setPos} />
            <Marker position={pos} icon={markerIcon} />
          </MapContainer>
        </div>
        <div className="p-4 flex items-center justify-between border-t border-gray-200">
          <p className="text-sm text-gray-500 font-mono">{pos[0].toFixed(4)}, {pos[1].toFixed(4)}</p>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 transition">Cancel</button>
            <button onClick={() => onConfirm(pos[0], pos[1])} className="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition">Confirm</button>
          </div>
        </div>
      </div>
    </div>
  );
}
