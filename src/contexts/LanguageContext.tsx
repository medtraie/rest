import { createContext, useContext, useEffect, useMemo, useState } from "react";
import fr from "@/locales/fr.json";
import ar from "@/locales/ar.json";

type Lang = "fr" | "ar";

type LanguageContextType = {
  language: Lang;
  setLanguage: (lang: Lang) => void;
};

const LanguageContext = createContext<LanguageContextType>({
  language: "fr",
  setLanguage: () => {},
});

export const LanguageProvider = ({ children }: { children: React.ReactNode }) => {
  const [language, setLanguage] = useState<Lang>(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem("ui-language") : null;
    if (stored === "fr" || stored === "ar") return stored;
    return "fr";
  });
  useEffect(() => {
    try {
      window.localStorage.setItem("ui-language", language);
    } catch {}
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
  }, [language]);
  return <LanguageContext.Provider value={{ language, setLanguage }}>{children}</LanguageContext.Provider>;
};

export const useLanguage = () => useContext(LanguageContext);

const catalogs: Record<Lang, any> = { fr, ar };

const get = (obj: any, path: string) => {
  const parts = path.split(".");
  let curr = obj;
  for (const p of parts) {
    if (!curr || typeof curr !== "object") return undefined;
    curr = curr[p];
  }
  return typeof curr === "string" ? curr : undefined;
};

export const useT = () => {
  const { language } = useLanguage();
  const dict = useMemo(() => catalogs[language], [language]);
  const t = useMemo(() => {
    return (key: string, fallback?: string) => {
      const value = get(dict, key);
      if (typeof value === "string") return value;
      if (typeof fallback === "string") return fallback;
      return key;
    };
  }, [dict]);
  return t;
};
