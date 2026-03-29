

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
import { useLanguage, useT } from '@/contexts/LanguageContext';
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
  } = useApp();
  const t = useT();
  const { language } = useLanguage();
  const uiLocale = language === 'ar' ? 'ar-MA' : 'fr-MA';
  const tr = (frText: string, arText: string) => (language === 'ar' ? arText : frText);
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
  const [transferType, setTransferType] = useState<'versement_espece' | 'remise_cheques' | 'retrait_bancaire'>(
    'versement_espece'
  );
  const [transferAmount, setTransferAmount] = useState<string>('');
  const [transferDescription, setTransferDescription] = useState<string>('');
  const [transferDate, setTransferDate] = useState<string>(() => new Date().toISOString());

  // Cash operation modal state
  const [cashDialogOpen, setCashDialogOpen] = useState(false);
  const [cashName, setCashName] = useState('');
  const [cashAmount, setCashAmount] = useState<string>('');
  const [cashType, setCashType] = useState<'versement' | 'retrait'>('versement');
  const [cashAccount, setCashAccount] = useState<'espece' | 'banque' | 'cheque' | 'autre'>('espece');
  const [cashAccountDetails, setCashAccountDetails] = useState('');
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

  // Normalize operations for "Gestion de Transfert"
  const opRows: OpRow[] = useMemo(() => {
    return financialTransactions.map((t) => {
      if (t.type === 'transfert') {
        const bt = bankTransfers.find(b => b.id === t.id);
        return {
          kind: 'transfert',
          id: t.id || Math.random().toString(),
          date: t.date,
      typeLabel: tr('Transfert', 'تحويل'),
          description: t.description,
          amount: t.amount,
          sourceAccount: t.sourceAccount as any,
          destinationAccount: t.destinationAccount as any,
          status: bt?.status || 'validated',
        };
      }
      
      const op = cashOperations.find(o => o.id === t.id);
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
  }, [financialTransactions, cashOperations, bankTransfers]);

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

  const commandWindowOps = useMemo(() => {
    if (commandWindow === 'all') return opRows;
    const now = Date.now();
    const days = commandWindow === '7j' ? 7 : commandWindow === '30j' ? 30 : 90;
    const maxMs = days * 24 * 60 * 60 * 1000;
    return opRows.filter((row) => now - new Date(row.date).getTime() <= maxMs);
  }, [opRows, commandWindow]);

  const getRowPriority = (row: OpRow): 'high' | 'medium' | 'low' => {
    if (row.status === 'pending') return 'high';
    if (row.amount >= 12000) return 'high';
    if (row.amount >= 4000) return 'medium';
    return 'low';
  };

  const revenueIntelligence = useMemo(() => {
    const totalIn = commandWindowOps.reduce((sum, row) => {
      if (row.kind === 'operation' && row.typeLabel === 'versement') return sum + row.amount;
      if (row.kind === 'transfert' && row.destinationAccount === 'banque') return sum + row.amount;
      return sum;
    }, 0);
    const totalOut = commandWindowOps.reduce((sum, row) => {
      if (row.kind === 'operation' && row.typeLabel === 'retrait') return sum + row.amount;
      if (row.kind === 'transfert' && row.sourceAccount === 'banque') return sum + row.amount;
      return sum;
    }, 0);
    const pendingOps = commandWindowOps.filter((row) => row.status === 'pending').length;
    const netFlow = totalIn - totalOut;
    const accountPressure = [
      { account: tr('Espèce', 'نقد'), balance: soldeEspece },
      { account: tr('Banque', 'بنك'), balance: soldeBanque },
      { account: tr('Chèque', 'شيك'), balance: soldeCheque }
    ].sort((a, b) => a.balance - b.balance);
    const laneCounts = commandWindowOps.reduce(
      (acc, row) => {
        const level = getRowPriority(row);
        acc[level] += 1;
        return acc;
      },
      { high: 0, medium: 0, low: 0 }
    );
    return { totalIn, totalOut, pendingOps, netFlow, accountPressure, laneCounts };
  }, [commandWindowOps, soldeEspece, soldeBanque, soldeCheque]);

  const missionBoard = useMemo(() => {
    const lanes = {
      high: [] as OpRow[],
      medium: [] as OpRow[],
      low: [] as OpRow[]
    };
    commandWindowOps.forEach((row) => {
      const lane = getRowPriority(row);
      lanes[lane].push(row);
    });
    const sortByDate = (a: OpRow, b: OpRow) => new Date(b.date).getTime() - new Date(a.date).getTime();
    return {
      high: lanes.high.sort(sortByDate).slice(0, 4),
      medium: lanes.medium.sort(sortByDate).slice(0, 4),
      low: lanes.low.sort(sortByDate).slice(0, 4)
    };
  }, [commandWindowOps]);

  const accountForecast = useMemo(() => {
    const divisor = commandWindow === '7j' ? 7 : commandWindow === '30j' ? 30 : commandWindow === '90j' ? 90 : 30;
    const accounts: Array<{ key: 'espece' | 'banque' | 'cheque'; label: string; balance: number }> = [
      { key: 'espece', label: 'Espèce', balance: soldeEspece },
      { key: 'banque', label: 'Banque', balance: soldeBanque },
      { key: 'cheque', label: 'Chèque', balance: soldeCheque }
    ];
    return accounts
      .map((account) => {
        const outflow = commandWindowOps.reduce((sum, row) => {
          if (row.kind === 'transfert') {
            if (row.sourceAccount === account.key) return sum + row.amount;
            return sum;
          }
          if (row.typeLabel === 'retrait' && row.accountAffected === account.key) return sum + row.amount;
          return sum;
        }, 0);
        const dailyDrain = outflow > 0 ? outflow / divisor : 0;
        const daysLeft = dailyDrain > 0 ? account.balance / dailyDrain : Infinity;
        const risk = daysLeft <= 10 ? 'high' : daysLeft <= 25 ? 'medium' : 'low';
        return { ...account, outflow, dailyDrain, daysLeft, risk };
      })
      .sort((a, b) => {
        if (!Number.isFinite(a.daysLeft) && !Number.isFinite(b.daysLeft)) return a.balance - b.balance;
        if (!Number.isFinite(a.daysLeft)) return 1;
        if (!Number.isFinite(b.daysLeft)) return -1;
        return a.daysLeft - b.daysLeft;
      });
  }, [commandWindowOps, commandWindow, soldeEspece, soldeBanque, soldeCheque]);

  const weeklyFlowHeatmap = useMemo(() => {
    const now = new Date();
    const currentWeekStart = startOfWeekMonday(now);
    const slices = Array.from({ length: 8 }, (_, index) => {
      const diff = 7 - index;
      const start = new Date(currentWeekStart);
      start.setDate(start.getDate() - diff * 7);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      const weeklyTx = financialTransactions.filter((tx) => {
        const d = new Date(tx.date);
        return d >= start && d < end;
      });
      const inbound = weeklyTx.reduce((sum, tx) => {
        if (tx.type === 'encaissement' || tx.type === 'versement') return sum + Math.abs(Number(tx.amount) || 0);
        return sum;
      }, 0);
      const outbound = weeklyTx.reduce((sum, tx) => {
        if (tx.type === 'retrait' || tx.type === 'dépense' || tx.type === 'réparation') return sum + Math.abs(Number(tx.amount) || 0);
        return sum;
      }, 0);
      const net = inbound - outbound;
      return {
        key: start.toISOString(),
        start,
        end,
        label: start.toLocaleDateString(uiLocale, { day: '2-digit', month: 'short' }),
        inbound,
        outbound,
        net
      };
    });
    const maxAbs = Math.max(1, ...slices.map((slice) => Math.abs(slice.net)));
    return slices.map((slice) => ({
      ...slice,
      intensity: Math.min(1, Math.abs(slice.net) / maxAbs),
      trend: slice.net >= 0 ? 'up' : 'down'
    }));
  }, [financialTransactions, uiLocale]);

  const whatIfScenario = useMemo(() => {
    const baseDays = commandWindow === '7j' ? 7 : commandWindow === '30j' ? 30 : commandWindow === '90j' ? 90 : 30;
    const baseIn = commandWindowOps.reduce((sum, row) => {
      if (row.kind === 'operation' && row.typeLabel === 'versement') return sum + row.amount;
      if (row.kind === 'transfert' && row.destinationAccount === 'banque') return sum + row.amount;
      return sum;
    }, 0);
    const baseOut = commandWindowOps.reduce((sum, row) => {
      if (row.kind === 'operation' && row.typeLabel === 'retrait') return sum + row.amount;
      if (row.kind === 'transfert' && row.sourceAccount === 'banque') return sum + row.amount;
      return sum;
    }, 0);
    const dailyBaseNet = (baseIn - baseOut) / baseDays;
    const dailyIn = parseFloat(whatIfDailyIn) || 0;
    const dailyOut = parseFloat(whatIfDailyOut) || 0;
    const horizon = parseInt(whatIfHorizon, 10) || 30;
    const dailyProjectedNet = dailyBaseNet + dailyIn - dailyOut;
    const currentLiquidity = soldeEspece + soldeBanque + soldeCheque;
    const projectedLiquidity = currentLiquidity + dailyProjectedNet * horizon;
    const runwayDays = dailyProjectedNet < 0 ? currentLiquidity / Math.abs(dailyProjectedNet) : Infinity;
    const risk = projectedLiquidity <= 0 || runwayDays <= 10 ? 'high' : runwayDays <= 25 ? 'medium' : 'low';
    return {
      dailyBaseNet,
      dailyProjectedNet,
      currentLiquidity,
      projectedLiquidity,
      runwayDays,
      horizon,
      risk
    };
  }, [commandWindow, commandWindowOps, whatIfDailyIn, whatIfDailyOut, whatIfHorizon, soldeEspece, soldeBanque, soldeCheque]);

  const anomalyRows = useMemo(() => {
    if (commandWindowOps.length < 3) return [] as RevenueAnomaly[];
    const amounts = commandWindowOps.map((row) => Math.abs(row.amount));
    const mean = amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length;
    const variance = amounts.reduce((sum, amount) => sum + (amount - mean) ** 2, 0) / amounts.length;
    const std = Math.sqrt(variance) || 1;
    return commandWindowOps
      .map((row) => {
        const isPositive = row.kind === 'operation' ? row.typeLabel === 'versement' : row.destinationAccount === 'banque';
        const score = (Math.abs(row.amount) - mean) / std;
        const label = row.kind === 'transfert'
          ? `${formatAccountName(row.sourceAccount, tr)} → ${formatAccountName(row.destinationAccount, tr)}`
          : `${formatOpType(row.typeLabel)} · ${formatAccountName(row.accountAffected, tr)}`;
        return {
          id: `${row.kind}-${row.id}`,
          date: row.date,
          amount: row.amount,
          score,
          direction: isPositive ? 'positive' : 'negative',
          label
        };
      })
      .filter((row) => Math.abs(row.score) >= 1.15)
      .sort((a, b) => Math.abs(b.score) - Math.abs(a.score))
      .slice(0, 6);
  }, [commandWindowOps, language]);

  const visibleAnomalies = useMemo(() => {
    if (anomalyMode === 'all') return anomalyRows;
    return anomalyRows.filter((row) => row.direction === anomalyMode);
  }, [anomalyRows, anomalyMode]);

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
        const affected = [r.sourceAccount, r.destinationAccount].filter(Boolean);
        if (affected.length > 0 && !affected.includes(filterAccount)) return false;
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
  const handleSubmitTransfer = () => {
    const amount = parseFloat(transferAmount);
    if (!amount || amount <= 0) {
      toast.error(tr('Veuillez saisir un montant valide', 'يرجى إدخال مبلغ صالح'));
      return;
    }
    let source: BankTransfer['sourceAccount'] = 'espece';
    let dest: BankTransfer['destinationAccount'] = 'banque';
    if (transferType === 'versement_espece') {
      source = 'espece';
      dest = 'banque';
    } else if (transferType === 'remise_cheques') {
      source = 'cheque';
      dest = 'banque';
    } else {
      source = 'banque';
      dest = 'espece';
    }

    const id = (crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));
    addBankTransfer({
      id,
      date: transferDate,
      type: transferType,
      sourceAccount: source,
      destinationAccount: dest,
      amount,
      description: transferDescription || '',
      status: 'pending',
    });
    // Validation immédiate pour mettre à jour les cartes et appliquer les effets
    validateBankTransfer(id);

    toast.success(tr('تم تسجيل التحويل واعتماده', 'تم تسجيل التحويل واعتماده'));
    setTransferDialogOpen(false);
    setTransferAmount('');
    setTransferDescription('');
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
    } else {
      source = 'banque';
      dest = 'espece';
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

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="border-none shadow-sm bg-white overflow-hidden xl:col-span-2">
          <CardContent className="p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-slate-900 rounded-xl">
                  <Banknote className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">{tr('Revenue Mission Deck', 'لوحة قيادة الإيرادات')}</h3>
                  <p className="text-xs text-slate-500">{tr('Vue tactique des flux et priorités de validation', 'رؤية تكتيكية للتدفقات وأولويات الاعتماد')}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant={commandWindow === '7j' ? 'default' : 'outline'} size="sm" className={commandWindow === '7j' ? 'bg-blue-600 hover:bg-blue-700' : ''} onClick={() => setCommandWindow('7j')}>{tr('7 jours', '7 أيام')}</Button>
                <Button variant={commandWindow === '30j' ? 'default' : 'outline'} size="sm" className={commandWindow === '30j' ? 'bg-blue-600 hover:bg-blue-700' : ''} onClick={() => setCommandWindow('30j')}>{tr('30 jours', '30 يومًا')}</Button>
                <Button variant={commandWindow === '90j' ? 'default' : 'outline'} size="sm" className={commandWindow === '90j' ? 'bg-blue-600 hover:bg-blue-700' : ''} onClick={() => setCommandWindow('90j')}>{tr('90 jours', '90 يومًا')}</Button>
                <Button variant={commandWindow === 'all' ? 'default' : 'outline'} size="sm" className={commandWindow === 'all' ? 'bg-blue-600 hover:bg-blue-700' : ''} onClick={() => setCommandWindow('all')}>{t('revenue.window.all', 'Tout')}</Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 space-y-2">
                <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide">{tr('Entrées', 'الداخل')}</p>
                <p className="text-xl font-black text-emerald-700">{formatCurrency(revenueIntelligence.totalIn)}</p>
                <p className="text-[11px] text-emerald-600">{tr('Flux positifs sur la fenêtre', 'تدفقات إيجابية ضمن النافذة')}</p>
              </div>
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 space-y-2">
                <p className="text-xs font-bold text-rose-700 uppercase tracking-wide">{tr('Sorties', 'الخارج')}</p>
                <p className="text-xl font-black text-rose-700">{formatCurrency(revenueIntelligence.totalOut)}</p>
                <p className="text-[11px] text-rose-600">{tr('Pression de trésorerie', 'ضغط السيولة')}</p>
              </div>
              <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 space-y-2">
                <p className="text-xs font-bold text-indigo-700 uppercase tracking-wide">{tr('Balance Mission', 'رصيد المهمة')}</p>
                <p className="text-xl font-black text-indigo-700">{formatCurrency(revenueIntelligence.netFlow)}</p>
                <p className="text-[11px] text-indigo-600">{tr('في الانتظار', 'في الانتظار')}: {revenueIntelligence.pendingOps}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { key: 'high', title: tr('Critique', 'حرج'), items: missionBoard.high, count: revenueIntelligence.laneCounts.high, cls: 'border-rose-200', badge: 'bg-rose-100 text-rose-700' },
                { key: 'medium', title: tr('Surveillance', 'مراقبة'), items: missionBoard.medium, count: revenueIntelligence.laneCounts.medium, cls: 'border-amber-200', badge: 'bg-amber-100 text-amber-700' },
                { key: 'low', title: tr('Stable', 'مستقر'), items: missionBoard.low, count: revenueIntelligence.laneCounts.low, cls: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-700' }
              ].map((lane) => (
                <div key={lane.key} className={`rounded-2xl border ${lane.cls} bg-slate-50 p-3 space-y-2`}>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-black text-slate-700 uppercase tracking-wide">{lane.title}</p>
                    <Badge className={`${lane.badge} border-none`}>{lane.count}</Badge>
                  </div>
                  {lane.items.length === 0 ? (
                    <p className="text-xs text-slate-500">{tr('Aucun flux sur cette lane.', 'لا توجد تدفقات في هذا المسار.')}</p>
                  ) : (
                    lane.items.map((row) => (
                      <button
                        key={`${row.kind}-${row.id}`}
                        type="button"
                        onClick={() => setFilterType(row.kind === 'transfert' ? 'transfert' : row.typeLabel)}
                        className="w-full text-left rounded-xl border border-slate-200 bg-white px-3 py-2 hover:bg-slate-50 transition-colors"
                      >
                        <p className="text-xs font-bold text-slate-800">{row.kind === 'transfert' ? t('revenue.table.transfert', 'Transfert') : formatOpType(row.typeLabel)}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">{formatDateLocalized(row.date)} · {formatCurrency(row.amount)}</p>
                      </button>
                    ))
                  )}
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => applyCommandFocus('pending')} className="bg-rose-600 hover:bg-rose-700 text-white">
                <ChevronDown className="h-4 w-4 mr-2" />
                {tr('Focus validations', 'تركيز على الاعتمادات')}
              </Button>
              <Button variant="outline" onClick={() => applyCommandFocus('inflow')}>
                <TrendingUp className="h-4 w-4 mr-2 text-emerald-600" />
                {tr('Focus entrées', 'تركيز على الداخل')}
              </Button>
              <Button variant="outline" onClick={() => applyCommandFocus('outflow')}>
                <TrendingDown className="h-4 w-4 mr-2 text-rose-600" />
                {tr('Focus sorties', 'تركيز على الخارج')}
              </Button>
              <Button variant="ghost" onClick={() => applyCommandFocus('reset')} className="text-slate-600">
                <X className="h-4 w-4 mr-2" />
                {t('revenue.intelligence.reset', 'Réinitialiser')}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white overflow-hidden">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-50 rounded-xl">
                <FileText className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">{tr('Prévision de Trésorerie', 'توقع السيولة')}</h3>
                <p className="text-xs text-slate-500">{tr('Signal par compte sur la fenêtre active', 'إشارة حسب الحساب ضمن النافذة النشطة')}</p>
              </div>
            </div>
            <div className="space-y-2">
              {accountForecast.map((row) => (
                <button
                  key={row.key}
                  type="button"
                  onClick={() => applyForecastFocus(row.key, row.risk)}
                  className="w-full text-left rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 hover:bg-white transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-800">{row.label}</p>
                    <Badge className={row.risk === 'high' ? 'bg-rose-100 text-rose-700 border-none' : row.risk === 'medium' ? 'bg-amber-100 text-amber-700 border-none' : 'bg-emerald-100 text-emerald-700 border-none'}>
                      {row.risk === 'high' ? tr('Alerte Rouge', 'إنذار أحمر') : row.risk === 'medium' ? tr('Alerte Orange', 'إنذار برتقالي') : tr('Stable', 'مستقر')}
                    </Badge>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                    <span>{formatCurrency(row.balance)}</span>
                    <span>{Number.isFinite(row.daysLeft) ? `${Math.max(0, Math.floor(row.daysLeft))} ${tr('jours', 'يوم')}` : tr('Sans pression', 'دون ضغط')}</span>
                  </div>
                </button>
              ))}
            </div>
            {revenueIntelligence.accountPressure[0] && (
              <div className="rounded-xl bg-slate-900 text-white p-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-300">{tr('Compte le plus exposé', 'الحساب الأكثر تعرضًا')}</p>
                <p className="font-black text-sm mt-1">{revenueIntelligence.accountPressure[0].account}</p>
                <p className="text-xs text-slate-300 mt-0.5">{formatCurrency(revenueIntelligence.accountPressure[0].balance)}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="border-none shadow-sm bg-white overflow-hidden xl:col-span-2">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-50 rounded-xl">
                <Calendar className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">{tr('Weekly Flow Heatmap', 'خريطة حرارة التدفق الأسبوعي')}</h3>
                <p className="text-xs text-slate-500">{tr('Lecture visuelle des semaines positives et sous tension', 'قراءة بصرية للأسابيع الإيجابية وتحت الضغط')}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2">
              {weeklyFlowHeatmap.map((week) => (
                <button
                  key={week.key}
                  type="button"
                  onClick={() => applyHeatmapFocus(week.start, week.end, week.trend)}
                  className={`rounded-xl border px-3 py-2 text-left transition-colors ${
                    week.trend === 'up'
                      ? 'border-emerald-200 hover:border-emerald-300'
                      : 'border-rose-200 hover:border-rose-300'
                  }`}
                  style={{
                    backgroundColor: week.trend === 'up'
                      ? `rgba(16, 185, 129, ${0.12 + week.intensity * 0.33})`
                      : `rgba(244, 63, 94, ${0.12 + week.intensity * 0.33})`
                  }}
                >
                  <p className="text-[11px] font-bold text-slate-700">{week.label}</p>
                  <p className={`text-xs font-black mt-1 ${week.trend === 'up' ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {formatCurrency(week.net)}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{week.trend === 'up' ? tr('Momentum +', 'زخم +') : tr('Momentum -', 'زخم -')}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white overflow-hidden">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-violet-50 rounded-xl">
                <Wallet className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">{tr('What-if Liquidity Lab', 'مختبر سيناريوهات السيولة')}</h3>
                <p className="text-xs text-slate-500">{tr('Simulation proactive de la trésorerie', 'محاكاة استباقية للسيولة')}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[11px] uppercase tracking-wide text-slate-500">{tr('+ Entrée / jour', '+ الداخل / يوم')}</Label>
                <Input value={whatIfDailyIn} onChange={(e) => setWhatIfDailyIn(e.target.value)} className="h-9 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] uppercase tracking-wide text-slate-500">{tr('- Sortie / jour', '- الخارج / يوم')}</Label>
                <Input value={whatIfDailyOut} onChange={(e) => setWhatIfDailyOut(e.target.value)} className="h-9 text-sm" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] uppercase tracking-wide text-slate-500">{t('revenue.whatif.horizon', 'Horizon')}</Label>
              <div className="flex items-center gap-2">
                <Button variant={whatIfHorizon === '15' ? 'default' : 'outline'} size="sm" className={whatIfHorizon === '15' ? 'bg-violet-600 hover:bg-violet-700' : ''} onClick={() => setWhatIfHorizon('15')}>{language === 'ar' ? '15ي' : '15j'}</Button>
                <Button variant={whatIfHorizon === '30' ? 'default' : 'outline'} size="sm" className={whatIfHorizon === '30' ? 'bg-violet-600 hover:bg-violet-700' : ''} onClick={() => setWhatIfHorizon('30')}>{language === 'ar' ? '30ي' : '30j'}</Button>
                <Button variant={whatIfHorizon === '60' ? 'default' : 'outline'} size="sm" className={whatIfHorizon === '60' ? 'bg-violet-600 hover:bg-violet-700' : ''} onClick={() => setWhatIfHorizon('60')}>{language === 'ar' ? '60ي' : '60j'}</Button>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500">{t('revenue.whatif.currentLiquidity', 'Liquidité actuelle')}</p>
                <p className="text-xs font-black text-slate-800">{formatCurrency(whatIfScenario.currentLiquidity)}</p>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500">{tr('Projection', 'التوقع')} ({whatIfScenario.horizon}j)</p>
                <p className={`text-xs font-black ${whatIfScenario.projectedLiquidity >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {formatCurrency(whatIfScenario.projectedLiquidity)}
                </p>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500">{t('revenue.whatif.runway', 'Runway')}</p>
                <p className="text-xs font-black text-slate-800">
                  {Number.isFinite(whatIfScenario.runwayDays) ? `${Math.max(0, Math.floor(whatIfScenario.runwayDays))} ${t('revenue.whatif.days', 'jours')}` : tr('Trajectoire positive', 'مسار إيجابي')}
                </p>
              </div>
              <Badge className={whatIfScenario.risk === 'high' ? 'bg-rose-100 text-rose-700 border-none' : whatIfScenario.risk === 'medium' ? 'bg-amber-100 text-amber-700 border-none' : 'bg-emerald-100 text-emerald-700 border-none'}>
                {whatIfScenario.risk === 'high' ? t('revenue.whatif.risk.high', 'Risque élevé') : whatIfScenario.risk === 'medium' ? t('revenue.whatif.risk.medium', 'Risque moyen') : tr('Risque maîtrisé', 'خطر متحكم به')}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="border-none shadow-sm bg-white overflow-hidden xl:col-span-2">
          <CardContent className="p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-slate-900">{tr('Anomaly Radar', 'رادار الشذوذ')}</h3>
                <p className="text-xs text-slate-500">{tr('Détection des flux atypiques pour audit rapide', 'اكتشاف التدفقات غير الاعتيادية للتدقيق السريع')}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant={anomalyMode === 'all' ? 'default' : 'outline'} size="sm" className={anomalyMode === 'all' ? 'bg-slate-700 hover:bg-slate-800' : ''} onClick={() => setAnomalyMode('all')}>{t('revenue.anomalies.all', 'Toutes')}</Button>
                <Button variant={anomalyMode === 'positive' ? 'default' : 'outline'} size="sm" className={anomalyMode === 'positive' ? 'bg-emerald-600 hover:bg-emerald-700' : ''} onClick={() => setAnomalyMode('positive')}>{t('revenue.anomalies.positive', 'Positives')}</Button>
                <Button variant={anomalyMode === 'negative' ? 'default' : 'outline'} size="sm" className={anomalyMode === 'negative' ? 'bg-rose-600 hover:bg-rose-700' : ''} onClick={() => setAnomalyMode('negative')}>{t('revenue.anomalies.negative', 'Négatives')}</Button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {visibleAnomalies.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                  {tr('Aucun signal atypique sur la fenêtre actuelle.', 'لا توجد إشارات غير اعتيادية في النافذة الحالية.')}
                </div>
              ) : (
                visibleAnomalies.map((anomaly) => (
                  <button
                    key={anomaly.id}
                    type="button"
                    onClick={() => applyAnomalyFocus(anomaly)}
                    className={`rounded-xl border px-3 py-2 text-left transition-colors ${
                      anomaly.direction === 'positive'
                        ? 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100/60'
                        : 'border-rose-200 bg-rose-50 hover:bg-rose-100/60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-black text-slate-800">{anomaly.label}</p>
                      <Badge className={anomaly.direction === 'positive' ? 'bg-emerald-100 text-emerald-700 border-none' : 'bg-rose-100 text-rose-700 border-none'}>
                        x{Math.abs(anomaly.score).toFixed(1)}
                      </Badge>
                    </div>
                  <p className="text-[11px] text-slate-600 mt-1">{formatDateLocalized(anomaly.date)} · {formatCurrency(anomaly.amount)}</p>
                  </button>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white overflow-hidden">
          <CardContent className="p-5 space-y-3">
            <div>
              <h3 className="text-base font-black text-slate-900">{tr('Autopilot Playbooks', 'سيناريوهات الطيار الآلي')}</h3>
              <p className="text-xs text-slate-500">{tr('Scénarios prêts à appliquer en un clic', 'سيناريوهات جاهزة للتطبيق بنقرة واحدة')}</p>
            </div>
            <Button onClick={() => applyAutopilot('protect')} className="w-full justify-start bg-rose-600 hover:bg-rose-700">
              <TrendingDown className="h-4 w-4 mr-2" />
              {tr('Protection Liquidité', 'حماية السيولة')}
            </Button>
            <Button variant="outline" onClick={() => applyAutopilot('accelerate')} className="w-full justify-start">
              <TrendingUp className="h-4 w-4 mr-2 text-emerald-600" />
              {tr('Accélération Encaissements', 'تسريع التحصيلات')}
            </Button>
            <Button variant="ghost" onClick={() => applyAutopilot('balance')} className="w-full justify-start text-slate-600">
              <X className="h-4 w-4 mr-2" />
              {tr('Reset Intelligent', 'إعادة ضبط ذكية')}
            </Button>
            <div className="rounded-xl bg-slate-900 text-white p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-300">{tr('Pilotage conseillé', 'توجيه موصى به')}</p>
              <p className="text-sm font-black mt-1">
                {whatIfScenario.risk === 'high' ? tr('Active Protection Liquidité', 'فعّل حماية السيولة') : whatIfScenario.risk === 'medium' ? tr('Surveille les sorties critiques', 'راقب المخرجات الحرجة') : tr('Maintiens la cadence actuelle', 'حافظ على الوتيرة الحالية')}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="gestion" className="w-full space-y-4">
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
                                        openEditTransfer(bankTransfers.find((t) => t.id === r.id)!);
                                      } else {
                                        openEditCash(cashOperations.find((o) => o.id === r.id)!);
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
                                        handleValidateTransfer(bankTransfers.find((t) => t.id === r.id)!);
                                      } else {
                                        handleValidateCash(cashOperations.find((o) => o.id === r.id)!);
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
          <Card className="border-none shadow-sm overflow-hidden">
            <CardHeader className="bg-white border-b py-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-semibold text-slate-800">{t('revenue.history.title', 'Historique Financier')}</CardTitle>
                  <p className="text-sm text-slate-500">{t('revenue.history.subtitle', 'Consulter toutes les transactions')}</p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="text-blue-600 border-blue-200 hover:bg-blue-50"
                  onClick={exportHistoryToPDF}
                >
                  <Download className="mr-2 h-4 w-4" />
                  {t('revenue.history.export', 'Exporter PDF')}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {/* Filters for History */}
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
                    <span className="text-slate-400 text-xs">{t('revenue.filters.to', 'à')}</span>
                    <Input 
                      type="date" 
                      className="h-9 text-sm"
                      value={filterEndDate} 
                      onChange={(e) => setFilterEndDate(e.target.value)} 
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('revenue.history.type', 'Type')}</Label>
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder={t('revenue.history.allTransactions', 'Toutes les transactions')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('revenue.history.allTransactions', 'Toutes les transactions')}</SelectItem>
                      <SelectItem value="versement">{t('revenue.history.versements', 'Versements')}</SelectItem>
                      <SelectItem value="transfert">{t('revenue.history.transfers', 'Transferts')}</SelectItem>
                      <SelectItem value="retrait">{t('revenue.history.withdrawals', 'Retraits')}</SelectItem>
                      <SelectItem value="dépense">{t('revenue.history.expenses', 'Dépenses')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('revenue.history.affectedAccount', 'Compte affecté')}</Label>
                  <Select value={filterAccount} onValueChange={setFilterAccount}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder={t('revenue.filters.allAccounts', 'Tous les comptes')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('revenue.filters.allAccounts', 'Tous les comptes')}</SelectItem>
                      <SelectItem value="espece">{tr('Espèce', 'نقد')}</SelectItem>
                      <SelectItem value="cheque">{tr('Chèque', 'شيك')}</SelectItem>
                      <SelectItem value="banque">{tr('Banque', 'بنك')}</SelectItem>
                      <SelectItem value="autre">{tr('Autre', 'أخرى')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5 lg:col-span-2">
                  <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('revenue.table.amount', 'Montant')}</Label>
                  <div className="flex items-center gap-2">
                    <Input 
                      className="h-9 text-sm"
                      placeholder={t('revenue.filters.min', 'Min')}
                      value={filterAmountMin} 
                      onChange={(e) => setFilterAmountMin(e.target.value)} 
                    />
                    <Input 
                      className="h-9 text-sm"
                      placeholder={t('revenue.filters.max', 'Max')}
                      value={filterAmountMax} 
                      onChange={(e) => setFilterAmountMax(e.target.value)} 
                    />
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="font-semibold text-slate-700">{t('revenue.table.date', 'Date')}</TableHead>
                      <TableHead className="font-semibold text-slate-700">{t('revenue.history.type', 'Type')}</TableHead>
                      <TableHead className="font-semibold text-slate-700">{t('revenue.history.description', 'Description')}</TableHead>
                      <TableHead className="font-semibold text-slate-700">{t('revenue.table.amount', 'Montant')}</TableHead>
                      <TableHead className="font-semibold text-slate-700">{t('revenue.history.accounts', 'Comptes')}</TableHead>
                      <TableHead className="font-semibold text-slate-700 text-right">{t('revenue.table.status', 'Statut')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredHistory.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-32 text-center text-slate-500">
                          {t('revenue.history.none', 'Aucune transaction trouvée')}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredHistory.map((r: FinancialTransaction) => (
                        <TableRow key={r.id} className="hover:bg-slate-50/50 transition-colors">
                          <TableCell className="text-slate-700 font-medium">{formatDateLocalized(r.date)}</TableCell>
                          <TableCell>
                            <Badge 
                              variant="outline" 
                              className={`capitalize ${
                                r.type === 'réparation' || r.type === 'dépense' 
                                  ? 'border-rose-200 text-rose-700 bg-rose-50' 
                                  : 'border-emerald-200 text-emerald-700 bg-emerald-50'
                              }`}
                            >
                              {formatOpType(r.type)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-slate-600 text-sm max-w-[250px] truncate">{r.description || '-'}</TableCell>
                          <TableCell className={`font-bold ${r.amount >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {formatCurrency(r.amount)}
                          </TableCell>
          <TableCell>
                            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                              <span>
                                {r.sourceAccount === 'autre' && r.accountDetails ? `${tr('Autre', 'أخرى')} (${r.accountDetails})` : formatAccountName(r.sourceAccount || '', tr)}
                              </span>
                              {r.destinationAccount && (
                                <>
                                  <ArrowRightLeft className="h-3 w-3" />
                                  <span>
                                    {r.destinationAccount === 'autre' && r.accountDetails ? `${tr('Autre', 'أخرى')} (${r.accountDetails})` : formatAccountName(r.destinationAccount || '', tr)}
                                  </span>
                                </>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge className="bg-blue-100 text-blue-700 border-none">{formatStatus(r.status)}</Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
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
                <Select value={transferType} onValueChange={(v) => setTransferType(v as any)}>
                  <SelectTrigger className="border-slate-200 focus:ring-blue-500">
                    <SelectValue placeholder={t('revenue.transfer.chooseType', 'Choisir le type')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="versement_espece">{t('revenue.transfer.depositCash', 'Versement Espèce -> Banque')}</SelectItem>
                    <SelectItem value="remise_cheques">{t('revenue.transfer.chequeDeposit', 'Remise Chèque -> Banque')}</SelectItem>
                    <SelectItem value="retrait_bancaire">{t('revenue.transfer.bankWithdrawal', 'Retrait Banque -> Espèce')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
              {t('common.cancel')}
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
                <Select value={cashAccount} onValueChange={(v) => setCashAccount(v as any)}>
                  <SelectTrigger className="border-slate-200 focus:ring-indigo-500">
                    <SelectValue placeholder={t('revenue.cashOperation.selectAccount')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="espece">{t('revenue.cashOperation.cashRegister')}</SelectItem>
                    <SelectItem value="banque">{t('revenue.cashOperation.bankAccount')}</SelectItem>
                    <SelectItem value="cheque">{tr('Chèque', 'شيك')}</SelectItem>
                    <SelectItem value="autre">{tr('Autre', 'أخرى')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700 font-medium">{t('revenue.cashOperation.counterpartyDetails')}</Label>
                <Input 
                  value={cashAccountDetails} 
                  onChange={(e) => setCashAccountDetails(e.target.value)} 
                  placeholder={t('revenue.cashOperation.counterpartyPlaceholder')} 
                  className="border-slate-200 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="p-6 pt-2 bg-slate-50 flex gap-2">
            <Button variant="ghost" onClick={() => setCashDialogOpen(false)} className="text-slate-600 hover:bg-slate-200">
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSubmitCash} className="bg-indigo-600 hover:bg-indigo-700 text-white px-8">
              {t('revenue.cashOperation.saveOperation')}
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
              {t('revenue.editTransfer.title')}
            </DialogTitle>
          </DialogHeader>
          {editingTransfer && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>{t('revenue.editTransfer.type')}</Label>
                <Select
                  value={editingTransfer.type}
                  onValueChange={(v) => setEditingTransfer({ ...editingTransfer, type: v as any })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="versement_espece">{tr('Versement Espèce', 'إيداع نقدي')}</SelectItem>
                    <SelectItem value="remise_cheques">{tr('Remise de Chèques', 'إيداع شيكات')}</SelectItem>
                    <SelectItem value="retrait_bancaire">{tr('Retrait Bancaire', 'سحب بنكي')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('revenue.editTransfer.amount')}</Label>
                  <Input
                    type="number"
                    value={editingTransfer.amount}
                    onChange={(e) => setEditingTransfer({ ...editingTransfer, amount: parseFloat(e.target.value || '0') })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('revenue.editTransfer.date')}</Label>
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
                <Label>{t('revenue.editTransfer.description')}</Label>
                <Textarea
                  value={editingTransfer.description}
                  onChange={(e) => setEditingTransfer({ ...editingTransfer, description: e.target.value })}
                  className="resize-none"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTransferOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleUpdateTransfer} className="bg-blue-600 hover:bg-blue-700 text-white">{t('common.update')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editCashOpen} onOpenChange={setEditCashOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5 text-indigo-600" />
              {t('revenue.editOperation.title')}
            </DialogTitle>
          </DialogHeader>
          {editingCash && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>{t('revenue.editOperation.label')}</Label>
                <Input
                  value={editingCash.name}
                  onChange={(e) => setEditingCash({ ...editingCash, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('revenue.editOperation.amount')}</Label>
                  <Input
                    type="number"
                    value={editingCash.amount}
                    onChange={(e) => setEditingCash({ ...editingCash, amount: parseFloat(e.target.value || '0') })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('revenue.editOperation.date')}</Label>
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
                  <Label>{t('revenue.editOperation.type')}</Label>
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
                  <Label>{t('revenue.editOperation.accountAffected')}</Label>
                  <Select
                    value={editingCash.accountAffected}
                    onValueChange={(v) => setEditingCash({ ...editingCash, accountAffected: v as any })}
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
              <div className="space-y-2">
                <Label>{t('revenue.editOperation.counterpartyDetails')}</Label>
                <Input
                  value={editingCash.accountDetails || ''}
                  onChange={(e) => setEditingCash({ ...editingCash, accountDetails: e.target.value })}
                  placeholder={t('revenue.editOperation.counterpartyPlaceholder')}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditCashOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleUpdateCash} className="bg-indigo-600 hover:bg-indigo-700 text-white">{t('common.update')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default Revenue;
