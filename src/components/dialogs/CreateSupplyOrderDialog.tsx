import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useApp } from '@/contexts/AppContext';
import { useToast } from '@/hooks/use-toast';
import { Package, Plus, Minus, Trash2, User, Truck, Receipt, Hash, AlertCircle } from 'lucide-react';
import { SupplyOrderItem } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';

interface CreateSupplyOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  driverId: string;
  driverName: string;
  truckId?: string;
}

export const CreateSupplyOrderDialog: React.FC<CreateSupplyOrderDialogProps> = ({
  open,
  onOpenChange,
  driverId,
  driverName,
  truckId,
}) => {
  const { bottleTypes, clients, addSupplyOrder, updateBottleType, supplyOrders, drivers } = useApp();
  const { toast } = useToast();

  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [items, setItems] = useState<SupplyOrderItem[]>([]);
  const [orderNumber, setOrderNumber] = useState<string>('');

  const currentDriver = drivers.find(d => d.id === driverId);

  React.useEffect(() => {
    if (open) {
      if (!supplyOrders || supplyOrders.length === 0) {
        setOrderNumber('BS-1');
      } else {
        let maxNum = 0;
        supplyOrders.forEach(order => {
          if (order.orderNumber && typeof order.orderNumber === 'string') {
            const match = order.orderNumber.match(/(?:BS-)(\d+)/i);
            if (match && match[1]) {
              const num = parseInt(match[1], 10);
              if (num > maxNum) {
                maxNum = num;
              }
            }
          }
        });
        setOrderNumber(`BS-${maxNum + 1}`);
      }
    }
  }, [open, supplyOrders]);

  const selectedClient = clients.find(c => c.id === selectedClientId);

  const addItem = () => {
    if (bottleTypes.length === 0) return;
    
    const newItem: SupplyOrderItem = {
      bottleTypeId: bottleTypes[0].id,
      bottleTypeName: bottleTypes[0].name,
      emptyQuantity: 0,
      fullQuantity: 0,
      unitPrice: bottleTypes[0].unitPrice,
      taxLabel: bottleTypes[0].taxLabel,
      amount: 0,
    };
    setItems([...items, newItem]);
  };

  const updateItem = (index: number, field: keyof SupplyOrderItem, value: any) => {
    const updatedItems = [...items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    
    if (field === 'bottleTypeId') {
      const bottleType = bottleTypes.find(bt => bt.id === value);
      if (bottleType) {
        updatedItems[index].bottleTypeName = bottleType.name;
        updatedItems[index].unitPrice = bottleType.unitPrice;
        updatedItems[index].taxLabel = bottleType.taxLabel;
      }
    }
    
    // Recalculate amount
    const item = updatedItems[index];
    item.amount = item.fullQuantity * item.unitPrice;
    
    setItems(updatedItems);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
    const tax = subtotal * 0.2; // 20% TVA
    const total = subtotal + tax;
    return { subtotal, tax, total };
  };

  const handleSubmit = () => {
    if (items.length === 0) {
      toast({
        title: "Erreur",
        description: "Veuillez ajouter au moins un produit",
        variant: "destructive",
      });
      return;
    }

    const trimmedOrderNumber = orderNumber.trim();
    if (!trimmedOrderNumber) {
      toast({
        title: "Erreur",
        description: "Veuillez saisir un numéro de B.S",
        variant: "destructive",
      });
      return;
    }

    const duplicate = supplyOrders.some(
      (o) => (o.orderNumber || "").toLowerCase() === trimmedOrderNumber.toLowerCase()
    );
    if (duplicate) {
      toast({
        title: "Doublon",
        description: "Ce numéro de B.S existe déjà",
        variant: "destructive",
      });
      return;
    }

    const { subtotal, tax, total } = calculateTotals();

    items.forEach(item => {
      const bt = bottleTypes.find(bt => bt.id === item.bottleTypeId);
      if (!bt) return;
      const currentRemaining = Number(bt.remainingQuantity || 0);
      const currentDistributed = Number(bt.distributedQuantity || 0);
      const fullQty = Number(item.fullQuantity || 0);
      const nextRemaining = Math.max(0, currentRemaining - fullQty);
      const nextDistributed = currentDistributed + fullQty;
      updateBottleType(item.bottleTypeId, {
        remainingQuantity: nextRemaining,
        distributedQuantity: nextDistributed,
      });
    });

    addSupplyOrder({
      orderNumber: trimmedOrderNumber,
      date: new Date().toISOString(),
      driverId,
      driverName,
      clientId: selectedClientId,
      clientName: selectedClient?.name || '',
      items: items.filter(item => item.emptyQuantity > 0 || item.fullQuantity > 0),
      subtotal,
      tax,
      total,
    });

    toast({
      title: "Bon de Sortie créé",
      description: `B.S N° ${trimmedOrderNumber} a été créé avec succès pour ${driverName}`,
    });

    // Reset form
    setSelectedClientId('');
    setItems([]);
    onOpenChange(false);
  };

  const totals = calculateTotals();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto p-0 border-none shadow-2xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col h-full"
        >
          {/* Header Section */}
          <div className="bg-indigo-600 p-6 text-white">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle className="text-2xl font-bold flex items-center gap-3 text-white">
                    <div className="p-2 bg-white/20 rounded-lg">
                      <Package className="w-6 h-6" />
                    </div>
                    Nouveau Bon de Sortie (B.S)
                  </DialogTitle>
                  <DialogDescription className="text-indigo-100 mt-1">
                    Préparer une nouvelle distribution pour le chauffeur
                  </DialogDescription>
                </div>
                <div className="hidden md:block text-right">
                  <div className="text-xs uppercase tracking-wider text-indigo-200 font-bold mb-1">Chauffeur / Destinataire</div>
                  <div className="font-semibold text-lg flex items-center gap-2 justify-end">
                    <User className="w-4 h-4" />
                    {driverName}
                  </div>
                </div>
              </div>
            </DialogHeader>
          </div>

          <div className="p-6 space-y-8 bg-slate-50/50">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* BS Number Card */}
              <Card className="shadow-sm border-indigo-100 overflow-hidden">
                <div className="h-1 bg-indigo-500 w-full" />
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-bold text-slate-500 uppercase flex items-center gap-2">
                    <Hash className="w-4 h-4 text-indigo-500" />
                    Référence B.S
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Input
                    id="order-number"
                    value={orderNumber}
                    onChange={(e) => setOrderNumber(e.target.value)}
                    className="text-xl font-mono font-bold border-indigo-200 focus:ring-indigo-500 h-12"
                    placeholder="BS-000"
                  />
                </CardContent>
              </Card>

              {/* Client Info Card */}
              <Card className="md:col-span-2 shadow-sm border-indigo-100 overflow-hidden">
                <div className="h-1 bg-indigo-500 w-full" />
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-bold text-slate-500 uppercase flex items-center gap-2">
                    <User className="w-4 h-4 text-indigo-500" />
                    Informations Client (Optionnel)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                    <SelectTrigger className="h-12 border-indigo-200 focus:ring-indigo-500">
                      <SelectValue placeholder="Sélectionner un client (optionnel)" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map(client => (
                        <SelectItem key={client.id} value={client.id}>
                          <div className="flex flex-col">
                            <span className="font-medium">{client.name}</span>
                            <span className="text-xs text-slate-500">{client.phone}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
            </div>

            {/* Products Table Section */}
            <Card className="shadow-sm border-indigo-100 overflow-hidden">
              <div className="h-1 bg-indigo-500 w-full" />
              <CardHeader className="flex flex-row items-center justify-between border-b bg-slate-50/50">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Truck className="w-5 h-5 text-indigo-500" />
                  Produits à Charger
                </CardTitle>
                <Button 
                  onClick={addItem} 
                  size="sm"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition-all active:scale-95"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Ajouter un Produit
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-slate-100/50">
                      <TableRow>
                        <TableHead className="w-[300px]">Produit</TableHead>
                        <TableHead className="text-center">Quantité Vides</TableHead>
                        <TableHead className="text-center">Quantité Pleines</TableHead>
                        <TableHead className="text-right">Prix Unitaire</TableHead>
                        <TableHead className="text-right">Montant</TableHead>
                        <TableHead className="w-[80px] text-center">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <AnimatePresence initial={false}>
                        {items.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="h-32 text-center text-slate-400 italic">
                              Aucun produit ajouté. Cliquez sur "Ajouter un Produit" pour commencer.
                            </TableCell>
                          </TableRow>
                        ) : (
                          items.map((item, index) => (
                            <motion.tr
                              key={index}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: 10 }}
                              className="group border-b hover:bg-indigo-50/30 transition-colors"
                            >
                              <TableCell>
                                <Select
                                  value={item.bottleTypeId}
                                  onValueChange={(value) => updateItem(index, 'bottleTypeId', value)}
                                >
                                  <SelectTrigger className="border-indigo-100 focus:ring-indigo-500 bg-white">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {bottleTypes.map(bottleType => (
                                      <SelectItem key={bottleType.id} value={bottleType.id}>
                                        <div className="flex justify-between items-center w-full min-w-[200px]">
                                          <span>{bottleType.name}</span>
                                          <Badge variant="outline" className="ml-2 text-[10px] bg-slate-50">
                                            Stock: {bottleType.remainingQuantity || 0}
                                          </Badge>
                                        </div>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center justify-center gap-1">
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8 rounded-full border-indigo-100 hover:bg-indigo-100 hover:text-indigo-600"
                                    onClick={() => updateItem(index, 'emptyQuantity', Math.max(0, item.emptyQuantity - 1))}
                                  >
                                    <Minus className="w-3 h-3" />
                                  </Button>
                                  <Input
                                    type="number"
                                    value={item.emptyQuantity}
                                    onChange={(e) => updateItem(index, 'emptyQuantity', parseInt(e.target.value) || 0)}
                                    className="w-20 text-center font-bold border-indigo-100"
                                    min="0"
                                  />
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8 rounded-full border-indigo-100 hover:bg-indigo-100 hover:text-indigo-600"
                                    onClick={() => updateItem(index, 'emptyQuantity', item.emptyQuantity + 1)}
                                  >
                                    <Plus className="w-3 h-3" />
                                  </Button>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center justify-center gap-1">
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8 rounded-full border-indigo-100 hover:bg-indigo-100 hover:text-indigo-600"
                                    onClick={() => updateItem(index, 'fullQuantity', Math.max(0, item.fullQuantity - 1))}
                                  >
                                    <Minus className="w-3 h-3" />
                                  </Button>
                                  <Input
                                    type="number"
                                    value={item.fullQuantity}
                                    onChange={(e) => updateItem(index, 'fullQuantity', parseInt(e.target.value) || 0)}
                                    className="w-20 text-center font-bold border-indigo-100 text-indigo-700"
                                    min="0"
                                  />
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8 rounded-full border-indigo-100 hover:bg-indigo-100 hover:text-indigo-600"
                                    onClick={() => updateItem(index, 'fullQuantity', item.fullQuantity + 1)}
                                  >
                                    <Plus className="w-3 h-3" />
                                  </Button>
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-medium text-slate-600">
                                {item.unitPrice.toFixed(2)} DH
                              </TableCell>
                              <TableCell className="text-right font-bold text-indigo-600">
                                {item.amount.toFixed(2)} DH
                              </TableCell>
                              <TableCell className="text-center">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full"
                                  onClick={() => removeItem(index)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </TableCell>
                            </motion.tr>
                          ))
                        )}
                      </AnimatePresence>
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Bottom Section: Totals & Summary */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
              {/* Note / Alert */}
              <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex gap-3 text-amber-800">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <div>
                  <h4 className="font-bold text-sm">Rappel important</h4>
                  <p className="text-xs leading-relaxed opacity-90 mt-1">
                    Le stock de produits pleins sera automatiquement déduit du stock disponible une fois le Bon de Sortie validé. Assurez-vous que les quantités sont exactes.
                  </p>
                </div>
              </div>

              {/* Totals Summary */}
              <Card className="shadow-lg border-indigo-200 bg-indigo-50/30 overflow-hidden">
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center text-slate-600">
                      <span className="text-sm font-medium">Sous-total (Hors Taxe):</span>
                      <span className="font-bold">{totals.subtotal.toFixed(2)} DH</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-600">
                      <span className="text-sm font-medium">TVA (20%):</span>
                      <span className="font-bold">{totals.tax.toFixed(2)} DH</span>
                    </div>
                    <div className="h-px bg-indigo-200 my-2" />
                    <div className="flex justify-between items-center">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-indigo-900 uppercase tracking-wider">Total TTC à charger</span>
                        <span className="text-[10px] text-indigo-500 font-medium">* Montant estimé de la distribution</span>
                      </div>
                      <div className="text-3xl font-black text-indigo-700">
                        {totals.total.toFixed(2)} <span className="text-sm">DH</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Final Actions */}
            <div className="flex items-center justify-between border-t pt-6">
              <Button 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                className="border-slate-200 text-slate-500 hover:bg-slate-100"
              >
                Annuler
              </Button>
              <Button 
                onClick={handleSubmit} 
                disabled={items.length === 0}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 h-12 rounded-lg font-bold shadow-lg shadow-indigo-200 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
              >
                <Receipt className="w-5 h-5 mr-2" />
                Valider et Créer le B.S
              </Button>
            </div>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
};
