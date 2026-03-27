import React from "react";
import { Toaster as UIToaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppProvider, useApp } from "./contexts/AppContext";
import { Toaster } from "sonner";
import { LanguageProvider, useT } from "./contexts/LanguageContext";
import { PageTransitionProvider } from "./contexts/PageTransitionContext";
import { Layout } from "./components/layout/Layout";
import Dashboard from "./pages/Dashboard";
import Inventory from "./pages/Inventory";
import Trucks from "./pages/Trucks";
import Drivers from "./pages/Drivers";
import Exchanges from "./pages/Exchanges";
import Factory from "./pages/Factory";
import SupplyReturn from "./pages/SupplyReturn";
import Clients from "./pages/Clients";
import DefectiveStock from "./pages/DefectiveStock";
import Expenses from "./pages/Expenses";
import Revenue from "./pages/Revenue";
import Reports from "./pages/Reports";
import FuelManagement from "./pages/FuelManagement";
import PetitCamion from "./pages/PetitCamion";
import Repairs from "./pages/Repairs";
import Settings from "./pages/Settings";
import LiveMap from "./pages/LiveMap";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import { supabase } from "./lib/supabaseClient";
import type { Session } from "@supabase/supabase-js";

const queryClient = new QueryClient();

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error?: any }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  componentDidCatch(error: any, info: any) {
    console.error("Unhandled UI error:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
          <div className="max-w-lg w-full rounded-2xl bg-white shadow-xl border border-slate-100 p-8 space-y-4">
            <div className="text-2xl font-bold text-slate-900">Une erreur s'est produite</div>
            <div className="text-sm text-slate-600">L'interface a rencontré une erreur inattendue.</div>
            {import.meta.env.DEV && this.state.error && (
              <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-md p-3 overflow-auto max-h-48">
                {(this.state.error?.message || String(this.state.error))}
              </div>
            )}
            <div className="flex gap-2">
              <button
                className="px-4 py-2 rounded-md bg-indigo-600 text-white font-semibold"
                onClick={() => window.location.reload()}
              >
                Recharger
              </button>
              <button
                className="px-4 py-2 rounded-md border border-slate-200 text-slate-700 font-semibold"
                onClick={() => this.setState({ hasError: false, error: undefined })}
              >
                Essayer de continuer
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children as any;
  }
}

const ProtectedRoute = ({ permission, element, fallback }: { permission: string; element: JSX.Element; fallback: string }) => {
  const { hasPermission } = useApp();
  if (!hasPermission(permission as any)) {
    return <Navigate to={fallback} replace />;
  }
  return element;
};

const AccessDenied = () => {
  const t = useT();
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="text-3xl font-bold text-slate-800">{t("app.accessDenied")}</div>
        <div className="text-sm text-slate-500">{t("app.accessDeniedDesc")}</div>
      </div>
    </div>
  );
};

