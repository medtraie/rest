import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useApp } from '@/contexts/AppContext';
import { useT, useLanguage } from '@/contexts/LanguageContext';
import { BottleType } from '@/types';
import { 
  Package, 
  PackageCheck,
  TrendingUp, 
  TrendingDown, 
  RefreshCw, 
  Factory, 
  Truck, 
  AlertTriangle, 
  Search,
  Layers,
  Sparkles,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldAlert
} from 'lucide-react';

interface BottleHistoryDialogProps {
  bottle: BottleType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export type MovementCategory = 'all' | 'truck' | 'factory' | 'adjustment';

export interface FormattedMovement {
  id: string;
  date: string | number;
  type: string;
  category: 'truck' | 'factory' | 'adjustment' | 'exchange';
  direction: 'in' | 'out' | 'neutral';
  label: string;
  quantity: number;
  note?: string;
  driverName?: string;
  truckPlate?: string;
  orderNumber?: string;
}

export const BottleHistoryDialog = ({ bottle, open, onOpenChange }: BottleHistoryDialogProps) => {
  const { 
    transactions = [], 
    returnOrders = [], 
    foreignBottles = [], 
    supplyOrders = [], 
    emptyBottlesStock = [], 
    defectiveBottles = [], 
    stockHistory = [],
    drivers = [],
    trucks = []
  } = useApp();

  const t = useT();
  const { language } = useLanguage();
  const [activeTab, setActiveTab] = useState<MovementCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Drivers and trucks lookup maps
  const driverMap = useMemo(() => {
    const map = new Map<string, string>();
    (drivers || []).forEach((d: any) => {
      if (d?.id) map.set(String(d.id), d.name || String(d.id));
    });
    return map;
  }, [drivers]);

  const truckMap = useMemo(() => {
    const map = new Map<string, string>();
    (trucks || []).forEach((tr: any) => {
      if (tr?.id) map.set(String(tr.id), tr.plateNumber || tr.name || String(tr.id));
    });
    return map;
  }, [trucks]);

  // Comprehensive bottle movements aggregator
  const bottleMovements = useMemo(() => {
    const entries: FormattedMovement[] = [];
    const seenIds = new Set<string>();

    // 1. Transactions (Factory, Supply, Exchange, etc.)
    const safeTransactions = Array.isArray(transactions) ? transactions : [];
    safeTransactions.forEach((tx: any) => {
      const bt = Array.isArray(tx?.bottleTypes)
        ? tx.bottleTypes.find((x: any) => String(x?.bottleTypeId) === String(bottle.id))
        : undefined;
      if (!bt) return;

      const qty = Number(bt.quantity || 0);
      if (qty <= 0) return;

      let category: 'truck' | 'factory' | 'adjustment' | 'exchange' = 'truck';
      let direction: 'in' | 'out' | 'neutral' = 'neutral';
      let label = tx.type;

      if (tx.type === 'supply') {
        category = 'truck';
        direction = 'out';
        label = t('inventory.history.supplyTruck', 'Alimentation camion');
      } else if (tx.type === 'factory_reception' || tx.type === 'factory_in') {
        category = 'factory';
        direction = 'in';
        label = t('inventory.history.factoryReception', 'Réception Usine (Pleins)');
      } else if (tx.type === 'factory' || tx.type === 'factory_send' || tx.type === 'factory_out') {
        category = 'factory';
        direction = 'out';
        label = t('inventory.history.factorySend', 'Envoi Usine (Vides)');
      } else if (tx.type === 'exchange') {
        category = 'exchange';
        direction = 'neutral';
        label = t('inventory.history.exchange', 'Échange de bouteilles');
      } else if (tx.type === 'return') {
        category = 'truck';
        direction = 'in';
        label = t('inventory.history.returnTruck', 'Retour camion');
      }

      const id = `tx-${tx.id || `${tx.type}-${tx.date}`}`;
      if (!seenIds.has(id)) {
        seenIds.add(id);
        entries.push({
          id,
          date: tx.date || tx.created_at || Date.now(),
          type: tx.type,
          category,
          direction,
          label,
          quantity: qty,
          note: tx.note || tx.description,
          driverName: tx.driverId ? driverMap.get(String(tx.driverId)) : tx.driverName,
          truckPlate: tx.truckId ? truckMap.get(String(tx.truckId)) : tx.truckPlate,
        });
      }
    });

    // 2. Supply Orders (Chargements camions)
    const safeSupplyOrders = Array.isArray(supplyOrders) ? supplyOrders : [];
    safeSupplyOrders.forEach((so: any) => {
      let items: any[] = [];
      try {
        if (Array.isArray(so?.items)) items = so.items;
        else if (typeof so?.items === 'string') {
          const parsed = JSON.parse(so.items);
          items = Array.isArray(parsed) ? parsed : [parsed];
        }
      } catch {}

      items.forEach((item: any) => {
        const itId = String(item?.bottleTypeId ?? item?.bottle_type_id ?? item?.id ?? '');
        const itName = String(item?.bottleTypeName ?? item?.name ?? item?.bottle_type_name ?? '');
        if (itId === String(bottle.id) || (itName && itName.toLowerCase() === bottle.name.toLowerCase())) {
          const qty = Number(item?.fullQuantity ?? item?.full_quantity ?? item?.quantity ?? item?.qty ?? 0);
          if (qty > 0) {
            const id = `so-${so.id}-${item.bottleTypeId || itId || item.id || itName}`;
            if (!seenIds.has(id)) {
              seenIds.add(id);
              entries.push({
                id,
                date: so.date || so.created_at || Date.now(),
                type: 'supply_order',
                category: 'truck',
                direction: 'out',
                label: t('inventory.history.supplyOrder', 'Chargement Camion'),
                quantity: qty,
                orderNumber: so.orderNumber || so.id,
                driverName: so.driverName || (so.driverId ? driverMap.get(String(so.driverId)) : undefined),
                truckPlate: so.truckPlate || (so.truckId ? truckMap.get(String(so.truckId)) : undefined),
              });
            }
          }
        }
      });
    });

    // 3. Return Orders (Déchargements / Retours chauffeurs)
    const safeReturns = Array.isArray(returnOrders) ? returnOrders : [];
    safeReturns.forEach((ro: any) => {
      (ro.items || []).forEach((item: any) => {
        if (String(item?.bottleTypeId) !== String(bottle.id)) return;

        const driverName = ro.driverName || (ro.driverId ? driverMap.get(String(ro.driverId)) : undefined);
        const orderNumber = ro.orderNumber || ro.supplyOrderId || ro.id;

        const addMovement = (qty: number, label: string, suffix: string, direction: 'in' | 'out', note?: string) => {
          if (Number(qty) > 0) {
            const id = `ro-${ro.id}-${item.bottleTypeId}-${suffix}`;
            if (!seenIds.has(id)) {
              seenIds.add(id);
              entries.push({
                id,
                date: ro.date || ro.created_at || Date.now(),
                type: `return_${suffix}`,
                category: 'truck',
                direction,
                label,
                quantity: Number(qty),
                driverName,
                orderNumber,
                note,
              });
            }
          }
        };

        addMovement(item.returnedFullQuantity || 0, t('inventory.history.returnedFull', 'Retour Pleins'), 'full', 'in');
        addMovement(item.returnedEmptyQuantity || 0, t('inventory.history.returnedEmpty', 'Retour Vides'), 'empty', 'in');
        addMovement(item.defectiveQuantity || 0, t('inventory.history.returnedDefective', 'Retour Défectueuses'), 'defective', 'in');
        addMovement(item.foreignQuantity || 0, t('inventory.history.returnedForeign', 'Retour Étrangères'), 'foreign', 'in');
        addMovement(item.consigneQuantity || 0, t('inventory.history.consigne', 'Consigne'), 'consigne', 'in');
        addMovement(item.lostQuantity || 0, t('inventory.history.lost', 'Bouteille Perdue'), 'lost', 'out');
      });
    });

    // 4. Foreign Bottles direct
    const safeForeigns = Array.isArray(foreignBottles) ? foreignBottles : [];
    safeForeigns
      .filter((fb: any) => (!fb.returnOrderId || fb.returnOrderId === 'direct') && String(fb?.bottleType) === String(bottle.name))
      .forEach((fb: any) => {
        const id = `fb-${fb.id}`;
        if (!seenIds.has(id)) {
          seenIds.add(id);
          entries.push({
            id,
            date: fb.date || fb.created_at || Date.now(),
            type: 'foreign_direct',
            category: 'truck',
            direction: 'in',
            label: t('inventory.history.foreignDirect', 'Ajout étranger (direct)'),
            quantity: Number(fb.quantity || 0),
            note: fb.notes || fb.note,
          });
        }
      });

    // 5. Stock Adjustments (Plein, Vides, Défectueux)
    const safeStockHistory = Array.isArray(stockHistory) ? stockHistory : [];
    safeStockHistory
      .filter((entry: any) => String(entry?.bottleTypeId) === String(bottle.id))
      .forEach((entry: any) => {
        const isAdd = String(entry?.changeType || '').toLowerCase() === 'add' || Number(entry?.newQuantity ?? 0) > Number(entry?.previousQuantity ?? 0);
        const stockType = String(entry?.stockType || 'full').toLowerCase();
        
        let stockTypeLabel = t('inventory.card.full', 'Plein');
        if (stockType.includes('empty') || stockType.includes('vide')) {
          stockTypeLabel = t('inventory.card.empty', 'Vides');
        } else if (stockType.includes('defective') || stockType.includes('defect')) {
          stockTypeLabel = t('inventory.defective.titleShort', 'Défectueux');
        }

        const id = `manual-adj-${entry.id}`;
        if (!seenIds.has(id)) {
          seenIds.add(id);
          entries.push({
            id,
            date: entry.date || entry.created_at || Date.now(),
            type: isAdd ? 'manual_add' : 'manual_remove',
            category: 'adjustment',
            direction: isAdd ? 'in' : 'out',
            label: `${t('inventory.history.manualAdjustment', 'Ajustement Manuel')} (${stockTypeLabel}) ${isAdd ? '(+)' : '(-)'}`,
            quantity: Number(entry.quantity || 0),
            note: entry.note ? String(entry.note) : undefined,
          });
        }
      });

    return entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, returnOrders, foreignBottles, supplyOrders, stockHistory, bottle.id, bottle.name, driverMap, truckMap, t]);

  // Circulation computation
  const getPendingCirculation = React.useCallback((bottleTypeId: string) => {
    if (!supplyOrders || !Array.isArray(supplyOrders)) return 0;
    const pendingOrders = supplyOrders.filter((o: any) => {
      if (!o || !o.id) return false;
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
          const itId = String(it?.bottleTypeId ?? it?.bottle_type_id ?? it?.id ?? '');
          return itId === String(bottleTypeId);
        })
        .reduce((s: number, it: any) => {
          const val = Number(it?.fullQuantity ?? it?.full_quantity ?? it?.quantity ?? it?.qty ?? 0);
          return s + val;
        }, 0);
      return sum + qty;
    }, 0);
  }, [supplyOrders, returnOrders]);

  // Precise Inventory Quantities
  const stockPlein = Math.max(
    Number(bottle.remainingQuantity ?? (bottle as any).remainingquantity ?? 0),
    0
  );

  const emptyQty = useMemo(() => {
    return emptyBottlesStock
      .filter((stock: any) => String(stock.bottleTypeId) === String(bottle.id))
      .reduce((sum: number, stock: any) => sum + Number(stock.quantity || 0), 0);
  }, [emptyBottlesStock, bottle.id]);

  const circulation = getPendingCirculation(String(bottle.id));

  const defectiveQty = useMemo(() => {
    return defectiveBottles
      .filter((d: any) => String(d.bottleTypeId) === String(bottle.id))
      .reduce((sum: number, d: any) => sum + Number(d.quantity || 0), 0);
  }, [defectiveBottles, bottle.id]);

  // Real Physical Park: Sum of Plein + Vides + Circulation + Défectueuses
  const totalPhysicalPark = stockPlein + emptyQty + circulation + defectiveQty;

  // Cumulative Distributed across all orders
  const distributedCumulative = useMemo(() => {
    const safeOrders = Array.isArray(supplyOrders) ? supplyOrders : [];
    return safeOrders.reduce((sum: number, o: any) => {
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
          const itId = String(it?.bottleTypeId ?? it?.bottle_type_id ?? it?.id ?? '');
          const itName = String(it?.bottleTypeName ?? it?.name ?? it?.bottle_type_name ?? '');
          return itId === String(bottle.id) || itName === String(bottle.name);
        })
        .reduce((s: number, it: any) => {
          const val = Number(it?.fullQuantity ?? it?.full_quantity ?? it?.quantity ?? it?.qty ?? 0);
          return s + val;
        }, 0);
      return sum + qty;
    }, 0);
  }, [supplyOrders, bottle.id, bottle.name]);

  // Stock Plein Financial Value
  const unitPrice = Number(bottle.unitPrice || 0);
  const fullStockValue = stockPlein * unitPrice;

  // Availability Rate
  const availabilityRate = totalPhysicalPark > 0 
    ? ((stockPlein / totalPhysicalPark) * 100) 
    : 0;

  // Filtered movements based on active tab and search
  const filteredMovements = useMemo(() => {
    return bottleMovements.filter((mv) => {
      const matchesTab = 
        activeTab === 'all' 
          ? true 
          : activeTab === 'truck' 
          ? mv.category === 'truck' 
          : activeTab === 'factory' 
          ? mv.category === 'factory' 
          : mv.category === 'adjustment';

      if (!matchesTab) return false;

      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      return (
        mv.label.toLowerCase().includes(query) ||
        (mv.note && mv.note.toLowerCase().includes(query)) ||
        (mv.driverName && mv.driverName.toLowerCase().includes(query)) ||
        (mv.truckPlate && mv.truckPlate.toLowerCase().includes(query)) ||
        (mv.orderNumber && mv.orderNumber.toLowerCase().includes(query)) ||
        String(mv.quantity).includes(query)
      );
    });
  }, [bottleMovements, activeTab, searchQuery]);

  // Tab counts
  const tabCounts = useMemo(() => {
    return {
      all: bottleMovements.length,
      truck: bottleMovements.filter(m => m.category === 'truck').length,
      factory: bottleMovements.filter(m => m.category === 'factory').length,
      adjustment: bottleMovements.filter(m => m.category === 'adjustment').length,
    };
  }, [bottleMovements]);

  // Render Icon helper
  const getMovementIcon = (mv: FormattedMovement) => {
    if (mv.category === 'factory') {
      return mv.direction === 'in' 
        ? <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700"><Factory className="w-4 h-4" /></div>
        : <div className="p-2 rounded-lg bg-amber-100 text-amber-700"><Factory className="w-4 h-4" /></div>;
    }
    if (mv.category === 'adjustment') {
      return mv.direction === 'in'
        ? <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700"><TrendingUp className="w-4 h-4" /></div>
        : <div className="p-2 rounded-lg bg-rose-100 text-rose-700"><TrendingDown className="w-4 h-4" /></div>;
    }
    if (mv.type.includes('defective')) {
      return <div className="p-2 rounded-lg bg-rose-100 text-rose-700"><AlertTriangle className="w-4 h-4" /></div>;
    }
    if (mv.type.includes('empty')) {
      return <div className="p-2 rounded-lg bg-purple-100 text-purple-700"><Package className="w-4 h-4" /></div>;
    }
    if (mv.direction === 'in') {
      return <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700"><ArrowDownLeft className="w-4 h-4" /></div>;
    }
    if (mv.direction === 'out') {
      return <div className="p-2 rounded-lg bg-blue-100 text-blue-700"><Truck className="w-4 h-4" /></div>;
    }
    return <div className="p-2 rounded-lg bg-slate-100 text-slate-700"><RefreshCw className="w-4 h-4" /></div>;
  };

  const isRtl = language === 'ar';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0 border border-slate-200 shadow-2xl rounded-2xl bg-slate-50/50">
        {/* Header */}
        <DialogHeader className="p-5 pb-4 bg-white border-b border-slate-200 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-100/80 text-indigo-600">
                <Package className="w-6 h-6" />
              </div>
              <div>
                <DialogTitle className="text-xl font-black text-slate-900 flex items-center gap-2">
                  {t('inventory.history.title', 'Historique & État du Stock')}
                  <span className="text-indigo-600">— {bottle.name}</span>
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 font-medium flex items-center gap-2 mt-0.5">
                  <span>{bottle.capacity}</span>
                  <span>•</span>
                  <span>{t('inventory.card.price', 'Prix unitaire')}: <strong className="text-slate-700">{unitPrice > 0 ? `${unitPrice.toFixed(2)} DH` : '—'}</strong></span>
                </DialogDescription>
              </div>
            </div>
            <Badge variant="outline" className="font-bold border-slate-200 bg-slate-50 text-slate-700 px-3 py-1 text-xs">
              {t('inventory.common.active', 'Actif')}
            </Badge>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Main 4 Visual KPI Cards - Current Stock State */}
          <div>
            <div className="flex items-center justify-between mb-2.5 px-0.5">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                {t('inventory.history.currentStockBreakdown', 'État actuel du stock en temps réel')}
              </h4>
              <span className="text-[11px] font-bold text-slate-400">
                {t('inventory.history.totalPark', 'Parc total')}: <strong className="text-slate-800">{totalPhysicalPark.toLocaleString('fr-FR')}</strong> {t('inventory.common.units', 'unités')}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* 1. Stock Plein */}
              <div className="p-3.5 rounded-xl bg-white border border-emerald-200/80 shadow-sm hover:shadow transition-all relative overflow-hidden">
                <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-50 rounded-bl-full pointer-events-none -z-0 opacity-60" />
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wide">
                      {t('inventory.card.full', 'Stock Plein')}
                    </span>
                    <PackageCheck className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="text-2xl font-black text-emerald-700 tracking-tight">
                    {stockPlein.toLocaleString('fr-FR')}
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium mt-1 truncate" title={`Valeur: ${fullStockValue.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DH`}>
                    {fullStockValue > 0 ? `${fullStockValue.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} DH` : t('inventory.history.availableInDepot', 'Disponible au dépôt')}
                  </div>
                </div>
              </div>

              {/* 2. Stock Vides */}
              <div className="p-3.5 rounded-xl bg-white border border-purple-200/80 shadow-sm hover:shadow transition-all relative overflow-hidden">
                <div className="absolute top-0 right-0 w-16 h-16 bg-purple-50 rounded-bl-full pointer-events-none -z-0 opacity-60" />
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-bold text-purple-800 uppercase tracking-wide">
                      {t('inventory.card.empty', 'Stock Vides')}
                    </span>
                    <Package className="w-4 h-4 text-purple-600" />
                  </div>
                  <div className="text-2xl font-black text-purple-700 tracking-tight">
                    {emptyQty.toLocaleString('fr-FR')}
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium mt-1 truncate">
                    {t('inventory.history.readyForFactory', 'Au dépôt (prêt usine)')}
                  </div>
                </div>
              </div>

              {/* 3. En Circulation */}
              <div className="p-3.5 rounded-xl bg-white border border-blue-200/80 shadow-sm hover:shadow transition-all relative overflow-hidden">
                <div className="absolute top-0 right-0 w-16 h-16 bg-blue-50 rounded-bl-full pointer-events-none -z-0 opacity-60" />
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wide">
                      {t('inventory.card.circulation', 'En Circulation')}
                    </span>
                    <Truck className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="text-2xl font-black text-blue-700 tracking-tight">
                    {circulation.toLocaleString('fr-FR')}
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium mt-1 truncate">
                    {t('inventory.history.onTrucks', 'Sur camions en tournée')}
                  </div>
                </div>
              </div>

              {/* 4. Défectueuses */}
              <div className="p-3.5 rounded-xl bg-white border border-rose-200/80 shadow-sm hover:shadow transition-all relative overflow-hidden">
                <div className="absolute top-0 right-0 w-16 h-16 bg-rose-50 rounded-bl-full pointer-events-none -z-0 opacity-60" />
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wide">
                      {t('inventory.defective.titleShort', 'Défectueuses')}
                    </span>
                    <ShieldAlert className="w-4 h-4 text-rose-600" />
                  </div>
                  <div className="text-2xl font-black text-rose-700 tracking-tight">
                    {defectiveQty.toLocaleString('fr-FR')}
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium mt-1 truncate">
                    {t('inventory.history.toRepairOrScrap', 'Rebut / À réparer')}
                  </div>
                </div>
              </div>
            </div>

            {/* Visual Proportion Bar & Summary Metrics */}
            <div className="mt-3 p-3 rounded-xl bg-white border border-slate-200/80 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                <span className="flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-slate-400" />
                  {t('inventory.history.stockDistributionBar', 'Répartition du parc physique')}
                </span>
                <span className="font-mono text-slate-700">
                  {availabilityRate.toFixed(1)}% {t('inventory.history.fullAvailableRate', 'disponible en plein')}
                </span>
              </div>

              {/* Multi-segment Progress bar */}
              <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden flex">
                {totalPhysicalPark > 0 ? (
                  <>
                    <div 
                      style={{ width: `${(stockPlein / totalPhysicalPark) * 100}%` }} 
                      className="bg-emerald-500 transition-all duration-500" 
                      title={`Plein: ${stockPlein}`}
                    />
                    <div 
                      style={{ width: `${(emptyQty / totalPhysicalPark) * 100}%` }} 
                      className="bg-purple-500 transition-all duration-500" 
                      title={`Vides: ${emptyQty}`}
                    />
                    <div 
                      style={{ width: `${(circulation / totalPhysicalPark) * 100}%` }} 
                      className="bg-blue-500 transition-all duration-500" 
                      title={`Circulation: ${circulation}`}
                    />
                    <div 
                      style={{ width: `${(defectiveQty / totalPhysicalPark) * 100}%` }} 
                      className="bg-rose-500 transition-all duration-500" 
                      title={`Défectueuses: ${defectiveQty}`}
                    />
                  </>
                ) : (
                  <div className="w-full bg-slate-200" />
                )}
              </div>

              {/* Sub Metrics */}
              <div className="grid grid-cols-3 gap-2 pt-1 text-center text-[11px] border-t border-slate-100">
                <div className="space-y-0.5">
                  <div className="text-slate-400 font-medium">{t('inventory.history.totalPark', 'Parc Total')}</div>
                  <div className="font-bold text-slate-900">{totalPhysicalPark.toLocaleString('fr-FR')} {t('inventory.common.units', 'unités')}</div>
                </div>
                <div className="space-y-0.5 border-x border-slate-100 px-2">
                  <div className="text-slate-400 font-medium">{t('inventory.history.cumulativeDistributed', 'Cumul Distribué')}</div>
                  <div className="font-bold text-indigo-600">{distributedCumulative.toLocaleString('fr-FR')} {t('inventory.common.units', 'unités')}</div>
                </div>
                <div className="space-y-0.5">
                  <div className="text-slate-400 font-medium">{t('inventory.history.stockValue', 'Valeur Stock Plein')}</div>
                  <div className="font-bold text-emerald-700">{fullStockValue.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DH</div>
                </div>
              </div>
            </div>
          </div>

          {/* Transactions / Movements Section */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <h4 className="text-sm font-black text-slate-800 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-600" />
                {t('inventory.history.recentMovements', 'Mouvements & Historique')}
                <Badge variant="secondary" className="font-bold text-xs px-2 py-0.5 bg-slate-200/80 text-slate-700">
                  {filteredMovements.length}
                </Badge>
              </h4>

              {/* Search Bar */}
              <div className="relative w-full sm:w-60">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  type="text"
                  placeholder={t('inventory.history.searchPlaceholder', 'Rechercher un mouvement...')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-8 text-xs bg-white border-slate-200"
                />
              </div>
            </div>

            {/* Category Filter Tabs */}
            <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as MovementCategory)} className="w-full">
              <TabsList className="w-full grid grid-cols-4 bg-slate-200/60 p-1 rounded-xl h-9">
                <TabsTrigger value="all" className="text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-slate-900 rounded-lg">
                  {t('inventory.filters.all', 'Tous')} ({tabCounts.all})
                </TabsTrigger>
                <TabsTrigger value="truck" className="text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-blue-700 rounded-lg">
                  🚚 {t('inventory.history.tabTruck', 'Tournées')} ({tabCounts.truck})
                </TabsTrigger>
                <TabsTrigger value="factory" className="text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-amber-700 rounded-lg">
                  🏭 {t('inventory.history.tabFactory', 'Usine')} ({tabCounts.factory})
                </TabsTrigger>
                <TabsTrigger value="adjustment" className="text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-purple-700 rounded-lg">
                  ⚙️ {t('inventory.history.tabAdjustment', 'Ajustements')} ({tabCounts.adjustment})
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Scrollable Transaction List */}
            <ScrollArea className="h-[280px] rounded-xl border border-slate-200/80 bg-white p-3 shadow-xs">
              {filteredMovements.length > 0 ? (
                <div className="space-y-2.5 pr-2">
                  {filteredMovements.map((mv) => {
                    const movementValue = unitPrice > 0 ? mv.quantity * unitPrice : 0;
                    const dateObj = new Date(mv.date || Date.now());
                    const isInvalidDate = isNaN(dateObj.getTime());
                    const formattedDate = !isInvalidDate
                      ? dateObj.toLocaleDateString(language === 'ar' ? 'ar-MA' : 'fr-FR', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : String(mv.date);

                    return (
                      <div 
                        key={mv.id} 
                        className="p-3 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-100/60 hover:border-slate-200 transition-all flex items-start justify-between gap-3"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          {getMovementIcon(mv)}
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-black text-slate-800 text-sm">{mv.label}</span>
                              {mv.orderNumber && (
                                <Badge variant="outline" className="text-[10px] font-mono font-bold bg-white text-slate-600 border-slate-200 px-1.5 py-0">
                                  #{mv.orderNumber}
                                </Badge>
                              )}
                            </div>

                            {/* Subtitle with driver / truck info */}
                            {(mv.driverName || mv.truckPlate) && (
                              <div className="text-xs text-slate-600 font-medium flex items-center gap-1.5">
                                {mv.driverName && <span>Chauffeur: <strong className="text-slate-800">{mv.driverName}</strong></span>}
                                {mv.driverName && mv.truckPlate && <span>•</span>}
                                {mv.truckPlate && <span className="font-mono text-slate-700">{mv.truckPlate}</span>}
                              </div>
                            )}

                            {/* Note */}
                            {mv.note && (
                              <div className="text-[11px] text-slate-500 italic line-clamp-1" title={mv.note}>
                                {mv.note}
                              </div>
                            )}

                            {/* Date */}
                            <div className="text-[11px] text-slate-400 font-medium">
                              {formattedDate}
                            </div>
                          </div>
                        </div>

                        {/* Right side: Quantity & Financial Value */}
                        <div className="text-right flex-shrink-0 space-y-0.5">
                          <div className={`text-sm font-black ${
                            mv.direction === 'in' 
                              ? 'text-emerald-700' 
                              : mv.direction === 'out' 
                              ? 'text-blue-700' 
                              : 'text-slate-800'
                          }`}>
                            {mv.direction === 'in' ? '+' : mv.direction === 'out' ? '-' : ''}
                            {mv.quantity.toLocaleString('fr-FR')} {t('inventory.common.units', 'unités')}
                          </div>
                          {movementValue > 0 && (
                            <div className="text-[11px] font-semibold text-slate-500 font-mono">
                              {movementValue.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DH
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 text-slate-400 space-y-2">
                  <Package className="w-10 h-10 mx-auto text-slate-300 stroke-[1.5]" />
                  <p className="text-sm font-bold text-slate-600">
                    {searchQuery 
                      ? t('inventory.history.noSearchResults', 'Aucun mouvement correspondant à votre recherche')
                      : t('inventory.history.noTransactions', 'Aucune transaction enregistrée')}
                  </p>
                  <p className="text-xs text-slate-400 max-w-xs mx-auto">
                    {t('inventory.history.noTransactionsHint', 'Les mouvements de stock liés à ce type de bouteille apparaîtront ici.')}
                  </p>
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
