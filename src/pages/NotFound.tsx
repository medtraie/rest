import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";
import { useT } from "@/contexts/LanguageContext";

const NotFound = () => {
  const location = useLocation();
  const t = useT();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-6">
        <div className="space-y-2">
          <h1 className="text-9xl font-bold text-muted-foreground">404</h1>
          <h2 className="text-2xl font-semibold">{t('notFound.title', 'Page introuvable')}</h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            {t('notFound.description', "Désolé, la page que vous recherchez n'existe pas ou a été déplacée.")}
          </p>
        </div>
        
        <Button asChild>
          <a href="/" className="inline-flex items-center gap-2">
            <Home className="w-4 h-4" />
            {t('notFound.backHome', "Retour à l'accueil")}
          </a>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
