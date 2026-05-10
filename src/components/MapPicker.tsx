import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, useMapEvents, useMap, Marker } from 'react-leaflet';
import L from 'leaflet';
import { Icons, cn } from '../constants';
import { toast } from 'sonner';
import RoutingMachine from './RoutingMachine';

// Fix for default marker icon in Leaflet
const DefaultIcon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface MapPickerProps {
  onLocationSelect?: (lat: number, lng: number) => void;
  initialLocation?: { lat: number, lng: number } | null;
  className?: string;
  readOnly?: boolean;
  showUserLocation?: boolean;
  routing?: {
    origin: [number, number];
    destination: [number, number];
    onRouteFound?: (route: any) => void;
    key?: number;
  } | null;
}

const UserLocationMarker = () => {
  const [position, setPosition] = React.useState<[number, number] | null>(null);
  const map = useMap();

  useEffect(() => {
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setPosition([pos.coords.latitude, pos.coords.longitude]);
      },
      (err) => console.warn('UserLocationMarker error:', err),
      { enableHighAccuracy: true }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  if (!position) return null;

  const userIcon = L.divIcon({
    className: 'user-location-marker',
    html: `<div style="background-color: #3b82f6; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(59, 130, 246, 0.5); position: relative;">
            <div style="position: absolute; top: -2px; left: -2px; right: -2px; bottom: -2px; border-radius: 50%; border: 2px solid #3b82f6; animation: pulse 2s infinite;"></div>
          </div>
          <style>
            @keyframes pulse {
              0% { transform: scale(1); opacity: 1; }
              100% { transform: scale(2.5); opacity: 0; }
            }
          </style>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });

  return <Marker position={position} icon={userIcon} />;
};

const LocationMarker = ({ onLocationSelect, readOnly }: { onLocationSelect?: (lat: number, lng: number) => void, readOnly?: boolean }) => {
  const map = useMapEvents({
    moveend: () => {
      if (readOnly) return;
      const center = map.getCenter();
      if (onLocationSelect) onLocationSelect(center.lat, center.lng);
    },
  });
  return null;
};

const MapController = ({ center }: { center: [number, number] }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
};

export const MapPicker: React.FC<MapPickerProps> = ({ onLocationSelect, initialLocation, className, readOnly, showUserLocation, routing }) => {
  const [mapType, setMapType] = React.useState<'street' | 'satellite'>('street');
  const defaultCenter: [number, number] = [36.2648, 2.7539]; // Medea
  const [mapCenter, setMapCenter] = React.useState<[number, number]>(
    initialLocation ? [initialLocation.lat, initialLocation.lng] : defaultCenter
  );

  const handleLocateMe = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const newCenter: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setMapCenter(newCenter);
        if (onLocationSelect) onLocationSelect(newCenter[0], newCenter[1]);
      },
      (err) => {
        console.error("Locate me failed", err);
        toast.error('فشل تحديد الموقع التلقائي');
      },
      { enableHighAccuracy: true }
    );
  };

  return (
    <div className={cn("relative w-full h-full rounded-3xl overflow-hidden shadow-inner border border-slate-200", className)}>
      <MapContainer 
        center={mapCenter} 
        zoom={16} 
        scrollWheelZoom={!readOnly}
        dragging={!readOnly}
        className="w-full h-full z-0"
      >
        {mapType === 'street' ? (
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        ) : (
          <TileLayer
            attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EBP, and the GIS User Community'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          />
        )}
        <LocationMarker onLocationSelect={onLocationSelect} readOnly={readOnly} />
        {showUserLocation && <UserLocationMarker />}
        {routing && (
          <RoutingMachine 
            key={routing.key}
            origin={routing.origin} 
            destination={routing.destination} 
            onRouteFound={routing.onRouteFound} 
          />
        )}
        <MapController center={mapCenter} />
      </MapContainer>
      
      {/* Map Type Toggle */}
      {(!readOnly || showUserLocation) && (
        <div className="absolute top-4 left-4 z-20 flex flex-col gap-2">
          <button 
            onClick={() => setMapType(mapType === 'street' ? 'satellite' : 'street')}
            className="p-3 bg-white rounded-full shadow-lg border border-slate-100 hover:bg-slate-50 transition-all text-brand-primary"
            title="تبديل نوع الخريطة"
          >
            {mapType === 'street' ? <Icons.Map className="w-6 h-6" /> : <Icons.Dashboard className="w-6 h-6" />}
          </button>
        </div>
      )}

      {/* Fixed Center Marker (Uber Style) */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full pointer-events-none z-10 mb-2">
        <div className={cn("flex flex-col items-center", !readOnly && "animate-bounce")}>
          <div className="w-10 h-10 bg-brand-primary rounded-full flex items-center justify-center shadow-2xl border-2 border-white">
            <Icons.Location className="w-6 h-6 text-white" />
          </div>
          <div className="w-1 h-4 bg-brand-primary shadow-lg"></div>
        </div>
      </div>

      {/* Locate Me Button */}
      {(!readOnly || showUserLocation) && (
        <button 
          onClick={handleLocateMe}
          className="absolute top-4 right-4 z-20 p-3 bg-white rounded-full shadow-lg border border-slate-100 hover:bg-slate-50 transition-all text-brand-primary"
          title="تحديد موقعي الحالي"
        >
          <Icons.Navigate className="w-6 h-6" />
        </button>
      )}
      
      {/* Map Overlay Info */}
      {!readOnly && (
        <div className="absolute bottom-4 left-4 right-4 z-20 pointer-events-none">
          <div className="bg-white/90 backdrop-blur px-4 py-2 rounded-xl shadow-lg border border-slate-100 text-center text-xs font-bold text-slate-600">
            حرك الخريطة لتحديد موقع البلاغ بدقة
          </div>
        </div>
      )}
    </div>
  );
};
