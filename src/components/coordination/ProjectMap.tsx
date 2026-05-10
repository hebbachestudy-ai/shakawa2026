import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Project } from '../../types';
import L from 'leaflet';
import { PROJECT_STATUS_LABELS } from '../../constants';

// Fix Leaflet marker icon issue
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

interface ProjectMapProps {
  projects: Project[];
  fullScreen?: boolean;
}

export const ProjectMap: React.FC<ProjectMapProps> = ({ projects, fullScreen }) => {
  const center: [number, number] = [36.2648, 2.7539]; // Default center (e.g., Medea)

  return (
    <div className={fullScreen ? "w-full h-full" : "w-full h-[400px] rounded-2xl overflow-hidden border border-slate-200"}>
      <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        {projects.map(project => (
          <React.Fragment key={project.id}>
            <Marker position={[project.latitude, project.longitude]}>
              <Popup>
                <div className="text-right rtl" dir="rtl">
                  <p className="font-bold text-sm mb-1">{project.title}</p>
                  <p className="text-[10px] text-slate-500 mb-2">{project.ownerDirectorateName}</p>
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-600 rounded-full text-[10px] font-bold">
                    {PROJECT_STATUS_LABELS[project.status]}
                  </span>
                </div>
              </Popup>
            </Marker>
            {project.status === 'conflict_detected' && (
              <Circle 
                center={[project.latitude, project.longitude]}
                radius={200}
                pathOptions={{ color: 'red', fillColor: 'red', fillOpacity: 0.2 }}
              />
            )}
            {project.status === 'reserved_area' && (
              <Circle 
                center={[project.latitude, project.longitude]}
                radius={150}
                pathOptions={{ color: 'teal', fillColor: 'teal', fillOpacity: 0.2 }}
              />
            )}
          </React.Fragment>
        ))}
      </MapContainer>
    </div>
  );
};
