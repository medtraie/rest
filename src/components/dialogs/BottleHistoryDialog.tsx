import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useApp } from '@/contexts/AppContext';
import { BottleType } from '@/types';
import { Package, TrendingUp, TrendingDown, RefreshCw, Factory } from 'lucide-react';

interface BottleHistoryDialogProps {
  bottle: BottleType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const BottleHistoryDialog = ({ bottle, open, onOpenChange }: BottleHistoryDialogProps) => {
  const { transactions, returnOrders, foreignBottles, supplyOrders, emptyBottlesStock = [], defectiveBottles = [] } = useApp();

  const bottleMovements = React.useMemo(() => {
    const entries: Array<{ id: string; date: string | number; type: string; label: string; quantity: number; }> = [];

    const safeTransactions = Array.isArray(transactions) ? transactions : [];
    safeTransactions.forEach((tx: any) => {
      const bt = Array.isArray(tx?.bottleTypes)
        ? tx.bottleTypes.find((x: any) => x?.bottleTypeId === bottle.id)
        : undefined;
      if (!bt) return;
      entries.push({
        id: `tx-${tx.id || `${tx.type}-${tx.date}`}`,
        date: tx.date || Date.now(),
        type: tx.type,
        label: tx.type === 'supply' ? 'Alimentation camion' : tx.type === 'factory' ? 'Envoi usine' : tx.type,
        quantity: Number(bt.quantity || 0),
      });
    });

    const safeReturns = Array.isArray(returnOrders) ? returnOrders : [];
    safeReturns.forEach((ro: any) => {
      (ro.items || []).forEach((item: any) => {
        if (item?.bottleTypeId !== bottle.id) return;
        const addIf = (qty: number, label: string, suffix: string) => {
          if (Number(qty) > 0) {
            entries.push({
              id: `ro-${ro.id}-${item.bottleTypeId}-${suffix}`,
              date: ro.date || Date.now(),
              type: 'return',
              label,
              quantity: Number(qty),
            });
          }
        };
        addIf(item.returnedFullQuantity || 0, 'Retour Pleins', 'full');
        addIf(item.returnedEmptyQuantity || 0, 'Retour Vides', 'empty');
        addIf(item.defectiveQuantity || 0, 'Défectueuses', 'defective');
        addIf(item.foreignQuantity || 0, 'Étrangères', 'foreign');
        addIf(item.consigneQuantity || 0, 'Consigne', 'consigne');
        addIf(item.lostQuantity || 0, 'Perdu', 'lost');
      });
    });

    const safeForeigns = Array.isArray(foreignBottles) ? foreignBottles : [];
    safeForeigns
      .filter((fb: any) => (!fb.returnOrderId || fb.returnOrderId === 'direct') && String(fb?.bottleType) === String(bottle.name))
      .forEach((fb: any) => {
        entries.push({
          id: `fb-${fb.id}`,
          date: fb.date || Date.now(),
          type: 'return',
          label: `Ajout étranger (direct)`,
          quantity: Number(fb.quantity || 0),
        });
      });

    return entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, returnOrders, foreignBottles, bottle.id, bottle.name]);

  const getPendingCirculation = React.useCallback((bottleTypeId: string) => {
    if (!supplyOrders || !Array.isArray(supplyOrders)) return 0;
    const pendingOrders = supplyOrders.filter((o: any) => {
      if (!o || !o.id) return false;
      const hasReturn = (returnOrders || []).some((ro: any) => String(ro?.supplyOrderId) === String(o.id));
      return !hasReturn;
    });
    return pendingOrders.reduce((sum: number, o: any) => {
      let items: any[] = [];
      try {
        if (Array.isArray(o?.items)) {
          items = o.items;
        } else if (typeof o?.items === 'string') {
          const trimmed = o.items.trim();
          if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
            const parsed = JSON.parse(trimmed);
            items = Array.isArray(parsed) ? parsed : [parsed];
          }
        } else if (typeof o?.items === 'object' && o?.items !== null) {
          items = [o.items];
        }
      } catch {
        items = [];
      }
      const qty = items
        .filter((it: any) => {
          const itId = String(it?.bottleTypeId ?? it?.bottle_type_id ?? it?.id ?? '');
          return itId === String(bottleTypeId);
        })
        .reduce((s: number, it: any) => {
          const val = Number(it?.fullQuantity ?? it?.full_quantity ?? it?.quantity ?? it?.qty ?? 0);
          return s + val;
        }, 0);
      return sum + qty;
    }, 0);
  }, [supplyOrders, returnOrders]);

