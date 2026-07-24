

import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useApp } from '@/contexts/AppContext';
import { useT } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import { 
  Download, 
  Edit, 
  Trash2, 
  Check, 
  X, 
  Filter, 
  ArrowRightLeft, 
  Wallet, 
  History, 
  Plus, 
  TrendingUp, 
  TrendingDown, 
  Landmark, 
  Coins, 
  Receipt, 
  CreditCard,
  Calendar,
  Search,
  ChevronDown,
  ArrowUpRight,
  ArrowDownLeft,
  Banknote,
  FileText
} from 'lucide-react';
import { format } from 'date-fns';
import type { BankTransfer, CashOperation, FinancialTransaction } from '@/types';
import FinancialTxCard from '@/components/ui/FinancialTxCard';
import { motion } from 'framer-motion';
const RevenueCommandCenterSection = React.lazy(() => import('@/components/revenue/RevenueCommandCenterSection'));
const RevenueHistoryTab = React.lazy(() => import('@/components/revenue/RevenueHistoryTab'));
const MButton = motion(Button);

const fmtMAD = (n: number, locale = 'fr-MA') =>
  n.toLocaleString(locale, { style: 'currency', currency: 'MAD', minimumFractionDigits: 2 });

const formatAccountName = (acc: string, tr: (fr: string, ar: string) => string = (frText) => frText) => {
  switch (acc?.toLowerCase()) {
    case 'espece': return tr('Espèce', 'نقد');
    case 'cheque': return tr('Chèque', 'شيك');
    case 'banque': return tr('Banque', 'بنك');
    case 'autre': return tr('Autre', 'أخرى');
    default: return acc || tr('-', '-');
  }
};
const inferTransferSupplierFlow = (transfer: Partial<BankTransfer> | null | undefined) => {
  const explicit = String(transfer?.accountDetails || '').trim();
  if (explicit) {
    if (transfer?.type === 'retrait_bancaire') {
      return { sourceSupplierBank: explicit, destinationSupplierBank: '' };
    }
    return { sourceSupplierBank: '', destinationSupplierBank: explicit };
  }

  const lead = String(transfer?.description || '').split('|')[0].trim();
  if (!lead.includes('->')) {
    return { sourceSupplierBank: '', destinationSupplierBank: '' };
  }
  const [leftRaw, rightRaw] = lead.split('->');
  const left = String(leftRaw || '').trim();
  const right = String(rightRaw || '').trim();

  if (transfer?.type === 'banque_a_banque') {
    return { sourceSupplierBank: left, destinationSupplierBank: right };
  }
  if (transfer?.type === 'retrait_bancaire') {
    return { sourceSupplierBank: left, destinationSupplierBank: '' };
  }
  return { sourceSupplierBank: '', destinationSupplierBank: right };
};
const fmtDate = (iso: string, uiLocale = 'fr-MA') => {
  try {
    return new Date(iso).toLocaleDateString(uiLocale);
  } catch {
    return iso;
  }
};

const startOfWeekMonday = (date: Date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return d;
};

type OpRow =
  | {
      kind: 'transfert';
      id: string;
      date: string;
      typeLabel: string;
      description: string;
      amount: number;
      sourceAccount: 'espece' | 'cheque' | 'banque';
      destinationAccount: 'espece' | 'cheque' | 'banque';
      accountDetails?: string;
      status: 'pending' | 'validated';
    }
  | {
      kind: 'operation';
      id: string;
      date: string;
      typeLabel: 'versement' | 'retrait';
      description: string;
      amount: number;
      accountAffected: 'espece' | 'banque' | 'cheque' | 'autre';
      accountDetails?: string;
      status: 'pending' | 'validated';
    };

type RevenueAnomaly = {
  id: string;
  date: string;
  amount: number;
  score: number;
  direction: 'positive' | 'negative';
  label: string;
};

