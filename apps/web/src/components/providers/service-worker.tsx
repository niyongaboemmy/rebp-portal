"use client";

import { useEffect } from "react";

/** Registers the service worker in production builds only (dev HMR and SWs don't mix). */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      /* offline support is progressive: failure leaves the site fully working */
    });
  }, []);
  return null;
}
