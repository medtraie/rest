import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ArrowRightLeft, Clock3, Route, Truck, Flame, RefreshCw, Gauge, Factory, Warehouse, PencilLine, Maximize2, Minimize2, Plus, FileText, CheckCircle2 } from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap, useMapEvents, ZoomControl } from "react-leaflet";
import L from "leaflet";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabaseClient";
import { kvGet, kvSet } from "@/lib/kv";
import { useLanguage } from "@/contexts/LanguageContext";
import jsPDF from "jspdf";
import "jspdf-autotable";
import "leaflet/dist/leaflet.css";

type GpsDevice = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  speed: number;
  status: string;
  moving: boolean;
  timestamp: string;
  plate: string;
  driver: string;
};

type TracePoint = { lat: number; lng: number; at: number };
type Zone = { lat: number; lng: number; radius: number; name: string; color: string };
type ZoneTarget = "none" | "usine" | "depot";

type TransferMission = {
  id: string;
  deviceId: string;
  operationId: string;
  blReference: string;
  status: "en_cours" | "arrive_usine" | "termine";
  startTime: number;
  arrivalTime?: number;
  expenses?: number;
  distanceKm?: number;
  cost?: number;
  gasoilCost?: number;
  driverName?: string;
  plate?: string;
};

const TRANSFER_ZONES_KEY = "transfer-live:zones:v1";
const TRANSFER_MISSIONS_KEY = "transfer-live:missions:v1";

const toRad = (value: number) => (value * Math.PI) / 180;
const haversineKm = (a: [number, number], b: [number, number]) => {
  const R = 6371;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
};

const isInside = (lat: number, lng: number, zone: Zone | null) => !!zone && haversineKm([lat, lng], [zone.lat, zone.lng]) * 1000 <= zone.radius;

