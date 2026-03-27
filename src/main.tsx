import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerSW } from "virtual:pwa-register";
import { toast } from "sonner";

createRoot(document.getElementById("root")!).render(<App />);

if (import.meta.env.PROD) {
  registerSW({
    onNeedRefresh() {
      const lang = localStorage.getItem("ui-language") === "ar" ? "ar" : "fr";
      toast(lang === "ar" ? "تحديث متاح. أعد تحميل التطبيق لتطبيق التغييرات." : "Mise à jour disponible. Rechargez l'application pour appliquer les changements.");
    },
    onOfflineReady() {
      const lang = localStorage.getItem("ui-language") === "ar" ? "ar" : "fr";
      toast(lang === "ar" ? "التطبيق جاهز للعمل دون اتصال." : "L'application est prête pour une utilisation hors ligne.");
    },
  });
}
