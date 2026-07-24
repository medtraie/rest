import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, ThumbsUp, Truck } from 'lucide-react';

type Props = {
  t: (key: string, fallback: string) => string;
  tr: (fr: string, ar: string) => string;
  drivers: Array<any>;
  dailyStartDate: string;
  setDailyStartDate: React.Dispatch<React.SetStateAction<string>>;
  dailyEndDate: string;
  setDailyEndDate: React.Dispatch<React.SetStateAction<string>>;
  dailyReportDriver: string;
  setDailyReportDriver: React.Dispatch<React.SetStateAction<string>>;
  applyDailyPeriodPreset: (preset: 'today' | 'last7' | 'month') => void;
  periodLabel: string;
  dailyReportsDisplayMode: 'cards' | 'list';
  setDailyReportsDisplayMode: React.Dispatch<React.SetStateAction<'cards' | 'list'>>;
  generateAllDailyReports: () => Promise<void>;
  isBulkGeneratingReports: boolean;
  completedReportIds: string[];
  dailyReportActions: Array<{ id: string; label: string; variant?: 'default' | 'outline' | 'secondary'; action: () => void | Promise<void> }>;
  activeReportId: string | null;
  runReportAction: (id: string, action: () => void | Promise<void>) => Promise<void>;
  glowingReportIds: string[];
  getDailyActionTone: (index: number, isCurrent: boolean, isDone: boolean) => { chip: string; card: string; button: string; status: string };
  cardMotion: (index: number) => any;
};

