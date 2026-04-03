import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useApp } from '@/contexts/AppContext';
import { Plus, Truck, User, Hash } from 'lucide-react';
import { toast } from 'sonner';

interface AddTruckDialogProps {
  trigger?: React.ReactNode;
}

const TrailerIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="inline-block">
    <path d="M2 14.5V6C2 5.44772 2.44772 5 3 5H15V14.5H2Z" fill="#3B82F6" stroke="#1E40AF" strokeWidth="1"/>
    <path d="M15 14.5V7C15 6.44772 15.4477 6 16 6H20.5L22 9V14.5H15Z" fill="#60A5FA" stroke="#1E40AF" strokeWidth="1"/>
    <circle cx="5" cy="16" r="2.5" fill="#1F2937" stroke="white" strokeWidth="1"/>
    <circle cx="12" cy="16" r="2.5" fill="#1F2937" stroke="white" strokeWidth="1"/>
    <circle cx="19" cy="16" r="2.5" fill="#1F2937" stroke="white" strokeWidth="1"/>
    <path d="M18 9H21" stroke="white" strokeWidth="1" strokeLinecap="round"/>
    <rect x="2" y="14" width="20" height="1" fill="#1E40AF"/>
  </svg>
);

export const AddTruckDialog = ({ trigger }: AddTruckDialogProps) => {
  const { addTruck, drivers = [] } = useApp();
  const availableDrivers = drivers.filter((driver: any) => !driver.isUnavailable);
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    matricule: '',
    driverId: '',
    truckType: 'camion' as 'camion' | 'remorque' | 'petit-camion' | 'clark'
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.driverId) {
      toast.error('Veuillez sélectionner un chauffeur');
      return;
    }

    addTruck({
      id: (window.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)),
      matricule: formData.matricule,
      driverId: formData.driverId,
      truckType: formData.truckType,
      isActive: true,
      currentLoad: [],
      updatedAt: new Date().toISOString(),
      nextReturnDate: undefined,
      reposReason: undefined,
      techStatus: 'operational'
    });

    toast.success('Camion ajouté avec succès');
    setOpen(false);
    setFormData({ matricule: '', driverId: '', truckType: 'camion' });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition-all rounded-xl h-11 px-6 font-bold">
            <Plus className="w-5 h-5 mr-2" />
            Ajouter un camion
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md p-0 border-none overflow-hidden shadow-2xl">
        <div className="bg-indigo-600 p-6 text-white">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                <Truck className="w-6 h-6" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-white">Nouveau Camion</DialogTitle>
                <p className="text-indigo-100 text-xs mt-0.5">Enregistrer un véhicule dans la flotte</p>
              </div>
            </div>
          </DialogHeader>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-5 bg-white">
          <div className="space-y-2">
            <Label htmlFor="matricule" className="text-slate-700 font-semibold ml-1">Matricule</Label>
            <div className="relative group">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
              <Input
                id="matricule"
                value={formData.matricule}
                onChange={(e) => setFormData({ ...formData, matricule: e.target.value })}
                placeholder="Ex: A-12345"
                className="pl-10 h-11 bg-slate-50 border-slate-100 focus:ring-2 focus:ring-indigo-600 transition-all rounded-xl"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="truckType" className="text-slate-700 font-semibold ml-1">Type de véhicule</Label>
            <Select value={formData.truckType} onValueChange={(value: 'camion' | 'remorque' | 'petit-camion' | 'clark') => setFormData({ ...formData, truckType: value })}>
              <SelectTrigger className="h-11 bg-slate-50 border-slate-100 focus:ring-2 focus:ring-indigo-600 transition-all rounded-xl">
                <SelectValue placeholder="Sélectionner le type" />
              </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-100 shadow-xl">
                  <SelectItem value="camion" className="rounded-lg">
                    <span className="inline-flex items-center gap-2">
                      <img src="/truck-types/camion.png" alt="Camion" className="h-4 w-6 object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
                      <span>Camion</span>
                    </span>
                  </SelectItem>
                  <SelectItem value="remorque" className="rounded-lg">
                    <span className="inline-flex items-center gap-2">
                      <img src="/truck-types/remorque.png" alt="Remorque" className="h-4 w-6 object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
                      <span>Remorque</span>
                    </span>
                  </SelectItem>
                  <SelectItem value="petit-camion" className="rounded-lg">
                    <span className="inline-flex items-center gap-2">
                      <img src="/truck-types/allogaz.png" alt="Allogaz" className="h-4 w-6 object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
                      <span>Allogaz</span>
                    </span>
                  </SelectItem>
                  <SelectItem value="clark" className="rounded-lg">
                    <span className="inline-flex items-center gap-2">
                      <img src="/truck-types/clark.jpeg" alt="Clark" className="h-4 w-6 object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
                      <span>Clark</span>
                    </span>
                  </SelectItem>
                </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="driverId" className="text-slate-700 font-semibold ml-1">Assigner un chauffeur</Label>
            <div className="relative group">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors z-10" />
              <Select 
                value={formData.driverId} 
                onValueChange={(value) => setFormData({ ...formData, driverId: value })}
              >
                <SelectTrigger className="pl-10 h-11 bg-slate-50 border-slate-100 focus:ring-2 focus:ring-indigo-600 transition-all rounded-xl">
                  <SelectValue placeholder="Sélectionner un chauffeur" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-100 shadow-xl">
                  {availableDrivers.map(driver => (
                    <SelectItem key={driver.id} value={String(driver.id)} className="rounded-lg">
                      {driver.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="submit" className="flex-1 h-11 bg-indigo-600 hover:bg-indigo-700 shadow-md transition-all font-bold rounded-xl">
              Confirmer
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} className="flex-1 h-11 border-slate-200 font-medium rounded-xl">
              Annuler
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
