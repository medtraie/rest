import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useApp } from '@/contexts/AppContext';
import { useToast } from '@/hooks/use-toast';
import { SupplyOrder, ReturnOrderItem, ExpenseReport } from '@/types';
import { supabaseService } from '@/lib/supabaseService';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, X, Receipt, DollarSign, Package, AlertCircle, Trash2, CreditCard, Wallet, Banknote, Save } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { motion, AnimatePresence } from 'framer-motion';

const CONSIGNE_FEES: Record<string, number> = {
  'Butane 12KG': 50,
  'Butane 6KG': 30,
  'Butane 3KG': 20,
};

const calculatePaymentTotals = (items: ReturnOrderItem[], supplyOrder: SupplyOrder, totalExpenses: number) => {
  if (!items || items.length === 0) {
    return { subtotal: 0, taxAmount: 0, total: 0, consigneFeesTotal: 0 };
  }

  const subtotal = items.reduce((sum, item) => {
    const originalItem = supplyOrder.items.find(orig => orig.bottleTypeId === item.bottleTypeId);
    if (!originalItem) return sum;
    const soldQuantity = Math.max(
      0,
      (originalItem.fullQuantity || 0) - (item.returnedFullQuantity || 0) - (item.defectiveQuantity || 0)
    );
    const unitPrice = item.unitPrice !== undefined ? item.unitPrice : (originalItem.unitPrice || 0);
    const amount = soldQuantity * unitPrice;
    return sum + amount;
  }, 0);

  const consigneFeesTotal = items.reduce((sum, item) => {
    const fee = item.consignePrice !== undefined ? item.consignePrice : (CONSIGNE_FEES[item.bottleTypeName] || 0);
    const q = item.consigneQuantity || 0;
    return sum + (q * fee);
  }, 0);

  const taxRate = typeof (supplyOrder as any).taxRate === 'number' ? (supplyOrder as any).taxRate : 10;
  const taxAmount = subtotal * (taxRate / 100);

  const total = Math.max(0, subtotal + taxAmount + consigneFeesTotal - Math.max(0, totalExpenses));
  return { subtotal, taxAmount, total, consigneFeesTotal };
};

interface RecordReturnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplyOrder: SupplyOrder;
  mode?: 'standard' | 'par-code';
}

interface ForeignBottleEntry {
  companyName: string;
  bottleType: string;
  quantity: number;
}
interface ExpenseCodeOption {
  id: string;
  code: string;
  designation: string;
  account: string;
}

