import React, { useEffect, useState } from "react";
import { useLanguage, useT } from "@/contexts/LanguageContext";
import { useApp } from "@/contexts/AppContext";
import { flushQueue, getQueueSize } from "@/lib/offlineQueue";
import { CloudOff, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";

const NetworkStatus: React.FC = () => {
  const { language } = useLanguage();
  const t = useT();
  const app = useApp();
  const [online, setOnline] = useState<boolean>(navigator.onLine);
  const [pending, setPending] = useState<number>(getQueueSize());

  useEffect(() => {
    const onOnline = async () => {
      setOnline(true);
      const flushed = await flushQueue(app);
      setPending(getQueueSize());
      if (flushed > 0) {
        const msg = language === "ar"
          ? `تمت مزامنة ${flushed} عملية معلّقة`
          : `Synchronisé ${flushed} opérations en attente`;
        // Sonner toast is globally available in App
        (window as any).sonner?.success?.(msg);
      }
    };
    const onOffline = () => {
      setOnline(false);
      setPending(getQueueSize());
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [app, language]);

  return (
    <div className="flex items-center gap-2">
      <span className={[
        "inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs",
        online ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"
      ].join(" ")}>
        {online ? <Wifi className="w-3 h-3" /> : <CloudOff className="w-3 h-3" />}
        {online ? (language === "ar" ? "متصل" : "En ligne") : (language === "ar" ? "غير متصل" : "Hors ligne")}
      </span>
      {pending > 0 && (
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs border-amber-200 text-amber-700 bg-amber-50"
          onClick={async () => {
            const flushed = await flushQueue(app);
            setPending(getQueueSize());
          }}
        >
          {(language === "ar" ? "معلّق" : "En attente")}: {pending}
        </Button>
      )}
    </div>
  );
};

export default NetworkStatus;
