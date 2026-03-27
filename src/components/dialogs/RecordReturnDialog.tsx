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
}

interface ForeignBottleEntry {
  companyName: string;
  bottleType: string;
  quantity: number;
}

export const RecordReturnDialog: React.FC<RecordReturnDialogProps> = ({ open, onOpenChange, supplyOrder }) => {
  const { addReturnOrder, addExpense, updateBottleType, bottleTypes, drivers, addForeignBottle, updateEmptyBottlesStockByBottleType, addDefectiveBottle, addRevenue, brands } = useApp();
  const { toast } = useToast();

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
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto p-0 border-none shadow-2xl">
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
