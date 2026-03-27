// Top-level imports
import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useApp } from '@/contexts/AppContext';
import { useToast } from '@/hooks/use-toast';
import { Repair } from '@/types';
import { Wrench, Plus, Search, Filter, Calendar, DollarSign, FileText, Truck, FileDown, Play, Pencil, Trash2, AlertCircle, CheckCircle2, History, CreditCard, Banknote, TrendingUp, TrendingDown, Sparkles, ShieldAlert, Brain, Rocket, Siren, Gauge, Target, Flame, BarChart3, Zap } from 'lucide-react';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion';
import { useLanguage, useT } from '@/contexts/LanguageContext';

const formatMetric = (value: number, locale: string, decimals: number) =>
  value.toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });

const AnimatedMetricValue = ({
  value,
  suffix = '',
  decimals = 0,
  locale = 'fr-MA',
  className = ''
}: {
  value: number;
  suffix?: string;
  decimals?: number;
  locale?: string;
  className?: string;
}) => {
  const shouldReduceMotion = useReducedMotion();
  const motionValue = useMotionValue(0);
  const transformed = useTransform(motionValue, (latest) => formatMetric(latest, locale, decimals));
  const [displayValue, setDisplayValue] = useState(() => formatMetric(0, locale, decimals));

  useEffect(() => {
    if (shouldReduceMotion) {
      setDisplayValue(formatMetric(value, locale, decimals));
      return;
    }
    const controls = animate(motionValue, value, {
      duration: 1.1,
      ease: [0.16, 1, 0.3, 1]
    });
    const unsubscribe = transformed.on('change', (latest) => setDisplayValue(latest));
    return () => {
      controls.stop();
      unsubscribe();
    };
  }, [value, locale, decimals, shouldReduceMotion, motionValue, transformed]);

  return <span className={className}>{displayValue}{suffix}</span>;
};