export const RecordReturnDialog: React.FC<RecordReturnDialogProps> = ({ open, onOpenChange, supplyOrder, mode = 'standard' }) => {
  const { addReturnOrder, addExpense, updateBottleType, bottleTypes, drivers, clients = [], addForeignBottle, updateEmptyBottlesStockByBottleType, addDefectiveBottle, addRevenue, brands } = useApp();
  const { toast } = useToast();
  const isParCodeMode = mode === 'par-code';

  const [items, setItems] = useState<ReturnOrderItem[]>([]);
  const [expenses, setExpenses] = useState<ExpenseReport[]>([]);
  const [newExpense, setNewExpense] = useState({ description: '', amount: 0 });
  const [paymentCashAmount, setPaymentCashAmount] = useState<string>('');
  const [paymentCheckAmount, setPaymentCheckAmount] = useState<string>('');
  const [paymentMygazAmount, setPaymentMygazAmount] = useState<string>('');
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [foreignBottlesModalOpen, setForeignBottlesModalOpen] = useState(false);
  const [currentItemIndex, setCurrentItemIndex] = useState<number | null>(null);
  const [foreignBottles, setForeignBottles] = useState<ForeignBottleEntry[]>([]);
  const [newForeignBottle, setNewForeignBottle] = useState<ForeignBottleEntry>({
    companyName: '',
    bottleType: '',
    quantity: 0,
  });
  const [foreignDetailsByItem, setForeignDetailsByItem] = useState<Record<string, ForeignBottleEntry[]>>({});
  const [expenseCodeOptions, setExpenseCodeOptions] = useState<ExpenseCodeOption[]>([]);
  const [selectedExpenseCode, setSelectedExpenseCode] = useState('');
  const [selectedExpenseAmount, setSelectedExpenseAmount] = useState('');
  const [difPricingOptions, setDifPricingOptions] = useState<Array<{ code: string; prix_dif: number }>>([]);
  const [difRows, setDifRows] = useState<Array<{ code: string; qte: number; prix: number }>>([]);
  const [defRows, setDefRows] = useState<Array<{ code: string; qte: number; prix: number }>>([]);
  const [selectedDifCode, setSelectedDifCode] = useState('');
  const [selectedDefCode, setSelectedDefCode] = useState('');
  const [clientRows, setClientRows] = useState<Array<{ client: string; bon: string; code: string; qte: number; prix: number; montant: number; payer: number; dif: number }>>([]);
  const [selectedClientId, setSelectedClientId] = useState('');

  React.useEffect(() => {
    if (supplyOrder && supplyOrder.items) {
      setItems(
        supplyOrder.items
          .filter(item => (item.emptyQuantity > 0 || item.fullQuantity > 0))
          .map(item => ({
            bottleTypeId: item.bottleTypeId,
            bottleTypeName: item.bottleTypeName,
            emptyQuantity: item.emptyQuantity,
            fullQuantity: item.fullQuantity,
            returnedEmptyQuantity: 0,
            returnedFullQuantity: 0,
            foreignQuantity: 0,
            defectiveQuantity: 0,
            lostQuantity: 0,
            consigneQuantity: 0,
            soldQuantity: 0,
            unitPrice: item.unitPrice || 0,
            consignePrice: CONSIGNE_FEES[item.bottleTypeName] || 0,
          }))
      );
    }
  }, [supplyOrder]);
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      const rows = await supabaseService.getAll<ExpenseCodeOption>('accounting_expense_codes');
      const difRowsData = await supabaseService.getAll<{ code: string; prix_dif: number }>('dif_pricing');
      
      if (!mounted) return;
      
      setExpenseCodeOptions(
        rows
          .map((row) => ({
            id: String(row.id),
            code: String((row as any).code || '').trim(),
            designation: String((row as any).designation || '').trim(),
            account: String((row as any).account || '').trim(),
          }))
          .filter((row) => row.code && row.designation)
      );

      setDifPricingOptions(
        difRowsData
          .map((row) => ({
            code: String((row as any).code || '').trim(),
            prix_dif: Number((row as any).prix_dif ?? (row as any).prixDif ?? 0),
          }))
          .filter((row) => row.code)
      );
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const totalExpenses = React.useMemo(
    () => expenses.reduce((sum, e) => sum + (e.amount || 0), 0) + (newExpense.amount > 0 ? newExpense.amount : 0),
    [expenses, newExpense]
  );

  const paymentTotals = React.useMemo(
    () => calculatePaymentTotals(items, supplyOrder, totalExpenses),
    [items, supplyOrder, totalExpenses]
  );

  const ventesSummary = React.useMemo(() => {
    const totalVentes = items.reduce(
      (sum, it) => sum + Math.max(0, (it.fullQuantity || 0) - (it.returnedFullQuantity || 0) - (it.defectiveQuantity || 0)),
      0
    );
    const totalPrix = items.reduce((sum, it) => {
      const unitPrice = it.unitPrice !== undefined ? it.unitPrice : (bottleTypes.find(b => b.id === it.bottleTypeId)?.unitPrice || 0);
      const soldQuantity = Math.max(0, (it.fullQuantity || 0) - (it.returnedFullQuantity || 0) - (it.defectiveQuantity || 0));
      return sum + (soldQuantity * unitPrice);
    }, 0);
    const consigneFeesTotal = items.reduce((sum, it) => {
      const fee = it.consignePrice !== undefined ? it.consignePrice : (CONSIGNE_FEES[it.bottleTypeName] || 0);
      return sum + ((it.consigneQuantity || 0) * fee);
    }, 0);
    return { totalVentes, totalPrix, consigneFeesTotal };
  }, [items, bottleTypes]);
  const normalizeBottleKey = React.useCallback((value: string | undefined) => {
    return String(value || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');
  }, []);
  const resolveBottleMeta = React.useCallback(
    (bottleTypeId: string, bottleTypeName?: string) => {
      const idRaw = String(bottleTypeId || '').trim();
      const nameRaw = String(bottleTypeName || '').trim();
      const idKey = normalizeBottleKey(idRaw);
      const nameKey = normalizeBottleKey(nameRaw);
      return bottleTypes.find((bt) => {
        const btId = String(bt.id || '').trim();
        const btName = String(bt.name || '').trim();
        const btCode = String((bt as any).code || '').trim();
        const btIdKey = normalizeBottleKey(btId);
        const btNameKey = normalizeBottleKey(btName);
        const btCodeKey = normalizeBottleKey(btCode);
        return (
          btId === idRaw ||
          btCode === idRaw ||
          btName === nameRaw ||
          btIdKey === idKey ||
          btCodeKey === idKey ||
          btNameKey === idKey ||
          btNameKey === nameKey
        );
      });
    },
    [bottleTypes, normalizeBottleKey]
  );
  const resolveBottleCode = React.useCallback(
    (bottleTypeId: string, bottleTypeName?: string) => {
      const matched = resolveBottleMeta(bottleTypeId, bottleTypeName);
      const fromMeta = String((matched as any)?.code ?? (matched as any)?.codeArticle ?? (matched as any)?.code_article ?? '').trim();
      if (fromMeta) return fromMeta;
      return bottleTypeName || '-';
    },
    [resolveBottleMeta]
  );
  const resolveBottleColor = React.useCallback(
    (bottleTypeId: string, bottleTypeName?: string) => {
      const matched = resolveBottleMeta(bottleTypeId, bottleTypeName);
      return String((matched as any)?.color || '#94a3b8');
    },
    [resolveBottleMeta]
  );
  const normalizeDifCode = React.useCallback((value: string | undefined) => {
    return String(value || '').trim().toUpperCase();
  }, []);
  const parCodeRows = React.useMemo(() => {
    return items.map((item) => {
      const soldQty = Math.max(0, (item.fullQuantity || 0) - (item.returnedFullQuantity || 0) - (item.defectiveQuantity || 0));
      const unitPrice = Number(item.unitPrice || 0);
      const code = resolveBottleCode(item.bottleTypeId, item.bottleTypeName);
      const pricing = difPricingOptions.find(p => normalizeDifCode(p.code) === normalizeDifCode(code));
      const difPrix = pricing ? pricing.prix_dif : 0;
      return {
        code,
        designation: item.bottleTypeName,
        sor: Number(item.fullQuantity || 0),
        rtg: Number(item.returnedFullQuantity || 0),
        rtr: Number(item.returnedEmptyQuantity || 0),
        vte: soldQty,
        pu: unitPrice,
        montant: soldQty * unitPrice,
        difPrix,
      };
    });
  }, [items, resolveBottleCode, difPricingOptions, normalizeDifCode]);
  const parCodeTotals = React.useMemo(() => {
    const ventes = parCodeRows.reduce((sum, row) => sum + row.montant, 0);
    const encaisse = (parseFloat(paymentCashAmount) || 0) + (parseFloat(paymentCheckAmount) || 0) + (parseFloat(paymentMygazAmount) || 0);
    const aEncaisser = Math.max(0, paymentTotals.total - encaisse);
    return {
      ventes,
      depenses: totalExpenses,
      difference: ventes - totalExpenses,
      aEncaisser,
      encaisse,
      enPlus: encaisse - paymentTotals.total,
    };
  }, [parCodeRows, totalExpenses, paymentCashAmount, paymentCheckAmount, paymentMygazAmount, paymentTotals.total]);
  const addSelectedExpenseCode = () => {
    const picked = expenseCodeOptions.find((item) => item.id === selectedExpenseCode);
    if (!picked) return;
    const amount = Math.max(0, Number(selectedExpenseAmount || 0));
    setExpenses((prev) => [
      ...prev,
      {
        id: window.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2),
        date: new Date().toISOString(),
        description: `${picked.code} - ${picked.designation}`,
        amount,
        type: 'note de frais',
        paymentMethod: 'dette',
        note: `Compte ${picked.account}`,
      } as ExpenseReport,
    ]);
    setSelectedExpenseCode('');
    setSelectedExpenseAmount('');
  };
  const addDifRowByCode = (code: string) => {
    if (!code) return;
    const pricing = difPricingOptions.find(p => normalizeDifCode(p.code) === normalizeDifCode(code));
    const prix = pricing ? pricing.prix_dif : 0;
    setDifRows((prev) => [...prev, { code, qte: 0, prix }]);
    setSelectedDifCode('');
  };
  const addDefRowByCode = (code: string) => {
    if (!code) return;
    setDefRows((prev) => [...prev, { code, qte: 0, prix: 0 }]);
    setSelectedDefCode('');
  };
  const addClientRow = (clientId: string) => {
    if (!clientId) return;
    const picked = clients.find((c) => String(c.id) === String(clientId));
    if (!picked) return;
    setClientRows((prev) => [
      ...prev,
      {
        client: picked.name,
        bon: supplyOrder.orderNumber || '',
        code: picked.code || '',
        qte: 0,
        prix: 0,
        montant: 0,
        payer: 0,
        dif: 0,
      },
    ]);
    setSelectedClientId('');
  };

  const handleQuantityChange = (bottleTypeId: string, field: keyof ReturnOrderItem, value: string) => {
    const quantity = (field === 'unitPrice' || field === 'consignePrice') ? (parseFloat(value) || 0) : (parseInt(value) || 0);
    setItems(prev =>
      prev.map(item =>
        item.bottleTypeId === bottleTypeId ? { ...item, [field]: quantity } : item
      )
    );
  };

  const openForeignBottlesModal = (index: number) => {
    setCurrentItemIndex(index);
    const currentItem = items[index];
    setNewForeignBottle({
      companyName: '',
      bottleType: currentItem.bottleTypeName,
      quantity: 0,
    });
    setForeignBottles(foreignDetailsByItem[currentItem.bottleTypeId] || []);
    setForeignBottlesModalOpen(true);
  };

  const addForeignBottleEntry = () => {
    const qty = Number(newForeignBottle.quantity) || 0;
    if (qty <= 0) {
      toast({ title: "Quantité invalide", description: "Veuillez entrer une quantité > 0", variant: "destructive" });
      return;
    }
    const itemName = (currentItemIndex !== null ? items[currentItemIndex]?.bottleTypeName : undefined) || newForeignBottle.bottleType;
    const company = (newForeignBottle.companyName || '').trim() || 'Autre';
    setForeignBottles(prev => [...prev, { companyName: company, bottleType: itemName || '', quantity: qty }]);
    setNewForeignBottle({ companyName: '', bottleType: itemName || '', quantity: 0 });
  };

  const saveForeignBottles = () => {
    if (currentItemIndex !== null) {
      const item = items[currentItemIndex];
      const totalForeignQuantity = foreignBottles.reduce((sum, fb) => sum + fb.quantity, 0);
      setItems(prev =>
        prev.map((it, idx) =>
          idx === currentItemIndex ? { ...it, foreignQuantity: totalForeignQuantity } : it
        )
      );
      setForeignDetailsByItem(prev => ({ ...prev, [item.bottleTypeId]: foreignBottles }));
    }
    setForeignBottlesModalOpen(false);
  };

  const handleSubmit = async () => {
    try {
      const orderNumber = `BD${Date.now().toString().slice(-5)}`;
      const cash = parseFloat(paymentCashAmount) || 0;
      const check = parseFloat(paymentCheckAmount) || 0;
      const mygaz = parseFloat(paymentMygazAmount) || 0;
      const totalPaid = cash + check + mygaz;
      const paymentDebt = Math.max(0, paymentTotals.total - totalPaid);
      const driverDebtChange = paymentDebt;

      const paymentInfo = { cash, check, mygaz, debt: paymentDebt, total: paymentTotals.total, subtotal: paymentTotals.subtotal, taxAmount: paymentTotals.taxAmount };

      const newReturnOrderId = await addReturnOrder(
        supplyOrder.id,
        items,
        ventesSummary.totalVentes,
        totalExpenses,
        items.reduce((sum, it) => sum + (it.lostQuantity || 0), 0),
        ventesSummary.totalPrix - totalExpenses,
        supplyOrder.driverId || '',
        driverDebtChange,
        0,
        JSON.stringify(paymentInfo),
        orderNumber,
        cash,
        check,
        mygaz,
        paymentDebt,
        paymentTotals.total
      );

      items.forEach(item => {
        const bottleType = bottleTypes.find(bt => bt.id === item.bottleTypeId);
        if (!bottleType) return;
        updateEmptyBottlesStockByBottleType(item.bottleTypeId, item.returnedEmptyQuantity || 0);
        if ((item.consigneQuantity || 0) > 0) updateEmptyBottlesStockByBottleType(item.bottleTypeId, -(item.consigneQuantity || 0));
        if ((item.lostQuantity || 0) > 0) updateEmptyBottlesStockByBottleType(item.bottleTypeId, -(item.lostQuantity || 0));
        if ((item.foreignQuantity || 0) > 0) updateEmptyBottlesStockByBottleType(item.bottleTypeId, -(item.foreignQuantity || 0));
        const currentDistributed = Number(bottleType.distributedQuantity || 0);
        const prevTotal = Number((bottleType as any).totalQuantity ?? (bottleType as any).totalquantity ?? bottleType.totalQuantity ?? 0);
        const returnedFull = Number(item.returnedFullQuantity || 0);
        const fullQty = Number(item.fullQuantity || 0);
        const defectiveQty = Number(item.defectiveQuantity || 0);
        const soldQty = Math.max(0, fullQty - returnedFull - defectiveQty);
        const newDistributed = Math.max(0, currentDistributed - fullQty);
        const newTotal = Math.max(0, prevTotal - soldQty);
        const newRemaining = Math.max(0, newTotal - newDistributed);
        updateBottleType(item.bottleTypeId, {
          totalQuantity: newTotal,
          remainingQuantity: newRemaining,
          distributedQuantity: newDistributed,
        });
        const foreignEntries = foreignDetailsByItem[item.bottleTypeId] || [];
        foreignEntries.forEach(fb => addForeignBottle({ returnOrderId: newReturnOrderId, companyName: fb.companyName, bottleType: fb.bottleType, quantity: fb.quantity, type: 'normal', date: new Date().toISOString() }));
        if (foreignEntries.length === 0 && (item.foreignQuantity || 0) > 0) addForeignBottle({ returnOrderId: newReturnOrderId, companyName: 'Autre', bottleType: item.bottleTypeName, quantity: item.foreignQuantity || 0, type: 'normal', date: new Date().toISOString() });
        if ((item.defectiveQuantity || 0) > 0) addDefectiveBottle({ returnOrderId: newReturnOrderId, bottleTypeId: item.bottleTypeId, bottleTypeName: item.bottleTypeName, quantity: item.defectiveQuantity || 0, date: new Date().toISOString() });
      });

      expenses.concat(newExpense.description && newExpense.amount > 0 ? [newExpense as ExpenseReport] : []).forEach(exp => {
        addExpense({ id: `exp-${Date.now()}-${Math.random()}`, type: 'note de frais', amount: exp.amount, paymentMethod: 'dette', date: new Date().toISOString(), note: exp.description, returnOrderId: newReturnOrderId });
      });

      await addRevenue({
        date: new Date().toISOString(),
        description: `Règlement B.D ${orderNumber}`,
        amount: totalPaid,
        paymentMethod: (cash > 0 || check > 0 || mygaz > 0) ? 'mixed' : 'cash',
        cashAmount: cash,
        checkAmount: check,
        mygazAmount: mygaz,
        relatedOrderId: newReturnOrderId,
        relatedOrderType: 'return'
      });

      toast({ title: "Bon d'Entrée créé", description: `B.D N° ${orderNumber} a été créé avec succès` });
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast({ title: "Erreur", description: "Une erreur est survenue lors de l'enregistrement", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={isParCodeMode ? "max-w-[96vw] max-h-[95vh] overflow-y-auto p-0 border-none shadow-2xl" : "max-w-6xl max-h-[90vh] overflow-y-auto p-0 border-none shadow-2xl"}>
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col h-full">
          <div className="bg-indigo-600 p-6 text-white">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle className="text-2xl font-bold flex items-center gap-3 text-white">
                    <div className="p-2 bg-white/20 rounded-lg"><Receipt className="w-6 h-6" /></div>
                    Enregistrer un Retour
                  </DialogTitle>
                  <DialogDescription className="text-indigo-100 mt-1">
                    Traitement du retour pour le Bon de Sortie <span className="font-mono font-bold bg-white/20 px-2 py-0.5 rounded text-white">{supplyOrder.orderNumber}</span>
                  </DialogDescription>
                </div>
                <div className="hidden md:block text-right">
                  <div className="text-xs uppercase tracking-wider text-indigo-200 font-bold mb-1">Chauffeur / Client</div>
                  <div className="font-semibold text-lg">{supplyOrder.driverName || (drivers.find(d => d.id === supplyOrder.driverId)?.name) || 'N/A'}</div>
                </div>
              </div>
            </DialogHeader>
          </div>

          <div className="p-6 space-y-8">
            {isParCodeMode ? (
              <div className="space-y-6">
                <div className="grid lg:grid-cols-3 gap-4">
                  <Card className="lg:col-span-2 border border-slate-300 bg-white">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Tableau principal (Par code)</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="border rounded-lg overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-slate-50">
                              <TableHead>Article</TableHead>
                              <TableHead>Désignation</TableHead>
                              <TableHead className="text-center">Sor</TableHead>
                              <TableHead className="text-center">RtG</TableHead>
                              <TableHead className="text-center">RtR</TableHead>
                              <TableHead className="text-center">Vte</TableHead>
                              <TableHead className="text-right">PU</TableHead>
                              <TableHead className="text-right">Montant</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {items.map((item) => {
                              const soldQty = Math.max(0, (item.fullQuantity || 0) - (item.returnedFullQuantity || 0) - (item.defectiveQuantity || 0));
                              return (
                                <TableRow key={item.bottleTypeId}>
                                  <TableCell>
                                    <div className="inline-flex items-center gap-2">
                                      <span
                                        className="inline-block w-2.5 h-2.5 rounded-full border border-slate-300"
                                        style={{ backgroundColor: resolveBottleColor(item.bottleTypeId, item.bottleTypeName) }}
                                      />
                                      <span>{resolveBottleCode(item.bottleTypeId, item.bottleTypeName)}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell>{item.bottleTypeName}</TableCell>
                                  <TableCell className="text-center">{item.fullQuantity || 0}</TableCell>
                                  <TableCell className="text-center">
                                    <Input type="number" value={item.returnedFullQuantity || ''} onChange={(e) => handleQuantityChange(item.bottleTypeId, 'returnedFullQuantity', e.target.value)} className="w-16 h-8 mx-auto text-center" />
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <Input type="number" value={item.returnedEmptyQuantity || ''} onChange={(e) => handleQuantityChange(item.bottleTypeId, 'returnedEmptyQuantity', e.target.value)} className="w-16 h-8 mx-auto text-center" />
                                  </TableCell>
                                  <TableCell className="text-center font-bold">{soldQty}</TableCell>
                                  <TableCell className="text-right">
                                    <Input type="number" step="0.01" value={item.unitPrice ?? ''} onChange={(e) => handleQuantityChange(item.bottleTypeId, 'unitPrice', e.target.value)} className="w-24 h-8 ml-auto text-right" />
                                  </TableCell>
                                  <TableCell className="text-right font-bold">{(soldQty * Number(item.unitPrice || 0)).toFixed(2)}</TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border border-slate-300 bg-white">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Synthèse</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex justify-between"><span>Ventes</span><span className="font-bold">{parCodeTotals.ventes.toFixed(2)}</span></div>
                      <div className="flex justify-between"><span>Dépenses</span><span className="font-bold">{parCodeTotals.depenses.toFixed(2)}</span></div>
                      <div className="flex justify-between"><span>Difference</span><span className="font-bold">{parCodeTotals.difference.toFixed(2)}</span></div>
                      <div className="flex justify-between"><span>A encaisser</span><span className="font-bold">{parCodeTotals.aEncaisser.toFixed(2)}</span></div>
                      <div className="flex justify-between"><span>Encaisé</span><span className="font-bold">{parCodeTotals.encaisse.toFixed(2)}</span></div>
                      <div className="flex justify-between"><span>En plus</span><span className={`font-bold ${parCodeTotals.enPlus < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{parCodeTotals.enPlus.toFixed(2)}</span></div>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid lg:grid-cols-3 gap-4">
                  <Card className="border border-slate-300 bg-white">
                    <CardHeader className="pb-2"><CardTitle className="text-base">Dépenses</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex gap-2">
                        <Select value={selectedExpenseCode} onValueChange={setSelectedExpenseCode}>
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Sélectionner dépense codifiée" />
                          </SelectTrigger>
                          <SelectContent>
                            {expenseCodeOptions.map((opt) => (
                              <SelectItem key={opt.id} value={opt.id}>
                                {opt.code} · {opt.designation}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input type="number" placeholder="0.00" value={selectedExpenseAmount} onChange={(e) => setSelectedExpenseAmount(e.target.value)} className="w-24" />
                        <Button onClick={addSelectedExpenseCode} size="icon"><Plus className="h-4 w-4" /></Button>
                      </div>
                      <div className="border rounded-lg overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-slate-50"><TableHead>Dépense</TableHead><TableHead className="text-right">Montant</TableHead></TableRow>
                          </TableHeader>
                          <TableBody>
                            {expenses.length === 0 ? (
                              <TableRow><TableCell colSpan={2} className="text-center text-slate-400">Aucune dépense</TableCell></TableRow>
                            ) : expenses.map((exp, idx) => (
                              <TableRow key={idx}><TableCell>{exp.description || (exp as any).note}</TableCell><TableCell className="text-right">{exp.amount.toFixed(2)}</TableCell></TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border border-slate-300 bg-white">
                    <CardHeader className="pb-2"><CardTitle className="text-base">DIF</CardTitle></CardHeader>
                    <CardContent>
                      <div className="flex gap-2 mb-3">
                        <Select value={selectedDifCode} onValueChange={setSelectedDifCode}>
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Sélectionner un code supplémentaire" />
                          </SelectTrigger>
                          <SelectContent>
                            {difPricingOptions.map((it) => (
                              <SelectItem key={`dif-opt-${it.code}`} value={it.code}>
                                {it.code}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button type="button" onClick={() => addDifRowByCode(selectedDifCode)}>Ajouter</Button>
                      </div>
                      <div className="border rounded-lg overflow-hidden mt-2">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-slate-50"><TableHead>Code</TableHead><TableHead className="text-center">Qte (VTE)</TableHead><TableHead className="text-right">Prix</TableHead><TableHead className="text-right">Montant</TableHead></TableRow>
                          </TableHeader>
                          <TableBody>
                            {parCodeRows.length === 0 && difRows.length === 0 ? (
                              <TableRow><TableCell colSpan={4} className="text-center text-slate-400">Tableau vide</TableCell></TableRow>
                            ) : (
                              <>
                                {parCodeRows.map((row, idx) => (
                                  <TableRow key={`auto-dif-${row.code}-${idx}`}>
                                    <TableCell>{row.code}</TableCell>
                                    <TableCell className="text-center font-bold text-slate-700">{row.vte}</TableCell>
                                    <TableCell className="text-right">{row.difPrix.toFixed(2)}</TableCell>
                                    <TableCell className="text-right font-bold text-emerald-600">{(row.vte * row.difPrix).toFixed(2)}</TableCell>
                                  </TableRow>
                                ))}
                                {difRows.map((row, idx) => (
                                  <TableRow key={`manual-dif-${row.code}-${idx}`}>
                                    <TableCell>{row.code}</TableCell>
                                    <TableCell>
                                      <Input type="number" value={row.qte || ''} onChange={(e) => setDifRows(prev => prev.map((r, i) => i === idx ? { ...r, qte: Number(e.target.value || 0) } : r))} className="w-16 h-8 mx-auto text-center" />
                                    </TableCell>
                                    <TableCell>
                                      <Input type="number" value={row.prix || ''} onChange={(e) => setDifRows(prev => prev.map((r, i) => i === idx ? { ...r, prix: Number(e.target.value || 0) } : r))} className="w-20 h-8 ml-auto text-right" />
                                    </TableCell>
                                    <TableCell className="text-right font-bold text-emerald-600">{(row.qte * row.prix).toFixed(2)}</TableCell>
                                  </TableRow>
                                ))}
                                <TableRow className="bg-slate-50 font-bold">
                                  <TableCell colSpan={3} className="text-right">Total DIF :</TableCell>
                                  <TableCell className="text-right text-emerald-700">
                                    {(parCodeRows.reduce((sum, row) => sum + (row.vte * row.difPrix), 0) + difRows.reduce((sum, row) => sum + (row.qte * row.prix), 0)).toFixed(2)}
                                  </TableCell>
                                </TableRow>
                              </>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border border-slate-300 bg-white">
                    <CardHeader className="pb-2"><CardTitle className="text-base">DEF</CardTitle></CardHeader>
                    <CardContent>
                      <div className="flex gap-2 mb-3">
                        <Select value={selectedDefCode} onValueChange={setSelectedDefCode}>
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Sélectionner un code" />
                          </SelectTrigger>
                          <SelectContent>
                            {items.map((it) => (
                              <SelectItem key={`def-opt-${it.bottleTypeId}`} value={it.bottleTypeId}>
                                {it.bottleTypeId} · {it.bottleTypeName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button type="button" onClick={() => addDefRowByCode(selectedDefCode)}>Ajouter</Button>
                      </div>
                      <div className="border rounded-lg overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-slate-50"><TableHead>Code</TableHead><TableHead>Qte</TableHead><TableHead>Prix</TableHead><TableHead className="text-right">Montant</TableHead></TableRow>
                          </TableHeader>
                          <TableBody>
                            {defRows.length === 0 ? (
                              <TableRow><TableCell colSpan={4} className="text-center text-slate-400">Tableau vide</TableCell></TableRow>
                            ) : defRows.map((row, idx) => (
                              <TableRow key={`def-${row.code}-${idx}`}>
                                <TableCell>{row.code}</TableCell>
                                <TableCell><Input type="number" value={row.qte || ''} onChange={(e) => setDefRows(prev => prev.map((r, i) => i === idx ? { ...r, qte: Number(e.target.value || 0) } : r))} className="w-16 h-8" /></TableCell>
                                <TableCell><Input type="number" value={row.prix || ''} onChange={(e) => setDefRows(prev => prev.map((r, i) => i === idx ? { ...r, prix: Number(e.target.value || 0) } : r))} className="w-20 h-8" /></TableCell>
                                <TableCell className="text-right">{(row.qte * row.prix).toFixed(2)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="border border-slate-300 rounded-xl p-4 bg-white space-y-3">
                  <div className="flex gap-2">
                    <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Sélectionner un client" />
                      </SelectTrigger>
                      <SelectContent>
                        {clients.map((client) => (
                          <SelectItem key={`client-opt-${client.id}`} value={String(client.id)}>
                            {client.name}{client.code ? ` · ${client.code}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button type="button" onClick={() => addClientRow(selectedClientId)}>Ajouter client</Button>
                  </div>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          <TableHead>Client</TableHead>
                          <TableHead>BON</TableHead>
                          <TableHead>Code</TableHead>
                          <TableHead className="text-center">Qte</TableHead>
                          <TableHead className="text-right">Prix</TableHead>
                          <TableHead className="text-right">Montant</TableHead>
                          <TableHead className="text-right">Payer</TableHead>
                          <TableHead className="text-right">Dif</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {clientRows.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center text-slate-400">Aucune ligne</TableCell>
                          </TableRow>
                        ) : (
                          clientRows.map((row, idx) => (
                            <TableRow key={`client-row-${row.code}-${idx}`}>
                              <TableCell>{row.client}</TableCell>
                              <TableCell>{row.bon}</TableCell>
                              <TableCell>{row.code}</TableCell>
                              <TableCell className="text-center"><Input value={row.qte || ''} onChange={(e) => setClientRows(prev => prev.map((r, i) => i === idx ? { ...r, qte: Number(e.target.value || 0) } : r))} type="number" className="w-16 h-8 mx-auto" /></TableCell>
                              <TableCell className="text-right"><Input value={row.prix || ''} onChange={(e) => setClientRows(prev => prev.map((r, i) => i === idx ? { ...r, prix: Number(e.target.value || 0) } : r))} type="number" className="w-20 h-8 ml-auto" /></TableCell>
                              <TableCell className="text-right font-bold"><Input value={row.montant || ''} onChange={(e) => setClientRows(prev => prev.map((r, i) => i === idx ? { ...r, montant: Number(e.target.value || 0) } : r))} type="number" className="w-24 h-8 ml-auto" /></TableCell>
                              <TableCell className="text-right text-emerald-700"><Input value={row.payer || ''} onChange={(e) => setClientRows(prev => prev.map((r, i) => i === idx ? { ...r, payer: Number(e.target.value || 0) } : r))} type="number" className="w-24 h-8 ml-auto" /></TableCell>
                              <TableCell className="text-right text-amber-700"><Input value={row.dif || ''} onChange={(e) => setClientRows(prev => prev.map((r, i) => i === idx ? { ...r, dif: Number(e.target.value || 0) } : r))} type="number" className="w-20 h-8 ml-auto" /></TableCell>
                            </TableRow>
                          ))
                        )}
                        <TableRow className="bg-slate-50">
                          <TableCell colSpan={5} className="font-bold text-right">Total :</TableCell>
                          <TableCell className="text-right font-bold">{clientRows.reduce((s, r) => s + r.montant, 0).toFixed(2)}</TableCell>
                          <TableCell className="text-right font-bold text-emerald-700">{clientRows.reduce((s, r) => s + r.payer, 0).toFixed(2)}</TableCell>
                          <TableCell className="text-right font-bold text-amber-700">{clientRows.reduce((s, r) => s + r.dif, 0).toFixed(2)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                  <div className="border-t pt-3">
                    <p className="font-bold text-slate-900">
                      MONTANT A ENCAISSE EN LETTRE : {parCodeTotals.aEncaisser.toFixed(2)} DH
                    </p>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button onClick={() => setPaymentDialogOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                    <DollarSign className="h-4 w-4 mr-2" /> Finaliser & Régler
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div className="flex flex-wrap gap-4">
                    <div className="bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm">
                      <div className="text-[10px] uppercase font-bold text-slate-400">Total Ventes</div>
                      <div className="text-xl font-bold text-indigo-600">{(ventesSummary.totalPrix + ventesSummary.consigneFeesTotal).toFixed(2)} DH</div>
                    </div>
                    <div className="bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm">
                      <div className="text-[10px] uppercase font-bold text-slate-400">Dépenses</div>
                      <div className="text-xl font-bold text-red-500">-{totalExpenses.toFixed(2)} DH</div>
                    </div>
                    <div className="bg-indigo-600 px-4 py-2 rounded-lg shadow-md">
                    <div className="text-[10px] uppercase font-bold text-indigo-200">Total TTC net à payer</div>
                      <div className="text-xl font-bold text-white">{paymentTotals.total.toFixed(2)} DH</div>
                    </div>
                  </div>
                  <Button onClick={() => setPaymentDialogOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-200 transition-all hover:scale-105 active:scale-95 w-full md:w-auto">
                    <DollarSign className="h-4 w-4 mr-2" /> Finaliser & Régler
                  </Button>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-6 bg-indigo-600 rounded-full" />
                    <h3 className="font-bold text-slate-800">Inventaire des Produits Retournés</h3>
                  </div>
                  <div className="border rounded-xl overflow-hidden bg-white shadow-sm">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead className="font-bold">Produit</TableHead>
                          <TableHead className="text-center bg-blue-50/50">Vides</TableHead>
                          <TableHead className="text-center bg-green-50/50">Pleins</TableHead>
                          <TableHead className="text-center bg-orange-50/50">Consigne</TableHead>
                          <TableHead className="text-center bg-purple-50/50">Étranger</TableHead>
                          <TableHead className="text-center bg-red-50/50">Déf/RC</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((item, index) => (
                          <TableRow key={item.bottleTypeId} className="hover:bg-slate-50/50 transition-colors">
                            <TableCell className="font-semibold text-slate-700">{item.bottleTypeName}</TableCell>
                            <TableCell className="bg-blue-50/20"><Input type="number" value={item.returnedEmptyQuantity || ''} onChange={(e) => handleQuantityChange(item.bottleTypeId, 'returnedEmptyQuantity', e.target.value)} className="w-20 mx-auto text-center font-bold border-blue-100" placeholder="0" /></TableCell>
                            <TableCell className="bg-green-50/20"><Input type="number" value={item.returnedFullQuantity || ''} onChange={(e) => handleQuantityChange(item.bottleTypeId, 'returnedFullQuantity', e.target.value)} className="w-20 mx-auto text-center font-bold border-green-100" placeholder="0" /></TableCell>
                            <TableCell className="bg-orange-50/20"><Input type="number" value={item.consigneQuantity || ''} onChange={(e) => handleQuantityChange(item.bottleTypeId, 'consigneQuantity', e.target.value)} className="w-20 mx-auto text-center font-bold border-orange-100" placeholder="0" /></TableCell>
                            <TableCell className="bg-purple-50/20">
                              <div className="flex items-center justify-center gap-2">
                                <span className="font-bold text-purple-700">{item.foreignQuantity || 0}</span>
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-purple-400 hover:text-purple-600 hover:bg-purple-50" onClick={() => openForeignBottlesModal(index)}><Plus className="h-3 w-3" /></Button>
                              </div>
                            </TableCell>
                            <TableCell className="bg-red-50/20">
                              <div className="flex flex-col gap-1">
                                <Input type="number" value={item.defectiveQuantity || ''} onChange={(e) => handleQuantityChange(item.bottleTypeId, 'defectiveQuantity', e.target.value)} className="w-20 mx-auto text-center h-7 text-xs border-red-100" placeholder="Déf" />
                                <Input type="number" value={item.lostQuantity || ''} onChange={(e) => handleQuantityChange(item.bottleTypeId, 'lostQuantity', e.target.value)} className="w-20 mx-auto text-center h-7 text-xs border-red-100" placeholder="RC" />
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className={`text-[10px] font-bold px-2 py-1 rounded-full inline-block ${(item.returnedEmptyQuantity + item.consigneQuantity + item.returnedFullQuantity + item.defectiveQuantity) === item.fullQuantity ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                {item.returnedEmptyQuantity + item.consigneQuantity + item.returnedFullQuantity + item.defectiveQuantity} / {item.fullQuantity}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                  <Card className="border-none shadow-sm bg-slate-50/50">
                    <CardHeader><CardTitle className="text-lg flex items-center gap-2"><DollarSign className="w-5 h-5 text-indigo-600" /> Résumé Financier</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                      <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                        <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                          <span className="text-slate-500">Ventes Gaz:</span>
                          <span className="font-bold text-slate-900">{ventesSummary.totalPrix.toFixed(2)} DH</span>
                        </div>
                        <div className="pb-2 border-b border-slate-100">
                          <div className="text-slate-500 mb-2">Prix unitaire de produit:</div>
                          <div className="space-y-2">
                            {items.map((it) => (
                              <div key={it.bottleTypeId} className="flex items-center justify-between gap-3">
                                <span className="text-xs text-slate-600 truncate">{it.bottleTypeName}</span>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={it.unitPrice ?? ''}
                                  onChange={(e) => handleQuantityChange(it.bottleTypeId, 'unitPrice', e.target.value)}
                                  className="w-28 h-8 text-right bg-white"
                                  placeholder="0.00"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="flex justify-between items-center pb-2 border-b border-slate-100 text-orange-600">
                          <span className="text-slate-500">Consigne (Dépôts):</span>
                          <span className="font-bold">{ventesSummary.consigneFeesTotal.toFixed(2)} DH</span>
                        </div>
                        <div className="pb-2 border-b border-slate-100">
                          <div className="text-slate-500 mb-2">Prix consigne (modifiable):</div>
                          <div className="space-y-2">
                            {items.map((it) => (
                              <div key={it.bottleTypeId} className="flex items-center justify-between gap-3">
                                <span className="text-xs text-slate-600 truncate">{it.bottleTypeName}</span>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={it.consignePrice ?? ''}
                                  onChange={(e) => handleQuantityChange(it.bottleTypeId, 'consignePrice', e.target.value)}
                                  className="w-28 h-8 text-right bg-white"
                                  placeholder="0.00"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="flex justify-between items-center pb-2 border-b border-slate-100 text-red-500">
                          <span className="text-slate-500">Total Dépenses:</span>
                          <span className="font-bold">-{totalExpenses.toFixed(2)} DH</span>
                        </div>
                        <div className="flex justify-between items-center pt-2 text-lg">
                          <span className="font-bold text-slate-800">NET À PAYER:</span>
                          <span className="font-black text-indigo-600">{paymentTotals.total.toFixed(2)} DH</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-none shadow-sm bg-slate-50/50">
                    <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Receipt className="w-5 h-5 text-red-500" /> Note de Frais</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex gap-2">
                        <Input placeholder="Description (ex: Gasoil, Péage...)" value={newExpense.description} onChange={(e) => setNewExpense(prev => ({ ...prev, description: e.target.value }))} className="flex-grow bg-white" />
                        <Input type="number" placeholder="0.00" value={newExpense.amount || ''} onChange={(e) => setNewExpense(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))} className="w-24 bg-white" />
                        <Button onClick={() => { if (newExpense.description && newExpense.amount > 0) { setExpenses(prev => [...prev, { ...newExpense, id: Date.now().toString(), date: new Date().toISOString(), type: 'note de frais', paymentMethod: 'dette', note: newExpense.description } as ExpenseReport]); setNewExpense({ description: '', amount: 0 }); } }} size="icon" className="bg-red-500 hover:bg-red-600 text-white"><Plus className="h-4 w-4" /></Button>
                      </div>
                      <AnimatePresence>
                        <div className="space-y-2 max-h-[150px] overflow-y-auto pr-2">
                          {expenses.map((exp, idx) => (
                            <motion.div key={idx} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="flex items-center justify-between p-2 bg-white rounded-lg border border-red-100 group">
                              <span className="text-sm font-medium text-slate-700">{exp.description || (exp as any).note}</span>
                              <div className="flex items-center gap-3">
                                <span className="font-bold text-red-600">{exp.amount.toFixed(2)} DH</span>
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setExpenses(prev => prev.filter((_, i) => i !== idx))}><Trash2 className="h-3 w-3" /></Button>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </AnimatePresence>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </div>

          <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>Règlement du Retour</DialogTitle><DialogDescription>Saisissez les montants reçus pour finaliser le bon d'entrée.</DialogDescription></DialogHeader>
              <div className="grid gap-6 py-4">
                <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 flex justify-between items-center">
                  <span className="font-bold text-indigo-900">Total TTC net à payer:</span>
                  <span className="text-2xl font-black text-indigo-600">{paymentTotals.total.toFixed(2)} DH</span>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2"><Label className="flex items-center gap-2"><Banknote className="w-4 h-4 text-emerald-600" /> Espèces (Cash)</Label><Input type="number" value={paymentCashAmount} onChange={(e) => setPaymentCashAmount(e.target.value)} className="text-lg font-bold" placeholder="0.00" /></div>
                  <div className="space-y-2"><Label className="flex items-center gap-2"><CreditCard className="w-4 h-4 text-blue-600" /> Chèque / Virement</Label><Input type="number" value={paymentCheckAmount} onChange={(e) => setPaymentCheckAmount(e.target.value)} className="text-lg font-bold" placeholder="0.00" /></div>
                  <div className="space-y-2"><Label className="flex items-center gap-2"><Wallet className="w-4 h-4 text-orange-600" /> MyGaz / Crédit</Label><Input type="number" value={paymentMygazAmount} onChange={(e) => setPaymentMygazAmount(e.target.value)} className="text-lg font-bold" placeholder="0.00" /></div>
                </div>
                <div className="bg-orange-50 border border-orange-200 p-4 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-lg font-medium text-orange-800">Dette Chauffeur (Gaz):</span>
                    <span className="text-2xl font-bold text-orange-600">{Math.max(0, paymentTotals.total - (parseFloat(paymentCashAmount) || 0) - (parseFloat(paymentCheckAmount) || 0) - (parseFloat(paymentMygazAmount) || 0)).toFixed(2)} DH</span>
                  </div>
                </div>
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>Modifier Inventaire</Button>
                <Button onClick={handleSubmit} className="bg-indigo-600 hover:bg-indigo-700 text-white"><Save className="w-4 h-4 mr-2" /> Enregistrer le Bon</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={foreignBottlesModalOpen} onOpenChange={setForeignBottlesModalOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>Bouteilles Étrangères</DialogTitle><DialogDescription>Détaillez les bouteilles d'autres marques pour {currentItemIndex !== null ? items[currentItemIndex]?.bottleTypeName : ''}.</DialogDescription></DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="flex gap-2">
                  <div className="flex-grow">
                    <Label className="text-xs mb-1 block">Marque / Société</Label>
                    <Select value={newForeignBottle.companyName} onValueChange={(v) => setNewForeignBottle(p => ({ ...p, companyName: v }))}>
                      <SelectTrigger className="bg-white"><SelectValue placeholder="Choisir marque" /></SelectTrigger>
                      <SelectContent>{brands.map(b => <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>)}<SelectItem value="Autre">Autre</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div className="w-24">
                    <Label className="text-xs mb-1 block">Quantité</Label>
                    <Input type="number" value={newForeignBottle.quantity || ''} onChange={(e) => setNewForeignBottle(p => ({ ...p, quantity: parseInt(e.target.value) || 0 }))} />
                  </div>
                  <div className="flex items-end"><Button onClick={addForeignBottleEntry} size="icon" className="bg-purple-600 hover:bg-purple-700 text-white"><Plus className="h-4 w-4" /></Button></div>
                </div>
                <div className="border rounded-lg overflow-hidden max-h-[200px] overflow-y-auto bg-slate-50">
                  <Table>
                    <TableHeader className="bg-slate-100 sticky top-0"><TableRow><TableHead className="h-8 text-xs">Marque</TableHead><TableHead className="h-8 text-xs text-center">Qté</TableHead><TableHead className="h-8 text-xs text-right">Action</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {foreignBottles.map((fb, idx) => (
                        <TableRow key={idx} className="bg-white"><TableCell className="py-1 text-sm">{fb.companyName}</TableCell><TableCell className="py-1 text-center font-bold">{fb.quantity}</TableCell><TableCell className="py-1 text-right"><Button variant="ghost" size="icon" className="h-6 w-6 text-red-400 hover:text-red-600" onClick={() => setForeignBottles(prev => prev.filter((_, i) => i !== idx))}><X className="h-3 w-3" /></Button></TableCell></TableRow>
                      ))}
                      {foreignBottles.length === 0 && <TableRow><TableCell colSpan={3} className="text-center py-4 text-slate-400 text-xs italic">Aucune entrée</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </div>
              </div>
              <DialogFooter><Button onClick={saveForeignBottles} className="bg-purple-600 hover:bg-purple-700 text-white w-full">Confirmer (Total: {foreignBottles.reduce((s, f) => s + f.quantity, 0)})</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
};
