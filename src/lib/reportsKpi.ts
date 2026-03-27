import type { BottleType, ReturnOrder, SupplyOrder } from '@/types';

export type ReportsStockFilter = {
  startDate?: string;
  endDate?: string;
  selectedTruck?: string;
  selectedDriver?: string;
};

export type StockAnalysisRow = {
  id: string;
  name: string;
  total: number;
  distributed: number;
  rawDistributed: number;
  remaining: number;
  value: number;
  distributionRate: number;
  status: string;
  statusColor: string;
};

export type StockKpis = {
  stockValueRemaining: number;
  totalUnits: number;
  distributedUnits: number;
  averageDistributionRate: number;
};

export type KpiComparisonPoint = {
  current: number;
  previous: number;
  delta: number;
  deltaPercent: number | null;
};

export type StockComparison = {
  stockValueRemaining: KpiComparisonPoint | null;
  totalUnits: KpiComparisonPoint | null;
  distributedUnits: KpiComparisonPoint | null;
  averageDistributionRate: KpiComparisonPoint | null;
};

export type StockAnomaly = {
  key: string;
  severity: 'high' | 'medium';
  message: string;
};

type DateWindow = {
  startDate: Date | null;
  endDate: Date | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const parseDateStart = (value?: string) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
};

const parseDateEnd = (value?: string) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(23, 59, 59, 999);
  return d;
};

const buildCurrentWindow = (filter: ReportsStockFilter): DateWindow => ({
  startDate: parseDateStart(filter.startDate),
  endDate: parseDateEnd(filter.endDate),
});

const buildPreviousWindow = (filter: ReportsStockFilter): DateWindow | null => {
  const currentStart = parseDateStart(filter.startDate);
  const currentEnd = parseDateEnd(filter.endDate);
  if (!currentStart && !currentEnd) return null;
  const start = currentStart || (currentEnd ? new Date(currentEnd) : null);
  const end = currentEnd || (currentStart ? new Date(currentStart) : null);
  if (!start || !end) return null;
  if (end.getTime() < start.getTime()) return null;
  const days = Math.floor((end.getTime() - start.getTime()) / DAY_MS) + 1;
  const previousEnd = new Date(start.getTime() - 1);
  previousEnd.setHours(23, 59, 59, 999);
  const previousStart = new Date(previousEnd.getTime() - (days - 1) * DAY_MS);
  previousStart.setHours(0, 0, 0, 0);
  return { startDate: previousStart, endDate: previousEnd };
};

const matchesOrderFilters = (
  order: ReturnOrder,
  supplyOrders: SupplyOrder[],
  filter: ReportsStockFilter,
  window: DateWindow
) => {
  const orderDate = new Date(order.date || '');
  if (window.startDate && orderDate < window.startDate) return false;
  if (window.endDate && orderDate > window.endDate) return false;
  if ((filter.selectedTruck || 'all') !== 'all') {
    const linkedSupply = (supplyOrders || []).find((s: any) => String(s.id) === String(order.supplyOrderId));
    if ((linkedSupply?.truckId || '') !== filter.selectedTruck) return false;
  }
  if ((filter.selectedDriver || 'all') !== 'all' && order.driverId !== filter.selectedDriver) return false;
  return true;
};

const getDistributedByBottleType = (orders: ReturnOrder[]) =>
  (orders || []).reduce((acc, order) => {
    (order.items || []).forEach((item: any) => {
      const bottleTypeId = String(item?.bottleTypeId || '');
      if (!bottleTypeId) return;
      const soldFallback = Number(item?.returnedEmptyQuantity || 0) + Number(item?.consigneQuantity || 0);
      const sold = Math.max(0, Number(item?.soldQuantity ?? soldFallback) || 0);
      acc[bottleTypeId] = (acc[bottleTypeId] || 0) + sold;
    });
    return acc;
  }, {} as Record<string, number>);

const buildStockRows = (bottleTypes: BottleType[], distributedByBottleType: Record<string, number>) =>
  (bottleTypes || []).map((bt) => {
    const total = Number(bt.totalQuantity || 0);
    const rawDistributed = Number(distributedByBottleType[String(bt.id)] || 0);
    const distributed = Math.max(0, Math.min(total, rawDistributed));
    const remaining = Math.max(0, total - distributed);
    const distributionRate = total > 0 ? (distributed / total) * 100 : 0;
    const value = remaining * (Number(bt.unitPrice || 0));
    let status = 'Sain';
    let statusColor = 'text-green-600';
    if (remaining === 0) {
      status = 'Épuisé';
      statusColor = 'text-red-600';
    } else if (remaining < 10) {
      status = 'Critique';
      statusColor = 'text-orange-600';
    } else if (remaining < 50) {
      status = 'Faible';
      statusColor = 'text-yellow-600';
    }
    return {
      id: String(bt.id),
      name: bt.name,
      total,
      distributed,
      rawDistributed,
      remaining,
      value,
      distributionRate,
      status,
      statusColor,
    };
  });

