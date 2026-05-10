import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';
import { Report } from '../types';
import { Icons, cn, REPORT_TYPES, STATUS_COLORS, STATUS_LABELS } from '../constants';

// Declare leaflet.heat for TypeScript
declare module 'leaflet' {
  interface HeatLayerOptions {
    radius?: number;
    blur?: number;
    maxZoom?: number;
    max?: number;
    minOpacity?: number;
    gradient?: { [key: number]: string };
  }
  function heatLayer(latlngs: any[], options?: HeatLayerOptions): any;
}

// Fix for default marker icon in Leaflet
const DefaultIcon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
});

L.Marker.prototype.options.icon = DefaultIcon;

// Custom icon generator based on status
const getStatusIcon = (status: string) => {
  const colors: Record<string, string> = {
    'New': '#2563eb', // blue-600
    'Inspected': '#4f46e5', // indigo-600
    'Pricing': '#9333ea', // purple-600
    'Negotiating': '#ea580c', // orange-600
    'Permitted': '#0d9488', // teal-600
    'Repairing': '#d97706', // amber-600
    'Repaired': '#059669', // emerald-600
    'Verified': '#16a34a', // green-600
    'Archived': '#475569', // slate-600
    'Rejected': '#dc2626', // red-600
  };

  const color = colors[status] || '#64748b';

  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="background-color: ${color}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.3);"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
    popupAnchor: [0, -6],
  });
};

const HeatLayer: React.FC<{ reports: Report[] }> = ({ reports }) => {
  const map = useMap();

  React.useEffect(() => {
    if (!map || reports.length === 0) return;

    const points = reports
      .filter(r => r.location)
      .map(r => [r.location.lat, r.location.lng, 0.5]); // intensity 0.5

    const heatLayer = (L as any).heatLayer(points, {
      radius: 25,
      blur: 15,
      maxZoom: 17,
      gradient: { 0.4: 'blue', 0.65: 'lime', 1: 'red' }
    }).addTo(map);

    return () => {
      map.removeLayer(heatLayer);
    };
  }, [map, reports]);

  return null;
};

const MapUpdater: React.FC<{ reports: Report[] }> = ({ reports }) => {
  const map = useMap();
  
  React.useEffect(() => {
    if (reports.length > 0) {
      const validReports = reports.filter(r => r.location);
      if (validReports.length > 0) {
        const bounds = L.latLngBounds(validReports.map(r => [r.location.lat, r.location.lng]));
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
      }
    }
  }, [reports, map]);
  
  return null;
};

interface CitizenMapProps {
  reports: Report[];
  className?: string;
  onReportClick?: (report: Report) => void;
  showHeatMap?: boolean;
  center?: { lat: number, lng: number };
  zoom?: number;
  interactive?: boolean;
}

