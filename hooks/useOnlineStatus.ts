"use client";

import { useEffect, useState } from "react";

/** Reflects browser online/offline (page-level connectivity, distinct from realtime WebSockets). */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  useEffect(() => {
    setOnline(navigator.onLine);
    const onOnline = () => setOnline(true);
    const offOnline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", offOnline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", offOnline);
    };
  }, []);

  return online;
}