  const totalStored = Number(bottle.totalQuantity ?? (bottle as any).totalquantity ?? 0);
  const distributedDb = Number(bottle.distributedQuantity ?? (bottle as any).distributedquantity ?? 0);
  const circulation = getPendingCirculation(String(bottle.id));
  const distributedEffective = Math.max(distributedDb, circulation);
  const stockPlein = Math.max(totalStored - distributedEffective, 0);
  const emptyQty = React.useMemo(() => {
    return Number(emptyBottlesStock.find(s => String(s.bottleTypeId) === String(bottle.id))?.quantity || 0);
  }, [emptyBottlesStock, bottle.id]);
  const defectiveQty = React.useMemo(() => {
    return defectiveBottles
      .filter(d => String(d.bottleTypeId) === String(bottle.id))
      .reduce((sum, d) => sum + Number(d.quantity || 0), 0);
  }, [defectiveBottles, bottle.id]);
  const distributedCumulative = React.useMemo(() => {
    const safeOrders = Array.isArray(supplyOrders) ? supplyOrders : [];
    return safeOrders.reduce((sum: number, o: any) => {
      let items: any[] = [];
      try {
        if (Array.isArray(o?.items)) {
          items = o.items;
        } else if (typeof o?.items === 'string') {
          const trimmed = o.items.trim();
          if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
            const parsed = JSON.parse(trimmed);
            items = Array.isArray(parsed) ? parsed : [parsed];
          }
        } else if (typeof o?.items === 'object' && o?.items !== null) {
          items = [o.items];
        }
      } catch {
        items = [];
      }
      const qty = items
        .filter((it: any) => {
          const itId = String(it?.bottleTypeId ?? it?.bottle_type_id ?? it?.id ?? '');
          const itName = String(it?.bottleTypeName ?? it?.name ?? it?.bottle_type_name ?? '');
          return itId === String(bottle.id) || itName === String(bottle.name);
        })
        .reduce((s: number, it: any) => {
          const val = Number(it?.fullQuantity ?? it?.full_quantity ?? it?.quantity ?? it?.qty ?? 0);
          return s + val;
        }, 0);
      return sum + qty;
    }, 0);
  }, [supplyOrders, bottle.id, bottle.name]);

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'supply': return <TrendingDown className="w-4 h-4 text-destructive" />;
      case 'return': return <TrendingUp className="w-4 h-4 text-success" />;
      case 'exchange': return <RefreshCw className="w-4 h-4 text-warning" />;
      case 'factory': return <Factory className="w-4 h-4 text-primary" />;
      default: return <Package className="w-4 h-4" />;
    }
  };

  const getTransactionLabel = (type: string) => {
    switch (type) {
      case 'supply': return 'Alimentation camion';
      case 'return': return 'Retour camion';
      case 'exchange': return 'Échange';
      case 'factory': return 'Envoi usine';
      default: return type;
    }
  };

  const getStatusLabel = (status?: string) => {
    if (!status) return null;
    const labels: Record<string, string> = {
      sold: 'Vendu',
      empty: 'Vide',
      unsold: 'Non vendu',
      foreign: 'Étranger',
      defective: 'Défectueux',
      lost: 'Perdu'
    };
    return labels[status] || status;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Historique - {bottle.name}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Summary */}
          <div className="p-4 bg-muted/50 rounded-lg space-y-3">
            <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{totalStored}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </div>
            <div className="text-center">
                <div className="text-2xl font-bold text-success">{distributedEffective}</div>
              <div className="text-xs text-muted-foreground">Distribué</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{stockPlein}</div>
              <div className="text-xs text-muted-foreground">Restant</div>
            </div>
          </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <div className="text-2xl font-bold text-indigo-600">{circulation}</div>
                <div className="text-xs text-muted-foreground">Circulation</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-slate-900">{distributedDb}</div>
                <div className="text-xs text-muted-foreground">Distribué (DB)</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{distributedCumulative}</div>
                <div className="text-xs text-muted-foreground">Distribué (Historique)</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{emptyQty}</div>
                <div className="text-xs text-muted-foreground">Vides</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-rose-600">{defectiveQty}</div>
                <div className="text-xs text-muted-foreground">Défectueuses</div>
              </div>
            </div>

            </div>

          {/* Transaction List */}
          <div>
            <h4 className="font-medium mb-3">Transactions récentes</h4>
            <ScrollArea className="h-[400px] pr-4">
              {bottleMovements.length > 0 ? (
                <div className="space-y-3">
                  {bottleMovements.map((mv) => (
                    <div key={mv.id} className="border rounded-lg p-3 hover:bg-muted/50 transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getTransactionIcon(mv.type)}
                          <span className="font-medium">{mv.label}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium">{mv.quantity} unités</div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(mv.date || Date.now()).toLocaleDateString('fr-FR', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground mt-2">
                        Valeur: {(mv.quantity * bottle.unitPrice).toLocaleString()} DH
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Aucune transaction enregistrée</p>
                  <p className="text-sm">L'historique des mouvements apparaîtra ici</p>
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
