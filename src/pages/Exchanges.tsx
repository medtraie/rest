import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useApp } from '@/contexts/AppContext';
import { 
  ArrowRightLeft, 
  Plus, 
  Building2, 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  Package, 
  AlertTriangle, 
  Download, 
  Trash, 
  Edit,
  History,
  DollarSign,
  ArrowUpRight,
  ArrowDownLeft,
  Search,
  Settings2,
  Zap,
  Radar,
  Gauge
} from 'lucide-react';
import { AddForeignBottleDialog } from '@/components/dialogs/AddForeignBottleDialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { BottleType, Brand } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';

export const COMPANIES = [
  'Aziz gaz', 'Winxo', 'Dima gaz', 'Total', 'Putagaz', 
  'Nadigaz', 'Somap gaz', 'Atlas gaz', 'Ultra gaz', 'Petrom gaz'
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 100
      }
    }
  };

  const tableRowVariants = {
    hidden: { opacity: 0, x: -10 },
    visible: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 10 }
  };

const Exchanges = () => {
  const { exchanges = [], bottleTypes = [], addExchange, addForeignBottle, foreignBottles = [], brands = [] } = useApp();
  const { toast } = useToast();
  const { language } = useLanguage();
  const tr = (frText: string, arText: string) => (language === 'ar' ? arText : frText);
  const [showExchangeForm, setShowExchangeForm] = useState(false);
  const [selectedBottleType, setSelectedBottleType] = useState<BottleType | null>(null);
  const [addForeignDialogOpen, setAddForeignDialogOpen] = useState(false);
  const [showBrandDialog, setShowBrandDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [paidByFilter, setPaidByFilter] = useState<'all' | 'nous' | 'client' | 'egale'>('all');
  const [timeWindow, setTimeWindow] = useState<'7j' | '30j' | 'all'>('30j');
  const [missionFilter, setMissionFilter] = useState<'all' | 'critical' | 'watch' | 'stable'>('all');
  
  const [exchangeForm, setExchangeForm] = useState({
    exchangeMode: 'simple' as 'simple' | 'duel',
    companyName: '',
    sentCompany: '',
    receivedCompany: '',
    clientName: '',
    bottleType: '',
    operationType: 'envoi' as 'envoi' | 'reception',
    quantityGiven: 0,
    quantityReceived: 0,
    unitPrice: 0,
    paidBy: 'nous' as 'nous' | 'client' | 'egale'
  });

  const resolvePaidBy = (exchange: any): 'nous' | 'client' | 'egale' => {
    if (exchange?.paidBy === 'nous' || exchange?.paidBy === 'client' || exchange?.paidBy === 'egale') {
      return exchange.paidBy;
    }
    return exchange?.isPaidByUs ? 'nous' : 'client';
  };

  const getPaidByLabel = (exchange: any) => {
    const paidBy = resolvePaidBy(exchange);
    if (paidBy === 'nous') return tr('Nous payons', 'نحن ندفع');
    if (paidBy === 'client') return tr('Le client paye', 'الزبون يدفع');
    return tr('Égale', 'متساوي');
  };

  const getPaidByBadgeClass = (exchange: any) => {
    const paidBy = resolvePaidBy(exchange);
    if (paidBy === 'nous') return 'bg-rose-100 text-rose-700';
    if (paidBy === 'client') return 'bg-emerald-100 text-emerald-700';
    return 'bg-slate-100 text-slate-700';
  };

  const handleExchange = async () => {
    const bottleTypeData = bottleTypes.find(bt => bt.id === exchangeForm.bottleType);
    if (!bottleTypeData) {
      toast({
        title: tr("Erreur", "خطأ"),
        description: tr("Veuillez sélectionner un type de bouteille", "يرجى اختيار نوع القنينة"),
        variant: "destructive"
      });
      return;
    }
    const isDuelMode = exchangeForm.exchangeMode === 'duel';
    if (isDuelMode) {
      if (!exchangeForm.sentCompany || !exchangeForm.receivedCompany) {
        toast({
          title: tr("Erreur", "خطأ"),
          description: tr("Veuillez sélectionner les deux marques du changement duel", "يرجى اختيار الشركتين لتبديل ثنائي"),
          variant: "destructive"
        });
        return;
      }
      if (exchangeForm.sentCompany === exchangeForm.receivedCompany) {
        toast({
          title: tr("Erreur", "خطأ"),
          description: tr("Les deux marques doivent être différentes en changement duel", "يجب أن تكون الشركتان مختلفتين في التبديل الثنائي"),
          variant: "destructive"
        });
        return;
      }
      if (exchangeForm.quantityGiven <= 0 || exchangeForm.quantityReceived <= 0) {
        toast({
          title: tr("Erreur", "خطأ"),
          description: tr("En changement duel, les quantités Donné et Reçu doivent être supérieures à 0", "في التبديل الثنائي يجب أن تكون كميتا المُعطى والمستَلم أكبر من 0"),
          variant: "destructive"
        });
        return;
      }
      const sentStock = getForeignStockForBottleTypeAndCompany(bottleTypeData.name, exchangeForm.sentCompany);
      if (exchangeForm.quantityGiven > sentStock) {
        toast({
          title: tr("Stock insuffisant", "مخزون غير كافٍ"),
          description: language === 'ar'
            ? `المخزون الحالي لدى ${exchangeForm.sentCompany}: ${sentStock} قنينة.`
            : `Stock actuel chez ${exchangeForm.sentCompany}: ${sentStock} bouteille(s).`,
          variant: "destructive"
        });
        return;
      }
    } else {
      if (!exchangeForm.companyName) {
        toast({
          title: tr("Erreur", "خطأ"),
          description: tr("Veuillez sélectionner une société / marque", "يرجى اختيار شركة / علامة"),
          variant: "destructive"
        });
        return;
      }
      const quantityForStock = exchangeForm.operationType === 'envoi' ? exchangeForm.quantityGiven : exchangeForm.quantityReceived;
      if (quantityForStock <= 0) {
        toast({
          title: tr("Erreur", "خطأ"),
          description: exchangeForm.operationType === 'envoi'
            ? tr("Veuillez saisir une quantité donnée supérieure à 0", "يرجى إدخال كمية مُعطاة أكبر من 0")
            : tr("Veuillez saisir une quantité reçue supérieure à 0", "يرجى إدخال كمية مُستلمة أكبر من 0"),
          variant: "destructive"
        });
        return;
      }
      const currentStock = getForeignStockForBottleTypeAndCompany(bottleTypeData.name, exchangeForm.companyName);
      if (exchangeForm.operationType === 'envoi' && quantityForStock > currentStock) {
        toast({
          title: tr("Stock insuffisant", "مخزون غير كافٍ"),
          description: language === 'ar'
            ? `المخزون الحالي: ${currentStock} قنينة. لا يمكن إرسال ${quantityForStock}.`
            : `Stock actuel: ${currentStock} bouteille(s). Impossible d'envoyer ${quantityForStock}.`,
          variant: "destructive"
        });
        return;
      }
    }

    const rawPriceDifference = (exchangeForm.quantityReceived - exchangeForm.quantityGiven) * (exchangeForm.unitPrice || bottleTypeData.unitPrice || 0);
    const priceDifference = exchangeForm.paidBy === 'egale' ? 0 : Math.abs(rawPriceDifference);
    const companyLabel = isDuelMode
      ? `${exchangeForm.sentCompany} ⇄ ${exchangeForm.receivedCompany}`
      : exchangeForm.companyName;

    await addExchange({
      companyName: companyLabel,
      clientName: exchangeForm.clientName || undefined,
      bottleType: bottleTypeData?.name || '',
      quantityGiven: exchangeForm.quantityGiven,
      quantityReceived: exchangeForm.quantityReceived,
      priceDifference,
      date: new Date().toISOString(),
      isPaidByUs: exchangeForm.paidBy === 'nous',
      paidBy: exchangeForm.paidBy
    });

    if (isDuelMode) {
      if (exchangeForm.quantityGiven > 0) {
        await addForeignBottle({
          returnOrderId: `exchange-${Date.now()}-sent`,
          companyName: exchangeForm.sentCompany,
          bottleType: bottleTypeData.name,
          quantity: -exchangeForm.quantityGiven,
          type: 'normal',
          date: new Date().toISOString()
        });
      }
      if (exchangeForm.quantityReceived > 0) {
        await addForeignBottle({
          returnOrderId: `exchange-${Date.now()}-received`,
          companyName: exchangeForm.receivedCompany,
          bottleType: bottleTypeData.name,
          quantity: exchangeForm.quantityReceived,
          type: 'normal',
          date: new Date().toISOString()
        });
      }
    } else {
      const quantityForStock = exchangeForm.operationType === 'envoi' ? exchangeForm.quantityGiven : exchangeForm.quantityReceived;
      const stockDelta = exchangeForm.operationType === 'envoi' ? -quantityForStock : quantityForStock;
      if (stockDelta !== 0) {
        await addForeignBottle({
          returnOrderId: `exchange-${Date.now()}`,
          companyName: exchangeForm.companyName,
          bottleType: bottleTypeData.name,
          quantity: stockDelta,
          type: 'normal',
          date: new Date().toISOString()
        });
      }
      toast({
        title: tr("Échange enregistré", "تم تسجيل التبديل"),
        description: stockDelta > 0
          ? (language === 'ar'
              ? `تم تحديث المخزون الخارجي: +${stockDelta} قنينة.`
              : `Stock étranger mis à jour: +${stockDelta} bouteille(s).`)
          : (language === 'ar'
              ? `تم تحديث المخزون الخارجي: ${stockDelta} قنينة.`
              : `Stock étranger mis à jour: ${stockDelta} bouteille(s).`)
      });
    }

    if (isDuelMode) {
      toast({
        title: "Changement duel enregistré",
        description: `${exchangeForm.sentCompany}: -${exchangeForm.quantityGiven} | ${exchangeForm.receivedCompany}: +${exchangeForm.quantityReceived}`
      });
    }

    setExchangeForm({
      exchangeMode: 'simple',
      companyName: '',
      sentCompany: '',
      receivedCompany: '',
      clientName: '',
      bottleType: '',
      operationType: 'envoi',
      quantityGiven: 0,
      quantityReceived: 0,
      unitPrice: 0,
      paidBy: 'nous'
    });
    setShowExchangeForm(false);
  };

  // Stats calculation
  const stats = useMemo(() => {
    const totalNousPayons = exchanges
      .filter(ex => resolvePaidBy(ex) === 'nous')
      .reduce((sum, ex) => sum + (ex.priceDifference || 0), 0);
    const totalIlsPaient = exchanges
      .filter(ex => resolvePaidBy(ex) === 'client')
      .reduce((sum, ex) => sum + (ex.priceDifference || 0), 0);
    const netSolde = totalIlsPaient - totalNousPayons;
    
    return {
      totalExchanges: exchanges.length,
      totalNousPayons,
      totalIlsPaient,
      netSolde
    };
  }, [exchanges]);

  const getForeignStockByCompany = (companyName: string) => {
    return foreignBottles
      .filter(fb => fb.companyName === companyName && (fb.type === 'normal' || !fb.type))
      .reduce((acc, fb) => {
        const existing = acc.find(item => item.bottleType === fb.bottleType);
        if (existing) {
          existing.quantity += fb.quantity;
        } else {
          acc.push({ bottleType: fb.bottleType, quantity: fb.quantity });
        }
        return acc;
      }, [] as { bottleType: string; quantity: number }[]);
  };

  const getTotalForeignStockByCompany = (companyName: string) => {
    return foreignBottles
      .filter(fb => fb.companyName === companyName && (fb.type === 'normal' || !fb.type))
      .reduce((sum, fb) => sum + fb.quantity, 0);
  };

  const getForeignStockForBottleTypeAndCompany = (bottleTypeName: string, companyName: string) => {
    return foreignBottles
      .filter(fb => fb.bottleType === bottleTypeName && fb.companyName === companyName && (fb.type === 'normal' || !fb.type))
      .reduce((sum, fb) => sum + fb.quantity, 0);
  };

  const getTotalForeignStockForBottleType = (bottleTypeName: string) => {
    return foreignBottles
      .filter(fb => fb.bottleType === bottleTypeName && fb.type === 'normal')
      .reduce((sum, fb) => sum + fb.quantity, 0);
  };

  const getStockStatus = (quantity: number) => {
    if (quantity === 0) return { status: tr('Vide', 'فارغ'), variant: 'destructive' as const, color: 'text-rose-600', bg: 'bg-rose-50' };
    if (quantity < 20) return { status: tr('Faible', 'منخفض'), variant: 'secondary' as const, color: 'text-amber-600', bg: 'bg-amber-50' };
    return { status: tr('Normal', 'عادي'), variant: 'default' as const, color: 'text-emerald-600', bg: 'bg-emerald-50' };
  };

  const availableBottleTypes = bottleTypes.filter(bt => !bt.name.includes('Détendeur'));

  const filteredExchanges = useMemo(() => {
    const now = Date.now();
    const scopedByTime = exchanges.filter((ex) => {
      if (timeWindow === 'all') return true;
      const maxAge = timeWindow === '7j' ? 7 : 30;
      const ageDays = (now - new Date(ex.date).getTime()) / (1000 * 60 * 60 * 24);
      return ageDays <= maxAge;
    });
    const scopedByPaid = scopedByTime.filter((ex) => paidByFilter === 'all' || resolvePaidBy(ex) === paidByFilter);
    const query = searchQuery.toLowerCase();
    if (!query) return scopedByPaid;
    return scopedByPaid.filter(ex => 
      ex.companyName.toLowerCase().includes(query) || 
      ex.clientName?.toLowerCase().includes(query) ||
      ex.bottleType.toLowerCase().includes(query)
    );
  }, [exchanges, searchQuery, paidByFilter, timeWindow]);

  const exchangeIntelligence = useMemo(() => {
    const totalGiven = filteredExchanges.reduce((sum, ex) => sum + ex.quantityGiven, 0);
    const totalReceived = filteredExchanges.reduce((sum, ex) => sum + ex.quantityReceived, 0);
    const netUnits = totalReceived - totalGiven;
    const topPartners = Object.values(
      filteredExchanges.reduce((acc, ex) => {
        if (!acc[ex.companyName]) {
          acc[ex.companyName] = { company: ex.companyName, count: 0, totalValue: 0 };
        }
        acc[ex.companyName].count += 1;
        acc[ex.companyName].totalValue += ex.priceDifference || 0;
        return acc;
      }, {} as Record<string, { company: string; count: number; totalValue: number }>)
    )
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
    const stockPressure = availableBottleTypes
      .map((type) => ({
        bottleType: type.name,
        qty: getTotalForeignStockForBottleType(type.name)
      }))
      .sort((a, b) => a.qty - b.qty)
      .slice(0, 3);
    return { totalGiven, totalReceived, netUnits, topPartners, stockPressure };
  }, [filteredExchanges, availableBottleTypes, foreignBottles]);

  const stockByBottleType = useMemo(() => {
    return availableBottleTypes.reduce((acc, type) => {
      acc[type.name] = getTotalForeignStockForBottleType(type.name);
      return acc;
    }, {} as Record<string, number>);
  }, [availableBottleTypes, foreignBottles]);

  const classifyMissionStage = (exchange: any): 'critical' | 'watch' | 'stable' => {
    const stock = stockByBottleType[exchange.bottleType] ?? 0;
    const stockImpact = exchange.quantityReceived - exchange.quantityGiven;
    if (stock <= 10 || (stock <= 20 && stockImpact < 0) || (resolvePaidBy(exchange) === 'nous' && (exchange.priceDifference || 0) >= 3000)) {
      return 'critical';
    }
    if (stock <= 30 || Math.abs(stockImpact) >= 8 || (exchange.priceDifference || 0) >= 1500) {
      return 'watch';
    }
    return 'stable';
  };

  const missionBoard = useMemo(() => {
    const lanes = {
      critical: [] as any[],
      watch: [] as any[],
      stable: [] as any[]
    };
    filteredExchanges.forEach((exchange) => {
      const stage = classifyMissionStage(exchange);
      lanes[stage].push(exchange);
    });
    const sortByDate = (a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime();
    return {
      critical: lanes.critical.sort(sortByDate).slice(0, 5),
      watch: lanes.watch.sort(sortByDate).slice(0, 5),
      stable: lanes.stable.sort(sortByDate).slice(0, 5),
      counts: {
        critical: lanes.critical.length,
        watch: lanes.watch.length,
        stable: lanes.stable.length
      }
    };
  }, [filteredExchanges, stockByBottleType]);

  const stockForecast = useMemo(() => {
    const now = Date.now();
    const windowMs = 30 * 24 * 60 * 60 * 1000;
    return availableBottleTypes
      .map((type) => {
        const stock = stockByBottleType[type.name] || 0;
        const monthExchanges = exchanges.filter((exchange) => exchange.bottleType === type.name && (now - new Date(exchange.date).getTime()) <= windowMs);
        const monthNet = monthExchanges.reduce((sum, exchange) => sum + (exchange.quantityReceived - exchange.quantityGiven), 0);
        const dailyDrain = Math.max(0, -monthNet / 30);
        const daysLeft = dailyDrain > 0 ? stock / dailyDrain : Infinity;
        const risk = daysLeft <= 10 ? 'critical' : daysLeft <= 20 ? 'warning' : 'stable';
        return { bottleType: type.name, stock, daysLeft, dailyDrain, risk };
      })
      .sort((a, b) => {
        if (!Number.isFinite(a.daysLeft) && !Number.isFinite(b.daysLeft)) return a.stock - b.stock;
        if (!Number.isFinite(a.daysLeft)) return 1;
        if (!Number.isFinite(b.daysLeft)) return -1;
        return a.daysLeft - b.daysLeft;
      })
      .slice(0, 6);
  }, [availableBottleTypes, stockByBottleType, exchanges]);

  const visibleExchanges = useMemo(() => {
    if (missionFilter === 'all') return filteredExchanges;
    return filteredExchanges.filter((exchange) => classifyMissionStage(exchange) === missionFilter);
  }, [filteredExchanges, missionFilter, stockByBottleType]);

  const applyQuickFocus = (mode: 'top-partner' | 'stock-risk' | 'reset') => {
    if (mode === 'top-partner' && exchangeIntelligence.topPartners[0]) {
      setSearchQuery(exchangeIntelligence.topPartners[0].company);
      return;
    }
    if (mode === 'stock-risk' && exchangeIntelligence.stockPressure[0]) {
      setSearchQuery(exchangeIntelligence.stockPressure[0].bottleType);
      return;
    }
    setSearchQuery('');
    setPaidByFilter('all');
    setTimeWindow('30j');
    setMissionFilter('all');
  };

  const applySlaFocus = (bottleType: string, risk: 'critical' | 'warning' | 'stable') => {
    setSearchQuery(bottleType);
    setTimeWindow('30j');
    if (risk === 'critical') {
      setPaidByFilter('nous');
      setMissionFilter('critical');
      return;
    }
    if (risk === 'warning') {
      setMissionFilter('watch');
      return;
    }
    setMissionFilter('stable');
  };

  const exportExchangesToPDF = () => {
    const w = window.open('', '_blank');
    if (!w) return;

    const rows = exchanges.map(ex => `
        <tr>
          <td>${format(new Date(ex.date), 'dd/MM/yyyy')}</td>
          <td>${ex.companyName}</td>
          <td>${ex.clientName ?? '-'}</td>
          <td>${ex.bottleType}</td>
          <td style="text-align:right">${ex.quantityGiven}</td>
          <td style="text-align:right">${ex.quantityReceived}</td>
          <td style="text-align:right">${ex.quantityReceived - ex.quantityGiven}</td>
          <td>${getPaidByLabel(ex)}</td>
          <td style="text-align:right">${ex.priceDifference.toLocaleString('fr-FR')} DH</td>
        </tr>
    `).join('');

    w.document.write(`
      <html>
        <head>
          <title>Historique des échanges</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #333; line-height: 1.6; direction: ltr; }
            .header { border-bottom: 2px solid #4f46e5; padding-bottom: 20px; margin-bottom: 30px; }
            h1 { color: #4f46e5; margin: 0; font-size: 24px; }
            .meta { display: flex; gap: 20px; margin-top: 10px; font-weight: bold; }
            .stat { background: #f3f4f6; padding: 10px 15px; border-radius: 8px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #e5e7eb; padding: 12px; font-size: 13px; text-align: left; }
            th { background: #4f46e5; color: white; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em; }
            tr:nth-child(even) { background: #f9fafb; }
            .footer { margin-top: 30px; border-top: 2px solid #e5e7eb; padding-top: 20px; text-align: right; }
            .total-box { display: inline-block; background: #4f46e5; color: white; padding: 15px 25px; border-radius: 12px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Historique des échanges de bouteilles</h1>
            <div class="meta">
              <div class="stat">Total échanges: ${stats.totalExchanges}</div>
              <div class="stat">Nous payons: ${stats.totalNousPayons.toLocaleString('fr-FR')} DH</div>
              <div class="stat">Ils paient: ${stats.totalIlsPaient.toLocaleString('fr-FR')} DH</div>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Marque</th>
                <th>Client</th>
                <th>Type</th>
                <th style="text-align:right">Donné</th>
                <th style="text-align:right">Reçu</th>
                <th style="text-align:right">Impact Stock</th>
                <th>Payé par</th>
                <th style="text-align:right">Montant</th>
              </tr>
            </thead>
            <tbody>
              ${rows || '<tr><td colspan="9" style="text-align:center;color:#777">Aucun échange enregistré</td></tr>'}
            </tbody>
          </table>
          <div class="footer">
            <div class="total-box">
              <div style="font-size: 12px; opacity: 0.8; text-transform: uppercase; margin-bottom: 5px;">Solde Net</div>
              <div style="font-size: 24px; font-weight: bold;">${stats.netSolde.toLocaleString('fr-FR')} DH</div>
            </div>
          </div>
        </body>
      </html>
    `);
    w.document.close();
    setTimeout(() => w.print(), 500);
  };

  return (
    <motion.div 
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="app-page-shell p-4 md:p-8 space-y-8 bg-slate-50/30 min-h-screen text-left"
      dir="ltr"
    >
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <motion.div variants={itemVariants}>
          <div className="flex items-center gap-4 mb-2">
            <motion.div 
              whileHover={{ rotate: 180 }}
              transition={{ duration: 0.5 }}
              className="p-3 bg-indigo-600 rounded-2xl shadow-xl shadow-indigo-200"
            >
              <ArrowRightLeft className="w-7 h-7 text-white" />
            </motion.div>
            <div>
              <h1 className="app-page-title text-3xl font-black tracking-tight text-slate-900">
                {tr("Échanges Commerciaux", "تبديلات تجارية للقنينات")}
              </h1>
              <p className="app-page-subtitle text-slate-500 font-medium">
                {tr("Gestion et suivi des bouteilles étrangères et des échanges", "إدارة وتتبع القنينات الأجنبية وعمليات التبديل.")}
              </p>
            </div>
          </div>
        </motion.div>
        
        <motion.div variants={itemVariants} className="flex flex-wrap items-center gap-3">
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button 
              variant="outline" 
              onClick={() => setShowBrandDialog(true)}
              className="border-slate-200 hover:bg-white hover:border-indigo-300 text-slate-600 rounded-xl h-12 px-6 transition-all shadow-sm"
            >
              <Settings2 className="w-5 h-5 mr-2 text-indigo-500" />
              {tr("Gérer les Marques", "إدارة العلامات التجارية")}
            </Button>
          </motion.div>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button 
              onClick={() => setShowExchangeForm(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200 rounded-xl h-12 px-8 font-bold transition-all"
            >
              <Plus className="w-5 h-5 mr-2" />
              {tr("Nouvel Échange", "تبديل جديد")}
            </Button>
          </motion.div>
        </motion.div>
      </div>

      {/* Stats Section */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: tr('Total Échanges', 'إجمالي التبديلات'), value: stats.totalExchanges, icon: ArrowRightLeft, color: 'bg-blue-600', trend: 'neutral' },
          { label: tr('Nous devons payer', 'علينا أن ندفع'), value: `${stats.totalNousPayons.toLocaleString()} DH`, icon: ArrowDownLeft, color: 'bg-rose-600', trend: 'down' },
          { label: tr('Nous devons recevoir', 'علينا أن نستقبل'), value: `${stats.totalIlsPaient.toLocaleString()} DH`, icon: ArrowUpRight, color: 'bg-emerald-600', trend: 'up' },
          { label: tr('Solde Net', 'الرصيد الصافي'), value: `${stats.netSolde.toLocaleString()} DH`, icon: DollarSign, color: 'bg-indigo-600', trend: stats.netSolde >= 0 ? 'up' : 'down' }
        ].map((stat, idx) => (
          <motion.div 
            key={idx} 
            variants={itemVariants}
            whileHover={{ y: -5 }}
            className="relative group"
          >
            <Card className="border-none shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden bg-white/80 backdrop-blur-sm">
              <div className={`absolute top-0 left-0 w-1 h-full ${stat.color}`} />
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-3 ${stat.color} bg-opacity-10 rounded-2xl group-hover:scale-110 transition-transform duration-300`}>
                    <stat.icon className={`w-6 h-6 ${stat.color.replace('bg-', 'text-')}`} />
                  </div>
                  {stat.trend === 'up' && <TrendingUp className="w-4 h-4 text-emerald-500" />}
                  {stat.trend === 'down' && <TrendingDown className="w-4 h-4 text-rose-500" />}
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
                  <h3 className="text-2xl font-black text-slate-900">{stat.value}</h3>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <Card className="border-none shadow-sm bg-white overflow-hidden">
        <CardContent className="p-5 space-y-4">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-50 rounded-xl">
                <Radar className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900">
                  {tr("Exchange Command Deck", "لوحة قيادة التبديلات")}
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  {tr("Pilotage temps réel des échanges et du stock étranger", "قيادة آنية للتبديلات والمخزون الخارجي.")}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant={timeWindow === '7j' ? 'default' : 'outline'} className={timeWindow === '7j' ? 'bg-indigo-600 hover:bg-indigo-700' : ''} onClick={() => setTimeWindow('7j')}>7 jours</Button>
              <Button variant={timeWindow === '30j' ? 'default' : 'outline'} className={timeWindow === '30j' ? 'bg-indigo-600 hover:bg-indigo-700' : ''} onClick={() => setTimeWindow('30j')}>30 jours</Button>
              <Button variant={timeWindow === 'all' ? 'default' : 'outline'} className={timeWindow === 'all' ? 'bg-indigo-600 hover:bg-indigo-700' : ''} onClick={() => setTimeWindow('all')}>Tout</Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                {tr("Signal Opérationnel", "إشارة تشغيلية")}
              </p>
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-600">{tr("Donné", "مُعطى")}</p>
                <p className="font-black text-rose-600">{exchangeIntelligence.totalGiven}</p>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-600">{tr("Reçu", "مستلم")}</p>
                <p className="font-black text-emerald-600">{exchangeIntelligence.totalReceived}</p>
              </div>
              <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                <p className="text-xs font-bold text-slate-500 uppercase">
                  {tr("Balance unités", "رصيد الوحدات")}
                </p>
                <Badge className={exchangeIntelligence.netUnits >= 0 ? 'bg-emerald-100 text-emerald-700 border-none' : 'bg-rose-100 text-rose-700 border-none'}>
                  {exchangeIntelligence.netUnits > 0 ? '+' : ''}{exchangeIntelligence.netUnits}
                </Badge>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                {tr("Partenaires clés", "شركاء رئيسيون")}
              </p>
              {exchangeIntelligence.topPartners.length === 0 ? (
                <p className="text-sm text-slate-500">
                  {tr("Aucune donnée sur la fenêtre actuelle.", "لا توجد بيانات في الفترة الحالية.")}
                </p>
              ) : (
                exchangeIntelligence.topPartners.map((partner) => (
                  <button
                    key={partner.company}
                    type="button"
                    onClick={() => setSearchQuery(partner.company)}
                    className="w-full text-left rounded-xl border border-slate-200 bg-white p-2.5 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                            <p className="text-xs font-bold text-slate-700">{partner.company}</p>
                            <p className="text-[11px] text-slate-500">
                              {language === 'ar' ? `${partner.count} عملية` : `${partner.count} ops`}
                            </p>
                    </div>
                    <p className="text-xs text-indigo-600 font-bold mt-0.5">{partner.totalValue.toLocaleString('fr-FR')} DH</p>
                  </button>
                ))
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                      {tr("Actions express", "إجراءات سريعة")}
                    </p>
              <Button onClick={() => applyQuickFocus('top-partner')} className="w-full justify-start bg-indigo-600 hover:bg-indigo-700">
                <Zap className="w-4 h-4 mr-2" />
                {tr("Focus top partenaire", "تركيز على أفضل شريك")}
              </Button>
              <Button onClick={() => applyQuickFocus('stock-risk')} variant="outline" className="w-full justify-start">
                <Gauge className="w-4 h-4 mr-2 text-amber-500" />
                {tr("Focus risque stock", "تركيز على مخاطر المخزون")}
              </Button>
              <Button onClick={() => applyQuickFocus('reset')} variant="ghost" className="w-full justify-start text-slate-600">
                <Trash className="w-4 h-4 mr-2" />
                {tr("Réinitialiser le cockpit", "إعادة تعيين لوحة القيادة")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="border-none shadow-sm bg-white overflow-hidden xl:col-span-2">
          <CardContent className="p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-slate-900 rounded-xl">
                  <Gauge className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">
                    {tr("Mission Control Kanban", "كانبان التحكم في المهام")}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {tr("Pilotage des échanges par niveau de risque", "قيادة التبديلات حسب مستوى المخاطر")}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant={missionFilter === 'all' ? 'default' : 'outline'} size="sm" className={missionFilter === 'all' ? 'bg-slate-700 hover:bg-slate-800' : ''} onClick={() => setMissionFilter('all')}>
                  {tr("Tout", "الكل")}
                </Button>
                <Button variant={missionFilter === 'critical' ? 'default' : 'outline'} size="sm" className={missionFilter === 'critical' ? 'bg-rose-600 hover:bg-rose-700' : ''} onClick={() => setMissionFilter('critical')}>
                  {tr("Critique", "حرج")}
                </Button>
                <Button variant={missionFilter === 'watch' ? 'default' : 'outline'} size="sm" className={missionFilter === 'watch' ? 'bg-amber-500 hover:bg-amber-600 border-none text-white' : ''} onClick={() => setMissionFilter('watch')}>
                  {tr("Surveillance", "مراقبة")}
                </Button>
                <Button variant={missionFilter === 'stable' ? 'default' : 'outline'} size="sm" className={missionFilter === 'stable' ? 'bg-emerald-600 hover:bg-emerald-700' : ''} onClick={() => setMissionFilter('stable')}>
                  {tr("Stable", "مستقر")}
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                { key: 'critical', title: tr('Critique', 'حرج'), count: missionBoard.counts.critical, items: missionBoard.critical, badgeClass: 'bg-rose-100 text-rose-700', borderClass: 'border-rose-200' },
                { key: 'watch', title: tr('Surveillance', 'مراقبة'), count: missionBoard.counts.watch, items: missionBoard.watch, badgeClass: 'bg-amber-100 text-amber-700', borderClass: 'border-amber-200' },
                { key: 'stable', title: tr('Stable', 'مستقر'), count: missionBoard.counts.stable, items: missionBoard.stable, badgeClass: 'bg-emerald-100 text-emerald-700', borderClass: 'border-emerald-200' }
              ].map((lane) => (
                <div key={lane.key} className={`rounded-2xl border ${lane.borderClass} bg-slate-50 p-3 space-y-2`}>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-black uppercase tracking-wide text-slate-600">{lane.title}</p>
                    <Badge className={`${lane.badgeClass} border-none`}>{lane.count}</Badge>
                  </div>
                  {lane.items.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      {tr("Aucun échange sur ce niveau.", "لا توجد تبديلات في هذا المستوى.")}
                    </p>
                  ) : (
                    lane.items.map((exchange: any) => (
                      <button
                        key={exchange.id}
                        type="button"
                        onClick={() => setSearchQuery(exchange.companyName)}
                        className="w-full text-left rounded-xl bg-white border border-slate-200 px-3 py-2 hover:bg-slate-50 transition-colors"
                      >
                        <p className="text-xs font-bold text-slate-800">{exchange.companyName}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">{exchange.bottleType} · {format(new Date(exchange.date), 'dd/MM', { locale: fr })}</p>
                      </button>
                    ))
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white overflow-hidden">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-50 rounded-xl">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">
                  {tr("Stock SLA Alerts", "تنبيهات مخزون SLA")}
                </h3>
                <p className="text-xs text-slate-500">
                  {tr("Prévision de rupture par type de bouteille", "توقّع نفاد المخزون حسب نوع القنينة")}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              {stockForecast.length === 0 ? (
                <p className="text-sm text-slate-500">
                  {tr("Aucune donnée disponible.", "لا توجد بيانات متاحة.")}
                </p>
              ) : (
                stockForecast.map((forecast) => (
                  <button
                    key={forecast.bottleType}
                    type="button"
                    onClick={() => applySlaFocus(forecast.bottleType, forecast.risk)}
                    className="w-full text-left rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 hover:bg-white transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-slate-800">{forecast.bottleType}</p>
                      <Badge className={forecast.risk === 'critical' ? 'bg-rose-100 text-rose-700 border-none' : forecast.risk === 'warning' ? 'bg-amber-100 text-amber-700 border-none' : 'bg-emerald-100 text-emerald-700 border-none'}>
                        {forecast.risk === 'critical'
                          ? tr('SLA rouge', 'SLA أحمر')
                          : forecast.risk === 'warning'
                            ? tr('SLA orange', 'SLA برتقالي')
                            : tr('SLA vert', 'SLA أخضر')}
                      </Badge>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-500">
                      <span>{tr("Stock", "المخزون")}: {forecast.stock}</span>
                      <span>
                        {Number.isFinite(forecast.daysLeft)
                          ? `${Math.max(0, Math.floor(forecast.daysLeft))} j`
                          : tr('flux stable', 'تدفق مستقر')}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Left Column: Stock Inventory */}
        <div className="lg:col-span-2 space-y-6">
          <motion.div variants={itemVariants} className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-50 rounded-lg">
                <Package className="w-5 h-5 text-indigo-600" />
              </div>
              <h2 className="text-xl font-black text-slate-800">
                {tr("Stock de Bouteilles Étrangères", "مخزون القنينات الأجنبية")}
              </h2>
            </div>
            <Badge variant="outline" className="bg-indigo-50/50 text-indigo-700 border-indigo-100 px-4 py-1.5 rounded-full font-bold">
              {language === 'ar'
                ? `${brands.length} علامة مسجّلة`
                : `${brands.length} marques enregistrées`}
            </Badge>
          </motion.div>

          <div className="grid gap-6">
            <AnimatePresence>
              {availableBottleTypes.map((bottleType, bIdx) => {
                const totalStockForType = getTotalForeignStockForBottleType(bottleType.name);
                const { status, color, bg } = getStockStatus(totalStockForType);

                return (
                  <motion.div 
                    key={bottleType.id} 
                    variants={itemVariants}
                    layout
                  >
                    <Card className="border-none shadow-sm overflow-hidden group hover:shadow-lg transition-all duration-300 bg-white">
                      <CardHeader className="bg-slate-50/50 border-b border-slate-100 flex flex-row items-center justify-between p-6">
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-white rounded-xl shadow-sm group-hover:scale-110 transition-transform duration-300">
                            <Package className="w-6 h-6 text-indigo-600" />
                          </div>
                          <div>
                            <CardTitle className="text-xl font-black text-slate-800">{bottleType.name}</CardTitle>
                            <p className="text-xs text-slate-500 font-bold mt-0.5">
                              {tr("Stock total actuel", "إجمالي المخزون الحالي")}
                            </p>
                          </div>
                        </div>
                        <div className={`flex items-center gap-2.5 px-4 py-2 rounded-xl ${bg} ${color} font-black text-sm shadow-sm`}>
                          <motion.div 
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ repeat: Infinity, duration: 2 }}
                            className={`w-2 h-2 rounded-full ${color.replace('text-', 'bg-')}`} 
                          />
                          {status}: {totalStockForType}
                        </div>
                      </CardHeader>
                      <CardContent className="p-6">
                        <div className="grid sm:grid-cols-2 gap-4">
                          {brands.map((company) => {
                            const qty = getForeignStockForBottleTypeAndCompany(bottleType.name, company.name);
                            return (
                              <motion.div 
                                key={company.id} 
                                whileHover={{ scale: 1.02 }}
                                className={`flex items-center justify-between p-4 rounded-2xl border transition-all duration-200 ${
                                  qty > 0 
                                    ? 'bg-white border-slate-200 shadow-sm' 
                                    : 'bg-slate-50/50 border-transparent opacity-60'
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <div className={`p-2 rounded-lg ${qty > 0 ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                                    <Building2 className="w-4 h-4" />
                                  </div>
                                  <span className="text-sm font-bold text-slate-700">{company.name}</span>
                                </div>
                                <div className="flex flex-col items-end">
                                  <span className={`text-lg font-black ${qty > 0 ? 'text-indigo-600' : 'text-slate-400'}`}>{qty}</span>
                                  {qty > 0 && (
                                    <span className="text-[10px] text-slate-400 font-bold">
                                      {tr("bouteille(s)", "قنينة")}
                                    </span>
                                  )}
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>

                        <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-100">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                              {tr("Dernière mise à jour : Aujourd'hui", "آخر تحديث: اليوم")}
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-indigo-600 hover:bg-indigo-50 rounded-xl font-black px-4 h-10 transition-colors"
                            onClick={() => {
                              setSelectedBottleType(bottleType);
                              setAddForeignDialogOpen(true);
                            }}
                          >
                            <Plus className="w-4 h-4 mr-2" /> {tr("Ajuster le stock", "تعديل المخزون")}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>

        {/* Right Column: History & Controls */}
        <div className="space-y-6">
          <motion.div variants={itemVariants}>
            <Card className="border-none shadow-sm overflow-hidden bg-white h-full">
              <CardHeader className="bg-slate-900 text-white p-6">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-black flex items-center gap-3">
                    <History className="w-5 h-5 text-indigo-400" />
                    {tr("Historique des Échanges", "سجل التبديلات")}
                  </CardTitle>
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    onClick={exportExchangesToPDF}
                    className="bg-white/10 hover:bg-white/20 border-none text-white rounded-lg h-9 px-4"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    PDF
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="p-4 bg-slate-50 border-b border-slate-100">
                  <div className="relative group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                    <Input 
                      placeholder={tr("Rechercher une marque, client ou type...", "ابحث عن علامة، زبون أو نوع...")}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 h-11 bg-white border-slate-200 focus:ring-2 focus:ring-indigo-600/10 rounded-xl text-sm font-medium text-left"
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Button variant={paidByFilter === 'all' ? 'default' : 'outline'} size="sm" className={paidByFilter === 'all' ? 'bg-slate-700 hover:bg-slate-800 h-8' : 'h-8'} onClick={() => setPaidByFilter('all')}>
                      {tr("Tous", "الكل")}
                    </Button>
                    <Button variant={paidByFilter === 'nous' ? 'default' : 'outline'} size="sm" className={paidByFilter === 'nous' ? 'bg-rose-600 hover:bg-rose-700 h-8' : 'h-8'} onClick={() => setPaidByFilter('nous')}>
                      {tr("Nous payons", "نحن ندفع")}
                    </Button>
                    <Button variant={paidByFilter === 'client' ? 'default' : 'outline'} size="sm" className={paidByFilter === 'client' ? 'bg-emerald-600 hover:bg-emerald-700 h-8' : 'h-8'} onClick={() => setPaidByFilter('client')}>
                      {tr("Client paye", "الزبون يدفع")}
                    </Button>
                    <Button variant={paidByFilter === 'egale' ? 'default' : 'outline'} size="sm" className={paidByFilter === 'egale' ? 'bg-indigo-600 hover:bg-indigo-700 h-8' : 'h-8'} onClick={() => setPaidByFilter('egale')}>
                      {tr("Égale", "متساوي")}
                    </Button>
                    <Badge variant="outline" className="h-8 px-3 rounded-full border-slate-200 text-slate-600">
                      {tr("Mission", "المهمة")}: {missionFilter === 'all'
                        ? tr('Tout', 'الكل')
                        : missionFilter === 'critical'
                          ? tr('Critique', 'حرج')
                          : missionFilter === 'watch'
                            ? tr('Surveillance', 'مراقبة')
                            : tr('Stable', 'مستقر')}
                    </Badge>
                  </div>
                </div>
                
                <div className="divide-y divide-slate-100 max-h-[800px] overflow-y-auto custom-scrollbar">
                  <AnimatePresence mode="popLayout">
                    {visibleExchanges.length > 0 ? (
                      visibleExchanges.map((exchange, idx) => (
                        <motion.div 
                          key={exchange.id}
                          variants={tableRowVariants}
                          initial="hidden"
                          animate="visible"
                          exit="exit"
                          layout
                          transition={{ 
                            delay: idx * 0.03,
                            layout: { duration: 0.2 }
                          }}
                          whileHover={{ x: 5, backgroundColor: "rgba(248, 250, 252, 1)" }}
                          className="p-5 hover:bg-slate-50 transition-all cursor-default group border-l-2 border-transparent hover:border-indigo-500"
                        >
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-4">
                              <div className={`p-3 rounded-2xl shadow-sm ${
                                resolvePaidBy(exchange) === 'nous' ? 'bg-rose-50 text-rose-600' : resolvePaidBy(exchange) === 'client' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-600'
                              }`}>
                                <ArrowRightLeft className="w-5 h-5" />
                              </div>
                              <div>
                                <div className="font-black text-slate-900">{exchange.companyName}</div>
                                <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5 mt-0.5">
                                  <Calendar className="w-3 h-3" />
                                  {format(new Date(exchange.date), 'dd MMMM yyyy', { locale: fr })}
                                </div>
                              </div>
                            </div>
                            <Badge 
                              className={`text-[10px] font-black px-3 py-1 rounded-full border-none ${
                                getPaidByBadgeClass(exchange)
                              }`}
                            >
                              {getPaidByLabel(exchange)}
                            </Badge>
                          </div>

                          <div className="grid grid-cols-2 gap-3 mb-4">
                            <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-100 group-hover:bg-white transition-colors">
                              <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Donné</p>
                              <div className="flex items-center gap-2">
                                <TrendingDown className="w-3 h-3 text-rose-500" />
                                <span className="font-black text-slate-800">{exchange.quantityGiven}</span>
                                <span className="text-[10px] font-bold text-slate-500">bouteille(s)</span>
                              </div>
                            </div>
                            <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-100 group-hover:bg-white transition-colors">
                              <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Reçu</p>
                              <div className="flex items-center gap-2">
                                <TrendingUp className="w-3 h-3 text-emerald-500" />
                                <span className="font-black text-slate-800">{exchange.quantityReceived}</span>
                                <span className="text-[10px] font-bold text-slate-500">bouteille(s)</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between bg-indigo-50/30 p-3 rounded-xl">
                            <div className="flex items-center gap-2">
                              <Package className="w-3.5 h-3.5 text-indigo-500" />
                              <span className="text-xs font-bold text-indigo-900">{exchange.bottleType}</span>
                            </div>
                            <div className="text-right">
                              <div className="font-black text-indigo-600 text-sm">
                                {exchange.priceDifference.toLocaleString()} DH
                              </div>
                              <div className="text-[10px] font-bold text-slate-500 uppercase">
                                Impact stock: {exchange.quantityReceived - exchange.quantityGiven > 0 ? '+' : ''}{exchange.quantityReceived - exchange.quantityGiven}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ))
                    ) : (
                      <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
                        <div className="p-4 bg-slate-50 rounded-full mb-4">
                          <Search className="w-8 h-8 text-slate-300" />
                        </div>
                        <p className="text-slate-500 font-bold">
                          {tr("Aucun résultat trouvé", "لا توجد نتائج")}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          {tr("Essayez d'autres mots-clés", "جرّب كلمات مفتاحية أخرى")}
                        </p>
                      </div>
                    )}
                  </AnimatePresence>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>

      {/* Forms & Dialogs */}
      <Dialog open={showExchangeForm} onOpenChange={setShowExchangeForm}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none shadow-2xl">
          <div className="bg-indigo-600 p-6 text-white">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                  <ArrowRightLeft className="w-5 h-5" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-bold">
                    {tr("Nouvel Échange", "تبديل جديد")}
                  </DialogTitle>
                  <p className="text-indigo-100 text-xs mt-1">
                    {tr("Enregistrer un mouvement de bouteilles entre marques", "تسجيل حركة قنينات بين العلامات")}
                  </p>
                </div>
              </div>
            </DialogHeader>
          </div>
          
          <div className="p-6 space-y-6 bg-white">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-500 uppercase">
                {tr("Mode d'échange", "وضع التبديل")}
              </Label>
              <Select
                value={exchangeForm.exchangeMode}
                onValueChange={(value: 'simple' | 'duel') => setExchangeForm({
                  ...exchangeForm,
                  exchangeMode: value,
                  companyName: '',
                  sentCompany: '',
                  receivedCompany: ''
                })}
              >
                <SelectTrigger className="rounded-xl border-slate-200 h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="simple">{tr("Échange simple", "تبديل بسيط")}</SelectItem>
                  <SelectItem value="duel">{tr("Changement duel", "تبديل ثنائي")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {exchangeForm.exchangeMode === 'duel' ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-500 uppercase">
                    {tr("Marque / Société envoyée", "علامة / شركة مُرسِلة")}
                  </Label>
                  <Select
                    value={exchangeForm.sentCompany}
                    onValueChange={(value) => setExchangeForm({ ...exchangeForm, sentCompany: value })}
                  >
                    <SelectTrigger className="rounded-xl border-slate-200 h-11">
                      <SelectValue placeholder={tr("Choisir la marque envoyée...", "اختر العلامة المُرسِلة...")} />
                    </SelectTrigger>
                    <SelectContent>
                      {brands.map(company => (
                        <SelectItem key={company.id} value={company.name}>{company.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-500 uppercase">
                    {tr("Marque / Société reçue", "علامة / شركة مستلِمة")}
                  </Label>
                  <Select
                    value={exchangeForm.receivedCompany}
                    onValueChange={(value) => setExchangeForm({ ...exchangeForm, receivedCompany: value })}
                  >
                    <SelectTrigger className="rounded-xl border-slate-200 h-11">
                      <SelectValue placeholder={tr("Choisir la marque reçue...", "اختر العلامة المستلِمة...")} />
                    </SelectTrigger>
                    <SelectContent>
                      {brands.map(company => (
                        <SelectItem key={company.id} value={company.name}>{company.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 uppercase">
                  {tr("Société / Marque", "شركة / علامة")}
                </Label>
                <Select
                  value={exchangeForm.companyName}
                  onValueChange={(value) => setExchangeForm({ ...exchangeForm, companyName: value })}
                >
                  <SelectTrigger className="rounded-xl border-slate-200 h-11">
                    <SelectValue placeholder={tr("Choisir la société...", "اختر الشركة...")} />
                  </SelectTrigger>
                  <SelectContent>
                    {brands.map(company => (
                      <SelectItem key={company.id} value={company.name}>{company.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-500 uppercase">
                {tr("Nom du Client", "اسم الزبون")}
              </Label>
              <Input
                value={exchangeForm.clientName}
                onChange={(e) => setExchangeForm({...exchangeForm, clientName: e.target.value})}
                className="rounded-xl border-slate-200 h-11"
                placeholder={tr("Optionnel...", "اختياري...")}
              />
            </div>

            {exchangeForm.exchangeMode === 'simple' && (
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 uppercase">
                  {tr("Sens de l'opération", "اتجاه العملية")}
                </Label>
                <Select
                  value={exchangeForm.operationType}
                  onValueChange={(value: 'envoi' | 'reception') => setExchangeForm({ ...exchangeForm, operationType: value })}
                >
                  <SelectTrigger className="rounded-xl border-slate-200 h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="envoi">{tr("J'envoie des bouteilles", "أرسل قنينات")}</SelectItem>
                    <SelectItem value="reception">{tr("Je reçois des bouteilles", "أتلقى قنينات")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 uppercase">
                  {tr("Type de Bouteille", "نوع القنينة")}
                </Label>
                <Select 
                  value={exchangeForm.bottleType} 
                  onValueChange={(value) => setExchangeForm({...exchangeForm, bottleType: value})}
                >
                  <SelectTrigger className="rounded-xl border-slate-200 h-11">
                    <SelectValue placeholder={tr("Choisir le type...", "اختر النوع...")} />
                  </SelectTrigger>
                  <SelectContent>
                    {bottleTypes.map(bt => (
                      <SelectItem key={bt.id} value={bt.id}>{bt.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 uppercase">
                  {tr("Payé par", "الجهة الدافعة")}
                </Label>
                <Select 
                  value={exchangeForm.paidBy} 
                  onValueChange={(value: 'nous' | 'client' | 'egale') => setExchangeForm({
                    ...exchangeForm,
                    paidBy: value,
                    unitPrice: value === 'egale' ? 0 : exchangeForm.unitPrice
                  })}
                >
                  <SelectTrigger className="rounded-xl border-slate-200 h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nous">{tr("Nous payons", "نحن ندفع")}</SelectItem>
                    <SelectItem value="client">{tr("Le client paye", "الزبون يدفع")}</SelectItem>
                    <SelectItem value="egale">{tr("Égale", "متساوي")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 uppercase">
                  {tr("Donné", "مُعطى")}
                </Label>
                <Input
                  type="number"
                  value={exchangeForm.quantityGiven}
                  onChange={(e) => setExchangeForm({...exchangeForm, quantityGiven: parseInt(e.target.value) || 0})}
                  className="rounded-xl border-slate-200 h-11"
                />
              </div>
              
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 uppercase">
                  {tr("Reçu", "مستلم")}
                </Label>
                <Input
                  type="number"
                  value={exchangeForm.quantityReceived}
                  onChange={(e) => setExchangeForm({...exchangeForm, quantityReceived: parseInt(e.target.value) || 0})}
                  className="rounded-xl border-slate-200 h-11"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 uppercase">
                  {tr("Prix (DH)", "السعر (درهم)")}
                </Label>
                <Input
                  type="number"
                  value={exchangeForm.unitPrice}
                  onChange={(e) => setExchangeForm({...exchangeForm, unitPrice: parseFloat(e.target.value) || 0})}
                  disabled={exchangeForm.paidBy === 'egale'}
                  className="rounded-xl border-slate-200 h-11 font-bold text-indigo-600"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="p-6 pt-2 bg-slate-50 flex gap-2">
            <Button variant="ghost" onClick={() => setShowExchangeForm(false)} className="rounded-xl text-slate-500">
              {tr("Annuler", "إلغاء")}
            </Button>
            <Button onClick={handleExchange} className="bg-indigo-600 hover:bg-indigo-700 rounded-xl px-8 font-bold">
              {tr("Enregistrer l'échange", "حفظ التبديل")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stock adjustment dialog */}
      {selectedBottleType && (
        <AddForeignBottleDialog
          open={addForeignDialogOpen}
          onOpenChange={setAddForeignDialogOpen}
          bottleType={selectedBottleType}
        />
      )}

      {/* Brand Management Dialog */}
      <BrandManagerDialog open={showBrandDialog} onOpenChange={setShowBrandDialog} />
    </motion.div>
  );
};

const BrandManagerDialog = ({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void; }) => {
  const { brands, addBrand, updateBrand, deleteBrand } = useApp();
  const { language } = useLanguage();
  const tr = (frText: string, arText: string) => (language === 'ar' ? arText : frText);
  const [newBrandName, setNewBrandName] = useState("");
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);

  const handleAddBrand = () => {
    if (newBrandName.trim()) {
      if (editingBrand) {
        updateBrand(editingBrand.id, { name: newBrandName });
        setEditingBrand(null);
      } else {
        addBrand({ name: newBrandName, id: '' });
      }
      setNewBrandName("");
    }
  };

  const handleEdit = (brand: Brand) => {
    setEditingBrand(brand);
    setNewBrandName(brand.name);
  };

  const handleCancelEdit = () => {
    setEditingBrand(null);
    setNewBrandName("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none shadow-2xl">
        <div className="bg-slate-900 p-6 text-white">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/10 rounded-lg">
                <Settings2 className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold">
                  {tr("Gestion des Marques", "إدارة العلامات التجارية")}
                </DialogTitle>
                <p className="text-slate-400 text-xs mt-1">
                  {tr("Ajouter, modifier ou supprimer des sociétés enregistrées", "إضافة أو تعديل أو حذف الشركات المسجّلة")}
                </p>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex gap-2">
              <Input
                value={newBrandName}
                onChange={(e) => setNewBrandName(e.target.value)}
                placeholder={
                  editingBrand
                    ? tr("Nouveau nom...", "اسم جديد...")
                    : tr("Nom de la nouvelle société...", "اسم الشركة الجديدة...")
                }
                className="rounded-xl h-11 border-slate-200"
              />
            <Button 
              onClick={handleAddBrand}
              className="bg-indigo-600 hover:bg-indigo-700 rounded-xl px-6 font-bold"
            >
              {editingBrand ? tr("Mettre à jour", "تحديث") : tr("Ajouter", "إضافة")}
            </Button>
            {editingBrand && (
              <Button variant="ghost" onClick={handleCancelEdit} className="rounded-xl">
                {tr("Annuler", "إلغاء")}
              </Button>
            )}
          </div>

          <div className="bg-slate-50 rounded-2xl border border-slate-100 divide-y divide-slate-200 max-h-[300px] overflow-y-auto">
            {brands.map((brand) => (
              <div key={brand.id} className="flex items-center justify-between p-4 group">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-500">
                    {brand.name.charAt(0)}
                  </div>
                  <span className="font-bold text-slate-700">{brand.name}</span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(brand)} className="h-8 w-8 text-slate-400 hover:text-indigo-600">
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => deleteBrand(brand.id)} className="h-8 w-8 text-slate-400 hover:text-rose-600">
                    <Trash className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="p-4 bg-slate-50">
          <Button variant="secondary" onClick={() => onOpenChange(false)} className="rounded-xl w-full">
            {tr("Fermer la fenêtre", "إغلاق النافذة")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default Exchanges;
