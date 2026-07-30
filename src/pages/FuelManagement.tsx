import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useApp } from '@/contexts/AppContext';
import { Fuel, Droplet, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';

const safeDate = (value: any) => {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? new Date() : d;
};

export default function FuelManagement() {
  const { fuelPurchases, fuelConsumptions, fuelDrains } = useApp() as any;

  const summary = useMemo(() => {
    const purchases = Array.isArray(fuelPurchases) ? fuelPurchases : [];
    const consumptions = Array.isArray(fuelConsumptions) ? fuelConsumptions : [];
    const drains = Array.isArray(fuelDrains) ? fuelDrains : [];

    const purchasedLiters = purchases.reduce((sum: number, p: any) => sum + Number(p?.quantityLiters || 0), 0);
    const drainedLiters = drains.reduce((sum: number, p: any) => sum + Number(p?.quantityLiters || 0), 0);
    const consumedLiters = consumptions.reduce((sum: number, c: any) => sum + Number(c?.liters || 0), 0);
    const purchaseCost = purchases.reduce((sum: number, p: any) => sum + Number(p?.price || 0), 0);

    return {
      purchasedLiters,
      drainedLiters,
      consumedLiters,
      purchaseCost,
      purchases,
      consumptions,
      drains,
    };
  }, [fuelPurchases, fuelConsumptions, fuelDrains]);

  const lastPurchases = summary.purchases
    .slice()
    .sort((a: any, b: any) => safeDate(b?.date).getTime() - safeDate(a?.date).getTime())
    .slice(0, 10);

  const lastConsumptions = summary.consumptions
    .slice()
    .sort((a: any, b: any) => safeDate(b?.date).getTime() - safeDate(a?.date).getTime())
    .slice(0, 10);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
            <Fuel className="w-8 h-8 text-indigo-600" />
            Gestion Carburant
          </h1>
          <p className="text-sm text-slate-500 mt-1">Aperçu des achats, consommations et vidanges.</p>
        </div>
        <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700">
          Données: {summary.purchases.length + summary.consumptions.length + summary.drains.length}
        </Badge>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Card className="rounded-2xl border-slate-200/80 bg-white/95">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-700 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" /> Achats (L)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-slate-900">{summary.purchasedLiters.toFixed(0)}</div>
            <div className="text-xs text-slate-500 mt-1">Total litres achetés</div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200/80 bg-white/95">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-700 flex items-center gap-2">
              <Droplet className="w-4 h-4 text-amber-600" /> Consommation (L)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-slate-900">{summary.consumedLiters.toFixed(0)}</div>
            <div className="text-xs text-slate-500 mt-1">Total litres consommés</div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200/80 bg-white/95">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-700 flex items-center gap-2">
              <Droplet className="w-4 h-4 text-rose-600" /> Vidanges (L)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-slate-900">{summary.drainedLiters.toFixed(0)}</div>
            <div className="text-xs text-slate-500 mt-1">Total litres vidangés</div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200/80 bg-white/95">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-700 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-600" /> Coût achats
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-slate-900">{summary.purchaseCost.toFixed(2)} DH</div>
            <div className="text-xs text-slate-500 mt-1">Somme des prix enregistrés</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-2xl border-slate-200/80 bg-white/95 overflow-hidden">
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="text-base font-bold text-slate-800">Derniers achats</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80">
                  <TableHead className="font-bold">Date</TableHead>
                  <TableHead className="font-bold">Litres</TableHead>
                  <TableHead className="text-right font-bold">Prix</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lastPurchases.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="py-10 text-center text-slate-400">
                      Aucun achat enregistré
                    </TableCell>
                  </TableRow>
                ) : (
                  lastPurchases.map((p: any) => (
                    <TableRow key={String(p.id)} className="hover:bg-slate-50/50">
                      <TableCell className="font-medium text-slate-700">
                        {format(safeDate(p.date), 'dd/MM/yyyy')}
                      </TableCell>
                      <TableCell className="font-semibold text-slate-900">{Number(p.quantityLiters || 0).toFixed(0)}</TableCell>
                      <TableCell className="text-right font-bold text-slate-900">{Number(p.price || 0).toFixed(2)} DH</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200/80 bg-white/95 overflow-hidden">
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="text-base font-bold text-slate-800">Dernières consommations</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80">
                  <TableHead className="font-bold">Date</TableHead>
                  <TableHead className="font-bold">Chauffeur</TableHead>
                  <TableHead className="font-bold">Camion</TableHead>
                  <TableHead className="text-right font-bold">Litres</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lastConsumptions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-10 text-center text-slate-400">
                      Aucune consommation enregistrée
                    </TableCell>
                  </TableRow>
                ) : (
                  lastConsumptions.map((c: any) => (
                    <TableRow key={String(c.id)} className="hover:bg-slate-50/50">
                      <TableCell className="font-medium text-slate-700">
                        {format(safeDate(c.date), 'dd/MM/yyyy')}
                      </TableCell>
                      <TableCell className="text-slate-800">{c.driver || '—'}</TableCell>
                      <TableCell className="text-slate-800">{c.truck || '—'}</TableCell>
                      <TableCell className="text-right font-bold text-slate-900">{Number(c.liters || 0).toFixed(0)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

