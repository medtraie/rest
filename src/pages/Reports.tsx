import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useApp } from '@/contexts/AppContext';
import { 
  FileText, 
  Download, 
  Filter, 
  Calendar,
  BarChart3,
  PieChart,
  TrendingUp,
  Package,
  Truck,
  Users,
  ArrowRightLeft,
  AlertTriangle,
  Activity,
  ThumbsUp,
  ThumbsDown,
  Info,
  Sparkles,
  Gauge,
  Layers3,
  ArrowUp,
  ArrowDown,
  BriefcaseBusiness,
  HandCoins,
  Navigation,
  Minimize2,
  Maximize2,
  Radar
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Revenue } from '@/types';
import { supabaseService } from '@/lib/supabaseService';
import { kvGet, kvSet } from '@/lib/kv';
import { motion } from 'framer-motion';
import { buildReportsStockKpis, type KpiComparisonPoint } from '@/lib/reportsKpi';
import { useLanguage, useT } from '@/contexts/LanguageContext';

type ReportsUIPreferences = {
  startDate: string;
  endDate: string;
  selectedFilter: string;
  selectedTruck: string;
  selectedDriver: string;
  transactionsSort: 'date_desc' | 'date_asc' | 'value_desc' | 'value_asc';
  transactionsLimit: '25' | '50' | '100' | 'all';
  showTransactions: boolean;
  showReference: boolean;
  transactionTypeFilter: 'all' | 'supply' | 'return' | 'exchange' | 'factory';
  showNonZeroOnly: boolean;
};

const REPORTS_UI_PREFS_KEY = 'reports_ui_preferences_v1';

