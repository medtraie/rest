import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Filter, Info } from 'lucide-react';
import { motion } from 'framer-motion';

type Props = {
  t: (key: string, fallback: string) => string;
  showTransactions: boolean;
  setShowTransactions: React.Dispatch<React.SetStateAction<boolean>>;
  setExpandedTransactionId: React.Dispatch<React.SetStateAction<string | null>>;
  showReference: boolean;
  setShowReference: React.Dispatch<React.SetStateAction<boolean>>;
  transactionsSort: 'date_desc' | 'date_asc' | 'value_desc' | 'value_asc';
  setTransactionsSort: (value: 'date_desc' | 'date_asc' | 'value_desc' | 'value_asc') => void;
  transactionsLimit: '25' | '50' | '100' | 'all';
  setTransactionsLimit: (value: '25' | '50' | '100' | 'all') => void;
  transactionTypeFilter: 'all' | 'supply' | 'return' | 'exchange' | 'factory';
  setTransactionTypeFilter: (value: 'all' | 'supply' | 'return' | 'exchange' | 'factory') => void;
  showNonZeroOnly: boolean;
  setShowNonZeroOnly: React.Dispatch<React.SetStateAction<boolean>>;
  transactionSearch: string;
  setTransactionSearch: React.Dispatch<React.SetStateAction<string>>;
  filteredTransactionsLength: number;
  totalValue: number;
  transactionsByType: { supply: number; return: number; exchange: number; factory: number };
  visibleTransactionsTotal: number;
  visibleTransactionsWithValue: number;
  visibleTransactionsLength: number;
  tableFilteredTransactionsLength: number;
  visibleTransactionRows: Array<any>;
  expandedTransactionId: string | null;
};

