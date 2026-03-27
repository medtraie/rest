import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useApp } from '@/contexts/AppContext';
import { BottleType } from '@/types';
import { toast } from 'sonner';

interface EditBottleTypeDialogProps {
  bottle: BottleType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const EditBottleTypeDialog = ({ bottle, open, onOpenChange }: EditBottleTypeDialogProps) => {
  const { updateBottleType, bottleTypes } = useApp();
  const displayTaxRate = '10';
  const [formData, setFormData] = useState({
    name: bottle?.name || '',
    capacity: bottle?.capacity || '',
    totalQuantity: (
      bottle?.totalQuantity ??
      (bottle?.remainingQuantity || 0) + (bottle?.distributedQuantity || 0)
    ).toString(),
    unitPrice: (bottle?.unitPrice ?? 0).toString(),
    taxRate: (bottle?.taxRate ?? 20).toString()
  });

  useEffect(() => {
    if (open && bottle) {
      setFormData({
        name: bottle.name || (bottle as any).name || '',
        capacity: bottle.capacity || (bottle as any).capacity || '',
        totalQuantity: (
          bottle.totalQuantity ??
          (bottle as any).totalquantity ??
          ((bottle.remainingQuantity ?? (bottle as any).remainingquantity ?? 0) +
           (bottle.distributedQuantity ?? (bottle as any).distributedquantity ?? 0))
        ).toString(),
        unitPrice: (bottle.unitPrice ?? (bottle as any).unitprice ?? 0).toString(),
        taxRate: (bottle.taxRate ?? (bottle as any).taxrate ?? 20).toString()
      });
    }
  }, [bottle, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check for duplicates if name changed
    const currentName = bottle.name || (bottle as any).name || '';
    if (formData.name.toLowerCase() !== currentName.toLowerCase()) {
      const isDuplicate = bottleTypes.some(
        bt => bt.id !== bottle.id && (bt.name || (bt as any).name || '').toLowerCase() === formData.name.toLowerCase()
      );

      if (isDuplicate) {
        toast.error('Ce type de bouteille existe déjà');
        return;
      }
    }

    const newTotalQuantity = parseInt(formData.totalQuantity) || 0;
    const currentRemainingQuantity = bottle.remainingQuantity ?? (bottle as any).remainingquantity ?? 0;
    const currentDistributedQuantity = bottle.distributedQuantity ?? (bottle as any).distributedquantity ?? 0;
    const currentTotalQuantity =
      (bottle.totalQuantity ?? (bottle as any).totalquantity) ??
      (currentRemainingQuantity + currentDistributedQuantity);
    const quantityDifference = newTotalQuantity - Number(currentTotalQuantity || 0);
    
    const result = await updateBottleType(bottle.id, {
      name: formData.name,
      capacity: formData.capacity,
      totalQuantity: newTotalQuantity,
      remainingQuantity: Math.max(0, currentRemainingQuantity + quantityDifference),
      unitPrice: parseFloat(formData.unitPrice) || 0,
      taxRate: Number(bottle.taxRate ?? (bottle as any).taxrate ?? 0)
    });
    
    if (result) {
      toast.success('Type de bouteille modifié avec succès');
      onOpenChange(false);
    } else {
      toast.error('Erreur lors de la modification');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modifier {bottle.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Nom</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          <div>
            <Label htmlFor="capacity">Capacité</Label>
            <Input
              id="capacity"
              value={formData.capacity}
              onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
              required
            />
          </div>
          <div>
            <Label htmlFor="totalQuantity">Quantité totale</Label>
            <Input
              id="totalQuantity"
              type="number"
              value={formData.totalQuantity}
              onChange={(e) => setFormData({ ...formData, totalQuantity: e.target.value })}
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              Actuel: {Number(bottle.totalQuantity ?? (bottle as any).totalquantity ?? ((bottle.remainingQuantity ?? (bottle as any).remainingquantity ?? 0) + (bottle.distributedQuantity ?? (bottle as any).distributedquantity ?? 0)))} | Restant: {Math.max(Number(bottle.totalQuantity ?? (bottle as any).totalquantity ?? ((bottle.remainingQuantity ?? (bottle as any).remainingquantity ?? 0) + (bottle.distributedQuantity ?? (bottle as any).distributedquantity ?? 0))) - Number(bottle.distributedQuantity ?? (bottle as any).distributedquantity ?? 0), 0)} | Distribué: {Number(bottle.distributedQuantity ?? (bottle as any).distributedquantity ?? 0)}
            </p>
          </div>
          <div>
            <Label htmlFor="unitPrice">Prix unitaire (DH)</Label>
            <Input
              id="unitPrice"
              type="number"
              step="0.01"
              value={formData.unitPrice}
              onChange={(e) => setFormData({ ...formData, unitPrice: e.target.value })}
              required
            />
          </div>
          <div>
            <Label htmlFor="taxRate">Taux de taxe (%)</Label>
            <Input
              id="taxRate"
              type="text"
              value={displayTaxRate}
              disabled
              readOnly
            />
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Annuler
            </Button>
            <Button type="submit" className="flex-1">Enregistrer</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
