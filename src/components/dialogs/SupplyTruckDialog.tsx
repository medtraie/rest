import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useApp } from '@/contexts/AppContext';
import { Truck as TruckType } from '@/types';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Truck, Package, Plus, Trash2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

interface SupplyTruckDialogProps {
  truck: TruckType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const SupplyTruckDialog = ({ truck, open, onOpenChange }: SupplyTruckDialogProps) => {
  const { bottleTypes, updateBottleType, addTransaction } = useApp();
  const [supplies, setSupplies] = useState<Array<{ bottleTypeId: string; quantity: number }>>([]);
  const [selectedBottle, setSelectedBottle] = useState('');
  const [quantity, setQuantity] = useState('');

  const addSupply = () => {
    if (!selectedBottle || !quantity) return;
    
    const qty = parseInt(quantity);
    if (isNaN(qty) || qty <= 0) {
      toast.error('Veuillez saisir une quantité valide');
      return;
    }

    const bottle = bottleTypes.find(bt => bt.id === selectedBottle);
    if (bottle && bottle.remainingQuantity < qty) {
      toast.error(`Stock insuffisant. Stock disponible: ${bottle.remainingQuantity}`);
      return;
    }
    
    setSupplies([...supplies, { 
      bottleTypeId: selectedBottle, 
      quantity: qty 
    }]);
    setSelectedBottle('');
    setQuantity('');
  };

  const removeSupply = (index: number) => {
    setSupplies(supplies.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (supplies.length === 0) {
      toast.error('Veuillez ajouter au moins un article');
      return;
    }

    let totalValue = 0;
    supplies.forEach(supply => {
      const bottle = bottleTypes.find(bt => bt.id === supply.bottleTypeId);
      if (bottle) {
        const currentDistributed = Number(bottle.distributedQuantity || 0);
        const currentRemaining = Number(bottle.remainingQuantity || 0);
        const qty = Number(supply.quantity || 0);
        updateBottleType(bottle.id, {
          distributedQuantity: currentDistributed + qty,
          remainingQuantity: currentRemaining - qty
        });
        totalValue += (Number(bottle.unitPrice) || 0) * qty;
      }
    });

    addTransaction({
      type: 'supply',
      date: new Date().toISOString(),
      truckId: truck.id,
      bottleTypes: supplies,
      totalValue
    });
    
    toast.success('Camion alimenté avec succès');
    onOpenChange(false);
    setSupplies([]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 border-none shadow-2xl overflow-hidden">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col h-full"
        >
          {/* Header */}
          <div className="bg-indigo-600 p-6 text-white">
            <DialogHeader>
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/20 rounded-xl">
                  <Truck className="w-8 h-8 text-white" />
                </div>
                <div>
                  <DialogTitle className="text-2xl font-bold text-white">
                    Alimenter le Camion
                  </DialogTitle>
                  <DialogDescription className="text-indigo-100">
                    Chargement des bouteilles pour le camion <span className="font-mono font-bold bg-white/20 px-2 py-0.5 rounded text-white">{truck.matricule}</span>
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
          </div>

          <div className="p-6 space-y-6 bg-slate-50/50">
            {/* Input Section */}
            <Card className="border-indigo-100 shadow-sm overflow-hidden">
              <CardContent className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                  <div className="md:col-span-2 space-y-2">
                    <Label className="text-xs font-bold uppercase text-slate-500 flex items-center gap-2">
                      <Package className="w-3 h-3 text-indigo-500" />
                      Type de bouteille
                    </Label>
                    <Select value={selectedBottle} onValueChange={setSelectedBottle}>
                      <SelectTrigger className="h-11 border-indigo-100 focus:ring-indigo-500">
                        <SelectValue placeholder="Choisir une bouteille" />
                      </SelectTrigger>
                      <SelectContent>
                        {bottleTypes.map(bt => (
                          <SelectItem key={bt.id} value={bt.id}>
                            <div className="flex justify-between items-center w-full min-w-[240px]">
                              <span className="font-medium">{bt.name}</span>
                              <Badge variant="outline" className="text-[10px] bg-slate-50">
                                Dispo: {bt.remainingQuantity || 0}
                              </Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-slate-500">Quantité</Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        placeholder="0"
                        className="h-11 border-indigo-100 focus:ring-indigo-500 font-bold"
                        min="1"
                      />
                      <Button 
                        type="button" 
                        onClick={addSupply}
                        className="h-11 w-11 p-0 bg-indigo-600 hover:bg-indigo-700 shadow-md transition-all active:scale-95"
                      >
                        <Plus className="w-5 h-5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* List Section */}
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Articles à charger ({supplies.length})
              </h4>
              
              <div className="max-h-[250px] overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                <AnimatePresence initial={false}>
                  {supplies.length === 0 ? (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-center py-10 bg-white border border-dashed border-slate-200 rounded-xl text-slate-400"
                    >
                      <Package className="w-8 h-8 mx-auto mb-2 opacity-20" />
                      <p className="text-sm italic">Aucun article ajouté pour le moment</p>
                    </motion.div>
                  ) : (
                    supplies.map((supply, idx) => {
                      const bottle = bottleTypes.find(bt => bt.id === supply.bottleTypeId);
                      return (
                        <motion.div
                          key={`${supply.bottleTypeId}-${idx}`}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 10 }}
                          className="flex items-center justify-between p-3 bg-white border border-indigo-50 rounded-xl shadow-sm hover:border-indigo-200 transition-colors group"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold">
                              {idx + 1}
                            </div>
                            <div>
                              <p className="font-bold text-slate-800">{bottle?.name}</p>
                              <p className="text-xs text-slate-500">P.U: {bottle?.unitPrice.toFixed(2)} DH</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none px-3 py-1 font-bold text-sm">
                              {supply.quantity} unités
                            </Badge>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full"
                              onClick={() => removeSupply(idx)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </motion.div>
                      );
                    })
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Alert */}
            <div className="bg-amber-50 border border-amber-100 p-3 rounded-xl flex gap-3 items-start text-amber-800">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <p className="text-[11px] leading-tight">
                L'alimentation du camion mettra à jour le stock principal immédiatement. Veuillez vérifier les quantités avant de valider.
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t">
              <Button 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                className="border-slate-200 text-slate-500 hover:bg-slate-100"
              >
                Annuler
              </Button>
              <Button 
                onClick={handleSubmit} 
                disabled={supplies.length === 0}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 h-12 rounded-xl font-bold shadow-lg shadow-indigo-200 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
              >
                Valider l'alimentation
              </Button>
            </div>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
};
