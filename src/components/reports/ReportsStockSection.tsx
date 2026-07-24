import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Filter, PieChart, AlertTriangle } from 'lucide-react';

type StockRow = {
  name: string;
  total: number;
  distributed: number;
  remaining: number;
  value: number;
  distributionRate: number;
  status: string;
  statusColor: string;
};

type Props = {
  t: (key: string, fallback: string) => string;
  stockSearch: string;
  setStockSearch: React.Dispatch<React.SetStateAction<string>>;
  stockAnalysis: StockRow[];
  stockRemainingValue: number;
  stockTotalUnits: number;
  stockDistributedUnits: number;
  stockAverageDistributionRate: number;
  stockAnomalies: Array<{ message: string }>;
  stockComparison: Record<string, any>;
  renderKpiComparison: (point: any, suffix?: string) => React.ReactNode;
};

export default function ReportsStockSection(props: Props) {
  const {
    t,
    stockSearch,
    setStockSearch,
    stockAnalysis,
    stockRemainingValue,
    stockTotalUnits,
    stockDistributedUnits,
    stockAverageDistributionRate,
    stockAnomalies,
    stockComparison,
    renderKpiComparison,
  } = props;

  const filteredStockRows = React.useMemo(() => {
    const query = stockSearch.trim().toLowerCase();
    if (!query) return stockAnalysis;
    return stockAnalysis.filter((row) => row.name.toLowerCase().includes(query));
  }, [stockAnalysis, stockSearch]);

  return (
    <Card id="reports-stock" className="border-slate-200 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xl font-bold flex items-center gap-2">
          <PieChart className="w-5 h-5 text-purple-600" />
          {t('reports.stock.title', 'Analyse du stock')}
        </CardTitle>
        <div className="flex items-center gap-2">
          <div className="relative w-48">
            <Filter className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('reports.common.search', 'Rechercher...')}
              className="pl-8 h-9"
              value={stockSearch}
              onChange={(event) => setStockSearch(event.target.value)}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-5 gap-4 mb-6">
          <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
            <div className="text-purple-800 text-sm font-semibold mb-1">{t('reports.stock.remainingValue', 'Valeur Stock Restant')}</div>
            <div className="text-2xl font-bold text-purple-900">{stockRemainingValue.toFixed(2)} MAD</div>
            {renderKpiComparison(stockComparison.stockValueRemaining, ' MAD')}
          </div>
          <div className="bg-green-50 p-4 rounded-lg border border-green-100">
            <div className="text-green-800 text-sm font-semibold mb-1">{t('reports.stock.totalUnits', 'Total Unités')}</div>
            <div className="text-2xl font-bold text-green-900">{stockTotalUnits}</div>
            {renderKpiComparison(stockComparison.totalUnits)}
          </div>
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
            <div className="text-blue-800 text-sm font-semibold mb-1">{t('reports.stock.distributedUnits', 'Unités Distribuées')}</div>
            <div className="text-2xl font-bold text-blue-900">{stockDistributedUnits}</div>
            {renderKpiComparison(stockComparison.distributedUnits)}
          </div>
          <div className="bg-orange-50 p-4 rounded-lg border border-orange-100">
            <div className="text-orange-800 text-sm font-semibold mb-1">{t('reports.stock.averageDistributionRate', 'Taux de Distribution Moyen')}</div>
            <div className="text-2xl font-bold text-orange-900">{stockAverageDistributionRate.toFixed(1)}%</div>
            {renderKpiComparison(stockComparison.averageDistributionRate, '%')}
          </div>
          <div className="bg-red-50 p-4 rounded-lg border border-red-100">
            <div className="text-red-800 text-sm font-semibold mb-1 flex items-center gap-1">
              <AlertTriangle className="w-4 h-4" />
              {t('reports.stock.detectedAnomalies', 'Anomalies détectées')}
            </div>
            <div className="text-2xl font-bold text-red-900">{stockAnomalies.length}</div>
            <div className="mt-1 text-xs text-red-700 min-h-8">
              {stockAnomalies.length > 0 ? stockAnomalies[0].message : t('reports.stock.noCriticalAnomaly', 'Aucune anomalie critique')}
            </div>
          </div>
        </div>

        <div className="hidden md:block overflow-x-auto border rounded-lg smart-scroll-x">
          <table className="reports-table-ultra w-full text-sm smart-table">
            <thead>
              <tr className="text-left border-b bg-gray-50 sticky top-0">
                <th className="p-3">{t('reports.stock.table.bottleType', 'Type de Bouteille')}</th>
                <th className="p-3 text-center">{t('reports.stock.table.total', 'Total')}</th>
                <th className="p-3 text-center">{t('reports.stock.table.distributedUnits', 'Unités Distribuées')}</th>
                <th className="p-3 text-center">{t('reports.stock.table.remaining', 'Restant')}</th>
                <th className="p-3 text-right">{t('reports.stock.table.value', 'Valeur')}</th>
                <th className="p-3">{t('reports.stock.table.distributionRate', 'Taux de Distribution')}</th>
                <th className="p-3">{t('reports.stock.table.state', 'État')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredStockRows.map((row, index) => (
                <tr key={row.name} className={`border-b hover:bg-gray-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                  <td className="p-3 font-medium">{row.name}</td>
                  <td className="p-3 text-center">{row.total}</td>
                  <td className="p-3 text-center text-blue-600 font-semibold">{row.distributed}</td>
                  <td className="p-3 text-center text-green-600 font-semibold">{row.remaining}</td>
                  <td className="p-3 text-right font-mono">{row.value.toFixed(2)}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="w-full bg-gray-200 rounded-full h-2 min-w-[100px]">
                        <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${Math.min(100, row.distributionRate)}%` }} />
                      </div>
                      <span className="text-xs font-semibold">{row.distributionRate.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td className="p-3">
                    <Badge className={`${row.statusColor} bg-white border`}>{row.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="md:hidden grid grid-cols-1 gap-2">
          {filteredStockRows.map((row) => (
            <div key={row.name} className="rounded-xl border border-slate-200 bg-white p-3 app-panel-soft">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{row.name}</span>
                <Badge variant="outline" className="text-[10px]">{row.status}</Badge>
              </div>
              <div className="mt-1 grid grid-cols-3 gap-2 text-xs">
                <span>{t('reports.stock.table.total', 'Total')}: {row.total}</span>
                <span className="text-blue-700 font-semibold">{t('reports.stock.table.distributedUnits', 'Unités Distribuées')}: {row.distributed}</span>
                <span className="text-green-700 font-semibold">{t('reports.stock.table.remaining', 'Restant')}: {row.remaining}</span>
              </div>
              <div className="mt-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-2 bg-blue-600" style={{ width: `${Math.min(100, row.distributionRate)}%` }} />
              </div>
              <div className="mt-1 text-xs font-semibold">{row.value.toFixed(2)} MAD</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
