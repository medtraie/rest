import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card } from "@/components/ui/card";
import { MapPin, ShieldAlert, RefreshCw, Truck, Gauge, Clock3, Search, Target, Pause, Play, Maximize2, Minimize2, Flame, BellRing, Radar, Focus, Download, Volume2, VolumeX, Sparkles, Activity, PanelBottom, Table2, Rows3, Command, Layers, GitCompare, AlertTriangle, Wifi, WifiOff, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "@/lib/supabaseClient";
import { kvGet, kvSet } from "@/lib/kv";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents, Polyline, Circle } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { motion } from "framer-motion";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useLanguage } from "@/contexts/LanguageContext";

type DeviceFilter = "all" | "online" | "offline" | "moving" | "stopped";

type GpsDevice = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  speed: number;
  status: string;
  timestamp: string;
  moving: boolean;
  imei: string;
  plate: string;
  driver: string;
};

type AddressValue = {
  short: string;
  full: string;
};

type MapTheme = "osm" | "cartoLight" | "cartoDark";

type LiveMapSettings = {
  refreshMs: string;
  deviceFilter: DeviceFilter;
  clusteringEnabled: boolean;
  markerColor: string;
  mapTheme: MapTheme;
  showTrace: boolean;
  compactCards: boolean;
  replaySpeed: "1" | "2" | "4";
  showVehiclesTable: boolean;
  smartFocusEnabled: boolean;
  heatZonesEnabled: boolean;
  alertsLayerEnabled: boolean;
  adaptiveRefreshEnabled: boolean;
  sidePanelSize: number;
  designMode: "neon" | "glass" | "mission";
  spatialAudioEnabled: boolean;
  panelMode: "feed" | "table";
  minimalUiMode: boolean;
  dockHidden: boolean;
  showDockBlinkPoint: boolean;
  dockWorkspace: DockWorkspace;
  uiLanguage: "fr" | "ar";
  mapCenter: [number, number];
  mapZoom: number;
  activePreset: "operations" | "security" | "replay" | "focus";
  compareIds: string[];
  searchQuery: string;
};

const LIVE_MAP_SETTINGS_KEY = "live-map:settings:v1";
const LIVE_MAP_RECORDING_KEY = "live-map:last-recording:v1";
const LIVE_MAP_REPLAYS_LIST_KEY = "live-map:replays:list:v1";

type LayerPreset = "operations" | "security" | "replay" | "focus";
type DockWorkspace = "visibility" | "presets" | "display" | "actions";

type SectionVisibility = {
  topModes: boolean;
  miniMap: boolean;
  storyTimeline: boolean;
  selectedVehicle: boolean;
  incidentTimeline: boolean;
  comparePanel: boolean;
  replayPanel: boolean;
  alertEngine: boolean;
  riskRadar: boolean;
  alertsFeed: boolean;
  deviceList: boolean;
  dockPresets: boolean;
  dockDisplay: boolean;
  dockActions: boolean;
};

type MapViewportState = {
  center: [number, number];
  zoom: number;
  bounds: { north: number; south: number; east: number; west: number };
};

const mapThemes: Record<MapTheme, { label: string; url: string; attribution: string }> = {
  osm: {
    label: "OpenStreetMap",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "&copy; OpenStreetMap contributors",
  },
  cartoLight: {
    label: "Carto Clair",
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
  },
  cartoDark: {
    label: "Carto Sombre",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
  },
};

const createTrackerIcon = (color: string, selected: boolean) => {
  const size = selected ? 26 : 22;
  const border = selected ? 3 : 2;
  const halo = selected ? 3 : 2;
  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:${border}px solid #ffffff;box-shadow:0 0 0 ${halo}px ${color}55;"></div>`,
  });
};

const statusColor = {
  online: "bg-cyan-100 text-cyan-700",
  offline: "bg-blue-100 text-blue-700",
  moving: "bg-sky-100 text-sky-700",
  stopped: "bg-amber-100 text-amber-700",
  unknown: "bg-slate-100 text-slate-600",
};

const resolveDeviceStatusKey = (device: GpsDevice): "online" | "offline" | "moving" | "stopped" => {
  const normalized = device.status.toLowerCase();
  if (normalized.includes("offline") || normalized.includes("disconnect") || normalized.includes("lost")) return "offline";
  if (normalized.includes("moving") || device.moving || device.speed > 2) return "moving";
  if (normalized.includes("stop") || normalized.includes("idle")) return "stopped";
  if (normalized.includes("online") || normalized.includes("on")) return "online";
  const ts = parseDeviceTimestamp(device.timestamp);
  if (ts && Date.now() - ts > 25 * 60000) return "offline";
  return device.speed > 2 ? "moving" : "stopped";
};

const isMovingFast = (device: GpsDevice) => device.moving && device.speed >= 60;
const isOutOfGeofence = (device: GpsDevice) => device.lat < 20 || device.lat > 36.5 || device.lng < -18 || device.lng > -1;
const getGpsAgeMinutes = (device: GpsDevice, now: number) => {
  const ts = parseDeviceTimestamp(device.timestamp);
  if (!ts) return 999;
  return Math.max(0, (now - ts) / 60000);
};

const decimateTrace = (points: [number, number][], targetPoints: number) => {
  if (points.length <= targetPoints) return points;
  const step = Math.max(1, Math.floor(points.length / targetPoints));
  const reduced: [number, number][] = [];
  for (let i = 0; i < points.length; i += step) reduced.push(points[i]);
  if (reduced[reduced.length - 1] !== points[points.length - 1]) reduced.push(points[points.length - 1]);
  return reduced;
};

const parseDeviceTimestamp = (value: string) => {
  const parsed = Date.parse(value);
  if (Number.isFinite(parsed)) return parsed;
  return null;
};

const isOnline = (device: GpsDevice) => {
  const normalized = device.status.toLowerCase();
  return normalized.includes("online") || normalized.includes("on");
};

