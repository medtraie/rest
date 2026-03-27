import { useState, useMemo, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { useApp } from "@/contexts/AppContext";
import { OilPurchase, OilConsumption, OilDrain } from "@/types";
import React from "react";
import { Plus, Minus, Droplet, ShoppingCart, History, Trash2, Gauge } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { kvGet, kvSet } from "@/lib/kv";
import { useLanguage } from "@/contexts/LanguageContext";

interface OilBarrelProps {
  level: number;
  levelLabel: string;
}

type BarrelLink = {
  barrelIndex: number;
  barrelName: string;
  capacityLiters: number;
};

const OilBarrel: React.FC<OilBarrelProps> = ({ level, levelLabel }) => {
  const pct = Math.max(0, Math.min(100, level));
  const fillHeight = 125 * (pct / 100);
  const waveA = "M18 0 C35 6 53 -6 70 0 C87 6 105 -6 122 0 L122 140 L18 140 Z";
  const waveB = "M18 0 C35 -5 53 5 70 0 C87 -5 105 5 122 0 L122 140 L18 140 Z";
  const fillColor =
    pct < 30
      ? "from-red-500 via-orange-500 to-amber-400"
      : pct < 60
      ? "from-yellow-500 via-amber-500 to-orange-400"
      : "from-sky-500 via-blue-500 to-indigo-500";

  return (
    <div className="relative w-40 h-44 mx-auto">
      <svg viewBox="0 0 140 160" className="w-full h-full">
        <defs>
          <linearGradient id="oilFillGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#60a5fa" />
            <stop offset="55%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#1e3a8a" />
          </linearGradient>
          <clipPath id="barrelClip">
            <path d="M 30 16 C 18 28, 18 135, 30 146 H 110 C 122 135, 122 28, 110 16 Z" />
          </clipPath>
        </defs>
        <path d="M 30 16 C 18 28, 18 135, 30 146 H 110 C 122 135, 122 28, 110 16 Z" fill="#e2e8f0" />
        <g clipPath="url(#barrelClip)">
          <motion.rect
            x="18"
            y={146 - fillHeight}
            width="104"
            height={fillHeight}
            fill="url(#oilFillGradient)"
            initial={false}
            animate={{ y: 146 - fillHeight, height: fillHeight }}
            transition={{ duration: 0.7, ease: "easeInOut" }}
            opacity={0.95}
          />
          <motion.path
            d={waveA}
            fill="#bfdbfe"
            fillOpacity={0.45}
            initial={false}
            animate={{
              d: [waveA, waveB, waveA],
              y: [146 - fillHeight + 4, 146 - fillHeight - 2, 146 - fillHeight + 4],
            }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.path
            d={waveB}
            fill="#93c5fd"
            fillOpacity={0.35}
            initial={false}
            animate={{
              d: [waveB, waveA, waveB],
              y: [146 - fillHeight + 8, 146 - fillHeight + 3, 146 - fillHeight + 8],
            }}
            transition={{ duration: 2.3, repeat: Infinity, ease: "easeInOut" }}
          />
        </g>
        <path d="M 30 16 C 18 28, 18 135, 30 146 H 110 C 122 135, 122 28, 110 16 Z" fill="none" stroke="#94a3b8" strokeWidth="2.5" />
        <path d="M 23 55 C 15 60, 15 100, 23 105" fill="none" stroke="#94a3b8" strokeWidth="1.5" />
        <path d="M 117 55 C 125 60, 125 100, 117 105" fill="none" stroke="#94a3b8" strokeWidth="1.5" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-3xl font-bold text-slate-700">{pct.toFixed(1)}%</span>
        <span className={`mt-1 rounded-full px-2 py-0.5 text-[11px] font-semibold text-white bg-gradient-to-r ${fillColor}`}>
          {levelLabel}
        </span>
      </div>
    </div>
  );
};

function OilManagement() {
  const {
    oilPurchases,
    addOilPurchase,
    oilConsumptions,
    addOilConsumption,
    oilDrains,
    addOilDrain,
    addCashOperation,
  } = useApp();
  const { language } = useLanguage();
  const tr = (frText: string, arText: string) => (language === "ar" ? arText : frText);
  const uiLocale = language === "ar" ? "ar-MA" : "fr-MA";

  const [barrelCount, setBarrelCount] = useState<number>(() => {
    const raw = localStorage.getItem("oilManagement.barrelCount");
    return raw ? parseInt(raw) : 2;
  });
  const adjustBarrelCount = (delta: number) => {
    setBarrelCount((prev) => Math.max(1, Math.min(20, prev + delta)));
  };
  const [barrelsConfig, setBarrelsConfig] = useState<Array<{ name: string; capacityLiters: number }>>(() => {
    const raw = localStorage.getItem("oilManagement.barrelsConfig");
    const initial = raw
      ? JSON.parse(raw)
      : Array.from({ length: barrelCount }, (_, i) => ({ name: `${tr("Baril", "برميل")} ${i + 1}`, capacityLiters: 220 }));
    return initial.slice(0, barrelCount);
  });
  const [purchaseLinks, setPurchaseLinks] = useState<Record<string, BarrelLink>>(() => {
    try {
      return JSON.parse(localStorage.getItem("oilManagement.purchaseLinks") || "{}");
    } catch {
      return {};
    }
  });
  const [consumptionLinks, setConsumptionLinks] = useState<Record<string, BarrelLink>>(() => {
    try {
      return JSON.parse(localStorage.getItem("oilManagement.consumptionLinks") || "{}");
    } catch {
      return {};
    }
  });
  const [drainLinks, setDrainLinks] = useState<Record<string, BarrelLink>>(() => {
    try {
      return JSON.parse(localStorage.getItem("oilManagement.drainLinks") || "{}");
    } catch {
      return {};
    }
  });
  const [selectedPurchaseBarrel, setSelectedPurchaseBarrel] = useState<number>(0);
  const [selectedConsumptionBarrel, setSelectedConsumptionBarrel] = useState<number>(0);
  const [selectedDrainBarrel, setSelectedDrainBarrel] = useState<number>(0);

  useEffect(() => {
    setBarrelsConfig((prev) => {
      const next = Array.from({ length: barrelCount }, (_, i) => prev[i] || { name: `${tr("Baril", "برميل")} ${i + 1}`, capacityLiters: 220 });
      return next;
    });
  }, [barrelCount]);

  useEffect(() => {
    const sync = async () => {
      try {
        const [savedBarrelCount, savedBarrelsConfig, savedPurchaseLinks, savedConsumptionLinks, savedDrainLinks] = await Promise.all([
          kvGet<number>("oilManagement.barrelCount"),
          kvGet<Array<{ name: string; capacityLiters: number }>>("oilManagement.barrelsConfig"),
          kvGet<Record<string, BarrelLink>>("oilManagement.purchaseLinks"),
          kvGet<Record<string, BarrelLink>>("oilManagement.consumptionLinks"),
          kvGet<Record<string, BarrelLink>>("oilManagement.drainLinks"),
        ]);
        if (typeof savedBarrelCount === "number" && savedBarrelCount > 0) setBarrelCount(Math.min(20, Math.max(1, savedBarrelCount)));
        if (Array.isArray(savedBarrelsConfig) && savedBarrelsConfig.length > 0) setBarrelsConfig(savedBarrelsConfig);
        if (savedPurchaseLinks && typeof savedPurchaseLinks === "object") setPurchaseLinks(savedPurchaseLinks);
        if (savedConsumptionLinks && typeof savedConsumptionLinks === "object") setConsumptionLinks(savedConsumptionLinks);
        if (savedDrainLinks && typeof savedDrainLinks === "object") setDrainLinks(savedDrainLinks);
      } catch {
      }
    };
    sync();
  }, []);

  const formatMAD = (amount: number) =>
    new Intl.NumberFormat(uiLocale, { style: "currency", currency: "MAD", minimumFractionDigits: 2 }).format(amount);
  const purchaseCapacitiesLegacy = useMemo<Record<string | number, number>>(() => {
    try { return JSON.parse(localStorage.getItem("oilManagement.purchaseCapacities") || "{}"); }
    catch { return {}; }
  }, [oilPurchases]);
  const consumptionCapacitiesLegacy = useMemo<Record<string | number, number>>(() => {
    try { return JSON.parse(localStorage.getItem("oilManagement.consumptionCapacities") || "{}"); }
    catch { return {}; }
  }, [oilConsumptions]);
  const resolvePurchaseCapacity = (id: string | number) =>
    purchaseLinks[String(id)]?.capacityLiters ?? purchaseCapacitiesLegacy[id] ?? 220;
  const resolveConsumptionCapacity = (id: string | number) =>
    consumptionLinks[String(id)]?.capacityLiters ?? consumptionCapacitiesLegacy[id] ?? 220;
  const resolveDrainCapacity = (id: string | number) => drainLinks[String(id)]?.capacityLiters ?? 220;
  const totalPurchasedLiters = useMemo(
    () => oilPurchases.reduce((s, p) => s + p.quantity * resolvePurchaseCapacity(p.id), 0),
    [oilPurchases, purchaseLinks, purchaseCapacitiesLegacy]
  );
  const totalConsumedLiters = useMemo(
    () => oilConsumptions.reduce((s, c) => s + c.quantity * resolveConsumptionCapacity(c.id), 0),
    [oilConsumptions, consumptionLinks, consumptionCapacitiesLegacy]
  );
  const totalDrainedLiters = useMemo(
    () => oilDrains.reduce((s, d) => s + d.quantity * resolveDrainCapacity(d.id), 0),
    [oilDrains, drainLinks]
  );
  const totalCapacityLiters = useMemo(
    () => barrelsConfig.reduce((sum, b) => sum + b.capacityLiters, 0),
    [barrelsConfig]
  );
  const totalPurchasedAmount = useMemo(() => oilPurchases.reduce((s, p) => s + (p.price || 0), 0), [oilPurchases]);
  const averagePricePerLiter = totalPurchasedLiters > 0 ? totalPurchasedAmount / totalPurchasedLiters : 0;
  const toDate = (value: Date | string) => (value instanceof Date ? value : new Date(value));
  const sortedPurchases = useMemo(() => [...oilPurchases].sort((a, b) => +toDate(b.date) - +toDate(a.date)), [oilPurchases]);
  const sortedConsumptions = useMemo(() => [...oilConsumptions].sort((a, b) => +toDate(b.date) - +toDate(a.date)), [oilConsumptions]);
  const sortedDrains = useMemo(() => [...oilDrains].sort((a, b) => +toDate(b.date) - +toDate(a.date)), [oilDrains]);
  const barrelMetrics = useMemo(() => {
    return barrelsConfig.map((barrel, index) => {
      const purchased = oilPurchases.reduce((sum, p) => {
        const link = purchaseLinks[String(p.id)];
        if (link?.barrelIndex !== index) return sum;
        return sum + p.quantity * link.capacityLiters;
      }, 0);
      const consumed = oilConsumptions.reduce((sum, c) => {
        const link = consumptionLinks[String(c.id)];
        if (link?.barrelIndex !== index) return sum;
        return sum + c.quantity * link.capacityLiters;
      }, 0);
      const drained = oilDrains.reduce((sum, d) => {
        const link = drainLinks[String(d.id)];
        if (link?.barrelIndex !== index) return sum;
        return sum + d.quantity * link.capacityLiters;
      }, 0);
      const currentLiters = Math.max(0, purchased - consumed - drained);
      const levelPct = barrel.capacityLiters > 0 ? Math.min(100, (currentLiters / barrel.capacityLiters) * 100) : 0;
      return { index, ...barrel, purchased, consumed, drained, currentLiters, levelPct };
    });
  }, [barrelsConfig, oilPurchases, oilConsumptions, oilDrains, purchaseLinks, consumptionLinks, drainLinks]);
  const baseStockLiters = 0;
  const currentStockLiters = baseStockLiters + totalPurchasedLiters - totalConsumedLiters - totalDrainedLiters;
  const oilLevelPct = totalCapacityLiters > 0 ? Math.min(100, Math.max(0, (currentStockLiters / totalCapacityLiters) * 100)) : 0;
  const stockStateLabel = oilLevelPct > 70 ? tr("Niveau optimal", "مستوى ممتاز") : oilLevelPct > 30 ? tr("Niveau moyen", "مستوى متوسط") : tr("Niveau bas", "مستوى منخفض");

  useEffect(() => {
    const persist = async () => {
      localStorage.setItem("oilManagement.barrelCount", barrelCount.toString());
      await kvSet("oilManagement.barrelCount", barrelCount);
    };
    persist();
  }, [barrelCount]);

  useEffect(() => {
    const normalized = Array.from({ length: barrelCount }, (_, i) => barrelsConfig[i] || { name: `${tr("Baril", "برميل")} ${i + 1}`, capacityLiters: 220 });
    localStorage.setItem("oilManagement.barrelsConfig", JSON.stringify(normalized));
    kvSet("oilManagement.barrelsConfig", normalized);
  }, [barrelsConfig, barrelCount]);

  useEffect(() => {
    localStorage.setItem("oilManagement.purchaseLinks", JSON.stringify(purchaseLinks));
    kvSet("oilManagement.purchaseLinks", purchaseLinks);
  }, [purchaseLinks]);

  useEffect(() => {
    localStorage.setItem("oilManagement.consumptionLinks", JSON.stringify(consumptionLinks));
    kvSet("oilManagement.consumptionLinks", consumptionLinks);
  }, [consumptionLinks]);

  useEffect(() => {
    localStorage.setItem("oilManagement.drainLinks", JSON.stringify(drainLinks));
    kvSet("oilManagement.drainLinks", drainLinks);
  }, [drainLinks]);

  useEffect(() => {
    const purchasesLS = oilPurchases.map((p) => ({
      date: p.date,
      quantityLiters: (p.quantity || 0) * resolvePurchaseCapacity(p.id),
    }));
    const consumptionsLS = [
      ...oilConsumptions.map((c) => ({
        date: c.date,
        quantityLiters: (c.quantity || 0) * resolveConsumptionCapacity(c.id),
      })),
      ...oilDrains.map((d) => ({
        date: d.date,
        quantityLiters: (d.quantity || 0) * resolveDrainCapacity(d.id),
      })),
    ];
    localStorage.setItem("oilManagement.purchases", JSON.stringify(purchasesLS));
    localStorage.setItem("oilManagement.consumptions", JSON.stringify(consumptionsLS));
    localStorage.setItem("oilManagement.baseStockLiters", "0");
  }, [oilPurchases, oilConsumptions, oilDrains, purchaseLinks, consumptionLinks, drainLinks, purchaseCapacitiesLegacy, consumptionCapacitiesLegacy]);

  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [consumptionDialogOpen, setConsumptionDialogOpen] = useState(false);
  const [drainDialogOpen, setDrainDialogOpen] = useState(false);

  const [purchaseForm, setPurchaseForm] = useState<Omit<OilPurchase, "id">>({
    date: new Date(),
    quantity: 0,
    price: 0,
    paymentMethod: "cash",
  });
  const [consumptionForm, setConsumptionForm] = useState<
    Omit<OilConsumption, "id">
  >({
    date: new Date(),
    quantity: 0,
    driver: "",
    truck: "",
  });
  const [drainForm, setDrainForm] = useState<Omit<OilDrain, "id">>({
    date: new Date(),
    quantity: 0,
    price: 0,
    paymentMethod: "cash",
  });

  const addPurchase = async () => {
    if (!purchaseForm.quantity || purchaseForm.quantity <= 0 || !purchaseForm.price || purchaseForm.price <= 0) {
      toast.error(tr("Veuillez saisir une quantité et un prix valides.", "يرجى إدخال كمية وسعر صالحين."));
      return;
    }
    const barrel = barrelsConfig[selectedPurchaseBarrel] || { name: `${tr("Baril", "برميل")} ${selectedPurchaseBarrel + 1}`, capacityLiters: 220 };
    const newPurchase: OilPurchase = { id: Date.now(), ...purchaseForm };
    await addOilPurchase(newPurchase);
    setPurchaseLinks((prev) => ({
      ...prev,
      [String(newPurchase.id)]: {
        barrelIndex: selectedPurchaseBarrel,
        barrelName: barrel.name,
        capacityLiters: barrel.capacityLiters,
      },
    }));
    const accountAffected =
      purchaseForm.paymentMethod === "cash"
        ? "espece"
        : purchaseForm.paymentMethod === "check"
        ? "cheque"
        : "autre";
    await addCashOperation({
      id: Date.now(),
      date: newPurchase.date,
      description: language === "ar" ? `شراء زيت - ${newPurchase.quantity} برميل` : `Achat d'huile - ${newPurchase.quantity} barils`,
      amount: newPurchase.price,
      type: "retrait",
      category: "Achat",
      paymentMethod: purchaseForm.paymentMethod,
      status: "pending",
      accountAffected,
    });
    setPurchaseForm({ date: new Date(), quantity: 0, price: 0, paymentMethod: "cash" });
    setPurchaseDialogOpen(false);
    toast.success(tr("Ravitaillement huile enregistré.", "تم تسجيل تموين الزيت."));
  };

  const addConsumption = async () => {
    if (!consumptionForm.quantity || consumptionForm.quantity <= 0 || !consumptionForm.driver || !consumptionForm.truck) {
      toast.error(tr("Veuillez renseigner quantité, chauffeur et camion.", "يرجى إدخال الكمية والسائق والشاحنة."));
      return;
    }
    const barrel = barrelsConfig[selectedConsumptionBarrel] || { name: `${tr("Baril", "برميل")} ${selectedConsumptionBarrel + 1}`, capacityLiters: 220 };
    const newConsumption: OilConsumption = { id: Date.now(), ...consumptionForm };
    await addOilConsumption(newConsumption);
    setConsumptionLinks((prev) => ({
      ...prev,
      [String(newConsumption.id)]: {
        barrelIndex: selectedConsumptionBarrel,
        barrelName: barrel.name,
        capacityLiters: barrel.capacityLiters,
      },
    }));
    setConsumptionForm({ date: new Date(), quantity: 0, driver: "", truck: "" });
    setConsumptionDialogOpen(false);
    toast.success(tr("Consommation huile enregistrée.", "تم تسجيل استهلاك الزيت."));
  };

  const addDrain = async () => {
    if (!drainForm.quantity || drainForm.quantity <= 0 || !drainForm.price || drainForm.price <= 0) {
      toast.error(tr("Veuillez saisir une quantité et un prix valides.", "يرجى إدخال كمية وسعر صالحين."));
      return;
    }
    const barrel = barrelsConfig[selectedDrainBarrel] || { name: `${tr("Baril", "برميل")} ${selectedDrainBarrel + 1}`, capacityLiters: 220 };
    const newDrain: OilDrain = { id: Date.now(), ...drainForm };
    await addOilDrain(newDrain);
    setDrainLinks((prev) => ({
      ...prev,
      [String(newDrain.id)]: {
        barrelIndex: selectedDrainBarrel,
        barrelName: barrel.name,
        capacityLiters: barrel.capacityLiters,
      },
    }));
    const accountAffected =
      drainForm.paymentMethod === "cash"
        ? "espece"
        : drainForm.paymentMethod === "check"
        ? "cheque"
        : "autre";
    await addCashOperation({
      id: Date.now(),
      date: newDrain.date,
      description: language === "ar" ? `تفريغ براميل الزيت - ${newDrain.quantity} برميل` : `Vidange barils d'huile - ${newDrain.quantity} barils`,
      amount: newDrain.price,
      type: "retrait",
      category: "Achat",
      paymentMethod: drainForm.paymentMethod,
      status: "pending",
      accountAffected,
    });
    setDrainForm({ date: new Date(), quantity: 0, price: 0, paymentMethod: "cash" });
    setDrainDialogOpen(false);
    toast.success(tr("Vidange huile enregistrée.", "تم تسجيل تفريغ الزيت."));
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="app-page-shell space-y-8"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="app-page-title text-3xl font-bold tracking-tight">{tr("Gestion de l'Huile", "إدارة الزيت")}</h1>
          <p className="app-page-subtitle text-muted-foreground">{tr("Suivez les stocks de barils et la consommation par véhicule.", "تتبّع مخزون البراميل واستهلاك كل مركبة.")}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="overflow-hidden">
          <CardHeader className="bg-blue-50/50 border-b">
            <CardTitle className="flex items-center gap-2 text-blue-700">
              <Droplet className="w-5 h-5" />
              {tr("État du Stock Huile", "حالة مخزون الزيت")}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 flex flex-col items-center justify-center space-y-5">
            <OilBarrel level={oilLevelPct} levelLabel={tr("Niveau huile", "مستوى الزيت")} />
            <div className="text-center">
              <p className="text-3xl font-bold">{oilLevelPct.toFixed(1)}%</p>
              <Badge variant={oilLevelPct > 70 ? "default" : oilLevelPct > 30 ? "secondary" : "destructive"} className="mt-1">
                {stockStateLabel}
              </Badge>
              <p className="mt-3 text-xl font-bold">{Math.max(0, Math.round(currentStockLiters)).toLocaleString(uiLocale)} L</p>
              <p className="text-xs text-muted-foreground">{tr("Stock actuel", "المخزون الحالي")} / {Math.round(totalCapacityLiters).toLocaleString(uiLocale)} L</p>
            </div>
            <div className="w-full flex items-center justify-between pt-3 border-t">
              <Label className="text-sm font-medium">{tr("Nombre de Barils", "عدد البراميل")}</Label>
              <div className="flex items-center bg-secondary/50 rounded-lg p-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => adjustBarrelCount(-1)} disabled={barrelCount <= 1}>
                  <Minus className="w-4 h-4" />
                </Button>
                <span className="text-sm font-bold w-12 text-center">{barrelCount}</span>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => adjustBarrelCount(1)} disabled={barrelCount >= 20}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-green-500" onClick={() => setPurchaseDialogOpen(true)}>
            <CardContent className="pt-6 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{tr("Ravitaillements", "التموينات")}</p>
                <p className="text-2xl font-bold">{oilPurchases.length}</p>
              </div>
              <ShoppingCart className="w-6 h-6 text-green-600" />
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-blue-500" onClick={() => setConsumptionDialogOpen(true)}>
            <CardContent className="pt-6 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{tr("Consommations", "الاستهلاكات")}</p>
                <p className="text-2xl font-bold">{oilConsumptions.length}</p>
              </div>
              <Droplet className="w-6 h-6 text-blue-600" />
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-rose-500" onClick={() => setDrainDialogOpen(true)}>
            <CardContent className="pt-6 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{tr("Vidanges", "عمليات التفريغ")}</p>
                <p className="text-2xl font-bold">{oilDrains.length}</p>
              </div>
              <Trash2 className="w-6 h-6 text-rose-600" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{tr("Prix moyen/L", "متوسط السعر/لتر")}</p>
                <p className="text-2xl font-bold">{formatMAD(averagePricePerLiter || 0)}</p>
              </div>
              <Gauge className="w-6 h-6 text-primary" />
            </CardContent>
          </Card>

          <Card className="sm:col-span-2 lg:col-span-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{tr("Répartition dynamique par Baril", "توزيع ديناميكي حسب البرميل")}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {barrelMetrics.map((barrel, idx) => (
                <motion.div
                  key={`${barrel.name}-${idx}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: idx * 0.05 }}
                  className="rounded-xl border bg-card p-3"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">{barrel.name}</p>
                    <Badge variant="outline">{barrel.capacityLiters} L</Badge>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.max(0, Math.min(100, barrel.levelPct))}%` }}
                      transition={{ duration: 0.6, ease: "easeInOut" }}
                      className="h-full rounded-full bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-600"
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{Math.round(barrel.currentLiters).toLocaleString(uiLocale)} L</span>
                    <span>{Math.round(barrel.levelPct)}%</span>
                  </div>
                </motion.div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between bg-muted/30">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-primary" />
              <CardTitle>{tr("Tableau Ravitaillements", "جدول التموينات")}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[400px] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                  <TableRow>
                    <TableHead>{tr("Date", "التاريخ")}</TableHead>
                    <TableHead>{tr("Quantité", "الكمية")}</TableHead>
                    <TableHead>{tr("Baril", "البرميل")}</TableHead>
                    <TableHead>{tr("Volume", "الحجم")}</TableHead>
                    <TableHead>{tr("Prix Total", "السعر الإجمالي")}</TableHead>
                    <TableHead>{tr("Mode", "الطريقة")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <AnimatePresence>
                    {sortedPurchases.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                          {tr("Aucun achat enregistré", "لا توجد عمليات شراء مسجلة")}
                        </TableCell>
                      </TableRow>
                    ) : (
                      sortedPurchases.map((p, idx) => (
                        <motion.tr 
                          key={p.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: idx * 0.05 }}
                        >
                          <TableCell className="font-medium">{new Date(p.date).toLocaleDateString(uiLocale)}</TableCell>
                          <TableCell>{p.quantity} {tr("barils", "براميل")}</TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">{purchaseLinks[String(p.id)]?.barrelName || tr("Baril non défini", "برميل غير محدد")}</span>
                              <span className="text-xs text-muted-foreground">{resolvePurchaseCapacity(p.id)} L</span>
                            </div>
                          </TableCell>
                          <TableCell>{((p.quantity || 0) * resolvePurchaseCapacity(p.id)).toLocaleString(uiLocale)} L</TableCell>
                          <TableCell className="font-bold">{formatMAD(p.price)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">{p.paymentMethod}</Badge>
                          </TableCell>
                        </motion.tr>
                      ))
                    )}
                  </AnimatePresence>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between bg-muted/30">
            <div className="flex items-center gap-2">
              <Droplet className="w-5 h-5 text-primary" />
              <CardTitle>{tr("Tableau Consommations", "جدول الاستهلاكات")}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[400px] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                  <TableRow>
                    <TableHead>{tr("Date", "التاريخ")}</TableHead>
                    <TableHead>{tr("Véhicule / Chauffeur", "المركبة / السائق")}</TableHead>
                    <TableHead>{tr("Quantité", "الكمية")}</TableHead>
                    <TableHead>{tr("Baril", "البرميل")}</TableHead>
                    <TableHead>{tr("Volume", "الحجم")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <AnimatePresence>
                    {sortedConsumptions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                          {tr("Aucune consommation enregistrée", "لا توجد استهلاكات مسجلة")}
                        </TableCell>
                      </TableRow>
                    ) : (
                      sortedConsumptions.map((c, idx) => (
                        <motion.tr 
                          key={c.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: idx * 0.05 }}
                        >
                          <TableCell className="font-medium">{new Date(c.date).toLocaleDateString(uiLocale)}</TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">{c.truck}</span>
                              <span className="text-xs text-muted-foreground">{c.driver}</span>
                            </div>
                          </TableCell>
                          <TableCell>{c.quantity} {tr("barils", "براميل")}</TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">{consumptionLinks[String(c.id)]?.barrelName || tr("Baril non défini", "برميل غير محدد")}</span>
                              <span className="text-xs text-muted-foreground">{resolveConsumptionCapacity(c.id)} L</span>
                            </div>
                          </TableCell>
                          <TableCell>{((c.quantity || 0) * resolveConsumptionCapacity(c.id)).toLocaleString(uiLocale)} L</TableCell>
                        </motion.tr>
                      ))
                    )}
                  </AnimatePresence>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between bg-muted/30">
          <div className="flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-rose-600" />
            <CardTitle>{tr("Tableau Vidanges", "جدول التفريغ")}</CardTitle>
          </div>
          <Button size="sm" variant="outline" onClick={() => setDrainDialogOpen(true)} className="text-red-600 hover:bg-red-50 gap-2">
            <Trash2 className="w-4 h-4" />
            {tr("Nouvelle vidange", "تفريغ جديد")}
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[320px] overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                <TableRow>
                  <TableHead>{tr("Date", "التاريخ")}</TableHead>
                  <TableHead>{tr("Quantité", "الكمية")}</TableHead>
                  <TableHead>{tr("Baril", "البرميل")}</TableHead>
                  <TableHead>{tr("Volume", "الحجم")}</TableHead>
                  <TableHead>{tr("Prix", "السعر")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <AnimatePresence>
                  {sortedDrains.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                        {tr("Aucune vidange enregistrée", "لا توجد عمليات تفريغ مسجلة")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedDrains.map((d, idx) => (
                      <motion.tr
                        key={d.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: idx * 0.04 }}
                      >
                        <TableCell className="font-medium">{new Date(d.date).toLocaleDateString(uiLocale)}</TableCell>
                        <TableCell>{d.quantity} {tr("barils", "براميل")}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{drainLinks[String(d.id)]?.barrelName || tr("Baril non défini", "برميل غير محدد")}</span>
                            <span className="text-xs text-muted-foreground">{resolveDrainCapacity(d.id)} L</span>
                          </div>
                        </TableCell>
                        <TableCell>{((d.quantity || 0) * resolveDrainCapacity(d.id)).toLocaleString(uiLocale)} L</TableCell>
                        <TableCell className="font-bold">{formatMAD(d.price)}</TableCell>
                      </motion.tr>
                    ))
                  )}
                </AnimatePresence>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Purchase Dialog */}
      <Dialog open={purchaseDialogOpen} onOpenChange={setPurchaseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tr("Ajouter un Achat d'Huile", "إضافة شراء زيت")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="quantity" className="text-right">
                {tr("Quantité (barils)", "الكمية (براميل)")}
              </Label>
              <Input
                id="quantity"
                type="number"
                className="col-span-3"
                onChange={(e) =>
                  setPurchaseForm({
                    ...purchaseForm,
                    quantity: parseInt(e.target.value),
                  })
                }
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="price" className="text-right">
                {tr("Prix (MAD)", "السعر (MAD)")}
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
                {tr("Paiement", "الدفع")}
              </Label>
              <Select
                onValueChange={(value) =>
                  setPurchaseForm({
                    ...purchaseForm,
                    paymentMethod: value as "cash" | "credit" | "check",
                  })
                }
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder={tr("Méthode", "الطريقة")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">{tr("Cash", "نقدًا")}</SelectItem>
                  <SelectItem value="credit">{tr("Credit", "آجل")}</SelectItem>
                  <SelectItem value="check">{tr("Check", "شيك")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">{tr("Baril lié", "البرميل المرتبط")}</Label>
              <Select value={String(selectedPurchaseBarrel)} onValueChange={(value) => setSelectedPurchaseBarrel(parseInt(value))}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder={tr("Choisir un baril", "اختر برميلاً")} />
                </SelectTrigger>
                <SelectContent>
                  {barrelsConfig.map((b, idx) => (
                    <SelectItem key={`p-${idx}`} value={String(idx)}>
                      {b.name} ({b.capacityLiters} L)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={addPurchase}>{tr("Enregistrer", "حفظ")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Consumption Dialog */}
      <Dialog open={consumptionDialogOpen} onOpenChange={setConsumptionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tr("Ajouter une Consommation", "إضافة استهلاك")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="c-quantity" className="text-right">
                {tr("Quantité (barils)", "الكمية (براميل)")}
              </Label>
              <Input
                id="c-quantity"
                type="number"
                className="col-span-3"
                onChange={(e) =>
                  setConsumptionForm({
                    ...consumptionForm,
                    quantity: parseInt(e.target.value),
                  })
                }
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="driver" className="text-right">
                {tr("Chauffeur", "السائق")}
              </Label>
              <Input
                id="driver"
                className="col-span-3"
                onChange={(e) =>
                  setConsumptionForm({ ...consumptionForm, driver: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="truck" className="text-right">
                {tr("Camion", "الشاحنة")}
              </Label>
              <Input
                id="truck"
                className="col-span-3"
                onChange={(e) =>
                  setConsumptionForm({ ...consumptionForm, truck: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">{tr("Baril lié", "البرميل المرتبط")}</Label>
              <Select value={String(selectedConsumptionBarrel)} onValueChange={(value) => setSelectedConsumptionBarrel(parseInt(value))}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder={tr("Choisir un baril", "اختر برميلاً")} />
                </SelectTrigger>
                <SelectContent>
                  {barrelsConfig.map((b, idx) => (
                    <SelectItem key={`c-${idx}`} value={String(idx)}>
                      {b.name} ({b.capacityLiters} L)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={addConsumption}>{tr("Enregistrer", "حفظ")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Drain Dialog */}
      <Dialog open={drainDialogOpen} onOpenChange={setDrainDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tr("Vider barils d'huile", "تفريغ براميل الزيت")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="d-quantity" className="text-right">
                {tr("Quantité (barils)", "الكمية (براميل)")}
              </Label>
              <Input
                id="d-quantity"
                type="number"
                className="col-span-3"
                onChange={(e) =>
                  setDrainForm({
                    ...drainForm,
                    quantity: parseInt(e.target.value),
                  })
                }
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="d-price" className="text-right">
                {tr("Prix (MAD)", "السعر (MAD)")}
              </Label>
              <Input
                id="d-price"
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
              <Label className="text-right">{tr("Baril lié", "البرميل المرتبط")}</Label>
              <Select value={String(selectedDrainBarrel)} onValueChange={(value) => setSelectedDrainBarrel(parseInt(value))}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder={tr("Choisir un baril", "اختر برميلاً")} />
                </SelectTrigger>
                <SelectContent>
                  {barrelsConfig.map((b, idx) => (
                    <SelectItem key={`d-${idx}`} value={String(idx)}>
                      {b.name} ({b.capacityLiters} L)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={addDrain}>{tr("Enregistrer", "حفظ")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="mt-4">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{tr("Configuration des Barils", "إعدادات البراميل")}</CardTitle>
          <Badge variant="secondary">{barrelsConfig.length} {tr("barils configurés", "براميل مهيأة")}</Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          {barrelsConfig.map((b, idx) => (
            <div key={idx} className="grid grid-cols-1 md:grid-cols-12 items-center gap-3 rounded-lg border p-3">
              <div className="md:col-span-2">
                <p className="text-xs text-muted-foreground">{tr("Baril", "برميل")}</p>
                <p className="font-semibold">#{idx + 1}</p>
              </div>
              <div className="md:col-span-6">
                <Label>{tr("Nom", "الاسم")}</Label>
                <Input
                  value={b.name}
                  onChange={(e) => {
                    const next = [...barrelsConfig];
                    next[idx] = { ...next[idx], name: e.target.value };
                    setBarrelsConfig(next);
                  }}
                />
              </div>
              <div className="md:col-span-4">
                <Label>{tr("Capacité (L)", "السعة (لتر)")}</Label>
                <Select
                  value={String(b.capacityLiters)}
                  onValueChange={(v) => {
                    const next = [...barrelsConfig];
                    next[idx] = { ...next[idx], capacityLiters: parseInt(v) };
                    setBarrelsConfig(next);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={tr("Choisir", "اختيار")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="60">60</SelectItem>
                    <SelectItem value="220">220</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default OilManagement;
