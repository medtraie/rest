import React from 'react';
import { Activity, AlertTriangle, Download, Info, ThumbsDown, ThumbsUp, Truck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { motion } from 'framer-motion';

type FleetRow = {
  id: string;
  matricule?: string;
  repairCount: number;
  totalRepairCost: number;
  score: number;
  status: string;
  color: string;
  recommendation: string;
};

type Props = {
  t: (key: string, fallback: string) => string;
  MButton: typeof motion.button extends never ? any : any;
  sectionMotion: Record<string, any>;
  truckHealthAnalysis: FleetRow[];
  trucksCount: number;
  generateFleetHealthReport: () => void;
};

export default function ReportsFleetSection({
  t,
  MButton,
  sectionMotion,
  truckHealthAnalysis,
  trucksCount,
  generateFleetHealthReport,
}: Props) {
  const criticalVehicles = React.useMemo(
    () => truckHealthAnalysis.filter((row) => row.score < 40).length,
    [truckHealthAnalysis]
  );
  const goodVehicles = React.useMemo(
    () => truckHealthAnalysis.filter((row) => row.score >= 70).length,
    [truckHealthAnalysis]
  );

  return (
    <motion.div {...sectionMotion}>
      <Card id="reports-fleet" className="border-slate-200 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-600" />
            {t('reports.fleet.title', 'Analyse Intelligente de la Flotte')}
          </CardTitle>
          <MButton onClick={generateFleetHealthReport} variant="outline" size="sm" whileTap={{ scale: 0.96 }}>
            <Download className="w-4 h-4 mr-2" />
            {t('reports.fleet.healthReportPdf', 'Rapport Santé PDF')}
          </MButton>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
              <div className="flex items-center gap-2 text-blue-800 font-semibold mb-1">
                <Truck className="w-4 h-4" />
                {t('reports.fleet.totalVehicles', 'Total Véhicules')}
              </div>
              <div className="text-2xl font-bold text-blue-900">{trucksCount}</div>
            </div>
            <div className="bg-red-50 p-4 rounded-lg border border-red-100">
              <div className="flex items-center gap-2 text-red-800 font-semibold mb-1">
                <AlertTriangle className="w-4 h-4" />
                {t('reports.fleet.criticalVehicles', 'Véhicules Critiques')}
              </div>
              <div className="text-2xl font-bold text-red-900">{criticalVehicles}</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg border border-green-100">
              <div className="flex items-center gap-2 text-green-800 font-semibold mb-1">
                <ThumbsUp className="w-4 h-4" />
                {t('reports.fleet.goodVehicles', 'Véhicules en Bon État')}
              </div>
              <div className="text-2xl font-bold text-green-900">{goodVehicles}</div>
            </div>
          </div>

          <div className="overflow-x-auto border rounded-lg hidden md:block smart-scroll-x">
            <table className="reports-table-ultra w-full text-sm smart-table">
              <thead>
                <tr className="text-left border-b bg-gray-50 sticky top-0">
                  <th className="px-2.5 py-2">{t('reports.fleet.table.vehicle', 'Véhicule')}</th>
                  <th className="px-2.5 py-2">{t('reports.fleet.table.repairsCount', 'Nb Réparations')}</th>
                  <th className="px-2.5 py-2">{t('reports.fleet.table.totalCost', 'Coût Total')}</th>
                  <th className="px-2.5 py-2">{t('reports.fleet.table.health', 'Santé')}</th>
                  <th className="px-2.5 py-2">{t('reports.fleet.table.state', 'État')}</th>
                  <th className="px-2.5 py-2">{t('reports.fleet.table.advice', 'Conseil')}</th>
                </tr>
              </thead>
              <tbody>
                {truckHealthAnalysis.map((row, index) => (
                  <tr key={row.id} className={`border-b hover:bg-gray-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                    <td className="px-2.5 py-2 font-medium">{row.matricule}</td>
                    <td className="px-2.5 py-2">{row.repairCount}</td>
                    <td className="px-2.5 py-2">{row.totalRepairCost.toFixed(2)} DH</td>
                    <td className="px-2.5 py-2">
                      <div className="w-full bg-gray-200 rounded-full h-2 max-w-[100px]">
                        <div
                          className={`h-2 rounded-full ${row.score >= 70 ? 'bg-green-500' : row.score >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                          style={{ width: `${row.score}%` }}
                        ></div>
                      </div>
                    </td>
                    <td className={`px-2.5 py-2 font-bold ${row.color}`}>
                      {row.score < 40 && <ThumbsDown className="w-4 h-4 inline mr-1" />}
                      {row.score >= 70 && <ThumbsUp className="w-4 h-4 inline mr-1" />}
                      {row.status}
                    </td>
                    <td className="px-2.5 py-2">
                      <Badge variant={row.score < 40 ? 'destructive' : row.score < 70 ? 'default' : 'secondary'}>
                        {row.recommendation}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden grid grid-cols-1 gap-2">
            {truckHealthAnalysis.map((row) => (
              <div key={row.id} className="rounded-xl border border-slate-200 bg-white p-3 app-panel-soft">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{row.matricule}</span>
                  <Badge variant="outline" className="text-[10px]">{row.status}</Badge>
                </div>
                <div className="mt-1 grid grid-cols-3 gap-2 text-xs">
                  <span>{row.repairCount} {t('reports.fleet.table.repairsCount', 'Nb Réparations')}</span>
                  <span className="font-bold">{row.totalRepairCost.toFixed(2)} DH</span>
                  <span>{row.score}%</span>
                </div>
                <div className="mt-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div className={`h-2 ${row.score >= 70 ? 'bg-green-500' : row.score >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${row.score}%` }} />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 p-4 bg-gray-50 rounded-lg flex items-start gap-3 border border-gray-200">
            <Info className="w-5 h-5 text-gray-500 mt-0.5" />
            <div className="text-xs text-gray-600">
              <p className="font-bold mb-1">{t('reports.fleet.analysisHow', "Comment fonctionne l'analyse ?")}</p>
              {t('reports.fleet.analysisDescription', "L'algorithme calcule un score de santé basé sur la fréquence des pannes et les coûts cumulés. Un score inférieur à 40 indique une machine coûteuse qui devrait être remplacée pour optimiser la rentabilité.")}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