export const CitizenMap: React.FC<CitizenMapProps> = ({ 
  reports, 
  className, 
  onReportClick, 
  showHeatMap: initialShowHeatMap = false,
  center,
  zoom: initialZoom = 12,
  interactive = true
}) => {
  const [mapType, setMapType] = React.useState<'street' | 'satellite'>('street');
  const [showHeatMap, setShowHeatMap] = React.useState(initialShowHeatMap);
  const defaultCenter: [number, number] = center ? [center.lat, center.lng] : [36.2648, 2.7539]; // Medea, Algeria
  
  return (
    <div className={cn("relative w-full h-[calc(100vh-200px)] rounded-3xl overflow-hidden shadow-inner border border-slate-200", className)}>
      <MapContainer 
        center={defaultCenter} 
        zoom={initialZoom} 
        scrollWheelZoom={interactive}
        dragging={interactive}
        zoomControl={interactive}
        doubleClickZoom={interactive}
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
        <MapUpdater reports={reports} />
        
        {showHeatMap ? (
          <HeatLayer reports={reports} />
        ) : (
          reports.map((report) => {
            if (!report.location) return null;
            
            return (
              <Marker 
                key={report.id} 
                position={[report.location.lat, report.location.lng]}
                icon={getStatusIcon(report.status)}
              >
                <Popup>
                  <div className="p-1 min-w-[200px] font-sans rtl text-right" dir="rtl">
                    <div className="flex items-center gap-3 mb-3">
                      <img 
                        src={report.photoUrl} 
                        className="w-12 h-12 rounded-lg object-cover shadow-sm" 
                        alt="Report" 
                      />
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm m-0">
                          {Object.values(REPORT_TYPES).flat().find((t: any) => t.id === report.type)?.label || report.type}
                        </h4>
                        <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-bold inline-block mt-1", STATUS_COLORS[report.status] || "bg-slate-100 text-slate-600")}>
                          {STATUS_LABELS[report.status] || report.status}
                        </span>
                      </div>
                    </div>
                    
                    <div className="space-y-2 text-xs text-slate-600">
                      <p className="flex items-center gap-2">
                        <Icons.Location className="w-3 h-3 text-brand-primary" />
                        {report.municipality}، {report.district}
                      </p>
                      <p className="flex items-center gap-2">
                        <Icons.Calendar className="w-3 h-3 text-brand-primary" />
                        {new Date(report.createdAt).toLocaleDateString('ar-DZ')}
                      </p>
                    </div>
                    
                    <button 
                      onClick={() => onReportClick?.(report)}
                      className="w-full mt-3 py-2 bg-brand-primary text-white text-xs font-bold rounded-lg hover:bg-brand-primary/90 transition-colors"
                    >
                      عرض التفاصيل
                    </button>
                  </div>
                </Popup>
              </Marker>
            );
          })
        )}

        {interactive && (
          <div className="absolute top-4 left-4 z-20 flex flex-col gap-2">
            <button 
              onClick={() => setMapType(mapType === 'street' ? 'satellite' : 'street')}
              className="p-3 bg-white rounded-full shadow-lg border border-slate-100 hover:bg-slate-50 transition-all text-brand-primary"
              title="تبديل نوع الخريطة"
            >
              {mapType === 'street' ? <Icons.Map className="w-6 h-6" /> : <Icons.Dashboard className="w-6 h-6" />}
            </button>
            <button 
              onClick={() => setShowHeatMap(!showHeatMap)}
              className={cn(
                "p-3 rounded-full shadow-lg border transition-all",
                showHeatMap ? "bg-brand-primary text-white border-brand-primary" : "bg-white text-brand-primary border-slate-100 hover:bg-slate-50"
              )}
              title="تبديل الخريطة الحرارية"
            >
              <Icons.AI className="w-6 h-6" />
            </button>
          </div>
        )}

        {interactive && (
          <div className="absolute bottom-4 right-4 z-20 bg-white/90 backdrop-blur-sm p-4 rounded-2xl shadow-xl border border-slate-100 max-w-[200px] font-sans rtl text-right" dir="rtl">
            <h5 className="text-xs font-bold text-slate-900 mb-3 border-b border-slate-100 pb-2">دليل الخريطة</h5>
            
            {showHeatMap ? (
              <div className="space-y-2">
                <p className="text-[10px] text-slate-500 mb-2">كثافة البلاغات في المنطقة:</p>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500 shadow-sm"></div>
                  <span className="text-[10px] text-slate-700">كثافة عالية (بؤرة ساخنة)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-lime-500 shadow-sm"></div>
                  <span className="text-[10px] text-slate-700">كثافة متوسطة</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500 shadow-sm"></div>
                  <span className="text-[10px] text-slate-700">كثافة منخفضة</span>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[150px] overflow-y-auto pr-1">
                {Object.entries(STATUS_LABELS).slice(0, 8).map(([key, label]) => {
                  const colors: Record<string, string> = {
                    'New': '#2563eb',
                    'Inspected': '#4f46e5',
                    'Pricing': '#9333ea',
                    'Negotiating': '#ea580c',
                    'Permitted': '#0d9488',
                    'Repairing': '#d97706',
                    'Repaired': '#059669',
                    'Verified': '#16a34a',
                  };
                  return (
                    <div key={key} className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: colors[key] || '#64748b' }}></div>
                      <span className="text-[10px] text-slate-700">{label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </MapContainer>
    </div>
  );
};
