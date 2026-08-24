import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useLanguage, useT } from '@/contexts/LanguageContext';
import { 
  Archive, 
  Bot, 
  Calculator, 
  AlertTriangle, 
  Truck, 
  PackageCheck, 
  TrendingDown, 
  HelpCircle, 
  Sparkles, 
  CheckCircle2, 
  ArrowRight,
  ShieldAlert,
  Clock,
  Zap
} from 'lucide-react';

export type InventoryHelpTab = 'mission' | 'autopilot' | 'planner';

interface InventoryFeatureHelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: InventoryHelpTab;
}

export const InventoryFeatureHelpDialog: React.FC<InventoryFeatureHelpDialogProps> = ({
  open,
  onOpenChange,
  defaultTab = 'mission',
}) => {
  const { language } = useLanguage();
  const t = useT();
  const tr = (fr: string, ar: string) => (language === 'ar' ? ar : fr);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0 border border-slate-200 shadow-2xl rounded-2xl bg-white">
        {/* Header */}
        <DialogHeader className="p-5 pb-4 bg-white border-b border-slate-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <DialogTitle className="text-xl font-black text-slate-900 flex items-center gap-2">
                {tr('Guide & Fonctionnalités Intelligentes du Stock', 'دليل وشرح الخصائص الذكية للمخزون')}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 font-medium mt-0.5">
                {tr(
                  'Comprendre les algorithmes de pilotage, triage et réapprovisionnement automatique.',
                  'فهم خوارزميات التوجيه والفرز والتنبؤ بإعادة التموين التلقائي.'
                )}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Body Content with Tabs */}
        <div className="flex-1 overflow-y-auto p-5 bg-slate-50">
          <Tabs defaultValue={defaultTab} className="w-full space-y-4">
            <TabsList className="grid grid-cols-3 w-full bg-white border border-slate-200 p-1 rounded-xl h-auto shadow-2xs">
              <TabsTrigger
                value="mission"
                className="py-2 text-xs font-bold data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 rounded-lg flex items-center justify-center gap-1.5"
              >
                <Archive className="w-4 h-4" />
                <span>{tr('Mission Control', 'مركز التحكم')}</span>
              </TabsTrigger>

              <TabsTrigger
                value="autopilot"
                className="py-2 text-xs font-bold data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 rounded-lg flex items-center justify-center gap-1.5"
              >
                <Bot className="w-4 h-4" />
                <span>{tr('Stock Autopilot', 'الطيار الآلي')}</span>
              </TabsTrigger>

              <TabsTrigger
                value="planner"
                className="py-2 text-xs font-bold data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 rounded-lg flex items-center justify-center gap-1.5"
              >
                <Calculator className="w-4 h-4" />
                <span>{tr('Replenishment Planner', 'مخطط التموين')}</span>
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: MISSION CONTROL */}
            <TabsContent value="mission" className="space-y-4 m-0">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-xs">
                <div>
                  <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm">
                    <Archive className="w-4 h-4" />
                    <span>{tr('Centre de Commande & Triage Tactique', 'مركز القيادة والفرز التكتيكي')}</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    {tr(
                      "Mission Control analyse en temps réel les mouvements des 7 derniers jours et calcule l'autonomie restante en jours pour chaque type de bouteille afin de classer le stock en 3 corridors d'action immédiate :",
                      "يقوم مركز التحكم بتحليل حركات آخر 7 أيام في الوقت الفعلي وحساب الاستقلالية المتبقية بالأيام لكل نوع قنينة لفرز المخزون في 3 مسارات عمل مباشرة:"
                    )}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                  {/* Urgent */}
                  <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge className="bg-rose-600 text-white font-bold text-[10px] px-2 py-0.5">
                        🔴 {tr('Intervention', 'تدخل عاجل')}
                      </Badge>
                      <span className="text-[11px] font-bold text-rose-700">≤ 10 {tr('jours', 'أيام')}</span>
                    </div>
                    <p className="text-xs text-slate-700 font-medium leading-normal">
                      {tr(
                        "Stock plein ≤ seuil critique ou autonomie inférieure à 10 jours. Action requise : commande usine prioritaire.",
                        "المخزون الممتلئ أقل من الحد الحرج أو الاستقلالية أقل من 10 أيام. الإجراء: طلبية مستعجلة من المصنع."
                      )}
                    </p>
                  </div>

                  {/* Surveillance */}
                  <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge className="bg-amber-600 text-white font-bold text-[10px] px-2 py-0.5">
                        🟡 {tr('Surveillance', 'مراقبة')}
                      </Badge>
                      <span className="text-[11px] font-bold text-amber-700">11 - 21 {tr('jours', 'يوماً')}</span>
                    </div>
                    <p className="text-xs text-slate-700 font-medium leading-normal">
                      {tr(
                        "Niveau moyen ou en baisse. Action requise : planifier la recharge dans les tournées normales.",
                        "مستوى متوسط أو في انخفاض. الإجراء: جدولة التزويد ضمن دوريات الشحن العادية القادمة."
                      )}
                    </p>
                  </div>

                  {/* Stable */}
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge className="bg-emerald-600 text-white font-bold text-[10px] px-2 py-0.5">
                        🟢 {tr('Stable', 'مستقر')}
                      </Badge>
                      <span className="text-[11px] font-bold text-emerald-700">&gt; 21 {tr('jours', 'يوماً')}</span>
                    </div>
                    <p className="text-xs text-slate-700 font-medium leading-normal">
                      {tr(
                        "Stock suffisant et sécurisé. Aucune rupture prévisible à court terme.",
                        "مخزون وافر وآمن. لا يوجد أي خطر نفاد على المدى القريب."
                      )}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 text-xs text-slate-600 flex items-start gap-2.5">
                  <Zap className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
                  <span>
                    <strong>{tr('Astuce :', 'نصيحة :')}</strong> {tr(
                      'Cliquez directement sur n’importe quelle bouteille dans la grille pour appliquer instantanément un focus opérationnel sur celle-ci.',
                      'انقر مباشرة على أي قنينة في الخانات لتطبيق تصفية وتركيز فوري عليها في جدول المخزون.'
                    )}
                  </span>
                </div>
              </div>
            </TabsContent>

            {/* TAB 2: STOCK AUTOPILOT */}
            <TabsContent value="autopilot" className="space-y-4 m-0">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-xs">
                <div>
                  <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm">
                    <Bot className="w-4 h-4" />
                    <span>{tr('Pilote Automatique & Presets Stratégiques', 'الطيار الآلي والإعدادات التكتيكية')}</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    {tr(
                      "Le Stock Autopilot permet de reconfigurer l'ensemble des filtres et du tri de l'inventaire en 1 clic selon votre objectif métier du moment :",
                      "يتيح الطيار الآلي إعادة ضبط وترتيب كافة فلاتر المخزون بنقرة زر واحدة حسب هدفك الإداري المباشر:"
                    )}
                  </p>
                </div>

                <div className="space-y-2.5">
                  {/* Defense */}
                  <div className="flex items-start gap-3 p-3 rounded-xl border border-rose-200 bg-rose-50/50">
                    <div className="p-2 rounded-lg bg-rose-100 text-rose-700">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-rose-800">{tr('Mode Défense (Priorité Achats / Usine)', 'وضع الدفاع (أولوية المشتريات / المصنع)')}</div>
                      <div className="text-[11px] text-slate-600 mt-0.5">
                        {tr(
                          "Isole immédiatement les références en zone critique et les trie par ordre d'urgence pour préparer le bon de commande usine.",
                          "يعزل فوراً القنينات الحرجة ويرتبها حسب درجة النقص لإعداد طلبيات الشحن من المصنع."
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Rotation */}
                  <div className="flex items-start gap-3 p-3 rounded-xl border border-amber-200 bg-amber-50/50">
                    <div className="p-2 rounded-lg bg-amber-100 text-amber-700">
                      <Truck className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-amber-800">{tr('Mode Rotation (Priorité Terrain & Ventes)', 'وضع الدوران (أولوية الميدان والمبيعات)')}</div>
                      <div className="text-[11px] text-slate-600 mt-0.5">
                        {tr(
                          "Met l'accent sur les bouteilles à fort taux de circulation pour accélérer la récupération des emballages vides chez les clients.",
                          "يركز على القنينات الأكثر دوراناً وتوزيعاً لتسريع استرجاع القنينات الفارغة المتراكمة في السوق."
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Equilibre */}
                  <div className="flex items-start gap-3 p-3 rounded-xl border border-emerald-200 bg-emerald-50/50">
                    <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
                      <PackageCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-emerald-800">{tr('Mode Équilibre (Vision Globale Dépôt)', 'وضع التوازن (الرؤية العامة الشاملة)')}</div>
                      <div className="text-[11px] text-slate-600 mt-0.5">
                        {tr(
                          "Réinitialise les filtres pour afficher l'inventaire complet avec une balance équilibrée entre stock plein et parc total.",
                          "يعيد ضبط الفلاتر لعرض المخزون الكامل بتوازن شامل بين المتوفر الممتلئ وإجمالي الحظيرة."
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* TAB 3: REPLENISHMENT PLANNER */}
            <TabsContent value="planner" className="space-y-4 m-0">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-xs">
                <div>
                  <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm">
                    <Calculator className="w-4 h-4" />
                    <span>{tr('Planificateur Prédictif de Réapprovisionnement', 'المخطط التنبؤي لإعادة التموين')}</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    {tr(
                      "Le Replenishment Planner calcule scientifiquement le nombre exact d'unités à commander à l'usine pour couvrir l'horizon choisi (14j, 30j ou 60j) sans surstockage.",
                      "يحسب المخطط رياضياً العدد الدقيق للقنينات الواجب طلبها من المصنع لتغطية الأفق الزمني المختار (14 أو 30 أو 60 يوماً) دون زيادة غير مستغلة."
                    )}
                  </p>
                </div>

                {/* Formula Box */}
                <div className="rounded-xl bg-slate-900 text-white p-4 space-y-2 font-mono text-xs">
                  <div className="text-[10px] uppercase font-sans font-bold text-indigo-300">
                    {tr('📐 Formule Mathématique Appliquée :', '📐 المعادلة الرياضية المعتمدة :')}
                  </div>
                  <div className="text-sky-300 font-bold tracking-wide">
                    Refill = Buffer + (Drain Quotidien × Horizon) - Stock Plein Actuel
                  </div>
                  <div className="text-[11px] text-slate-400 font-sans leading-relaxed pt-1">
                    {tr(
                      "Où Buffer = Seuil Critique × 2 (marge de sécurité) et Drain = (Sorties 30j - Entrées 30j) / 30.",
                      "حيث مخزون الأمان = الحد الحرج × 2، ومعدل السحب اليومي = (الموزع خلال 30 يوماً - الوارد) / 30."
                    )}
                  </div>
                </div>

                {/* Metrics Breakdown */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="text-[10px] text-slate-500 font-bold uppercase">{tr('Drain / Jour', 'السحب اليومي')}</div>
                    <div className="text-xs font-bold text-slate-800 mt-0.5">{tr('Vitesse de consommation', 'معدل الاستهلاك اليومي')}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="text-[10px] text-slate-500 font-bold uppercase">{tr('Autonomie (Jours)', 'الاستقلالية (أيام)')}</div>
                    <div className="text-xs font-bold text-slate-800 mt-0.5">{tr('Stock plein / Drain', 'المخزون الممتلئ / السحب')}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200">
                    <div className="text-[10px] text-indigo-600 font-bold uppercase">{tr('Refill Recommandé', 'الكمية المطلوبة')}</div>
                    <div className="text-xs font-bold text-indigo-900 mt-0.5">{tr('Unités à commander', 'عدد القنينات للطلب')}</div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-slate-200 flex justify-end">
          <Button
            onClick={() => onOpenChange(false)}
            className="font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl"
          >
            {tr('Compris', 'حسناً، فهمت')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