function Revenue() {
  const {
    revenues,
    expenses,
    repairs,
    bankTransfers,
    cashOperations,
    financialTransactions,
    addBankTransfer,
    updateBankTransfer,
    validateBankTransfer,
    deleteBankTransfer,
    addCashOperation,
    updateCashOperation,
    validateCashOperation,
    deleteCashOperation,
    addFinancialTransaction,
    deleteFinancialTransaction,
    getAccountBalance,
    suppliers,
  } = useApp();
  const t = useT();
  const uiLocale = 'fr-MA';
  const tr = (frText: string, _arText: string) => frText;
  const formatCurrency = (n: number) => fmtMAD(n, uiLocale);
  const formatOpType = (type: string) => {
    if (type === 'transfert') return tr('Transfert', 'تحويل');
    if (type === 'versement' || type === 'encaissement') return tr('Versement', 'إيداع');
    if (type === 'retrait') return tr('Retrait', 'سحب');
    if (type === 'dépense') return tr('Dépense', 'مصروف');
    if (type === 'réparation') return tr('Réparation', 'إصلاح');
    return type;
  };
  const formatStatus = (status: string) =>
    status === 'validated' || status === 'completed'
      ? tr('Validé', 'معتمد')
      : status === 'pending'
      ? tr('En attente', 'قيد الانتظار')
      : status;
  const formatDateLocalized = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString(uiLocale);
    } catch {
      return iso;
    }
  };

  // Summary cards
  const soldeEspece = getAccountBalance('espece');
  const soldeCheque = getAccountBalance('cheque');
  const soldeBanque = getAccountBalance('banque');
  const totalDebt = useMemo(() => revenues.reduce((sum, r) => sum + (r.totalDebt || 0), 0), [revenues]);
  const totalExpenses = useMemo(() => {
    const expTotal = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const repairTotal = repairs.reduce((sum, r) => sum + (Number(r.paidAmount) || 0), 0);
    return expTotal + repairTotal;
  }, [expenses, repairs]);
  const montantTotal = useMemo(() => {
    const totalIn = financialTransactions
      .filter(t => t.type === 'encaissement' || t.type === 'versement')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    
    const totalOut = financialTransactions
      .filter(t => t.type === 'retrait' || t.type === 'dépense' || t.type === 'réparation')
      .reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0);

    return totalIn - totalOut;
  }, [financialTransactions]);

  // Transfer modal state
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [transferType, setTransferType] = useState<'versement_espece' | 'remise_cheques' | 'retrait_bancaire' | 'banque_a_banque'>(
    'versement_espece'
  );
  const [transferAmount, setTransferAmount] = useState<string>('');
  const [transferDescription, setTransferDescription] = useState<string>('');
  const [transferSourceSupplierId, setTransferSourceSupplierId] = useState<string>('none');
  const [transferDestinationSupplierId, setTransferDestinationSupplierId] = useState<string>('none');
  const [transferDate, setTransferDate] = useState<string>(() => new Date().toISOString());

  // Cash operation modal state
  const [cashDialogOpen, setCashDialogOpen] = useState(false);
  const [cashName, setCashName] = useState('');
  const [cashAmount, setCashAmount] = useState<string>('');
  const [cashType, setCashType] = useState<'versement' | 'retrait'>('versement');
  const [cashAccount, setCashAccount] = useState<'espece' | 'banque' | 'cheque' | 'autre'>('espece');
  const [cashAccountDetails, setCashAccountDetails] = useState('');
  const [cashSupplierId, setCashSupplierId] = useState<string>('none');
  const [cashDate, setCashDate] = useState<string>(() => new Date().toISOString());

  // Edit dialogs
  const [editTransferOpen, setEditTransferOpen] = useState(false);
  const [editingTransfer, setEditingTransfer] = useState<BankTransfer | null>(null);

  const [editCashOpen, setEditCashOpen] = useState(false);
  const [editingCash, setEditingCash] = useState<CashOperation | null>(null);

  // Filters (shared)
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('all'); // 'all' | 'encaissement' | 'transfert' | 'versement' | 'retrait'
  const [filterAccount, setFilterAccount] = useState<string>('all'); // 'all' | 'espece' | 'banque' | 'cheque' | 'autre'
  const [filterAmountMin, setFilterAmountMin] = useState<string>('');
  const [filterAmountMax, setFilterAmountMax] = useState<string>('');
  const [commandWindow, setCommandWindow] = useState<'7j' | '30j' | '90j' | 'all'>('30j');
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [whatIfDailyIn, setWhatIfDailyIn] = useState<string>('0');
  const [whatIfDailyOut, setWhatIfDailyOut] = useState<string>('0');
  const [whatIfHorizon, setWhatIfHorizon] = useState<'15' | '30' | '60'>('30');
  const [anomalyMode, setAnomalyMode] = useState<'all' | 'positive' | 'negative'>('all');
  const [activeTab, setActiveTab] = useState<'gestion' | 'historique'>('gestion');
  const normalizeAccountText = (value: string) => String(value || '').trim().toLowerCase();
  const supplierBankProfiles = useMemo(
    () =>
      (suppliers || [])
        .map((s: any) => ({
          id: String(s?.id || ''),
          name: String(s?.name || '').trim(),
          bankAccountName: String(s?.bankAccountName || '').trim(),
        }))
        .filter((s) => s.id && s.bankAccountName),
    [suppliers]
  );
  const supplierBankAccounts = useMemo(() => {
    const fromSuppliers = supplierBankProfiles.map((s) => s.bankAccountName).filter(Boolean);
    const fromOps = (cashOperations || [])
      .filter((op: any) => String(op?.accountAffected || '').toLowerCase() === 'banque')
      .map((op: any) => String(op?.accountDetails || '').trim())
      .filter(Boolean);
    const fromFinancial = (financialTransactions || [])
      .map((tx: any) => String(tx?.accountDetails || '').trim())
      .filter(Boolean);
    return Array.from(new Set([...fromSuppliers, ...fromOps, ...fromFinancial])).sort((a, b) => a.localeCompare(b));
  }, [supplierBankProfiles, cashOperations, financialTransactions]);
  const supplierBankSnapshots = useMemo(
    () =>
      supplierBankProfiles
        .map((supplier) => {
          const target = normalizeAccountText(supplier.bankAccountName);
          const seenIds = new Set<string>();
          let totalIn = 0;
          let totalOut = 0;
          let movementCount = 0;

          (cashOperations || []).forEach((op: any) => {
            const status = String(op?.status || '');
            if (status !== 'pending' && status !== 'validated') return;
            if (normalizeAccountText(String(op?.accountAffected || '')) !== 'banque') return;
            if (normalizeAccountText(String(op?.accountDetails || '')) !== target) return;
            const amount = Math.abs(Number(op?.amount) || 0);
            if (!amount) return;
            seenIds.add(String(op?.id ?? ''));
            movementCount += 1;
            if (String(op?.type || '') === 'versement') totalIn += amount;
            else totalOut += amount;
          });

          (bankTransfers || []).forEach((transfer: any) => {
            const status = String(transfer?.status || '');
            if (status !== 'pending' && status !== 'validated') return;
            const inferred = inferTransferSupplierFlow(transfer);
            const source = normalizeAccountText(String(transfer?.sourceAccount || ''));
            const destination = normalizeAccountText(String(transfer?.destinationAccount || ''));
            const amount = Math.abs(Number(transfer?.amount) || 0);
            if (!amount || (source !== 'banque' && destination !== 'banque')) return;
            const sourceSupplierBank = normalizeAccountText(inferred.sourceSupplierBank);
            const destinationSupplierBank = normalizeAccountText(inferred.destinationSupplierBank);
            const matchesSource = !!sourceSupplierBank && sourceSupplierBank === target;
            const matchesDestination = !!destinationSupplierBank && destinationSupplierBank === target;
            if (!matchesSource && !matchesDestination) return;
            seenIds.add(String(transfer?.id ?? ''));
            movementCount += 1;
            if (matchesDestination && destination === 'banque') totalIn += amount;
            if (matchesSource && source === 'banque') totalOut += amount;
          });

          (financialTransactions || []).forEach((tx: any) => {
            const txId = String(tx?.id ?? '');
            if (txId && seenIds.has(txId)) return;
            const status = String(tx?.status || '');
            if (status !== 'pending' && status !== 'completed') return;
            if (normalizeAccountText(String(tx?.accountDetails || '')) !== target) return;
            const source = normalizeAccountText(String(tx?.sourceAccount || ''));
            const destination = normalizeAccountText(String(tx?.destinationAccount || ''));
            const amount = Math.abs(Number(tx?.amount) || 0);
            if (!amount || (source !== 'banque' && destination !== 'banque')) return;
            movementCount += 1;
            if (destination === 'banque') totalIn += amount;
            if (source === 'banque') totalOut += amount;
          });

          return {
            ...supplier,
            movementCount,
            totalIn,
            totalOut,
            balance: totalIn - totalOut,
          };
        })
        .sort((a, b) => b.balance - a.balance),
    [supplierBankProfiles, cashOperations, bankTransfers, financialTransactions]
  );
  const bankTransfersById = useMemo(
    () => new Map(bankTransfers.map((transfer) => [String(transfer.id), transfer])),
    [bankTransfers]
  );
  const cashOperationsById = useMemo(
    () => new Map(cashOperations.map((operation) => [String(operation.id), operation])),
    [cashOperations]
  );

  // Normalize operations for "Gestion de Transfert"
  const opRows: OpRow[] = useMemo(() => {
    return financialTransactions.map((t) => {
      if (t.type === 'transfert') {
        const bt = bankTransfersById.get(String(t.id));
        return {
          kind: 'transfert',
          id: t.id || Math.random().toString(),
          date: t.date,
      typeLabel: tr('Transfert', 'تحويل'),
          description: t.description,
          amount: t.amount,
          sourceAccount: t.sourceAccount as any,
          destinationAccount: t.destinationAccount as any,
          accountDetails: bt?.accountDetails ?? t.accountDetails,
          status: bt?.status || 'validated',
        };
      }
      
      const op = cashOperationsById.get(String(t.id));
      return {
          kind: 'operation',
          id: t.id || Math.random().toString(),
          date: t.date,
          typeLabel: t.type === 'versement' || t.type === 'encaissement' ? 'versement' : 
                     t.type === 'retrait' || t.type === 'dépense' || t.type === 'réparation' ? 'retrait' : 'versement',
          description: t.description,
          amount: Math.abs(t.amount),
          accountAffected: (t.amount >= 0 ? t.destinationAccount : t.sourceAccount) as any,
          accountDetails: t.accountDetails,
          status: op?.status || 'validated',
        };
    }).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [financialTransactions, cashOperationsById, bankTransfersById]);

  const passesDate = (iso: string) => {
    const d = new Date(iso);
    if (filterStartDate && d < new Date(filterStartDate)) return false;
    if (filterEndDate && d > new Date(filterEndDate)) return false;
    return true;
  };
  const passesType = (row: OpRow) => {
    if (filterType === 'all') return true;
    if (filterType === 'transfert') return row.kind === 'transfert';
    if (filterType === 'versement') return row.kind === 'operation' && row.typeLabel === 'versement';
    if (filterType === 'retrait') return row.kind === 'operation' && row.typeLabel === 'retrait';
    if (filterType === 'dépense') return row.kind === 'operation' && row.typeLabel === 'dépense';
    return true;
  };
  const passesAccount = (row: OpRow) => {
    if (filterAccount === 'all') return true;
    if (filterAccount.startsWith('supplier_bank:')) {
      const target = normalizeAccountText(filterAccount.replace('supplier_bank:', ''));
      if (row.kind === 'operation') {
        return normalizeAccountText(String(row.accountDetails || '')) === target && row.accountAffected === 'banque';
      }
      return normalizeAccountText(String(row.accountDetails || '')) === target;
    }
    if (row.kind === 'transfert') {
      return row.sourceAccount === filterAccount || row.destinationAccount === filterAccount;
    }
    if (row.kind === 'operation') {
      return row.accountAffected === filterAccount;
    }
    return true;
  };
  const passesAmount = (amount: number) => {
    const min = filterAmountMin ? parseFloat(filterAmountMin) : null;
    const max = filterAmountMax ? parseFloat(filterAmountMax) : null;
    if (min !== null && amount < min) return false;
    if (max !== null && amount > max) return false;
    return true;
  };

  const filteredOps = useMemo(
    () => opRows.filter((r) => passesDate(r.date) && passesType(r) && passesAccount(r) && passesAmount(r.amount)),
    [opRows, filterStartDate, filterEndDate, filterType, filterAccount, filterAmountMin, filterAmountMax]
  );

  const getRowPriority = (row: OpRow): 'high' | 'medium' | 'low' => {
    if (row.status === 'pending') return 'high';
    if (row.amount >= 12000) return 'high';
    if (row.amount >= 4000) return 'medium';
    return 'low';
  };

  const visibleOps = useMemo(() => {
    if (priorityFilter === 'all') return filteredOps;
    return filteredOps.filter((row) => getRowPriority(row) === priorityFilter);
  }, [filteredOps, priorityFilter]);

  const filteredHistory = useMemo(() => {
    const rows = financialTransactions
      .slice()
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return rows.filter((r) => {
      // Type
      if (filterType !== 'all') {
        if (filterType === 'dépense') {
          if (r.type !== 'dépense' && r.type !== 'réparation') return false;
        } else if (filterType === 'versement') {
          // Group 'versement' and 'encaissement' as they are both incoming money
          if (r.type !== 'versement' && r.type !== 'encaissement') return false;
        } else {
          if (r.type !== filterType) return false;
        }
      }

      // Date
      if (!passesDate(r.date)) return false;

      // Account
      if (filterAccount !== 'all') {
        if (filterAccount.startsWith('supplier_bank:')) {
          const target = normalizeAccountText(filterAccount.replace('supplier_bank:', ''));
          const detailsMatch = normalizeAccountText(String((r as any).accountDetails || '')) === target;
          if (!detailsMatch) return false;
        } else {
          const affected = [r.sourceAccount, r.destinationAccount].filter(Boolean);
          if (affected.length > 0 && !affected.includes(filterAccount)) return false;
        }
      }

      // Amount
      return passesAmount(r.amount);
    });
  }, [financialTransactions, filterType, filterStartDate, filterEndDate, filterAccount, filterAmountMin, filterAmountMax]);

  const applyCommandFocus = (mode: 'pending' | 'inflow' | 'outflow' | 'reset') => {
    if (mode === 'pending') {
      setPriorityFilter('high');
      return;
    }
    if (mode === 'inflow') {
      setFilterType('versement');
      setPriorityFilter('all');
      return;
    }
    if (mode === 'outflow') {
      setFilterType('retrait');
      setPriorityFilter('medium');
      return;
    }
    setPriorityFilter('all');
    setFilterType('all');
    setFilterAccount('all');
    setFilterAmountMin('');
    setFilterAmountMax('');
  };

  const applyForecastFocus = (account: 'espece' | 'banque' | 'cheque', risk: 'high' | 'medium' | 'low') => {
    setFilterAccount(account);
    if (risk === 'high') {
      setPriorityFilter('high');
      return;
    }
    if (risk === 'medium') {
      setPriorityFilter('medium');
      return;
    }
    setPriorityFilter('low');
  };

  const applyHeatmapFocus = (start: Date, end: Date, trend: 'up' | 'down') => {
    setFilterStartDate(format(start, 'yyyy-MM-dd'));
    setFilterEndDate(format(end, 'yyyy-MM-dd'));
    if (trend === 'up') {
      setFilterType('versement');
      return;
    }
    setFilterType('retrait');
  };

  const applyAnomalyFocus = (anomaly: RevenueAnomaly) => {
    const date = new Date(anomaly.date);
    const from = new Date(date);
    const to = new Date(date);
    from.setDate(from.getDate() - 3);
    to.setDate(to.getDate() + 3);
    setFilterStartDate(format(from, 'yyyy-MM-dd'));
    setFilterEndDate(format(to, 'yyyy-MM-dd'));
    setFilterType(anomaly.direction === 'positive' ? 'versement' : 'retrait');
    setPriorityFilter(Math.abs(anomaly.score) >= 2 ? 'high' : 'medium');
  };

  const applyAutopilot = (mode: 'protect' | 'accelerate' | 'balance') => {
    if (mode === 'protect') {
      setCommandWindow('30j');
      setFilterType('retrait');
      setPriorityFilter('high');
      setWhatIfDailyIn('300');
      setWhatIfDailyOut('900');
      setWhatIfHorizon('30');
      return;
    }
    if (mode === 'accelerate') {
      setCommandWindow('90j');
      setFilterType('versement');
      setPriorityFilter('medium');
      setWhatIfDailyIn('1200');
      setWhatIfDailyOut('450');
      setWhatIfHorizon('60');
      return;
    }
    setCommandWindow('30j');
    setFilterType('all');
    setFilterAccount('all');
    setPriorityFilter('all');
    setFilterStartDate('');
    setFilterEndDate('');
    setWhatIfDailyIn('0');
    setWhatIfDailyOut('0');
    setWhatIfHorizon('30');
  };

  // Submit transfer
  const handleSubmitTransfer = async () => {
    const amount = parseFloat(transferAmount);
    if (!amount || amount <= 0) {
      toast.error(tr('Veuillez saisir un montant valide', 'يرجى إدخال مبلغ صالح'));
      return;
    }
    let source: BankTransfer['sourceAccount'] = 'espece';
    let dest: BankTransfer['destinationAccount'] = 'banque';
    let finalDescription = transferDescription.trim();
    let accountDetails: string | undefined;
    if (transferType === 'versement_espece') {
      source = 'espece';
      dest = 'banque';
      if (transferDestinationSupplierId !== 'none') {
        const destinationSupplier = supplierBankProfiles.find((s) => s.id === transferDestinationSupplierId);
        if (!destinationSupplier) {
          toast.error(tr('Veuillez choisir un compte fournisseur valide', 'يرجى اختيار حساب مورد صالح'));
          return;
        }
        accountDetails = destinationSupplier.bankAccountName;
        const flowLabel = `${tr('Versement Espèce', 'إيداع نقدي')} -> ${destinationSupplier.bankAccountName}`;
        finalDescription = finalDescription ? `${flowLabel} | ${finalDescription}` : flowLabel;
      }
    } else if (transferType === 'remise_cheques') {
      source = 'cheque';
      dest = 'banque';
    } else if (transferType === 'retrait_bancaire') {
      source = 'banque';
      dest = 'espece';
    } else {
      const sourceSupplier = supplierBankProfiles.find((s) => s.id === transferSourceSupplierId);
      const destinationSupplier = supplierBankProfiles.find((s) => s.id === transferDestinationSupplierId);
      if (!sourceSupplier || !destinationSupplier) {
        toast.error(tr('Veuillez choisir les deux comptes fournisseurs', 'يرجى اختيار حسابي المورّد (المصدر والوجهة)'));
        return;
      }
      if (sourceSupplier.id === destinationSupplier.id) {
        toast.error(tr('Le compte source et destination doivent être différents', 'يجب أن يكون حساب المصدر مختلفا عن حساب الوجهة'));
        return;
      }
      source = 'banque';
      dest = 'banque';
      const flowLabel = `${sourceSupplier.bankAccountName} -> ${destinationSupplier.bankAccountName}`;
      finalDescription = finalDescription ? `${flowLabel} | ${finalDescription}` : flowLabel;
    }

    const id = (crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));
    const saved = await addBankTransfer({
      id,
      date: transferDate,
      type: transferType,
      sourceAccount: source,
      destinationAccount: dest,
      accountDetails,
      amount,
      description: finalDescription,
      status: 'pending',
    });
    if (!saved) {
      toast.error(tr('Le transfert n’a pas été enregistré dans Supabase', 'لم يتم حفظ التحويل في Supabase'));
      return;
    }
    // Validation immédiate بعد تأكيد الحفظ لتفادي سباق create/update.
    await validateBankTransfer(id);

    toast.success(tr('تم تسجيل التحويل واعتماده', 'تم تسجيل التحويل واعتماده'));
    setTransferDialogOpen(false);
    setTransferAmount('');
    setTransferDescription('');
    setTransferSourceSupplierId('none');
    setTransferDestinationSupplierId('none');
    setTransferDate(new Date().toISOString());
    setTransferType('versement_espece');
  };

  // Submit cash operation
  const handleSubmitCash = () => {
    const amount = parseFloat(cashAmount);
    if (!cashName.trim() || !amount || amount <= 0) {
      toast.error(tr('Veuillez renseigner le libellé et un montant valide', 'يرجى إدخال الوصف ومبلغ صالح'));
      return;
    }
    if (cashAccount === 'banque' && !cashAccountDetails.trim()) {
      toast.error(tr('Veuillez sélectionner un compte banque fournisseur', 'يرجى اختيار الحساب البنكي للمورّد'));
      return;
    }

    addCashOperation({
      date: cashDate,
      name: cashName.trim(),
      amount,
      type: cashType,
      accountAffected: cashAccount,
      accountDetails: cashAccountDetails.trim() || undefined,
      status: 'pending',
    });

    toast.success(tr('Opération de caisse enregistrée (en attente de validation)', 'تم تسجيل عملية الصندوق (في انتظار الاعتماد)'));
    setCashDialogOpen(false);
    setCashName('');
    setCashAmount('');
    setCashType('versement');
    setCashAccount('espece');
    setCashAccountDetails('');
    setCashSupplierId('none');
    setCashDate(new Date().toISOString());
  };

  // Edit transfer
  const openEditTransfer = (t: BankTransfer) => {
    setEditingTransfer(t);
    setEditTransferOpen(true);
  };
  const handleUpdateTransfer = () => {
    if (!editingTransfer) return;
    if (editingTransfer.amount <= 0) {
      toast.error(tr('Montant invalide', 'مبلغ غير صالح'));
      return;
    }
    // Ensure source/destination reflect type
    let source: BankTransfer['sourceAccount'] = 'espece';
    let dest: BankTransfer['destinationAccount'] = 'banque';
    if (editingTransfer.type === 'versement_espece') {
      source = 'espece';
      dest = 'banque';
    } else if (editingTransfer.type === 'remise_cheques') {
      source = 'cheque';
      dest = 'banque';
    } else if (editingTransfer.type === 'retrait_bancaire') {
      source = 'banque';
      dest = 'espece';
    } else {
      source = 'banque';
      dest = 'banque';
    }

    updateBankTransfer(editingTransfer.id, {
      type: editingTransfer.type,
      amount: editingTransfer.amount,
      description: editingTransfer.description,
      date: editingTransfer.date,
      sourceAccount: source,
      destinationAccount: dest,
    });
    setEditTransferOpen(false);
    setEditingTransfer(null);
    toast.success(tr('Transfert mis à jour', 'تم تحديث التحويل'));
  };

  // Edit cash op
  const openEditCash = (o: CashOperation) => {
    setEditingCash(o);
    setEditCashOpen(true);
  };
  const handleUpdateCash = () => {
    if (!editingCash) return;
    if (editingCash.amount <= 0 || !editingCash.name.trim()) {
      toast.error(tr('Libellé ou montant invalide', 'الوصف أو المبلغ غير صالح'));
      return;
    }
    if (editingCash.accountAffected === 'banque' && !String(editingCash.accountDetails || '').trim()) {
      toast.error(tr('Veuillez sélectionner un compte banque fournisseur', 'يرجى اختيار الحساب البنكي للمورّد'));
      return;
    }
    updateCashOperation(editingCash.id, {
      name: editingCash.name,
      amount: editingCash.amount,
      type: editingCash.type,
      date: editingCash.date,
      accountAffected: editingCash.accountAffected,
      accountDetails: editingCash.accountDetails,
    });
    setEditCashOpen(false);
    setEditingCash(null);
    toast.success(tr('Opération mise à jour', 'تم تحديث العملية'));
  };

  // Validate logic
  const handleValidateTransfer = (t: BankTransfer) => {
    validateBankTransfer(t.id);

    if (t.type === 'remise_cheques') {
      // Historiser la régularisation de remise de chèques
      addFinancialTransaction({
        date: new Date().toISOString(),
        type: 'transfert',
        description: tr('Régularisation: chèques déposés à la banque', 'تسوية: إيداع الشيكات في البنك'),
        amount: t.amount,
        sourceAccount: 'cheque',
        destinationAccount: 'banque',
        status: 'completed',
        createdAt: new Date().toISOString(),
      });
    }

    toast.success(tr('Transfert validé', 'تم اعتماد التحويل'));
  };

  const handleValidateCash = (o: CashOperation) => {
    validateCashOperation(o.id);
    toast.success(tr('Opération validée', 'تم اعتماد العملية'));
  };

  // Delete
  const handleDeleteOperation = (id: string) => {
    deleteFinancialTransaction(id);
    toast.success(tr('Opération supprimée', 'تم حذف العملية'));
  };

  const exportOpsToPDF = () => {
    // Ouvre une fenêtre imprimable; l’utilisateur peut enregistrer en PDF
    const w = window.open('', '_blank');
    if (!w) return;
    const rowsHtml = filteredOps
      .map((r) => {
        if (r.kind === 'transfert') {
          return `<tr>
            <td>${fmtDate(r.date, uiLocale)}</td>
            <td>${r.typeLabel}</td>
            <td>${r.description || ''}</td>
            <td>${fmtMAD(r.amount, uiLocale)}</td>
            <td>${formatAccountName(r.sourceAccount, tr)} → ${formatAccountName(r.destinationAccount, tr)}</td>
            <td>${formatStatus(r.status)}</td>
          </tr>`;
        }
        return `<tr>
          <td>${fmtDate(r.date, uiLocale)}</td>
          <td>${r.typeLabel}</td>
          <td>${r.description || ''}</td>
          <td>${fmtMAD(r.amount, uiLocale)}</td>
          <td>${r.accountAffected === 'autre' && r.accountDetails ? `${tr('Autre', 'أخرى')} (${r.accountDetails})` : formatAccountName(r.accountAffected, tr)}</td>
          <td>${formatStatus(r.status)}</td>
        </tr>`;
      })
      .join('');
    w.document.write(`
      <html>
        <head>
          <title>${tr('Export - Gestion de Transfert', 'تصدير - إدارة التحويلات')}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; }
            h1 { font-size: 18px; margin-bottom: 12px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #888; padding: 6px 8px; font-size: 12px; }
            th { background: #f0f0f0; text-align: left; }
          </style>
        </head>
        <body>
            <h1>${tr('Gestion de Transfert - Export (filtres appliqués)', 'إدارة التحويلات - تصدير (فلاتر مطبقة)')}</h1>
          <table>
            <thead>
              <tr>
                <th>${tr('Date', 'التاريخ')}</th><th>${tr('Type', 'النوع')}</th><th>${tr('Description', 'الوصف')}</th><th>${tr('Montant', 'المبلغ')}</th><th>${tr('Compte(s)', 'الحساب/الحسابات')}</th><th>${tr('Statut', 'الحالة')}</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </body>
      </html>
    `);
    w.document.close();
    w.focus();
    w.print();
  };

  const exportHistoryToPDF = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    const rowsHtml = filteredHistory
      .map(
        (r) => {
          const source = r.sourceAccount === 'autre' && r.accountDetails ? `${tr('Autre', 'أخرى')} (${r.accountDetails})` : formatAccountName(r.sourceAccount || '', tr);
          const dest = r.destinationAccount === 'autre' && r.accountDetails ? `${tr('Autre', 'أخرى')} (${r.accountDetails})` : formatAccountName(r.destinationAccount || '', tr);
          const accounts = [source, dest].filter(Boolean).join(' → ') || '-';
          
          return `<tr>
            <td>${fmtDate(r.date, uiLocale)}</td>
            <td>${formatOpType(r.type)}</td>
            <td>${r.description || ''}</td>
            <td>${fmtMAD(r.amount, uiLocale)}</td>
            <td>${accounts}</td>
            <td>${formatStatus(r.status)}</td>
          </tr>`;
        }
      )
      .join('');
    w.document.write(`
      <html>
        <head>
          <title>${tr('Export - Historique Financier', 'تصدير - السجل المالي')}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; }
            h1 { font-size: 18px; margin-bottom: 12px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #888; padding: 6px 8px; font-size: 12px; }
            th { background: #f0f0f0; text-align: left; }
          </style>
        </head>
        <body>
          <h1>${tr('Historique Financier - Export (filtres appliqués)', 'السجل المالي - تصدير (فلاتر مطبقة)')}</h1>
          <table>
            <thead>
              <tr>
                <th>${tr('Date', 'التاريخ')}</th><th>${tr('Type', 'النوع')}</th><th>${tr('Description', 'الوصف')}</th><th>${tr('Montant', 'المبلغ')}</th><th>${tr('Compte(s)', 'الحساب/الحسابات')}</th><th>${tr('Statut', 'الحالة')}</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </body>
      </html>
    `);
    w.document.close();
    w.focus();
    w.print();
  };

  const revenueSectionFallback = (
    <Card className="border-none shadow-sm bg-white overflow-hidden">
      <CardContent className="p-8 text-sm text-slate-500">
        {t('revenue.loading.section', 'Chargement de la section...')}
      </CardContent>
    </Card>
  );

  return (
    <div className="app-page-shell flex-1 space-y-6 p-4 md:p-8 pt-6 bg-slate-50/30">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="app-page-title text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-lg">
              <Landmark className="h-6 w-6 text-white" />
            </div>
            {t('revenue.title', 'Revenus & Trésorerie')}
          </h2>
          <p className="app-page-subtitle text-slate-500 mt-1">
            {t('revenue.subtitle', 'Vue globale et gestion des flux financiers')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button 
            className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all flex items-center gap-2"
            onClick={() => setTransferDialogOpen(true)}
          >
            <ArrowRightLeft className="h-4 w-4" />
            {t('revenue.bankTransfer', 'Transfert Bancaire')}
          </Button>
          <Button 
            variant="outline" 
            className="border-blue-200 hover:bg-blue-50 text-blue-700 shadow-sm transition-all flex items-center gap-2"
            onClick={() => setCashDialogOpen(true)}
          >
            <Wallet className="h-4 w-4" />
            {t('revenue.cashOperation', 'Opération de Caisse')}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Card className="border-none shadow-sm bg-white overflow-hidden group hover:shadow-md transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">{t('revenue.accounts.espece', 'Caisse (Espèce)')}</CardTitle>
            <div className="p-2 bg-emerald-50 rounded-full group-hover:bg-emerald-100 transition-colors">
              <Coins className="h-4 w-4 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{formatCurrency(soldeEspece)}</div>
            <div className="flex items-center mt-1 text-xs text-emerald-600 font-medium">
              <ArrowDownLeft className="h-3 w-3 mr-1" />
              {t('revenue.accounts.especeAvail', 'Disponible en espèce')}
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white overflow-hidden group hover:shadow-md transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">{t('revenue.accounts.banque', 'Banque')}</CardTitle>
            <div className="p-2 bg-blue-50 rounded-full group-hover:bg-blue-100 transition-colors">
              <Landmark className="h-4 w-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{formatCurrency(soldeBanque)}</div>
            <div className="flex items-center mt-1 text-xs text-blue-600 font-medium">
              <Check className="h-3 w-3 mr-1" />
              {t('revenue.accounts.banqueAvail', 'Solde bancaire')}
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              {tr('Comptes fournisseurs', 'حسابات الموردين')}: {supplierBankAccounts.length}
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white overflow-hidden group hover:shadow-md transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">{t('revenue.accounts.cheque', 'Chèques (Portefeuille)')}</CardTitle>
            <div className="p-2 bg-indigo-50 rounded-full group-hover:bg-indigo-100 transition-colors">
              <CreditCard className="h-4 w-4 text-indigo-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{formatCurrency(soldeCheque)}</div>
            <div className="flex items-center mt-1 text-xs text-indigo-600 font-medium">
              <History className="h-3 w-3 mr-1" />
              {t('revenue.accounts.chequeAvail', 'Valeur des chèques')}
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white overflow-hidden group hover:shadow-md transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">{t('revenue.cards.debt', 'Dettes Fournisseurs')}</CardTitle>
            <div className="p-2 bg-amber-50 rounded-full group-hover:bg-amber-100 transition-colors">
              <Receipt className="h-4 w-4 text-amber-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{formatCurrency(totalDebt)}</div>
            <div className="flex items-center mt-1 text-xs text-amber-600 font-medium">
              <TrendingUp className="h-3 w-3 mr-1" />
              {tr('Total des créances', 'إجمالي المستحقات')}
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white overflow-hidden group hover:shadow-md transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">{t('revenue.cards.expenses', 'Dépenses & Charges')}</CardTitle>
            <div className="p-2 bg-rose-50 rounded-full group-hover:bg-rose-100 transition-colors">
              <TrendingDown className="h-4 w-4 text-rose-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{formatCurrency(totalExpenses)}</div>
            <div className="flex items-center mt-1 text-xs text-rose-600 font-medium">
              <ArrowUpRight className="h-3 w-3 mr-1" />
              {tr('Cumul des sorties', 'إجمالي التدفقات الخارجة')}
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white overflow-hidden group hover:shadow-md transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">{tr('Solde Net', 'الرصيد الصافي')}</CardTitle>
            <div className="p-2 bg-violet-50 rounded-full group-hover:bg-violet-100 transition-colors">
              <Wallet className="h-4 w-4 text-violet-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{formatCurrency(montantTotal)}</div>
            <div className="flex items-center mt-1 text-xs text-violet-600 font-medium">
              <Coins className="h-3 w-3 mr-1" />
              {tr('Balance globale', 'الرصيد العام')}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-sm bg-white overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-semibold text-slate-800">
                {tr('Comptes Bancaires Fournisseurs', 'الحسابات البنكية للموردين')}
              </CardTitle>
              <p className="text-xs text-slate-500 mt-1">
                {tr('Suivi du solde par compte fournisseur', 'تتبع الرصيد لكل حساب مورد')}
              </p>
            </div>
            <Badge variant="outline" className="border-slate-200 text-slate-700">
              {tr('Comptes suivis', 'الحسابات المتابعة')}: {supplierBankSnapshots.length}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {supplierBankSnapshots.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">
              {tr('Aucun compte fournisseur configuré.', 'لا توجد حسابات موردين مضبوطة.')}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {supplierBankSnapshots.map((item) => (
                <button
                  key={`supplier-bank-snapshot-${item.id}`}
                  type="button"
                  onClick={() => setFilterAccount(`supplier_bank:${item.bankAccountName}`)}
                  className="text-left rounded-xl border border-slate-200 bg-slate-50 p-3 hover:bg-white transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-bold text-slate-800 truncate">{item.name || tr('Fournisseur', 'مورد')}</p>
                    <Badge className="bg-slate-100 text-slate-700 border-none">{item.movementCount}</Badge>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500 truncate">{item.bankAccountName}</p>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
                    <div className="rounded-lg bg-emerald-50 p-2">
                      <p className="text-emerald-600">{tr('Entrées', 'المداخل')}</p>
                      <p className="font-bold text-emerald-700">{formatCurrency(item.totalIn)}</p>
                    </div>
                    <div className="rounded-lg bg-rose-50 p-2">
                      <p className="text-rose-600">{tr('Sorties', 'المخارج')}</p>
                      <p className="font-bold text-rose-700">{formatCurrency(item.totalOut)}</p>
                    </div>
                    <div className="rounded-lg bg-indigo-50 p-2">
                      <p className="text-indigo-600">{tr('Solde', 'الرصيد')}</p>
                      <p className={`font-bold ${item.balance >= 0 ? 'text-indigo-700' : 'text-rose-700'}`}>{formatCurrency(item.balance)}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <React.Suspense fallback={revenueSectionFallback}>
        <RevenueCommandCenterSection
          t={t}
          tr={tr}
          uiLocale={uiLocale}
          opRows={opRows}
          financialTransactions={financialTransactions}
          soldeEspece={soldeEspece}
          soldeBanque={soldeBanque}
          soldeCheque={soldeCheque}
          commandWindow={commandWindow}
          setCommandWindow={setCommandWindow}
          whatIfDailyIn={whatIfDailyIn}
          setWhatIfDailyIn={setWhatIfDailyIn}
          whatIfDailyOut={whatIfDailyOut}
          setWhatIfDailyOut={setWhatIfDailyOut}
          whatIfHorizon={whatIfHorizon}
          setWhatIfHorizon={setWhatIfHorizon}
          anomalyMode={anomalyMode}
          setAnomalyMode={setAnomalyMode}
          formatCurrency={formatCurrency}
          formatDateLocalized={formatDateLocalized}
          formatOpType={formatOpType}
          formatAccountName={formatAccountName}
          applyCommandFocus={applyCommandFocus}
          applyForecastFocus={applyForecastFocus}
          applyHeatmapFocus={applyHeatmapFocus}
          applyAnomalyFocus={applyAnomalyFocus}
          applyAutopilot={applyAutopilot}
        />
      </React.Suspense>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'gestion' | 'historique')} className="w-full space-y-4">
        <TabsList className="bg-white border p-1 shadow-sm">
          <TabsTrigger value="gestion" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            <ArrowRightLeft className="mr-2 h-4 w-4" />
            {t('revenue.tabs.gestion', 'Gestion')}
          </TabsTrigger>
          <TabsTrigger value="historique" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            <History className="mr-2 h-4 w-4" />
            {t('revenue.tabs.historique', 'Historique')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="gestion" className="space-y-4">
          <Card className="border-none shadow-sm overflow-hidden">
            <CardHeader className="bg-white border-b py-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-semibold text-slate-800">{t('revenue.management.title', 'Gestion des Flux')}</CardTitle>
                  <p className="text-sm text-slate-500">{t('revenue.management.subtitle', 'Suivi des opérations et transferts')}</p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="text-blue-600 border-blue-200 hover:bg-blue-50"
                  onClick={exportOpsToPDF}
                >
                  <Download className="mr-2 h-4 w-4" />
                  {t('revenue.management.exportPdf', 'Exporter PDF')}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {/* Filters Section */}
              <div className="p-4 bg-slate-50/50 border-b grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('revenue.filters.period', 'Période')}</Label>
                  <div className="flex items-center gap-2">
                    <Input 
                      type="date" 
                      className="h-9 text-sm"
                      value={filterStartDate} 
                      onChange={(e) => setFilterStartDate(e.target.value)} 
                    />
                    <span className="text-slate-400">{t('revenue.filters.to', 'à')}</span>
                    <Input 
                      type="date" 
                      className="h-9 text-sm"
                      value={filterEndDate} 
                      onChange={(e) => setFilterEndDate(e.target.value)} 
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('revenue.filters.type', 'Type')}</Label>
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder={t('revenue.filters.allTypes', 'Tous les types')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('revenue.filters.allTypes', 'Tous les types')}</SelectItem>
                      <SelectItem value="transfert">{t('revenue.table.transfert', 'Transfert')}</SelectItem>
                      <SelectItem value="versement">{t('revenue.types.versement', 'Versement')}</SelectItem>
                      <SelectItem value="retrait">{t('revenue.types.retrait', 'Retrait')}</SelectItem>
                      <SelectItem value="dépense">{t('revenue.types.depense', 'Dépense')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('revenue.filters.account', 'Compte')}</Label>
                  <Select value={filterAccount} onValueChange={setFilterAccount}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder={t('revenue.filters.allAccounts', 'Tous les comptes')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('revenue.filters.allAccounts', 'Tous les comptes')}</SelectItem>
                      <SelectItem value="espece">{tr('Espèce', 'نقد')}</SelectItem>
                      <SelectItem value="cheque">{tr('Chèque', 'شيك')}</SelectItem>
                      <SelectItem value="banque">{tr('Banque', 'بنك')}</SelectItem>
                      {supplierBankAccounts.map((account) => (
                        <SelectItem key={`mgmt-${account}`} value={`supplier_bank:${account}`}>
                          {tr('Banque fournisseur', 'بنك المورّد')}: {account}
                        </SelectItem>
                      ))}
                      <SelectItem value="autre">{tr('Autre', 'أخرى')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5 lg:col-span-2">
                  <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('revenue.filters.amountRange', 'Montant')}</Label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">{t('revenue.filters.min', 'Min')}</span>
                      <Input 
                        className="h-9 pl-10 text-sm"
                        placeholder="0.00"
                        value={filterAmountMin} 
                        onChange={(e) => setFilterAmountMin(e.target.value)} 
                      />
                    </div>
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">{t('revenue.filters.max', 'Max')}</span>
                      <Input 
                        className="h-9 pl-10 text-sm"
                        placeholder="999..."
                        value={filterAmountMax} 
                        onChange={(e) => setFilterAmountMax(e.target.value)} 
                      />
                    </div>
                  </div>
                </div>
                <div className="lg:col-span-5 flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="border-slate-200 text-slate-600 bg-white">
                    {t('revenue.intelligence.priority', 'Priorité')}: {priorityFilter === 'all' ? tr('Toutes', 'الكل') : priorityFilter === 'high' ? tr('Critique', 'حرج') : priorityFilter === 'medium' ? tr('Surveillance', 'مراقبة') : tr('Stable', 'مستقر')}
                  </Badge>
                  <Badge variant="outline" className="border-slate-200 text-slate-600 bg-white">
                    {t('revenue.intelligence.window', 'Fenêtre')}: {commandWindow === 'all' ? t('revenue.window.all', 'Tout') : commandWindow}
                  </Badge>
                  <Badge variant="outline" className="border-slate-200 text-slate-600 bg-white">
                    {tr('Radar', 'الرادار')}: {anomalyMode === 'all' ? tr('Tous signaux', 'كل الإشارات') : anomalyMode === 'positive' ? tr('Entrées atypiques', 'مداخل غير اعتيادية') : tr('Sorties atypiques', 'مخارج غير اعتيادية')}
                  </Badge>
                </div>
              </div>

              {/* Table Section */}
              <div className="smart-scroll-x hidden md:block">
                <Table className="smart-table">
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="font-semibold text-slate-700">{t('revenue.table.date', 'Date')}</TableHead>
                      <TableHead className="font-semibold text-slate-700">{t('revenue.table.operation', 'Opération')}</TableHead>
                      <TableHead className="font-semibold text-slate-700">{t('revenue.table.details', 'Détails')}</TableHead>
                      <TableHead className="font-semibold text-slate-700">{t('revenue.table.amount', 'Montant')}</TableHead>
                      <TableHead className="font-semibold text-slate-700">{t('revenue.table.flowAccount', 'Compte Flux')}</TableHead>
                      <TableHead className="font-semibold text-slate-700">{t('revenue.table.status', 'Statut')}</TableHead>
                      <TableHead className="text-right font-semibold text-slate-700">{t('revenue.table.actions', 'Actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleOps.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-32 text-center text-slate-500">
                          <div className="flex flex-col items-center justify-center">
                            <Filter className="h-8 w-8 text-slate-300 mb-2" />
                            <p>{t('revenue.table.noResults', 'Aucun résultat')}</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      visibleOps.map((r) => (
                        <TableRow key={`${r.kind}-${r.id}`} className="hover:bg-slate-50/50 transition-colors">
                          <TableCell className="font-medium text-slate-700">{formatDateLocalized(r.date)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {r.kind === 'transfert' ? (
                                <div className="p-1.5 bg-blue-50 rounded text-blue-600">
                                  <ArrowRightLeft className="h-3.5 w-3.5" />
                                </div>
                              ) : (
                                <div className={`p-1.5 rounded ${r.typeLabel === 'versement' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                  {r.typeLabel === 'versement' ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                                </div>
                              )}
                              <span className="text-sm font-medium">{formatOpType(r.typeLabel)}</span>
                            </div>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate text-slate-600 text-sm">
                            {r.description || '-'}
                          </TableCell>
                          <TableCell className={`font-bold ${r.amount >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {formatCurrency(Number(r.amount) || 0)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
                              {r.kind === 'transfert' ? (
                                <>
                                  <Badge variant="outline" className="border-slate-200">{formatAccountName(r.sourceAccount, tr)}</Badge>
                                  <ArrowRightLeft className="h-3 w-3 text-slate-400" />
                                  <Badge variant="outline" className="border-slate-200 bg-slate-50">{formatAccountName(r.destinationAccount, tr)}</Badge>
                                </>
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  {/* Determine if it's an entry or exit to show the flow correctly */}
                                  {r.typeLabel === 'versement' ? (
                                    <>
                                      <Badge variant="outline" className="border-slate-200 bg-slate-50/50">
                                        {r.accountDetails ? `${tr('Autre', 'أخرى')} (${r.accountDetails})` : tr('Autre', 'أخرى')}
                                      </Badge>
                                      <ArrowRightLeft className="h-3 w-3 text-slate-400" />
                                      <Badge variant="outline" className="border-slate-200 font-bold">
                                        {formatAccountName(r.accountAffected, tr)}
                                      </Badge>
                                    </>
                                  ) : (
                                    <>
                                      <Badge variant="outline" className="border-slate-200 font-bold">
                                        {formatAccountName(r.accountAffected, tr)}
                                      </Badge>
                                      <ArrowRightLeft className="h-3 w-3 text-slate-400" />
                                      <Badge variant="outline" className="border-slate-200 bg-slate-50/50">
                                        {r.accountDetails ? `${tr('Autre', 'أخرى')} (${r.accountDetails})` : tr('Autre', 'أخرى')}
                                      </Badge>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={r.status === 'validated' ? 'bg-emerald-100 text-emerald-700 border-none' : 'bg-amber-100 text-amber-700 border-none'}>
                              {formatStatus(r.status)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              {r.status === 'pending' ? (
                                <>
                                  <MButton
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-blue-600 hover:bg-blue-50 btn-haptic relative"
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => {
                                      if (r.kind === 'transfert') {
                                        openEditTransfer(bankTransfersById.get(String(r.id))!);
                                      } else {
                                        openEditCash(cashOperationsById.get(String(r.id))!);
                                      }
                                    }}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </MButton>
                                  <MButton
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-emerald-600 hover:bg-emerald-50 btn-haptic relative"
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => {
                                      if (r.kind === 'transfert') {
                                        handleValidateTransfer(bankTransfersById.get(String(r.id))!);
                                      } else {
                                        handleValidateCash(cashOperationsById.get(String(r.id))!);
                                      }
                                    }}
                                  >
                                    <Check className="h-4 w-4" />
                                  </MButton>
                                  <MButton
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-rose-600 hover:bg-rose-50 btn-haptic relative"
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => handleDeleteOperation(r.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </MButton>
                                </>
                              ) : (
                                <MButton
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-rose-600 hover:bg-rose-50 btn-haptic relative"
                                  whileTap={{ scale: 0.96 }}
                                  onClick={() => handleDeleteOperation(r.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </MButton>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              <div className="md:hidden grid grid-cols-1 gap-2 p-3">
                {filteredHistory.map((r: FinancialTransaction) => (
                  <FinancialTxCard
                    key={r.id}
                    tx={r}
                    formatDate={(iso) => new Date(iso).toLocaleDateString(uiLocale)}
                    formatAmount={(n) => formatCurrency(n)}
                    formatAccountName={(acc) => formatAccountName(acc || '', tr)}
                    labelMap={(type) => formatOpType(type)}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historique" className="space-y-4">
          <React.Suspense fallback={revenueSectionFallback}>
            <RevenueHistoryTab
              t={t}
              tr={tr}
              supplierBankAccounts={supplierBankAccounts}
              filterStartDate={filterStartDate}
              setFilterStartDate={setFilterStartDate}
              filterEndDate={filterEndDate}
              setFilterEndDate={setFilterEndDate}
              filterType={filterType}
              setFilterType={setFilterType}
              filterAccount={filterAccount}
              setFilterAccount={setFilterAccount}
              filterAmountMin={filterAmountMin}
              setFilterAmountMin={setFilterAmountMin}
              filterAmountMax={filterAmountMax}
              setFilterAmountMax={setFilterAmountMax}
              filteredHistory={filteredHistory}
              formatDateLocalized={formatDateLocalized}
              formatOpType={formatOpType}
              formatCurrency={formatCurrency}
              formatAccountName={formatAccountName}
              formatStatus={formatStatus}
              exportHistoryToPDF={exportHistoryToPDF}
            />
          </React.Suspense>
        </TabsContent>
      </Tabs>

      {/* Modals - Modernized */}
      <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none shadow-2xl">
          <div className="bg-blue-600 p-6 text-white">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <ArrowRightLeft className="h-5 w-5 text-blue-200" />
                {t('revenue.transfer.newTransfer', 'Nouveau Transfert')}
              </DialogTitle>
              <p className="text-blue-100 text-sm mt-1">{t('revenue.transfer.subtitle', 'Déplacer des fonds entre les comptes')}</p>
            </DialogHeader>
          </div>
          <div className="p-6 space-y-4 bg-white">
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label className="text-slate-700 font-medium">{t('revenue.transfer.type', 'Type de Transfert')}</Label>
                <Select
                  value={transferType}
                  onValueChange={(v) => {
                    const next = v as 'versement_espece' | 'remise_cheques' | 'retrait_bancaire' | 'banque_a_banque';
                    setTransferType(next);
                    if (next !== 'banque_a_banque') {
                      setTransferSourceSupplierId('none');
                    }
                    if (next !== 'banque_a_banque' && next !== 'versement_espece') {
                      setTransferDestinationSupplierId('none');
                    }
                  }}
                >
                  <SelectTrigger className="border-slate-200 focus:ring-blue-500">
                    <SelectValue placeholder={t('revenue.transfer.chooseType', 'Choisir le type')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="versement_espece">{t('revenue.transfer.depositCash', 'Versement Espèce -> Banque')}</SelectItem>
                    <SelectItem value="remise_cheques">{t('revenue.transfer.chequeDeposit', 'Remise Chèque -> Banque')}</SelectItem>
                    <SelectItem value="retrait_bancaire">{t('revenue.transfer.bankWithdrawal', 'Retrait Banque -> Espèce')}</SelectItem>
                    <SelectItem value="banque_a_banque">{tr('Banque fournisseur -> Banque fournisseur', 'بنك مورد -> بنك مورد')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {transferType === 'versement_espece' && (
                <div className="space-y-2">
                  <Label className="text-slate-700 font-medium">{tr('Compte fournisseur destination', 'حساب المورد الوجهة')}</Label>
                  <Select value={transferDestinationSupplierId} onValueChange={setTransferDestinationSupplierId}>
                    <SelectTrigger className="border-slate-200 focus:ring-blue-500">
                      <SelectValue placeholder={tr('Banque générale (optionnel)', 'البنك العام (اختياري)')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{tr('Banque générale', 'البنك العام')}</SelectItem>
                      {supplierBankProfiles.map((supplier) => (
                        <SelectItem key={`transfer-cash-dst-${supplier.id}`} value={supplier.id}>
                          {supplier.name} - {supplier.bankAccountName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {transferType === 'banque_a_banque' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-700 font-medium">{tr('Compte Source', 'الحساب المصدر')}</Label>
                    <Select value={transferSourceSupplierId} onValueChange={setTransferSourceSupplierId}>
                      <SelectTrigger className="border-slate-200 focus:ring-blue-500">
                        <SelectValue placeholder={tr('Choisir un fournisseur', 'اختر موردًا')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{tr('Sélectionner', 'اختر')}</SelectItem>
                        {supplierBankProfiles.map((supplier) => (
                          <SelectItem key={`transfer-src-${supplier.id}`} value={supplier.id}>
                            {supplier.name} - {supplier.bankAccountName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-700 font-medium">{tr('Compte Destination', 'الحساب الوجهة')}</Label>
                    <Select value={transferDestinationSupplierId} onValueChange={setTransferDestinationSupplierId}>
                      <SelectTrigger className="border-slate-200 focus:ring-blue-500">
                        <SelectValue placeholder={tr('Choisir un fournisseur', 'اختر موردًا')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{tr('Sélectionner', 'اختر')}</SelectItem>
                        {supplierBankProfiles.map((supplier) => (
                          <SelectItem key={`transfer-dst-${supplier.id}`} value={supplier.id}>
                            {supplier.name} - {supplier.bankAccountName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-700 font-medium">{t('revenue.transfer.amount', 'Montant')}</Label>
                  <Input 
                    type="number"
                    value={transferAmount} 
                    onChange={(e) => setTransferAmount(e.target.value)} 
                    placeholder="0.00"
                    className="border-slate-200 focus:ring-blue-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-700 font-medium">{t('revenue.transfer.date', 'Date')}</Label>
                  <Input
                    type="date"
                    value={format(new Date(transferDate), 'yyyy-MM-dd')}
                    onChange={(e) => {
                      const d = new Date(e.target.value);
                      setTransferDate(new Date(d.setHours(12)).toISOString());
                    }}
                    className="border-slate-200 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700 font-medium">{t('revenue.transfer.descriptionLabel', 'Description / Référence')}</Label>
                <Textarea 
                  value={transferDescription} 
                  onChange={(e) => setTransferDescription(e.target.value)} 
                  placeholder={t('revenue.transfer.notesPlaceholder', 'Ex: Versement recette du jour...')}
                  className="min-h-[100px] border-slate-200 focus:ring-blue-500 resize-none"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="p-6 pt-2 bg-slate-50 flex gap-2">
            <Button variant="ghost" onClick={() => setTransferDialogOpen(false)} className="text-slate-600 hover:bg-slate-200">
              {t('common.cancel', 'Annuler')}
            </Button>
            <Button onClick={handleSubmitTransfer} className="bg-blue-600 hover:bg-blue-700 text-white px-8">
              {t('revenue.transfer.confirm', 'Confirmer le transfert')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cashDialogOpen} onOpenChange={setCashDialogOpen}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none shadow-2xl">
          <div className="bg-indigo-600 p-6 text-white">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <Wallet className="h-5 w-5 text-indigo-200" />
                {t('revenue.cashOperation.title', 'Nouvelle Opération')}
              </DialogTitle>
              <p className="text-indigo-100 text-sm mt-1">{t('revenue.cashOperation.subtitle', 'Enregistrer un versement ou retrait')}</p>
            </DialogHeader>
          </div>
          <div className="p-6 space-y-4 bg-white">
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label className="text-slate-700 font-medium">{t('revenue.cashOperation.label', 'Libellé de l\'opération')}</Label>
                <Input 
                  value={cashName} 
                  onChange={(e) => setCashName(e.target.value)} 
                  placeholder={t('revenue.cashOperation.labelPlaceholder', 'Ex: Paiement fournisseur, Achat...')}
                  className="border-slate-200 focus:ring-indigo-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-700 font-medium">{t('revenue.transfer.amount', 'Montant')}</Label>
                  <Input 
                    type="number"
                    value={cashAmount} 
                    onChange={(e) => setCashAmount(e.target.value)} 
                    placeholder="0.00"
                    className="border-slate-200 focus:ring-indigo-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-700 font-medium">{t('revenue.transfer.date', 'Date')}</Label>
                  <Input
                    type="date"
                    value={format(new Date(cashDate), 'yyyy-MM-dd')}
                    onChange={(e) => {
                      const d = new Date(e.target.value);
                      setCashDate(new Date(d.setHours(12)).toISOString());
                    }}
                    className="border-slate-200 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div className="space-y-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <Label className="text-slate-700 font-semibold text-xs uppercase tracking-wider">{t('revenue.cashOperation.operationType', 'Type d\'opération')}</Label>
                <RadioGroup
                  value={cashType}
                  onValueChange={(v) => setCashType(v as 'versement' | 'retrait')}
                  className="flex gap-6 mt-1"
                >
                  <div className="flex items-center space-x-2 cursor-pointer group">
                    <RadioGroupItem value="versement" id="versement" className="text-indigo-600 border-slate-300" />
                    <Label htmlFor="versement" className="font-medium text-slate-700 cursor-pointer group-hover:text-indigo-600 transition-colors">
                      {t('revenue.cashOperation.depositEntry', 'Versement (Entrée)')}
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 cursor-pointer group">
                    <RadioGroupItem value="retrait" id="retrait" className="text-rose-600 border-slate-300" />
                    <Label htmlFor="retrait" className="font-medium text-slate-700 cursor-pointer group-hover:text-rose-600 transition-colors">
                      {t('revenue.cashOperation.withdrawExit', 'Retrait (Sortie)')}
                    </Label>
                  </div>
                </RadioGroup>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700 font-medium">{t('revenue.cashOperation.accountAffected', 'Compte impacté')}</Label>
                <Select
                  value={cashAccount}
                  onValueChange={(v) => {
                    const next = v as 'espece' | 'banque' | 'cheque' | 'autre';
                    setCashAccount(next);
                    if (next !== 'banque') {
                      setCashSupplierId('none');
                    }
                  }}
                >
                  <SelectTrigger className="border-slate-200 focus:ring-indigo-500">
                    <SelectValue placeholder={t('revenue.cashOperation.selectAccount', 'Sélectionner le compte')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="espece">{t('revenue.cashOperation.cashRegister', 'Caisse (Espèce)')}</SelectItem>
                    <SelectItem value="banque">{t('revenue.cashOperation.bankAccount', 'Compte Banque')}</SelectItem>
                    <SelectItem value="cheque">{tr('Chèque', 'شيك')}</SelectItem>
                    <SelectItem value="autre">{tr('Autre', 'أخرى')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {cashAccount === 'banque' && (
                <div className="space-y-2">
                  <Label className="text-slate-700 font-medium">{tr('Compte fournisseur', 'حساب المورد')}</Label>
                  <Select
                    value={cashSupplierId}
                    onValueChange={(supplierId) => {
                      setCashSupplierId(supplierId);
                      if (supplierId === 'none') return;
                      const selected = supplierBankProfiles.find((s) => s.id === supplierId);
                      if (selected) {
                        setCashAccountDetails(selected.bankAccountName);
                      }
                    }}
                  >
                    <SelectTrigger className="border-slate-200 focus:ring-indigo-500">
                      <SelectValue placeholder={tr('Sélectionner un fournisseur', 'اختر مورّدًا')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{tr('Aucun', 'لا يوجد')}</SelectItem>
                      {supplierBankProfiles.map((supplier) => (
                        <SelectItem key={`supplier-cash-${supplier.id}`} value={supplier.id}>
                          {supplier.name} - {supplier.bankAccountName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label className="text-slate-700 font-medium">{t('revenue.cashOperation.counterpartyDetails', 'Détails contrepartie')}</Label>
                <Input 
                  value={cashAccountDetails} 
                  onChange={(e) => {
                    setCashAccountDetails(e.target.value);
                    if (cashAccount === 'banque') setCashSupplierId('none');
                  }} 
                  placeholder={t('revenue.cashOperation.counterpartyPlaceholder', 'Ex: fournisseur, client, référence...')} 
                  className="border-slate-200 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="p-6 pt-2 bg-slate-50 flex gap-2">
            <Button variant="ghost" onClick={() => setCashDialogOpen(false)} className="text-slate-600 hover:bg-slate-200">
              {t('common.cancel', 'Annuler')}
            </Button>
            <Button onClick={handleSubmitCash} className="bg-indigo-600 hover:bg-indigo-700 text-white px-8">
              {t('revenue.cashOperation.saveOperation', 'Enregistrer l’opération')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialogs - Minimal Modernization for consistency */}
      <Dialog open={editTransferOpen} onOpenChange={setEditTransferOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5 text-blue-600" />
              {t('revenue.editTransfer.title', 'Modifier le transfert')}
            </DialogTitle>
          </DialogHeader>
          {editingTransfer && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>{t('revenue.editTransfer.type', 'Type')}</Label>
                <Select
                  value={editingTransfer.type}
                  onValueChange={(v) => setEditingTransfer({ ...editingTransfer, type: v as any })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="versement_espece">{tr('Versement Espèce', 'إيداع نقدي')}</SelectItem>
                    <SelectItem value="remise_cheques">{tr('Remise de Chèques', 'إيداع شيكات')}</SelectItem>
                    <SelectItem value="retrait_bancaire">{tr('Retrait Bancaire', 'سحب بنكي')}</SelectItem>
                    <SelectItem value="banque_a_banque">{tr('Banque fournisseur vers Banque fournisseur', 'من بنك مورد إلى بنك مورد')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('revenue.editTransfer.amount', 'Montant')}</Label>
                  <Input
                    type="number"
                    value={editingTransfer.amount}
                    onChange={(e) => setEditingTransfer({ ...editingTransfer, amount: parseFloat(e.target.value || '0') })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('revenue.editTransfer.date', 'Date')}</Label>
                  <Input
                    type="date"
                    value={format(new Date(editingTransfer.date), 'yyyy-MM-dd')}
                    onChange={(e) => {
                      const d = new Date(e.target.value);
                      setEditingTransfer({ ...editingTransfer, date: new Date(d.setHours(12)).toISOString() });
                    }}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t('revenue.editTransfer.description', 'Description')}</Label>
                <Textarea
                  value={editingTransfer.description}
                  onChange={(e) => setEditingTransfer({ ...editingTransfer, description: e.target.value })}
                  className="resize-none"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTransferOpen(false)}>{t('common.cancel', 'Annuler')}</Button>
            <Button onClick={handleUpdateTransfer} className="bg-blue-600 hover:bg-blue-700 text-white">{t('common.update', 'Mettre à jour')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editCashOpen} onOpenChange={setEditCashOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5 text-indigo-600" />
              {t('revenue.editOperation.title', 'Modifier l’opération')}
            </DialogTitle>
          </DialogHeader>
          {editingCash && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>{t('revenue.editOperation.label', 'Libellé')}</Label>
                <Input
                  value={editingCash.name}
                  onChange={(e) => setEditingCash({ ...editingCash, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('revenue.editOperation.amount', 'Montant')}</Label>
                  <Input
                    type="number"
                    value={editingCash.amount}
                    onChange={(e) => setEditingCash({ ...editingCash, amount: parseFloat(e.target.value || '0') })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('revenue.editOperation.date', 'Date')}</Label>
                  <Input
                    type="date"
                    value={format(new Date(editingCash.date), 'yyyy-MM-dd')}
                    onChange={(e) => {
                      const d = new Date(e.target.value);
                      setEditingCash({ ...editingCash, date: new Date(d.setHours(12)).toISOString() });
                    }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('revenue.editOperation.type', 'Type')}</Label>
                  <Select
                    value={editingCash.type}
                    onValueChange={(v) => setEditingCash({ ...editingCash, type: v as any })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="versement">{t('revenue.types.versement', 'Versement')}</SelectItem>
                      <SelectItem value="retrait">{t('revenue.types.retrait', 'Retrait')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('revenue.editOperation.accountAffected', 'Compte impacté')}</Label>
                  <Select
                    value={editingCash.accountAffected}
                    onValueChange={(v) => {
                      const next = v as 'espece' | 'banque' | 'cheque' | 'autre';
                      const nextDraft = { ...editingCash, accountAffected: next };
                      if (next !== 'banque') {
                        nextDraft.accountDetails = '';
                      }
                      setEditingCash(nextDraft);
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="espece">{tr('Espèce', 'نقد')}</SelectItem>
                      <SelectItem value="banque">{tr('Banque', 'بنك')}</SelectItem>
                      <SelectItem value="cheque">{tr('Chèque', 'شيك')}</SelectItem>
                      <SelectItem value="autre">{tr('Autre', 'أخرى')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {editingCash.accountAffected === 'banque' && (
                <div className="space-y-2">
                  <Label>{tr('Compte fournisseur', 'حساب المورد')}</Label>
                  <Select
                    value={
                      supplierBankProfiles.find(
                        (s) => normalizeAccountText(s.bankAccountName) === normalizeAccountText(String(editingCash.accountDetails || ''))
                      )?.id || 'none'
                    }
                    onValueChange={(supplierId) => {
                      if (supplierId === 'none') return;
                      const selected = supplierBankProfiles.find((s) => s.id === supplierId);
                      if (!selected) return;
                      setEditingCash({ ...editingCash, accountDetails: selected.bankAccountName });
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder={tr('Sélectionner un fournisseur', 'اختر مورّدًا')} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{tr('Aucun', 'لا يوجد')}</SelectItem>
                      {supplierBankProfiles.map((supplier) => (
                        <SelectItem key={`supplier-edit-${supplier.id}`} value={supplier.id}>
                          {supplier.name} - {supplier.bankAccountName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label>{t('revenue.editOperation.counterpartyDetails', 'Détails contrepartie')}</Label>
                <Input
                  value={editingCash.accountDetails || ''}
                  onChange={(e) => setEditingCash({ ...editingCash, accountDetails: e.target.value })}
                  placeholder={t('revenue.editOperation.counterpartyPlaceholder', 'Ex: fournisseur, client, référence...')}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditCashOpen(false)}>{t('common.cancel', 'Annuler')}</Button>
            <Button onClick={handleUpdateCash} className="bg-indigo-600 hover:bg-indigo-700 text-white">{t('common.update', 'Mettre à jour')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default Revenue;