const Reports = () => {
  const { transactions, bottleTypes, trucks, drivers, exchanges, expenses, revenues, returnOrders, supplyOrders, repairs } = useApp();
  const MButton = motion(Button);
  const t = useT();
  const { language } = useLanguage();
  const uiLocale = language === 'ar' ? 'ar-MA' : 'fr-FR';
  const tr = (frText: string, arText: string) => (language === 'ar' ? arText : frText);
  const tp = (key: string, fallback: string) => t(`reports.pdf.${key}`, fallback);
  const isArabicPdf = language === 'ar';
  const arabicPdfFontFile = 'NotoNaskhArabic-Regular.ttf';
  const arabicPdfFontName = 'NotoNaskhArabic';
  const arabicPdfFontUrl = 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/notonaskharabic/NotoNaskhArabic-Regular.ttf';
  const arabicPdfFontDataRef = React.useRef<string | null>(null);

  const getArabicPdfFontData = React.useCallback(async () => {
    if (arabicPdfFontDataRef.current) return arabicPdfFontDataRef.current;
    const cacheKey = 'reports_pdf_font_ar_v1';
    const cached = window.localStorage.getItem(cacheKey);
    if (cached) {
      arabicPdfFontDataRef.current = cached;
      return cached;
    }
    const response = await fetch(arabicPdfFontUrl);
    if (!response.ok) throw new Error(`PDF font download failed (${response.status})`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    const base64 = btoa(binary);
    arabicPdfFontDataRef.current = base64;
    window.localStorage.setItem(cacheKey, base64);
    return base64;
  }, [arabicPdfFontUrl]);

  const createPdfDoc = React.useCallback(async (options?: ConstructorParameters<typeof jsPDF>[0]) => {
    const doc = new jsPDF(options as any);
    if (isArabicPdf) {
      const fontData = await getArabicPdfFontData();
      doc.addFileToVFS(arabicPdfFontFile, fontData);
      doc.addFont(arabicPdfFontFile, arabicPdfFontName, 'normal');
      doc.setFont(arabicPdfFontName, 'normal');
    }
    return doc;
  }, [isArabicPdf, getArabicPdfFontData, arabicPdfFontFile, arabicPdfFontName]);

  const setPdfFont = (doc: jsPDF, weight: 'normal' | 'bold' = 'normal') => {
    if (isArabicPdf) {
      doc.setFont(arabicPdfFontName, 'normal');
      return;
    }
    doc.setFont('helvetica', weight);
  };
  const [dateFilter, setDateFilter] = useState({
    startDate: '',
    endDate: ''
  });
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [selectedTruck, setSelectedTruck] = useState('all');
  const [selectedDriver, setSelectedDriver] = useState('all');
  const [dailyStartDate, setDailyStartDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [dailyEndDate, setDailyEndDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [dailyReportDriver, setDailyReportDriver] = useState('all');
  const [stockSearch, setStockSearch] = useState('');
  const [driverSearch, setDriverSearch] = useState('');
  const [transactionSearch, setTransactionSearch] = useState('');
  const [analysisSearch, setAnalysisSearch] = useState('');
  const [showTransactions, setShowTransactions] = useState(true);
  const [transactionsSort, setTransactionsSort] = useState<'date_desc' | 'date_asc' | 'value_desc' | 'value_asc'>('date_desc');
  const [transactionsLimit, setTransactionsLimit] = useState<'25' | '50' | '100' | 'all'>('50');
  const [expandedTransactionId, setExpandedTransactionId] = useState<string | null>(null);
  const [showReference, setShowReference] = useState(true);
  const [transactionTypeFilter, setTransactionTypeFilter] = useState<'all' | 'supply' | 'return' | 'exchange' | 'factory'>('all');
  const [showNonZeroOnly, setShowNonZeroOnly] = useState(false);
  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const [isBulkGeneratingReports, setIsBulkGeneratingReports] = useState(false);
  const [completedReportIds, setCompletedReportIds] = useState<string[]>([]);
  const [glowingReportIds, setGlowingReportIds] = useState<string[]>([]);
  const [dailyReportsDisplayMode, setDailyReportsDisplayMode] = useState<'cards' | 'list'>('list');
  const [reportsView, setReportsView] = useState<'executive' | 'operational' | 'finance'>('executive');
  const [layoutMode, setLayoutMode] = useState<'immersive' | 'compact'>('immersive');
  const [kpiOrder, setKpiOrder] = useState<Array<'value' | 'supply' | 'return' | 'mix'>>([
    'value',
    'supply',
    'return',
    'mix',
  ]);
  const [factoryOps, setFactoryOps] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  React.useEffect(() => {
    (async () => {
      const ops = await supabaseService.getAll<any>('factory_operations');
      setFactoryOps(ops || []);
    })();
  }, []);
  React.useEffect(() => {
    (async () => {
      const list = await supabaseService.getAll<any>('suppliers');
      setSuppliers(list || []);
    })();
  }, []);
  React.useEffect(() => {
    let active = true;
    const applyPrefs = (prefs: Partial<ReportsUIPreferences>) => {
      if (!active) return;
      if (typeof prefs.startDate === 'string') {
        setDateFilter((prev) => ({ ...prev, startDate: prefs.startDate }));
      }
      if (typeof prefs.endDate === 'string') {
        setDateFilter((prev) => ({ ...prev, endDate: prefs.endDate }));
      }
      if (typeof prefs.selectedFilter === 'string') setSelectedFilter(prefs.selectedFilter);
      if (typeof prefs.selectedTruck === 'string') setSelectedTruck(prefs.selectedTruck);
      if (typeof prefs.selectedDriver === 'string') setSelectedDriver(prefs.selectedDriver);
      if (prefs.transactionsSort && ['date_desc', 'date_asc', 'value_desc', 'value_asc'].includes(prefs.transactionsSort)) {
        setTransactionsSort(prefs.transactionsSort);
      }
      if (prefs.transactionsLimit && ['25', '50', '100', 'all'].includes(prefs.transactionsLimit)) {
        setTransactionsLimit(prefs.transactionsLimit);
      }
      if (typeof prefs.showTransactions === 'boolean') setShowTransactions(prefs.showTransactions);
      if (typeof prefs.showReference === 'boolean') setShowReference(prefs.showReference);
      if (prefs.transactionTypeFilter && ['all', 'supply', 'return', 'exchange', 'factory'].includes(prefs.transactionTypeFilter)) {
        setTransactionTypeFilter(prefs.transactionTypeFilter);
      }
      if (typeof prefs.showNonZeroOnly === 'boolean') setShowNonZeroOnly(prefs.showNonZeroOnly);
    };
    (async () => {
      try {
        const localRaw = window.localStorage.getItem(REPORTS_UI_PREFS_KEY);
        if (localRaw) {
          const localPrefs = JSON.parse(localRaw) as Partial<ReportsUIPreferences>;
          applyPrefs(localPrefs);
        }
      } catch {}
      try {
        const cloudPrefs = await kvGet<Partial<ReportsUIPreferences>>(REPORTS_UI_PREFS_KEY);
        if (cloudPrefs) {
          applyPrefs(cloudPrefs);
          try {
            window.localStorage.setItem(REPORTS_UI_PREFS_KEY, JSON.stringify(cloudPrefs));
          } catch {}
        }
      } catch {}
      if (active) setPrefsLoaded(true);
    })();
    return () => {
      active = false;
    };
  }, []);
  React.useEffect(() => {
    if (!prefsLoaded) return;
    const prefs: ReportsUIPreferences = {
      startDate: dateFilter.startDate,
      endDate: dateFilter.endDate,
      selectedFilter,
      selectedTruck,
      selectedDriver,
      transactionsSort,
      transactionsLimit,
      showTransactions,
      showReference,
      transactionTypeFilter,
      showNonZeroOnly,
    };
    try {
      window.localStorage.setItem(REPORTS_UI_PREFS_KEY, JSON.stringify(prefs));
    } catch {}
    (async () => {
      try {
        await kvSet(REPORTS_UI_PREFS_KEY, prefs);
      } catch {}
    })();
  }, [
    prefsLoaded,
    dateFilter.startDate,
    dateFilter.endDate,
    selectedFilter,
    selectedTruck,
    selectedDriver,
    transactionsSort,
    transactionsLimit,
    showTransactions,
    showReference,
    transactionTypeFilter,
    showNonZeroOnly,
  ]);

  // Filter transactions based on selected criteria
  const getTransactionValue = (t: any) =>
    Number(t?.totalValue ?? t?.totalvalue ?? t?.value ?? t?.amount ?? t?.montant ?? t?.totalAmount ?? 0) || 0;
  const getTypeMeta = (type: string) => {
    if (type === 'supply') return { label: t('reports.types.supply', 'Alimentation'), className: 'bg-blue-50 text-blue-700' };
    if (type === 'return') return { label: t('reports.types.return', 'Retour'), className: 'bg-green-50 text-green-700' };
    if (type === 'exchange') return { label: t('reports.types.exchange', 'Échange'), className: 'bg-orange-50 text-orange-700' };
    if (type === 'factory_reception') return { label: t('reports.types.factoryReception', 'Réception Usine'), className: 'bg-purple-50 text-purple-700' };
    if (type === 'factory_invoice') return { label: t('reports.types.factoryInvoice', 'Facture Usine'), className: 'bg-indigo-50 text-indigo-700' };
    if (type === 'factory_settlement') return { label: t('reports.types.factorySettlement', 'Règlement Usine'), className: 'bg-teal-50 text-teal-700' };
    return { label: t('reports.types.factory', 'Usine'), className: 'bg-gray-50 text-gray-700' };
  };

  const filteredTransactions = transactions.filter(transaction => {
    const transactionDate = new Date(transaction.date);
    const startDate = dateFilter.startDate ? new Date(dateFilter.startDate) : null;
    const endDate = dateFilter.endDate ? new Date(dateFilter.endDate) : null;

    if (startDate && transactionDate < startDate) return false;
    if (endDate && transactionDate > endDate) return false;
    if (selectedFilter !== 'all') {
      if (selectedFilter === 'factory') {
        if (!String(transaction.type || '').includes('factory')) return false;
      } else {
        if (transaction.type !== selectedFilter) return false;
      }
    }
    if (selectedTruck !== 'all' && transaction.truckId !== selectedTruck) return false;
    if (selectedDriver !== 'all' && transaction.driverId !== selectedDriver) return false;

    if (transactionSearch) {
      const search = transactionSearch.toLowerCase();
      const dName = drivers.find((d) => d.id === transaction.driverId)?.name?.toLowerCase() || '';
      const trk = trucks.find((tr) => tr.id === transaction.truckId) as any;
      const tName = (trk?.name || trk?.plateNumber || trk?.registration || '')?.toLowerCase() || '';
      
      let cName = '';
      if (transaction.type === 'supply') {
        const order = supplyOrders.find(o => o.id === transaction.relatedOrderId || o.orderNumber === transaction.relatedOrderId);
        cName = order?.clientName?.toLowerCase() || '';
      } else if (transaction.type === 'return') {
        const order = returnOrders.find(o => o.id === transaction.relatedOrderId);
        cName = order?.clientName?.toLowerCase() || '';
      }

      return (
        dName.includes(search) ||
        tName.includes(search) ||
        cName.includes(search) ||
        transaction.type.toLowerCase().includes(search)
      );
    }

    return true;
  });

  // Calculate metrics
  const totalValue = filteredTransactions.reduce((sum, t) => sum + getTransactionValue(t), 0);
  const transactionsByType = {
    supply: filteredTransactions.filter(t => t.type === 'supply').length,
    return: filteredTransactions.filter(t => t.type === 'return').length,
    exchange: filteredTransactions.filter(t => t.type === 'exchange').length,
    factory: filteredTransactions.filter(t => String(t.type || '').includes('factory')).length,
  };
  const summaryTransactions = transactions.filter(transaction => {
    const transactionDate = new Date(transaction.date);
    const startDate = dateFilter.startDate ? new Date(dateFilter.startDate) : null;
    const endDate = dateFilter.endDate ? new Date(dateFilter.endDate) : null;
    const endOfDay = endDate ? new Date(endDate) : null;
    if (endOfDay) endOfDay.setHours(23, 59, 59, 999);

    if (startDate && transactionDate < startDate) return false;
    if (endOfDay && transactionDate > endOfDay) return false;
    if (selectedTruck !== 'all' && transaction.truckId !== selectedTruck) return false;
    if (selectedDriver !== 'all' && transaction.driverId !== selectedDriver) return false;
    return true;
  });
  const summaryByType = {
    supply: (supplyOrders || []).filter((order: any) => {
      const orderDate = new Date(order.date || '');
      const startDate = dateFilter.startDate ? new Date(dateFilter.startDate) : null;
      const endDate = dateFilter.endDate ? new Date(dateFilter.endDate) : null;
      const endOfDay = endDate ? new Date(endDate) : null;
      if (endOfDay) endOfDay.setHours(23, 59, 59, 999);
      if (startDate && orderDate < startDate) return false;
      if (endOfDay && orderDate > endOfDay) return false;
      if (selectedTruck !== 'all' && order.truckId !== selectedTruck) return false;
      if (selectedDriver !== 'all' && order.driverId !== selectedDriver) return false;
      return true;
    }).length,
    return: (returnOrders || []).filter((order: any) => {
      const orderDate = new Date(order.date || '');
      const startDate = dateFilter.startDate ? new Date(dateFilter.startDate) : null;
      const endDate = dateFilter.endDate ? new Date(dateFilter.endDate) : null;
      const endOfDay = endDate ? new Date(endDate) : null;
      if (endOfDay) endOfDay.setHours(23, 59, 59, 999);
      if (startDate && orderDate < startDate) return false;
      if (endOfDay && orderDate > endOfDay) return false;
      if (selectedTruck !== 'all') {
        const linkedSupply = (supplyOrders || []).find((s: any) => String(s.id) === String(order.supplyOrderId));
        if ((linkedSupply?.truckId || '') !== selectedTruck) return false;
      }
      if (selectedDriver !== 'all' && order.driverId !== selectedDriver) return false;
      return true;
    }).length,
    exchange: summaryTransactions.filter(t => t.type === 'exchange').length,
    factory: summaryTransactions.filter(t => String(t.type || '').includes('factory')).length,
  };
  const summaryTotalValue = summaryTransactions.reduce((sum, t) => sum + getTransactionValue(t), 0);

  const sortedTransactions = React.useMemo(() => {
    const list = [...filteredTransactions] as any[];
    const getTime = (t: any) => new Date(t?.date || 0).getTime();
    const getValue = (t: any) => getTransactionValue(t);
    list.sort((a, b) => {
      if (transactionsSort === 'date_desc') return getTime(b) - getTime(a);
      if (transactionsSort === 'date_asc') return getTime(a) - getTime(b);
      if (transactionsSort === 'value_desc') return getValue(b) - getValue(a);
      return getValue(a) - getValue(b);
    });
    return list;
  }, [filteredTransactions, transactionsSort]);

  const tableFilteredTransactions = React.useMemo(() => {
    return sortedTransactions.filter((t: any) => {
      if (transactionTypeFilter !== 'all') {
        if (transactionTypeFilter === 'factory') {
          if (!String(t.type || '').includes('factory')) return false;
        } else if (t.type !== transactionTypeFilter) {
          return false;
        }
      }
      if (showNonZeroOnly && getTransactionValue(t) <= 0) return false;
      return true;
    });
  }, [sortedTransactions, transactionTypeFilter, showNonZeroOnly]);

  const visibleTransactions = React.useMemo(() => {
    if (transactionsLimit === 'all') return tableFilteredTransactions;
    const limit = Number(transactionsLimit);
    return tableFilteredTransactions.slice(0, limit);
  }, [tableFilteredTransactions, transactionsLimit]);
  const visibleTransactionsTotal = React.useMemo(
    () => visibleTransactions.reduce((sum, t: any) => sum + getTransactionValue(t), 0),
    [visibleTransactions]
  );
  const visibleTransactionsWithValue = React.useMemo(
    () => visibleTransactions.filter((t: any) => getTransactionValue(t) > 0).length,
    [visibleTransactions]
  );

  const stockKpiBundle = React.useMemo(() => buildReportsStockKpis({
    bottleTypes: bottleTypes as any,
    returnOrders: (returnOrders || []) as any,
    supplyOrders: (supplyOrders || []) as any,
    filter: {
      startDate: dateFilter.startDate,
      endDate: dateFilter.endDate,
      selectedTruck,
      selectedDriver,
    },
  }), [
    bottleTypes,
    returnOrders,
    supplyOrders,
    dateFilter.startDate,
    dateFilter.endDate,
    selectedTruck,
    selectedDriver,
  ]);
  const stockAnalysis = stockKpiBundle.stockAnalysis;
  const stockTotalUnits = stockKpiBundle.kpis.totalUnits;
  const stockDistributedUnits = stockKpiBundle.kpis.distributedUnits;
  const stockAverageDistributionRate = stockKpiBundle.kpis.averageDistributionRate;
  const stockRemainingValue = stockKpiBundle.kpis.stockValueRemaining;
  const stockAnomalies = stockKpiBundle.anomalies;
  const stockComparison = stockKpiBundle.comparison;

  const renderKpiComparison = (point: KpiComparisonPoint | null, suffix = '') => {
    if (!point) {
      return <div className="mt-1 text-xs text-slate-500">{t('reports.kpi.noPreviousPeriod', 'Aucune période précédente')}</div>;
    }
    const deltaSign = point.delta > 0 ? '+' : '';
    const deltaValue = `${deltaSign}${point.delta.toFixed(1)}${suffix}`;
    const trendClass = point.delta > 0 ? 'text-emerald-700' : point.delta < 0 ? 'text-red-700' : 'text-slate-700';
    const trendLabel = point.deltaPercent === null ? '—' : `${point.deltaPercent > 0 ? '+' : ''}${point.deltaPercent.toFixed(1)}%`;
    return (
      <div className={`mt-1 text-xs font-semibold ${trendClass}`}>{t('reports.kpi.vsPreviousPeriod', 'vs période précédente')}: {deltaValue} ({trendLabel})</div>
    );
  };

  // Driver debt analysis
  const driverAnalysis = drivers.map(d => {
    const debt = d.debt || 0;
    const advances = d.advances || 0;
    const balance = d.balance || 0;
    
    // Status logic
    let status = t('drivers.status.balanced', 'Équilibré');
    let statusVariant: 'default' | 'destructive' | 'secondary' | 'outline' = 'secondary';
    
    if (balance < 0) {
      status = t('drivers.status.debt', 'Dette');
      statusVariant = 'destructive';
    } else if (balance > 0) {
      status = t('drivers.status.credit', 'Crédit');
      statusVariant = 'default';
    }

    return {
      id: d.id,
      name: d.name,
      debt,
      advances,
      balance,
      status,
      statusVariant
    };
  });

  const exportToPDF = async () => {
    await generateGeneralReport();
  };

  const exportToExcel = () => {
    const rows = filteredTransactions.map((t: any) => {
      const driverName = drivers.find((d) => d.id === t.driverId)?.name || '-';
      const truck = trucks.find((tr) => tr.id === t.truckId) as any;
      const truckName = (truck?.name || truck?.plateNumber || truck?.registration || '-') as string;
      const value = getTransactionValue(t).toFixed(2);
      return [
        new Date(t.date).toLocaleString(uiLocale),
        String(t.type || ''),
        driverName,
        truckName,
        value,
        String(t.reference || t.ref || t.orderNumber || t.relatedOrderId || t.id || ''),
      ];
    });
    const csv = [
      [tp('table.date', 'Date'), tp('table.type', 'Type'), tp('table.driver', 'Chauffeur'), tp('table.truck', 'Camion'), tp('table.valueMad', 'Valeur (MAD)'), tp('table.reference', 'Référence')].join(';'),
      ...rows.map((r) => r.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(';')),
    ].join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `transactions_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };


  const parseDateStr = (s?: string) => (s ? new Date(`${s}T00:00:00`) : null);
  const inRange = (d: Date) => {
    const s = parseDateStr(dailyStartDate);
    const e = parseDateStr(dailyEndDate);
    const dTime = d.getTime();
    if (s && dTime < s.getTime()) return false;
    if (e && dTime > new Date(`${dailyEndDate}T23:59:59.999`).getTime()) return false;
    return true;
  };

  const periodLabel = (() => {
    const s = dailyStartDate || '';
    const e = dailyEndDate || dailyStartDate || '';
    return s && e ? `${s} - ${e}` : (s || e || '');
  })();

  const generateDailyExpenseReport = async (currentExpenses: any[]) => {
    const reportDate = periodLabel;
    const doc = await createPdfDoc();
    const generatedAt = new Date().toLocaleString(uiLocale);
    addPdfHeader(doc, tp('headers.dailyExpense', 'Rapport Journalier des Notes de Frais'), [
      `${tp('labels.period', 'Période')}: ${reportDate}`,
      `${tp('labels.generatedAt', 'Généré le')}: ${generatedAt}`,
    ]);

    const dailyExpenses = currentExpenses.filter(expense => {
      const d = new Date(expense.date);
      return inRange(d) && expense.type === 'note de frais';
    });
    if (dailyExpenses.length === 0) {
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(12);
      doc.text(tp('empty.noDailyExpense', 'Aucune note de frais pour cette sélection.'), 14, 52);
      doc.save(`rapport_frais_${reportDate}.pdf`);
      return;
    }

    const expensesByDriver: Record<string, { driverName: string; expenses: any[] }> = {};
    const companyExpenses = {
        driverName: tp('labels.companyDebt', "Dette de l'entreprise"),
        expenses: []
    };

    dailyExpenses.forEach(expense => {
      let processed = false;
      if (expense.returnOrderId) {
        const returnOrder = returnOrders.find(ro => ro.id === expense.returnOrderId);
        if (returnOrder) {
          const driver = drivers.find(d => d.id === returnOrder.driverId);
          if (driver) {
            if (!expensesByDriver[driver.id]) {
              expensesByDriver[driver.id] = {
                driverName: driver.name,
                expenses: []
              };
            }
            expensesByDriver[driver.id].expenses.push(expense);
            processed = true;
          }
        }
      }
      
      if (!processed) {
        companyExpenses.expenses.push(expense);
      }
    });

    const paymentTotals = dailyExpenses.reduce<Record<string, number>>((acc, exp) => {
      const key = String(exp.paymentMethod || 'inconnu');
      acc[key] = (acc[key] || 0) + (exp.amount || 0);
      return acc;
    }, {});

    const grandTotal = dailyExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
    const allGroupedExpenses: Array<{ driverName: string; expenses: any[] }> = [
      ...Object.values(expensesByDriver),
      ...(companyExpenses.expenses.length > 0 ? [companyExpenses] : []),
    ];

    const sortedGroups = allGroupedExpenses
      .map(g => ({
        ...g,
        expenses: [...g.expenses].sort((a, b) => (b.amount || 0) - (a.amount || 0)),
        total: g.expenses.reduce((s, e: any) => s + (e.amount || 0), 0),
      }))
      .sort((a, b) => (b.total || 0) - (a.total || 0));

    const tableColumn = [tp('table.time', 'Heure'), tp('table.reference', 'Référence'), tp('table.note', 'Note'), tp('table.mode', 'Mode'), tp('table.amountDh', 'Montant (DH)')];
    const tableRows: any[] = [];

    sortedGroups.forEach((group) => {
      tableRows.push([
        { content: group.driverName, colSpan: 5, styles: { fillColor: [248, 250, 252], textColor: [30, 41, 59], fontStyle: 'bold' } }
      ]);

      group.expenses.forEach((expense: any) => {
        const timeStr = expense?.date ? new Date(expense.date).toLocaleTimeString(uiLocale, { hour: '2-digit', minute: '2-digit' }) : '';
        const source = expense?.returnOrderId ? 'B.D' : '';
        const ref = expense?.returnOrderId ? `${source} ${String(expense.returnOrderId).slice(-6)}` : '';
        tableRows.push([
          timeStr,
          ref,
          expense?.note || '-',
          String(expense?.paymentMethod || '-'),
          (expense?.amount || 0).toFixed(2),
        ]);
      });

      tableRows.push([
        { content: tp('labels.total', 'Total'), colSpan: 4, styles: { halign: 'right', fontStyle: 'bold' } },
        { content: group.total.toFixed(2), styles: { halign: 'right', fontStyle: 'bold' } }
      ]);
    });

    const tableStartY = addPdfMetricCards(doc, [
      { label: tp('cards.transactions', 'Transaction'), value: String(dailyExpenses.length), color: [59, 130, 246] },
      { label: tp('cards.total', 'Total'), value: `${grandTotal.toFixed(2)} DH`, color: [16, 185, 129] },
      { label: tp('cards.methods', 'Méthodes'), value: String(Object.keys(paymentTotals).length), color: [245, 158, 11] },
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      ...getPdfTableStyle(tableStartY, 9, {
        0: { cellWidth: 16 },
        1: { cellWidth: 28 },
        3: { cellWidth: 24 },
        4: { halign: 'right', cellWidth: 28, fontStyle: 'bold' },
      }),
      columnStyles: {
        0: { cellWidth: 16 },
        1: { cellWidth: 28 },
        3: { cellWidth: 24 },
        4: { halign: 'right', cellWidth: 28, fontStyle: 'bold' }
      },
    });

    const finalY = (doc as any).lastAutoTable.finalY || 46;
    const summaryY = finalY + 10;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, summaryY, 182, 22, 2, 2, 'F');
    doc.setTextColor(30, 41, 59);
    setPdfFont(doc, 'bold');
    doc.setFontSize(10);
    doc.text(`${tp('labels.total', 'Total')}: ${grandTotal.toFixed(2)} DH`, 20, summaryY + 8);
    setPdfFont(doc, 'normal');
    const paymentSummary = Object.entries(paymentTotals)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k}: ${v.toFixed(2)} DH`)
      .join(' | ');
    doc.text(paymentSummary, 20, summaryY + 15, { maxWidth: 170 });

    addPdfPageNumbers(doc);

    doc.save(`rapport_frais_${reportDate}.pdf`);
  };

  const generateDriverDebtReport = async () => {
    const reportDate = periodLabel;
    const doc = await createPdfDoc();
    const generatedAt = new Date().toLocaleString(uiLocale);
    addPdfHeader(doc, tp('headers.driverDebts', 'Rapport des Dettes des Chauffeurs'), [
      `${tp('labels.period', 'Période')}: ${reportDate}`,
      `${tp('labels.generatedAt', 'Généré le')}: ${generatedAt}`,
    ]);

    const driversWithDebt = drivers.filter(driver => driver.debt > 0);

    if (driversWithDebt.length === 0) {
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(12);
      doc.text(tp('empty.noDriverDebts', 'Aucun chauffeur avec des dettes.'), 14, 52);
      doc.save(`rapport_dettes_${reportDate}.pdf`);
      return;
    }

    const sortedDrivers = [...driversWithDebt].sort((a, b) => (b.debt || 0) - (a.debt || 0));
    const totalDebt = sortedDrivers.reduce((sum, driver) => sum + (driver.debt || 0), 0);
    const avgDebt = totalDebt / Math.max(1, sortedDrivers.length);

    const tableStartY = addPdfMetricCards(doc, [
      { label: tp('cards.drivers', 'Chauffeurs'), value: String(sortedDrivers.length), color: [239, 68, 68] },
      { label: tp('cards.totalDebt', 'Total dette'), value: `${totalDebt.toFixed(2)} DH`, color: [99, 102, 241] },
      { label: tp('cards.average', 'Moyenne'), value: `${avgDebt.toFixed(2)} DH`, color: [245, 158, 11] },
    ]);

    const tableColumn = ["#", tp('table.driver', 'Chauffeur'), tp('table.debtDh', 'Dette (DH)'), tp('table.cumulativeDh', 'Cumul (DH)'), tp('table.share', 'Part')];
    const tableRows: any[] = [];

    let runningTotal = 0;
    sortedDrivers.forEach((driver, idx) => {
      const debt = driver.debt || 0;
      runningTotal += debt;
      const part = totalDebt > 0 ? `${((debt / totalDebt) * 100).toFixed(1)}%` : '0%';
      tableRows.push([
        String(idx + 1),
        driver.name || '-',
        debt.toFixed(2),
        runningTotal.toFixed(2),
        part,
      ]);
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      ...getPdfTableStyle(tableStartY, 9),
      columnStyles: {
        0: { cellWidth: 8, halign: 'right' },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { cellWidth: 16, halign: 'right' },
      },
    });

    const finalY = (doc as any).lastAutoTable.finalY;
    const summaryY = finalY + 10;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, summaryY, 182, 18, 2, 2, 'F');
    doc.setTextColor(30, 41, 59);
    setPdfFont(doc, 'bold');
    doc.setFontSize(10);
    doc.text(`${tp('labels.totalDebts', 'Total des dettes')}: ${totalDebt.toFixed(2)} DH`, 20, summaryY + 7);
    setPdfFont(doc, 'normal');
    doc.text(`${tp('cards.average', 'Moyenne')}: ${avgDebt.toFixed(2)} DH`, 20, summaryY + 13);

    addPdfPageNumbers(doc);

    doc.save(`rapport_dettes_${reportDate}.pdf`);
  };

  const generateMiscellaneousExpensesReport = async () => {
    const reportDate = periodLabel;
    const doc = await createPdfDoc();
    const generatedAt = new Date().toLocaleString(uiLocale);
    addPdfHeader(doc, tp('headers.miscExpenses', 'Rapport des Dépenses Diverses'), [
      `${tp('labels.period', 'Période')}: ${reportDate}`,
      `${tp('labels.generatedAt', 'Généré le')}: ${generatedAt}`,
    ]);

    const dailyExpenses = expenses.filter(expense => {
      const d = new Date(expense.date);
      return inRange(d) && !expense.returnOrderId;
    });

    if (dailyExpenses.length === 0) {
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(12);
      doc.text(tp('empty.noMiscExpenseToday', "Aucune dépense diverse pour aujourd'hui."), 14, 52);
      doc.save(`rapport_depenses_diverses_${reportDate}.pdf`);
      return;
    }

    const sortedExpenses = [...dailyExpenses].sort((a, b) => (b.amount || 0) - (a.amount || 0));
    const paymentTotals = sortedExpenses.reduce<Record<string, number>>((acc, exp) => {
      const key = String(exp.paymentMethod || 'inconnu');
      acc[key] = (acc[key] || 0) + (exp.amount || 0);
      return acc;
    }, {});

    const totalAmount = sortedExpenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);

    const tableColumn = ["#", tp('table.time', 'Heure'), tp('table.type', 'Type'), tp('table.mode', 'Mode'), tp('table.note', 'Note'), tp('table.amountDh', 'Montant (DH)')];
    const tableRows: any[] = [];

    sortedExpenses.forEach((expense, idx) => {
      const timeStr = expense?.date ? new Date(expense.date).toLocaleTimeString(uiLocale, { hour: '2-digit', minute: '2-digit' }) : '';
      tableRows.push([
        String(idx + 1),
        timeStr,
        expense.type || '-',
        String(expense.paymentMethod || '-'),
        expense.note || '-',
        (expense.amount || 0).toFixed(2),
      ]);
    });

    const tableStartY = addPdfMetricCards(doc, [
      { label: tp('cards.transactions', 'Transaction'), value: String(sortedExpenses.length), color: [59, 130, 246] },
      { label: tp('cards.total', 'Total'), value: `${totalAmount.toFixed(2)} DH`, color: [16, 185, 129] },
      { label: tp('cards.methods', 'Méthodes'), value: String(Object.keys(paymentTotals).length), color: [245, 158, 11] },
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      ...getPdfTableStyle(tableStartY, 9),
      columnStyles: {
        0: { cellWidth: 8, halign: 'right' },
        1: { cellWidth: 16 },
        5: { halign: 'right', cellWidth: 28, fontStyle: 'bold' },
      },
    });

    const finalY = (doc as any).lastAutoTable.finalY || 46;
    const summaryY = finalY + 10;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, summaryY, 182, 22, 2, 2, 'F');
    doc.setTextColor(30, 41, 59);
    setPdfFont(doc, 'bold');
    doc.setFontSize(10);
    doc.text(`${tp('labels.totalExpenses', 'Total des dépenses')}: ${totalAmount.toFixed(2)} DH`, 20, summaryY + 8);
    setPdfFont(doc, 'normal');
    const paymentSummary = Object.entries(paymentTotals)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k}: ${v.toFixed(2)} DH`)
      .join(' | ');
    doc.text(paymentSummary, 20, summaryY + 15, { maxWidth: 170 });

    addPdfPageNumbers(doc);

    doc.save(`rapport_depenses_diverses_${reportDate}.pdf`);
  };

  const generateTransportReport = async () => {
    const reportDate = periodLabel;
    const doc = await createPdfDoc();
    const generatedAt = new Date().toLocaleString(uiLocale);
    addPdfHeader(doc, tp('headers.transport', 'Rapport Journalier des Dépenses de Transport'), [
      `${tp('labels.period', 'Période')}: ${reportDate}`,
      `${tp('labels.generatedAt', 'Généré le')}: ${generatedAt}`,
    ]);

    const transportExpenses = expenses.filter(expense => {
      const expDate = new Date(expense.date);
      const type = (expense.type || '').toLowerCase().trim();
      return inRange(expDate) && type === 'transport';
    });
  
    if (transportExpenses.length === 0) {
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(12);
      doc.text(tp('empty.noTransportExpenseToday', "Aucune dépense de transport pour aujourd'hui."), 14, 52);
      doc.save(`rapport_transport_${reportDate}.pdf`);
      return;
    }

    const sortedTransport = [...transportExpenses].sort((a, b) => {
      const ad = a?.date ? Date.parse(a.date) : 0;
      const bd = b?.date ? Date.parse(b.date) : 0;
      return ad - bd;
    });
    const paymentTotals = sortedTransport.reduce<Record<string, number>>((acc, exp) => {
      const key = String(exp.paymentMethod || 'inconnu');
      acc[key] = (acc[key] || 0) + (exp.amount || 0);
      return acc;
    }, {});
    const sourceTotals = sortedTransport.reduce<Record<string, number>>((acc, exp) => {
      const key = exp?.returnOrderId ? 'B.D' : 'Diverses';
      acc[key] = (acc[key] || 0) + (exp.amount || 0);
      return acc;
    }, {});
    const totalAmount = sortedTransport.reduce((sum, expense) => sum + (expense.amount || 0), 0);

    const tableColumn = ["#", tp('table.time', 'Heure'), tp('table.source', 'Source'), tp('table.note', 'Note'), tp('table.mode', 'Mode'), tp('table.amountDh', 'Montant (DH)')];
    const tableRows: any[] = [];
  
    sortedTransport.forEach((expense, idx) => {
      const timeStr = expense?.date ? new Date(expense.date).toLocaleTimeString(uiLocale, { hour: '2-digit', minute: '2-digit' }) : '';
      const source = expense?.returnOrderId ? 'B.D' : tp('labels.misc', 'Diverses');
      tableRows.push([
        String(idx + 1),
        timeStr,
        source,
        expense.note || '-',
        String(expense.paymentMethod || '-'),
        (expense.amount || 0).toFixed(2)
      ]);
    });
  
    const tableStartY = addPdfMetricCards(doc, [
      { label: tp('cards.transactions', 'Transaction'), value: String(sortedTransport.length), color: [59, 130, 246] },
      { label: tp('cards.totalTransport', 'Total transport'), value: `${totalAmount.toFixed(2)} DH`, color: [16, 185, 129] },
      { label: tp('cards.sources', 'Sources'), value: String(Object.keys(sourceTotals).length), color: [245, 158, 11] },
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      ...getPdfTableStyle(tableStartY, 9),
      columnStyles: {
        0: { cellWidth: 8, halign: 'right' },
        1: { cellWidth: 16 },
        2: { cellWidth: 18 },
        4: { cellWidth: 22 },
        5: { halign: 'right', cellWidth: 28, fontStyle: 'bold' },
      },
    });

    const finalY = (doc as any).lastAutoTable.finalY || 46;
    const summaryY = finalY + 10;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, summaryY, 182, 30, 2, 2, 'F');
    doc.setTextColor(30, 41, 59);
    setPdfFont(doc, 'bold');
    doc.setFontSize(10);
    doc.text(`${tp('labels.totalTransport', 'Total transport')}: ${totalAmount.toFixed(2)} DH`, 20, summaryY + 8);
    setPdfFont(doc, 'normal');
    const sourceSummary = Object.entries(sourceTotals)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k}: ${v.toFixed(2)} DH`)
      .join(' | ');
    doc.text(sourceSummary, 20, summaryY + 15, { maxWidth: 170 });
    const paymentSummary = Object.entries(paymentTotals)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k}: ${v.toFixed(2)} DH`)
      .join(' | ');
    doc.text(paymentSummary, 20, summaryY + 22, { maxWidth: 170 });
  
    addPdfPageNumbers(doc);
  
    doc.save(`rapport_transport_${reportDate}.pdf`);
  };

  const generateGeneralReport = async () => {
    const reportDate = periodLabel;
    const doc = await createPdfDoc();
    const generatedAt = new Date().toLocaleString(uiLocale);
    addPdfHeader(doc, tp('headers.generalDaily', 'Rapport Général Journalier'), [
      `${tp('labels.period', 'Période')}: ${reportDate}`,
      `${tp('labels.generatedAt', 'Généré le')}: ${generatedAt}`,
    ]);

    const dailyMiscExpenses = expenses.filter(expense => {
      const d = new Date(expense.date);
      return inRange(d) && !expense.returnOrderId;
    });
    const totalMisc = dailyMiscExpenses.reduce((sum, exp) => sum + exp.amount, 0);

    const transportExpenses = expenses.filter(expense => {
      const expDate = new Date(expense.date);
      const type = (expense.type || '').toLowerCase().trim();
      return inRange(expDate) && type === 'transport';
    });
    const totalTransport = transportExpenses.reduce((sum, exp) => sum + exp.amount, 0);

    const totalDebt = drivers.reduce((sum, driver) => sum + (driver.debt || 0), 0);

    const dailyNotesExpenses = expenses.filter(expense => 
      expense.date.slice(0, 10) === reportDate && expense.type === 'note de frais'
    );
    const totalNotes = dailyNotesExpenses.reduce((sum, exp) => sum + exp.amount, 0);

    let totalMygaz = 0;
    const processedOrderIds = new Set<string>();
    drivers.forEach((driver) => {
      const driverReturnOrders = (returnOrders || []).filter((o: any) => {
        if (!o || !o.date) return false;
        const d = new Date(o.date);
        return o.driverId === driver.id && inRange(d);
      });

      driverReturnOrders.forEach((order: any) => {
        if (processedOrderIds.has(order.id)) return;
        processedOrderIds.add(order.id);

        const relatedRevenues = (revenues || []).filter((r: Revenue) => {
          if (r.relatedOrderId !== order.id || r.relatedOrderType !== 'return') return false;
          const rD = new Date(r.date);
          return inRange(rD);
        });
        
        if (relatedRevenues.length > 0) {
          const latestRevenue = [...relatedRevenues].sort(
            (a: Revenue, b: Revenue) => new Date(a.date).getTime() - new Date(b.date).getTime()
          )[relatedRevenues.length - 1];
          totalMygaz += (latestRevenue?.mygazAmount || 0);
        } else {
          totalMygaz += (order.paymentMygaz || 0);
        }
      });
    });

    const grandTotal = totalMisc + totalTransport + totalDebt + totalNotes + totalMygaz;

    const tableColumn = [tp('table.designation', 'Désignation'), tp('table.amountMad', 'Montant (MAD)')];
    const tableRows = [
      [tp('rows.miscExpenses', 'Dépenses Diverses'), totalMisc.toFixed(2)],
      [tp('rows.transport', 'Transport'), totalTransport.toFixed(2)],
      [tp('rows.driverDebts', 'Dettes Chauffeurs'), totalDebt.toFixed(2)],
      [tp('rows.dailyExpenses', 'Notes de Frais'), totalNotes.toFixed(2)],
      [tp('rows.mygazPayments', 'Paiements MYGAZ'), totalMygaz.toFixed(2)],
      [{ content: tp('labels.totalUpper', 'TOTAL'), styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }, 
       { content: grandTotal.toFixed(2), styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }]
    ];

    const tableStartY = addPdfMetricCards(doc, [
      { label: tp('cards.sections', 'Sections'), value: '5', color: [59, 130, 246] },
      { label: tp('cards.totalGlobal', 'Total global'), value: `${grandTotal.toFixed(2)} MAD`, color: [16, 185, 129] },
      { label: tp('cards.transactions', 'Transaction'), value: String(processedOrderIds.size), color: [245, 158, 11] },
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      ...getPdfTableStyle(tableStartY, 10),
      columnStyles: {
        1: { halign: 'right' }
      },
      styles: { fontSize: 10, cellPadding: 5 }
    });

    addPdfPageNumbers(doc);
    doc.save(`rapport_general_${reportDate}.pdf`);
  };

  const generateDiversesReport = async () => {
    const selectedDate = periodLabel;
    const doc = await createPdfDoc();
    const generatedAt = new Date().toLocaleString(uiLocale);
    addPdfHeader(doc, tp('headers.miscSales', 'Rapport Ventes Diverses'), [
      `${tp('labels.period', 'Période')}: ${selectedDate}`,
      `${tp('labels.generatedAt', 'Généré le')}: ${generatedAt}`,
    ]);

    const CONSIGNE_FEES: Record<string, number> = {
      'Butane 12KG': 50,
      'Butane 6KG': 40,
      'Butane 3KG': 30,
    };

    const tableColumn = [tp('table.driver', 'Chauffeur'), tp('table.orderNumber', 'N° Bon'), tp('table.product', 'Produit'), tp('table.depositQty', 'Quantité Consigne'), tp('table.unitPrice', 'Prix Unitaire'), tp('table.totalMad', 'Total (MAD)')];
    const tableRows: any[] = [];
    let totalConsigneAmount = 0;

    const driversToReport =
      dailyReportDriver === 'all' ? drivers : drivers.filter((d) => d.id === dailyReportDriver);

    driversToReport.forEach((driver) => {
      const driverReturnOrders = (returnOrders || []).filter((o: any) => {
        const d = new Date(o.date || '');
        return o.driverId === driver.id && inRange(d);
      });

      driverReturnOrders.forEach((order: any) => {
        (order.items || []).forEach((item: any) => {
          if ((item.consigneQuantity || 0) > 0) {
            const unitPrice = item.consignePrice || CONSIGNE_FEES[item.bottleTypeName] || 0;
            const total = item.consigneQuantity * unitPrice;
            tableRows.push([
              driver.name,
              order.orderNumber,
              item.bottleTypeName,
              item.consigneQuantity,
              unitPrice.toFixed(2),
              total.toFixed(2)
            ]);
            totalConsigneAmount += total;
          }
        });
      });
    });

    if (tableRows.length > 0) {
      tableRows.push([
        { content: tp('labels.totalDeposit', 'TOTAL CONSIGNE (DÉPÔT)'), colSpan: 5, styles: { fontStyle: 'bold', halign: 'right', fillColor: [240, 240, 240] } },
        { content: totalConsigneAmount.toFixed(2), styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }
      ]);

      const tableStartY = addPdfMetricCards(doc, [
        { label: tp('cards.transactions', 'Transaction'), value: String(tableRows.length - 1), color: [59, 130, 246] },
        { label: tp('cards.totalDeposit', 'Total consigne'), value: `${totalConsigneAmount.toFixed(2)} MAD`, color: [16, 185, 129] },
        { label: tp('cards.drivers', 'Chauffeurs'), value: String(driversToReport.length), color: [245, 158, 11] },
      ]);

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        ...getPdfTableStyle(tableStartY, 8),
        columnStyles: {
          5: { halign: 'right' }
        }
      });
    } else {
      doc.text(tp('empty.noDepositSales', 'Aucune vente de consigne trouvée pour cette sélection.'), 14, 40);
    }

    addPdfPageNumbers(doc);
    doc.save(`rapport_diverses_${(dailyStartDate || '').replaceAll('-','')}_${(dailyEndDate || dailyStartDate || '').replaceAll('-','')}.pdf`);
  };

  const generateRepairsReport = async () => {
    const selectedDate = periodLabel;
    const doc = await createPdfDoc();
    const generatedAt = new Date().toLocaleString(uiLocale);
    addPdfHeader(doc, tp('headers.repairs', 'Rapport des Réparations'), [
      `${tp('labels.period', 'Période')}: ${selectedDate}`,
      `${tp('labels.generatedAt', 'Généré le')}: ${generatedAt}`,
    ]);

    const tableColumn = [tp('table.vehicle', 'Véhicule'), tp('table.type', 'Type'), tp('table.totalCost', 'Coût Total'), tp('table.paid', 'Payé'), tp('table.debt', 'Dette'), tp('table.noteShort', 'Remarque')];
    const tableRows: any[] = [];
    
    let totalCostSum = 0;
    let totalPaidSum = 0;
    let totalDebtSum = 0;

    const dailyRepairs = (repairs || []).filter(r => inRange(new Date(r.date)));

    dailyRepairs.forEach(repair => {
      const truck = trucks.find(t => t.id === repair.truckId);
      const typeLabel = repair.type === 'mecanique' ? tp('repairType.mechanical', 'Mécanique') : repair.type === 'electrique' ? tp('repairType.electrical', 'Électrique') : tp('repairType.garage', 'Garage');
      
      tableRows.push([
        truck?.matricule || 'N/A',
        typeLabel,
        repair.totalCost.toFixed(2),
        repair.paidAmount.toFixed(2),
        repair.debtAmount.toFixed(2),
        repair.remarks
      ]);

      totalCostSum += repair.totalCost;
      totalPaidSum += repair.paidAmount;
      totalDebtSum += repair.debtAmount;
    });

    if (tableRows.length > 0) {
      tableRows.push([
        { content: tp('labels.totalUpper', 'TOTAL'), colSpan: 2, styles: { fontStyle: 'bold', halign: 'right', fillColor: [240, 240, 240] } },
        { content: totalCostSum.toFixed(2), styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } },
        { content: totalPaidSum.toFixed(2), styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } },
        { content: totalDebtSum.toFixed(2), styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } },
        ''
      ]);

      const tableStartY = addPdfMetricCards(doc, [
        { label: tp('cards.transactions', 'Transaction'), value: String(dailyRepairs.length), color: [59, 130, 246] },
        { label: tp('cards.totalCost', 'Coût total'), value: `${totalCostSum.toFixed(2)} DH`, color: [16, 185, 129] },
        { label: tp('table.debt', 'Dette'), value: `${totalDebtSum.toFixed(2)} DH`, color: [245, 158, 11] },
      ]);

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        ...getPdfTableStyle(tableStartY, 8),
      });
    } else {
      doc.text(tp('empty.noRepairForDate', 'Aucune réparation trouvée pour cette date.'), 14, 40);
    }

    addPdfPageNumbers(doc);
    doc.save(`rapport_reparations_${(dailyStartDate || '').replaceAll('-','')}_${(dailyEndDate || dailyStartDate || '').replaceAll('-','')}.pdf`);
  };

  const truckHealthAnalysis = trucks.map(truck => {
    const truckRepairs = (repairs || []).filter(r => r.truckId === truck.id);
    const totalRepairCost = truckRepairs.reduce((sum, r) => sum + r.totalCost, 0);
    const repairCount = truckRepairs.length;
    
    // Simple logic for health score (0-100)
    // Factors: repair frequency and cost
    let score = 100;
    if (repairCount > 5) score -= 20;
    if (repairCount > 10) score -= 30;
    if (totalRepairCost > 10000) score -= 20;
    if (totalRepairCost > 25000) score -= 30;
    
    score = Math.max(0, score);
    
    let status = tp('health.good', 'Bonne');
    let color = 'text-green-600';
    let recommendation = tp('health.keepMaintenance', "Continuer l'entretien régulier");
    
    if (score < 70) {
      status = tp('health.average', 'Moyenne');
      color = 'text-yellow-600';
      recommendation = tp('health.watchRepairs', 'Surveiller les prochaines réparations');
    }
    if (score < 40) {
      status = tp('health.critical', 'Critique');
      color = 'text-red-600';
      recommendation = tp('health.considerReplace', 'Envisager la vente ou le remplacement');
    }

    return {
      ...truck,
      totalRepairCost,
      repairCount,
      score,
      status,
      color,
      recommendation
    };
  }).sort((a, b) => a.score - b.score);

  const generateFleetHealthReport = async () => {
    const doc = await createPdfDoc();
    doc.setFontSize(16);
    doc.text(tp('headers.fleetHealth', 'Analyse de Santé du Parc Automobile'), 14, 16);
    doc.setFontSize(10);
    doc.text(`${tp('labels.generatedDate', 'Date de génération')}: ${new Date().toLocaleDateString()}`, 14, 22);

    const tableColumn = [tp('table.plate', 'Matricule'), tp('table.repairs', 'Réparations'), tp('table.totalCost', 'Coût Total'), tp('table.score', 'Score'), tp('table.state', 'État'), tp('table.recommendation', 'Recommandation')];
    const tableRows = truckHealthAnalysis.map(t => [
      t.matricule,
      t.repairCount,
      `${t.totalRepairCost.toFixed(2)} MAD`,
      `${t.score}/100`,
      t.status,
      t.recommendation
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 30,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185] },
      styles: { fontSize: 8 },
    });

    doc.save(`analyse_sante_flotte_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const pdfHeaderColor = [79, 70, 229] as const;
  const pdfTextColor = [30, 41, 59] as const;
  const pdfMutedTextColor = [148, 163, 184] as const;

  const sanitizePdfText = (value: string) =>
    isArabicPdf
      ? String(value || '')
      : String(value || '')
          .replaceAll('→', ' - ')
          .replaceAll('•', ' - ')
          .replaceAll('…', '...')
          .replaceAll('’', "'");

  const addPdfHeader = (
    doc: jsPDF,
    title: string,
    lines: string[],
    fillColor: readonly [number, number, number] = pdfHeaderColor
  ) => {
    const pageWidth = (doc as any).internal.pageSize.getWidth();
    const x = isArabicPdf ? pageWidth - 14 : 14;
    const align = isArabicPdf ? 'right' : 'left';
    doc.setFillColor(fillColor[0], fillColor[1], fillColor[2]);
    doc.rect(0, 0, pageWidth, 38, 'F');
    doc.setTextColor(255, 255, 255);
    setPdfFont(doc, 'bold');
    doc.setFontSize(18);
    doc.text(sanitizePdfText(title), x, 22, { align });

    setPdfFont(doc, 'normal');
    doc.setFontSize(10);
    const baseY = 30;
    lines.slice(0, 2).forEach((line, idx) => {
      const labelPrefix = idx === 0 ? '[TIME] ' : '[TX] ';
      doc.text(`${labelPrefix}${sanitizePdfText(line)}`, x, baseY + idx * 5, { align });
    });
    doc.setTextColor(pdfTextColor[0], pdfTextColor[1], pdfTextColor[2]);
  };

  const addPdfMetricCards = (
    doc: jsPDF,
    cards: Array<{ label: string; value: string; color: readonly [number, number, number] }>,
    startY = 42
  ) => {
    if (cards.length === 0) return startY;
    const pageWidth = (doc as any).internal.pageSize.getWidth();
    const marginX = 14;
    const gap = 4;
    const cardsToRender = cards.slice(0, 3);
    const cardWidth = (pageWidth - marginX * 2 - gap * (cardsToRender.length - 1)) / cardsToRender.length;
    cardsToRender.forEach((card, index) => {
      const x = marginX + index * (cardWidth + gap);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(x, startY, cardWidth, 15, 2, 2, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(x, startY, cardWidth, 15, 2, 2, 'S');
      doc.setFillColor(card.color[0], card.color[1], card.color[2]);
      doc.roundedRect(x + 1, startY + 1, 3, 13, 1, 1, 'F');
      doc.setTextColor(100, 116, 139);
      setPdfFont(doc, 'normal');
      doc.setFontSize(8);
      doc.text(sanitizePdfText(card.label), x + 6, startY + 6);
      doc.setTextColor(pdfTextColor[0], pdfTextColor[1], pdfTextColor[2]);
      setPdfFont(doc, 'bold');
      doc.setFontSize(10);
      doc.text(sanitizePdfText(card.value), x + 6, startY + 12);
    });
    return startY + 20;
  };

  const getPdfTableStyle = (startY: number, fontSize = 8, columnStyles: Record<number, any> = {}) => ({
    startY,
    theme: 'grid' as const,
    headStyles: { fillColor: pdfHeaderColor as any, textColor: [255, 255, 255], fontStyle: 'bold' as const },
    styles: { fontSize, cellPadding: 2, textColor: [15, 23, 42] as any, lineColor: [226, 232, 240] as any, lineWidth: 0.2 as any, font: isArabicPdf ? arabicPdfFontName : 'helvetica', halign: isArabicPdf ? 'right' : 'left' },
    alternateRowStyles: { fillColor: [248, 250, 252] as any },
    columnStyles,
  });

  const addPdfPageNumbers = (doc: jsPDF) => {
    const pageCount = (doc as any).internal.getNumberOfPages();
    const pageWidth = (doc as any).internal.pageSize.getWidth();
    const pageHeight = (doc as any).internal.pageSize.getHeight();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(9);
      doc.setTextColor(pdfMutedTextColor[0], pdfMutedTextColor[1], pdfMutedTextColor[2]);
      doc.text(`${tp('labels.page', 'Page')} ${i} / ${pageCount}`, pageWidth - 14, pageHeight - 10, { align: 'right' });
    }
    doc.setTextColor(pdfTextColor[0], pdfTextColor[1], pdfTextColor[2]);
  };

  const generateCombinedDriversReport = async () => {
    const doc = await createPdfDoc({ orientation: 'landscape' });
    const selectedDate = periodLabel;
    const driverName =
      dailyReportDriver === 'all'
        ? t('reports.filters.all', 'Tous')
        : drivers.find((d) => d.id === dailyReportDriver)?.name || t('reports.daily.unknown', 'Inconnu');

    const generatedAt = new Date().toLocaleString(uiLocale);
    addPdfHeader(doc, tp('headers.dailyDrivers', 'Rapport Journalier des Chauffeurs'), [
      `${tp('labels.period', 'Période')}: ${selectedDate}`,
      `${tp('table.driver', 'Chauffeur')}: ${driverName} | ${tp('labels.generatedAt', 'Généré le')}: ${generatedAt}`,
    ]);

    const mapBottleKey = (name?: string) => {
      const n = (name || '').toLowerCase().replace(/\s+/g, '');
      if (n.includes('bng')) return 'bng';
      if (/(^|[^0-9])3kg($|[^0-9])/.test(n) || /3\s*kg/.test((name || '').toLowerCase())) return '3kg';
      if (/(^|[^0-9])6kg($|[^0-9])/.test(n) || /6\s*kg/.test((name || '').toLowerCase())) return '6kg';
      if (/(^|[^0-9])12kg($|[^0-9])/.test(n) || /12\s*kg/.test((name || '').toLowerCase())) return '12kg';
      if (/(^|[^0-9])34kg($|[^0-9])/.test(n) || /34\s*kg/.test((name || '').toLowerCase())) return '34kg';
      return '';
    };

    const tableColumn = [tp('table.driver', 'Chauffeur'), tp('table.type', 'Type'), '3kg', '6kg', '12kg', '34kg', 'BNG', tp('table.totalUnits', 'Total unités'), tp('table.chequeDh', 'Chèque (DH)'), tp('table.cashDh', 'Espèce (DH)')];
    const rowsForTable: {
      driverName: string;
      typeLabel: string;
      q3: number;
      q6: number;
      q12: number;
      q34: number;
      bng: number;
      totalUnits: number;
      cheque: number;
      espece: number;
      totalAmount: number;
    }[] = [];

    const driversToReport =
      dailyReportDriver === 'all' ? drivers : drivers.filter((d) => d.id === dailyReportDriver);

    driversToReport.forEach((driver) => {
      // Bons d'entrée (B.D) ضمن الفترة
      const driverReturnOrders = (returnOrders || []).filter((o: any) => {
        if (!o || !o.date) return false;
        const d = new Date(o.date);
        return o.driverId === driver.id && inRange(d);
      });

      const driverRevenues = (revenues || []).filter((r: any) => {
        const rD = new Date(r.date || '');
        if (!inRange(rD)) return false;
        if (r.relatedOrderType !== 'return' || !r.relatedOrderId) return false;
        const ro = (returnOrders || []).find((o: any) => o.id === r.relatedOrderId);
        return ro?.driverId === driver.id;
      });

      const quantities = { '3kg': 0, '6kg': 0, '12kg': 0, '34kg': 0, 'bng': 0 };

      driverReturnOrders.forEach((o: any) => {
        (o.items || []).forEach((item: any) => {
          const bt = bottleTypes.find((b) => b.id === item.bottleTypeId);
          const name = bt?.name || item.bottleTypeName || '';
          const key = mapBottleKey(name);
          const sold = (item.returnedEmptyQuantity || 0) + (item.consigneQuantity || 0);
          
          if (key && key in quantities) {
            quantities[key as keyof typeof quantities] += sold;
          }
        });
      });

      let cheque = 0;
      let espece = 0;

      if (driverRevenues.length > 0) {
        cheque = driverRevenues.reduce((sum: number, r: any) => sum + (r.checkAmount || r.totalCheque || 0), 0);
        espece = driverRevenues.reduce((sum: number, r: any) => sum + (r.cashAmount || r.totalCash || 0), 0);
      } else {
        cheque = driverReturnOrders.reduce((sum: number, o: any) => sum + (o.paymentCheque || 0), 0);
        espece = driverReturnOrders.reduce((sum: number, o: any) => sum + (o.paymentCash || 0), 0);
      }

      // 2. Identify if this is a "Camion" or "Petit Camion" row
      const isCamion = trucks.some(t => t.driverId === driver.id && t.truckType === 'camion');
      const typeLabel = isCamion ? t('reports.filters.truck', 'Camion') : t('nav.petitCamion', 'Allogaz');
      const totalUnits = quantities['3kg'] + quantities['6kg'] + quantities['12kg'] + quantities['34kg'] + quantities['bng'];
      const totalAmount = cheque + espece;

      // Add row if data exists
      if (driverReturnOrders.length > 0 || totalAmount > 0 || totalUnits > 0) {
        rowsForTable.push({
          driverName: driver.name,
          typeLabel,
          q3: quantities['3kg'],
          q6: quantities['6kg'],
          q12: quantities['12kg'],
          q34: quantities['34kg'],
          bng: quantities['bng'],
          totalUnits,
          cheque,
          espece,
          totalAmount,
        });
      }
    });

    if (rowsForTable.length > 0) {
      const totals = rowsForTable.reduce(
        (acc, r) => {
          acc.sum3kg += r.q3;
          acc.sum6kg += r.q6;
          acc.sum12kg += r.q12;
          acc.sum34kg += r.q34;
          acc.sumBNG += r.bng;
          acc.sumUnits += r.totalUnits;
          acc.sumCheque += r.cheque;
          acc.sumEspece += r.espece;
          acc.sumAmount += r.totalAmount;
          return acc;
        },
        { sum3kg: 0, sum6kg: 0, sum12kg: 0, sum34kg: 0, sumBNG: 0, sumUnits: 0, sumCheque: 0, sumEspece: 0, sumAmount: 0 }
      );

      const sorted = [...rowsForTable].sort((a, b) => {
        if (b.totalUnits !== a.totalUnits) return b.totalUnits - a.totalUnits;
        return b.totalAmount - a.totalAmount;
      });

      const tableRows: any[] = sorted.map((r) => {
        return [
          r.driverName,
          r.typeLabel,
          r.q3,
          r.q6,
          r.q12,
          r.q34,
          r.bng,
          r.totalUnits,
          r.cheque.toFixed(2),
          r.espece.toFixed(2),
        ];
      });

      tableRows.push([
        tp('labels.totalUpper', 'TOTAL'),
        '',
        totals.sum3kg,
        totals.sum6kg,
        totals.sum12kg,
        totals.sum34kg,
        totals.sumBNG,
        totals.sumUnits,
        totals.sumCheque.toFixed(2),
        totals.sumEspece.toFixed(2),
      ]);

      const tableStartY = addPdfMetricCards(doc, [
        { label: tp('cards.transactions', 'Transaction'), value: String(sorted.length), color: [59, 130, 246] },
        { label: tp('cards.units', 'Unités'), value: String(totals.sumUnits), color: [16, 185, 129] },
        { label: tp('cards.collection', 'Encaissement'), value: `${(totals.sumCheque + totals.sumEspece).toFixed(2)} DH`, color: [245, 158, 11] },
      ]);

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        ...getPdfTableStyle(tableStartY, 8),
        columnStyles: {
          2: { halign: 'right' },
          3: { halign: 'right' },
          4: { halign: 'right' },
          5: { halign: 'right' },
          6: { halign: 'right' },
          7: { halign: 'right', fontStyle: 'bold' },
          8: { halign: 'right' },
          9: { halign: 'right' },
        },
      });
      addPdfPageNumbers(doc);
    } else {
      doc.setFontSize(12);
      doc.text(tp('empty.noDataForSelection', 'Aucune donnée pour cette sélection.'), 14, 52);
    }

    doc.save(`rapport_journalier_chauffeurs_${(dailyStartDate || '').replaceAll('-','')}_${(dailyEndDate || dailyStartDate || '').replaceAll('-','')}.pdf`);
  };

  const generateDailyPetitCamionReport = async () => {
    const doc = await createPdfDoc({ orientation: 'landscape' });
    const selectedDate = periodLabel;
    const driverName =
      dailyReportDriver === 'all'
        ? t('reports.filters.all', 'Tous')
        : drivers.find((d) => d.id === dailyReportDriver)?.name || t('reports.daily.unknown', 'Inconnu');
    const generatedAt = new Date().toLocaleString(uiLocale);
    addPdfHeader(doc, tp('headers.dailyAllogazBd', "Rapport Journalier Allogaz - Bons d'Entrée (B.D)"), [
      `${tp('labels.period', 'Période')}: ${selectedDate}`,
      `${tp('table.driver', 'Chauffeur')}: ${driverName} | ${tp('labels.generatedAt', 'Généré le')}: ${generatedAt}`,
    ]);
  
    const tableColumn = [tp('table.driver', 'Chauffeur'), '3kg', '6kg', '12kg', '34kg', 'BNG', tp('table.totalUnits', 'Total unités'), tp('table.chequeDh', 'Chèque (DH)'), tp('table.cashDh', 'Espèce (DH)')];
    const rowsForTable: {
      driverName: string;
      q3: number;
      q6: number;
      q12: number;
      q34: number;
      bng: number;
      totalUnits: number;
      cheque: number;
      espece: number;
      totalAmount: number;
    }[] = [];
  
    const driversToReport =
      dailyReportDriver === 'all' ? drivers : drivers.filter((d) => d.id === dailyReportDriver);
  
    const mapBottleKey = (name: string) => {
      const n = (name || '').toLowerCase().replace(/\s+/g, '');
      if (n.includes('bng')) return 'bng';
      if (/(^|[^0-9])3kg($|[^0-9])/.test(n) || /3\s*kg/.test(name.toLowerCase())) return '3kg';
      if (/(^|[^0-9])6kg($|[^0-9])/.test(n) || /6\s*kg/.test(name.toLowerCase())) return '6kg';
      if (/(^|[^0-9])12kg($|[^0-9])/.test(n) || /12\s*kg/.test(name.toLowerCase())) return '12kg';
      if (/(^|[^0-9])34kg($|[^0-9])/.test(n) || /34\s*kg/.test(name.toLowerCase())) return '34kg';
      return '';
    };
  
    driversToReport.forEach((driver) => {
      const driverReturnOrders = (returnOrders || []).filter((o: any) => {
        if (!o || !o.date) return false;
        const d = new Date(o.date);
        return o.driverId === driver.id && inRange(d);
      });
  
      const driverRevenues = (revenues || []).filter((r: any) => {
        const rD = new Date(r.date || '');
        if (!inRange(rD)) return false;
        if (r.relatedOrderType !== 'return' || !r.relatedOrderId) return false;
        const ro = (returnOrders || []).find((o: any) => o.id === r.relatedOrderId);
        return ro?.driverId === driver.id;
      });
  
      const quantities = { '3kg': 0, '6kg': 0, '12kg': 0, '34kg': 0, 'bng': 0 };
  
      driverReturnOrders.forEach((o: any) => {
        (o.items || []).forEach((item: any) => {
          const bt = bottleTypes.find((b) => b.id === item.bottleTypeId);
          if (!bt) return;
          const key = mapBottleKey(bt.name);
          const sold = (item.returnedEmptyQuantity || 0) + (item.consigneQuantity || 0);
          if (key && key in quantities) {
            quantities[key as keyof typeof quantities] += sold;
          }
        });
      });
  
      let cheque = 0;
      let espece = 0;
  
      if (driverRevenues.length > 0) {
        cheque = driverRevenues.reduce((sum: number, r: any) => sum + (r.checkAmount || r.totalCheque || 0), 0);
        espece = driverRevenues.reduce((sum: number, r: any) => sum + (r.cashAmount || r.totalCash || 0), 0);
      } else {
        cheque = driverReturnOrders.reduce((sum: number, o: any) => sum + (o.paymentCheque || 0), 0);
        espece = driverReturnOrders.reduce((sum: number, o: any) => sum + (o.paymentCash || 0), 0);
      }
      const totalUnits = quantities['3kg'] + quantities['6kg'] + quantities['12kg'] + quantities['34kg'] + quantities['bng'];
      const totalAmount = cheque + espece;
  
      if (driverReturnOrders.length > 0 || totalAmount > 0 || totalUnits > 0) {
        rowsForTable.push({
          driverName: driver.name,
          q3: quantities['3kg'],
          q6: quantities['6kg'],
          q12: quantities['12kg'],
          q34: quantities['34kg'],
          bng: quantities['bng'],
          totalUnits,
          cheque,
          espece,
          totalAmount,
        });
      }
    });
    if (rowsForTable.length === 0) {
      doc.setFontSize(12);
      doc.text(tp('empty.noDataForSelection', 'Aucune donnée pour cette sélection.'), 14, 52);
      doc.save(`rapport_petit_camion_${selectedDate}.pdf`);
      return;
    }

    const totals = rowsForTable.reduce(
      (acc, r) => {
        acc.sum3kg += r.q3;
        acc.sum6kg += r.q6;
        acc.sum12kg += r.q12;
        acc.sum34kg += r.q34;
        acc.sumBNG += r.bng;
        acc.sumUnits += r.totalUnits;
        acc.sumCheque += r.cheque;
        acc.sumEspece += r.espece;
        acc.sumAmount += r.totalAmount;
        return acc;
      },
      { sum3kg: 0, sum6kg: 0, sum12kg: 0, sum34kg: 0, sumBNG: 0, sumUnits: 0, sumCheque: 0, sumEspece: 0, sumAmount: 0 }
    );

    const sorted = [...rowsForTable].sort((a, b) => {
      if (b.totalUnits !== a.totalUnits) return b.totalUnits - a.totalUnits;
      return b.totalAmount - a.totalAmount;
    });

    const tableRows: any[] = sorted.map((r) => {
      return [
        r.driverName,
        r.q3,
        r.q6,
        r.q12,
        r.q34,
        r.bng,
        r.totalUnits,
        r.cheque.toFixed(2),
        r.espece.toFixed(2),
      ];
    });

    tableRows.push([
      tp('labels.totalUpper', 'TOTAL'),
      totals.sum3kg,
      totals.sum6kg,
      totals.sum12kg,
      totals.sum34kg,
      totals.sumBNG,
      totals.sumUnits,
      totals.sumCheque.toFixed(2),
      totals.sumEspece.toFixed(2),
    ]);

    const tableStartY = addPdfMetricCards(doc, [
      { label: tp('cards.transactions', 'Transaction'), value: String(sorted.length), color: [59, 130, 246] },
      { label: tp('cards.units', 'Unités'), value: String(totals.sumUnits), color: [16, 185, 129] },
      { label: tp('cards.collection', 'Encaissement'), value: `${(totals.sumCheque + totals.sumEspece).toFixed(2)} DH`, color: [245, 158, 11] },
    ]);
    
    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      ...getPdfTableStyle(tableStartY, 8),
      columnStyles: {
        1: { halign: 'right' },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right' },
        6: { halign: 'right', fontStyle: 'bold' },
        7: { halign: 'right' },
        8: { halign: 'right' },
      },
    });
    addPdfPageNumbers(doc);

    doc.save(`rapport_petit_camion_${(dailyStartDate || '').replaceAll('-','')}_${(dailyEndDate || dailyStartDate || '').replaceAll('-','')}.pdf`);
  };

  const generateTotalVenteReport = async () => {
    const doc = await createPdfDoc({ orientation: 'landscape' });
    const selectedDate = periodLabel;
    const driverName =
      dailyReportDriver === 'all'
        ? t('reports.filters.all', 'Tous')
        : drivers.find((d) => d.id === dailyReportDriver)?.name || t('reports.daily.unknown', 'Inconnu');

    const generatedAt = new Date().toLocaleString(uiLocale);
    addPdfHeader(doc, tp('headers.totalSalesBd', 'Rapport Total Vente (B.D)'), [
      `${tp('labels.period', 'Période')}: ${selectedDate}`,
      `${tp('table.driver', 'Chauffeur')}: ${driverName} | ${tp('labels.generatedAt', 'Généré le')}: ${generatedAt}`,
    ]);

    const mapBottleKey = (name?: string) => {
      const n = (name || '').toLowerCase().replace(/\s+/g, '');
      if (n.includes('bng')) return 'bng';
      if (/(^|[^0-9])3kg($|[^0-9])/.test(n) || /3\s*kg/.test((name || '').toLowerCase())) return '3kg';
      if (/(^|[^0-9])6kg($|[^0-9])/.test(n) || /6\s*kg/.test((name || '').toLowerCase())) return '6kg';
      if (/(^|[^0-9])12kg($|[^0-9])/.test(n) || /12\s*kg/.test((name || '').toLowerCase())) return '12kg';
      if (/(^|[^0-9])34kg($|[^0-9])/.test(n) || /34\s*kg/.test((name || '').toLowerCase())) return '34kg';
      return '';
    };

    const tableColumn = [tp('table.driver', 'Chauffeur'), tp('table.type', 'Type'), '3kg', '6kg', '12kg', '34kg', 'BNG', tp('table.soldBottlesBd', 'Bouteilles vendues (B.D)'), tp('table.chequeDh', 'Chèque (DH)'), tp('table.cashDh', 'Espèce (DH)'), tp('table.totalSalesDh', 'Total vente (DH)')];
    const rowsForTable: {
      driverName: string;
      typeLabel: string;
      q3: number;
      q6: number;
      q12: number;
      q34: number;
      bng: number;
      totalUnits: number;
      cheque: number;
      espece: number;
      totalAmount: number;
    }[] = [];

    const driversToReport =
      dailyReportDriver === 'all' ? drivers : drivers.filter((d) => d.id === dailyReportDriver);

    driversToReport.forEach((driver) => {
      const driverReturnOrders = (returnOrders || []).filter((o: any) => {
        if (!o || !o.date) return false;
        const d = new Date(o.date);
        return o.driverId === driver.id && inRange(d);
      });

      const driverRevenues = (revenues || []).filter((r: any) => {
        const rD = new Date(r.date || '');
        if (!inRange(rD)) return false;
        if (r.relatedOrderType !== 'return' || !r.relatedOrderId) return false;
        const ro = (returnOrders || []).find((o: any) => o.id === r.relatedOrderId);
        return ro?.driverId === driver.id;
      });

      const quantities = { '3kg': 0, '6kg': 0, '12kg': 0, '34kg': 0, 'bng': 0 };

      driverReturnOrders.forEach((o: any) => {
        (o.items || []).forEach((item: any) => {
          const bt = bottleTypes.find((b) => b.id === item.bottleTypeId);
          const name = bt?.name || item.bottleTypeName || '';
          const key = mapBottleKey(name);
          const sold = (item.returnedEmptyQuantity || 0) + (item.consigneQuantity || 0);
          if (key && key in quantities) {
            quantities[key as keyof typeof quantities] += sold;
          }
        });
      });

      let cheque = 0;
      let espece = 0;

      if (driverRevenues.length > 0) {
        cheque = driverRevenues.reduce((sum: number, r: any) => sum + (r.checkAmount || r.totalCheque || 0), 0);
        espece = driverRevenues.reduce((sum: number, r: any) => sum + (r.cashAmount || r.totalCash || 0), 0);
      } else {
        cheque = driverReturnOrders.reduce((sum: number, o: any) => sum + (o.paymentCheque || 0), 0);
        espece = driverReturnOrders.reduce((sum: number, o: any) => sum + (o.paymentCash || 0), 0);
      }

      const isCamion = trucks.some(t => t.driverId === driver.id && t.truckType === 'camion');
      const typeLabel = isCamion ? t('reports.filters.truck', 'Camion') : t('nav.petitCamion', 'Allogaz');
      const totalUnits = quantities['3kg'] + quantities['6kg'] + quantities['12kg'] + quantities['34kg'] + quantities['bng'];
      const totalAmount = cheque + espece;

      if (driverReturnOrders.length > 0 || totalAmount > 0 || totalUnits > 0) {
        rowsForTable.push({
          driverName: driver.name,
          typeLabel,
          q3: quantities['3kg'],
          q6: quantities['6kg'],
          q12: quantities['12kg'],
          q34: quantities['34kg'],
          bng: quantities['bng'],
          totalUnits,
          cheque,
          espece,
          totalAmount,
        });
      }
    });

    if (rowsForTable.length > 0) {
      const totals = rowsForTable.reduce(
        (acc, r) => {
          acc.sum3kg += r.q3;
          acc.sum6kg += r.q6;
          acc.sum12kg += r.q12;
          acc.sum34kg += r.q34;
          acc.sumBNG += r.bng;
          acc.sumUnits += r.totalUnits;
          acc.sumCheque += r.cheque;
          acc.sumEspece += r.espece;
          acc.sumAmount += r.totalAmount;
          return acc;
        },
        { sum3kg: 0, sum6kg: 0, sum12kg: 0, sum34kg: 0, sumBNG: 0, sumUnits: 0, sumCheque: 0, sumEspece: 0, sumAmount: 0 }
      );

      const sorted = [...rowsForTable].sort((a, b) => {
        if (b.totalAmount !== a.totalAmount) return b.totalAmount - a.totalAmount;
        return b.totalUnits - a.totalUnits;
      });

      const tableRows: any[] = sorted.map((r) => {
        return [
          r.driverName,
          r.typeLabel,
          r.q3,
          r.q6,
          r.q12,
          r.q34,
          r.bng,
          r.totalUnits,
          r.cheque.toFixed(2),
          r.espece.toFixed(2),
          r.totalAmount.toFixed(2),
        ];
      });

      tableRows.push([
        tp('labels.totalUpper', 'TOTAL'),
        '',
        totals.sum3kg,
        totals.sum6kg,
        totals.sum12kg,
        totals.sum34kg,
        totals.sumBNG,
        totals.sumUnits,
        totals.sumCheque.toFixed(2),
        totals.sumEspece.toFixed(2),
        totals.sumAmount.toFixed(2),
      ]);

      const tableStartY = addPdfMetricCards(doc, [
        { label: tp('cards.transactions', 'Transaction'), value: String(sorted.length), color: [59, 130, 246] },
        { label: tp('cards.soldBottles', 'Bouteilles vendues'), value: String(totals.sumUnits), color: [16, 185, 129] },
        { label: tp('cards.totalSales', 'Total vente'), value: `${totals.sumAmount.toFixed(2)} DH`, color: [245, 158, 11] },
      ]);

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        ...getPdfTableStyle(tableStartY, 8),
        columnStyles: {
          2: { halign: 'right' },
          3: { halign: 'right' },
          4: { halign: 'right' },
          5: { halign: 'right' },
          6: { halign: 'right' },
          7: { halign: 'right', fontStyle: 'bold' },
          8: { halign: 'right' },
          9: { halign: 'right' },
          10: { halign: 'right', fontStyle: 'bold' },
        },
      });
      addPdfPageNumbers(doc);
    } else {
      doc.setFontSize(12);
      doc.text(tp('empty.noDataForSelection', 'Aucune donnée pour cette sélection.'), 14, 52);
    }

    doc.save(`rapport_total_vente_${(dailyStartDate || '').replaceAll('-','')}_${(dailyEndDate || dailyStartDate || '').replaceAll('-','')}.pdf`);
  };

  // 1. Analysis of Foreign Bottles by Driver
  const foreignBottlesAnalysis = drivers.map(driver => {
    const driverReturnOrders = (returnOrders || []).filter(o => o.driverId === driver.id);
    const foreignData = {
      total: 0,
      byType: {} as Record<string, number>,
      history: [] as { date: string, orderNumber: string, quantity: number, bottleType: string }[]
    };

    driverReturnOrders.forEach(order => {
      (order.items || []).forEach(item => {
        if ((item.foreignQuantity || 0) > 0) {
          foreignData.total += item.foreignQuantity;
          foreignData.byType[item.bottleTypeName] = (foreignData.byType[item.bottleTypeName] || 0) + item.foreignQuantity;
          foreignData.history.push({
            date: order.date,
            orderNumber: order.orderNumber,
            quantity: item.foreignQuantity,
            bottleType: item.bottleTypeName
          });
        }
      });
    });

    return {
      driverId: driver.id,
      driverName: driver.name,
      ...foreignData
    };
  }).filter(d => d.total > 0);

  // 2. Analysis of Remaining Bottles (R.C / Lost) by Driver
  const rcBottlesAnalysis = drivers.map(driver => {
    const driverReturnOrders = (returnOrders || []).filter(o => o.driverId === driver.id);
    const rcData = {
      total: 0,
      byType: {} as Record<string, number>,
      history: [] as { date: string, orderNumber: string, quantity: number, bottleType: string }[]
    };

    driverReturnOrders.forEach(order => {
      (order.items || []).forEach(item => {
        if ((item.lostQuantity || 0) > 0) {
          rcData.total += item.lostQuantity;
          rcData.byType[item.bottleTypeName] = (rcData.byType[item.bottleTypeName] || 0) + item.lostQuantity;
          rcData.history.push({
            date: order.date,
            orderNumber: order.orderNumber,
            quantity: item.lostQuantity,
            bottleType: item.bottleTypeName
          });
        }
      });
    });

    return {
      driverId: driver.id,
      driverName: driver.name,
      ...rcData
    };
  }).filter(d => d.total > 0);

  const generateForeignBottlesReport = async () => {
    const doc = await createPdfDoc();
    const generatedAt = new Date().toLocaleString(uiLocale);
    const filterLabel = analysisSearch.trim() ? analysisSearch.trim() : tp('labels.none', 'Aucun');
    const filtered = foreignBottlesAnalysis
      .filter(d => d.driverName.toLowerCase().includes(analysisSearch.toLowerCase()))
      .sort((a, b) => (b.total || 0) - (a.total || 0));

    addPdfHeader(doc, tp('headers.foreignByDriver', 'Rapport des Bouteilles Étrangères par Chauffeur'), [
      `${tp('labels.generatedAt', 'Généré le')}: ${generatedAt}`,
      `${tp('labels.driverFilter', 'Filtre chauffeur')}: ${filterLabel}`,
    ]);

    if (filtered.length === 0) {
      doc.setFontSize(12);
      doc.text(tp('empty.noForeignForSelection', 'Aucune bouteille étrangère détectée pour cette sélection.'), 14, 52);
      doc.save(`rapport_bouteilles_etrangeres_${new Date().toISOString().slice(0, 10)}.pdf`);
      return;
    }

    const totalForeign = filtered.reduce((sum, d) => sum + (d.total || 0), 0);
    const topDriver = filtered[0]?.driverName || '-';
    const topDriverTotal = filtered[0]?.total || 0;

    setPdfFont(doc, 'bold');
    doc.setFontSize(10);
    doc.text(`${tp('labels.totalForeign', 'Total étrangers')}: ${totalForeign}`, 14, 48);
    doc.text(`${tp('labels.impactedDrivers', 'Chauffeurs impactés')}: ${filtered.length}`, 80, 48);
    doc.text(`${tp('labels.top', 'Top')}: ${topDriver} (${topDriverTotal})`, 150, 48);
    setPdfFont(doc, 'normal');

    const overviewRows: any[] = filtered.map((d) => {
      const pct = totalForeign > 0 ? ((d.total || 0) / totalForeign) * 100 : 0;
      const typesStr = Object.entries(d.byType || {})
        .sort((a, b) => (b[1] || 0) - (a[1] || 0))
        .slice(0, 4)
        .map(([type, qty]) => `${qty} ${type}`)
        .join(' | ');
      return [
        d.driverName,
        d.total || 0,
        `${pct.toFixed(1)}%`,
        typesStr || '-',
      ];
    });

    autoTable(doc, {
      head: [[tp('table.driver', 'Chauffeur'), tp('labels.total', 'Total'), '%', tp('table.topTypes', 'Top types')]],
      body: overviewRows,
      startY: 54,
      theme: 'grid',
      headStyles: { fillColor: pdfHeaderColor as any, textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: {
        1: { halign: 'right', fontStyle: 'bold' },
        2: { halign: 'right' },
      },
    });

    const afterOverviewY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 8 : 120;

    const detailsRows: any[] = [];
    filtered.forEach((d) => {
      detailsRows.push([
        { content: `${d.driverName} — ${tp('labels.total', 'Total')}: ${d.total}`, colSpan: 3, styles: { fillColor: [248, 250, 252], textColor: pdfTextColor as any, fontStyle: 'bold' } },
      ]);
      const types = Object.entries(d.byType || {}).sort((a, b) => (b[1] || 0) - (a[1] || 0));
      types.forEach(([type, qty]) => {
        detailsRows.push([type, qty, '']);
      });
      if (types.length === 0) {
        detailsRows.push(['-', 0, '']);
      }
    });

    autoTable(doc, {
      head: [[tp('table.type', 'Type'), tp('table.qty', 'Qté'), '']],
      body: detailsRows,
      startY: afterOverviewY,
      theme: 'grid',
      headStyles: { fillColor: [241, 245, 249], textColor: pdfTextColor as any, fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
    });

    const history = filtered
      .flatMap((d) =>
        (d.history || []).map((h) => ({
          driverName: d.driverName,
          date: h.date,
          orderNumber: h.orderNumber,
          bottleType: h.bottleType,
          quantity: h.quantity,
        }))
      )
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (history.length > 0) {
      doc.addPage();
      addPdfHeader(doc, tp('headers.foreignHistory', 'Historique — Bouteilles Étrangères'), [
        `${tp('labels.generatedAt', 'Généré le')}: ${generatedAt}`,
        `${tp('labels.driverFilter', 'Filtre chauffeur')}: ${filterLabel}`,
      ]);

      const historyRows = history.map((h) => ([
        new Date(h.date).toLocaleDateString(uiLocale),
        h.driverName,
        h.orderNumber,
        h.bottleType,
        Number(h.quantity || 0),
      ]));

      autoTable(doc, {
        head: [[tp('table.date', 'Date'), tp('table.driver', 'Chauffeur'), tp('table.orderNumber', 'N° Bon'), tp('table.type', 'Type'), tp('table.qty', 'Qté')]],
        body: historyRows,
        startY: 46,
        theme: 'grid',
        headStyles: { fillColor: pdfHeaderColor as any, textColor: [255, 255, 255], fontStyle: 'bold' },
        styles: { fontSize: 9, cellPadding: 2 },
        columnStyles: { 4: { halign: 'right', fontStyle: 'bold' } },
      });
    }

    addPdfPageNumbers(doc);
    doc.save(`rapport_bouteilles_etrangeres_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const generateRCReport = async () => {
    const doc = await createPdfDoc();
    const generatedAt = new Date().toLocaleString(uiLocale);
    const filterLabel = analysisSearch.trim() ? analysisSearch.trim() : tp('labels.none', 'Aucun');
    const filtered = rcBottlesAnalysis
      .filter(d => d.driverName.toLowerCase().includes(analysisSearch.toLowerCase()))
      .sort((a, b) => (b.total || 0) - (a.total || 0));

    addPdfHeader(
      doc,
      tp('headers.rcByDriver', 'Rapport des Bouteilles Restantes (R.C) par Chauffeur'),
      [`${tp('labels.generatedAt', 'Généré le')}: ${generatedAt}`, `${tp('labels.driverFilter', 'Filtre chauffeur')}: ${filterLabel}`],
      [231, 76, 60]
    );

    if (filtered.length === 0) {
      doc.setFontSize(12);
      doc.text(tp('empty.noRcForSelection', 'Aucun R.C (perte) détecté pour cette sélection.'), 14, 52);
      doc.save(`rapport_rc_bouteilles_${new Date().toISOString().slice(0, 10)}.pdf`);
      return;
    }

    const totalRC = filtered.reduce((sum, d) => sum + (d.total || 0), 0);
    const topDriver = filtered[0]?.driverName || '-';
    const topDriverTotal = filtered[0]?.total || 0;

    setPdfFont(doc, 'bold');
    doc.setFontSize(10);
    doc.text(`${tp('labels.totalRc', 'Total R.C')}: ${totalRC}`, 14, 48);
    doc.text(`${tp('labels.impactedDrivers', 'Chauffeurs impactés')}: ${filtered.length}`, 80, 48);
    doc.text(`${tp('labels.top', 'Top')}: ${topDriver} (${topDriverTotal})`, 150, 48);
    setPdfFont(doc, 'normal');

    const overviewRows: any[] = filtered.map((d) => {
      const pct = totalRC > 0 ? ((d.total || 0) / totalRC) * 100 : 0;
      const typesStr = Object.entries(d.byType || {})
        .sort((a, b) => (b[1] || 0) - (a[1] || 0))
        .slice(0, 4)
        .map(([type, qty]) => `${qty} ${type}`)
        .join(' | ');
      return [
        d.driverName,
        d.total || 0,
        `${pct.toFixed(1)}%`,
        typesStr || '-',
      ];
    });

    autoTable(doc, {
      head: [[tp('table.driver', 'Chauffeur'), tp('labels.total', 'Total'), '%', tp('table.topTypes', 'Top types')]],
      body: overviewRows,
      startY: 54,
      theme: 'grid',
      headStyles: { fillColor: [231, 76, 60], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: {
        1: { halign: 'right', fontStyle: 'bold' },
        2: { halign: 'right' },
      },
    });

    const afterOverviewY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 8 : 120;

    const detailsRows: any[] = [];
    filtered.forEach((d) => {
      detailsRows.push([
        { content: `${d.driverName} — ${tp('labels.total', 'Total')}: ${d.total}`, colSpan: 3, styles: { fillColor: [254, 242, 242], textColor: pdfTextColor as any, fontStyle: 'bold' } },
      ]);
      const types = Object.entries(d.byType || {}).sort((a, b) => (b[1] || 0) - (a[1] || 0));
      types.forEach(([type, qty]) => {
        detailsRows.push([type, qty, '']);
      });
      if (types.length === 0) {
        detailsRows.push(['-', 0, '']);
      }
    });

    autoTable(doc, {
      head: [[tp('table.type', 'Type'), tp('table.qty', 'Qté'), '']],
      body: detailsRows,
      startY: afterOverviewY,
      theme: 'grid',
      headStyles: { fillColor: [254, 226, 226], textColor: pdfTextColor as any, fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
    });

    const history = filtered
      .flatMap((d) =>
        (d.history || []).map((h) => ({
          driverName: d.driverName,
          date: h.date,
          orderNumber: h.orderNumber,
          bottleType: h.bottleType,
          quantity: h.quantity,
        }))
      )
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (history.length > 0) {
      doc.addPage();
      addPdfHeader(
        doc,
        tp('headers.rcHistory', 'Historique — Bouteilles Restantes (R.C)'),
        [`${tp('labels.generatedAt', 'Généré le')}: ${generatedAt}`, `${tp('labels.driverFilter', 'Filtre chauffeur')}: ${filterLabel}`],
        [231, 76, 60]
      );

      const historyRows = history.map((h) => ([
        new Date(h.date).toLocaleDateString(uiLocale),
        h.driverName,
        h.orderNumber,
        h.bottleType,
        Number(h.quantity || 0),
      ]));

      autoTable(doc, {
        head: [[tp('table.date', 'Date'), tp('table.driver', 'Chauffeur'), tp('table.orderNumber', 'N° Bon'), tp('table.type', 'Type'), tp('table.qty', 'Qté')]],
        body: historyRows,
        startY: 46,
        theme: 'grid',
        headStyles: { fillColor: [231, 76, 60], textColor: [255, 255, 255], fontStyle: 'bold' },
        styles: { fontSize: 9, cellPadding: 2 },
        columnStyles: { 4: { halign: 'right', fontStyle: 'bold' } },
      });
    }

    addPdfPageNumbers(doc);
    doc.save(`rapport_rc_bouteilles_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const renderAnalysisSection = () => {
    const totalForeign = foreignBottlesAnalysis.reduce((sum, d) => sum + d.total, 0);
    const totalRC = rcBottlesAnalysis.reduce((sum, d) => sum + d.total, 0);

    return (
      <div className="space-y-6">
        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="text-2xl font-bold flex items-center gap-2">
                <Package className="w-6 h-6 text-orange-600" />
                {t('reports.impact.title', "Suivi d'impact du stock")}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">{t('reports.impact.subtitle', 'Analyse des pertes (R.C) et des bouteilles étrangères par chauffeur')}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative w-64">
                <Filter className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('reports.impact.filterByDriver', 'Filtrer par chauffeur...')}
                  className="pl-8 h-9"
                  value={analysisSearch}
                  onChange={(e) => setAnalysisSearch(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 flex items-center gap-4">
                <div className="bg-orange-500 p-3 rounded-lg text-white">
                  <Activity className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-orange-800 text-xs font-bold uppercase tracking-wider">{t('reports.impact.globalImpact', 'Impact Global')}</div>
                  <div className="text-2xl font-black text-orange-900">{totalForeign + totalRC}</div>
                </div>
              </div>
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-center gap-4">
                <div className="bg-blue-500 p-3 rounded-lg text-white">
                  <Package className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-blue-800 text-xs font-bold uppercase tracking-wider">{t('reports.impact.foreignTotal', 'Étrangères Total')}</div>
                  <div className="text-2xl font-black text-blue-900">{totalForeign}</div>
                </div>
              </div>
              <div className="bg-red-50 p-4 rounded-xl border border-red-100 flex items-center gap-4">
                <div className="bg-red-500 p-3 rounded-lg text-white">
                  <ArrowRightLeft className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-red-800 text-xs font-bold uppercase tracking-wider">{t('reports.impact.rcLossesTotal', 'R.C (Pertes) Total')}</div>
                  <div className="text-2xl font-black text-red-900">{totalRC}</div>
                </div>
              </div>
              <div className="bg-green-50 p-4 rounded-xl border border-green-100 flex items-center gap-4">
                <div className="bg-green-500 p-3 rounded-lg text-white">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-green-800 text-xs font-bold uppercase tracking-wider">{t('reports.impact.impactedDrivers', 'Chauffeurs Impactés')}</div>
                  <div className="text-2xl font-black text-green-900">
                    {new Set([...foreignBottlesAnalysis.map(d => d.driverId), ...rcBottlesAnalysis.map(d => d.driverId)]).size}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Foreign Bottles Analysis */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold flex items-center gap-2 text-blue-700">
                    <div className="w-2 h-6 bg-blue-500 rounded-full"></div>
                    {t('reports.impact.foreignBottles', 'Bouteilles Étrangères')}
                  </h3>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="text-blue-600 border-blue-200 hover:bg-blue-50"
                    onClick={generateForeignBottlesReport}
                    disabled={foreignBottlesAnalysis.length === 0}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    PDF
                  </Button>
                </div>
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                  {foreignBottlesAnalysis
                    .filter(d => d.driverName.toLowerCase().includes(analysisSearch.toLowerCase()))
                    .map(d => (
                      <div key={d.driverId} className="group p-4 bg-white border rounded-xl hover:shadow-md transition-all border-blue-100 hover:border-blue-300">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <span className="text-sm font-bold text-gray-900 group-hover:text-blue-700 transition-colors">{d.driverName}</span>
                            <div className="flex gap-1 mt-1">
                              {Object.entries(d.byType).map(([type, qty]) => (
                                <Badge key={type} variant="secondary" className="text-[10px] py-0 bg-blue-50 text-blue-700 border-blue-100">
                                  {qty} {type}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-xl font-black text-blue-600">{d.total}</span>
                            <p className="text-[10px] text-muted-foreground uppercase font-bold">{t('reports.impact.units', 'Unités')}</p>
                          </div>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className="bg-blue-500 h-full rounded-full transition-all"
                            style={{ width: `${Math.min(100, (d.total / totalForeign) * 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  {foreignBottlesAnalysis.length === 0 && (
                    <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed">
                      <Package className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">{t('reports.impact.noForeignBottle', 'Aucune bouteille étrangère détectée.')}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* R.C Bottles Analysis */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold flex items-center gap-2 text-red-700">
                    <div className="w-2 h-6 bg-red-500 rounded-full"></div>
                    {t('reports.impact.rcTracking', 'Suivi des Restants (R.C)')}
                  </h3>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="text-red-600 border-red-200 hover:bg-red-50"
                    onClick={generateRCReport}
                    disabled={rcBottlesAnalysis.length === 0}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    PDF
                  </Button>
                </div>
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                  {rcBottlesAnalysis
                    .filter(d => d.driverName.toLowerCase().includes(analysisSearch.toLowerCase()))
                    .map(d => (
                      <div key={d.driverId} className="group p-4 bg-white border rounded-xl hover:shadow-md transition-all border-red-100 hover:border-red-300">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <span className="text-sm font-bold text-gray-900 group-hover:text-red-700 transition-colors">{d.driverName}</span>
                            <div className="flex gap-1 mt-1">
                              {Object.entries(d.byType).map(([type, qty]) => (
                                <Badge key={type} variant="secondary" className="text-[10px] py-0 bg-red-50 text-red-700 border-red-100">
                                  {qty} {type}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-xl font-black text-red-600">{d.total}</span>
                            <p className="text-[10px] text-muted-foreground uppercase font-bold">{t('reports.impact.units', 'Unités')}</p>
                          </div>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className="bg-red-500 h-full rounded-full transition-all"
                            style={{ width: `${Math.min(100, (d.total / totalRC) * 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  {rcBottlesAnalysis.length === 0 && (
                    <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed">
                      <ArrowRightLeft className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">{t('reports.impact.noRcLoss', 'Aucun R.C (perte) détecté.')}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const generateMygazReport = async () => {
    const doc = await createPdfDoc();
    const selectedDate = periodLabel;
    const driverName =
      dailyReportDriver === 'all'
        ? t('reports.filters.all', 'Tous')
        : drivers.find((d) => d.id === dailyReportDriver)?.name || t('reports.daily.unknown', 'Inconnu');

    const generatedAt = new Date().toLocaleString(uiLocale);
    addPdfHeader(doc, tp('headers.mygaz', 'Rapport des Paiements MYGAZ'), [
      `${tp('labels.period', 'Période')}: ${selectedDate}`,
      `${tp('table.driver', 'Chauffeur')}: ${driverName} | ${tp('labels.generatedAt', 'Généré le')}: ${generatedAt}`,
    ]);

    const tableColumn = [tp('table.driver', 'Chauffeur'), tp('table.orderNumber', 'N° Bon'), tp('table.totalOrder', 'Total Bon'), tp('table.mygazAmount', 'Montant MYGAZ'), tp('table.otherCashCheck', 'Autre (Esp/Chq)'), tp('table.debt', 'Dette')];
    const tableRows: any[] = [];

    let totalMygaz = 0;
    let totalBons = 0;
    let totalAutre = 0;
    let totalDette = 0;

    const driversToReport =
      dailyReportDriver === 'all' ? drivers : drivers.filter((d) => d.id === dailyReportDriver);

    const processedOrderIds = new Set<string>();

    driversToReport.forEach((driver) => {
      const driverReturnOrders = (returnOrders || []).filter((o: any) => {
        if (!o || !o.date) return false;
        const d = new Date(o.date);
        return o.driverId === driver.id && inRange(d);
      });

      driverReturnOrders.forEach((order: any) => {
        if (processedOrderIds.has(order.id)) return;
        processedOrderIds.add(order.id);

        const relatedRevenues = (revenues || []).filter((r: Revenue) => {
          if (r.relatedOrderId !== order.id || r.relatedOrderType !== 'return') return false;
          const rD = new Date(r.date);
          return inRange(rD);
        });
        
        let mygaz = 0;
        let cash = 0;
        let check = 0;
        const debt = order.paymentDebt || 0;
        const total = order.paymentTotal || 0;

        if (relatedRevenues.length > 0) {
          const latestRevenue = [...relatedRevenues].sort(
            (a: Revenue, b: Revenue) => new Date(a.date).getTime() - new Date(b.date).getTime()
          )[relatedRevenues.length - 1];
          mygaz = (latestRevenue?.mygazAmount || 0);
          cash = (latestRevenue?.cashAmount || latestRevenue?.totalCash || 0);
          check = (latestRevenue?.checkAmount || latestRevenue?.totalCheque || 0);
        } else {
          mygaz = order.paymentMygaz || 0;
          cash = order.paymentCash || 0;
          check = order.paymentCheque || 0;
        }

        if (mygaz > 0) {
          tableRows.push([
            driver.name,
            order.orderNumber,
            total.toFixed(2),
            mygaz.toFixed(2),
            (cash + check).toFixed(2),
            debt.toFixed(2)
          ]);
          totalMygaz += mygaz;
          totalBons += total;
          totalAutre += (cash + check);
          totalDette += debt;
        }
      });
    });

    if (tableRows.length > 0) {
      tableRows.sort((a, b) => {
        const mygazA = Number(a[3] || 0);
        const mygazB = Number(b[3] || 0);
        if (mygazB !== mygazA) return mygazB - mygazA;
        const totalA = Number(a[2] || 0);
        const totalB = Number(b[2] || 0);
        return totalB - totalA;
      });
      tableRows.push([
        tp('labels.totalUpper', 'TOTAL'),
        '',
        totalBons.toFixed(2),
        totalMygaz.toFixed(2),
        totalAutre.toFixed(2),
        totalDette.toFixed(2)
      ]);

      const tableStartY = addPdfMetricCards(doc, [
        { label: tp('cards.transactions', 'Transaction'), value: String(tableRows.length - 1), color: [59, 130, 246] },
        { label: tp('cards.totalMygaz', 'Total MYGAZ'), value: `${totalMygaz.toFixed(2)} DH`, color: [16, 185, 129] },
        { label: tp('table.debt', 'Dette'), value: `${totalDette.toFixed(2)} DH`, color: [245, 158, 11] },
      ]);

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        ...getPdfTableStyle(tableStartY, 9),
        columnStyles: {
          2: { halign: 'right', fontStyle: 'bold' },
          3: { halign: 'right', fontStyle: 'bold' },
          4: { halign: 'right' },
          5: { halign: 'right' },
        },
      });
      addPdfPageNumbers(doc);
    } else {
      doc.setFontSize(12);
      doc.text(tp('empty.noMygazForSelection', 'Aucun paiement MYGAZ trouvé pour cette sélection.'), 14, 52);
    }

    doc.save(`rapport_mygaz_${(dailyStartDate || '').replaceAll('-','')}_${(dailyEndDate || dailyStartDate || '').replaceAll('-','')}.pdf`);
  };

  const generateDriversSupplyReturnReport = async () => {
    const selectedDate = periodLabel;
    const doc = await createPdfDoc({ orientation: 'landscape' });
    const driverFilterLabel = dailyReportDriver === 'all' ? t('reports.filters.all', 'Tous') : (drivers.find(d => d.id === dailyReportDriver)?.name || t('reports.daily.unknown', 'Inconnu'));
    const generatedAt = new Date().toLocaleString(uiLocale);
    addPdfHeader(doc, tp('headers.driversBdHistory', "Historique des Bons d'Entrée (B.D) — Camions"), [
      `${tp('labels.period', 'Période')}: ${selectedDate}`,
      `${tp('labels.driverFilter', 'Filtre chauffeur')}: ${driverFilterLabel} | ${tp('labels.generatedAt', 'Généré le')}: ${generatedAt}`,
    ]);

    const hasCamion = (driverId: string) => trucks.some(t => t.driverId === driverId && t.truckType === 'camion');
    const driversToReport =
      dailyReportDriver === 'all'
        ? drivers.filter(d => hasCamion(d.id))
        : drivers.filter(d => d.id === dailyReportDriver && hasCamion(d.id));

    const mapBottleKey = (name?: string) => {
      const n = (name || '').toLowerCase().replace(/\s+/g, '');
      if (n.includes('bng')) return 'bng';
      if (/(^|[^0-9])3kg($|[^0-9])/.test(n) || /3\s*kg/.test(name.toLowerCase())) return '3kg';
      if (/(^|[^0-9])6kg($|[^0-9])/.test(n) || /6\s*kg/.test(name.toLowerCase())) return '6kg';
      if (/(^|[^0-9])12kg($|[^0-9])/.test(n) || /12\s*kg/.test(name.toLowerCase())) return '12kg';
      if (/(^|[^0-9])34kg($|[^0-9])/.test(n) || /34\s*kg/.test(name.toLowerCase())) return '34kg';
      return '';
    };

    const tableColumn = [tp('table.driver', 'Chauffeur'), tp('table.orderNumber', 'N° Bon'), tp('table.client', 'Client'), '3kg', '6kg', '12kg', '34kg', 'BNG', tp('table.totalUnits', 'Total unités'), tp('table.chequeDh', 'Chèque (DH)'), tp('table.cashDh', 'Espèce (DH)'), tp('table.debtDh', 'Dette (DH)')];
    const tableRows: any[] = [];

    let sum3kg = 0, sum6kg = 0, sum12kg = 0, sum34kg = 0, sumBNG = 0, sumUnits = 0;
    let sumCheque = 0, sumEspece = 0, sumDette = 0;

    driversToReport.forEach(driver => {
      const roForDriver = (returnOrders || []).filter((o: any) => {
        const d = new Date(o.date || '');
        return inRange(d) && o.driverId === driver.id;
      });

      roForDriver.forEach((order: any) => {
        const quantities: Record<'3kg' | '6kg' | '12kg' | '34kg' | 'bng', number> = {
          '3kg': 0, '6kg': 0, '12kg': 0, '34kg': 0, 'bng': 0
        };

        (order.items || []).forEach((item: any) => {
          const name =
            item.bottleTypeName ||
            bottleTypes.find((b: any) => b.id === item.bottleTypeId)?.name ||
            '';
          const key = mapBottleKey(name);
          const sold = (item.returnedEmptyQuantity || 0) + (item.consigneQuantity || 0);
          if (key && quantities[key as keyof typeof quantities] !== undefined) {
            quantities[key as keyof typeof quantities] += sold;
          }
        });

        const relatedRevenues = (revenues || []).filter((r: any) => {
          const rD = new Date(r.date || '');
          if (!inRange(rD)) return false;
          return r.relatedOrderType === 'return' && r.relatedOrderId === order.id;
        });

        let cheque = 0;
        let espece = 0;
        if (relatedRevenues.length > 0) {
          cheque = relatedRevenues.reduce((sum: number, r: any) => sum + (r.checkAmount || r.totalCheque || 0), 0);
          espece = relatedRevenues.reduce((sum: number, r: any) => sum + (r.cashAmount || r.totalCash || 0), 0);
        } else {
          cheque = order.paymentCheque || 0;
          espece = order.paymentCash || 0;
        }

        const debt = order.paymentDebt || 0;
        const totalUnits = quantities['3kg'] + quantities['6kg'] + quantities['12kg'] + quantities['34kg'] + quantities['bng'];

        tableRows.push([
          driver.name,
          order.orderNumber || '',
          order.clientName || '-',
          quantities['3kg'],
          quantities['6kg'],
          quantities['12kg'],
          quantities['34kg'],
          quantities['bng'],
          totalUnits,
          cheque.toFixed(2),
          espece.toFixed(2),
          debt.toFixed(2),
        ]);

        sum3kg += quantities['3kg'];
        sum6kg += quantities['6kg'];
        sum12kg += quantities['12kg'];
        sum34kg += quantities['34kg'];
        sumBNG += quantities['bng'];
        sumUnits += totalUnits;
        sumCheque += cheque;
        sumEspece += espece;
        sumDette += debt;
      });
    });

    if (tableRows.length === 0) {
      doc.setFontSize(12);
      doc.text(tp('empty.noBdForSelection', 'Aucune donnée B.D pour la sélection.'), 14, 52);
      doc.save(`historique_bd_camions_${selectedDate}.pdf`);
      return;
    }

    tableRows.sort((a, b) => {
      const driverA = String(a[0] || '');
      const driverB = String(b[0] || '');
      if (driverA !== driverB) return driverA.localeCompare(driverB, 'fr');
      return String(a[1] || '').localeCompare(String(b[1] || ''), 'fr');
    });

    tableRows.push([
      tp('labels.totalUpper', 'TOTAL'),
      '',
      '',
      sum3kg,
      sum6kg,
      sum12kg,
      sum34kg,
      sumBNG,
      sumUnits,
      sumCheque.toFixed(2),
      sumEspece.toFixed(2),
      sumDette.toFixed(2),
    ]);

    const tableStartY = addPdfMetricCards(doc, [
      { label: tp('cards.transactions', 'Transaction'), value: String(tableRows.length - 1), color: [59, 130, 246] },
      { label: tp('cards.units', 'Unités'), value: String(sumUnits), color: [16, 185, 129] },
      { label: tp('table.debt', 'Dette'), value: `${sumDette.toFixed(2)} DH`, color: [245, 158, 11] },
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      ...getPdfTableStyle(tableStartY, 8),
      columnStyles: {
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right' },
        6: { halign: 'right' },
        7: { halign: 'right' },
        8: { halign: 'right', fontStyle: 'bold' },
        9: { halign: 'right' },
        10: { halign: 'right' },
        11: { halign: 'right' },
      },
    });
    addPdfPageNumbers(doc);

    doc.save(`historique_bd_camions_${(dailyStartDate || '').replaceAll('-','')}_${(dailyEndDate || dailyStartDate || '').replaceAll('-','')}.pdf`);
  };
  const generateFactoryReceptionReport = async () => {
    const doc = await createPdfDoc({ orientation: 'landscape' });
    const selectedDate = periodLabel;
    const driverName =
      dailyReportDriver === 'all'
        ? t('reports.filters.all', 'Tous')
        : drivers.find((d) => d.id === dailyReportDriver)?.name || t('reports.daily.unknown', 'Inconnu');
    const generatedAt = new Date().toLocaleString(uiLocale);
    addPdfHeader(doc, tp('headers.factoryReception', 'Réception Usine'), [
      `${tp('labels.period', 'Période')}: ${selectedDate}`,
      `${tp('table.driver', 'Chauffeur')}: ${driverName} | ${tp('labels.generatedAt', 'Généré le')}: ${generatedAt}`,
    ]);

    const mapBottleKey = (name?: string) => {
      const n = (name || '').toLowerCase().replace(/\s+/g, '');
      if (n.includes('bng')) return 'bng';
      if (/(^|[^0-9])3kg($|[^0-9])/.test(n) || /3\s*kg/.test((name || '').toLowerCase())) return '3kg';
      if (/(^|[^0-9])6kg($|[^0-9])/.test(n) || /6\s*kg/.test((name || '').toLowerCase())) return '6kg';
      if (/(^|[^0-9])12kg($|[^0-9])/.test(n) || /12\s*kg/.test((name || '').toLowerCase())) return '12kg';
      if (/(^|[^0-9])34kg($|[^0-9])/.test(n) || /34\s*kg/.test((name || '').toLowerCase())) return '34kg';
      return '';
    };

    const suppliers = await supabaseService.getAll<any>('suppliers');
    const operations = await supabaseService.getAll<any>('factory_operations');
    const driverFilter = dailyReportDriver;
    const ops = (operations || []).filter((op: any) => {
      if (!op || !op.receivedBottles || (op.receivedBottles || []).length === 0) return false;
      const rd = new Date(op.receivedDate || op.date);
      if (!inRange(rd)) return false;
      if (driverFilter === 'all') return true;
      const selectedDriverName = drivers.find(d => d.id === driverFilter)?.name || '';
      const byName = (op.driverName || '').toLowerCase() === selectedDriverName.toLowerCase();
      const byTruck = (trucks.find(t => t.id === op.truckId)?.driverId || '') === driverFilter;
      return byName || byTruck;
    });

    const tableColumn = [tp('table.driver', 'Chauffeur'), tp('table.blRef', 'Réf BL'), tp('table.supplier', 'Fournisseur'), tp('table.receptionDate', 'Date Réception'), '3kg', '6kg', '12kg', '34kg', 'BNG', tp('table.amountDh', 'Montant (DH)'), tp('table.totalUnits', 'Total unités')];
    const tableRows: any[] = [];
    let sum3 = 0, sum6 = 0, sum12 = 0, sum34 = 0, sumBNG = 0, sumAmount = 0, sumUnits = 0;

    ops.forEach((op: any) => {
      const supplierName = suppliers.find((s: any) => String(s.id) === String(op.supplierId))?.name || (op.supplierId || '-');
      const driverLabel = op.driverName || (drivers.find(d => d.id === (trucks.find(t => t.id === op.truckId)?.driverId))?.name || '—');
      const rd = op.receivedDate ? new Date(op.receivedDate) : (op.date ? new Date(op.date) : null);
      const rdLabel = rd ? `${rd.getFullYear()}-${String(rd.getMonth()+1).padStart(2,'0')}-${String(rd.getDate()).padStart(2,'0')}` : '';

      const quantities: Record<'3kg' | '6kg' | '12kg' | '34kg' | 'bng', number> = { '3kg': 0, '6kg': 0, '12kg': 0, '34kg': 0, 'bng': 0 };
      (op.receivedBottles || []).forEach((item: any) => {
        const bt = bottleTypes.find(b => b.id === item.bottleTypeId);
        const key = mapBottleKey(bt?.name || '');
        const qty = Number(item.quantity || 0);
        if (key && quantities[key as keyof typeof quantities] !== undefined) {
          quantities[key as keyof typeof quantities] += qty;
        }
      });
      const totalUnits = quantities['3kg'] + quantities['6kg'] + quantities['12kg'] + quantities['34kg'] + quantities['bng'];
      const amountCalc = (op.receivedBottles || []).reduce((acc: number, item: any) => {
        const bt = bottleTypes.find(b => b.id === item.bottleTypeId);
        const unit = Number(
          (bt as any)?.purchasePrice ??
          (bt as any)?.unitPrice ??
          (bt as any)?.price ??
          (bt as any)?.cost ??
          0
        );
        const qty = Number(item.quantity || 0);
        return acc + unit * qty;
      }, 0);
      const txCandidates = (transactions || []).filter((t: any) => t.type === 'factory_reception');
      const parsedTx = txCandidates.map((t: any) => {
        const raw = t.details ?? t.detail ?? t.meta ?? t.data;
        let det: any = undefined;
        if (typeof raw === 'string') { try { det = JSON.parse(raw); } catch { det = undefined; } }
        else if (raw && typeof raw === 'object') det = raw;
        const td = new Date(t.date || 0).getTime();
        const tRef = String(t.reference || t.ref || '');
        const tTruckId = String(t.truckId || det?.truckId || det?.truck_id || '');
        const tDriverId = String(t.driverId || det?.driverId || det?.driver_id || '');
        return { t, det, td, tRef, tTruckId, tDriverId, value: getTransactionValue(t) };
      });
      const od = rd ? rd.getTime() : new Date(op.date || 0).getTime();
      const dFromTruck = trucks.find(tr => String(tr.id) === String(op.truckId || ''))?.driverId;
      const strictMatches = parsedTx.filter(x => {
        const byOp = x.det?.operationId && String(x.det.operationId) === String(op.id);
        const byRef = op.blReference && (x.tRef === String(op.blReference));
        const bySupplier = !x.t.supplierId || String(x.t.supplierId) === String(op.supplierId);
        return (byOp || byRef) && bySupplier;
      });
      let amountFromTx = 0;
      if (strictMatches.length > 0) {
        amountFromTx = strictMatches.reduce((s, x) => s + (Number(x.value) || 0), 0);
      } else {
        const fuzzy = parsedTx.filter(x => {
          const bySupplier = !x.t.supplierId || String(x.t.supplierId) === String(op.supplierId);
          const byTime = Math.abs(x.td - od) <= 2 * 60 * 60 * 1000;
          const byTruck = x.tTruckId && String(x.tTruckId) === String(op.truckId || '');
          const byDriver = dFromTruck && x.tDriverId && String(x.tDriverId) === String(dFromTruck);
          return bySupplier && byTime && (byTruck || byDriver);
        });
        if (fuzzy.length > 0) {
          const closest = [...fuzzy].sort((a, b) => Math.abs(a.td - od) - Math.abs(b.td - od))[0];
          const sameRef = fuzzy.filter(x => x.tRef && x.tRef === closest.tRef);
          const group = sameRef.length > 0 ? sameRef : [closest];
          amountFromTx = group.reduce((s, x) => s + (Number(x.value) || 0), 0);
        }
      }
      const amount = amountFromTx > 0 ? amountFromTx : amountCalc;

      tableRows.push([
        driverLabel,
        op.blReference || '',
        supplierName,
        rdLabel,
        quantities['3kg'],
        quantities['6kg'],
        quantities['12kg'],
        quantities['34kg'],
        quantities['bng'],
        amount.toFixed(2),
        totalUnits,
      ]);

      sum3 += quantities['3kg'];
      sum6 += quantities['6kg'];
      sum12 += quantities['12kg'];
      sum34 += quantities['34kg'];
      sumBNG += quantities['bng'];
      sumAmount += amount;
      sumUnits += totalUnits;
    });

    if (tableRows.length === 0) {
      doc.setFontSize(12);
      doc.text(tp('empty.noFactoryReception', 'Aucune réception usine trouvée pour cette sélection.'), 14, 52);
      doc.save(`reception_usine_${(dailyStartDate || '').replaceAll('-','')}_${(dailyEndDate || dailyStartDate || '').replaceAll('-','')}.pdf`);
      return;
    }

    tableRows.sort((a, b) => {
      const au = Number(a[10] || 0);
      const bu = Number(b[10] || 0);
      if (!isNaN(au) && !isNaN(bu) && au !== bu) return bu - au; // Total unités desc
      const av = Number(a[9] || 0);
      const bv = Number(b[9] || 0);
      if (!isNaN(av) && !isNaN(bv) && av !== bv) return bv - av; // tie-breaker by Montant desc
      return String(a[0] || '').localeCompare(String(b[0] || ''), 'fr');
    });
    tableRows.push([
      tp('labels.totalUpper', 'TOTAL'),
      '',
      '',
      '',
      sum3,
      sum6,
      sum12,
      sum34,
      sumBNG,
      sumAmount.toFixed(2),
      sumUnits,
    ]);

    const tableStartY = addPdfMetricCards(doc, [
      { label: tp('cards.transactions', 'Transaction'), value: String(tableRows.length - 1), color: [59, 130, 246] },
      { label: tp('cards.units', 'Unités'), value: String(sumUnits), color: [16, 185, 129] },
      { label: tp('table.amount', 'Montant'), value: `${sumAmount.toFixed(2)} DH`, color: [245, 158, 11] },
    ]);


    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      ...getPdfTableStyle(tableStartY, 9),
      columnStyles: {
        4: { halign: 'right' },
        5: { halign: 'right' },
        6: { halign: 'right' },
        7: { halign: 'right' },
        8: { halign: 'right' },
        9: { halign: 'right' },
        10: { halign: 'right', fontStyle: 'bold' },
      },
    });
    addPdfPageNumbers(doc);
    doc.save(`reception_usine_${(dailyStartDate || '').replaceAll('-','')}_${(dailyEndDate || dailyStartDate || '').replaceAll('-','')}.pdf`);
  };
  const runReportAction = async (id: string, action: () => void | Promise<void>) => {
    setActiveReportId(id);
    try {
      await Promise.resolve(action());
      setCompletedReportIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
      setGlowingReportIds((prev) => [...prev.filter((item) => item !== id), id]);
      setTimeout(() => {
        setGlowingReportIds((prev) => prev.filter((item) => item !== id));
      }, 1200);
    } finally {
      setActiveReportId(null);
    }
  };
  const applyDailyPeriodPreset = (preset: 'today' | 'last7' | 'month') => {
    const now = new Date();
    const toIso = (d: Date) => d.toISOString().slice(0, 10);
    if (preset === 'today') {
      const today = toIso(now);
      setDailyStartDate(today);
      setDailyEndDate(today);
      return;
    }
    if (preset === 'last7') {
      const end = new Date(now);
      const start = new Date(now);
      start.setDate(start.getDate() - 6);
      setDailyStartDate(toIso(start));
      setDailyEndDate(toIso(end));
      return;
    }
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    setDailyStartDate(toIso(start));
    setDailyEndDate(toIso(end));
  };
  const dailyReportActions: Array<{ id: string; label: string; variant?: 'default' | 'outline' | 'secondary'; action: () => void | Promise<void> }> = [
    { id: 'drivers_daily', label: t('reports.dailyActions.driversDaily', 'Rapport Journalier des Chauffeurs'), action: () => generateCombinedDriversReport() },
    { id: 'total_vente', label: t('reports.dailyActions.totalVente', 'Rapport Total Vente (B.D)'), variant: 'outline', action: () => generateTotalVenteReport() },
    { id: 'allogaz_bd', label: t('reports.dailyActions.allogazBd', 'Rapport Allogaz (B.D)'), variant: 'outline', action: () => generateDailyPetitCamionReport() },
    { id: 'mygaz', label: t('reports.dailyActions.mygaz', 'Rapport MYGAZ'), variant: 'secondary', action: () => generateMygazReport() },
    { id: 'drivers_history_bd', label: t('reports.dailyActions.driversHistoryBd', 'Historique B.D — Camions'), variant: 'outline', action: () => generateDriversSupplyReturnReport() },
    { id: 'driver_debts', label: t('reports.dailyActions.driverDebts', 'Dettes Chauffeurs'), variant: 'outline', action: () => generateDriverDebtReport() },
    { id: 'daily_expenses', label: t('reports.dailyActions.dailyExpenses', 'Notes de Frais'), variant: 'outline', action: () => generateDailyExpenseReport(expenses) },
    { id: 'misc_expenses', label: t('reports.dailyActions.miscExpenses', 'Dépenses Diverses'), variant: 'outline', action: () => generateMiscellaneousExpensesReport() },
    { id: 'transport', label: t('reports.dailyActions.transport', 'Transport'), variant: 'outline', action: () => generateTransportReport() },
    { id: 'general_pdf', label: t('reports.dailyActions.generalPdf', 'Rapport Général PDF'), action: () => generateGeneralReport() },
    { id: 'diverses_pdf', label: t('reports.dailyActions.diversesPdf', 'Rapport Diverses PDF'), action: () => generateDiversesReport() },
    { id: 'repairs_pdf', label: t('reports.dailyActions.repairsPdf', 'Rapport Réparations PDF'), action: () => generateRepairsReport() },
    { id: 'factory_reception', label: t('reports.dailyActions.factoryReception', 'Réception Usine'), variant: 'outline', action: () => generateFactoryReceptionReport() },
  ];
  const generateAllDailyReports = async () => {
    if (isBulkGeneratingReports) return;
    setIsBulkGeneratingReports(true);
    setCompletedReportIds([]);
    try {
      for (const report of dailyReportActions) {
        setActiveReportId(report.id);
        await Promise.resolve(report.action());
        setCompletedReportIds((prev) => (prev.includes(report.id) ? prev : [...prev, report.id]));
        setGlowingReportIds((prev) => [...prev.filter((item) => item !== report.id), report.id]);
        setTimeout(() => {
          setGlowingReportIds((prev) => prev.filter((item) => item !== report.id));
        }, 1200);
      }
    } finally {
      setActiveReportId(null);
      setIsBulkGeneratingReports(false);
    }
  };
  const sectionMotion = {
    initial: { opacity: 0, y: 8 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: '-40px' },
    transition: { duration: 0.25 },
  };
  const cardMotion = (index: number) => ({
    initial: { opacity: 0, y: 10 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: '-40px' },
    transition: { duration: 0.2, delay: index * 0.04 },
  });
  const getDailyActionTone = (index: number, isCurrent: boolean, isDone: boolean) => {
    if (isCurrent) {
      return {
        chip: 'border-indigo-300 bg-indigo-600 text-white shadow-sm shadow-indigo-200',
        card: 'border-indigo-200 bg-indigo-50/40',
        button: 'bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-600',
        status: 'text-indigo-600'
      };
    }
    if (isDone) {
      return {
        chip: 'border-emerald-300 bg-emerald-50 text-emerald-700',
        card: 'border-emerald-200 bg-emerald-50/40',
        button: 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600',
        status: 'text-emerald-600'
      };
    }
    const palettes = [
      { chip: 'border-sky-200 bg-sky-50 text-sky-700', card: 'border-sky-200 bg-sky-50/30', button: 'border-sky-300 text-sky-700 hover:bg-sky-50', status: 'text-sky-600' },
      { chip: 'border-violet-200 bg-violet-50 text-violet-700', card: 'border-violet-200 bg-violet-50/30', button: 'border-violet-300 text-violet-700 hover:bg-violet-50', status: 'text-violet-600' },
      { chip: 'border-amber-200 bg-amber-50 text-amber-700', card: 'border-amber-200 bg-amber-50/30', button: 'border-amber-300 text-amber-700 hover:bg-amber-50', status: 'text-amber-600' },
      { chip: 'border-cyan-200 bg-cyan-50 text-cyan-700', card: 'border-cyan-200 bg-cyan-50/30', button: 'border-cyan-300 text-cyan-700 hover:bg-cyan-50', status: 'text-cyan-600' }
    ];
    return palettes[index % palettes.length];
  };
  const activeFiltersCount = [
    dateFilter.startDate,
    dateFilter.endDate,
    selectedFilter !== 'all' ? selectedFilter : '',
    selectedTruck !== 'all' ? selectedTruck : '',
    selectedDriver !== 'all' ? selectedDriver : '',
  ].filter(Boolean).length;
  const healthyFleetCount = truckHealthAnalysis.filter((t) => t.score >= 70).length;
  const dataHealthScore = Math.round(
    Math.min(
      100,
      (summaryTransactions.length > 0 ? 35 : 10) +
        (stockAnomalies.length === 0 ? 35 : Math.max(8, 35 - stockAnomalies.length * 4)) +
        (healthyFleetCount / Math.max(1, trucks.length)) * 30,
    ),
  );
  const moveKpiCard = (id: 'value' | 'supply' | 'return' | 'mix', direction: 'up' | 'down') => {
    setKpiOrder((prev) => {
      const currentIndex = prev.indexOf(id);
      if (currentIndex === -1) return prev;
      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const next = [...prev];
      [next[currentIndex], next[targetIndex]] = [next[targetIndex], next[currentIndex]];
      return next;
    });
  };
  const kpiCardsConfig: Record<
    'value' | 'supply' | 'return' | 'mix',
    { title: string; value: string; icon: any; className: string }
  > = {
    value: {
      title: t('reports.kpi.totalValue', 'Valeur totale'),
      value: `${summaryTotalValue.toFixed(2)} MAD`,
      icon: TrendingUp,
      className: 'from-white to-slate-50',
    },
    supply: {
      title: t('reports.kpi.supplyBs', 'Alimentation (B.S)'),
      value: `${summaryByType.supply}`,
      icon: Package,
      className: 'from-white to-blue-50/50',
    },
    return: {
      title: t('reports.kpi.returnBd', 'Retour (B.D)'),
      value: `${summaryByType.return}`,
      icon: ArrowRightLeft,
      className: 'from-white to-green-50/50',
    },
    mix: {
      title: t('reports.kpi.exchangeFactory', 'Échange / Usine'),
      value: `${t('reports.transactions.exchangeShort', 'Éch')}: ${summaryByType.exchange} — ${t('reports.types.factory', 'Usine')}: ${summaryByType.factory}`,
      icon: BarChart3,
      className: 'from-white to-indigo-50/50',
    },
  };
  const showAnalysisSection = reportsView === 'operational';
  const showFleetSection = reportsView !== 'finance';
  const showStockSection = reportsView !== 'finance';
  const showDriversSection = reportsView !== 'executive';
  const showTransactionsSection = reportsView !== 'executive';
  const showDailyReportsSection = reportsView !== 'executive';
  const topDebtDriver = driverAnalysis.reduce(
    (best, current) => (current.debt > best.debt ? current : best),
    driverAnalysis[0] || { name: '-', debt: 0 },
  );
  const topRepairTruck = truckHealthAnalysis.reduce(
    (best, current) => (current.totalRepairCost > best.totalRepairCost ? current : best),
    truckHealthAnalysis[0] || { matricule: '-', totalRepairCost: 0 },
  );
  const highestTransaction = filteredTransactions.reduce(
    (best, current) => (getTransactionValue(current) > getTransactionValue(best) ? current : best),
    filteredTransactions[0] || { id: '-', date: '', type: '-', amount: 0 },
  );
  const scrollToSection = (sectionId: string) => {
    const section = document.getElementById(sectionId);
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
      <div className={layoutMode === 'compact' ? 'app-page-shell space-y-4 pb-2' : 'app-page-shell space-y-6 pb-2'}>
          <motion.div {...sectionMotion}>
          <Card className="app-dark-hero overflow-hidden border-0 bg-gradient-to-r from-slate-900 via-indigo-900 to-slate-900 text-white shadow-xl">
              <CardContent className="p-0">
                <div className="px-6 py-5 md:px-8 md:py-7">
                  <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                    <div className="space-y-3">
                      <Badge className="bg-white/15 text-white border-white/20 hover:bg-white/20">
                        <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                        {t('reports.hero.studio', 'Reports Studio')}
                      </Badge>
                      <div>
                        <h1 className="app-page-title text-2xl md:text-3xl font-black tracking-tight">{t('reports.hero.title', 'Pilotage intelligent des rapports')}</h1>
                        <p className="app-page-subtitle text-slate-200/90 mt-1">
                          {t('reports.hero.subtitle', 'Interface modernisée, filtres dynamiques et génération rapide sans changer le comportement métier.')}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 min-w-[280px]">
                      <div className="app-panel-soft rounded-xl border border-white/20 bg-white/10 p-3 backdrop-blur-sm">
                        <div className="text-[11px] uppercase tracking-wider text-slate-200">{t('reports.hero.filteredTransactions', 'Transactions filtrées')}</div>
                        <div className="text-2xl font-black">{filteredTransactions.length}</div>
                      </div>
                      <div className="app-panel-soft rounded-xl border border-white/20 bg-white/10 p-3 backdrop-blur-sm">
                        <div className="text-[11px] uppercase tracking-wider text-slate-200">{t('reports.hero.totalValue', 'Valeur totale')}</div>
                        <div className="text-2xl font-black">{summaryTotalValue.toFixed(0)} MAD</div>
                      </div>
                      <div className="app-panel-soft rounded-xl border border-white/20 bg-white/10 p-3 backdrop-blur-sm">
                        <div className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-slate-200">
                          <Gauge className="w-3.5 h-3.5" />
                          {t('reports.hero.dataScore', 'Score données')}
                        </div>
                        <div className="text-2xl font-black">{dataHealthScore}%</div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
          </Card>
          </motion.div>

          <motion.div {...sectionMotion}>
          <Card id="reports-filters" className="border-slate-200/80 shadow-sm bg-gradient-to-b from-white to-slate-50/30">
              <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-3 flex-wrap">
                      <span className="flex items-center gap-2">
                        <Filter className="w-5 h-5" />
                        {t('reports.filters.title', 'Filtres Intelligents')}
                      </span>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" className="h-7 px-2.5">
                          <Layers3 className="w-3.5 h-3.5 mr-1.5" />
                          {activeFiltersCount} {t('reports.filters.activeFilters', 'filtres actifs')}
                        </Badge>
                        <Badge variant="outline" className="h-7 px-2.5">
                          {periodLabel || t('reports.filters.periodNotDefined', 'Période non définie')}
                        </Badge>
                        <Button variant="outline" size="sm" onClick={exportToPDF}>
                          <Download className="w-4 h-4 mr-2" />
                          {t('reports.filters.quickPdf', 'PDF rapide')}
                        </Button>
                        <Button variant="outline" size="sm" onClick={exportToExcel}>
                          <Download className="w-4 h-4 mr-2" />
                          {t('reports.filters.quickExcel', 'Excel rapide')}
                        </Button>
                      </div>
                  </CardTitle>
              </CardHeader>
              <CardContent>
                  <div className="grid md:grid-cols-5 gap-4">
                      <div>
                          <Label>{t('reports.filters.start', 'Début')} <span className="text-xs text-muted-foreground">{tr('(jj/mm/aaaa)', '(يوم/شهر/سنة)')}</span></Label>
                          <Input
                              type="date"
                              lang={uiLocale}
                              value={dateFilter.startDate}
                              onChange={(e) =>
                                  setDateFilter((prev) => ({ ...prev, startDate: e.target.value }))
                              }
                          />
                      </div>
                      <div>
                          <Label>{t('reports.filters.end', 'Fin')} <span className="text-xs text-muted-foreground">{tr('(jj/mm/aaaa)', '(يوم/شهر/سنة)')}</span></Label>
                          <Input
                              type="date"
                              lang={uiLocale}
                              value={dateFilter.endDate}
                              onChange={(e) =>
                                  setDateFilter((prev) => ({ ...prev, endDate: e.target.value }))
                              }
                          />
                      </div>
                      <div>
                          <Label>{t('reports.filters.type', 'Type')}</Label>
                          <Select value={selectedFilter} onValueChange={setSelectedFilter}>
                              <SelectTrigger>
                                  <SelectValue placeholder={t('reports.filters.all', 'Tous')} />
                              </SelectTrigger>
                              <SelectContent>
                                  <SelectItem value="all">{t('reports.filters.all', 'Tous')}</SelectItem>
                                  <SelectItem value="supply">{t('reports.types.supply', 'Alimentation')}</SelectItem>
                                  <SelectItem value="return">{t('reports.types.return', 'Retour')}</SelectItem>
                                  <SelectItem value="exchange">{t('reports.types.exchange', 'Échange')}</SelectItem>
                                  <SelectItem value="factory">{t('reports.types.factory', 'Usine')}</SelectItem>
                              </SelectContent>
                          </Select>
                      </div>
                      <div>
                          <Label>{t('reports.filters.truck', 'Camion')}</Label>
                          <Select value={selectedTruck} onValueChange={setSelectedTruck}>
                              <SelectTrigger>
                                  <SelectValue placeholder={t('reports.filters.all', 'Tous')} />
                              </SelectTrigger>
                              <SelectContent>
                                  <SelectItem value="all">{t('reports.filters.all', 'Tous')}</SelectItem>
                                  {trucks.map((t) => (
                                    <SelectItem key={t.id} value={t.id}>
                                      {(t as any).name || (t as any).plateNumber || (t as any).registration || t.id}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                          </Select>
                      </div>
                      <div>
                          <Label>{t('reports.filters.driver', 'Chauffeur')}</Label>
                          <Select value={selectedDriver} onValueChange={setSelectedDriver}>
                              <SelectTrigger>
                                  <SelectValue placeholder={t('reports.filters.all', 'Tous')} />
                              </SelectTrigger>
                              <SelectContent>
                                  <SelectItem value="all">{t('reports.filters.all', 'Tous')}</SelectItem>
                                  {drivers.map((d) => (
                                    <SelectItem key={d.id} value={d.id}>
                                      {d.name}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                          </Select>
                      </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline">{t('reports.badges.drivers', 'Chauffeurs')}: {drivers.length}</Badge>
                      <Badge variant="outline">{t('reports.badges.trucks', 'Camions')}: {trucks.length}</Badge>
                      <Badge variant="outline">{t('reports.badges.healthyFleet', 'Flotte saine')}: {healthyFleetCount}</Badge>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setDateFilter({ startDate: '', endDate: '' });
                        setSelectedFilter('all');
                        setSelectedTruck('all');
                        setSelectedDriver('all');
                      }}
                    >
                      {t('reports.filters.reset', 'Réinitialiser les filtres')}
                    </Button>
                  </div>
              </CardContent>
          </Card>
          </motion.div>

          <motion.div {...sectionMotion}>
          <Card className="border-slate-200/80 shadow-sm">
              <CardContent className="pt-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant={reportsView === 'executive' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setReportsView('executive')}
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    {t('reports.views.executive', tr('Executive', 'تنفيذي'))}
                  </Button>
                  <Button
                    variant={reportsView === 'operational' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setReportsView('operational')}
                  >
                    <BriefcaseBusiness className="w-4 h-4 mr-2" />
                    {t('reports.views.operational', 'Opérationnel')}
                  </Button>
                  <Button
                    variant={reportsView === 'finance' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setReportsView('finance')}
                  >
                    <HandCoins className="w-4 h-4 mr-2" />
                    {t('reports.views.finance', 'Finance')}
                  </Button>
                  <Badge variant="secondary" className="ml-auto">
                    {t('reports.views.active', 'Vue active')}: {reportsView === 'executive' ? t('reports.views.executive', tr('Executive', 'تنفيذي')) : reportsView === 'operational' ? t('reports.views.operational', 'Opérationnel') : t('reports.views.finance', 'Finance')}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLayoutMode((prev) => (prev === 'immersive' ? 'compact' : 'immersive'))}
                  >
                    {layoutMode === 'immersive' ? <Minimize2 className="w-4 h-4 mr-2" /> : <Maximize2 className="w-4 h-4 mr-2" />}
                    {layoutMode === 'immersive' ? t('reports.layout.compact', 'Compact') : t('reports.layout.immersive', 'Immersive')}
                  </Button>
                </div>
              </CardContent>
          </Card>
          </motion.div>

          <motion.div {...sectionMotion}>
          <Card className="border-slate-200 shadow-sm bg-gradient-to-r from-white via-slate-50/70 to-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Navigation className="w-5 h-5 text-indigo-600" />
                  {t('reports.quickNav.title', 'Navigation Rapide V3')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => scrollToSection('reports-filters')}>{t('reports.quickNav.filters', 'Filtres')}</Button>
                  {showFleetSection && <Button variant="outline" size="sm" onClick={() => scrollToSection('reports-fleet')}>{t('reports.quickNav.fleet', 'Flotte')}</Button>}
                  <Button variant="outline" size="sm" onClick={() => scrollToSection('reports-kpis')}>{t('reports.quickNav.kpis', 'KPIs')}</Button>
                  {showStockSection && <Button variant="outline" size="sm" onClick={() => scrollToSection('reports-stock')}>{t('reports.quickNav.stock', 'Stock')}</Button>}
                  {showDriversSection && <Button variant="outline" size="sm" onClick={() => scrollToSection('reports-drivers')}>{t('reports.quickNav.drivers', 'Chauffeurs')}</Button>}
                  {showTransactionsSection && <Button variant="outline" size="sm" onClick={() => scrollToSection('reports-transactions')}>{t('reports.quickNav.transactions', 'Transactions')}</Button>}
                  {showDailyReportsSection && <Button variant="outline" size="sm" onClick={() => scrollToSection('reports-daily')}>{t('reports.quickNav.dailyReports', 'Rapports Journaliers')}</Button>}
                </div>
                <div className="grid md:grid-cols-3 gap-3">
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="text-xs text-slate-500 mb-1">{t('reports.quickNav.topDebtDriver', 'Chauffeur le plus exposé')}</div>
                    <div className="font-semibold text-slate-900">{topDebtDriver.name}</div>
                    <div className="text-sm text-rose-600">{Number(topDebtDriver.debt || 0).toFixed(2)} MAD {t('reports.quickNav.ofDebt', 'de dette')}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="text-xs text-slate-500 mb-1">{t('reports.quickNav.topCostTruck', 'Camion coût maximal')}</div>
                    <div className="font-semibold text-slate-900">{topRepairTruck.matricule || '-'}</div>
                    <div className="text-sm text-amber-600">{Number(topRepairTruck.totalRepairCost || 0).toFixed(2)} DH {t('reports.quickNav.ofRepairs', 'de réparations')}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                      <Radar className="w-3.5 h-3.5" />
                      {t('reports.quickNav.biggestTransaction', 'Plus grosse transaction filtrée')}
                    </div>
                    <div className="font-semibold text-slate-900">{String(highestTransaction.type || '-')}</div>
                    <div className="text-sm text-indigo-600">{getTransactionValue(highestTransaction).toFixed(2)} MAD</div>
                  </div>
                </div>
              </CardContent>
          </Card>
          </motion.div>
  
          {showAnalysisSection && renderAnalysisSection()}

          {showFleetSection && <motion.div {...sectionMotion}>
          <Card id="reports-fleet" className="border-slate-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-600" />
                {t('reports.fleet.title', 'Analyse Intelligente de la Flotte')}
              </CardTitle>
              <MButton onClick={generateFleetHealthReport} variant="outline" size="sm" whileTap={{ scale: 0.96 }}>
                <Download className="w-4 h-4 mr-2" />
                {t('reports.fleet.healthReportPdf', 'Rapport Santé PDF')}
              </MButton>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4 mb-6">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                  <div className="flex items-center gap-2 text-blue-800 font-semibold mb-1">
                    <Truck className="w-4 h-4" />
                    {t('reports.fleet.totalVehicles', 'Total Véhicules')}
                  </div>
                  <div className="text-2xl font-bold text-blue-900">{trucks.length}</div>
                </div>
                <div className="bg-red-50 p-4 rounded-lg border border-red-100">
                  <div className="flex items-center gap-2 text-red-800 font-semibold mb-1">
                    <AlertTriangle className="w-4 h-4" />
                    {t('reports.fleet.criticalVehicles', 'Véhicules Critiques')}
                  </div>
                  <div className="text-2xl font-bold text-red-900">
                    {truckHealthAnalysis.filter(t => t.score < 40).length}
                  </div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                  <div className="flex items-center gap-2 text-green-800 font-semibold mb-1">
                    <ThumbsUp className="w-4 h-4" />
                    {t('reports.fleet.goodVehicles', 'Véhicules en Bon État')}
                  </div>
                  <div className="text-2xl font-bold text-green-900">
                    {truckHealthAnalysis.filter(t => t.score >= 70).length}
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto border rounded-lg hidden md:block smart-scroll-x">
                <table className="reports-table-ultra w-full text-sm smart-table">
                  <thead>
                    <tr className="text-left border-b bg-gray-50 sticky top-0">
                      <th className="px-2.5 py-2">{t('reports.fleet.table.vehicle', 'Véhicule')}</th>
                      <th className="px-2.5 py-2">{t('reports.fleet.table.repairsCount', 'Nb Réparations')}</th>
                      <th className="px-2.5 py-2">{t('reports.fleet.table.totalCost', 'Coût Total')}</th>
                      <th className="px-2.5 py-2">{t('reports.fleet.table.health', 'Santé')}</th>
                      <th className="px-2.5 py-2">{t('reports.fleet.table.state', 'État')}</th>
                      <th className="px-2.5 py-2">{t('reports.fleet.table.advice', 'Conseil')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {truckHealthAnalysis.map((t, index) => (
                      <tr key={t.id} className={`border-b hover:bg-gray-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                        <td className="px-2.5 py-2 font-medium">{t.matricule}</td>
                        <td className="px-2.5 py-2">{t.repairCount}</td>
                        <td className="px-2.5 py-2">{t.totalRepairCost.toFixed(2)} DH</td>
                        <td className="px-2.5 py-2">
                          <div className="w-full bg-gray-200 rounded-full h-2 max-w-[100px]">
                            <div 
                              className={`h-2 rounded-full ${
                                t.score >= 70 ? 'bg-green-500' : t.score >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${t.score}%` }}
                            ></div>
                          </div>
                        </td>
                        <td className={`px-2.5 py-2 font-bold ${t.color}`}>
                          {t.score < 40 && <ThumbsDown className="w-4 h-4 inline mr-1" />}
                          {t.score >= 70 && <ThumbsUp className="w-4 h-4 inline mr-1" />}
                          {t.status}
                        </td>
                        <td className="px-2.5 py-2">
                          <Badge variant={t.score < 40 ? 'destructive' : t.score < 70 ? 'default' : 'secondary'}>
                            {t.recommendation}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="md:hidden grid grid-cols-1 gap-2">
                {truckHealthAnalysis.map((row) => (
                  <div key={row.id} className="rounded-xl border border-slate-200 bg-white p-3 app-panel-soft">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">{row.matricule}</span>
                      <Badge variant="outline" className="text-[10px]">{row.status}</Badge>
                    </div>
                    <div className="mt-1 grid grid-cols-3 gap-2 text-xs">
                      <span>{row.repairCount} {t('reports.fleet.table.repairsCount', 'Nb Réparations')}</span>
                      <span className="font-bold">{row.totalRepairCost.toFixed(2)} DH</span>
                      <span>{row.score}%</span>
                    </div>
                    <div className="mt-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div className={`h-2 ${row.score >= 70 ? 'bg-green-500' : row.score >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${row.score}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-4 p-4 bg-gray-50 rounded-lg flex items-start gap-3 border border-gray-200">
                <Info className="w-5 h-5 text-gray-500 mt-0.5" />
                <div className="text-xs text-gray-600">
                  <p className="font-bold mb-1">{t('reports.fleet.analysisHow', "Comment fonctionne l'analyse ?")}</p>
                  {t('reports.fleet.analysisDescription', "L'algorithme calcule un score de santé basé sur la fréquence des pannes et les coûts cumulés. Un score inférieur à 40 indique une machine coûteuse qui devrait être remplacée pour optimiser la rentabilité.")}
                </div>
              </div>
            </CardContent>
          </Card>
          </motion.div>}

          <div id="reports-kpis" className="grid md:grid-cols-4 gap-4">
              {kpiOrder.map((id, index) => {
                const card = kpiCardsConfig[id];
                const Icon = card.icon;
                const canMoveUp = index > 0;
                const canMoveDown = index < kpiOrder.length - 1;
                return (
                  <motion.div key={id} {...cardMotion(index)}>
                  <Card className={`border-slate-200 shadow-sm bg-gradient-to-br ${card.className}`}>
                      <CardHeader className="pb-3">
                          <CardTitle className="flex items-center justify-between gap-2">
                              <span className="flex items-center gap-2 text-base">
                                <Icon className="w-5 h-5" />
                                {card.title}
                              </span>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  disabled={!canMoveUp}
                                  onClick={() => moveKpiCard(id, 'up')}
                                >
                                  <ArrowUp className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  disabled={!canMoveDown}
                                  onClick={() => moveKpiCard(id, 'down')}
                                >
                                  <ArrowDown className="w-4 h-4" />
                                </Button>
                              </div>
                          </CardTitle>
                      </CardHeader>
                      <CardContent>
                          <Badge variant="secondary">{card.value}</Badge>
                      </CardContent>
                  </Card>
                  </motion.div>
                );
              })}
          </div>
  
          {showStockSection && <motion.div {...sectionMotion}>
          <Card id="reports-stock" className="border-slate-200 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xl font-bold flex items-center gap-2">
                      <PieChart className="w-5 h-5 text-purple-600" />
                      {t('reports.stock.title', 'Analyse du stock')}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <div className="relative w-48">
                      <Filter className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder={t('reports.common.search', 'Rechercher...')}
                        className="pl-8 h-9"
                        value={stockSearch}
                        onChange={(e) => setStockSearch(e.target.value)}
                      />
                    </div>
                  </div>
              </CardHeader>
              <CardContent>
                  <div className="grid md:grid-cols-5 gap-4 mb-6">
                    <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
                      <div className="text-purple-800 text-sm font-semibold mb-1">{t('reports.stock.remainingValue', 'Valeur Stock Restant')}</div>
                      <div className="text-2xl font-bold text-purple-900">
                        {stockRemainingValue.toFixed(2)} MAD
                      </div>
                      {renderKpiComparison(stockComparison.stockValueRemaining, ' MAD')}
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                      <div className="text-green-800 text-sm font-semibold mb-1">{t('reports.stock.totalUnits', 'Total Unités')}</div>
                      <div className="text-2xl font-bold text-green-900">
                        {stockTotalUnits}
                      </div>
                      {renderKpiComparison(stockComparison.totalUnits)}
                    </div>
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                      <div className="text-blue-800 text-sm font-semibold mb-1">{t('reports.stock.distributedUnits', 'Unités Distribuées')}</div>
                      <div className="text-2xl font-bold text-blue-900">
                        {stockDistributedUnits}
                      </div>
                      {renderKpiComparison(stockComparison.distributedUnits)}
                    </div>
                    <div className="bg-orange-50 p-4 rounded-lg border border-orange-100">
                      <div className="text-orange-800 text-sm font-semibold mb-1">{t('reports.stock.averageDistributionRate', 'Taux de Distribution Moyen')}</div>
                      <div className="text-2xl font-bold text-orange-900">
                        {stockAverageDistributionRate.toFixed(1)}%
                      </div>
                      {renderKpiComparison(stockComparison.averageDistributionRate, '%')}
                    </div>
                    <div className="bg-red-50 p-4 rounded-lg border border-red-100">
                      <div className="text-red-800 text-sm font-semibold mb-1 flex items-center gap-1">
                        <AlertTriangle className="w-4 h-4" />
                        {t('reports.stock.detectedAnomalies', 'Anomalies détectées')}
                      </div>
                      <div className="text-2xl font-bold text-red-900">
                        {stockAnomalies.length}
                      </div>
                      <div className="mt-1 text-xs text-red-700 min-h-8">
                        {stockAnomalies.length > 0 ? stockAnomalies[0].message : t('reports.stock.noCriticalAnomaly', 'Aucune anomalie critique')}
                      </div>
                    </div>
                  </div>

                  <div className="hidden md:block overflow-x-auto border rounded-lg smart-scroll-x">
                      <table className="reports-table-ultra w-full text-sm smart-table">
                          <thead>
                              <tr className="text-left border-b bg-gray-50 sticky top-0">
                                  <th className="p-3">{t('reports.stock.table.bottleType', 'Type de Bouteille')}</th>
                                  <th className="p-3 text-center">{t('reports.stock.table.total', 'Total')}</th>
                                  <th className="p-3 text-center">{t('reports.stock.table.distributedUnits', 'Unités Distribuées')}</th>
                                  <th className="p-3 text-center">{t('reports.stock.table.remaining', 'Restant')}</th>
                                  <th className="p-3 text-right">{t('reports.stock.table.value', 'Valeur')}</th>
                                  <th className="p-3">{t('reports.stock.table.distributionRate', 'Taux de Distribution')}</th>
                                  <th className="p-3">{t('reports.stock.table.state', 'État')}</th>
                              </tr>
                          </thead>
                          <tbody>
                              {stockAnalysis
                                .filter(s => {
                                  const query = stockSearch.trim().toLowerCase();
                                  if (!query) return true;
                                  return s.name.toLowerCase().includes(query);
                                })
                                .map((s, index) => (
                                  <tr key={s.name} className={`border-b hover:bg-gray-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                                      <td className="p-3 font-medium">{s.name}</td>
                                      <td className="p-3 text-center">{s.total}</td>
                                      <td className="p-3 text-center text-blue-600 font-semibold">{s.distributed}</td>
                                      <td className="p-3 text-center text-green-600 font-semibold">{s.remaining}</td>
                                      <td className="p-3 text-right font-mono">{s.value.toFixed(2)}</td>
                                      <td className="p-3">
                                        <div className="flex items-center gap-2">
                                          <div className="w-full bg-gray-200 rounded-full h-2 min-w-[100px]">
                                            <div 
                                              className="bg-blue-600 h-2 rounded-full transition-all"
                                              style={{ width: `${Math.min(100, s.distributionRate)}%` }}
                                            ></div>
                                          </div>
                                          <span className="text-xs font-semibold">{s.distributionRate.toFixed(1)}%</span>
                                        </div>
                                      </td>
                                      <td className="p-3">
                                        <Badge className={`${s.statusColor} bg-white border`}>
                                          {s.status}
                                        </Badge>
                                      </td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
                  <div className="md:hidden grid grid-cols-1 gap-2">
                    {stockAnalysis
                      .filter(s => {
                        const query = stockSearch.trim().toLowerCase();
                        if (!query) return true;
                        return s.name.toLowerCase().includes(query);
                      })
                      .map((s) => (
                        <div key={s.name} className="rounded-xl border border-slate-200 bg-white p-3 app-panel-soft">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold">{s.name}</span>
                            <Badge variant="outline" className="text-[10px]">{s.status}</Badge>
                          </div>
                          <div className="mt-1 grid grid-cols-3 gap-2 text-xs">
                            <span>{t('reports.stock.table.total', 'Total')}: {s.total}</span>
                            <span className="text-blue-700 font-semibold">{t('reports.stock.table.distributedUnits', 'Unités Distribuées')}: {s.distributed}</span>
                            <span className="text-green-700 font-semibold">{t('reports.stock.table.remaining', 'Restant')}: {s.remaining}</span>
                          </div>
                          <div className="mt-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div className="h-2 bg-blue-600" style={{ width: `${Math.min(100, s.distributionRate)}%` }} />
                          </div>
                          <div className="mt-1 text-xs font-semibold">{s.value.toFixed(2)} MAD</div>
                        </div>
                      ))}
                  </div>
              </CardContent>
          </Card>
          </motion.div>}
  
          {showDriversSection && <motion.div {...sectionMotion}>
          <Card id="reports-drivers" className="border-slate-200 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xl font-bold flex items-center gap-2">
                      <Users className="w-5 h-5 text-blue-600" />
                      {t('reports.drivers.title', 'Analyse des chauffeurs')}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <div className="relative w-48">
                      <Filter className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder={t('reports.common.search', 'Rechercher...')}
                        className="pl-8 h-9"
                        value={driverSearch}
                        onChange={(e) => setDriverSearch(e.target.value)}
                      />
                    </div>
                  </div>
              </CardHeader>
              <CardContent>
                  <div className="grid md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-red-50 p-4 rounded-lg border border-red-100">
                      <div className="text-red-800 text-sm font-semibold mb-1">{t('reports.drivers.totalDebts', 'Total Dettes')}</div>
                      <div className="text-2xl font-bold text-red-900">
                        {driverAnalysis.reduce((sum, d) => sum + d.debt, 0).toFixed(2)} MAD
                      </div>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                      <div className="text-green-800 text-sm font-semibold mb-1">{t('reports.drivers.totalAdvances', 'Total Acomptes')}</div>
                      <div className="text-2xl font-bold text-green-900">
                        {driverAnalysis.reduce((sum, d) => sum + d.advances, 0).toFixed(2)} MAD
                      </div>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                      <div className="text-blue-800 text-sm font-semibold mb-1">{t('reports.drivers.globalNetBalance', 'Solde Net Global')}</div>
                      <div className="text-2xl font-bold text-blue-900">
                        {driverAnalysis.reduce((sum, d) => sum + d.balance, 0).toFixed(2)} MAD
                      </div>
                    </div>
                  </div>

                  <div className="hidden md:block overflow-x-auto border rounded-lg smart-scroll-x">
                      <table className="reports-table-ultra w-full text-sm smart-table">
                          <thead>
                              <tr className="text-left border-b bg-gray-50 sticky top-0">
                                  <th className="p-3">{t('reports.drivers.table.driver', 'Chauffeur')}</th>
                                  <th className="p-3 text-right">{t('reports.drivers.table.cumulativeDebt', 'Dette (Cumulée)')}</th>
                                  <th className="p-3 text-right">{t('reports.drivers.table.advances', 'Acomptes')}</th>
                                  <th className="p-3 text-right">{t('reports.drivers.table.currentBalance', 'Solde Actuel')}</th>
                                  <th className="p-3 text-center">{t('reports.drivers.table.status', 'Statut')}</th>
                                  <th className="p-3">{t('reports.drivers.table.progress', 'Progression')}</th>
                              </tr>
                          </thead>
                          <tbody>
                              {driverAnalysis
                                .filter(d => d.name.toLowerCase().includes(driverSearch.toLowerCase()))
                                .map((d, index) => (
                                  <tr key={d.id} className={`border-b hover:bg-gray-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                                      <td className="p-3 font-medium">{d.name}</td>
                                      <td className="p-3 text-right text-red-600 font-mono">{d.debt.toFixed(2)}</td>
                                      <td className="p-3 text-right text-green-600 font-mono">{d.advances.toFixed(2)}</td>
                                      <td className={`p-3 text-right font-bold font-mono ${d.balance < 0 ? 'text-red-600' : d.balance > 0 ? 'text-green-600' : ''}`}>
                                        {d.balance.toFixed(2)}
                                      </td>
                                      <td className="p-3 text-center">
                                          <Badge variant={d.statusVariant}>
                                            {d.status}
                                          </Badge>
                                      </td>
                                      <td className="p-3">
                                        <div className="w-full bg-gray-200 rounded-full h-1.5 max-w-[100px]">
                                          <div 
                                            className={`h-1.5 rounded-full ${d.balance < 0 ? 'bg-red-500' : 'bg-green-500'}`}
                                            style={{ 
                                              width: `${Math.min(100, Math.abs(d.balance) / 100)}%` 
                                            }}
                                          ></div>
                                        </div>
                                      </td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
                  <div className="md:hidden grid grid-cols-1 gap-2">
                    {driverAnalysis
                      .filter(d => d.name.toLowerCase().includes(driverSearch.toLowerCase()))
                      .map((d) => (
                        <div key={d.id} className="rounded-xl border border-slate-200 bg-white p-3 app-panel-soft">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold">{d.name}</span>
                            <Badge variant={d.statusVariant} className="text-[10px]">{d.status}</Badge>
                          </div>
                          <div className="mt-1 grid grid-cols-3 gap-2 text-xs">
                            <span className="text-red-700 font-semibold">{t('reports.drivers.table.cumulativeDebt', 'Dette')}: {d.debt.toFixed(2)}</span>
                            <span className="text-green-700 font-semibold">{t('reports.drivers.table.advances', 'Acomptes')}: {d.advances.toFixed(2)}</span>
                            <span className={`${d.balance < 0 ? 'text-red-700' : 'text-green-700'} font-semibold`}>{t('reports.drivers.table.currentBalance', 'Solde')}: {d.balance.toFixed(2)}</span>
                          </div>
                          <div className="mt-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div className={`h-2 ${d.balance < 0 ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${Math.min(100, Math.abs(d.balance) / 100)}%` }} />
                          </div>
                        </div>
                      ))}
                  </div>
              </CardContent>
          </Card>
          </motion.div>}
  
          {showTransactionsSection && <motion.div {...sectionMotion}>
          <Card id="reports-transactions" className="border-slate-200 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xl font-bold flex items-center gap-2">
                      <FileText className="w-5 h-5 text-indigo-600" />
                      {t('reports.transactions.title', 'Historique des transactions')}
                  </CardTitle>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    <MButton
                      variant="outline"
                      size="sm"
                      whileTap={{ scale: 0.96 }}
                      onClick={() => {
                        setShowTransactions((v) => !v);
                        setExpandedTransactionId(null);
                      }}
                    >
                      {showTransactions ? t('reports.common.hide', 'Cacher') : t('reports.common.show', 'Afficher')}
                    </MButton>
                    <MButton
                      variant="outline"
                      size="sm"
                      whileTap={{ scale: 0.96 }}
                      onClick={() => setShowReference(v => !v)}
                    >
                      {showReference ? t('reports.transactions.hideReference', 'Cacher Référence') : t('reports.transactions.showReference', 'Afficher Référence')}
                    </MButton>
                    <Select value={transactionsSort} onValueChange={(v) => setTransactionsSort(v as any)}>
                      <SelectTrigger className="h-9 w-[170px]">
                        <SelectValue placeholder={t('reports.transactions.sort', 'Tri')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="date_desc">{t('reports.transactions.sortDateDesc', 'Date ↓')}</SelectItem>
                        <SelectItem value="date_asc">{t('reports.transactions.sortDateAsc', 'Date ↑')}</SelectItem>
                        <SelectItem value="value_desc">{t('reports.transactions.sortValueDesc', 'Valeur ↓')}</SelectItem>
                        <SelectItem value="value_asc">{t('reports.transactions.sortValueAsc', 'Valeur ↑')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={transactionsLimit} onValueChange={(v) => setTransactionsLimit(v as any)}>
                      <SelectTrigger className="h-9 w-[140px]">
                        <SelectValue placeholder={t('reports.transactions.limit', 'Limiter')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="25">25 {t('reports.transactions.lines', 'lignes')}</SelectItem>
                        <SelectItem value="50">50 {t('reports.transactions.lines', 'lignes')}</SelectItem>
                        <SelectItem value="100">100 {t('reports.transactions.lines', 'lignes')}</SelectItem>
                        <SelectItem value="all">{t('reports.filters.all', 'Tous')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={transactionTypeFilter} onValueChange={(v) => setTransactionTypeFilter(v as any)}>
                      <SelectTrigger className="h-9 w-[170px]">
                        <SelectValue placeholder={t('reports.filters.type', 'Type')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('reports.transactions.allTypes', 'Tous types')}</SelectItem>
                        <SelectItem value="supply">{t('reports.types.supply', 'Alimentation')}</SelectItem>
                        <SelectItem value="return">{t('reports.types.return', 'Retour')}</SelectItem>
                        <SelectItem value="exchange">{t('reports.types.exchange', 'Échange')}</SelectItem>
                        <SelectItem value="factory">{t('reports.types.factory', 'Usine')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <MButton
                      variant={showNonZeroOnly ? 'default' : 'outline'}
                      size="sm"
                      whileTap={{ scale: 0.96 }}
                      onClick={() => setShowNonZeroOnly(v => !v)}
                    >
                      {showNonZeroOnly ? t('reports.transactions.amountGtZero', 'Montants > 0') : t('reports.transactions.allAmounts', 'Tous montants')}
                    </MButton>
                    <div className="relative w-64">
                      <Filter className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder={t('reports.transactions.searchPlaceholder', 'Chercher (Chauffeur, Client, Camion...)')}
                        className="pl-8 h-9"
                        value={transactionSearch}
                        onChange={(e) => setTransactionSearch(e.target.value)}
                      />
                    </div>
                  </div>
              </CardHeader>
              <CardContent>
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{filteredTransactions.length} {t('reports.transactions.operations', 'opérations')}</Badge>
                      <Badge variant="secondary">{totalValue.toFixed(2)} MAD</Badge>
                      <Badge variant="outline">
                        {t('reports.transactions.supplyShort', 'Alim')}: {transactionsByType.supply} | {t('reports.transactions.returnShort', 'Ret')}: {transactionsByType.return} | {t('reports.transactions.exchangeShort', 'Éch')}: {transactionsByType.exchange} | {t('reports.types.factory', 'Usine')}: {transactionsByType.factory}
                      </Badge>
                      <Badge variant="outline">{t('reports.transactions.displayed', 'Affiché')}: {visibleTransactionsTotal.toFixed(2)} MAD</Badge>
                      <Badge variant="outline">{t('reports.transactions.withAmount', 'Avec montant')}: {visibleTransactionsWithValue}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {t('reports.transactions.displayed', 'Affiché')}: {visibleTransactions.length}/{tableFilteredTransactions.length}
                      </span>
                    </div>
                  </div>

                  {!showTransactions ? (
                    <div className="text-sm text-muted-foreground py-6 text-center border rounded-lg bg-gray-50">
                      {t('reports.transactions.historyHidden', 'Historique masqué.')}
                    </div>
                  ) : (
                    <>
                    <div className="hidden md:block overflow-x-auto border rounded-lg smart-scroll-x">
                        <table className="reports-table-ultra w-full text-sm smart-table">
                            <thead>
                                <tr className="text-left border-b bg-gray-50 sticky top-0">
                                        <th className="px-3 py-2.5 text-center w-14">#</th>
                                        <th className="px-3 py-2.5">{t('reports.table.date', 'Date')}</th>
                                        <th className="px-3 py-2.5">{t('reports.table.type', 'Type')}</th>
                                        <th className="px-3 py-2.5">{t('reports.table.driver', 'Chauffeur')}</th>
                                        <th className="px-3 py-2.5">{t('reports.table.client', 'Client')}</th>
                                        {showReference && <th className="px-3 py-2.5">{t('reports.table.reference', 'Référence')}</th>}
                                        <th className="px-3 py-2.5">{t('reports.table.truck', 'Camion')}</th>
                                        <th className="px-3 py-2.5 text-right">{t('reports.table.valueMad', 'Valeur (MAD)')}</th>
                                        <th className="px-3 py-2.5 text-center">{t('reports.table.details', 'Détails')}</th>
                                    </tr>
                            </thead>
                            <tbody>
                                {visibleTransactions.map((t: any, index: number) => {
                                    let dName = drivers.find((d) => d.id === t.driverId)?.name || '-';
                                    const rawDetails = t.details ?? t.detail ?? t.meta ?? t.data;
                                    let parsedDetails: any = undefined;
                                    if (typeof rawDetails === 'string') {
                                      try {
                                        parsedDetails = JSON.parse(rawDetails);
                                      } catch {
                                        parsedDetails = undefined;
                                      }
                                    } else if (rawDetails && typeof rawDetails === 'object') {
                                      parsedDetails = rawDetails;
                                    }
                                    const detailTruckId = parsedDetails?.truckId ?? parsedDetails?.truck_id;
                                    const detailTruckName =
                                      parsedDetails?.truckName ??
                                      parsedDetails?.truck ??
                                      parsedDetails?.camion ??
                                      parsedDetails?.plateNumber ??
                                      parsedDetails?.registration;

                                    const trk = trucks.find((tr) => String(tr.id) === String(t.truckId || detailTruckId)) as any;
                                    let tName = (trk?.name || trk?.plateNumber || trk?.registration || trk?.matricule || detailTruckName || '-') as string;

                                    const supplyOrder = t.type === 'supply'
                                      ? supplyOrders.find((o: any) => o.id === t.relatedOrderId || o.orderNumber === t.relatedOrderId)
                                      : undefined;
                                    const returnOrder = t.type === 'return'
                                      ? returnOrders.find((o: any) => o.id === t.relatedOrderId || o.orderNumber === t.relatedOrderId)
                                      : undefined;

                                    const isFactoryType =
                                      t.type === 'factory' ||
                                      t.type === 'factory_reception' ||
                                      t.type === 'factory_invoice' ||
                                      t.type === 'factory_settlement';

                                    let cName = '-';
                                    if (supplyOrder) cName = supplyOrder.clientName || '-';
                                    else if (returnOrder) cName = returnOrder.clientName || '-';
                                    else if (isFactoryType) {
                                      const supplierId = t.supplierId || parsedDetails?.supplierId || parsedDetails?.supplier_id;
                                      if (supplierId) {
                                        const sup = suppliers.find(s => String(s.id) === String(supplierId));
                                        cName = sup?.name || '-';
                                      }
                                    }

                                    const detailRef =
                                      parsedDetails?.reference ??
                                      parsedDetails?.ref ??
                                      parsedDetails?.orderNumber ??
                                      parsedDetails?.blReference ??
                                      parsedDetails?.bl ??
                                      parsedDetails?.id;
                                    const rawRef = String(
                                      supplyOrder?.orderNumber ||
                                      returnOrder?.orderNumber ||
                                      t.orderNumber ||
                                      t.reference ||
                                      t.ref ||
                                      detailRef ||
                                      t.relatedOrderId ||
                                      t.id ||
                                      ''
                                    );
                                    let ref = rawRef ? rawRef : '-';
                                    const dateLabel = t?.date
                                      ? new Date(t.date).toLocaleString(uiLocale, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
                                      : '-';

                                    if (isFactoryType && (tName === '-' || !rawRef || ref === '-' || dName === '-')) {
                                      const td = new Date(t.date || 0).getTime();
                                      const match = factoryOps.find((op: any) => {
                                        const od = new Date(op.receivedDate || op.date).getTime();
                                        const diff = Math.abs(od - td);
                                        const supplierMatch = !t.supplierId || String(op.supplierId || '') === String(t.supplierId);
                                        const refMatch = !!rawRef && rawRef !== '-' && op.blReference && String(op.blReference) === String(rawRef);
                                        const opIdMatch = parsedDetails?.operationId && String(op.id) === String(parsedDetails.operationId);
                                        return refMatch || opIdMatch || (diff <= 2 * 60 * 60 * 1000 && supplierMatch);
                                      });
                                      if (match) {
                                        const tr2 = trucks.find(tr => String(tr.id) === String(match.truckId)) as any;
                                        const tName2 = (tr2?.name || tr2?.plateNumber || tr2?.registration || tr2?.matricule || '-') as string;
                                        if (tName === '-' && tName2 !== '-') tName = tName2;
                                        if ((!rawRef || rawRef === '-' || ref === '-') && match.blReference) ref = match.blReference;
                                        if (dName === '-') {
                                          const drvFromTruckId = tr2?.driverId;
                                          if (drvFromTruckId) {
                                            const drv = drivers.find(d => d.id === drvFromTruckId);
                                            if (drv?.name) dName = drv.name;
                                          } else if (match.driverName) {
                                            dName = match.driverName;
                                          }
                                        }
                                      }
                                    }
                                    if (dName === '-') {
                                      const pdDriverId = parsedDetails?.driverId ?? parsedDetails?.driver_id;
                                      if (pdDriverId) {
                                        const drv = drivers.find(d => d.id === pdDriverId);
                                        if (drv?.name) dName = drv.name;
                                      } else {
                                        const trForD = trucks.find(tr => tr.id === (t.truckId || detailTruckId)) as any;
                                        const drv2Id = trForD?.driverId;
                                        if (drv2Id) {
                                          const drv2 = drivers.find(d => d.id === drv2Id);
                                          if (drv2?.name) dName = drv2.name;
                                        } else {
                                          const nameHint = parsedDetails?.driverName ?? parsedDetails?.driver ?? parsedDetails?.chauffeur;
                                          if (nameHint) dName = String(nameHint);
                                        }
                                      }
                                    }

                                    const valueNumber = getTransactionValue(t);
                                    const typeMeta = getTypeMeta(String(t.type || ''));

                                    const isExpanded = expandedTransactionId === t.id;
                                    const bottleBreakdown = (t.bottleTypes || []).map((bt: any) => {
                                      const name = bottleTypes.find((b) => b.id === bt.bottleTypeId)?.name || bt.bottleTypeName || bt.bottleTypeId || '-';
                                      return {
                                        key: `${t.id}-${bt.bottleTypeId}-${bt.status || 'na'}`,
                                        name,
                                        quantity: Number(bt.quantity || 0),
                                        status: bt.status ? String(bt.status) : '',
                                      };
                                    });

                                    return (
                                      <React.Fragment key={t.id}>
                                        <tr className={`border-b hover:bg-gray-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                                          <td className="px-3 py-2.5 text-center text-xs text-muted-foreground">{index + 1}</td>
                                          <td className="px-3 py-2.5">{dateLabel}</td>
                                          <td className="px-3 py-2.5">
                                            <Badge variant="outline" className={typeMeta.className}>
                                              {typeMeta.label}
                                            </Badge>
                                          </td>
                                          <td className="px-3 py-2.5 font-medium">{dName}</td>
                                          <td className="px-3 py-2.5">{cName}</td>
                                        {showReference && (
                                          <td className="px-3 py-2.5 font-mono text-xs max-w-[220px] truncate" title={ref}>
                                            {ref}
                                          </td>
                                        )}
                                          <td className="px-3 py-2.5">{tName}</td>
                                        <td className={`px-3 py-2.5 text-right font-bold ${valueNumber > 0 ? 'text-slate-900' : 'text-slate-400'}`}>{valueNumber.toFixed(2)}</td>
                                          <td className="px-3 py-2.5 text-center">
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-8 w-8 p-0"
                                              onClick={() => setExpandedTransactionId((prev) => (prev === t.id ? null : t.id))}
                                            >
                                              <Info className="h-4 w-4 text-blue-600" />
                                            </Button>
                                          </td>
                                        </tr>
                                        {isExpanded && (
                                          <tr className="border-b bg-white">
                                        <td className="px-3 py-2.5" colSpan={showReference ? 9 : 8}>
                                              <div className="grid md:grid-cols-3 gap-3">
                                                <div className="text-sm">
                                                  <div className="text-xs text-muted-foreground">{t('reports.transactions.identifier', 'Identifiant')}</div>
                                                  <div className="font-mono text-xs">{String(t.id || '-')}</div>
                                                </div>
                                                <div className="text-sm">
                                                  <div className="text-xs text-muted-foreground">{t('reports.table.total', 'Total')}</div>
                                                  <div className="font-bold">{valueNumber.toFixed(2)} MAD</div>
                                                </div>
                                                <div className="text-sm">
                                                  <div className="text-xs text-muted-foreground">{t('reports.table.bottles', 'Bouteilles')}</div>
                                                  <div className="flex flex-wrap gap-2 mt-1">
                                                    {bottleBreakdown.length === 0 ? (
                                                      <span className="text-xs text-muted-foreground">—</span>
                                                    ) : (
                                                      bottleBreakdown.map((b: any) => (
                                                        <Badge key={b.key} variant="secondary" className="text-xs">
                                                          {b.quantity} {b.name}{b.status ? ` (${b.status})` : ''}
                                                        </Badge>
                                                      ))
                                                    )}
                                                  </div>
                                                </div>
                                              </div>
                                            </td>
                                          </tr>
                                        )}
                                      </React.Fragment>
                                    );
                                })}
                                {visibleTransactions.length === 0 && (
                                  <tr>
                                    <td className="p-4 text-center text-sm text-muted-foreground" colSpan={showReference ? 9 : 8}>
                                      {t('reports.transactions.noTransactionForFilters', 'Aucune transaction pour ces filtres.')}
                                    </td>
                                  </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div className="md:hidden grid grid-cols-1 gap-2">
                      {visibleTransactions.map((t: any, index: number) => {
                        const valueNumber = getTransactionValue(t);
                        const typeMeta = getTypeMeta(String(t.type || ''));
                        const dateLabel = t?.date
                          ? new Date(t.date).toLocaleString(uiLocale, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
                          : '-';
                        const dName = drivers.find((d) => d.id === t.driverId)?.name || '-';
                        const trk = trucks.find((tr) => String(tr.id) === String(t.truckId)) as any;
                        const tName = (trk?.name || trk?.plateNumber || trk?.registration || trk?.matricule || '-') as string;
                        return (
                          <div key={t.id} className="rounded-xl border border-slate-200 bg-white p-3 app-panel-soft">
                            <div className="flex items-center justify-between">
                              <Badge variant="outline" className={typeMeta.className + ' text-[10px]'}>{typeMeta.label}</Badge>
                              <span className="text-xs text-muted-foreground">{dateLabel}</span>
                            </div>
                            <div className="mt-1 text-sm font-semibold">{dName}</div>
                            <div className="text-xs text-muted-foreground">{tName}</div>
                            <div className={`mt-1 text-sm font-bold ${valueNumber > 0 ? 'text-slate-900' : 'text-slate-400'}`}>{valueNumber.toFixed(2)} MAD</div>
                          </div>
                        );
                      })}
                    </div>
                    </>
                  )}
              </CardContent>
          </Card>
          </motion.div>}
  
          {showDailyReportsSection && <motion.div {...sectionMotion}>
          <Card id="reports-daily" className="border-slate-200 shadow-sm">
              <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                      <Truck className="w-5 h-5" />
                      {t('reports.daily.title', 'Rapport Journalier des Chauffeurs')}
                  </CardTitle>
              </CardHeader>
              <CardContent>
                  <div className="grid md:grid-cols-4 gap-4 mb-4">
                      <div>
                          <Label>{t('reports.filters.start', 'Début')} <span className="text-xs text-muted-foreground">{tr('(jj/mm/aaaa)', '(يوم/شهر/سنة)')}</span></Label>
                          <Input
                              type="date"
                              value={dailyStartDate}
                              onChange={(e) => setDailyStartDate(e.target.value)}
                          />
                      </div>
                      <div>
                          <Label>{t('reports.filters.end', 'Fin')} <span className="text-xs text-muted-foreground">{tr('(jj/mm/aaaa)', '(يوم/شهر/سنة)')}</span></Label>
                          <Input
                              type="date"
                              value={dailyEndDate}
                              onChange={(e) => setDailyEndDate(e.target.value)}
                          />
                      </div>
                      <div>
                          <Label>{t('reports.filters.driver', 'Chauffeur')}</Label>
                          <Select value={dailyReportDriver} onValueChange={setDailyReportDriver}>
                              <SelectTrigger>
                                  <SelectValue placeholder={t('reports.filters.all', 'Tous')} />
                              </SelectTrigger>
                              <SelectContent>
                                  <SelectItem value="all">{t('reports.filters.all', 'Tous')}</SelectItem>
                                  {drivers.map((d) => (
                                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                  ))}
                              </SelectContent>
                          </Select>
                      </div>
                      <div>
                          <Label>{t('reports.daily.quickPeriod', 'Période rapide')}</Label>
                          <div className="grid grid-cols-3 gap-2">
                            <MButton type="button" variant="outline" className="h-10" whileTap={{ scale: 0.98 }} onClick={() => applyDailyPeriodPreset('today')}>{t('reports.daily.today', "Aujourd'hui")}</MButton>
                            <MButton type="button" variant="outline" className="h-10" whileTap={{ scale: 0.98 }} onClick={() => applyDailyPeriodPreset('last7')}>{t('reports.daily.last7Days', '7 jours')}</MButton>
                            <MButton type="button" variant="outline" className="h-10" whileTap={{ scale: 0.98 }} onClick={() => applyDailyPeriodPreset('month')}>{t('reports.daily.month', 'Mois')}</MButton>
                          </div>
                      </div>
                  </div>

                  <div className="mb-4 rounded-lg border bg-slate-50 p-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm">
                      <span className="font-semibold">{t('reports.daily.period', 'Période')}:</span> {periodLabel || t('reports.daily.notDefined', 'Non définie')} · <span className="font-semibold">{t('reports.filters.driver', 'Chauffeur')}:</span> {dailyReportDriver === 'all' ? t('reports.filters.all', 'Tous') : (drivers.find(d => d.id === dailyReportDriver)?.name || t('reports.daily.unknown', 'Inconnu'))}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-1">
                        <Button
                          type="button"
                          size="sm"
                          variant={dailyReportsDisplayMode === 'list' ? 'default' : 'ghost'}
                          className="h-7 px-2 text-xs"
                          onClick={() => setDailyReportsDisplayMode('list')}
                        >
                          {t('reports.daily.list', 'Liste')}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={dailyReportsDisplayMode === 'cards' ? 'default' : 'ghost'}
                          className="h-7 px-2 text-xs"
                          onClick={() => setDailyReportsDisplayMode('cards')}
                        >
                          {t('reports.daily.cards', 'Cards')}
                        </Button>
                      </div>
                      <Button
                        onClick={generateAllDailyReports}
                        disabled={isBulkGeneratingReports}
                        className="h-9 px-3 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        {isBulkGeneratingReports ? t('reports.daily.generating', 'Génération en cours...') : t('reports.daily.downloadAllReports', 'Télécharger Tous les Rapports')}
                      </Button>
                    </div>
                  </div>

                  {isBulkGeneratingReports && (
                    <div className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50/60 p-2.5">
                      <div className="mb-1.5 flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-indigo-700">
                          {t('reports.daily.progress', 'Progression')} {completedReportIds.length}/{dailyReportActions.length}
                        </span>
                        <span className="text-indigo-600">
                          {activeReportId ? dailyReportActions.find((item) => item.id === activeReportId)?.label || '' : ''}
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-indigo-100">
                        <motion.div
                          className="h-full rounded-full bg-indigo-600"
                          animate={{ width: `${Math.max(6, (completedReportIds.length / Math.max(1, dailyReportActions.length)) * 100)}%` }}
                          transition={{ duration: 0.35, ease: 'easeOut' }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="mb-4 pb-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {dailyReportActions.map((report, index) => {
                        const isRunning = activeReportId === report.id || isBulkGeneratingReports;
                        const isDone = completedReportIds.includes(report.id);
                        const isCurrent = activeReportId === report.id;
                        const isGlow = glowingReportIds.includes(report.id);
                        const tone = getDailyActionTone(index, isCurrent, isDone);
                        return (
                          <React.Fragment key={`timeline-${report.id}`}>
                            <MButton
                              variant={isCurrent ? 'default' : isDone ? 'secondary' : 'outline'}
                              size="sm"
                              className={`h-7 rounded-full px-2.5 text-[11px] max-w-[220px] truncate ${tone.chip}`}
                              onClick={() => runReportAction(report.id, report.action)}
                              disabled={isRunning}
                              whileHover={{ y: -1, scale: 1.02 }}
                              whileTap={{ scale: 0.96 }}
                              animate={isGlow ? { boxShadow: ['0 0 0 rgba(16,185,129,0)', '0 0 0 6px rgba(16,185,129,0.22)', '0 0 0 rgba(16,185,129,0)'] } : undefined}
                              transition={isGlow ? { duration: 0.9, ease: 'easeOut' } : undefined}
                            >
                              <span className="mr-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-black/10 px-1 text-[10px]">
                                {index + 1}
                              </span>
                              <span className="truncate">{report.label}</span>
                            </MButton>
                            {index < dailyReportActions.length - 1 && <div className="hidden md:block h-px w-4 bg-slate-300" />}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>

                  {dailyReportsDisplayMode === 'cards' ? (
                  <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-2">
                      {dailyReportActions.map((report, index) => {
                        const isRunning = activeReportId === report.id || isBulkGeneratingReports;
                        const isCurrent = activeReportId === report.id;
                        const isDone = completedReportIds.includes(report.id);
                        const isGlow = glowingReportIds.includes(report.id);
                        const showSuccessCue = isGlow && isDone && !isCurrent;
                        const tone = getDailyActionTone(index, isCurrent, isDone);
                        return (
                          <motion.div key={report.id} {...cardMotion(index)} whileHover={{ y: -2, scale: 1.01 }} animate={isGlow ? { boxShadow: ['0 0 0 rgba(16,185,129,0)', '0 0 0 7px rgba(16,185,129,0.18)', '0 0 0 rgba(16,185,129,0)'] } : undefined} transition={isGlow ? { duration: 0.95, ease: 'easeOut' } : undefined} className={`rounded-lg border bg-white p-2.5 shadow-sm ${tone.card}`}>
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-slate-900 truncate">{report.label}</p>
                                <p className={`text-[11px] mt-1 ${isCurrent || isDone ? tone.status : 'text-slate-500'}`}>
                                  {isCurrent ? t('reports.daily.generating', 'Génération en cours...') : isDone ? t('reports.daily.done', 'Terminé') : t('reports.daily.ready', 'Prêt')}
                                </p>
                              </div>
                              <MButton
                                onClick={() => runReportAction(report.id, report.action)}
                                variant={report.variant || 'outline'}
                                size="sm"
                                className={`h-7 px-2 shrink-0 text-[11px] ${tone.button}`}
                                disabled={isRunning}
                                whileHover={{ y: -1, scale: 1.04 }}
                                whileTap={{ scale: 0.96 }}
                              >
                                <motion.span
                                  className="mr-1 inline-flex"
                                  animate={showSuccessCue ? { scale: [1, 1.18, 1], rotate: [0, -8, 0] } : { scale: 1, rotate: 0 }}
                                  transition={{ duration: 0.45, ease: 'easeOut' }}
                                >
                                  {showSuccessCue ? <ThumbsUp className="w-3 h-3" /> : <Download className="w-3 h-3" />}
                                </motion.span>
                                {showSuccessCue ? t('reports.daily.doneShort', 'OK') : t('reports.daily.downloadOneShort', 'PDF')}
                              </MButton>
                            </div>
                          </motion.div>
                        );
                      })}
                  </div>
                  ) : (
                  <div className="space-y-2">
                    {dailyReportActions.map((report, index) => {
                      const isRunning = activeReportId === report.id || isBulkGeneratingReports;
                      const isCurrent = activeReportId === report.id;
                      const isDone = completedReportIds.includes(report.id);
                      const isGlow = glowingReportIds.includes(report.id);
                      const showSuccessCue = isGlow && isDone && !isCurrent;
                      const tone = getDailyActionTone(index, isCurrent, isDone);
                      return (
                        <motion.div key={`list-${report.id}`} {...cardMotion(index)} whileHover={{ y: -1, scale: 1.005 }} animate={isGlow ? { boxShadow: ['0 0 0 rgba(16,185,129,0)', '0 0 0 7px rgba(16,185,129,0.18)', '0 0 0 rgba(16,185,129,0)'] } : undefined} transition={isGlow ? { duration: 0.95, ease: 'easeOut' } : undefined} className={`rounded-lg border bg-white p-2.5 shadow-sm ${tone.card}`}>
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0 flex items-center gap-2">
                              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-700">{index + 1}</span>
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-slate-900 truncate">{report.label}</p>
                                <p className={`text-[11px] ${isCurrent || isDone ? tone.status : 'text-slate-500'}`}>
                                  {isCurrent ? t('reports.daily.generating', 'Génération en cours...') : isDone ? t('reports.daily.done', 'Terminé') : t('reports.daily.ready', 'Prêt')}
                                </p>
                              </div>
                            </div>
                            <MButton
                              onClick={() => runReportAction(report.id, report.action)}
                              variant={report.variant || 'outline'}
                              size="sm"
                              className={`h-7 px-2 shrink-0 text-[11px] ${tone.button}`}
                              disabled={isRunning}
                              whileHover={{ y: -1, scale: 1.04 }}
                              whileTap={{ scale: 0.96 }}
                            >
                              <motion.span
                                className="mr-1 inline-flex"
                                animate={showSuccessCue ? { scale: [1, 1.18, 1], rotate: [0, -8, 0] } : { scale: 1, rotate: 0 }}
                                transition={{ duration: 0.45, ease: 'easeOut' }}
                              >
                                {showSuccessCue ? <ThumbsUp className="w-3 h-3" /> : <Download className="w-3 h-3" />}
                              </motion.span>
                              {showSuccessCue ? t('reports.daily.doneShort', 'OK') : t('reports.daily.downloadOneShort', 'PDF')}
                            </MButton>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                  )}
              </CardContent>
          </Card>
          </motion.div>}
      </div>
  );
}

// Add the missing default export
export default Reports;
