import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

declare global {
  interface Window {
    __SFT_BOOT_DONE__?: boolean;
  }
}

const STALE_ASSET_ERROR =
  /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk [\d]+ failed|Unable to preload CSS/i;
const STORAGE_RECOVERY_KEY = "__sft_boot_storage_recovery_v1";

const showBootstrapRecovery = (message: string) => {
  const root = document.getElementById("root");
  if (!root) return;
  root.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f8fafc;padding:24px;font-family:Inter,system-ui,sans-serif;">
      <div style="width:min(560px,100%);background:#fff;border:1px solid #e2e8f0;border-radius:20px;box-shadow:0 20px 40px rgba(15,23,42,.08);padding:28px;">
        <div style="font-size:28px;font-weight:800;color:#0f172a;margin-bottom:8px;">SFT GAZ</div>
        <div style="font-size:18px;font-weight:700;color:#0f172a;margin-bottom:10px;">L'application n'a pas pu terminer son démarrage.</div>
        <div style="font-size:14px;line-height:1.6;color:#475569;margin-bottom:18px;">${message}</div>
        <div style="display:flex;gap:12px;flex-wrap:wrap;">
          <button id="sft-reload-app" style="border:0;background:#2563eb;color:#fff;padding:10px 16px;border-radius:12px;font-weight:700;cursor:pointer;">Recharger</button>
          <button id="sft-reset-browser-data" style="border:1px solid #cbd5e1;background:#fff;color:#0f172a;padding:10px 16px;border-radius:12px;font-weight:700;cursor:pointer;">Réinitialiser les données locales</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById("sft-reload-app")?.addEventListener("click", () => {
    window.location.reload();
  });
  document.getElementById("sft-reset-browser-data")?.addEventListener("click", () => {
    try {
      const authSnapshot = window.localStorage.getItem("sft-gaz-auth");
      window.localStorage.clear();
      window.sessionStorage.clear();
      if (authSnapshot) {
        window.localStorage.setItem("sft-gaz-auth", authSnapshot);
      }
    } catch {}
    window.location.reload();
  });
};

const tryStartupStorageRecovery = () => {
  try {
    if (window.sessionStorage.getItem(STORAGE_RECOVERY_KEY) === "1") {
      return false;
    }
    window.sessionStorage.setItem(STORAGE_RECOVERY_KEY, "1");
    const authSnapshot = window.localStorage.getItem("sft-gaz-auth");
    window.localStorage.clear();
    if (authSnapshot) {
      window.localStorage.setItem("sft-gaz-auth", authSnapshot);
    }
    return true;
  } catch {
    return false;
  }
};

const recoverFromStaleAssetError = (reason: unknown) => {
  const message = reason instanceof Error ? reason.message : String(reason ?? "");
  if (!STALE_ASSET_ERROR.test(message)) return false;
  try {
    const key = "__sft_asset_reload_once_v1";
    if (window.sessionStorage.getItem(key) === "1") {
      window.sessionStorage.removeItem(key);
      return false;
    }
    window.sessionStorage.setItem(key, "1");
    window.location.reload();
    return true;
  } catch {
    return false;
  }
};

const cleanupOfflineArtifacts = async () => {
  if (!("serviceWorker" in navigator)) return;
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  } catch {}
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch {}
};

void cleanupOfflineArtifacts();

window.addEventListener("unhandledrejection", (event) => {
  if (recoverFromStaleAssetError(event.reason)) {
    event.preventDefault();
    return;
  }
  const message = event.reason instanceof Error ? event.reason.message : String(event.reason ?? "Erreur inconnue");
  showBootstrapRecovery(`Une erreur JavaScript a interrompu le chargement: ${message}`);
  event.preventDefault();
});

window.addEventListener("error", (event) => {
  if (recoverFromStaleAssetError(event.error ?? event.message)) {
    return;
  }
  const message = event.error instanceof Error ? event.error.message : String(event.message ?? "Erreur inconnue");
  showBootstrapRecovery(`Une erreur JavaScript a interrompu le chargement: ${message}`);
});

createRoot(document.getElementById("root")!).render(<App />);

window.setTimeout(() => {
  if (window.__SFT_BOOT_DONE__) return;
  if (tryStartupStorageRecovery()) {
    window.location.reload();
    return;
  }
  showBootstrapRecovery("Le navigateur n'a pas confirmé le démarrage complet de l'application. Une donnée locale corrompue ou un script bloqué peut être en cause.");
}, 4500);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void cleanupOfflineArtifacts();
  });
}
