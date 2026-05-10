import L from 'leaflet';
import { createControlComponent } from '@react-leaflet/core';
import 'leaflet-routing-machine';

interface RoutingMachineProps {
  origin: [number, number];
  destination: [number, number];
  onRouteFound?: (route: any) => void;
}

const createRoutingMachineLayer = (props: RoutingMachineProps) => {
  const { origin, destination, onRouteFound } = props;

  const instance = L.Routing.control({
    waypoints: [
      L.latLng(origin[0], origin[1]),
      L.latLng(destination[0], destination[1]),
    ],
    lineOptions: {
      styles: [{ color: '#3b82f6', weight: 8, opacity: 0.8 }],
      extendToWaypoints: true,
      missingRouteTolerance: 10,
    },
    show: false,
    addWaypoints: false,
    routeWhileDragging: false,
    fitSelectedRoutes: true,
    showAlternatives: false,
    // @ts-ignore
    router: L.Routing.osrmv1({
      serviceUrl: 'https://router.project-osrm.org/route/v1',
      language: 'ar',
    }),
    // @ts-ignore
    createMarker: (i: number, waypoint: any) => {
      if (i === 0) return null; // Start point is handled by UserLocationMarker
      return L.marker(waypoint.latLng, {
        icon: L.icon({
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41]
        })
      });
    }
  });

  instance.on('routingerror', (e) => {
    console.warn('Routing error (offline?):', e.error?.message || 'Unknown routing error');
    // Provide a simple direct line fallback
    const directRoute = {
      summary: {
        totalDistance: L.latLng(origin[0], origin[1]).distanceTo(L.latLng(destination[0], destination[1])),
        totalTime: (L.latLng(origin[0], origin[1]).distanceTo(L.latLng(destination[0], destination[1])) / 13.8) // Assume 50km/h
      },
      instructions: [{
        text: 'اتجه مباشرة نحو الهدف (وضع أوفلاين)',
        distance: L.latLng(origin[0], origin[1]).distanceTo(L.latLng(destination[0], destination[1]))
      }]
    };
    if (onRouteFound) onRouteFound(directRoute);
  });

  instance.on('routesfound', (e) => {
    const routes = e.routes;
    if (routes && routes.length > 0 && onRouteFound) {
      onRouteFound(routes[0]);
    }
  });

  return instance;
};

const RoutingMachine = createControlComponent(createRoutingMachineLayer);

export default RoutingMachine;
