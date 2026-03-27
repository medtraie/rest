import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Fuel, Settings, Plus, Minus } from 'lucide-react';

const OilBarrelsWidget: React.FC = () => {
  const navigate = useNavigate();
  const readOilData = () => {
    const purchases = JSON.parse(localStorage.getItem('oilManagement.purchases') || '[]');
    const consumptions = JSON.parse(localStorage.getItem('oilManagement.consumptions') || '[]');
    const baseStock = parseFloat(localStorage.getItem('oilManagement.baseStockLiters') || '0');
    const totalPurchased = baseStock + purchases.reduce((sum: number, p: any) => sum + p.quantityLiters, 0);
    const totalConsumed = consumptions.reduce((sum: number, c: any) => sum + c.quantityLiters, 0);
    const currentStock = Math.max(0, totalPurchased - totalConsumed);
    const capacity = 1000;
    const level = Math.min((currentStock / capacity) * 100, 100);
    return { currentStock, totalPurchased, totalConsumed, level };
  };
  
  const [barrelCount, setBarrelCount] = useState<number>(() => {
    const raw = localStorage.getItem('oilManagement.barrelCount');
    return raw ? parseInt(raw) : 5;
  });

  const [oilData, setOilData] = useState(() => readOilData());
  const oilLevel = oilData.level;

  useEffect(() => {
    localStorage.setItem('oilManagement.barrelCount', barrelCount.toString());
  }, [barrelCount]);

  useEffect(() => {
    const refresh = () => setOilData(readOilData());
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    window.addEventListener('storage', refresh);
    document.addEventListener('visibilitychange', onVisibilityChange);
    refresh();
    return () => {
      window.removeEventListener('storage', refresh);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  const barrels = Array.from({ length: Math.max(1, barrelCount) }, (_, i) => i);

  const adjustBarrelCount = (delta: number) => {
    setBarrelCount(prev => Math.max(1, Math.min(20, prev + delta)));
  };

  return (
    <Card className="w-full border-none shadow-lg ring-1 ring-slate-200/70 bg-gradient-to-b from-white to-slate-50/60 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-xl">
      <CardHeader className="pb-3">
        <CardTitle className="group flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Fuel className="w-4 h-4 text-blue-600 transition-transform duration-300 ease-out group-hover:scale-110" />
            Gestion d'Huile
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/oil-management')}
            className="h-6 px-2 text-xs"
          >
            <Settings className="w-3 h-3 mr-1" />
            Gérer
          </Button>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">Barils:</Label>
          <div className="flex items-center gap-1">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => adjustBarrelCount(-1)}
              className="h-6 w-6 p-0"
              disabled={barrelCount <= 1}
            >
              <Minus className="w-3 h-3" />
            </Button>
            <span className="text-sm font-medium w-8 text-center">{barrelCount}</span>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => adjustBarrelCount(1)}
              className="h-6 w-6 p-0"
              disabled={barrelCount >= 20}
            >
              <Plus className="w-3 h-3" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-slate-50 px-2 py-1.5 ring-1 ring-slate-200/70 transition-all duration-300 ease-out hover:bg-slate-100">
            <div className="text-[10px] uppercase tracking-wide text-slate-500">Stock</div>
            <div className="text-xs font-bold text-slate-800">{Math.round(oilData.currentStock)} L</div>
          </div>
          <div className="rounded-lg bg-emerald-50 px-2 py-1.5 ring-1 ring-emerald-100 transition-all duration-300 ease-out hover:bg-emerald-100">
            <div className="text-[10px] uppercase tracking-wide text-emerald-500">Entrées</div>
            <div className="text-xs font-bold text-emerald-700">{Math.round(oilData.totalPurchased)} L</div>
          </div>
          <div className="rounded-lg bg-rose-50 px-2 py-1.5 ring-1 ring-rose-100 transition-all duration-300 ease-out hover:bg-rose-100">
            <div className="text-[10px] uppercase tracking-wide text-rose-500">Sorties</div>
            <div className="text-xs font-bold text-rose-700">{Math.round(oilData.totalConsumed)} L</div>
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          {barrels.slice(0, 8).map((barrelIndex) => (
            <div key={barrelIndex} className="relative">
              <div className="w-8 h-10 relative transition-transform duration-300 ease-out hover:-translate-y-0.5 hover:scale-105">
                <div className="absolute inset-0 bg-gradient-to-b from-gray-300 to-gray-500 rounded border border-gray-400 shadow-sm">
                  <div className="absolute top-1/2 left-0 right-0 h-px bg-gray-600 transform -translate-y-1/2"></div>
                </div>

                <div 
                  className="absolute bottom-0 left-0 right-0 rounded-b transition-all duration-500 ease-out overflow-hidden"
                  style={{ 
                    height: `${oilLevel}%`,
                    background: `linear-gradient(180deg, 
                      ${oilLevel > 70 ? '#3B82F6' : oilLevel > 30 ? '#EAB308' : '#F59E0B'} 0%, 
                      ${oilLevel > 70 ? '#1E40AF' : oilLevel > 30 ? '#CA8A04' : '#D97706'} 100%)`
                  }}
                >
                  <div className="absolute top-0 left-0 right-0 h-px bg-white/30"></div>
                </div>

                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-[6px] font-bold text-gray-700 z-10">
                  OIL
                </div>
              </div>
            </div>
          ))}
          
          {barrelCount > 8 && (
            <div className="flex items-center justify-center w-8 h-10 text-xs text-muted-foreground">
              +{barrelCount - 8}
            </div>
          )}
        </div>

        <div className="text-center space-y-1">
          <div className="text-lg font-bold transition-all duration-300 ease-out">
            {oilLevel.toFixed(1)}%
          </div>
          <Badge 
            variant={oilLevel > 70 ? "default" : oilLevel > 30 ? "secondary" : "destructive"}
            className="text-xs"
          >
            {oilLevel > 70 ? 'Niveau optimal' : oilLevel > 30 ? 'Niveau moyen' : 'Niveau bas'}
          </Badge>
          <div className="relative h-2.5 w-full bg-white rounded-full overflow-hidden ring-1 ring-slate-200/80">
            <div
            className={`${oilLevel > 70 ? 'bg-emerald-500' : oilLevel > 30 ? 'bg-amber-500' : 'bg-rose-500'} h-full transition-all duration-500 ease-out`}
              style={{ width: `${oilLevel}%` }}
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => navigate('/oil-management')}
            className="flex-1 text-xs h-7 transition-all duration-300 ease-out hover:-translate-y-0.5"
          >
            Voir détails
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default OilBarrelsWidget;
