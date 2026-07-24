import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowRightLeft, Download } from 'lucide-react';
import type { FinancialTransaction } from '@/types';

type Props = {
  t: (key: string, fallback: string) => string;
  tr: (fr: string, ar: string) => string;
  supplierBankAccounts: string[];
  filterStartDate: string;
  setFilterStartDate: React.Dispatch<React.SetStateAction<string>>;
  filterEndDate: string;
  setFilterEndDate: React.Dispatch<React.SetStateAction<string>>;
  filterType: string;
  setFilterType: React.Dispatch<React.SetStateAction<string>>;
  filterAccount: string;
  setFilterAccount: React.Dispatch<React.SetStateAction<string>>;
  filterAmountMin: string;
  setFilterAmountMin: React.Dispatch<React.SetStateAction<string>>;
  filterAmountMax: string;
  setFilterAmountMax: React.Dispatch<React.SetStateAction<string>>;
  filteredHistory: FinancialTransaction[];
  formatDateLocalized: (iso: string) => string;
  formatOpType: (type: string) => string;
  formatCurrency: (n: number) => string;
  formatAccountName: (acc: string, tr?: (fr: string, ar: string) => string) => string;
  formatStatus: (status: string) => string;
  exportHistoryToPDF: () => void;
};

export default function RevenueHistoryTab(props: Props) {
  const {
    t,
    tr,
    supplierBankAccounts,
    filterStartDate,
    setFilterStartDate,
    filterEndDate,
    setFilterEndDate,
    filterType,
    setFilterType,
    filterAccount,
    setFilterAccount,
    filterAmountMin,
    setFilterAmountMin,
    filterAmountMax,
    setFilterAmountMax,
    filteredHistory,
    formatDateLocalized,
    formatOpType,
    formatCurrency,
    formatAccountName,
    formatStatus,
    exportHistoryToPDF,
  } = props;

  return (
    <Card className="border-none shadow-sm overflow-hidden">
      <CardHeader className="bg-white border-b py-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold text-slate-800">{t('revenue.history.title', 'Historique Financier')}</CardTitle>
            <p className="text-sm text-slate-500">{t('revenue.history.subtitle', 'Consulter toutes les transactions')}</p>
          </div>
          <Button variant="outline" size="sm" className="text-blue-600 border-blue-200 hover:bg-blue-50" onClick={exportHistoryToPDF}>
            <Download className="mr-2 h-4 w-4" />
            {t('revenue.history.export', 'Exporter PDF')}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="p-4 bg-slate-50/50 border-b grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('revenue.filters.period', 'Période')}</Label>
            <div className="flex items-center gap-2">
              <Input type="date" className="h-9 text-sm" value={filterStartDate} onChange={(e) => setFilterStartDate(e.target.value)} />
              <span className="text-slate-400 text-xs">{t('revenue.filters.to', 'à')}</span>
              <Input type="date" className="h-9 text-sm" value={filterEndDate} onChange={(e) => setFilterEndDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('revenue.history.type', 'Type')}</Label>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder={t('revenue.history.allTransactions', 'Toutes les transactions')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('revenue.history.allTransactions', 'Toutes les transactions')}</SelectItem>
                <SelectItem value="versement">{t('revenue.history.versements', 'Versements')}</SelectItem>
                <SelectItem value="transfert">{t('revenue.history.transfers', 'Transferts')}</SelectItem>
                <SelectItem value="retrait">{t('revenue.history.withdrawals', 'Retraits')}</SelectItem>
                <SelectItem value="dépense">{t('revenue.history.expenses', 'Dépenses')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('revenue.history.affectedAccount', 'Compte affecté')}</Label>
            <Select value={filterAccount} onValueChange={setFilterAccount}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder={t('revenue.filters.allAccounts', 'Tous les comptes')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('revenue.filters.allAccounts', 'Tous les comptes')}</SelectItem>
                <SelectItem value="espece">{tr('Espèce', 'نقد')}</SelectItem>
                <SelectItem value="cheque">{tr('Chèque', 'شيك')}</SelectItem>
                <SelectItem value="banque">{tr('Banque', 'بنك')}</SelectItem>
                {supplierBankAccounts.map((account) => (
                  <SelectItem key={`hist-${account}`} value={`supplier_bank:${account}`}>
                    {tr('Banque fournisseur', 'بنك المورّد')}: {account}
                  </SelectItem>
                ))}
                <SelectItem value="autre">{tr('Autre', 'أخرى')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 lg:col-span-2">
            <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('revenue.table.amount', 'Montant')}</Label>
            <div className="flex items-center gap-2">
              <Input className="h-9 text-sm" placeholder={t('revenue.filters.min', 'Min')} value={filterAmountMin} onChange={(e) => setFilterAmountMin(e.target.value)} />
              <Input className="h-9 text-sm" placeholder={t('revenue.filters.max', 'Max')} value={filterAmountMax} onChange={(e) => setFilterAmountMax(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="font-semibold text-slate-700">{t('revenue.table.date', 'Date')}</TableHead>
                <TableHead className="font-semibold text-slate-700">{t('revenue.history.type', 'Type')}</TableHead>
                <TableHead className="font-semibold text-slate-700">{t('revenue.history.description', 'Description')}</TableHead>
                <TableHead className="font-semibold text-slate-700">{t('revenue.table.amount', 'Montant')}</TableHead>
                <TableHead className="font-semibold text-slate-700">{t('revenue.history.accounts', 'Comptes')}</TableHead>
                <TableHead className="font-semibold text-slate-700 text-right">{t('revenue.table.status', 'Statut')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredHistory.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-slate-500">
                    {t('revenue.history.none', 'Aucune transaction trouvée')}
                  </TableCell>
                </TableRow>
              ) : (
                filteredHistory.map((row) => (
                  <TableRow key={row.id} className="hover:bg-slate-50/50 transition-colors">
                    <TableCell className="text-slate-700 font-medium">{formatDateLocalized(row.date)}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`capitalize ${row.type === 'réparation' || row.type === 'dépense' ? 'border-rose-200 text-rose-700 bg-rose-50' : 'border-emerald-200 text-emerald-700 bg-emerald-50'}`}
                      >
                        {formatOpType(row.type)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-600 text-sm max-w-[250px] truncate">{row.description || '-'}</TableCell>
                    <TableCell className={`font-bold ${row.amount >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatCurrency(row.amount)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                        <span>{row.sourceAccount === 'autre' && row.accountDetails ? `${tr('Autre', 'أخرى')} (${row.accountDetails})` : formatAccountName(row.sourceAccount || '', tr)}</span>
                        {row.destinationAccount && (
                          <>
                            <ArrowRightLeft className="h-3 w-3" />
                            <span>{row.destinationAccount === 'autre' && row.accountDetails ? `${tr('Autre', 'أخرى')} (${row.accountDetails})` : formatAccountName(row.destinationAccount || '', tr)}</span>
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge className="bg-blue-100 text-blue-700 border-none">{formatStatus(row.status)}</Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