const MapViewportSync = ({
  devices,
  selectedDevice,
  followEnabled,
  pendingCenterDeviceId,
  pendingCenterPoint,
  onCentered,
  onCenteredPoint,
  replayDirectorPoint,
  replayDirectorEnabled,
  onViewportChange,
}: {
  devices: GpsDevice[];
  selectedDevice: GpsDevice | null;
  followEnabled: boolean;
  pendingCenterDeviceId: string | null;
  pendingCenterPoint: [number, number] | null;
  onCentered: () => void;
  onCenteredPoint: () => void;
  replayDirectorPoint: [number, number] | null;
  replayDirectorEnabled: boolean;
  onViewportChange: (viewport: MapViewportState) => void;
}) => {
  const map = useMap();
  const initializedRef = useRef(false);

  const emitViewport = useCallback(() => {
    const center = map.getCenter();
    const bounds = map.getBounds();
    onViewportChange({
      center: [center.lat, center.lng],
      zoom: map.getZoom(),
      bounds: {
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest(),
      },
    });
  }, [map, onViewportChange]);

  useMapEvents({
    moveend: emitViewport,
    zoomend: emitViewport,
  });

  useEffect(() => {
    emitViewport();
  }, [emitViewport]);

  useEffect(() => {
    if (!pendingCenterDeviceId) return;
    const target = devices.find((device) => device.id === pendingCenterDeviceId);
    if (!target) return;
    map.setView([target.lat, target.lng], Math.max(map.getZoom(), 14), { animate: true });
    onCentered();
  }, [pendingCenterDeviceId, devices, map, onCentered]);

  useEffect(() => {
    if (!pendingCenterPoint) return;
    map.setView(pendingCenterPoint, Math.max(map.getZoom(), 14), { animate: true });
    onCenteredPoint();
  }, [pendingCenterPoint, map, onCenteredPoint]);

  useEffect(() => {
    if (!replayDirectorEnabled || !replayDirectorPoint) return;
    map.setView(replayDirectorPoint, Math.max(map.getZoom(), 15), { animate: true });
  }, [replayDirectorEnabled, replayDirectorPoint, map]);

  useEffect(() => {
    if (followEnabled && selectedDevice) {
      map.setView([selectedDevice.lat, selectedDevice.lng], Math.max(map.getZoom(), 14), { animate: true });
    }
  }, [selectedDevice, followEnabled, map]);

  useEffect(() => {
    if (initializedRef.current) return;
    if (followEnabled || selectedDevice) return;
    if (devices.length === 0) return;
    if (devices.length === 1) {
      map.setView([devices[0].lat, devices[0].lng], 13, { animate: true });
      initializedRef.current = true;
      return;
    }
    const bounds = L.latLngBounds(devices.map((device) => [device.lat, device.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [25, 25], animate: true });
    initializedRef.current = true;
  }, [devices, selectedDevice, followEnabled, map]);

  return null;
};

const coordinateKey = (lat: number, lng: number) => `${lat.toFixed(5)},${lng.toFixed(5)}`;

const shortAddressFromPayload = (payload: any, uiLanguage: "fr" | "ar") => {
  const address = payload?.address ?? {};
  const city = String(
    address?.city ??
    address?.town ??
    address?.village ??
    address?.municipality ??
    address?.county ??
    ""
  ).trim();
  const street = String(
    address?.road ??
    address?.pedestrian ??
    address?.street ??
    address?.residential ??
    address?.path ??
    ""
  ).trim();
  const joined = [city, street].filter(Boolean).join(" - ");
  if (joined) return joined;
  const display = String(payload?.display_name ?? "").trim();
  if (!display) return uiLanguage === "ar" ? "العنوان غير متاح" : "Adresse indisponible";
  return display.split(",").slice(0, 2).join(", ").trim();
};

const DevicePopup = ({
  device,
  address,
  uiLanguage,
  onNeedAddress,
  tr,
}: {
  device: GpsDevice;
  address: AddressValue | undefined;
  uiLanguage: "fr" | "ar";
  onNeedAddress: (lat: number, lng: number) => void;
  tr: (fr: string, ar: string) => string;
}) => {
  useEffect(() => {
    if (!address) {
      onNeedAddress(device.lat, device.lng);
    }
  }, [address, device.lat, device.lng, onNeedAddress]);

  return (
    <div className="text-xs space-y-1 min-w-[220px]">
      <div className="font-semibold text-sm">{device.name}</div>
      <div>{tr("Vitesse", "السرعة")}: {device.speed.toFixed(0)} km/h</div>
      <div>{tr("Dernière mise à jour", "آخر تحديث")}: {device.timestamp || "—"}</div>
      <div>{tr("Position", "الموقع")}: {device.lat.toFixed(5)}, {device.lng.toFixed(5)}</div>
      <div>{tr("Adresse", "العنوان")}: {address?.short || tr("Recherche d’adresse...", "جارٍ البحث عن العنوان...")}</div>
      <div>IMEI: {device.imei || "—"}</div>
      <div>{tr("Plaque", "اللوحة")}: {device.plate || "—"}</div>
      <div>{tr("Chauffeur", "السائق")}: {device.driver || "—"}</div>
    </div>
  );
};

const LiveMap = () => {
  const [devices, setDevices] = useState<GpsDevice[]>([]);
  const [timelineFrames, setTimelineFrames] = useState<Array<{ at: number; devices: GpsDevice[] }>>([]);
  const [timelineIndex, setTimelineIndex] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [rawDeviceCount, setRawDeviceCount] = useState(0);
  const [droppedCount, setDroppedCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [deviceFilter, setDeviceFilter] = useState<DeviceFilter>("all");
  const [clusteringEnabled, setClusteringEnabled] = useState(true);
  const [followEnabled, setFollowEnabled] = useState(false);
  const [refreshMs, setRefreshMs] = useState("30000");
  const [refreshPaused, setRefreshPaused] = useState(false);
  const [addressCache, setAddressCache] = useState<Record<string, AddressValue>>({});
  const [markerColor, setMarkerColor] = useState("#2563eb");
  const [mapTheme, setMapTheme] = useState<MapTheme>("osm");
  const [showTrace, setShowTrace] = useState(true);
  const [compactCards, setCompactCards] = useState(false);
  const [replaySpeed, setReplaySpeed] = useState<"1" | "2" | "4">("1");
  const [showVehiclesTable, setShowVehiclesTable] = useState(true);
  const [smartFocusEnabled, setSmartFocusEnabled] = useState(false);
  const [heatZonesEnabled, setHeatZonesEnabled] = useState(true);
  const [alertsLayerEnabled, setAlertsLayerEnabled] = useState(true);
  const [adaptiveRefreshEnabled, setAdaptiveRefreshEnabled] = useState(true);
  const [sidePanelSize, setSidePanelSize] = useState(28);
  const [designMode, setDesignMode] = useState<"neon" | "glass" | "mission">("mission");
  const [spatialAudioEnabled, setSpatialAudioEnabled] = useState(false);
  const [panelMode, setPanelMode] = useState<"feed" | "table">("feed");
  const [storyModeEnabled, setStoryModeEnabled] = useState(true);
  const [minimalUiMode, setMinimalUiMode] = useState(false);
  const [dockHidden, setDockHidden] = useState(false);
  const [showDockBlinkPoint, setShowDockBlinkPoint] = useState(true);
  const [dockWorkspace, setDockWorkspace] = useState<DockWorkspace>("actions");
  const { language: uiLanguage, setLanguage: setUiLanguage } = useLanguage();
  const [activePreset, setActivePreset] = useState<LayerPreset>("operations");
  const [mapCenter, setMapCenter] = useState<[number, number]>([31.7917, -7.0926]);
  const [mapZoom, setMapZoom] = useState(6);
  const [mapBounds, setMapBounds] = useState<MapViewportState["bounds"] | null>(null);
  const [settingsReady, setSettingsReady] = useState(false);
  const [traceHistory, setTraceHistory] = useState<Record<string, [number, number][]>>({});
  const [multiFollowIds, setMultiFollowIds] = useState<string[]>([]);
  const [pendingCenterDeviceId, setPendingCenterDeviceId] = useState<string | null>(null);
  const [pendingCenterPoint, setPendingCenterPoint] = useState<[number, number] | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [mutedAlertUntil, setMutedAlertUntil] = useState<Record<string, number>>({});
  const [assignedAlertKeys, setAssignedAlertKeys] = useState<Record<string, boolean>>({});
  const [escalatedAlertKeys, setEscalatedAlertKeys] = useState<Record<string, boolean>>({});
  const [connectionState, setConnectionState] = useState<"online" | "retrying" | "offline">("online");
  const [, setRetryAttempt] = useState(0);
  const [retryInMs, setRetryInMs] = useState<number | null>(null);
  const [replayActive, setReplayActive] = useState(false);
  const [replayIndex, setReplayIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string>("");
  const [recordingStatus, setRecordingStatus] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sectionVisibility, setSectionVisibility] = useState<SectionVisibility>({
    topModes: true,
    miniMap: true,
    storyTimeline: true,
    selectedVehicle: true,
    incidentTimeline: true,
    comparePanel: true,
    replayPanel: true,
    alertEngine: true,
    riskRadar: true,
    alertsFeed: true,
    deviceList: true,
    dockPresets: true,
    dockDisplay: true,
    dockActions: true,
  });
  const firstLoadDone = useRef(false);
  const mapWrapperRef = useRef<HTMLDivElement | null>(null);
  const loadingAddressKeysRef = useRef(new Set<string>());
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const retryTimerRef = useRef<number | null>(null);

  const trackerIcon = useMemo(() => createTrackerIcon(markerColor, false), [markerColor]);
  const trackerSelectedIcon = useMemo(() => createTrackerIcon(markerColor, true), [markerColor]);
  const replayIcon = useMemo(() => createTrackerIcon("#06b6d4", true), []);
  const palette = useMemo(() => ["#2563eb", "#8b5cf6", "#38bdf8", "#06b6d4", "#0ea5e9", "#0284c7"], []);
  const toggleSectionVisibility = useCallback((section: keyof SectionVisibility) => {
    setSectionVisibility((prev) => ({ ...prev, [section]: !prev[section] }));
  }, []);
  const tr = useCallback((fr: string, ar: string) => (uiLanguage === "ar" ? ar : fr), [uiLanguage]);
  const uiLocale = uiLanguage === "ar" ? "ar-MA" : "fr-MA";

  const fetchAddress = async (lat: number, lng: number) => {
    const key = coordinateKey(lat, lng);
    if (addressCache[key]) return;
    if (loadingAddressKeysRef.current.has(key)) return;
    loadingAddressKeysRef.current.add(key);
    try {
      const cached = await kvGet<AddressValue>(`live-map:addr:${key}`);
      if (cached?.short && cached?.full) {
        setAddressCache((prev) => ({ ...prev, [key]: cached }));
        return;
      }
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&accept-language=${uiLanguage}`
      );
      if (!response.ok) throw new Error(tr("Échec de géocodage inversé", "فشل تحويل الإحداثيات إلى عنوان"));
      const payload = await response.json();
      const unavailableAddress = tr("Adresse indisponible", "العنوان غير متاح");
      const resolvedFull = String(payload?.display_name ?? "").trim() || unavailableAddress;
      const resolvedShort = shortAddressFromPayload(payload, uiLanguage);
      const nextValue = { short: resolvedShort, full: resolvedFull };
      setAddressCache((prev) => ({ ...prev, [key]: nextValue }));
      kvSet(`live-map:addr:${key}`, nextValue);
    } catch {
      const unavailableAddress = tr("Adresse indisponible", "العنوان غير متاح");
      const fallback = { short: unavailableAddress, full: unavailableAddress };
      setAddressCache((prev) => ({ ...prev, [key]: fallback }));
    } finally {
      loadingAddressKeysRef.current.delete(key);
    }
  };

  const loadGpsData = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("gpswox");
      if (invokeError) throw new Error(invokeError.message);
      if (data?.success === false) {
        const configHint = data?.configSource
          ? (uiLanguage === "ar" ? ` | المصدر: ${data.configSource}` : ` | source: ${data.configSource}`)
          : "";
        throw new Error(`${String(data?.error ?? tr("Erreur GPS", "خطأ GPS"))}${configHint}`);
      }
      const incoming = Array.isArray(data?.devices) ? data.devices : [];
      const rawCount = Number(data?.rawDeviceCount ?? incoming.length ?? 0) || 0;
      const dropped = Number(data?.droppedCount ?? 0) || 0;

      const mapped = incoming
        .map((item: any): GpsDevice | null => {
          const lat = Number(item?.lat);
          const lng = Number(item?.lng);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
          return {
            id: String(item?.id ?? item?.device_id ?? item?.imei ?? crypto.randomUUID()),
            name: String(item?.name ?? item?.label ?? tr("Véhicule", "مركبة")),
            lat,
            lng,
            speed: Number(item?.speed ?? 0) || 0,
            status: String(item?.status ?? "unknown"),
            timestamp: String(item?.timestamp ?? item?.time ?? ""),
            moving: Boolean(item?.moving ?? Number(item?.speed ?? 0) > 0),
            imei: String(item?.imei ?? ""),
            plate: String(item?.plate ?? item?.plate_number ?? ""),
            driver: String(item?.driver ?? item?.driver_name ?? ""),
          };
        })
        .filter(Boolean) as GpsDevice[];

      setDevices((prev) => {
        if (prev.length === 0) return mapped;
        const prevMap = new Map(prev.map((item) => [item.id, item]));
        let changed = prev.length !== mapped.length;
        const merged = mapped.map((item) => {
          const old = prevMap.get(item.id);
          if (!old) {
            changed = true;
            return item;
          }
          const same =
            old.lat === item.lat &&
            old.lng === item.lng &&
            old.speed === item.speed &&
            old.status === item.status &&
            old.timestamp === item.timestamp &&
            old.moving === item.moving &&
            old.name === item.name &&
            old.imei === item.imei &&
            old.plate === item.plate &&
            old.driver === item.driver;
          if (!same) changed = true;
          return same ? old : item;
        });
        return changed ? merged : prev;
      });
      setRawDeviceCount(rawCount);
      setDroppedCount(dropped);
      setSelectedDeviceId((prev) => (prev && mapped.some((d) => d.id === prev) ? prev : (mapped[0]?.id ?? "")));
      setLastUpdated(new Date().toLocaleString(uiLocale));
      setTimelineFrames((prev) => {
        const next = [...prev, { at: Date.now(), devices: mapped }];
        return next.slice(-240);
      });
      setTraceHistory((prev) => {
        const next: Record<string, [number, number][]> = { ...prev };
        const currentIds = new Set(mapped.map((device) => device.id));
        for (const id of Object.keys(next)) {
          if (!currentIds.has(id)) delete next[id];
        }
        for (const device of mapped) {
          const existing = next[device.id] ? [...next[device.id]] : [];
          const latest = existing[existing.length - 1];
          if (!latest || Math.abs(latest[0] - device.lat) > 0.000001 || Math.abs(latest[1] - device.lng) > 0.000001) {
            existing.push([device.lat, device.lng]);
          }
          next[device.id] = existing.slice(-500);
        }
        return next;
      });
      if (mapped.length === 0) {
        if (rawCount > 0) {
          setError(uiLanguage === "ar" ? `لا توجد إحداثيات GPS قابلة للاستخدام. الأجهزة المستلمة: ${rawCount}، بدون إحداثيات صالحة: ${dropped}.` : `Aucune position GPS exploitable. Appareils reçus: ${rawCount}, sans coordonnées valides: ${dropped}.`);
        } else {
          setError(tr("Aucun appareil retourné par GPSwox.", "لم يتم إرجاع أي جهاز من GPSwox."));
        }
      }
      if (retryTimerRef.current) {
        window.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      setRetryAttempt(0);
      setRetryInMs(null);
      setConnectionState("online");
    } catch (e: any) {
      setError(e?.message || tr("Erreur de connexion à l'API GPS.", "خطأ في الاتصال بواجهة GPS."));
      setConnectionState(navigator.onLine ? "retrying" : "offline");
      setRetryAttempt((prev) => {
        const next = prev + 1;
        const delay = Math.min(60000, 2000 * (2 ** Math.min(6, next)));
        setRetryInMs(delay);
        if (retryTimerRef.current) window.clearTimeout(retryTimerRef.current);
        if (!refreshPaused) {
          retryTimerRef.current = window.setTimeout(() => {
            loadGpsData();
          }, delay);
        }
        return next;
      });
    } finally {
      setIsLoading(false);
    }
  }, [refreshPaused, tr, uiLanguage]);

  useEffect(() => {
    if (firstLoadDone.current) return;
    firstLoadDone.current = true;
    loadGpsData();
  }, [loadGpsData]);

  useEffect(() => {
    let active = true;
    const hydrate = async () => {
      const saved = await kvGet<Partial<LiveMapSettings>>(LIVE_MAP_SETTINGS_KEY);
      if (!active || !saved || typeof saved !== "object") {
        setSettingsReady(true);
        return;
      }
      const nextFilter = typeof saved.deviceFilter === "string" ? saved.deviceFilter : "all";
      const nextTheme = typeof saved.mapTheme === "string" ? saved.mapTheme : "osm";
      const validFilters: DeviceFilter[] = ["all", "online", "offline", "moving", "stopped"];
      const validThemes: MapTheme[] = ["osm", "cartoLight", "cartoDark"];
      if (validFilters.includes(nextFilter as DeviceFilter)) setDeviceFilter(nextFilter as DeviceFilter);
      if (validThemes.includes(nextTheme as MapTheme)) setMapTheme(nextTheme as MapTheme);
      if (typeof saved.refreshMs === "string") setRefreshMs(saved.refreshMs);
      if (typeof saved.clusteringEnabled === "boolean") setClusteringEnabled(saved.clusteringEnabled);
      if (typeof saved.markerColor === "string") setMarkerColor(saved.markerColor);
      if (typeof saved.showTrace === "boolean") setShowTrace(saved.showTrace);
      if (typeof saved.compactCards === "boolean") setCompactCards(saved.compactCards);
      if (saved.replaySpeed === "1" || saved.replaySpeed === "2" || saved.replaySpeed === "4") setReplaySpeed(saved.replaySpeed);
      if (typeof saved.showVehiclesTable === "boolean") setShowVehiclesTable(saved.showVehiclesTable);
      if (typeof saved.smartFocusEnabled === "boolean") setSmartFocusEnabled(saved.smartFocusEnabled);
      if (typeof saved.heatZonesEnabled === "boolean") setHeatZonesEnabled(saved.heatZonesEnabled);
      if (typeof saved.alertsLayerEnabled === "boolean") setAlertsLayerEnabled(saved.alertsLayerEnabled);
      if (typeof saved.adaptiveRefreshEnabled === "boolean") setAdaptiveRefreshEnabled(saved.adaptiveRefreshEnabled);
      if (typeof saved.sidePanelSize === "number") setSidePanelSize(Math.max(18, Math.min(45, saved.sidePanelSize)));
      if (saved.designMode === "neon" || saved.designMode === "glass" || saved.designMode === "mission") setDesignMode(saved.designMode);
      if (typeof saved.spatialAudioEnabled === "boolean") setSpatialAudioEnabled(saved.spatialAudioEnabled);
      if (saved.panelMode === "feed" || saved.panelMode === "table") setPanelMode(saved.panelMode);
      if (typeof saved.minimalUiMode === "boolean") setMinimalUiMode(saved.minimalUiMode);
      if (typeof saved.dockHidden === "boolean") setDockHidden(saved.dockHidden);
      if (typeof saved.showDockBlinkPoint === "boolean") setShowDockBlinkPoint(saved.showDockBlinkPoint);
      if (saved.dockWorkspace === "visibility" || saved.dockWorkspace === "presets" || saved.dockWorkspace === "display" || saved.dockWorkspace === "actions") setDockWorkspace(saved.dockWorkspace);
      if (saved.uiLanguage === "fr" || saved.uiLanguage === "ar") setUiLanguage(saved.uiLanguage);
      if (Array.isArray(saved.mapCenter) && saved.mapCenter.length === 2) {
        const lat = Number(saved.mapCenter[0]);
        const lng = Number(saved.mapCenter[1]);
        if (Number.isFinite(lat) && Number.isFinite(lng)) setMapCenter([lat, lng]);
      }
      if (typeof saved.mapZoom === "number" && Number.isFinite(saved.mapZoom)) setMapZoom(Math.max(3, Math.min(19, Math.round(saved.mapZoom))));
      if (saved.activePreset === "operations" || saved.activePreset === "security" || saved.activePreset === "replay" || saved.activePreset === "focus") setActivePreset(saved.activePreset);
      if (Array.isArray(saved.compareIds)) setCompareIds(saved.compareIds.filter((item): item is string => typeof item === "string").slice(0, 4));
      if (typeof saved.searchQuery === "string") setSearchQuery(saved.searchQuery);
      setSettingsReady(true);
    };
    hydrate();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (refreshPaused) return;
    const movingCount = devices.filter((device) => device.moving || device.speed > 5).length;
    const staleCount = devices.filter((device) => getGpsAgeMinutes(device, Date.now()) > 25).length;
    const focusCount = devices.filter((device) => isOutOfGeofence(device) || device.speed >= 100).length;
    const timeout = adaptiveRefreshEnabled
      ? focusCount > 0
        ? 4000
        : staleCount > 0
          ? 7000
          : movingCount > 0
            ? 6000
            : 32000
      : Number(refreshMs);
    const timer = window.setInterval(loadGpsData, timeout);
    return () => window.clearInterval(timer);
  }, [refreshMs, refreshPaused, adaptiveRefreshEnabled, devices, loadGpsData]);

  useEffect(() => {
    if (!settingsReady) return;
    const timer = window.setTimeout(() => {
      kvSet(LIVE_MAP_SETTINGS_KEY, {
        refreshMs,
        deviceFilter,
        clusteringEnabled,
        markerColor,
        mapTheme,
        showTrace,
        compactCards,
        replaySpeed,
        showVehiclesTable,
        smartFocusEnabled,
        heatZonesEnabled,
        alertsLayerEnabled,
        adaptiveRefreshEnabled,
        sidePanelSize,
        designMode,
        spatialAudioEnabled,
        panelMode,
        minimalUiMode,
        dockHidden,
        showDockBlinkPoint,
        dockWorkspace,
        uiLanguage,
        mapCenter,
        mapZoom,
        activePreset,
        compareIds,
        searchQuery,
      } satisfies LiveMapSettings);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [settingsReady, refreshMs, deviceFilter, clusteringEnabled, markerColor, mapTheme, showTrace, compactCards, replaySpeed, showVehiclesTable, smartFocusEnabled, heatZonesEnabled, alertsLayerEnabled, adaptiveRefreshEnabled, sidePanelSize, designMode, spatialAudioEnabled, panelMode, minimalUiMode, dockHidden, showDockBlinkPoint, dockWorkspace, uiLanguage, mapCenter, mapZoom, activePreset, compareIds, searchQuery]);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement && mapWrapperRef.current && document.fullscreenElement === mapWrapperRef.current));
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    return () => {
      if (recordedVideoUrl) URL.revokeObjectURL(recordedVideoUrl);
    };
  }, [recordedVideoUrl]);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    };
  }, []);

  useEffect(() => {
    const onOnline = () => {
      setConnectionState("online");
      setRetryAttempt(0);
      setRetryInMs(null);
      if (!refreshPaused) loadGpsData();
    };
    const onOffline = () => setConnectionState("offline");
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [refreshPaused, loadGpsData]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    return () => {
      if (retryTimerRef.current) {
        window.clearTimeout(retryTimerRef.current);
      }
    };
  }, []);

  const applyLayerPreset = useCallback((preset: LayerPreset) => {
    setActivePreset(preset);
    if (preset === "operations") {
      setMinimalUiMode(false);
      setSmartFocusEnabled(false);
      setHeatZonesEnabled(true);
      setAlertsLayerEnabled(true);
      setPanelMode("feed");
      setShowTrace(true);
      return;
    }
    if (preset === "security") {
      setMinimalUiMode(false);
      setSmartFocusEnabled(true);
      setHeatZonesEnabled(false);
      setAlertsLayerEnabled(true);
      setPanelMode("feed");
      setShowTrace(true);
      return;
    }
    if (preset === "focus") {
      setMinimalUiMode(true);
      setSmartFocusEnabled(true);
      setHeatZonesEnabled(false);
      setAlertsLayerEnabled(true);
      setAdaptiveRefreshEnabled(true);
      setPanelMode("feed");
      setShowTrace(true);
      setStoryModeEnabled(false);
      setRefreshPaused(false);
      setReplayActive(false);
      return;
    }
    setMinimalUiMode(false);
    setSmartFocusEnabled(false);
    setHeatZonesEnabled(false);
    setAlertsLayerEnabled(false);
    setPanelMode("table");
    setShowTrace(true);
    setReplayActive(true);
  }, []);

  const toggleCompareDevice = useCallback((deviceId: string) => {
    setCompareIds((prev) => {
      if (prev.includes(deviceId)) return prev.filter((id) => id !== deviceId);
      if (prev.length >= 4) return [...prev.slice(1), deviceId];
      return [...prev, deviceId];
    });
  }, []);

  const handleViewportChange = useCallback((viewport: MapViewportState) => {
    setMapCenter(viewport.center);
    setMapZoom(viewport.zoom);
    setMapBounds(viewport.bounds);
  }, []);

  const timelineDevices = useMemo(() => {
    if (timelineIndex === null) return devices;
    const frame = timelineFrames[timelineIndex];
    return frame?.devices ?? devices;
  }, [devices, timelineFrames, timelineIndex]);

  const smartFocusPriorities = useMemo(() => {
    const now = Date.now();
    return timelineDevices
      .map((device) => {
        let score = 0;
        const tags: string[] = [];
        if (device.speed >= 110) {
          score += 7;
          tags.push(tr("Vitesse anormale", "سرعة غير طبيعية"));
        } else if (device.speed >= 95) {
          score += 4;
          tags.push(tr("Vitesse élevée", "سرعة مرتفعة"));
        }
        if (isOutOfGeofence(device)) {
          score += 8;
          tags.push(tr("Sortie de zone", "خروج من المنطقة"));
        }
        const age = getGpsAgeMinutes(device, now);
        if (age >= 25 || !isOnline(device)) {
          score += 6;
          tags.push(tr("Perte GPS", "فقدان GPS"));
        } else if (age >= 15) {
          score += 3;
          tags.push(tr("GPS instable", "GPS غير مستقر"));
        }
        return { device, score, tags };
      })
      .sort((a, b) => b.score - a.score || b.device.speed - a.device.speed);
  }, [timelineDevices, tr]);

  const smartFocusDevices = useMemo(() => {
    if (!smartFocusEnabled) return timelineDevices;
    const prioritized = smartFocusPriorities.filter((item) => item.score > 0).map((item) => item.device);
    return prioritized.length > 0 ? prioritized : timelineDevices;
  }, [timelineDevices, smartFocusEnabled, smartFocusPriorities]);

  const searchedDevices = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return smartFocusDevices;
    return smartFocusDevices.filter((device) =>
      [
        device.name,
        device.imei,
        device.plate,
        device.driver,
        device.id,
      ]
        .map((value) => value.toLowerCase())
        .some((value) => value.includes(query))
    );
  }, [smartFocusDevices, searchQuery]);

  const filteredDevices = useMemo(() => {
    if (deviceFilter === "all") return searchedDevices;
    if (deviceFilter === "online") return searchedDevices.filter(isOnline);
    if (deviceFilter === "offline") return searchedDevices.filter((device) => !isOnline(device));
    if (deviceFilter === "moving") return searchedDevices.filter((device) => device.moving || device.speed > 0);
    return searchedDevices.filter((device) => !device.moving && device.speed <= 0);
  }, [searchedDevices, deviceFilter]);

  const selectedDevice = useMemo(
    () => filteredDevices.find((device) => device.id === selectedDeviceId) ?? filteredDevices[0] ?? null,
    [filteredDevices, selectedDeviceId]
  );
  const selectedTrace = selectedDevice ? (traceHistory[selectedDevice.id] ?? []) : [];
  const targetTracePoints = mapZoom >= 14 ? 440 : mapZoom >= 11 ? 260 : 140;
  const selectedTraceDecimated = useMemo(() => decimateTrace(selectedTrace, targetTracePoints), [selectedTrace, targetTracePoints]);
  const replayTrace = selectedTraceDecimated;
  const replayPoint = replayTrace.length > 0 ? replayTrace[Math.min(replayIndex, replayTrace.length - 1)] : null;
  const replayPath = replayTrace.slice(0, Math.max(1, replayIndex + 1));
  const devicesInViewport = useMemo(() => {
    if (!mapBounds) return filteredDevices;
    const latPad = Math.max(0.08, (mapBounds.north - mapBounds.south) * 0.12);
    const lngPad = Math.max(0.08, (mapBounds.east - mapBounds.west) * 0.12);
    return filteredDevices.filter((device) =>
      device.lat <= mapBounds.north + latPad &&
      device.lat >= mapBounds.south - latPad &&
      device.lng <= mapBounds.east + lngPad &&
      device.lng >= mapBounds.west - lngPad
    );
  }, [filteredDevices, mapBounds]);

  const activeClustering = useMemo(
    () => clusteringEnabled && (mapZoom <= 10 || devicesInViewport.length >= 36),
    [clusteringEnabled, mapZoom, devicesInViewport.length]
  );

  const heatZones = useMemo(() => {
    const bins = new Map<string, { lat: number; lng: number; count: number }>();
    for (const device of devicesInViewport) {
      const latBin = Math.round(device.lat * 20) / 20;
      const lngBin = Math.round(device.lng * 20) / 20;
      const key = `${latBin}:${lngBin}`;
      const existing = bins.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        bins.set(key, { lat: latBin, lng: lngBin, count: 1 });
      }
    }
    return Array.from(bins.values()).filter((item) => item.count > 1);
  }, [devicesInViewport]);
  const alerts = useMemo(() => {
    const now = Date.now();
    return filteredDevices
      .flatMap((device) => {
        const tags: Array<{ type: string; severity: "high" | "medium"; color: string }> = [];
        if (isOutOfGeofence(device)) {
          tags.push({ type: tr("Sortie de zone", "خروج من المنطقة الجغرافية"), severity: "high", color: "#0ea5e9" });
        }
        if (!isOnline(device) || getGpsAgeMinutes(device, now) > 25) {
          tags.push({ type: tr("Perte connexion", "فقدان الاتصال"), severity: "high", color: "#2563eb" });
        }
        if (device.speed >= 110) {
          tags.push({ type: tr("Vitesse anormale", "سرعة غير طبيعية"), severity: "high", color: "#06b6d4" });
        }
        const ts = parseDeviceTimestamp(device.timestamp);
        if (ts && now - ts > 30 * 60000 && device.speed <= 2) {
          tags.push({ type: tr("Arrêt long", "توقف طويل"), severity: "medium", color: "#38bdf8" });
        }
        return tags.map((tag) => ({ ...tag, key: `${device.id}:${tag.type}`, device }));
      })
      .filter((alert) => (mutedAlertUntil[alert.key] ?? 0) < now)
      .slice(0, 60);
  }, [filteredDevices, mutedAlertUntil, tr]);
  const visibleMapAlerts = useMemo(() => {
    if (!mapBounds) return alerts;
    return alerts.filter((alert) =>
      alert.device.lat <= mapBounds.north &&
      alert.device.lat >= mapBounds.south &&
      alert.device.lng <= mapBounds.east &&
      alert.device.lng >= mapBounds.west
    );
  }, [alerts, mapBounds]);
  const criticalAlertCount = useMemo(() => alerts.filter((alert) => alert.severity === "high").length, [alerts]);
  const storyEvents = useMemo(() => {
    const lastFrames = timelineFrames.slice(-40);
    return lastFrames
      .map((frame, index) => {
        const previous = lastFrames[index - 1];
        if (!previous) return null;
        const prevMap = new Map(previous.devices.map((item) => [item.id, item]));
        const nextMap = new Map(frame.devices.map((item) => [item.id, item]));
        let speeding = 0;
        let stopped = 0;
        let offline = 0;
        for (const device of frame.devices) {
          if (device.speed >= 90) speeding += 1;
          if (device.speed <= 2) stopped += 1;
          if (!isOnline(device)) offline += 1;
        }
        const prevMoving = previous.devices.filter((device) => (device.moving || device.speed > 0)).length;
        const nextMoving = frame.devices.filter((device) => (device.moving || device.speed > 0)).length;
        const deltaMoving = nextMoving - prevMoving;
        const risingAlerts = frame.devices.reduce((count, device) => {
          const prev = prevMap.get(device.id);
          if (!prev) return count;
          if (prev.speed < 80 && device.speed >= 80) return count + 1;
          return count;
        }, 0);
        return {
          at: frame.at,
          label: deltaMoving > 0 ? tr("Flux en hausse", "تزايد الحركة") : deltaMoving < 0 ? tr("Ralentissement global", "تباطؤ عام") : tr("Flux stable", "حركة مستقرة"),
          detail: uiLanguage === "ar"
            ? `${speeding} سرعة مرتفعة • ${stopped} توقف • ${offline} غير متصل • ${risingAlerts} انتقالات`
            : `${speeding} vitesse élevée • ${stopped} arrêt • ${offline} hors ligne • ${risingAlerts} bascules`,
        };
      })
      .filter((item): item is { at: number; label: string; detail: string } => Boolean(item))
      .slice(-8)
      .reverse();
  }, [timelineFrames, tr, uiLanguage]);
  const drivingScores = useMemo(() => {
    const map: Record<string, number> = {};
    for (const device of filteredDevices) {
      const trace = traceHistory[device.id] ?? [];
      const speedPenalty = Math.min(35, Math.max(0, device.speed - 80) * 0.9);
      let harshPenalty = 0;
      for (let i = 1; i < trace.length; i += 1) {
        const prev = trace[i - 1];
        const next = trace[i];
        const delta = Math.abs(next[0] - prev[0]) + Math.abs(next[1] - prev[1]);
        if (delta > 0.03) harshPenalty += 2;
      }
      const offlinePenalty = isOnline(device) ? 0 : 18;
      map[device.id] = Math.max(20, Math.min(100, 100 - speedPenalty - harshPenalty - offlinePenalty));
    }
    return map;
  }, [filteredDevices, traceHistory]);
  const topRiskVehicles = useMemo(
    () => [...filteredDevices].sort((a, b) => drivingScores[a.id] - drivingScores[b.id]).slice(0, 5),
    [filteredDevices, drivingScores]
  );
  const etaMinutes = useMemo(() => {
    const map: Record<string, number | null> = {};
    for (const device of filteredDevices) {
      const toCenter = Math.sqrt((device.lat - 33.5731) ** 2 + (device.lng + 7.5898) ** 2) * 111;
      const speed = Math.max(15, device.speed || 15);
      map[device.id] = Math.round((toCenter / speed) * 60);
    }
    return map;
  }, [filteredDevices]);
  const replayDirectorPoint = replayPoint ? [replayPoint[0], replayPoint[1]] as [number, number] : null;
  const replayDirectorEnabled = replayActive || followEnabled;
  const compareDevices = useMemo(
    () => compareIds
      .map((id) => filteredDevices.find((device) => device.id === id) ?? devices.find((device) => device.id === id))
      .filter((item): item is GpsDevice => Boolean(item)),
    [compareIds, filteredDevices, devices]
  );
  const compareStats = useMemo(() => {
    const perDevice = compareDevices.map((device) => {
      let stops = 0;
      let outOfZone = 0;
      let totalFrames = 0;
      const frames = timelineFrames.slice(-120);
      let wasMoving = false;
      for (const frame of frames) {
        const current = frame.devices.find((item) => item.id === device.id);
        if (!current) continue;
        totalFrames += 1;
        const moving = current.moving || current.speed > 3;
        if (wasMoving && !moving) stops += 1;
        if (isOutOfGeofence(current)) outOfZone += 1;
        wasMoving = moving;
      }
      const compliance = totalFrames > 0 ? Math.max(0, 100 - Math.round((outOfZone / totalFrames) * 100)) : 100;
      return {
        device,
        speed: device.speed,
        stops,
        risk: drivingScores[device.id] ?? 0,
        compliance,
      };
    });
    return perDevice;
  }, [compareDevices, timelineFrames, drivingScores]);
  const statusLabels = useMemo(
    () => ({
      online: tr("En ligne", "متصل"),
      offline: tr("Hors ligne", "غير متصل"),
      moving: tr("En mouvement", "في الحركة"),
      stopped: tr("À l'arrêt", "متوقف"),
    }),
    [tr]
  );
  const incidentTimeline = useMemo(() => {
    if (!selectedDevice) return [];
    const frames = timelineFrames.slice(-120);
    const events: Array<{ at: number; label: string; detail: string; point: [number, number] }> = [];
    for (let i = 1; i < frames.length; i += 1) {
      const prev = frames[i - 1].devices.find((device) => device.id === selectedDevice.id);
      const curr = frames[i].devices.find((device) => device.id === selectedDevice.id);
      if (!curr) continue;
      if (prev) {
        const prevStatus = resolveDeviceStatusKey(prev);
        const currStatus = resolveDeviceStatusKey(curr);
        if (prevStatus !== currStatus) {
          events.push({
            at: frames[i].at,
            label: currStatus === "moving" ? tr("Passage en mouvement", "الانتقال إلى الحركة") : currStatus === "stopped" ? tr("Passage à l'arrêt", "الانتقال إلى التوقف") : currStatus === "offline" ? tr("Passage offline", "الانتقال إلى غير متصل") : tr("Retour en ligne", "العودة للاتصال"),
            detail: `${curr.name} • ${statusLabels[currStatus]}`,
            point: [curr.lat, curr.lng],
          });
        }
        if (!isOutOfGeofence(prev) && isOutOfGeofence(curr)) {
          events.push({
            at: frames[i].at,
            label: tr("Sortie geofence", "خروج من المنطقة الجغرافية"),
            detail: uiLanguage === "ar" ? `${curr.name} خارج المنطقة المسموح بها` : `${curr.name} hors zone autorisée`,
            point: [curr.lat, curr.lng],
          });
        }
        if (prev.speed < 100 && curr.speed >= 100) {
          events.push({
            at: frames[i].at,
            label: tr("Vitesse anormale", "سرعة غير طبيعية"),
            detail: `${curr.speed.toFixed(0)} km/h`,
            point: [curr.lat, curr.lng],
          });
        }
      }
    }
    return events.slice(-8).reverse();
  }, [timelineFrames, selectedDevice, statusLabels, tr, uiLanguage]);
  const skin = useMemo(() => {
    if (designMode === "neon") {
      return {
        page: "bg-slate-950 text-slate-100",
        mapShell: "border border-cyan-400/40 shadow-[0_0_40px_rgba(34,211,238,0.2)] bg-slate-900/70",
        panel: "bg-slate-900/70 border border-cyan-400/20 backdrop-blur-md",
        dock: "bg-slate-900/75 border border-cyan-300/40 shadow-[0_0_30px_rgba(56,189,248,0.2)]",
      };
    }
    if (designMode === "glass") {
      return {
        page: "bg-gradient-to-br from-slate-100 via-white to-indigo-50",
        mapShell: "border border-white/40 shadow-xl bg-white/30 backdrop-blur-xl",
        panel: "bg-white/45 border border-white/60 backdrop-blur-xl",
        dock: "bg-white/70 border border-white/60 shadow-xl",
      };
    }
    return {
        page: "bg-slate-950 text-slate-100",
        mapShell: "border border-cyan-500/35 shadow-2xl bg-slate-900/60",
        panel: "bg-slate-900/65 border border-cyan-500/30 backdrop-blur-md",
        dock: "bg-slate-900/80 border border-cyan-400/35 shadow-[0_0_24px_rgba(6,182,212,0.25)]",
    };
  }, [designMode]);
  const isDarkDesign = designMode === "neon" || designMode === "mission";
  const contrastTextClass = isDarkDesign ? "text-slate-100" : "text-slate-900";
  const contrastMutedClass = isDarkDesign ? "text-slate-300" : "text-slate-600";
  const contrastInputClass = isDarkDesign ? "bg-slate-800/70 border-slate-500 text-slate-100 placeholder:text-slate-400" : "";
  const contrastOutlineButtonClass = isDarkDesign ? "border-slate-500/80 text-slate-100 bg-slate-800/40 hover:bg-slate-700/60 hover:text-white" : "";
  const contrastBadgePalette: Record<"online" | "offline" | "moving" | "stopped", string> = isDarkDesign
    ? {
      online: "bg-cyan-500/30 text-cyan-50 ring-1 ring-cyan-300/70",
      offline: "bg-blue-500/30 text-blue-50 ring-1 ring-blue-300/70",
      moving: "bg-sky-500/30 text-sky-50 ring-1 ring-sky-300/70",
      stopped: "bg-amber-500/30 text-amber-50 ring-1 ring-amber-300/70",
    }
    : {
      online: statusColor.online,
      offline: statusColor.offline,
      moving: statusColor.moving,
      stopped: statusColor.stopped,
    };
  const severityBadgePalette: Record<"high" | "medium", string> = isDarkDesign
    ? {
      high: "bg-cyan-500/30 text-cyan-50 ring-1 ring-cyan-300/70",
      medium: "bg-sky-500/30 text-sky-50 ring-1 ring-sky-300/70",
    }
    : {
      high: "bg-cyan-100 text-cyan-700",
      medium: "bg-sky-100 text-sky-700",
    };
  const fleetPulse = useMemo(() => {
    const now = Date.now();
    const online = filteredDevices.filter(isOnline).length;
    const moving = filteredDevices.filter((device) => device.moving || device.speed > 3).length;
    const stale = filteredDevices.filter((device) => getGpsAgeMinutes(device, now) > 25).length;
    const averageSpeed = filteredDevices.length > 0
      ? Math.round(filteredDevices.reduce((sum, device) => sum + Math.max(0, device.speed), 0) / filteredDevices.length)
      : 0;
    return {
      online,
      offline: Math.max(0, filteredDevices.length - online),
      moving,
      stopped: Math.max(0, online - moving),
      stale,
      averageSpeed,
    };
  }, [filteredDevices]);
  const heroMetrics = useMemo(() => ([
    { key: "online", icon: Wifi, value: fleetPulse.online, label: tr("En ligne", "متصل"), accent: "from-emerald-500/25 via-cyan-500/15 to-transparent" },
    { key: "moving", icon: Activity, value: fleetPulse.moving, label: tr("En mouvement", "في الحركة"), accent: "from-sky-500/25 via-indigo-500/15 to-transparent" },
    { key: "alerts", icon: ShieldAlert, value: criticalAlertCount, label: tr("Alertes critiques", "تنبيهات حرجة"), accent: "from-orange-500/25 via-rose-500/15 to-transparent" },
    { key: "viewport", icon: Focus, value: devicesInViewport.length, label: tr("Dans le cadre", "داخل المشهد"), accent: "from-violet-500/25 via-cyan-500/15 to-transparent" },
  ]), [criticalAlertCount, devicesInViewport.length, fleetPulse.moving, fleetPulse.online, tr]);
  const selectedStatusKey = selectedDevice ? resolveDeviceStatusKey(selectedDevice) : null;
  const commandDeckSummary = useMemo(() => ([
    { key: "preset", label: tr("Préréglage", "الضبط"), value: activePreset === "operations" ? tr("Opérations", "العمليات") : activePreset === "security" ? tr("Sécurité", "الأمن") : activePreset === "replay" ? tr("Relecture", "الإعادة") : tr("Focus", "التركيز") },
    { key: "theme", label: tr("Fond", "الخلفية"), value: mapThemes[mapTheme].label },
    { key: "refresh", label: tr("Rythme", "الإيقاع"), value: refreshPaused ? tr("En pause", "متوقف") : adaptiveRefreshEnabled ? tr("Adaptatif", "تكيّفي") : `${Math.round(Number(refreshMs) / 1000)}s` },
    { key: "integrity", label: tr("Signal", "الإشارة"), value: `${rawDeviceCount - droppedCount}/${rawDeviceCount || filteredDevices.length || 0}` },
  ]), [activePreset, adaptiveRefreshEnabled, droppedCount, filteredDevices.length, mapTheme, rawDeviceCount, refreshMs, refreshPaused, tr]);
  const viewportCoverage = filteredDevices.length > 0 ? Math.round((devicesInViewport.length / filteredDevices.length) * 100) : 100;
  const selectedDeviceAlerts = useMemo(
    () => selectedDevice ? alerts.filter((alert) => alert.device.id === selectedDevice.id) : [],
    [alerts, selectedDevice]
  );
  const selectedDeviceAddress = useMemo(() => {
    if (!selectedDevice) return null;
    return addressCache[coordinateKey(selectedDevice.lat, selectedDevice.lng)] ?? null;
  }, [addressCache, selectedDevice]);
  const missionRail = useMemo(() => topRiskVehicles.slice(0, 3).map((device, index) => ({
    id: device.id,
    name: device.name,
    index,
    score: drivingScores[device.id] ?? 0,
    speed: Math.round(device.speed),
  })), [drivingScores, topRiskVehicles]);
  const workspaceTabs = useMemo(() => ([
    { key: "actions" as const, label: tr("Pilotage", "القيادة"), icon: Command },
    { key: "visibility" as const, label: tr("Visibilité", "الرؤية"), icon: Eye },
    { key: "presets" as const, label: tr("Scènes", "المشاهد"), icon: Layers },
    { key: "display" as const, label: tr("Affichage", "العرض"), icon: PanelBottom },
  ]), [tr]);
  const tableRows = useMemo(() => filteredDevices.slice(0, 12), [filteredDevices]);
  const densityTypographyClass = filteredDevices.length >= 90 || sidePanelSize <= 24 ? "text-xs" : "text-sm";
  const commandResults = useMemo(() => {
    const query = commandQuery.trim().toLowerCase();
    return filteredDevices
      .filter((device) => !query || `${device.name} ${device.imei} ${device.plate}`.toLowerCase().includes(query))
      .slice(0, 12);
  }, [commandQuery, filteredDevices]);
  const toggleFullscreen = async () => {
    if (!mapWrapperRef.current) return;
    if (!document.fullscreenElement) {
      await mapWrapperRef.current.requestFullscreen();
      return;
    }
    await document.exitFullscreen();
  };

  const toggleRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
      setIsRecording(false);
      setRecordingStatus(tr("Enregistrement arrêté. Génération de la vidéo...", "تم إيقاف التسجيل. جارٍ إنشاء الفيديو..."));
      return;
    }

    if (!selectedDevice) {
      setError(tr("Sélectionnez un véhicule avant de lancer l’enregistrement du suivi.", "اختر مركبة قبل بدء تسجيل التتبع."));
      return;
    }

    try {
      setError("");
      setRecordingStatus(tr("Préparation de l’enregistrement...", "جارٍ تجهيز التسجيل..."));
      if (!document.fullscreenElement && mapWrapperRef.current) {
        await mapWrapperRef.current.requestFullscreen().catch(() => null);
      }
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      mediaStreamRef.current = stream;
      recordedChunksRef.current = [];
      const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordedChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
        if (recordedVideoUrl) URL.revokeObjectURL(recordedVideoUrl);
        setRecordedVideoUrl(URL.createObjectURL(blob));
        setRecordingStatus(tr("Vidéo du suivi prête.", "فيديو التتبع جاهز."));
        const replaySnapshot = {
          deviceId: selectedDevice.id,
          vehicleName: selectedDevice.name,
          generatedAt: new Date().toISOString(),
          points: selectedTrace.length,
          trace: selectedTrace.slice(-300),
        };
        kvSet(LIVE_MAP_RECORDING_KEY, replaySnapshot);
        kvGet<any[]>(LIVE_MAP_REPLAYS_LIST_KEY).then((existing) => {
          const list = Array.isArray(existing) ? existing : [];
          kvSet(LIVE_MAP_REPLAYS_LIST_KEY, [replaySnapshot, ...list].slice(0, 20));
        });
      };
      recorder.start();
      setFollowEnabled(true);
      setIsRecording(true);
      setRecordingStatus(tr("Enregistrement en cours. Partagez l’onglet de la carte pour capturer le suivi.", "التسجيل قيد التشغيل. شارك تبويب الخريطة لالتقاط التتبع."));
      stream.getVideoTracks().forEach((track) => {
        track.onended = () => {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
            mediaRecorderRef.current.stop();
          }
          mediaStreamRef.current?.getTracks().forEach((item) => item.stop());
          mediaStreamRef.current = null;
          setIsRecording(false);
        };
      });
    } catch {
      setRecordingStatus("");
      setError(tr("Impossible de démarrer l’enregistrement de suivi.", "تعذر بدء تسجيل التتبع."));
    }
  };

  useEffect(() => {
    if (!selectedDeviceId && filteredDevices[0]) {
      setSelectedDeviceId(filteredDevices[0].id);
      return;
    }
    if (selectedDeviceId && !filteredDevices.some((device) => device.id === selectedDeviceId)) {
      setSelectedDeviceId(filteredDevices[0]?.id ?? '');
    }
  }, [filteredDevices, selectedDeviceId]);

  useEffect(() => {
    setReplayActive(false);
    setReplayIndex(0);
  }, [selectedDeviceId]);

  useEffect(() => {
    if (timelineFrames.length === 0) return;
    if (timelineIndex === null) return;
    if (timelineIndex > timelineFrames.length - 1) {
      setTimelineIndex(timelineFrames.length - 1);
    }
  }, [timelineFrames, timelineIndex]);

  useEffect(() => {
    if (!smartFocusEnabled || filteredDevices.length > 0) return;
    setSmartFocusEnabled(false);
  }, [smartFocusEnabled, filteredDevices.length]);

  useEffect(() => {
    setCompareIds((prev) => prev.filter((id) => devices.some((device) => device.id === id)).slice(0, 4));
  }, [devices]);

  useEffect(() => {
    if (!smartFocusEnabled || smartFocusDevices.length < 2) return;
    const timer = window.setInterval(() => {
      setSelectedDeviceId((prev) => {
        const currentIndex = smartFocusDevices.findIndex((device) => device.id === prev);
        const next = smartFocusDevices[(currentIndex + 1 + smartFocusDevices.length) % smartFocusDevices.length];
        if (next) setPendingCenterDeviceId(next.id);
        return next?.id ?? prev;
      });
    }, 7000);
    return () => window.clearInterval(timer);
  }, [smartFocusEnabled, smartFocusDevices]);

  useEffect(() => {
    if (!replayActive) return;
    if (replayTrace.length <= 1) {
      setReplayActive(false);
      return;
    }
    const urgencyBoost = criticalAlertCount > 0 ? 0.75 : 1;
    const interval = Math.max(80, (700 / Number(replaySpeed)) * urgencyBoost);
    const timer = window.setInterval(() => {
      setReplayIndex((prev) => {
        if (prev >= replayTrace.length - 1) {
          setReplayActive(false);
          return prev;
        }
        return prev + 1;
      });
    }, interval);
    return () => window.clearInterval(timer);
  }, [replayActive, replayTrace, replaySpeed, criticalAlertCount]);

  useEffect(() => {
    if (!spatialAudioEnabled || criticalAlertCount <= 0) return;
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.value = 740;
    gain.gain.value = 0.001;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    gain.gain.exponentialRampToValueAtTime(0.04, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.25);
    oscillator.stop(context.currentTime + 0.25);
    return () => {
      context.close();
    };
  }, [criticalAlertCount, spatialAudioEnabled]);

  return (
    <div dir={uiLanguage === "ar" ? "rtl" : "ltr"} lang={uiLanguage} className={`relative h-[calc(100vh-1rem)] overflow-hidden p-2 md:p-3 ${skin.page}`}>
      <div className="pointer-events-none absolute inset-x-4 top-4 z-[700] flex flex-col gap-3">
        <div className="pointer-events-auto flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <Card className={`w-full max-w-[640px] overflow-hidden rounded-[28px] ${skin.panel}`}>
            <div className={`relative p-4 md:p-5 ${isDarkDesign ? "bg-gradient-to-r from-cyan-500/18 via-slate-900/10 to-transparent" : "bg-gradient-to-r from-cyan-100/80 via-white/60 to-transparent"}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className={`mb-2 inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] ${isDarkDesign ? "border-cyan-300/30 bg-cyan-400/10 text-cyan-100" : "border-cyan-200 bg-cyan-50 text-cyan-700"}`}>
                    <MapPin className="h-3.5 w-3.5" />
                    {tr("Live intelligence", "ذكاء مباشر")}
                  </div>
                  <div className="text-lg font-semibold md:text-2xl">{tr("Carte Live Cinématique", "الخريطة المباشرة السينمائية")}</div>
                  <div className={`mt-1 max-w-[540px] text-sm ${contrastMutedClass}`}>
                    {tr("Pilotage temps réel, narration tactique et vision opérationnelle dans une seule scène.", "قيادة لحظية وسرد تكتيكي ورؤية تشغيلية داخل مشهد واحد.")}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge className={`${connectionState === "online" ? "bg-cyan-500/25 text-cyan-100" : connectionState === "retrying" ? "bg-sky-500/25 text-sky-100" : "bg-blue-500/25 text-blue-100"} border-0`}>
                    {connectionState === "online" ? <Wifi className="h-3 w-3 mr-1" /> : <WifiOff className="h-3 w-3 mr-1" />}
                    {connectionState === "online" ? tr("En ligne", "متصل") : connectionState === "retrying" ? tr("Nouvel essai", "إعادة المحاولة") : tr("Hors ligne", "غير متصل")}
                  </Badge>
                  <div className={`text-xs ${contrastMutedClass}`}>
                    {tr("Score flotte moyen", "متوسط أسطول")} {fleetPulse.averageSpeed} km/h
                  </div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
                {heroMetrics.map((metric) => {
                  const MetricIcon = metric.icon;
                  return (
                    <div key={metric.key} className={`rounded-2xl border px-3 py-2.5 ${isDarkDesign ? "border-white/10 bg-slate-950/35" : "border-white/70 bg-white/70 shadow-sm"}`}>
                      <div className={`mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br ${metric.accent}`}>
                        <MetricIcon className="h-4 w-4" />
                      </div>
                      <div className="text-xl font-black md:text-2xl">{metric.value}</div>
                      <div className={`text-[11px] uppercase tracking-[0.18em] ${contrastMutedClass}`}>{metric.label}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className={`flex items-center gap-1 rounded-2xl px-1.5 py-1.5 shadow-lg ${skin.panel}`}>
              <Button size="sm" variant={uiLanguage === "fr" ? "default" : "outline"} className={uiLanguage === "fr" ? "" : contrastOutlineButtonClass} onClick={() => setUiLanguage("fr")}>FR</Button>
              <Button size="sm" variant={uiLanguage === "ar" ? "default" : "outline"} className={uiLanguage === "ar" ? "" : contrastOutlineButtonClass} onClick={() => setUiLanguage("ar")}>AR</Button>
            </div>
            <Button
              size="sm"
              variant={minimalUiMode ? "default" : "outline"}
              className={minimalUiMode ? skin.panel : `${skin.panel} ${contrastOutlineButtonClass}`}
              onClick={() => setMinimalUiMode((value) => !value)}
            >
              <PanelBottom className="h-3.5 w-3.5 mr-1" />
              {minimalUiMode ? tr("Vue complète", "عرض كامل") : tr("Vue carte pure", "عرض الخريطة فقط")}
            </Button>
            <Button size="sm" variant="outline" className={`${skin.panel} ${contrastOutlineButtonClass}`} onClick={() => setCommandPaletteOpen(true)}>
              <Command className="h-3.5 w-3.5 mr-1" />
              {tr("Commandes", "الأوامر")}
            </Button>
          </div>
        </div>

        {!minimalUiMode && (
          <Card className={`pointer-events-auto overflow-hidden rounded-[24px] px-3 py-3 ${skin.panel}`}>
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={`${isDarkDesign ? "bg-white/10 text-slate-100" : "bg-slate-900 text-white"} border-0`}>
                  {tr("Studio tactique", "الاستوديو التكتيكي")}
                </Badge>
                {commandDeckSummary.map((item) => (
                  <div key={item.key} className={`rounded-full border px-3 py-1 text-xs ${isDarkDesign ? "border-white/10 bg-white/5" : "border-slate-200 bg-white/80"}`}>
                    <span className={`mr-1 ${contrastMutedClass}`}>{item.label}</span>
                    <span className="font-semibold">{item.value}</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant={sectionVisibility.topModes ? "default" : "outline"}
                  className={sectionVisibility.topModes ? "" : contrastOutlineButtonClass}
                  onClick={() => toggleSectionVisibility("topModes")}
                >
                  {sectionVisibility.topModes ? <Eye className="h-3.5 w-3.5 mr-1" /> : <EyeOff className="h-3.5 w-3.5 mr-1" />}
                  {tr("Studio visuel", "الاستوديو البصري")}
                </Button>
                {(["operations", "security", "focus", "replay"] as const).map((preset) => (
                  <Button key={preset} size="sm" variant={activePreset === preset ? "default" : "outline"} className={activePreset === preset ? "" : contrastOutlineButtonClass} onClick={() => applyLayerPreset(preset)}>
                    {preset === "operations" ? tr("Opérations", "العمليات") : preset === "security" ? tr("Sécurité", "الأمن") : preset === "focus" ? tr("Focus", "التركيز") : tr("Relecture", "الإعادة")}
                  </Button>
                ))}
                {sectionVisibility.topModes && (
                  <>
                    {(["neon", "glass", "mission"] as const).map((mode) => (
                      <Button key={mode} variant={designMode === mode ? "default" : "outline"} size="sm" onClick={() => setDesignMode(mode)} className={designMode === mode ? "" : contrastOutlineButtonClass}>
                        {mode === "neon" ? tr("Néon Tactique", "نيون تكتيكي") : mode === "glass" ? tr("Verre Minimal Pro", "زجاج احترافي") : tr("Contrôle Mission", "وضع المهمة")}
                      </Button>
                    ))}
                  </>
                )}
              </div>
            </div>
          </Card>
        )}
      </div>

      <ResizablePanelGroup direction="horizontal" className="h-full">
        <ResizablePanel defaultSize={minimalUiMode ? 100 : 100 - sidePanelSize} minSize={minimalUiMode ? 100 : 55}>
          <Card ref={mapWrapperRef} className={`relative h-full overflow-hidden ${skin.mapShell}`}>
            {isLoading && filteredDevices.length === 0 ? (
              <div className="p-6 space-y-4">
                <Skeleton className="h-10 w-60" />
                <Skeleton className="h-[78vh] w-full rounded-2xl" />
              </div>
            ) : (
              <MapContainer center={mapCenter} zoom={mapZoom} className="h-full w-full rounded-2xl">
                <TileLayer attribution={mapThemes[mapTheme].attribution} url={mapThemes[mapTheme].url} />
                <MapViewportSync
                  devices={filteredDevices}
                  selectedDevice={selectedDevice}
                  followEnabled={followEnabled}
                  pendingCenterDeviceId={pendingCenterDeviceId}
                  pendingCenterPoint={pendingCenterPoint}
                  onCentered={() => setPendingCenterDeviceId(null)}
                  onCenteredPoint={() => setPendingCenterPoint(null)}
                  replayDirectorPoint={replayDirectorPoint}
                  replayDirectorEnabled={replayDirectorEnabled}
                  onViewportChange={handleViewportChange}
                />
                {showTrace && selectedTraceDecimated.length > 1 && <Polyline positions={selectedTraceDecimated} pathOptions={{ color: markerColor, weight: 4 }} />}
                {multiFollowIds.map((id, index) => {
                  const trace = decimateTrace(traceHistory[id] ?? [], targetTracePoints);
                  if (trace.length <= 1) return null;
                  return <Polyline key={`mf-${id}`} positions={trace} pathOptions={{ color: palette[index % palette.length], weight: 3 }} />;
                })}
                {replayPath.length > 1 && <Polyline positions={replayPath} pathOptions={{ color: "#f97316", weight: 5, opacity: 0.95 }} />}
                {replayPoint && <Marker position={replayPoint} icon={replayIcon} />}
                {heatZonesEnabled && heatZones.map((zone) => (
                  <Circle
                    key={`heat-${zone.lat}-${zone.lng}`}
                    center={[zone.lat, zone.lng]}
                    radius={Math.min(12000, 2400 + zone.count * 900)}
                    pathOptions={{ color: "#06b6d4", fillColor: "#06b6d4", fillOpacity: Math.min(0.42, 0.14 + zone.count * 0.03), weight: 1 }}
                  />
                ))}
                {alertsLayerEnabled && visibleMapAlerts.map((alert, idx) => (
                  <Circle
                    key={`alert-${alert.device.id}-${idx}`}
                    center={[alert.device.lat, alert.device.lng]}
                    radius={alert.severity === "high" ? 560 : 340}
                    pathOptions={{ color: alert.color, fillColor: alert.color, fillOpacity: alert.severity === "high" ? 0.22 : 0.12, weight: 2 }}
                  />
                ))}
                {activeClustering ? (
                  <MarkerClusterGroup chunkedLoading>
                    {devicesInViewport.map((device) => (
                      <Marker key={device.id} position={[device.lat, device.lng]} icon={selectedDeviceId === device.id ? trackerSelectedIcon : trackerIcon}>
                        <Popup>
                          <DevicePopup device={device} address={addressCache[coordinateKey(device.lat, device.lng)]} uiLanguage={uiLanguage} onNeedAddress={fetchAddress} tr={tr} />
                        </Popup>
                      </Marker>
                    ))}
                  </MarkerClusterGroup>
                ) : (
                  devicesInViewport.map((device) => (
                    <Marker key={device.id} position={[device.lat, device.lng]} icon={selectedDeviceId === device.id ? trackerSelectedIcon : trackerIcon}>
                      <Popup>
                        <DevicePopup device={device} address={addressCache[coordinateKey(device.lat, device.lng)]} uiLanguage={uiLanguage} onNeedAddress={fetchAddress} tr={tr} />
                      </Popup>
                    </Marker>
                  ))
                )}
              </MapContainer>
            )}

            {!minimalUiMode && sectionVisibility.miniMap && (
            <div className={`absolute right-4 top-[180px] z-[600] w-[270px] overflow-hidden rounded-[24px] shadow-2xl ${skin.panel}`}>
              <div className={`border-b px-3 py-2.5 ${isDarkDesign ? "border-white/10 bg-slate-950/35" : "border-slate-200/70 bg-white/80"}`}>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold">{tr("Mini théâtre", "المسرح المصغر")}</div>
                    <div className={`text-[11px] ${contrastMutedClass}`}>{devicesInViewport.length} {tr("véhicules dans le cadre", "مركبات داخل المشهد")}</div>
                  </div>
                  {selectedDevice && selectedStatusKey && <Badge className={`${contrastBadgePalette[selectedStatusKey]} border-0`}>{statusLabels[selectedStatusKey]}</Badge>}
                </div>
              </div>
              <div className="h-[170px]">
                <MapContainer center={selectedDevice ? [selectedDevice.lat, selectedDevice.lng] : [31.7917, -7.0926]} zoom={5} zoomControl={false} attributionControl={false} className="h-full w-full">
                  <TileLayer attribution={mapThemes[mapTheme].attribution} url={mapThemes[mapTheme].url} />
                  {filteredDevices.slice(0, 40).map((device) => (
                    <Circle key={`mini-${device.id}`} center={[device.lat, device.lng]} radius={650} pathOptions={{ color: selectedDeviceId === device.id ? "#2563eb" : "#94a3b8", fillColor: selectedDeviceId === device.id ? "#2563eb" : "#94a3b8", fillOpacity: 0.45, weight: 1 }} />
                  ))}
                </MapContainer>
              </div>
            </div>
            )}

            {!minimalUiMode && selectedDevice && (
            <div className="absolute left-4 bottom-28 z-[610] w-[min(420px,calc(100vw-2rem))]">
              <Card className={`overflow-hidden rounded-[28px] ${skin.panel}`}>
                <div className={`relative border-b px-4 py-4 ${isDarkDesign ? "border-white/10 bg-gradient-to-br from-cyan-500/18 via-slate-950/10 to-transparent" : "border-slate-200/70 bg-gradient-to-br from-cyan-50 via-white to-transparent"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className={`mb-2 inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${isDarkDesign ? "border-cyan-300/20 bg-cyan-400/10 text-cyan-100" : "border-cyan-200 bg-cyan-50 text-cyan-700"}`}>
                        <Truck className="h-3.5 w-3.5" />
                        {tr("Focus véhicule", "تركيز المركبة")}
                      </div>
                      <div className="truncate text-lg font-black">{selectedDevice.name}</div>
                      <div className={`mt-1 flex flex-wrap items-center gap-2 text-xs ${contrastMutedClass}`}>
                        <span>{selectedDevice.driver || tr("Chauffeur non assigné", "سائق غير معين")}</span>
                        <span>•</span>
                        <span>{selectedDevice.plate || selectedDevice.imei}</span>
                      </div>
                    </div>
                    {selectedStatusKey && <Badge className={`${contrastBadgePalette[selectedStatusKey]} border-0`}>{statusLabels[selectedStatusKey]}</Badge>}
                  </div>
                  <div className="mt-4 grid grid-cols-4 gap-2">
                    <div className={`rounded-2xl border px-3 py-2 ${isDarkDesign ? "border-white/10 bg-slate-950/40" : "border-white/80 bg-white/80"}`}>
                      <div className={`text-[10px] uppercase tracking-[0.2em] ${contrastMutedClass}`}>{tr("Score", "النتيجة")}</div>
                      <div className="mt-1 text-lg font-black">{drivingScores[selectedDevice.id] ?? 0}</div>
                    </div>
                    <div className={`rounded-2xl border px-3 py-2 ${isDarkDesign ? "border-white/10 bg-slate-950/40" : "border-white/80 bg-white/80"}`}>
                      <div className={`text-[10px] uppercase tracking-[0.2em] ${contrastMutedClass}`}>{tr("Vitesse", "السرعة")}</div>
                      <div className="mt-1 text-lg font-black">{Math.round(selectedDevice.speed)}<span className="ml-1 text-xs font-semibold">km/h</span></div>
                    </div>
                    <div className={`rounded-2xl border px-3 py-2 ${isDarkDesign ? "border-white/10 bg-slate-950/40" : "border-white/80 bg-white/80"}`}>
                      <div className={`text-[10px] uppercase tracking-[0.2em] ${contrastMutedClass}`}>{tr("ETA", "الوصول")}</div>
                      <div className="mt-1 text-lg font-black">{etaMinutes[selectedDevice.id] ?? "—"}<span className="ml-1 text-xs font-semibold">{tr("min", "د")}</span></div>
                    </div>
                    <div className={`rounded-2xl border px-3 py-2 ${isDarkDesign ? "border-white/10 bg-slate-950/40" : "border-white/80 bg-white/80"}`}>
                      <div className={`text-[10px] uppercase tracking-[0.2em] ${contrastMutedClass}`}>{tr("Alertes", "التنبيهات")}</div>
                      <div className="mt-1 text-lg font-black">{selectedDeviceAlerts.length}</div>
                    </div>
                  </div>
                </div>
                <div className="grid gap-3 px-4 py-4 md:grid-cols-[1.35fr,0.95fr]">
                  <div className={`rounded-2xl border p-3 ${isDarkDesign ? "border-white/10 bg-slate-950/30" : "border-slate-200/70 bg-white/75"}`}>
                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                      <Radar className="h-3.5 w-3.5" />
                      {tr("Signal terrain", "إشارة الميدان")}
                    </div>
                    <div className={`text-xs leading-5 ${contrastMutedClass}`}>
                      {selectedDeviceAddress?.short || tr("Adresse en cours de résolution...", "جارٍ تحديد العنوان...")}
                    </div>
                    <div className={`mt-2 flex flex-wrap items-center gap-2 text-[11px] ${contrastMutedClass}`}>
                      <span>{tr("Vue", "المشهد")} {viewportCoverage}%</span>
                      <span>•</span>
                      <span>{tr("Trace", "الأثر")} {selectedTraceDecimated.length}</span>
                      <span>•</span>
                      <span>{tr("État replay", "حالة الإعادة")} {replayActive ? tr("Actif", "نشط") : tr("Veille", "استعداد")}</span>
                    </div>
                  </div>
                  <div className={`rounded-2xl border p-3 ${isDarkDesign ? "border-cyan-400/15 bg-cyan-500/10" : "border-cyan-100 bg-cyan-50/85"}`}>
                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                      <ShieldAlert className="h-3.5 w-3.5" />
                      {tr("Actions rapides", "إجراءات سريعة")}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button size="sm" variant={followEnabled ? "default" : "outline"} className={followEnabled ? "" : contrastOutlineButtonClass} onClick={() => { setFollowEnabled((value) => !value); setSelectedDeviceId(selectedDevice.id); }}><Target className="h-3.5 w-3.5 mr-1" />{tr("Suivre", "تتبع")}</Button>
                      <Button size="sm" variant="outline" className={contrastOutlineButtonClass} onClick={() => setPendingCenterDeviceId(selectedDevice.id)}>{tr("Centrer", "توسيط")}</Button>
                      <Button size="sm" variant="outline" className={contrastOutlineButtonClass} onClick={() => { setSelectedDeviceId(selectedDevice.id); setReplayActive(true); setReplayIndex(0); }}><Activity className="h-3.5 w-3.5 mr-1" />{tr("Relecture", "إعادة التشغيل")}</Button>
                      <Button size="sm" variant={compareIds.includes(selectedDevice.id) ? "default" : "outline"} className={compareIds.includes(selectedDevice.id) ? "" : contrastOutlineButtonClass} onClick={() => toggleCompareDevice(selectedDevice.id)}><GitCompare className="h-3.5 w-3.5 mr-1" />{tr("Comparer", "مقارنة")}</Button>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
            )}

            {!minimalUiMode && sectionVisibility.storyTimeline && (
            <div className="absolute left-1/2 bottom-24 z-[610] w-[min(900px,94vw)] -translate-x-1/2">
              <Card className={`p-3 ${skin.panel}`}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="text-base md:text-sm font-semibold flex items-center gap-2"><Sparkles className="h-3.5 w-3.5" />{tr("Mode histoire live", "وضع القصة المباشرة")}</div>
                  <Button size="sm" variant={storyModeEnabled ? "default" : "outline"} className={storyModeEnabled ? "" : contrastOutlineButtonClass} onClick={() => setStoryModeEnabled((value) => !value)}>{tr("Histoire", "القصة")}</Button>
                </div>
                <div className="flex items-center gap-3">
                  <Button variant={timelineIndex === null ? "default" : "outline"} size="sm" className={timelineIndex === null ? "" : contrastOutlineButtonClass} onClick={() => setTimelineIndex(null)}>{tr("Direct", "مباشر")}</Button>
                  <Slider
                    value={[timelineIndex === null ? Math.max(0, timelineFrames.length - 1) : timelineIndex]}
                    min={0}
                    max={Math.max(0, timelineFrames.length - 1)}
                    step={1}
                    onValueChange={(value) => timelineFrames.length > 0 && setTimelineIndex(value[0])}
                    className="flex-1"
                    disabled={timelineFrames.length <= 1}
                  />
                  <div className={`text-sm md:text-xs ${contrastMutedClass}`}>{timelineIndex === null ? tr("Maintenant", "الآن") : `${timelineIndex + 1}/${timelineFrames.length}`}</div>
                </div>
                {storyModeEnabled && (
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-1.5">
                    {storyEvents.slice(0, 4).map((event) => (
                      <div key={event.at} className="rounded-md border px-2 py-1.5 text-sm md:text-xs">
                        <div className={`font-semibold ${contrastTextClass}`}>{event.label}</div>
                        <div className={contrastMutedClass}>{event.detail}</div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
            )}
          </Card>
        </ResizablePanel>

        {!minimalUiMode && <ResizableHandle withHandle />}

        {!minimalUiMode && (
        <ResizablePanel defaultSize={sidePanelSize} minSize={18} maxSize={40} onResize={(size) => setSidePanelSize(Math.round(size))}>
          <Card className={`h-full overflow-y-auto p-3 ${skin.panel} ${compactCards ? "text-xs" : densityTypographyClass} ${contrastTextClass}`}>
            <div className={`mb-3 overflow-hidden rounded-[24px] border p-3 ${isDarkDesign ? "border-white/10 bg-slate-950/30" : "border-white/70 bg-white/65"}`}>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-base font-semibold md:text-sm">{tr("Panneaux contextuels", "اللوحات السياقية")}</div>
                  <div className={`mt-1 text-xs ${contrastMutedClass}`}>{tr("Lecture opérationnelle, alertes et suivi ciblé.", "قراءة تشغيلية وتنبيهات وتتبع موجّه.")}</div>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant={panelMode === "feed" ? "default" : "outline"} className={panelMode === "feed" ? "" : contrastOutlineButtonClass} onClick={() => setPanelMode("feed")}><Rows3 className="h-3.5 w-3.5 mr-1" />{tr("Flux", "التدفق")}</Button>
                  <Button size="sm" variant={panelMode === "table" ? "default" : "outline"} className={panelMode === "table" ? "" : contrastOutlineButtonClass} onClick={() => setPanelMode("table")}><Table2 className="h-3.5 w-3.5 mr-1" />{tr("Tableau", "الجدول")}</Button>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className={`rounded-2xl border px-3 py-2 ${isDarkDesign ? "border-cyan-400/15 bg-cyan-500/10" : "border-cyan-100 bg-cyan-50/80"}`}>
                  <div className={`text-[11px] uppercase tracking-[0.18em] ${contrastMutedClass}`}>{tr("Alertes", "التنبيهات")}</div>
                  <div className="mt-1 text-xl font-black">{criticalAlertCount}</div>
                </div>
                <div className={`rounded-2xl border px-3 py-2 ${isDarkDesign ? "border-emerald-400/15 bg-emerald-500/10" : "border-emerald-100 bg-emerald-50/80"}`}>
                  <div className={`text-[11px] uppercase tracking-[0.18em] ${contrastMutedClass}`}>{tr("Offline / stale", "غير متصل / متقادم")}</div>
                  <div className="mt-1 text-xl font-black">{fleetPulse.offline + fleetPulse.stale}</div>
                </div>
              </div>
            </div>

            <div className="mb-3 flex items-center justify-between">
              <div className="text-base md:text-sm font-semibold">{tr("Vue active", "العرض النشط")}</div>
              <div className="flex items-center gap-1">
                <Button size="sm" variant={panelMode === "feed" ? "default" : "outline"} className={panelMode === "feed" ? "" : contrastOutlineButtonClass} onClick={() => setPanelMode("feed")}><Rows3 className="h-3.5 w-3.5 mr-1" />{tr("Flux", "التدفق")}</Button>
                <Button size="sm" variant={panelMode === "table" ? "default" : "outline"} className={panelMode === "table" ? "" : contrastOutlineButtonClass} onClick={() => setPanelMode("table")}><Table2 className="h-3.5 w-3.5 mr-1" />{tr("Tableau", "الجدول")}</Button>
              </div>
            </div>

            {selectedDevice && sectionVisibility.selectedVehicle && (
              <motion.div layout transition={{ duration: criticalAlertCount > 0 ? 0.16 : 0 }} className={`mb-3 overflow-hidden rounded-[24px] border ${selectedDevice ? "bg-primary/10 border-primary/30" : ""}`}>
                <div className={`border-b px-3 py-3 ${isDarkDesign ? "border-white/10 bg-slate-950/30" : "border-white/70 bg-white/60"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{selectedDevice.name}</div>
                      <div className={`mt-1 text-xs ${contrastMutedClass}`}>{selectedDevice.driver || tr("Chauffeur non assigné", "سائق غير معين")} • {selectedDevice.plate || selectedDevice.imei}</div>
                    </div>
                    <Badge className={`${contrastBadgePalette[resolveDeviceStatusKey(selectedDevice)]} border-0`}>{statusLabels[resolveDeviceStatusKey(selectedDevice)]}</Badge>
                  </div>
                  <div className={`mt-2 text-base md:text-sm ${contrastMutedClass}`}>{tr("Score", "النتيجة")} {drivingScores[selectedDevice.id] ?? 0}/100 • {tr("Arrivée estimée", "الوصول المتوقع")} {etaMinutes[selectedDevice.id] ?? "—"} {tr("min", "د")}</div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <div className={`rounded-2xl border px-3 py-2 ${isDarkDesign ? "border-white/10 bg-white/5" : "border-slate-200 bg-white/75"}`}>
                      <div className={`text-[10px] uppercase tracking-[0.18em] ${contrastMutedClass}`}>{tr("Vitesse", "السرعة")}</div>
                      <div className="mt-1 text-lg font-black">{Math.round(selectedDevice.speed)}<span className="ml-1 text-xs font-semibold">km/h</span></div>
                    </div>
                    <div className={`rounded-2xl border px-3 py-2 ${isDarkDesign ? "border-white/10 bg-white/5" : "border-slate-200 bg-white/75"}`}>
                      <div className={`text-[10px] uppercase tracking-[0.18em] ${contrastMutedClass}`}>{tr("Alertes", "التنبيهات")}</div>
                      <div className="mt-1 text-lg font-black">{selectedDeviceAlerts.length}</div>
                    </div>
                    <div className={`rounded-2xl border px-3 py-2 ${isDarkDesign ? "border-white/10 bg-white/5" : "border-slate-200 bg-white/75"}`}>
                      <div className={`text-[10px] uppercase tracking-[0.18em] ${contrastMutedClass}`}>{tr("Trace", "الأثر")}</div>
                      <div className="mt-1 text-lg font-black">{selectedTraceDecimated.length}</div>
                    </div>
                  </div>
                </div>
                <div className="px-3 py-3">
                <div className="grid grid-cols-2 gap-1.5">
                  <Button size="sm" variant={followEnabled ? "default" : "outline"} className={followEnabled ? "" : contrastOutlineButtonClass} onClick={() => { setFollowEnabled((value) => !value); setSelectedDeviceId(selectedDevice.id); }}><Target className="h-3.5 w-3.5 mr-1" />{tr("Suivre", "تتبع")}</Button>
                  <Button size="sm" variant="outline" className={contrastOutlineButtonClass} onClick={() => { setSelectedDeviceId(selectedDevice.id); setReplayActive(true); setReplayIndex(0); }}><Activity className="h-3.5 w-3.5 mr-1" />{tr("Relecture", "إعادة التشغيل")}</Button>
                  <Button size="sm" variant="outline" className={contrastOutlineButtonClass} onClick={() => setPendingCenterDeviceId(selectedDevice.id)}>{tr("Centrer", "توسيط")}</Button>
                  <Button size="sm" variant={compareIds.includes(selectedDevice.id) ? "default" : "outline"} className={compareIds.includes(selectedDevice.id) ? "" : contrastOutlineButtonClass} onClick={() => toggleCompareDevice(selectedDevice.id)}><GitCompare className="h-3.5 w-3.5 mr-1" />{tr("Comparer", "مقارنة")}</Button>
                  <Button size="sm" variant="outline" onClick={() => {
                    const payload = { id: selectedDevice.id, name: selectedDevice.name, speed: selectedDevice.speed, status: selectedDevice.status, trace: traceHistory[selectedDevice.id] ?? [], exportedAt: new Date().toISOString() };
                    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
                    const anchor = document.createElement("a");
                    anchor.href = url;
                    anchor.download = `replay-${selectedDevice.id}.json`;
                    anchor.click();
                    URL.revokeObjectURL(url);
                  }} className={contrastOutlineButtonClass}><Download className="h-3.5 w-3.5 mr-1" />{tr("Exporter", "تصدير")}</Button>
                </div>
                </div>
              </motion.div>
            )}

            {selectedDevice && incidentTimeline.length > 0 && sectionVisibility.incidentTimeline && (
              <Card className="mb-3 p-2.5 border-primary/30 bg-primary/10">
                <div className="mb-1.5 text-sm font-semibold">{tr("Chronologie des incidents", "الجدول الزمني للحوادث")}</div>
                <div className="space-y-1.5">
                  {incidentTimeline.slice(0, 5).map((item) => (
                    <button key={`${item.at}-${item.label}`} type="button" onClick={() => setPendingCenterPoint(item.point)} className="w-full rounded-md border px-2 py-1.5 text-left">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-semibold truncate">{item.label}</span>
                        <span className={contrastMutedClass}>{new Date(item.at).toLocaleTimeString(uiLocale, { hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                      <div className={`mt-0.5 text-xs ${contrastMutedClass}`}>{item.detail}</div>
                    </button>
                  ))}
                </div>
              </Card>
            )}

            {compareStats.length >= 2 && sectionVisibility.comparePanel && (
              <Card className="mb-3 p-2.5 border-cyan-400/30 bg-cyan-500/10">
                <div className="mb-1.5 text-sm font-semibold">{tr("Comparaison multi-sélection", "مقارنة متعددة")}</div>
                <div className="space-y-1.5">
                  {compareStats.map((row) => (
                    <div key={`compare-${row.device.id}`} className="rounded-md border px-2 py-1.5 text-xs">
                      <div className="font-semibold truncate">{row.device.name}</div>
                      <div className={contrastMutedClass}>{tr("Vitesse", "السرعة")} {row.speed.toFixed(0)} • {tr("Arrêts", "التوقفات")} {row.stops} • {tr("Risque", "المخاطر")} {row.risk}/100 • {tr("Conformité", "الامتثال")} {row.compliance}%</div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {replayActive && sectionVisibility.replayPanel && (
              <Card className="mb-3 p-2.5 bg-cyan-500/10 border-cyan-400/30">
                <div className="text-base md:text-sm font-semibold">{tr("Mode relecture actif", "وضع إعادة التشغيل نشط")}</div>
                <div className={`mt-1 text-sm md:text-xs ${contrastMutedClass}`}>{tr("Panoramique auto + vitesse dynamique", "تحريك تلقائي + سرعة ديناميكية")} ({replaySpeed}x)</div>
              </Card>
            )}

            {criticalAlertCount > 0 && sectionVisibility.alertEngine && (
              <Card className="mb-3 p-2.5 bg-blue-500/10 border-blue-400/30">
                <div className="text-base md:text-sm font-semibold flex items-center gap-1.5"><BellRing className="h-3.5 w-3.5" />{tr("Moteur d’alerte", "محرك التنبيهات")}</div>
                <div className={`mt-1 text-sm md:text-xs ${contrastMutedClass}`}>{criticalAlertCount} {tr("points critiques mis en évidence sur la carte", "نقاط حرجة مميزة على الخريطة")}</div>
              </Card>
            )}

            {sectionVisibility.riskRadar && (
              <>
                <div className="mb-2 text-base md:text-sm font-semibold">{tr("Radar des risques", "رادار المخاطر")}</div>
                {missionRail.length > 0 && (
                  <div className="mb-2 grid gap-2">
                    {missionRail.map((item) => (
                      <button
                        key={`mission-rail-${item.id}`}
                        type="button"
                        onClick={() => {
                          setSelectedDeviceId(item.id);
                          setPendingCenterDeviceId(item.id);
                        }}
                        className={`rounded-2xl border px-3 py-2 text-left ${isDarkDesign ? "border-white/10 bg-slate-950/30 hover:bg-slate-900/50" : "border-slate-200 bg-white/75 hover:bg-white"}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-xs font-semibold uppercase tracking-[0.18em]">{tr("Mission", "مهمة")} {item.index + 1}</div>
                            <div className="truncate text-sm font-semibold">{item.name}</div>
                          </div>
                          <Badge className={`${isDarkDesign ? "bg-cyan-500/30 text-cyan-50 ring-1 ring-cyan-300/70" : "bg-cyan-100 text-cyan-700"} border-0`}>{item.score}</Badge>
                        </div>
                        <div className={`mt-1 text-xs ${contrastMutedClass}`}>{tr("Vitesse", "السرعة")} {item.speed} km/h</div>
                      </button>
                    ))}
                  </div>
                )}
                <div className="space-y-1.5">
                  {topRiskVehicles.map((device) => (
                    <button key={`risk-${device.id}`} type="button" onClick={() => setSelectedDeviceId(device.id)} className="w-full rounded-md border px-2 py-1.5 text-left">
                      <div className="flex items-center justify-between gap-2 text-sm md:text-xs">
                        <span className="truncate">{device.name}</span>
                        <Badge className={`${isDarkDesign ? "bg-cyan-500/30 text-cyan-50 ring-1 ring-cyan-300/70" : "bg-cyan-100 text-cyan-700"} border-0`}>{drivingScores[device.id] ?? 0}</Badge>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}

            {sectionVisibility.alertsFeed && (
              <>
                <div className="mt-3 mb-2 text-base md:text-sm font-semibold">{tr("Flux d’alertes", "تدفق التنبيهات")}</div>
                <div className="space-y-1.5">
                  {alerts.slice(0, 8).map((alert) => (
                    <div key={`alert-line-${alert.key}`} className="w-full rounded-md border px-2 py-1.5">
                      <div className="flex items-center justify-between gap-2 text-sm md:text-xs">
                        <button type="button" className="truncate text-left" onClick={() => setPendingCenterDeviceId(alert.device.id)}>{alert.device.name} • {alert.type}</button>
                        <Badge className={`${severityBadgePalette[alert.severity]} border-0`}>{alert.severity === "high" ? tr("Élevée", "مرتفعة") : tr("Moyenne", "متوسطة")}</Badge>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <Button size="sm" variant="outline" className={contrastOutlineButtonClass} onClick={() => setMutedAlertUntil((prev) => ({ ...prev, [alert.key]: Date.now() + 10 * 60000 }))}>{tr("Silence 10 min", "صامت 10 دقائق")}</Button>
                        <Button size="sm" variant={assignedAlertKeys[alert.key] ? "default" : "outline"} className={assignedAlertKeys[alert.key] ? "" : contrastOutlineButtonClass} onClick={() => setAssignedAlertKeys((prev) => ({ ...prev, [alert.key]: !prev[alert.key] }))}>{assignedAlertKeys[alert.key] ? tr("Assignée", "مُسندة") : tr("Assigner", "إسناد")}</Button>
                        <Button size="sm" variant={escalatedAlertKeys[alert.key] ? "default" : "outline"} className={escalatedAlertKeys[alert.key] ? "" : contrastOutlineButtonClass} onClick={() => setEscalatedAlertKeys((prev) => ({ ...prev, [alert.key]: !prev[alert.key] }))}>{escalatedAlertKeys[alert.key] ? tr("Escaladée", "مصعّدة") : tr("Escalader", "تصعيد")}</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {sectionVisibility.deviceList && panelMode === "feed" ? (
              <div className="mt-3 space-y-1.5">
                {filteredDevices.slice(0, 14).map((device) => {
                  const statusKey = resolveDeviceStatusKey(device);
                  const badgeClass = contrastBadgePalette[statusKey];
                  return (
                    <button key={device.id} type="button" onClick={() => setSelectedDeviceId(device.id)} className={`w-full rounded-md border px-2 py-1.5 text-left ${selectedDeviceId === device.id ? "border-primary bg-primary/10" : ""}`}>
                      <div className="flex items-center justify-between gap-2 text-sm md:text-xs">
                        <span className="truncate">{device.name}</span>
                        <div className="flex items-center gap-1.5">
                          <Badge className={`${badgeClass} border-0`}>{statusLabels[statusKey]}</Badge>
                          <Button size="sm" variant={compareIds.includes(device.id) ? "default" : "outline"} className={compareIds.includes(device.id) ? "h-6 px-2" : `h-6 px-2 ${contrastOutlineButtonClass}`} onClick={(event) => { event.stopPropagation(); toggleCompareDevice(device.id); }}>{tr("Comp", "مق")}</Button>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : sectionVisibility.deviceList && showVehiclesTable ? (
              <Table className={isDarkDesign ? "[&_th]:text-slate-200 [&_td]:text-slate-100" : ""}>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tr("Véhicule", "المركبة")}</TableHead>
                    <TableHead>{tr("Statut", "الحالة")}</TableHead>
                    <TableHead>{tr("Vitesse", "السرعة")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableRows.map((device) => {
                    const statusKey = resolveDeviceStatusKey(device);
                    const badgeClass = contrastBadgePalette[statusKey];
                    return (
                      <TableRow key={`table-${device.id}`} className="cursor-pointer" onClick={() => setSelectedDeviceId(device.id)}>
                        <TableCell className="font-medium">{device.name}</TableCell>
                        <TableCell><Badge className={`${badgeClass} border-0`}>{statusLabels[statusKey]}</Badge></TableCell>
                        <TableCell>{device.speed.toFixed(0)} km/h</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : sectionVisibility.deviceList ? (
              <Card className="mt-3 p-2 text-xs border-dashed">{tr("Tableau véhicules masqué", "جدول المركبات مخفي")}</Card>
            ) : null}
          </Card>
        </ResizablePanel>
        )}
      </ResizablePanelGroup>

      {!minimalUiMode && !dockHidden && (
      <div className="pointer-events-none absolute inset-x-0 bottom-4 z-[700] flex justify-center px-4">
        <Card className={`pointer-events-auto relative w-[min(1080px,98vw)] p-2.5 ${skin.dock}`}>
          <button
            type="button"
            title={tr("Masquer le panneau", "إخفاء اللوحة")}
            aria-label={tr("Masquer le panneau", "إخفاء اللوحة")}
            onClick={() => setDockHidden(true)}
            className={`absolute right-2 top-2 rounded-full p-1 transition hover:scale-110 ${contrastOutlineButtonClass}`}
          >
              <span className="relative flex h-3.5 w-3.5">
                {showDockBlinkPoint && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-80" />}
                <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-cyan-500" />
              </span>
          </button>
          <div className="flex flex-col gap-3">
            <div className="grid gap-2 lg:grid-cols-[minmax(240px,1.2fr),auto] lg:items-center">
              <div className="relative min-w-[220px] flex-1">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 opacity-70" />
                <Input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder={tr("Recherche / IMEI / plaque", "بحث / IMEI / اللوحة")} className={`pl-8 ${contrastInputClass}`} />
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Button size="sm" variant="outline" className={contrastOutlineButtonClass} onClick={loadGpsData}><RefreshCw className={`h-3.5 w-3.5 mr-1 ${isLoading && criticalAlertCount > 0 ? "animate-spin" : ""}`} />{tr("Actualiser", "تحديث")}</Button>
                <Button size="sm" variant={refreshPaused ? "default" : "outline"} className={refreshPaused ? "" : contrastOutlineButtonClass} onClick={() => setRefreshPaused((value) => !value)}>{refreshPaused ? <Play className="h-3.5 w-3.5 mr-1" /> : <Pause className="h-3.5 w-3.5 mr-1" />}{refreshPaused ? tr("Reprendre", "استئناف") : tr("Pause", "إيقاف مؤقت")}</Button>
                <Button size="sm" variant="outline" className={contrastOutlineButtonClass} onClick={() => setCommandPaletteOpen(true)}><Command className="h-3.5 w-3.5 mr-1" />{tr("Commandes", "الأوامر")}</Button>
              </div>
            </div>

            <div className={`rounded-[22px] border p-2.5 ${isDarkDesign ? "border-white/10 bg-slate-950/25" : "border-white/70 bg-white/70"}`}>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold">{tr("Console de pilotage", "وحدة القيادة")}</div>
                  <div className={`text-xs ${contrastMutedClass}`}>{tr("Une zone à la fois pour réduire la charge visuelle.", "منطقة واحدة في كل مرة لتقليل الحمل البصري.")}</div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {workspaceTabs.map((tab) => {
                    const TabIcon = tab.icon;
                    return (
                      <Button
                        key={tab.key}
                        size="sm"
                        variant={dockWorkspace === tab.key ? "default" : "outline"}
                        className={dockWorkspace === tab.key ? "" : contrastOutlineButtonClass}
                        onClick={() => setDockWorkspace(tab.key)}
                      >
                        <TabIcon className="h-3.5 w-3.5 mr-1" />
                        {tab.label}
                      </Button>
                    );
                  })}
                </div>
              </div>

              {dockWorkspace === "visibility" && (
                <div className="grid gap-3 lg:grid-cols-[1.3fr,0.9fr]">
                  <div className="rounded-2xl border border-white/10 p-2.5">
                    <div className="mb-2 text-sm font-semibold">{tr("Visibilité rapide", "إظهار سريع")}</div>
                    <div className="flex flex-wrap gap-1.5">
                      <Button size="sm" variant={sectionVisibility.miniMap ? "default" : "outline"} className={sectionVisibility.miniMap ? "" : contrastOutlineButtonClass} onClick={() => toggleSectionVisibility("miniMap")}>{sectionVisibility.miniMap ? <Eye className="h-3.5 w-3.5 mr-1" /> : <EyeOff className="h-3.5 w-3.5 mr-1" />}{tr("Mini-carte", "الخريطة المصغرة")}</Button>
                      <Button size="sm" variant={sectionVisibility.storyTimeline ? "default" : "outline"} className={sectionVisibility.storyTimeline ? "" : contrastOutlineButtonClass} onClick={() => toggleSectionVisibility("storyTimeline")}>{sectionVisibility.storyTimeline ? <Eye className="h-3.5 w-3.5 mr-1" /> : <EyeOff className="h-3.5 w-3.5 mr-1" />}{tr("Chronologie live", "الجدول الزمني المباشر")}</Button>
                      <Button size="sm" variant={sectionVisibility.incidentTimeline ? "default" : "outline"} className={sectionVisibility.incidentTimeline ? "" : contrastOutlineButtonClass} onClick={() => toggleSectionVisibility("incidentTimeline")}>{sectionVisibility.incidentTimeline ? <Eye className="h-3.5 w-3.5 mr-1" /> : <EyeOff className="h-3.5 w-3.5 mr-1" />}{tr("Incidents", "الحوادث")}</Button>
                      <Button size="sm" variant={sectionVisibility.riskRadar ? "default" : "outline"} className={sectionVisibility.riskRadar ? "" : contrastOutlineButtonClass} onClick={() => toggleSectionVisibility("riskRadar")}>{sectionVisibility.riskRadar ? <Eye className="h-3.5 w-3.5 mr-1" /> : <EyeOff className="h-3.5 w-3.5 mr-1" />}{tr("Radar risques", "رادار المخاطر")}</Button>
                      <Button size="sm" variant={sectionVisibility.alertsFeed ? "default" : "outline"} className={sectionVisibility.alertsFeed ? "" : contrastOutlineButtonClass} onClick={() => toggleSectionVisibility("alertsFeed")}>{sectionVisibility.alertsFeed ? <Eye className="h-3.5 w-3.5 mr-1" /> : <EyeOff className="h-3.5 w-3.5 mr-1" />}{tr("Flux alertes", "تدفق التنبيهات")}</Button>
                      <Button size="sm" variant={sectionVisibility.deviceList ? "default" : "outline"} className={sectionVisibility.deviceList ? "" : contrastOutlineButtonClass} onClick={() => toggleSectionVisibility("deviceList")}>{sectionVisibility.deviceList ? <Eye className="h-3.5 w-3.5 mr-1" /> : <EyeOff className="h-3.5 w-3.5 mr-1" />}{tr("Liste véhicules", "قائمة المركبات")}</Button>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/10 p-2.5">
                    <div className="mb-2 text-sm font-semibold">{tr("Modules du dock", "وحدات الشريط")}</div>
                    <div className="flex flex-wrap gap-1.5">
                      <Button size="sm" variant={sectionVisibility.dockPresets ? "default" : "outline"} className={sectionVisibility.dockPresets ? "" : contrastOutlineButtonClass} onClick={() => toggleSectionVisibility("dockPresets")}>{sectionVisibility.dockPresets ? tr("Presets visibles", "المشاهد ظاهرة") : tr("Presets masqués", "المشاهد مخفية")}</Button>
                      <Button size="sm" variant={sectionVisibility.dockDisplay ? "default" : "outline"} className={sectionVisibility.dockDisplay ? "" : contrastOutlineButtonClass} onClick={() => toggleSectionVisibility("dockDisplay")}>{sectionVisibility.dockDisplay ? tr("Affichage visible", "العرض ظاهر") : tr("Affichage masqué", "العرض مخفي")}</Button>
                      <Button size="sm" variant={sectionVisibility.dockActions ? "default" : "outline"} className={sectionVisibility.dockActions ? "" : contrastOutlineButtonClass} onClick={() => toggleSectionVisibility("dockActions")}>{sectionVisibility.dockActions ? tr("Actions visibles", "الإجراءات ظاهرة") : tr("Actions masquées", "الإجراءات مخفية")}</Button>
                      <Button size="sm" variant={showVehiclesTable ? "default" : "outline"} className={showVehiclesTable ? "" : contrastOutlineButtonClass} onClick={() => setShowVehiclesTable((value) => !value)}>{showVehiclesTable ? tr("Tableau visible", "الجدول ظاهر") : tr("Tableau masqué", "الجدول مخفي")}</Button>
                      <Button size="sm" variant={showDockBlinkPoint ? "default" : "outline"} className={showDockBlinkPoint ? "" : contrastOutlineButtonClass} onClick={() => setShowDockBlinkPoint((value) => !value)}>{showDockBlinkPoint ? tr("Point actif", "الوميض نشط") : tr("Point inactif", "الوميض متوقف")}</Button>
                    </div>
                  </div>
                </div>
              )}

              {dockWorkspace === "presets" && (
                <div className="grid gap-3 lg:grid-cols-[1.1fr,0.9fr]">
                  {sectionVisibility.dockPresets && (
                    <div className="rounded-2xl border border-white/10 p-2.5">
                      <div className="mb-2 text-sm font-semibold">{tr("Scènes prêtes", "مشاهد جاهزة")}</div>
                      <div className="flex flex-wrap gap-1.5">
                        <Button size="sm" variant={activePreset === "operations" ? "default" : "outline"} className={activePreset === "operations" ? "" : contrastOutlineButtonClass} onClick={() => applyLayerPreset("operations")}><Layers className="h-3.5 w-3.5 mr-1" />{tr("Opérations", "العمليات")}</Button>
                        <Button size="sm" variant={activePreset === "security" ? "default" : "outline"} className={activePreset === "security" ? "" : contrastOutlineButtonClass} onClick={() => applyLayerPreset("security")}><AlertTriangle className="h-3.5 w-3.5 mr-1" />{tr("Sécurité", "الأمن")}</Button>
                        <Button size="sm" variant={activePreset === "focus" ? "default" : "outline"} className={activePreset === "focus" ? "" : contrastOutlineButtonClass} onClick={() => applyLayerPreset("focus")}><Target className="h-3.5 w-3.5 mr-1" />{tr("Carte focus", "خريطة التركيز")}</Button>
                        <Button size="sm" variant={activePreset === "replay" ? "default" : "outline"} className={activePreset === "replay" ? "" : contrastOutlineButtonClass} onClick={() => applyLayerPreset("replay")}><Activity className="h-3.5 w-3.5 mr-1" />{tr("Vue relecture", "عرض الإعادة")}</Button>
                      </div>
                    </div>
                  )}
                  <div className="rounded-2xl border border-white/10 p-2.5">
                    <div className="mb-2 text-sm font-semibold">{tr("Studio visuel", "الاستوديو البصري")}</div>
                    <div className="flex flex-wrap gap-1.5">
                      <Button size="sm" variant={sectionVisibility.topModes ? "default" : "outline"} className={sectionVisibility.topModes ? "" : contrastOutlineButtonClass} onClick={() => toggleSectionVisibility("topModes")}>{sectionVisibility.topModes ? tr("Modes visibles", "الأنماط ظاهرة") : tr("Modes masqués", "الأنماط مخفية")}</Button>
                      {(["neon", "glass", "mission"] as const).map((mode) => (
                        <Button key={mode} size="sm" variant={designMode === mode ? "default" : "outline"} className={designMode === mode ? "" : contrastOutlineButtonClass} onClick={() => setDesignMode(mode)}>
                          {mode === "neon" ? tr("Néon", "نيون") : mode === "glass" ? tr("Verre", "زجاج") : tr("Mission", "مهمة")}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {dockWorkspace === "display" && (
                <div className="grid gap-3 lg:grid-cols-[1.15fr,0.85fr]">
                  {sectionVisibility.dockDisplay && (
                    <div className="rounded-2xl border border-white/10 p-2.5">
                      <div className="mb-2 text-sm font-semibold">{tr("Réglages d'affichage", "إعدادات العرض")}</div>
                      <div className="flex flex-wrap gap-1.5">
                        <Button size="sm" variant={panelMode === "feed" ? "default" : "outline"} className={panelMode === "feed" ? "" : contrastOutlineButtonClass} onClick={() => setPanelMode((value) => value === "feed" ? "table" : "feed")}><PanelBottom className="h-3.5 w-3.5 mr-1" />{panelMode === "feed" ? tr("Tableau", "الجدول") : tr("Flux", "التدفق")}</Button>
                        <Button size="sm" variant={smartFocusEnabled ? "default" : "outline"} className={smartFocusEnabled ? "" : contrastOutlineButtonClass} onClick={() => setSmartFocusEnabled((value) => !value)}><Focus className="h-3.5 w-3.5 mr-1" />{tr("Focus", "التركيز")}</Button>
                        <Button size="sm" variant={alertsLayerEnabled ? "default" : "outline"} className={alertsLayerEnabled ? "" : contrastOutlineButtonClass} onClick={() => setAlertsLayerEnabled((value) => !value)}><BellRing className="h-3.5 w-3.5 mr-1" />{tr("Alertes carte", "تنبيهات الخريطة")}</Button>
                        <Button size="sm" variant={clusteringEnabled ? "default" : "outline"} className={clusteringEnabled ? "" : contrastOutlineButtonClass} onClick={() => setClusteringEnabled((value) => !value)}><Layers className="h-3.5 w-3.5 mr-1" />{tr("Regrouper", "تجميع")}</Button>
                        <Button size="sm" variant={heatZonesEnabled ? "default" : "outline"} className={heatZonesEnabled ? "" : contrastOutlineButtonClass} onClick={() => setHeatZonesEnabled((value) => !value)}><Flame className="h-3.5 w-3.5 mr-1" />{tr("Zones chaleur", "مناطق الحرارة")}</Button>
                      </div>
                    </div>
                  )}
                  <div className="rounded-2xl border border-white/10 p-2.5">
                    <div className="mb-2 text-sm font-semibold">{tr("Mode de lecture", "وضع القراءة")}</div>
                    <div className={`text-xs ${contrastMutedClass}`}>
                      {panelMode === "feed" ? tr("Les panneaux privilégient la narration et les alertes.", "اللوحات تركز على السرد والتنبيهات.") : tr("Les panneaux privilégient la comparaison tabulaire.", "اللوحات تركز على المقارنة الجدولية.")}
                    </div>
                  </div>
                </div>
              )}

              {dockWorkspace === "actions" && (
                <div className="grid gap-3 lg:grid-cols-[1.2fr,0.8fr]">
                  {sectionVisibility.dockActions && (
                    <div className="rounded-2xl border border-white/10 p-2.5">
                      <div className="mb-2 text-sm font-semibold">{tr("Actions temps réel", "إجراءات لحظية")}</div>
                      <div className="flex flex-wrap gap-1.5">
                        <Button size="sm" variant={replayActive ? "default" : "outline"} className={replayActive ? "" : contrastOutlineButtonClass} onClick={() => {
                          if (replayTrace.length <= 1) return;
                          if (replayIndex >= replayTrace.length - 1) setReplayIndex(0);
                          setReplayActive((prev) => !prev);
                        }}><Play className="h-3.5 w-3.5 mr-1" />{tr("Relecture", "إعادة التشغيل")}</Button>
                        <Button size="sm" variant={adaptiveRefreshEnabled ? "default" : "outline"} className={adaptiveRefreshEnabled ? "" : contrastOutlineButtonClass} onClick={() => setAdaptiveRefreshEnabled((value) => !value)}><Radar className="h-3.5 w-3.5 mr-1" />{tr("Adaptatif", "تكيّفي")}</Button>
                        <Button size="sm" variant={spatialAudioEnabled ? "default" : "outline"} className={spatialAudioEnabled ? "" : contrastOutlineButtonClass} onClick={() => setSpatialAudioEnabled((value) => !value)}>
                          {spatialAudioEnabled ? <Volume2 className="h-3.5 w-3.5 mr-1" /> : <VolumeX className="h-3.5 w-3.5 mr-1" />}
                          {tr("Son", "الصوت")}
                        </Button>
                        <Button size="sm" variant="outline" className={contrastOutlineButtonClass} onClick={toggleRecording}>{isRecording ? tr("Arrêter rec", "إيقاف التسجيل") : tr("Enregistrer", "تسجيل")}</Button>
                        <Button size="sm" variant="outline" className={contrastOutlineButtonClass} onClick={toggleFullscreen}>{isFullscreen ? <Minimize2 className="h-3.5 w-3.5 mr-1" /> : <Maximize2 className="h-3.5 w-3.5 mr-1" />}{isFullscreen ? tr("Réduire", "تصغير") : tr("Plein écran", "ملء الشاشة")}</Button>
                      </div>
                    </div>
                  )}
                  <div className="rounded-2xl border border-white/10 p-2.5">
                    <div className="mb-2 text-sm font-semibold">{tr("État session", "حالة الجلسة")}</div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className={`rounded-xl border px-3 py-2 ${isDarkDesign ? "border-white/10 bg-white/5" : "border-slate-200 bg-white/80"}`}>
                        <div className={`text-[10px] uppercase tracking-[0.18em] ${contrastMutedClass}`}>{tr("Replay", "الإعادة")}</div>
                        <div className="mt-1 text-sm font-black">{replayActive ? tr("Actif", "نشط") : tr("Prêt", "جاهز")}</div>
                      </div>
                      <div className={`rounded-xl border px-3 py-2 ${isDarkDesign ? "border-white/10 bg-white/5" : "border-slate-200 bg-white/80"}`}>
                        <div className={`text-[10px] uppercase tracking-[0.18em] ${contrastMutedClass}`}>{tr("Capture", "التسجيل")}</div>
                        <div className="mt-1 text-sm font-black">{isRecording ? tr("En cours", "قيد التشغيل") : tr("Inactive", "غير مفعلة")}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>
      )}

      {!minimalUiMode && dockHidden && (
      <div className="pointer-events-none absolute bottom-5 right-5 z-[710]">
        <button
          type="button"
          title={tr("Afficher le panneau", "إظهار اللوحة")}
          aria-label={tr("Afficher le panneau", "إظهار اللوحة")}
          onClick={() => setDockHidden(false)}
          className={`pointer-events-auto rounded-full p-1.5 shadow-xl transition hover:scale-110 ${skin.panel} ${contrastOutlineButtonClass}`}
        >
          <span className="relative flex h-3.5 w-3.5">
            {showDockBlinkPoint && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-80" />}
            <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-cyan-500" />
          </span>
        </button>
      </div>
      )}

      {minimalUiMode && activePreset === "focus" && (
      <div className="pointer-events-none absolute inset-x-0 bottom-4 z-[710] flex justify-center px-4">
        <Card className={`pointer-events-auto w-auto rounded-full px-2 py-1.5 shadow-2xl ${skin.dock}`}>
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="outline" className={contrastOutlineButtonClass} onClick={() => applyLayerPreset("operations")}>
              <PanelBottom className="h-3.5 w-3.5 mr-1" />
              {tr("Quitter focus", "خروج من التركيز")}
            </Button>
            <Button size="sm" variant="outline" className={contrastOutlineButtonClass} onClick={loadGpsData}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${isLoading ? "animate-spin" : ""}`} />
              {tr("Actualiser", "تحديث")}
            </Button>
            <Button size="sm" variant={alertsLayerEnabled ? "default" : "outline"} className={alertsLayerEnabled ? "" : contrastOutlineButtonClass} onClick={() => setAlertsLayerEnabled((value) => !value)}>
              <BellRing className="h-3.5 w-3.5 mr-1" />
              {tr("Alertes", "تنبيهات")}
            </Button>
          </div>
        </Card>
      </div>
      )}

      <CommandDialog open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen}>
        <CommandInput value={commandQuery} onValueChange={setCommandQuery} placeholder={tr("Rechercher véhicule ou action...", "ابحث عن مركبة أو إجراء...")} />
        <CommandList>
          <CommandEmpty>{tr("Aucun résultat", "لا توجد نتائج")}</CommandEmpty>
          <CommandGroup heading={tr("Véhicules", "المركبات")}>
            {commandResults.map((device) => (
              <CommandItem key={`cmd-vehicle-${device.id}`} onSelect={() => {
                setSelectedDeviceId(device.id);
                setPendingCenterDeviceId(device.id);
                setCommandPaletteOpen(false);
              }}>
                {device.name}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading={tr("Actions", "الإجراءات")}>
            <CommandItem onSelect={() => { setMinimalUiMode((value) => !value); setCommandPaletteOpen(false); }}>
              {minimalUiMode ? tr("Activer vue complète", "تفعيل العرض الكامل") : tr("Activer vue carte pure", "تفعيل عرض الخريطة فقط")}
            </CommandItem>
            <CommandItem onSelect={() => { setSmartFocusEnabled((value) => !value); setCommandPaletteOpen(false); }}>
              {smartFocusEnabled ? tr("Désactiver Smart Focus", "تعطيل التركيز الذكي") : tr("Activer Smart Focus", "تفعيل التركيز الذكي")}
            </CommandItem>
            <CommandItem onSelect={() => { setPanelMode((value) => value === "feed" ? "table" : "feed"); setCommandPaletteOpen(false); }}>
              {tr("Basculer Flux/Tableau", "تبديل التدفق/الجدول")}
            </CommandItem>
            <CommandItem onSelect={() => { applyLayerPreset("security"); setCommandPaletteOpen(false); }}>
              {tr("Appliquer le préréglage sécurité", "تطبيق ضبط الأمان")}
            </CommandItem>
            <CommandItem onSelect={() => { applyLayerPreset("focus"); setCommandPaletteOpen(false); }}>
              {tr("Appliquer le préréglage carte focus", "تطبيق ضبط خريطة التركيز")}
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      {connectionState !== "online" && (
        <Alert className="absolute left-5 bottom-36 z-[720] w-[420px] border-amber-300 bg-amber-50 text-amber-900 py-2">
          <AlertTitle className="text-xs font-bold text-amber-800">{tr("État de la connexion", "حالة الاتصال")}</AlertTitle>
          <AlertDescription className="text-xs">
            {connectionState === "retrying" ? tr(`Nouvel essai dans ${Math.max(1, Math.round((retryInMs ?? 1000) / 1000))}s`, `إعادة المحاولة خلال ${Math.max(1, Math.round((retryInMs ?? 1000) / 1000))}ث`) : tr("Mode hors ligne actif, reprise automatique en cours", "وضع عدم الاتصال نشط، الاستعادة التلقائية جارية")}
          </AlertDescription>
        </Alert>
      )}

      {recordingStatus && (
        <Alert className="absolute left-5 bottom-24 z-[720] w-[420px] bg-blue-50 border-blue-200 text-blue-900 py-2">
          <AlertTitle className="text-xs font-bold text-blue-700">{tr("Enregistrement du suivi", "تسجيل التتبع")}</AlertTitle>
          <AlertDescription className="text-xs">{recordingStatus}</AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert className="absolute right-5 bottom-24 z-[720] w-[420px] bg-blue-50 border-blue-200 text-blue-800 py-2">
          <ShieldAlert className="h-4 w-4 text-blue-600" />
          <AlertTitle className="text-xs font-bold text-blue-700">{tr("Erreur", "خطأ")}</AlertTitle>
          <AlertDescription className="text-xs">{error}</AlertDescription>
        </Alert>
      )}
      {recordedVideoUrl && (
        <Card className="absolute right-5 top-28 z-[720] w-[360px] p-3">
          <div className="text-xs font-semibold mb-2">{tr("Lecture vidéo suivi", "تشغيل فيديو التتبع")}</div>
          <video src={recordedVideoUrl} controls className="w-full rounded-lg border" />
        </Card>
      )}
    </div>
  );
};

export default LiveMap;