const RoutesWithAuth = ({ session }: { session: Session | null }) => {
  const { hasPermission } = useApp();
  const permissionRoutes = [
    { permission: "dashboard", path: "/" },
    { permission: "inventory", path: "/inventory" },
    { permission: "trucks", path: "/trucks" },
    { permission: "live-map", path: "/live-map" },
    { permission: "drivers", path: "/drivers" },
    { permission: "clients", path: "/clients" },
    { permission: "supply-return", path: "/supply-return" },
    { permission: "petit-camion", path: "/petit-camion" },
    { permission: "defective-stock", path: "/defective-stock" },
    { permission: "exchanges", path: "/exchanges" },
    { permission: "factory", path: "/factory" },
    { permission: "fuel-management", path: "/fuel-management" },
    { permission: "repairs", path: "/repairs" },
    { permission: "expenses", path: "/expenses" },
    { permission: "revenue", path: "/revenue" },
    { permission: "reports", path: "/reports" },
    { permission: "settings", path: "/settings" },
  ];

  const fallbackPath = permissionRoutes.find(p => hasPermission(p.permission as any))?.path ?? "/access-denied";

  return (
    <Routes>
      <Route path="/login" element={session ? <Navigate to={fallbackPath} replace /> : <Login />} />
      <Route element={session ? <Layout /> : <Navigate to="/login" replace />}>
        <Route path="/" element={<ProtectedRoute permission="dashboard" element={<Dashboard />} fallback={fallbackPath} />} />
        <Route path="/inventory" element={<ProtectedRoute permission="inventory" element={<Inventory />} fallback={fallbackPath} />} />
        <Route path="/trucks" element={<ProtectedRoute permission="trucks" element={<Trucks />} fallback={fallbackPath} />} />
        <Route path="/drivers" element={<ProtectedRoute permission="drivers" element={<Drivers />} fallback={fallbackPath} />} />
        <Route path="/exchanges" element={<ProtectedRoute permission="exchanges" element={<Exchanges />} fallback={fallbackPath} />} />
        <Route path="/factory" element={<ProtectedRoute permission="factory" element={<Factory />} fallback={fallbackPath} />} />
        <Route path="/supply-return" element={<ProtectedRoute permission="supply-return" element={<SupplyReturn />} fallback={fallbackPath} />} />
        <Route path="/clients" element={<ProtectedRoute permission="clients" element={<Clients />} fallback={fallbackPath} />} />
        <Route path="/defective-stock" element={<ProtectedRoute permission="defective-stock" element={<DefectiveStock />} fallback={fallbackPath} />} />
        <Route path="/expenses" element={<ProtectedRoute permission="expenses" element={<Expenses />} fallback={fallbackPath} />} />
        <Route path="/revenue" element={<ProtectedRoute permission="revenue" element={<Revenue />} fallback={fallbackPath} />} />
        <Route path="/reports" element={<ProtectedRoute permission="reports" element={<Reports />} fallback={fallbackPath} />} />
        <Route path="/fuel-management" element={<ProtectedRoute permission="fuel-management" element={<FuelManagement />} fallback={fallbackPath} />} />
        <Route path="/oil-management" element={<Navigate to="/fuel-management" replace />} />
        <Route path="/petit-camion" element={<ProtectedRoute permission="petit-camion" element={<PetitCamion />} fallback={fallbackPath} />} />
        <Route path="/repairs" element={<ProtectedRoute permission="repairs" element={<Repairs />} fallback={fallbackPath} />} />
        <Route path="/settings" element={<ProtectedRoute permission="settings" element={<Settings />} fallback={fallbackPath} />} />
        <Route path="/live-map" element={<ProtectedRoute permission="live-map" element={<LiveMap />} fallback={fallbackPath} />} />
        <Route path="/access-denied" element={<AccessDenied />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
};

const AppContent = ({ supabaseConfigured }: { supabaseConfigured: boolean }) => {
  const [session, setSession] = React.useState<Session | null>(null);
  const [authReady, setAuthReady] = React.useState(false);
  const t = useT();

  React.useEffect(() => {
    if (!supabaseConfigured) {
      setAuthReady(true);
      return;
    }
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session ?? null);
      setAuthReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [supabaseConfigured]);

  if (!supabaseConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-lg w-full rounded-2xl bg-white shadow-xl border border-slate-100 p-8 space-y-3">
          <div className="text-2xl font-bold text-slate-900">{t("app.configMissing")}</div>
          <div className="text-sm text-slate-600">
            {t("app.configMissingDesc")}
          </div>
          <div className="text-xs text-slate-500">
            {t("app.configMissingHint")}
          </div>
        </div>
      </div>
    );
  }

  const Splash = () => {
    const t = useT();
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-white px-8 py-7 shadow-xl border border-slate-100">
          <img src="/sft-logo.svg?v=20260322sft10" alt="SFT GAZ logo" className="h-14 w-14 rounded-xl object-contain" />
          <div className="text-sm font-bold uppercase tracking-[0.2em] text-slate-800">{t("brand")}</div>
          <div className="text-sm text-muted-foreground">{t("loading", "Chargement...")}</div>
        </div>
      </div>
    );
  };
  return authReady ? <RoutesWithAuth session={session} /> : <Splash />;
};

const App = () => {
  const supabaseConfigured = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <LanguageProvider>
          <PageTransitionProvider>
            <AppProvider>
            <UIToaster />
            <Sonner />
            <BrowserRouter>
              <ErrorBoundary>
                <AppContent supabaseConfigured={supabaseConfigured} />
              </ErrorBoundary>
            </BrowserRouter>
            </AppProvider>
          </PageTransitionProvider>
        </LanguageProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
