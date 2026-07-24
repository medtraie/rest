import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const STALE_ASSET_ERROR =
  /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk [\d]+ failed|Unable to preload CSS/i;

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
  }
});

window.addEventListener("error", (event) => {
  void recoverFromStaleAssetError(event.error ?? event.message);
});

createRoot(document.getElementById("root")!).render(<App />);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void cleanupOfflineArtifacts();
  });
}
