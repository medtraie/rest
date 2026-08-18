import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { 
  Search, 
  Pause, 
  Play, 
  Layers, 
  Route, 
  Wifi, 
  WifiOff, 
  Navigation, 
  RefreshCw, 
  Crosshair, 
  Gauge, 
  Clock3, 
  Eye, 
  EyeOff,
  Truck,
  User,
  Radio,
  Signal,
  Compass,
  Phone,
  Settings2,
  Sparkles,
  ShieldCheck,
  ChevronRight,
  ChevronLeft,
  BatteryCharging,
  Maximize2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapContainer, Marker, Popup, TileLayer, Polyline, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '@/lib/supabaseClient';
import { useApp } from '@/contexts/AppContext';
import { useLanguage, useT } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { kvGet, kvSet } from '@/lib/kv';

type FilterMode = 'all' | 'moving' | 'stopped' | 'offline';
type MapLayerType = 'dark' | 'google_roads' | 'google_hybrid' | 'osm';

export interface LiveVehicle {
  id: string;
  name: string;
  plate: string;
  driverName: string;
  driverPhone?: string;
  lat: number;
  lng: number;
  speed: number;
  heading: number;
  moving: boolean;
  online: boolean;
  status: 'moving' | 'stopped' | 'offline';
  timestamp: string;
  imei: string;
  batteryLevel?: number;
  fuelLevel?: number;
  bottlesCount?: number;
  source: 'gpswox' | 'simulated';
}

const MOROCCO_CENTER: [number, number] = [32.0, -6.5];

// Map Tile Layers
const MAP_LAYERS: Record<MapLayerType, { name: string; url: string; attribution: string; subdomains?: string[] }> = {
  dark: {
    name: 'Cyber Dark (2026)',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; CartoDB &copy; OpenStreetMap',
    subdomains: ['a', 'b', 'c', 'd'],
  },
  google_roads: {
    name: 'Google Roads',
    url: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    attribution: '&copy; Google Maps',
  },
  google_hybrid: {
    name: 'Google Satellite',
    url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    attribution: '&copy; Google Maps Satellite',
  },
  osm: {
    name: 'OpenStreetMap',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
  },
};

// Base coordinates for simulation across major Moroccan distribution axes
const MOROCCAN_HUBS = [
  { name: 'Casablanca Port / Ain Sebaa', lat: 33.595, lng: -7.58 },
  { name: 'Rabat Agdal / Hay Riad', lat: 33.98, lng: -6.85 },
  { name: 'Marrakech Sidi Ghanem', lat: 31.65, lng: -8.03 },
  { name: 'Tanger Med / Zone Franche', lat: 35.76, lng: -5.81 },
  { name: 'Fès Route de Meknès', lat: 34.02, lng: -5.02 },
  { name: 'Agadir Anza / Dakhla', lat: 30.42, lng: -9.59 },
  { name: 'Meknès Bassatine', lat: 33.89, lng: -5.55 },
  { name: 'Oujda Zone Industrielle', lat: 34.68, lng: -1.91 },
];

const createVehicleIcon = (vehicle: LiveVehicle, isSelected: boolean) => {
  const isMoving = vehicle.moving && vehicle.online;
  const isStopped = vehicle.online && !vehicle.moving;
  const isOffline = !vehicle.online;

  const color = isSelected
    ? '#38bdf8' // Sky blue
    : isMoving
    ? '#10b981' // Emerald
    : isStopped
    ? '#f59e0b' // Amber
    : '#64748b'; // Slate

  const glowColor = isSelected
    ? 'rgba(56, 189, 248, 0.6)'
    : isMoving
    ? 'rgba(16, 185, 129, 0.5)'
    : isStopped
    ? 'rgba(245, 158, 11, 0.4)'
    : 'rgba(100, 116, 139, 0.2)';

  const heading = vehicle.heading || 0;

  return L.divIcon({
    className: 'custom-live-marker',
    html: `
      <div style="position:relative; width:44px; height:44px; display:flex; align-items:center; justify-content:center; cursor:pointer;">
        ${
          isSelected
            ? `<div style="position:absolute; width:52px; height:52px; border-radius:999px; border:2px solid ${color}; animation:ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite; opacity:0.75;"></div>`
            : ''
        }
        <div style="
          position:absolute; 
          width:36px; 
          height:36px; 
          border-radius:12px; 
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
          border: 2px solid ${color};
          box-shadow: 0 0 16px ${glowColor}, 0 4px 6px -1px rgba(0,0,0,0.5);
          display:flex; 
          align-items:center; 
          justify-content:center;
          transform: rotate(${heading}deg);
          transition: transform 0.4s ease;
        ">
          <svg style="width:18px; height:18px; fill:${color};" viewBox="0 0 24 24">
            <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/>
          </svg>
        </div>

        <div style="
          position:absolute; 
          bottom:-8px; 
          left:50%; 
          transform:translateX(-50%); 
          background:#090d16; 
          color:#f8fafc; 
          border:1px solid ${color}; 
          font-size:9px; 
          font-weight:900; 
          padding:1px 4px; 
          border-radius:6px; 
          white-space:nowrap;
          box-shadow:0 2px 4px rgba(0,0,0,0.6);
        ">
          ${vehicle.speed > 0 ? `${Math.round(vehicle.speed)} km/h` : 'STOP'}
        </div>
      </div>
    `,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -22],
  });
};

