import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useApp } from '@/contexts/AppContext';
import { Package } from 'lucide-react';
import { toast } from 'sonner';

export const AddBottleTypeDialog = () => {
  const { addBottleType, bottleTypes } = useApp();
  const colorPresets = ['#2563eb', '#16a34a', '#ef4444', '#f59e0b', '#111827', '#06b6d4', '#7c3aed', '#f97316'];
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    capacity: '',
    totalQuantity: '',
    unitPrice: '',
    purchasePrice: '',
    taxRate: '20',
    color: '#2563eb'
  });

  // Reset form when dialog opens
  React.useEffect(() => {
    if (open) {
      setFormData({
        name: '',
        capacity: '',
        totalQuantity: '',
        unitPrice: '',
        purchasePrice: '',
        taxRate: '20',
        color: '#2563eb'
      });
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check for duplicates with safe access
    const isDuplicate = bottleTypes.some(
      bt => (bt.name || (bt as any).name || '').toLowerCase() === formData.name.toLowerCase()
    );

    if (isDuplicate) {
      toast.error('Ce type de bouteille existe déjà');
      return;
    }
    const totalQty = parseInt(formData.totalQuantity) || 0;
    const newBottle = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36),
      name: formData.name,
      capacity: formData.capacity,
      totalQuantity: totalQty,
      distributedQuantity: 0,
      remainingQuantity: totalQty,
      unitPrice: parseFloat(formData.unitPrice) || 0,
      purchasePrice: parseFloat(formData.purchasePrice) || 0,
      taxRate: parseFloat(formData.taxRate) || 0,
      color: formData.color || '#2563eb'
    };

    const result = await addBottleType(newBottle);
    
    if (result) {
      toast.success('Type de bouteille ajouté avec succès');
      setOpen(false);
      setFormData({ name: '', capacity: '', totalQuantity: '', unitPrice: '', purchasePrice: '', taxRate: '20', color: '#2563eb' });
    } else {
      toast.error('Erreur lors de l\'ajout du type de bouteille');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Package className="w-4 h-4 mr-2" />
          Ajouter un type
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajouter un type de bouteille</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Nom</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ex: Butane 12KG"
              required
            />
          </div>
          <div>
            <Label htmlFor="capacity">Capacité</Label>
            <Input
              id="capacity"
              value={formData.capacity}
              onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
              placeholder="Ex: 12KG"
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
              placeholder="500"
              required
            />
          </div>
          <div>
            <Label htmlFor="unitPrice">Prix unitaire (DH)</Label>
            <Input
              id="unitPrice"
              type="number"
              step="0.01"
              value={formData.unitPrice}
              onChange={(e) => setFormData({ ...formData, unitPrice: e.target.value })}
              placeholder="150"
              required
            />
          </div>
          <div>
            <Label htmlFor="purchasePrice">Prix d'achat (DH)</Label>
            <Input
              id="purchasePrice"
              type="number"
              step="0.01"
              value={formData.purchasePrice}
              onChange={(e) => setFormData({ ...formData, purchasePrice: e.target.value })}
              placeholder="120"
              required
            />
          </div>
          <div>
            <Label htmlFor="color">Couleur de la bouteille</Label>
            <div className="mt-2 space-y-2">
              <div className="flex items-center gap-3">
                <Input
                  id="color"
                  type="color"
                  className="h-10 w-16 p-1 cursor-pointer"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                />
                <span className="text-xs font-mono text-slate-500">{formData.color}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {colorPresets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setFormData({ ...formData, color: preset })}
                    className={`h-6 w-6 rounded-full border ${formData.color === preset ? 'border-slate-900 ring-2 ring-slate-300' : 'border-slate-300'}`}
                    style={{ backgroundColor: preset }}
                  />
                ))}
              </div>
            </div>
          </div>
          <div>
            <Label htmlFor="taxRate">Taux de taxe (%)</Label>
            <Input
              id="taxRate"
              type="number"
              step="0.01"
              value={formData.taxRate}
              onChange={(e) => setFormData({ ...formData, taxRate: e.target.value })}
              placeholder="20"
              required
            />
          </div>
          <Button type="submit" className="w-full">Ajouter</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
