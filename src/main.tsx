import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

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

createRoot(document.getElementById("root")!).render(<App />);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void cleanupOfflineArtifacts();
  });
}
