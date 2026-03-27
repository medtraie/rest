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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useApp } from '@/contexts/AppContext';
import { useToast } from '@/hooks/use-toast';
import { BottleType } from '@/types';
import { COMPANIES } from '@/pages/Exchanges';

interface AddForeignBottleDialogProps {
  bottleType: BottleType;
  companyName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AddForeignBottleDialog: React.FC<AddForeignBottleDialogProps> = ({
  bottleType,
  companyName: initialCompany,
  open,
  onOpenChange,
}) => {
  const { addForeignBottle, brands } = useApp();
  const { toast } = useToast();
  const [companyName, setCompanyName] = useState(initialCompany || '');
  const [quantity, setQuantity] = useState(0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!companyName) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner une marque",
        variant: "destructive"
      });
      return;
    }

    if (quantity <= 0) {
      toast({
        title: "Erreur",
        description: "La quantité doit être supérieure à 0",
        variant: "destructive"
      });
      return;
    }

    addForeignBottle({
      returnOrderId: 'direct',
      companyName,
      bottleType: bottleType.name,
      quantity,
      type: 'normal',
      date: new Date().toISOString()
    });

    toast({
      title: "Stock ajouté",
      description: `${quantity} ${bottleType.name} de ${companyName} ajoutées`,
    });

    setQuantity(0);
    setCompanyName(initialCompany || '');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajouter une bouteille étrangère</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="company">Marque</Label>
            <Select value={companyName} onValueChange={setCompanyName}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une marque" />
              </SelectTrigger>
              <SelectContent>
                {brands.map((brand) => (
                  <SelectItem key={brand.id} value={brand.name}>
                    {brand.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="quantity">Quantité</Label>
            <Input
              id="quantity"
              type="number"
              min="1"
              value={quantity || ''}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
              placeholder="Entrer la quantité"
            />
          </div>

          <div className="flex gap-2">
            <Button type="submit" className="flex-1">
              Ajouter
            </Button>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Annuler
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
