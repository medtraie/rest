import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Pause, Play, Layers, Route, Wifi, WifiOff, Navigation, RefreshCw, Crosshair, Gauge, Clock3, Eye, EyeOff } from 'lucide-react';
import { motion } from 'framer-motion';
import { MapContainer, Marker, Popup, TileLayer, Polyline } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '@/lib/supabaseClient';
import { useLanguage } from '@/contexts/LanguageContext';

type FilterMode = 'all' | 'online' | 'moving' | 'stopped';

type GpsDevice = {
  id: string;
  name: string;
  imei: string;
  plate: string;
  lat: number;
  lng: number;
  speed: number;
  moving: boolean;
  online: boolean;
  status: string;
  timestamp: string;
  heading: number;
};

const MOROCCO_CENTER: [number, number] = [32.1, -6.35];

const googleRoadUrl = `https://mt1.google.com/vt/lyrs=r&x={x}&y={y}&z={z}${import.meta.env.VITE_GOOGLE_MAPS_API_KEY ? `&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}` : ''}${import.meta.env.VITE_GOOGLE_MAPS_REGION ? `&region=${import.meta.env.VITE_GOOGLE_MAPS_REGION}` : ''}`;

const speedArrowColor = (speed: number) => {
  if (speed >= 80) return '#ef4444';
  if (speed >= 30) return '#f59e0b';
  return '#22c55e';
};

const markerIcon = (color: string, heading = 0, speed = 0) =>
  L.divIcon({
    className: '',
    html: `
      <div style="position:relative;width:30px;height:38px;display:flex;align-items:flex-start;justify-content:center;">
        <div style="position:absolute;top:4px;left:50%;transform:translateX(-50%) rotate(${heading}deg);transform-origin:50% 10px;width:0;height:0;border-left:4px solid transparent;border-right:4px solid transparent;border-bottom:9px solid ${speedArrowColor(speed)};z-index:4;filter:drop-shadow(0 0 5px ${speedArrowColor(speed)}AA);"></div>
        <div style="position:absolute;top:-3px;left:50%;transform:translateX(-50%);width:30px;height:30px;border-radius:999px;background:radial-gradient(circle, ${speedArrowColor(speed)}55 0%, rgba(255,255,255,0) 72%);opacity:.95;"></div>
        <div style="position:absolute;top:0;left:50%;transform:translateX(-50%);width:24px;height:24px;border-radius:999px;background:${color};border:3px solid #fff;box-shadow:0 4px 12px rgba(15,23,42,.45),0 0 0 2px rgba(255,255,255,.22) inset;display:flex;align-items:center;justify-content:center;color:#fff;font-size:10px;font-weight:800;">⌖</div>
        <div style="position:absolute;top:20px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-top:12px solid ${color};filter:drop-shadow(0 3px 5px rgba(15,23,42,.35));"></div>
        <div style="position:absolute;top:-4px;right:-2px;background:linear-gradient(135deg,#0f172a,#1e293b);color:#fff;border:1px solid rgba(255,255,255,.28);font-size:8px;line-height:1;padding:2px 4px;border-radius:999px;font-weight:800;letter-spacing:.2px;box-shadow:0 0 10px rgba(14,165,233,.35);">GPS</div>
      </div>
    `,
    iconSize: [30, 38],
    iconAnchor: [15, 34],
  });

const toText = (value: unknown, fallback = '') => {
  const parsed = String(value ?? '').trim();
  return parsed.length > 0 ? parsed : fallback;
};

const asNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const normalizeHeading = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  const mod = parsed % 360;
  return mod < 0 ? mod + 360 : mod;
};
const shortestHeadingDelta = (from: number, to: number) => {
  const delta = ((to - from + 540) % 360) - 180;
  return delta;
};

const normalizeStatus = (raw: string) => {
  const status = raw.toLowerCase();
  const online = status.includes('online') || status.includes('active') || status.includes('moving') || status.includes('stop');
  return { status, online };
};

