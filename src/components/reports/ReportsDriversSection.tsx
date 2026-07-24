import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Filter, Users } from 'lucide-react';

type DriverRow = {
  id: string;
  name: string;
  debt: number;
  advances: number;
  balance: number;
  status: string;
  statusVariant: 'default' | 'destructive' | 'secondary' | 'outline';
};

type Props = {
  t: (key: string, fallback: string) => string;
  driverSearch: string;
  setDriverSearch: React.Dispatch<React.SetStateAction<string>>;
  driverAnalysis: DriverRow[];
};

export default function ReportsDriversSection(props: Props) {
  const { t, driverSearch, setDriverSearch, driverAnalysis } = props;

  const filteredDriverRows = React.useMemo(() => {
    const query = driverSearch.toLowerCase();
    return driverAnalysis.filter((driver) => driver.name.toLowerCase().includes(query));
  }, [driverAnalysis, driverSearch]);

  const totals = React.useMemo(() => {
    return filteredDriverRows.reduce(
      (acc, row) => {
        acc.debt += row.debt;
        acc.advances += row.advances;
        acc.balance += row.balance;
        return acc;
      },
      { debt: 0, advances: 0, balance: 0 },
    );
  }, [filteredDriverRows]);

  return (
    <Card id="reports-drivers" className="border-slate-200 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xl font-bold flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-600" />
          {t('reports.drivers.title', 'Analyse des chauffeurs')}
        </CardTitle>
        <div className="flex items-center gap-2">
          <div className="relative w-48">
            <Filter className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('reports.common.search', 'Rechercher...')}
              className="pl-8 h-9"
              value={driverSearch}
              onChange={(event) => setDriverSearch(event.target.value)}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <div className="bg-red-50 p-4 rounded-lg border border-red-100">
            <div className="text-red-800 text-sm font-semibold mb-1">{t('reports.drivers.totalDebts', 'Total Dettes')}</div>
            <div className="text-2xl font-bold text-red-900">{totals.debt.toFixed(2)} MAD</div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg border border-green-100">
            <div className="text-green-800 text-sm font-semibold mb-1">{t('reports.drivers.totalAdvances', 'Total Acomptes')}</div>
            <div className="text-2xl font-bold text-green-900">{totals.advances.toFixed(2)} MAD</div>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
            <div className="text-blue-800 text-sm font-semibold mb-1">{t('reports.drivers.globalNetBalance', 'Solde Net Global')}</div>
            <div className="text-2xl font-bold text-blue-900">{totals.balance.toFixed(2)} MAD</div>
          </div>
        </div>

        <div className="hidden md:block overflow-x-auto border rounded-lg smart-scroll-x">
          <table className="reports-table-ultra w-full text-sm smart-table">
            <thead>
              <tr className="text-left border-b bg-gray-50 sticky top-0">
                <th className="p-3">{t('reports.drivers.table.driver', 'Chauffeur')}</th>
                <th className="p-3 text-right">{t('reports.drivers.table.cumulativeDebt', 'Dette (Cumulée)')}</th>
                <th className="p-3 text-right">{t('reports.drivers.table.advances', 'Acomptes')}</th>
                <th className="p-3 text-right">{t('reports.drivers.table.currentBalance', 'Solde Actuel')}</th>
                <th className="p-3 text-center">{t('reports.drivers.table.status', 'Statut')}</th>
                <th className="p-3">{t('reports.drivers.table.progress', 'Progression')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredDriverRows.map((row, index) => (
                <tr key={row.id} className={`border-b hover:bg-gray-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                  <td className="p-3 font-medium">{row.name}</td>
                  <td className="p-3 text-right text-red-600 font-mono">{row.debt.toFixed(2)}</td>
                  <td className="p-3 text-right text-green-600 font-mono">{row.advances.toFixed(2)}</td>
                  <td className={`p-3 text-right font-bold font-mono ${row.balance < 0 ? 'text-red-600' : row.balance > 0 ? 'text-green-600' : ''}`}>{row.balance.toFixed(2)}</td>
                  <td className="p-3 text-center">
                    <Badge variant={row.statusVariant}>{row.status}</Badge>
                  </td>
                  <td className="p-3">
                    <div className="w-full bg-gray-200 rounded-full h-1.5 max-w-[100px]">
                      <div
                        className={`h-1.5 rounded-full ${row.balance < 0 ? 'bg-red-500' : 'bg-green-500'}`}
                        style={{ width: `${Math.min(100, Math.abs(row.balance) / 100)}%` }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="md:hidden grid grid-cols-1 gap-2">
          {filteredDriverRows.map((row) => (
            <div key={row.id} className="rounded-xl border border-slate-200 bg-white p-3 app-panel-soft">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{row.name}</span>
                <Badge variant={row.statusVariant} className="text-[10px]">{row.status}</Badge>
              </div>
              <div className="mt-1 grid grid-cols-3 gap-2 text-xs">
                <span className="text-red-700 font-semibold">{t('reports.drivers.table.cumulativeDebt', 'Dette')}: {row.debt.toFixed(2)}</span>
                <span className="text-green-700 font-semibold">{t('reports.drivers.table.advances', 'Acomptes')}: {row.advances.toFixed(2)}</span>
                <span className={`${row.balance < 0 ? 'text-red-700' : 'text-green-700'} font-semibold`}>{t('reports.drivers.table.currentBalance', 'Solde')}: {row.balance.toFixed(2)}</span>
              </div>
              <div className="mt-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                <div className={`h-2 ${row.balance < 0 ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${Math.min(100, Math.abs(row.balance) / 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
