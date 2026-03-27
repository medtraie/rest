import React, { useEffect, useState } from 'react';
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Menu, Sparkles, PanelsTopLeft } from "lucide-react";
import { Outlet, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useLanguage, useT } from "@/contexts/LanguageContext";
import InstallPrompt from "@/components/pwa/InstallPrompt";
import NetworkStatus from "@/components/pwa/NetworkStatus";
import { AnimatePresence, motion } from "framer-motion";
import { usePageTransition } from "@/contexts/PageTransitionContext";

type NavTheme = 'indigo' | 'emerald' | 'sunset' | 'violet';

export const Layout: React.FC = () => {
  const { language } = useLanguage();
  const t = useT();
  const pageTransition = usePageTransition();
  const [cardMode, setCardMode] = useState<'classic' | 'cinematic'>(() => {
    if (typeof window === 'undefined') return 'cinematic';
    return window.localStorage.getItem('app-card-mode') === 'classic' ? 'classic' : 'cinematic';
  });
  const [navTheme, setNavTheme] = useState<NavTheme>(() => {
    if (typeof window === 'undefined') return 'indigo';
    const stored = window.localStorage.getItem('app-nav-theme');
    if (stored === 'emerald' || stored === 'sunset' || stored === 'violet' || stored === 'indigo') return stored;
    return 'indigo';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-card-mode', cardMode);
    window.localStorage.setItem('app-card-mode', cardMode);
  }, [cardMode]);

  useEffect(() => {
    document.documentElement.setAttribute('data-nav-theme', navTheme);
    window.localStorage.setItem('app-nav-theme', navTheme);
  }, [navTheme]);

  useEffect(() => {
    const handleNavThemeChange = (event: Event) => {
      const theme = (event as CustomEvent<NavTheme>).detail;
      if (theme === 'indigo' || theme === 'emerald' || theme === 'sunset' || theme === 'violet') {
        setNavTheme(theme);
      }
    };

    window.addEventListener('app-nav-theme-change', handleNavThemeChange as EventListener);
    return () => {
      window.removeEventListener('app-nav-theme-change', handleNavThemeChange as EventListener);
    };
  }, []);

  const applyCardMode = (mode: 'classic' | 'cinematic') => {
    setCardMode(mode);
    window.dispatchEvent(new CustomEvent('app-card-mode-change', { detail: mode }));
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <header className="h-16 border-b bg-card flex items-center px-6 gap-4">
            <SidebarTrigger className="p-2 hover:bg-accent rounded-md">
              <Menu className="w-4 h-4" />
            </SidebarTrigger>
            
            <div className="flex items-center justify-between w-full">
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  {t("layout.systemTitle")}
                </h2>
              </div>
              
              <div className="flex items-center gap-4">
                <InstallPrompt />
                <NetworkStatus />
                <div className="hidden md:inline-flex items-center rounded-xl border border-slate-200 bg-white p-1">
                  <Button
                    size="sm"
                    variant={cardMode === 'classic' ? 'secondary' : 'ghost'}
                    className={cardMode === 'classic' ? 'bg-slate-100 text-slate-900' : 'text-slate-500'}
                    onClick={() => applyCardMode('classic')}
                  >
                    <PanelsTopLeft className="w-4 h-4" />
                    {t("layout.cardClassic")}
                  </Button>
                  <Button
                    size="sm"
                    variant={cardMode === 'cinematic' ? 'secondary' : 'ghost'}
                    className={cardMode === 'cinematic' ? 'bg-slate-900 text-white hover:bg-slate-900' : 'text-slate-500'}
                    onClick={() => applyCardMode('cinematic')}
                  >
                    <Sparkles className="w-4 h-4" />
                    {t("layout.cardCinematic")}
                  </Button>
                </div>
                <div className="text-sm text-muted-foreground">
                  {new Date().toLocaleDateString(language === "ar" ? "ar-MA" : "fr-FR", {
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={useLocation().pathname}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: pageTransition.duration, ease: pageTransition.ease }}
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};
