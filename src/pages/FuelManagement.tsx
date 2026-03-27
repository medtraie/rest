import { useState, useMemo, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApp } from "@/contexts/AppContext";
import { FuelPurchase, FuelConsumption, FuelDrain } from "@/types";
import { format } from "date-fns";
import React from "react";
import OilManagement from "./OilManagement";
import { useLanguage, useT } from "@/contexts/LanguageContext";
import { kvGet, kvSet } from "@/lib/kv";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { 
  Fuel, 
  History, 
  TrendingUp, 
  Settings2, 
  Droplet, 
  Plus, 
  Trash2,
  Calendar,
  Gauge,
  Truck,
  User,
  CreditCard,
  DollarSign,
  Waves,
  Activity,
  Sparkles,
  ArrowRight,
  AlertTriangle,
  Radar,
  Timer,
  ShieldAlert,
  Download,
  FileSpreadsheet
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface FuelTankProps {
  level: number;
}

const FuelTank: React.FC<FuelTankProps> = ({ level }) => {
  const t = useT();
  const pct = Math.max(0, Math.min(100, level));
  const fillHeight = 150 * (pct / 100);
  const waveA = "M20 0 C55 9 85 -9 120 0 C155 9 185 -9 220 0 L220 200 L20 200 Z";
  const waveB = "M20 0 C55 -8 85 8 120 0 C155 -8 185 8 220 0 L220 200 L20 200 Z";
  const levelColor =
    pct < 25
      ? "from-red-500 to-red-400"
      : pct < 70
      ? "from-amber-500 to-yellow-400"
      : "from-emerald-500 to-green-400";

  return (
    <div className="relative w-64 mx-auto">
      <svg viewBox="0 0 240 260" className="w-full h-auto">
        <defs>
          <linearGradient id="fuelFillGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fde047" />
            <stop offset="60%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#d97706" />
          </linearGradient>
          <clipPath id="fuelTankClip">
            <rect x="20" y="30" width="200" height="180" rx="20" />
          </clipPath>
        </defs>
        <rect x="100" y="12" width="40" height="14" rx="5" fill="#4b5563" />
        <rect x="20" y="30" width="200" height="180" rx="20" fill="#0f172a" stroke="#64748b" strokeWidth="2" />
        <g clipPath="url(#fuelTankClip)">
          <motion.rect
            x="20"
            y={210 - fillHeight}
            width="200"
            height={fillHeight}
            fill="url(#fuelFillGradient)"
            initial={false}
            animate={{ y: 210 - fillHeight, height: fillHeight }}
            transition={{ duration: 0.7, ease: "easeInOut" }}
            opacity={0.92}
          />
          <motion.path
            d={waveA}
            fill="#fde68a"
            fillOpacity={0.45}
            initial={false}
            animate={{
              d: [waveA, waveB, waveA],
              y: [210 - fillHeight + 4, 210 - fillHeight - 3, 210 - fillHeight + 4],
            }}
            transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.path
            d={waveB}
            fill="#fcd34d"
            fillOpacity={0.28}
            initial={false}
            animate={{
              d: [waveB, waveA, waveB],
              y: [210 - fillHeight + 8, 210 - fillHeight + 2, 210 - fillHeight + 8],
            }}
            transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
          />
        </g>
        <rect x="20" y="30" width="200" height="180" rx="20" fill="none" stroke="#94a3b8" strokeWidth="2.5" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-4xl font-bold text-white">{pct.toFixed(0)}%</span>
        <span className={`mt-2 rounded-full px-3 py-1 text-xs font-semibold bg-gradient-to-r ${levelColor} text-slate-900`}>
          {t('fuel.tankLevel', 'Niveau du carburant')}
        </span>
      </div>
    </div>
  );
};

const FuelManagement = () => {
  const {
    drivers,
    trucks,
    fuelPurchases,
    addFuelPurchase,
    fuelConsumptions,
    addFuelConsumption,
    fuelDrains,
    addFuelDrain,
    addCashOperation,
  } = useApp();
  const t = useT();
  const { language } = useLanguage();
  const tr = (frText: string, arText: string) => (language === 'ar' ? arText : frText);
  const uiLocale = language === 'ar' ? 'ar-MA' : 'fr-MA';
  const formatNum = (value: number) => Number(value || 0).toLocaleString(uiLocale);

  const CisternTank: React.FC<{ level: number }> = ({ level }) => <FuelTank level={level} />;

  // Format MAD
  const formatMAD = (amount: number) =>
    new Intl.NumberFormat(uiLocale, { style: "currency", currency: "MAD", minimumFractionDigits: 2 }).format(amount);
  const toDate = (value: Date | string) => (value instanceof Date ? value : new Date(value));

  // Propriétés du réservoir
  const [tankCapacity, setTankCapacity] = useState(20000);
  const [tankCapacityInput, setTankCapacityInput] = useState("20000");
  const [tankCapacityDialogOpen, setTankCapacityDialogOpen] = useState(false);
  const [tankCapacitySaving, setTankCapacitySaving] = useState(false);
  const capacity = Math.max(1, Number(tankCapacity) || 1);
  const baseStockLiters = 0;

  // Totaux
  const totalPurchased = useMemo(
    () => fuelPurchases.reduce((s, p) => s + p.quantityLiters, 0),
    [fuelPurchases]
  );
  const totalConsumed = useMemo(
    () => fuelConsumptions.reduce((s, c) => s + c.liters, 0),
    [fuelConsumptions]
  );
  const totalDrained = useMemo(
    () => fuelDrains.reduce((s, d) => s + d.quantityLiters, 0),
    [fuelDrains]
  );
  const totalPurchasedAmount = useMemo(
    () => fuelPurchases.reduce((s, p) => s + (p.price || 0), 0),
    [fuelPurchases]
  );
  const totalDrainedAmount = useMemo(
    () => fuelDrains.reduce((s, d) => s + (d.price || 0), 0),
    [fuelDrains]
  );

  const currentStockLiters = Math.max(0, baseStockLiters + totalPurchased - totalConsumed - totalDrained);
  const fuelLevelPct = Math.min(100, (currentStockLiters / capacity) * 100);
  const stockStatus = fuelLevelPct < 25 ? tr("Critique", "حرج") : fuelLevelPct < 70 ? tr("Moyen", "متوسط") : tr("Optimal", "مثالي");
  const averageLPer100 = useMemo(() => {
    const liters = fuelConsumptions.reduce((s, c) => s + (c.liters || 0), 0);
    const km = fuelConsumptions.reduce((s, c) => s + (c.mileageKm || 0), 0);
    return km > 0 ? (liters / km) * 100 : 0;
  }, [fuelConsumptions]);
  const sortedPurchases = useMemo(
    () => [...fuelPurchases].sort((a, b) => +toDate(b.date) - +toDate(a.date)),
    [fuelPurchases]
  );
  const sortedConsumptions = useMemo(
    () => [...fuelConsumptions].sort((a, b) => +toDate(b.date) - +toDate(a.date)),
    [fuelConsumptions]
  );
  const sortedDrains = useMemo(
    () => [...fuelDrains].sort((a, b) => +toDate(b.date) - +toDate(a.date)),
    [fuelDrains]
  );

  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [consumptionDialogOpen, setConsumptionDialogOpen] = useState(false);
  const [selectedDriverId, setSelectedDriverId] = useState("");
  
  const [drainDialogOpen, setDrainDialogOpen] = useState(false);
    

  const [purchaseForm, setPurchaseForm] = useState<Omit<FuelPurchase, "id">>({
    date: new Date(),
    quantityLiters: 0,
    price: 0,
    paymentMethod: "Espèces",
  });
  const [consumptionForm, setConsumptionForm] = useState<Omit<FuelConsumption, "id">>({
    date: new Date(),
    liters: 0,
    driver: "",
    truck: "",
    mileageKm: 0,
  });
  const [drainForm, setDrainForm] = useState<Omit<FuelDrain, "id">>({
    date: new Date(),
    quantityLiters: 0,
    price: 0,
    paymentMethod: "Espèces",
  });

  const [perfLimits, setPerfLimits] = useState({ greenMax: 25, yellowMax: 35 });

  useEffect(() => {
    const loadTankCapacity = async () => {
      const value = await kvGet<number>("fuel_tank_capacity_liters_v1");
      if (typeof value === "number" && value > 0) {
        setTankCapacity(value);
        setTankCapacityInput(String(Math.round(value)));
      }
    };
    loadTankCapacity();
  }, []);

  const perfBadge = (lPer100?: number | null) => {
    if (lPer100 == null) return "bg-gray-200 text-gray-700";
    if (lPer100 > perfLimits.yellowMax) return "bg-red-100 text-red-800";
    if (lPer100 >= perfLimits.greenMax) return "bg-yellow-100 text-yellow-800";
    return "bg-green-100 text-green-800";
  };

  const driverPerformance = useMemo(() => {
    const acc: Record<string, { liters: number; km: number }> = {};
    fuelConsumptions.forEach((c) => {
      const name = c.driver || tr("N/A", "غير متاح");
      const km = c.mileageKm || 0;
      acc[name] = {
        liters: (acc[name]?.liters || 0) + (c.liters || 0),
        km: (acc[name]?.km || 0) + km,
      };
    });
    return Object.entries(acc)
      .map(([driver, { liters, km }]) => ({
        driver,
        liters,
        km,
        lPer100: km > 0 ? (liters / km) * 100 : null,
      }))
      .sort((a, b) => (b.lPer100 ?? -Infinity) - (a.lPer100 ?? -Infinity));
  }, [fuelConsumptions, perfLimits]);

  const driversList = useMemo(
    () => Array.from(new Set(fuelConsumptions.map((c) => c.driver).filter(Boolean))),
    [fuelConsumptions]
  );
  const [chartDriver, setChartDriver] = useState<string>("all");
  const [mainTab, setMainTab] = useState<"carburant" | "huile">("carburant");
  const [dashboardMode, setDashboardMode] = useState<"creative" | "control">("creative");
  const [forecastWindow, setForecastWindow] = useState<7 | 14 | 30>(14);
  const driverSeries = useMemo(() => {
    const rows = fuelConsumptions
      .filter((c) => (chartDriver === "all" ? true : c.driver === chartDriver))
      .map((c) => ({
        date: toDate(c.date),
        lPer100: c.mileageKm && c.mileageKm > 0 ? (c.liters / c.mileageKm) * 100 : null,
      }))
      .filter((pt) => pt.lPer100 !== null)
      .sort((a, b) => +new Date(a.date) - +new Date(b.date));
    return rows as Array<{ date: Date; lPer100: number }>;
  }, [fuelConsumptions, chartDriver]);

  const weeklyPulse = useMemo(() => {
    const now = Date.now();
    const dayMs = 1000 * 60 * 60 * 24;
    const isRecent = (value: Date | string) => (now - +toDate(value)) / dayMs <= 7;
    const purchases7 = fuelPurchases.filter((p) => isRecent(p.date)).reduce((s, p) => s + p.quantityLiters, 0);
    const consumed7 = fuelConsumptions.filter((c) => isRecent(c.date)).reduce((s, c) => s + c.liters, 0);
    const drains7 = fuelDrains.filter((d) => isRecent(d.date)).reduce((s, d) => s + d.quantityLiters, 0);
    return {
      purchases7,
      consumed7,
      drains7,
      netFlow: purchases7 - consumed7 - drains7,
    };
  }, [fuelPurchases, fuelConsumptions, fuelDrains]);

  const adaptiveSignal = useMemo(() => {
    const stockCritical = fuelLevelPct < 25;
    const stockMedium = fuelLevelPct >= 25 && fuelLevelPct < 60;
    const perfCritical = averageLPer100 > perfLimits.yellowMax;
    const perfMedium = averageLPer100 >= perfLimits.greenMax && averageLPer100 <= perfLimits.yellowMax;
    const flowCritical = weeklyPulse.netFlow < 0;
    if (stockCritical || perfCritical || flowCritical) {
      return {
        label: tr("Surveillance renforcée", "مراقبة مشددة"),
        tone: "critical" as const,
        heroClass: "from-rose-950 via-slate-900 to-slate-900",
        chipClass: "bg-rose-100 text-rose-700 border-rose-200",
      };
    }
    if (stockMedium || perfMedium) {
      return {
        label: tr("Zone de vigilance", "منطقة يقظة"),
        tone: "warning" as const,
        heroClass: "from-amber-900 via-slate-900 to-slate-900",
        chipClass: "bg-amber-100 text-amber-700 border-amber-200",
      };
    }
    return {
      label: tr("Rythme optimal", "وتيرة مثالية"),
      tone: "optimal" as const,
      heroClass: "from-emerald-900 via-slate-900 to-slate-900",
      chipClass: "bg-emerald-100 text-emerald-700 border-emerald-200",
    };
  }, [fuelLevelPct, averageLPer100, perfLimits.greenMax, perfLimits.yellowMax, weeklyPulse.netFlow]);

  const quickAction = useMemo(() => {
    if (fuelLevelPct < 25) return { key: "purchase" as const, label: tr("Lancer un ravitaillement", "بدء عملية تزويد"), hint: tr("Niveau faible, réapprovisionnement conseillé.", "المستوى منخفض، يُنصح بإعادة التزويد.") };
    if (averageLPer100 > perfLimits.yellowMax) return { key: "consumption" as const, label: tr("Enregistrer une consommation", "تسجيل استهلاك"), hint: tr("Performance élevée, suivez les prochains trajets.", "الأداء مرتفع، تابع الرحلات القادمة.") };
    if (weeklyPulse.drains7 > 0 && weeklyPulse.drains7 >= weeklyPulse.purchases7 * 0.2) return { key: "drain" as const, label: tr("Vérifier les vidanges", "مراجعة عمليات التفريغ"), hint: tr("Impact notable des vidanges cette semaine.", "تأثير ملحوظ للتفريغ هذا الأسبوع.") };
    return { key: "consumption" as const, label: tr("Suivre une nouvelle consommation", "متابعة استهلاك جديد"), hint: tr("Maintenez la cadence d’analyse des trajets.", "حافظ على وتيرة تحليل الرحلات.") };
  }, [fuelLevelPct, averageLPer100, perfLimits.yellowMax, weeklyPulse.drains7, weeklyPulse.purchases7]);

  const controlRoomStats = useMemo(() => {
    const alerts = [
      fuelLevelPct < 25,
      averageLPer100 > perfLimits.yellowMax,
      weeklyPulse.netFlow < 0,
    ].filter(Boolean).length;
    return [
      {
        label: tr("Alertes actives", "تنبيهات نشطة"),
        value: alerts.toString(),
        tone: alerts > 0 ? "text-rose-300 border-rose-900/60 bg-rose-950/40" : "text-emerald-300 border-emerald-900/60 bg-emerald-950/40",
      },
      {
        label: tr("Flux 7 jours", "تدفق 7 أيام"),
        value: `${weeklyPulse.netFlow >= 0 ? "+" : ""}${formatNum(weeklyPulse.netFlow)} L`,
        tone: weeklyPulse.netFlow < 0 ? "text-amber-300 border-amber-900/60 bg-amber-950/40" : "text-cyan-300 border-cyan-900/60 bg-cyan-950/40",
      },
      {
        label: tr("Consommation moyenne", "متوسط الاستهلاك"),
        value: `${averageLPer100.toFixed(2)} L/100`,
        tone: averageLPer100 > perfLimits.yellowMax ? "text-rose-300 border-rose-900/60 bg-rose-950/40" : "text-slate-200 border-slate-700 bg-slate-900/70",
      },
      {
        label: tr("Signal global", "الإشارة العامة"),
        value: adaptiveSignal.label,
        tone: adaptiveSignal.tone === "critical" ? "text-rose-300 border-rose-900/60 bg-rose-950/40" : adaptiveSignal.tone === "warning" ? "text-amber-300 border-amber-900/60 bg-amber-950/40" : "text-emerald-300 border-emerald-900/60 bg-emerald-950/40",
      },
    ];
  }, [fuelLevelPct, averageLPer100, perfLimits.yellowMax, weeklyPulse.netFlow, adaptiveSignal]);

  const performanceHeatmap = useMemo(() => {
    return driverPerformance.slice(0, 8).map((driver, index) => {
      const score = driver.lPer100 ?? 0;
      const normalized = perfLimits.yellowMax > 0 ? Math.min(1, score / perfLimits.yellowMax) : 0;
      const levelClass =
        driver.lPer100 == null
          ? "bg-slate-100 border-slate-200"
          : normalized < 0.65
          ? "bg-emerald-100 border-emerald-200"
          : normalized < 1
          ? "bg-amber-100 border-amber-200"
          : "bg-rose-100 border-rose-200";
      return {
        rank: index + 1,
        name: driver.driver,
        liters: driver.liters,
        km: driver.km,
        lPer100: driver.lPer100,
        levelClass,
        intensity: `${Math.max(12, Math.round(normalized * 100))}%`,
      };
    });
  }, [driverPerformance, perfLimits.yellowMax]);

  const predictiveOps = useMemo(() => {
    const now = Date.now();
    const dayMs = 1000 * 60 * 60 * 24;
    const isInWindow = (value: Date | string) => (now - +toDate(value)) / dayMs <= forecastWindow;
    const buyWindow = fuelPurchases.filter((p) => isInWindow(p.date)).reduce((sum, p) => sum + p.quantityLiters, 0);
    const consumeWindow = fuelConsumptions.filter((c) => isInWindow(c.date)).reduce((sum, c) => sum + c.liters, 0);
    const drainWindow = fuelDrains.filter((d) => isInWindow(d.date)).reduce((sum, d) => sum + d.quantityLiters, 0);
    const netWindow = buyWindow - consumeWindow - drainWindow;
    const avgDailyNet = netWindow / forecastWindow;
    const daysToCritical = avgDailyNet < 0 ? currentStockLiters / Math.abs(avgDailyNet) : null;
    const stockRisk = fuelLevelPct < 20 ? 42 : fuelLevelPct < 40 ? 28 : fuelLevelPct < 60 ? 18 : 8;
    const perfRisk = averageLPer100 > perfLimits.yellowMax ? 35 : averageLPer100 >= perfLimits.greenMax ? 22 : 10;
    const flowRisk = avgDailyNet < 0 ? 25 : 8;
    const riskScore = Math.min(100, Math.round(stockRisk + perfRisk + flowRisk));
    return {
      buyWindow,
      consumeWindow,
      drainWindow,
      netWindow,
      avgDailyNet,
      daysToCritical,
      riskScore,
      riskLabel: riskScore >= 75 ? tr("Risque élevé", "مخاطر مرتفعة") : riskScore >= 45 ? tr("Risque modéré", "مخاطر متوسطة") : tr("Risque faible", "مخاطر منخفضة"),
    };
  }, [forecastWindow, fuelPurchases, fuelConsumptions, fuelDrains, currentStockLiters, fuelLevelPct, averageLPer100, perfLimits.greenMax, perfLimits.yellowMax]);

  const temporalDriverScores = useMemo(() => {
    const now = Date.now();
    const dayMs = 1000 * 60 * 60 * 24;
    const recentCutoff = forecastWindow;
    const byDriver: Record<string, { recentLiters: number; recentKm: number; baseLiters: number; baseKm: number }> = {};
    fuelConsumptions.forEach((entry) => {
      const name = entry.driver || tr("N/A", "غير متاح");
      const ageDays = (now - +toDate(entry.date)) / dayMs;
      if (!byDriver[name]) {
        byDriver[name] = { recentLiters: 0, recentKm: 0, baseLiters: 0, baseKm: 0 };
      }
      if (ageDays <= recentCutoff) {
        byDriver[name].recentLiters += entry.liters || 0;
        byDriver[name].recentKm += entry.mileageKm || 0;
      } else {
        byDriver[name].baseLiters += entry.liters || 0;
        byDriver[name].baseKm += entry.mileageKm || 0;
      }
    });
    return Object.entries(byDriver)
      .map(([driver, values]) => {
        const recentLPer100 = values.recentKm > 0 ? (values.recentLiters / values.recentKm) * 100 : null;
        const baselineLPer100 = values.baseKm > 0 ? (values.baseLiters / values.baseKm) * 100 : recentLPer100;
        const delta = recentLPer100 !== null && baselineLPer100 !== null ? recentLPer100 - baselineLPer100 : 0;
        const normalized = recentLPer100 !== null && perfLimits.yellowMax > 0 ? Math.min(1, recentLPer100 / perfLimits.yellowMax) : 0.5;
        const score = Math.max(0, Math.min(100, Math.round((1 - normalized) * 75 + (delta <= 0 ? 25 : Math.max(0, 25 - delta * 3)))));
        const trend = delta > 1 ? tr("Hausse", "ارتفاع") : delta < -1 ? tr("Baisse", "انخفاض") : tr("Stable", "مستقر");
        return {
          driver,
          recentLPer100,
          baselineLPer100,
          delta,
          score,
          trend,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
  }, [fuelConsumptions, forecastWindow, perfLimits.yellowMax]);

  const addPurchase = async () => {
    if (!purchaseForm.quantityLiters || purchaseForm.quantityLiters <= 0 || !purchaseForm.price || purchaseForm.price <= 0) {
      toast.error(tr("Veuillez saisir une quantité et un prix valides.", "يرجى إدخال كمية وسعر صالحين."));
      return;
    }
    const newPurchase: FuelPurchase = {
      id: Date.now(),
      ...purchaseForm,
    };
    await addFuelPurchase(newPurchase);

    const accountAffected =
      purchaseForm.paymentMethod === "Espèces"
        ? "espece"
        : purchaseForm.paymentMethod === "Chèque"
        ? "cheque"
        : "banque";

    await addCashOperation({
      id: Date.now(),
      date: newPurchase.date,
      description: language === "ar" ? `شراء وقود - ${newPurchase.quantityLiters}لتر` : `Achat carburant - ${newPurchase.quantityLiters}L`,
      amount: newPurchase.price,
      type: "retrait",
      category: "Achat",
      paymentMethod: purchaseForm.paymentMethod,
      status: "pending",
      accountAffected,
    });

    setPurchaseForm({
      date: new Date(),
      quantityLiters: 0,
      price: 0,
      paymentMethod: "Espèces",
    });
    setPurchaseDialogOpen(false);
    toast.success(tr("Ravitaillement enregistré.", "تم تسجيل التزويد."));
  };

  const addConsumption = async () => {
    if (!consumptionForm.driver || !consumptionForm.truck || !consumptionForm.liters || consumptionForm.liters <= 0) {
      toast.error(tr("Veuillez compléter chauffeur, camion et quantité.", "يرجى استكمال السائق والشاحنة والكمية."));
      return;
    }
    const newConsumption: FuelConsumption = {
      id: Date.now(),
      ...consumptionForm,
    };
    await addFuelConsumption(newConsumption);
    setConsumptionForm({
      date: new Date(),
      liters: 0,
      driver: "",
      truck: "",
      mileageKm: 0,
    });
    setSelectedDriverId("");
    setConsumptionDialogOpen(false);
    toast.success(tr("Consommation enregistrée.", "تم تسجيل الاستهلاك."));
  };

  const addDrain = async () => {
    if (!drainForm.quantityLiters || drainForm.quantityLiters <= 0 || !drainForm.price || drainForm.price <= 0) {
      toast.error(tr("Veuillez saisir une quantité et un prix valides.", "يرجى إدخال كمية وسعر صالحين."));
      return;
    }
    const newDrain: FuelDrain = {
      id: Date.now(),
      ...drainForm,
    };
    await addFuelDrain(newDrain);

    const accountAffected =
      drainForm.paymentMethod === "Espèces"
        ? "espece"
        : drainForm.paymentMethod === "Chèque"
        ? "cheque"
        : "banque";

    await addCashOperation({
      id: Date.now(),
      date: newDrain.date,
      description: language === "ar" ? `تفريغ خزان الوقود - ${newDrain.quantityLiters}لتر` : `Vidange réservoir carburant - ${newDrain.quantityLiters}L`,
      amount: newDrain.price,
      type: "retrait",
      category: "Achat",
      paymentMethod: drainForm.paymentMethod,
      status: "pending",
      accountAffected,
    });

    setDrainForm({
      date: new Date(),
      quantityLiters: 0,
      price: 0,
      paymentMethod: "Espèces",
    });
    setDrainDialogOpen(false);
    toast.success(t('fuel.dialog.successDrain'));
  };

  // Export PDFs
  const [exportStartDate, setExportStartDate] = useState<Date | null>(null);
  const [exportEndDate, setExportEndDate] = useState<Date | null>(null);
  const [exportTruckId, setExportTruckId] = useState<string>("__all__");
  const isInExportRange = (value: Date | string) => {
    const d = toDate(value).getTime();
    const startOk = exportStartDate ? d >= new Date(exportStartDate).setHours(0, 0, 0, 0) : true;
    const endOk = exportEndDate ? d <= new Date(exportEndDate).setHours(23, 59, 59, 999) : true;
    return startOk && endOk;
  };
  const companyName = "SFT GAZ";
  const exportCisternPdf = () => {
    const rows = [
      ...fuelPurchases.filter(p => isInExportRange(p.date)).map(p => ({
        date: new Date(p.date).toLocaleDateString(uiLocale),
        type: tr("Achat", "شراء"),
        qty: `${formatNum(p.quantityLiters)} L`,
        pu: formatMAD(p.price / Math.max(1, p.quantityLiters)),
        amount: formatMAD(p.price || 0),
        note: p.paymentMethod || ""
      })),
      ...fuelDrains.filter(d => isInExportRange(d.date)).map(d => ({
        date: new Date(d.date).toLocaleDateString(uiLocale),
        type: tr("Vidange", "تفريغ"),
        qty: `${formatNum(d.quantityLiters)} L`,
        pu: "",
        amount: formatMAD(d.price || 0),
        note: d.paymentMethod || ""
      }))
    ].sort((a, b) => {
      const ad = a.date; const bd = b.date;
      return ad < bd ? -1 : ad > bd ? 1 : 0;
    });
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const periodFrom = exportStartDate ? new Date(exportStartDate).toLocaleDateString(uiLocale) : tr("Non défini", "غير محدد");
    const periodTo = exportEndDate ? new Date(exportEndDate).toLocaleDateString(uiLocale) : tr("Non défini", "غير محدد");
    doc.setFillColor(17, 24, 39);
    doc.rect(0, 0, 595, 86, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.text(companyName, 40, 30);
    doc.setFontSize(16);
    doc.text(tr("MOUVEMENT DE CITERNE", "حركة الصهريج"), 40, 54);
    doc.setFontSize(10);
    doc.text(`${tr("Période", "الفترة")}: ${periodFrom} - ${periodTo}`, 40, 72);
    doc.setTextColor(15, 23, 42);
    autoTable(doc, {
      startY: 110,
      head: [[tr("Date", "التاريخ"), tr("Type", "النوع"), tr("Quantité", "الكمية"), tr("P.U", "سعر الوحدة"), tr("Montant", "المبلغ"), tr("Note", "ملاحظة")]],
      body: rows.map(r => [r.date, r.type, r.qty, r.pu, r.amount, r.note]),
      styles: { fontSize: 9, textColor: [15, 23, 42] },
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      theme: "grid"
    });
    const totalRows = rows.reduce((acc, r) => {
      if (r.type === tr("Achat", "شراء")) acc.purchases += Number(r.qty.replace(/[^\d.]/g, "")) || 0;
      if (r.type === tr("Vidange", "تفريغ")) acc.drains += Number(r.qty.replace(/[^\d.]/g, "")) || 0;
      return acc;
    }, { purchases: 0, drains: 0 });
    const net = totalRows.purchases - totalRows.drains;
    const totalAmountMad =
      fuelPurchases.filter(p => isInExportRange(p.date)).reduce((s, p) => s + (p.price || 0), 0) +
      fuelDrains.filter(d => isInExportRange(d.date)).reduce((s, d) => s + (d.price || 0), 0);
    const footerY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 22 : 150;
    doc.setFillColor(239, 246, 255);
    doc.roundedRect(40, footerY, 160, 46, 8, 8, "F");
    doc.setFillColor(254, 242, 242);
    doc.roundedRect(215, footerY, 160, 46, 8, 8, "F");
    doc.setFillColor(236, 253, 245);
    doc.roundedRect(390, footerY, 165, 46, 8, 8, "F");
    doc.setFillColor(240, 249, 255);
    doc.roundedRect(40, footerY + 60, 515, 46, 8, 8, "F");
    doc.setFontSize(10);
    doc.setTextColor(30, 64, 175);
    doc.text(tr("Achats", "المشتريات"), 52, footerY + 18);
    doc.setTextColor(15, 23, 42);
    doc.text(`${formatNum(totalRows.purchases)} L`, 52, footerY + 36);
    doc.setTextColor(190, 24, 24);
    doc.text(tr("Vidanges", "التفريغات"), 227, footerY + 18);
    doc.setTextColor(15, 23, 42);
    doc.text(`${formatNum(totalRows.drains)} L`, 227, footerY + 36);
    doc.setTextColor(5, 150, 105);
    doc.text(tr("Variation nette", "التغير الصافي"), 402, footerY + 18);
    doc.setTextColor(15, 23, 42);
    doc.text(`${formatNum(net)} L`, 402, footerY + 36);
    doc.setTextColor(30, 64, 175);
    doc.text(tr("Total MAD", "إجمالي MAD"), 52, footerY + 78);
    doc.setTextColor(15, 23, 42);
    doc.text(`${formatMAD(totalAmountMad)}`, 52, footerY + 96);
    const signY = footerY + 130;
    doc.setDrawColor(148, 163, 184);
    doc.line(40, signY, 220, signY);
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(tr("Signature", "التوقيع"), 40, signY + 14);
    doc.save(`mouvement-citerne.pdf`);
  };
  const exportTruckPdf = (scope: "single" | "all") => {
    const buildTruckSection = (doc: jsPDF, matricule: string, appendPage: boolean) => {
      const items = fuelConsumptions
        .filter(c => c.truck === matricule && isInExportRange(c.date))
        .sort((a, b) => +toDate(a.date) - +toDate(b.date));
      const periodFrom = exportStartDate ? new Date(exportStartDate).toLocaleDateString(uiLocale) : tr("Non défini", "غير محدد");
      const periodTo = exportEndDate ? new Date(exportEndDate).toLocaleDateString(uiLocale) : tr("Non défini", "غير محدد");
      if (appendPage) doc.addPage();
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, 595, 80, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.text(companyName, 40, 26);
      doc.setFontSize(14);
      doc.text(`${tr("Consommation Camion", "استهلاك الشاحنة")}`, 40, 46);
      doc.setFontSize(11);
      doc.text(`${tr("Camion", "الشاحنة")}: ${matricule}`, 40, 62);
      doc.setFontSize(10);
      doc.text(`${tr("Période", "الفترة")}: ${periodFrom} - ${periodTo}`, 40, 74);
      doc.setTextColor(15, 23, 42);
      autoTable(doc, {
        startY: 102,
        head: [[tr("Date", "التاريخ"), tr("Chauffeur", "السائق"), tr("Litres", "اللترات"), tr("Kilométrage", "الكيلومترات"), "L/100"]],
        body: items.map(it => {
          const l100 = it.mileageKm && it.mileageKm > 0 ? ((it.liters / it.mileageKm) * 100).toFixed(2) : "";
          return [
            new Date(it.date).toLocaleDateString(uiLocale),
            it.driver || "",
            formatNum(it.liters),
            it.mileageKm ? formatNum(it.mileageKm) : "",
            l100
          ];
        }),
        styles: { fontSize: 9, textColor: [15, 23, 42] },
        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255] },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        theme: "grid"
      });
      const totals = items.reduce((acc, it) => { acc.l += it.liters || 0; acc.km += it.mileageKm || 0; return acc; }, { l: 0, km: 0 });
      const avg = totals.km > 0 ? (totals.l / totals.km) * 100 : 0;
      const y = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 20 : 140;
      doc.setFillColor(239, 246, 255);
      doc.roundedRect(40, y, 160, 46, 8, 8, "F");
      doc.setFillColor(236, 253, 245);
      doc.roundedRect(215, y, 160, 46, 8, 8, "F");
      doc.setFillColor(254, 242, 242);
      doc.roundedRect(390, y, 165, 46, 8, 8, "F");
      doc.setFontSize(10);
      doc.setTextColor(30, 64, 175);
      doc.text(tr("Total litres", "إجمالي اللترات"), 52, y + 18);
      doc.setTextColor(15, 23, 42);
      doc.text(`${formatNum(totals.l)} L`, 52, y + 36);
      doc.setTextColor(5, 150, 105);
      doc.text(tr("Total km", "إجمالي الكيلومترات"), 227, y + 18);
      doc.setTextColor(15, 23, 42);
      doc.text(`${formatNum(totals.km)} km`, 227, y + 36);
      doc.setTextColor(190, 24, 24);
      doc.text(tr("Moyenne", "المتوسط"), 402, y + 18);
      doc.setTextColor(15, 23, 42);
      doc.text(`${avg ? avg.toFixed(2) : ""} L/100`, 402, y + 36);
      const signY = y + 70;
      doc.setDrawColor(148, 163, 184);
      doc.line(40, signY, 220, signY);
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text(tr("Signature", "التوقيع"), 40, signY + 14);
    };
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    if (scope === "single") {
      const truck = trucks.find(t => String(t.id) === String(exportTruckId));
      const matricule = truck?.matricule || "";
      buildTruckSection(doc, matricule, false);
    } else {
      const ordered = trucks.slice().sort((a, b) => (a.matricule || "").localeCompare(b.matricule || ""));
      let first = true;
      ordered.forEach(trk => {
        const hasRows = fuelConsumptions.some(c => c.truck === trk.matricule && isInExportRange(c.date));
        if (!hasRows) return;
        buildTruckSection(doc, trk.matricule || "", !first ? true : false);
        first = false;
      });
    }
    doc.save(scope === "single" ? `consommation-${(trucks.find(t => String(t.id) === String(exportTruckId))?.matricule || "camion")}.pdf` : "consommation-camions.pdf");
  };

  const saveTankCapacity = async () => {
    const parsed = Math.round(Number(tankCapacityInput));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toast.error(tr("Veuillez saisir une capacité valide.", "يرجى إدخال سعة صالحة."));
      return;
    }
    setTankCapacitySaving(true);
    await kvSet("fuel_tank_capacity_liters_v1", parsed);
    setTankCapacity(parsed);
    setTankCapacitySaving(false);
    setTankCapacityDialogOpen(false);
    toast.success(tr("Capacité de la citerne enregistrée.", "تم حفظ سعة الصهريج."));
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="app-page-shell p-4 md:p-8 space-y-8"
    >
      <Tabs
        value={mainTab}
        onValueChange={(value) => {
          const next = value as "carburant" | "huile";
          setMainTab(next);
          if (next === "huile") {
            setPurchaseDialogOpen(false);
            setConsumptionDialogOpen(false);
            setDrainDialogOpen(false);
          }
        }}
        className="space-y-6"
      >
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="carburant">{t('fuel.tabFuel')}</TabsTrigger>
          <TabsTrigger value="huile">{t('fuel.tabOil')}</TabsTrigger>
        </TabsList>
        <TabsContent value="carburant" className={dashboardMode === "control" ? "space-y-6 rounded-2xl border border-slate-800/80 bg-slate-950/40 p-4 md:p-5" : "space-y-6"}>
          <Card className={`border-0 overflow-hidden bg-gradient-to-r ${adaptiveSignal.heroClass} text-white`}>
            <CardContent className="p-6 md:p-7">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={adaptiveSignal.chipClass}>{tr('Signal', 'الإشارة')}: {adaptiveSignal.label}</Badge>
                    <Badge variant="secondary" className="bg-white/15 text-white border-white/20">
                      <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                      {t('fuel.version')}
                    </Badge>
                    <div className="ml-0 md:ml-1 inline-flex rounded-lg border border-white/20 bg-black/20 p-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className={dashboardMode === "creative" ? "h-7 text-xs bg-white text-slate-900 hover:bg-white" : "h-7 text-xs text-white hover:bg-white/10"}
                        onClick={() => setDashboardMode("creative")}
                      >
                        {t('fuel.creative')}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className={dashboardMode === "control" ? "h-7 text-xs bg-white text-slate-900 hover:bg-white" : "h-7 text-xs text-white hover:bg-white/10"}
                        onClick={() => setDashboardMode("control")}
                      >
                        {t('fuel.controlRoom')}
                      </Button>
                    </div>
                  </div>
                  <div>
                    <h1 className="app-page-title text-3xl font-bold tracking-tight">{t('fuel.title')}</h1>
                    <p className="app-page-subtitle text-slate-200">{t('fuel.subtitle')}</p>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                    <div className="rounded-lg bg-white/10 border border-white/10 px-3 py-2.5">
                      <p className="text-[11px] uppercase tracking-wide text-slate-200">{t('fuel.stock')}</p>
                      <p className="text-lg font-black">{formatNum(currentStockLiters)} L</p>
                    </div>
                    <div className="rounded-lg bg-white/10 border border-white/10 px-3 py-2.5">
                      <p className="text-[11px] uppercase tracking-wide text-slate-200">{t('fuel.weeklyFlow')}</p>
                      <p className="text-lg font-black">{weeklyPulse.netFlow >= 0 ? "+" : ""}{formatNum(weeklyPulse.netFlow)} L</p>
                    </div>
                    <div className="rounded-lg bg-white/10 border border-white/10 px-3 py-2.5">
                      <p className="text-[11px] uppercase tracking-wide text-slate-200">{t('fuel.weeklyPurchase')}</p>
                      <p className="text-lg font-black">{formatNum(weeklyPulse.purchases7)} L</p>
                    </div>
                    <div className="rounded-lg bg-white/10 border border-white/10 px-3 py-2.5">
                      <p className="text-[11px] uppercase tracking-wide text-slate-200">{t('fuel.avgConsumption')}</p>
                      <p className="text-lg font-black">{averageLPer100.toFixed(2)} L/100</p>
                    </div>
                  </div>
                </div>
                <div className="w-full xl:w-[340px] space-y-2.5 rounded-xl border border-white/15 bg-black/20 p-4">
                  <p className="text-xs uppercase tracking-wider text-slate-200 font-bold">{t('fuel.recommendedAction')}</p>
                  <p className="text-base font-bold">{quickAction.label}</p>
                  <p className="text-xs text-slate-200">{quickAction.hint}</p>
                  <Button
                    className="w-full mt-1 bg-white text-slate-900 hover:bg-slate-100"
                    onClick={() => {
                      if (quickAction.key === "purchase") setPurchaseDialogOpen(true);
                      if (quickAction.key === "consumption") setConsumptionDialogOpen(true);
                      if (quickAction.key === "drain") setDrainDialogOpen(true);
                    }}
                  >
                    {t('fuel.openAction')}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setPurchaseDialogOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              {t('fuel.newPurchase')}
            </Button>
            <Button onClick={() => setConsumptionDialogOpen(true)} variant="secondary" className="gap-2">
              <Droplet className="w-4 h-4" />
              {t('fuel.newConsumption')}
            </Button>
            <Button
              variant="outline"
              onClick={() => setDrainDialogOpen(true)}
              className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4" />
              {t('fuel.drain')}
            </Button>
            <Button
              variant="outline"
              onClick={() => setTankCapacityDialogOpen(true)}
              className="gap-2"
            >
              <Settings2 className="w-4 h-4" />
              {tr("Capacité Citerne", "سعة الصهريج")}
            </Button>
          </div>
          {dashboardMode === "control" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              {controlRoomStats.map((item) => (
                <div key={item.label} className={`rounded-xl border px-3 py-3 ${item.tone}`}>
                  <p className="text-[11px] uppercase tracking-wide font-bold">{item.label}</p>
                  <p className="text-lg font-black mt-1">{item.value}</p>
                </div>
              ))}
            </div>
          )}
          <Card className={dashboardMode === "control" ? "border-slate-800 bg-slate-950/60 text-slate-100" : ""}>
            <CardHeader className={dashboardMode === "control" ? "border-b border-slate-800" : ""}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Radar className="w-5 h-5 text-primary" />
                  <div>
                    <CardTitle>{tr('Pulse Prévisionnel', 'النبض التوقعي')}</CardTitle>
                    <CardDescription className={dashboardMode === "control" ? "text-slate-300" : ""}>
                      {tr('Projection dynamique des flux et du risque opérationnel', 'توقع ديناميكي للتدفقات والمخاطر التشغيلية')}
                    </CardDescription>
                  </div>
                </div>
                <Select
                  value={String(forecastWindow)}
                  onValueChange={(value) => setForecastWindow(Number(value) as 7 | 14 | 30)}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">{tr('Fenêtre 7 jours', 'نافذة 7 أيام')}</SelectItem>
                    <SelectItem value="14">{tr('Fenêtre 14 jours', 'نافذة 14 يومًا')}</SelectItem>
                    <SelectItem value="30">{tr('Fenêtre 30 jours', 'نافذة 30 يومًا')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="pt-5">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-3">
                  <p className="text-[11px] uppercase tracking-wide font-bold text-cyan-200">{tr('Flux moyen / jour', 'متوسط التدفق / يوم')}</p>
                  <p className="text-lg font-black mt-1">
                    {predictiveOps.avgDailyNet >= 0 ? "+" : ""}
                    {predictiveOps.avgDailyNet.toFixed(0)} L
                  </p>
                </div>
                <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/10 px-3 py-3">
                  <p className="text-[11px] uppercase tracking-wide font-bold text-indigo-200">{tr('Balance fenêtre', 'رصيد النافذة')}</p>
                  <p className="text-lg font-black mt-1">
                    {predictiveOps.netWindow >= 0 ? "+" : ""}
                    {formatNum(predictiveOps.netWindow)} L
                  </p>
                </div>
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-3">
                  <p className="text-[11px] uppercase tracking-wide font-bold text-amber-200">{tr('Jours avant critique', 'أيام قبل الحالة الحرجة')}</p>
                  <p className="text-lg font-black mt-1">
                    {predictiveOps.daysToCritical !== null ? `${Math.max(0, Math.round(predictiveOps.daysToCritical))} ${tr('j', 'ي')}` : tr("Stable", "مستقر")}
                  </p>
                </div>
                <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-3">
                  <p className="text-[11px] uppercase tracking-wide font-bold text-rose-200">{tr('Score risque', 'نقاط المخاطر')}</p>
                  <p className="text-lg font-black mt-1">{predictiveOps.riskScore}/100</p>
                </div>
              </div>
              <div className={`mt-4 rounded-xl border px-3 py-2.5 flex items-center gap-2 text-sm ${predictiveOps.riskScore >= 75 ? "border-rose-200 bg-rose-50 text-rose-700" : predictiveOps.riskScore >= 45 ? "border-amber-200 bg-amber-50 text-amber-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
                <ShieldAlert className="w-4 h-4" />
                {predictiveOps.riskLabel} · {tr('achats', 'مشتريات')} {formatNum(predictiveOps.buyWindow)} L · {tr('consommations', 'استهلاكات')} {formatNum(predictiveOps.consumeWindow)} L · {tr('vidanges', 'تفريغات')} {formatNum(predictiveOps.drainWindow)} L
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <Card className="xl:col-span-1 overflow-hidden border-0 bg-gradient-to-b from-slate-900 to-slate-800 text-white shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Waves className="w-5 h-5 text-amber-300" />
                  {tr('Niveau de la Citerne', 'مستوى الصهريج')}
                </CardTitle>
                <CardDescription className="text-slate-300">{tr('Animation dynamique du liquide', 'حركة ديناميكية للسائل')}</CardDescription>
              </CardHeader>
              <CardContent className="pt-2 flex flex-col items-center gap-4">
                <CisternTank level={fuelLevelPct} />
                <div className="w-full rounded-lg bg-white/10 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-300">{tr('Stock disponible', 'المخزون المتاح')}</span>
                    <Badge variant="secondary">{stockStatus}</Badge>
                  </div>
                  <p className="mt-1 text-2xl font-bold">{formatNum(currentStockLiters)} L</p>
                  <p className="text-xs text-slate-300">{tr('Capacité totale', 'السعة الإجمالية')}: {formatNum(capacity)} L</p>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="mt-2 h-7 bg-white/15 text-white hover:bg-white/25 border border-white/20"
                    onClick={() => setTankCapacityDialogOpen(true)}
                  >
                    {tr("Modifier la capacité", "تعديل السعة")}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="xl:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card className="border-green-100 bg-gradient-to-br from-green-50 to-white">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{tr('Ravitaillements', 'التزويدات')}</p>
                      <h3 className="text-2xl font-bold">{fuelPurchases.length}</h3>
                      <p className="text-xs text-muted-foreground mt-1">{formatNum(totalPurchased)} L</p>
                    </div>
                    <div className="p-3 bg-green-100 rounded-full">
                      <TrendingUp className="w-5 h-5 text-green-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-blue-100 bg-gradient-to-br from-blue-50 to-white">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{tr('Consommations', 'الاستهلاكات')}</p>
                      <h3 className="text-2xl font-bold">{fuelConsumptions.length}</h3>
                      <p className="text-xs text-muted-foreground mt-1">{formatNum(totalConsumed)} L</p>
                    </div>
                    <div className="p-3 bg-blue-100 rounded-full">
                      <Droplet className="w-5 h-5 text-blue-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-amber-100 bg-gradient-to-br from-amber-50 to-white">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{tr('Coût total achats', 'إجمالي تكلفة المشتريات')}</p>
                      <h3 className="text-2xl font-bold">{formatMAD(totalPurchasedAmount)}</h3>
                      <p className="text-xs text-muted-foreground mt-1">{tr('Vidange', 'تفريغ')}: {formatMAD(totalDrainedAmount)}</p>
                    </div>
                    <div className="p-3 bg-amber-100 rounded-full">
                      <DollarSign className="w-5 h-5 text-amber-700" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-white">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{tr('Efficacité moyenne', 'الكفاءة المتوسطة')}</p>
                      <h3 className="text-2xl font-bold">{averageLPer100.toFixed(2)} L/100</h3>
                      <p className="text-xs text-muted-foreground mt-1">{tr('Basée sur tous les trajets', 'مبنية على كل الرحلات')}</p>
                    </div>
                    <div className="p-3 bg-primary/10 rounded-full">
                      <Activity className="w-5 h-5 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <Card className="overflow-hidden">
            <CardHeader className="bg-muted/30">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2">
                  <History className="w-5 h-5 text-primary" />
                  {tr('Journal Carburant', 'سجل الوقود')}
                </CardTitle>
                <Badge className={adaptiveSignal.chipClass}>{adaptiveSignal.label}</Badge>
              </div>
              <CardDescription>{tr('Ravitaillements, consommations et vidanges synchronisés Supabase', 'تزويدات واستهلاكات وتفريغات متزامنة مع Supabase')}</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50/70 p-3 grid grid-cols-1 md:grid-cols-3 gap-2.5">
                <div className="rounded-lg bg-white border border-slate-200 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-slate-600 font-bold">{tr('Achats 7 jours', 'مشتريات 7 أيام')}</p>
                  <p className="text-lg font-black text-slate-900">{formatNum(weeklyPulse.purchases7)} L</p>
                </div>
                <div className="rounded-lg bg-white border border-slate-200 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-slate-600 font-bold">{tr('Consommation 7 jours', 'استهلاك 7 أيام')}</p>
                  <p className="text-lg font-black text-slate-900">{formatNum(weeklyPulse.consumed7)} L</p>
                </div>
                <div className={`rounded-lg border px-3 py-2 ${weeklyPulse.netFlow < 0 ? "bg-rose-50 border-rose-100" : "bg-emerald-50 border-emerald-100"}`}>
                  <p className="text-[11px] uppercase tracking-wide font-bold text-slate-600">{tr('Balance nette', 'الرصيد الصافي')}</p>
                  <p className={`text-lg font-black ${weeklyPulse.netFlow < 0 ? "text-rose-700" : "text-emerald-700"}`}>
                    {weeklyPulse.netFlow >= 0 ? "+" : ""}
                    {formatNum(weeklyPulse.netFlow)} L
                  </p>
                </div>
              </div>
              {adaptiveSignal.tone === "critical" && (
                <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  {tr('Contrôle recommandé: stock/performance présente un risque à court terme.', 'يوصى بالمراقبة: المخزون/الأداء يمثلان خطراً على المدى القصير.')}
                </div>
              )}
              <Tabs defaultValue="ravitaillements" className="space-y-4">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="ravitaillements">{tr('Ravitaillements', 'التزويدات')}</TabsTrigger>
                  <TabsTrigger value="consommations">{tr('Consommations', 'الاستهلاكات')}</TabsTrigger>
                  <TabsTrigger value="vidanges">{tr('Vidanges', 'التفريغات')}</TabsTrigger>
                </TabsList>
                <TabsContent value="ravitaillements" className="m-0">
                  <div className="max-h-[420px] overflow-auto rounded-md border">
                    <Table>
                      <TableHeader className="sticky top-0 bg-background z-10">
                        <TableRow>
                          <TableHead>{tr('Date', 'التاريخ')}</TableHead>
                          <TableHead>{tr('Quantité (L)', 'الكمية (لتر)')}</TableHead>
                          <TableHead>{tr('Prix', 'السعر')}</TableHead>
                          <TableHead>{tr('Paiement', 'الدفع')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedPurchases.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                              {tr('Aucun ravitaillement enregistré', 'لا يوجد أي تزويد مسجل')}
                            </TableCell>
                          </TableRow>
                        ) : (
                          sortedPurchases.map((p, idx) => (
                            <motion.tr key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} whileHover={{ scale: 1.003 }} transition={{ delay: idx * 0.03 }}>
                              <TableCell>{toDate(p.date).toLocaleDateString(uiLocale)}</TableCell>
                              <TableCell>{formatNum(p.quantityLiters)} L</TableCell>
                              <TableCell>{formatMAD(p.price)}</TableCell>
                              <TableCell>{p.paymentMethod}</TableCell>
                            </motion.tr>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
                <TabsContent value="consommations" className="m-0">
                  <div className="max-h-[420px] overflow-auto rounded-md border">
                    <Table>
                      <TableHeader className="sticky top-0 bg-background z-10">
                        <TableRow>
                          <TableHead>{tr('Date', 'التاريخ')}</TableHead>
                          <TableHead>{tr('Chauffeur', 'السائق')}</TableHead>
                          <TableHead>{tr('Camion', 'الشاحنة')}</TableHead>
                          <TableHead>{tr('Litres', 'اللترات')}</TableHead>
                          <TableHead>{tr('Rendement', 'المردودية')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedConsumptions.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                              {tr('Aucune consommation enregistrée', 'لا يوجد أي استهلاك مسجل')}
                            </TableCell>
                          </TableRow>
                        ) : (
                          sortedConsumptions.map((c, idx) => {
                            const lPer100 = c.mileageKm && c.mileageKm > 0 ? (c.liters / c.mileageKm) * 100 : null;
                            return (
                              <motion.tr key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} whileHover={{ scale: 1.003 }} transition={{ delay: idx * 0.03 }}>
                                <TableCell>{toDate(c.date).toLocaleDateString(uiLocale)}</TableCell>
                                <TableCell>{c.driver}</TableCell>
                                <TableCell>{c.truck}</TableCell>
                                <TableCell>{formatNum(c.liters)} L</TableCell>
                                <TableCell>
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${perfBadge(lPer100 ?? undefined)}`}>
                                    {lPer100 !== null ? `${lPer100.toFixed(2)} L/100` : "-"}
                                  </span>
                                </TableCell>
                              </motion.tr>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
                <TabsContent value="vidanges" className="m-0">
                  <div className="max-h-[420px] overflow-auto rounded-md border">
                    <Table>
                      <TableHeader className="sticky top-0 bg-background z-10">
                        <TableRow>
                          <TableHead>{tr('Date', 'التاريخ')}</TableHead>
                          <TableHead>{tr('Quantité (L)', 'الكمية (لتر)')}</TableHead>
                          <TableHead>{tr('Prix', 'السعر')}</TableHead>
                          <TableHead>{tr('Paiement', 'الدفع')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedDrains.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                              {tr('Aucune vidange enregistrée', 'لا يوجد أي تفريغ مسجل')}
                            </TableCell>
                          </TableRow>
                        ) : (
                          sortedDrains.map((d, idx) => (
                            <motion.tr key={d.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} whileHover={{ scale: 1.003 }} transition={{ delay: idx * 0.03 }}>
                              <TableCell>{toDate(d.date).toLocaleDateString(uiLocale)}</TableCell>
                              <TableCell>{formatNum(d.quantityLiters)} L</TableCell>
                              <TableCell>{formatMAD(d.price)}</TableCell>
                              <TableCell>{d.paymentMethod}</TableCell>
                            </motion.tr>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Performance par Chauffeur */}
        <Card>
          <CardHeader className="bg-muted/30">
            <div className="flex items-center gap-2">
              <Gauge className="w-5 h-5 text-primary" />
              <div>
                <CardTitle>{tr('Performance par Chauffeur', 'الأداء حسب السائق')}</CardTitle>
                <CardDescription>{tr('Consommation moyenne (L/100km)', 'متوسط الاستهلاك (ل/100كم)')}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tr('Chauffeur', 'السائق')}</TableHead>
                  <TableHead className="text-right">{tr('Total (L)', 'الإجمالي (لتر)')}</TableHead>
                  <TableHead className="text-right">{tr('Total (km)', 'الإجمالي (كم)')}</TableHead>
                  <TableHead className="text-center">{tr('Efficacité', 'الكفاءة')}</TableHead>
                </TableRow>
              </TableHeader>
                <TableBody>
                  {driverPerformance.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        {tr('Aucune donnée de performance', 'لا توجد بيانات أداء')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    <>
                      {driverPerformance.map((d) => (
                        <TableRow key={d.driver}>
                          <TableCell className="font-medium">{d.driver}</TableCell>
                          <TableCell className="text-right">{formatNum(d.liters)} L</TableCell>
                          <TableCell className="text-right">{formatNum(d.km)} km</TableCell>
                          <TableCell className="text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${perfBadge(d.lPer100 ?? undefined)}`}>
                              {d.lPer100 !== null ? `${d.lPer100.toFixed(2)} L/100` : "-"}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/50 font-bold">
                        <TableCell>{tr('Total Général', 'الإجمالي العام')}</TableCell>
                        <TableCell className="text-right">
                          {formatNum(driverPerformance.reduce((s, d) => s + d.liters, 0))} L
                        </TableCell>
                        <TableCell className="text-right">
                          {formatNum(driverPerformance.reduce((s, d) => s + d.km, 0))} km
                        </TableCell>
                        <TableCell className="text-center">
                          {(() => {
                            const totalL = driverPerformance.reduce((s, d) => s + d.liters, 0);
                            const totalKm = driverPerformance.reduce((s, d) => s + d.km, 0);
                            const avg = totalKm > 0 ? (totalL / totalKm) * 100 : 0;
                            return (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${perfBadge(avg)}`}>
                                {avg.toFixed(2)} L/100 ({tr('Moy.', 'متوسط')})
                              </span>
                            );
                          })()}
                        </TableCell>
                      </TableRow>
                    </>
                  )}
                </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Configuration des Seuils */}
        <Card>
          <CardHeader className="bg-muted/30">
            <div className="flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-primary" />
              <div>
                <CardTitle>{tr('Seuils de Performance', 'عتبات الأداء')}</CardTitle>
                <CardDescription>{tr('Configurez les limites L/100km', 'قم بضبط حدود L/100km')}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  {tr('Limite Optimale (Vert)', 'الحد المثالي (أخضر)')}
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    className="w-20 text-right"
                    value={perfLimits.greenMax}
                    onChange={(e) => setPerfLimits(p => ({ ...p, greenMax: parseFloat(e.target.value) || 0 }))}
                  />
                  <span className="text-xs text-muted-foreground">L/100</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  {tr("Limite d'Alerte (Jaune)", 'حد الإنذار (أصفر)')}
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    className="w-20 text-right"
                    value={perfLimits.yellowMax}
                    onChange={(e) => setPerfLimits(p => ({ ...p, yellowMax: parseFloat(e.target.value) || 0 }))}
                  />
                  <span className="text-xs text-muted-foreground">L/100</span>
                </div>
              </div>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg text-xs text-muted-foreground space-y-2">
              <p>• <span className="text-green-600 font-medium">{tr('Vert', 'أخضر')}:</span> {tr('En dessous de', 'أقل من')} {perfLimits.greenMax} L/100km</p>
              <p>• <span className="text-yellow-600 font-medium">{tr('Jaune', 'أصفر')}:</span> {tr('Entre', 'بين')} {perfLimits.greenMax} {tr('et', 'و')} {perfLimits.yellowMax} L/100km</p>
              <p>• <span className="text-red-600 font-medium">{tr('Rouge', 'أحمر')}:</span> {tr('Au-dessus de', 'أعلى من')} {perfLimits.yellowMax} L/100km</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="bg-muted/30">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              {tr('Heatmap Performance Chauffeurs', 'خريطة حرارية لأداء السائقين')}
            </CardTitle>
            <Badge variant="outline">{tr('Top 8', 'أفضل 8')}</Badge>
          </div>
          <CardDescription>{tr('Lecture rapide des profils de consommation par intensité', 'قراءة سريعة لملفات الاستهلاك حسب الشدة')}</CardDescription>
        </CardHeader>
        <CardContent className="pt-5">
          {performanceHeatmap.length === 0 ? (
            <div className="h-[120px] flex items-center justify-center rounded-xl border-2 border-dashed text-muted-foreground">
              {tr('Aucune donnée disponible', 'لا توجد بيانات متاحة')}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              {performanceHeatmap.map((cell) => (
                <motion.div
                  key={cell.name}
                  whileHover={{ y: -2 }}
                  className={`rounded-xl border p-3 ${cell.levelClass}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] uppercase tracking-wide font-bold">#{cell.rank}</span>
                    <span className="text-[11px] font-bold">{cell.lPer100 !== null ? `${cell.lPer100.toFixed(2)} L/100` : "-"}</span>
                  </div>
                  <p className="font-bold text-sm mt-1 truncate">{cell.name}</p>
                  <div className="mt-2 h-2 rounded-full bg-white/70 overflow-hidden">
                    <div className="h-full bg-slate-900/70" style={{ width: cell.intensity }} />
                  </div>
                  <p className="mt-2 text-[11px] font-semibold text-slate-700">{formatNum(cell.liters)} L · {formatNum(cell.km)} km</p>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="bg-muted/30">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Timer className="w-5 h-5 text-primary" />
              <div>
                <CardTitle>{tr('Score Temporel Chauffeurs', 'التقييم الزمني للسائقين')}</CardTitle>
                <CardDescription>{tr("Évolution récente comparée à l'historique", 'التطور الحديث مقارنة بالسجل')}</CardDescription>
              </div>
            </div>
            <Badge variant="outline">{tr('Top 8', 'أفضل 8')}</Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-5">
          {temporalDriverScores.length === 0 ? (
            <div className="h-[120px] flex items-center justify-center rounded-xl border-2 border-dashed text-muted-foreground">
              {tr('Aucune donnée disponible', 'لا توجد بيانات متاحة')}
            </div>
          ) : (
            <div className="space-y-3">
              {temporalDriverScores.map((item) => (
                <div key={item.driver} className="rounded-xl border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-bold text-sm">{item.driver}</p>
                    <Badge className={item.score >= 75 ? "bg-emerald-100 text-emerald-700" : item.score >= 50 ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"}>
                      {tr('Score', 'النقاط')} {item.score}
                    </Badge>
                  </div>
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    <div className="rounded-lg bg-slate-50 border px-2 py-1.5">
                      {tr('Récent', 'حديث')}: {item.recentLPer100 !== null ? `${item.recentLPer100.toFixed(2)} L/100` : "-"}
                    </div>
                    <div className="rounded-lg bg-slate-50 border px-2 py-1.5">
                      {tr('Base', 'أساس')}: {item.baselineLPer100 !== null ? `${item.baselineLPer100.toFixed(2)} L/100` : "-"}
                    </div>
                    <div className={`rounded-lg border px-2 py-1.5 ${item.delta > 1 ? "bg-rose-50 border-rose-100 text-rose-700" : item.delta < -1 ? "bg-emerald-50 border-emerald-100 text-emerald-700" : "bg-slate-50"}`}>
                      {tr('Tendance', 'الاتجاه')}: {item.trend} {item.delta !== 0 ? `(${item.delta > 0 ? "+" : ""}${item.delta.toFixed(2)})` : ""}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Graphique Évolution */}
      <Card>
        <CardHeader className="bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              <CardTitle>{tr('Évolution de la Consommation', 'تطور الاستهلاك')}</CardTitle>
            </div>
            <Select onValueChange={(value) => setChartDriver(value)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder={tr('Tous les chauffeurs', 'جميع السائقين')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tr('Tous les chauffeurs', 'جميع السائقين')}</SelectItem>
                {driversList.map((d) => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {driverSeries.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground border-2 border-dashed rounded-lg">
              {tr('Aucune donnée historique disponible pour ce chauffeur', 'لا توجد بيانات تاريخية متاحة لهذا السائق')}
            </div>
          ) : (
            <div className="w-full h-[250px] relative">
              <svg viewBox="0 0 440 200" className="w-full h-full preserve-3d">
                <defs>
                  <linearGradient id="lineGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                  </linearGradient>
                </defs>
                
                {/* Axes */}
                <line x1="30" y1="170" x2="420" y2="170" stroke="currentColor" strokeOpacity="0.2" />
                <line x1="30" y1="20" x2="30" y2="170" stroke="currentColor" strokeOpacity="0.2" />

                {(() => {
                  const maxY = Math.max(...driverSeries.map((p) => p.lPer100), perfLimits.yellowMax + 5);
                  const scaleY = (v: number) => 170 - ((v / maxY) * 150);
                  const yGreen = scaleY(perfLimits.greenMax);
                  const yYellow = scaleY(perfLimits.yellowMax);
                  return (
                    <>
                      <line x1="30" y1={yGreen} x2="420" y2={yGreen} stroke="#22c55e" strokeDasharray="4 4" strokeOpacity="0.5" />
                      <line x1="30" y1={yYellow} x2="420" y2={yYellow} stroke="#f59e0b" strokeDasharray="4 4" strokeOpacity="0.5" />
                    </>
                  );
                })()}

                {(() => {
                  const n = driverSeries.length;
                  const maxY = Math.max(...driverSeries.map((p) => p.lPer100), perfLimits.yellowMax + 5);
                  const scaleX = (i: number) => 30 + (i * (390 / Math.max(1, n - 1)));
                  const scaleY = (v: number) => 170 - ((v / maxY) * 150);
                  const points = driverSeries.map((p, i) => `${scaleX(i)},${scaleY(p.lPer100)}`).join(" ");
                  const areaPoints = `${scaleX(0)},170 ${points} ${scaleX(n-1)},170`;
                  return (
                    <>
                      <polygon points={areaPoints} fill="url(#lineGradient)" />
                      <motion.polyline 
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        points={points} 
                        fill="none" 
                        stroke="#3b82f6" 
                        strokeWidth="2.5" 
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      {driverSeries.map((p, i) => (
                        <circle 
                          key={i} 
                          cx={scaleX(i)} 
                          cy={scaleY(p.lPer100)} 
                          r="4" 
                          fill="white" 
                          stroke="#3b82f6" 
                          strokeWidth="2" 
                          className="hover:r-6 transition-all"
                        />
                      ))}
                    </>
                  );
                })()}
              </svg>
            </div>
          )}
        </CardContent>
      </Card>

        </TabsContent>
        <TabsContent value="huile">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <OilManagement />
          </motion.div>
        </TabsContent>
      </Tabs>

      <Card className="mt-4 border border-slate-200 bg-white rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2">
            <span>{tr("Export PDF Carburant", "تصدير PDF للوقود")}</span>
            <div className="text-xs text-slate-500">{tr("Mouvements citerne et consommations par camion", "حركات الصهريج واستهلاكات حسب الشاحنة")}</div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider">{tr("Début", "البداية")}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-xs border-slate-200 h-10">
                    <Calendar className="mr-2 h-3.5 w-3.5" />
                    {exportStartDate ? new Date(exportStartDate).toLocaleDateString(uiLocale) : tr("Du", "من")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent mode="single" selected={exportStartDate ?? undefined} onSelect={(d) => setExportStartDate(d ?? null)} />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider">{tr("Fin", "النهاية")}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-xs border-slate-200 h-10">
                    <Calendar className="mr-2 h-3.5 w-3.5" />
                    {exportEndDate ? new Date(exportEndDate).toLocaleDateString(uiLocale) : tr("Au", "إلى")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent mode="single" selected={exportEndDate ?? undefined} onSelect={(d) => setExportEndDate(d ?? null)} />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider">{tr("Camion", "الشاحنة")}</Label>
              <Select value={exportTruckId} onValueChange={setExportTruckId}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder={tr("Tous les camions", "جميع الشاحنات")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">{tr("Tous les camions", "جميع الشاحنات")}</SelectItem>
                  {trucks.map(trk => (
                    <SelectItem key={trk.id} value={String(trk.id)}>{trk.matricule || trk.name || String(trk.id)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="border-slate-200" onClick={exportCisternPdf}>
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              {tr("Mouvement de Citerne (PDF)", "حركة الصهريج (PDF)")}
            </Button>
            <Button onClick={() => exportTruckPdf(exportTruckId === "__all__" ? "all" : "single")}>
              <Download className="w-4 h-4 mr-2" />
              {exportTruckId === "__all__" ? tr("Tous les Camions (PDF)", "جميع الشاحنات (PDF)") : tr("Consommation Camion (PDF)", "استهلاك الشاحنة (PDF)")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={tankCapacityDialogOpen} onOpenChange={setTankCapacityDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tr("Capacité totale de la citerne", "السعة الكلية للصهريج")}</DialogTitle>
            <DialogDescription>
              {tr("Définissez la capacité maximale utilisée pour le niveau de la citerne.", "حدّد السعة القصوى المستعملة في مستوى الصهريج.")}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="tank-capacity" className="text-right">
                {tr("Capacité (L)", "السعة (لتر)")}
              </Label>
              <Input
                id="tank-capacity"
                type="number"
                min="1"
                className="col-span-3"
                value={tankCapacityInput}
                onChange={(e) => setTankCapacityInput(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setTankCapacityInput(String(Math.round(capacity)));
                setTankCapacityDialogOpen(false);
              }}
            >
              {tr("Annuler", "إلغاء")}
            </Button>
            <Button onClick={saveTankCapacity} disabled={tankCapacitySaving}>
              {tankCapacitySaving ? tr("Enregistrement...", "جارٍ الحفظ...") : tr("Enregistrer", "حفظ")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Purchase Dialog */}
      <Dialog open={purchaseDialogOpen} onOpenChange={setPurchaseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tr('Ajouter un Ravitaillement', 'إضافة تزويد')}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="quantity" className="text-right">
                {tr('Quantité (L)', 'الكمية (لتر)')}
              </Label>
              <Input
                id="quantity"
                type="number"
                className="col-span-3"
                onChange={(e) =>
                  setPurchaseForm({
                    ...purchaseForm,
                    quantityLiters: parseFloat(e.target.value),
                  })
                }
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="price" className="text-right">
                {tr('Prix (MAD)', 'السعر (MAD)')}
              </Label>
              <Input
                id="price"
                type="number"
                className="col-span-3"
                onChange={(e) =>
                  setPurchaseForm({
                    ...purchaseForm,
                    price: parseFloat(e.target.value),
                  })
                }
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="payment" className="text-right">
                {tr('Paiement', 'الدفع')}
              </Label>
              <Select
                onValueChange={(value) =>
                  setPurchaseForm({
                    ...purchaseForm,
                    paymentMethod: value as "Espèces" | "Chèque" | "Virement",
                  })
                }
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder={tr('Méthode', 'الطريقة')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Espèces">{tr('Espèces', 'نقدًا')}</SelectItem>
                  <SelectItem value="Chèque">{tr('Chèque', 'شيك')}</SelectItem>
                  <SelectItem value="Virement">{tr('Virement', 'تحويل')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={addPurchase}>{tr('Enregistrer', 'حفظ')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Consumption Dialog */}
      <Dialog open={consumptionDialogOpen} onOpenChange={setConsumptionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tr('Ajouter une Consommation', 'إضافة استهلاك')}</DialogTitle>
            <DialogDescription>
              {tr('Enregistrez le carburant utilisé par un camion.', 'سجّل الوقود المستعمل من طرف شاحنة.')}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="liters" className="text-right">
                {tr('Litres', 'اللترات')}
              </Label>
              <Input
                id="liters"
                type="number"
                className="col-span-3"
                onChange={(e) =>
                  setConsumptionForm({
                    ...consumptionForm,
                    liters: parseFloat(e.target.value),
                  })
                }
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="driver" className="text-right">
                {tr('Chauffeur', 'السائق')}
              </Label>
              <Select
                onValueChange={(value) => {
                  const selectedDriver = drivers.find((d) => d.id === value);
                  const linkedTrucks = trucks.filter((t) => String(t.driverId) === String(value) && t.matricule);
                  setConsumptionForm({
                    ...consumptionForm,
                    driver: selectedDriver ? selectedDriver.name : "",
                    truck: linkedTrucks.length === 1 ? linkedTrucks[0].matricule : "",
                  });
                  setSelectedDriverId(value);
                }}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder={tr('Sélectionner un chauffeur', 'اختر سائقًا')} />
                </SelectTrigger>
                <SelectContent>
                  {drivers.map((driver) => (
                    <SelectItem key={driver.id} value={driver.id}>
                      {driver.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="truck" className="text-right">
                {tr('Camion', 'الشاحنة')}
              </Label>
              <Select
                onValueChange={(value) =>
                  setConsumptionForm({ ...consumptionForm, truck: value })
                }
                value={consumptionForm.truck}
                disabled={!selectedDriverId}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder={tr('Sélectionner un camion', 'اختر شاحنة')} />
                </SelectTrigger>
                <SelectContent>
                  {trucks
                    .filter((truck) => String(truck.driverId) === String(selectedDriverId) && truck.matricule)
                    .map((truck) => (
                      <SelectItem key={truck.id} value={truck.matricule}>
                        {truck.matricule}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            {/* Nouveau: Kilométrage */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="mileage" className="text-right">
                {tr('Kilométrage (km)', 'المسافة المقطوعة (كم)')}
              </Label>
              <Input
                id="mileage"
                type="number"
                className="col-span-3"
                value={consumptionForm.mileageKm || ""}
                onChange={(e) =>
                  setConsumptionForm({
                    ...consumptionForm,
                    mileageKm: parseFloat(e.target.value) || 0,
                  })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={addConsumption}>{tr('Enregistrer', 'حفظ')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Drain Dialog */}
      <Dialog open={drainDialogOpen} onOpenChange={setDrainDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tr('Vider le réservoir', 'تفريغ الخزان')}</DialogTitle>
            <DialogDescription>
              {tr('Enregistrez une vidange du réservoir. Cela peut être utilisé pour enregistrer la vente de carburant ou corriger le stock.', 'سجّل عملية تفريغ للخزان. يمكن استخدامها لتسجيل بيع الوقود أو تصحيح المخزون.')}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="drain-quantity" className="text-right">
                {tr('Quantité (L)', 'الكمية (لتر)')}
              </Label>
              <Input
                id="drain-quantity"
                type="number"
                className="col-span-3"
                onChange={(e) =>
                  setDrainForm({
                    ...drainForm,
                    quantityLiters: parseFloat(e.target.value),
                  })
                }
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="drain-price" className="text-right">
                {tr('Prix (MAD)', 'السعر (MAD)')}
              </Label>
              <Input
                id="drain-price"
                type="number"
                className="col-span-3"
                onChange={(e) =>
                  setDrainForm({
                    ...drainForm,
                    price: parseFloat(e.target.value),
                  })
                }
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="drain-payment" className="text-right">
                {tr('Paiement', 'الدفع')}
              </Label>
              <Select
                onValueChange={(value) =>
                  setDrainForm({
                    ...drainForm,
                    paymentMethod: value as "Espèces" | "Chèque" | "Virement",
                  })
                }
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder={tr('Méthode', 'الطريقة')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Espèces">{tr('Espèces', 'نقدًا')}</SelectItem>
                  <SelectItem value="Chèque">{tr('Chèque', 'شيك')}</SelectItem>
                  <SelectItem value="Virement">{tr('Virement', 'تحويل')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={addDrain}>{tr('Enregistrer', 'حفظ')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default FuelManagement;
