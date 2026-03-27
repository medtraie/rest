import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useApp } from '@/contexts/AppContext';
import { Plus, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';

interface AddDriverDialogProps {
  trigger?: React.ReactNode;
}

export const AddDriverDialog = ({ trigger }: AddDriverDialogProps) => {
  const { addDriver } = useApp();
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    addDriver({
      id: crypto.randomUUID(),
      name: formData.name,
      debt: 0,
      advances: 0,
      balance: 0
    });
    
    toast.success('Chauffeur ajouté avec succès');
    setOpen(false);
    setFormData({ name: '' });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Ajouter un chauffeur
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md p-0 border-none overflow-hidden shadow-2xl">
        <div className="bg-indigo-600 p-6 text-white">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                <UserPlus className="w-6 h-6" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-white">Nouveau Chauffeur</DialogTitle>
                <p className="text-indigo-100 text-xs mt-0.5">Ajouter un nouveau membre à l'équipe</p>
              </div>
            </div>
          </DialogHeader>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 bg-white">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-slate-700 font-semibold ml-1">Nom complet du chauffeur</Label>
            <div className="relative group">
              <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Ahmed Hassan"
                className="pl-10 h-12 bg-slate-50 border-none focus-visible:ring-2 focus-visible:ring-indigo-600 transition-all shadow-inner"
                required
              />
            </div>
          </div>
          
          <div className="flex gap-3 pt-2">
            <Button type="submit" className="flex-1 h-12 bg-indigo-600 hover:bg-indigo-700 shadow-md transition-all font-bold">
              Confirmer l'ajout
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} className="flex-1 h-12 border-slate-200 font-medium">
              Annuler
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
