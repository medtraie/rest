import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useApp } from '@/contexts/AppContext';
import type { PermissionKey } from '@/contexts/AppContext';
import { 
  Download, 
  Upload, 
  Trash2, 
  RefreshCw, 
  ShieldAlert, 
  Database,
  History,
  Info,
  LogOut,
  Users,
  Sparkles,
  ShieldCheck,
  Gauge,
  Layers,
  Palette,
  Eye,
  EyeOff,
  Filter,
  Plus
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type NavTheme = 'indigo' | 'emerald' | 'sunset' | 'violet';

const navThemeOptions: { value: NavTheme; preview: string }[] = [
  { value: 'indigo', preview: 'from-slate-900 via-indigo-900 to-blue-700' },
  { value: 'emerald', preview: 'from-slate-900 via-emerald-800 to-cyan-700' },
  { value: 'sunset', preview: 'from-slate-900 via-orange-700 to-rose-700' },
  { value: 'violet', preview: 'from-slate-900 via-violet-800 to-fuchsia-700' },
];

const Settings = () => {
  const { 
    exportData, 
    importData, 
    clearAllData, 
    drivers,
    updateDriver,
    roles, 
    roleAssignments, 
    availablePermissions, 
    addRole, 
    updateRolePermissions, 
    assignRoleToEmail, 
    removeRoleAssignment,
    currentUserEmail,
    currentRole
  } = useApp();
  const { toast } = useToast();
  const { language } = useLanguage();
  const tr = (frText: string, arText: string) => (language === 'ar' ? arText : frText);
  const navThemeLabel = (value: NavTheme) => {
    if (value === 'indigo') return tr('Bleu Indigo', 'أزرق نيلي');
    if (value === 'emerald') return tr('Vert Émeraude', 'أخضر زمردي');
    if (value === 'sunset') return tr('Sunset Orange', 'برتقالي الغروب');
    return tr('Violet Néon', 'بنفسجي نيون');
  };
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [assignmentEmail, setAssignmentEmail] = useState("");
  const [assignmentRoleId, setAssignmentRoleId] = useState("");
  const [gpsApiUrl, setGpsApiUrl] = useState('');
  const [gpsEmail, setGpsEmail] = useState('');
  const [gpsPassword, setGpsPassword] = useState('');
  const [showGpsPassword, setShowGpsPassword] = useState(false);
  const [gpsSaving, setGpsSaving] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [navTheme, setNavTheme] = useState<NavTheme>(() => {
    if (typeof window === 'undefined') return 'indigo';
    const stored = window.localStorage.getItem('app-nav-theme');
    if (stored === 'emerald' || stored === 'sunset' || stored === 'violet' || stored === 'indigo') return stored;
    return 'indigo';
  });
  const [priceZone, setPriceZone] = useState<0 | 1>(0);
  const [pricing, setPricing] = useState<Array<{
    id?: string;
    code: string;
    designation: string;
    prix_dif: string;
    prix_def: string;
    prix_unitaire: string;
    prix_achat: string;
    zone: 0 | 1;
  }>>([]);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [pricingSaving, setPricingSaving] = useState(false);
  const [thresholdDrafts, setThresholdDrafts] = useState<Record<string, string>>({});
  const [foreignThresholdDrafts, setForeignThresholdDrafts] = useState<Record<string, string>>({});
  const [sectors, setSectors] = useState<Array<{
    id: string;
    code: string;
    secteurs: string;
    ville: string;
    region: string;
  }>>([]);
  const [sectorsLoading, setSectorsLoading] = useState(false);
  const [sectorsSaving, setSectorsSaving] = useState(false);
  const [selectedSectorId, setSelectedSectorId] = useState<string | null>(null);
  const [sectorFilterInput, setSectorFilterInput] = useState('');
  const [sectorFilter, setSectorFilter] = useState('');
  const [sectorForm, setSectorForm] = useState({
    code: '',
    secteurs: '',
    ville: '',
    region: ''
  });

  useEffect(() => {
    if (!assignmentRoleId && roles.length > 0) {
      setAssignmentRoleId(roles[0].id);
    }
  }, [assignmentRoleId, roles]);

  useEffect(() => {
    const loadGpsSettings = async () => {
      setGpsLoading(true);
      const { data } = await supabase
        .from('gps_settings')
        .select('api_url,email,password')
        .eq('id', 'default')
        .maybeSingle();
      if (data) {
        setGpsApiUrl(String(data.api_url ?? ''));
        setGpsEmail(String(data.email ?? ''));
        setGpsPassword(String(data.password ?? ''));
      }
      setGpsLoading(false);
    };
    loadGpsSettings();
  }, []);

  useEffect(() => {
    const loadPricing = async () => {
      setPricingLoading(true);
      const { data, error } = await supabase
        .from('pricing_settings')
        .select('*')
        .eq('zone', priceZone)
        .order('code', { ascending: true });
      if (error) {
        toast({ title: tr('Erreur chargement tarifs', 'خطأ في تحميل التعريفات'), description: error.message, variant: 'destructive' });
        setPricingLoading(false);
        return;
      }
      const rows = (data ?? []).map((r: any) => ({
        id: String(r.id),
        code: String(r.code ?? ''),
        designation: String(r.designation ?? ''),
        prix_dif: Number(r.prix_dif ?? 0) === 0 ? '' : String(r.prix_dif),
        prix_def: Number(r.prix_def ?? 0) === 0 ? '' : String(r.prix_def),
        prix_unitaire: Number(r.prix_unitaire ?? 0) === 0 ? '' : String(r.prix_unitaire),
        prix_achat: Number(r.prix_achat ?? 0) === 0 ? '' : String(r.prix_achat),
        zone: Number(r.zone ?? 0) as 0 | 1,
      }));
      setPricing(rows);
      setPricingLoading(false);
    };
    loadPricing();
  }, [priceZone]);

  useEffect(() => {
    const loadSectors = async () => {
      setSectorsLoading(true);
      const { data, error } = await supabase
        .from('sectors_settings')
        .select('*')
        .order('code', { ascending: true });
      if (error) {
        toast({ title: 'Erreur chargement secteurs', description: error.message, variant: 'destructive' });
        setSectorsLoading(false);
        return;
      }
      const rows = (data ?? []).map((row: any) => ({
        id: String(row.id),
        code: String(row.code ?? ''),
        secteurs: String(row.secteurs ?? ''),
        ville: String(row.ville ?? ''),
        region: String(row.region ?? '')
      }));
      setSectors(rows);
      setSectorsLoading(false);
    };
    loadSectors();
  }, []);

  const addPricingRow = () => {
    setPricing(prev => [
      ...prev,
      { code: '', designation: '', prix_dif: '', prix_def: '', prix_unitaire: '', prix_achat: '', zone: priceZone }
    ]);
  };

  useEffect(() => {
    const nextDrafts = drivers.reduce<Record<string, string>>((acc, driver) => {
      const threshold = Number(driver.debtThreshold || 0);
      acc[driver.id] = threshold > 0 ? threshold.toString() : '';
      return acc;
    }, {});
    setThresholdDrafts(nextDrafts);
  }, [drivers]);
  useEffect(() => {
    const nextDrafts = drivers.reduce<Record<string, string>>((acc, driver) => {
      const threshold = Number(driver.foreignBottlesThreshold || 0);
      acc[driver.id] = threshold > 0 ? threshold.toString() : '';
      return acc;
    }, {});
    setForeignThresholdDrafts(nextDrafts);
  }, [drivers]);

  const updateRowField = (index: number, field: keyof (typeof pricing)[number], value: string) => {
    setPricing(prev => {
      const next = [...prev];
      const row = { ...next[index] };
      (row as any)[field] = value;
      next[index] = row;
      return next;
    });
  };

  const saveRow = async (index: number) => {
    const row = pricing[index];
    const parsePrice = (value: string) => {
      const normalized = value.trim();
      if (!normalized) return null;
      const parsed = Number(normalized);
      return Number.isFinite(parsed) ? parsed : null;
    };
    const payload = {
      id: row.id,
      code: row.code?.trim() || null,
      designation: row.designation?.trim() || null,
      prix_dif: parsePrice(row.prix_dif),
      prix_def: parsePrice(row.prix_def),
      prix_unitaire: parsePrice(row.prix_unitaire),
      prix_achat: parsePrice(row.prix_achat),
      zone: row.zone,
      updated_at: new Date().toISOString()
    };
    setPricingSaving(true);
    const { data, error } = await supabase.from('pricing_settings').upsert(payload, { onConflict: 'id' }).select().maybeSingle();
    setPricingSaving(false);
    if (error) {
      toast({ title: tr('Échec de sauvegarde', 'فشل الحفظ'), description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: tr('Tarif enregistré', 'تم حفظ التسعيرة') });
    if (data) {
      setPricing(prev => {
        const next = [...prev];
        next[index] = { ...row, id: String(data.id) };
        return next;
      });
    }
  };

  const saveDriverThreshold = async (driverId: string) => {
    const raw = (thresholdDrafts[driverId] || '').trim();
    const threshold = raw === '' ? 0 : Math.max(0, Number(raw) || 0);
    await updateDriver(driverId, { debtThreshold: threshold });
    toast({
      title: tr('Seuil enregistré', 'تم حفظ السقف'),
      description: tr('Le seuil de dette du chauffeur a été mis à jour.', 'تم تحديث سقف الدين للسائق.')
    });
  };
  const saveDriverForeignThreshold = async (driverId: string) => {
    const raw = (foreignThresholdDrafts[driverId] || '').trim();
    const threshold = raw === '' ? 0 : Math.max(0, Number(raw) || 0);
    await updateDriver(driverId, { foreignBottlesThreshold: threshold });
    toast({
      title: 'Seuil enregistré',
      description: 'Le seuil des bouteilles étrangères du chauffeur a été mis à jour.'
    });
  };

  const displayedSectors = React.useMemo(() => {
    const keyword = sectorFilter.trim().toLowerCase();
    if (!keyword) return sectors;
    return sectors.filter((row) =>
      row.code.toLowerCase().includes(keyword) ||
      row.secteurs.toLowerCase().includes(keyword) ||
      row.ville.toLowerCase().includes(keyword) ||
      row.region.toLowerCase().includes(keyword)
    );
  }, [sectors, sectorFilter]);

  const clearSectorForm = () => {
    setSelectedSectorId(null);
    setSectorForm({ code: '', secteurs: '', ville: '', region: '' });
  };

  const handleSectorFilter = () => {
    setSectorFilter(sectorFilterInput.trim());
  };

  const handleSectorConsult = () => {
    if (!selectedSectorId) {
      toast({ title: 'Sélection requise', description: 'Veuillez sélectionner un secteur.', variant: 'destructive' });
      return;
    }
    const selected = sectors.find((row) => row.id === selectedSectorId);
    if (!selected) return;
    setSectorForm({
      code: selected.code,
      secteurs: selected.secteurs,
      ville: selected.ville,
      region: selected.region
    });
    toast({ title: 'Secteur chargé', description: `Code ${selected.code || '-'}` });
  };

  const handleSectorAdd = async () => {
    const payload = {
      code: sectorForm.code.trim() || null,
      secteurs: sectorForm.secteurs.trim() || null,
      ville: sectorForm.ville.trim() || null,
      region: sectorForm.region.trim() || null,
      updated_at: new Date().toISOString()
    };
    if (!payload.code && !payload.secteurs && !payload.ville && !payload.region) {
      toast({ title: 'Aucune donnée', description: 'Veuillez remplir au moins un champ.', variant: 'destructive' });
      return;
    }
    setSectorsSaving(true);
    const { data, error } = await supabase.from('sectors_settings').insert(payload).select().single();
    setSectorsSaving(false);
    if (error) {
      toast({ title: 'Échec ajout secteur', description: error.message, variant: 'destructive' });
      return;
    }
    const created = {
      id: String((data as any).id),
      code: String((data as any).code ?? ''),
      secteurs: String((data as any).secteurs ?? ''),
      ville: String((data as any).ville ?? ''),
      region: String((data as any).region ?? '')
    };
    setSectors((prev) => [created, ...prev]);
    setSelectedSectorId(created.id);
    setSectorForm({
      code: created.code,
      secteurs: created.secteurs,
      ville: created.ville,
      region: created.region
    });
    toast({ title: 'Secteur ajouté' });
  };

  const handleSectorUpdate = async () => {
    if (!selectedSectorId) {
      toast({ title: 'Sélection requise', description: 'Veuillez choisir une ligne à modifier.', variant: 'destructive' });
      return;
    }
    const payload = {
      code: sectorForm.code.trim() || null,
      secteurs: sectorForm.secteurs.trim() || null,
      ville: sectorForm.ville.trim() || null,
      region: sectorForm.region.trim() || null,
      updated_at: new Date().toISOString()
    };
    setSectorsSaving(true);
    const { data, error } = await supabase
      .from('sectors_settings')
      .update(payload)
      .eq('id', selectedSectorId)
      .select()
      .single();
    setSectorsSaving(false);
    if (error) {
      toast({ title: 'Échec modification', description: error.message, variant: 'destructive' });
      return;
    }
    const updated = {
      id: String((data as any).id),
      code: String((data as any).code ?? ''),
      secteurs: String((data as any).secteurs ?? ''),
      ville: String((data as any).ville ?? ''),
      region: String((data as any).region ?? '')
    };
    setSectors((prev) => prev.map((row) => (row.id === selectedSectorId ? updated : row)));
    setSectorForm({
      code: updated.code,
      secteurs: updated.secteurs,
      ville: updated.ville,
      region: updated.region
    });
    toast({ title: 'Secteur modifié' });
  };

  const handleSectorDelete = async () => {
    if (!selectedSectorId) {
      toast({ title: 'Sélection requise', description: 'Veuillez choisir une ligne à supprimer.', variant: 'destructive' });
      return;
    }
    setSectorsSaving(true);
    const { error } = await supabase.from('sectors_settings').delete().eq('id', selectedSectorId);
    setSectorsSaving(false);
    if (error) {
      toast({ title: 'Échec suppression', description: error.message, variant: 'destructive' });
      return;
    }
    setSectors((prev) => prev.filter((row) => row.id !== selectedSectorId));
    clearSectorForm();
    toast({ title: 'Secteur supprimé' });
  };

  const handleImport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFile) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      importData(content);
    };
    reader.readAsText(importFile);
  };

  const handleUpdate = () => {
    setIsUpdating(true);
    // Simulate update check and refresh
    setTimeout(() => {
      window.location.reload();
      setIsUpdating(false);
    }, 1500);
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: tr("Échec de déconnexion", "فشل تسجيل الخروج"),
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    toast({
      title: tr("Déconnecté", "تم تسجيل الخروج"),
      description: tr("À bientôt.", "إلى اللقاء."),
    });
  };

  const handleAddRole = () => {
    const name = newRoleName.trim();
    if (!name) {
      toast({
        title: tr("Nom requis", "الاسم مطلوب"),
        description: tr("Veuillez saisir le nom du rôle.", "يرجى إدخال اسم الدور."),
        variant: "destructive",
      });
      return;
    }
    addRole(name);
    setNewRoleName("");
    toast({ title: tr("Rôle ajouté", "تمت إضافة الدور"), description: name });
  };

  const handleAssignRole = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignmentEmail.trim() || !assignmentRoleId) {
      toast({
        title: tr("Données manquantes", "بيانات ناقصة"),
        description: tr("Veuillez saisir un email et choisir un rôle.", "يرجى إدخال بريد إلكتروني واختيار دور."),
        variant: "destructive",
      });
      return;
    }
    assignRoleToEmail(assignmentEmail, assignmentRoleId);
    setAssignmentEmail("");
    toast({ title: tr("Rôle assigné", "تم إسناد الدور"), description: assignmentEmail });
  };

  const applyNavTheme = (theme: NavTheme) => {
    setNavTheme(theme);
    document.documentElement.setAttribute('data-nav-theme', theme);
    window.localStorage.setItem('app-nav-theme', theme);
    window.dispatchEvent(new CustomEvent('app-nav-theme-change', { detail: theme }));
    toast({ title: tr("Navigation mise à jour", "تم تحديث التنقل"), description: tr("Nouveau dégradé appliqué.", "تم تطبيق تدرج جديد.") });
  };

  const saveGpsSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const api = gpsApiUrl.trim();
    const email = gpsEmail.trim();
    const password = gpsPassword.trim();
    if (!api || !email || !password) {
      toast({
        title: tr('Données manquantes', 'بيانات ناقصة'),
        description: tr('Veuillez renseigner API URL, Email et Password.', 'يرجى إدخال رابط API والبريد الإلكتروني وكلمة المرور.'),
        variant: 'destructive',
      });
      return;
    }
    setGpsSaving(true);
    const { error } = await supabase.from('gps_settings').upsert(
      { id: 'default', api_url: api, email, password, updated_at: new Date().toISOString() },
      { onConflict: 'id' }
    );
    setGpsSaving(false);
    if (error) {
      toast({
        title: tr('Échec de sauvegarde', 'فشل الحفظ'),
        description: error.message,
        variant: 'destructive',
      });
      return;
    }
    toast({
      title: tr('Paramètres GPS enregistrés', 'تم حفظ إعدادات GPS'),
      description: tr('Les identifiants seront utilisés automatiquement par le suivi.', 'سيتم استخدام بيانات الدخول تلقائيًا من طرف التتبع.'),
    });
  };

  const totalRoles = roles.length;
  const totalAssignments = roleAssignments.length;
  const myAssignments = currentUserEmail
    ? roleAssignments.filter((assignment) => assignment.email.toLowerCase() === currentUserEmail.toLowerCase()).length
    : 0;

  return (
    <div className="app-page-shell min-h-screen bg-slate-950 p-6 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-6">
        <Card className="border-slate-800 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900">
          <CardContent className="p-6 md:p-8">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge className="bg-indigo-100 text-indigo-800 border-indigo-200" variant="outline">
                    <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                    {tr('Settings Studio', 'استوديو الإعدادات')}
                  </Badge>
                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200" variant="outline">
                    <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />
                    {tr('Système sécurisé', 'نظام آمن')}
                  </Badge>
                </div>
                <div>
                  <h1 className="app-page-title text-3xl md:text-4xl font-black tracking-tight">{tr('Paramètres', 'الإعدادات')}</h1>
                  <p className="app-page-subtitle mt-1 text-slate-200">{tr('Pilotage créatif des données, accès et sécurité sans changer le comportement métier.', 'قيادة ذكية للبيانات والصلاحيات والأمان دون تغيير منطق العمل.')}</p>
                </div>
                {currentUserEmail && currentRole && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="bg-slate-900/80 text-slate-200 border-slate-700">
                      {currentUserEmail}
                    </Badge>
                    <Badge className="bg-cyan-100 text-cyan-800 border-cyan-200" variant="outline">
                      {tr('Rôle', 'الدور')}: {currentRole.name}
                    </Badge>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 w-full xl:w-[360px]">
                <div className="app-panel-soft rounded-xl border border-slate-700 bg-slate-900/70 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-slate-300">{tr('Rôles', 'الأدوار')}</p>
                  <p className="text-xl font-black">{totalRoles}</p>
                </div>
                <div className="app-panel-soft rounded-xl border border-slate-700 bg-slate-900/70 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-slate-300">{tr('Assignations', 'الإسنادات')}</p>
                  <p className="text-xl font-black">{totalAssignments}</p>
                </div>
                <div className="app-panel-soft rounded-xl border border-slate-700 bg-slate-900/70 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-slate-300">{tr('Mes accès', 'صلاحياتي')}</p>
                  <p className="text-xl font-black">{myAssignments}</p>
                </div>
                <Button
                  variant="outline"
                  onClick={handleLogout}
                  className="h-full border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  {tr('Se déconnecter', 'تسجيل الخروج')}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="operations" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 border border-slate-700 bg-slate-900/90">
            <TabsTrigger value="operations" className="text-slate-200 hover:text-white data-[state=active]:bg-slate-700 data-[state=active]:text-white">
              {tr('Opérations', 'العمليات')}
            </TabsTrigger>
            <TabsTrigger value="security" className="text-slate-200 hover:text-white data-[state=active]:bg-slate-700 data-[state=active]:text-white">
              {tr('Sécurité & Accès', 'الأمان والصلاحيات')}
            </TabsTrigger>
            <TabsTrigger value="system" className="text-slate-200 hover:text-white data-[state=active]:bg-slate-700 data-[state=active]:text-white">
              {tr('Système', 'النظام')}
            </TabsTrigger>
            <TabsTrigger value="pricing" className="text-slate-200 hover:text-white data-[state=active]:bg-slate-700 data-[state=active]:text-white">
              Paramétrage
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pricing" className="space-y-6 m-0">
            <Card className="border-slate-800 bg-slate-900/60">
              <CardHeader className="border-b border-slate-800">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-slate-100">Paramétrage Tarifs</CardTitle>
                    <CardDescription className="text-slate-300">
                      Tarifs par zone. Basculez entre Zone 0 et Zone 1 et éditez directement.
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant={priceZone === 0 ? 'default' : 'outline'} onClick={() => setPriceZone(0)} className={priceZone === 0 ? 'bg-indigo-600' : ''}>
                      Zone 0
                    </Button>
                    <Button variant={priceZone === 1 ? 'default' : 'outline'} onClick={() => setPriceZone(1)} className={priceZone === 1 ? 'bg-indigo-600' : ''}>
                      Zone 1
                    </Button>
                    <Button onClick={addPricingRow} className="bg-emerald-600 hover:bg-emerald-700">
                      + Ajouter
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="rounded-xl border border-slate-700 overflow-hidden">
                  <Table>
                    <TableHeader className="bg-slate-800/60">
                      <TableRow>
                        <TableHead className="text-slate-200">Code</TableHead>
                        <TableHead className="text-slate-200">Désignation</TableHead>
                        <TableHead className="text-slate-200">Prix DIF</TableHead>
                        <TableHead className="text-slate-200">Prix DEF</TableHead>
                        <TableHead className="text-slate-200">Prix Unitaire</TableHead>
                        <TableHead className="text-slate-200">Prix d'achat</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pricingLoading ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-slate-300 py-6">
                            Chargement...
                          </TableCell>
                        </TableRow>
                      ) : pricing.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-slate-400 py-6">
                            Aucune ligne. Cliquez sur Ajouter.
                          </TableCell>
                        </TableRow>
                      ) : (
                        pricing.map((row, idx) => (
                          <TableRow key={row.id ?? `tmp-${idx}`}>
                            <TableCell>
                              <Input
                                value={row.code}
                                onChange={(e) => updateRowField(idx, 'code', e.target.value)}
                                className="border-slate-700 bg-slate-950 text-slate-100"
                                placeholder="6003"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                value={row.designation}
                                onChange={(e) => updateRowField(idx, 'designation', e.target.value)}
                                className="border-slate-700 bg-slate-950 text-slate-100"
                                placeholder="TISSIR BNG 12KG"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                value={row.prix_dif}
                                onChange={(e) => updateRowField(idx, 'prix_dif', e.target.value)}
                                className="border-slate-700 bg-slate-950 text-slate-100"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                value={row.prix_def}
                                onChange={(e) => updateRowField(idx, 'prix_def', e.target.value)}
                                className="border-slate-700 bg-slate-950 text-slate-100"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                value={row.prix_unitaire}
                                onChange={(e) => updateRowField(idx, 'prix_unitaire', e.target.value)}
                                className="border-slate-700 bg-slate-950 text-slate-100"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                value={row.prix_achat}
                                onChange={(e) => updateRowField(idx, 'prix_achat', e.target.value)}
                                className="border-slate-700 bg-slate-950 text-slate-100"
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                onClick={() => saveRow(idx)}
                                disabled={pricingSaving}
                                className="bg-indigo-600 hover:bg-indigo-700"
                              >
                                {pricingSaving ? 'Sauvegarde...' : 'Enregistrer'}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-800 bg-slate-900/60">
              <CardHeader className="border-b border-slate-800">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-slate-100">Liste des secteurs</CardTitle>
                    <CardDescription className="text-slate-300">
                      Gestion des secteurs avec consultation, ajout, modification, suppression et filtre.
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="bg-slate-900 text-slate-200 border-slate-700">
                    {displayedSectors.length} lignes
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="grid gap-3 md:grid-cols-5">
                  <div className="space-y-1 md:col-span-1">
                    <Label className="text-slate-200">Code</Label>
                    <Input
                      value={sectorForm.code}
                      onChange={(e) => setSectorForm((prev) => ({ ...prev, code: e.target.value }))}
                      placeholder="Ex: S210"
                      className="border-slate-700 bg-slate-950 text-slate-100"
                    />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <Label className="text-slate-200">Secteurs</Label>
                    <Input
                      value={sectorForm.secteurs}
                      onChange={(e) => setSectorForm((prev) => ({ ...prev, secteurs: e.target.value }))}
                      placeholder="Ex: OULED SAID"
                      className="border-slate-700 bg-slate-950 text-slate-100"
                    />
                  </div>
                  <div className="space-y-1 md:col-span-1">
                    <Label className="text-slate-200">Ville</Label>
                    <Input
                      value={sectorForm.ville}
                      onChange={(e) => setSectorForm((prev) => ({ ...prev, ville: e.target.value }))}
                      placeholder="Ex: BENI MELLAL"
                      className="border-slate-700 bg-slate-950 text-slate-100"
                    />
                  </div>
                  <div className="space-y-1 md:col-span-1">
                    <Label className="text-slate-200">Région</Label>
                    <Input
                      value={sectorForm.region}
                      onChange={(e) => setSectorForm((prev) => ({ ...prev, region: e.target.value }))}
                      placeholder="Ex: 200"
                      className="border-slate-700 bg-slate-950 text-slate-100"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-end gap-2">
                  <div className="w-full md:w-[320px] space-y-1">
                    <Label className="text-slate-200">Filtre</Label>
                    <Input
                      value={sectorFilterInput}
                      onChange={(e) => setSectorFilterInput(e.target.value)}
                      placeholder="Code, secteur, ville ou région"
                      className="border-slate-700 bg-slate-950 text-slate-100"
                    />
                  </div>
                  <Button onClick={handleSectorFilter} className="bg-cyan-600 hover:bg-cyan-700">
                    <Filter className="w-4 h-4 mr-1.5" />
                    Filtre
                  </Button>
                  <Button
                    variant="outline"
                    className="border-slate-700 text-slate-200 hover:bg-slate-800"
                    onClick={() => {
                      setSectorFilter('');
                      setSectorFilterInput('');
                    }}
                  >
                    Réinitialiser
                  </Button>
                  <div className="ml-auto flex flex-wrap gap-2">
                    <Button
                      onClick={handleSectorConsult}
                      variant="outline"
                      className="border-slate-700 text-slate-200 hover:bg-slate-800"
                    >
                      Consulter
                    </Button>
                    <Button onClick={handleSectorAdd} disabled={sectorsSaving} className="bg-emerald-600 hover:bg-emerald-700">
                      <Plus className="w-4 h-4 mr-1.5" />
                      Ajouter
                    </Button>
                    <Button onClick={handleSectorUpdate} disabled={sectorsSaving} className="bg-indigo-600 hover:bg-indigo-700">
                      Modifier
                    </Button>
                    <Button onClick={handleSectorDelete} disabled={sectorsSaving} variant="destructive">
                      Supprimer
                    </Button>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-700 overflow-hidden">
                  <Table>
                    <TableHeader className="bg-slate-800/60">
                      <TableRow>
                        <TableHead className="text-slate-200">Code</TableHead>
                        <TableHead className="text-slate-200">Secteurs</TableHead>
                        <TableHead className="text-slate-200">Ville</TableHead>
                        <TableHead className="text-slate-200">Région</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sectorsLoading ? (
                        <TableRow>
                          <TableCell colSpan={4} className="py-6 text-center text-slate-300">
                            Chargement...
                          </TableCell>
                        </TableRow>
                      ) : displayedSectors.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="py-6 text-center text-slate-400">
                            Aucune ligne secteur.
                          </TableCell>
                        </TableRow>
                      ) : (
                        displayedSectors.map((row) => (
                          <TableRow
                            key={row.id}
                            className={`cursor-pointer ${selectedSectorId === row.id ? 'bg-indigo-500/20 hover:bg-indigo-500/20' : 'hover:bg-slate-800/40'}`}
                            onClick={() => {
                              setSelectedSectorId(row.id);
                              setSectorForm({
                                code: row.code,
                                secteurs: row.secteurs,
                                ville: row.ville,
                                region: row.region
                              });
                            }}
                          >
                            <TableCell className="text-slate-100 font-medium">{row.code || '-'}</TableCell>
                            <TableCell className="text-slate-100">{row.secteurs || '-'}</TableCell>
                            <TableCell className="text-slate-200">{row.ville || '-'}</TableCell>
                            <TableCell className="text-slate-200">{row.region || '-'}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-800 bg-slate-900/60">
              <CardHeader className="border-b border-slate-800">
                <CardTitle className="text-slate-100">Seuil de Dette par Chauffeur</CardTitle>
                <CardDescription className="text-slate-300">
                  Dès que la dette actuelle dépasse le seuil, le chauffeur passe en état clôture automatiquement.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="rounded-xl border border-slate-700 overflow-hidden">
                  <Table>
                    <TableHeader className="bg-slate-800/60">
                      <TableRow>
                        <TableHead className="text-slate-200">Chauffeur</TableHead>
                        <TableHead className="text-slate-200">Dette Actuelle</TableHead>
                        <TableHead className="text-slate-200">Seuil</TableHead>
                        <TableHead className="text-slate-200">État</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {drivers.map((driver) => {
                        const debt = Number(driver.debt || 0);
                        const threshold = Number(driver.debtThreshold || 0);
                        const isClosed = threshold > 0 && debt >= threshold;
                        return (
                          <TableRow key={driver.id}>
                            <TableCell className="font-medium text-slate-100">{driver.name}</TableCell>
                            <TableCell className={debt > 0 ? 'text-rose-300' : 'text-emerald-300'}>
                              {debt.toLocaleString()} DH
                            </TableCell>
                            <TableCell className="w-[180px]">
                              <Input
                                type="number"
                                min="0"
                                value={thresholdDrafts[driver.id] ?? ''}
                                onChange={(e) => setThresholdDrafts((prev) => ({ ...prev, [driver.id]: e.target.value }))}
                                placeholder="Ex: 5000"
                                className="border-slate-700 bg-slate-950 text-slate-100"
                              />
                            </TableCell>
                            <TableCell>
                              <Badge className={isClosed ? 'bg-rose-100 text-rose-800 border-rose-200' : 'bg-emerald-100 text-emerald-800 border-emerald-200'} variant="outline">
                                {isClosed ? 'Clôture' : 'Ouvert'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button onClick={() => saveDriverThreshold(driver.id)} className="bg-indigo-600 hover:bg-indigo-700">
                                Enregistrer
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-800 bg-slate-900/60">
              <CardHeader className="border-b border-slate-800">
                <CardTitle className="text-slate-100">Seuil de Bouteilles Étrangères par Chauffeur</CardTitle>
                <CardDescription className="text-slate-300">
                  Si le total des bouteilles étrangères dépasse le seuil, le chauffeur devient indisponible automatiquement.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="rounded-xl border border-slate-700 overflow-hidden">
                  <Table>
                    <TableHeader className="bg-slate-800/60">
                      <TableRow>
                        <TableHead className="text-slate-200">Chauffeur</TableHead>
                        <TableHead className="text-slate-200">Étrangères Actuelles</TableHead>
                        <TableHead className="text-slate-200">Seuil</TableHead>
                        <TableHead className="text-slate-200">État</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {drivers.map((driver) => {
                        const totalForeign = Number(driver.totalForeignBottles || 0);
                        const threshold = Number(driver.foreignBottlesThreshold || 0);
                        const isClosed = threshold > 0 && totalForeign >= threshold;
                        return (
                          <TableRow key={`foreign-${driver.id}`}>
                            <TableCell className="font-medium text-slate-100">{driver.name}</TableCell>
                            <TableCell className={totalForeign > 0 ? 'text-amber-300' : 'text-emerald-300'}>
                              {totalForeign.toLocaleString()} bouteilles
                            </TableCell>
                            <TableCell className="w-[180px]">
                              <Input
                                type="number"
                                min="0"
                                value={foreignThresholdDrafts[driver.id] ?? ''}
                                onChange={(e) => setForeignThresholdDrafts((prev) => ({ ...prev, [driver.id]: e.target.value }))}
                                placeholder="Ex: 60"
                                className="border-slate-700 bg-slate-950 text-slate-100"
                              />
                            </TableCell>
                            <TableCell>
                              <Badge className={isClosed ? 'bg-rose-100 text-rose-800 border-rose-200' : 'bg-emerald-100 text-emerald-800 border-emerald-200'} variant="outline">
                                {isClosed ? 'Clôture' : 'Ouvert'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button onClick={() => saveDriverForeignThreshold(driver.id)} className="bg-indigo-600 hover:bg-indigo-700">
                                Enregistrer
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="operations" className="space-y-6 m-0">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="border-slate-800 bg-slate-900/60">
                <CardHeader className="border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/20 rounded-lg text-blue-300">
                      <Download className="w-5 h-5" />
                    </div>
                    <div>
                      <CardTitle className="text-slate-100">{tr('Sauvegarde & Export', 'النسخ الاحتياطي والتصدير')}</CardTitle>
                      <CardDescription className="text-slate-300">{tr('Téléchargez une copie intégrale des données', 'حمّل نسخة كاملة من البيانات')}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  <div className="rounded-xl border border-slate-700 bg-slate-900 p-3 text-sm text-slate-200">
                    {tr('Sauvegarde recommandée avant toute modification majeure.', 'يُنصح بالنسخ الاحتياطي قبل أي تعديل كبير.')}
                  </div>
                  <Button onClick={exportData} className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold">
                    <Download className="w-4 h-4 mr-2" />
                    {tr('Télécharger le Backup (JSON)', 'تنزيل النسخة الاحتياطية (JSON)')}
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-slate-800 bg-slate-900/60">
                <CardHeader className="border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-300">
                      <Upload className="w-5 h-5" />
                    </div>
                    <div>
                      <CardTitle className="text-slate-100">{tr('Restauration', 'الاسترجاع')}</CardTitle>
                      <CardDescription className="text-slate-300">{tr('Importez vos données depuis un backup JSON', 'استورد بياناتك من نسخة JSON احتياطية')}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  <form onSubmit={handleImport} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="backup-file" className="text-slate-100">{tr('Fichier Backup (.json)', 'ملف النسخة الاحتياطية (.json)')}</Label>
                      <Input
                        id="backup-file"
                        type="file"
                        accept=".json"
                        onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                        className="cursor-pointer border-slate-700 bg-slate-950 text-slate-100 file:mr-3 file:rounded-md file:border-0 file:bg-slate-800 file:px-3 file:py-1.5 file:text-slate-100"
                      />
                    </div>
                    <Button
                      type="submit"
                      disabled={!importFile}
                      className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-bold disabled:opacity-50"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {tr('Restaurer les données', 'استرجاع البيانات')}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>

            <Card className="border-rose-900/60 bg-rose-950/30">
              <CardHeader className="border-b border-rose-900/60">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-rose-500/20 rounded-lg text-rose-300">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle className="text-rose-100">{tr('Zone de Danger', 'منطقة الخطر')}</CardTitle>
                    <CardDescription className="text-rose-300">{tr('Action irréversible sur le stockage local', 'إجراء غير قابل للتراجع على التخزين المحلي')}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="rounded-xl border border-rose-900/70 bg-rose-950/40 p-3 text-sm text-rose-200">
                  {tr('La suppression complète efface définitivement toutes les données locales.', 'الحذف الكامل يمسح كل البيانات المحلية نهائيًا.')}
                </div>
                <Button onClick={clearAllData} variant="destructive" className="w-full h-12 font-bold">
                  <Trash2 className="w-4 h-4 mr-2" />
                  {tr('Tout supprimer (Réinitialiser)', 'حذف الكل (إعادة تهيئة)')}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="space-y-6 m-0">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="border-slate-800 bg-slate-900/60">
                <CardHeader className="border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-700/60 rounded-lg text-slate-200">
                      <Database className="w-5 h-5" />
                    </div>
                    <div>
                      <CardTitle className="text-slate-100">{tr('Rôles & Autorisations', 'الأدوار والصلاحيات')}</CardTitle>
                      <CardDescription className="text-slate-300">{tr('Gestion précise des permissions', 'إدارة دقيقة للصلاحيات')}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-5">
                  <div className="flex flex-col md:flex-row gap-3">
                      <Input
                      placeholder={tr('Nom du rôle', 'اسم الدور')}
                      value={newRoleName}
                      onChange={(e) => setNewRoleName(e.target.value)}
                        className="border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-500"
                    />
                    <Button onClick={handleAddRole} className="md:w-40 bg-slate-100 text-slate-900 hover:bg-white">
                      {tr('Ajouter', 'إضافة')}
                    </Button>
                  </div>
                  <div className="space-y-4">
                    {roles.map((role) => {
                      const isAll = role.permissions.includes("*");
                      const rolePermissions = isAll
                        ? []
                        : role.permissions.filter((perm): perm is PermissionKey => perm !== "*");
                      return (
                        <div key={role.id} className="rounded-xl border border-slate-700 bg-slate-900 p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="font-semibold text-slate-100">{role.name}</div>
                            {isAll && <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200" variant="outline">{tr('Accès total', 'صلاحية كاملة')}</Badge>}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {availablePermissions.map((perm) => (
                              <label key={perm.key} className="flex items-center gap-2 text-sm text-slate-200">
                                <Checkbox
                                  checked={isAll ? true : rolePermissions.includes(perm.key)}
                                  disabled={isAll}
                                  onCheckedChange={(checked) => {
                                    if (isAll) return;
                                    const next = checked
                                      ? [...rolePermissions, perm.key]
                                      : rolePermissions.filter((p: string) => p !== perm.key);
                                    updateRolePermissions(role.id, next);
                                  }}
                                />
                                {perm.label}
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-800 bg-slate-900/60">
                <CardHeader className="border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-300">
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                      <CardTitle className="text-slate-100">{tr('Assignation des profils', 'إسناد الملفات الشخصية')}</CardTitle>
                      <CardDescription className="text-slate-300">{tr('Associez un email à un rôle', 'اربط بريدًا إلكترونيًا بدور')}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  <form onSubmit={handleAssignRole} className="space-y-3">
                    <div className="space-y-2">
                      <Label className="text-slate-100">{tr('Email', 'البريد الإلكتروني')}</Label>
                      <Input
                        type="email"
                        placeholder={tr('utilisateur@entreprise.com', 'utilisateur@entreprise.com')}
                        value={assignmentEmail}
                        onChange={(e) => setAssignmentEmail(e.target.value)}
                        className="border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-100">{tr('Rôle', 'الدور')}</Label>
                      <Select value={assignmentRoleId} onValueChange={setAssignmentRoleId}>
                        <SelectTrigger className="border-slate-700 bg-slate-950 text-slate-100 focus:ring-2 focus:ring-indigo-400/60">
                          <SelectValue placeholder={tr('Choisir un rôle', 'اختر دورًا')} />
                        </SelectTrigger>
                        <SelectContent className="border-slate-700 bg-slate-900 text-slate-100">
                          {roles.map((role) => (
                            <SelectItem key={role.id} value={role.id} className="focus:bg-slate-800 focus:text-slate-100">
                              {role.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white">
                      {tr('Assigner', 'إسناد')}
                    </Button>
                  </form>
                  <div className="space-y-2">
                    {roleAssignments.length === 0 ? (
                      <div className="text-sm text-slate-300">{tr('Aucune assignation', 'لا توجد إسنادات')}</div>
                    ) : (
                      roleAssignments.map((assignment) => {
                        const role = roles.find(r => r.id === assignment.roleId);
                        const isCurrent = currentUserEmail?.toLowerCase() === assignment.email.toLowerCase();
                        return (
                          <div key={assignment.id} className="flex items-center justify-between border border-slate-700 rounded-lg p-3 bg-slate-900">
                            <div className="flex flex-col">
                              <div className="font-medium text-slate-100">{assignment.email}</div>
                              <div className="text-xs text-slate-300">{role?.name ?? tr('Rôle inconnu', 'دور غير معروف')}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              {isCurrent && (
                                <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-200">{tr('Vous', 'أنت')}</Badge>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-slate-400 hover:text-red-500 hover:bg-red-500/10"
                                onClick={() => removeRoleAssignment(assignment.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="system" className="space-y-6 m-0">
            <Card className="border-slate-800 bg-slate-900/60">
              <CardHeader className="border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-violet-500/20 p-2 text-violet-300">
                    <Palette className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle className="text-slate-100">{tr('Thème Navigation', 'سمة التنقل')}</CardTitle>
                    <CardDescription className="text-slate-300">{tr('Choisissez la couleur dégradée de la barre latérale', 'اختر لون التدرج للشريط الجانبي')}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                <div className="space-y-2">
                  <Label className="text-slate-100">{tr('Couleur', 'اللون')}</Label>
                  <Select value={navTheme} onValueChange={(value) => applyNavTheme(value as NavTheme)}>
                    <SelectTrigger className="border-slate-700 bg-slate-950 text-slate-100 focus:ring-2 focus:ring-violet-400/60">
                      <SelectValue placeholder={tr('Choisir un thème', 'اختر سمة')} />
                    </SelectTrigger>
                    <SelectContent className="border-slate-700 bg-slate-900 text-slate-100">
                      {navThemeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value} className="focus:bg-slate-800 focus:text-slate-100">
                          {navThemeLabel(option.value)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className={`h-14 w-full rounded-xl border border-slate-700 bg-gradient-to-r ${navThemeOptions.find(option => option.value === navTheme)?.preview ?? navThemeOptions[0].preview}`} />
              </CardContent>
            </Card>

            <Card className="border-slate-800 bg-slate-900/60">
              <CardHeader className="border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-cyan-500/20 p-2 text-cyan-300">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle className="text-slate-100">{tr('Compte GPS Tracking', 'حساب تتبع GPS')}</CardTitle>
                    <CardDescription className="text-slate-300">{tr('Configuration utilisée automatiquement par la carte live', 'إعدادات تُستخدم تلقائيًا من طرف الخريطة المباشرة')}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <form onSubmit={saveGpsSettings} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-slate-100">API URL</Label>
                    <Input
                      value={gpsApiUrl}
                      onChange={(e) => setGpsApiUrl(e.target.value)}
                      placeholder={tr('https://serveur-tracking.com/api', 'https://serveur-tracking.com/api')}
                      className="border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-100">Email</Label>
                    <Input
                      type="email"
                      value={gpsEmail}
                      onChange={(e) => setGpsEmail(e.target.value)}
                      placeholder={tr('tracking@entreprise.com', 'tracking@entreprise.com')}
                      className="border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-100">{tr('Password', 'كلمة المرور')}</Label>
                    <div className="relative">
                      <Input
                        type={showGpsPassword ? 'text' : 'password'}
                        value={gpsPassword}
                        onChange={(e) => setGpsPassword(e.target.value)}
                        placeholder={tr('Mot de passe', 'كلمة المرور')}
                        className="border-slate-700 bg-slate-950 pr-11 text-slate-100 placeholder:text-slate-500"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 text-slate-300 hover:bg-slate-800 hover:text-white"
                        onClick={() => setShowGpsPassword((v) => !v)}
                      >
                        {showGpsPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-700 bg-slate-900 p-3 text-sm text-slate-300">
                    {tr("Si aucun enregistrement n'existe en base, le suivi utilise la configuration par défaut.", 'إذا لم توجد إعدادات محفوظة في قاعدة البيانات، يتم استخدام الإعدادات الافتراضية تلقائيًا.')}
                  </div>
                  <Button disabled={gpsSaving || gpsLoading} type="submit" className="w-full h-12 bg-cyan-600 hover:bg-cyan-700 text-white font-bold disabled:opacity-60">
                    <Database className="w-4 h-4 mr-2" />
                    {gpsSaving ? tr('Sauvegarde...', 'جارٍ الحفظ...') : tr('Enregistrer les paramètres GPS', 'حفظ إعدادات GPS')}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <div className="grid gap-6 md:grid-cols-3">
              <Card className="border-slate-800 bg-slate-900/60">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base text-slate-100">
                    <Gauge className="w-4 h-4 text-cyan-300" />
                    {tr('Santé système', 'صحة النظام')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="rounded-lg border border-emerald-700/60 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-200">
                    {tr('Tous les services critiques sont opérationnels.', 'جميع الخدمات الحرجة تعمل بشكل طبيعي.')}
                  </div>
                </CardContent>
              </Card>
              <Card className="border-slate-800 bg-slate-900/60">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base text-slate-100">
                    <Layers className="w-4 h-4 text-indigo-300" />
                    {tr('Version active', 'الإصدار النشط')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-900 px-3 py-2">
                    <span className="text-sm text-slate-300">{tr('Build actuelle', 'البنية الحالية')}</span>
                    <Badge variant="outline" className="bg-slate-800 text-slate-200 border-slate-600">v1.0.0</Badge>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-slate-800 bg-slate-900/60">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base text-slate-100">
                    <Info className="w-4 h-4 text-amber-300" />
                    {tr('Conseil maintenance', 'نصيحة الصيانة')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-300">{tr("Export hebdomadaire recommandé pour continuité d'exploitation.", 'يُنصح بتصدير أسبوعي لضمان استمرارية التشغيل.')}</p>
                </CardContent>
              </Card>
            </div>

            <Card className="border-slate-800 bg-slate-900/60">
              <CardHeader className="border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-300">
                    <RefreshCw className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle className="text-slate-100">{tr('Mise à jour', 'التحديث')}</CardTitle>
                    <CardDescription className="text-slate-300">{tr('Contrôle de disponibilité des mises à jour', 'التحقق من توفر التحديثات')}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center justify-between p-4 bg-slate-900 rounded-xl border border-slate-700">
                  <div className="flex items-center gap-3">
                    <Info className="w-5 h-5 text-slate-300" />
                    <div>
                      <p className="text-sm font-bold text-slate-100">{tr('Version Actuelle', 'الإصدار الحالي')}</p>
                      <p className="text-xs text-slate-300">v1.0.0 ({tr('Dernière version', 'آخر إصدار')})</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-200">{tr('À jour', 'محدّث')}</Badge>
                </div>
                <Button onClick={handleUpdate} disabled={isUpdating} className="w-full h-12 bg-slate-100 text-slate-900 hover:bg-white font-bold">
                  <RefreshCw className={`w-4 h-4 mr-2 ${isUpdating ? 'animate-spin' : ''}`} />
                  {isUpdating ? tr('Vérification...', 'جارٍ التحقق...') : tr('Vérifier la mise à jour', 'التحقق من التحديث')}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-center pt-4">
          <p className="text-xs text-slate-300 font-medium flex items-center gap-2">
            <History className="w-3 h-3" />
            {tr('Dernière modification', 'آخر تعديل')}: {new Date().toLocaleDateString(language === 'ar' ? 'ar-MA' : 'fr-FR')}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Settings;
