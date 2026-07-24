import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Banknote,
  Calendar,
  ChevronDown,
  FileText,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react';

type OpRow = any;
type RevenueAnomaly = any;

const startOfWeekMonday = (date: Date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return d;
};

type Props = {
  t: (key: string, fallback: string) => string;
  tr: (fr: string, ar: string) => string;
  uiLocale: string;
  opRows: OpRow[];
  financialTransactions: any[];
  soldeEspece: number;
  soldeBanque: number;
  soldeCheque: number;
  commandWindow: '7j' | '30j' | '90j' | 'all';
  setCommandWindow: React.Dispatch<React.SetStateAction<'7j' | '30j' | '90j' | 'all'>>;
  whatIfDailyIn: string;
  setWhatIfDailyIn: React.Dispatch<React.SetStateAction<string>>;
  whatIfDailyOut: string;
  setWhatIfDailyOut: React.Dispatch<React.SetStateAction<string>>;
  whatIfHorizon: '15' | '30' | '60';
  setWhatIfHorizon: React.Dispatch<React.SetStateAction<'15' | '30' | '60'>>;
  anomalyMode: 'all' | 'positive' | 'negative';
  setAnomalyMode: React.Dispatch<React.SetStateAction<'all' | 'positive' | 'negative'>>;
  formatCurrency: (n: number) => string;
  formatDateLocalized: (iso: string) => string;
  formatOpType: (type: string) => string;
  formatAccountName: (acc: string, tr?: (fr: string, ar: string) => string) => string;
  applyCommandFocus: (mode: 'pending' | 'inflow' | 'outflow' | 'reset') => void;
  applyForecastFocus: (account: 'espece' | 'banque' | 'cheque', risk: 'high' | 'medium' | 'low') => void;
  applyHeatmapFocus: (start: Date, end: Date, trend: 'up' | 'down') => void;
  applyAnomalyFocus: (anomaly: RevenueAnomaly) => void;
  applyAutopilot: (mode: 'protect' | 'accelerate' | 'balance') => void;
};

