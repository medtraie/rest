import React from "react";

const RETRYABLE_LAZY_ERROR =
  /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk [\d]+ failed|Unable to preload CSS/i;

const waitForever = () => new Promise<never>(() => {});

export const lazyWithRetry = <T extends React.ComponentType<any>>(
  importer: () => Promise<{ default: T }>,
  key: string
) =>
  React.lazy(async () => {
    try {
      const module = await importer();
      try {
        window.sessionStorage.removeItem(`lazy-retry:${key}`);
      } catch {}
      return module;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const storageKey = `lazy-retry:${key}`;
      const canRetry =
        typeof window !== "undefined" &&
        RETRYABLE_LAZY_ERROR.test(message);

      if (canRetry) {
        try {
          const alreadyRetried = window.sessionStorage.getItem(storageKey) === "1";
          if (!alreadyRetried) {
            window.sessionStorage.setItem(storageKey, "1");
            window.location.reload();
            return waitForever();
          }
          window.sessionStorage.removeItem(storageKey);
        } catch {}
      }

      throw error;
    }
  });
