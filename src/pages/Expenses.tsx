import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useApp } from '@/contexts/AppContext';
import { DollarSign, Plus, Calendar, Search, Filter, Download, Trash2, Receipt, Wallet, CreditCard, Banknote, History, CheckCircle2, AlertCircle, Pencil, Sparkles, BarChart3, Layers, TrendingDown, Gauge, Target, Siren, Rocket, BellRing, Save, RotateCcw, BrainCircuit, Landmark, Building2, ArrowDownRight } from 'lucide-react';
import { toast } from 'sonner';
import { Expense } from '@/types';
import { format } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { loadPdfTools } from '@/lib/pdf';
import { DateRange } from 'react-day-picker';
import { useLanguage, useT } from '@/contexts/LanguageContext';

const paymentMethods = [
  'espece',
  'compte_fournisseur',
  'cheque',
  'banque'
];

const scenarioStorageKey = 'gazzzit-expenses-v43-lab';

type ScenarioSnapshot = {
  id: string;
  timestamp: string;
  mode: 'prudent' | 'equilibre' | 'offensif';
  variation: string;
  budget: string;
  category: string;
  categoryShare: string;
  projected: number;
  optimized: number;
};

const Expenses = () => {
  const { expenses, addExpense, updateExpense, deleteExpense, expenseTypes, addExpenseType, suppliers } = useApp();
  const t = useT();
  const { language } = useLanguage();
  const tr = (frText: string, arText: string) => (language === 'ar' ? arText : frText);
  const uiLocale = language === 'ar' ? 'ar-MA' : 'fr-MA';
  const formatDateUi = (value: Date | string, options?: Intl.DateTimeFormatOptions) =>
    new Date(value).toLocaleDateString(uiLocale, options || { year: 'numeric', month: '2-digit', day: '2-digit' });
  const te = (key: string, fallback: string) => t(`expenses.pdf.${key}`, fallback);
  const tu = (key: string, fallback: string) => t(`expenses.ui.${key}`, fallback);
  const paymentLabel = (method: string) => {
    switch (method) {
      case 'espece':
        return tu('payment.cash', 'Espèce');
      case 'compte_fournisseur':
        return tr('Compte Bancaire Fournisseur', 'حساب بنكي للمورد');
      case 'cheque':
        return tu('payment.cheque', 'Chèque');
      case 'banque':
        return tu('payment.bank', 'Banque');
      default:
        return method;
    }
  };
  const isArabicPdf = language === 'ar';
  const arabicPdfFontFile = 'NotoNaskhArabic-Regular.ttf';
  const arabicPdfFontName = 'NotoNaskhArabic';
  const arabicPdfFontUrl = 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/notonaskharabic/NotoNaskhArabic-Regular.ttf';
  const arabicPdfFontDataRef = useRef<string | null>(null);
  const getArabicPdfFontData = useCallback(async () => {
    if (arabicPdfFontDataRef.current) return arabicPdfFontDataRef.current;
    const cacheKey = 'expenses_pdf_font_ar_v1';
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
  }, []);
  const createPdfDoc = useCallback(async (jsPDF: any) => {
    const doc = new jsPDF();
    if (isArabicPdf) {
      const fontData = await getArabicPdfFontData();
      doc.addFileToVFS(arabicPdfFontFile, fontData);
      doc.addFont(arabicPdfFontFile, arabicPdfFontName, 'normal');
      doc.setFont(arabicPdfFontName, 'normal');
    }
    return doc;
  }, [isArabicPdf, getArabicPdfFontData]);
  const today = new Date();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [expenseType, setExpenseType] = useState<string>('');
  const [customExpenseType, setCustomExpenseType] = useState<string>('');
  const [showAddTypeInline, setShowAddTypeInline] = useState(false);
  const [newExpenseTypeName, setNewExpenseTypeName] = useState('');
  const [code, setCode] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [selectedSupplierBank, setSelectedSupplierBank] = useState<string>('');
  const [date, setDate] = useState<Date>(new Date());
  const [note, setNote] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'espece' | 'compte_fournisseur' | 'cheque' | 'banque'>('all');
  const [monthlyBudget, setMonthlyBudget] = useState<string>('50000');
  const [forecastMode, setForecastMode] = useState<'prudent' | 'equilibre' | 'offensif'>('equilibre');
  const [selectedTargetCategory, setSelectedTargetCategory] = useState<string>('all');
  const [categoryTargetShare, setCategoryTargetShare] = useState<string>('35');
  const [whatIfVariation, setWhatIfVariation] = useState<string>('0');
  const [scenarioHistory, setScenarioHistory] = useState<ScenarioSnapshot[]>([]);
  const [expenseToEdit, setExpenseToEdit] = useState<Expense | null>(null);

  const supplierBankProfiles = useMemo(() => {
    return (suppliers || [])
      .map((s) => ({
        id: String(s?.id || ''),
        name: String(s?.name || '').trim(),
        bankAccountName: String(s?.bankAccountName || s?.name || '').trim(),
        bankName: String(s?.bankName || '').trim(),
        rib: String(s?.rib || '').trim()
      }))
      .filter((s) => s.id && (s.bankAccountName || s.name));
  }, [suppliers]);

  const handleGenerateCode = () => {
    const todayStr = format(new Date(), 'yyyyMMdd');
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    setCode(`EXP-${todayStr}-${randomSuffix}`);
  };

  const handleAddExpense = () => {
    if (!expenseType || !amount || !paymentMethod) {
      toast.error(tu('toast.fillRequired', 'Veuillez remplir tous les champs obligatoires'));
      return;
    }

    if (expenseType === 'autre' && !customExpenseType) {
      toast.error(tu('toast.specifyExpenseType', 'Veuillez préciser le type de dépense'));
      return;
    }

    if (paymentMethod === 'compte_fournisseur' && !selectedSupplierBank) {
      toast.error(tr('Veuillez sélectionner un compte bancaire fournisseur', 'يرجى اختيار حساب بنكي للمورد'));
      return;
    }

    let finalType = expenseType;
    if (expenseType === 'autre') {
      finalType = customExpenseType;
      addExpenseType(customExpenseType);
    }

    const matchedSupplier = supplierBankProfiles.find(s => s.bankAccountName === selectedSupplierBank || s.id === selectedSupplierId);
    const finalSupplierId = selectedSupplierId || matchedSupplier?.id;
    const finalSupplierBank = selectedSupplierBank || matchedSupplier?.bankAccountName;

    const trimmedCode = code ? code.trim() : '';

    if (expenseToEdit) {
      updateExpense(expenseToEdit.id, {
        type: finalType as any,
        code: trimmedCode,
        amount: parseFloat(amount),
        paymentMethod: paymentMethod as any,
        date: date.toISOString(),
        note: note || undefined,
        supplierId: paymentMethod === 'compte_fournisseur' ? finalSupplierId : undefined,
        supplierBankName: paymentMethod === 'compte_fournisseur' ? finalSupplierBank : undefined,
        accountDetails: paymentMethod === 'compte_fournisseur' ? finalSupplierBank : undefined,
      });
      toast.success(tu('toast.expenseUpdated', 'Dépense mise à jour avec succès'));
    } else {
      const generatedId = (window.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));
      const newExpense: Expense = {
        id: generatedId,
        type: finalType as any,
        code: trimmedCode,
        amount: parseFloat(amount),
        paymentMethod: paymentMethod as any,
        date: date.toISOString(),
        note: note || undefined,
        supplierId: paymentMethod === 'compte_fournisseur' ? finalSupplierId : undefined,
        supplierBankName: paymentMethod === 'compte_fournisseur' ? finalSupplierBank : undefined,
        accountDetails: paymentMethod === 'compte_fournisseur' ? finalSupplierBank : undefined,
      };

      addExpense(newExpense);
      toast.success(tu('toast.expenseAdded', 'Dépense ajoutée avec succès'));
    }
    
    resetForm();
    setDialogOpen(false);
  };

  const handleEditExpense = (expense: Expense) => {
    setExpenseToEdit(expense);
    setExpenseType(expense.type);
    setCode(expense.code || '');
    setAmount(expense.amount.toString());
    setPaymentMethod(expense.paymentMethod);
    setDate(new Date(expense.date));
    setNote(expense.note || '');
    if (expense.paymentMethod === 'compte_fournisseur') {
      const bankName = expense.supplierBankName || expense.accountDetails || '';
      setSelectedSupplierBank(bankName);
      const sup = supplierBankProfiles.find(s => s.id === expense.supplierId || s.bankAccountName === bankName);
      setSelectedSupplierId(sup?.id || expense.supplierId || '');
    } else {
      setSelectedSupplierId('');
      setSelectedSupplierBank('');
    }
    setDialogOpen(true);
  };

  const handleAddExpenseTypeToList = async () => {
    const nextType = newExpenseTypeName.trim();
    if (!nextType) {
      toast.error(tu('toast.specifyExpenseType', 'Veuillez préciser le type de dépense'));
      return;
    }
    const exists = expenseTypes.some((t) => t.trim().toLowerCase() === nextType.toLowerCase());
    if (exists) {
      toast.error(tr('Ce type existe déjà dans la liste', 'هذا النوع موجود بالفعل في القائمة'));
      return;
    }
    await addExpenseType(nextType);
    setExpenseType(nextType);
    setNewExpenseTypeName('');
    setShowAddTypeInline(false);
    toast.success(tr('Type de dépense ajouté avec succès', 'تمت إضافة نوع المصروف بنجاح'));
  };

  const resetForm = () => {
    setExpenseToEdit(null);
    setExpenseType('');
    setCustomExpenseType('');
    setShowAddTypeInline(false);
    setNewExpenseTypeName('');
    setCode('');
    setAmount('');
    setPaymentMethod('');
    setSelectedSupplierId('');
    setSelectedSupplierBank('');
    setDate(new Date());
    setNote('');
  };

  const handleDownloadPDF = async () => {
    const { jsPDF, autoTable } = await loadPdfTools();
    const doc = await createPdfDoc(jsPDF);
    doc.text(te('title', 'Liste des Dépenses'), 14, 16);

    const tableColumn = [te('type', 'Type'), te('code', 'Code'), te('date', 'Date'), te('paymentMethod', 'Mode de paiement'), te('note', 'Note'), te('amountMad', 'Montant (MAD)')];
    const tableRows: (string | number)[][] = [];

    filteredExpenses.forEach(expense => {
      const expenseData = [
        expense.type,
        expense.code || '-',
        new Date(expense.date).toLocaleDateString(uiLocale),
        paymentLabel(expense.paymentMethod),
        expense.note || '-',
        `-${expense.amount.toFixed(2)} DH`
      ];
      tableRows.push(expenseData);
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 20,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185] },
      styles: { font: isArabicPdf ? arabicPdfFontName : 'helvetica' },
    });

    const finalY = (doc as any).lastAutoTable.finalY;
    doc.setFontSize(10);
    doc.text(`${te('totalExpenses', 'Total des dépenses')}: -${totalExpenses.toFixed(2)} DH`, 14, finalY + 10);

    doc.save(`depenses_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  const filteredExpenses = expenses.filter(expense => 
    ((expense.type || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (expense.code || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (expense.note || '').toLowerCase().includes(searchQuery.toLowerCase())) &&
    (!dateRange?.from || new Date(expense.date) >= dateRange.from) &&
    (!dateRange?.to || new Date(expense.date) <= dateRange.to) &&
    (paymentFilter === 'all' || expense.paymentMethod === paymentFilter)
  );

  const totalExpenses = filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const averageExpense = filteredExpenses.length > 0 ? totalExpenses / filteredExpenses.length : 0;

  const paymentBreakdown = useMemo(() => {
    return paymentMethods.map((method) => {
      const list = filteredExpenses.filter((expense) => expense.paymentMethod === method);
      const amount = list.reduce((sum, expense) => sum + expense.amount, 0);
      const ratio = totalExpenses > 0 ? Math.round((amount / totalExpenses) * 100) : 0;
      return { method, amount, count: list.length, ratio };
    });
  }, [filteredExpenses, totalExpenses]);

  const topExpenseTypes = useMemo(() => {
    const grouped = filteredExpenses.reduce((acc, expense) => {
      if (!acc[expense.type]) {
        acc[expense.type] = { type: expense.type, amount: 0, count: 0 };
      }
      acc[expense.type].amount += expense.amount;
      acc[expense.type].count += 1;
      return acc;
    }, {} as Record<string, { type: string; amount: number; count: number }>);
    return Object.values(grouped).sort((a, b) => b.amount - a.amount).slice(0, 4);
  }, [filteredExpenses]);

  const expensiveExpenses = useMemo(() => {
    return filteredExpenses
      .slice()
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [filteredExpenses]);

  const maxExpense = filteredExpenses.length > 0 ? Math.max(...filteredExpenses.map((expense) => expense.amount)) : 0;
  const previousMonthExpenses = useMemo(() => {
    const now = new Date();
    const startCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endPreviousMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    return expenses
      .filter((expense) => {
        const expenseDate = new Date(expense.date);
        return expenseDate >= startPreviousMonth && expenseDate <= endPreviousMonth;
      })
      .reduce((sum, expense) => sum + expense.amount, 0);
  }, [expenses]);

  const currentMonthExpenses = useMemo(() => {
    const now = new Date();
    const startCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return expenses
      .filter((expense) => new Date(expense.date) >= startCurrentMonth)
      .reduce((sum, expense) => sum + expense.amount, 0);
  }, [expenses]);

  const monthDelta = currentMonthExpenses - previousMonthExpenses;
  const monthDeltaPercent =
    previousMonthExpenses > 0
      ? Math.round((monthDelta / previousMonthExpenses) * 100)
      : currentMonthExpenses > 0
        ? 100
        : 0;

  const budgetValue = Math.max(0, Number(monthlyBudget) || 0);

  const guardrailMeta = useMemo(() => {
    if (budgetValue <= 0) {
      return {
        ratio: 0,
        label: tr('Budget non défini', 'الميزانية غير محددة'),
        tone: 'text-slate-700 border-slate-200 bg-slate-50'
      };
    }
    const ratio = Math.round((currentMonthExpenses / budgetValue) * 100);
    if (ratio >= 100) {
      return { ratio, label: tr('Dépassement critique', 'تجاوز حرج'), tone: 'text-rose-700 border-rose-200 bg-rose-50' };
    }
    if (ratio >= 85) {
      return { ratio, label: tr('Zone de vigilance', 'منطقة مراقبة'), tone: 'text-amber-700 border-amber-200 bg-amber-50' };
    }
    return { ratio, label: tr('Sous contrôle', 'تحت السيطرة'), tone: 'text-emerald-700 border-emerald-200 bg-emerald-50' };
  }, [budgetValue, currentMonthExpenses, language]);

  const weeklyRunRate = useMemo(() => {
    const now = Date.now();
    const days28 = 28 * 24 * 60 * 60 * 1000;
    const amountLast28 = expenses
      .filter((expense) => now - new Date(expense.date).getTime() <= days28)
      .reduce((sum, expense) => sum + expense.amount, 0);
    return amountLast28 / 4;
  }, [expenses]);

  const forecastTimeline = useMemo(() => {
    const modeMultiplier = forecastMode === 'prudent' ? 0.85 : forecastMode === 'offensif' ? 1.2 : 1;
    const weeklyIncrement = weeklyRunRate * modeMultiplier;
    return Array.from({ length: 6 }, (_, index) => {
      const projectedSpend = currentMonthExpenses + weeklyIncrement * (index + 1);
      const ratio = budgetValue > 0 ? Math.round((projectedSpend / budgetValue) * 100) : 0;
      const pressure = ratio >= 100 ? 'high' : ratio >= 85 ? 'medium' : 'low';
      return {
        week: index + 1,
        projectedSpend,
        ratio,
        pressure
      };
    });
  }, [forecastMode, weeklyRunRate, currentMonthExpenses, budgetValue]);

  const smartAlerts = useMemo(() => {
    const alerts: Array<{ id: string; title: string; note: string; action: 'tighten' | 'bank' | 'category' | 'recover' }> = [];
    if (guardrailMeta.ratio >= 100) {
      alerts.push({
        id: 'budget-break',
        title: tr('Budget dépassé', 'تجاوز الميزانية'),
        note: tr('Activer un contrôle court terme 7 jours.', 'تفعيل رقابة قصيرة الأجل لمدة 7 أيام.'),
        action: 'tighten'
      });
    }
    if (paymentBreakdown.find((item) => item.method === 'banque' && item.ratio >= 45)) {
      alerts.push({
        id: 'bank-heavy',
        title: tr('Pression banque élevée', 'ضغط مرتفع على البنك'),
        note: tr('Vérifier les charges bancaires prioritaires.', 'راجع المصاريف البنكية ذات الأولوية.'),
        action: 'bank'
      });
    }
    if (topExpenseTypes[0] && totalExpenses > 0 && (topExpenseTypes[0].amount / totalExpenses) >= 0.5) {
      alerts.push({
        id: 'category-heavy',
        title: tr('Catégorie dominante', 'فئة مهيمنة'),
        note: language === 'ar' ? `تحليل معمّق لفئة ${topExpenseTypes[0].type}.` : `Drill-down sur ${topExpenseTypes[0].type}.`,
        action: 'category'
      });
    }
    if (monthDelta < 0) {
      alerts.push({
        id: 'recovery',
        title: tr('Trajectoire positive', 'مسار إيجابي'),
        note: tr('Conserver la stratégie actuelle 30 jours.', 'حافظ على الاستراتيجية الحالية لمدة 30 يومًا.'),
        action: 'recover'
      });
    }
    if (alerts.length === 0) {
      alerts.push({
        id: 'monitor',
        title: tr('Monitoring normal', 'مراقبة عادية'),
        note: tr('Ajuster le budget cible pour précision.', 'اضبط الميزانية المستهدفة لزيادة الدقة.'),
        action: 'recover'
      });
    }
    return alerts.slice(0, 3);
  }, [guardrailMeta.ratio, paymentBreakdown, topExpenseTypes, totalExpenses, monthDelta]);

  const applyAlertAction = (action: 'tighten' | 'bank' | 'category' | 'recover') => {
    if (action === 'tighten') {
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
      setDateRange({ from, to: now });
      setPaymentFilter('all');
      setSearchQuery('');
    }
    if (action === 'bank') {
      setPaymentFilter('banque');
      setSearchQuery('');
    }
    if (action === 'category' && topExpenseTypes[0]) {
      setSearchQuery(topExpenseTypes[0].type);
    }
    if (action === 'recover') {
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
      setDateRange({ from, to: now });
      setPaymentFilter('all');
    }
  };

  const todayDay = Math.max(1, today.getDate());
  const monthDays = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const cumulativeMonthForecast = useMemo(() => {
    const currentPace = currentMonthExpenses / todayDay;
    const projectedEndMonth = currentPace * monthDays;
    const forecastDelta = projectedEndMonth - currentMonthExpenses;
    return { currentPace, projectedEndMonth, forecastDelta };
  }, [currentMonthExpenses, todayDay, monthDays]);

  const currentMonthByCategory = useMemo(() => {
    return expenses
      .filter((expense) => {
        const expenseDate = new Date(expense.date);
        return expenseDate.getMonth() === today.getMonth() && expenseDate.getFullYear() === today.getFullYear();
      })
      .reduce((acc, expense) => {
        acc[expense.type] = (acc[expense.type] || 0) + expense.amount;
        return acc;
      }, {} as Record<string, number>);
  }, [expenses, today]);

  const targetCategoryOptions = useMemo(() => {
    const categories = Object.keys(currentMonthByCategory);
    if (categories.length === 0) return ['all'];
    return ['all', ...categories];
  }, [currentMonthByCategory]);

  const categoryTargetMeta = useMemo(() => {
    const share = Math.max(0, Math.min(100, Number(categoryTargetShare) || 0));
    const targetAmount = budgetValue * (share / 100);
    const selectedCategorySpend = selectedTargetCategory === 'all'
      ? currentMonthExpenses
      : (currentMonthByCategory[selectedTargetCategory] || 0);
    const projectedCategory = (selectedCategorySpend / todayDay) * monthDays;
    const ratio = targetAmount > 0 ? Math.round((projectedCategory / targetAmount) * 100) : 0;
    const status = ratio >= 100 ? tr('Target break risk', 'خطر تجاوز الهدف') : ratio >= 85 ? tr('Target pressure', 'ضغط على الهدف') : tr('Target healthy', 'الهدف ضمن الوضع الصحي');
    return { share, targetAmount, selectedCategorySpend, projectedCategory, ratio, status };
  }, [categoryTargetShare, budgetValue, selectedTargetCategory, currentMonthExpenses, currentMonthByCategory, todayDay, monthDays, language]);

  const earlyWarnings = useMemo(() => {
    const list: Array<{ id: string; title: string; note: string; action: 'tighten' | 'bank' | 'category' | 'recover' }> = [];
    const projectedRatio = budgetValue > 0 ? Math.round((cumulativeMonthForecast.projectedEndMonth / budgetValue) * 100) : 0;
    if (projectedRatio >= 100) {
      list.push({
        id: 'forecast-overrun',
        title: tr('Month-end overrun forecast', 'توقع تجاوز بنهاية الشهر'),
        note: tr('Projected spend crosses budget, lock next 7 days.', 'الإنفاق المتوقع يتجاوز الميزانية، فعّل قفل 7 أيام.'),
        action: 'tighten'
      });
    }
    if (categoryTargetMeta.ratio >= 95 && selectedTargetCategory !== 'all') {
      list.push({
        id: 'category-overheat',
        title: tr('Category target near limit', 'هدف الفئة قريب من الحد'),
        note: language === 'ar' ? `الإنفاق المتوقع لفئة ${selectedTargetCategory} قريب من السقف.` : `Projected ${selectedTargetCategory} spend is near cap.`,
        action: 'category'
      });
    }
    if (paymentBreakdown.find((item) => item.method === 'banque' && item.ratio >= 50)) {
      list.push({
        id: 'bank-overweight',
        title: tr('Bank payments overweight', 'مدفوعات البنك مرتفعة'),
        note: tr('Drill on bank operations to reduce pressure.', 'راجع عمليات البنك لتخفيف الضغط.'),
        action: 'bank'
      });
    }
    if (list.length === 0) {
      list.push({
        id: 'trajectory-ok',
        title: tr('Trajectory under control', 'المسار تحت السيطرة'),
        note: tr('Maintain 30-day balance strategy.', 'حافظ على استراتيجية التوازن لـ30 يومًا.'),
        action: 'recover'
      });
    }
    return list.slice(0, 3);
  }, [budgetValue, cumulativeMonthForecast.projectedEndMonth, categoryTargetMeta.ratio, selectedTargetCategory, paymentBreakdown, language]);

  const optimizationPlan = useMemo(() => {
    if (currentMonthExpenses <= 0) return [];
    return Object.entries(currentMonthByCategory)
      .map(([type, spent]) => {
        const share = (spent / currentMonthExpenses) * 100;
        const reductionRate = share >= 40 ? 0.15 : share >= 25 ? 0.1 : 0.06;
        const suggestedShare = Math.max(8, Math.min(65, Math.round(share - (reductionRate * 100))));
        return {
          type,
          spent,
          share,
          reductionRate,
          suggestedShare,
          reductionAmount: spent * reductionRate
        };
      })
      .sort((a, b) => b.spent - a.spent)
      .slice(0, 4);
  }, [currentMonthByCategory, currentMonthExpenses]);

  const whatIfMeta = useMemo(() => {
    const variationPercent = Math.max(-35, Math.min(35, Number(whatIfVariation) || 0));
    const variationFactor = 1 + (variationPercent / 100);
    const optimizationTotal = optimizationPlan.reduce((sum, item) => sum + item.reductionAmount, 0);
    const baseScenarios = [
      { key: 'prudent' as const, label: tr('Prudent', 'حذر'), factor: 0.9 },
      { key: 'equilibre' as const, label: tr('Équilibré', 'متوازن'), factor: 1 },
      { key: 'offensif' as const, label: tr('Offensif', 'هجومي'), factor: 1.12 }
    ];
    const scenarios = baseScenarios.map((scenario) => {
      const projected = cumulativeMonthForecast.projectedEndMonth * scenario.factor * variationFactor;
      const optimizedProjected = Math.max(0, projected - (optimizationTotal * (scenario.key === 'offensif' ? 0.7 : scenario.key === 'equilibre' ? 1 : 1.2)));
      const ratio = budgetValue > 0 ? Math.round((projected / budgetValue) * 100) : 0;
      const optimizedRatio = budgetValue > 0 ? Math.round((optimizedProjected / budgetValue) * 100) : 0;
      return {
        ...scenario,
        projected,
        optimizedProjected,
        ratio,
        optimizedRatio
      };
    });
    return { variationPercent, optimizationTotal, scenarios };
  }, [whatIfVariation, optimizationPlan, cumulativeMonthForecast.projectedEndMonth, budgetValue, language]);

  const applyScenario = (scenario: 'prudent' | 'equilibre' | 'offensif') => {
    setForecastMode(scenario);
    if (scenario === 'prudent') {
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
      setDateRange({ from, to: now });
    }
    if (scenario === 'equilibre') {
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
      setDateRange({ from, to: now });
    }
    if (scenario === 'offensif') {
      setDateRange(undefined);
    }
  };

  const applyOptimization = (type: string, suggestedShare: number) => {
    setSelectedTargetCategory(type);
    setCategoryTargetShare(String(suggestedShare));
    setSearchQuery(type);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(scenarioStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        forecastMode?: 'prudent' | 'equilibre' | 'offensif';
        monthlyBudget?: string;
        whatIfVariation?: string;
        selectedTargetCategory?: string;
        categoryTargetShare?: string;
        scenarioHistory?: ScenarioSnapshot[];
      };
      if (parsed.forecastMode) setForecastMode(parsed.forecastMode);
      if (typeof parsed.monthlyBudget === 'string') setMonthlyBudget(parsed.monthlyBudget);
      if (typeof parsed.whatIfVariation === 'string') setWhatIfVariation(parsed.whatIfVariation);
      if (typeof parsed.selectedTargetCategory === 'string') setSelectedTargetCategory(parsed.selectedTargetCategory);
      if (typeof parsed.categoryTargetShare === 'string') setCategoryTargetShare(parsed.categoryTargetShare);
      if (Array.isArray(parsed.scenarioHistory)) {
        setScenarioHistory(parsed.scenarioHistory.slice(0, 8));
      }
    } catch {
      setScenarioHistory([]);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const payload = {
      forecastMode,
      monthlyBudget,
      whatIfVariation,
      selectedTargetCategory,
      categoryTargetShare,
      scenarioHistory
    };
    window.localStorage.setItem(scenarioStorageKey, JSON.stringify(payload));
  }, [forecastMode, monthlyBudget, whatIfVariation, selectedTargetCategory, categoryTargetShare, scenarioHistory]);

  const captureScenarioSnapshot = () => {
    const selectedScenario = whatIfMeta.scenarios.find((item) => item.key === forecastMode) || whatIfMeta.scenarios[1];
    const snapshot: ScenarioSnapshot = {
      id: `${Date.now()}`,
      timestamp: new Date().toISOString(),
      mode: forecastMode,
      variation: String(whatIfMeta.variationPercent),
      budget: monthlyBudget,
      category: selectedTargetCategory,
      categoryShare: categoryTargetShare,
      projected: selectedScenario?.projected || 0,
      optimized: selectedScenario?.optimizedProjected || 0
    };
    setScenarioHistory((prev) => [snapshot, ...prev].slice(0, 8));
    toast.success(tu('toast.scenarioSaved', tr('Scenario snapshot saved', 'تم حفظ لقطة السيناريو')));
  };

  const replayScenarioSnapshot = (snapshot: ScenarioSnapshot) => {
    setForecastMode(snapshot.mode);
    setWhatIfVariation(snapshot.variation);
    setMonthlyBudget(snapshot.budget);
    setSelectedTargetCategory(snapshot.category);
    setCategoryTargetShare(snapshot.categoryShare);
    applyScenario(snapshot.mode);
  };

  const resetScenarioLab = () => {
    setForecastMode('equilibre');
    setMonthlyBudget('50000');
    setWhatIfVariation('0');
    setSelectedTargetCategory('all');
    setCategoryTargetShare('35');
    setScenarioHistory([]);
    setDateRange(undefined);
    setSearchQuery('');
    setPaymentFilter('all');
  };

  const adaptiveRecommendations = useMemo(() => {
    const list: Array<{ id: string; title: string; note: string; action: 'prudent' | 'equilibre' | 'offensif' | 'optimize' | 'tighten' | 'recover' }> = [];
    const activeScenario = whatIfMeta.scenarios.find((item) => item.key === forecastMode) || whatIfMeta.scenarios[1];
    if (activeScenario && activeScenario.optimizedRatio >= 100) {
      list.push({
        id: 'shift-prudent',
        title: tr('Shift to prudent mode', 'التحول إلى الوضع الحذر'),
        note: tr('Current optimized projection exceeds budget.', 'التوقع المحسّن الحالي يتجاوز الميزانية.'),
        action: 'prudent'
      });
    }
    if (activeScenario && activeScenario.optimizedRatio < 85 && monthDelta < 0) {
      list.push({
        id: 'move-equilibre',
        title: tr('Return to balanced mode', 'العودة إلى الوضع المتوازن'),
        note: tr('Trend is healthy and can absorb balanced pacing.', 'المسار صحي ويمكنه استيعاب وتيرة متوازنة.'),
        action: 'equilibre'
      });
    }
    if (optimizationPlan[0]) {
      list.push({
        id: 'run-optimization',
        title: language === 'ar' ? `تحسين ${optimizationPlan[0].type}` : `Optimize ${optimizationPlan[0].type}`,
        note: language === 'ar' ? `طبّق هدف ${optimizationPlan[0].suggestedShare}% لأعلى فئة تكلفة.` : `Apply target ${optimizationPlan[0].suggestedShare}% for top cost category.`,
        action: 'optimize'
      });
    }
    if (guardrailMeta.ratio >= 90) {
      list.push({
        id: 'tight-window',
        title: tr('Lock 7-day control window', 'تفعيل نافذة ضبط 7 أيام'),
        note: tr('Near guardrail threshold, tighten quickly.', 'قريب من حد الحماية، شدّد سريعًا.'),
        action: 'tighten'
      });
    }
    if (list.length === 0) {
      list.push({
        id: 'keep-offensif',
        title: tr('Maintain offensive scenario', 'الحفاظ على السيناريو الهجومي'),
        note: tr('Budget margin supports growth rhythm.', 'هامش الميزانية يدعم وتيرة النمو.'),
        action: 'offensif'
      });
    }
    return list.slice(0, 4);
  }, [whatIfMeta.scenarios, forecastMode, monthDelta, optimizationPlan, guardrailMeta.ratio, language]);

  const applyRecommendation = (action: 'prudent' | 'equilibre' | 'offensif' | 'optimize' | 'tighten' | 'recover') => {
    if (action === 'prudent' || action === 'equilibre' || action === 'offensif') {
      applyScenario(action);
      return;
    }
    if (action === 'optimize' && optimizationPlan[0]) {
      applyOptimization(optimizationPlan[0].type, optimizationPlan[0].suggestedShare);
      return;
    }
    if (action === 'tighten') {
      applyAlertAction('tighten');
      return;
    }
    applyAlertAction('recover');
  };

  return (
    <div className="app-page-shell p-4 md:p-8 space-y-6 bg-slate-50/50 min-h-screen">
      <Card className="app-dark-hero border-none shadow-xl overflow-hidden bg-gradient-to-r from-slate-900 via-indigo-900 to-rose-900 text-white">
        <CardContent className="p-6 md:p-8">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div>
              <p className="inline-flex items-center gap-2 text-xs md:text-sm bg-white/15 border border-white/20 rounded-full px-3 py-1">
                <Calendar className="w-4 h-4" />
                {formatDateUi(today, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
              <h1 className="app-page-title text-3xl md:text-4xl font-black tracking-tight mt-3">{tu('hero.title', 'Expense Studio')}</h1>
              <p className="app-page-subtitle text-indigo-100 mt-1">{tu('hero.subtitle', 'Interface repensée pour piloter, analyser et agir instantanément.')}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge className="bg-white/15 hover:bg-white/15 border border-white/20 text-white rounded-full">
                  {tu('hero.filteredExpenses', 'Dépenses filtrées')}: {filteredExpenses.length}
                </Badge>
                <Badge className="bg-white/15 hover:bg-white/15 border border-white/20 text-white rounded-full">
                  {tu('hero.total', 'Total')}: {totalExpenses.toLocaleString(uiLocale, { minimumFractionDigits: 2 })} DH
                </Badge>
                <Badge className="bg-white/15 hover:bg-white/15 border border-white/20 text-white rounded-full">
                  {tu('hero.average', 'Moyenne')}: {averageExpense.toLocaleString(uiLocale, { maximumFractionDigits: 2 })} DH
                </Badge>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={handleDownloadPDF} className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white">
                <Download className="w-4 h-4 mr-2" />
                {tu('actions.exportPdf', 'Exporter PDF')}
              </Button>
              <Button onClick={() => { resetForm(); setDialogOpen(true); }} className="bg-white text-indigo-900 hover:bg-indigo-50 font-bold">
                <Plus className="w-4 h-4 mr-2" />
                {tu('actions.newExpense', 'Nouvelle Charge')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border-none shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500 font-semibold uppercase">{tr('Total Filtré', 'الإجمالي المفلتر')}</p>
            <p className="text-2xl font-black text-rose-700 mt-1">-{totalExpenses.toFixed(2)} DH</p>
            <p className="text-xs text-slate-500 mt-1">{tr('Charge active selon les filtres', 'الإنفاق النشط حسب الفلاتر')}</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500 font-semibold uppercase">{tr('Transaction Max', 'أعلى عملية')}</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{maxExpense.toFixed(2)} DH</p>
            <p className="text-xs text-slate-500 mt-1">{tr('Plus grande dépense affichée', 'أكبر مصروف معروض')}</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500 font-semibold uppercase">{tr('Delta Mensuel', 'فارق شهري')}</p>
            <p className={`text-2xl font-black mt-1 ${monthDelta > 0 ? 'text-rose-700' : monthDelta < 0 ? 'text-emerald-700' : 'text-slate-900'}`}>
              {monthDelta > 0 ? '+' : ''}{monthDelta.toFixed(2)} DH
            </p>
            <p className="text-xs text-slate-500 mt-1">{monthDeltaPercent}% {tr('vs mois précédent', 'مقارنة بالشهر السابق')}</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500 font-semibold uppercase">{tr('Top Catégorie', 'أعلى فئة')}</p>
            <p className="text-2xl font-black text-slate-900 mt-1 capitalize">{topExpenseTypes[0]?.type || '-'}</p>
            <p className="text-xs text-slate-500 mt-1">{topExpenseTypes[0]?.amount.toFixed(2) || '0.00'} DH</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-sm bg-white">
        <CardContent className="p-5 space-y-4">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={tu('filters.searchPlaceholder', 'Rechercher par type, code ou note...')}
                className="pl-10 h-11 bg-slate-50 border-slate-200 rounded-xl"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant={paymentFilter === 'all' ? 'default' : 'outline'} className={paymentFilter === 'all' ? 'bg-indigo-600 hover:bg-indigo-700' : ''} onClick={() => setPaymentFilter('all')}>{tu('filters.all', 'Tous')}</Button>
              <Button variant={paymentFilter === 'espece' ? 'default' : 'outline'} className={paymentFilter === 'espece' ? 'bg-emerald-600 hover:bg-emerald-700' : ''} onClick={() => setPaymentFilter('espece')}>{tu('payment.cash', 'Espèce')}</Button>
              <Button variant={paymentFilter === 'compte_fournisseur' ? 'default' : 'outline'} className={paymentFilter === 'compte_fournisseur' ? 'bg-purple-600 hover:bg-purple-700 text-white' : ''} onClick={() => setPaymentFilter('compte_fournisseur')}>
                <Landmark className="w-3.5 h-3.5 mr-1" />
                {tr('Compte Fournisseur', 'حساب المورد')}
              </Button>
              <Button variant={paymentFilter === 'cheque' ? 'default' : 'outline'} className={paymentFilter === 'cheque' ? 'bg-amber-600 hover:bg-amber-700' : ''} onClick={() => setPaymentFilter('cheque')}>{tu('payment.cheque', 'Chèque')}</Button>
              <Button variant={paymentFilter === 'banque' ? 'default' : 'outline'} className={paymentFilter === 'banque' ? 'bg-indigo-600 hover:bg-indigo-700' : ''} onClick={() => setPaymentFilter('banque')}>{tu('payment.bank', 'Banque')}</Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl border border-slate-200">
              <Filter className="w-4 h-4 text-slate-500" />
              <span className="text-xs font-bold text-slate-500 uppercase">{tu('filters.smart', 'Filtres intelligents')}</span>
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="date"
                  variant="outline"
                  className={cn("h-11 min-w-[250px] justify-start text-left", !dateRange && "text-slate-500")}
                >
                  <Calendar className="mr-2 h-4 w-4 text-indigo-600" />
                  {dateRange?.from
                    ? dateRange.to
                      ? `${formatDateUi(dateRange.from, { day: '2-digit', month: 'short' })} - ${formatDateUi(dateRange.to, { day: '2-digit', month: 'short' })}`
                      : formatDateUi(dateRange.from, { day: '2-digit', month: 'long', year: 'numeric' })
                    : tu('filters.allDates', 'Toutes les dates')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 rounded-2xl shadow-2xl border-none overflow-hidden" align="end">
                <CalendarComponent
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={2}
                  className="bg-white p-4"
                />
              </PopoverContent>
            </Popover>
            <Button
              variant="outline"
              className="h-11"
              onClick={() => {
                const now = new Date();
                const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
                setDateRange({ from, to: now });
              }}
            >
              {tu('filters.last7Days', '7 jours')}
            </Button>
            <Button
              variant="outline"
              className="h-11"
              onClick={() => {
                const now = new Date();
                const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
                setDateRange({ from, to: now });
              }}
            >
              {tu('filters.last30Days', '30 jours')}
            </Button>
            {(searchQuery || dateRange || paymentFilter !== 'all') && (
              <Button
                variant="ghost"
                onClick={() => {
                  setSearchQuery('');
                  setDateRange(undefined);
                  setPaymentFilter('all');
                }}
                className="h-11 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {tu('actions.reset', 'Réinitialiser')}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm bg-white">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Gauge className="w-4 h-4 text-indigo-600" />
            {tu('forecast.title', tr('Prévision V4 & Garde-fous', 'توقعات V4 وحواجز الحماية'))}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <Button
              variant={forecastMode === 'prudent' ? 'default' : 'outline'}
              className={forecastMode === 'prudent' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
              onClick={() => setForecastMode('prudent')}
            >
              {tu('forecast.scenarioPrudent', 'Scénario Prudent')}
            </Button>
            <Button
              variant={forecastMode === 'equilibre' ? 'default' : 'outline'}
              className={forecastMode === 'equilibre' ? 'bg-indigo-600 hover:bg-indigo-700' : ''}
              onClick={() => setForecastMode('equilibre')}
            >
              {tu('forecast.scenarioBalanced', 'Scénario Équilibré')}
            </Button>
            <Button
              variant={forecastMode === 'offensif' ? 'default' : 'outline'}
              className={forecastMode === 'offensif' ? 'bg-rose-600 hover:bg-rose-700' : ''}
              onClick={() => setForecastMode('offensif')}
            >
              {tu('forecast.scenarioOffensive', 'Scénario Offensif')}
            </Button>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
              <div>
                <p className="text-sm font-semibold text-slate-800">{tu('forecast.budgetGuardrail', tr('Garde-fou budget', 'حاجز حماية الميزانية'))}</p>
                <p className="text-xs text-slate-500 mt-0.5">{tu('forecast.monthlyFrame', tr('Cadre mensuel pour piloter les dépenses.', 'إطار شهري لقيادة المصاريف.'))}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="monthlyBudget">{tu('forecast.monthlyBudgetTargetDh', 'Budget mensuel cible (DH)')}</Label>
                <Input
                  id="monthlyBudget"
                  type="number"
                  min="0"
                  value={monthlyBudget}
                  onChange={(e) => setMonthlyBudget(e.target.value)}
                  placeholder="50000"
                />
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setMonthlyBudget('30000')}>30k</Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setMonthlyBudget('50000')}>50k</Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setMonthlyBudget('80000')}>80k</Button>
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-1">
                <p className="text-xs text-slate-500">{tu('forecast.currentMonthExpenses', 'Dépenses du mois courant')}</p>
                <p className="text-sm font-bold text-slate-900">{currentMonthExpenses.toFixed(2)} DH</p>
                <p className="text-xs text-slate-500">{tu('forecast.budgetConsumption', 'Consommation budget')}</p>
                <Badge variant="outline" className={guardrailMeta.tone}>
                  {guardrailMeta.ratio}% · {guardrailMeta.label}
                </Badge>
              </div>
            </div>

            <div className="xl:col-span-2 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex items-center justify-between gap-2 mb-3">
                <p className="text-sm font-semibold text-slate-800">{tu('forecast.projection6Weeks', tr('Projection 6 semaines', 'توقع 6 أسابيع'))}</p>
                <p className="text-xs text-slate-500">{tu('forecast.runRate', tr('Rythme', 'الوتيرة'))}: {weeklyRunRate.toFixed(2)} DH / {tu('forecast.week', tr('semaine', 'أسبوع'))}</p>
              </div>
              <div className="space-y-2">
                {forecastTimeline.map((point) => (
                  <button
                    key={point.week}
                    type="button"
                    onClick={() => {
                      if (point.pressure === 'high') {
                        const now = new Date();
                        const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
                        setDateRange({ from, to: now });
                      }
                      if (point.pressure === 'medium') {
                        const now = new Date();
                        const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
                        setDateRange({ from, to: now });
                      }
                      if (point.pressure === 'low') {
                        setDateRange(undefined);
                      }
                    }}
                    className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-left hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-slate-700">{tu('forecast.weekLabel', 'Semaine')} {point.week}</p>
                      <Badge variant="outline" className={point.pressure === 'high' ? 'text-rose-700 border-rose-200 bg-rose-50' : point.pressure === 'medium' ? 'text-amber-700 border-amber-200 bg-amber-50' : 'text-emerald-700 border-emerald-200 bg-emerald-50'}>
                        {point.pressure === 'high' ? tr('Critique', 'حرج') : point.pressure === 'medium' ? tr('Vigilance', 'مراقبة') : tr('Stable', 'مستقر')}
                      </Badge>
                    </div>
                    <div className="mt-1 flex items-center justify-between">
                      <p className="text-sm font-bold text-slate-900">{point.projectedSpend.toFixed(2)} DH</p>
                      <p className={`text-xs font-semibold ${point.ratio >= 100 ? 'text-rose-600' : point.ratio >= 85 ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {point.ratio}% {tu('forecast.budget', 'budget')}
                      </p>
                    </div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                      <div className={`h-full ${point.ratio >= 100 ? 'bg-rose-500' : point.ratio >= 85 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, point.ratio)}%` }} />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center gap-2 mb-2">
              <Siren className="w-4 h-4 text-rose-600" />
              <p className="text-sm font-semibold text-slate-800">{tu('forecast.smartAlerts', 'Smart Alerts')}</p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
              {smartAlerts.map((alert) => (
                <button
                  key={alert.id}
                  type="button"
                  onClick={() => applyAlertAction(alert.action)}
                  className="rounded-lg border border-slate-200 bg-white p-2.5 text-left hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    {alert.action === 'tighten' && <Target className="w-3.5 h-3.5 text-rose-600" />}
                    {alert.action === 'bank' && <Banknote className="w-3.5 h-3.5 text-indigo-600" />}
                    {alert.action === 'category' && <Layers className="w-3.5 h-3.5 text-amber-600" />}
                    {alert.action === 'recover' && <Rocket className="w-3.5 h-3.5 text-emerald-600" />}
                    <p className="text-xs font-semibold text-slate-800">{alert.title}</p>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">{alert.note}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center gap-2 mb-2">
              <BellRing className="w-4 h-4 text-indigo-600" />
              <p className="text-sm font-semibold text-slate-800">{tu('forecast.earlyWarningLab', tr('V4.1 Laboratoire d\'alerte précoce', 'V4.1 مختبر الإنذار المبكر'))}</p>
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
              <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase">{tu('forecast.cumulativeMonthForecast', tr('Prévision cumulée du mois', 'التوقع التراكمي للشهر'))}</p>
                <p className="text-sm font-bold text-slate-900">{cumulativeMonthForecast.projectedEndMonth.toFixed(2)} DH</p>
                <p className={`text-xs font-semibold ${cumulativeMonthForecast.forecastDelta > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {cumulativeMonthForecast.forecastDelta > 0 ? '+' : ''}{cumulativeMonthForecast.forecastDelta.toFixed(2)} DH {tu('forecast.vsCurrent', tr('vs actuel', 'مقارنة بالحالي'))}
                </p>
                <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
                  <div className={`${budgetValue > 0 && cumulativeMonthForecast.projectedEndMonth >= budgetValue ? 'bg-rose-500' : 'bg-emerald-500'} h-full`} style={{ width: `${Math.min(100, budgetValue > 0 ? (cumulativeMonthForecast.projectedEndMonth / budgetValue) * 100 : 0)}%` }} />
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase">{tu('forecast.categoryTargetPlanner', tr('Planificateur cible de catégorie', 'مخطط هدف الفئة'))}</p>
                <Select value={selectedTargetCategory} onValueChange={setSelectedTargetCategory}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder={tu('forecast.selectCategory', tr('Sélectionner une catégorie', 'اختر فئة'))} />
                  </SelectTrigger>
                  <SelectContent>
                    {targetCategoryOptions.map((item) => (
                      <SelectItem key={item} value={item} className="capitalize">
                        {item === 'all' ? tu('forecast.allCategories', tr('Toutes les catégories', 'كل الفئات')) : item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min="1"
                  max="100"
                  value={categoryTargetShare}
                  onChange={(e) => setCategoryTargetShare(e.target.value)}
                  className="h-9"
                  placeholder="35"
                />
                <Badge variant="outline" className={categoryTargetMeta.ratio >= 100 ? 'text-rose-700 border-rose-200 bg-rose-50' : categoryTargetMeta.ratio >= 85 ? 'text-amber-700 border-amber-200 bg-amber-50' : 'text-emerald-700 border-emerald-200 bg-emerald-50'}>
                  {categoryTargetMeta.ratio}% · {categoryTargetMeta.status}
                </Badge>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase">{tu('forecast.earlyWarnings', tr('Alertes précoces', 'إنذارات مبكرة'))}</p>
                {earlyWarnings.map((warning) => (
                  <button
                    key={warning.id}
                    type="button"
                    onClick={() => applyAlertAction(warning.action)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-left hover:bg-slate-100 transition-colors"
                  >
                    <p className="text-xs font-semibold text-slate-800">{warning.title}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{warning.note}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between gap-2 mb-3">
              <p className="text-sm font-semibold text-slate-800">{tu('forecast.whatIfLab', tr('V4.2 Laboratoire scénarios What-if', 'V4.2 مختبر سيناريوهات What-if'))}</p>
              <div className="flex items-center gap-2">
                <Label htmlFor="whatIfVariation" className="text-xs text-slate-500">{tu('forecast.variationPercent', 'Variation (%)')}</Label>
                <Input
                  id="whatIfVariation"
                  type="number"
                  min="-35"
                  max="35"
                  value={whatIfVariation}
                  onChange={(e) => setWhatIfVariation(e.target.value)}
                  className="h-8 w-20"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
              {whatIfMeta.scenarios.map((scenario) => (
                <button
                  key={scenario.key}
                  type="button"
                  onClick={() => applyScenario(scenario.key)}
                  className={`rounded-lg border p-3 text-left transition-colors ${forecastMode === scenario.key ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-700">{scenario.label}</p>
                    <Badge variant="outline" className={scenario.optimizedRatio >= 100 ? 'text-rose-700 border-rose-200 bg-rose-50' : scenario.optimizedRatio >= 85 ? 'text-amber-700 border-amber-200 bg-amber-50' : 'text-emerald-700 border-emerald-200 bg-emerald-50'}>
                      {scenario.optimizedRatio}% {tu('forecast.optimized', tr('optimisé', 'محسّن'))}
                    </Badge>
                  </div>
                  <p className="text-sm font-bold text-slate-900 mt-1">{scenario.projected.toFixed(2)} DH</p>
                  <p className="text-[11px] text-slate-500">{tu('forecast.base', tr('Base', 'الأساس'))} {scenario.ratio}% {tu('forecast.budget', tr('budget', 'الميزانية'))} · {tu('forecast.shift', tr('variation', 'التغير'))} {whatIfMeta.variationPercent}%</p>
                  <p className="text-xs font-semibold text-indigo-700 mt-1">{tu('forecast.optimizedValue', tr('Optimisé', 'محسّن'))}: {scenario.optimizedProjected.toFixed(2)} DH</p>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 mt-3">
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <p className="text-xs font-semibold text-slate-500 uppercase">{tu('forecast.sideBySideBoard', tr('Tableau comparatif', 'لوحة مقارنة'))}</p>
                <div className="mt-2 space-y-2">
                  {whatIfMeta.scenarios.map((scenario) => (
                    <div key={`bar-${scenario.key}`} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-slate-700">{scenario.label}</p>
                        <p className="text-xs text-slate-500">{scenario.optimizedRatio}%</p>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
                        <div className={`h-full ${scenario.optimizedRatio >= 100 ? 'bg-rose-500' : scenario.optimizedRatio >= 85 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, scenario.optimizedRatio)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <p className="text-xs font-semibold text-slate-500 uppercase">{tu('forecast.autoOptimizationByCategory', tr('Optimisation automatique par catégorie', 'تحسين تلقائي حسب الفئة'))}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{tu('forecast.potentialReduction', tr('Réduction potentielle', 'تخفيض محتمل'))}: {whatIfMeta.optimizationTotal.toFixed(2)} DH</p>
                <div className="mt-2 space-y-2">
                  {optimizationPlan.length === 0 ? (
                    <p className="text-xs text-slate-500">{tu('forecast.noCategorySignal', tr('Aucun signal catégorie disponible.', 'لا توجد إشارة فئة متاحة.'))}</p>
                  ) : (
                    optimizationPlan.map((item) => (
                      <button
                        key={item.type}
                        type="button"
                        onClick={() => applyOptimization(item.type, item.suggestedShare)}
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-left hover:bg-slate-100 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-slate-700 capitalize">{item.type}</p>
                          <p className="text-[11px] text-slate-500">{item.share.toFixed(0)}%</p>
                        </div>
                        <p className="text-[11px] text-indigo-700 mt-0.5">{tu('forecast.target', tr('Objectif', 'الهدف'))} {item.suggestedShare}% · {tu('forecast.save', tr('Économie', 'توفير'))} {item.reductionAmount.toFixed(2)} DH</p>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center gap-2 mb-3">
              <History className="w-4 h-4 text-indigo-600" />
              <p className="text-sm font-semibold text-slate-800">{tr('V4.3 Scenario Memory & Adaptive Actions', 'V4.3 ذاكرة السيناريو والإجراءات التكيفية')}</p>
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
              <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase">{tr('Scenario persistence', 'استمرارية السيناريو')}</p>
                <p className="text-[11px] text-slate-500">{tr('Mode', 'الوضع')} {forecastMode} · {tr('Variation', 'التغيّر')} {whatIfMeta.variationPercent}%</p>
                <p className="text-[11px] text-slate-500">{tr('Budget', 'الميزانية')} {monthlyBudget} DH · {tr('Snapshots', 'اللقطات')} {scenarioHistory.length}</p>
                <div className="flex items-center gap-2 pt-1">
                  <Button type="button" size="sm" onClick={captureScenarioSnapshot} className="bg-indigo-600 hover:bg-indigo-700">
                    <Save className="w-3.5 h-3.5 mr-1.5" />
                    {tr('Save Snapshot', 'حفظ لقطة')}
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={resetScenarioLab}>
                    <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                    {tr('Reset Lab', 'إعادة ضبط المختبر')}
                  </Button>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase">{tr('Historical replay', 'إعادة تشغيل تاريخية')}</p>
                {scenarioHistory.length === 0 ? (
                  <p className="text-xs text-slate-500">{tr('No snapshots yet.', 'لا توجد لقطات بعد.')}</p>
                ) : (
                  scenarioHistory.map((snapshot) => (
                    <button
                      key={snapshot.id}
                      type="button"
                      onClick={() => replayScenarioSnapshot(snapshot)}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-left hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-slate-700 capitalize">{snapshot.mode}</p>
                        <p className="text-[11px] text-slate-500">{new Date(snapshot.timestamp).toLocaleString(uiLocale, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    <p className="text-[11px] text-indigo-700 mt-0.5">{snapshot.optimized.toFixed(2)} DH {tr('optimized', 'محسّن')} · {snapshot.variation}%</p>
                    </button>
                  ))
                )}
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
                <div className="flex items-center gap-1.5">
                  <BrainCircuit className="w-3.5 h-3.5 text-rose-600" />
                  <p className="text-xs font-semibold text-slate-500 uppercase">{tr('Adaptive recommendations', 'توصيات تكيفية')}</p>
                </div>
                {adaptiveRecommendations.map((recommendation) => (
                  <button
                    key={recommendation.id}
                    type="button"
                    onClick={() => applyRecommendation(recommendation.action)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-left hover:bg-slate-100 transition-colors"
                  >
                    <p className="text-xs font-semibold text-slate-800">{recommendation.title}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{recommendation.note}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-600" />
              {tu('sections.paymentBreakdown', 'Répartition par paiement')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {paymentBreakdown.map((item) => (
              <button
                key={item.method}
                type="button"
                onClick={() => setPaymentFilter(item.method as any)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50/60 p-2.5 text-left hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-700 capitalize">{paymentLabel(item.method)}</p>
                  <p className="text-xs font-semibold text-slate-500">{item.ratio}%</p>
                </div>
                <p className="text-sm font-bold text-slate-900 mt-1">{item.amount.toFixed(2)} DH · {item.count} {tr('ops', 'عملية')}</p>
                <div className="mt-1.5 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                  <div className="h-full bg-indigo-500" style={{ width: `${item.ratio}%` }} />
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Layers className="w-4 h-4 text-rose-600" />
              {tu('sections.topCategories', 'Top catégories')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topExpenseTypes.length === 0 ? (
              <p className="text-sm text-slate-500">{tu('empty.noData', 'Aucune donnée disponible.')}</p>
            ) : (
              topExpenseTypes.map((item, index) => (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => setSearchQuery(item.type)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50/60 p-2.5 text-left hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-700 capitalize">#{index + 1} {item.type}</p>
                    <p className="text-xs text-slate-500">{item.count} {tr('ops', 'عملية')}</p>
                  </div>
                  <p className="text-sm font-bold text-rose-700 mt-1">-{item.amount.toFixed(2)} DH</p>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-600" />
              {tu('sections.expenseRadar', 'Radar dépenses fortes')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {expensiveExpenses.map((expense) => (
              <button
                key={expense.id}
                type="button"
                onClick={() => handleEditExpense(expense)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50/60 p-2.5 text-left hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-slate-700 capitalize truncate">{expense.type}</p>
                  <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
                </div>
                <p className="text-sm font-bold text-slate-900 mt-1">-{expense.amount.toFixed(2)} DH</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{formatDateUi(expense.date)} · {expense.code || '-'}</p>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-md overflow-hidden rounded-2xl bg-white">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/70">
              <TableRow className="hover:bg-transparent border-slate-100">
                <TableHead className="text-slate-600 font-bold">{tu('table.type', 'Type')}</TableHead>
                <TableHead className="text-slate-600 font-bold">{tu('table.code', 'Code')}</TableHead>
                <TableHead className="text-slate-600 font-bold">{tu('table.date', 'Date')}</TableHead>
                <TableHead className="text-slate-600 font-bold">{tu('table.paymentMethod', 'Mode de paiement')}</TableHead>
                <TableHead className="text-slate-600 font-bold">{tu('table.note', 'Note')}</TableHead>
                <TableHead className="text-slate-600 font-bold text-right">{tu('table.amount', 'Montant')}</TableHead>
                <TableHead className="text-slate-600 font-bold text-center">{tu('table.actions', 'Actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredExpenses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-40 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <Receipt className="w-12 h-12 mb-2 opacity-20" />
                      <p className="text-lg font-medium">{tu('empty.noExpenseFound', 'Aucune dépense trouvée')}</p>
                      <p className="text-sm">{tu('empty.adjustFilters', 'Vérifiez vos filtres ou ajoutez une nouvelle charge')}</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredExpenses.map((expense) => (
                  <TableRow key={expense.id} className="group hover:bg-slate-50/50 transition-colors border-slate-100">
                    <TableCell>
                      <Badge variant="outline" className="bg-white border-slate-200 text-slate-700 font-bold px-3 py-1 rounded-lg capitalize">
                        {expense.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-600 font-medium">{expense.code || '-'}</TableCell>
                    <TableCell className="text-slate-600 font-medium">{formatDateUi(expense.date)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {expense.paymentMethod === 'espece' && <Banknote className="w-4 h-4 text-emerald-500 shrink-0" />}
                        {expense.paymentMethod === 'compte_fournisseur' && <Landmark className="w-4 h-4 text-purple-600 shrink-0" />}
                        {expense.paymentMethod === 'cheque' && <Receipt className="w-4 h-4 text-amber-500 shrink-0" />}
                        {expense.paymentMethod === 'banque' && <CreditCard className="w-4 h-4 text-indigo-500 shrink-0" />}
                        <div className="flex flex-col">
                          <span className="capitalize text-slate-700 font-medium">
                            {paymentLabel(expense.paymentMethod)}
                          </span>
                          {expense.paymentMethod === 'compte_fournisseur' && (expense.supplierBankName || expense.accountDetails) && (
                            <span className="text-[11px] text-purple-600 font-semibold tracking-tight">
                              {expense.supplierBankName || expense.accountDetails}
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate text-slate-500 italic text-sm">{expense.note || '-'}</TableCell>
                    <TableCell className="text-right">
                      <span className="font-extrabold text-rose-600 bg-rose-50 px-3 py-1 rounded-lg">-{expense.amount.toFixed(2)} DH</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                          onClick={() => handleEditExpense(expense)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                          onClick={() => {
                            if (window.confirm(tu('confirm.deleteExpense', 'Êtes-vous sûr de vouloir supprimer cette dépense ?'))) {
                              deleteExpense(expense.id);
                              toast.success(tu('toast.expenseDeleted', 'Dépense supprimée avec succès'));
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
              {filteredExpenses.length > 0 && (
                <TableRow className="bg-slate-50/80 hover:bg-slate-50/80 border-t-2 border-slate-100">
                  <TableCell colSpan={5} className="py-5 text-lg font-bold text-slate-900">
                    <div className="flex items-center gap-2">
                      <div className="w-1 h-6 bg-rose-500 rounded-full" />
                      {tu('table.totalFilteredExpenses', 'Total des charges filtrées')}
                    </div>
                  </TableCell>
                  <TableCell className="text-right py-5">
                    <div className="inline-flex flex-col items-end">
                      <span className="text-2xl font-black text-rose-700">-{totalExpenses.toFixed(2)} DH</span>
                      <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{tu('table.totalAmountVatIncluded', 'Montant total TTC')}</span>
                    </div>
                  </TableCell>
                  <TableCell />
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl p-0 border-none overflow-hidden shadow-2xl rounded-2xl max-h-[92vh] flex flex-col">
          {/* Header */}
          <div className="bg-gradient-to-r from-rose-600 via-rose-700 to-indigo-950 p-6 text-white shrink-0 relative overflow-hidden">
            <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
            <DialogHeader>
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-md shadow-inner border border-white/20">
                  <Receipt className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <DialogTitle className="text-xl font-black text-white tracking-wide">
                      {expenseToEdit ? tu('dialog.editTitle', 'Modifier la Charge') : tu('dialog.newTitle', 'Nouvelle Charge')}
                    </DialogTitle>
                    <Badge className="bg-white/20 text-white hover:bg-white/30 border-none text-[11px] font-semibold px-2">
                      <Sparkles className="w-3 h-3 mr-1 text-amber-300 inline" />
                      {expenseToEdit ? tr('Édition', 'تعديل') : tr('Enregistrement', 'تسجيل')}
                    </Badge>
                  </div>
                  <p className="text-rose-100/90 text-xs mt-1 font-medium">
                    {expenseToEdit 
                      ? tr('Mettre à jour les paramètres et le mode de règlement de la charge', 'تحديث بيانات ومصدر دفع المصروف') 
                      : tr('Enregistrer une charge avec affectation automatique du compte', 'تسجيل مصروف جديد مع الخصم التلقائي من الحساب المالي المختار')}
                  </p>
                </div>
              </div>
            </DialogHeader>
          </div>
          
          {/* Form Content */}
          <div className="p-6 space-y-5 bg-slate-50/40 overflow-y-auto flex-1">
            {/* Type de Dépense */}
            <div className="space-y-2 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between">
                <Label htmlFor="type" className="text-slate-800 font-bold text-sm flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-rose-500" />
                  {tu('form.expenseTypeLabel', 'Type de dépense')} <span className="text-rose-500">*</span>
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 px-2"
                  onClick={() => setShowAddTypeInline((prev) => !prev)}
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  {tr('Nouveau type', 'نوع جديد')}
                </Button>
              </div>

              <Select value={expenseType} onValueChange={setExpenseType}>
                <SelectTrigger className="h-11 bg-slate-50/80 border-slate-200 focus:ring-2 focus:ring-rose-500 transition-all rounded-xl">
                  <SelectValue placeholder={tu('form.chooseType', 'Choisir un type')} />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-100 shadow-xl max-h-60">
                  {expenseTypes.map(type => (
                    <SelectItem key={type} value={type} className="rounded-lg capitalize font-medium">{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {showAddTypeInline && (
                <div className="flex gap-2 pt-2 p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 animate-in fade-in-50 duration-200">
                  <Input
                    value={newExpenseTypeName}
                    onChange={(e) => setNewExpenseTypeName(e.target.value)}
                    placeholder={tr('Nom du nouveau type...', 'اسم النوع الجديد...')}
                    className="h-9 bg-white border-indigo-200 text-sm"
                  />
                  <Button type="button" size="sm" className="h-9 bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 font-medium" onClick={handleAddExpenseTypeToList}>
                    {tr('Ajouter', 'إضافة')}
                  </Button>
                </div>
              )}

              {expenseType === 'autre' && (
                <div className="space-y-1.5 pt-2">
                  <Label htmlFor="customExpenseType" className="text-slate-700 text-xs font-semibold">{tu('form.customExpenseNameLabel', 'Préciser le nom de la dépense *')}</Label>
                  <Input
                    id="customExpenseType"
                    value={customExpenseType}
                    onChange={(e) => setCustomExpenseType(e.target.value)}
                    placeholder={tu('form.customExpenseNamePlaceholder', 'Entrez le nom de la dépense')}
                    className="h-10 bg-slate-50 border-slate-200 focus:ring-2 focus:ring-rose-500 transition-all rounded-xl font-semibold"
                  />
                </div>
              )}
            </div>

            {/* Code & Montant Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Code */}
              <div className="space-y-2 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between">
                  <Label htmlFor="code" className="text-slate-800 font-bold text-sm">
                    {tu('form.codeLabel', 'Code')} <span className="text-xs font-normal text-slate-400">({tr('facultatif', 'اختياري')})</span>
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleGenerateCode}
                    className="h-6 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 px-2"
                  >
                    <Sparkles className="w-3 h-3 mr-1" />
                    {tr('Auto', 'تلقائي')}
                  </Button>
                </div>
                <Input
                  id="code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder={tu('form.codePlaceholder', 'Ex: EXP-20261024-01')}
                  className="h-11 bg-slate-50/80 border-slate-200 focus:ring-2 focus:ring-rose-500 transition-all rounded-xl font-bold font-mono text-slate-800"
                />
              </div>

              {/* Amount */}
              <div className="space-y-2 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                <Label htmlFor="amount" className="text-slate-800 font-bold text-sm">
                  {tu('form.amountLabel', 'Montant (MAD)')} <span className="text-rose-500">*</span>
                </Label>
                <div className="relative group">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-rose-600 transition-colors" />
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="pl-9 pr-12 h-11 bg-slate-50/80 border-slate-200 focus:ring-2 focus:ring-rose-500 transition-all rounded-xl font-black text-rose-600 text-lg"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">DH</span>
                </div>
              </div>
            </div>

            {/* Mode de règlement */}
            <div className="space-y-3 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between">
                <Label className="text-slate-800 font-bold text-sm flex items-center gap-1.5">
                  <Wallet className="w-4 h-4 text-purple-600" />
                  {tu('form.paymentMethodLabel', 'Mode de règlement')} <span className="text-rose-500">*</span>
                </Label>
                {paymentMethod === 'compte_fournisseur' && (
                  <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100 border-purple-200 text-[10px] font-bold">
                    {tr('Débit Fournisseur Direct', 'خصم بنكي مباشر')}
                  </Badge>
                )}
              </div>

              {/* Visual payment mode selector grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {/* Espèce */}
                <button
                  type="button"
                  onClick={() => {
                    setPaymentMethod('espece');
                    setSelectedSupplierId('');
                    setSelectedSupplierBank('');
                  }}
                  className={cn(
                    "flex flex-col items-center justify-center p-3 rounded-xl border transition-all text-center gap-1.5",
                    paymentMethod === 'espece'
                      ? "border-emerald-500 bg-emerald-50/70 text-emerald-900 ring-2 ring-emerald-500/20 shadow-sm font-bold"
                      : "border-slate-200 hover:border-slate-300 bg-slate-50/50 text-slate-600 hover:bg-slate-50"
                  )}
                >
                  <Banknote className={cn("w-5 h-5", paymentMethod === 'espece' ? "text-emerald-600" : "text-slate-400")} />
                  <span className="text-xs font-bold leading-tight">{tu('payment.cash', 'Espèce')}</span>
                  <span className="text-[10px] text-slate-400 font-normal">{tr('Caisse', 'الصندوق')}</span>
                </button>

                {/* Compte Bancaire Fournisseur */}
                <button
                  type="button"
                  onClick={() => {
                    setPaymentMethod('compte_fournisseur');
                    if (!selectedSupplierBank && supplierBankProfiles.length > 0) {
                      setSelectedSupplierId(supplierBankProfiles[0].id);
                      setSelectedSupplierBank(supplierBankProfiles[0].bankAccountName);
                    }
                  }}
                  className={cn(
                    "flex flex-col items-center justify-center p-3 rounded-xl border transition-all text-center gap-1.5",
                    paymentMethod === 'compte_fournisseur'
                      ? "border-purple-600 bg-purple-50/80 text-purple-950 ring-2 ring-purple-500/20 shadow-sm font-bold"
                      : "border-slate-200 hover:border-slate-300 bg-slate-50/50 text-slate-600 hover:bg-slate-50"
                  )}
                >
                  <Landmark className={cn("w-5 h-5", paymentMethod === 'compte_fournisseur' ? "text-purple-600" : "text-slate-400")} />
                  <span className="text-xs font-bold leading-tight">{tr('Compte Fournisseur', 'حساب المورد')}</span>
                  <span className="text-[10px] text-purple-600/80 font-semibold">{tr('Débit auto', 'خصم بنكي')}</span>
                </button>

                {/* Chèque */}
                <button
                  type="button"
                  onClick={() => {
                    setPaymentMethod('cheque');
                    setSelectedSupplierId('');
                    setSelectedSupplierBank('');
                  }}
                  className={cn(
                    "flex flex-col items-center justify-center p-3 rounded-xl border transition-all text-center gap-1.5",
                    paymentMethod === 'cheque'
                      ? "border-amber-500 bg-amber-50/70 text-amber-900 ring-2 ring-amber-500/20 shadow-sm font-bold"
                      : "border-slate-200 hover:border-slate-300 bg-slate-50/50 text-slate-600 hover:bg-slate-50"
                  )}
                >
                  <Receipt className={cn("w-5 h-5", paymentMethod === 'cheque' ? "text-amber-600" : "text-slate-400")} />
                  <span className="text-xs font-bold leading-tight">{tu('payment.cheque', 'Chèque')}</span>
                  <span className="text-[10px] text-slate-400 font-normal">{tr('Portefeuille', 'شيك')}</span>
                </button>

                {/* Banque Société */}
                <button
                  type="button"
                  onClick={() => {
                    setPaymentMethod('banque');
                    setSelectedSupplierId('');
                    setSelectedSupplierBank('');
                  }}
                  className={cn(
                    "flex flex-col items-center justify-center p-3 rounded-xl border transition-all text-center gap-1.5",
                    paymentMethod === 'banque'
                      ? "border-indigo-600 bg-indigo-50/70 text-indigo-950 ring-2 ring-indigo-500/20 shadow-sm font-bold"
                      : "border-slate-200 hover:border-slate-300 bg-slate-50/50 text-slate-600 hover:bg-slate-50"
                  )}
                >
                  <CreditCard className={cn("w-5 h-5", paymentMethod === 'banque' ? "text-indigo-600" : "text-slate-400")} />
                  <span className="text-xs font-bold leading-tight">{tu('payment.bank', 'Banque')}</span>
                  <span className="text-[10px] text-slate-400 font-normal">{tr('Société', 'حساب الشركة')}</span>
                </button>
              </div>

              {/* Dedicated Supplier Bank Account Selector when compte_fournisseur is chosen */}
              {paymentMethod === 'compte_fournisseur' && (
                <div className="mt-3 p-4 bg-purple-50/60 rounded-xl border border-purple-200 space-y-3 animate-in fade-in-50 duration-200">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-purple-600" />
                      {tr('Sélectionner le compte bancaire fournisseur *', 'اختر حساب بنك المورد *')}
                    </Label>
                    <span className="text-[11px] text-purple-600 font-semibold">
                      {supplierBankProfiles.length} {tr('comptes disponibles', 'حسابات متوفرة')}
                    </span>
                  </div>

                  <Select
                    value={selectedSupplierBank}
                    onValueChange={(val) => {
                      setSelectedSupplierBank(val);
                      const matched = supplierBankProfiles.find(s => s.bankAccountName === val);
                      if (matched) setSelectedSupplierId(matched.id);
                    }}
                  >
                    <SelectTrigger className="h-11 bg-white border-purple-200 focus:ring-2 focus:ring-purple-500 rounded-xl font-medium text-slate-800">
                      <SelectValue placeholder={tr('Choisir un compte bancaire fournisseur', 'اختر حساب بنك المورد')} />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-purple-100 shadow-xl max-h-60">
                      {supplierBankProfiles.map((sup) => (
                        <SelectItem key={sup.id} value={sup.bankAccountName} className="rounded-lg py-2">
                          <div className="flex flex-col text-left">
                            <span className="font-bold text-slate-800">{sup.bankAccountName}</span>
                            <span className="text-[11px] text-slate-500">
                              {sup.name !== sup.bankAccountName ? `${sup.name} · ` : ''}
                              {sup.bankName ? `${sup.bankName} ` : ''}
                              {sup.rib ? `(RIB: ${sup.rib.slice(-6)})` : ''}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Impact notice banner */}
                  <div className="flex items-start gap-2.5 p-3 rounded-lg bg-white/90 border border-purple-200/80 text-xs text-purple-900">
                    <ArrowDownRight className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">
                        {tr('Déduction automatique du compte bancaire fournisseur :', 'خصم تلقائي من حساب بنك المورد :')}
                      </p>
                      <p className="text-[11px] text-purple-700 mt-0.5">
                        {tr(
                          `Le montant de ${amount ? `${parseFloat(amount).toFixed(2)} DH` : '0.00 DH'} sera débité directement du compte "${selectedSupplierBank || 'Fournisseur'}" dans la section Comptes Bancaires Fournisseurs.`,
                          `سيتم خصم مبلغ ${amount ? `${parseFloat(amount).toFixed(2)} DH` : '0.00 DH'} مباشرة من حساب "${selectedSupplierBank || 'المورد'}" في قسم حسابات بنوك الموردين.`
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Date de l'opération */}
            <div className="space-y-2 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
              <Label htmlFor="date" className="text-slate-800 font-bold text-sm flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-rose-500" />
                {tu('form.operationDateLabel', "Date de l'opération")} <span className="text-rose-500">*</span>
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full h-11 bg-slate-50/80 border-slate-200 focus:ring-2 focus:ring-rose-500 transition-all rounded-xl justify-start text-left font-semibold text-slate-700",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <Calendar className="mr-2 h-4 w-4 text-rose-500" />
                    {date ? formatDateUi(date, { day: '2-digit', month: 'long', year: 'numeric' }) : <span>{tu('form.chooseDate', 'Choisir une date')}</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-2xl shadow-2xl border-none overflow-hidden" align="center">
                  <CalendarComponent
                    mode="single"
                    selected={date}
                    onSelect={(date) => date && setDate(date)}
                    initialFocus
                    className="bg-white p-4"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Note / Détails */}
            <div className="space-y-2 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
              <Label htmlFor="note" className="text-slate-800 font-bold text-sm">
                {tu('form.noteLabel', 'Note / Observations')} <span className="text-xs font-normal text-slate-400">({tr('facultatif', 'اختياري')})</span>
              </Label>
              <Textarea
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={tu('form.notePlaceholder', 'Précisions ou référence sur la dépense...')}
                className="bg-slate-50/80 border-slate-200 focus:ring-2 focus:ring-rose-500 transition-all rounded-xl resize-none min-h-[85px] text-sm"
              />
            </div>

            {/* Live Financial Summary */}
            {amount && parseFloat(amount) > 0 && (
              <div className="p-3.5 bg-gradient-to-r from-rose-50 to-indigo-50/60 rounded-xl border border-rose-100 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center text-rose-700 font-bold">
                    <TrendingDown className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-800 block">
                      {paymentMethod === 'compte_fournisseur' 
                        ? tr(`Débit Compte Fournisseur (${selectedSupplierBank || 'Non spécifié'})`, `خصم من حساب بنك المورد (${selectedSupplierBank || 'غير محدد'})`) 
                        : paymentMethod === 'espece' 
                          ? tr('Débit Caisse (Espèce)', 'خصم من الصندوق (نقدًا)')
                          : paymentMethod === 'cheque' 
                            ? tr('Chèque émis', 'شيك صادر')
                            : tr('Débit Banque Société', 'خصم من الحساب البنكي')}
                    </span>
                    <span className="text-slate-500 text-[11px] font-medium">
                      {expenseType || tr('Charge générale', 'مصروف عام')} {code ? `· ${code}` : ''}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-black text-rose-600 block">
                    -{parseFloat(amount).toFixed(2)} DH
                  </span>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">TTC</span>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-4 bg-white border-t border-slate-100 shrink-0">
            <DialogFooter className="flex gap-2 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDialogOpen(false);
                  resetForm();
                }}
                className="flex-1 sm:flex-none h-11 border-slate-200 font-semibold rounded-xl hover:bg-slate-50 px-5"
              >
                {tu('actions.cancel', 'Annuler')}
              </Button>
              <Button
                onClick={handleAddExpense}
                className="flex-1 sm:flex-none h-11 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 shadow-md hover:shadow-lg transition-all font-bold rounded-xl text-white px-6"
              >
                {expenseToEdit ? (
                  <>
                    <Save className="w-4 h-4 mr-1.5" />
                    {tu('actions.update', 'Mettre à jour')}
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-1.5" />
                    {tu('actions.save', 'Enregistrer la charge')}
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Expenses;
