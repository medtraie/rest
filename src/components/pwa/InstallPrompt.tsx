import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useT, useLanguage } from "@/contexts/LanguageContext";
import { Download } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice?: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const InstallPrompt: React.FC = () => {
  const { language } = useLanguage();
  const t = useT();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handler as EventListener);
    return () => window.removeEventListener("beforeinstallprompt", handler as EventListener);
  }, []);

  if (!visible || !deferredPrompt) return null;

  const label = language === "ar" ? "تثبيت التطبيق" : "Installer l'application";

  return (
    <div className="flex items-center">
      <Button
        size="sm"
        variant="secondary"
        className="bg-emerald-600 text-white hover:bg-emerald-700"
        onClick={async () => {
          await deferredPrompt.prompt();
          setVisible(false);
        }}
      >
        <Download className="w-4 h-4 mr-2" />
        {label}
      </Button>
    </div>
  );
};

export default InstallPrompt;
