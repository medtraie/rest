import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useApp } from '@/contexts/AppContext';
import { Driver } from '@/types';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { motion, AnimatePresence } from 'framer-motion';
import { DollarSign, CreditCard, Banknote, Landmark, ArrowRight, Wallet, TrendingUp, TrendingDown, CheckCircle2 } from 'lucide-react';

interface RecordPaymentDialogProps {
  driver: Driver;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const RecordPaymentDialog = ({ driver, open, onOpenChange }: RecordPaymentDialogProps) => {
    const { recordDriverPayment, addCashOperation, addFinancialTransaction } = useApp();
    const [amount, setAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<'espece' | 'cheque' | 'banque'>('espece');

    const paymentAmount = parseFloat(amount) || 0;
    
    // Calculate future balance
    const currentDebt = driver.debt || 0;
    const currentAdvances = driver.advances || 0;
    let nextDebt = currentDebt;
    let nextAdvances = currentAdvances;

    if (paymentAmount > 0) {
      if (paymentAmount <= currentDebt) {
        nextDebt = currentDebt - paymentAmount;
      } else {
        nextDebt = 0;
        nextAdvances = currentAdvances + (paymentAmount - currentDebt);
      }
    }
    const nextBalance = nextAdvances - nextDebt;

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (paymentAmount <= 0) {
        toast.error('Le montant doit être positif');
        return;
      }

      recordDriverPayment(driver.id, paymentAmount);

      addCashOperation({
        id: crypto.randomUUID(),
        date: new Date().toISOString(),
        name: `Paiement chauffeur: ${driver.name}`,
        amount: paymentAmount,
        type: 'versement',
        accountAffected: paymentMethod,
        status: 'validated',
      });

      toast.success('Paiement enregistré avec succès');
      onOpenChange(false);
      setAmount('');
      setPaymentMethod('espece');
    };

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden border-none shadow-2xl">
          <div className="bg-indigo-600 p-6 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12">
              <Wallet className="w-32 h-32" />
            </div>
            <DialogHeader className="relative z-10">
              <DialogTitle className="text-2xl font-bold text-white flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                  <Banknote className="w-6 h-6" />
                </div>
                Enregistrer un paiement
              </DialogTitle>
              <DialogDescription className="text-indigo-100 text-base mt-1">
                Chauffeur: <span className="font-semibold text-white">{driver.name}</span>
              </DialogDescription>
            </DialogHeader>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6 bg-white">
            {/* Status Overview Cards */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Dette Actuelle</p>
                <div className="flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-red-500" />
                  <span className="text-lg font-bold text-slate-900">{Math.abs(driver.debt).toLocaleString()} DH</span>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Avances</p>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                  <span className="text-lg font-bold text-slate-900">{driver.advances.toLocaleString()} DH</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="amount" className="text-sm font-semibold text-slate-700">Montant du paiement (DH)</Label>
                <div className="relative group">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="pl-10 h-12 text-lg font-bold bg-slate-50 border-slate-200 focus:border-indigo-500 focus:ring-indigo-500 transition-all shadow-sm"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold text-slate-700">Mode de paiement *</Label>
                <Select value={paymentMethod} onValueChange={(v: 'espece' | 'cheque' | 'banque') => setPaymentMethod(v)}>
                  <SelectTrigger className="h-12 bg-slate-50 border-slate-200 focus:ring-indigo-500">
                    <SelectValue placeholder="Choisir un mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="espece" className="py-3">
                      <div className="flex items-center gap-3">
                        <Banknote className="w-4 h-4 text-emerald-600" />
                        <span>Espèces</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="cheque" className="py-3">
                      <div className="flex items-center gap-3">
                        <CreditCard className="w-4 h-4 text-blue-600" />
                        <span>Chèque</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="banque" className="py-3">
                      <div className="flex items-center gap-3">
                        <Landmark className="w-4 h-4 text-indigo-600" />
                        <span>Banque / Virement</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Live Preview of Future Balance */}
            <AnimatePresence>
              {paymentAmount > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="p-4 rounded-xl bg-indigo-50 border border-indigo-100 space-y-3"
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-indigo-600 font-medium">Ancien Solde</span>
                    <span className="font-semibold text-slate-600">{driver.balance.toLocaleString()} DH</span>
                  </div>
                  <div className="flex items-center justify-center py-1">
                    <ArrowRight className="w-4 h-4 text-indigo-300" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-indigo-700 font-bold">Nouveau Solde Prévisionnel</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-xl font-black ${nextBalance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {Math.abs(nextBalance).toLocaleString()} DH
                      </span>
                      <Badge variant={nextBalance >= 0 ? "default" : "destructive"} className="text-[10px] uppercase">
                        {nextBalance >= 0 ? 'Crédit' : 'Dette'}
                      </Badge>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex gap-3 pt-2">
              <Button 
                type="button" 
                variant="outline" 
                className="flex-1 h-12 border-slate-200 text-slate-600 hover:bg-slate-50"
                onClick={() => onOpenChange(false)}
              >
                Annuler
              </Button>
              <Button 
                type="submit" 
                className="flex-[2] h-12 bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200 transition-all hover:scale-[1.02] active:scale-[0.98]"
                disabled={paymentAmount <= 0}
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Confirmer le paiement
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    );
};
