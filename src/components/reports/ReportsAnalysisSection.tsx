import React from 'react';
import { ArrowRightLeft, Activity, Download, Filter, Package, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type ImpactRow = {
  driverId: string;
  driverName: string;
  total: number;
  byType: Record<string, number>;
};

type Props = {
  t: (key: string, fallback: string) => string;
  analysisSearch: string;
  setAnalysisSearch: React.Dispatch<React.SetStateAction<string>>;
  foreignBottlesAnalysis: ImpactRow[];
  rcBottlesAnalysis: ImpactRow[];
  generateForeignBottlesReport: () => void;
  generateRCReport: () => void;
};

export default function ReportsAnalysisSection({
  t,
  analysisSearch,
  setAnalysisSearch,
  foreignBottlesAnalysis,
  rcBottlesAnalysis,
  generateForeignBottlesReport,
  generateRCReport,
}: Props) {
  const normalizedSearch = analysisSearch.toLowerCase();
  const filteredForeign = React.useMemo(
    () => foreignBottlesAnalysis.filter((d) => d.driverName.toLowerCase().includes(normalizedSearch)),
    [foreignBottlesAnalysis, normalizedSearch]
  );
  const filteredRc = React.useMemo(
    () => rcBottlesAnalysis.filter((d) => d.driverName.toLowerCase().includes(normalizedSearch)),
    [rcBottlesAnalysis, normalizedSearch]
  );
  const totalForeign = React.useMemo(
    () => foreignBottlesAnalysis.reduce((sum, d) => sum + d.total, 0),
    [foreignBottlesAnalysis]
  );
  const totalRC = React.useMemo(
    () => rcBottlesAnalysis.reduce((sum, d) => sum + d.total, 0),
    [rcBottlesAnalysis]
  );
  const impactedDriversCount = React.useMemo(
    () => new Set([...foreignBottlesAnalysis.map((d) => d.driverId), ...rcBottlesAnalysis.map((d) => d.driverId)]).size,
    [foreignBottlesAnalysis, rcBottlesAnalysis]
  );

  return (
    <div className="space-y-6">
      <Card className="border-l-4 border-l-orange-500">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="text-2xl font-bold flex items-center gap-2">
              <Package className="w-6 h-6 text-orange-600" />
              {t('reports.impact.title', "Suivi d'impact du stock")}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">{t('reports.impact.subtitle', 'Analyse des pertes (R.C) et des bouteilles étrangères par chauffeur')}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative w-64">
              <Filter className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('reports.impact.filterByDriver', 'Filtrer par chauffeur...')}
                className="pl-8 h-9"
                value={analysisSearch}
                onChange={(e) => setAnalysisSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 flex items-center gap-4">
              <div className="bg-orange-500 p-3 rounded-lg text-white">
                <Activity className="w-6 h-6" />
              </div>
              <div>
                <div className="text-orange-800 text-xs font-bold uppercase tracking-wider">{t('reports.impact.globalImpact', 'Impact Global')}</div>
                <div className="text-2xl font-black text-orange-900">{totalForeign + totalRC}</div>
              </div>
            </div>
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-center gap-4">
              <div className="bg-blue-500 p-3 rounded-lg text-white">
                <Package className="w-6 h-6" />
              </div>
              <div>
                <div className="text-blue-800 text-xs font-bold uppercase tracking-wider">{t('reports.impact.foreignTotal', 'Étrangères Total')}</div>
                <div className="text-2xl font-black text-blue-900">{totalForeign}</div>
              </div>
            </div>
            <div className="bg-red-50 p-4 rounded-xl border border-red-100 flex items-center gap-4">
              <div className="bg-red-500 p-3 rounded-lg text-white">
                <ArrowRightLeft className="w-6 h-6" />
              </div>
              <div>
                <div className="text-red-800 text-xs font-bold uppercase tracking-wider">{t('reports.impact.rcLossesTotal', 'R.C (Pertes) Total')}</div>
                <div className="text-2xl font-black text-red-900">{totalRC}</div>
              </div>
            </div>
            <div className="bg-green-50 p-4 rounded-xl border border-green-100 flex items-center gap-4">
              <div className="bg-green-500 p-3 rounded-lg text-white">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <div className="text-green-800 text-xs font-bold uppercase tracking-wider">{t('reports.impact.impactedDrivers', 'Chauffeurs Impactés')}</div>
                <div className="text-2xl font-black text-green-900">{impactedDriversCount}</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold flex items-center gap-2 text-blue-700">
                  <div className="w-2 h-6 bg-blue-500 rounded-full"></div>
                  {t('reports.impact.foreignBottles', 'Bouteilles Étrangères')}
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-blue-600 border-blue-200 hover:bg-blue-50"
                  onClick={generateForeignBottlesReport}
                  disabled={foreignBottlesAnalysis.length === 0}
                >
                  <Download className="w-4 h-4 mr-2" />
                  PDF
                </Button>
              </div>
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                {filteredForeign.map((d) => (
                  <div key={d.driverId} className="group p-4 bg-white border rounded-xl hover:shadow-md transition-all border-blue-100 hover:border-blue-300">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <span className="text-sm font-bold text-gray-900 group-hover:text-blue-700 transition-colors">{d.driverName}</span>
                        <div className="flex gap-1 mt-1">
                          {Object.entries(d.byType).map(([type, qty]) => (
                            <Badge key={type} variant="secondary" className="text-[10px] py-0 bg-blue-50 text-blue-700 border-blue-100">
                              {qty} {type}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xl font-black text-blue-600">{d.total}</span>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold">{t('reports.impact.units', 'Unités')}</p>
                      </div>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-blue-500 h-full rounded-full transition-all"
                        style={{ width: `${Math.min(100, totalForeign > 0 ? (d.total / totalForeign) * 100 : 0)}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
                {foreignBottlesAnalysis.length === 0 && (
                  <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed">
                    <Package className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">{t('reports.impact.noForeignBottle', 'Aucune bouteille étrangère détectée.')}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold flex items-center gap-2 text-red-700">
                  <div className="w-2 h-6 bg-red-500 rounded-full"></div>
                  {t('reports.impact.rcTracking', 'Suivi des Restants (R.C)')}
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-600 border-red-200 hover:bg-red-50"
                  onClick={generateRCReport}
                  disabled={rcBottlesAnalysis.length === 0}
                >
                  <Download className="w-4 h-4 mr-2" />
                  PDF
                </Button>
              </div>
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                {filteredRc.map((d) => (
                  <div key={d.driverId} className="group p-4 bg-white border rounded-xl hover:shadow-md transition-all border-red-100 hover:border-red-300">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <span className="text-sm font-bold text-gray-900 group-hover:text-red-700 transition-colors">{d.driverName}</span>
                        <div className="flex gap-1 mt-1">
                          {Object.entries(d.byType).map(([type, qty]) => (
                            <Badge key={type} variant="secondary" className="text-[10px] py-0 bg-red-50 text-red-700 border-red-100">
                              {qty} {type}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xl font-black text-red-600">{d.total}</span>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold">{t('reports.impact.units', 'Unités')}</p>
                      </div>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-red-500 h-full rounded-full transition-all"
                        style={{ width: `${Math.min(100, totalRC > 0 ? (d.total / totalRC) * 100 : 0)}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
                {rcBottlesAnalysis.length === 0 && (
                  <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed">
                    <ArrowRightLeft className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">{t('reports.impact.noRcLoss', 'Aucun R.C (perte) détecté.')}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
