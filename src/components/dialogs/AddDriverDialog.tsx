import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useApp } from '@/contexts/AppContext';
import { Plus, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';

interface AddDriverDialogProps {
  trigger?: React.ReactNode;
}

export const AddDriverDialog = ({ trigger }: AddDriverDialogProps) => {
  const { addDriver, updateTruck, trucks = [], drivers = [] } = useApp();
  const [open, setOpen] = useState(false);
  const [selectedTruckId, setSelectedTruckId] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    aideLivreurs: '',
    codeAL: '',
    adresse: '',
    ville: '',
    telephone: '',
    nCin: '',
    vehicule: '',
    nPermis: ''
  });
  const setField = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newDriverId = crypto.randomUUID();
    const selectedTruck = trucks.find((truck) => String(truck.id) === String(selectedTruckId));
    
    await addDriver({
      id: newDriverId,
      name: formData.name.trim(),
      code: formData.code.trim() || undefined,
      aideLivreurs: formData.aideLivreurs.trim() || undefined,
      codeAL: formData.codeAL.trim() || undefined,
      adresse: formData.adresse.trim() || undefined,
      ville: formData.ville.trim() || undefined,
      telephone: formData.telephone.trim() || undefined,
      nCin: formData.nCin.trim() || undefined,
      vehicule: selectedTruck?.matricule || formData.vehicule.trim() || undefined,
      nPermis: formData.nPermis.trim() || undefined,
      debt: 0,
      advances: 0,
      balance: 0,
      debtThreshold: 0,
      foreignBottlesThreshold: 0
    });

    if (selectedTruck) {
      await updateTruck(selectedTruck.id, { driverId: newDriverId });
    }
    
    toast.success('Chauffeur ajouté avec succès');
    setOpen(false);
    setSelectedTruckId('');
    setFormData({ name: '', code: '', aideLivreurs: '', codeAL: '', adresse: '', ville: '', telephone: '', nCin: '', vehicule: '', nPermis: '' });
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
      <DialogContent className="max-w-2xl p-0 border-none overflow-hidden shadow-2xl">
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

        <form onSubmit={handleSubmit} className="p-6 space-y-5 bg-white">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-slate-700 font-semibold ml-1">Nom complet du chauffeur</Label>
            <div className="relative group">
              <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setField('name', e.target.value)}
                placeholder="Ex: Ahmed Hassan"
                className="pl-10 h-12 bg-slate-50 border-none focus-visible:ring-2 focus-visible:ring-indigo-600 transition-all shadow-inner"
                required
              />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/60 space-y-3">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Identification</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="code" className="text-slate-700 font-semibold ml-1 flex items-center gap-1">
                  Code <span className="text-[10px] text-slate-400 font-normal">(Optionnel)</span>
                </Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setField('code', e.target.value)}
                  placeholder="Ex: D210"
                  className="h-12 bg-white border border-slate-200 focus-visible:ring-2 focus-visible:ring-indigo-600 transition-all"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="aideLivreurs" className="text-slate-700 font-semibold ml-1 flex items-center gap-1">
                  Aide livreurs <span className="text-[10px] text-slate-400 font-normal">(Optionnel)</span>
                </Label>
                <Input
                  id="aideLivreurs"
                  value={formData.aideLivreurs}
                  onChange={(e) => setField('aideLivreurs', e.target.value)}
                  placeholder="Ex: 2 ou Nom aide"
                  className="h-12 bg-white border border-slate-200 focus-visible:ring-2 focus-visible:ring-indigo-600 transition-all"
                />
              </div>
              <div className="space-y-2 md:col-span-3">
                <Label htmlFor="codeAL" className="text-slate-700 font-semibold ml-1 flex items-center gap-1">
                  Code A.L <span className="text-[10px] text-slate-400 font-normal">(Optionnel)</span>
                </Label>
                <Input
                  id="codeAL"
                  value={formData.codeAL}
                  onChange={(e) => setField('codeAL', e.target.value)}
                  placeholder="Ex: AL-2026-01"
                  className="h-12 bg-white border border-slate-200 focus-visible:ring-2 focus-visible:ring-indigo-600 transition-all"
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/60 space-y-3">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Coordonnées</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="vehiculeSelect" className="text-slate-700 font-semibold ml-1 flex items-center gap-1">
                Camion (depuis Trucks) <span className="text-[10px] text-slate-400 font-normal">(Optionnel)</span>
              </Label>
              <Select
                value={selectedTruckId || 'none'}
                onValueChange={(value) => {
                  const nextValue = value === 'none' ? '' : value;
                  setSelectedTruckId(nextValue);
                  const truck = trucks.find((item) => String(item.id) === String(nextValue));
                  if (truck) setField('vehicule', truck.matricule);
                }}
              >
                <SelectTrigger id="vehiculeSelect" className="h-12 bg-white border border-slate-200 focus:ring-2 focus:ring-indigo-600">
                  <SelectValue placeholder="Sélectionner un camion" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun camion</SelectItem>
                  {trucks.map((truck) => {
                    const assignedDriver = drivers.find((d) => String(d.id) === String(truck.driverId));
                    return (
                      <SelectItem key={truck.id} value={String(truck.id)}>
                        {truck.matricule}{assignedDriver ? ` • ${assignedDriver.name}` : ''}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="adresse" className="text-slate-700 font-semibold ml-1 flex items-center gap-1">
                Adresse <span className="text-[10px] text-slate-400 font-normal">(Optionnel)</span>
              </Label>
              <Input
                id="adresse"
                value={formData.adresse}
                onChange={(e) => setField('adresse', e.target.value)}
                placeholder="Ex: Quartier Al Massira"
                className="h-12 bg-white border border-slate-200 focus-visible:ring-2 focus-visible:ring-indigo-600 transition-all"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ville" className="text-slate-700 font-semibold ml-1 flex items-center gap-1">
                Ville <span className="text-[10px] text-slate-400 font-normal">(Optionnel)</span>
              </Label>
              <Input
                id="ville"
                value={formData.ville}
                onChange={(e) => setField('ville', e.target.value)}
                placeholder="Ex: Beni Mellal"
                className="h-12 bg-white border border-slate-200 focus-visible:ring-2 focus-visible:ring-indigo-600 transition-all"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="telephone" className="text-slate-700 font-semibold ml-1 flex items-center gap-1">
                Téléphone <span className="text-[10px] text-slate-400 font-normal">(Optionnel)</span>
              </Label>
              <Input
                id="telephone"
                value={formData.telephone}
                onChange={(e) => setField('telephone', e.target.value)}
                placeholder="Ex: 0612345678"
                className="h-12 bg-white border border-slate-200 focus-visible:ring-2 focus-visible:ring-indigo-600 transition-all"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nCin" className="text-slate-700 font-semibold ml-1 flex items-center gap-1">
                N CIN <span className="text-[10px] text-slate-400 font-normal">(Optionnel)</span>
              </Label>
              <Input
                id="nCin"
                value={formData.nCin}
                onChange={(e) => setField('nCin', e.target.value)}
                placeholder="Ex: AB123456"
                className="h-12 bg-white border border-slate-200 focus-visible:ring-2 focus-visible:ring-indigo-600 transition-all"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="vehicule" className="text-slate-700 font-semibold ml-1 flex items-center gap-1">
                Véhicule <span className="text-[10px] text-slate-400 font-normal">(Optionnel)</span>
              </Label>
              <Input
                id="vehicule"
                value={formData.vehicule}
                onChange={(e) => setField('vehicule', e.target.value)}
                placeholder="Ex: Camion 3.5T"
                className="h-12 bg-white border border-slate-200 focus-visible:ring-2 focus-visible:ring-indigo-600 transition-all"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nPermis" className="text-slate-700 font-semibold ml-1 flex items-center gap-1">
                N Permis <span className="text-[10px] text-slate-400 font-normal">(Optionnel)</span>
              </Label>
              <Input
                id="nPermis"
                value={formData.nPermis}
                onChange={(e) => setField('nPermis', e.target.value)}
                placeholder="Ex: P-987654"
                className="h-12 bg-white border border-slate-200 focus-visible:ring-2 focus-visible:ring-indigo-600 transition-all"
              />
            </div>
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
