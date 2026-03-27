import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useApp } from '@/contexts/AppContext';
import { Package2, Plus, TrendingDown, TrendingUp, AlertTriangle, History, ArrowUpRight, ArrowDownRight, Search, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { AddEmptyStockDialog } from '@/components/dialogs/AddEmptyStockDialog';
import { AddDefectiveStockDialog } from '@/components/dialogs/AddDefectiveStockDialog';
import { BottleType, StockHistory } from '@/types';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

const EmptyStock = () => {
  const { emptyBottlesStock = [], bottleTypes = [], defectiveBottles = [], stockHistory = [] } = useApp();
  const [selectedBottleType, setSelectedBottleType] = useState<BottleType | null>(null);
  const [selectedDefectiveBottleType, setSelectedDefectiveBottleType] = useState<BottleType | null>(null);
  const [historyBottle, setHistoryBottle] = useState<{ bottle: BottleType, type: 'empty' | 'defective' } | null>(null);
  const [addStockDialogOpen, setAddStockDialogOpen] = useState(false);
  const [addDefectiveStockDialogOpen, setAddDefectiveStockDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [historySearch, setHistorySearch] = useState('');

  // Filter out Détendeur Clic-On
  const availableBottleTypes = bottleTypes.filter(bt => !bt.name.includes('Détendeur'));

  const filteredHistory = stockHistory.filter(h => 
    h.bottleTypeName.toLowerCase().includes(historySearch.toLowerCase()) ||
    h.note?.toLowerCase().includes(historySearch.toLowerCase()) ||
    h.changeType.toLowerCase().includes(historySearch.toLowerCase())
  );

  const getEmptyStockForBottleType = (bottleTypeId: string) => {
    return emptyBottlesStock.find(stock => stock.bottleTypeId === bottleTypeId)?.quantity || 0;
  };

  const getStockStatus = (quantity: number) => {
    if (quantity === 0) return { status: 'Vide', variant: 'destructive' as const, icon: TrendingDown };
    if (quantity < 50) return { status: 'Faible', variant: 'secondary' as const, icon: TrendingDown };
    return { status: 'Normal', variant: 'default' as const, icon: TrendingUp };
  };

  const getDefectiveStockForBottleType = (bottleTypeId: string) => {
    return defectiveBottles
      .filter(defective => defective.bottleTypeId === bottleTypeId)
      .reduce((sum, defective) => sum + defective.quantity, 0);
  };

  const totalEmptyBottles = emptyBottlesStock.reduce((sum, stock) => sum + stock.quantity, 0);
  const totalDefectiveBottles = defectiveBottles.reduce((sum, defective) => sum + defective.quantity, 0);

  return (
    <div className="p-6 space-y-8 bg-slate-50/50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight">Gestion des Stocks</h1>
          <p className="text-muted-foreground mt-2 flex items-center gap-2">
            <Package2 className="w-4 h-4" />
            Suivi des bouteilles vides et défectueuses
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="bg-white shadow-sm">
            <History className="w-4 h-4 mr-2" />
            Historique complet
          </Button>
        </div>
      </div>

      <Tabs defaultValue="inventory" className="space-y-6">
        <TabsList className="bg-white p-1 shadow-sm border">
          <TabsTrigger value="inventory" className="px-6">Inventaire Actuel</TabsTrigger>
          <TabsTrigger value="history" className="px-6">Historique des Changements</TabsTrigger>
        </TabsList>

        <TabsContent value="inventory" className="space-y-8">
          {/* Inventaire Section */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold">Bouteilles Vides</h2>
                <p className="text-sm text-muted-foreground">État actuel du stock vide par type</p>
              </div>
              <Badge variant="outline" className="px-4 py-1 text-lg font-bold bg-blue-50 text-blue-700 border-blue-200">
                Total: {totalEmptyBottles}
              </Badge>
            </div>
            
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {availableBottleTypes.map((bottle) => {
                const emptyQuantity = getEmptyStockForBottleType(bottle.id);
                const stockInfo = getStockStatus(emptyQuantity);
                
                return (
                  <Card key={bottle.id} className="border-none shadow-sm hover:shadow-md transition-all group">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg font-bold">{bottle.name}</CardTitle>
                        <Badge variant={stockInfo.variant} className="h-6">
                          {stockInfo.status}
                        </Badge>
                      </div>
                      <CardDescription>{bottle.capacity}</CardDescription>
                    </CardHeader>
                    
                    <CardContent className="space-y-4">
                      <div className="flex items-end justify-between">
                        <span className="text-4xl font-black tracking-tighter">{emptyQuantity}</span>
                        <span className="text-sm text-muted-foreground font-medium mb-1">Unités</span>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="secondary" 
                          size="sm" 
                          className="flex-1 bg-slate-100 hover:bg-blue-600 hover:text-white transition-colors group-hover:shadow-sm"
                          onClick={() => {
                            setSelectedBottleType(bottle);
                            setAddStockDialogOpen(true);
                          }}
                        >
                          <Plus className="w-3 h-3 mr-2" />
                          Mettre à jour
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="px-2 hover:bg-purple-50 hover:text-purple-600"
                          onClick={() => {
                            setHistoryBottle({ bottle, type: 'empty' });
                            setHistoryDialogOpen(true);
                          }}
                        >
                          <History className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Stock de Bouteilles Défectueuses Section */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-destructive">Bouteilles Défectueuses</h2>
                <p className="text-sm text-muted-foreground">Bouteilles nécessitant une réparation أو remplacement</p>
              </div>
              <Badge variant="outline" className="px-4 py-1 text-lg font-bold bg-red-50 text-red-700 border-red-200">
                Total: {totalDefectiveBottles}
              </Badge>
            </div>
            
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {availableBottleTypes.map((bottle) => {
                const defectiveQuantity = getDefectiveStockForBottleType(bottle.id);
                const isLow = defectiveQuantity > 0;
                
                return (
                  <Card key={bottle.id} className={`border-none shadow-sm hover:shadow-md transition-all ${isLow ? 'bg-red-50/30' : ''}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg font-bold">{bottle.name}</CardTitle>
                        {isLow && (
                          <div className="p-1.5 bg-red-100 rounded-full text-red-600">
                            <AlertTriangle className="w-4 h-4" />
                          </div>
                        )}
                      </div>
                      <CardDescription>{bottle.capacity}</CardDescription>
                    </CardHeader>
                    
                    <CardContent className="space-y-4">
                      <div className="flex items-end justify-between">
                        <span className="text-4xl font-black tracking-tighter text-red-600">{defectiveQuantity}</span>
                        <span className="text-sm text-muted-foreground font-medium mb-1">Unités</span>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="flex-1 border-red-200 hover:bg-red-600 hover:text-white transition-colors"
                          onClick={() => {
                            setSelectedDefectiveBottleType(bottle);
                            setAddDefectiveStockDialogOpen(true);
                          }}
                        >
                          <Plus className="w-3 h-3 mr-2" />
                          Signaler défaut
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="px-2 hover:bg-purple-50 hover:text-purple-600"
                          onClick={() => {
                            setHistoryBottle({ bottle, type: 'defective' });
                            setHistoryDialogOpen(true);
                          }}
                        >
                          <History className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-xl font-bold flex items-center gap-2">
                    <History className="w-5 h-5 text-purple-600" />
                    Historique des mouvements
                  </CardTitle>
                  <CardDescription>Suivi détaillé de chaque changement dans les stocks</CardDescription>
                </div>
                <div className="relative w-full md:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    placeholder="Rechercher un type, une note..." 
                    className="pl-10"
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="w-[180px]">Date & Heure</TableHead>
                      <TableHead>Type de Stock</TableHead>
                      <TableHead>Produit</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead className="text-center">Quantité</TableHead>
                      <TableHead className="text-right">Ancien → Nouveau</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredHistory.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                          <History className="w-12 h-12 mx-auto mb-3 opacity-10" />
                          Aucun historique disponible
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredHistory.map((entry) => {
                        const isAdd = entry.changeType === 'add' || entry.changeType === 'return';
                        const isDefective = entry.stockType === 'defective';
                        
                        return (
                          <TableRow key={entry.id} className="hover:bg-slate-50 transition-colors">
                            <TableCell className="font-medium">
                              {format(new Date(entry.date), 'dd MMM yyyy')}
                              <span className="block text-xs text-muted-foreground font-normal">
                                {format(new Date(entry.date), 'HH:mm:ss')}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={isDefective ? 'border-red-200 text-red-700 bg-red-50' : 'border-blue-200 text-blue-700 bg-blue-50'}>
                                {isDefective ? 'Défectueux' : 'Vide'}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-bold">{entry.bottleTypeName}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {isAdd ? (
                                  <ArrowUpRight className="w-4 h-4 text-green-500" />
                                ) : (
                                  <ArrowDownRight className="w-4 h-4 text-red-500" />
                                )}
                                <span className="text-sm capitalize">{entry.changeType}</span>
                              </div>
                              {entry.note && (
                                <span className="text-[10px] text-muted-foreground block truncate max-w-[150px]">
                                  {entry.note}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              <span className={`font-bold ${isAdd ? 'text-green-600' : 'text-red-600'}`}>
                                {isAdd ? '+' : '-'}{entry.quantity}
                              </span>
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm text-muted-foreground">
                              {entry.previousQuantity} → <span className="text-foreground font-bold">{entry.newQuantity}</span>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>


      {/* Dialogs */}
      {selectedBottleType && (
        <AddEmptyStockDialog
          bottleType={selectedBottleType}
          open={addStockDialogOpen}
          onOpenChange={setAddStockDialogOpen}
        />
      )}
      
      {selectedDefectiveBottleType && (
        <AddDefectiveStockDialog
          bottleType={selectedDefectiveBottleType}
          open={addDefectiveStockDialogOpen}
          onOpenChange={setAddDefectiveStockDialogOpen}
        />
      )}

      {/* History Dialog */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <History className="w-5 h-5 text-purple-600" />
              Historique: {historyBottle?.bottle.name} ({historyBottle?.type === 'empty' ? 'Vide' : 'Défectueux'})
            </DialogTitle>
            <DialogDescription>
              Liste des derniers changements pour ce type de bouteille
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4">
            <div className="rounded-xl border overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead className="text-center">Quantité</TableHead>
                    <TableHead className="text-right">Ancien → Nouveau</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stockHistory
                    .filter(h => h.bottleTypeId === historyBottle?.bottle.id && h.stockType === historyBottle?.type)
                    .length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        Aucun historique pour ce produit
                      </TableCell>
                    </TableRow>
                  ) : (
                    stockHistory
                      .filter(h => h.bottleTypeId === historyBottle?.bottle.id && h.stockType === historyBottle?.type)
                      .map((entry) => {
                        const isAdd = entry.changeType === 'add' || entry.changeType === 'return';
                        return (
                          <TableRow key={entry.id}>
                            <TableCell className="text-sm">
                              {format(new Date(entry.date), 'dd/MM/yyyy HH:mm')}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="text-sm font-medium capitalize">{entry.changeType}</span>
                                {entry.note && <span className="text-[10px] text-muted-foreground">{entry.note}</span>}
                              </div>
                            </TableCell>
                            <TableCell className="text-center font-bold">
                              <span className={isAdd ? 'text-green-600' : 'text-red-600'}>
                                {isAdd ? '+' : '-'}{entry.quantity}
                              </span>
                            </TableCell>
                            <TableCell className="text-right text-xs font-mono">
                              {entry.previousQuantity} → <span className="font-bold">{entry.newQuantity}</span>
                            </TableCell>
                          </TableRow>
                        );
                      })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmptyStock;