export default function ReportsTransactionsSection(props: Props) {
  const {
    t,
    showTransactions,
    setShowTransactions,
    setExpandedTransactionId,
    showReference,
    setShowReference,
    transactionsSort,
    setTransactionsSort,
    transactionsLimit,
    setTransactionsLimit,
    transactionTypeFilter,
    setTransactionTypeFilter,
    showNonZeroOnly,
    setShowNonZeroOnly,
    transactionSearch,
    setTransactionSearch,
    filteredTransactionsLength,
    totalValue,
    transactionsByType,
    visibleTransactionsTotal,
    visibleTransactionsWithValue,
    visibleTransactionsLength,
    tableFilteredTransactionsLength,
    visibleTransactionRows,
    expandedTransactionId,
  } = props;

  const MButton = motion(Button);

  return (
    <Card id="reports-transactions" className="border-slate-200 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xl font-bold flex items-center gap-2">
          <FileText className="w-5 h-5 text-indigo-600" />
          {t('reports.transactions.title', 'Historique des transactions')}
        </CardTitle>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <MButton
            variant="outline"
            size="sm"
            whileTap={{ scale: 0.96 }}
            onClick={() => {
              setShowTransactions((value) => !value);
              setExpandedTransactionId(null);
            }}
          >
            {showTransactions ? t('reports.common.hide', 'Cacher') : t('reports.common.show', 'Afficher')}
          </MButton>
          <MButton variant="outline" size="sm" whileTap={{ scale: 0.96 }} onClick={() => setShowReference((value) => !value)}>
            {showReference ? t('reports.transactions.hideReference', 'Cacher Référence') : t('reports.transactions.showReference', 'Afficher Référence')}
          </MButton>
          <Select value={transactionsSort} onValueChange={(value) => setTransactionsSort(value as Props['transactionsSort'])}>
            <SelectTrigger className="h-9 w-[170px]">
              <SelectValue placeholder={t('reports.transactions.sort', 'Tri')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date_desc">{t('reports.transactions.sortDateDesc', 'Date ↓')}</SelectItem>
              <SelectItem value="date_asc">{t('reports.transactions.sortDateAsc', 'Date ↑')}</SelectItem>
              <SelectItem value="value_desc">{t('reports.transactions.sortValueDesc', 'Valeur ↓')}</SelectItem>
              <SelectItem value="value_asc">{t('reports.transactions.sortValueAsc', 'Valeur ↑')}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={transactionsLimit} onValueChange={(value) => setTransactionsLimit(value as Props['transactionsLimit'])}>
            <SelectTrigger className="h-9 w-[140px]">
              <SelectValue placeholder={t('reports.transactions.limit', 'Limiter')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="25">25 {t('reports.transactions.lines', 'lignes')}</SelectItem>
              <SelectItem value="50">50 {t('reports.transactions.lines', 'lignes')}</SelectItem>
              <SelectItem value="100">100 {t('reports.transactions.lines', 'lignes')}</SelectItem>
              <SelectItem value="all">{t('reports.filters.all', 'Tous')}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={transactionTypeFilter} onValueChange={(value) => setTransactionTypeFilter(value as Props['transactionTypeFilter'])}>
            <SelectTrigger className="h-9 w-[170px]">
              <SelectValue placeholder={t('reports.filters.type', 'Type')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('reports.transactions.allTypes', 'Tous types')}</SelectItem>
              <SelectItem value="supply">{t('reports.types.supply', 'Alimentation')}</SelectItem>
              <SelectItem value="return">{t('reports.types.return', 'Retour')}</SelectItem>
              <SelectItem value="exchange">{t('reports.types.exchange', 'Échange')}</SelectItem>
              <SelectItem value="factory">{t('reports.types.factory', 'Usine')}</SelectItem>
            </SelectContent>
          </Select>
          <MButton variant={showNonZeroOnly ? 'default' : 'outline'} size="sm" whileTap={{ scale: 0.96 }} onClick={() => setShowNonZeroOnly((value) => !value)}>
            {showNonZeroOnly ? t('reports.transactions.amountGtZero', 'Montants > 0') : t('reports.transactions.allAmounts', 'Tous montants')}
          </MButton>
          <div className="relative w-64">
            <Filter className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('reports.transactions.searchPlaceholder', 'Chercher (Chauffeur, Client, Camion...)')}
              className="pl-8 h-9"
              value={transactionSearch}
              onChange={(event) => setTransactionSearch(event.target.value)}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{filteredTransactionsLength} {t('reports.transactions.operations', 'opérations')}</Badge>
            <Badge variant="secondary">{totalValue.toFixed(2)} MAD</Badge>
            <Badge variant="outline">
              {t('reports.transactions.supplyShort', 'Alim')}: {transactionsByType.supply} | {t('reports.transactions.returnShort', 'Ret')}: {transactionsByType.return} | {t('reports.transactions.exchangeShort', 'Éch')}: {transactionsByType.exchange} | {t('reports.types.factory', 'Usine')}: {transactionsByType.factory}
            </Badge>
            <Badge variant="outline">{t('reports.transactions.displayed', 'Affiché')}: {visibleTransactionsTotal.toFixed(2)} MAD</Badge>
            <Badge variant="outline">{t('reports.transactions.withAmount', 'Avec montant')}: {visibleTransactionsWithValue}</Badge>
            <span className="text-xs text-muted-foreground">
              {t('reports.transactions.displayed', 'Affiché')}: {visibleTransactionsLength}/{tableFilteredTransactionsLength}
            </span>
          </div>
        </div>

        {!showTransactions ? (
          <div className="text-sm text-muted-foreground py-6 text-center border rounded-lg bg-gray-50">
            {t('reports.transactions.historyHidden', 'Historique masqué.')}
          </div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto border rounded-lg smart-scroll-x">
              <table className="reports-table-ultra w-full text-sm smart-table">
                <thead>
                  <tr className="text-left border-b bg-gray-50 sticky top-0">
                    <th className="px-3 py-2.5 text-center w-14">#</th>
                    <th className="px-3 py-2.5">{t('reports.table.date', 'Date')}</th>
                    <th className="px-3 py-2.5">{t('reports.table.type', 'Type')}</th>
                    <th className="px-3 py-2.5">{t('reports.table.driver', 'Chauffeur')}</th>
                    <th className="px-3 py-2.5">{t('reports.table.client', 'Client')}</th>
                    {showReference && <th className="px-3 py-2.5">{t('reports.table.reference', 'Référence')}</th>}
                    <th className="px-3 py-2.5">{t('reports.table.truck', 'Camion')}</th>
                    <th className="px-3 py-2.5 text-right">{t('reports.table.valueMad', 'Valeur (MAD)')}</th>
                    <th className="px-3 py-2.5 text-center">{t('reports.table.details', 'Détails')}</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleTransactionRows.map((row) => {
                    const isExpanded = expandedTransactionId === row.id;
                    return (
                      <React.Fragment key={row.id}>
                        <tr className={`border-b hover:bg-gray-50 transition-colors ${row.index % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                          <td className="px-3 py-2.5 text-center text-xs text-muted-foreground">{row.index + 1}</td>
                          <td className="px-3 py-2.5">{row.dateLabel}</td>
                          <td className="px-3 py-2.5">
                            <Badge variant="outline" className={row.typeMeta.className}>{row.typeMeta.label}</Badge>
                          </td>
                          <td className="px-3 py-2.5 font-medium">{row.driverName}</td>
                          <td className="px-3 py-2.5">{row.clientName}</td>
                          {showReference && (
                            <td className="px-3 py-2.5 font-mono text-xs max-w-[220px] truncate" title={row.ref}>
                              {row.ref}
                            </td>
                          )}
                          <td className="px-3 py-2.5">{row.truckName}</td>
                          <td className={`px-3 py-2.5 text-right font-bold ${row.valueNumber > 0 ? 'text-slate-900' : 'text-slate-400'}`}>{row.valueNumber.toFixed(2)}</td>
                          <td className="px-3 py-2.5 text-center">
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setExpandedTransactionId((value) => (value === row.id ? null : row.id))}>
                              <Info className="h-4 w-4 text-blue-600" />
                            </Button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="border-b bg-white">
                            <td className="px-3 py-2.5" colSpan={showReference ? 9 : 8}>
                              <div className="grid md:grid-cols-3 gap-3">
                                <div className="text-sm">
                                  <div className="text-xs text-muted-foreground">{t('reports.transactions.identifier', 'Identifiant')}</div>
                                  <div className="font-mono text-xs">{String(row.id || '-')}</div>
                                </div>
                                <div className="text-sm">
                                  <div className="text-xs text-muted-foreground">{t('reports.table.total', 'Total')}</div>
                                  <div className="font-bold">{row.valueNumber.toFixed(2)} MAD</div>
                                </div>
                                <div className="text-sm">
                                  <div className="text-xs text-muted-foreground">{t('reports.table.bottles', 'Bouteilles')}</div>
                                  <div className="flex flex-wrap gap-2 mt-1">
                                    {row.bottleBreakdown.length === 0 ? (
                                      <span className="text-xs text-muted-foreground">—</span>
                                    ) : (
                                      row.bottleBreakdown.map((b: any) => (
                                        <Badge key={b.key} variant="secondary" className="text-xs">
                                          {b.quantity} {b.name}{b.status ? ` (${b.status})` : ''}
                                        </Badge>
                                      ))
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                  {visibleTransactionRows.length === 0 && (
                    <tr>
                      <td className="p-4 text-center text-sm text-muted-foreground" colSpan={showReference ? 9 : 8}>
                        {t('reports.transactions.noTransactionForFilters', 'Aucune transaction pour ces filtres.')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="md:hidden grid grid-cols-1 gap-2">
              {visibleTransactionRows.map((row) => (
                <div key={row.id} className="rounded-xl border border-slate-200 bg-white p-3 app-panel-soft">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className={row.typeMeta.className + ' text-[10px]'}>{row.typeMeta.label}</Badge>
                    <span className="text-xs text-muted-foreground">{row.dateLabel}</span>
                  </div>
                  <div className="mt-1 text-sm font-semibold">{row.driverName}</div>
                  <div className="text-xs text-muted-foreground">{row.truckName}</div>
                  <div className={`mt-1 text-sm font-bold ${row.valueNumber > 0 ? 'text-slate-900' : 'text-slate-400'}`}>{row.valueNumber.toFixed(2)} MAD</div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