const markerIcon = (color: string) =>
  L.divIcon({
    className: "custom-marker",
    html: `<div style="background-color: ${color}; width: 18px; height: 18px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center;"><div style="width: 6px; height: 6px; background: white; border-radius: 50%;"></div></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });

const DEFAULT_USINE_ZONE: Zone = { lat: 33.5806, lng: -7.6136, radius: 1200, name: "Usine Centrale", color: "#2563eb" };
const DEFAULT_DEPOT_ZONE: Zone = { lat: 33.5333, lng: -7.5833, radius: 1000, name: "Dépôt Principal", color: "#16a34a" };

const ZoneDrawLayer = ({
  drawTarget,
  onPick,
}: {
  drawTarget: ZoneTarget;
  onPick: (lat: number, lng: number) => void;
}) => {
  useMapEvents({
    click(event) {
      if (drawTarget === "none") return;
      onPick(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
};

const MapResizeSync = ({ fullscreen }: { fullscreen: boolean }) => {
  const map = useMap();
  useEffect(() => {
    const t1 = window.setTimeout(() => map.invalidateSize(), 40);
    const t2 = window.setTimeout(() => map.invalidateSize(), 220);
    const t3 = window.setTimeout(() => map.invalidateSize(), 520);
    const t4 = window.setTimeout(() => map.invalidateSize(), 900);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      window.clearTimeout(t4);
    };
  }, [fullscreen, map]);
  return null;
};

const MapFocusSync = ({ target, targetId, zoom }: { target: [number, number] | null; targetId?: string; zoom?: number }) => {
  const map = useMap();
  const lastTargetId = useRef<string | null>(null);

  useEffect(() => {
    if (!target || !targetId) return;
    if (lastTargetId.current === targetId) return; // Only fly when selecting a new vehicle
    
    lastTargetId.current = targetId;
    map.flyTo(target, zoom ?? Math.max(map.getZoom(), 12), { duration: 0.6 });
  }, [map, target, targetId, zoom]);
  
  return null;
};

const TransferLiveStudio = () => {
  const { language } = useLanguage();
  const tr = useCallback((fr: string, ar: string) => (language === "ar" ? ar : fr), [language]);
  const [devices, setDevices] = useState<GpsDevice[]>([]);
  const [traceHistory, setTraceHistory] = useState<Record<string, TracePoint[]>>({});
  const [selectedId, setSelectedId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [refreshMs, setRefreshMs] = useState("30000");
  const [costPerKm, setCostPerKm] = useState(6.5);
  const [showHeatZones, setShowHeatZones] = useState(true);
  const [lastUpdate, setLastUpdate] = useState("");
  const [drawTarget, setDrawTarget] = useState<ZoneTarget>("none");
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);
  const [usineZone, setUsineZone] = useState<Zone | null>(DEFAULT_USINE_ZONE);
  const [depotZone, setDepotZone] = useState<Zone | null>(DEFAULT_DEPOT_ZONE);
  const [missions, setMissions] = useState<TransferMission[]>([]);
  const [showNewTransferModal, setShowNewTransferModal] = useState(false);
  const [pendingOperations, setPendingOperations] = useState<any[]>([]);
  const [newTransferForm, setNewTransferForm] = useState({ deviceId: "", operationId: "" });
  const [arrivedMissionToConfirm, setArrivedMissionToConfirm] = useState<TransferMission | null>(null);
  const [expensesInput, setExpensesInput] = useState("");
  const [isSimulating, setIsSimulating] = useState(false);
  const simulationRef = useRef<{ timer: number | null, step: number }>({ timer: null, step: 0 });
  const mapPanelRef = useRef<HTMLDivElement | null>(null);
  const colors = useMemo(() => ["#2563eb", "#0ea5e9", "#8b5cf6", "#22c55e", "#f59e0b", "#ef4444", "#14b8a6"], []);
  const zoneColorPresets = useMemo(() => ["#2563eb", "#16a34a", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"], []);

  const colorFor = useCallback((id: string) => {
    const hash = id.split("").reduce((sum, c) => sum + c.charCodeAt(0), 0);
    return colors[hash % colors.length];
  }, [colors]);

  const loadGpsData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("gpswox");
      if (invokeError) throw new Error(invokeError.message);
      const incoming = Array.isArray(data?.devices) ? data.devices : [];
      const mapped: GpsDevice[] = incoming
        .map((item: any) => {
          const lat = Number(item?.lat);
          const lng = Number(item?.lng);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
          return {
            id: String(item?.id ?? item?.device_id ?? item?.imei ?? crypto.randomUUID()),
            name: String(item?.name ?? "Véhicule"),
            lat,
            lng,
            speed: Number(item?.speed ?? 0) || 0,
            status: String(item?.status ?? "unknown"),
            moving: Boolean(item?.moving ?? Number(item?.speed ?? 0) > 0),
            timestamp: String(item?.timestamp ?? item?.time ?? new Date().toISOString()),
            plate: String(item?.plate ?? item?.matricule ?? ""),
            driver: String(item?.driver ?? ""),
          };
        })
        .filter(Boolean) as GpsDevice[];
      setDevices(mapped);
      setLastUpdate(new Date().toLocaleTimeString(language === "ar" ? "ar-MA" : "fr-MA"));
      setTraceHistory((prev) => {
        const next: Record<string, TracePoint[]> = { ...prev };
        const ids = new Set(mapped.map((d) => d.id));
        Object.keys(next).forEach((id) => {
          if (!ids.has(id)) delete next[id];
        });
        mapped.forEach((device) => {
          const history = next[device.id] ? [...next[device.id]] : [];
          const last = history[history.length - 1];
          if (!last || Math.abs(last.lat - device.lat) > 0.000001 || Math.abs(last.lng - device.lng) > 0.000001) {
            history.push({ lat: device.lat, lng: device.lng, at: Date.now() });
          }
          next[device.id] = history.slice(-240);
        });
        return next;
      });
      if (!selectedId && mapped[0]) setSelectedId(mapped[0].id);
    } catch (e: any) {
      setError(String(e?.message || tr("Erreur de chargement GPS", "خطأ تحميل GPS")));
    } finally {
      setLoading(false);
    }
  }, [language, selectedId, tr]);

  useEffect(() => {
    loadGpsData();
  }, [loadGpsData]);

  const loadPendingOperations = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('factory_operations')
        .select('*')
        .order('date', { ascending: false })
        .limit(50);
      if (!error && data) {
        setPendingOperations(data.filter((op: any) => !op.receivedBottles || op.receivedBottles.length === 0));
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const saved = await kvGet<{ usine?: Zone | null; depot?: Zone | null }>(TRANSFER_ZONES_KEY);
        if (saved && "usine" in saved) setUsineZone(saved.usine ? { ...saved.usine, color: saved.usine.color || DEFAULT_USINE_ZONE.color } : null);
        if (saved && "depot" in saved) setDepotZone(saved.depot ? { ...saved.depot, color: saved.depot.color || DEFAULT_DEPOT_ZONE.color } : null);
      } catch {}
    })();

    (async () => {
      try {
        const savedMissions = await kvGet<TransferMission[]>(TRANSFER_MISSIONS_KEY);
        if (Array.isArray(savedMissions)) setMissions(savedMissions);
      } catch {}
    })();

    loadPendingOperations();
  }, [loadPendingOperations]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      kvSet(TRANSFER_ZONES_KEY, { usine: usineZone, depot: depotZone }).catch(() => {});
    }, 250);
    return () => window.clearTimeout(timer);
  }, [depotZone, usineZone]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      kvSet(TRANSFER_MISSIONS_KEY, missions).catch(() => {});
    }, 250);
    return () => window.clearTimeout(timer);
  }, [missions]);

  useEffect(() => {
    if (isSimulating) return; // Disable standard polling during simulation
    const interval = window.setInterval(loadGpsData, Math.max(10000, Number(refreshMs) || 30000));
    return () => window.clearInterval(interval);
  }, [loadGpsData, refreshMs, isSimulating]);

  useEffect(() => {
    return () => {
      if (simulationRef.current.timer) {
        window.clearTimeout(simulationRef.current.timer);
      }
    };
  }, []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    if (isMapFullscreen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = prev || "";
    }
    return () => {
      document.body.style.overflow = prev || "";
    };
  }, [isMapFullscreen]);

  const transferRows = useMemo(() => {
    return devices.map((device) => {
      const activeMission = missions.find((m) => m.deviceId === device.id && m.status !== "termine");
      const path = traceHistory[device.id] || [];
      
      let distanceKm = 0;
      let relevantPath = path;
      
      // If we have an active mission, calculate distance from the start time of the mission
      if (activeMission) {
        relevantPath = path.filter((p) => p.at >= activeMission.startTime);
      }
      
      for (let i = 1; i < relevantPath.length; i += 1) {
        distanceKm += haversineKm([relevantPath[i - 1].lat, relevantPath[i - 1].lng], [relevantPath[i].lat, relevantPath[i].lng]);
      }
      
      let departureAt: number | null = activeMission ? activeMission.startTime : null;
      let arrivedAt: number | null = activeMission?.arrivalTime || null;
      
      if (!activeMission) {
        for (let i = 1; i < path.length; i += 1) {
          const prevInsideUsine = isInside(path[i - 1].lat, path[i - 1].lng, usineZone);
          const currInsideUsine = isInside(path[i].lat, path[i].lng, usineZone);
          const currInsideDepot = isInside(path[i].lat, path[i].lng, depotZone);
          if (departureAt === null && prevInsideUsine && !currInsideUsine) departureAt = path[i].at;
          if (departureAt !== null && currInsideDepot) {
            arrivedAt = path[i].at;
            break;
          }
        }
      }

      const now = Date.now();
      const durationMinutes = departureAt ? Math.max(1, Math.round(((arrivedAt || now) - departureAt) / 60000)) : 0;
      const cost = distanceKm * costPerKm;
      
      let status = tr("En transfert", "في التحويل");
      if (activeMission) {
        if (activeMission.status === "arrive_usine") {
          status = tr("Arrivé à l'usine", "وصل للمصنع");
        } else if (isInside(device.lat, device.lng, usineZone)) {
          // It just arrived!
          status = tr("Arrivé à l'usine", "وصل للمصنع");
        }
      } else {
        status = arrivedAt
          ? tr("Livrée", "تم التسليم")
          : isInside(device.lat, device.lng, usineZone)
          ? tr("En usine", "داخل المصنع")
          : isInside(device.lat, device.lng, depotZone)
          ? tr("Au dépôt", "داخل المستودع")
          : tr("En transfert", "في التحويل");
      }

      return {
        id: device.id,
        name: device.name,
        plate: device.plate || "-",
        driver: activeMission?.driverName || device.driver || tr("Non assigné", "غير معين"),
        speed: Math.round(device.speed),
        currentLat: device.lat,
        currentLng: device.lng,
        distanceKm,
        durationMinutes,
        cost,
        status,
        path: relevantPath,
        mission: activeMission,
      };
    });
  }, [costPerKm, depotZone, devices, traceHistory, tr, usineZone, missions]);

  const activeTransfers = transferRows.filter((row) => row.status === tr("En transfert", "في التحويل")).length;
  const totalCost = transferRows.reduce((sum, row) => sum + row.cost, 0);

  const heatZones = useMemo(() => {
    const buckets: Record<string, { lat: number; lng: number; count: number }> = {};
    Object.values(traceHistory).forEach((points) => {
      points.slice(-40).forEach((p) => {
        const key = `${p.lat.toFixed(2)}_${p.lng.toFixed(2)}`;
        if (!buckets[key]) buckets[key] = { lat: p.lat, lng: p.lng, count: 0 };
        buckets[key].count += 1;
      });
    });
    return Object.values(buckets).filter((b) => b.count >= 3);
  }, [traceHistory]);

  const selectedTransfer = transferRows.find((row) => row.id === selectedId) || transferRows[0] || null;
  const mapCenter: [number, number] = selectedTransfer?.path?.length
    ? [selectedTransfer.path[selectedTransfer.path.length - 1].lat, selectedTransfer.path[selectedTransfer.path.length - 1].lng]
    : [33.5731, -7.5898];
  const selectedMapPoint: [number, number] | null = selectedTransfer
    ? (selectedTransfer.path.length > 0
      ? [selectedTransfer.path[selectedTransfer.path.length - 1].lat, selectedTransfer.path[selectedTransfer.path.length - 1].lng]
      : [selectedTransfer.currentLat, selectedTransfer.currentLng])
    : null;
  const pickZonePoint = useCallback((lat: number, lng: number) => {
    if (drawTarget === "usine") {
      setUsineZone((prev) => ({ ...(prev ?? DEFAULT_USINE_ZONE), lat, lng }));
    }
    if (drawTarget === "depot") {
      setDepotZone((prev) => ({ ...(prev ?? DEFAULT_DEPOT_ZONE), lat, lng }));
    }
    setDrawTarget("none");
  }, [drawTarget]);
  const toggleMapFullscreen = useCallback(() => {
    setIsMapFullscreen((value) => !value);
  }, []);
  const setZoneColor = useCallback((zone: ZoneTarget, color: string) => {
    if (zone === "usine") setUsineZone((prev) => prev ? ({ ...prev, color }) : prev);
    if (zone === "depot") setDepotZone((prev) => prev ? ({ ...prev, color }) : prev);
  }, []);

  const runSimulationStep = useCallback(() => {
    if (!usineZone || !depotZone) return;
    
    setDevices(prev => prev.map(d => {
      // Find mission for this device
      const activeMission = missions.find(m => m.deviceId === d.id && m.status !== "termine");
      if (!activeMission) return d;
      
      // Move towards Usine
      const stepSize = 0.003; // About 300m
      const dx = usineZone.lng - d.lng;
      const dy = usineZone.lat - d.lat;
      const dist = Math.sqrt(dx*dx + dy*dy);
      
      let nextLng = d.lng;
      let nextLat = d.lat;
      let nextSpeed = d.speed;
      
      if (dist > 0.002) { // Still far from center
        nextLng += (dx / dist) * stepSize;
        nextLat += (dy / dist) * stepSize;
        nextSpeed = 60 + Math.random() * 20; // 60-80 km/h
      } else {
        nextSpeed = 0; // Arrived
      }
      
      // Update trace
      setTraceHistory(hist => {
        const h = hist[d.id] ? [...hist[d.id]] : [];
        h.push({ lat: nextLat, lng: nextLng, at: Date.now() });
        return { ...hist, [d.id]: h.slice(-240) };
      });
      
      return {
        ...d,
        lat: nextLat,
        lng: nextLng,
        speed: nextSpeed,
      };
    }));
    
    simulationRef.current.timer = window.setTimeout(runSimulationStep, 2000); // Update every 2s
  }, [usineZone, depotZone, missions]);

  const toggleSimulation = useCallback(() => {
    if (isSimulating) {
      if (simulationRef.current.timer) {
        window.clearTimeout(simulationRef.current.timer);
      }
      setIsSimulating(false);
      loadGpsData(); // Reset real data
    } else {
      setIsSimulating(true);
      // Move all active mission devices to depot to start
      if (depotZone) {
        setDevices(prev => prev.map(d => {
          if (missions.some(m => m.deviceId === d.id && m.status !== "termine")) {
            return { ...d, lat: depotZone.lat, lng: depotZone.lng, speed: 0 };
          }
          return d;
        }));
      }
      simulationRef.current.timer = window.setTimeout(runSimulationStep, 1000);
    }
  }, [isSimulating, runSimulationStep, depotZone, missions, loadGpsData]);

  const handleStartTransfer = useCallback(() => {
    if (!newTransferForm.deviceId || !newTransferForm.operationId) return;
    const op = pendingOperations.find(o => String(o.id) === String(newTransferForm.operationId));
    const device = devices.find(d => d.id === newTransferForm.deviceId);
    if (!op || !device) return;

    const newMission: TransferMission = {
      id: crypto.randomUUID(),
      deviceId: device.id,
      operationId: op.id,
      blReference: op.blReference || `OP-${op.id}`,
      status: "en_cours",
      startTime: Date.now(),
      driverName: op.driverName || device.driver,
      plate: device.plate
    };

    setMissions(prev => [...prev.filter(m => m.deviceId !== device.id || m.status === "termine"), newMission]);
    setShowNewTransferModal(false);
    setNewTransferForm({ deviceId: "", operationId: "" });
  }, [newTransferForm, pendingOperations, devices]);

  const handleConfirmArrival = useCallback((mission: TransferMission) => {
    setArrivedMissionToConfirm(mission);
    setExpensesInput("");
  }, []);

  const submitArrival = useCallback(() => {
    if (!arrivedMissionToConfirm) return;
    const exp = Number(expensesInput) || 0;
    const relatedRow = transferRows.find(r => r.mission?.id === arrivedMissionToConfirm.id);
    const distanceKm = relatedRow?.distanceKm || 0;
    const cost = distanceKm * costPerKm;

    setMissions(prev => prev.map(m => {
      if (m.id === arrivedMissionToConfirm.id) {
        return {
          ...m,
          status: "termine",
          arrivalTime: Date.now(),
          expenses: exp,
          distanceKm,
          cost: cost + exp,
          gasoilCost: cost
        };
      }
      return m;
    }));
    
    // Auto generate PDF
    generateMissionPDF({
      ...arrivedMissionToConfirm,
      arrivalTime: Date.now(),
      expenses: exp,
      distanceKm,
      cost: cost + exp,
      gasoilCost: cost
    });

    setArrivedMissionToConfirm(null);
    
    // Reset simulation device position if needed
    if (isSimulating && depotZone) {
       setDevices(prev => prev.map(d => d.id === arrivedMissionToConfirm.deviceId ? { ...d, lat: depotZone.lat, lng: depotZone.lng, speed: 0 } : d));
    }
  }, [arrivedMissionToConfirm, expensesInput, transferRows, costPerKm, isSimulating, depotZone]);

  const generateMissionPDF = (mission: TransferMission) => {
    try {
      const doc = new jsPDF();
      const primaryColor = [79, 70, 229];
      
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(0, 0, 210, 45, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(28);
      doc.setFont('helvetica', 'bold');
      doc.text("SFT GAZ", 14, 25);
      
      doc.setFontSize(16);
      doc.text("RAPPORT DE TRANSFERT", 196, 25, { align: 'right' });
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`BL: ${mission.blReference}`, 196, 32, { align: 'right' });

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text("Détails du trajet", 14, 60);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Véhicule / Matricule : ${mission.plate || mission.deviceId}`, 14, 70);
      doc.text(`Chauffeur : ${mission.driverName || '-'}`, 14, 78);
      doc.text(`Départ : Dépôt (${new Date(mission.startTime).toLocaleString('fr-FR')})`, 14, 86);
      doc.text(`Arrivée : Usine (${mission.arrivalTime ? new Date(mission.arrivalTime).toLocaleString('fr-FR') : '-'})`, 14, 94);
      
      const durationMins = mission.arrivalTime ? Math.round((mission.arrivalTime - mission.startTime) / 60000) : 0;
      doc.text(`Durée : ${durationMins} minutes`, 14, 102);
      doc.text(`Distance parcourue : ${(mission.distanceKm || 0).toFixed(1)} km`, 14, 110);
      
      doc.setFont('helvetica', 'bold');
      doc.text("Frais et coûts", 14, 125);
      doc.setFont('helvetica', 'normal');
      doc.text(`Coût Gasoil estimé : ${Math.round(mission.gasoilCost || 0)} DH`, 14, 135);
      doc.text(`Dépenses additionnelles : ${mission.expenses || 0} DH`, 14, 143);
      
      doc.setFont('helvetica', 'bold');
      doc.text(`Coût Total : ${Math.round(mission.cost || 0)} DH`, 14, 155);

      doc.save(`Transfert_${mission.blReference}_${Date.now()}.pdf`);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <Card className="border-none shadow-none bg-transparent overflow-hidden">
        <CardHeader className="pb-3 px-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-2xl font-black text-slate-900 flex items-center gap-3">
                <div className="p-2.5 bg-indigo-600 rounded-2xl shadow-sm shadow-indigo-200">
                  <ArrowRightLeft className="w-6 h-6 text-white" />
                </div>
                {tr("Transfert Live Studio", "استوديو التحويل المباشر")}
              </CardTitle>
              <p className="text-slate-500 mt-2 ml-1 text-sm">{tr("Suivi et gestion en temps réel des flottes et des missions", "تتبع وإدارة الأساطيل والمهام في الوقت الفعلي")}</p>
            </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-indigo-100 text-indigo-700 border-none">{tr("Google Maps", "خرائط جوجل")}</Badge>
            <Button size="sm" variant={isSimulating ? "default" : "outline"} className={isSimulating ? "bg-amber-500 hover:bg-amber-600 text-white" : "text-amber-600 border-amber-200 hover:bg-amber-50"} onClick={toggleSimulation}>
              <Route className={`w-4 h-4 mr-1.5 ${isSimulating ? "animate-pulse" : ""}`} />
              {isSimulating ? tr("Arrêter Simulation", "إيقاف المحاكاة") : tr("Simuler Trajet", "محاكاة الرحلة")}
            </Button>
            <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => setShowNewTransferModal(true)}>
              <Plus className="w-4 h-4 mr-1.5" />
              {tr("Nouveau transfert", "تحويل جديد")}
            </Button>
            <Button size="sm" variant="outline" onClick={loadGpsData}>
              <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
              {tr("Actualiser", "تحديث")}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-4">
          {[
            { key: "fleet", icon: Truck, label: tr("Véhicules suivis", "المركبات المتتبعة"), value: devices.length, className: "bg-gradient-to-br from-blue-50 to-blue-100/50 text-blue-700 border-blue-200/60 shadow-sm" },
            { key: "active", icon: Route, label: tr("Missions actives", "المهام النشطة"), value: activeTransfers, className: "bg-gradient-to-br from-amber-50 to-amber-100/50 text-amber-700 border-amber-200/60 shadow-sm" },
            { key: "cost", icon: Gauge, label: tr("Coût estimé", "التكلفة التقديرية"), value: `${Math.round(totalCost).toLocaleString()} DH`, className: "bg-gradient-to-br from-emerald-50 to-emerald-100/50 text-emerald-700 border-emerald-200/60 shadow-sm" },
            { key: "time", icon: Clock3, label: tr("Dernière sync", "آخر مزامنة"), value: lastUpdate || "--:--", className: "bg-gradient-to-br from-indigo-50 to-indigo-100/50 text-indigo-700 border-indigo-200/60 shadow-sm" },
          ].map((metric, index) => (
            <motion.div
              key={metric.key}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: index * 0.05 }}
              className={`rounded-3xl border p-4 transition-all hover:shadow-md ${metric.className}`}
            >
              <div className="flex items-center justify-between">
                <div className="p-2.5 bg-white/60 rounded-xl shadow-sm border border-white/40">
                  <metric.icon className="w-5 h-5" />
                </div>
                <span className="text-xl font-black">{metric.value}</span>
              </div>
              <p className="mt-3 text-[11px] font-bold uppercase tracking-wider opacity-80">{metric.label}</p>
            </motion.div>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr,380px]">
          <div
            ref={mapPanelRef}
            className={`${isMapFullscreen ? "fixed inset-0 z-[9999] bg-slate-900" : "relative rounded-3xl border border-slate-200/60 overflow-hidden h-[500px] shadow-sm"}`}
          >
            <div className={`absolute ${isMapFullscreen ? "top-5 right-5" : "top-4 right-4"} z-[1200]`}>
              <Button size="sm" variant="outline" className="bg-white/90 backdrop-blur-md border-slate-200 shadow-sm hover:bg-white" onClick={toggleMapFullscreen}>
                {isMapFullscreen ? <Minimize2 className="w-4 h-4 mr-1.5" /> : <Maximize2 className="w-4 h-4 mr-1.5" />}
                {isMapFullscreen ? tr("Quitter plein écran", "الخروج من ملء الشاشة") : tr("Plein écran", "ملء الشاشة")}
              </Button>
            </div>
            <MapContainer
              center={mapCenter}
              zoom={10}
              className="w-full h-full z-0 transition-all duration-500 ease-in-out"
              zoomControl={false}
            >
              <ZoomControl position="bottomright" />
              <MapResizeSync fullscreen={isMapFullscreen} />
              <MapFocusSync target={selectedMapPoint} targetId={selectedId} />
              <ZoneDrawLayer drawTarget={drawTarget} onPick={pickZonePoint} />
              <TileLayer
                attribution={mapThemes.googleRoad.attribution}
                url={mapThemes.googleRoad.url}
              />
              {usineZone && (
                <Circle center={[usineZone.lat, usineZone.lng]} radius={usineZone.radius} pathOptions={{ color: usineZone.color, fillColor: usineZone.color, fillOpacity: 0.08, weight: 2 }} />
              )}
              {depotZone && (
                <Circle center={[depotZone.lat, depotZone.lng]} radius={depotZone.radius} pathOptions={{ color: depotZone.color, fillColor: depotZone.color, fillOpacity: 0.08, weight: 2 }} />
              )}
              {showHeatZones && heatZones.map((z, idx) => (
                <Circle
                  key={`heat-${idx}`}
                  center={[z.lat, z.lng]}
                  radius={Math.min(1800, 250 + z.count * 60)}
                  pathOptions={{ color: "#f59e0b", fillColor: "#f59e0b", fillOpacity: 0.16, weight: 1 }}
                />
              ))}
              {transferRows.map((row) => (
                <React.Fragment key={row.id}>
                  {row.path.length > 1 && (
                    <Polyline positions={row.path.map((p) => [p.lat, p.lng] as [number, number])} pathOptions={{ color: colorFor(row.id), weight: selectedId === row.id ? 5 : 3, opacity: selectedId === row.id ? 0.95 : 0.4, dashArray: isSimulating ? "8, 12" : undefined }} className={isSimulating && row.mission ? "animate-pulse" : ""} />
                  )}
                  <Marker position={[row.path[row.path.length - 1]?.lat ?? row.currentLat, row.path[row.path.length - 1]?.lng ?? row.currentLng]} icon={markerIcon(colorFor(row.id))}>
                    <Popup>
                      <div className="text-xs space-y-1">
                        <p className="font-bold">{row.name}</p>
                        <p>{tr("Statut", "الحالة")}: {row.status}</p>
                        <p>{tr("Distance", "المسافة")}: {row.distanceKm.toFixed(1)} km</p>
                        <p>{tr("Durée", "المدة")}: {row.durationMinutes} min</p>
                        <p>{tr("Coût", "التكلفة")}: {Math.round(row.cost).toLocaleString()} DH</p>
                      </div>
                    </Popup>
                  </Marker>
                </React.Fragment>
              ))}
              {usineZone && (
                <Marker
                  position={[usineZone.lat, usineZone.lng]}
                  icon={markerIcon(usineZone.color)}
                  draggable
                  eventHandlers={{
                    dragend: (event) => {
                      const ll = (event.target as L.Marker).getLatLng();
                      setUsineZone((prev) => prev ? { ...prev, lat: ll.lat, lng: ll.lng } : prev);
                    },
                  }}
                >
                  <Popup>{tr("Zone usine", "منطقة المصنع")} - {usineZone.name}</Popup>
                </Marker>
              )}
              {depotZone && (
                <Marker
                  position={[depotZone.lat, depotZone.lng]}
                  icon={markerIcon(depotZone.color)}
                  draggable
                  eventHandlers={{
                    dragend: (event) => {
                      const ll = (event.target as L.Marker).getLatLng();
                      setDepotZone((prev) => prev ? { ...prev, lat: ll.lat, lng: ll.lng } : prev);
                    },
                  }}
                >
                  <Popup>{tr("Zone dépôt", "منطقة المستودع")} - {depotZone.name}</Popup>
                </Marker>
              )}
            </MapContainer>
          </div>

          <div className="flex flex-col gap-4">
            <Card className="border border-slate-200/60 shadow-sm rounded-3xl overflow-hidden bg-white">
              <div className="p-4 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-white rounded-xl shadow-sm border border-slate-200/50 text-slate-500">
                    <Route className="w-4 h-4" />
                  </div>
                  <p className="text-sm font-bold text-slate-800">{tr("Missions actives", "المهام النشطة")}</p>
                </div>
                <Badge variant="secondary" className="bg-indigo-100 text-indigo-700 hover:bg-indigo-200">{activeTransfers}</Badge>
              </div>
              <div className="p-3">
                <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1 custom-scrollbar">
                  {transferRows.filter(r => r.status !== tr("Livrée", "تم التسليم")).length === 0 && (
                    <div className="text-center py-6 text-slate-400 text-xs">
                      {tr("Aucune mission en cours", "لا توجد مهام نشطة")}
                    </div>
                  )}
                  {transferRows.filter(r => r.status !== tr("Livrée", "تم التسليم")).map((row) => (
                    <motion.button 
                      key={row.id} 
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      type="button" 
                      onClick={() => setSelectedId(row.id)} 
                      className={`w-full relative overflow-hidden rounded-2xl border p-3 text-left transition-all duration-300 ${selectedId === row.id ? "border-indigo-300 bg-indigo-50/80 shadow-md shadow-indigo-100/50 ring-1 ring-indigo-200" : "border-slate-200/60 bg-white hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm"}`}
                    >
                      {selectedId === row.id && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 rounded-l-2xl" />
                      )}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`w-2 h-2 rounded-full shrink-0 ${row.status === tr("En transfert", "في التحويل") ? "bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.6)]" : row.status === tr("Arrivé à l'usine", "وصل للمصنع") ? "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" : "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"}`} />
                          <span className="text-sm font-bold text-slate-800 truncate">{row.name}</span>
                        </div>
                        <span className="text-[10px] font-mono font-medium px-2 py-1 rounded-lg bg-white border border-slate-200/60 shadow-sm shrink-0">{row.speed} km/h</span>
                      </div>
                      
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <div className="flex items-center gap-1.5">
                          <span className={`font-semibold ${row.status === tr("En transfert", "في التحويل") ? "text-amber-600" : row.status === tr("Arrivé à l'usine", "وصل للمصنع") ? "text-blue-600" : "text-emerald-600"}`}>
                            {row.status}
                          </span>
                          {row.mission?.blReference && (
                            <>
                              <span className="text-slate-300">•</span>
                              <span className="font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded-md">{row.mission.blReference}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-4 pt-3 border-t border-slate-200/50">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider">{tr("Distance", "المسافة")}</span>
                          <span className="text-xs font-semibold text-slate-700">{row.distanceKm.toFixed(1)} km</span>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider">{tr("Coût est.", "التكلفة")}</span>
                          <span className="text-xs font-bold text-emerald-600">{Math.round(row.cost)} DH</span>
                        </div>
                      </div>

                      {row.mission && row.status === tr("Arrivé à l'usine", "وصل للمصنع") && (
                        <Button 
                          size="sm" 
                          className="w-full mt-3 h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-200 transition-all hover:shadow-md" 
                          onClick={(e) => { e.stopPropagation(); handleConfirmArrival(row.mission!); }}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                          {tr("Confirmer l'arrivée", "تأكيد الوصول")}
                        </Button>
                      )}
                    </motion.button>
                  ))}
                </div>
              </div>
            </Card>

            <Card className="border border-slate-200/60 shadow-sm rounded-3xl overflow-hidden bg-white">
              <div className="p-3 bg-slate-50/80 border-b border-slate-100 flex items-center gap-2 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => setDrawTarget(drawTarget === "none" ? "usine" : "none")}>
                <div className="p-1.5 bg-white rounded-lg shadow-sm border border-slate-200/50 text-slate-500">
                  <PencilLine className="w-3.5 h-3.5" />
                </div>
                <p className="text-xs font-bold text-slate-700">{tr("Configuration des zones", "إعدادات المناطق")}</p>
              </div>
              
              {drawTarget !== "none" && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  className="p-4 space-y-3 bg-slate-50/30"
                >
                  <div className="grid grid-cols-2 gap-2">
                    <Button size="sm" variant={drawTarget === "usine" ? "default" : "outline"} className={`justify-start h-9 ${drawTarget === "usine" ? "bg-indigo-600 hover:bg-indigo-700 text-white" : ""}`} onClick={() => setDrawTarget("usine")}>
                      <Factory className="w-4 h-4 mr-1.5 shrink-0" />
                      <span className="truncate">{tr("Usine", "مصنع")}</span>
                    </Button>
                    <Button size="sm" variant={drawTarget === "depot" ? "default" : "outline"} className={`justify-start h-9 ${drawTarget === "depot" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}`} onClick={() => setDrawTarget("depot")}>
                      <Warehouse className="w-4 h-4 mr-1.5 shrink-0" />
                      <span className="truncate">{tr("Dépôt", "مستودع")}</span>
                    </Button>
                    <Button size="sm" variant="outline" className="justify-start h-8 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200" onClick={() => setUsineZone(null)}>
                      {tr("Effacer Usine", "مسح المصنع")}
                    </Button>
                    <Button size="sm" variant="outline" className="justify-start h-8 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200" onClick={() => setDepotZone(null)}>
                      {tr("Effacer Dépôt", "مسح المستودع")}
                    </Button>
                  </div>
                  
                  <div className="pt-2 border-t border-slate-200/60 grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-[10px] uppercase text-slate-500 font-bold mb-1 block">{tr("Coût par km", "تكلفة كم")}</Label>
                      <div className="relative">
                        <Input type="number" className="h-8 text-xs pr-8 bg-white" value={costPerKm} onChange={(e) => setCostPerKm(Number(e.target.value) || 0)} />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">DH</span>
                      </div>
                    </div>
                    <div>
                      <Label className="text-[10px] uppercase text-slate-500 font-bold mb-1 block">{tr("Actualisation", "التحديث")}</Label>
                      <Select value={refreshMs} onValueChange={setRefreshMs}>
                        <SelectTrigger className="h-8 text-xs bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10000" className="text-xs">10s</SelectItem>
                          <SelectItem value="30000" className="text-xs">30s</SelectItem>
                          <SelectItem value="60000" className="text-xs">60s</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Button size="sm" className="w-full bg-amber-500 hover:bg-amber-600 text-white" variant={showHeatZones ? "default" : "outline"} onClick={() => setShowHeatZones((value) => !value)}>
                    <Flame className="w-4 h-4 mr-1.5" />
                    {showHeatZones ? tr("Heat zones actives", "مناطق الحرارة مفعلة") : tr("Heat zones désactivées", "مناطق الحرارة متوقفة")}
                  </Button>

                  <div className="grid grid-cols-1 gap-3">
                    <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-bold text-slate-700">{tr("Zone Usine", "منطقة المصنع")}</p>
                        <div className="h-4 w-4 rounded-full border border-slate-300" style={{ backgroundColor: usineZone?.color || DEFAULT_USINE_ZONE.color }} />
                      </div>
                      <div className="grid grid-cols-[1fr,72px] gap-2">
                        <Input
                          type="number"
                          className="h-8 text-xs"
                          value={usineZone?.radius ?? ""}
                          onChange={(e) => setUsineZone((prev) => prev ? ({ ...prev, radius: Math.max(100, Number(e.target.value) || 100) }) : prev)}
                          placeholder={tr("Rayon (m)", "نصف القطر (م)")}
                          disabled={!usineZone}
                        />
                        <Input
                          type="color"
                          className="h-8 w-full p-1"
                          value={usineZone?.color ?? DEFAULT_USINE_ZONE.color}
                          onChange={(e) => setUsineZone((prev) => prev ? ({ ...prev, color: e.target.value }) : prev)}
                          disabled={!usineZone}
                        />
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {zoneColorPresets.map((preset) => (
                          <button
                            key={`u-${preset}`}
                            type="button"
                            onClick={() => setZoneColor("usine", preset)}
                            className={`h-5 w-5 rounded-full border ${usineZone?.color === preset ? "border-slate-900 ring-2 ring-slate-300" : "border-slate-300"}`}
                            style={{ backgroundColor: preset }}
                            disabled={!usineZone}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-bold text-slate-700">{tr("Zone Dépôt", "منطقة المستودع")}</p>
                        <div className="h-4 w-4 rounded-full border border-slate-300" style={{ backgroundColor: depotZone?.color || DEFAULT_DEPOT_ZONE.color }} />
                      </div>
                      <div className="grid grid-cols-[1fr,72px] gap-2">
                        <Input
                          type="number"
                          className="h-8 text-xs"
                          value={depotZone?.radius ?? ""}
                          onChange={(e) => setDepotZone((prev) => prev ? ({ ...prev, radius: Math.max(100, Number(e.target.value) || 100) }) : prev)}
                          placeholder={tr("Rayon (m)", "نصف القطر (م)")}
                          disabled={!depotZone}
                        />
                        <Input
                          type="color"
                          className="h-8 w-full p-1"
                          value={depotZone?.color ?? DEFAULT_DEPOT_ZONE.color}
                          onChange={(e) => setDepotZone((prev) => prev ? ({ ...prev, color: e.target.value }) : prev)}
                          disabled={!depotZone}
                        />
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {zoneColorPresets.map((preset) => (
                          <button
                            key={`d-${preset}`}
                            type="button"
                            onClick={() => setZoneColor("depot", preset)}
                            className={`h-5 w-5 rounded-full border ${depotZone?.color === preset ? "border-slate-900 ring-2 ring-slate-300" : "border-slate-300"}`}
                            style={{ backgroundColor: preset }}
                            disabled={!depotZone}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                    onClick={() => { setUsineZone(null); setDepotZone(null); setDrawTarget("none"); }}
                  >
                    {tr("Effacer zones", "مسح المناطق")}
                  </Button>
                </motion.div>
              )}
            </Card>
          </div>
        </div>

        {error && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700 shadow-sm flex items-center gap-3">
            <div className="p-2 bg-rose-100 rounded-full shrink-0">
              <Flame className="w-4 h-4 text-rose-600" />
            </div>
            {error}
          </motion.div>
        )}

        <Card className="rounded-3xl border border-slate-200/60 overflow-hidden bg-white shadow-sm">
          <div className="p-4 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-white rounded-xl shadow-sm border border-slate-200/50 text-slate-500">
                <FileText className="w-4 h-4" />
              </div>
              <p className="text-sm font-bold text-slate-800">{tr("Registre des transferts", "سجل التحويلات")}</p>
            </div>
          </div>
          <div className="max-h-[380px] overflow-auto custom-scrollbar">
          <table className="w-full text-sm">
            <thead className="bg-white sticky top-0 z-10 shadow-sm shadow-slate-100/50">
              <tr>
                <th className="px-5 py-3.5 text-left font-bold text-slate-500 uppercase tracking-wider text-[11px]">{tr("Véhicule", "المركبة")}</th>
                <th className="px-5 py-3.5 text-left font-bold text-slate-500 uppercase tracking-wider text-[11px]">{tr("Chauffeur", "السائق")}</th>
                <th className="px-5 py-3.5 text-left font-bold text-slate-500 uppercase tracking-wider text-[11px]">{tr("Statut", "الحالة")}</th>
                <th className="px-5 py-3.5 text-left font-bold text-slate-500 uppercase tracking-wider text-[11px]">{tr("Distance", "المسافة")}</th>
                <th className="px-5 py-3.5 text-left font-bold text-slate-500 uppercase tracking-wider text-[11px]">{tr("Durée", "المدة")}</th>
                <th className="px-5 py-3.5 text-left font-bold text-slate-500 uppercase tracking-wider text-[11px]">{tr("Coût est.", "التكلفة")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transferRows.slice(0, 20).map((row, index) => (
                <motion.tr 
                  key={row.id} 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.02 }}
                  className={`group hover:bg-slate-50/80 transition-colors cursor-pointer ${selectedId === row.id ? "bg-indigo-50/30" : ""}`}
                  onClick={() => setSelectedId(row.id)}
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-sm border border-slate-200/60 ${selectedId === row.id ? "bg-indigo-600 text-white" : "bg-white text-slate-600 group-hover:bg-slate-100"}`}>
                        <Truck className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-slate-800">{row.name}</div>
                        <div className="text-[11px] font-mono text-slate-500 mt-0.5">{row.plate}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className="font-medium text-slate-700">{row.driver}</span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`${row.status === tr("Livrée", "تم التسليم") ? "bg-emerald-50 text-emerald-700 border-emerald-200" : row.status === tr("Arrivé à l'usine", "وصل للمصنع") ? "bg-blue-50 text-blue-700 border-blue-200" : row.status === tr("En transfert", "في التحويل") ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-slate-50 text-slate-700 border-slate-200"} px-2.5 py-1 text-xs font-semibold`}>
                        {row.status}
                      </Badge>
                      {row.mission && row.status === tr("Arrivé à l'usine", "وصل للمصنع") && (
                        <Button size="sm" className="h-7 px-3 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm" onClick={(e) => { e.stopPropagation(); handleConfirmArrival(row.mission!); }}>
                          {tr("Confirmer", "تأكيد")}
                        </Button>
                      )}
                    </div>
                    {row.mission?.blReference && (
                      <div className="mt-1.5 text-[10px] font-mono text-slate-500 flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        BL: {row.mission.blReference}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <div className="font-bold text-slate-700">{row.distanceKm.toFixed(1)} <span className="text-xs font-normal text-slate-400">km</span></div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="font-bold text-slate-700">{row.durationMinutes} <span className="text-xs font-normal text-slate-400">min</span></div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="font-black text-emerald-600 bg-emerald-50/50 inline-block px-3 py-1.5 rounded-xl border border-emerald-100/50">
                      {Math.round(row.cost).toLocaleString()} <span className="text-xs font-bold text-emerald-500">DH</span>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
          </div>
        </Card>
      </CardContent>
    </Card>

      {/* New Transfer Modal */}
      <Dialog open={showNewTransferModal} onOpenChange={setShowNewTransferModal}>
        <DialogContent className="max-w-md border-none shadow-2xl rounded-2xl overflow-hidden p-0">
          <div className="bg-indigo-600 p-6 text-white text-left">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Route className="w-5 h-5" />
              {tr("Nouveau transfert (Dépôt → Usine)", "تحويل جديد (مستودع ← مصنع)")}
            </DialogTitle>
            <DialogDescription className="text-indigo-100 mt-1">
              {tr("Associez un véhicule à une opération d'envoi à l'usine.", "ربط مركبة بعملية إرسال للمصنع.")}
            </DialogDescription>
          </div>
          <div className="p-6 space-y-5 bg-white text-left">
            <div className="space-y-2">
              <Label className="text-sm font-bold text-slate-700">{tr("Véhicule", "المركبة")}</Label>
              <Select value={newTransferForm.deviceId} onValueChange={(val) => setNewTransferForm(prev => ({ ...prev, deviceId: val }))}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder={tr("Sélectionner un véhicule...", "اختر مركبة...")} />
                </SelectTrigger>
                <SelectContent>
                  {devices.map(d => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name} {d.plate ? `(${d.plate})` : ""} - {d.driver || "Sans chauffeur"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm font-bold text-slate-700">{tr("Référence BL (Envoi à l'Usine)", "مرجع BL (إرسال للمصنع)")}</Label>
              <Select value={newTransferForm.operationId} onValueChange={(val) => setNewTransferForm(prev => ({ ...prev, operationId: val }))}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder={tr("Sélectionner une opération...", "اختر عملية...")} />
                </SelectTrigger>
                <SelectContent>
                  {pendingOperations.length === 0 ? (
                    <SelectItem value="none" disabled>{tr("Aucune opération en attente", "لا توجد عمليات معلقة")}</SelectItem>
                  ) : (
                    pendingOperations.map(op => (
                      <SelectItem key={op.id} value={String(op.id)}>
                        {op.blReference || `OP-${op.id}`} - {op.driverName} ({new Date(op.date).toLocaleDateString()})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="p-4 bg-slate-50 border-t flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowNewTransferModal(false)}>{tr("Annuler", "إلغاء")}</Button>
            <Button className="bg-indigo-600 text-white hover:bg-indigo-700" onClick={handleStartTransfer} disabled={!newTransferForm.deviceId || !newTransferForm.operationId}>
              {tr("Démarrer le transfert", "بدء التحويل")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Arrival Modal */}
      <Dialog open={!!arrivedMissionToConfirm} onOpenChange={(open) => !open && setArrivedMissionToConfirm(null)}>
        <DialogContent className="max-w-sm border-none shadow-2xl rounded-2xl overflow-hidden p-0">
          <div className="bg-emerald-600 p-6 text-white text-left">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" />
              {tr("Véhicule arrivé à l'usine", "المركبة وصلت للمصنع")}
            </DialogTitle>
            <DialogDescription className="text-emerald-100 mt-1">
              {tr("Veuillez confirmer l'arrivée et saisir les dépenses éventuelles.", "يرجى تأكيد الوصول وإدخال المصاريف المحتملة.")}
            </DialogDescription>
          </div>
          <div className="p-6 space-y-4 bg-white text-left">
            <div className="rounded-xl bg-slate-50 p-3 border border-slate-100 space-y-1 text-sm text-slate-600">
              <p><strong>BL :</strong> {arrivedMissionToConfirm?.blReference}</p>
              <p><strong>Chauffeur :</strong> {arrivedMissionToConfirm?.driverName}</p>
              <p><strong>Distance :</strong> {transferRows.find(r => r.mission?.id === arrivedMissionToConfirm?.id)?.distanceKm.toFixed(1)} km</p>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-bold text-slate-700">{tr("Dépenses additionnelles (DH)", "مصاريف إضافية (درهم)")}</Label>
              <Input 
                type="number" 
                value={expensesInput} 
                onChange={(e) => setExpensesInput(e.target.value)} 
                placeholder="0.00"
                className="h-11 text-lg font-semibold"
              />
            </div>
          </div>
          <div className="p-4 bg-slate-50 border-t flex justify-end gap-2">
            <Button variant="outline" onClick={() => setArrivedMissionToConfirm(null)}>{tr("Annuler", "إلغاء")}</Button>
            <Button className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={submitArrival}>
              {tr("Confirmer l'arrivée", "تأكيد الوصول")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

const mapThemes = {
  googleRoad: {
    label: "Google Maps",
    url: `https://mt1.google.com/vt/lyrs=r&x={x}&y={y}&z={z}${import.meta.env.VITE_GOOGLE_MAPS_API_KEY ? `&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}` : ""}${import.meta.env.VITE_GOOGLE_MAPS_REGION ? `&region=${import.meta.env.VITE_GOOGLE_MAPS_REGION}` : ""}`,
    attribution: "&copy; Google",
  },
};

export default TransferLiveStudio;
