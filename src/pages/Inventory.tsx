import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useApp } from '@/contexts/AppContext';
import { Package, Edit, TrendingDown, TrendingUp, Eye, EyeOff, Archive, Truck, PackageCheck, AlertTriangle, Plus, Minus, Package2, ChevronDown, ChevronUp, History, Trash2 } from 'lucide-react';
import { AddBottleTypeDialog } from '@/components/dialogs/AddBottleTypeDialog';
import { EditBottleTypeDialog } from '@/components/dialogs/EditBottleTypeDialog';
import { BottleHistoryDialog } from '@/components/dialogs/BottleHistoryDialog';
import { BottleType } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AddEmptyStockDialog } from '@/components/dialogs/AddEmptyStockDialog';
import { AddDefectiveStockDialog } from '@/components/dialogs/AddDefectiveStockDialog';
import { format } from 'date-fns';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { safeDate } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import { kvGet, kvSet } from '@/lib/kv';
import { useLanguage, useT } from '@/contexts/LanguageContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const bottleColorPalette = ['#2563eb', '#16a34a', '#ef4444', '#f59e0b', '#111827', '#06b6d4', '#7c3aed', '#f97316'];

const sanitizeBottleColor = (value: unknown, fallback: string) => {
  const raw = String(value ?? '').trim();
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw;
  if (/^#[0-9a-fA-F]{3}$/.test(raw)) {
    const v = raw.slice(1);
    return `#${v[0]}${v[0]}${v[1]}${v[1]}${v[2]}${v[2]}`;
  }
  return fallback;
};

const colorForBottle = (bottle: BottleType, index: number) => {
  const fallback = bottleColorPalette[index % bottleColorPalette.length];
  return sanitizeBottleColor((bottle as any).color, fallback);
};

