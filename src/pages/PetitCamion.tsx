import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useApp } from '@/contexts/AppContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Truck, Users, ArrowRight, ArrowLeft, Building2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { RecordReturnDialog } from '@/components/dialogs/RecordReturnDialog';
import { CreateSupplyOrderDialog } from '@/components/dialogs/CreateSupplyOrderDialog';

type AnimateState = 'idle' | 'supply' | 'return';

const PetitCamion = () => {
  const { trucks, drivers, supplyOrders } = useApp();
  const { toast } = useToast();
  const { language } = useLanguage();
  const tr = (frText: string, arText: string) => (language === 'ar' ? arText : frText);
  
  const [selectedTruckId, setSelectedTruckId] = useState<string>('');
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [showSupplyDialog, setShowSupplyDialog] = useState(false);
  const [showReturnDialog, setShowReturnDialog] = useState(false);
  const [animationState, setAnimationState] = useState<AnimateState>('idle');

  // Filter only petit camion trucks
  const petitCamionTrucks = trucks.filter(truck => truck.truckType === 'petit-camion');
  
  const selectedTruck = trucks.find(t => t.id === selectedTruckId);
  const selectedDriver = drivers.find(d => d.id === selectedDriverId);
  const latestSupplyOrder = supplyOrders
    .filter(order => order.driverId === selectedDriverId && order.truckId === selectedTruckId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0] || null;

  const handleSupplyTruck = () => {
    if (!selectedTruckId || !selectedDriverId) {
      toast({
        title: tr("Sélection requise", "اختيار مطلوب"),
        description: tr("Veuillez sélectionner Allogaz et un chauffeur", "يرجى اختيار ألوغاز وسائق"),
        variant: "destructive",
      });
      return;
    }

    setAnimationState('supply');
    setTimeout(() => {
      setShowSupplyDialog(true);
      setAnimationState('idle');
    }, 1000);
  };

  const handleReturnTruck = () => {
    if (!selectedTruckId || !selectedDriverId) {
      toast({
        title: tr("Sélection requise", "اختيار مطلوب"),
        description: tr("Veuillez sélectionner Allogaz et un chauffeur", "يرجى اختيار ألوغاز وسائق"),
        variant: "destructive",
      });
      return;
    }

    // Find the latest supply order for this truck and driver
    if (!latestSupplyOrder) {
      toast({
        title: tr("Aucun bon de sortie trouvé", "لا يوجد سند خروج"),
        description: tr("Aucun bon de sortie trouvé pour ce chauffeur et cet Allogaz. Veuillez d'abord alimenter Allogaz.", "لا يوجد سند خروج لهذا السائق ولهذا الألوغاز. يرجى تغذية ألوغاز أولاً."),
        variant: "destructive",
      });
      return;
    }

    setAnimationState('return');
    setTimeout(() => {
      setShowReturnDialog(true);
      setAnimationState('idle');
    }, 1000);
  };

  return (
    <div className="app-page-shell container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Truck className="w-8 h-8 text-primary" />
        <div>
          <h1 className="app-page-title text-3xl font-bold">{tr("ALLOGAZ", "ألوغاز")}</h1>
          <p className="app-page-subtitle text-muted-foreground">{tr("Gestion Allogaz", "إدارة ألوغاز")}</p>
        </div>
      </div>

      {/* Selection Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            {tr("Sélection Allogaz et Chauffeur", "اختيار ألوغاز والسائق")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="truck-select">{tr("Allogaz", "ألوغاز")}</Label>
              <Select value={selectedTruckId} onValueChange={setSelectedTruckId}>
                <SelectTrigger id="truck-select">
                  <SelectValue placeholder={tr("Sélectionner Allogaz", "اختر ألوغاز")} />
                </SelectTrigger>
                <SelectContent>
                  {petitCamionTrucks.length === 0 && (
                    <SelectItem disabled value="none">{tr("Aucun Allogaz disponible", "لا يوجد ألوغاز متاح")}</SelectItem>
                  )}
                  {petitCamionTrucks.map(truck => {
                    const driver = drivers.find(d => d.id === truck.driverId);
                    return (
                      <SelectItem key={truck.id} value={truck.id}>
                        {truck.matricule} - {driver?.name || tr('Sans chauffeur', 'بدون سائق')}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="driver-select">{tr("Sélectionnez un chauffeur", "اختر سائقًا")}</Label>
              <Select value={selectedDriverId} onValueChange={setSelectedDriverId}>
                <SelectTrigger id="driver-select">
                  <SelectValue placeholder={tr("Sélectionner un chauffeur", "اختر سائقًا")} />
                </SelectTrigger>
                <SelectContent>
                  {drivers.map(driver => (
                    <SelectItem key={driver.id} value={driver.id}>
                      {driver.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedTruck && selectedDriver && (
            <div className="mt-4 p-4 bg-muted/50 rounded-lg">
              <h3 className="font-medium mb-2">{tr("Sélection actuelle:", "الاختيار الحالي:")}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">{tr("Allogaz:", "ألوغاز:")}</span> {selectedTruck.matricule}
                </div>
                <div>
                  <span className="font-medium">{tr("Chauffeur:", "السائق:")}</span> {selectedDriver.name}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Animation and Action Section */}
      <Card>
        <CardHeader>
          <CardTitle>{tr("Opérations", "العمليات")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center space-y-6">
            {/* Animation Area */}
            <div className="relative w-full max-w-md h-32 bg-gradient-to-b from-sky-100 to-green-100 rounded-lg overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center">
                {/* Building */}
                <div className="relative">
                  <Building2 className="w-16 h-16 text-gray-600" />
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                </div>
                
                {/* Truck Animation */}
                <div className={`absolute transition-all duration-1000 ease-in-out ${
                  animationState === 'supply' 
                    ? 'transform translate-x-20 opacity-75' 
                    : animationState === 'return'
                    ? 'transform -translate-x-20 opacity-75'
                    : 'transform translate-x-0 opacity-100'
                }`}>
                  <Truck className={`w-8 h-8 transition-colors duration-500 ${
                    animationState === 'supply' ? 'text-blue-500' : 
                    animationState === 'return' ? 'text-green-500' : 
                    'text-gray-400'
                  }`} />
                </div>
              </div>
              
              {/* Animation Effects */}
              {animationState === 'supply' && (
                <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                  <ArrowRight className="w-6 h-6 text-blue-500 animate-bounce" />
                </div>
              )}
              {animationState === 'return' && (
                <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
                  <ArrowLeft className="w-6 h-6 text-green-500 animate-bounce" />
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4">
              <Button
                onClick={handleSupplyTruck}
                disabled={!selectedTruckId || !selectedDriverId || animationState !== 'idle'}
                className="flex items-center gap-2"
                size="lg"
              >
                <ArrowRight className="w-4 h-4" />
                {tr("Alimenter Allogaz", "تغذية ألوغاز")}
              </Button>
              
              <Button
                onClick={handleReturnTruck}
                disabled={!selectedTruckId || !selectedDriverId || animationState !== 'idle'}
                variant="outline"
                className="flex items-center gap-2"
                size="lg"
              >
                <ArrowLeft className="w-4 h-4" />
                {tr("Retour Allogaz", "إرجاع ألوغاز")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Supply Dialog - Create new supply order */}
      {showSupplyDialog && selectedDriver && (
        <CreateSupplyOrderDialog
          open={showSupplyDialog}
          onOpenChange={setShowSupplyDialog}
          driverId={selectedDriverId}
          driverName={selectedDriver.name}
          truckId={selectedTruckId}
        />
      )}

      {/* Return Dialog - Process return for existing supply order */}
      {showReturnDialog && latestSupplyOrder && (
        <RecordReturnDialog
          open={showReturnDialog}
          onOpenChange={setShowReturnDialog}
          supplyOrder={latestSupplyOrder}
        />
      )}
    </div>
  );
};

export default PetitCamion;