const computeKpis = (rows: StockAnalysisRow[]): StockKpis => {
  const totalUnits = rows.reduce((sum, s) => sum + s.total, 0);
  const distributedUnits = rows.reduce((sum, s) => sum + s.distributed, 0);
  const stockValueRemaining = rows.reduce((sum, s) => sum + s.value, 0);
  const averageDistributionRate = totalUnits > 0 ? (distributedUnits / totalUnits) * 100 : 0;
  return { stockValueRemaining, totalUnits, distributedUnits, averageDistributionRate };
};

const toComparison = (current: number, previous: number): KpiComparisonPoint => {
  const delta = current - previous;
  const deltaPercent = previous === 0 ? null : (delta / previous) * 100;
  return { current, previous, delta, deltaPercent };
};

const buildAnomalies = (rows: StockAnalysisRow[], bottleTypes: BottleType[]): StockAnomaly[] => {
  const anomalies: StockAnomaly[] = [];
  rows.forEach((row) => {
    if (row.rawDistributed > row.total) {
      anomalies.push({
        key: `oversold-${row.id}`,
        severity: 'high',
        message: `${row.name}: unités distribuées (${row.rawDistributed}) supérieures au total (${row.total})`,
      });
    }
    if (row.total === 0 && row.rawDistributed > 0) {
      anomalies.push({
        key: `zero-total-${row.id}`,
        severity: 'high',
        message: `${row.name}: distribution détectée avec total unités égal à 0`,
      });
    }
  });
  bottleTypes.forEach((bt) => {
    if (Number(bt.totalQuantity || 0) < 0 || Number(bt.remainingQuantity || 0) < 0 || Number(bt.distributedQuantity || 0) < 0) {
      anomalies.push({
        key: `negative-${bt.id}`,
        severity: 'high',
        message: `${bt.name}: quantités négatives détectées dans les données de stock`,
      });
    }
    if (Number(bt.unitPrice || 0) < 0) {
      anomalies.push({
        key: `price-${bt.id}`,
        severity: 'medium',
        message: `${bt.name}: prix unitaire négatif détecté`,
      });
    }
  });
  return anomalies;
};

export const buildReportsStockKpis = ({
  bottleTypes,
  returnOrders,
  supplyOrders,
  filter,
}: {
  bottleTypes: BottleType[];
  returnOrders: ReturnOrder[];
  supplyOrders: SupplyOrder[];
  filter: ReportsStockFilter;
}) => {
  const currentWindow = buildCurrentWindow(filter);
  const currentOrders = (returnOrders || []).filter((order) => matchesOrderFilters(order, supplyOrders || [], filter, currentWindow));
  const currentDistributed = getDistributedByBottleType(currentOrders);
  const stockAnalysis = buildStockRows(bottleTypes || [], currentDistributed);
  const kpis = computeKpis(stockAnalysis);
  const previousWindow = buildPreviousWindow(filter);
  const comparison: StockComparison = {
    stockValueRemaining: null,
    totalUnits: null,
    distributedUnits: null,
    averageDistributionRate: null,
  };
  if (previousWindow) {
    const previousOrders = (returnOrders || []).filter((order) => matchesOrderFilters(order, supplyOrders || [], filter, previousWindow));
    const previousDistributed = getDistributedByBottleType(previousOrders);
    const previousRows = buildStockRows(bottleTypes || [], previousDistributed);
    const previousKpis = computeKpis(previousRows);
    comparison.stockValueRemaining = toComparison(kpis.stockValueRemaining, previousKpis.stockValueRemaining);
    comparison.totalUnits = toComparison(kpis.totalUnits, previousKpis.totalUnits);
    comparison.distributedUnits = toComparison(kpis.distributedUnits, previousKpis.distributedUnits);
    comparison.averageDistributionRate = toComparison(kpis.averageDistributionRate, previousKpis.averageDistributionRate);
  }
  const anomalies = buildAnomalies(stockAnalysis, bottleTypes || []);
  return { stockAnalysis, kpis, comparison, anomalies };
};
