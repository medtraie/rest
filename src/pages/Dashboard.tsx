import React, { useMemo, useState } from 'react';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useApp } from '@/contexts/AppContext';
import { useLanguage, useT } from '@/contexts/LanguageContext';
import OilBarrelsWidget from '@/components/dashboard/OilBarrelsWidget';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { safeDate } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { 
  Package, 
  Truck, 
  Users, 
  TrendingUp,
  AlertTriangle,
  DollarSign,
  BarChart3,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  ArrowUpDown,
  Plus,
  History,
  Settings,
  Activity,
  Fuel,
  Droplets,
  Wrench,
  CreditCard,
  TrendingDown
} from 'lucide-react';

const Dashboard = () => {
  const t = useT();
  const { language } = useLanguage();
  const uiLocale = language === 'ar' ? 'ar-MA' : 'fr-MA';
  const tr = (frText: string, arText: string) => (language === 'ar' ? arText : frText);
  const navigate = useNavigate();
  const { 
    bottleTypes = [], 
    trucks = [], 
    drivers = [], 
    transactions = [],
    expenses = [],
    repairs = [],
    financialTransactions = [],
    revenues = [],
    emptyBottlesStock = [],
    cashOperations = [],
    stockHistory = []
  } = useApp();

  // Debug logging
  console.log('Dashboard Data:', { 
    bottleTypesCount: bottleTypes.length,
    emptyBottlesStockCount: emptyBottlesStock.length,
    financialTransactionsCount: financialTransactions.length,
    revenuesCount: revenues.length
  });

  const getStockMetrics = (bt: any) => {
    const totalStored = Number(bt?.totalQuantity || 0);
    const distributed = Number(bt?.distributedQuantity || 0);
    const emptyStockEntry = emptyBottlesStock.find(s => s.bottleTypeId === bt.id);
    const warehouseEmpty = Number(emptyStockEntry?.quantity || 0);
    const warehouseFull = Math.max(totalStored - distributed, 0);
    const totalAssets = totalStored > 0 ? totalStored : (warehouseFull + warehouseEmpty + distributed);
    const fullAssets = warehouseFull + distributed;
    return { warehouseFull, warehouseEmpty, distributed, fullAssets, totalAssets };
  };

  const getRemainingQuantity = (bt: any) => {
    const { warehouseFull } = getStockMetrics(bt);
    return warehouseFull;
  };

  const getTotalQuantity = (bt: any) => {
    const { totalAssets } = getStockMetrics(bt);
    return totalAssets;
  };

  const getStockStatus = (remaining: number) => {
    const r = Number(remaining || 0);
    if (r < 100) return { key: 'critique', label: t('dashboard.stock.critique'), color: 'bg-red-500', badge: 'destructive' as const };
    if (r < 300) return { key: 'faible', label: t('dashboard.stock.faible'), color: 'bg-orange-500', badge: 'secondary' as const };
    if (r < 600) return { key: 'moyen', label: t('dashboard.stock.moyen'), color: 'bg-yellow-500', badge: 'outline' as const };
    if (r < 1000) return { key: 'bon', label: t('dashboard.stock.bon'), color: 'bg-green-500', badge: 'default' as const };
    return { key: 'normal', label: t('dashboard.stock.normal'), color: 'bg-green-500', badge: 'default' as const };
  };

  // Calculate metrics
  // Stock Total represents total assets (Full + Empty + Distributed)
  const totalStock = useMemo(() => {
    return bottleTypes.reduce((sum, bt) => {
      const { totalAssets } = getStockMetrics(bt);
      return sum + totalAssets;
    }, 0);
  }, [bottleTypes, emptyBottlesStock]);
  
  const totalValue = useMemo(() => bottleTypes.reduce((sum, bt) => {
    const { warehouseFull } = getStockMetrics(bt);
    return sum + (warehouseFull * (Number(bt.unitPrice) || 0));
  }, 0), [bottleTypes, emptyBottlesStock]);

  const activeTrucks = trucks.filter(t => t.isActive).length;
  const totalDriverDebt = useMemo(() => drivers.reduce((sum, d) => sum + Math.abs(d.debt || 0), 0), [drivers]);
  
  // Use percentage < 20% for low stock alert
  // Alert based on Full Bottles availability vs Total Assets
  const lowStockBottles = bottleTypes.filter(bt => {
    const remaining = getRemainingQuantity(bt);
    const status = getStockStatus(remaining);
    return status.key === 'critique' || status.key === 'faible';
  });
  
  const totalExpenses = useMemo(() => 
    expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0) +
    repairs.reduce((sum, r) => sum + (Number(r.paidAmount) || 0), 0),
  [expenses, repairs]);

  const { totalRevenue, netBalance, revenueBreakdown, expenseBreakdown } = useMemo(() => {
    // 1. Financial Transactions (New System)
    const finRevenue = financialTransactions
      .filter(t => t.type === 'encaissement' || t.type === 'versement')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
      
    const finExpenses = financialTransactions
      .filter(t => t.type === 'retrait' || t.type === 'dépense' || t.type === 'réparation')
      .reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0);

    // 2. Driver Payments (Transactions table)
    // Include 'payment' and 'credit' types as per Drivers page logic
    const driverPayments = transactions
      .filter(t => t.type === 'payment' || t.type === 'credit')
      .reduce((sum, t) => {
        // Handle various amount fields
        const val = t.amount ?? t.montant ?? t.value ?? t.totalValue ?? 0;
        return sum + (Number(val) || 0);
      }, 0);

    // 3. Manual Revenues (Legacy)
    const legacyRevenue = revenues.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    
    // 4. Expenses (Legacy)
    const legacyExpenses = 
      expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0) +
      repairs.reduce((sum, r) => sum + (Number(r.paidAmount) || 0), 0);

    // Aggregation Strategy:
    // Revenue = Driver Payments + Manual Revenues + Financial Transactions (encaissement)
    // We assume these are distinct entries. 
    // If a driver payment is manually entered in revenues, it might duplicate, but usually systems are separate.
    // Financial Transactions are likely distinct from legacy transactions.
    
    const finalRevenue = driverPayments + legacyRevenue + finRevenue;
    const finalExpenses = legacyExpenses + finExpenses;
    
    return { 
      totalRevenue: finalRevenue, 
      netBalance: finalRevenue - finalExpenses,
      revenueBreakdown: {
        driverPayments,
        legacyRevenue,
        finRevenue,
      },
      expenseBreakdown: {
        legacyExpenses,
        finExpenses,
      },
    };
  }, [financialTransactions, revenues, expenses, repairs, transactions]);

  const fleetAvailability = trucks.length > 0 ? Math.round((activeTrucks / trucks.length) * 100) : 0;

  const topRiskBottles = useMemo(() => {
    return bottleTypes
      .map((bottle) => {
        const remaining = getRemainingQuantity(bottle);
        const total = getTotalQuantity(bottle);
        const status = getStockStatus(remaining);
        const coverage = Math.round(Math.min(((remaining || 0) / (total || 1)) * 100, 100));
        return { bottle, remaining, status, coverage };
      })
      .filter((item) => item.status.key === 'critique' || item.status.key === 'faible')
      .sort((a, b) => a.remaining - b.remaining)
      .slice(0, 4);
  }, [bottleTypes, emptyBottlesStock]);

  const sectionPulse = useMemo(() => {
    const supplyOps = transactions.filter((t: any) => t.type === 'supply').length;
    const repairOps = repairs.length;
    const financeOps = financialTransactions.length + cashOperations.length;
    const reportSignals = transactions.length + expenses.length + repairs.length + financialTransactions.length + revenues.length + cashOperations.length + stockHistory.length;
    return [
      { label: t('dashboard.pulse.supplyReturn'), value: `${supplyOps} ${t('dashboard.pulse.supplyOps')}`, path: '/supply-return', icon: Package },
      { label: t('dashboard.pulse.maintenance'), value: `${repairOps} ${t('dashboard.pulse.repairs')}`, path: '/repairs', icon: Wrench },
      { label: t('dashboard.pulse.finance'), value: `${financeOps} ${t('dashboard.pulse.financeFlux')}`, path: '/revenue', icon: DollarSign },
      { label: t('dashboard.pulse.reports'), value: `${reportSignals} ${t('dashboard.pulse.signals')}`, path: '/reports', icon: BarChart3 },
    ];
  }, [transactions, repairs, financialTransactions, cashOperations, expenses, revenues, stockHistory, t]);
  
  const today = new Date().toLocaleDateString(uiLocale, {
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  const quickActions = [
    { key: 'newSale', label: t('dashboard.quickActions.newSale'), icon: Plus, path: '/supply-return', color: 'bg-blue-500' },
    { key: 'expense', label: t('dashboard.quickActions.expense'), icon: CreditCard, path: '/expenses', color: 'bg-red-500' },
    { key: 'fuel', label: t('dashboard.quickActions.fuel'), icon: Fuel, path: '/fuel', color: 'bg-orange-500' },
    { key: 'repair', label: t('dashboard.quickActions.repair'), icon: Wrench, path: '/repairs', color: 'bg-purple-500' },
  ];

  const [stockStatusFilter, setStockStatusFilter] = useState<'all' | 'critique' | 'faible' | 'moyen' | 'bon' | 'normal'>('all');
  const [stockSort, setStockSort] = useState<'remaining-asc' | 'remaining-desc'>('remaining-desc');
  const [activityFilter, setActivityFilter] = useState<'all' | 'finance' | 'operations' | 'maintenance' | 'stock'>('all');

  const getTruckLabel = (truckId?: string) => {
    if (!truckId) return '';
    const trk: any = trucks.find(t => String(t.id) === String(truckId));
    return trk?.matricule || trk?.name || trk?.plateNumber || '';
  };
  const getDriverLabel = (driverId?: string, truckId?: string) => {
    const id = driverId || trucks.find(t => String(t.id) === String(truckId))?.driverId;
    if (!id) return '';
    return drivers.find(d => String(d.id) === String(id))?.name || '';
  };
  const sumBottleQty = (list?: Array<{ quantity?: number }>) =>
    (Array.isArray(list) ? list.reduce((s, i) => s + (Number(i.quantity) || 0), 0) : 0);
  const normalizeDate = (obj: any) =>
    safeDate(obj?.date || obj?.dateISO || obj?.createdAt);

  const recentActivities = useMemo(() => {
    const items: Array<{
      id: string;
      date: Date;
      title: string;
      subtitle?: string;
      iconBg: string;
      icon: React.ReactNode;
      amount?: number;
      category: 'finance' | 'operations' | 'maintenance' | 'stock';
    }> = [];
    // Transactions
    transactions.forEach((transaction: any) => {
      const truck = getTruckLabel(transaction.truckId);
      const driver = getDriverLabel(transaction.driverId, transaction.truckId);
      const totalQty = sumBottleQty(transaction.bottleTypes);
      const date = normalizeDate(transaction);
      let title = t('dashboard.activity.operation');
      let iconBg = 'bg-slate-100 text-slate-600';
      let icon: React.ReactNode = <Activity className="w-4 h-4" />;
      let amount = Number(transaction.totalValue || transaction.amount || transaction.totalVentes || 0);
      if (transaction.type === 'supply') {
        title = t('dashboard.activity.truckSupply');
        iconBg = 'bg-blue-100 text-blue-600';
        icon = <ArrowUpRight className="w-4 h-4" />;
      } else if (transaction.type === 'return') {
        title = t('dashboard.activity.truckReturn');
        iconBg = 'bg-green-100 text-green-600';
        icon = <ArrowDownRight className="w-4 h-4" />;
      } else if (transaction.type === 'exchange') {
        title = t('dashboard.activity.exchange');
        iconBg = 'bg-orange-100 text-orange-600';
        icon = <Package className="w-4 h-4" />;
      } else if (transaction.type === 'payment') {
        title = t('dashboard.activity.driverPayment');
        iconBg = 'bg-emerald-100 text-emerald-600';
        icon = <DollarSign className="w-4 h-4" />;
      } else if (transaction.type === 'debt') {
        title = t('dashboard.activity.driverDebt');
        iconBg = 'bg-red-100 text-red-600';
        icon = <TrendingDown className="w-4 h-4" />;
      } else if (transaction.type === 'factory') {
        title = t('dashboard.activity.factory');
        iconBg = 'bg-slate-100 text-slate-600';
        icon = <Droplets className="w-4 h-4" />;
      }
      const subtitle = [truck, driver, totalQty ? `${totalQty} ${t('dashboard.activity.units')}` : null]
        .filter(Boolean)
        .join(' · ');
      items.push({
        id: String(transaction.id ?? `${title}-${date.getTime()}`),
        date,
        title,
        subtitle,
        iconBg,
        icon,
        amount: amount > 0 ? amount : undefined,
        category: 'operations',
      });
    });
    // Expenses
    expenses.forEach((e: any) => {
      const date = normalizeDate(e);
      items.push({
        id: String(e.id ?? `expense-${date.getTime()}`),
        date,
        title: `${t('dashboard.activity.depense')}: ${e.type}`,
        subtitle: String(e.paymentMethod || '').toUpperCase(),
        iconBg: 'bg-red-100 text-red-600',
        icon: <CreditCard className="w-4 h-4" />,
        amount: Number(e.amount || 0) || undefined,
        category: 'finance',
      });
    });
    // Repairs
    repairs.forEach((r: any) => {
      const date = normalizeDate(r);
      const truck = getTruckLabel(r.truckId);
      items.push({
        id: String(r.id ?? `repair-${date.getTime()}`),
        date,
        title: `${t('dashboard.activity.reparation')}: ${r.type}`,
        subtitle: truck,
        iconBg: 'bg-purple-100 text-purple-600',
        icon: <Wrench className="w-4 h-4" />,
        amount: Number(r.totalCost || 0) || undefined,
        category: 'maintenance',
      });
    });
    // Financial Transactions
    financialTransactions.forEach((f: any) => {
      const date = normalizeDate(f);
      let title = t('dashboard.activity.transaction');
      let iconBg = 'bg-slate-100 text-slate-600';
      let icon: React.ReactNode = <BarChart3 className="w-4 h-4" />;
      if (f.type === 'encaissement' || f.type === 'versement') {
        title = f.type === 'encaissement' ? t('dashboard.activity.encaissement') : t('dashboard.activity.versement');
        iconBg = 'bg-green-100 text-green-600';
        icon = <DollarSign className="w-4 h-4" />;
      } else if (f.type === 'retrait') {
        title = t('dashboard.activity.retrait');
        iconBg = 'bg-orange-100 text-orange-600';
        icon = <TrendingDown className="w-4 h-4" />;
      } else if (f.type === 'dépense' || f.type === 'réparation') {
        title = f.type === 'dépense' ? t('dashboard.activity.depense') : t('dashboard.activity.reparation');
        iconBg = 'bg-red-100 text-red-600';
        icon = <CreditCard className="w-4 h-4" />;
      }
      items.push({
        id: String(f.id ?? `fin-${date.getTime()}`),
        date,
        title,
        subtitle: f.description || '',
        iconBg,
        icon,
        amount: Number(f.amount || 0) || undefined,
        category: 'finance',
      });
    });
    // Revenues
    revenues.forEach((rev: any) => {
      const date = normalizeDate(rev);
      const ref = rev.relatedOrderId ? `${t('dashboard.activity.refShort')}: ${String(rev.relatedOrderId).slice(-6)}` : '';
      const driver = rev.driverName || '';
      const total = Number(rev.totalAmount || rev.amount || rev.cashAmount || 0);
      items.push({
        id: String(rev.id ?? `rev-${date.getTime()}`),
        date,
        title: t('dashboard.activity.revenue'),
        subtitle: [driver, ref].filter(Boolean).join(' · '),
        iconBg: 'bg-emerald-100 text-emerald-600',
        icon: <TrendingUp className="w-4 h-4" />,
        amount: total || undefined,
        category: 'finance',
      });
    });
    // Cash Operations
    cashOperations.forEach((op: any) => {
      const date = normalizeDate(op);
      const isDeposit = op.type === 'versement';
      items.push({
        id: String(op.id ?? `cash-${date.getTime()}`),
        date,
        title: isDeposit ? t('dashboard.activity.versement') : t('dashboard.activity.retrait'),
        subtitle: String(op.accountAffected || '').toUpperCase(),
        iconBg: isDeposit ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600',
        icon: isDeposit ? <DollarSign className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />,
        amount: Number(op.amount || 0) || undefined,
        category: 'finance',
      });
    });
    // Stock History (Empty Bottles)
    stockHistory.forEach((h: any) => {
      const date = normalizeDate(h);
      const isAdd = h.changeType === 'add' || h.changeType === 'return';
      items.push({
        id: String(h.id ?? `stock-${date.getTime()}`),
        date,
        title: t('dashboard.activity.emptyStock'),
        subtitle: `${h.bottleTypeName || ''} · ${isAdd ? '+' : '-'}${h.quantity || 0}`,
        iconBg: isAdd ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-600',
        icon: <History className="w-4 h-4" />,
        category: 'stock',
      });
    });
    items.sort((a, b) => b.date.getTime() - a.date.getTime());
    return items.slice(0, 8);
  }, [transactions, expenses, repairs, financialTransactions, revenues, cashOperations, stockHistory, trucks, drivers, t]);

  const stockRows = useMemo(() => {
    const items = bottleTypes.map((bottle) => {
      const remaining = getRemainingQuantity(bottle);
      const total = getTotalQuantity(bottle);
      const percentage = Math.min(((remaining || 0) / (total || 1)) * 100, 100);
      const status = getStockStatus(remaining);
      const { distributed } = getStockMetrics(bottle);
      return { bottle, remaining, total, percentage, status, distributed };
    });
    const filtered = stockStatusFilter === 'all'
      ? items
      : items.filter((i) => i.status.key === stockStatusFilter);
    return [...filtered].sort((a, b) =>
      stockSort === 'remaining-asc' ? a.remaining - b.remaining : b.remaining - a.remaining
    );
  }, [bottleTypes, stockStatusFilter, stockSort, emptyBottlesStock]);

  const stockSummary = useMemo(() => {
    return stockRows.reduce((acc, row) => {
      const key = row.status.key;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [stockRows]);

  const filteredRecentActivities = useMemo(() => {
    if (activityFilter === 'all') return recentActivities;
    return recentActivities.filter((activity) => activity.category === activityFilter);
  }, [recentActivities, activityFilter]);

  const performanceSignals = useMemo(() => {
    const fleetRatio = trucks.length > 0 ? Math.round((activeTrucks / trucks.length) * 100) : 0;
    const fuelOps = expenses.filter((e: any) => String(e.type || '').toLowerCase().includes('carb')).length;
    const distributionLabel = lowStockBottles.length === 0 ? t('dashboard.distributionStatus.optimum') : lowStockBottles.length <= 2 ? t('dashboard.distributionStatus.controlled') : t('dashboard.distributionStatus.tension');
    const distributionTone = lowStockBottles.length === 0 ? 'bg-emerald-500' : lowStockBottles.length <= 2 ? 'bg-amber-500' : 'bg-rose-500';
    return {
      fleetRatio,
      fuelOps,
      distributionLabel,
      distributionTone,
    };
  }, [trucks.length, activeTrucks, expenses, lowStockBottles, t]);

  const globalPulse = useMemo(() => {
    const displayedStocks = stockRows.length || 1;
    const criticalCount = stockSummary.critique || 0;
    const lowCount = stockSummary.faible || 0;
    const healthyCount = (stockSummary.bon || 0) + (stockSummary.normal || 0);
    const stockHealthScore = Math.max(0, Math.min(100, Math.round(((healthyCount + (stockSummary.moyen || 0) * 0.5) / displayedStocks) * 100)));
    const expenseRatio = totalRevenue > 0 ? Math.round((totalExpenses / totalRevenue) * 100) : 0;
    const debtLoadRatio = totalRevenue > 0 ? Math.round((totalDriverDebt / totalRevenue) * 100) : 0;
    return {
      criticalCount,
      lowCount,
      healthyCount,
      stockHealthScore,
      expenseRatio,
      debtLoadRatio,
    };
  }, [stockRows.length, stockSummary, totalRevenue, totalExpenses, totalDriverDebt]);

  return (
    <div className="app-page-shell relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-100 via-white to-indigo-50/60 p-6 space-y-8">
      <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-indigo-300/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 -left-24 h-80 w-80 rounded-full bg-cyan-300/20 blur-3xl" />
      {/* Header Section */}
      <Card className="app-dark-hero relative border-none bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 text-white shadow-2xl transition-all duration-300 ease-out hover:shadow-[0_24px_60px_-24px_rgba(15,23,42,0.65)]">
        <CardContent className="p-6 md:p-7">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-cyan-100">
                <Activity className="w-4 h-4 animate-pulse" />
                {t('dashboard.overview')}
              </div>
              <h1 className="app-page-title text-3xl md:text-4xl font-extrabold tracking-tight">{t('dashboard.title')}</h1>
              <div className="flex items-center gap-2 text-slate-200 mt-2">
                <Calendar className="w-4 h-4" />
                <span className="capitalize">{today}</span>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Badge className="bg-white/15 text-white border-white/25">{t('dashboard.stockValue')}: {totalValue.toLocaleString(uiLocale)} DH</Badge>
                <Badge className="bg-white/15 text-white border-white/25">{t('dashboard.expenses')}: {totalExpenses.toLocaleString(uiLocale)} DH</Badge>
                <Badge className="bg-rose-400/20 text-rose-100 border-rose-200/30">{t('dashboard.stockAlerts')}: {lowStockBottles.length}</Badge>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={() => window.location.reload()} className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white shadow-sm">
                <History className="w-4 h-4 mr-2" />
                {t('dashboard.refresh')}
              </Button>
              <Button size="sm" onClick={() => navigate('/supply-return')} className="bg-white text-slate-900 hover:bg-slate-100 shadow-md">
                <Plus className="w-4 h-4 mr-2" />
                {t('dashboard.newOperation')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metrics Summary */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title={t('dashboard.metrics.totalStock')}
          value={`${totalStock.toLocaleString(uiLocale)} ${t('dashboard.activity.units')}`}
          icon={Package}
          className="border-none shadow-lg ring-1 ring-slate-200/60 bg-gradient-to-br from-white via-blue-50/40 to-cyan-50/40 transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-xl"
          trend={{ value: 5.2, isPositive: true }}
        />
        <MetricCard
          title={t('dashboard.metrics.totalRevenue')}
          value={`${totalRevenue.toLocaleString(uiLocale)} DH`}
          icon={TrendingUp}
          className="border-none shadow-lg ring-1 ring-slate-200/60 bg-gradient-to-br from-white via-emerald-50/35 to-green-50/40 transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-xl"
          valueClassName="text-green-600"
          trend={{ value: 12.5, isPositive: true }}
        />
        <MetricCard
          title={t('dashboard.metrics.activeTrucks')}
          value={`${activeTrucks}/${trucks.length}`}
          icon={Truck}
          className="border-none shadow-lg ring-1 ring-slate-200/60 bg-gradient-to-br from-white via-orange-50/35 to-amber-50/35 transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-xl"
        />
        <MetricCard
          title={t('dashboard.metrics.driverDebts')}
          value={`${totalDriverDebt.toLocaleString(uiLocale)} DH`}
          icon={Users}
          className="border-none shadow-lg ring-1 ring-slate-200/60 bg-gradient-to-br from-white via-rose-50/35 to-red-50/35 transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-xl"
          valueClassName="text-destructive"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-8 border-none shadow-xl ring-1 ring-slate-200/70 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 text-white overflow-hidden transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Settings className="w-5 h-5 text-cyan-300" />
              {t('dashboard.piloting.title')}
            </CardTitle>
            <CardDescription className="text-slate-200/80">
              {t('dashboard.piloting.subtitle')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              {sectionPulse.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  className="app-panel-soft group flex items-center justify-between rounded-xl border border-white/15 bg-white/5 p-3 text-left hover:bg-white/10 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-cyan-300/40"
                  onClick={() => navigate(item.path)}
                >
                  <div>
                    <div className="text-xs uppercase tracking-wider text-slate-300">{item.label}</div>
                    <div className="text-sm font-bold text-white">{item.value}</div>
                  </div>
                  <div className="rounded-lg bg-white/10 p-2 text-cyan-200 group-hover:bg-cyan-400/20 transition-colors duration-300 ease-out">
                    <item.icon className="w-4 h-4" />
                  </div>
                </button>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="app-panel-soft rounded-xl border border-emerald-200/20 bg-emerald-400/10 p-3 transition-all duration-300 ease-out hover:bg-emerald-400/20">
                <p className="text-[11px] uppercase tracking-wider text-emerald-100/90">{t('dashboard.piloting.driverPayments')}</p>
                <p className="text-xl font-black text-white">{revenueBreakdown.driverPayments.toLocaleString(uiLocale)} DH</p>
              </div>
              <div className="app-panel-soft rounded-xl border border-cyan-200/20 bg-cyan-400/10 p-3 transition-all duration-300 ease-out hover:bg-cyan-400/20">
                <p className="text-[11px] uppercase tracking-wider text-cyan-100/90">{t('dashboard.piloting.manualRevenue')}</p>
                <p className="text-xl font-black text-white">{revenueBreakdown.legacyRevenue.toLocaleString(uiLocale)} DH</p>
              </div>
              <div className="app-panel-soft rounded-xl border border-indigo-200/20 bg-indigo-400/10 p-3 transition-all duration-300 ease-out hover:bg-indigo-400/20">
                <p className="text-[11px] uppercase tracking-wider text-indigo-100/90">{t('dashboard.piloting.financeFlow')}</p>
                <p className="text-xl font-black text-white">{revenueBreakdown.finRevenue.toLocaleString(uiLocale)} DH</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-4 border-none shadow-xl ring-1 ring-slate-200/70 bg-white/90 backdrop-blur-sm transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-600" />
              {t('dashboard.executivePulse.title')}
            </CardTitle>
            <CardDescription>{t('dashboard.executivePulse.subtitle')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="mb-1 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500">
                <span>{t('dashboard.executivePulse.fleetAvailability')}</span>
                <span>{fleetAvailability}%</span>
              </div>
              <Progress value={fleetAvailability} className="h-2" />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500">
                <span>{t('dashboard.executivePulse.expenseRatio')}</span>
                <span>{totalRevenue > 0 ? `${Math.round((totalExpenses / totalRevenue) * 100)}%` : '0%'}</span>
              </div>
              <Progress value={totalRevenue > 0 ? Math.min((totalExpenses / totalRevenue) * 100, 100) : 0} className="h-2" />
            </div>
            <div className="app-panel rounded-xl bg-slate-50 p-3 space-y-1 transition-all duration-300 ease-out hover:bg-slate-100">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>{t('dashboard.executivePulse.legacyExpenses')}</span>
                <span>{expenseBreakdown.legacyExpenses.toLocaleString(uiLocale)} DH</span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>{t('dashboard.executivePulse.financeExpenses')}</span>
                <span>{expenseBreakdown.finExpenses.toLocaleString(uiLocale)} DH</span>
              </div>
              <div className="mt-2 pt-2 border-t border-slate-200 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t('dashboard.executivePulse.netBalance')}</span>
                <span className={`text-sm font-extrabold ${netBalance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{netBalance.toLocaleString(uiLocale)} DH</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Quick Actions - New Section */}
        <Card className="lg:col-span-3 border-none shadow-lg ring-1 ring-slate-200/70 bg-white/80 backdrop-blur-md transition-all duration-300 ease-out hover:shadow-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" />
              {t('dashboard.quickActions.title')}
            </CardTitle>
            <CardDescription>{t('dashboard.quickActions.subtitle')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {quickActions.map((action) => (
                <Button
                  key={action.key}
                  variant="outline"
                  className="h-24 flex flex-col items-center justify-center gap-3 rounded-2xl border-slate-200/80 bg-gradient-to-b from-white to-slate-50 hover:border-primary hover:bg-primary/5 hover:-translate-y-0.5 transition-all duration-300 ease-out group"
                  onClick={() => navigate(action.path)}
                >
                  <div className={`p-3 rounded-xl ${action.color} text-white group-hover:scale-110 transition-transform duration-300 ease-out shadow-sm`}>
                    <action.icon className="w-6 h-6" />
                  </div>
                  <span className="font-semibold text-sm">{action.label}</span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Stock Status - Modernized */}
        <Card className="lg:col-span-2 border-none shadow-lg ring-1 ring-slate-200/70 transition-all duration-300 ease-out hover:shadow-xl">
          <CardHeader className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-blue-600" />
                  {t('dashboard.stock.title')}
                </CardTitle>
                <CardDescription>{t('dashboard.stock.subtitle')}</CardDescription>
              </div>
                <Button variant="ghost" size="sm" className="hover:bg-slate-100" onClick={() => navigate('/inventory')}>
                {t('dashboard.stock.manage')}
              </Button>
            </div>
            <div className="flex items-center gap-3">
                <ToggleGroup type="single" value={stockStatusFilter} onValueChange={(v) => setStockStatusFilter((v as any) || 'all')} className="gap-2 flex-wrap">
                <ToggleGroupItem value="all" className="px-2 py-1 text-xs bg-slate-100/80 data-[state=on]:bg-slate-900 data-[state=on]:text-white">{t('dashboard.stock.all')}</ToggleGroupItem>
                <ToggleGroupItem value="critique" className="px-2 py-1 text-xs bg-slate-100/80 data-[state=on]:bg-slate-900 data-[state=on]:text-white">{t('dashboard.stock.critique')}</ToggleGroupItem>
                <ToggleGroupItem value="faible" className="px-2 py-1 text-xs bg-slate-100/80 data-[state=on]:bg-slate-900 data-[state=on]:text-white">{t('dashboard.stock.faible')}</ToggleGroupItem>
                <ToggleGroupItem value="moyen" className="px-2 py-1 text-xs bg-slate-100/80 data-[state=on]:bg-slate-900 data-[state=on]:text-white">{t('dashboard.stock.moyen')}</ToggleGroupItem>
                <ToggleGroupItem value="bon" className="px-2 py-1 text-xs bg-slate-100/80 data-[state=on]:bg-slate-900 data-[state=on]:text-white">{t('dashboard.stock.bon')}</ToggleGroupItem>
                <ToggleGroupItem value="normal" className="px-2 py-1 text-xs bg-slate-100/80 data-[state=on]:bg-slate-900 data-[state=on]:text-white">{t('dashboard.stock.normal')}</ToggleGroupItem>
              </ToggleGroup>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setStockSort(stockSort === 'remaining-asc' ? 'remaining-desc' : 'remaining-asc')}
                className="h-8 text-xs"
              >
                <ArrowUpDown className="w-3.5 h-3.5 mr-1" />
                {t('dashboard.stock.sortByRemaining')} {stockSort === 'remaining-asc' ? '↑' : '↓'}
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-lg bg-slate-50 px-2.5 py-2 ring-1 ring-slate-200/70">
                <div className="text-[10px] uppercase tracking-wide text-slate-500">{t('dashboard.stock.displayed')}</div>
                <div className="text-sm font-extrabold text-slate-800">{stockRows.length}</div>
              </div>
              <div className="rounded-lg bg-red-50 px-2.5 py-2 ring-1 ring-red-100">
                <div className="text-[10px] uppercase tracking-wide text-red-500">{t('dashboard.stock.critique')}</div>
                <div className="text-sm font-extrabold text-red-700">{stockSummary.critique || 0}</div>
              </div>
              <div className="rounded-lg bg-orange-50 px-2.5 py-2 ring-1 ring-orange-100">
                <div className="text-[10px] uppercase tracking-wide text-orange-500">{t('dashboard.stock.faible')}</div>
                <div className="text-sm font-extrabold text-orange-700">{stockSummary.faible || 0}</div>
              </div>
              <div className="rounded-lg bg-emerald-50 px-2.5 py-2 ring-1 ring-emerald-100">
                <div className="text-[10px] uppercase tracking-wide text-emerald-500">{t('dashboard.stock.healthy')}</div>
                <div className="text-sm font-extrabold text-emerald-700">{(stockSummary.bon || 0) + (stockSummary.normal || 0)}</div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {stockRows.map(({ bottle, remaining, total, percentage, status, distributed }) => (
                <div key={bottle.id} className="space-y-2 rounded-2xl border border-slate-200/80 bg-gradient-to-b from-white to-slate-50 p-3.5 shadow-sm transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-md hover:border-slate-300">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm">{bottle.name}</span>
                      <Badge variant={status.badge} className="h-5 px-1.5 text-[10px]">{status.label}</Badge>
                      <Badge variant="outline" className="h-5 px-1.5 text-[10px] border-slate-300 text-slate-600">{Math.round(percentage)}% {t('dashboard.stock.coverage')}</Badge>
                    </div>
                    <span className="text-sm font-medium text-muted-foreground">
                      {remaining} / {total}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium">
                    {t('dashboard.stock.current')}: {total} | {t('dashboard.stock.remaining')}: {remaining} | {t('dashboard.stock.distributed')}: {distributed}
                  </div>
                  <div className="relative h-2.5 w-full bg-white rounded-full overflow-hidden ring-1 ring-slate-200/70">
                    <div 
                      className={`absolute top-0 left-0 h-full ${status.color} transition-all duration-500 ease-out`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Widgets Column */}
        <div className="space-y-6">
          <OilBarrelsWidget />
          
          <Card className="border-none shadow-lg ring-1 ring-slate-200/70 bg-gradient-to-b from-white to-slate-50/60 transition-all duration-300 ease-out hover:shadow-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-600" />
                {t('dashboard.performance.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-white ring-1 ring-slate-200/80 transition-all duration-300 ease-out hover:bg-slate-50 hover:ring-slate-300">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-full text-green-600">
                    <Activity className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium">{t('dashboard.performance.distribution')}</span>
                </div>
                <Badge className={performanceSignals.distributionTone}>{performanceSignals.distributionLabel}</Badge>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-white ring-1 ring-slate-200/80 transition-all duration-300 ease-out hover:bg-slate-50 hover:ring-slate-300">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-full text-blue-600">
                    <Truck className="w-4 h-4" />
                  </div>
                   <span className="text-sm font-medium">{t('dashboard.performance.fleet')}</span>
                 </div>
                 <Badge variant="outline" className="text-blue-600 border-blue-200">{activeTrucks} / {trucks.length} {t('dashboard.performance.active')}</Badge>
              </div>
              <Progress value={performanceSignals.fleetRatio} className="h-1.5" />
              <div className="flex items-center justify-between p-3 rounded-lg bg-white ring-1 ring-slate-200/80 transition-all duration-300 ease-out hover:bg-slate-50 hover:ring-slate-300">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-100 rounded-full text-orange-600">
                    <Fuel className="w-4 h-4" />
                  </div>
                   <span className="text-sm font-medium">{t('dashboard.performance.fuel')}</span>
                 </div>
                 <Badge variant="outline" className="text-orange-600 border-orange-200">{performanceSignals.fuelOps} {t('dashboard.performance.fuelOps')}</Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg ring-1 ring-slate-200/70 bg-white transition-all duration-300 ease-out hover:shadow-xl">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                  {t('dashboard.priorities.title')}
                </CardTitle>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => navigate('/inventory')}>{t('dashboard.priorities.inventory')}</Button>
              </div>
              <CardDescription>{t('dashboard.priorities.subtitle')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-rose-50 px-2.5 py-2 ring-1 ring-rose-100 transition-all duration-300 ease-out hover:bg-rose-100">
                  <div className="text-[10px] uppercase tracking-wide text-rose-500">{t('dashboard.priorities.critiques')}</div>
                  <div className="text-sm font-extrabold text-rose-700">{stockSummary.critique || 0}</div>
                </div>
                <div className="rounded-lg bg-amber-50 px-2.5 py-2 ring-1 ring-amber-100 transition-all duration-300 ease-out hover:bg-amber-100">
                  <div className="text-[10px] uppercase tracking-wide text-amber-500">{t('dashboard.priorities.faibles')}</div>
                  <div className="text-sm font-extrabold text-amber-700">{stockSummary.faible || 0}</div>
                </div>
              </div>
              {topRiskBottles.length > 0 ? topRiskBottles.map(({ bottle, remaining, status, coverage }) => (
                <button
                  key={bottle.id}
                  type="button"
                  onClick={() => navigate('/inventory')}
                  className="w-full text-left rounded-xl border border-slate-200 p-3 hover:bg-slate-50 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-sm hover:border-slate-300"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">{bottle.name}</span>
                    <Badge variant={status.badge} className="h-5 px-2 text-[10px]">{status.label}</Badge>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                   <span>{remaining} {t('dashboard.stock.remaining')}</span>
                     <span>{coverage}% {t('dashboard.stock.coverage')}</span>
                  </div>
                </button>
              )) : (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-4 text-sm text-emerald-700">
                  {t('dashboard.priorities.noAlert')}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Recent Activity - Improved */}
        <Card className="lg:col-span-2 border-none shadow-lg ring-1 ring-slate-200/70 bg-white/90 backdrop-blur-sm transition-all duration-300 ease-out hover:shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5 text-purple-600" />
                {t('dashboard.activity.title')}
              </CardTitle>
              <CardDescription>{filteredRecentActivities.length > 0 ? '' : ''}</CardDescription>
            </div>
              <Button variant="ghost" size="sm" onClick={() => navigate('/reports')}>
                {t('dashboard.priorities.viewAll')}
              </Button>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <ToggleGroup type="single" value={activityFilter} onValueChange={(v) => setActivityFilter((v as any) || 'all')} className="gap-2 flex-wrap">
                <ToggleGroupItem value="all" className="px-2 py-1 text-xs bg-slate-100/80 data-[state=on]:bg-slate-900 data-[state=on]:text-white">{t('dashboard.activity.all')}</ToggleGroupItem>
                <ToggleGroupItem value="finance" className="px-2 py-1 text-xs bg-slate-100/80 data-[state=on]:bg-slate-900 data-[state=on]:text-white">{t('dashboard.activity.finance')}</ToggleGroupItem>
                <ToggleGroupItem value="operations" className="px-2 py-1 text-xs bg-slate-100/80 data-[state=on]:bg-slate-900 data-[state=on]:text-white">{t('dashboard.activity.operations')}</ToggleGroupItem>
                <ToggleGroupItem value="maintenance" className="px-2 py-1 text-xs bg-slate-100/80 data-[state=on]:bg-slate-900 data-[state=on]:text-white">{t('dashboard.activity.maintenance')}</ToggleGroupItem>
                <ToggleGroupItem value="stock" className="px-2 py-1 text-xs bg-slate-100/80 data-[state=on]:bg-slate-900 data-[state=on]:text-white">{t('dashboard.activity.stock')}</ToggleGroupItem>
              </ToggleGroup>
              <Badge variant="outline" className="text-xs border-slate-300">{t('dashboard.activity.displayed')}: {filteredRecentActivities.length}</Badge>
            </div>
            <div className="space-y-1">
              {filteredRecentActivities.map((activity) => (
                <div 
                  key={activity.id} 
                  className="flex items-center justify-between rounded-xl border border-transparent p-3 hover:bg-slate-50 hover:border-slate-200 transition-all duration-300 ease-out hover:-translate-y-0.5 group cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-2.5 rounded-lg ${activity.iconBg} group-hover:scale-110 transition-transform duration-300 ease-out`}>
                      {activity.icon}
                    </div>
                    <div>
                      <p className="text-sm font-bold leading-none mb-1">{activity.title}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {activity.subtitle ? `${activity.subtitle} · ` : ''}
                        {activity.date.toLocaleDateString(uiLocale, {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end gap-1">
                    <p className={`text-sm font-bold ${activity.amount ? 'text-slate-900' : 'text-slate-400'}`}>
                      {activity.amount ? `${activity.amount.toLocaleString(uiLocale)} DH` : '--'}
                    </p>
                    <Badge variant="outline" className="h-5 px-1.5 text-[10px] border-slate-300 text-slate-500 capitalize">
                      {activity.category === 'finance' ? t('dashboard.activity.finance') : activity.category === 'operations' ? t('dashboard.activity.operations') : activity.category === 'maintenance' ? t('dashboard.activity.maintenance') : t('dashboard.activity.stock')}
                    </Badge>
                  </div>
                </div>
              ))}
              {filteredRecentActivities.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <History className="w-12 h-12 mb-2 opacity-20" />
                  <p>{tr('Aucune activité pour ce filtre', 'لا توجد أنشطة لهذا الفلتر')}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Alerts & System Summary */}
        <div className="space-y-6">
          {lowStockBottles.length > 0 && (
            <Card className="border-red-200/80 bg-red-50/50 shadow-sm transition-all duration-300 ease-out hover:shadow-md">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-lg font-bold flex items-center gap-2 text-red-600">
                    <AlertTriangle className="w-5 h-5 animate-bounce" />
                    {t('dashboard.stockAlerts')}
                  </CardTitle>
                  <Badge variant="destructive">{lowStockBottles.length}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {lowStockBottles.map((bottle) => (
                  <div key={bottle.id} className="flex items-center justify-between p-2 bg-white rounded-lg shadow-sm border border-red-100 transition-all duration-300 ease-out hover:bg-red-50">
                    <span className="text-sm font-medium">{bottle.name}</span>
                    <Badge variant="destructive" className="font-bold">
                      {getRemainingQuantity(bottle)} {t('dashboard.stock.remaining')}
                    </Badge>
                  </div>
                ))}
                <Button size="sm" variant="outline" className="w-full border-red-200 text-red-700 hover:bg-red-100" onClick={() => navigate('/inventory')}>
                  {t('dashboard.stock.manageOpen')}
                </Button>
              </CardContent>
            </Card>
          )}

          <Card className="border-none shadow-xl bg-gradient-to-br from-primary via-indigo-600 to-sky-600 text-white transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-2xl">
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  {t('dashboard.executivePulse.title')}
                </CardTitle>
                <Button size="sm" variant="secondary" className="h-7 bg-white/20 text-white hover:bg-white/30 border-none" onClick={() => navigate('/reports')}>
                  {t('dashboard.pulse.reports')}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-white/10 px-2.5 py-2 border border-white/15 transition-all duration-300 ease-out hover:bg-white/20">
                  <div className="text-[10px] uppercase tracking-wide text-white/75">{t('dashboard.priorities.critiques')}</div>
                  <div className="text-base font-extrabold">{globalPulse.criticalCount}</div>
                </div>
                <div className="rounded-lg bg-white/10 px-2.5 py-2 border border-white/15 transition-all duration-300 ease-out hover:bg-white/20">
                  <div className="text-[10px] uppercase tracking-wide text-white/75">{t('dashboard.priorities.faibles')}</div>
                  <div className="text-base font-extrabold">{globalPulse.lowCount}</div>
                </div>
                <div className="rounded-lg bg-white/10 px-2.5 py-2 border border-white/15 transition-all duration-300 ease-out hover:bg-white/20">
                  <div className="text-[10px] uppercase tracking-wide text-white/75">{t('dashboard.stock.healthy')}</div>
                  <div className="text-base font-extrabold">{globalPulse.healthyCount}</div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1 opacity-80 uppercase tracking-wider font-semibold">
                  <span>{t('dashboard.executivePulse.stockHealthScore')}</span>
                  <span>{globalPulse.stockHealthScore}%</span>
                </div>
                <Progress value={globalPulse.stockHealthScore} className="h-2 bg-white/20 [&>div]:bg-white" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-white/10 px-2.5 py-2 border border-white/15 transition-all duration-300 ease-out hover:bg-white/20">
                  <div className="text-[10px] uppercase tracking-wide text-white/75">{t('dashboard.executivePulse.expenseRatio')}</div>
                  <div className="text-base font-extrabold">{globalPulse.expenseRatio}%</div>
                </div>
                <div className="rounded-lg bg-white/10 px-2.5 py-2 border border-white/15 transition-all duration-300 ease-out hover:bg-white/20">
                  <div className="text-[10px] uppercase tracking-wide text-white/75">{t('dashboard.executivePulse.debtRatio')}</div>
                  <div className="text-base font-extrabold">{globalPulse.debtLoadRatio}%</div>
                </div>
              </div>
              <div className="pt-1">
                <p className="text-3xl font-bold">{netBalance.toLocaleString(uiLocale)} DH</p>
                <p className="text-xs opacity-70">{t('dashboard.executivePulse.netBalanceHint')}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
