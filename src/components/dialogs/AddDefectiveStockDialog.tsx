import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useApp } from '@/contexts/AppContext';
import { BottleType } from '@/types';
import { AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AddDefectiveStockDialogProps {
  bottleType: BottleType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AddDefectiveStockDialog = ({
  bottleType,
  open,
  onOpenChange,
}: AddDefectiveStockDialogProps) => {
  const { addDefectiveStock } = useApp();
  const { toast } = useToast();
  const [quantity, setQuantity] = useState<number>(0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (quantity <= 0) {
      toast({
        title: "Erreur",
        description: "La quantité doit être supérieure à 0",
        variant: "destructive",
      });
      return;
    }

    addDefectiveStock(bottleType.id, quantity);
    
    toast({
      title: "Succès",
      description: `${quantity} bouteilles défectueuses de ${bottleType.name} ajoutées au stock`,
    });
    
    setQuantity(0);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            Ajouter Stock Défectueux - {bottleType.name}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="capacity">Capacité</Label>
            <Input
              id="capacity"
              value={bottleType.capacity}
              disabled
              className="bg-muted"
            />
          </div>

          <div>
            <Label htmlFor="quantity">Quantité de bouteilles défectueuses *</Label>
            <Input
              id="quantity"
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
              placeholder="Entrer la quantité"
              required
            />
          </div>

          <div className="flex gap-2 justify-end pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Annuler
            </Button>
            <Button type="submit" variant="destructive">
              Ajouter au Stock
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