export default function ReportsDailySection(props: Props) {
  const {
    t,
    tr,
    drivers,
    dailyStartDate,
    setDailyStartDate,
    dailyEndDate,
    setDailyEndDate,
    dailyReportDriver,
    setDailyReportDriver,
    applyDailyPeriodPreset,
    periodLabel,
    dailyReportsDisplayMode,
    setDailyReportsDisplayMode,
    generateAllDailyReports,
    isBulkGeneratingReports,
    completedReportIds,
    dailyReportActions,
    activeReportId,
    runReportAction,
    glowingReportIds,
    getDailyActionTone,
    cardMotion,
  } = props;

  const MButton = motion(Button);

  return (
    <Card id="reports-daily" className="border-slate-200 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Truck className="w-5 h-5" />
          {t('reports.daily.title', 'Rapport Journalier des Chauffeurs')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-4 gap-4 mb-4">
          <div>
            <Label>{t('reports.filters.start', 'Début')} <span className="text-xs text-muted-foreground">{tr('(jj/mm/aaaa)', '(يوم/شهر/سنة)')}</span></Label>
            <Input type="date" value={dailyStartDate} onChange={(event) => setDailyStartDate(event.target.value)} />
          </div>
          <div>
            <Label>{t('reports.filters.end', 'Fin')} <span className="text-xs text-muted-foreground">{tr('(jj/mm/aaaa)', '(يوم/شهر/سنة)')}</span></Label>
            <Input type="date" value={dailyEndDate} onChange={(event) => setDailyEndDate(event.target.value)} />
          </div>
          <div>
            <Label>{t('reports.filters.driver', 'Chauffeur')}</Label>
            <Select value={dailyReportDriver} onValueChange={setDailyReportDriver}>
              <SelectTrigger>
                <SelectValue placeholder={t('reports.filters.all', 'Tous')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('reports.filters.all', 'Tous')}</SelectItem>
                {drivers.map((driver) => (
                  <SelectItem key={driver.id} value={driver.id}>{driver.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t('reports.daily.quickPeriod', 'Période rapide')}</Label>
            <div className="grid grid-cols-3 gap-2">
              <MButton type="button" variant="outline" className="h-10" whileTap={{ scale: 0.98 }} onClick={() => applyDailyPeriodPreset('today')}>{t('reports.daily.today', "Aujourd'hui")}</MButton>
              <MButton type="button" variant="outline" className="h-10" whileTap={{ scale: 0.98 }} onClick={() => applyDailyPeriodPreset('last7')}>{t('reports.daily.last7Days', '7 jours')}</MButton>
              <MButton type="button" variant="outline" className="h-10" whileTap={{ scale: 0.98 }} onClick={() => applyDailyPeriodPreset('month')}>{t('reports.daily.month', 'Mois')}</MButton>
            </div>
          </div>
        </div>

        <div className="mb-4 rounded-lg border bg-slate-50 p-3 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm">
            <span className="font-semibold">{t('reports.daily.period', 'Période')}:</span> {periodLabel || t('reports.daily.notDefined', 'Non définie')} · <span className="font-semibold">{t('reports.filters.driver', 'Chauffeur')}:</span> {dailyReportDriver === 'all' ? t('reports.filters.all', 'Tous') : (drivers.find((driver) => driver.id === dailyReportDriver)?.name || t('reports.daily.unknown', 'Inconnu'))}
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-1">
              <Button type="button" size="sm" variant={dailyReportsDisplayMode === 'list' ? 'default' : 'ghost'} className="h-7 px-2 text-xs" onClick={() => setDailyReportsDisplayMode('list')}>
                {t('reports.daily.list', 'Liste')}
              </Button>
              <Button type="button" size="sm" variant={dailyReportsDisplayMode === 'cards' ? 'default' : 'ghost'} className="h-7 px-2 text-xs" onClick={() => setDailyReportsDisplayMode('cards')}>
                {t('reports.daily.cards', 'Cards')}
              </Button>
            </div>
            <Button onClick={generateAllDailyReports} disabled={isBulkGeneratingReports} className="h-9 px-3 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white">
              <Download className="w-4 h-4 mr-2" />
              {isBulkGeneratingReports ? t('reports.daily.generating', 'Génération en cours...') : t('reports.daily.downloadAllReports', 'Télécharger Tous les Rapports')}
            </Button>
          </div>
        </div>

        {isBulkGeneratingReports && (
          <div className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50/60 p-2.5">
            <div className="mb-1.5 flex items-center justify-between text-[11px]">
              <span className="font-semibold text-indigo-700">
                {t('reports.daily.progress', 'Progression')} {completedReportIds.length}/{dailyReportActions.length}
              </span>
              <span className="text-indigo-600">
                {activeReportId ? dailyReportActions.find((item) => item.id === activeReportId)?.label || '' : ''}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-indigo-100">
              <motion.div
                className="h-full rounded-full bg-indigo-600"
                animate={{ width: `${Math.max(6, (completedReportIds.length / Math.max(1, dailyReportActions.length)) * 100)}%` }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
              />
            </div>
          </div>
        )}

        <div className="mb-4 pb-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {dailyReportActions.map((report, index) => {
              const isRunning = activeReportId === report.id || isBulkGeneratingReports;
              const isDone = completedReportIds.includes(report.id);
              const isCurrent = activeReportId === report.id;
              const isGlow = glowingReportIds.includes(report.id);
              const tone = getDailyActionTone(index, isCurrent, isDone);
              return (
                <React.Fragment key={`timeline-${report.id}`}>
                  <MButton
                    variant={isCurrent ? 'default' : isDone ? 'secondary' : 'outline'}
                    size="sm"
                    className={`h-7 rounded-full px-2.5 text-[11px] max-w-[220px] truncate ${tone.chip}`}
                    onClick={() => void runReportAction(report.id, report.action)}
                    disabled={isRunning}
                    whileHover={{ y: -1, scale: 1.02 }}
                    whileTap={{ scale: 0.96 }}
                    animate={isGlow ? { boxShadow: ['0 0 0 rgba(16,185,129,0)', '0 0 0 6px rgba(16,185,129,0.22)', '0 0 0 rgba(16,185,129,0)'] } : undefined}
                    transition={isGlow ? { duration: 0.9, ease: 'easeOut' } : undefined}
                  >
                    <span className="mr-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-black/10 px-1 text-[10px]">
                      {index + 1}
                    </span>
                    <span className="truncate">{report.label}</span>
                  </MButton>
                  {index < dailyReportActions.length - 1 && <div className="hidden md:block h-px w-4 bg-slate-300" />}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {dailyReportsDisplayMode === 'cards' ? (
          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-2">
            {dailyReportActions.map((report, index) => {
              const isRunning = activeReportId === report.id || isBulkGeneratingReports;
              const isCurrent = activeReportId === report.id;
              const isDone = completedReportIds.includes(report.id);
              const isGlow = glowingReportIds.includes(report.id);
              const showSuccessCue = isGlow && isDone && !isCurrent;
              const tone = getDailyActionTone(index, isCurrent, isDone);
              return (
                <motion.div key={report.id} {...cardMotion(index)} whileHover={{ y: -2, scale: 1.01 }} animate={isGlow ? { boxShadow: ['0 0 0 rgba(16,185,129,0)', '0 0 0 7px rgba(16,185,129,0.18)', '0 0 0 rgba(16,185,129,0)'] } : undefined} transition={isGlow ? { duration: 0.95, ease: 'easeOut' } : undefined} className={`rounded-lg border bg-white p-2.5 shadow-sm ${tone.card}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-900 truncate">{report.label}</p>
                      <p className={`text-[11px] mt-1 ${isCurrent || isDone ? tone.status : 'text-slate-500'}`}>
                        {isCurrent ? t('reports.daily.generating', 'Génération en cours...') : isDone ? t('reports.daily.done', 'Terminé') : t('reports.daily.ready', 'Prêt')}
                      </p>
                    </div>
                    <MButton
                      onClick={() => void runReportAction(report.id, report.action)}
                      variant={report.variant || 'outline'}
                      size="sm"
                      className={`h-7 px-2 shrink-0 text-[11px] ${tone.button}`}
                      disabled={isRunning}
                      whileHover={{ y: -1, scale: 1.04 }}
                      whileTap={{ scale: 0.96 }}
                    >
                      <motion.span className="mr-1 inline-flex" animate={showSuccessCue ? { scale: [1, 1.18, 1], rotate: [0, -8, 0] } : { scale: 1, rotate: 0 }} transition={{ duration: 0.45, ease: 'easeOut' }}>
                        {showSuccessCue ? <ThumbsUp className="w-3 h-3" /> : <Download className="w-3 h-3" />}
                      </motion.span>
                      {showSuccessCue ? t('reports.daily.doneShort', 'OK') : t('reports.daily.downloadOneShort', 'PDF')}
                    </MButton>
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-2">
            {dailyReportActions.map((report, index) => {
              const isRunning = activeReportId === report.id || isBulkGeneratingReports;
              const isCurrent = activeReportId === report.id;
              const isDone = completedReportIds.includes(report.id);
              const isGlow = glowingReportIds.includes(report.id);
              const showSuccessCue = isGlow && isDone && !isCurrent;
              const tone = getDailyActionTone(index, isCurrent, isDone);
              return (
                <motion.div key={`list-${report.id}`} {...cardMotion(index)} whileHover={{ y: -1, scale: 1.005 }} animate={isGlow ? { boxShadow: ['0 0 0 rgba(16,185,129,0)', '0 0 0 7px rgba(16,185,129,0.18)', '0 0 0 rgba(16,185,129,0)'] } : undefined} transition={isGlow ? { duration: 0.95, ease: 'easeOut' } : undefined} className={`rounded-lg border bg-white p-2.5 shadow-sm ${tone.card}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex items-center gap-2">
                      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-700">{index + 1}</span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-900 truncate">{report.label}</p>
                        <p className={`text-[11px] ${isCurrent || isDone ? tone.status : 'text-slate-500'}`}>
                          {isCurrent ? t('reports.daily.generating', 'Génération en cours...') : isDone ? t('reports.daily.done', 'Terminé') : t('reports.daily.ready', 'Prêt')}
                        </p>
                      </div>
                    </div>
                    <MButton
                      onClick={() => void runReportAction(report.id, report.action)}
                      variant={report.variant || 'outline'}
                      size="sm"
                      className={`h-7 px-2 shrink-0 text-[11px] ${tone.button}`}
                      disabled={isRunning}
                      whileHover={{ y: -1, scale: 1.04 }}
                      whileTap={{ scale: 0.96 }}
                    >
                      <motion.span className="mr-1 inline-flex" animate={showSuccessCue ? { scale: [1, 1.18, 1], rotate: [0, -8, 0] } : { scale: 1, rotate: 0 }} transition={{ duration: 0.45, ease: 'easeOut' }}>
                        {showSuccessCue ? <ThumbsUp className="w-3 h-3" /> : <Download className="w-3 h-3" />}
                      </motion.span>
                      {showSuccessCue ? t('reports.daily.doneShort', 'OK') : t('reports.daily.downloadOneShort', 'PDF')}
                    </MButton>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