export default function RevenueCommandCenterSection(props: Props) {
  const {
    t,
    tr,
    uiLocale,
    opRows,
    financialTransactions,
    soldeEspece,
    soldeBanque,
    soldeCheque,
    commandWindow,
    setCommandWindow,
    whatIfDailyIn,
    setWhatIfDailyIn,
    whatIfDailyOut,
    setWhatIfDailyOut,
    whatIfHorizon,
    setWhatIfHorizon,
    anomalyMode,
    setAnomalyMode,
    formatCurrency,
    formatDateLocalized,
    formatOpType,
    formatAccountName,
    applyCommandFocus,
    applyForecastFocus,
    applyHeatmapFocus,
    applyAnomalyFocus,
    applyAutopilot,
  } = props;

  const getRowPriority = React.useCallback((row: OpRow): 'high' | 'medium' | 'low' => {
    if (row.status === 'pending') return 'high';
    if (row.amount >= 12000) return 'high';
    if (row.amount >= 4000) return 'medium';
    return 'low';
  }, []);

  const commandWindowOps = React.useMemo(() => {
    if (commandWindow === 'all') return opRows;
    const now = Date.now();
    const days = commandWindow === '7j' ? 7 : commandWindow === '30j' ? 30 : 90;
    const maxMs = days * 24 * 60 * 60 * 1000;
    return opRows.filter((row) => now - new Date(row.date).getTime() <= maxMs);
  }, [opRows, commandWindow]);

  const commandWindowSummary = React.useMemo(() => {
    const amounts: number[] = [];
    const laneCounts = { high: 0, medium: 0, low: 0 };
    let totalIn = 0;
    let totalOut = 0;
    let pendingOps = 0;

    commandWindowOps.forEach((row) => {
      amounts.push(Math.abs(row.amount));
      if (row.status === 'pending') pendingOps += 1;
      const level = getRowPriority(row);
      laneCounts[level] += 1;

      if (row.kind === 'operation') {
        if (row.typeLabel === 'versement') totalIn += row.amount;
        if (row.typeLabel === 'retrait') totalOut += row.amount;
        return;
      }

      if (row.destinationAccount === 'banque') totalIn += row.amount;
      if (row.sourceAccount === 'banque') totalOut += row.amount;
    });

    const mean = amounts.length > 0 ? amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length : 0;
    const variance = amounts.length > 0
      ? amounts.reduce((sum, amount) => sum + (amount - mean) ** 2, 0) / amounts.length
      : 0;
    const std = Math.sqrt(variance) || 1;

    return {
      totalIn,
      totalOut,
      pendingOps,
      laneCounts,
      mean,
      std,
      count: amounts.length,
    };
  }, [commandWindowOps, getRowPriority]);

  const revenueIntelligence = React.useMemo(() => {
    const netFlow = commandWindowSummary.totalIn - commandWindowSummary.totalOut;
    const accountPressure = [
      { account: tr('Espèce', 'نقد'), balance: soldeEspece },
      { account: tr('Banque', 'بنك'), balance: soldeBanque },
      { account: tr('Chèque', 'شيك'), balance: soldeCheque },
    ].sort((a, b) => a.balance - b.balance);
    return {
      totalIn: commandWindowSummary.totalIn,
      totalOut: commandWindowSummary.totalOut,
      pendingOps: commandWindowSummary.pendingOps,
      netFlow,
      accountPressure,
      laneCounts: commandWindowSummary.laneCounts,
    };
  }, [commandWindowSummary, soldeEspece, soldeBanque, soldeCheque, tr]);

  const missionBoard = React.useMemo(() => {
    const lanes = {
      high: [] as OpRow[],
      medium: [] as OpRow[],
      low: [] as OpRow[],
    };
    commandWindowOps.forEach((row) => {
      lanes[getRowPriority(row)].push(row);
    });
    const sortByDate = (a: OpRow, b: OpRow) => new Date(b.date).getTime() - new Date(a.date).getTime();
    return {
      high: lanes.high.sort(sortByDate).slice(0, 4),
      medium: lanes.medium.sort(sortByDate).slice(0, 4),
      low: lanes.low.sort(sortByDate).slice(0, 4),
    };
  }, [commandWindowOps, getRowPriority]);

  const accountForecast = React.useMemo(() => {
    const divisor = commandWindow === '7j' ? 7 : commandWindow === '30j' ? 30 : commandWindow === '90j' ? 90 : 45;
    const accounts = [
      { key: 'espece' as const, label: tr('Espèce', 'نقد'), balance: soldeEspece },
      { key: 'banque' as const, label: tr('Banque', 'بنك'), balance: soldeBanque },
      { key: 'cheque' as const, label: tr('Chèque', 'شيك'), balance: soldeCheque },
    ];
    return accounts
      .map((account) => {
        const outflow = commandWindowOps.reduce((sum, row) => {
          if (row.kind === 'transfert') {
            if (row.sourceAccount === account.key) return sum + row.amount;
            return sum;
          }
          if (row.typeLabel === 'retrait' && row.accountAffected === account.key) return sum + row.amount;
          return sum;
        }, 0);
        const dailyDrain = outflow > 0 ? outflow / divisor : 0;
        const daysLeft = dailyDrain > 0 ? account.balance / dailyDrain : Infinity;
        const risk = daysLeft <= 10 ? 'high' : daysLeft <= 25 ? 'medium' : 'low';
        return { ...account, outflow, dailyDrain, daysLeft, risk };
      })
      .sort((a, b) => {
        if (!Number.isFinite(a.daysLeft) && !Number.isFinite(b.daysLeft)) return a.balance - b.balance;
        if (!Number.isFinite(a.daysLeft)) return 1;
        if (!Number.isFinite(b.daysLeft)) return -1;
        return a.daysLeft - b.daysLeft;
      });
  }, [commandWindowOps, commandWindow, soldeEspece, soldeBanque, soldeCheque, tr]);

  const weeklyFlowHeatmap = React.useMemo(() => {
    const now = new Date();
    const currentWeekStart = startOfWeekMonday(now);
    const slices = Array.from({ length: 8 }, (_, index) => {
      const diff = 7 - index;
      const start = new Date(currentWeekStart);
      start.setDate(start.getDate() - diff * 7);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      return {
        key: start.toISOString(),
        start,
        end,
        label: start.toLocaleDateString(uiLocale, { day: '2-digit', month: 'short' }),
        inbound: 0,
        outbound: 0,
        net: 0,
      };
    });
    financialTransactions.forEach((tx) => {
      const d = new Date(tx.date);
      const slice = slices.find((item) => d >= item.start && d < item.end);
      if (!slice) return;
      const amount = Math.abs(Number(tx.amount) || 0);
      if (tx.type === 'encaissement' || tx.type === 'versement') {
        slice.inbound += amount;
      } else if (tx.type === 'retrait' || tx.type === 'dépense' || tx.type === 'réparation') {
        slice.outbound += amount;
      }
      slice.net = slice.inbound - slice.outbound;
    });
    const maxAbs = Math.max(1, ...slices.map((slice) => Math.abs(slice.net)));
    return slices.map((slice) => ({
      ...slice,
      intensity: Math.min(1, Math.abs(slice.net) / maxAbs),
      trend: slice.net >= 0 ? 'up' : 'down',
    }));
  }, [financialTransactions, uiLocale]);

  const whatIfScenario = React.useMemo(() => {
    const baseDays = commandWindow === '7j' ? 7 : commandWindow === '30j' ? 30 : commandWindow === '90j' ? 90 : 30;
    const dailyBaseNet = (commandWindowSummary.totalIn - commandWindowSummary.totalOut) / baseDays;
    const dailyIn = parseFloat(whatIfDailyIn) || 0;
    const dailyOut = parseFloat(whatIfDailyOut) || 0;
    const horizon = parseInt(whatIfHorizon, 10) || 30;
    const dailyProjectedNet = dailyBaseNet + dailyIn - dailyOut;
    const currentLiquidity = soldeEspece + soldeBanque + soldeCheque;
    const projectedLiquidity = currentLiquidity + dailyProjectedNet * horizon;
    const runwayDays = dailyProjectedNet < 0 ? currentLiquidity / Math.abs(dailyProjectedNet) : Infinity;
    const risk = projectedLiquidity <= 0 || runwayDays <= 10 ? 'high' : runwayDays <= 25 ? 'medium' : 'low';
    return {
      currentLiquidity,
      projectedLiquidity,
      runwayDays,
      horizon,
      risk,
    };
  }, [commandWindow, commandWindowSummary, whatIfDailyIn, whatIfDailyOut, whatIfHorizon, soldeEspece, soldeBanque, soldeCheque]);

  const anomalyRows = React.useMemo(() => {
    if (commandWindowSummary.count < 3) return [] as RevenueAnomaly[];
    return commandWindowOps
      .map((row) => {
        const isPositive = row.kind === 'operation' ? row.typeLabel === 'versement' : row.destinationAccount === 'banque';
        const score = (Math.abs(row.amount) - commandWindowSummary.mean) / commandWindowSummary.std;
        const label = row.kind === 'transfert'
          ? `${formatAccountName(row.sourceAccount, tr)} → ${formatAccountName(row.destinationAccount, tr)}`
          : `${formatOpType(row.typeLabel)} · ${formatAccountName(row.accountAffected, tr)}`;
        return {
          id: `${row.kind}-${row.id}`,
          date: row.date,
          amount: row.amount,
          score,
          direction: isPositive ? 'positive' : 'negative',
          label,
        };
      })
      .filter((row) => Math.abs(row.score) >= 1.15)
      .sort((a, b) => Math.abs(b.score) - Math.abs(a.score))
      .slice(0, 6);
  }, [commandWindowOps, commandWindowSummary, formatAccountName, formatOpType, tr]);

  const visibleAnomalies = React.useMemo(() => {
    if (anomalyMode === 'all') return anomalyRows;
    return anomalyRows.filter((row) => row.direction === anomalyMode);
  }, [anomalyRows, anomalyMode]);

  return (
    <>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="border-none shadow-sm bg-white overflow-hidden xl:col-span-2">
          <CardContent className="p-5 space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-slate-900 rounded-xl">
                  <Banknote className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">{tr('Tableau de Pilotage des Flux', 'لوحة قيادة الإيرادات')}</h3>
                  <p className="text-xs text-slate-500">{tr('Vue tactique des flux et priorités de validation', 'رؤية تكتيكية للتدفقات وأولويات الاعتماد')}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant={commandWindow === '7j' ? 'default' : 'outline'} size="sm" className={commandWindow === '7j' ? 'bg-blue-600 hover:bg-blue-700' : ''} onClick={() => setCommandWindow('7j')}>7 jours</Button>
                <Button variant={commandWindow === '30j' ? 'default' : 'outline'} size="sm" className={commandWindow === '30j' ? 'bg-blue-600 hover:bg-blue-700' : ''} onClick={() => setCommandWindow('30j')}>30 jours</Button>
                <Button variant={commandWindow === '90j' ? 'default' : 'outline'} size="sm" className={commandWindow === '90j' ? 'bg-blue-600 hover:bg-blue-700' : ''} onClick={() => setCommandWindow('90j')}>90 jours</Button>
                <Button variant={commandWindow === 'all' ? 'default' : 'outline'} size="sm" className={commandWindow === 'all' ? 'bg-blue-600 hover:bg-blue-700' : ''} onClick={() => setCommandWindow('all')}>{t('revenue.window.all', 'Tout')}</Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 space-y-2">
                <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide">{tr('Entrées', 'الداخل')}</p>
                <p className="text-xl font-black text-emerald-700">{formatCurrency(revenueIntelligence.totalIn)}</p>
              </div>
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 space-y-2">
                <p className="text-xs font-bold text-rose-700 uppercase tracking-wide">{tr('Sorties', 'الخارج')}</p>
                <p className="text-xl font-black text-rose-700">{formatCurrency(revenueIntelligence.totalOut)}</p>
              </div>
              <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 space-y-2">
                <p className="text-xs font-bold text-indigo-700 uppercase tracking-wide">{tr('Balance de mission', 'رصيد المهمة')}</p>
                <p className="text-xl font-black text-indigo-700">{formatCurrency(revenueIntelligence.netFlow)}</p>
                <p className="text-[11px] text-indigo-600">{tr('En attente', 'في الانتظار')}: {revenueIntelligence.pendingOps}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { key: 'high', title: tr('Critique', 'حرج'), items: missionBoard.high, count: revenueIntelligence.laneCounts.high, cls: 'border-rose-200', badge: 'bg-rose-100 text-rose-700' },
                { key: 'medium', title: tr('Surveillance', 'مراقبة'), items: missionBoard.medium, count: revenueIntelligence.laneCounts.medium, cls: 'border-amber-200', badge: 'bg-amber-100 text-amber-700' },
                { key: 'low', title: tr('Stable', 'مستقر'), items: missionBoard.low, count: revenueIntelligence.laneCounts.low, cls: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-700' },
              ].map((lane) => (
                <div key={lane.key} className={`rounded-2xl border ${lane.cls} bg-slate-50 p-3 space-y-2`}>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-black text-slate-700 uppercase tracking-wide">{lane.title}</p>
                    <Badge className={`${lane.badge} border-none`}>{lane.count}</Badge>
                  </div>
                  {lane.items.length === 0 ? (
                    <p className="text-xs text-slate-500">{tr('Aucun flux sur cette lane.', 'لا توجد تدفقات في هذا المسار.')}</p>
                  ) : (
                    lane.items.map((row) => (
                      <button
                        key={`${row.kind}-${row.id}`}
                        type="button"
                        onClick={() => applyCommandFocus(row.status === 'pending' ? 'pending' : row.kind === 'transfert' ? 'outflow' : row.typeLabel === 'versement' ? 'inflow' : 'outflow')}
                        className="w-full text-left rounded-xl border border-slate-200 bg-white px-3 py-2 hover:bg-slate-50 transition-colors"
                      >
                        <p className="text-xs font-bold text-slate-800">{row.kind === 'transfert' ? t('revenue.table.transfert', 'Transfert') : formatOpType(row.typeLabel)}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">{formatDateLocalized(row.date)} · {formatCurrency(row.amount)}</p>
                      </button>
                    ))
                  )}
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => applyCommandFocus('pending')} className="bg-rose-600 hover:bg-rose-700 text-white">
                <ChevronDown className="h-4 w-4 mr-2" />
                {tr('Priorité validations', 'تركيز على الاعتمادات')}
              </Button>
              <Button variant="outline" onClick={() => applyCommandFocus('inflow')}>
                <TrendingUp className="h-4 w-4 mr-2 text-emerald-600" />
                {tr('Priorité entrées', 'تركيز على الداخل')}
              </Button>
              <Button variant="outline" onClick={() => applyCommandFocus('outflow')}>
                <TrendingDown className="h-4 w-4 mr-2 text-rose-600" />
                {tr('Priorité sorties', 'تركيز على الخارج')}
              </Button>
              <Button variant="ghost" onClick={() => applyCommandFocus('reset')} className="text-slate-600">
                <X className="h-4 w-4 mr-2" />
                {t('revenue.intelligence.reset', 'Réinitialiser')}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white overflow-hidden">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-50 rounded-xl">
                <FileText className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">{tr('Prévision de Trésorerie', 'توقع السيولة')}</h3>
                <p className="text-xs text-slate-500">{tr('Signal par compte sur la fenêtre active', 'إشارة حسب الحساب ضمن النافذة النشطة')}</p>
              </div>
            </div>
            <div className="space-y-2">
              {accountForecast.map((row) => (
                <button
                  key={row.key}
                  type="button"
                  onClick={() => applyForecastFocus(row.key, row.risk)}
                  className="w-full text-left rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 hover:bg-white transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-800">{row.label}</p>
                    <Badge className={row.risk === 'high' ? 'bg-rose-100 text-rose-700 border-none' : row.risk === 'medium' ? 'bg-amber-100 text-amber-700 border-none' : 'bg-emerald-100 text-emerald-700 border-none'}>
                      {row.risk === 'high' ? tr('Alerte Rouge', 'إنذار أحمر') : row.risk === 'medium' ? tr('Alerte Orange', 'إنذار برتقالي') : tr('Stable', 'مستقر')}
                    </Badge>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                    <span>{formatCurrency(row.balance)}</span>
                    <span>{Number.isFinite(row.daysLeft) ? `${Math.max(0, Math.floor(row.daysLeft))} ${tr('jours', 'يوم')}` : tr('Sans pression', 'دون ضغط')}</span>
                  </div>
                </button>
              ))}
            </div>
            {revenueIntelligence.accountPressure[0] && (
              <div className="rounded-xl bg-slate-900 text-white p-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-300">{tr('Compte le plus exposé', 'الحساب الأكثر تعرضًا')}</p>
                <p className="font-black text-sm mt-1">{revenueIntelligence.accountPressure[0].account}</p>
                <p className="text-xs text-slate-300 mt-0.5">{formatCurrency(revenueIntelligence.accountPressure[0].balance)}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="border-none shadow-sm bg-white overflow-hidden xl:col-span-2">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-50 rounded-xl">
                <Calendar className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">{tr('Carte Hebdomadaire des Flux', 'خريطة حرارة التدفق الأسبوعي')}</h3>
                <p className="text-xs text-slate-500">{tr('Lecture visuelle des semaines positives et sous tension', 'قراءة بصرية للأسابيع الإيجابية وتحت الضغط')}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2">
              {weeklyFlowHeatmap.map((week) => (
                <button
                  key={week.key}
                  type="button"
                  onClick={() => applyHeatmapFocus(week.start, week.end, week.trend)}
                  className={`rounded-xl border px-3 py-2 text-left transition-colors ${week.trend === 'up' ? 'border-emerald-200 hover:border-emerald-300' : 'border-rose-200 hover:border-rose-300'}`}
                  style={{ backgroundColor: week.trend === 'up' ? `rgba(16, 185, 129, ${0.12 + week.intensity * 0.33})` : `rgba(244, 63, 94, ${0.12 + week.intensity * 0.33})` }}
                >
                  <p className="text-[11px] font-bold text-slate-700">{week.label}</p>
                  <p className={`text-xs font-black mt-1 ${week.trend === 'up' ? 'text-emerald-700' : 'text-rose-700'}`}>{formatCurrency(week.net)}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white overflow-hidden">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-violet-50 rounded-xl">
                <Wallet className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">{tr('Laboratoire de Scénarios de Liquidité', 'مختبر سيناريوهات السيولة')}</h3>
                <p className="text-xs text-slate-500">{tr('Simulation proactive de la trésorerie', 'محاكاة استباقية للسيولة')}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[11px] uppercase tracking-wide text-slate-500">{tr('+ Entrée / jour', '+ الداخل / يوم')}</Label>
                <Input value={whatIfDailyIn} onChange={(e) => setWhatIfDailyIn(e.target.value)} className="h-9 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] uppercase tracking-wide text-slate-500">{tr('- Sortie / jour', '- الخارج / يوم')}</Label>
                <Input value={whatIfDailyOut} onChange={(e) => setWhatIfDailyOut(e.target.value)} className="h-9 text-sm" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] uppercase tracking-wide text-slate-500">{t('revenue.whatif.horizon', 'Horizon')}</Label>
              <div className="flex items-center gap-2">
                <Button variant={whatIfHorizon === '15' ? 'default' : 'outline'} size="sm" className={whatIfHorizon === '15' ? 'bg-violet-600 hover:bg-violet-700' : ''} onClick={() => setWhatIfHorizon('15')}>15j</Button>
                <Button variant={whatIfHorizon === '30' ? 'default' : 'outline'} size="sm" className={whatIfHorizon === '30' ? 'bg-violet-600 hover:bg-violet-700' : ''} onClick={() => setWhatIfHorizon('30')}>30j</Button>
                <Button variant={whatIfHorizon === '60' ? 'default' : 'outline'} size="sm" className={whatIfHorizon === '60' ? 'bg-violet-600 hover:bg-violet-700' : ''} onClick={() => setWhatIfHorizon('60')}>60j</Button>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500">{t('revenue.whatif.currentLiquidity', 'Liquidité actuelle')}</p>
                <p className="text-xs font-black text-slate-800">{formatCurrency(whatIfScenario.currentLiquidity)}</p>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500">{tr('Projection', 'التوقع')} ({whatIfScenario.horizon}j)</p>
                <p className={`text-xs font-black ${whatIfScenario.projectedLiquidity >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{formatCurrency(whatIfScenario.projectedLiquidity)}</p>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500">{t('revenue.whatif.runway', 'Autonomie estimée')}</p>
                <p className="text-xs font-black text-slate-800">{Number.isFinite(whatIfScenario.runwayDays) ? `${Math.max(0, Math.floor(whatIfScenario.runwayDays))} ${t('revenue.whatif.days', 'jours')}` : tr('Trajectoire positive', 'مسار إيجابي')}</p>
              </div>
              <Badge className={whatIfScenario.risk === 'high' ? 'bg-rose-100 text-rose-700 border-none' : whatIfScenario.risk === 'medium' ? 'bg-amber-100 text-amber-700 border-none' : 'bg-emerald-100 text-emerald-700 border-none'}>
                {whatIfScenario.risk === 'high' ? t('revenue.whatif.risk.high', 'Risque élevé') : whatIfScenario.risk === 'medium' ? t('revenue.whatif.risk.medium', 'Risque moyen') : tr('Risque maîtrisé', 'خطر متحكم به')}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="border-none shadow-sm bg-white overflow-hidden xl:col-span-2">
          <CardContent className="p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-slate-900">{tr('Radar des Anomalies', 'رادار الشذوذ')}</h3>
                <p className="text-xs text-slate-500">{tr('Détection des flux atypiques pour audit rapide', 'اكتشاف التدفقات غير الاعتيادية للتدقيق السريع')}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant={anomalyMode === 'all' ? 'default' : 'outline'} size="sm" className={anomalyMode === 'all' ? 'bg-slate-700 hover:bg-slate-800' : ''} onClick={() => setAnomalyMode('all')}>{t('revenue.anomalies.all', 'Toutes')}</Button>
                <Button variant={anomalyMode === 'positive' ? 'default' : 'outline'} size="sm" className={anomalyMode === 'positive' ? 'bg-emerald-600 hover:bg-emerald-700' : ''} onClick={() => setAnomalyMode('positive')}>{t('revenue.anomalies.positive', 'Positives')}</Button>
                <Button variant={anomalyMode === 'negative' ? 'default' : 'outline'} size="sm" className={anomalyMode === 'negative' ? 'bg-rose-600 hover:bg-rose-700' : ''} onClick={() => setAnomalyMode('negative')}>{t('revenue.anomalies.negative', 'Négatives')}</Button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {visibleAnomalies.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">{tr('Aucun signal atypique sur la fenêtre actuelle.', 'لا توجد إشارات غير اعتيادية في النافذة الحالية.')}</div>
              ) : (
                visibleAnomalies.map((anomaly) => (
                  <button
                    key={anomaly.id}
                    type="button"
                    onClick={() => applyAnomalyFocus(anomaly)}
                    className={`rounded-xl border px-3 py-2 text-left transition-colors ${anomaly.direction === 'positive' ? 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100/60' : 'border-rose-200 bg-rose-50 hover:bg-rose-100/60'}`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-black text-slate-800">{anomaly.label}</p>
                      <Badge className={anomaly.direction === 'positive' ? 'bg-emerald-100 text-emerald-700 border-none' : 'bg-rose-100 text-rose-700 border-none'}>x{Math.abs(anomaly.score).toFixed(1)}</Badge>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-1">{formatDateLocalized(anomaly.date)} · {formatCurrency(anomaly.amount)}</p>
                  </button>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white overflow-hidden">
          <CardContent className="p-5 space-y-3">
            <div>
              <h3 className="text-base font-black text-slate-900">{tr('Scénarios de Pilotage Automatique', 'سيناريوهات الطيار الآلي')}</h3>
              <p className="text-xs text-slate-500">{tr('Scénarios prêts à appliquer en un clic', 'سيناريوهات جاهزة للتطبيق بنقرة واحدة')}</p>
            </div>
            <Button onClick={() => applyAutopilot('protect')} className="w-full justify-start bg-rose-600 hover:bg-rose-700">
              <TrendingDown className="h-4 w-4 mr-2" />
              {tr('Protection Liquidité', 'حماية السيولة')}
            </Button>
            <Button variant="outline" onClick={() => applyAutopilot('accelerate')} className="w-full justify-start">
              <TrendingUp className="h-4 w-4 mr-2 text-emerald-600" />
              {tr('Accélération Encaissements', 'تسريع التحصيلات')}
            </Button>
            <Button variant="ghost" onClick={() => applyAutopilot('balance')} className="w-full justify-start text-slate-600">
              <X className="h-4 w-4 mr-2" />
              {tr('Réinitialisation intelligente', 'إعادة ضبط ذكية')}
            </Button>
            <div className="rounded-xl bg-slate-900 text-white p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-300">{tr('Pilotage conseillé', 'توجيه موصى به')}</p>
              <p className="text-sm font-black mt-1">
                {whatIfScenario.risk === 'high' ? tr('Active Protection Liquidité', 'فعّل حماية السيولة') : whatIfScenario.risk === 'medium' ? tr('Surveille les sorties critiques', 'راقب المخرجات الحرجة') : tr('Maintiens la cadence actuelle', 'حافظ على الوتيرة الحالية')}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