const Repairs = () => {
  const { trucks, drivers, repairs, addRepair, updateRepair, deleteRepair, updateTruck, addExpense, deleteExpense } = useApp();
  const { toast } = useToast();
  const t = useT();
  const { language } = useLanguage();
  const ru = (key: string, fallback: string) => t(`repairs.ui.${key}`, fallback);
  const tr = (frText: string, arText: string) => (language === 'ar' ? arText : frText);
  const uiLocale = language === 'ar' ? 'ar-MA' : 'fr-MA';

  const handleDownloadPDF = (repair: Repair) => {
    const doc = new jsPDF();
    const truck = trucks.find(t => t.id === repair.truckId);
    const typeLabel = repair.type === 'mecanique' ? tr('Mécanique', 'ميكانيك') : repair.type === 'electrique' ? tr('Électrique', 'كهربائي') : tr('Garage', 'مرآب');
    const paymentMethodMap: { [key: string]: string } = {
      especes: tr('Espèces', 'نقدًا'),
      cheque: tr('Chèque', 'شيك'),
      virement: tr('Virement', 'تحويل'),
    };

    doc.setFillColor(249, 115, 22); // orange-500
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    const isAr = language === 'ar';
    doc.text(isAr ? "سند إصلاح" : "BON DE RÉPARATION", 105, 25, { align: 'center' });
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    const dateLabel = isAr ? "التاريخ" : "Date";
    const refLabel = isAr ? "المرجع" : "Référence";
    doc.text(`${dateLabel}: ${new Date(repair.date).toLocaleDateString(uiLocale, { day: '2-digit', month: 'long', year: 'numeric' })}`, 14, 50);
    doc.text(`${refLabel}: REP-${repair.id.slice(0, 8).toUpperCase()}`, 14, 58);

    autoTable(doc, {
      startY: 70,
      head: [[isAr ? 'البند' : 'Désignation', isAr ? 'التفاصيل' : 'Détails']],
      body: [
        [isAr ? 'المركبة' : 'Véhicule', truck?.matricule || 'N/A'],
        [isAr ? 'نوع الإصلاح' : 'Type de Réparation', isAr ? (repair.type === 'mecanique' ? 'ميكانيك' : repair.type === 'electrique' ? 'كهربائي' : 'مرآب') : typeLabel],
        [isAr ? 'الوصف' : 'Description', repair.remarks],
        [isAr ? 'طريقة الدفع' : 'Mode de Paiement', paymentMethodMap[repair.paymentMethod] || repair.paymentMethod],
        [isAr ? 'الحالة' : 'Statut', repair.debtAmount > 0 ? (isAr ? 'مدفوع جزئياً' : 'Partiellement Payé') : (isAr ? 'مدفوع' : 'Payé')],
      ],
      headStyles: { fillColor: [249, 115, 22] },
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;
    
    doc.setFontSize(14);
    doc.text(isAr ? "الملخص المالي" : "Récapitulatif Financier", 14, finalY);
    
    autoTable(doc, {
      startY: finalY + 5,
      body: [
        [isAr ? 'التكلفة الإجمالية' : 'Coût Total', `${repair.totalCost.toFixed(2)} MAD`],
        [isAr ? 'المبلغ المدفوع' : 'Montant Payé', `${repair.paidAmount.toFixed(2)} MAD`],
        [isAr ? 'المتبقي (دين)' : 'Reste à Payer (Dette)', `${repair.debtAmount.toFixed(2)} MAD`],
      ],
      styles: { fontSize: 11 },
      columnStyles: { 0: { fontStyle: 'bold' } },
    });

    doc.save(`reparation-${truck?.matricule || 'vehicule'}-${format(new Date(repair.date), 'dd-MM-yyyy')}.pdf`);
  };

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingRepair, setEditingRepair] = useState<Repair | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    truckId: '',
    type: 'mecanique' as 'mecanique' | 'electrique' | 'garage',
    totalCost: '',
    paidAmount: '',
    paymentMethod: 'especes' as 'especes' | 'cheque' | 'virement',
    date: new Date().toISOString().split('T')[0],
    remarks: ''
  });

  // Search and filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('tous');
  const [periodFilter, setPeriodFilter] = useState('toutes');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<'tous' | 'avec-dette' | 'reglees'>('tous');
  const [simulationAmount, setSimulationAmount] = useState('');
  const [activePreset, setActivePreset] = useState<'stabilisation' | 'encaissement' | 'zero-dette' | 'garage-focus' | 'custom'>('custom');
  const [forecastMode, setForecastMode] = useState<'defensif' | 'equilibre' | 'offensif'>('equilibre');
  const [executionWindow, setExecutionWindow] = useState<'14j' | '30j' | '60j'>('30j');
  const [targetDebt, setTargetDebt] = useState('');
  const [activeOverviewCard, setActiveOverviewCard] = useState('total');

  // Stats calculation
  const stats = useMemo(() => {
    const total = repairs.reduce((acc, r) => acc + r.totalCost, 0);
    const paid = repairs.reduce((acc, r) => acc + r.paidAmount, 0);
    const debt = repairs.reduce((acc, r) => acc + r.debtAmount, 0);
    const settlementRate = total > 0 ? Math.round((paid / total) * 100) : 0;
    const avgCost = repairs.length > 0 ? total / repairs.length : 0;
    return { total, paid, debt, count: repairs.length, settlementRate, avgCost };
  }, [repairs]);

  const overviewCards = [
    {
      key: 'count',
      title: tr('Nombre de Réparations', 'عدد الإصلاحات'),
      value: stats.count,
      suffix: '',
      decimals: 0,
      hint: tr('Opérations enregistrées', 'عمليات مسجّلة'),
      tag: tr('Volume', 'الحجم'),
      progress: Math.min(100, stats.count * 12),
      icon: History,
      shell: 'bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-950 border border-indigo-400/30 text-white',
      titleColor: 'text-indigo-100',
      valueColor: 'text-white',
      hintColor: 'text-indigo-100/90',
      tagColor: 'border-indigo-200/30 bg-indigo-300/15 text-indigo-100',
      iconWrap: 'bg-white/15 text-white',
      glow: 'from-indigo-200/30 via-fuchsia-200/20 to-transparent',
      progressTrack: 'bg-white/20',
      progressBar: 'from-cyan-300 via-indigo-200 to-fuchsia-200'
    },
    {
      key: 'total',
      title: tr('Coût Total', 'التكلفة الإجمالية'),
      value: stats.total,
      suffix: ' MAD',
      decimals: 0,
      hint: tr('Cumul total des coûts', 'إجمالي التكاليف'),
      tag: tr('Budget', 'الميزانية'),
      progress: stats.settlementRate,
      icon: Wrench,
      shell: 'bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 border border-amber-200/40 text-white',
      titleColor: 'text-amber-50',
      valueColor: 'text-white',
      hintColor: 'text-amber-50/95',
      tagColor: 'border-amber-100/40 bg-white/15 text-amber-50',
      iconWrap: 'bg-white/20 text-white',
      glow: 'from-amber-100/35 via-orange-100/20 to-transparent',
      progressTrack: 'bg-white/25',
      progressBar: 'from-yellow-200 via-orange-100 to-rose-100'
    },
    {
      key: 'paid',
      title: tr('Montant Réglé', 'المبلغ المسدَّد'),
      value: stats.paid,
      suffix: ' MAD',
      decimals: 0,
      hint: tr('Montant total payé', 'إجمالي المبلغ المدفوع'),
      tag: tr('Cashflow', 'التدفق النقدي'),
      progress: stats.settlementRate,
      icon: CheckCircle2,
      shell: 'bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 border border-emerald-200/40 text-white',
      titleColor: 'text-emerald-100',
      valueColor: 'text-white',
      hintColor: 'text-emerald-100',
      tagColor: 'border-emerald-100/40 bg-white/15 text-emerald-100',
      iconWrap: 'bg-white/20 text-white',
      glow: 'from-emerald-100/35 via-cyan-100/20 to-transparent',
      progressTrack: 'bg-white/25',
      progressBar: 'from-lime-200 via-emerald-100 to-cyan-100'
    },
    {
      key: 'debt',
      title: tr('Dettes Restantes', 'الديون المتبقية'),
      value: stats.debt,
      suffix: ' MAD',
      decimals: 0,
      hint: tr('Montant à régulariser', 'المبلغ الواجب تسويته'),
      tag: tr('Risque', 'المخاطر'),
      progress: stats.total > 0 ? Math.round((stats.debt / stats.total) * 100) : 0,
      icon: AlertCircle,
      shell: 'bg-gradient-to-br from-rose-500 via-pink-500 to-violet-600 border border-rose-200/40 text-white',
      titleColor: 'text-rose-100',
      valueColor: 'text-white',
      hintColor: 'text-rose-100',
      tagColor: 'border-rose-100/40 bg-white/15 text-rose-100',
      iconWrap: 'bg-white/20 text-white',
      glow: 'from-rose-100/35 via-pink-100/20 to-transparent',
      progressTrack: 'bg-white/25',
      progressBar: 'from-rose-100 via-pink-100 to-violet-100'
    }
  ];

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.truckId || !formData.totalCost || !formData.paidAmount || !formData.remarks) {
      toast({
        title: ru('toast.error', 'Erreur'),
        description: ru('toast.fillRequired', 'Veuillez remplir tous les champs obligatoires'),
        variant: "destructive"
      });
      return;
    }

    const totalCost = parseFloat(formData.totalCost);
    const paidAmount = parseFloat(formData.paidAmount);

    if (paidAmount > totalCost) {
      toast({
        title: ru('toast.error', 'Erreur'),
        description: ru('toast.paidExceedsTotal', 'Le montant payé ne peut pas être supérieur au coût total'),
        variant: "destructive"
      });
      return;
    }

    if (isEditing && editingRepair) {
      const updatedRepair: Repair = {
        ...editingRepair,
        date: formData.date,
        truckId: formData.truckId,
        type: formData.type,
        totalCost,
        paidAmount,
        debtAmount: totalCost - paidAmount,
        paymentMethod: formData.paymentMethod,
        remarks: formData.remarks
      };
      updateRepair(updatedRepair);
    } else {
      const newRepair: Repair = {
        id: (window.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)),
        date: formData.date,
        truckId: formData.truckId,
        type: formData.type,
        totalCost,
        paidAmount,
        debtAmount: totalCost - paidAmount,
        paymentMethod: formData.paymentMethod,
        remarks: formData.remarks
      };
      addRepair(newRepair);

      if (newRepair.type === 'garage' && newRepair.truckId) {
        updateTruck(newRepair.truckId, { isActive: false, reposReason: 'Garage' });
      }
    }

    setDialogOpen(false);
    setIsEditing(false);
    setEditingRepair(null);

    toast({
      title: ru('toast.success', 'Succès'),
      description: isEditing ? ru('toast.repairUpdated', 'Réparation mise à jour avec succès') : ru('toast.repairAdded', 'Réparation ajoutée avec succès')
    });
  };

  // Filter repairs based on search and filters
  const filteredRepairs = repairs.filter(repair => {
    const truck = trucks.find(t => t.id === repair.truckId);
    const truckMatricule = truck?.matricule || '';
    
    const matchesSearch = truckMatricule.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         repair.remarks.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = typeFilter === 'tous' || repair.type === typeFilter;
    
    let matchesPeriod = true;
    if (periodFilter !== 'toutes') {
      const repairDate = new Date(repair.date);
      const now = new Date();
      
      switch (periodFilter) {
        case '7jours':
          matchesPeriod = (now.getTime() - repairDate.getTime()) <= 7 * 24 * 60 * 60 * 1000;
          break;
        case '30jours':
          matchesPeriod = (now.getTime() - repairDate.getTime()) <= 30 * 24 * 60 * 60 * 1000;
          break;
        case '90jours':
          matchesPeriod = (now.getTime() - repairDate.getTime()) <= 90 * 24 * 60 * 60 * 1000;
          break;
      }
    }
    
    const matchesStatus =
      paymentStatusFilter === 'tous' ||
      (paymentStatusFilter === 'avec-dette' && repair.debtAmount > 0) ||
      (paymentStatusFilter === 'reglees' && repair.debtAmount <= 0);

    return matchesSearch && matchesType && matchesPeriod && matchesStatus;
  });

  const topDebtRepairs = useMemo(() => {
    return filteredRepairs
      .filter((repair) => repair.debtAmount > 0)
      .sort((a, b) => b.debtAmount - a.debtAmount)
      .slice(0, 3);
  }, [filteredRepairs]);

  const monthlyTrend = useMemo(() => {
    const now = new Date();
    const recentStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29).getTime();
    const previousStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 59).getTime();
    const recent = repairs
      .filter((repair) => {
        const repairTime = new Date(repair.date).getTime();
        return repairTime >= recentStart;
      })
      .reduce((sum, repair) => sum + repair.totalCost, 0);
    const previous = repairs
      .filter((repair) => {
        const repairTime = new Date(repair.date).getTime();
        return repairTime >= previousStart && repairTime < recentStart;
      })
      .reduce((sum, repair) => sum + repair.totalCost, 0);
    const delta = recent - previous;
    const percent = previous === 0 ? (recent > 0 ? 100 : 0) : Math.round((delta / previous) * 100);
    return { recent, previous, delta, percent };
  }, [repairs]);

  const getRepairAgeDays = (repairDate: string) => {
    const now = new Date().getTime();
    const date = new Date(repairDate).getTime();
    return Math.max(0, Math.floor((now - date) / (24 * 60 * 60 * 1000)));
  };

  const getSlaMeta = (repair: Repair) => {
    const age = getRepairAgeDays(repair.date);
    if (repair.debtAmount <= 0) {
      return { label: tr('Conforme', 'مطابق'), style: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
    }
    if (age >= 30) {
      return { label: tr('Critique', 'حرج'), style: 'bg-rose-100 text-rose-700 border-rose-200' };
    }
    if (age >= 15) {
      return { label: tr('À surveiller', 'تحت المراقبة'), style: 'bg-amber-100 text-amber-700 border-amber-200' };
    }
    return { label: tr('En délai', 'ضمن الأجل'), style: 'bg-blue-100 text-blue-700 border-blue-200' };
  };

  const overdueDebtCount = useMemo(() => {
    return repairs.filter((repair) => repair.debtAmount > 0 && getRepairAgeDays(repair.date) >= 30).length;
  }, [repairs]);

  const kanbanColumns = useMemo(() => {
    const urgent = filteredRepairs.filter((repair) => repair.debtAmount > 0 && getRepairAgeDays(repair.date) >= 30);
    const follow = filteredRepairs.filter((repair) => repair.debtAmount > 0 && getRepairAgeDays(repair.date) < 30);
    const done = filteredRepairs.filter((repair) => repair.debtAmount <= 0);
    return [
      { key: 'urgent', title: tr('Urgent', 'عاجل'), color: 'border-rose-200 bg-rose-50/50', items: urgent },
      { key: 'follow', title: tr('Suivi', 'متابعة'), color: 'border-amber-200 bg-amber-50/50', items: follow },
      { key: 'done', title: tr('Clôturé', 'مغلق'), color: 'border-emerald-200 bg-emerald-50/50', items: done }
    ];
  }, [filteredRepairs, language]);

  const debtBuckets = useMemo(() => {
    const openDebts = filteredRepairs.filter((repair) => repair.debtAmount > 0);
    const d0to14 = openDebts.filter((repair) => getRepairAgeDays(repair.date) < 15);
    const d15to29 = openDebts.filter((repair) => {
      const age = getRepairAgeDays(repair.date);
      return age >= 15 && age < 30;
    });
    const d30plus = openDebts.filter((repair) => getRepairAgeDays(repair.date) >= 30);
    return {
      d0to14: { count: d0to14.length, amount: d0to14.reduce((sum, repair) => sum + repair.debtAmount, 0) },
      d15to29: { count: d15to29.length, amount: d15to29.reduce((sum, repair) => sum + repair.debtAmount, 0) },
      d30plus: { count: d30plus.length, amount: d30plus.reduce((sum, repair) => sum + repair.debtAmount, 0) }
    };
  }, [filteredRepairs]);

  const priorityQueue = useMemo(() => {
    return filteredRepairs
      .filter((repair) => repair.debtAmount > 0)
      .map((repair) => ({
        repair,
        priorityScore: Math.round(repair.debtAmount * (1 + getRepairAgeDays(repair.date) / 30))
      }))
      .sort((a, b) => b.priorityScore - a.priorityScore)
      .slice(0, 5);
  }, [filteredRepairs]);

  const projectedDebt = useMemo(() => {
    const amount = Number(simulationAmount) || 0;
    return Math.max(0, stats.debt - amount);
  }, [simulationAmount, stats.debt]);

  const simulationImpact = useMemo(() => {
    const budget = Number(simulationAmount) || 0;
    const debtPool = repairs
      .filter((repair) => repair.debtAmount > 0)
      .sort((a, b) => {
        const scoreA = a.debtAmount * (1 + getRepairAgeDays(a.date) / 30);
        const scoreB = b.debtAmount * (1 + getRepairAgeDays(b.date) / 30);
        return scoreB - scoreA;
      });
    let remainingBudget = budget;
    let closedCount = 0;
    for (const repair of debtPool) {
      if (remainingBudget <= 0) break;
      if (remainingBudget >= repair.debtAmount) {
        remainingBudget -= repair.debtAmount;
        closedCount += 1;
      } else {
        remainingBudget = 0;
      }
    }
    return {
      closedCount,
      debtCases: debtPool.length,
      coverage: debtPool.length > 0 ? Math.round((closedCount / debtPool.length) * 100) : 0
    };
  }, [simulationAmount, repairs]);

  const riskScore = useMemo(() => {
    const debtRatio = stats.total > 0 ? stats.debt / stats.total : 0;
    return Math.max(0, Math.min(100, Math.round(debtRatio * 70 + overdueDebtCount * 6)));
  }, [stats.total, stats.debt, overdueDebtCount]);

  const riskMeta = useMemo(() => {
    if (riskScore >= 70) return { label: tr('Risque critique', 'مخاطر حرجة'), color: 'text-rose-700 bg-rose-50 border-rose-200' };
    if (riskScore >= 45) return { label: tr('Risque modéré', 'مخاطر متوسطة'), color: 'text-amber-700 bg-amber-50 border-amber-200' };
    return { label: tr('Risque maîtrisé', 'مخاطر مضبوطة'), color: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
  }, [riskScore, language]);

  const typeDebtPressure = useMemo(() => {
    const types: Array<{ key: 'mecanique' | 'electrique' | 'garage'; label: string }> = [
      { key: 'mecanique', label: tr('Mécanique', 'ميكانيك') },
      { key: 'electrique', label: tr('Électrique', 'كهربائي') },
      { key: 'garage', label: tr('Garage', 'مرآب') }
    ];
    return types.map((type) => {
      const list = filteredRepairs.filter((repair) => repair.type === type.key);
      const debt = list.reduce((sum, repair) => sum + repair.debtAmount, 0);
      const weight = stats.debt > 0 ? Math.round((debt / stats.debt) * 100) : 0;
      return { ...type, debt, count: list.length, weight };
    });
  }, [filteredRepairs, stats.debt, language]);

  const strategicRecommendations = useMemo(() => {
    const list: Array<{ id: string; title: string; note: string }> = [];
    if (riskScore >= 70) {
      list.push({ id: 'stabilisation', title: tr('Lancer stabilisation', 'تشغيل خطة الاستقرار'), note: tr('Réduit la pression critique 90 jours.', 'يخفّض الضغط الحرج خلال 90 يومًا.') });
    }
    if (stats.debt > 0 && stats.settlementRate < 70) {
      list.push({ id: 'encaissement', title: tr('Activer sprint encaissement', 'تفعيل سباق التحصيل'), note: tr('Pousse les dossiers solvables courts.', 'يدفع الملفات قصيرة الأجل القابلة للتحصيل.') });
    }
    if (stats.debt > 0 && overdueDebtCount >= 3) {
      list.push({ id: 'zero-dette', title: tr('Simuler quasi apurement', 'محاكاة شبه تسوية كاملة'), note: tr('Projette une baisse massive de dette.', 'يتوقع انخفاضًا كبيرًا في الديون.') });
    }
    if (debtBuckets.d30plus.count > 0) {
      list.push({ id: 'garage-focus', title: tr('Focus garage critique', 'تركيز على حالات المرآب الحرجة'), note: tr('Isoler les cas lourds à forte inertie.', 'عزل الحالات الثقيلة ذات الجمود العالي.') });
    }
    if (list.length === 0) {
      list.push({ id: 'encaissement', title: tr('Maintenir cadence encaissement', 'الحفاظ على وتيرة التحصيل'), note: tr('Consolide un profil déjà sain.', 'يعزز وضعًا ماليًا مستقرًا بالفعل.') });
    }
    return list.slice(0, 3);
  }, [riskScore, stats.debt, stats.settlementRate, overdueDebtCount, debtBuckets.d30plus.count, language]);

  const applyPreset = (preset: 'stabilisation' | 'encaissement' | 'zero-dette' | 'garage-focus') => {
    setSearchTerm('');
    setPaymentStatusFilter('avec-dette');
    if (preset === 'stabilisation') {
      setPeriodFilter('90jours');
      setTypeFilter('tous');
      setSimulationAmount(String(Math.round(stats.debt * 0.35)));
    }
    if (preset === 'encaissement') {
      setPeriodFilter('30jours');
      setTypeFilter('mecanique');
      setSimulationAmount(String(Math.round(stats.debt * 0.2)));
    }
    if (preset === 'zero-dette') {
      setPeriodFilter('toutes');
      setTypeFilter('tous');
      setSimulationAmount(String(stats.debt));
    }
    if (preset === 'garage-focus') {
      setPeriodFilter('90jours');
      setTypeFilter('garage');
      setSimulationAmount(String(Math.round(stats.debt * 0.45)));
    }
    setActivePreset(preset);
  };

  const timelineProjection = useMemo(() => {
    const now = Date.now();
    const days45 = 45 * 24 * 60 * 60 * 1000;
    const recentDebt = repairs
      .filter((repair) => repair.debtAmount > 0 && now - new Date(repair.date).getTime() <= days45)
      .reduce((sum, repair) => sum + repair.debtAmount, 0);
    const weeklyNewDebt = recentDebt / 6 || (stats.debt > 0 ? stats.debt / 8 : 0);
    const modeMultiplier = forecastMode === 'defensif' ? 0.85 : forecastMode === 'offensif' ? 1.25 : 1;
    const weeklyReduction = weeklyNewDebt * (0.7 + stats.settlementRate / 120) * modeMultiplier;
    const weeklyBudgetBoost = (Number(simulationAmount) || 0) / 6;
    let debtCursor = stats.debt;
    return Array.from({ length: 6 }, (_, index) => {
      const inflow = weeklyNewDebt;
      const outflow = weeklyReduction + weeklyBudgetBoost;
      debtCursor = Math.max(0, debtCursor + inflow - outflow);
      const pressure = debtCursor > stats.debt * 0.9 ? 'high' : debtCursor > stats.debt * 0.5 ? 'medium' : 'low';
      return {
        week: index + 1,
        projectedDebt: debtCursor,
        pressure,
        variance: inflow - outflow
      };
    });
  }, [repairs, stats.debt, stats.settlementRate, simulationAmount, forecastMode]);

  const commandSignal = useMemo(() => {
    const first = timelineProjection[0]?.projectedDebt ?? stats.debt;
    const last = timelineProjection[timelineProjection.length - 1]?.projectedDebt ?? stats.debt;
    const delta = last - first;
    const trend = delta > 0 ? tr('Hausse', 'ارتفاع') : delta < 0 ? tr('Baisse', 'انخفاض') : tr('Stable', 'مستقر');
    const alertLevel = last > stats.debt * 0.85 ? 'red' : last > stats.debt * 0.45 ? 'amber' : 'green';
    return { delta, trend, alertLevel };
  }, [timelineProjection, stats.debt, language]);

  const effectiveTargetDebt = useMemo(() => {
    const suggested = executionWindow === '14j' ? stats.debt * 0.75 : executionWindow === '30j' ? stats.debt * 0.55 : stats.debt * 0.35;
    const typedTarget = Number(targetDebt);
    if (!Number.isFinite(typedTarget) || typedTarget < 0) return Math.round(suggested);
    return Math.min(stats.debt, typedTarget);
  }, [executionWindow, targetDebt, stats.debt]);

  const executionScoreboard = useMemo(() => {
    const projectedEndDebt = timelineProjection[timelineProjection.length - 1]?.projectedDebt ?? stats.debt;
    const attainment = stats.debt > 0 ? Math.max(0, Math.min(100, Math.round((1 - projectedEndDebt / stats.debt) * 100))) : 100;
    const gap = Math.max(0, projectedEndDebt - effectiveTargetDebt);
    const feasibility = gap <= 0
      ? tr('Objectif atteignable', 'هدف قابل للتحقيق')
      : gap <= stats.debt * 0.2
        ? tr('Objectif sous pression', 'هدف تحت الضغط')
        : tr('Objectif agressif', 'هدف هجومي');
    return { projectedEndDebt, attainment, gap, feasibility };
  }, [timelineProjection, stats.debt, effectiveTargetDebt, language]);

  const priorityMissions = useMemo(() => {
    return repairs
      .filter((repair) => repair.debtAmount > 0)
      .map((repair) => {
        const ageDays = getRepairAgeDays(repair.date);
        const truck = trucks.find((item) => item.id === repair.truckId);
        const score = Math.round(repair.debtAmount * (1 + ageDays / 20));
        const action =
          repair.type === 'garage'
            ? 'garage-focus'
            : ageDays >= 30
              ? 'stabilisation'
              : repair.debtAmount > stats.avgCost
                ? 'zero-dette'
                : 'encaissement';
        return {
          id: repair.id,
          truckMatricule: truck?.matricule || tr('Inconnu', 'غير معروف'),
          amount: repair.debtAmount,
          ageDays,
          score,
          action
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);
  }, [repairs, trucks, stats.avgCost]);

  const selectedTruck = trucks.find(t => String(t.id) === formData.truckId);

  return (
    <div className="app-page-shell p-4 md:p-8 space-y-8 bg-slate-50/50 min-h-screen">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="app-page-title text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Wrench className="h-8 w-8 text-orange-600" />
            </div>
            {tr('Gestion des Réparations', 'إدارة الإصلاحات')}
          </h1>
          <p className="text-slate-500 mt-1 flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            {new Date().toLocaleDateString(uiLocale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <Button 
          onClick={() => {
            setIsEditing(false);
            setEditingRepair(null);
            setFormData({
              truckId: '',
              type: 'mecanique',
              totalCost: '',
              paidAmount: '',
              paymentMethod: 'especes',
              date: new Date().toISOString().split('T')[0],
              remarks: ''
            });
            setDialogOpen(true);
          }}
          className="bg-orange-600 hover:bg-orange-700 text-white shadow-lg shadow-orange-200 transition-all active:scale-95"
        >
          <Plus className="mr-2 h-5 w-5" /> {ru('actions.addRepair', 'Ajouter la réparation')}
        </Button>
      </div>

      <Card className="app-dark-hero border-none shadow-xl overflow-hidden bg-gradient-to-r from-slate-900 via-orange-900 to-slate-900 text-white">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div>
              <h2 className="app-page-title text-2xl md:text-3xl font-black tracking-tight">{tr('Repair Control Studio', 'استوديو التحكم في الإصلاح')}</h2>
              <p className="app-page-subtitle text-orange-100 mt-1">{tr('Pilotage intelligent des coûts, dettes et actions prioritaires atelier.', 'قيادة ذكية للتكاليف والديون وأولويات الورشة.')}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge className="bg-white/15 text-white hover:bg-white/15 border border-white/20 rounded-full">
                  {tr('Taux de règlement', 'معدل التسوية')}: {stats.settlementRate}%
                </Badge>
                <Badge className="bg-white/15 text-white hover:bg-white/15 border border-white/20 rounded-full">
                  {tr('Coût moyen', 'التكلفة المتوسطة')}: {stats.avgCost.toLocaleString(uiLocale)} MAD
                </Badge>
                <Badge className="bg-white/15 text-white hover:bg-white/15 border border-white/20 rounded-full">
                  {tr('Vue active', 'العرض النشط')}: {filteredRepairs.length} {tr('opérations', 'عمليات')}
                </Badge>
                <Badge className="bg-white/15 text-white hover:bg-white/15 border border-white/20 rounded-full">
                  {tr('Alertes SLA', 'تنبيهات SLA')}: {overdueDebtCount}
                </Badge>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"
                onClick={() => {
                  setPaymentStatusFilter('avec-dette');
                  setPeriodFilter('30jours');
                }}
              >
                <ShieldAlert className="mr-2 h-4 w-4" />
                {tr('Focus dettes', 'تركيز الديون')}
              </Button>
              <Button
                variant="outline"
                className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"
                onClick={() => {
                  setPaymentStatusFilter('tous');
                  setPeriodFilter('7jours');
                }}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                {tr('Focus 7 jours', 'تركيز 7 أيام')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {overviewCards.map((card, index) => {
          const Icon = card.icon;
          const isActive = activeOverviewCard === card.key;
          return (
            <motion.div
              key={card.key}
              initial={{ opacity: 0, y: 26, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: index * 0.1, duration: 0.45, ease: 'easeOut' }}
              whileHover={{ y: -6, scale: 1.015 }}
              whileTap={{ scale: 0.99 }}
              onMouseEnter={() => setActiveOverviewCard(card.key)}
              onFocus={() => setActiveOverviewCard(card.key)}
              tabIndex={0}
            >
              <Card className={`group relative overflow-hidden rounded-2xl shadow-xl transition-all duration-500 hover:shadow-2xl hover:shadow-black/20 ${card.shell} ${isActive ? 'ring-2 ring-white/40' : 'ring-1 ring-white/10'}`}>
                <motion.div
                  className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${card.glow} opacity-70`}
                  animate={{ x: ['-12%', '12%', '-12%'], y: ['0%', '-8%', '0%'] }}
                  transition={{ duration: 8 + index, repeat: Infinity, ease: 'easeInOut' }}
                />
                <motion.div
                  className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-white/20 blur-3xl"
                  animate={{ scale: [1, 1.25, 1], opacity: [0.35, 0.55, 0.35] }}
                  transition={{ duration: 5 + index, repeat: Infinity, ease: 'easeInOut' }}
                />
                <motion.div
                  className="pointer-events-none absolute -left-10 bottom-0 h-16 w-32 bg-gradient-to-r from-white/15 via-white/35 to-transparent blur-2xl"
                  animate={{ x: ['0%', '26%', '0%'], opacity: [0.2, 0.45, 0.2] }}
                  transition={{ duration: 6 + index, repeat: Infinity, ease: 'easeInOut' }}
                />
                <CardHeader className="relative pb-2">
                  <CardTitle className={`text-sm font-semibold flex items-center justify-between ${card.titleColor}`}>
                    <span className="flex items-center gap-2">
                      {card.title}
                      <Badge variant="outline" className={`h-5 rounded-full px-2 text-[10px] font-bold ${card.tagColor}`}>
                        {card.tag}
                      </Badge>
                    </span>
                    <motion.span
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${card.iconWrap}`}
                      whileHover={{ rotate: 8, scale: 1.08 }}
                      transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                    >
                      <Icon className="h-4 w-4" />
                    </motion.span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="relative space-y-3">
                  <AnimatedMetricValue
                    value={card.value}
                    suffix={card.suffix}
                    decimals={card.decimals}
                    className={`text-2xl font-black tracking-tight ${card.valueColor}`}
                  />
                  <div className={`h-2 w-full overflow-hidden rounded-full ${card.progressTrack}`}>
                    <motion.div
                      className={`h-full rounded-full bg-gradient-to-r ${card.progressBar}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.max(6, Math.min(100, card.progress))}%` }}
                      transition={{ delay: 0.2 + index * 0.12, duration: 0.7, ease: 'easeOut' }}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <p className={`text-xs ${card.hintColor}`}>{card.hint}</p>
                    <span className={`text-xs font-semibold ${card.hintColor}`}>{Math.max(0, Math.min(100, card.progress))}%</span>
                  </div>
                  <motion.div
                    className="h-px w-full bg-gradient-to-r from-transparent via-white/60 to-transparent"
                    animate={{ opacity: isActive ? [0.25, 0.85, 0.25] : [0.15, 0.35, 0.15] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                  />
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Filters & Search */}
      <Card className="border-none shadow-sm">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder={ru('placeholder.searchByVehicleOrRemark', 'Rechercher par véhicule ou remarque...')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 border-slate-200 focus:ring-orange-500"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="border-slate-200">
                <Filter className="mr-2 h-4 w-4 text-slate-400" />
                <SelectValue placeholder={ru('placeholder.repairType', 'Type de réparation')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tous">{tr('Tous les types', 'كل الأنواع')}</SelectItem>
                <SelectItem value="mecanique">{tr('Mécanique', 'ميكانيك')}</SelectItem>
                <SelectItem value="electrique">{tr('Électrique', 'كهربائي')}</SelectItem>
                <SelectItem value="garage">{tr('Garage', 'مرآب')}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={periodFilter} onValueChange={setPeriodFilter}>
              <SelectTrigger className="border-slate-200">
                <Calendar className="mr-2 h-4 w-4 text-slate-400" />
                <SelectValue placeholder={ru('placeholder.period', 'Période')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="toutes">{tr('Toutes les périodes', 'كل الفترات')}</SelectItem>
                <SelectItem value="7jours">{tr('7 derniers jours', 'آخر 7 أيام')}</SelectItem>
                <SelectItem value="30jours">{tr('30 derniers jours', 'آخر 30 يومًا')}</SelectItem>
                <SelectItem value="90jours">{tr('90 derniers jours', 'آخر 90 يومًا')}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={paymentStatusFilter} onValueChange={(value: 'tous' | 'avec-dette' | 'reglees') => setPaymentStatusFilter(value)}>
              <SelectTrigger className="border-slate-200">
                <AlertCircle className="mr-2 h-4 w-4 text-slate-400" />
                <SelectValue placeholder={ru('placeholder.paymentStatus', 'Statut paiement')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tous">{tr('Tous les statuts', 'كل الحالات')}</SelectItem>
                <SelectItem value="avec-dette">{tr('Avec dette', 'مع دين')}</SelectItem>
                <SelectItem value="reglees">{tr('Réglées', 'مسددة')}</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center justify-end">
              <p className="text-sm text-slate-500 font-medium">
                {filteredRepairs.length} {tr('résultat', 'نتيجة')}{filteredRepairs.length > 1 ? tr('s', '') : ''}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="border-none shadow-sm bg-white lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              {tr('Tendance Coût 30J', 'منحنى تكلفة آخر 30 يومًا')}
              {monthlyTrend.delta >= 0 ? (
                <TrendingUp className="h-5 w-5 text-rose-600" />
              ) : (
                <TrendingDown className="h-5 w-5 text-emerald-600" />
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-3">
              <div className="rounded-xl border border-slate-200 p-3 bg-slate-50/60">
                <p className="text-xs text-slate-500">
                  {tr('30 jours récents', 'آخر 30 يومًا')}
                </p>
                <p className="text-lg font-bold text-slate-900">{monthlyTrend.recent.toLocaleString(uiLocale)} MAD</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-3 bg-slate-50/60">
                <p className="text-xs text-slate-500">
                  {tr('30 jours précédents', '30 يومًا السابقة')}
                </p>
                <p className="text-lg font-bold text-slate-900">{monthlyTrend.previous.toLocaleString(uiLocale)} MAD</p>
              </div>
              <div className={`rounded-xl border p-3 ${monthlyTrend.delta >= 0 ? 'border-rose-200 bg-rose-50/60' : 'border-emerald-200 bg-emerald-50/60'}`}>
                <p className="text-xs text-slate-500">
                  {tr('Variation', 'التغيّر')}
                </p>
                <p className={`text-lg font-bold ${monthlyTrend.delta >= 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                  {monthlyTrend.delta >= 0 ? '+' : ''}
                  {monthlyTrend.percent}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{tr('Top Dettes', 'أعلى الديون')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topDebtRepairs.length > 0 ? (
              topDebtRepairs.map((repair) => {
                const truck = trucks.find((t) => t.id === repair.truckId);
                return (
                  <button
                    key={repair.id}
                    type="button"
                    onClick={() => {
                      setSearchTerm(truck?.matricule || '');
                      setPaymentStatusFilter('avec-dette');
                    }}
                    className="app-panel w-full text-left rounded-lg border border-slate-200 p-3 hover:bg-slate-50 transition-colors"
                  >
                    <p className="text-sm font-semibold text-slate-900">{truck?.matricule || tr('Inconnu', 'غير معروف')}</p>
                    <p className="text-xs text-rose-600 font-bold">{repair.debtAmount.toLocaleString(uiLocale)} MAD</p>
                  </button>
                );
              })
            ) : (
              <p className="text-sm text-slate-500">{tr('Aucune dette sur la vue active.', 'لا توجد ديون ضمن العرض النشط.')}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-sm bg-white">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{tr('Kanban Opérationnel', 'كانبان تشغيلي')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {kanbanColumns.map((column) => (
              <div key={column.key} className={`app-panel rounded-xl border p-3 ${column.color}`}>
                <div className="flex items-center justify-between mb-3">
                  <p className="font-semibold text-slate-900">{column.title}</p>
                  <Badge variant="outline" className="bg-white">
                    {column.items.length}
                  </Badge>
                </div>
                <div className="space-y-2 max-h-64 overflow-auto pr-1">
                  {column.items.length > 0 ? (
                    column.items.map((repair) => {
                      const truck = trucks.find((t) => t.id === repair.truckId);
                      return (
                        <button
                          key={repair.id}
                          type="button"
                          onClick={() => setSearchTerm(truck?.matricule || '')}
                          className="app-panel w-full text-left rounded-lg border border-slate-200 bg-white p-3 hover:bg-slate-50 transition-colors"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-slate-900 truncate">{truck?.matricule || tr('Inconnu', 'غير معروف')}</p>
                    <span className="text-xs font-bold text-slate-600">{new Date(repair.date).toLocaleDateString(uiLocale, { day: '2-digit', month: '2-digit' })}</span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">{repair.totalCost.toLocaleString(uiLocale)} MAD</p>
                        </button>
                      );
                    })
                  ) : (
                    <p className="text-xs text-slate-500">{tr('Aucune opération.', 'لا توجد عملية.')}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="border-none shadow-sm bg-white xl:col-span-2">
          <CardHeader className="pb-2">
          <CardTitle className="text-base">{tr('Cockpit Priorités Dettes', 'قمرة أولويات الديون')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => {
                  setPaymentStatusFilter('avec-dette');
                  setPeriodFilter('toutes');
                }}
                className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-left hover:bg-blue-100/60 transition-colors"
              >
                <p className="text-xs text-blue-700 font-semibold">
                  {tr('0-14 jours', '0-14 يومًا')}
                </p>
                <p className="text-lg font-bold text-blue-900">{debtBuckets.d0to14.amount.toLocaleString(uiLocale)} MAD</p>
                <p className="text-xs text-blue-700">
                  {debtBuckets.d0to14.count} {tr('dossier', 'ملف')}{debtBuckets.d0to14.count > 1 ? tr('s', '') : ''}
                </p>
              </button>
              <button
                type="button"
                onClick={() => {
                  setPaymentStatusFilter('avec-dette');
                  setPeriodFilter('30jours');
                }}
                className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-left hover:bg-amber-100/60 transition-colors"
              >
                <p className="text-xs text-amber-700 font-semibold">
                  {tr('15-29 jours', '15-29 يومًا')}
                </p>
                <p className="text-lg font-bold text-amber-900">{debtBuckets.d15to29.amount.toLocaleString(uiLocale)} MAD</p>
                <p className="text-xs text-amber-700">
                  {debtBuckets.d15to29.count} {tr('dossier', 'ملف')}{debtBuckets.d15to29.count > 1 ? tr('s', '') : ''}
                </p>
              </button>
              <button
                type="button"
                onClick={() => {
                  setPaymentStatusFilter('avec-dette');
                  setPeriodFilter('90jours');
                }}
                className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-left hover:bg-rose-100/60 transition-colors"
              >
                <p className="text-xs text-rose-700 font-semibold">
                  {tr('30+ jours', '30+ يومًا')}
                </p>
                <p className="text-lg font-bold text-rose-900">{debtBuckets.d30plus.amount.toLocaleString(uiLocale)} MAD</p>
                <p className="text-xs text-rose-700">
                  {debtBuckets.d30plus.count} {tr('dossier', 'ملف')}{debtBuckets.d30plus.count > 1 ? tr('s', '') : ''}
                </p>
              </button>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-800">{tr('File de priorités', 'قائمة الأولويات')}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => {
                    setPaymentStatusFilter('avec-dette');
                    setTypeFilter('tous');
                    setPeriodFilter('toutes');
                  }}
                >
                  {tr('Afficher tout', 'عرض الكل')}
                </Button>
              </div>
              {priorityQueue.length > 0 ? (
                <div className="space-y-2">
                  {priorityQueue.map(({ repair, priorityScore }) => {
                    const truck = trucks.find((t) => t.id === repair.truckId);
                    return (
                      <button
                        key={repair.id}
                        type="button"
                        onClick={() => setSearchTerm(truck?.matricule || '')}
                        className="w-full rounded-lg border border-slate-200 p-3 text-left hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-900">{truck?.matricule || tr('Inconnu', 'غير معروف')}</p>
                          <Badge variant="outline" className="text-[10px]">
                            Score {priorityScore}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          {tr('Dette', 'دين')} {repair.debtAmount.toLocaleString(uiLocale)} MAD · {getRepairAgeDays(repair.date)} {tr('jours', 'يوم')}
                        </p>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-slate-500">{tr('Aucune priorité active.', 'لا توجد أولوية نشطة.')}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-2">
          <CardTitle className="text-base">{tr('Simulateur Règlement', 'محاكي التسوية')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm text-slate-600">{ru('label.amountToInject', 'Montant à injecter (MAD)')}</Label>
              <Input
                type="number"
                min="0"
                value={simulationAmount}
                onChange={(e) => setSimulationAmount(e.target.value)}
                placeholder={ru('placeholder.injectExample', 'Ex: 15000')}
              />
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-1">
              <p className="text-xs text-slate-500">{tr('Dette actuelle', 'الدين الحالي')}</p>
              <p className="text-lg font-bold text-slate-900">{stats.debt.toLocaleString(uiLocale)} MAD</p>
              <p className="text-xs text-slate-500 mt-2">{tr('Dette projetée', 'الدين المتوقع')}</p>
              <p className="text-xl font-black text-emerald-700">{projectedDebt.toLocaleString(uiLocale)} MAD</p>
              <p className="text-xs text-slate-500">
                {tr('Réduction', 'التخفيض')}: {(stats.debt - projectedDebt).toLocaleString(uiLocale)} MAD
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => setSimulationAmount(String(Math.round(stats.debt * 0.25)))}>
                25%
              </Button>
              <Button variant="outline" onClick={() => setSimulationAmount(String(Math.round(stats.debt * 0.5)))}>
                50%
              </Button>
            </div>
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
              <p className="text-xs text-blue-700 font-semibold">{tr('Impact de liquidation', 'أثر التصفية')}</p>
              <p className="text-sm text-blue-900 mt-1">
                {simulationImpact.closedCount} {tr('dossier', 'ملف')}{simulationImpact.closedCount > 1 ? tr('s', '') : ''} {tr('clôturable', 'قابل للإغلاق')}{simulationImpact.closedCount > 1 ? tr('s', '') : ''}
              </p>
              <p className="text-xs text-blue-700">
                {tr('Couverture estimée', 'التغطية التقديرية')}: {simulationImpact.coverage}% ({simulationImpact.debtCases} {tr('dossiers ouverts', 'ملفات مفتوحة')})
              </p>
            </div>
            <Button
              className="w-full bg-orange-600 hover:bg-orange-700"
              onClick={() => {
                setPaymentStatusFilter('avec-dette');
                setPeriodFilter('toutes');
              }}
            >
              {tr('Ouvrir dossiers à régulariser', 'فتح الملفات المطلوب تسويتها')}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-sm bg-white">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Brain className="h-4 w-4 text-orange-600" />
            {tr('Radar Stratégique V2.3', 'الرادار الاستراتيجي V2.3')}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/70 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-800">{tr('Indice de risque atelier', 'مؤشر مخاطر الورشة')}</p>
              <Badge variant="outline" className={riskMeta.color}>{riskMeta.label}</Badge>
            </div>
            <div className="w-full h-2.5 rounded-full bg-slate-200 overflow-hidden">
              <div className={`h-full ${riskScore >= 70 ? 'bg-rose-500' : riskScore >= 45 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${riskScore}%` }} />
            </div>
            <p className="text-xs text-slate-600">{tr('Score actuel', 'النقاط الحالية')}: {riskScore}/100</p>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setPaymentStatusFilter('avec-dette');
                setPeriodFilter('90jours');
              }}
            >
              <Siren className="mr-2 h-4 w-4" />
              {tr('Afficher urgences critiques', 'عرض الحالات الحرجة العاجلة')}
            </Button>
          </div>

          <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/70 space-y-3">
            <p className="text-sm font-semibold text-slate-800">{tr('Pression par type', 'الضغط حسب النوع')}</p>
            <div className="space-y-2">
              {typeDebtPressure.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    setTypeFilter(item.key);
                    setPaymentStatusFilter('avec-dette');
                  }}
                  className="app-panel w-full text-left rounded-lg border border-slate-200 bg-white p-2.5 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-700">{item.label}</p>
                    <span className="text-xs text-slate-500">{item.weight}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-200 mt-1 overflow-hidden">
                    <div className="h-full bg-orange-500" style={{ width: `${item.weight}%` }} />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">{item.debt.toLocaleString(uiLocale)} MAD · {item.count} {tr('opérations', 'عمليات')}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="app-panel rounded-xl border border-slate-200 p-4 bg-slate-50/70 space-y-3">
            <p className="text-sm font-semibold text-slate-800">{tr('Actions recommandées', 'إجراءات موصى بها')}</p>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => {
                setSimulationAmount(String(Math.round(stats.debt * 0.75)));
              }}
            >
              <Rocket className="mr-2 h-4 w-4" />
              {tr('Simuler apurement 75%', 'محاكاة تسوية 75%')}
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => {
                setSimulationAmount(String(stats.debt));
                setPaymentStatusFilter('avec-dette');
              }}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              {tr('Simuler clôture complète', 'محاكاة إغلاق كامل')}
            </Button>
            <Button
              className="w-full bg-orange-600 hover:bg-orange-700 justify-start"
              onClick={() => {
                setSearchTerm('');
                setPaymentStatusFilter('avec-dette');
                setPeriodFilter('30jours');
                setTypeFilter('tous');
              }}
            >
              <ShieldAlert className="mr-2 h-4 w-4" />
              {tr('Prioriser plan 30 jours', 'إعطاء أولوية لخطة 30 يومًا')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm bg-white">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Gauge className="h-4 w-4 text-orange-600" />
            {tr('Presets Stratégiques V2.4', 'الضبطات الاستراتيجية V2.4')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            <button
              type="button"
              onClick={() => applyPreset('stabilisation')}
              className={`rounded-xl border p-3 text-left transition-colors ${activePreset === 'stabilisation' ? 'border-rose-300 bg-rose-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
            >
              <div className="flex items-center gap-2 text-rose-700">
                <Flame className="h-4 w-4" />
                <p className="text-sm font-semibold">{tr('Stabilisation', 'استقرار')}</p>
              </div>
              <p className="text-xs text-slate-600 mt-1">{tr('Priorité urgences et dossiers anciens.', 'أولوية للحالات العاجلة والملفات القديمة.')}</p>
            </button>
            <button
              type="button"
              onClick={() => applyPreset('encaissement')}
              className={`rounded-xl border p-3 text-left transition-colors ${activePreset === 'encaissement' ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
            >
              <div className="flex items-center gap-2 text-amber-700">
                <Target className="h-4 w-4" />
                <p className="text-sm font-semibold">{tr('Sprint Encaissement', 'سباق التحصيل')}</p>
              </div>
              <p className="text-xs text-slate-600 mt-1">{tr('Ciblage flux court et conversion rapide.', 'استهداف التدفق القصير والتحويل السريع.')}</p>
            </button>
            <button
              type="button"
              onClick={() => applyPreset('zero-dette')}
              className={`rounded-xl border p-3 text-left transition-colors ${activePreset === 'zero-dette' ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
            >
              <div className="flex items-center gap-2 text-emerald-700">
                <Rocket className="h-4 w-4" />
                <p className="text-sm font-semibold">{tr('Trajectoire Zéro Dette', 'مسار صفر ديون')}</p>
              </div>
              <p className="text-xs text-slate-600 mt-1">{tr('Simulation de clôture maximale.', 'محاكاة أقصى إغلاق.')}</p>
            </button>
            <button
              type="button"
              onClick={() => applyPreset('garage-focus')}
              className={`rounded-xl border p-3 text-left transition-colors ${activePreset === 'garage-focus' ? 'border-purple-300 bg-purple-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
            >
              <div className="flex items-center gap-2 text-purple-700">
                <ShieldAlert className="h-4 w-4" />
                <p className="text-sm font-semibold">{tr('Focus Garage', 'تركيز المرآب')}</p>
              </div>
              <p className="text-xs text-slate-600 mt-1">{tr('Isolement des cas à inertie élevée.', 'عزل الحالات ذات الجمود العالي.')}</p>
            </button>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm font-semibold text-slate-800">{tr('Suggestions automatiques', 'اقتراحات تلقائية')}</p>
            <div className="mt-2 grid grid-cols-1 lg:grid-cols-3 gap-2">
              {strategicRecommendations.map((recommendation) => (
                <button
                  key={recommendation.id}
                  type="button"
                  onClick={() => applyPreset(recommendation.id as 'stabilisation' | 'encaissement' | 'zero-dette' | 'garage-focus')}
                  className="rounded-lg border border-slate-200 bg-white p-2.5 text-left hover:bg-slate-50 transition-colors"
                >
                  <p className="text-xs font-semibold text-slate-800">{recommendation.title}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{recommendation.note}</p>
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm bg-white">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-orange-600" />
            {tr('Command Center V3.0', 'مركز القيادة V3.0')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <Button
              variant={forecastMode === 'defensif' ? 'default' : 'outline'}
              className={forecastMode === 'defensif' ? 'bg-rose-600 hover:bg-rose-700' : ''}
              onClick={() => setForecastMode('defensif')}
            >
              {tr('Scénario Défensif', 'سيناريو دفاعي')}
            </Button>
            <Button
              variant={forecastMode === 'equilibre' ? 'default' : 'outline'}
              className={forecastMode === 'equilibre' ? 'bg-orange-600 hover:bg-orange-700' : ''}
              onClick={() => setForecastMode('equilibre')}
            >
              {tr('Scénario Équilibré', 'سيناريو متوازن')}
            </Button>
            <Button
              variant={forecastMode === 'offensif' ? 'default' : 'outline'}
              className={forecastMode === 'offensif' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
              onClick={() => setForecastMode('offensif')}
            >
              {tr('Scénario Offensif', 'سيناريو هجومي')}
            </Button>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="xl:col-span-2 rounded-xl border border-slate-200 p-4 bg-slate-50/70">
              <p className="text-sm font-semibold text-slate-800 mb-3">{tr('Timeline prédictive dettes (6 semaines)', 'الخط الزمني التنبئي للديون (6 أسابيع)')}</p>
              <div className="space-y-2">
                {timelineProjection.map((point) => (
                  <button
                    key={point.week}
                    type="button"
                    onClick={() => {
                      setPaymentStatusFilter('avec-dette');
                      if (point.pressure === 'high') setPeriodFilter('90jours');
                      if (point.pressure === 'medium') setPeriodFilter('30jours');
                      if (point.pressure === 'low') setPeriodFilter('7jours');
                    }}
                    className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-left hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-slate-700">{tr('Semaine', 'الأسبوع')} {point.week}</p>
                      <Badge variant="outline" className={point.pressure === 'high' ? 'text-rose-700 border-rose-200 bg-rose-50' : point.pressure === 'medium' ? 'text-amber-700 border-amber-200 bg-amber-50' : 'text-emerald-700 border-emerald-200 bg-emerald-50'}>
                        {point.pressure === 'high' ? tr('Élevée', 'مرتفعة') : point.pressure === 'medium' ? tr('Moyenne', 'متوسطة') : tr('Faible', 'منخفضة')}
                      </Badge>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <p className="text-sm font-bold text-slate-900">{point.projectedDebt.toLocaleString(uiLocale)} MAD</p>
                      <p className={`text-xs font-semibold ${point.variance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {point.variance > 0 ? '+' : ''}
                        {Math.round(point.variance).toLocaleString(uiLocale)} MAD/{tr('sem', 'أسبوع')}
                      </p>
                    </div>
                    <div className="mt-1.5 w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${point.pressure === 'high' ? 'bg-rose-500' : point.pressure === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'}`}
                        style={{ width: `${Math.min(100, stats.debt > 0 ? (point.projectedDebt / stats.debt) * 100 : 0)}%` }}
                      />
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/70 space-y-3">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-orange-600" />
                <p className="text-sm font-semibold text-slate-800">{tr('Signal stratégique', 'الإشارة الاستراتيجية')}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <p className="text-xs text-slate-500">{tr('Tendance projetée', 'الاتجاه المتوقع')}</p>
                <p className="text-base font-bold text-slate-900">{commandSignal.trend}</p>
                <p className="text-xs text-slate-500 mt-1">{tr('Delta 6 semaines', 'فارق 6 أسابيع')}</p>
                <p className={`text-sm font-semibold ${commandSignal.delta > 0 ? 'text-rose-600' : commandSignal.delta < 0 ? 'text-emerald-600' : 'text-slate-700'}`}>
                  {commandSignal.delta > 0 ? '+' : ''}
                  {Math.round(commandSignal.delta).toLocaleString(uiLocale)} MAD
                </p>
                <Badge variant="outline" className={`mt-2 ${commandSignal.alertLevel === 'red' ? 'text-rose-700 border-rose-200 bg-rose-50' : commandSignal.alertLevel === 'amber' ? 'text-amber-700 border-amber-200 bg-amber-50' : 'text-emerald-700 border-emerald-200 bg-emerald-50'}`}>
                  {commandSignal.alertLevel === 'red' ? tr('Alerte rouge', 'إنذار أحمر') : commandSignal.alertLevel === 'amber' ? tr('Alerte orange', 'إنذار برتقالي') : tr('Alerte verte', 'إنذار أخضر')}
                </Badge>
              </div>
              <Button
                className="w-full bg-orange-600 hover:bg-orange-700"
                onClick={() => applyPreset('stabilisation')}
              >
                {tr('Déclencher plan stabilisation', 'تفعيل خطة الاستقرار')}
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setForecastMode('offensif');
                  applyPreset('zero-dette');
                }}
              >
                {tr('Passer en mode offensif', 'التحول إلى الوضع الهجومي')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm bg-white">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4 text-orange-600" />
            {tr('Execution Board V3.1', 'لوحة التنفيذ V3.1')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <Button
              variant={executionWindow === '14j' ? 'default' : 'outline'}
              className={executionWindow === '14j' ? 'bg-rose-600 hover:bg-rose-700' : ''}
              onClick={() => setExecutionWindow('14j')}
            >
              {tr('Fenêtre 14 jours', 'نافذة 14 يومًا')}
            </Button>
            <Button
              variant={executionWindow === '30j' ? 'default' : 'outline'}
              className={executionWindow === '30j' ? 'bg-orange-600 hover:bg-orange-700' : ''}
              onClick={() => setExecutionWindow('30j')}
            >
              {tr('Fenêtre 30 jours', 'نافذة 30 يومًا')}
            </Button>
            <Button
              variant={executionWindow === '60j' ? 'default' : 'outline'}
              className={executionWindow === '60j' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
              onClick={() => setExecutionWindow('60j')}
            >
              {tr('Fenêtre 60 jours', 'نافذة 60 يومًا')}
            </Button>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
              <p className="text-sm font-semibold text-slate-800">{tr('Objectif dette piloté', 'هدف دين موجه')}</p>
              <div className="space-y-2">
                <Label htmlFor="targetDebt">{ru('label.targetDebtFinal', 'Cible de dette finale')}</Label>
                <Input
                  id="targetDebt"
                  type="number"
                  min="0"
                  value={targetDebt}
                  onChange={(e) => setTargetDebt(e.target.value)}
                  placeholder={Math.round(effectiveTargetDebt).toString()}
                />
                <p className="text-xs text-slate-500">{tr('Cible active', 'الهدف النشط')}: {Math.round(effectiveTargetDebt).toLocaleString(uiLocale)} MAD</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-1">
                <p className="text-xs text-slate-500">{tr('Projection fin de fenêtre', 'توقع نهاية النافذة')}</p>
                <p className="text-sm font-bold text-slate-900">{Math.round(executionScoreboard.projectedEndDebt).toLocaleString(uiLocale)} MAD</p>
                <p className="text-xs text-slate-500">{tr('Progression estimée', 'التقدم المتوقع')}</p>
                <p className="text-sm font-semibold text-orange-700">{executionScoreboard.attainment}%</p>
                <Badge variant="outline" className={`mt-1 ${executionScoreboard.gap > 0 ? 'text-amber-700 border-amber-200 bg-amber-50' : 'text-emerald-700 border-emerald-200 bg-emerald-50'}`}>
                  {executionScoreboard.feasibility}
                </Badge>
              </div>
              <Button
                className="w-full bg-orange-600 hover:bg-orange-700"
                onClick={() => {
                  setSimulationAmount(String(Math.max(0, Math.round(stats.debt - effectiveTargetDebt))));
                  setPaymentStatusFilter('avec-dette');
                  setPeriodFilter(executionWindow === '14j' ? '7jours' : executionWindow === '30j' ? '30jours' : '90jours');
                }}
              >
                {tr('Alignement auto sur objectif', 'محاذاة تلقائية مع الهدف')}
              </Button>
            </div>

            <div className="xl:col-span-2 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-800">{tr('Missions prioritaires actionnables', 'مهام أولوية قابلة للتنفيذ')}</p>
                <Badge variant="outline" className="text-slate-600 border-slate-200 bg-white">{priorityMissions.length} {tr('missions', 'مهام')}</Badge>
              </div>
              <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-2">
                {priorityMissions.map((mission) => (
                  <button
                    key={mission.id}
                    type="button"
                    onClick={() => {
                      setSearchTerm(mission.truckMatricule);
                      setPaymentStatusFilter('avec-dette');
                      applyPreset(mission.action as 'stabilisation' | 'encaissement' | 'zero-dette' | 'garage-focus');
                    }}
                    className="rounded-lg border border-slate-200 bg-white p-3 text-left hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-slate-800">{mission.truckMatricule}</p>
                      <Badge variant="outline" className="text-[10px] border-slate-200 bg-slate-50 text-slate-600">
                        {tr('Score', 'نقاط')} {mission.score}
                      </Badge>
                    </div>
                    <p className="text-sm font-bold text-slate-900 mt-1">{mission.amount.toLocaleString(uiLocale)} MAD</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {mission.ageDays} {tr("jours d'ancienneté", 'يوم أقدمية')} · {tr('Action', 'إجراء')} {mission.action === 'stabilisation' ? tr('Stabilisation', 'استقرار') : mission.action === 'encaissement' ? tr('Encaissement', 'تحصيل') : mission.action === 'zero-dette' ? tr('Zéro Dette', 'صفر ديون') : tr('Focus Garage', 'تركيز المرآب')}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Repairs Table */}
      <Card className="border-none shadow-sm overflow-hidden">
        <div className="smart-scroll-x hidden md:block">
        <Table className="smart-table">
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="font-semibold text-slate-700">{ru('table.date', 'Date')}</TableHead>
              <TableHead className="font-semibold text-slate-700">{ru('table.vehicle', 'Véhicule')}</TableHead>
              <TableHead className="font-semibold text-slate-700">{ru('table.type', 'Type')}</TableHead>
              <TableHead className="font-semibold text-slate-700">{ru('table.cost', 'Coût total')}</TableHead>
              <TableHead className="font-semibold text-slate-700">{ru('table.paid', 'Payé')}</TableHead>
              <TableHead className="font-semibold text-slate-700">{ru('table.debt', 'Dette')}</TableHead>
              <TableHead className="font-semibold text-slate-700">{ru('table.actions', 'Actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRepairs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-slate-500">
                  <div className="flex flex-col items-center gap-2">
                    <Wrench className="h-8 w-8 text-slate-300" />
                    <p>{ru('empty.noRepairs', 'Aucune réparation trouvée')}</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredRepairs.map((repair) => {
                const truck = trucks.find(t => t.id === repair.truckId);
                return (
                  <TableRow key={repair.id} className="hover:bg-slate-50/50 transition-colors group">
                    <TableCell className="font-medium text-slate-600">
                      <div className="flex flex-col gap-1">
                        <span>{new Date(repair.date).toLocaleDateString(uiLocale)}</span>
                        <Badge variant="outline" className={`w-fit text-[10px] ${getSlaMeta(repair).style}`}>
                          SLA {getSlaMeta(repair).label}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-slate-100 rounded text-slate-600">
                          <Truck className="h-4 w-4" />
                        </div>
                        <span className="font-semibold text-slate-900">{truck?.matricule || tr('Inconnu', 'غير معروف')}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={`
                        ${repair.type === 'mecanique' ? 'bg-blue-50 text-blue-700 border-blue-100' : 
                          repair.type === 'electrique' ? 'bg-purple-50 text-purple-700 border-purple-100' : 
                          'bg-orange-50 text-orange-700 border-orange-100'}
                        border font-medium
                      `}>
                        {repair.type === 'mecanique' ? tr('Mécanique', 'ميكانيك') : 
                         repair.type === 'electrique' ? tr('Électrique', 'كهربائي') : tr('Garage', 'مرآب')}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-bold text-slate-900">
                      {repair.totalCost.toLocaleString(uiLocale)} MAD
                    </TableCell>
                    <TableCell className="text-emerald-600 font-medium">
                      {repair.paidAmount.toLocaleString(uiLocale)} MAD
                    </TableCell>
                    <TableCell>
                      {repair.debtAmount > 0 ? (
                        <span className="text-rose-600 font-bold px-2 py-1 bg-rose-50 rounded text-xs">
                          {repair.debtAmount.toLocaleString(uiLocale)} MAD
                        </span>
                      ) : (
                        <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50">
                          {tr('Réglé', 'مسدد')}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDownloadPDF(repair)}
                          className="h-8 w-8 text-slate-400 hover:text-orange-600 hover:bg-orange-50"
                        >
                          <FileDown className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditingRepair(repair);
                            setIsEditing(true);
                            setFormData({
                              truckId: repair.truckId,
                              type: repair.type,
                              totalCost: repair.totalCost.toString(),
                              paidAmount: repair.paidAmount.toString(),
                              paymentMethod: repair.paymentMethod,
                              date: repair.date.split('T')[0],
                              remarks: repair.remarks
                            });
                            setDialogOpen(true);
                          }}
                          className="h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm(ru('confirm.deleteRepair', 'Voulez-vous vraiment supprimer cette réparation ?'))) {
                              deleteRepair(repair.id);
                              toast({
                                title: ru('toast.repairDeleted', 'Réparation supprimée'),
                                description: ru('toast.repairDeletedSuccess', 'La réparation a été supprimée avec succès.'),
                              });
                            }
                          }}
                          className="h-8 w-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        </div>
        <div className="md:hidden grid grid-cols-1 gap-2 p-4">
          {filteredRepairs.map((repair) => {
            const truck = trucks.find(t => t.id === repair.truckId);
            return (
              <div key={repair.id} className="rounded-xl border border-slate-200 bg-white p-3 app-panel-soft">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-[10px]">
                    {new Date(repair.date).toLocaleDateString(uiLocale)}
                  </Badge>
                  <Badge variant="outline" className={`text-[10px] ${getSlaMeta(repair).style}`}>SLA {getSlaMeta(repair).label}</Badge>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <Truck className="h-4 w-4 text-slate-400" />
                  <span className="text-sm font-semibold text-slate-900">{truck?.matricule || tr('Inconnu', 'غير معروف')}</span>
                </div>
                <div className="mt-1">
                  <Badge variant="secondary" className={`
                    ${repair.type === 'mecanique' ? 'bg-blue-50 text-blue-700 border-blue-100' : 
                      repair.type === 'electrique' ? 'bg-purple-50 text-purple-700 border-purple-100' : 
                      'bg-orange-50 text-orange-700 border-orange-100'}
                    border font-medium
                  `}>
                    {repair.type === 'mecanique' ? tr('Mécanique', 'ميكانيك') : 
                      repair.type === 'electrique' ? tr('Électrique', 'كهربائي') : tr('Garage', 'مرآب')}
                  </Badge>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
                  <div className="font-bold text-slate-900">{repair.totalCost.toLocaleString(uiLocale)} MAD</div>
                  <div className="text-emerald-700 font-medium">{repair.paidAmount.toLocaleString(uiLocale)} MAD</div>
                  <div className="text-rose-700 font-medium">{repair.debtAmount.toLocaleString(uiLocale)} MAD</div>
                </div>
                <div className="mt-2 flex items-center gap-1">
                  {(() => {
                    const MButton = motion(Button);
                    return (
                      <>
                        <MButton variant="ghost" size="sm" className="btn-haptic relative" whileTap={{ scale: 0.96 }} onClick={() => handleDownloadPDF(repair)}>{ru('actions.export', 'Exporter')}</MButton>
                        <MButton variant="ghost" size="sm" className="btn-haptic relative" whileTap={{ scale: 0.96 }} onClick={() => { setEditingRepair(repair); setIsEditing(true); setFormData({ truckId: repair.truckId, type: repair.type, totalCost: repair.totalCost.toString(), paidAmount: repair.paidAmount.toString(), paymentMethod: repair.paymentMethod, date: repair.date.split('T')[0], remarks: repair.remarks }); setDialogOpen(true); }}>{ru('actions.edit', 'Modifier')}</MButton>
                        <MButton variant="ghost" size="sm" className="btn-haptic relative" whileTap={{ scale: 0.96 }} onClick={() => { if (confirm(ru('confirm.deleteRepair', 'Voulez-vous vraiment supprimer cette réparation ?'))) { deleteRepair(repair.id); toast({ title: ru('toast.repairDeleted', 'Réparation supprimée'), description: ru('toast.repairDeletedSuccess', 'La réparation a été supprimée avec succès.'), }); } }}>{ru('actions.delete', 'Supprimer')}</MButton>
                      </>
                    );
                  })()}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Modernized Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl border-none shadow-2xl p-0 overflow-hidden">
          <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-6 text-white">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <Wrench className="h-6 w-6" />
                </div>
                {isEditing ? ru('dialog.editTitle', 'Modifier la Réparation') : ru('dialog.newTitle', 'Nouvelle Réparation')}
              </DialogTitle>
              <p className="text-orange-100 mt-1">
                {isEditing ? ru('dialog.editSubtitle', "Mettre à jour les détails de l'opération") : ru('dialog.newSubtitle', 'Enregistrer une nouvelle opération de maintenance')}
              </p>
            </DialogHeader>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6 bg-white">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-slate-700 font-semibold">{ru('label.vehicle', 'Véhicule')}</Label>
                <Select value={formData.truckId} onValueChange={(value) => setFormData(prev => ({ ...prev, truckId: value }))}>
                  <SelectTrigger className="border-slate-200 focus:ring-orange-500">
                    <SelectValue placeholder={ru('placeholder.selectVehicle', 'Sélectionner un véhicule')} />
                  </SelectTrigger>
                  <SelectContent>
                    {trucks.map(truck => (
                      <SelectItem key={truck.id} value={truck.id}>
                        <div className="flex items-center gap-2">
                          <Truck className="h-4 w-4 text-slate-400" />
                          {truck.matricule}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-700 font-semibold">{ru('label.repairType', 'Type de Réparation')}</Label>
                <Select value={formData.type} onValueChange={(value: any) => setFormData(prev => ({ ...prev, type: value }))}>
                  <SelectTrigger className="border-slate-200 focus:ring-orange-500">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mecanique">🔧 {tr('Mécanique', 'ميكانيك')}</SelectItem>
                    <SelectItem value="electrique">⚡ {tr('Électrique', 'كهربائي')}</SelectItem>
                    <SelectItem value="garage">🏪 {tr('Garage', 'مرآب')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-slate-700 font-semibold">{ru('label.date', 'Date')}</Label>
                <Input 
                  type="date" 
                  value={formData.date} 
                  onChange={e => setFormData({ ...formData, date: e.target.value })}
                  className="border-slate-200 focus:ring-orange-500"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700 font-semibold">{ru('label.paymentMethod', 'Mode de Paiement')}</Label>
                <Select value={formData.paymentMethod} onValueChange={(value: any) => setFormData(prev => ({ ...prev, paymentMethod: value }))}>
                  <SelectTrigger className="border-slate-200 focus:ring-orange-500">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="especes">
                      <div className="flex items-center gap-2">
                        <Banknote className="h-4 w-4 text-emerald-500" />
                        {tr('Espèces', 'نقدًا')}
                      </div>
                    </SelectItem>
                    <SelectItem value="cheque">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-blue-500" />
                        {tr('Chèque', 'شيك')}
                      </div>
                    </SelectItem>
                    <SelectItem value="virement">
                      <div className="flex items-center gap-2">
                        <History className="h-4 w-4 text-purple-500" />
                        {tr('Virement', 'تحويل')}
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-slate-50 rounded-xl border border-slate-100">
              <div className="space-y-2">
                <Label className="text-slate-700 font-bold flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-orange-500" />
                  {ru('label.totalCostMad', 'Coût Total (MAD)')}
                </Label>
                <Input 
                  type="number" 
                  step="0.01"
                  value={formData.totalCost} 
                  onChange={e => setFormData({ ...formData, totalCost: e.target.value })}
                  className="bg-white border-slate-200 focus:ring-orange-500 font-bold text-lg"
                  placeholder={ru('placeholder.amountZero', '0.00')}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700 font-bold flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  {ru('label.paidAmountMad', 'Montant Payé (MAD)')}
                </Label>
                <Input 
                  type="number" 
                  step="0.01"
                  value={formData.paidAmount} 
                  onChange={e => setFormData({ ...formData, paidAmount: e.target.value })}
                  className="bg-white border-slate-200 focus:ring-emerald-500 font-bold text-lg text-emerald-600"
                  placeholder={ru('placeholder.amountZero', '0.00')}
                />
              </div>
              {formData.totalCost && formData.paidAmount && (
                <div className="md:col-span-2 pt-2 border-t border-slate-200 flex justify-between items-center">
                  <span className="text-sm font-medium text-slate-500">{ru('label.remainingDebt', 'Reste à payer (Dette) :')}</span>
                  <span className={`text-lg font-bold ${(parseFloat(formData.totalCost) - parseFloat(formData.paidAmount)) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {(parseFloat(formData.totalCost) - parseFloat(formData.paidAmount)).toLocaleString(uiLocale)} MAD
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-slate-700 font-semibold">{ru('label.descriptionRemarks', 'Description / Remarques')}</Label>
              <Textarea 
                placeholder={ru('placeholder.repairDetails', 'Détails de la réparation, pièces changées...')}
                value={formData.remarks}
                onChange={e => setFormData({ ...formData, remarks: e.target.value })}
                className="min-h-[100px] border-slate-200 focus:ring-orange-500"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)} className="text-slate-500 hover:bg-slate-100">
                {ru('actions.cancel', 'Annuler')}
              </Button>
              <Button type="submit" className="bg-orange-600 hover:bg-orange-700 text-white px-8 shadow-lg shadow-orange-100">
                {isEditing ? ru('actions.saveChanges', 'Enregistrer les modifications') : ru('actions.addRepair', 'Ajouter la réparation')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Repairs;
