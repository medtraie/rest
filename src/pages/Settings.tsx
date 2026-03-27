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
  EyeOff
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
          <TabsList className="grid w-full grid-cols-3 border border-slate-700 bg-slate-900/90">
            <TabsTrigger value="operations" className="text-slate-200 hover:text-white data-[state=active]:bg-slate-700 data-[state=active]:text-white">
              {tr('Opérations', 'العمليات')}
            </TabsTrigger>
            <TabsTrigger value="security" className="text-slate-200 hover:text-white data-[state=active]:bg-slate-700 data-[state=active]:text-white">
              {tr('Sécurité & Accès', 'الأمان والصلاحيات')}
            </TabsTrigger>
            <TabsTrigger value="system" className="text-slate-200 hover:text-white data-[state=active]:bg-slate-700 data-[state=active]:text-white">
              {tr('Système', 'النظام')}
            </TabsTrigger>
          </TabsList>

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