const GPSWOX_CONFIG_KEY = 'gpswox_config_v1';

export const LiveMap = () => {
  const { language } = useLanguage();
  const t = useT();
  const { toast } = useToast();
  const { trucks = [], drivers = [] } = useApp();

  const tr = useCallback((fr: string, ar: string) => (language === 'ar' ? ar : fr), [language]);

  const mapRef = useRef<L.Map | null>(null);
  const pollTimerRef = useRef<number | null>(null);

  // States
  const [vehicles, setVehicles] = useState<LiveVehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [activeLayer, setActiveLayer] = useState<MapLayerType>('dark');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [refreshIntervalSec, setRefreshIntervalSec] = useState('10');
  const [clusterEnabled, setClusterEnabled] = useState(true);
  const [tracesEnabled, setTraceEnabled] = useState(true);
  const [traceHistory, setTraceHistory] = useState<Record<string, [number, number][]>>({});
  const [lastSyncTime, setLastSyncTime] = useState<string>('');

  // GPSwox Settings Dialog
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [gpswoxUrl, setGpswoxUrl] = useState('');
  const [gpswoxEmail, setGpswoxEmail] = useState('');
  const [gpswoxPassword, setGpswoxPassword] = useState('');
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Lookup map for drivers
  const driverMap = useMemo(() => {
    const map = new Map<string, any>();
    (drivers || []).forEach((d: any) => {
      if (d?.id) map.set(String(d.id), d);
    });
    return map;
  }, [drivers]);

  // Load saved GPSwox config from KV or LocalStorage
  useEffect(() => {
    void (async () => {
      try {
        const cloudConfig = await kvGet<any>(GPSWOX_CONFIG_KEY);
        const localConfig = typeof window !== 'undefined' ? localStorage.getItem(GPSWOX_CONFIG_KEY) : null;
        const config = cloudConfig || (localConfig ? JSON.parse(localConfig) : null);
        if (config) {
          setGpswoxUrl(config.apiUrl || '');
          setGpswoxEmail(config.email || '');
          setGpswoxPassword(config.password || '');
        }
      } catch {}
    })();
  }, []);

  // Generate realistic fleet simulation from user's actual trucks
  const generateSimulatedFleet = useCallback((): LiveVehicle[] => {
    const rawTrucks = Array.isArray(trucks) && trucks.length > 0
      ? trucks
      : [
          { id: 'sim-1', matricule: '12450-A-26', driverId: 'd-1', isActive: true, truckType: 'camion' },
          { id: 'sim-2', matricule: '98412-B-50', driverId: 'd-2', isActive: true, truckType: 'camion' },
          { id: 'sim-3', matricule: '34109-D-01', driverId: 'd-3', isActive: true, truckType: 'petit-camion' },
          { id: 'sim-4', matricule: '77215-A-11', driverId: 'd-4', isActive: true, truckType: 'camion' },
          { id: 'sim-5', matricule: '65902-H-33', driverId: 'd-5', isActive: false, truckType: 'camion' },
        ];

    return rawTrucks.map((truck: any, index: number) => {
      const hub = MOROCCAN_HUBS[index % MOROCCAN_HUBS.length];
      const driver = truck.driverId ? driverMap.get(String(truck.driverId)) : null;

      // Realistic jitter for live movement feel
      const seed = index + 1;
      const isOnline = truck.isActive !== false;
      const isMoving = isOnline && index % 3 !== 2;
      const speed = isMoving ? 35 + ((seed * 13) % 55) : 0;
      const heading = (seed * 67) % 360;

      // Small jitter around hub
      const latOffset = ((Math.sin(seed * 4.2) * 0.15) + (Math.random() * 0.005));
      const lngOffset = ((Math.cos(seed * 3.8) * 0.15) + (Math.random() * 0.005));

      const bottleTotal = (truck.currentLoad || []).reduce((acc: number, item: any) => acc + (Number(item?.quantity) || 0), 0);

      return {
        id: String(truck.id),
        name: truck.matricule || `Camion #${index + 1}`,
        plate: truck.matricule || `MAT-${1000 + index}`,
        driverName: driver?.name || (truck.driverName ?? `Chauffeur ${index + 1}`),
        driverPhone: driver?.telephone,
        lat: hub.lat + latOffset,
        lng: hub.lng + lngOffset,
        speed,
        heading,
        moving: isMoving,
        online: isOnline,
        status: !isOnline ? 'offline' : isMoving ? 'moving' : 'stopped',
        timestamp: new Date().toISOString(),
        imei: `8649200${100000 + index}`,
        batteryLevel: 85 + (seed % 15),
        fuelLevel: 45 + (seed * 9) % 50,
        bottlesCount: bottleTotal || 120 + (seed * 40) % 280,
        source: 'simulated',
      };
    });
  }, [trucks, driverMap]);

  // Main Live Data Fetcher with seamless fallback
  const fetchLiveFleet = useCallback(async () => {
    setIsLoading(true);
    try {
      // Attempt Edge Function connection
      const { data, error: invokeError } = await supabase.functions.invoke('gpswox');

      if (!invokeError && data && Array.isArray(data.devices) && data.devices.length > 0) {
        const liveDevices: LiveVehicle[] = data.devices
          .map((item: any): LiveVehicle | null => {
            const lat = Number(item.lat);
            const lng = Number(item.lng);
            if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return null;

            const speed = Number(item.speed) || 0;
            const isOnline = String(item.status || '').toLowerCase().includes('online') || String(item.status || '').toLowerCase().includes('active') || speed > 0;
            const isMoving = isOnline && speed > 0;

            return {
              id: String(item.id || item.imei || crypto.randomUUID()),
              name: String(item.name || item.plate || 'Véhicule'),
              plate: String(item.plate || item.plateNumber || item.name || '-'),
              driverName: String(item.driverName || item.driver || 'Chauffeur'),
              lat,
              lng,
              speed,
              heading: Number(item.heading || item.course || 0),
              moving: isMoving,
              online: isOnline,
              status: !isOnline ? 'offline' : isMoving ? 'moving' : 'stopped',
              timestamp: String(item.timestamp || new Date().toISOString()),
              imei: String(item.imei || item.uniqueId || '-'),
              batteryLevel: Number(item.battery || 90),
              fuelLevel: Number(item.fuel || 75),
              source: 'gpswox',
            };
          })
          .filter((v): v is LiveVehicle => Boolean(v));

        if (liveDevices.length > 0) {
          setVehicles(liveDevices);
          setIsLiveConnected(true);
          setLastSyncTime(new Date().toISOString());

          // Record live breadcrumbs
          setTraceHistory((prev) => {
            const next = { ...prev };
            liveDevices.forEach((v) => {
              const currentTrail = next[v.id] ? [...next[v.id]] : [];
              currentTrail.push([v.lat, v.lng]);
              next[v.id] = currentTrail.slice(-100);
            });
            return next;
          });
          return;
        }
      }

      // If GPSwox not connected, use the real trucks list from AppContext with realistic positions
      const simulated = generateSimulatedFleet();
      setVehicles(simulated);
      setIsLiveConnected(false);
      setLastSyncTime(new Date().toISOString());

      // Jitter breadcrumbs for simulation
      setTraceHistory((prev) => {
        const next = { ...prev };
        simulated.forEach((v) => {
          const currentTrail = next[v.id] ? [...next[v.id]] : [];
          currentTrail.push([v.lat, v.lng]);
          next[v.id] = currentTrail.slice(-100);
        });
        return next;
      });
    } catch {
      // Graceful fallback to real fleet
      const simulated = generateSimulatedFleet();
      setVehicles(simulated);
      setIsLiveConnected(false);
      setLastSyncTime(new Date().toISOString());
    } finally {
      setIsLoading(false);
    }
  }, [generateSimulatedFleet]);

  // Save GPSwox settings
  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    try {
      const config = {
        apiUrl: gpswoxUrl.trim(),
        email: gpswoxEmail.trim(),
        password: gpswoxPassword.trim(),
        updatedAt: new Date().toISOString(),
      };
      await kvSet(GPSWOX_CONFIG_KEY, config);
      if (typeof window !== 'undefined') {
        localStorage.setItem(GPSWOX_CONFIG_KEY, JSON.stringify(config));
      }
      toast({
        title: tr('Configuration enregistrée', 'تم حفظ الإعدادات'),
        description: tr('Tentative de connexion à GPSwox en cours...', 'جارٍ الاتصال بـ GPSwox...'),
      });
      setSettingsOpen(false);
      void fetchLiveFleet();
    } catch (err: any) {
      toast({
        title: tr('Erreur', 'خطأ'),
        description: err?.message || tr('Échec de la sauvegarde', 'فشل الحفظ'),
        variant: 'destructive',
      });
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Initial load
  useEffect(() => {
    void fetchLiveFleet();
  }, [fetchLiveFleet]);

  // Polling loop
  useEffect(() => {
    if (pollTimerRef.current) window.clearInterval(pollTimerRef.current);
    if (isPaused) return;

    const intervalMs = Math.max(5, Number(refreshIntervalSec) || 10) * 1000;
    pollTimerRef.current = window.setInterval(() => {
      void fetchLiveFleet();
    }, intervalMs);

    return () => {
      if (pollTimerRef.current) window.clearInterval(pollTimerRef.current);
    };
  }, [isPaused, refreshIntervalSec, fetchLiveFleet]);

  // Filtered vehicles
  const filteredVehicles = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return vehicles.filter((v) => {
      const matchesFilter =
        filterMode === 'all'
          ? true
          : filterMode === 'moving'
          ? v.moving && v.online
          : filterMode === 'stopped'
          ? v.online && !v.moving
          : !v.online;

      if (!matchesFilter) return false;
      if (!query) return true;

      return (
        v.name.toLowerCase().includes(query) ||
        v.plate.toLowerCase().includes(query) ||
        v.driverName.toLowerCase().includes(query) ||
        v.imei.toLowerCase().includes(query)
      );
    });
  }, [vehicles, filterMode, searchQuery]);

  // Counts
  const counts = useMemo(() => {
    const moving = vehicles.filter((v) => v.online && v.moving).length;
    const stopped = vehicles.filter((v) => v.online && !v.moving).length;
    const offline = vehicles.filter((v) => !v.online).length;
    return { total: vehicles.length, moving, stopped, offline };
  }, [vehicles]);

  const selectedVehicle = useMemo(
    () => vehicles.find((v) => v.id === selectedVehicleId) || null,
    [vehicles, selectedVehicleId]
  );

  // Focus map camera on selected vehicle
  useEffect(() => {
    if (!selectedVehicle || !mapRef.current) return;
    mapRef.current.flyTo([selectedVehicle.lat, selectedVehicle.lng], Math.max(mapRef.current.getZoom(), 13), {
      duration: 0.8,
      easeLinearity: 0.25,
    });
  }, [selectedVehicle]);

  // Fit all markers in view
  const handleFitAll = () => {
    if (!mapRef.current || filteredVehicles.length === 0) return;
    const bounds = L.latLngBounds(filteredVehicles.map((v) => [v.lat, v.lng] as [number, number]));
    mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
  };

  const isRtl = language === 'ar';

  return (
    <div className="h-[calc(100vh-84px)] p-3 md:p-4 flex flex-col gap-3 bg-slate-950 font-sans text-slate-100 overflow-hidden">
      {/* 2026 Futuristic Cyber Header */}
      <div className="h-14 px-4 rounded-xl bg-slate-900/90 backdrop-blur-xl border border-slate-800/80 shadow-2xl flex items-center justify-between gap-3 flex-shrink-0">
        {/* Left: Branding & Status Pulse */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-black tracking-wide text-white flex items-center gap-2">
                {tr('Live Fleet Telemetry', 'تتبع الأسطول المباشر')}
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-700/50">
                  2026 HUD
                </span>
              </h2>
            </div>
            <div className="text-[10px] text-slate-400 flex items-center gap-2">
              <span className="flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${isLiveConnected ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-amber-400 shadow-[0_0_8px_#fbbf24]'}`} />
                {isLiveConnected ? tr('GPSwox Satellite Live', 'متصل بالقمر الصناعي GPSwox') : tr('Flotte Locale Active', 'نشط (الأسطول المحلي)')}
              </span>
              <span>•</span>
              <span className="font-mono">{counts.total} {tr('véhicules suivis', 'مركبة متبعة')}</span>
            </div>
          </div>
        </div>

        {/* Center/Right: Action Buttons & Map Controls */}
        <div className="flex items-center gap-2">
          {/* Layer Selector */}
          <Select value={activeLayer} onValueChange={(val) => setActiveLayer(val as MapLayerType)}>
            <SelectTrigger className="h-8 w-36 bg-slate-800/90 border-slate-700 text-xs font-semibold text-slate-200">
              <Layers className="w-3.5 h-3.5 mr-1.5 text-indigo-400" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
              {Object.entries(MAP_LAYERS).map(([key, layer]) => (
                <SelectItem key={key} value={key} className="text-xs">
                  {layer.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Quick HUD Toggles */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setClusterEnabled((prev) => !prev)}
            className={`h-8 text-xs font-bold border-slate-700 ${
              clusterEnabled ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40' : 'bg-slate-800/80 text-slate-400'
            }`}
            title={tr('Grouper les véhicules', 'تجميع المركبات')}
          >
            <Navigation className="w-3.5 h-3.5 mr-1.5" />
            {tr('Clusters', 'تجميع')}
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setTraceEnabled((prev) => !prev)}
            className={`h-8 text-xs font-bold border-slate-700 hidden sm:flex ${
              tracesEnabled ? 'bg-sky-600/20 text-sky-300 border-sky-500/40' : 'bg-slate-800/80 text-slate-400'
            }`}
            title={tr('Afficher les tracés de déplacement', 'عرض المسارات')}
          >
            <Route className="w-3.5 h-3.5 mr-1.5" />
            {tr('Traces', 'المسارات')}
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleFitAll}
            className="h-8 text-xs font-bold bg-slate-800/90 hover:bg-slate-700 border-slate-700 text-slate-200"
            title={tr('Ajuster la vue à tous les véhicules', 'عرض كامل الأسطول')}
          >
            <Crosshair className="w-3.5 h-3.5 mr-1.5 text-cyan-400" />
            {tr('Centrer', 'تركيز')}
          </Button>

          {/* Pause / Play */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsPaused((prev) => !prev)}
            className={`h-8 text-xs font-bold border-slate-700 ${
              isPaused ? 'bg-amber-600/20 text-amber-300 border-amber-500/40' : 'bg-slate-800/90 text-slate-200'
            }`}
          >
            {isPaused ? <Play className="w-3.5 h-3.5 mr-1.5" /> : <Pause className="w-3.5 h-3.5 mr-1.5" />}
            {isPaused ? tr('Reprendre', 'استئناف') : tr('Pause', 'إيقاف')}
          </Button>

          {/* Refresh Button */}
          <Button
            size="icon"
            onClick={() => void fetchLiveFleet()}
            disabled={isLoading}
            className="h-8 w-8 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-indigo-400' : ''}`} />
          </Button>

          {/* GPSwox Settings Button */}
          <Button
            size="sm"
            onClick={() => setSettingsOpen(true)}
            className="h-8 text-xs font-bold bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white shadow-lg shadow-indigo-500/20"
          >
            <Settings2 className="w-3.5 h-3.5 mr-1.5" />
            {tr('GPS Config', 'إعدادات GPS')}
          </Button>
        </div>
      </div>

      {/* Main Map & Live Drawer Body */}
      <div className="flex-1 rounded-2xl overflow-hidden border border-slate-800/90 shadow-2xl relative flex">
        {/* The Interactive Map Viewport */}
        <div className="flex-1 h-full w-full relative z-0">
          <MapContainer
            center={MOROCCO_CENTER}
            zoom={6}
            className="h-full w-full bg-slate-950"
            whenReady={(evt) => {
              mapRef.current = evt.target;
            }}
          >
            <TileLayer
              attribution={MAP_LAYERS[activeLayer].attribution}
              url={MAP_LAYERS[activeLayer].url}
              subdomains={MAP_LAYERS[activeLayer].subdomains || ['a', 'b', 'c']}
            />

            {/* Vehicle Movement Traces */}
            {tracesEnabled &&
              filteredVehicles.map((vehicle) => {
                const line = traceHistory[vehicle.id] || [];
                if (line.length < 2) return null;
                const isSelected = selectedVehicleId === vehicle.id;
                return (
                  <Polyline
                    key={`trace-${vehicle.id}`}
                    positions={line}
                    pathOptions={{
                      color: isSelected ? '#38bdf8' : vehicle.moving ? '#10b981' : '#64748b',
                      weight: isSelected ? 4 : 2,
                      opacity: isSelected ? 0.9 : 0.45,
                      dashArray: vehicle.moving ? undefined : '4, 8',
                    }}
                  />
                );
              })}

            {/* Vehicle Markers */}
            {clusterEnabled ? (
              <MarkerClusterGroup chunkedLoading>
                {filteredVehicles.map((vehicle) => {
                  const isSelected = selectedVehicleId === vehicle.id;
                  return (
                    <Marker
                      key={vehicle.id}
                      position={[vehicle.lat, vehicle.lng]}
                      icon={createVehicleIcon(vehicle, isSelected)}
                      eventHandlers={{
                        click: () => setSelectedVehicleId(vehicle.id),
                      }}
                    >
                      <Popup className="cyber-popup">
                        <div className="p-1 min-w-[200px] text-slate-900">
                          <div className="font-black text-sm text-slate-900">{vehicle.plate}</div>
                          <div className="text-xs text-slate-600 font-semibold">{vehicle.name}</div>
                          <div className="mt-2 pt-2 border-t border-slate-200 text-xs space-y-1">
                            <div className="flex justify-between">
                              <span className="text-slate-500">Chauffeur:</span>
                              <strong className="text-slate-800">{vehicle.driverName}</strong>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Vitesse:</span>
                              <strong className="text-indigo-600 font-mono">{Math.round(vehicle.speed)} km/h</strong>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Statut:</span>
                              <span className="font-bold text-emerald-600">{vehicle.status}</span>
                            </div>
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}
              </MarkerClusterGroup>
            ) : (
              filteredVehicles.map((vehicle) => {
                const isSelected = selectedVehicleId === vehicle.id;
                return (
                  <Marker
                    key={vehicle.id}
                    position={[vehicle.lat, vehicle.lng]}
                    icon={createVehicleIcon(vehicle, isSelected)}
                    eventHandlers={{
                      click: () => setSelectedVehicleId(vehicle.id),
                    }}
                  >
                    <Popup className="cyber-popup">
                      <div className="p-1 min-w-[200px] text-slate-900">
                        <div className="font-black text-sm">{vehicle.plate}</div>
                        <div className="text-xs text-slate-600">{vehicle.name}</div>
                        <div className="mt-2 pt-2 border-t border-slate-200 text-xs space-y-1">
                          <div className="flex justify-between">
                            <span className="text-slate-500">Chauffeur:</span>
                            <strong>{vehicle.driverName}</strong>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Vitesse:</span>
                            <strong className="text-indigo-600 font-mono">{Math.round(vehicle.speed)} km/h</strong>
                          </div>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })
            )}
          </MapContainer>

          {/* Floating HUD Telemetry Overlay on Map */}
          <div className="absolute top-4 left-4 z-[900] flex flex-col gap-2 pointer-events-none">
            {/* Live Stats Pill */}
            <div className="pointer-events-auto px-3.5 py-2 rounded-xl bg-slate-900/90 backdrop-blur-xl border border-slate-800 shadow-xl flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>{counts.moving} {tr('En route', 'في الحركة')}</span>
              </div>
              <span className="text-slate-600">|</span>
              <div className="flex items-center gap-1.5 text-amber-400 font-bold">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span>{counts.stopped} {tr("À l'arrêt", 'متوقف')}</span>
              </div>
              <span className="text-slate-600">|</span>
              <div className="flex items-center gap-1.5 text-slate-400 font-bold">
                <span className="w-2 h-2 rounded-full bg-slate-500" />
                <span>{counts.offline} {tr('Hors ligne', 'غير متصل')}</span>
              </div>
            </div>
          </div>

          {/* Selected Vehicle Floating HUD Inspector */}
          <AnimatePresence>
            {selectedVehicle && (
              <motion.div
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 30, scale: 0.95 }}
                className="absolute bottom-4 left-4 right-4 md:right-auto md:w-[420px] z-[900] p-4 rounded-2xl bg-slate-900/95 backdrop-blur-2xl border border-indigo-500/40 shadow-[0_12px_40px_rgba(0,0,0,0.8)] text-slate-100 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-600 to-sky-600 text-white shadow-md">
                      <Truck className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-black text-white">{selectedVehicle.plate}</h3>
                        <Badge
                          className={
                            selectedVehicle.moving
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              : selectedVehicle.online
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              : 'bg-slate-700 text-slate-300'
                          }
                        >
                          {selectedVehicle.moving
                            ? tr('En mouvement', 'في الحركة')
                            : selectedVehicle.online
                            ? tr("À l'arrêt", 'متوقف')
                            : tr('Hors ligne', 'غير متصل')}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{selectedVehicle.name}</p>
                    </div>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setSelectedVehicleId(null)}
                    className="h-7 w-7 text-slate-400 hover:text-white rounded-lg"
                  >
                    ✕
                  </Button>
                </div>

                {/* Telemetry Metrics Grid */}
                <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">{tr('Vitesse', 'السرعة')}</div>
                    <div className="text-lg font-black text-sky-400 font-mono">
                      {Math.round(selectedVehicle.speed)} <span className="text-[10px]">km/h</span>
                    </div>
                  </div>
                  <div className="border-x border-slate-800 px-1">
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">{tr('Direction', 'الاتجاه')}</div>
                    <div className="text-lg font-black text-indigo-400 font-mono flex items-center justify-center gap-1">
                      <Compass className="w-4 h-4" style={{ transform: `rotate(${selectedVehicle.heading}deg)` }} />
                      {Math.round(selectedVehicle.heading)}°
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">{tr('Batterie', 'البطارية')}</div>
                    <div className="text-lg font-black text-emerald-400 font-mono flex items-center justify-center gap-1">
                      <BatteryCharging className="w-4 h-4" />
                      {selectedVehicle.batteryLevel ?? 95}%
                    </div>
                  </div>
                </div>

                {/* Chauffeur & Contact */}
                <div className="flex items-center justify-between text-xs px-1">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-slate-400" />
                    <div>
                      <span className="text-slate-400">{tr('Chauffeur:', 'السائق:')} </span>
                      <strong className="text-slate-200">{selectedVehicle.driverName}</strong>
                    </div>
                  </div>
                  {selectedVehicle.driverPhone && (
                    <a
                      href={`tel:${selectedVehicle.driverPhone}`}
                      className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/40 font-bold flex items-center gap-1"
                    >
                      <Phone className="w-3 h-3" />
                      {tr('Appeler', 'اتصال')}
                    </a>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Collapsible Sidebar (HUD Fleet Manager) */}
        <div
          className={`h-full bg-slate-900/95 backdrop-blur-2xl border-l border-slate-800 transition-all duration-300 z-10 flex flex-col ${
            sidebarOpen ? 'w-80' : 'w-0 overflow-hidden border-none'
          }`}
        >
          {/* Search & Filter Header */}
          <div className="p-3 border-b border-slate-800 space-y-2.5 flex-shrink-0">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-indigo-400" />
                {tr('Flotte en direct', 'الأسطول المباشر')}
              </h3>
              <Badge variant="outline" className="text-[10px] border-slate-700 text-slate-300">
                {filteredVehicles.length} / {counts.total}
              </Badge>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={tr('Rechercher matricule, chauffeur...', 'بحث برقم اللوحة، السائق...')}
                className="h-8 pl-8 text-xs bg-slate-950 border-slate-800 text-slate-200"
              />
            </div>

            {/* Filter Pills */}
            <div className="grid grid-cols-4 gap-1">
              <Button
                size="sm"
                variant={filterMode === 'all' ? 'default' : 'ghost'}
                onClick={() => setFilterMode('all')}
                className={`h-7 text-[11px] font-bold ${
                  filterMode === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {tr('Tous', 'الكل')}
              </Button>
              <Button
                size="sm"
                variant={filterMode === 'moving' ? 'default' : 'ghost'}
                onClick={() => setFilterMode('moving')}
                className={`h-7 text-[11px] font-bold ${
                  filterMode === 'moving' ? 'bg-emerald-600 text-white' : 'text-emerald-400/70 hover:text-emerald-300'
                }`}
              >
                {tr('Route', 'حركة')}
              </Button>
              <Button
                size="sm"
                variant={filterMode === 'stopped' ? 'default' : 'ghost'}
                onClick={() => setFilterMode('stopped')}
                className={`h-7 text-[11px] font-bold ${
                  filterMode === 'stopped' ? 'bg-amber-600 text-white' : 'text-amber-400/70 hover:text-amber-300'
                }`}
              >
                {tr('Arrêt', 'توقف')}
              </Button>
              <Button
                size="sm"
                variant={filterMode === 'offline' ? 'default' : 'ghost'}
                onClick={() => setFilterMode('offline')}
                className={`h-7 text-[11px] font-bold ${
                  filterMode === 'offline' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {tr('Hors', 'غير')}
              </Button>
            </div>
          </div>

          {/* Vehicle Cards ScrollArea */}
          <ScrollArea className="flex-1 p-2">
            <div className="space-y-1.5">
              {filteredVehicles.map((vehicle) => {
                const isSelected = selectedVehicleId === vehicle.id;
                return (
                  <button
                    key={vehicle.id}
                    type="button"
                    onClick={() => setSelectedVehicleId(vehicle.id)}
                    className={`w-full p-2.5 rounded-xl border text-left transition-all flex items-center justify-between gap-2 ${
                      isSelected
                        ? 'bg-indigo-600/20 border-indigo-500/60 shadow-[0_0_15px_rgba(99,102,241,0.2)]'
                        : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-800/60 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                          vehicle.moving
                            ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
                            : vehicle.online
                            ? 'bg-amber-400'
                            : 'bg-slate-600'
                        }`}
                      />
                      <div className="min-w-0">
                        <div className="font-bold text-xs text-white truncate">{vehicle.plate}</div>
                        <div className="text-[11px] text-slate-400 truncate flex items-center gap-1">
                          <User className="w-3 h-3" />
                          <span>{vehicle.driverName}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <div className="text-xs font-black font-mono text-sky-400">
                        {vehicle.speed > 0 ? `${Math.round(vehicle.speed)} km/h` : tr('STOP', 'متوقف')}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {vehicle.source === 'gpswox' ? '📡 Sat' : '🚗 Sim'}
                      </div>
                    </div>
                  </button>
                );
              })}

              {filteredVehicles.length === 0 && (
                <div className="py-12 text-center text-slate-500 text-xs">
                  <Truck className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                  {tr('Aucun véhicule trouvé', 'لم يتم العثور على مركبات')}
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Footer Bar */}
          <div className="p-2.5 border-t border-slate-800 bg-slate-950 text-[11px] text-slate-400 flex items-center justify-between">
            <span>{tr('Sync:', 'تحديث:')} {lastSyncTime ? new Date(lastSyncTime).toLocaleTimeString() : '—'}</span>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="text-indigo-400 hover:text-indigo-300 font-bold"
            >
              {tr('Gérer GPS', 'إدارة GPS')}
            </button>
          </div>
        </div>

        {/* Sidebar Toggle Handle */}
        <button
          type="button"
          onClick={() => setSidebarOpen((prev) => !prev)}
          className="absolute top-4 right-0 z-[900] h-8 w-6 bg-slate-900 border-y border-l border-slate-700 rounded-l-md text-slate-300 hover:text-white flex items-center justify-center shadow-lg"
          title={sidebarOpen ? tr('Masquer le panneau', 'إخفاء القائمة') : tr('Afficher le panneau', 'عرض القائمة')}
        >
          {sidebarOpen ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* GPSwox Configuration Modal */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-md bg-slate-900 border border-slate-800 text-slate-100 shadow-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-black text-white">
              <Radio className="w-5 h-5 text-indigo-400" />
              {tr('Configuration Serveur GPSwox', 'إعدادات خادم GPSwox')}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              {tr(
                'Entrez les identifiants de votre instance GPSwox pour activer la télémétrie satellite en temps réel.',
                'أدخل بيانات اعتماد خادم GPSwox لتفعيل التتبع المباشر بالأقمار الصناعية.'
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-300">{tr('URL API GPSwox', 'رابط خادم GPSwox')}</Label>
              <Input
                value={gpswoxUrl}
                onChange={(e) => setGpswoxUrl(e.target.value)}
                placeholder="https://gps.sftgaz.com ou https://api.gpswox.com"
                className="h-9 text-xs bg-slate-950 border-slate-800 text-slate-100"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-300">{tr('Email / Identifiant', 'البريد / اسم المستخدم')}</Label>
              <Input
                value={gpswoxEmail}
                onChange={(e) => setGpswoxEmail(e.target.value)}
                placeholder="admin@sftgaz.com"
                className="h-9 text-xs bg-slate-950 border-slate-800 text-slate-100"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-300">{tr('Mot de passe / Clé API', 'كلمة المرور / المفتاح السري')}</Label>
              <Input
                type="password"
                value={gpswoxPassword}
                onChange={(e) => setGpswoxPassword(e.target.value)}
                placeholder="••••••••••••"
                className="h-9 text-xs bg-slate-950 border-slate-800 text-slate-100"
              />
            </div>

            <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/30 text-xs text-indigo-200 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
              <span>
                {tr(
                  "En l'absence de serveur GPSwox actif, le système utilise automatiquement la flotte réelle enregistrée dans l'application avec simulation dynamique des trajets.",
                  "في حال عدم توفر خادم GPSwox نشط، يعرض النظام أسطول شاحناتك الفعلي المسجل في التطبيق مع محاكاة ديناميكية للمسارات."
                )}
              </span>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="ghost"
              onClick={() => setSettingsOpen(false)}
              className="text-xs text-slate-400 hover:text-white"
            >
              {tr('Annuler', 'إلغاء')}
            </Button>
            <Button
              onClick={handleSaveSettings}
              disabled={isSavingSettings}
              className="text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              {isSavingSettings ? tr('Connexion...', 'جارٍ الحفظ...') : tr('Enregistrer & Connecter', 'حفظ واتصال')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LiveMap;
