import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useApp } from '@/contexts/AppContext';
import { useT } from '@/contexts/LanguageContext';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, ClipboardList, Package, PlusCircle, Search, Siren } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { AddDefectiveStockDialog } from '@/components/dialogs/AddDefectiveStockDialog';
import { BottleType } from '@/types';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

const DefectiveStock = () => {
  const t = useT();
  const { defectiveBottles = [], bottleTypes } = useApp();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedBottleType, setSelectedBottleType] = useState<BottleType | null>(null);
  const [historySearch, setHistorySearch] = useState('');
  const [periodFilter, setPeriodFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [impactQuantity, setImpactQuantity] = useState(10);

  const handleOpenDialog = (bottleType: BottleType) => {
    setSelectedBottleType(bottleType);
    setDialogOpen(true);
  };

  const periodFilteredBottles = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfWeek = startOfToday - 6 * 24 * 60 * 60 * 1000;
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    if (periodFilter === 'all') return defectiveBottles;
    return defectiveBottles.filter((bottle) => {
      const bottleTime = new Date(bottle.date).getTime();
      if (periodFilter === 'today') return bottleTime >= startOfToday;
      if (periodFilter === 'week') return bottleTime >= startOfWeek;
      return bottleTime >= startOfMonth;
    });
  }, [defectiveBottles, periodFilter]);

  const groupedByType = useMemo(() => {
    return periodFilteredBottles.reduce((acc, bottle) => {
      const key = bottle.bottleTypeId;
      if (!acc[key]) {
        acc[key] = {
          bottleTypeId: bottle.bottleTypeId,
          bottleTypeName: bottle.bottleTypeName,
          totalQuantity: 0,
          entries: [] as typeof defectiveBottles
        };
      }
      acc[key].totalQuantity += bottle.quantity;
      acc[key].entries.push(bottle);
      return acc;
    }, {} as Record<string, { bottleTypeId: string; bottleTypeName: string; totalQuantity: number; entries: typeof defectiveBottles }>);
  }, [periodFilteredBottles]);

  const totalDefective = useMemo(() => periodFilteredBottles.reduce((sum, b) => sum + b.quantity, 0), [periodFilteredBottles]);
  const activeTypesCount = useMemo(() => Object.keys(groupedByType).length, [groupedByType]);
  const todayDefective = useMemo(() => {
    const today = new Date().toLocaleDateString('fr-FR');
    return defectiveBottles
      .filter((bottle) => new Date(bottle.date).toLocaleDateString('fr-FR') === today)
      .reduce((sum, bottle) => sum + bottle.quantity, 0);
  }, [defectiveBottles]);
  const sortedBottleTypes = useMemo(() => {
    return bottleTypes
      .slice()
      .sort((a, b) => (groupedByType[b.id]?.totalQuantity || 0) - (groupedByType[a.id]?.totalQuantity || 0));
  }, [bottleTypes, groupedByType]);
  const topBottleType = sortedBottleTypes[0];
  const maxTypeQuantity = useMemo(() => {
    return sortedBottleTypes.reduce((max, bottleType) => {
      const qty = groupedByType[bottleType.id]?.totalQuantity || 0;
      return Math.max(max, qty);
    }, 0);
  }, [sortedBottleTypes, groupedByType]);
  const riskyBottleType = useMemo(() => {
    return sortedBottleTypes.find((bottleType) => {
      const qty = groupedByType[bottleType.id]?.totalQuantity || 0;
      return maxTypeQuantity > 0 && qty >= maxTypeQuantity * 0.66;
    });
  }, [sortedBottleTypes, groupedByType, maxTypeQuantity]);
  const periodLabel = useMemo(() => {
    if (periodFilter === 'today') return t('defectiveStock.period.today');
    if (periodFilter === 'week') return t('defectiveStock.period.week');
    if (periodFilter === 'month') return t('defectiveStock.period.month');
    return t('defectiveStock.period.all');
  }, [periodFilter, t]);
  const sevenDayTrend = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startRecent = startOfToday - 6 * 24 * 60 * 60 * 1000;
    const startPrevious = startRecent - 7 * 24 * 60 * 60 * 1000;
    const recent = defectiveBottles
      .filter((bottle) => {
        const bottleTime = new Date(bottle.date).getTime();
        return bottleTime >= startRecent && bottleTime <= now.getTime();
      })
      .reduce((sum, bottle) => sum + bottle.quantity, 0);
    const previous = defectiveBottles
      .filter((bottle) => {
        const bottleTime = new Date(bottle.date).getTime();
        return bottleTime >= startPrevious && bottleTime < startRecent;
      })
      .reduce((sum, bottle) => sum + bottle.quantity, 0);
    const delta = recent - previous;
    const percent = previous === 0 ? (recent > 0 ? 100 : 0) : Math.round((delta / previous) * 100);
    return { recent, previous, delta, percent };
  }, [defectiveBottles]);
  const anomalyTypes = useMemo(() => {
    return sortedBottleTypes
      .filter((bottleType) => (groupedByType[bottleType.id]?.totalQuantity || 0) > 0)
      .slice(0, 3)
      .map((bottleType) => ({
        bottleType,
        quantity: groupedByType[bottleType.id]?.totalQuantity || 0,
        entries: groupedByType[bottleType.id]?.entries.length || 0
      }));
  }, [sortedBottleTypes, groupedByType]);
  const weeklyRadar = useMemo(() => {
    const now = new Date();
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - index));
      const start = date.getTime();
      const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime();
      const quantity = defectiveBottles
        .filter((bottle) => {
          const bottleTime = new Date(bottle.date).getTime();
          return bottleTime >= start && bottleTime < end;
        })
        .reduce((sum, bottle) => sum + bottle.quantity, 0);
      return {
        label: date.toLocaleDateString('fr-FR', { weekday: 'short' }),
        quantity
      };
    });
    const maxQuantity = days.reduce((max, day) => Math.max(max, day.quantity), 0);
    const total = days.reduce((sum, day) => sum + day.quantity, 0);
    const average = total / days.length;
    const avgDelta = days.slice(1).reduce((sum, day, index) => {
      return sum + Math.abs(day.quantity - days[index].quantity);
    }, 0) / Math.max(days.length - 1, 1);
    const volatility = avgDelta / Math.max(average, 1);
    const stabilityScore = Math.max(0, Math.min(100, 100 - Math.round(volatility * 100)));
    return { days, maxQuantity, average, stabilityScore };
  }, [defectiveBottles]);
  const stabilityLabel = useMemo(() => {
    if (weeklyRadar.stabilityScore >= 75) return t('defectiveStock.stability.stable');
    if (weeklyRadar.stabilityScore >= 45) return t('defectiveStock.stability.watch');
    return t('defectiveStock.stability.unstable');
  }, [weeklyRadar.stabilityScore, t]);
  const quickRecommendations = useMemo(() => {
    const top = anomalyTypes[0];
    const items: string[] = [];
    if (sevenDayTrend.delta > 0) items.push(t('defectiveStock.recommendations.trendUp'));
    if (top && top.quantity >= Math.max(weeklyRadar.average * 2, 1)) {
      items.push(`${t('defectiveStock.recommendations.concentration')} ${top.bottleType.name}: ${t('defectiveStock.recommendations.planAction')}`);
    }
    if (weeklyRadar.stabilityScore < 45) items.push(t('defectiveStock.recommendations.highVariability'));
    if (items.length === 0) items.push(t('defectiveStock.recommendations.controlled'));
    return items.slice(0, 3);
  }, [anomalyTypes, sevenDayTrend.delta, weeklyRadar.average, weeklyRadar.stabilityScore, t]);
  const focusBottleType = riskyBottleType || topBottleType;
  const focusCurrentQuantity = focusBottleType ? groupedByType[focusBottleType.id]?.totalQuantity || 0 : 0;
  const projectedFocusQuantity = focusCurrentQuantity + impactQuantity;
  const projectedTotal = totalDefective + impactQuantity;
  const projectedShare = projectedTotal > 0 ? Math.round((projectedFocusQuantity / projectedTotal) * 100) : 0;
  const projectedRiskLabel = projectedShare >= 55 ? t('defectiveStock.piloting.risk.high') : projectedShare >= 30 ? t('defectiveStock.piloting.risk.medium') : t('defectiveStock.piloting.risk.low');
  const handleStrategicPreset = (preset: 'stabilisation' | 'investigation' | 'surveillance') => {
    if (preset === 'stabilisation') {
      setPeriodFilter('week');
      setHistorySearch('');
      setImpactQuantity(8);
      return;
    }
    if (preset === 'investigation') {
      setPeriodFilter('today');
      setHistorySearch(anomalyTypes[0]?.bottleType.name || '');
      setImpactQuantity(15);
      return;
    }
    setPeriodFilter('month');
    setHistorySearch('');
    setImpactQuantity(20);
  };
  const filteredHistory = useMemo(() => {
    const term = historySearch.trim().toLowerCase();
    const rows = periodFilteredBottles.slice().reverse();
    if (!term) return rows;
    return rows.filter((bottle) =>
      bottle.bottleTypeName.toLowerCase().includes(term) ||
      bottle.returnOrderId.toLowerCase().includes(term)
    );
  }, [periodFilteredBottles, historySearch]);

  return (
    <div className="app-page-shell p-6 space-y-6 bg-slate-50/50 min-h-screen">
      <Card className="app-dark-hero border-none shadow-xl overflow-hidden bg-gradient-to-r from-slate-900 via-rose-900 to-slate-900 text-white">
        <CardContent className="p-6 md:p-8">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div>
              <h1 className="app-page-title text-3xl md:text-4xl font-black tracking-tight">{t('defectiveStock.title')}</h1>
              <p className="app-page-subtitle text-rose-100 mt-2">
                {t('defectiveStock.subtitle')}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge className="bg-white/15 text-white hover:bg-white/15 border border-white/20 rounded-full">
                  {totalDefective} {t('defectiveStock.units')}
                </Badge>
                <Badge className="bg-white/15 text-white hover:bg-white/15 border border-white/20 rounded-full">
                  {activeTypesCount} {t('defectiveStock.activeTypes')}
                </Badge>
                <Badge className="bg-white/15 text-white hover:bg-white/15 border border-white/20 rounded-full">
                  {todayDefective} {t('defectiveStock.today')}
                </Badge>
                <Badge className="bg-white/15 text-white hover:bg-white/15 border border-white/20 rounded-full">
                  {t('defectiveStock.view')}: {periodLabel}
                </Badge>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                className="bg-white text-slate-900 hover:bg-rose-100 font-bold"
                disabled={!topBottleType}
                onClick={() => topBottleType && handleOpenDialog(topBottleType)}
              >
                <PlusCircle className="w-4 h-4 mr-2" />
                {t('defectiveStock.addEntry')}
              </Button>
              <Button
                variant="outline"
                className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white disabled:bg-white/10 disabled:text-white/80"
                disabled={!riskyBottleType}
                onClick={() => riskyBottleType && handleOpenDialog(riskyBottleType)}
              >
                <AlertTriangle className="w-4 h-4 mr-2" />
                {t('defectiveStock.criticalAction')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 font-semibold">{t('defectiveStock.stats.total')}</p>
                <p className="text-3xl font-black text-slate-900">{totalDefective}</p>
              </div>
              <div className="p-3 rounded-xl bg-rose-100 text-rose-700">
                <AlertTriangle className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 font-semibold">{t('defectiveStock.stats.impactedTypes')}</p>
                <p className="text-3xl font-black text-slate-900">{activeTypesCount}</p>
              </div>
              <div className="p-3 rounded-xl bg-indigo-100 text-indigo-700">
                <Package className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 font-semibold">{t('defectiveStock.stats.historizedEntries')}</p>
                <p className="text-3xl font-black text-slate-900">{defectiveBottles.length}</p>
              </div>
              <div className="p-3 rounded-xl bg-emerald-100 text-emerald-700">
                <ClipboardList className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-sm bg-white">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <CardTitle>{t('defectiveStock.alertBoard.title')}</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-violet-100 text-violet-700 hover:bg-violet-100 rounded-full">
                {t('defectiveStock.alertBoard.rollingDays')}
              </Badge>
              <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100 rounded-full">
                {t('defectiveStock.view')}: {periodLabel}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-3">
              <Card className="border border-slate-200 bg-slate-50/40">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-500 font-semibold">{t('defectiveStock.alertBoard.trend7j')}</p>
                  {sevenDayTrend.delta >= 0 ? (
                    <ArrowUpRight className="w-5 h-5 text-rose-600" />
                  ) : (
                    <ArrowDownRight className="w-5 h-5 text-emerald-600" />
                  )}
                </div>
                <p className="text-2xl font-black mt-1">{sevenDayTrend.recent}</p>
                <p className={sevenDayTrend.delta >= 0 ? 'text-sm text-rose-600 mt-1' : 'text-sm text-emerald-600 mt-1'}>
                  {sevenDayTrend.delta >= 0 ? '+' : ''}
                  {sevenDayTrend.percent}% {t('defectiveStock.alertBoard.vsPrevious')}
                </p>
              </CardContent>
            </Card>
            <Card className="border border-slate-200 bg-slate-50/40">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-500 font-semibold">{t('defectiveStock.alertBoard.priorityType')}</p>
                  <Siren className="w-5 h-5 text-amber-600" />
                </div>
                <p className="text-base font-bold text-slate-900 mt-2 truncate">
                  {anomalyTypes[0]?.bottleType.name || t('defectiveStock.alertBoard.noType')}
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  {anomalyTypes[0] ? `${anomalyTypes[0].quantity} ${t('defectiveStock.alertBoard.units')}` : `0 ${t('defectiveStock.alertBoard.unit')}`}
                </p>
              </CardContent>
            </Card>
            <Card className="border border-slate-200 bg-slate-50/40">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-500 font-semibold">{t('defectiveStock.alertBoard.quickActions')}</p>
                  <AlertTriangle className="w-5 h-5 text-indigo-600" />
                </div>
                <div className="mt-3 space-y-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    disabled={!anomalyTypes[0]}
                    onClick={() => anomalyTypes[0] && handleOpenDialog(anomalyTypes[0].bottleType)}
                  >
                    {t('defectiveStock.alertBoard.addOnPriority')}
                  </Button>
                  <Button size="sm" variant="outline" className="w-full" onClick={() => setPeriodFilter('week')}>
                    {t('defectiveStock.alertBoard.switchTo7Days')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="grid md:grid-cols-3 gap-3">
            {anomalyTypes.length > 0 ? (
              anomalyTypes.map((item) => (
                <div key={item.bottleType.id} className="rounded-xl border border-slate-200 p-3 bg-white">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-slate-900 truncate">{item.bottleType.name}</p>
                    <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100 rounded-full">{item.quantity}</Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{item.entries} {t('defectiveStock.alertBoard.entriesOnView')}</p>
                </div>
              ))
            ) : (
              <div className="md:col-span-3 text-center py-4 text-slate-500">
                {t('defectiveStock.alertBoard.noAnomaly')}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm bg-white">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <CardTitle>{t('defectiveStock.studio.title')}</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => handleStrategicPreset('stabilisation')}>
                {t('defectiveStock.studio.presetStabilisation')}
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleStrategicPreset('investigation')}>
                {t('defectiveStock.studio.presetInvestigation')}
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleStrategicPreset('surveillance')}>
                {t('defectiveStock.studio.presetSurveillance')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-3">
          <Card className="border border-slate-200 bg-slate-50/40 lg:col-span-2">
            <CardContent className="p-4 space-y-4">
                      <p className="text-sm text-slate-500 font-semibold">{t('defectiveStock.studio.simulator')}</p>
              <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                <div className="w-full sm:w-56">
                  <p className="text-xs text-slate-500 mb-1">{t('defectiveStock.studio.simulatedQty')}</p>
                  <Input
                    type="number"
                    min={1}
                    value={impactQuantity}
                    onChange={(e) => setImpactQuantity(Math.max(1, Number(e.target.value) || 1))}
                  />
                </div>
                <Button
                  variant="outline"
                  disabled={!focusBottleType}
                  onClick={() => focusBottleType && handleOpenDialog(focusBottleType)}
                >
                  {t('defectiveStock.studio.applyOnFocus')}
                </Button>
              </div>
              <div className="grid sm:grid-cols-3 gap-2 pt-2">
                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-xs text-slate-500">{t('defectiveStock.studio.focusType')}</p>
                  <p className="text-sm font-bold text-slate-900 truncate">{focusBottleType?.name || t('defectiveStock.studio.none')}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-xs text-slate-500">{t('defectiveStock.studio.projectedShare')}</p>
                  <p className="text-sm font-bold text-slate-900">{projectedShare}%</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-xs text-slate-500">{t('defectiveStock.studio.projectedRisk')}</p>
                  <p className="text-sm font-bold text-slate-900">{projectedRiskLabel}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border border-slate-200 bg-slate-50/40">
            <CardContent className="p-4 space-y-3">
              <p className="text-sm text-slate-500 font-semibold">{t('defectiveStock.studio.shortcuts')}</p>
              <Button
                className="w-full"
                variant="outline"
                disabled={!anomalyTypes[0]}
                onClick={() => anomalyTypes[0] && handleOpenDialog(anomalyTypes[0].bottleType)}
              >
                {t('defectiveStock.studio.treatTop')}
              </Button>
              <Button
                className="w-full"
                variant="outline"
                disabled={!anomalyTypes[1]}
                onClick={() => anomalyTypes[1] && handleOpenDialog(anomalyTypes[1].bottleType)}
              >
                {t('defectiveStock.studio.treat2')}
              </Button>
              <Button className="w-full" variant="outline" onClick={() => setPeriodFilter('today')}>
                {t('defectiveStock.studio.focusToday')}
              </Button>
            </CardContent>
          </Card>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm bg-white">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <CardTitle>{t('defectiveStock.radar.title')}</CardTitle>
            <Badge
              className={
                weeklyRadar.stabilityScore >= 75
                  ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100 rounded-full'
                  : weeklyRadar.stabilityScore >= 45
                    ? 'bg-amber-100 text-amber-700 hover:bg-amber-100 rounded-full'
                    : 'bg-rose-100 text-rose-700 hover:bg-rose-100 rounded-full'
              }
            >
              {t('defectiveStock.radar.stability')}: {weeklyRadar.stabilityScore}/100 · {stabilityLabel}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-7">
            {weeklyRadar.days.map((day) => (
              <div key={day.label} className="rounded-xl border border-slate-200 p-3 bg-slate-50/50">
                <p className="text-xs font-semibold text-slate-500 uppercase">{day.label}</p>
                <div className="mt-2 h-20 flex items-end">
                  <div
                    className="w-full rounded-md bg-gradient-to-t from-indigo-600 to-cyan-400"
                    style={{
                      height: `${weeklyRadar.maxQuantity === 0 ? 0 : Math.max(8, Math.round((day.quantity / weeklyRadar.maxQuantity) * 100))}%`
                    }}
                  />
                </div>
                <p className="mt-2 text-sm font-bold text-slate-900">{day.quantity}</p>
              </div>
            ))}
          </div>
          <div className="grid md:grid-cols-3 gap-3">
            {quickRecommendations.map((item) => (
              <div key={item} className="rounded-xl border border-indigo-100 bg-indigo-50/50 px-3 py-2 text-sm text-indigo-900">
                {item}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm bg-white">
        <CardHeader>
          <CardTitle>{t('defectiveStock.piloting.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          {sortedBottleTypes.length > 0 ? (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {sortedBottleTypes.map((bottleType) => {
                const group = groupedByType[bottleType.id];
                const totalQuantity = group?.totalQuantity || 0;
                const entriesCount = group?.entries.length || 0;
                const latestEntry = group?.entries
                  .slice()
                  .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))[0];
                return (
                  <Card key={bottleType.id} className="border border-slate-200 bg-slate-50/40">
                    <CardContent className="p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 truncate">{bottleType.name}</p>
                          <p className="text-xs text-slate-500">{entriesCount} {t('defectiveStock.piloting.entries')}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100 rounded-full">
                            {totalQuantity}
                          </Badge>
                          <Badge
                            className={
                              maxTypeQuantity > 0 && totalQuantity >= maxTypeQuantity * 0.66
                                ? 'bg-red-100 text-red-700 hover:bg-red-100 rounded-full'
                                : maxTypeQuantity > 0 && totalQuantity >= maxTypeQuantity * 0.33
                                  ? 'bg-amber-100 text-amber-700 hover:bg-amber-100 rounded-full'
                                  : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100 rounded-full'
                            }
                          >
                            {maxTypeQuantity > 0 && totalQuantity >= maxTypeQuantity * 0.66
                              ? t('defectiveStock.piloting.risk.high')
                              : maxTypeQuantity > 0 && totalQuantity >= maxTypeQuantity * 0.33
                                ? t('defectiveStock.piloting.risk.medium')
                                : t('defectiveStock.piloting.risk.low')}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-xs text-slate-500">
                        {t('defectiveStock.piloting.lastEntry')}: {latestEntry ? new Date(latestEntry.date).toLocaleDateString('fr-FR') : t('defectiveStock.piloting.noEntry')}
                      </div>
                      <Button variant="outline" size="sm" className="w-full" onClick={() => handleOpenDialog(bottleType)}>
                        <PlusCircle className="w-4 h-4 mr-2" />
                        {t('defectiveStock.piloting.add')}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-10 text-slate-500">
              {t('defectiveStock.piloting.noBottleType')}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm bg-white">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-col gap-2">
              <CardTitle>{t('defectiveStock.history.title')}</CardTitle>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={periodFilter === 'all' ? 'default' : 'outline'}
                  onClick={() => setPeriodFilter('all')}
                >
                  {t('defectiveStock.history.all')}
                </Button>
                <Button
                  size="sm"
                  variant={periodFilter === 'today' ? 'default' : 'outline'}
                  onClick={() => setPeriodFilter('today')}
                >
                  {t('defectiveStock.history.today')}
                </Button>
                <Button
                  size="sm"
                  variant={periodFilter === 'week' ? 'default' : 'outline'}
                  onClick={() => setPeriodFilter('week')}
                >
                  {t('defectiveStock.history.week')}
                </Button>
                <Button
                  size="sm"
                  variant={periodFilter === 'month' ? 'default' : 'outline'}
                  onClick={() => setPeriodFilter('month')}
                >
                  {t('defectiveStock.history.month')}
                </Button>
              </div>
            </div>
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder={t('defectiveStock.history.search')}
                className="pl-9 bg-white"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredHistory.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('defectiveStock.history.date')}</TableHead>
                  <TableHead>{t('defectiveStock.history.bdRef')}</TableHead>
                  <TableHead>{t('defectiveStock.history.bottleType')}</TableHead>
                  <TableHead className="text-right">{t('defectiveStock.history.quantity')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredHistory.map((bottle) => (
                  <TableRow key={bottle.id}>
                    <TableCell>{new Date(bottle.date).toLocaleDateString('fr-FR')}</TableCell>
                    <TableCell className="font-medium">{bottle.returnOrderId}</TableCell>
                    <TableCell>{bottle.bottleTypeName}</TableCell>
                    <TableCell className="text-right font-bold">{bottle.quantity}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-10 text-slate-500">
              {t('defectiveStock.history.noResult')}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedBottleType && (
        <AddDefectiveStockDialog
          bottleType={selectedBottleType}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
        />
      )}
    </div>
  );
};

export default DefectiveStock;