const LiveMap = () => {
  const { language } = useLanguage();
  const tr = (fr: string, ar: string) => (language === 'ar' ? ar : fr);

  const mapRef = useRef<L.Map | null>(null);
  const timerRef = useRef<number | null>(null);
  const headingTargetRef = useRef<Record<string, number>>({});
  const headingAnimRef = useRef<number | null>(null);

  const [devices, setDevices] = useState<GpsDevice[]>([]);
  const [displayHeadingById, setDisplayHeadingById] = useState<Record<string, number>>({});
  const [traceHistory, setTraceHistory] = useState<Record<string, [number, number][]>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [groupEnabled, setGroupEnabled] = useState(true);
  const [traceEnabled, setTraceEnabled] = useState(true);
  const [showSpeedLegend, setShowSpeedLegend] = useState(true);
  const [paused, setPaused] = useState(false);
  const [refreshSec, setRefreshSec] = useState('10');
  const [lastUpdated, setLastUpdated] = useState('');

  const selectedDevice = useMemo(
    () => devices.find((device) => device.id === selectedDeviceId) || null,
    [devices, selectedDeviceId]
  );

  const counts = useMemo(() => {
    const online = devices.filter((d) => d.online).length;
    const moving = devices.filter((d) => d.moving).length;
    const stopped = devices.filter((d) => d.online && !d.moving).length;
    return {
      total: devices.length,
      online,
      moving,
      stopped,
    };
  }, [devices]);

  const filteredDevices = useMemo(() => {
    const q = search.trim().toLowerCase();
    return devices.filter((device) => {
      const passFilter =
        filterMode === 'all'
          ? true
          : filterMode === 'online'
            ? device.online
            : filterMode === 'moving'
              ? device.moving
              : device.online && !device.moving;
      if (!passFilter) return false;
      if (!q) return true;
      return (
        device.name.toLowerCase().includes(q) ||
        device.plate.toLowerCase().includes(q) ||
        device.imei.toLowerCase().includes(q)
      );
    });
  }, [devices, filterMode, search]);

  const loadGpsData = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('gpswox');
      if (invokeError) throw new Error(invokeError.message);
      if (data?.success === false) {
        throw new Error(toText(data?.error, tr('Erreur GPS', 'خطأ GPS')));
      }
      const incoming = Array.isArray(data?.devices) ? data.devices : [];
      const normalized = incoming
        .map((item: any): GpsDevice | null => {
          const lat = asNumber(item?.lat);
          const lng = asNumber(item?.lng);
          if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return null;
          const speed = asNumber(item?.speed);
          const moving = Boolean(item?.moving ?? speed > 0);
          const statusRaw = toText(item?.status, 'unknown');
          const statusNormalized = normalizeStatus(statusRaw);
          return {
            id: toText(item?.id ?? item?.device_id ?? item?.imei ?? crypto.randomUUID()),
            name: toText(item?.name ?? item?.label, tr('Véhicule', 'مركبة')),
            imei: toText(item?.imei ?? item?.uniqueId ?? item?.id, '-'),
            plate: toText(item?.plate ?? item?.plate_number ?? item?.plateNumber, '-'),
            lat,
            lng,
            speed,
            moving,
            online: statusNormalized.online,
            status: statusRaw,
            timestamp: toText(item?.timestamp ?? item?.time, ''),
            heading: normalizeHeading(item?.heading ?? item?.course ?? item?.angle ?? item?.bearing),
          };
        })
        .filter((row): row is GpsDevice => Boolean(row));

      setDevices(normalized);
      setLastUpdated(new Date().toISOString());
      setTraceHistory((prev) => {
        const next: Record<string, [number, number][]> = { ...prev };
        const active = new Set(normalized.map((device) => device.id));
        Object.keys(next).forEach((id) => {
          if (!active.has(id)) delete next[id];
        });
        normalized.forEach((device) => {
          const existing = next[device.id] ? [...next[device.id]] : [];
          const latest = existing[existing.length - 1];
          if (!latest || Math.abs(latest[0] - device.lat) > 0.000001 || Math.abs(latest[1] - device.lng) > 0.000001) {
            existing.push([device.lat, device.lng]);
          }
          next[device.id] = existing.slice(-150);
        });
        return next;
      });

      if (normalized.length === 0) {
        setError(tr("Aucune position valide reçue de GPSwox.", "لم يتم استلام أي مواقع صالحة من GPSwox."));
      }
    } catch (e: any) {
      setError(
        `${tr('Connexion GPSwox échouée.', 'فشل الاتصال بـ GPSwox.')}\n${tr(
          'Vérifiez les identifiants dans Settings > Système > GPSwox.',
          'تحقق من بيانات الدخول في Settings > Système > GPSwox.'
        )}\n${toText(e?.message)}`
      );
    } finally {
      setIsLoading(false);
    }
  }, [tr]);

  useEffect(() => {
    void loadGpsData();
  }, [loadGpsData]);

  useEffect(() => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    if (paused) return;
    const interval = Math.max(5, Number(refreshSec) || 10) * 1000;
    timerRef.current = window.setInterval(() => {
      void loadGpsData();
    }, interval);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [paused, refreshSec, loadGpsData]);
  useEffect(() => {
    const activeIds = new Set(devices.map((device) => device.id));
    const nextTargets: Record<string, number> = {};
    devices.forEach((device) => {
      nextTargets[device.id] = normalizeHeading(device.heading);
    });
    headingTargetRef.current = nextTargets;

    setDisplayHeadingById((prev) => {
      const next: Record<string, number> = {};
      Object.keys(nextTargets).forEach((id) => {
        next[id] = prev[id] ?? nextTargets[id];
      });
      return next;
    });

    if (headingAnimRef.current) {
      window.cancelAnimationFrame(headingAnimRef.current);
      headingAnimRef.current = null;
    }

    const animate = () => {
      let changed = false;
      let moving = false;
      setDisplayHeadingById((prev) => {
        const next: Record<string, number> = {};
        Object.keys(headingTargetRef.current).forEach((id) => {
          const current = prev[id] ?? headingTargetRef.current[id];
          const target = headingTargetRef.current[id];
          const delta = shortestHeadingDelta(current, target);
          if (Math.abs(delta) > 0.12) {
            next[id] = normalizeHeading(current + delta * 0.2);
            changed = true;
            moving = true;
          } else {
            next[id] = target;
          }
        });
        return next;
      });
      if (moving || changed) {
        headingAnimRef.current = window.requestAnimationFrame(animate);
      } else {
        headingAnimRef.current = null;
      }
    };

    headingAnimRef.current = window.requestAnimationFrame(animate);

    return () => {
      if (headingAnimRef.current) {
        window.cancelAnimationFrame(headingAnimRef.current);
        headingAnimRef.current = null;
      }
      const staleIds = Object.keys(headingTargetRef.current).filter((id) => !activeIds.has(id));
      if (staleIds.length > 0) {
        staleIds.forEach((id) => {
          delete headingTargetRef.current[id];
        });
      }
    };
  }, [devices]);

  useEffect(() => {
    if (!selectedDevice) return;
    if (!mapRef.current) return;
    mapRef.current.flyTo([selectedDevice.lat, selectedDevice.lng], Math.max(mapRef.current.getZoom(), 12), { duration: 0.6 });
  }, [selectedDevice]);

  const focusAll = () => {
    if (!mapRef.current || filteredDevices.length === 0) return;
    const bounds = L.latLngBounds(filteredDevices.map((device) => [device.lat, device.lng] as [number, number]));
    mapRef.current.fitBounds(bounds, { padding: [40, 40] });
  };

  const statusChip = (device: GpsDevice) => {
    if (!device.online) return { label: tr('Hors ligne', 'غير متصل'), className: 'bg-slate-700 text-slate-200' };
    if (device.moving) return { label: tr('En mouvement', 'في الحركة'), className: 'bg-cyan-600 text-white' };
    return { label: tr("À l'arrêt", 'متوقف'), className: 'bg-amber-500 text-white' };
  };
  const markerIconsByDevice = useMemo(() => {
    const next: Record<string, L.DivIcon> = {};
    filteredDevices.forEach((device) => {
      const color =
        selectedDeviceId === device.id
          ? '#0ea5e9'
          : !device.online
            ? '#64748b'
            : device.moving
              ? '#f97316'
              : '#facc15';
      next[device.id] = markerIcon(color, displayHeadingById[device.id] ?? device.heading, device.speed);
    });
    return next;
  }, [filteredDevices, selectedDeviceId, displayHeadingById]);

  return (
    <div className="h-[calc(100vh-88px)] p-4">
      <div className="h-full rounded-2xl overflow-hidden border border-slate-200 bg-slate-950 text-slate-100 shadow-2xl">
        <div className="h-14 px-4 border-b border-slate-800 bg-slate-950/95 flex items-center justify-between gap-3">
          <div className="relative w-full max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tr('Rechercher', 'بحث')}
              className="h-9 pl-9 border-slate-700 bg-slate-900 text-slate-100"
            />
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Badge className="bg-emerald-600 text-white">{tr('En direct', 'مباشر')}</Badge>
            <Badge variant="outline" className="border-slate-700 text-slate-300">{counts.total} {tr('véhicules', 'مركبة')}</Badge>
          </div>
        </div>

        <div className="h-[calc(100%-56px)] grid grid-cols-1 xl:grid-cols-[1fr_320px]">
          <div className="relative">
            <MapContainer
              center={MOROCCO_CENTER}
              zoom={7}
              className="h-full w-full"
              whenReady={(evt) => {
                mapRef.current = evt.target;
              }}
            >
              <TileLayer attribution="&copy; Google" url={googleRoadUrl} />
              {traceEnabled &&
                filteredDevices.map((device) => {
                  const line = traceHistory[device.id] || [];
                  if (line.length < 2) return null;
                  return <Polyline key={`trace-${device.id}`} positions={line} pathOptions={{ color: '#0ea5e9', weight: 2, opacity: 0.7 }} />;
                })}

              {groupEnabled ? (
                <MarkerClusterGroup chunkedLoading>
                  {filteredDevices.map((device) => (
                    <Marker
                      key={device.id}
                      position={[device.lat, device.lng]}
                      icon={markerIconsByDevice[device.id]}
                      eventHandlers={{
                        click: () => setSelectedDeviceId(device.id),
                      }}
                    >
                      <Popup>
                        <div className="text-sm min-w-[190px]">
                          <div className="font-bold">{device.name}</div>
                          <div className="text-xs opacity-80">IMEI: {device.imei}</div>
                          <div className="text-xs opacity-80">{tr('Vitesse', 'السرعة')}: {device.speed.toFixed(0)} km/h</div>
                          <div className="text-xs opacity-80">{tr('Direction', 'الاتجاه')}: {(displayHeadingById[device.id] ?? device.heading).toFixed(0)}°</div>
                          <div className="text-xs opacity-80">{tr('Statut', 'الحالة')}: {device.status}</div>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </MarkerClusterGroup>
              ) : (
                <>
                  {filteredDevices.map((device) => (
                    <Marker
                      key={device.id}
                      position={[device.lat, device.lng]}
                      icon={markerIconsByDevice[device.id]}
                      eventHandlers={{
                        click: () => setSelectedDeviceId(device.id),
                      }}
                    >
                      <Popup>
                        <div className="text-sm min-w-[190px]">
                          <div className="font-bold">{device.name}</div>
                          <div className="text-xs opacity-80">IMEI: {device.imei}</div>
                          <div className="text-xs opacity-80">{tr('Vitesse', 'السرعة')}: {device.speed.toFixed(0)} km/h</div>
                          <div className="text-xs opacity-80">{tr('Direction', 'الاتجاه')}: {(displayHeadingById[device.id] ?? device.heading).toFixed(0)}°</div>
                          <div className="text-xs opacity-80">{tr('Statut', 'الحالة')}: {device.status}</div>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </>
              )}
            </MapContainer>

            <div className="absolute top-3 left-3 flex flex-wrap gap-2 z-[900]">
              <Button size="sm" className="h-8 bg-slate-950/90 hover:bg-slate-900">
                <Wifi className="w-3.5 h-3.5 mr-1.5" />
                {tr('En direct', 'مباشر')}
              </Button>
              <Button size="sm" variant="outline" className="h-8 border-slate-600 bg-slate-950/90 text-slate-100">
                <Layers className="w-3.5 h-3.5 mr-1.5" />
                Google Maps
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 border-slate-600 bg-slate-950/90 text-slate-100"
                onClick={() => setGroupEnabled((prev) => !prev)}
              >
                <Navigation className="w-3.5 h-3.5 mr-1.5" />
                {tr('Grouper', 'تجميع')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 border-slate-600 bg-slate-950/90 text-slate-100"
                onClick={() => setTraceEnabled((prev) => !prev)}
              >
                <Route className="w-3.5 h-3.5 mr-1.5" />
                {tr('Traceurs', 'مسارات')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 border-slate-600 bg-slate-950/90 text-slate-100"
                onClick={() => setShowSpeedLegend((prev) => !prev)}
              >
                {showSpeedLegend ? <EyeOff className="w-3.5 h-3.5 mr-1.5" /> : <Eye className="w-3.5 h-3.5 mr-1.5" />}
                {showSpeedLegend ? tr('Masquer légende', 'إخفاء الدليل') : tr('Afficher légende', 'إظهار الدليل')}
              </Button>
            </div>

            <div className="absolute bottom-3 left-3 z-[900]">
              <Button size="sm" className="h-8 bg-slate-950/90 hover:bg-slate-900" onClick={focusAll}>
                <Crosshair className="w-3.5 h-3.5 mr-1.5" />
                {tr('Focus global', 'تركيز عام')}
              </Button>
            </div>
            {showSpeedLegend && (
              <div className="absolute bottom-3 right-3 z-[900] rounded-xl border border-slate-700 bg-slate-950/90 px-3 py-2 text-[11px] text-slate-100 shadow-xl">
                <div className="font-bold text-[10px] uppercase tracking-wide text-slate-300 mb-1">
                  {tr('Légende vitesse', 'دليل السرعة')}
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span>{tr('Faible', 'منخفضة')} (&lt; 30)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span>{tr('Moyenne', 'متوسطة')} (30-79)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500" />
                  <span>{tr('Élevée', 'مرتفعة')} (80+)</span>
                </div>
              </div>
            )}
          </div>

          <Card className="m-0 rounded-none border-0 border-l border-slate-800 bg-slate-950/95 flex flex-col">
            <div className="p-3 border-b border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm">{tr('Véhicules', 'المركبات')}</h3>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" className="h-8 border-slate-700 bg-slate-900 text-slate-100" onClick={() => setPaused((prev) => !prev)}>
                    {paused ? <Play className="w-3.5 h-3.5 mr-1.5" /> : <Pause className="w-3.5 h-3.5 mr-1.5" />}
                    {paused ? tr('Reprendre', 'استئناف') : tr('Pause', 'إيقاف')}
                  </Button>
                  <Select value={refreshSec} onValueChange={setRefreshSec}>
                    <SelectTrigger className="h-8 w-[86px] border-slate-700 bg-slate-900 text-slate-100">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10s</SelectItem>
                      <SelectItem value="20">20s</SelectItem>
                      <SelectItem value="30">30s</SelectItem>
                      <SelectItem value="60">60s</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="icon" className="h-8 w-8 bg-slate-900 hover:bg-slate-800" onClick={() => void loadGpsData()}>
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </div>

              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={tr('Rechercher par IMEI ou plaque...', 'بحث عبر IMEI أو اللوحة...')}
                className="h-9 border-slate-700 bg-slate-900 text-slate-100"
              />

              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  variant={filterMode === 'all' ? 'default' : 'outline'}
                  className={filterMode === 'all' ? 'bg-cyan-600 hover:bg-cyan-700 h-8' : 'h-8 border-slate-700 bg-slate-900 text-slate-100'}
                  onClick={() => setFilterMode('all')}
                >
                  {tr('Tous', 'الكل')} {counts.total}
                </Button>
                <Button
                  size="sm"
                  variant={filterMode === 'online' ? 'default' : 'outline'}
                  className={filterMode === 'online' ? 'bg-emerald-600 hover:bg-emerald-700 h-8' : 'h-8 border-slate-700 bg-slate-900 text-slate-100'}
                  onClick={() => setFilterMode('online')}
                >
                  {tr('En ligne', 'متصل')} {counts.online}
                </Button>
                <Button
                  size="sm"
                  variant={filterMode === 'moving' ? 'default' : 'outline'}
                  className={filterMode === 'moving' ? 'bg-sky-600 hover:bg-sky-700 h-8' : 'h-8 border-slate-700 bg-slate-900 text-slate-100'}
                  onClick={() => setFilterMode('moving')}
                >
                  {tr('En mouvement', 'في الحركة')} {counts.moving}
                </Button>
                <Button
                  size="sm"
                  variant={filterMode === 'stopped' ? 'default' : 'outline'}
                  className={filterMode === 'stopped' ? 'bg-amber-600 hover:bg-amber-700 h-8' : 'h-8 border-slate-700 bg-slate-900 text-slate-100'}
                  onClick={() => setFilterMode('stopped')}
                >
                  {tr("À l'arrêt", 'متوقف')} {counts.stopped}
                </Button>
              </div>
            </div>

            {error && (
              <div className="p-3 border-b border-slate-800">
                <Alert className="border-red-400/30 bg-red-500/10 text-red-100">
                  <AlertTitle className="flex items-center gap-2"><WifiOff className="w-4 h-4" /> {tr('Erreur GPS', 'خطأ GPS')}</AlertTitle>
                  <AlertDescription className="whitespace-pre-line text-xs">{error}</AlertDescription>
                </Alert>
              </div>
            )}

            <ScrollArea className="flex-1">
              <div className="p-3 space-y-2">
                {filteredDevices.map((device) => {
                  const chip = statusChip(device);
                  const active = selectedDeviceId === device.id;
                  return (
                    <motion.button
                      key={device.id}
                      type="button"
                      whileHover={{ y: -1 }}
                      onClick={() => setSelectedDeviceId(device.id)}
                      className={`w-full text-left rounded-xl border p-3 transition ${
                        active
                          ? 'border-cyan-400 bg-cyan-500/10'
                          : 'border-slate-800 bg-slate-900 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-bold text-sm truncate max-w-[170px]">{device.plate !== '-' ? device.plate : device.name}</div>
                        <Badge className={chip.className}>{chip.label}</Badge>
                      </div>
                      <div className="text-xs text-slate-400 mt-1 truncate">{device.name}</div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center gap-1 text-slate-300"><Gauge className="w-3.5 h-3.5" /> {device.speed.toFixed(0)} km/h</div>
                        <div className="flex items-center gap-1 text-slate-300"><Clock3 className="w-3.5 h-3.5" /> {device.timestamp || '-'}</div>
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500">
                        {device.lat.toFixed(5)}, {device.lng.toFixed(5)}
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500">IMEI: {device.imei}</div>
                    </motion.button>
                  );
                })}

                {filteredDevices.length === 0 && (
                  <div className="text-center text-xs text-slate-400 py-10">
                    {tr('Aucun véhicule trouvé.', 'لم يتم العثور على مركبات.')}
                  </div>
                )}
              </div>
            </ScrollArea>

            <div className="p-3 border-t border-slate-800 text-xs flex items-center justify-between text-slate-400">
              <span>{tr('Affichés', 'المعروض')} : {filteredDevices.length}</span>
              <span>{tr('Total', 'الإجمالي')} : {counts.total}</span>
            </div>
            <div className="px-3 pb-3 text-[11px] text-slate-500">
              {tr('Dernière mise à jour', 'آخر تحديث')} : {lastUpdated ? new Date(lastUpdated).toLocaleString(language === 'ar' ? 'ar-MA' : 'fr-MA') : '-'}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default LiveMap;
