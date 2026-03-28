import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useLanguage, useT } from '@/contexts/LanguageContext';
import { supabaseService } from '@/lib/supabaseService';
import { 
  Calculator, Landmark, PieChart, BookOpen, 
  Scale, ArrowRightLeft, TrendingUp, TrendingDown, Wallet, Search, Download, Calendar, ListTree, PlusCircle, Pencil, Trash2, ShieldCheck
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

type ExpenseCatalogItem = {
  id: string;
  code: string;
  designation: string;
  account: string;
  taxable: boolean;
  workflowStatus: 'draft' | 'review' | 'approved';
};
type AccountingEntryItem = {
  id: string;
  date: string;
  journal: string;
  label: string;
  debitAccount: string;
  debit: number;
  creditAccount: string;
  credit: number;
  ref?: string;
  exercice?: string;
  status?: 'draft' | 'review' | 'approved';
};

export default function Accounting() {
  const { language } = useLanguage();
  const t = useT();
  const isAr = language === 'ar';

  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentExercice, setCurrentExercice] = useState('2026');
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [isNewAccountModalOpen, setIsNewAccountModalOpen] = useState(false);
  const [isNewGasClassModalOpen, setIsNewGasClassModalOpen] = useState(false);
  const [isNewExerciceModalOpen, setIsNewExerciceModalOpen] = useState(false);
  const [entries, setEntries] = useState<AccountingEntryItem[]>([]);
  const [accounts, setAccounts] = useState<Array<{ id: string; code: string; label: string; classId: string }>>([
    { id: 'acc-1', code: '5141', label: 'Banques', classId: '5' },
    { id: 'acc-2', code: '3421', label: 'Clients', classId: '3' },
    { id: 'acc-3', code: '4411', label: 'Fournisseurs', classId: '4' },
  ]);
  const [gazClassesState, setGazClassesState] = useState<Array<{ id: string; code: string; label: string; family: string; linkedPcgm: string }>>([
    { id: 'gz-10', code: 'GZ-10', label: 'Distribution Bouteilles Pleines', family: 'Exploitation', linkedPcgm: 'Classe 7' },
    { id: 'gz-20', code: 'GZ-20', label: 'Retours & Consignations', family: 'Cycle Retour', linkedPcgm: 'Classe 4' },
    { id: 'gz-30', code: 'GZ-30', label: 'Coût Logistique Camions', family: 'Transport', linkedPcgm: 'Classe 6' },
    { id: 'gz-40', code: 'GZ-40', label: 'Maintenance Parc & Dépôts', family: 'Maintenance', linkedPcgm: 'Classe 6' },
  ]);
  const [exercices, setExercices] = useState<Array<{ id: string; code: string; startDate: string; endDate: string; status: 'open' | 'closed' }>>([
    { id: 'ex-2026', code: 'EX-2026', startDate: '2026-01-01', endDate: '2026-12-31', status: 'open' },
    { id: 'ex-2025', code: 'EX-2025', startDate: '2025-01-01', endDate: '2025-12-31', status: 'closed' },
  ]);
  const [accountForm, setAccountForm] = useState({ code: '', label: '', classId: '5' });
  const [gazClassForm, setGazClassForm] = useState({ code: '', label: '', family: '', linkedPcgm: 'Classe 6' });
  const [exerciceForm, setExerciceForm] = useState({ code: '', startDate: '', endDate: '' });
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editingGazClassId, setEditingGazClassId] = useState<string | null>(null);
  const [expenseCatalog, setExpenseCatalog] = useState<ExpenseCatalogItem[]>([]);
  const [expenseSearchTerm, setExpenseSearchTerm] = useState('');
  const [isExpenseCodeModalOpen, setIsExpenseCodeModalOpen] = useState(false);
  const [editingExpenseCodeId, setEditingExpenseCodeId] = useState<string | null>(null);
  const [expenseCodeForm, setExpenseCodeForm] = useState({
    code: '',
    designation: '',
    account: '',
    taxable: false,
  });
  const [entryForm, setEntryForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    journal: 'achats',
    label: '',
    debitAccount: '5141',
    debit: '0',
    creditAccount: '3421',
    credit: '0',
  });

  const containerVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } }
  };

  const formatMAD = (amount: number) => {
    return new Intl.NumberFormat(isAr ? 'ar-MA' : 'fr-MA', {
      style: 'currency',
      currency: 'MAD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const pcgmClasses = [
    { id: '1', name: t('accounting.classes.c1', 'Classe 1: Comptes de financement permanent'), color: 'bg-blue-50 text-blue-700 border-blue-200' },
    { id: '2', name: t('accounting.classes.c2', 'Classe 2: Comptes d\'actif immobilisé'), color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    { id: '3', name: t('accounting.classes.c3', 'Classe 3: Comptes d\'actif circulant'), color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    { id: '4', name: t('accounting.classes.c4', 'Classe 4: Comptes de passif circulant'), color: 'bg-amber-50 text-amber-700 border-amber-200' },
    { id: '5', name: t('accounting.classes.c5', 'Classe 5: Comptes de trésorerie'), color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
    { id: '6', name: t('accounting.classes.c6', 'Classe 6: Comptes de charges'), color: 'bg-rose-50 text-rose-700 border-rose-200' },
    { id: '7', name: t('accounting.classes.c7', 'Classe 7: Comptes de produits'), color: 'bg-green-50 text-green-700 border-green-200' },
  ];
  const scannedExpenseCatalog = React.useMemo<Array<{ code: string; designation: string; account: string; taxable: boolean }>>(() => [
    { code: 'ACH AUTR', designation: 'CHARGE DIVERS', account: '6126000', taxable: false },
    { code: 'AV DEF', designation: 'AVOIR DIFFER RESERV ETRG', account: '6126034', taxable: false },
    { code: 'BON CRE', designation: 'BON CAISSE CREDIT', account: '6126000', taxable: false },
    { code: 'BON ALI', designation: 'BON BAALOUACH ALI', account: '6126002', taxable: false },
    { code: 'BON KHO', designation: 'DEPOTS KHOURIBGA', account: '6126000', taxable: false },
    { code: 'BON OUEZ', designation: 'BON OUED ZEM', account: '6126004', taxable: false },
    { code: 'CAI CLL', designation: 'CAISSE CLIENT', account: '6126001', taxable: false },
    { code: 'CAI ECA', designation: 'CAISSE ECART', account: '6126011', taxable: false },
    { code: 'CH CONDP', designation: 'FRAIS DEPOTS CONSTRUCTION', account: '6126015', taxable: false },
    { code: 'CHA ADMP', designation: 'CHARGE ADMINSTRATIVE PUB', account: '6126030', taxable: false },
    { code: 'CHA ALCH', designation: 'ALIMENTATION CHIEN', account: '6126012', taxable: false },
    { code: 'CHA COMP', designation: 'FRAIS COMPTABLE', account: '6126013', taxable: false },
    { code: 'CHA ELIC', designation: 'ELECTRICITE/EAU', account: '6125106', taxable: false },
    { code: 'CHA FBQE', designation: 'FRAIS BANCAIRE', account: '6147000', taxable: false },
    { code: 'CHA FBUR', designation: 'FOURNITURE BUREAU', account: '6127017', taxable: false },
    { code: 'CHA LOCA', designation: 'LOCATION VEHICULE', account: '6126018', taxable: false },
    { code: 'CHA LOG', designation: 'INFORMATIQUE LOGICIEL', account: '6135103', taxable: false },
    { code: 'CHA LOYE', designation: 'LOYER DE MAISON', account: '6131200', taxable: false },
    { code: 'CHA TELE', designation: 'TELEPHONE', account: '6145520', taxable: false },
    { code: 'CHA TELV', designation: 'TELEPHONE LIVREUR', account: '6145521', taxable: false },
    { code: 'CHQ AUT', designation: 'CHEQUES', account: '6126000', taxable: false },
    { code: 'CRD OUV', designation: 'CREDIT OUVRIER', account: '6126032', taxable: false },
    { code: 'DEP AUT', designation: 'AUTOROUTES', account: '6143100', taxable: true },
    { code: 'DEP AUTR', designation: 'AUTRE DEPENSES', account: '6126000', taxable: true },
    { code: 'DEP PARK', designation: 'PARKING', account: '6126000', taxable: true },
    { code: 'DON FACT', designation: 'FACTURE', account: '6146300', taxable: false },
    { code: 'DON FIC', designation: 'FRAIS DE ROUTE', account: '6147510', taxable: false },
    { code: 'DON GASO', designation: 'DON GASOIL', account: '6146600', taxable: false },
    { code: 'DON REST', designation: 'CHARGE RESTAURANT', account: '6143740', taxable: false },
    { code: 'GAS CLAR', designation: 'GASOIL CLARK', account: '6122310', taxable: false },
    { code: 'GAS DEP', designation: 'GASOIL CAMIONS', account: '6122320', taxable: false },
    { code: 'GAS IFAT', designation: 'GASOIL VEHICULE SERVICE', account: '6122330', taxable: false },
    { code: 'GAS TRAN', designation: 'GASOIL TRANSPORT PERS', account: '6122360', taxable: false },
    { code: 'REP CLAR', designation: 'REPARATION CLARK', account: '6137900', taxable: false },
    { code: 'REP HUIL', designation: 'ACHAT HUIL MOTEUR', account: '6133200', taxable: false },
    { code: 'REP INFO', designation: 'REPERATION INFORMATIQUE', account: '6137300', taxable: false },
    { code: 'REP LAVA', designation: 'LAVAGE', account: '6133400', taxable: false },
    { code: 'REP PIEC', designation: 'PIECE D ETACHES', account: '6133500', taxable: false },
    { code: 'REP PNEU', designation: 'PNEUX', account: '6133600', taxable: false },
    { code: 'REP VDA', designation: 'VIDANGE', account: '6133000', taxable: false },
    { code: 'SAL ADMI', designation: 'OUVRIER ADMINISTRATIVE', account: '6171100', taxable: false },
    { code: 'SAL DEPL', designation: 'DEPLACEMENT VOYAGE', account: '6171400', taxable: false },
    { code: 'SAL LIVR', designation: 'SALAIRE LIVR COM+FIX', account: '6171600', taxable: false },
    { code: 'SAL MEC', designation: 'OUVRIER MECANIQUE', account: '6171700', taxable: false },
    { code: 'SAL RMK', designation: 'SALAIRE RMK CHAUFFEUR', account: '6171170', taxable: false },
    { code: 'TAX ANN', designation: 'TAXE ANNUELLE', account: '6167500', taxable: false },
    { code: 'TAX ASS', designation: 'ASSURANCE', account: '6134100', taxable: false },
    { code: 'TAX CG', designation: 'TAXE CARTE GRISE', account: '61674002', taxable: false },
    { code: 'TAX PCIR', designation: 'TAXE PERMIS DE CIRCULER', account: '6134110', taxable: false },
    { code: 'TAX TR', designation: 'TAXE SUR LES TRANSPORTS', account: '6175100', taxable: false },
    { code: 'TAX TVA', designation: 'TVA', account: '6126000', taxable: false },
    { code: 'TAX VGN', designation: 'VIGNETTE', account: '6167300', taxable: false },
    { code: 'VTE BUT', designation: 'VENTE BUTANE', account: '71114000', taxable: true },
    { code: 'VTE CONS', designation: 'VENTE CONSIGNE', account: '71115000', taxable: true },
    { code: 'ZAX TVA', designation: 'TVA OUED ZEM', account: '61261002', taxable: false },
    { code: 'ZAX VOIT', designation: 'TRAITE VOITURE DE SERVIC', account: '61671003', taxable: false },
  ], []);
  useEffect(() => {
    const loadV2Data = async () => {
      const [loadedAccounts, loadedGazClasses, loadedExercices, loadedExpenseCatalog, loadedEntries] = await Promise.all([
        supabaseService.getAll<Array<{ id: string; code: string; label: string; classId: string }>[number]>('accounting_accounts'),
        supabaseService.getAll<Array<{ id: string; code: string; label: string; family: string; linkedPcgm: string }>[number]>('accounting_gaz_classes'),
        supabaseService.getAll<Array<{ id: string; code: string; startDate: string; endDate: string; status: 'open' | 'closed' }>[number]>('accounting_exercices'),
        supabaseService.getAll<ExpenseCatalogItem>('accounting_expense_codes'),
        supabaseService.getAll<AccountingEntryItem>('accounting_entries'),
      ]);
      if (loadedAccounts.length) setAccounts(loadedAccounts);
      if (loadedGazClasses.length) setGazClassesState(loadedGazClasses);
      if (loadedExercices.length) setExercices(loadedExercices);
      setEntries(loadedEntries);
      if (loadedExpenseCatalog.length) {
        setExpenseCatalog(loadedExpenseCatalog);
      } else {
        setExpenseCatalog(
          scannedExpenseCatalog.map((item) => ({
            ...item,
            id: window.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2),
            workflowStatus: 'approved',
          }))
        );
      }
    };
    loadV2Data();
  }, []);

  const handleExport = () => {
    toast.success(t('accounting.actions.exported', 'Exportation réussie'));
  };

  const handleSaveEntry = async () => {
    const debitAmount = Number(entryForm.debit);
    const creditAmount = Number(entryForm.credit);
    if (!entryForm.label.trim() || !entryForm.debitAccount.trim() || !entryForm.creditAccount.trim() || debitAmount <= 0 || creditAmount <= 0) {
      toast.error(t('accounting.newEntryModal.desc', 'Entrez les détails de la transaction comptable.'));
      return;
    }
    const next: AccountingEntryItem = {
      id: window.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2),
      date: entryForm.date,
      journal: entryForm.journal,
      label: entryForm.label.trim(),
      debitAccount: entryForm.debitAccount.trim(),
      debit: debitAmount,
      creditAccount: entryForm.creditAccount.trim(),
      credit: creditAmount,
      ref: `${entryForm.debitAccount.trim()}→${entryForm.creditAccount.trim()}`,
      exercice: currentExercice,
      status: 'draft',
    };
    setEntries((prev) => [next, ...prev]);
    await supabaseService.create('accounting_entries', next);
    toast.success(t('accounting.actions.saved', 'Enregistré avec succès'));
    setIsEntryModalOpen(false);
    setEntryForm({
      date: new Date().toISOString().slice(0, 10),
      journal: 'achats',
      label: '',
      debitAccount: '5141',
      debit: '0',
      creditAccount: '3421',
      credit: '0',
    });
  };

  const handleSaveAccount = async () => {
    if (!accountForm.code.trim() || !accountForm.label.trim()) {
      toast.error(t('accounting.newEntryModal.desc', 'Entrez les détails de la transaction comptable.'));
      return;
    }
    const next = {
      id: editingAccountId ?? (window.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)),
      code: accountForm.code.trim(),
      label: accountForm.label.trim(),
      classId: accountForm.classId,
    };
    if (editingAccountId) {
      setAccounts((prev) => prev.map((item) => (item.id === editingAccountId ? next : item)));
      await supabaseService.update('accounting_accounts', editingAccountId, next);
    } else {
      setAccounts((prev) => [next, ...prev.filter((item) => item.code !== next.code)]);
      await supabaseService.create('accounting_accounts', next);
    }
    toast.success(t('accounting.actions.saved', 'Enregistré avec succès'));
    setIsNewAccountModalOpen(false);
    setAccountForm({ code: '', label: '', classId: '5' });
    setEditingAccountId(null);
  };
  const handleSaveGazClass = async () => {
    if (!gazClassForm.code.trim() || !gazClassForm.label.trim() || !gazClassForm.family.trim()) {
      toast.error(t('accounting.newEntryModal.desc', 'Entrez les détails de la transaction comptable.'));
      return;
    }
    const next = {
      id: editingGazClassId ?? (window.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)),
      code: gazClassForm.code.trim(),
      label: gazClassForm.label.trim(),
      family: gazClassForm.family.trim(),
      linkedPcgm: gazClassForm.linkedPcgm,
    };
    if (editingGazClassId) {
      setGazClassesState((prev) => prev.map((item) => (item.id === editingGazClassId ? next : item)));
      await supabaseService.update('accounting_gaz_classes', editingGazClassId, next);
    } else {
      setGazClassesState((prev) => [next, ...prev.filter((item) => item.code !== next.code)]);
      await supabaseService.create('accounting_gaz_classes', next);
    }
    toast.success(t('accounting.actions.saved', 'Enregistré avec succès'));
    setIsNewGasClassModalOpen(false);
    setGazClassForm({ code: '', label: '', family: '', linkedPcgm: 'Classe 6' });
    setEditingGazClassId(null);
  };
  const handleActionToast = (message: string) => {
    toast.success(message);
  };
  const handleSaveExercice = async () => {
    if (!exerciceForm.code.trim() || !exerciceForm.startDate || !exerciceForm.endDate) {
      toast.error(t('accounting.newEntryModal.desc', 'Entrez les détails de la transaction comptable.'));
      return;
    }
    const next = {
      id: window.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2),
      code: exerciceForm.code.trim(),
      startDate: exerciceForm.startDate,
      endDate: exerciceForm.endDate,
      status: 'open' as const,
    };
    setExercices((prev) => [next, ...prev.filter((item) => item.code !== next.code)]);
    await supabaseService.create('accounting_exercices', next);
    toast.success(t('accounting.actions.saved', 'Enregistré avec succès'));
    setIsNewExerciceModalOpen(false);
    setExerciceForm({ code: '', startDate: '', endDate: '' });
  };
  const openCreateExpenseCode = () => {
    setEditingExpenseCodeId(null);
    setExpenseCodeForm({ code: '', designation: '', account: '', taxable: false });
    setIsExpenseCodeModalOpen(true);
  };
  const openEditExpenseCode = (item: ExpenseCatalogItem) => {
    setEditingExpenseCodeId(item.id);
    setExpenseCodeForm({
      code: item.code,
      designation: item.designation,
      account: item.account,
      taxable: item.taxable,
    });
    setIsExpenseCodeModalOpen(true);
  };
  const handleSaveExpenseCode = async () => {
    if (!expenseCodeForm.code.trim() || !expenseCodeForm.designation.trim() || !expenseCodeForm.account.trim()) {
      toast.error(t('accounting.newEntryModal.desc', 'Entrez les détails de la transaction comptable.'));
      return;
    }
    if (editingExpenseCodeId) {
      const updated: ExpenseCatalogItem = {
        id: editingExpenseCodeId,
        code: expenseCodeForm.code.trim(),
        designation: expenseCodeForm.designation.trim(),
        account: expenseCodeForm.account.trim(),
        taxable: expenseCodeForm.taxable,
        workflowStatus: 'review',
      };
      setExpenseCatalog((prev) => prev.map((item) => (item.id === editingExpenseCodeId ? updated : item)));
      await supabaseService.update('accounting_expense_codes', editingExpenseCodeId, updated);
    } else {
      const created: ExpenseCatalogItem = {
        id: window.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2),
        code: expenseCodeForm.code.trim(),
        designation: expenseCodeForm.designation.trim(),
        account: expenseCodeForm.account.trim(),
        taxable: expenseCodeForm.taxable,
        workflowStatus: 'draft',
      };
      setExpenseCatalog((prev) => [created, ...prev.filter((item) => item.code !== created.code)]);
      await supabaseService.create('accounting_expense_codes', created);
    }
    toast.success(t('accounting.actions.saved', 'Enregistré avec succès'));
    setIsExpenseCodeModalOpen(false);
    setExpenseCodeForm({ code: '', designation: '', account: '', taxable: false });
    setEditingExpenseCodeId(null);
  };
  const handleDeleteExpenseCode = async (id: string) => {
    setExpenseCatalog((prev) => prev.filter((item) => item.id !== id));
    await supabaseService.delete('accounting_expense_codes', id);
    toast.success(t('accounting.actions.saved', 'Enregistré avec succès'));
  };
  const handleSetExpenseWorkflow = async (id: string, status: ExpenseCatalogItem['workflowStatus']) => {
    setExpenseCatalog((prev) => prev.map((item) => (item.id === id ? { ...item, workflowStatus: status } : item)));
    await supabaseService.update('accounting_expense_codes', id, { workflowStatus: status });
    toast.success(status === 'approved' ? 'Code approuvé' : 'Code envoyé en revue');
  };
  const handleImportScannedCatalog = async () => {
    const imported = scannedExpenseCatalog.map((item) => ({
      id: window.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2),
      code: item.code,
      designation: item.designation,
      account: item.account,
      taxable: item.taxable,
      workflowStatus: 'approved' as const,
    }));
    setExpenseCatalog((prev) => {
      const byCode = new Map(prev.map((row) => [row.code, row]));
      imported.forEach((row) => byCode.set(row.code, row));
      return Array.from(byCode.values());
    });
    for (const row of imported) {
      await supabaseService.create('accounting_expense_codes', row);
    }
    toast.success('Catalogue des dépenses importé');
  };
  const filteredExpenseCatalog = expenseCatalog.filter((row) => {
    const q = expenseSearchTerm.trim().toLowerCase();
    if (!q) return true;
    return (
      row.code.toLowerCase().includes(q) ||
      row.designation.toLowerCase().includes(q) ||
      row.account.toLowerCase().includes(q) ||
      (row.taxable ? 'true' : 'false').includes(q) ||
      row.workflowStatus.toLowerCase().includes(q)
    );
  });
  const openEditAccount = (item: { id: string; code: string; label: string; classId: string }) => {
    setEditingAccountId(item.id);
    setAccountForm({ code: item.code, label: item.label, classId: item.classId });
    setIsNewAccountModalOpen(true);
  };
  const openEditGazClass = (item: { id: string; code: string; label: string; family: string; linkedPcgm: string }) => {
    setEditingGazClassId(item.id);
    setGazClassForm({ code: item.code, label: item.label, family: item.family, linkedPcgm: item.linkedPcgm });
    setIsNewGasClassModalOpen(true);
  };
  const handleDeleteAccount = async (id: string) => {
    setAccounts((prev) => prev.filter((item) => item.id !== id));
    await supabaseService.delete('accounting_accounts', id);
    toast.success(t('accounting.actions.saved', 'Enregistré avec succès'));
  };
  const handleDeleteGazClass = async (id: string) => {
    setGazClassesState((prev) => prev.filter((item) => item.id !== id));
    await supabaseService.delete('accounting_gaz_classes', id);
    toast.success(t('accounting.actions.saved', 'Enregistré avec succès'));
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Calculator className="w-8 h-8 text-indigo-600" />
            {t('accounting.title', 'Comptabilité Générale')}
          </h1>
          <p className="text-slate-500 mt-1 font-medium">
            {t('accounting.subtitle', 'Plan Comptable Général Marocain (PCGM)')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="bg-white border border-slate-200 rounded-lg flex items-center px-2 py-1 mr-2">
            <Calendar className="w-4 h-4 text-slate-500 mr-2" />
            <Select value={currentExercice} onValueChange={setCurrentExercice}>
              <SelectTrigger className="h-8 border-0 bg-transparent shadow-none focus:ring-0 w-[110px] font-semibold text-indigo-700">
                <SelectValue placeholder={t('accounting.exercice', 'Exercice')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2026">2026</SelectItem>
                <SelectItem value="2025">2025</SelectItem>
                <SelectItem value="2024">2024</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <Button variant="outline" className="bg-white" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            {t('accounting.exportSaisie', 'Exporter les écritures')}
          </Button>
          
          <Dialog open={isEntryModalOpen} onOpenChange={setIsEntryModalOpen}>
            <DialogTrigger asChild>
              <Button className="bg-indigo-600 hover:bg-indigo-700 text-white">
                <PlusCircle className="w-4 h-4 mr-2" />
                {t('accounting.newEntry', 'Nouvelle Écriture')}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>{t('accounting.newEntryModal.title', 'Saisie d\'une nouvelle écriture')}</DialogTitle>
                <DialogDescription>
                  {t('accounting.newEntryModal.desc', 'Entrez les détails de la transaction comptable.')}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t('accounting.date', 'Date')}</Label>
                    <Input type="date" value={entryForm.date} onChange={(e) => setEntryForm((prev) => ({ ...prev, date: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Journal</Label>
                    <Select value={entryForm.journal} onValueChange={(val) => setEntryForm((prev) => ({ ...prev, journal: val }))}>
                      <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="achats">Achats</SelectItem>
                        <SelectItem value="ventes">Ventes</SelectItem>
                        <SelectItem value="banque">Banque</SelectItem>
                        <SelectItem value="od">Opérations Diverses</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t('accounting.label', 'Libellé')}</Label>
                  <Input placeholder="Description de l'opération..." value={entryForm.label} onChange={(e) => setEntryForm((prev) => ({ ...prev, label: e.target.value }))} />
                </div>
                {/* Simplified entry lines for demo */}
                <div className="border rounded-lg p-3 bg-slate-50 space-y-3 mt-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase">Lignes d'écriture</p>
                  <div className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-4"><Input placeholder="Compte Débit" value={entryForm.debitAccount} onChange={(e) => setEntryForm((prev) => ({ ...prev, debitAccount: e.target.value }))} className="h-8 text-sm" /></div>
                    <div className="col-span-4"><Input placeholder="Débit" value={entryForm.debit} onChange={(e) => setEntryForm((prev) => ({ ...prev, debit: e.target.value }))} className="h-8 text-sm text-right" /></div>
                    <div className="col-span-4"><Input placeholder="Crédit" value={entryForm.credit} onChange={(e) => setEntryForm((prev) => ({ ...prev, credit: e.target.value }))} className="h-8 text-sm text-right" /></div>
                  </div>
                  <div className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-4"><Input placeholder="Compte Crédit" value={entryForm.creditAccount} onChange={(e) => setEntryForm((prev) => ({ ...prev, creditAccount: e.target.value }))} className="h-8 text-sm" /></div>
                    <div className="col-span-4"><Input placeholder="Débit" value="0" readOnly className="h-8 text-sm text-right" /></div>
                    <div className="col-span-4"><Input placeholder="Crédit" value={entryForm.credit} readOnly className="h-8 text-sm text-right" /></div>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsEntryModalOpen(false)}>
                  {t('accounting.actions.cancel', 'Annuler')}
                </Button>
                <Button onClick={handleSaveEntry} className="bg-indigo-600 hover:bg-indigo-700">
                  {t('accounting.actions.save', 'Enregistrer')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-slate-100/80 p-1 rounded-xl w-full justify-start overflow-x-auto flex-nowrap h-auto mb-6 border border-slate-200 shadow-sm">
          <TabsTrigger value="dashboard" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm py-2 px-4 text-sm font-semibold">
            <PieChart className="w-4 h-4 mr-2" /> {t('accounting.tabs.dashboard', 'Tableau de bord')}
          </TabsTrigger>
          <TabsTrigger value="journal" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm py-2 px-4 text-sm font-semibold">
            <BookOpen className="w-4 h-4 mr-2" /> {t('accounting.tabs.journal', 'Journal Général')}
          </TabsTrigger>
          <TabsTrigger value="ledger" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm py-2 px-4 text-sm font-semibold">
            <Landmark className="w-4 h-4 mr-2" /> {t('accounting.tabs.ledger', 'Grand Livre')}
          </TabsTrigger>
          <TabsTrigger value="balance" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm py-2 px-4 text-sm font-semibold">
            <Scale className="w-4 h-4 mr-2" /> {t('accounting.tabs.balance', 'Balance')}
          </TabsTrigger>
          <TabsTrigger value="cpc" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm py-2 px-4 text-sm font-semibold">
            <ArrowRightLeft className="w-4 h-4 mr-2" /> {t('accounting.tabs.cpc', 'CPC & Bilan')}
          </TabsTrigger>
          <TabsTrigger value="tva" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm py-2 px-4 text-sm font-semibold">
            <Wallet className="w-4 h-4 mr-2" /> {t('accounting.tabs.tva', 'Déclaration TVA')}
          </TabsTrigger>
          <TabsTrigger value="exercices" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm py-2 px-4 text-sm font-semibold">
            <Calendar className="w-4 h-4 mr-2" /> {t('accounting.tabs.exercices', 'Exercices')}
          </TabsTrigger>
          <TabsTrigger value="plan" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm py-2 px-4 text-sm font-semibold">
            <ListTree className="w-4 h-4 mr-2" /> {t('accounting.tabs.plan', 'Plan Comptable')}
          </TabsTrigger>
        </TabsList>

        <motion.div variants={containerVariants} initial="hidden" animate="visible" key={activeTab}>
          
          <TabsContent value="dashboard" className="mt-0 space-y-6 focus-visible:outline-none">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="border-emerald-200 bg-emerald-50/50 shadow-sm">
                <CardContent className="p-5">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-bold text-emerald-800 uppercase tracking-wider">{t('accounting.kpi.revenue', 'Chiffre d\'Affaires')}</p>
                      <h3 className="text-2xl font-black text-slate-900 mt-2">{formatMAD(452000)}</h3>
                    </div>
                    <div className="p-3 bg-emerald-100 rounded-xl">
                      <TrendingUp className="w-5 h-5 text-emerald-700" />
                    </div>
                  </div>
                  <p className="text-xs text-emerald-600 mt-3 font-medium">+12.5% {t('accounting.vsLastMonth', 'vs mois précédent')}</p>
                </CardContent>
              </Card>

              <Card className="border-rose-200 bg-rose-50/50 shadow-sm">
                <CardContent className="p-5">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-bold text-rose-800 uppercase tracking-wider">{t('accounting.kpi.expenses', 'Charges (Cl 6)')}</p>
                      <h3 className="text-2xl font-black text-slate-900 mt-2">{formatMAD(285400)}</h3>
                    </div>
                    <div className="p-3 bg-rose-100 rounded-xl">
                      <TrendingDown className="w-5 h-5 text-rose-700" />
                    </div>
                  </div>
                  <p className="text-xs text-rose-600 mt-3 font-medium">+5.2% {t('accounting.vsLastMonth', 'vs mois précédent')}</p>
                </CardContent>
              </Card>

              <Card className="border-indigo-200 bg-indigo-50/50 shadow-sm">
                <CardContent className="p-5">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-bold text-indigo-800 uppercase tracking-wider">{t('accounting.kpi.result', 'Résultat Net')}</p>
                      <h3 className="text-2xl font-black text-slate-900 mt-2">{formatMAD(166600)}</h3>
                    </div>
                    <div className="p-3 bg-indigo-100 rounded-xl">
                      <Scale className="w-5 h-5 text-indigo-700" />
                    </div>
                  </div>
                  <p className="text-xs text-indigo-600 mt-3 font-medium">{t('accounting.estimated', 'Estimation courante')}</p>
                </CardContent>
              </Card>

              <Card className="border-sky-200 bg-sky-50/50 shadow-sm">
                <CardContent className="p-5">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-bold text-sky-800 uppercase tracking-wider">{t('accounting.kpi.treasury', 'Trésorerie Actif')}</p>
                      <h3 className="text-2xl font-black text-slate-900 mt-2">{formatMAD(845000)}</h3>
                    </div>
                    <div className="p-3 bg-sky-100 rounded-xl">
                      <Landmark className="w-5 h-5 text-sky-700" />
                    </div>
                  </div>
                  <p className="text-xs text-sky-600 mt-3 font-medium">Banques & Caisses (5141, 5161)</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2 shadow-sm border-slate-200">
                <CardHeader>
                  <CardTitle className="text-lg">{t('accounting.dashboard.recentEntries', 'Dernières Écritures Comptables')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead>{t('accounting.date', 'Date')}</TableHead>
                          <TableHead>{t('accounting.account', 'Compte')}</TableHead>
                          <TableHead>{t('accounting.label', 'Libellé')}</TableHead>
                          <TableHead className="text-right text-emerald-700 font-bold">{t('accounting.debit', 'Débit')}</TableHead>
                          <TableHead className="text-right text-rose-700 font-bold">{t('accounting.credit', 'Crédit')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {entries.map((entry) => (
                          <TableRow key={entry.id}>
                            <TableCell className="text-slate-500 text-xs">{entry.date}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="font-mono bg-slate-50">{entry.debitAccount}</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="font-medium text-sm">{entry.label}</div>
                              <div className="text-xs text-slate-400">{entry.ref || '-'}</div>
                            </TableCell>
                            <TableCell className="text-right font-medium text-emerald-600">
                              {entry.debit > 0 ? formatMAD(entry.debit) : '-'}
                            </TableCell>
                            <TableCell className="text-right font-medium text-rose-600">
                              {entry.credit > 0 ? formatMAD(entry.credit) : '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm border-slate-200">
                <CardHeader>
                  <CardTitle className="text-lg">{t('accounting.dashboard.tvaSummary', 'Aperçu TVA')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex justify-between items-center">
                    <div>
                      <p className="text-xs font-bold text-slate-500 uppercase">TVA Facturée (4455)</p>
                      <p className="text-lg font-black text-slate-900">{formatMAD(45200)}</p>
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex justify-between items-center">
                    <div>
                      <p className="text-xs font-bold text-slate-500 uppercase">TVA Récupérable (3455)</p>
                      <p className="text-lg font-black text-slate-900">{formatMAD(28600)}</p>
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-100 flex justify-between items-center">
                    <div>
                      <p className="text-xs font-bold text-indigo-700 uppercase">TVA Due (Estimée)</p>
                      <p className="text-xl font-black text-indigo-900">{formatMAD(16600)}</p>
                    </div>
                  </div>
                  <Button className="w-full" variant="outline">{t('accounting.tva.prepare', 'Préparer la déclaration')}</Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Placeholder for other tabs - In a real app these would be separate components */}
          <TabsContent value="journal" className="mt-0 focus-visible:outline-none">
            <Card className="shadow-sm border-slate-200 min-h-[500px]">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-xl">{t('accounting.tabs.journal', 'Journal Général')}</CardTitle>
                  <CardDescription>{t('accounting.journal.desc', 'Saisie et consultation des écritures comptables')}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input placeholder={t('accounting.search', 'Rechercher...')} className="pl-9 w-[250px] bg-slate-50" />
                  </div>
                  <Button variant="outline" onClick={() => handleActionToast('Filtres journal appliqués')}>
                    <FilterIcon className="w-4 h-4 mr-2" /> Filtres
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead>{t('accounting.date', 'Date')}</TableHead>
                          <TableHead>Journal</TableHead>
                          <TableHead>{t('accounting.account', 'Compte')}</TableHead>
                          <TableHead>{t('accounting.label', 'Libellé')}</TableHead>
                          <TableHead className="text-right text-emerald-700 font-bold">{t('accounting.debit', 'Débit')}</TableHead>
                          <TableHead className="text-right text-rose-700 font-bold">{t('accounting.credit', 'Crédit')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {entries.map((entry) => (
                          <TableRow key={entry.id}>
                            <TableCell className="text-slate-500 text-xs">{entry.date}</TableCell>
                            <TableCell><Badge variant="secondary" className="bg-indigo-50 text-indigo-700 hover:bg-indigo-50">{entry.journal.toUpperCase()}</Badge></TableCell>
                            <TableCell>
                              <Badge variant="outline" className="font-mono bg-slate-50">{entry.debitAccount}</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="font-medium text-sm">{entry.label}</div>
                              <div className="text-xs text-slate-400">{entry.ref || '-'}</div>
                            </TableCell>
                            <TableCell className="text-right font-medium text-emerald-600">
                              {entry.debit > 0 ? formatMAD(entry.debit) : '-'}
                            </TableCell>
                            <TableCell className="text-right font-medium text-rose-600">
                              {entry.credit > 0 ? formatMAD(entry.credit) : '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ledger" className="mt-0 focus-visible:outline-none">
             <Card className="shadow-sm border-slate-200 min-h-[500px]">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-xl">{t('accounting.tabs.ledger', 'Grand Livre')}</CardTitle>
                  <CardDescription>{t('accounting.ledger.desc', 'Détail des mouvements par compte comptable')}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Select defaultValue="5141">
                    <SelectTrigger className="w-[250px]">
                      <SelectValue placeholder="Choisir un compte" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5141">5141 - Banques</SelectItem>
                      <SelectItem value="3421">3421 - Clients</SelectItem>
                      <SelectItem value="4411">4411 - Fournisseurs</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" onClick={() => handleActionToast('Filtre Grand Livre appliqué')}>
                    <FilterIcon className="w-4 h-4 mr-2" /> Filtres
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <div className="bg-slate-50 p-4 border-b border-slate-200 flex justify-between items-center">
                    <div>
                      <h3 className="font-bold text-slate-800">5141 - Banques</h3>
                      <p className="text-sm text-slate-500">Solde initial: {formatMAD(150000)} (Débiteur)</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-slate-500">Solde final</p>
                      <h3 className="font-bold text-indigo-700">{formatMAD(165000)}</h3>
                    </div>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Libellé</TableHead>
                        <TableHead className="text-right">Débit</TableHead>
                        <TableHead className="text-right">Crédit</TableHead>
                        <TableHead className="text-right">Solde</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="text-slate-500 text-xs">2026-03-27</TableCell>
                        <TableCell className="text-sm">Virement Client X</TableCell>
                        <TableCell className="text-right text-emerald-600 font-medium">{formatMAD(15000)}</TableCell>
                        <TableCell className="text-right text-rose-600 font-medium">-</TableCell>
                        <TableCell className="text-right font-bold text-slate-700">{formatMAD(165000)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="balance" className="mt-0 focus-visible:outline-none">
             <Card className="shadow-sm border-slate-200 min-h-[500px]">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-xl">{t('accounting.tabs.balance', 'Balance Générale')}</CardTitle>
                  <CardDescription>{t('accounting.balance.desc', 'Balance des comptes à 6 colonnes')}</CardDescription>
                </div>
                <Button variant="outline" onClick={handleExport}><Download className="w-4 h-4 mr-2" /> Exporter</Button>
              </CardHeader>
              <CardContent>
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead rowSpan={2} className="border-r border-slate-200 align-middle">Compte</TableHead>
                        <TableHead rowSpan={2} className="border-r border-slate-200 align-middle">Intitulé</TableHead>
                        <TableHead colSpan={2} className="text-center border-r border-slate-200">Mouvements</TableHead>
                        <TableHead colSpan={2} className="text-center">Soldes</TableHead>
                      </TableRow>
                      <TableRow>
                        <TableHead className="text-right">Débit</TableHead>
                        <TableHead className="text-right border-r border-slate-200">Crédit</TableHead>
                        <TableHead className="text-right">Débiteur</TableHead>
                        <TableHead className="text-right">Créditeur</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-mono text-sm border-r border-slate-100">3421</TableCell>
                        <TableCell className="border-r border-slate-100 font-medium">Clients</TableCell>
                        <TableCell className="text-right border-r border-slate-100">{formatMAD(45000)}</TableCell>
                        <TableCell className="text-right border-r border-slate-200">{formatMAD(15000)}</TableCell>
                        <TableCell className="text-right text-emerald-700 font-bold border-r border-slate-100">{formatMAD(30000)}</TableCell>
                        <TableCell className="text-right text-rose-700 font-bold">-</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-mono text-sm border-r border-slate-100">4411</TableCell>
                        <TableCell className="border-r border-slate-100 font-medium">Fournisseurs</TableCell>
                        <TableCell className="text-right border-r border-slate-100">{formatMAD(10000)}</TableCell>
                        <TableCell className="text-right border-r border-slate-200">{formatMAD(35000)}</TableCell>
                        <TableCell className="text-right text-emerald-700 font-bold border-r border-slate-100">-</TableCell>
                        <TableCell className="text-right text-rose-700 font-bold">{formatMAD(25000)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cpc" className="mt-0 focus-visible:outline-none">
             <Card className="shadow-sm border-slate-200 min-h-[500px]">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-xl">{t('accounting.tabs.cpc', 'États de Synthèse (Bilan & CPC)')}</CardTitle>
                  <CardDescription>{t('accounting.cpc.desc', 'Génération automatique des états financiers selon le PCGM')}</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => handleActionToast('Génération du Bilan démarrée')}>
                    <PieChart className="w-4 h-4 mr-2" /> Générer Bilan
                  </Button>
                  <Button variant="outline" onClick={() => handleActionToast('Génération du CPC démarrée')}>
                    <ArrowRightLeft className="w-4 h-4 mr-2" /> Générer CPC
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                 <div className="flex flex-col items-center justify-center py-20 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                  <PieChart className="w-16 h-16 mb-4 text-slate-300" />
                  <p className="text-lg font-medium text-slate-600">Module de liasse fiscale en cours de développement</p>
                  <p className="text-sm text-slate-400 mt-2">Bilan, CPC, ESG, Tableau de financement</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tva" className="mt-0 focus-visible:outline-none">
             <Card className="shadow-sm border-slate-200 min-h-[500px]">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-xl">{t('accounting.tabs.tva', 'Déclaration de TVA')}</CardTitle>
                  <CardDescription>{t('accounting.tva.desc', 'Rapprochement et génération du fichier EDI pour la DGI')}</CardDescription>
                </div>
                <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => handleActionToast('Génération EDI démarrée')}>
                  <Download className="w-4 h-4 mr-2" /> Générer Fichier EDI
                </Button>
              </CardHeader>
              <CardContent>
                 <div className="grid md:grid-cols-2 gap-6">
                    <Card className="border-indigo-100 shadow-none">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-bold text-slate-500 uppercase">TVA Facturée (Exigible)</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-black text-slate-900">{formatMAD(45200)}</div>
                        <p className="text-sm text-slate-500 mt-1">Base HT: {formatMAD(226000)}</p>
                      </CardContent>
                    </Card>
                    <Card className="border-indigo-100 shadow-none">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-bold text-slate-500 uppercase">TVA Récupérable (Déductible)</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-black text-slate-900">{formatMAD(28600)}</div>
                        <p className="text-sm text-slate-500 mt-1">Base HT: {formatMAD(143000)}</p>
                      </CardContent>
                    </Card>
                 </div>
                 <div className="mt-6 p-6 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-indigo-900">TVA Due à payer</h3>
                      <p className="text-indigo-700 text-sm">Période: Mars 2026</p>
                    </div>
                    <div className="text-3xl font-black text-indigo-700">{formatMAD(16600)}</div>
                 </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="plan" className="mt-0 focus-visible:outline-none">
             <Card className="shadow-sm border-slate-200 min-h-[500px]">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-xl">{t('accounting.plan.title', 'Plan Comptable Marocain')}</CardTitle>
                  <CardDescription>{t('accounting.plan.desc', 'Classes 1 à 7 du PCGM')}</CardDescription>
                </div>
                 <div className="flex gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input placeholder={t('accounting.search', 'Rechercher...')} className="pl-9 w-[250px] bg-slate-50" />
                  </div>
                   <Dialog open={isNewGasClassModalOpen} onOpenChange={setIsNewGasClassModalOpen}>
                     <DialogTrigger asChild>
                       <Button variant="outline">
                         <PlusCircle className="w-4 h-4 mr-2" />
                         {t('accounting.plan.newGazClass', 'Nouvelle Classe Gaz')}
                       </Button>
                     </DialogTrigger>
                     <DialogContent className="sm:max-w-[480px]">
                       <DialogHeader>
                        <DialogTitle>{editingGazClassId ? 'Modifier Classe Gaz' : t('accounting.plan.newGazClass', 'Nouvelle Classe Gaz')}</DialogTitle>
                         <DialogDescription>{t('accounting.plan.newGazClassDesc', 'Créer une classe sectorielle dédiée au gaz')}</DialogDescription>
                       </DialogHeader>
                       <div className="grid gap-4 py-4">
                         <div className="space-y-2">
                           <Label>Code Classe</Label>
                          <Input placeholder="Ex: GZ-50" value={gazClassForm.code} onChange={(e) => setGazClassForm((prev) => ({ ...prev, code: e.target.value }))} />
                         </div>
                         <div className="space-y-2">
                           <Label>Libellé</Label>
                          <Input placeholder="Ex: Frais de consignation circuit secondaire" value={gazClassForm.label} onChange={(e) => setGazClassForm((prev) => ({ ...prev, label: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                          <Label>Famille</Label>
                          <Input placeholder="Ex: Exploitation" value={gazClassForm.family} onChange={(e) => setGazClassForm((prev) => ({ ...prev, family: e.target.value }))} />
                         </div>
                         <div className="space-y-2">
                           <Label>Classe PCGM liée</Label>
                          <Select value={gazClassForm.linkedPcgm} onValueChange={(val) => setGazClassForm((prev) => ({ ...prev, linkedPcgm: val }))}>
                             <SelectTrigger><SelectValue placeholder="Sélectionner la classe liée" /></SelectTrigger>
                             <SelectContent>
                              <SelectItem value="Classe 3">Classe 3</SelectItem>
                              <SelectItem value="Classe 4">Classe 4</SelectItem>
                              <SelectItem value="Classe 6">Classe 6</SelectItem>
                              <SelectItem value="Classe 7">Classe 7</SelectItem>
                             </SelectContent>
                           </Select>
                         </div>
                       </div>
                       <DialogFooter>
                         <Button variant="outline" onClick={() => setIsNewGasClassModalOpen(false)}>
                           {t('accounting.actions.cancel', 'Annuler')}
                         </Button>
                         <Button onClick={handleSaveGazClass} className="bg-indigo-600 hover:bg-indigo-700">
                           {t('accounting.actions.save', 'Enregistrer')}
                         </Button>
                       </DialogFooter>
                     </DialogContent>
                   </Dialog>
                  <Dialog open={isNewAccountModalOpen} onOpenChange={setIsNewAccountModalOpen}>
                    <DialogTrigger asChild>
                      <Button className="bg-indigo-600 hover:bg-indigo-700 text-white">
                        <PlusCircle className="w-4 h-4 mr-2" />
                         {t('accounting.plan.newAccount', 'Nouveau compte comptable')}
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                      <DialogHeader>
                         <DialogTitle>{editingAccountId ? 'Modifier compte comptable' : t('accounting.plan.newAccount', 'Nouveau compte comptable')}</DialogTitle>
                        <DialogDescription>
                          Créer un nouveau compte dans le plan comptable.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                          <Label>Numéro de compte</Label>
                          <Input placeholder="Ex: 5141" value={accountForm.code} onChange={(e) => setAccountForm((prev) => ({ ...prev, code: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                          <Label>Intitulé du compte</Label>
                          <Input placeholder="Ex: Banques" value={accountForm.label} onChange={(e) => setAccountForm((prev) => ({ ...prev, label: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                          <Label>Classe</Label>
                          <Select value={accountForm.classId} onValueChange={(val) => setAccountForm((prev) => ({ ...prev, classId: val }))}>
                            <SelectTrigger><SelectValue placeholder="Sélectionner la classe" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">Classe 1: Financement permanent</SelectItem>
                              <SelectItem value="2">Classe 2: Actif immobilisé</SelectItem>
                              <SelectItem value="3">Classe 3: Actif circulant</SelectItem>
                              <SelectItem value="4">Classe 4: Passif circulant</SelectItem>
                              <SelectItem value="5">Classe 5: Trésorerie</SelectItem>
                              <SelectItem value="6">Classe 6: Charges</SelectItem>
                              <SelectItem value="7">Classe 7: Produits</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsNewAccountModalOpen(false)}>
                          {t('accounting.actions.cancel', 'Annuler')}
                        </Button>
                        <Button onClick={handleSaveAccount} className="bg-indigo-600 hover:bg-indigo-700">
                          {t('accounting.actions.save', 'Enregistrer')}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  <Button variant="outline" onClick={openCreateExpenseCode}>
                    <PlusCircle className="w-4 h-4 mr-2" />
                    Nouveau code dépense
                  </Button>
                  <Button variant="outline" onClick={handleImportScannedCatalog}>
                    <Download className="w-4 h-4 mr-2" />
                    Importer listes des dépenses
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pcgmClasses.map(cls => (
                    <div key={cls.id} className={`p-4 rounded-xl border ${cls.color} flex items-center justify-between cursor-pointer hover:shadow-md transition-shadow`}>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-white/60 flex items-center justify-center font-black text-lg shadow-sm">
                          {cls.id}
                        </div>
                        <span className="font-semibold">{cls.name}</span>
                      </div>
                      <Button variant="ghost" size="sm" className="bg-white/50 hover:bg-white" onClick={() => handleActionToast(`Ouverture de la classe ${cls.id}`)}>
                        Explorer
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="mt-8 rounded-xl border border-slate-200 overflow-hidden">
                  <div className="bg-slate-50 p-4 flex items-center justify-between border-b border-slate-200">
                    <div>
                      <h3 className="font-bold text-slate-900">{t('accounting.plan.gazTitle', 'Classes sectorielles Gaz')}</h3>
                      <p className="text-sm text-slate-500">{t('accounting.plan.gazDesc', 'Classes internes dédiées à la gestion et distribution du gaz')}</p>
                    </div>
                    <Button variant="outline" onClick={() => { setEditingGazClassId(null); setGazClassForm({ code: '', label: '', family: '', linkedPcgm: 'Classe 6' }); setIsNewGasClassModalOpen(true); }}>
                      <PlusCircle className="w-4 h-4 mr-2" />
                      {t('accounting.plan.newGazClass', 'Nouvelle Classe Gaz')}
                    </Button>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Libellé</TableHead>
                        <TableHead>Famille</TableHead>
                        <TableHead>Classe PCGM</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {gazClassesState.map((item) => (
                        <TableRow key={item.code}>
                          <TableCell className="font-mono text-xs">{item.code}</TableCell>
                          <TableCell className="font-medium">{item.label}</TableCell>
                          <TableCell><Badge variant="secondary">{item.family}</Badge></TableCell>
                          <TableCell>{item.linkedPcgm}</TableCell>
                          <TableCell className="text-right">
                            <div className="inline-flex items-center gap-1">
                              <Button size="sm" variant="outline" onClick={() => openEditGazClass(item)}>
                                <Pencil className="w-3 h-3 mr-1" /> Edit
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => handleDeleteGazClass(item.id)}>
                                <Trash2 className="w-3 h-3 mr-1" /> Delete
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setIsNewAccountModalOpen(true)}>
                                {t('accounting.plan.newAccount', 'Nouveau compte comptable')}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="mt-8 rounded-xl border border-slate-200 overflow-hidden">
                  <div className="bg-slate-50 p-4 flex items-center justify-between border-b border-slate-200">
                    <div>
                      <h3 className="font-bold text-slate-900">{t('accounting.plan.newAccount', 'Nouveau compte comptable')}</h3>
                      <p className="text-sm text-slate-500">Référentiel des comptes opérationnels gaz</p>
                    </div>
                    <Button variant="outline" onClick={() => { setEditingAccountId(null); setAccountForm({ code: '', label: '', classId: '5' }); setIsNewAccountModalOpen(true); }}>
                      <PlusCircle className="w-4 h-4 mr-2" />
                      {t('accounting.plan.newAccount', 'Nouveau compte comptable')}
                    </Button>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Intitulé</TableHead>
                        <TableHead>Classe</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {accounts.map((acc) => (
                        <TableRow key={acc.id}>
                          <TableCell className="font-mono text-xs">{acc.code}</TableCell>
                          <TableCell className="font-medium">{acc.label}</TableCell>
                          <TableCell><Badge variant="outline">{acc.classId}</Badge></TableCell>
                          <TableCell className="text-right">
                            <div className="inline-flex items-center gap-1">
                              <Button size="sm" variant="outline" onClick={() => openEditAccount(acc)}>
                                <Pencil className="w-3 h-3 mr-1" /> Edit
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => handleDeleteAccount(acc.id)}>
                                <Trash2 className="w-3 h-3 mr-1" /> Delete
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="mt-8 rounded-xl border border-slate-200 overflow-hidden">
                  <div className="bg-slate-50 p-4 flex items-center justify-between border-b border-slate-200">
                    <div>
                      <h3 className="font-bold text-slate-900">Liste des dépenses codifiées (scan intégré)</h3>
                      <p className="text-sm text-slate-500">Codes, désignations et comptes reliés au plan comptable gaz</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                          value={expenseSearchTerm}
                          onChange={(e) => setExpenseSearchTerm(e.target.value)}
                          placeholder="Rechercher code / désignation / compte..."
                          className="pl-9 w-[320px] bg-white"
                        />
                      </div>
                      <Button variant="outline" onClick={openCreateExpenseCode}>
                        <PlusCircle className="w-4 h-4 mr-2" />
                        Nouveau code dépense
                      </Button>
                    </div>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Désignation</TableHead>
                        <TableHead>Compte</TableHead>
                        <TableHead>Taxable</TableHead>
                        <TableHead>Workflow</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredExpenseCatalog.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="font-mono text-xs">{row.code}</TableCell>
                          <TableCell className="font-medium">{row.designation}</TableCell>
                          <TableCell className="font-mono">{row.account}</TableCell>
                          <TableCell>{row.taxable ? <Badge className="bg-emerald-100 text-emerald-700 border-none">True</Badge> : <Badge className="bg-slate-200 text-slate-700 border-none">False</Badge>}</TableCell>
                          <TableCell>
                            {row.workflowStatus === 'approved' ? (
                              <Badge className="bg-emerald-100 text-emerald-700 border-none">Approved</Badge>
                            ) : row.workflowStatus === 'review' ? (
                              <Badge className="bg-amber-100 text-amber-700 border-none">Review</Badge>
                            ) : (
                              <Badge className="bg-slate-200 text-slate-700 border-none">Draft</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="inline-flex items-center gap-1">
                              <Button size="sm" variant="outline" onClick={() => openEditExpenseCode(row)}>
                                <Pencil className="w-3 h-3 mr-1" /> Edit
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => handleSetExpenseWorkflow(row.id, row.workflowStatus === 'approved' ? 'review' : 'approved')}>
                                <ShieldCheck className="w-3 h-3 mr-1" /> {row.workflowStatus === 'approved' ? 'Review' : 'Approve'}
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => handleDeleteExpenseCode(row.id)}>
                                <Trash2 className="w-3 h-3 mr-1" /> Delete
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {filteredExpenseCatalog.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-slate-500 py-8">
                            Aucun résultat pour cette recherche
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                <Dialog open={isExpenseCodeModalOpen} onOpenChange={setIsExpenseCodeModalOpen}>
                  <DialogContent className="sm:max-w-[520px]">
                    <DialogHeader>
                      <DialogTitle>{editingExpenseCodeId ? 'Modifier code dépense' : 'Nouveau code dépense'}</DialogTitle>
                      <DialogDescription>Renseigner le code de dépense lié au plan comptable marocain.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label>Code</Label>
                          <Input value={expenseCodeForm.code} onChange={(e) => setExpenseCodeForm((prev) => ({ ...prev, code: e.target.value }))} placeholder="Ex: GAS DEP" />
                        </div>
                        <div className="space-y-2">
                          <Label>Compte</Label>
                          <Input value={expenseCodeForm.account} onChange={(e) => setExpenseCodeForm((prev) => ({ ...prev, account: e.target.value }))} placeholder="Ex: 6122320" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Désignation</Label>
                        <Input value={expenseCodeForm.designation} onChange={(e) => setExpenseCodeForm((prev) => ({ ...prev, designation: e.target.value }))} placeholder="Ex: GASOIL CAMIONS" />
                      </div>
                      <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                        <Label className="text-sm">Taxable</Label>
                        <Select value={expenseCodeForm.taxable ? 'true' : 'false'} onValueChange={(val) => setExpenseCodeForm((prev) => ({ ...prev, taxable: val === 'true' }))}>
                          <SelectTrigger className="w-[120px] h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="true">True</SelectItem>
                            <SelectItem value="false">False</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsExpenseCodeModalOpen(false)}>{t('accounting.actions.cancel', 'Annuler')}</Button>
                      <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={handleSaveExpenseCode}>{t('accounting.actions.save', 'Enregistrer')}</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="exercices" className="mt-0 focus-visible:outline-none">
            <Card className="shadow-sm border-slate-200 min-h-[500px]">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-xl">{t('accounting.tabs.exercices', 'Exercices Comptables')}</CardTitle>
                  <CardDescription>{t('accounting.exercices.desc', 'Gestion des exercices et périodes de clôture')}</CardDescription>
                </div>
                <Dialog open={isNewExerciceModalOpen} onOpenChange={setIsNewExerciceModalOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-indigo-600 hover:bg-indigo-700 text-white">
                      <PlusCircle className="w-4 h-4 mr-2" />
                      {t('accounting.exercices.new', 'Nouvel Exercice')}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[460px]">
                    <DialogHeader>
                      <DialogTitle>{t('accounting.exercices.new', 'Nouvel Exercice')}</DialogTitle>
                      <DialogDescription>{t('accounting.exercices.newDesc', 'Créer un nouvel exercice comptable')}</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="space-y-2">
                        <Label>{t('accounting.exercices.code', 'Code')}</Label>
                        <Input placeholder="EX-2027" value={exerciceForm.code} onChange={(e) => setExerciceForm((prev) => ({ ...prev, code: e.target.value }))} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label>{t('accounting.exercices.startDate', 'Date début')}</Label>
                          <Input type="date" value={exerciceForm.startDate} onChange={(e) => setExerciceForm((prev) => ({ ...prev, startDate: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                          <Label>{t('accounting.exercices.endDate', 'Date fin')}</Label>
                          <Input type="date" value={exerciceForm.endDate} onChange={(e) => setExerciceForm((prev) => ({ ...prev, endDate: e.target.value }))} />
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsNewExerciceModalOpen(false)}>
                        {t('accounting.actions.cancel', 'Annuler')}
                      </Button>
                      <Button onClick={handleSaveExercice} className="bg-indigo-600 hover:bg-indigo-700">
                        {t('accounting.actions.save', 'Enregistrer')}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead>{t('accounting.exercices.code', 'Code')}</TableHead>
                        <TableHead>{t('accounting.exercices.period', 'Période')}</TableHead>
                        <TableHead>{t('accounting.exercices.status', 'Statut')}</TableHead>
                        <TableHead className="text-right">{t('accounting.exercices.actions', 'Actions')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {exercices.map((ex) => (
                        <TableRow key={ex.id}>
                          <TableCell className="font-semibold">{ex.code}</TableCell>
                          <TableCell>{ex.startDate} - {ex.endDate}</TableCell>
                          <TableCell>
                            {ex.status === 'open' ? (
                              <Badge className="bg-emerald-100 text-emerald-700 border-none">{t('accounting.exercices.open', 'Ouvert')}</Badge>
                            ) : (
                              <Badge className="bg-slate-200 text-slate-700 border-none">{t('accounting.exercices.closed', 'Clôturé')}</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {ex.status === 'open' ? (
                              <Button size="sm" variant="outline" onClick={() => handleActionToast('Clôture d\'exercice planifiée')}>{t('accounting.exercices.close', 'Clôturer')}</Button>
                            ) : (
                              <Button size="sm" variant="outline" onClick={() => handleActionToast('Réouverture soumise à validation')}>{t('accounting.exercices.reopen', 'Réouvrir')}</Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

        </motion.div>
      </Tabs>
    </div>
  );
}

function FilterIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  )
}