const hexToRgba = (hex: string, alpha: number) => {
  const parsed = sanitizeBottleColor(hex, '#2563eb').replace('#', '');
  const r = parseInt(parsed.slice(0, 2), 16);
  const g = parseInt(parsed.slice(2, 4), 16);
  const b = parseInt(parsed.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
};

const AnimatedBottleGlyph = ({ color, delay = 0 }: { color: string; delay?: number }) => (
  <motion.svg
    viewBox="0 0 64 64"
    className="w-9 h-9"
    initial={{ opacity: 0, y: 6, scale: 0.94 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    transition={{ duration: 0.35, ease: 'easeOut', delay }}
  >
    <motion.rect
      x="24"
      y="5"
      width="16"
      height="6"
      rx="2"
      fill={hexToRgba(color, 0.2)}
      stroke={hexToRgba(color, 0.9)}
      strokeWidth="1.5"
    />
    <motion.path
      d="M18 13h28v7H18z"
      fill={hexToRgba(color, 0.18)}
      stroke={hexToRgba(color, 0.9)}
      strokeWidth="1.5"
    />
    <motion.rect
      x="14"
      y="20"
      width="36"
      height="34"
      rx="10"
      fill={hexToRgba(color, 0.2)}
      stroke={hexToRgba(color, 0.95)}
      strokeWidth="2"
      animate={{ y: [0, -1.5, 0] }}
      transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut', delay }}
    />
    <motion.path
      d="M14 37h36"
      stroke={hexToRgba(color, 0.95)}
      strokeWidth="2"
      strokeLinecap="round"
    />
    <motion.ellipse
      cx="32"
      cy="58"
      rx="18"
      ry="4"
      fill={hexToRgba(color, 0.18)}
      animate={{ opacity: [0.25, 0.45, 0.25] }}
      transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut', delay }}
    />
  </motion.svg>
);

const Inventory = () => {
  const t = useT();
  const { language } = useLanguage();
  const uiLocale = language === 'ar' ? 'ar-MA' : 'fr-MA';
  const dayUnit = language === 'ar' ? 'ي' : 'j';
  const { bottleTypes, emptyBottlesStock = [], defectiveBottles = [], transactions = [], returnOrders = [], foreignBottles = [], trucks = [], drivers = [], supplyOrders = [], stockHistory = [], clearAllInventory, updateBottleType, addStockHistory, currentUserEmail } = useApp();
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const selectedBottle = React.useMemo(() => 
    bottleTypes.find(b => b.id === selectedBottleId) || null,
    [bottleTypes, selectedBottleId]
  );
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [showTotalValue, setShowTotalValue] = useState(false);
  const [selectedEmptyBottleType, setSelectedEmptyBottleType] = useState<BottleType | null>(null);
  const [selectedDefectiveBottleType, setSelectedDefectiveBottleType] = useState<BottleType | null>(null);
  const [emptyStockDialogOpen, setEmptyStockDialogOpen] = useState(false);
  const [defectiveStockDialogOpen, setDefectiveStockDialogOpen] = useState(false);
  const [impactPanelVisible, setImpactPanelVisible] = useState(true);
  const [impactView, setImpactView] = useState<'today' | 'last7days'>('today');
  const [showEmpty, setShowEmpty] = useState(true);
  const [showDefective, setShowDefective] = useState(true);
  const [confirmClearDialogOpen, setConfirmClearDialogOpen] = useState(false);
  const [deleteConfirmDialogOpen, setDeleteConfirmDialogOpen] = useState(false);
  const [bottleToDelete, setBottleToDelete] = useState<BottleType | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'critical' | 'low' | 'normal'>('all');
  const [sortMode, setSortMode] = useState<'name' | 'stock' | 'distribution'>('stock');
  const [showQuickStats, setShowQuickStats] = useState(true);
  const [stockPilotMode, setStockPilotMode] = useState<'defense' | 'rotation' | 'equilibre' | 'custom'>('equilibre');
  const [replenishmentHorizon, setReplenishmentHorizon] = useState<'14' | '30' | '60'>('30');
  const [emptySortMode, setEmptySortMode] = useState<'qty' | 'date' | 'name'>('qty');
  const [defectiveSortMode, setDefectiveSortMode] = useState<'qty' | 'date' | 'name'>('qty');
  const [emptyCriticalOnly, setEmptyCriticalOnly] = useState(false);
  const [defectiveCriticalOnly, setDefectiveCriticalOnly] = useState(false);
  const [thresholdsByBottle, setThresholdsByBottle] = useState<Record<string, number>>({});
  const [stockAdjustByBottle, setStockAdjustByBottle] = useState<Record<string, string>>({});
  const [adjustModeByBottle, setAdjustModeByBottle] = useState<Record<string, 'add' | 'remove'>>({});
  const [adjustingBottleId, setAdjustingBottleId] = useState<string | null>(null);
  const MotionTableRow = motion(TableRow);

  const { deleteBottleType } = useApp();

  const handleDelete = async () => {
    if (bottleToDelete) {
      await deleteBottleType(bottleToDelete.id);
      setDeleteConfirmDialogOpen(false);
      setBottleToDelete(null);
    }
  };

  // Stock history dialog state
  const [stockHistoryDialogOpen, setStockHistoryDialogOpen] = useState(false);
  const [historyBottle, setHistoryBottle] = useState<{ bottle: BottleType; type: 'empty' | 'defective' } | null>(null);

  const filteredStockHistory = React.useMemo(() => {
    if (!historyBottle) return [];
    const normalize = (value: string) =>
      value
        .toLowerCase()
        .replace(/\s+/g, '')
        .replace(/[^a-z0-9]/g, '');
    const aliases = historyBottle.type === 'empty'
      ? ['empty', 'emptystock', 'emptybottles', 'emptybottlesstock', 'vide', 'vides', 'stockvide', 'stockvides']
      : ['defective', 'defectivestock', 'defectivebottles', 'defectivebottlesstock', 'defectueux', 'defectueuse', 'stockdefectueux', 'stockdefectueuses'];
    const bottleId = String(historyBottle.bottle.id);
    const bottleName = String(historyBottle.bottle.name || '');
    const normalizedBottleName = normalize(bottleName);
    const base = stockHistory.filter(h => {
      const idMatch = String(h.bottleTypeId ?? '') === bottleId;
      const entryName = String(h.bottleTypeName ?? '');
      const normalizedEntryName = normalize(entryName);
      const nameMatch = normalizedBottleName && normalizedEntryName === normalizedBottleName;
      const fuzzyNameMatch = normalizedBottleName && (
        normalizedEntryName.includes(normalizedBottleName) ||
        normalizedBottleName.includes(normalizedEntryName)
      );
      const noteMatch = normalizedBottleName && normalize(String((h as any).note ?? '')).includes(normalizedBottleName);
      return idMatch || nameMatch || fuzzyNameMatch || noteMatch;
    });
    const typed = base.filter(h => {
      const st = normalize(String(h.stockType ?? ''));
      return !st || aliases.includes(st);
    });
    const list = typed.length ? typed : base;
    return [...list].sort((a, b) => safeDate(b.date).getTime() - safeDate(a.date).getTime());
  }, [stockHistory, historyBottle]);

  const getDefaultCriticalThreshold = (total: number) => {
    const t = Number(total || 0);
    return Math.max(30, Math.round((t || 250) * 0.12));
  };

  const getStockStatus = (remaining: number, total: number, criticalThreshold?: number) => {
    const r = Number(remaining || 0);
    const base = Number(criticalThreshold ?? getDefaultCriticalThreshold(total));
    const low = Math.round(base * 2);
    const medium = Math.round(base * 3.5);
    const good = Math.round(base * 5);
    if (isNaN(r)) return { level: 'normal' as const, status: t('inventory.status.normal', 'Normal'), variant: 'default' as const, icon: TrendingUp };
    if (r <= base) return { level: 'critical' as const, status: t('inventory.status.critical', 'Critique'), variant: 'destructive' as const, icon: TrendingDown };
    if (r <= low) return { level: 'low' as const, status: t('inventory.status.low', 'Faible'), variant: 'secondary' as const, icon: TrendingDown };
    if (r <= medium) return { level: 'medium' as const, status: t('inventory.status.medium', 'Moyen'), variant: 'outline' as const, icon: TrendingDown };
    if (r <= good) return { level: 'good' as const, status: t('inventory.status.good', 'Bon'), variant: 'default' as const, icon: TrendingUp };
    return { level: 'normal' as const, status: t('inventory.status.normal', 'Normal'), variant: 'default' as const, icon: TrendingUp };
  };

  const availableBottleTypes = bottleTypes;

  const getPendingCirculation = (bottleTypeId: string) => {
    if (!supplyOrders || !Array.isArray(supplyOrders)) return 0;

    const pendingOrders = supplyOrders.filter((o: any) => {
      if (!o || !o.id) return false;
      // Check if there is a return order linked to this supply order
      const hasReturn = (returnOrders || []).some((ro: any) => String(ro?.supplyOrderId) === String(o.id));
      return !hasReturn;
    });

    return pendingOrders.reduce((sum: number, o: any) => {
      let items: any[] = [];
      try {
        if (Array.isArray(o?.items)) {
          items = o.items;
        } else if (typeof o?.items === 'string') {
          const trimmed = o.items.trim();
          if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
            const parsed = JSON.parse(trimmed);
            items = Array.isArray(parsed) ? parsed : [parsed];
          }
        } else if (typeof o?.items === 'object' && o?.items !== null) {
          items = [o.items];
        }
      } catch {
        items = [];
      }
      
      const qty = items
        .filter((it: any) => {
          // Check for camelCase, snake_case, or simple id
          const itId = String(it?.bottleTypeId ?? it?.bottle_type_id ?? it?.id ?? '');
          return itId === String(bottleTypeId);
        })
        .reduce((s: number, it: any) => {
          // Check for various quantity field names
          const val = Number(it?.fullQuantity ?? it?.full_quantity ?? it?.quantity ?? it?.qty ?? 0);
          return s + val;
        }, 0);
      return sum + qty;
    }, 0);
  };

  const getEmptyQuantity = (id: string) =>
    emptyBottlesStock.find(s => s.bottleTypeId === id)?.quantity || 0;

  const getDefectiveQuantity = (id: string) =>
    defectiveBottles.filter(b => b.bottleTypeId === id).reduce((sum, b) => sum + b.quantity, 0);

  const handleAdjustPleinStock = async (bottle: BottleType, stockPlein: number, distributed: number) => {
    const rawQty = stockAdjustByBottle[bottle.id] ?? '';
    const qty = Math.floor(Number(rawQty));
    if (!Number.isFinite(qty) || qty <= 0) return;
    const mode = adjustModeByBottle[bottle.id] ?? 'add';
    const currentTotal = Number((bottle as any).totalQuantity ?? (bottle as any).totalquantity ?? 0);

    if (mode === 'remove' && qty > stockPlein) return;

    const delta = mode === 'add' ? qty : -qty;
    const nextTotal = Math.max(distributed, currentTotal + delta);
    const nextRemaining = Math.max(0, nextTotal - distributed);

    setAdjustingBottleId(bottle.id);
    try {
      await updateBottleType(bottle.id, {
        totalQuantity: nextTotal,
        remainingQuantity: nextRemaining,
      });
      await addStockHistory({
        date: new Date().toISOString(),
        bottleTypeId: bottle.id,
        bottleTypeName: bottle.name,
        stockType: 'full',
        changeType: mode === 'add' ? 'add' : 'remove',
        quantity: qty,
        previousQuantity: stockPlein,
        newQuantity: Math.max(0, stockPlein + delta),
        note: `Ajustement manuel plein (${mode === 'add' ? '+' : '-'}${qty}) | Utilisateur: ${currentUserEmail || 'inconnu'}`
      });
      setStockAdjustByBottle((prev) => ({ ...prev, [bottle.id]: '' }));
    } finally {
      setAdjustingBottleId(null);
    }
  };

  const simpleStatus = (qty: number) => {
    if (qty === 0) return { status: t('inventory.status.empty', 'Vide'), variant: 'destructive' as const, icon: TrendingDown };
    if (qty < 50) return { status: t('inventory.status.low', 'Faible'), variant: 'secondary' as const, icon: TrendingDown };
    return { status: t('inventory.status.normal', 'Normal'), variant: 'default' as const, icon: TrendingUp };
  };

  interface InventoryImpactEvent {
    id: string;
    date: string;
    source: 'supply' | 'return' | 'foreign_add';
    label: string;
    driverName?: string;
    bottleTypeName: string;
    emptyDelta: number;
    fullDelta: number;
    defectiveDelta: number;
    foreignDelta: number;
  }

  const getDriverNameByTruckId = (truckId?: string) => {
    if (!truckId) return undefined;
    const truck = trucks.find(t => t.id === truckId);
    const driver = drivers.find(d => String(d.id) === String(truck?.driverId));
    return driver?.name;
  };

  const getDriverNameForReturn = (ro: any) => {
    if (ro?.driverName) return ro.driverName;
    const so = supplyOrders.find((s: any) => String(s.id) === String(ro?.supplyOrderId));
    if (so?.driverName) return so.driverName;
    const driver = drivers.find(d => String(d.id) === String(ro?.driverId));
    return driver?.name;
  };

  const impactEvents = React.useMemo<InventoryImpactEvent[]>(() => {
    const events: InventoryImpactEvent[] = [];

    // Alimentation camion — Réduit les Pleins
    transactions
      .filter(t => t.type === 'supply')
      .forEach(tx => {
        (tx.bottleTypes || []).forEach((bt: any) => {
          const bottleName = bottleTypes.find(b => b.id === bt.bottleTypeId)?.name || 'Inconnu';
          events.push({
            id: `supply-${tx.id || `${tx.date}-${bt.bottleTypeId}`}`,
            date: tx.date,
            source: 'supply',
            label: t('inventory.impact.event.supplyTruck', 'Alimentation camion'),
            driverName: getDriverNameByTruckId(tx.truckId),
            bottleTypeName: bottleName,
            emptyDelta: 0,
            fullDelta: -Number(bt.quantity || 0),
            defectiveDelta: 0,
            foreignDelta: 0,
          });
        });
      });

    // B.D Retour — Impact détaillé
    (returnOrders || []).forEach((ro: any) => {
      (ro.items || []).forEach((item: any) => {
        const emptyDelta =
          (Number(item.returnedEmptyQuantity || 0)) -
          (Number(item.consigneQuantity || 0)) -
          (Number(item.lostQuantity || 0)) -
          (Number(item.foreignQuantity || 0));

        events.push({
          id: `return-${ro.id}-${item.bottleTypeId}`,
          date: ro.date,
          source: 'return',
          label: `${t('inventory.impact.event.returnBs', 'B.D - Retour B.S')} ${ro.supplyOrderNumber || ''}`.trim(),
          driverName: getDriverNameForReturn(ro),
          bottleTypeName: item.bottleTypeName,
          emptyDelta,
          // Correction: Returned Full bottles add to Pleins stock, they do NOT add to Vides
          fullDelta: Number(item.returnedFullQuantity || 0),
          defectiveDelta: Number(item.defectiveQuantity || 0),
          foreignDelta: Number(item.foreignQuantity || 0),
        });
      });
    });

    // Étrangères directes
    (foreignBottles || [])
      .filter((fb: any) => !fb.returnOrderId || fb.returnOrderId === 'direct')
      .forEach((fb: any) => {
        events.push({
          id: `foreign-${fb.id}`,
          date: fb.date,
          source: 'foreign_add',
          label: `${t('inventory.impact.event.foreignAdd', 'Ajout étrangère')} (${fb.companyName})`,
          driverName: undefined,
          bottleTypeName: fb.bottleType,
          emptyDelta: -Number(fb.quantity || 0),
          fullDelta: 0,
          defectiveDelta: 0,
          foreignDelta: Number(fb.quantity || 0),
        });
      });

    return events.sort((a, b) => safeDate(b.date).getTime() - safeDate(a.date).getTime());
  }, [transactions, returnOrders, foreignBottles, bottleTypes, trucks, drivers, supplyOrders, t]);

  const { filteredImpactEvents, summaryTotals, summaryTitle } = React.useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const filtered = impactEvents.filter(event => {
      const eventDate = safeDate(event.date);
      if (impactView === 'today') {
        return eventDate >= today;
      }
      if (impactView === 'last7days') {
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(today.getDate() - 6);
        return eventDate >= sevenDaysAgo;
      }
      return false;
    });

    const totals = filtered.reduce(
      (acc, event) => {
        acc.empty += event.emptyDelta;
        acc.full += event.fullDelta;
        acc.defective += event.defectiveDelta;
        acc.foreign += event.foreignDelta;
        return acc;
      },
      { empty: 0, full: 0, defective: 0, foreign: 0 }
    );

    const title = impactView === 'today'
      ? t('inventory.impact.summaryToday', 'Résumé du jour')
      : t('inventory.impact.summaryLast7Days', 'Résumé des 7 derniers jours');

    return { filteredImpactEvents: filtered, summaryTotals: totals, summaryTitle: title };
  }, [impactEvents, impactView]);

  const last7DaysEvents = React.useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    return impactEvents.filter(e => safeDate(e.date) >= cutoff);
  }, [impactEvents]);

  const totalsLast7 = React.useMemo(() => {
    return last7DaysEvents.reduce(
      (acc, e) => {
        acc.empty += e.emptyDelta;
        acc.full += e.fullDelta;
        acc.defective += e.defectiveDelta;
        acc.foreign += e.foreignDelta;
        return acc;
      },
      { empty: 0, full: 0, defective: 0, foreign: 0 }
    );
  }, [last7DaysEvents]);

  const eventsToday = React.useMemo(() => {
    const today = new Date();
    return impactEvents.filter((e) => {
      const d = safeDate(e.date);
      return (
        d.getFullYear() === today.getFullYear() &&
        d.getMonth() === today.getMonth() &&
        d.getDate() === today.getDate()
      );
    });
  }, [impactEvents]);

  const totalsToday = React.useMemo(() => {
    return eventsToday.reduce(
      (acc, e) => {
        acc.empty += e.emptyDelta;
        acc.full += e.fullDelta;
        acc.defective += e.defectiveDelta;
        acc.foreign += e.foreignDelta;
        return acc;
      },
      { empty: 0, full: 0, defective: 0, foreign: 0 }
    );
  }, [eventsToday]);

  const fmtDelta = (n: number) => (n > 0 ? `+${n}` : `${n}`);
  const inventoryCards = useMemo(() => {
    return availableBottleTypes.map((bottle) => {
      const distributedField = Number(bottle.distributedQuantity ?? (bottle as any).distributedquantity ?? 0);
      const pendingCirculation = getPendingCirculation(bottle.id);
      const distributed = Math.max(distributedField, pendingCirculation);
      const emptyStockEntry = emptyBottlesStock.find(s => s.bottleTypeId === bottle.id);
      const warehouseEmpty = Number(emptyStockEntry?.quantity || 0);
      const totalStored = Number(bottle.totalQuantity ?? (bottle as any).totalquantity ?? 0);
      const stockPlein = Math.max(totalStored - distributed, 0);
      const computedTotal = totalStored > 0 ? totalStored : (stockPlein + distributed);
      const criticalThreshold = Number(thresholdsByBottle[bottle.id] ?? getDefaultCriticalThreshold(computedTotal || 0));
      const stockInfo = getStockStatus(stockPlein, computedTotal || 0, criticalThreshold);
      const distributionRate = computedTotal > 0 ? (distributed / computedTotal) * 100 : 0;
      return {
        bottle,
        stockPlein,
        warehouseEmpty,
        distributed,
        computedTotal,
        criticalThreshold,
        stockInfo,
        distributionRate,
      };
    });
  }, [availableBottleTypes, emptyBottlesStock, supplyOrders, returnOrders, thresholdsByBottle]);

  const filteredBottleCards = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase();
    const filtered = inventoryCards.filter(({ bottle, stockInfo }) => {
      const matchesSearch = !normalized || bottle.name.toLowerCase().includes(normalized) || String(bottle.capacity || '').toLowerCase().includes(normalized);
      const matchesFilter =
        stockFilter === 'all'
          ? true
          : stockFilter === 'critical'
          ? stockInfo.level === 'critical'
          : stockFilter === 'low'
          ? stockInfo.level === 'low' || stockInfo.level === 'medium'
          : stockInfo.level === 'good' || stockInfo.level === 'normal';
      return matchesSearch && matchesFilter;
    });
    return [...filtered].sort((a, b) => {
      if (sortMode === 'name') return a.bottle.name.localeCompare(b.bottle.name);
      if (sortMode === 'distribution') return b.distributionRate - a.distributionRate;
      return b.stockPlein - a.stockPlein;
    });
  }, [inventoryCards, searchTerm, stockFilter, sortMode]);

  const totalEmpty = emptyBottlesStock.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);
  const totalDefective = defectiveBottles.reduce((sum, d) => sum + (Number(d.quantity) || 0), 0);
  const totalGeneral = inventoryCards.reduce((sum, card) => sum + Number((card.bottle as any).totalQuantity ?? (card.bottle as any).totalquantity ?? 0), 0);
  const totalDistributed = inventoryCards.reduce((sum, card) => sum + card.distributed, 0);
  const totalRemaining = inventoryCards.reduce((sum, card) => sum + card.stockPlein, 0);
  const avgDistributionRate = inventoryCards.length > 0 ? inventoryCards.reduce((sum, c) => sum + c.distributionRate, 0) / inventoryCards.length : 0;
  const fullOutflowLast7 = last7DaysEvents.reduce((sum, e) => sum + Math.max(0, -Number(e.fullDelta || 0)), 0);
  const rotationRate = totalRemaining > 0 ? (fullOutflowLast7 / totalRemaining) * 100 : 0;
  const criticalCards = inventoryCards.filter(card => card.stockPlein <= card.criticalThreshold);
  const criticalShortage = criticalCards.reduce((sum, card) => sum + Math.max(card.criticalThreshold - card.stockPlein, 0), 0);
  const bottleOutflowByName = useMemo(() => {
    return last7DaysEvents.reduce((acc, event) => {
      const key = String(event.bottleTypeName || '').toLowerCase();
      if (!key) return acc;
      const outflow = Math.max(0, -Number(event.fullDelta || 0));
      acc[key] = (acc[key] || 0) + outflow;
      return acc;
    }, {} as Record<string, number>);
  }, [last7DaysEvents]);

  const missionBoard = useMemo(() => {
    const lanes = { urgent: [] as typeof inventoryCards, watch: [] as typeof inventoryCards, stable: [] as typeof inventoryCards };
    inventoryCards.forEach((card) => {
      const outflow = bottleOutflowByName[String(card.bottle.name || '').toLowerCase()] || 0;
      const dailyOutflow = outflow > 0 ? outflow / 7 : 0;
      const daysLeft = dailyOutflow > 0 ? card.stockPlein / dailyOutflow : Number.POSITIVE_INFINITY;
      const riskLevel = card.stockPlein <= card.criticalThreshold || daysLeft <= 10
        ? 'urgent'
        : card.stockInfo.level === 'low' || card.stockInfo.level === 'medium' || daysLeft <= 21
        ? 'watch'
        : 'stable';
      (lanes[riskLevel] as any).push({
        ...card,
        daysLeft,
        dailyOutflow
      });
    });
    const sortByPressure = (a: any, b: any) => {
      if (!Number.isFinite(a.daysLeft) && !Number.isFinite(b.daysLeft)) return b.distributionRate - a.distributionRate;
      if (!Number.isFinite(a.daysLeft)) return 1;
      if (!Number.isFinite(b.daysLeft)) return -1;
      return a.daysLeft - b.daysLeft;
    };
    return {
      urgent: [...(lanes.urgent as any[])].sort(sortByPressure),
      watch: [...(lanes.watch as any[])].sort(sortByPressure),
      stable: [...(lanes.stable as any[])].sort(sortByPressure)
    };
  }, [inventoryCards, bottleOutflowByName]);

  const stockPulse = useMemo(() => {
    const today = new Date();
    const keys = Array.from({ length: 8 }, (_, idx) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (7 - idx));
      return format(d, 'yyyy-MM-dd');
    });
    return keys.map((key) => {
      const events = impactEvents.filter((event) => format(safeDate(event.date), 'yyyy-MM-dd') === key);
      const netFull = events.reduce((sum, event) => sum + Number(event.fullDelta || 0), 0);
      const volatility = events.reduce((sum, event) => sum + Math.abs(Number(event.fullDelta || 0)) + Math.abs(Number(event.emptyDelta || 0)), 0);
      const spotlight = events.reduce(
        (acc, event) => {
          const score = Math.abs(Number(event.fullDelta || 0)) + Math.abs(Number(event.emptyDelta || 0));
          if (score > acc.score) return { score, bottle: event.bottleTypeName || '' };
          return acc;
        },
        { score: 0, bottle: '' }
      );
      return {
        key,
        dateLabel: new Date(`${key}T00:00:00`).toLocaleDateString(uiLocale, { day: '2-digit', month: '2-digit' }),
        netFull,
        volatility,
        spotlightBottle: spotlight.bottle
      };
    });
  }, [impactEvents, uiLocale]);

  const pulseMax = useMemo(() => Math.max(1, ...stockPulse.map((cell) => cell.volatility)), [stockPulse]);

  const recent30DaysEvents = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    return impactEvents.filter((event) => safeDate(event.date) >= cutoff);
  }, [impactEvents]);

  const forecastRows = useMemo(() => {
    const horizonDays = parseInt(replenishmentHorizon, 10) || 30;
    const byBottle = recent30DaysEvents.reduce((acc, event) => {
      const key = String(event.bottleTypeName || '').toLowerCase();
      if (!key) return acc;
      if (!acc[key]) acc[key] = { in30: 0, out30: 0 };
      const full = Number(event.fullDelta || 0);
      if (full > 0) acc[key].in30 += full;
      if (full < 0) acc[key].out30 += Math.abs(full);
      return acc;
    }, {} as Record<string, { in30: number; out30: number }>);

    return inventoryCards
      .map((card) => {
        const key = String(card.bottle.name || '').toLowerCase();
        const flow = byBottle[key] || { in30: 0, out30: 0 };
        const dailyIn = flow.in30 / 30;
        const dailyOut = flow.out30 / 30;
        const dailyDrain = Math.max(dailyOut - dailyIn, 0);
        const daysLeft = dailyDrain > 0 ? card.stockPlein / dailyDrain : Number.POSITIVE_INFINITY;
        const targetBuffer = card.criticalThreshold * 2;
        const projectedNeed = dailyDrain * horizonDays;
        const recommendedRefill = Math.max(Math.ceil(targetBuffer + projectedNeed - card.stockPlein), 0);
        const risk = daysLeft <= 10 ? 'high' : daysLeft <= 25 ? 'medium' : 'low';
        return {
          ...card,
          dailyIn,
          dailyOut,
          dailyDrain,
          daysLeft,
          recommendedRefill,
          risk
        };
      })
      .sort((a, b) => {
        if (!Number.isFinite(a.daysLeft) && !Number.isFinite(b.daysLeft)) return b.recommendedRefill - a.recommendedRefill;
        if (!Number.isFinite(a.daysLeft)) return 1;
        if (!Number.isFinite(b.daysLeft)) return -1;
        return a.daysLeft - b.daysLeft;
      });
  }, [inventoryCards, recent30DaysEvents, replenishmentHorizon]);

  const totalRefillRecommended = useMemo(
    () => forecastRows.reduce((sum, row) => sum + row.recommendedRefill, 0),
    [forecastRows]
  );

  const driverHeatmap = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 14);
    const scoped = impactEvents.filter((event) => safeDate(event.date) >= cutoff);
    const grouped = scoped.reduce((acc, event) => {
      const driver = event.driverName || t('inventory.driverHeatmap.noDriver', 'Sans chauffeur');
      const lane = event.source === 'supply'
        ? t('inventory.driverHeatmap.lane.supply', 'Sortie camion')
        : event.source === 'return'
        ? t('inventory.driverHeatmap.lane.return', 'Retour terrain')
        : t('inventory.driverHeatmap.lane.foreign', 'Entrée étrangère');
      const key = `${driver}||${lane}`;
      if (!acc[key]) {
        acc[key] = {
          driver,
          lane,
          netFull: 0,
          pressure: 0,
          bottles: {} as Record<string, number>
        };
      }
      const full = Number(event.fullDelta || 0);
      const empty = Number(event.emptyDelta || 0);
      const pressureScore = Math.abs(full) + Math.abs(empty);
      acc[key].netFull += full;
      acc[key].pressure += pressureScore;
      const bottleKey = String(event.bottleTypeName || '');
      if (bottleKey) {
        acc[key].bottles[bottleKey] = (acc[key].bottles[bottleKey] || 0) + pressureScore;
      }
      return acc;
    }, {} as Record<string, { driver: string; lane: string; netFull: number; pressure: number; bottles: Record<string, number> }>);

    return Object.values(grouped)
      .map((entry) => {
        const spotlightBottle = Object.entries(entry.bottles).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
        return {
          ...entry,
          spotlightBottle,
          trend: entry.netFull < 0 ? 'drain' as const : 'recovery' as const
        };
      })
      .sort((a, b) => b.pressure - a.pressure)
      .slice(0, 8);
  }, [impactEvents, t]);

  const driverHeatMax = useMemo(() => Math.max(1, ...driverHeatmap.map((row) => row.pressure)), [driverHeatmap]);

  const emptyRows = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase();
    return emptyBottlesStock
      .filter(s => s.quantity > 0 && s.bottleTypeName)
      .filter(s => !normalized || s.bottleTypeName.toLowerCase().includes(normalized))
      .sort((a, b) => b.quantity - a.quantity);
  }, [emptyBottlesStock, searchTerm]);

  const defectiveRows = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase();
    return defectiveBottles
      .filter(d => d.quantity > 0 && d.bottleTypeName)
      .filter(d => !normalized || d.bottleTypeName.toLowerCase().includes(normalized))
      .sort((a, b) => b.quantity - a.quantity);
  }, [defectiveBottles, searchTerm]);

  const bottleById = useMemo(() => {
    return availableBottleTypes.reduce((acc, bottle) => {
      acc[bottle.id] = bottle;
      return acc;
    }, {} as Record<string, BottleType>);
  }, [availableBottleTypes]);

  const getEmptyCriticalLimit = (bottleTypeId: string) => {
    const bottle = bottleById[bottleTypeId];
    const total = Number((bottle as any)?.totalQuantity ?? (bottle as any)?.totalquantity ?? 0);
    return Math.max(20, Math.round((total || 250) * 0.08));
  };

  const getDefectiveCriticalLimit = (bottleTypeId: string) => {
    const bottle = bottleById[bottleTypeId];
    const total = Number((bottle as any)?.totalQuantity ?? (bottle as any)?.totalquantity ?? 0);
    return Math.max(10, Math.round((total || 200) * 0.06));
  };

  const sortedEmptyRows = useMemo(() => {
    const rows = [...emptyRows];
    if (emptySortMode === 'name') return rows.sort((a, b) => a.bottleTypeName.localeCompare(b.bottleTypeName));
    if (emptySortMode === 'date') return rows.sort((a, b) => safeDate(b.lastUpdated).getTime() - safeDate(a.lastUpdated).getTime());
    return rows.sort((a, b) => b.quantity - a.quantity);
  }, [emptyRows, emptySortMode]);

  const sortedDefectiveRows = useMemo(() => {
    const rows = [...defectiveRows];
    if (defectiveSortMode === 'name') return rows.sort((a, b) => a.bottleTypeName.localeCompare(b.bottleTypeName));
    if (defectiveSortMode === 'date') return rows.sort((a, b) => safeDate(b.date).getTime() - safeDate(a.date).getTime());
    return rows.sort((a, b) => b.quantity - a.quantity);
  }, [defectiveRows, defectiveSortMode]);

  const visibleEmptyRows = useMemo(() => {
    if (!emptyCriticalOnly) return sortedEmptyRows;
    return sortedEmptyRows.filter((row) => Number(row.quantity) <= getEmptyCriticalLimit(row.bottleTypeId));
  }, [sortedEmptyRows, emptyCriticalOnly, bottleById]);

  const visibleDefectiveRows = useMemo(() => {
    if (!defectiveCriticalOnly) return sortedDefectiveRows;
    return sortedDefectiveRows.filter((row) => Number(row.quantity) >= getDefectiveCriticalLimit(row.bottleTypeId));
  }, [sortedDefectiveRows, defectiveCriticalOnly, bottleById]);

  const toSparklineGeometry = (values: number[]) => {
    const width = 116;
    const height = 26;
    const safeValues = values.length ? values.map((v) => Math.max(0, Number(v) || 0)) : [0];
    const max = Math.max(1, ...safeValues);
    const toY = (value: number) => height - (value / max) * (height - 2);
    if (safeValues.length === 1) {
      const y = toY(safeValues[0]);
      return {
        path: `M 2 ${y.toFixed(2)} L ${width - 2} ${y.toFixed(2)}`,
        areaPath: `M 2 26 L 2 ${y.toFixed(2)} L ${width - 2} ${y.toFixed(2)} L ${width - 2} 26 Z`,
        lastPoint: { x: width - 2, y }
      };
    }
    const step = (width - 4) / (safeValues.length - 1);
    const points = safeValues.map((value, index) => {
      const x = 2 + index * step;
      const y = toY(value);
      return { x, y };
    });
    let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
    for (let i = 1; i < points.length; i += 1) {
      const prev = points[i - 1];
      const curr = points[i];
      const cpx1 = prev.x + step * 0.45;
      const cpy1 = prev.y;
      const cpx2 = curr.x - step * 0.45;
      const cpy2 = curr.y;
      d += ` C ${cpx1.toFixed(2)} ${cpy1.toFixed(2)}, ${cpx2.toFixed(2)} ${cpy2.toFixed(2)}, ${curr.x.toFixed(2)} ${curr.y.toFixed(2)}`;
    }
    const areaPath = `${d} L ${points[points.length - 1].x.toFixed(2)} 26 L ${points[0].x.toFixed(2)} 26 Z`;
    return {
      path: d,
      areaPath,
      lastPoint: points[points.length - 1]
    };
  };

  const toTrend = (values: number[]) => {
    const series = values.length ? values : [0];
    if (series.length < 2) return 'flat' as const;
    const prev = Number(series[series.length - 2] || 0);
    const curr = Number(series[series.length - 1] || 0);
    if (curr > prev) return 'up' as const;
    if (curr < prev) return 'down' as const;
    return 'flat' as const;
  };

  const toVolatility = (values: number[]) => {
    const series = values.length ? values.map((v) => Math.max(0, Number(v) || 0)) : [0];
    if (series.length < 2) return 0;
    const diffs: number[] = [];
    for (let i = 1; i < series.length; i += 1) {
      diffs.push(Math.abs(series[i] - series[i - 1]));
    }
    const avgDiff = diffs.reduce((sum, d) => sum + d, 0) / diffs.length;
    const amplitude = Math.max(1, ...series);
    return Math.min(1, (avgDiff / amplitude) * 3);
  };

  const clamp01 = (value: number) => Math.min(1, Math.max(0, Number(value) || 0));

  const sparklineByBottle = useMemo(() => {
    const normalize = (value: string) =>
      value
        .toLowerCase()
        .replace(/\s+/g, '')
        .replace(/[^a-z0-9]/g, '');
    const emptyAliases = ['empty', 'emptystock', 'emptybottles', 'emptybottlesstock', 'vide', 'vides', 'stockvide', 'stockvides'];
    const defectiveAliases = ['defective', 'defectivestock', 'defectivebottles', 'defectivebottlesstock', 'defectueux', 'defectueuse', 'stockdefectueux', 'stockdefectueuses'];
    const fullAliases = ['full', 'fullstock', 'fullbottles', 'stockfull', 'plein', 'pleins', 'stockplein', 'stockpleins'];
    return availableBottleTypes.reduce((acc, bottle) => {
      const relatedHistory = stockHistory
        .filter((entry) => String(entry.bottleTypeId ?? '') === String(bottle.id))
        .sort((a, b) => safeDate(a.date).getTime() - safeDate(b.date).getTime());
      const toSeries = (aliases: string[], fallback: number) => {
        const values = relatedHistory
          .filter((entry) => {
            const st = normalize(String(entry.stockType ?? ''));
            return !st || aliases.includes(st);
          })
          .map((entry) => Number(entry.newQuantity ?? entry.quantity ?? 0))
          .filter((v) => Number.isFinite(v));
        const recent = values.slice(-6);
        if (recent.length === 0) return [Math.max(0, fallback)];
        return recent;
      };
      const fullFallback = inventoryCards.find((card) => String(card.bottle.id) === String(bottle.id))?.stockPlein ?? 0;
      const fullSeries = toSeries(fullAliases, fullFallback);
      const emptySeries = toSeries(emptyAliases, getEmptyQuantity(bottle.id));
      const defectiveSeries = toSeries(defectiveAliases, getDefectiveQuantity(bottle.id));
      acc[bottle.id] = {
        full: {
          series: fullSeries,
          ...toSparklineGeometry(fullSeries),
          trend: toTrend(fullSeries),
          volatility: toVolatility(fullSeries)
        },
        empty: {
          series: emptySeries,
          ...toSparklineGeometry(emptySeries),
          trend: toTrend(emptySeries),
          volatility: toVolatility(emptySeries)
        },
        defective: {
          series: defectiveSeries,
          ...toSparklineGeometry(defectiveSeries),
          trend: toTrend(defectiveSeries),
          volatility: toVolatility(defectiveSeries)
        }
      };
      return acc;
    }, {} as Record<string, { full: { series: number[]; path: string; areaPath: string; lastPoint: { x: number; y: number }; trend: 'up' | 'down' | 'flat'; volatility: number }; empty: { series: number[]; path: string; areaPath: string; lastPoint: { x: number; y: number }; trend: 'up' | 'down' | 'flat'; volatility: number }; defective: { series: number[]; path: string; areaPath: string; lastPoint: { x: number; y: number }; trend: 'up' | 'down' | 'flat'; volatility: number } }>);
  }, [availableBottleTypes, stockHistory, emptyBottlesStock, defectiveBottles, inventoryCards]);

  const emptyTableStats = useMemo(() => {
    const now = new Date();
    const staleCount = emptyRows.filter((row) => {
      const d = safeDate(row.lastUpdated);
      const diff = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
      return diff > 10;
    }).length;
    const topRow = sortedEmptyRows[0];
    return {
      staleCount,
      topName: topRow?.bottleTypeName || '',
      topQty: Number(topRow?.quantity || 0)
    };
  }, [emptyRows, sortedEmptyRows]);

  const defectiveTableStats = useMemo(() => {
    const critical = defectiveRows.filter((row) => Number(row.quantity) >= 20).length;
    const medium = defectiveRows.filter((row) => Number(row.quantity) >= 10 && Number(row.quantity) < 20).length;
    const topRow = sortedDefectiveRows[0];
    return {
      critical,
      medium,
      topName: topRow?.bottleTypeName || '',
      topQty: Number(topRow?.quantity || 0)
    };
  }, [defectiveRows, sortedDefectiveRows]);

  useEffect(() => {
    const loadPrefs = async () => {
      const localRaw = localStorage.getItem('inventory.ui.preferences');
      if (localRaw) {
        try {
          const localPrefs = JSON.parse(localRaw);
          if (typeof localPrefs.searchTerm === 'string') setSearchTerm(localPrefs.searchTerm);
          if (['all', 'critical', 'low', 'normal'].includes(localPrefs.stockFilter)) setStockFilter(localPrefs.stockFilter);
          if (['name', 'stock', 'distribution'].includes(localPrefs.sortMode)) setSortMode(localPrefs.sortMode);
          if (typeof localPrefs.showQuickStats === 'boolean') setShowQuickStats(localPrefs.showQuickStats);
        } catch {
        }
      }
      try {
        const cloudPrefs = await kvGet<any>('inventory.ui.preferences');
        if (cloudPrefs && typeof cloudPrefs === 'object') {
          if (typeof cloudPrefs.searchTerm === 'string') setSearchTerm(cloudPrefs.searchTerm);
          if (['all', 'critical', 'low', 'normal'].includes(cloudPrefs.stockFilter)) setStockFilter(cloudPrefs.stockFilter);
          if (['name', 'stock', 'distribution'].includes(cloudPrefs.sortMode)) setSortMode(cloudPrefs.sortMode);
          if (typeof cloudPrefs.showQuickStats === 'boolean') setShowQuickStats(cloudPrefs.showQuickStats);
        }
      } catch {
      }
    };
    loadPrefs();
  }, []);

  useEffect(() => {
    const loadThresholds = async () => {
      const localRaw = localStorage.getItem('inventory.thresholds.byBottle');
      if (localRaw) {
        try {
          const localThresholds = JSON.parse(localRaw);
          if (localThresholds && typeof localThresholds === 'object') {
            setThresholdsByBottle(localThresholds);
          }
        } catch {
        }
      }
      try {
        const cloudThresholds = await kvGet<any>('inventory.thresholds.byBottle');
        if (cloudThresholds && typeof cloudThresholds === 'object') {
          setThresholdsByBottle(cloudThresholds);
        }
      } catch {
      }
    };
    loadThresholds();
  }, []);

  useEffect(() => {
    const prefs = { searchTerm, stockFilter, sortMode, showQuickStats };
    localStorage.setItem('inventory.ui.preferences', JSON.stringify(prefs));
    kvSet('inventory.ui.preferences', prefs);
  }, [searchTerm, stockFilter, sortMode, showQuickStats]);

  useEffect(() => {
    localStorage.setItem('inventory.thresholds.byBottle', JSON.stringify(thresholdsByBottle));
    kvSet('inventory.thresholds.byBottle', thresholdsByBottle);
  }, [thresholdsByBottle]);

  const applyMissionFocus = (bottleName: string, lane: 'urgent' | 'watch' | 'stable') => {
    setSearchTerm(bottleName);
    setSortMode('stock');
    setShowQuickStats(true);
    setImpactView('last7days');
    if (lane === 'urgent') {
      setStockFilter('critical');
      setStockPilotMode('defense');
      return;
    }
    if (lane === 'watch') {
      setStockFilter('low');
      setStockPilotMode('rotation');
      return;
    }
    setStockFilter('normal');
    setStockPilotMode('equilibre');
  };

  const applyPulseFocus = (spotlightBottle: string, netFull: number) => {
    if (spotlightBottle) setSearchTerm(spotlightBottle);
    setImpactView('last7days');
    setStockFilter(netFull < 0 ? 'critical' : 'all');
    setSortMode(netFull < 0 ? 'stock' : 'distribution');
    setStockPilotMode('custom');
  };

  const applyStockPilot = (mode: 'defense' | 'rotation' | 'equilibre') => {
    setStockPilotMode(mode);
    if (mode === 'defense') {
      setStockFilter('critical');
      setSortMode('stock');
      setImpactView('last7days');
      return;
    }
    if (mode === 'rotation') {
      setStockFilter('low');
      setSortMode('distribution');
      setImpactView('last7days');
      return;
    }
    setStockFilter('all');
    setSortMode('stock');
    setSearchTerm('');
    setImpactView('today');
  };

  const applyForecastFocus = (bottleName: string, risk: 'high' | 'medium' | 'low') => {
    setSearchTerm(bottleName);
    setSortMode('stock');
    setImpactView('last7days');
    if (risk === 'high') {
      setStockFilter('critical');
      setStockPilotMode('defense');
      return;
    }
    if (risk === 'medium') {
      setStockFilter('low');
      setStockPilotMode('rotation');
      return;
    }
    setStockFilter('normal');
    setStockPilotMode('equilibre');
  };

  const applyDriverHeatFocus = (spotlightBottle: string, trend: 'drain' | 'recovery') => {
    if (spotlightBottle) setSearchTerm(spotlightBottle);
    setImpactView('last7days');
    setStockPilotMode('custom');
    if (trend === 'drain') {
      setStockFilter('critical');
      setSortMode('stock');
      return;
    }
    setStockFilter('all');
    setSortMode('distribution');
  };

  return (
    <div className="app-page-shell p-6 space-y-8 bg-slate-50/30 min-h-screen">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h1 className="app-page-title text-3xl font-bold text-slate-900 tracking-tight">{t('inventory.hero.title', 'Inventaire')}</h1>
          <p className="app-page-subtitle text-slate-500 mt-1 flex items-center gap-2">
            <Package className="w-4 h-4" />
            {t('inventory.hero.subtitle', 'Gestion globale des stocks et suivi des bouteilles')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="destructive" 
            size="sm"
            className="flex items-center gap-2"
            onClick={() => setConfirmClearDialogOpen(true)}
          >
            <Trash2 className="w-4 h-4" />
            {t('inventory.actions.resetAllStock', 'Réinitialiser tout le stock')}
          </Button>
          <AddBottleTypeDialog />
        </div>
      </div>

      <Card className="border-slate-200 bg-white">
        <CardContent className="p-4 md:p-5">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            <div className="flex-1">
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t('inventory.filters.search', 'Rechercher un type, une capacité...')}
                className="h-10"
              />
            </div>
            <ToggleGroup
              type="single"
              value={stockFilter}
              onValueChange={(value: any) => value && setStockFilter(value)}
              className="justify-start flex-wrap"
            >
              <ToggleGroupItem value="all">{t('inventory.filters.all', 'Tous')}</ToggleGroupItem>
              <ToggleGroupItem value="critical">{t('inventory.status.critical', 'Critique')}</ToggleGroupItem>
              <ToggleGroupItem value="low">{t('inventory.status.low', 'Faible')}</ToggleGroupItem>
              <ToggleGroupItem value="normal">{t('inventory.status.normal', 'Normal')}</ToggleGroupItem>
            </ToggleGroup>
            <ToggleGroup
              type="single"
              value={sortMode}
              onValueChange={(value: any) => value && setSortMode(value)}
              className="justify-start"
            >
              <ToggleGroupItem value="stock">{t('inventory.filters.stock', 'Stock')}</ToggleGroupItem>
              <ToggleGroupItem value="distribution">{t('inventory.filters.distribution', 'Distribution')}</ToggleGroupItem>
              <ToggleGroupItem value="name">{t('inventory.filters.name', 'Nom')}</ToggleGroupItem>
            </ToggleGroup>
            <Button variant="outline" size="sm" onClick={() => setShowQuickStats(v => !v)}>
              {showQuickStats ? t('inventory.actions.hideStats', 'Masquer stats') : t('inventory.actions.showStats', 'Afficher stats')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <AnimatePresence initial={false}>
        {showQuickStats && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4"
          >
            <Card className="border-slate-200 bg-white">
              <CardContent className="p-4">
                <p className="text-xs text-slate-500 uppercase tracking-wide">{t('inventory.quickStats.totalAssets', 'Actifs totaux')}</p>
                <p className="text-2xl font-black text-slate-900">{totalGeneral}</p>
              </CardContent>
            </Card>
            <Card className="border-slate-200 bg-white">
              <CardContent className="p-4">
                <p className="text-xs text-slate-500 uppercase tracking-wide">{t('inventory.quickStats.fullStock', 'Stock plein')}</p>
                <p className="text-2xl font-black text-indigo-700">{totalRemaining}</p>
              </CardContent>
            </Card>
            <Card className="border-slate-200 bg-white">
              <CardContent className="p-4">
                <p className="text-xs text-slate-500 uppercase tracking-wide">{t('inventory.quickStats.inCirculation', 'En circulation')}</p>
                <p className="text-2xl font-black text-purple-700">{totalDistributed}</p>
              </CardContent>
            </Card>
            <Card className="border-slate-200 bg-white">
              <CardContent className="p-4">
                <p className="text-xs text-slate-500 uppercase tracking-wide">{t('inventory.quickStats.averageDistribution', 'Distribution moyenne')}</p>
                <p className="text-2xl font-black text-emerald-700">{avgDistributionRate.toFixed(1)}%</p>
              </CardContent>
            </Card>
            <Card className="border-slate-200 bg-white">
              <CardContent className="p-4">
                <p className="text-xs text-slate-500 uppercase tracking-wide">{t('inventory.quickStats.rotationRate7d', 'Rotation Rate (7j)')}</p>
                <p className="text-2xl font-black text-amber-700">{rotationRate.toFixed(1)}%</p>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {criticalCards.length > 0 && (
        <Card className="border-rose-200 bg-rose-50/40">
          <CardContent className="p-4 md:p-5">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-rose-100">
                  <AlertTriangle className="w-5 h-5 text-rose-700" />
                </div>
                <div>
                  <p className="font-bold text-rose-800">
                    {language === 'ar'
                      ? `تنبيه حرج على ${criticalCards.length} ${criticalCards.length === 1 ? 'نوع من القنينات' : 'أنواع من القنينات'}`
                      : `${t('inventory.alert.criticalOn', 'Alerte critique sur')} ${criticalCards.length} ${t('inventory.alert.bottleType', 'type')}${criticalCards.length > 1 ? 's' : ''} ${t('inventory.alert.ofBottle', 'de bouteille')}`}
                  </p>
                  <p className="text-sm text-rose-700">
                    {t('inventory.alert.estimatedShortage', 'Manque estimé')}: {criticalShortage} {t('inventory.alert.unitsToThreshold', 'unités pour revenir au seuil critique configuré.')}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {criticalCards.slice(0, 4).map((card) => (
                  <Badge key={`critical-chip-${card.bottle.id}`} variant="destructive" className="font-semibold">
                    {card.bottle.name}: {card.stockPlein}/{card.criticalThreshold}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="border-none shadow-sm bg-white overflow-hidden xl:col-span-2">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-50 rounded-xl">
                <Archive className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">{t('inventory.mission.title', 'Mission Control Inventory')}</h3>
                <p className="text-xs text-slate-500">{t('inventory.mission.subtitle', 'Tri tactique des références selon risque de rupture')}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { key: 'urgent', title: t('inventory.mission.intervention', 'Intervention'), style: 'border-rose-200 bg-rose-50', text: 'text-rose-700' },
                { key: 'watch', title: t('inventory.mission.watch', 'Surveillance'), style: 'border-amber-200 bg-amber-50', text: 'text-amber-700' },
                { key: 'stable', title: t('inventory.mission.stable', 'Stable'), style: 'border-emerald-200 bg-emerald-50', text: 'text-emerald-700' }
              ].map((lane) => {
                const rows = missionBoard[lane.key as 'urgent' | 'watch' | 'stable'] as any[];
                return (
                  <div key={lane.key} className={`rounded-xl border p-3 space-y-2 ${lane.style}`}>
                    <div className="flex items-center justify-between">
                      <p className={`text-xs font-black uppercase tracking-wide ${lane.text}`}>{lane.title}</p>
                      <Badge className="border-none bg-white text-slate-700">{rows.length}</Badge>
                    </div>
                    <div className="space-y-2">
                      {rows.slice(0, 3).map((row) => (
                        <button
                          key={`mission-${lane.key}-${row.bottle.id}`}
                          type="button"
                          onClick={() => applyMissionFocus(row.bottle.name, lane.key as 'urgent' | 'watch' | 'stable')}
                          className="w-full rounded-lg border border-white/70 bg-white/80 px-2.5 py-2 text-left hover:bg-white transition-colors"
                        >
                          <p className="text-[12px] font-bold text-slate-800 truncate">{row.bottle.name}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            {Number.isFinite(row.daysLeft) ? `${Math.max(0, Math.floor(row.daysLeft))}${dayUnit} ${t('inventory.mission.autonomy', 'autonomie')}` : t('inventory.mission.stableAutonomy', 'Autonomie stable')}
                          </p>
                        </button>
                      ))}
                      {rows.length === 0 && (
                        <p className="text-[11px] text-slate-500">{t('inventory.empty.noItem', 'Aucun élément')}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white overflow-hidden">
          <CardContent className="p-5 space-y-3">
            <div>
              <h3 className="text-base font-black text-slate-900">{t('inventory.autopilot.title', 'Stock Autopilot')}</h3>
              <p className="text-xs text-slate-500">{t('inventory.autopilot.subtitle', 'Presets rapides pour piloter les priorités')}</p>
            </div>
            <Button onClick={() => applyStockPilot('defense')} className={`w-full justify-start ${stockPilotMode === 'defense' ? 'bg-rose-600 hover:bg-rose-700' : ''}`} variant={stockPilotMode === 'defense' ? 'default' : 'outline'}>
              <AlertTriangle className="w-4 h-4 mr-2" />
              {t('inventory.autopilot.defenseMode', 'Mode Défense')}
            </Button>
            <Button onClick={() => applyStockPilot('rotation')} className={`w-full justify-start ${stockPilotMode === 'rotation' ? 'bg-amber-600 hover:bg-amber-700 text-white' : ''}`} variant={stockPilotMode === 'rotation' ? 'default' : 'outline'}>
              <Truck className="w-4 h-4 mr-2" />
              {t('inventory.autopilot.rotationMode', 'Mode Rotation')}
            </Button>
            <Button onClick={() => applyStockPilot('equilibre')} className={`w-full justify-start ${stockPilotMode === 'equilibre' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`} variant={stockPilotMode === 'equilibre' ? 'default' : 'outline'}>
              <PackageCheck className="w-4 h-4 mr-2" />
              {t('inventory.autopilot.balanceMode', 'Mode Équilibre')}
            </Button>
            <div className="rounded-xl bg-slate-900 text-white p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-300">{t('inventory.autopilot.activeControl', 'Pilotage actif')}</p>
              <p className="text-sm font-black mt-1">
                {stockPilotMode === 'defense' ? t('inventory.autopilot.defenseHint', 'Renforcer les références critiques') : stockPilotMode === 'rotation' ? t('inventory.autopilot.rotationHint', 'Accélérer la récupération terrain') : stockPilotMode === 'equilibre' ? t('inventory.autopilot.balanceHint', 'Vision globale stabilisée') : t('inventory.autopilot.manualHint', 'Ajustement manuel en cours')}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-sm bg-white overflow-hidden">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-cyan-50 rounded-xl">
              <TrendingUp className="w-5 h-5 text-cyan-600" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">{t('inventory.flowPulse.title', 'Flow Pulse 8 jours')}</h3>
              <p className="text-xs text-slate-500">{t('inventory.flowPulse.subtitle', 'Intensité journalière des mouvements et focus rapide')}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2">
            {stockPulse.map((cell) => (
              <button
                key={`pulse-${cell.key}`}
                type="button"
                onClick={() => applyPulseFocus(cell.spotlightBottle, cell.netFull)}
                className={`rounded-xl border px-3 py-2 text-left transition-colors ${cell.netFull < 0 ? 'border-rose-200 hover:border-rose-300' : 'border-emerald-200 hover:border-emerald-300'}`}
                style={{
                  backgroundColor: cell.netFull < 0
                    ? `rgba(244, 63, 94, ${0.12 + (cell.volatility / pulseMax) * 0.35})`
                    : `rgba(16, 185, 129, ${0.12 + (cell.volatility / pulseMax) * 0.35})`
                }}
              >
                <p className="text-[11px] font-bold text-slate-700">{cell.dateLabel}</p>
                <p className={`text-xs font-black mt-1 ${cell.netFull < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{fmtDelta(cell.netFull)}</p>
                <p className="text-[10px] text-slate-500 mt-0.5 truncate">{cell.spotlightBottle || '—'}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="border-none shadow-sm bg-white overflow-hidden xl:col-span-2">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h3 className="text-base font-black text-slate-900">{t('inventory.forecast.title', 'Rupture Forecaster')}</h3>
                <p className="text-xs text-slate-500">{t('inventory.forecast.subtitle', 'Projection par référence et priorité de réapprovisionnement')}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant={replenishmentHorizon === '14' ? 'default' : 'outline'} className={replenishmentHorizon === '14' ? 'bg-indigo-600 hover:bg-indigo-700' : ''} onClick={() => setReplenishmentHorizon('14')}>{`14${dayUnit}`}</Button>
                <Button size="sm" variant={replenishmentHorizon === '30' ? 'default' : 'outline'} className={replenishmentHorizon === '30' ? 'bg-indigo-600 hover:bg-indigo-700' : ''} onClick={() => setReplenishmentHorizon('30')}>{`30${dayUnit}`}</Button>
                <Button size="sm" variant={replenishmentHorizon === '60' ? 'default' : 'outline'} className={replenishmentHorizon === '60' ? 'bg-indigo-600 hover:bg-indigo-700' : ''} onClick={() => setReplenishmentHorizon('60')}>{`60${dayUnit}`}</Button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {forecastRows.slice(0, 6).map((row) => (
                <button
                  key={`forecast-${row.bottle.id}`}
                  type="button"
                  onClick={() => applyForecastFocus(row.bottle.name, row.risk)}
                  className={`rounded-xl border px-3 py-2 text-left transition-colors ${
                    row.risk === 'high' ? 'border-rose-200 bg-rose-50 hover:bg-rose-100/60' : row.risk === 'medium' ? 'border-amber-200 bg-amber-50 hover:bg-amber-100/60' : 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100/60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-black text-slate-800 truncate">{row.bottle.name}</p>
                    <Badge className={row.risk === 'high' ? 'bg-rose-100 text-rose-700 border-none' : row.risk === 'medium' ? 'bg-amber-100 text-amber-700 border-none' : 'bg-emerald-100 text-emerald-700 border-none'}>
                      {row.risk === 'high'
                        ? t('inventory.forecast.risk.urgent', 'Urgent')
                        : row.risk === 'medium'
                        ? t('inventory.forecast.risk.watch', 'Watch')
                        : t('inventory.forecast.risk.stable', 'Stable')}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-2 text-[11px]">
                    <div>
                      <p className="text-slate-500">{t('inventory.forecast.autonomy', 'Autonomie')}</p>
                      <p className="font-black text-slate-700">{Number.isFinite(row.daysLeft) ? `${Math.max(0, Math.floor(row.daysLeft))}${dayUnit}` : '∞'}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">{t('inventory.forecast.drainPerDay', 'Drain/j')}</p>
                      <p className="font-black text-slate-700">{row.dailyDrain.toFixed(1)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">{t('inventory.forecast.refill', 'Refill')}</p>
                      <p className="font-black text-indigo-700">{row.recommendedRefill}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white overflow-hidden">
          <CardContent className="p-5 space-y-3">
            <div>
              <h3 className="text-base font-black text-slate-900">{t('inventory.planner.title', 'Replenishment Planner')}</h3>
              <p className="text-xs text-slate-500">{t('inventory.planner.objective', 'Objectif global de recharge sur')} {replenishmentHorizon} {t('inventory.common.days', 'jours')}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">{t('inventory.planner.refillRecommended', 'Refill recommandé')}</p>
              <p className="text-2xl font-black text-indigo-700 mt-1">{totalRefillRecommended} {t('inventory.common.units', 'unités')}</p>
            </div>
            <div className="space-y-2">
              {forecastRows.slice(0, 3).map((row) => (
                <div key={`planner-${row.bottle.id}`} className="rounded-lg border border-slate-200 p-2.5 flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-700 truncate">{row.bottle.name}</p>
                  <p className="text-xs font-black text-slate-900">{row.recommendedRefill}</p>
                </div>
              ))}
            </div>
            <Button variant="outline" className="w-full" onClick={() => { setSearchTerm(''); setSortMode('stock'); setStockFilter('all'); setStockPilotMode('custom'); }}>
              {t('inventory.planner.focusGlobalPlan', 'Focus plan global')}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-sm bg-white overflow-hidden">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-violet-50 rounded-xl">
              <Truck className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">{t('inventory.driverHeatmap.title', 'Driver Pressure Heatmap 14j')}</h3>
              <p className="text-xs text-slate-500">{t('inventory.driverHeatmap.subtitle', 'Localise les corridors de pression et accélère le focus')}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2">
            {driverHeatmap.map((row) => (
              <button
                key={`driver-heat-${row.driver}-${row.lane}`}
                type="button"
                onClick={() => applyDriverHeatFocus(row.spotlightBottle, row.trend)}
                className={`rounded-xl border px-3 py-2 text-left transition-colors ${row.trend === 'drain' ? 'border-rose-200 hover:border-rose-300' : 'border-emerald-200 hover:border-emerald-300'}`}
                style={{
                  backgroundColor: row.trend === 'drain'
                    ? `rgba(244, 63, 94, ${0.12 + (row.pressure / driverHeatMax) * 0.35})`
                    : `rgba(16, 185, 129, ${0.12 + (row.pressure / driverHeatMax) * 0.35})`
                }}
              >
                <p className="text-[11px] font-black text-slate-800 truncate">{row.driver}</p>
                <p className="text-[10px] text-slate-500 truncate mt-0.5">{row.lane}</p>
                <p className={`text-xs font-black mt-1 ${row.trend === 'drain' ? 'text-rose-700' : 'text-emerald-700'}`}>{fmtDelta(row.netFull)}</p>
                <p className="text-[10px] text-slate-600 truncate mt-0.5">{row.spotlightBottle || '—'}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredBottleCards.map(({ bottle, stockPlein, warehouseEmpty, computedTotal, stockInfo, distributed, distributionRate, criticalThreshold }, index) => {
          const bottleColor = colorForBottle(bottle, index);
          return (
          <motion.div
            key={bottle.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.34, delay: Math.min(index * 0.08, 0.56), ease: 'easeOut' }}
          >
            <Card className={`hover:shadow-lg transition-shadow ${stockPlein <= criticalThreshold ? 'border-rose-300' : 'border-slate-200'}`}>
              <CardHeader className="pb-3 bg-slate-50/50 rounded-t-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg border" style={{ backgroundColor: hexToRgba(bottleColor, 0.1), borderColor: hexToRgba(bottleColor, 0.26) }}>
                      <AnimatedBottleGlyph color={bottleColor} delay={Math.min(index * 0.07, 0.45)} />
                    </div>
                    <CardTitle className="text-lg font-bold text-slate-800">{bottle.name}</CardTitle>
                  </div>
                  <Badge variant={stockInfo.variant} className="flex items-center gap-1 px-2 py-1">
                    <stockInfo.icon className="w-3 h-3" />
                    {stockInfo.status}
                  </Badge>
                </div>
                <p className="text-sm text-slate-500 font-medium mt-1">{bottle.capacity}</p>
              </CardHeader>
              
              <CardContent className="space-y-4 pt-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm font-semibold">
                    <span className="text-slate-600">{t('inventory.card.remainingFullStock', 'Stock plein restant')}</span>
                    <span className="text-slate-900">{stockPlein} {t('inventory.common.units', 'unités')}</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-500" 
                      style={{ 
                        backgroundColor: bottleColor,
                        width: `${computedTotal > 0 ? Math.min(((stockPlein) / computedTotal) * 100, 100) : 0}%` 
                      }}
                    />
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <svg viewBox="0 0 120 28" className="h-8 w-[120px] shrink-0">
                      <defs>
                        <linearGradient id={`fullCardGradient-${bottle.id}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={bottleColor} stopOpacity="0.36" />
                          <stop offset="100%" stopColor={bottleColor} stopOpacity="0.03" />
                        </linearGradient>
                      </defs>
                      <path d="M2 26 L118 26" stroke={hexToRgba(bottleColor, 0.24)} strokeWidth="1.2" fill="none" />
                      <motion.path
                        d={sparklineByBottle[bottle.id]?.full.areaPath || 'M2 26 L2 14 L118 14 L118 26 Z'}
                        fill={`url(#fullCardGradient-${bottle.id})`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.55, ease: 'easeOut', delay: Math.min(index * 0.08, 0.56) + 0.08 }}
                      />
                      <motion.path
                        d={sparklineByBottle[bottle.id]?.full.path || 'M2 14 L118 14'}
                        stroke={bottleColor}
                        strokeWidth="2"
                        fill="none"
                        strokeLinecap="round"
                        initial={{ pathLength: 0, opacity: 0.4 }}
                        animate={{ pathLength: 1, opacity: 1 }}
                        transition={{
                          duration: 1.15 - clamp01(sparklineByBottle[bottle.id]?.full.volatility || 0) * 0.45,
                          ease: 'easeOut',
                          delay: Math.min(index * 0.08, 0.56)
                        }}
                      />
                      <motion.circle
                        cx={sparklineByBottle[bottle.id]?.full.lastPoint.x || 118}
                        cy={sparklineByBottle[bottle.id]?.full.lastPoint.y || 14}
                        r="2.8"
                        fill={bottleColor}
                        animate={{
                          r: [2.2, 3.2 + clamp01(sparklineByBottle[bottle.id]?.full.volatility || 0) * 2, 2.2],
                          opacity: [0.9, 0.35 + clamp01(sparklineByBottle[bottle.id]?.full.volatility || 0) * 0.35, 0.9]
                        }}
                        transition={{
                          duration: 2.1 - clamp01(sparklineByBottle[bottle.id]?.full.volatility || 0) * 0.9,
                          repeat: Infinity,
                          ease: 'easeInOut',
                          delay: Math.min(index * 0.08, 0.56) + 0.15
                        }}
                      />
                    </svg>
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-2 py-0.5 border-none ${
                        sparklineByBottle[bottle.id]?.full.trend === 'up'
                          ? 'bg-emerald-100 text-emerald-700'
                          : sparklineByBottle[bottle.id]?.full.trend === 'down'
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {sparklineByBottle[bottle.id]?.full.trend === 'up'
                        ? t('inventory.trend.upRecovery', '↑ Reprise')
                        : sparklineByBottle[bottle.id]?.full.trend === 'down'
                        ? t('inventory.trend.downTension', '↓ Tension')
                        : t('inventory.trend.stable', '→ Stable')}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 rounded-xl">
                  <div className="space-y-1 text-center">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">{t('inventory.card.full', 'Plein')}</p>
                    <p className="text-base font-bold text-slate-900">{stockPlein}</p>
                  </div>
                  <div className="space-y-1 text-center border-l border-slate-200 pl-2">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">{t('inventory.card.empty', 'Vides')}</p>
                    <p className="text-base font-bold text-purple-600">{warehouseEmpty}</p>
                  </div>
                  <div className="space-y-1 text-center border-l border-slate-200 pl-2">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">{t('inventory.card.circulation', 'Circulation')}</p>
                    <p className="text-base font-bold text-indigo-600">{distributed}</p>
                  </div>
                </div>

                <div className="pt-2">
                  <div className="flex justify-between text-sm mb-2 font-medium">
                    <span className="text-slate-600">{t('inventory.card.distributionRate', 'Taux de distribution')}</span>
                    <span style={{ color: bottleColor }}>{distributionRate.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-500" 
                      style={{ width: `${Math.min(distributionRate, 100)}%`, backgroundColor: bottleColor }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 p-2.5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('inventory.card.criticalThreshold', 'Seuil critique')}</span>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      step={10}
                      value={criticalThreshold}
                      onChange={(e) => {
                        const parsed = Number(e.target.value);
                        if (!Number.isFinite(parsed)) return;
                        setThresholdsByBottle(prev => ({ ...prev, [bottle.id]: Math.max(0, Math.round(parsed)) }));
                      }}
                      className="h-8 w-24 bg-white"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const fallback = getDefaultCriticalThreshold(computedTotal || 0);
                        setThresholdsByBottle(prev => ({ ...prev, [bottle.id]: fallback }));
                      }}
                    >
                      {t('inventory.card.auto', 'Auto')}
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 p-2.5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('inventory.card.adjustStock', 'Ajuster le stock')}</span>
                  <div className="flex items-center gap-2">
                    <ToggleGroup
                      type="single"
                      value={adjustModeByBottle[bottle.id] ?? 'add'}
                      onValueChange={(value) => {
                        if (!value) return;
                        setAdjustModeByBottle((prev) => ({ ...prev, [bottle.id]: value as 'add' | 'remove' }));
                      }}
                    >
                      <ToggleGroupItem value="add" className="h-8 px-2">
                        <Plus className="w-3.5 h-3.5" />
                      </ToggleGroupItem>
                      <ToggleGroupItem value="remove" className="h-8 px-2">
                        <Minus className="w-3.5 h-3.5" />
                      </ToggleGroupItem>
                    </ToggleGroup>
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      value={stockAdjustByBottle[bottle.id] ?? ''}
                      onChange={(e) => setStockAdjustByBottle((prev) => ({ ...prev, [bottle.id]: e.target.value }))}
                      className="h-8 w-20 bg-white"
                      placeholder="0"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8"
                      disabled={adjustingBottleId === bottle.id}
                      onClick={() => handleAdjustPleinStock(bottle, stockPlein, distributed)}
                    >
                      {t('inventory.card.apply', 'Appliquer')}
                    </Button>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1 border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold"
                    onClick={() => {
                      setSelectedBottleId(bottle.id);
                      setEditDialogOpen(true);
                    }}
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    {t('inventory.card.edit', 'Modifier')}
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1 border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold"
                    onClick={() => {
                      setSelectedBottleId(bottle.id);
                      setHistoryDialogOpen(true);
                    }}
                  >
                    <History className="w-4 h-4 mr-2" />
                    {t('inventory.card.history', 'Historique')}
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="border-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 text-slate-500"
                    onClick={() => {
                      setBottleToDelete(bottle);
                      setDeleteConfirmDialogOpen(true);
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
          );
        })}
        {filteredBottleCards.length === 0 && (
          <Card className="md:col-span-2 lg:col-span-3 border-dashed">
            <CardContent className="py-16 text-center text-slate-500">
              {t('inventory.empty.noResultForFilters', 'Aucun résultat pour les filtres actifs.')}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Summary Card */}
      <Card className="border-slate-200 overflow-hidden">
        <CardHeader className="bg-slate-50 border-b border-slate-100">
          <CardTitle className="text-xl font-bold text-slate-800">{t('inventory.summary.title', "Résumé de l'inventaire")}</CardTitle>
        </CardHeader>
        <CardContent className="pt-8 pb-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 items-center">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <Archive className="w-6 h-6 text-indigo-600" />
              </div>
              <div className="text-3xl font-black text-slate-900">
                {availableBottleTypes.reduce((sum, bt) => sum + Number((bt as any).totalQuantity ?? (bt as any).totalquantity ?? 0), 0)}
              </div>
              <div className="text-sm font-bold text-slate-500 uppercase tracking-wide">{t('inventory.summary.totalGeneral', 'Total général')}</div>
            </div>
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <Truck className="w-6 h-6 text-blue-600" />
              </div>
              <div className="text-3xl font-black text-blue-600">
                {Array.isArray(supplyOrders) ? supplyOrders.reduce((total, o: any) => {
                  let items: any[] = [];
                  try {
                    if (Array.isArray(o?.items)) {
                      items = o.items;
                    } else if (typeof o?.items === 'string') {
                      const s = o.items.trim();
                      if (s.startsWith('[') || s.startsWith('{')) {
                        const parsed = JSON.parse(s);
                        items = Array.isArray(parsed) ? parsed : [parsed];
                      }
                    } else if (typeof o?.items === 'object' && o?.items !== null) {
                      items = [o.items];
                    }
                  } catch {
                    items = [];
                  }
                  const qty = items.reduce((s: number, it: any) => {
                    const val = Number(it?.fullQuantity ?? it?.full_quantity ?? it?.quantity ?? it?.qty ?? 0);
                    return s + val;
                  }, 0);
                  return total + qty;
                }, 0) : 0}
              </div>
              <div className="text-sm font-bold text-slate-500 uppercase tracking-wide">{t('inventory.summary.distributed', 'Distribuées')}</div>
            </div>
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <PackageCheck className="w-6 h-6 text-emerald-600" />
              </div>
              <div className="text-3xl font-black text-emerald-600">
                {availableBottleTypes.reduce((sum, bt) => {
                  const totalStored = Number((bt as any).totalQuantity ?? (bt as any).totalquantity ?? 0);
                  const distributedField = Number((bt as any).distributedQuantity ?? (bt as any).distributedquantity ?? bt.distributedQuantity ?? 0);
                  const pending = getPendingCirculation(bt.id);
                  const distributed = Math.max(distributedField, pending);
                  const stockPlein = Math.max(totalStored - distributed, 0);
                  return sum + stockPlein;
                }, 0)}
              </div>
              <div className="text-sm font-bold text-slate-500 uppercase tracking-wide">{t('inventory.summary.remaining', 'Restantes')}</div>
            </div>
            <div className="text-center space-y-2">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setShowTotalValue(!showTotalValue)} 
                className="w-12 h-12 rounded-full hover:bg-slate-100 mx-auto mb-2"
              >
                {showTotalValue ? <EyeOff className="w-6 h-6 text-slate-600" /> : <Eye className="w-6 h-6 text-slate-600" />}
              </Button>
              {showTotalValue ? (
                <div className="text-3xl font-black text-indigo-600">
                  {availableBottleTypes.reduce((sum, bt) => {
                    const rem = Number((bt as any).remainingQuantity ?? 0);
                    const price = Number((bt as any).unitPrice ?? 0);
                    return sum + (rem * price);
                  }, 0).toLocaleString(uiLocale)} DH
                </div>
              ) : (
                <div className="text-3xl font-black text-slate-300">••••••</div>
              )}
              <div className="text-sm font-bold text-slate-500 uppercase tracking-wide">{t('inventory.summary.totalValue', 'Valeur totale')}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader className="flex flex-row items-center justify-between gap-4 border-b border-slate-100 bg-slate-50/50">
          <div>
            <CardTitle className="text-xl font-bold text-slate-800">{t('inventory.impact.title', "Suivi d'impact du stock")}</CardTitle>
            <p className="text-sm text-slate-500 font-medium">{t('inventory.impact.subtitle', 'Résumé et dernières modifications')}</p>
          </div>
      
          <div className="flex items-center gap-3">
            <ToggleGroup
              type="single"
              value={impactView}
              onValueChange={(v) => v && setImpactView(v as 'today' | 'last7days')}
              className="bg-white border border-slate-200 p-1 rounded-lg"
            >
              <ToggleGroupItem value="today" className="px-3 py-1 text-sm font-semibold data-[state=on]:bg-indigo-600 data-[state=on]:text-white rounded-md transition-all">
                {t('inventory.impact.today', "Aujourd'hui")}
              </ToggleGroupItem>
              <ToggleGroupItem value="last7days" className="px-3 py-1 text-sm font-semibold data-[state=on]:bg-indigo-600 data-[state=on]:text-white rounded-md transition-all">
                {t('inventory.impact.last7Days', '7 derniers jours')}
              </ToggleGroupItem>
            </ToggleGroup>
      
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setImpactPanelVisible((p) => !p)}
              className="text-slate-600 hover:text-indigo-600 font-bold"
            >
              {impactPanelVisible ? <ChevronUp className="w-4 h-4 mr-2" /> : <ChevronDown className="w-4 h-4 mr-2" />}
              {impactPanelVisible ? t('inventory.common.hide', 'Masquer') : t('inventory.common.show', 'Afficher')}
            </Button>
          </div>
        </CardHeader>
      
        {impactPanelVisible && (
          <CardContent className="space-y-8 pt-6">
            {/* Résumé Impact */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{t('inventory.impact.deltaEmpty', 'Δ Vides')}</div>
                <div className={`text-2xl font-black ${summaryTotals.empty >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {fmtDelta(summaryTotals.empty)}
                </div>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{t('inventory.impact.deltaFull', 'Δ Pleins')}</div>
                <div className={`text-2xl font-black ${summaryTotals.full >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {fmtDelta(summaryTotals.full)}
                </div>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{t('inventory.impact.deltaDefective', 'Δ Défectueuses')}</div>
                <div className={`text-2xl font-black ${summaryTotals.defective >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {fmtDelta(summaryTotals.defective)}
                </div>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{t('inventory.impact.deltaForeign', 'Δ Étrangères')}</div>
                <div className={`text-2xl font-black ${summaryTotals.foreign >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {fmtDelta(summaryTotals.foreign)}
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-lg font-bold text-slate-800">{t('inventory.impact.recentTransactions', 'Transactions récentes')}</h4>
                <Badge variant="outline" className="text-slate-500 font-bold border-slate-200">
                  {filteredImpactEvents.length} {t('inventory.impact.operations', 'opérations')}
                </Badge>
              </div>
              
              <div className="border border-slate-100 rounded-xl overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="font-bold text-slate-700">{t('inventory.table.date', 'Date')}</TableHead>
                      <TableHead className="font-bold text-slate-700">{t('inventory.table.operation', 'Opération')}</TableHead>
                      <TableHead className="font-bold text-slate-700">{t('inventory.table.driver', 'Chauffeur')}</TableHead>
                      <TableHead className="font-bold text-slate-700">{t('inventory.table.bottleType', 'Type de bouteille')}</TableHead>
                      <TableHead className="text-right font-bold text-slate-700">{t('inventory.table.variation', 'Variation')}</TableHead>
                    </TableRow>
                  </TableHeader>
                
                  <TableBody>
                    {filteredImpactEvents.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-slate-400 font-medium italic">
                          {t('inventory.impact.noTransactionForPeriod', 'Aucune transaction enregistrée pour cette période')}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredImpactEvents.map((e) => {
                        const primary =
                          e.emptyDelta !== 0
                            ? { kind: t('inventory.card.empty', 'Vides'), qty: e.emptyDelta }
                            : e.fullDelta !== 0
                            ? { kind: t('inventory.card.full', 'Pleins'), qty: e.fullDelta }
                            : e.defectiveDelta !== 0
                            ? { kind: t('inventory.defective.titleShort', 'Défectueuses'), qty: e.defectiveDelta }
                            : { kind: t('inventory.impact.foreignShort', 'Étrangères'), qty: e.foreignDelta };

                        return (
                          <MotionTableRow
                            key={`${e.id}-${e.date}-${e.emptyDelta}-${e.fullDelta}-${e.defectiveDelta}-${e.foreignDelta}`}
                            layout
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.18, ease: 'easeOut' }}
                            className="hover:bg-slate-50/50 transition-colors"
                          >
                            <TableCell className="font-medium text-slate-600">
                              {safeDate(e.date).toLocaleString(uiLocale, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-bold text-slate-800">{e.label}</span>
                                <span className="text-xs text-slate-500">
                                  {e.source === 'supply'
                                    ? t('inventory.impact.source.supply', 'Sortie')
                                    : e.source === 'return'
                                    ? t('inventory.impact.source.return', 'Retour')
                                    : t('inventory.impact.source.foreign', 'Étrangère')}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {e.driverName ? (
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-[10px] font-bold text-slate-600">
                                    {e.driverName.charAt(0)}
                                  </div>
                                  <span className="text-sm font-semibold text-slate-700">{e.driverName}</span>
                                </div>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </TableCell>
                            <TableCell className="font-bold text-slate-700">
                              {e.bottleTypeName}
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge 
                                variant={primary.qty > 0 ? 'default' : 'destructive'}
                                className={`font-black ${primary.qty > 0 ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-rose-100 text-rose-700 hover:bg-rose-200'} border-none`}
                              >
                                {fmtDelta(primary.qty)} {primary.kind}
                              </Badge>
                            </TableCell>
                          </MotionTableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Empty & Defective Stock inside Inventory */}
      <div className="space-y-8">
        {/* Empty bottles section */}
        <div>
          <h2 className="text-xl font-semibold">{t('inventory.empty.title', 'Stock Vides')}</h2>
          <p className="text-muted-foreground mb-4">{t('inventory.empty.subtitle', 'Gestion des stocks de bouteilles vides')}</p>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {availableBottleTypes.map((bottle) => {
              const qty = getEmptyQuantity(bottle.id);
              const info = simpleStatus(qty);
              return (
                <Card key={bottle.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{bottle.name}</CardTitle>
                      <Badge variant={info.variant} className="flex items-center gap-1">
                        <info.icon className="w-3 h-3" />
                        {info.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{bottle.capacity}</p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center text-sm">
                      <div className="flex flex-col">
                        <span>{t('inventory.empty.bottles', 'Bouteilles vides')}</span>
                        <span className="font-medium text-2xl">{qty}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 hover:bg-purple-50 hover:text-purple-600"
                        onClick={() => {
                          setHistoryBottle({ bottle, type: 'empty' });
                          setStockHistoryDialogOpen(true);
                        }}
                      >
                        <History className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <svg viewBox="0 0 120 28" className="h-8 w-[120px] shrink-0">
                        <defs>
                          <linearGradient id={`emptyCardGradient-${bottle.id}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.32" />
                            <stop offset="100%" stopColor="#a78bfa" stopOpacity="0.02" />
                          </linearGradient>
                        </defs>
                        <path d="M2 26 L118 26" className="stroke-purple-100" strokeWidth="1.2" fill="none" />
                        <motion.path
                          d={sparklineByBottle[bottle.id]?.empty.areaPath || 'M2 26 L2 14 L118 14 L118 26 Z'}
                          fill={`url(#emptyCardGradient-${bottle.id})`}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.55, ease: 'easeOut' }}
                        />
                        <motion.path
                          d={sparklineByBottle[bottle.id]?.empty.path || 'M2 14 L118 14'}
                          className="stroke-purple-500"
                          strokeWidth="2"
                          fill="none"
                          strokeLinecap="round"
                          initial={{ pathLength: 0, opacity: 0.4 }}
                          animate={{ pathLength: 1, opacity: 1 }}
                          transition={{
                            duration: 1.15 - Math.min(1, Math.max(0, Number(sparklineByBottle[bottle.id]?.empty.volatility || 0))) * 0.45,
                            ease: 'easeOut'
                          }}
                        />
                        <motion.circle
                          cx={sparklineByBottle[bottle.id]?.empty.lastPoint.x || 118}
                          cy={sparklineByBottle[bottle.id]?.empty.lastPoint.y || 14}
                          r="2.8"
                          className="fill-purple-500"
                          animate={{
                            r: [
                              2.2,
                              3.2 + Math.min(1, Math.max(0, Number(sparklineByBottle[bottle.id]?.empty.volatility || 0))) * 2,
                              2.2
                            ],
                            opacity: [
                              0.9,
                              0.35 + Math.min(1, Math.max(0, Number(sparklineByBottle[bottle.id]?.empty.volatility || 0))) * 0.35,
                              0.9
                            ]
                          }}
                          transition={{
                            duration: 2.1 - Math.min(1, Math.max(0, Number(sparklineByBottle[bottle.id]?.empty.volatility || 0))) * 0.9,
                            repeat: Infinity,
                            ease: 'easeInOut'
                          }}
                        />
                      </svg>
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-2 py-0.5 border-none ${
                          sparklineByBottle[bottle.id]?.empty.trend === 'up'
                            ? 'bg-emerald-100 text-emerald-700'
                            : sparklineByBottle[bottle.id]?.empty.trend === 'down'
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {sparklineByBottle[bottle.id]?.empty.trend === 'up'
                        ? t('inventory.trend.upRecovery', '↑ Reprise')
                          : sparklineByBottle[bottle.id]?.empty.trend === 'down'
                          ? t('inventory.trend.downTension', '↓ Tension')
                          : t('inventory.trend.stable', '→ Stable')}
                      </Badge>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => { setSelectedEmptyBottleType(bottle); setEmptyStockDialogOpen(true); }}
                    >
                      <Plus className="w-3 h-3 mr-1" /> {t('inventory.actions.addStock', 'Ajouter Stock')}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Defective bottles section */}
        <div>
          <h2 className="text-xl font-semibold">{t('inventory.defective.title', 'Stock de Bouteilles Défectueuses')}</h2>
          <p className="text-muted-foreground mb-4">{t('inventory.defective.subtitle', 'Gestion des stocks de bouteilles défectueuses')}</p>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {availableBottleTypes.map((bottle) => {
              const qty = getDefectiveQuantity(bottle.id);
              const info = simpleStatus(qty);
              return (
                <Card key={bottle.id} className="hover:shadow-lg transition-shadow border-destructive/20">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{bottle.name}</CardTitle>
                      <Badge variant={info.variant} className="flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        {info.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{bottle.capacity}</p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center text-sm">
                      <div className="flex flex-col">
                        <span>{t('inventory.defective.bottles', 'Bouteilles défectueuses')}</span>
                        <span className="font-medium text-2xl text-destructive">{qty}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600"
                        onClick={() => {
                          setHistoryBottle({ bottle, type: 'defective' });
                          setStockHistoryDialogOpen(true);
                        }}
                      >
                        <History className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <svg viewBox="0 0 120 28" className="h-8 w-[120px] shrink-0">
                        <defs>
                          <linearGradient id={`defectiveCardGradient-${bottle.id}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#f87171" stopOpacity="0.32" />
                            <stop offset="100%" stopColor="#f87171" stopOpacity="0.02" />
                          </linearGradient>
                        </defs>
                        <path d="M2 26 L118 26" className="stroke-red-100" strokeWidth="1.2" fill="none" />
                        <motion.path
                          d={sparklineByBottle[bottle.id]?.defective.areaPath || 'M2 26 L2 14 L118 14 L118 26 Z'}
                          fill={`url(#defectiveCardGradient-${bottle.id})`}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.55, ease: 'easeOut' }}
                        />
                        <motion.path
                          d={sparklineByBottle[bottle.id]?.defective.path || 'M2 14 L118 14'}
                          className="stroke-red-500"
                          strokeWidth="2"
                          fill="none"
                          strokeLinecap="round"
                          initial={{ pathLength: 0, opacity: 0.4 }}
                          animate={{ pathLength: 1, opacity: 1 }}
                          transition={{
                            duration: 1.15 - Math.min(1, Math.max(0, Number(sparklineByBottle[bottle.id]?.defective.volatility || 0))) * 0.45,
                            ease: 'easeOut'
                          }}
                        />
                        <motion.circle
                          cx={sparklineByBottle[bottle.id]?.defective.lastPoint.x || 118}
                          cy={sparklineByBottle[bottle.id]?.defective.lastPoint.y || 14}
                          r="2.8"
                          className="fill-red-500"
                          animate={{
                            r: [
                              2.2,
                              3.2 + Math.min(1, Math.max(0, Number(sparklineByBottle[bottle.id]?.defective.volatility || 0))) * 2,
                              2.2
                            ],
                            opacity: [
                              0.9,
                              0.35 + Math.min(1, Math.max(0, Number(sparklineByBottle[bottle.id]?.defective.volatility || 0))) * 0.35,
                              0.9
                            ]
                          }}
                          transition={{
                            duration: 2.1 - Math.min(1, Math.max(0, Number(sparklineByBottle[bottle.id]?.defective.volatility || 0))) * 0.9,
                            repeat: Infinity,
                            ease: 'easeInOut'
                          }}
                        />
                      </svg>
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-2 py-0.5 border-none ${
                          sparklineByBottle[bottle.id]?.defective.trend === 'down'
                            ? 'bg-emerald-100 text-emerald-700'
                            : sparklineByBottle[bottle.id]?.defective.trend === 'up'
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {sparklineByBottle[bottle.id]?.defective.trend === 'down'
                          ? t('inventory.defective.trend.downImprovement', '↓ Amélioration')
                          : sparklineByBottle[bottle.id]?.defective.trend === 'up'
                          ? t('inventory.defective.trend.upAlert', '↑ Alerte')
                          : t('inventory.trend.stable', '→ Stable')}
                      </Badge>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full border-destructive/40 hover:bg-destructive/10"
                      onClick={() => { setSelectedDefectiveBottleType(bottle); setDefectiveStockDialogOpen(true); }}
                    >
                      <Plus className="w-3 h-3 mr-1" /> {t('inventory.actions.addStock', 'Ajouter Stock')}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

      {/* Empty & Defective Stock Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Empty bottles table */}
        <Card className="shadow-md border-none overflow-hidden">
          <CardHeader className="bg-white border-b border-slate-100 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Package2 className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold">{t('inventory.empty.title', 'Stock Vides')}</CardTitle>
                  <div className="text-2xl font-black text-purple-700 mt-1">
                    {totalEmpty} <span className="text-sm font-medium text-slate-400 uppercase tracking-wider ml-1">{t('inventory.common.bottles', 'Bouteilles')}</span>
                  </div>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowEmpty(!showEmpty)}
                className="hover:bg-slate-100"
              >
                {showEmpty ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </Button>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 pt-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="border-purple-200 bg-purple-50 text-purple-700">
                  {t('inventory.table.top', 'Top')}: {emptyTableStats.topName || '—'} {emptyTableStats.topQty > 0 ? `(${emptyTableStats.topQty})` : ''}
                </Badge>
                <Badge variant="outline" className={emptyTableStats.staleCount > 0 ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}>
                  {emptyTableStats.staleCount > 0 ? `${emptyTableStats.staleCount} ${t('inventory.table.notUpdated', 'non actualisé(s)')}` : t('inventory.table.recentUpdates', 'Mises à jour récentes')}
                </Badge>
                <Badge variant="outline" className={emptyCriticalOnly ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-slate-200 bg-white text-slate-600'}>
                  {emptyCriticalOnly ? t('inventory.table.onlyCritical', 'Seulement critiques') : t('inventory.table.allLevels', 'Tous niveaux')}
                </Badge>
              </div>
              <div className="flex items-center gap-1">
                <Button size="sm" variant={emptyCriticalOnly ? 'default' : 'outline'} className={emptyCriticalOnly ? 'bg-rose-600 hover:bg-rose-700' : ''} onClick={() => setEmptyCriticalOnly((v) => !v)}>
                  {t('inventory.table.critical', 'Critiques')}
                </Button>
                <Button size="sm" variant={emptySortMode === 'qty' ? 'default' : 'outline'} className={emptySortMode === 'qty' ? 'bg-purple-600 hover:bg-purple-700' : ''} onClick={() => setEmptySortMode('qty')}>{t('inventory.table.qty', 'Qté')}</Button>
                <Button size="sm" variant={emptySortMode === 'date' ? 'default' : 'outline'} className={emptySortMode === 'date' ? 'bg-purple-600 hover:bg-purple-700' : ''} onClick={() => setEmptySortMode('date')}>{t('inventory.table.date', 'Date')}</Button>
                <Button size="sm" variant={emptySortMode === 'name' ? 'default' : 'outline'} className={emptySortMode === 'name' ? 'bg-purple-600 hover:bg-purple-700' : ''} onClick={() => setEmptySortMode('name')}>{t('inventory.table.name', 'Nom')}</Button>
              </div>
            </div>
          </CardHeader>
          {showEmpty && (
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50/50">
                    <TableRow>
                      <TableHead className="font-bold text-slate-700 py-4">{t('inventory.table.product', 'Produit')}</TableHead>
                      <TableHead className="text-center font-bold text-slate-700 py-4">{t('inventory.table.quantity', 'Quantité')}</TableHead>
                      <TableHead className="text-right font-bold text-slate-700 py-4">{t('inventory.table.lastUpdate', 'Dernière Mise à Jour')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleEmptyRows.map((stock) => (
                      <MotionTableRow
                        key={`${stock.id}-${stock.quantity}-${stock.lastUpdated}`}
                        layout
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.16, ease: 'easeOut' }}
                        className="hover:bg-slate-50/50 transition-colors border-b border-slate-50"
                      >
                        <TableCell className="font-semibold text-slate-900 py-4">
                          <div className="flex items-center justify-between gap-2">
                            <span>{stock.bottleTypeName}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-slate-500 hover:text-purple-700 hover:bg-purple-50"
                              onClick={() => {
                                const bottle = availableBottleTypes.find((b) => b.id === stock.bottleTypeId);
                                if (!bottle) return;
                                setHistoryBottle({ bottle, type: 'empty' });
                                setStockHistoryDialogOpen(true);
                              }}
                            >
                              <History className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                          <div className="mt-1.5 flex items-center gap-2">
                            <svg viewBox="0 0 120 28" className="h-8 w-[120px] shrink-0">
                              <defs>
                                <linearGradient id={`emptyTableGradient-${stock.id}`} x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.32" />
                                  <stop offset="100%" stopColor="#a78bfa" stopOpacity="0.02" />
                                </linearGradient>
                              </defs>
                              <path d="M2 26 L118 26" className="stroke-purple-100" strokeWidth="1.2" fill="none" />
                              <motion.path
                                d={sparklineByBottle[stock.bottleTypeId]?.empty.areaPath || 'M2 26 L2 14 L118 14 L118 26 Z'}
                                fill={`url(#emptyTableGradient-${stock.id})`}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ duration: 0.55, ease: 'easeOut' }}
                              />
                              <motion.path
                                d={sparklineByBottle[stock.bottleTypeId]?.empty.path || 'M2 14 L118 14'}
                                className="stroke-purple-500"
                                strokeWidth="2"
                                fill="none"
                                strokeLinecap="round"
                                initial={{ pathLength: 0, opacity: 0.4 }}
                                animate={{ pathLength: 1, opacity: 1 }}
                                transition={{
                                  duration: 1.15 - Math.min(1, Math.max(0, Number(sparklineByBottle[stock.bottleTypeId]?.empty.volatility || 0))) * 0.45,
                                  ease: 'easeOut'
                                }}
                              />
                              <motion.circle
                                cx={sparklineByBottle[stock.bottleTypeId]?.empty.lastPoint.x || 118}
                                cy={sparklineByBottle[stock.bottleTypeId]?.empty.lastPoint.y || 14}
                                r="2.8"
                                className="fill-purple-500"
                                animate={{
                                  r: [
                                    2.2,
                                    3.2 + Math.min(1, Math.max(0, Number(sparklineByBottle[stock.bottleTypeId]?.empty.volatility || 0))) * 2,
                                    2.2
                                  ],
                                  opacity: [
                                    0.9,
                                    0.35 + Math.min(1, Math.max(0, Number(sparklineByBottle[stock.bottleTypeId]?.empty.volatility || 0))) * 0.35,
                                    0.9
                                  ]
                                }}
                                transition={{
                                  duration: 2.1 - Math.min(1, Math.max(0, Number(sparklineByBottle[stock.bottleTypeId]?.empty.volatility || 0))) * 0.9,
                                  repeat: Infinity,
                                  ease: 'easeInOut'
                                }}
                              />
                            </svg>
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-2 py-0.5 border-none ${
                                sparklineByBottle[stock.bottleTypeId]?.empty.trend === 'up'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : sparklineByBottle[stock.bottleTypeId]?.empty.trend === 'down'
                                  ? 'bg-rose-100 text-rose-700'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {sparklineByBottle[stock.bottleTypeId]?.empty.trend === 'up'
                                ? t('inventory.trend.upRecovery', '↑ Reprise')
                                : sparklineByBottle[stock.bottleTypeId]?.empty.trend === 'down'
                                ? t('inventory.trend.downTension', '↓ Tension')
                                : t('inventory.trend.stable', '→ Stable')}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-center py-4">
                          <Badge variant="outline" className="font-bold px-3 py-1 bg-purple-50 text-purple-700 border-purple-100">
                            {stock.quantity}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-slate-500 text-sm py-4 font-mono">
                          {safeDate(stock.lastUpdated).toLocaleString(uiLocale)}
                        </TableCell>
                      </MotionTableRow>
                    ))}
                    {visibleEmptyRows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-12 text-slate-400 italic">
                          {emptyCriticalOnly ? t('inventory.empty.noCritical', 'Aucune bouteille vide critique') : t('inventory.empty.noStock', 'Aucune bouteille vide en stock')}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Defective bottles table */}
        <Card className="shadow-md border-none overflow-hidden">
          <CardHeader className="bg-white border-b border-slate-100 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold">{t('inventory.defective.titleShort', 'Stock Défectueuses')}</CardTitle>
                  <div className="text-2xl font-black text-red-700 mt-1">
                    {totalDefective} <span className="text-sm font-medium text-slate-400 uppercase tracking-wider ml-1">{t('inventory.common.bottles', 'Bouteilles')}</span>
                  </div>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowDefective(!showDefective)}
                className="hover:bg-slate-100"
              >
                {showDefective ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </Button>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 pt-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">
                  {t('inventory.table.top', 'Top')}: {defectiveTableStats.topName || '—'} {defectiveTableStats.topQty > 0 ? `(${defectiveTableStats.topQty})` : ''}
                </Badge>
                <Badge variant="outline" className={defectiveTableStats.critical > 0 ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}>
                  {t('inventory.table.critical', 'Critiques')}: {defectiveTableStats.critical}
                </Badge>
                <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                  {t('inventory.table.medium', 'Moyens')}: {defectiveTableStats.medium}
                </Badge>
                <Badge variant="outline" className={defectiveCriticalOnly ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-slate-200 bg-white text-slate-600'}>
                  {defectiveCriticalOnly ? t('inventory.table.onlyCritical', 'Seulement critiques') : t('inventory.table.allLevels', 'Tous niveaux')}
                </Badge>
              </div>
              <div className="flex items-center gap-1">
                <Button size="sm" variant={defectiveCriticalOnly ? 'default' : 'outline'} className={defectiveCriticalOnly ? 'bg-rose-600 hover:bg-rose-700' : ''} onClick={() => setDefectiveCriticalOnly((v) => !v)}>
                  {t('inventory.table.critical', 'Critiques')}
                </Button>
                <Button size="sm" variant={defectiveSortMode === 'qty' ? 'default' : 'outline'} className={defectiveSortMode === 'qty' ? 'bg-red-600 hover:bg-red-700' : ''} onClick={() => setDefectiveSortMode('qty')}>{t('inventory.table.qty', 'Qté')}</Button>
                <Button size="sm" variant={defectiveSortMode === 'date' ? 'default' : 'outline'} className={defectiveSortMode === 'date' ? 'bg-red-600 hover:bg-red-700' : ''} onClick={() => setDefectiveSortMode('date')}>{t('inventory.table.date', 'Date')}</Button>
                <Button size="sm" variant={defectiveSortMode === 'name' ? 'default' : 'outline'} className={defectiveSortMode === 'name' ? 'bg-red-600 hover:bg-red-700' : ''} onClick={() => setDefectiveSortMode('name')}>{t('inventory.table.name', 'Nom')}</Button>
              </div>
            </div>
          </CardHeader>
          {showDefective && (
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50/50">
                    <TableRow>
                      <TableHead className="font-bold text-slate-700 py-4">{t('inventory.table.product', 'Produit')}</TableHead>
                      <TableHead className="text-center font-bold text-slate-700 py-4">{t('inventory.table.quantity', 'Quantité')}</TableHead>
                      <TableHead className="text-right font-bold text-slate-700 py-4">{t('inventory.table.date', 'Date')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleDefectiveRows.map((defective) => (
                      <MotionTableRow
                        key={`${defective.id}-${defective.quantity}-${defective.date}`}
                        layout
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.16, ease: 'easeOut' }}
                        className="hover:bg-slate-50/50 transition-colors border-b border-slate-50"
                      >
                        <TableCell className="font-semibold text-slate-900 py-4">
                          <div className="flex items-center justify-between gap-2">
                            <span>{defective.bottleTypeName}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-slate-500 hover:text-red-700 hover:bg-red-50"
                              onClick={() => {
                                const bottle = availableBottleTypes.find((b) => b.id === defective.bottleTypeId);
                                if (!bottle) return;
                                setHistoryBottle({ bottle, type: 'defective' });
                                setStockHistoryDialogOpen(true);
                              }}
                            >
                              <History className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                          <div className="mt-1.5 flex items-center gap-2">
                            <svg viewBox="0 0 120 28" className="h-8 w-[120px] shrink-0">
                              <defs>
                                <linearGradient id={`defectiveTableGradient-${defective.id}`} x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#f87171" stopOpacity="0.32" />
                                  <stop offset="100%" stopColor="#f87171" stopOpacity="0.02" />
                                </linearGradient>
                              </defs>
                              <path d="M2 26 L118 26" className="stroke-red-100" strokeWidth="1.2" fill="none" />
                              <motion.path
                                d={sparklineByBottle[defective.bottleTypeId]?.defective.areaPath || 'M2 26 L2 14 L118 14 L118 26 Z'}
                                fill={`url(#defectiveTableGradient-${defective.id})`}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ duration: 0.55, ease: 'easeOut' }}
                              />
                              <motion.path
                                d={sparklineByBottle[defective.bottleTypeId]?.defective.path || 'M2 14 L118 14'}
                                className="stroke-red-500"
                                strokeWidth="2"
                                fill="none"
                                strokeLinecap="round"
                                initial={{ pathLength: 0, opacity: 0.4 }}
                                animate={{ pathLength: 1, opacity: 1 }}
                                transition={{
                                  duration: 1.15 - Math.min(1, Math.max(0, Number(sparklineByBottle[defective.bottleTypeId]?.defective.volatility || 0))) * 0.45,
                                  ease: 'easeOut'
                                }}
                              />
                              <motion.circle
                                cx={sparklineByBottle[defective.bottleTypeId]?.defective.lastPoint.x || 118}
                                cy={sparklineByBottle[defective.bottleTypeId]?.defective.lastPoint.y || 14}
                                r="2.8"
                                className="fill-red-500"
                                animate={{
                                  r: [
                                    2.2,
                                    3.2 + Math.min(1, Math.max(0, Number(sparklineByBottle[defective.bottleTypeId]?.defective.volatility || 0))) * 2,
                                    2.2
                                  ],
                                  opacity: [
                                    0.9,
                                    0.35 + Math.min(1, Math.max(0, Number(sparklineByBottle[defective.bottleTypeId]?.defective.volatility || 0))) * 0.35,
                                    0.9
                                  ]
                                }}
                                transition={{
                                  duration: 2.1 - Math.min(1, Math.max(0, Number(sparklineByBottle[defective.bottleTypeId]?.defective.volatility || 0))) * 0.9,
                                  repeat: Infinity,
                                  ease: 'easeInOut'
                                }}
                              />
                            </svg>
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-2 py-0.5 border-none ${
                                sparklineByBottle[defective.bottleTypeId]?.defective.trend === 'down'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : sparklineByBottle[defective.bottleTypeId]?.defective.trend === 'up'
                                  ? 'bg-rose-100 text-rose-700'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {sparklineByBottle[defective.bottleTypeId]?.defective.trend === 'down'
                                ? t('inventory.defective.trend.downImprovement', '↓ Amélioration')
                                : sparklineByBottle[defective.bottleTypeId]?.defective.trend === 'up'
                                ? t('inventory.defective.trend.upAlert', '↑ Alerte')
                                : t('inventory.trend.stable', '→ Stable')}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-center py-4">
                          <Badge variant="outline" className="font-bold px-3 py-1 bg-red-50 text-red-700 border-red-100">
                            {defective.quantity}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-slate-500 text-sm py-4 font-mono">
                          {safeDate(defective.date).toLocaleString(uiLocale)}
                        </TableCell>
                      </MotionTableRow>
                    ))}
                    {visibleDefectiveRows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-12 text-slate-400 italic">
                          {defectiveCriticalOnly ? t('inventory.defective.noCritical', 'Aucune bouteille défectueuse critique') : t('inventory.defective.noStock', 'Aucune bouteille défectueuse en stock')}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
      </div>

      {/* Dialogs */}
      {selectedBottle && (
        <>
          <EditBottleTypeDialog
            bottle={selectedBottle}
            open={editDialogOpen}
            onOpenChange={(open) => {
              setEditDialogOpen(open);
              if (!open) setSelectedBottleId(null);
            }}
          />
          <BottleHistoryDialog
            bottle={selectedBottle}
            open={historyDialogOpen}
            onOpenChange={(open) => {
              setHistoryDialogOpen(open);
              if (!open) setSelectedBottleId(null);
            }}
          />
        </>
      )}
      {selectedEmptyBottleType && (
        <AddEmptyStockDialog
          bottleType={selectedEmptyBottleType}
          open={emptyStockDialogOpen}
          onOpenChange={setEmptyStockDialogOpen}
        />
      )}
      {selectedDefectiveBottleType && (
        <AddDefectiveStockDialog
          bottleType={selectedDefectiveBottleType}
          open={defectiveStockDialogOpen}
          onOpenChange={setDefectiveStockDialogOpen}
        />
      )}

      {/* Stock History Dialog */}
      <Dialog open={stockHistoryDialogOpen} onOpenChange={setStockHistoryDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col p-0 gap-0 border-none shadow-2xl">
          {historyBottle && (
            <>
              <div className={`p-6 ${historyBottle.type === 'empty' ? 'bg-purple-600' : 'bg-red-600'} text-white`}>
                <DialogHeader>
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <DialogTitle className="text-2xl font-bold flex items-center gap-3 text-white">
                        <History className="w-6 h-6" />
                        {t('inventory.history.title', 'Historique des mouvements')}
                      </DialogTitle>
                      <DialogDescription className="text-white/80 text-base">
                        {historyBottle.bottle.name} • {historyBottle.type === 'empty' ? t('inventory.empty.title', 'Stock Vides') : t('inventory.defective.titleShort', 'Stock Défectueux')}
                      </DialogDescription>
                    </div>
                    <div className="hidden md:flex flex-col items-end">
                      <span className="text-xs uppercase tracking-wider text-white/60">{t('inventory.history.currentStock', 'Stock Actuel')}</span>
                      <span className="text-3xl font-black">
                        {historyBottle.type === 'empty' 
                          ? getEmptyQuantity(historyBottle.bottle.id) 
                          : getDefectiveQuantity(historyBottle.bottle.id)}
                      </span>
                    </div>
                  </div>
                </DialogHeader>
              </div>

              <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <Table>
                    <TableHeader className="bg-slate-50/80 sticky top-0 z-10">
                      <TableRow className="hover:bg-transparent border-b border-slate-200">
                        <TableHead className="w-[180px] font-bold text-slate-600 py-4">{t('inventory.history.dateTime', 'Date & Heure')}</TableHead>
                        <TableHead className="font-bold text-slate-600 py-4">{t('inventory.history.operationType', "Type d'opération")}</TableHead>
                        <TableHead className="text-center font-bold text-slate-600 py-4">{t('inventory.table.quantity', 'Quantité')}</TableHead>
                        <TableHead className="text-right font-bold text-slate-600 py-4">{t('inventory.history.stockEvolution', 'Évolution Stock')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredStockHistory.map((entry) => {
                          const isAdd = entry.changeType === 'add' || 
                            entry.changeType === 'return' || 
                            (entry.changeType === 'factory' && entry.newQuantity > entry.previousQuantity);
                          
                          let label = entry.changeType;
                          if (entry.changeType === 'add') label = t('inventory.history.change.addManual', 'Ajout Manuel');
                          else if (entry.changeType === 'return') label = t('inventory.history.change.returnBd', 'Retour B.D');
                          else if (entry.changeType === 'remove') label = t('inventory.history.change.stockOut', 'Sortie Stock');
                          else if (entry.changeType === 'factory') {
                            label = entry.newQuantity > entry.previousQuantity
                              ? t('inventory.history.change.factoryReturn', 'Retour Usine')
                              : t('inventory.history.change.factorySend', 'Envoi Usine');
                          }

                          return (
                            <MotionTableRow
                              key={`${entry.id}-${entry.newQuantity}-${entry.date}`}
                              layout
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.17, ease: 'easeOut' }}
                              className="hover:bg-slate-50/50 transition-colors border-b border-slate-100"
                            >
                              <TableCell className="py-4">
                                <div className="flex flex-col">
                                  <span className="text-sm font-semibold text-slate-900">
                                    {safeDate(entry.date).toLocaleDateString(uiLocale, { day: '2-digit', month: 'long', year: 'numeric' })}
                                  </span>
                                  <span className="text-xs text-slate-500 font-mono">
                                    {safeDate(entry.date).toLocaleTimeString(uiLocale)}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="py-4">
                                <div className="flex items-center gap-3">
                                  <div className={`p-1.5 rounded-lg ${isAdd ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                    {isAdd ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                                  </div>
                                  <div className="flex flex-col">
                                    <span className={`text-sm font-bold uppercase tracking-tight ${isAdd ? 'text-green-700' : 'text-red-700'}`}>
                                      {label}
                                    </span>
                                    {entry.note && (
                                      <span className="text-[11px] text-slate-500 line-clamp-1 italic max-w-[200px]" title={entry.note}>
                                        {entry.note}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-center py-4">
                                <Badge 
                                  variant="outline" 
                                  className={`font-black px-2.5 py-0.5 border-none ${
                                    isAdd ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                  }`}
                                >
                                  {isAdd ? '+' : '-'}{entry.quantity}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right py-4">
                                <div className="flex items-center justify-end gap-2 text-sm">
                                  <span className="text-slate-400 line-through decoration-slate-300">{entry.previousQuantity}</span>
                                  <div className="w-3 h-[1px] bg-slate-300"></div>
                                  <span className="font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                                    {entry.newQuantity}
                                  </span>
                                </div>
                              </TableCell>
                            </MotionTableRow>
                          );
                        })}
                      {filteredStockHistory.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="py-20 text-center">
                            <div className="flex flex-col items-center justify-center space-y-3">
                              <div className="p-4 bg-slate-100 rounded-full">
                                <Archive className="w-8 h-8 text-slate-400" />
                              </div>
                              <div className="space-y-1">
                                <p className="text-slate-900 font-bold">{t('inventory.history.noHistory', 'Aucun historique')}</p>
                                <p className="text-slate-500 text-sm">{t('inventory.history.noHistoryHint', 'Les mouvements de stock apparaîtront ici.')}</p>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
              <div className="p-4 bg-white border-t border-slate-200 flex justify-end">
                <Button 
                  onClick={() => setStockHistoryDialogOpen(false)}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-8"
                >
                  {t('inventory.common.close', 'Fermer')}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      {/* Confirm Clear All Inventory Dialog */}
      {/* Confirmation Clear Dialog */}
      <Dialog open={confirmClearDialogOpen} onOpenChange={setConfirmClearDialogOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-2xl border-none shadow-2xl">
          <DialogHeader className="space-y-3">
            <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-2">
              <AlertTriangle className="h-6 w-6 text-rose-600" />
            </div>
            <DialogTitle className="text-2xl font-bold text-center text-slate-900">
              {t('inventory.confirmReset.title', 'Réinitialisation complète')}
            </DialogTitle>
            <DialogDescription className="text-center text-slate-500 text-base leading-relaxed pt-2">
              {t('inventory.confirmReset.question', 'Êtes-vous sûr de vouloir réinitialiser tout le stock ?')}
              <br />
              <span className="font-bold text-slate-700">
                {t('inventory.confirmReset.description', 'Cette action remettra toutes les quantités à zéro mais conservera les types de bouteilles standards.')}
              </span>
              <br />
              <span className="text-rose-600 font-black mt-2 block">{t('inventory.common.irreversible', 'Cette action est irréversible.')}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 mt-6">
            <Button 
              variant="outline" 
              onClick={() => setConfirmClearDialogOpen(false)}
              className="flex-1 h-12 rounded-xl border-slate-200 font-bold text-slate-600 hover:bg-slate-50"
            >
              {t('inventory.common.cancel', 'Annuler')}
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => {
                clearAllInventory();
                setConfirmClearDialogOpen(false);
              }}
              className="flex-1 h-12 rounded-xl bg-rose-600 hover:bg-rose-700 font-bold shadow-lg shadow-rose-200"
            >
              {t('inventory.common.confirm', 'Confirmer')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Bottle Type Confirmation Dialog */}
      <Dialog open={deleteConfirmDialogOpen} onOpenChange={setDeleteConfirmDialogOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-2xl border-none shadow-2xl">
          <DialogHeader className="space-y-3">
            <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-2">
              <Trash2 className="h-6 w-6 text-rose-600" />
            </div>
            <DialogTitle className="text-2xl font-bold text-center text-slate-900">
              {t('inventory.confirmDelete.title', 'Supprimer')} {bottleToDelete?.name}
            </DialogTitle>
            <DialogDescription className="text-center text-slate-500 text-base leading-relaxed pt-2">
              {t('inventory.confirmDelete.question', 'Êtes-vous sûr de vouloir supprimer ce type de bouteille ?')}
              <br />
              <span className="font-bold text-slate-700">
                {t('inventory.confirmDelete.description', 'Toutes les données associées à ce type seront définitivement supprimées.')}
              </span>
              <br />
              <span className="text-rose-600 font-black mt-2 block">{t('inventory.common.irreversible', 'Cette action est irréversible.')}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 mt-6">
            <Button 
              variant="outline" 
              onClick={() => {
                setDeleteConfirmDialogOpen(false);
                setBottleToDelete(null);
              }}
              className="flex-1 h-12 rounded-xl border-slate-200 font-bold text-slate-600 hover:bg-slate-50"
            >
              {t('inventory.common.cancel', 'Annuler')}
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDelete}
              className="flex-1 h-12 rounded-xl bg-rose-600 hover:bg-rose-700 font-bold shadow-lg shadow-rose-200"
            >
              {t('inventory.common.delete', 'Supprimer')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Inventory;
