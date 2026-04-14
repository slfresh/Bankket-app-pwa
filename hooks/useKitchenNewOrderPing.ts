"use client";

import { useEffect, useRef, useState } from "react";
import { isKitchenSoundMuted, playKitchenBeep } from "@/lib/kitchen/play-beep";

/**
 * On new pending order IDs (after initial load), optional beep + toast message.
 */
export function useKitchenNewOrderPing(pendingOrders: { id: string }[]) {
  const [toast, setToast] = useState<string | null>(null);
  const seen = useRef<Set<string>>(new Set());
  const boot = useRef(true);

  useEffect(() => {
    const ids = new Set(pendingOrders.map((o) => o.id));
    if (boot.current) {
      boot.current = false;
      seen.current = ids;
      return;
    }
    let newCount = 0;
    for (const id of ids) {
      if (!seen.current.has(id)) {
        newCount += 1;
      }
    }
    seen.current = ids;
    if (newCount > 0) {
      if (!isKitchenSoundMuted()) {
        playKitchenBeep();
      }
      setToast(
        newCount === 1 ? "New order · pending" : `${newCount} new orders · pending`,
      );
      const t = window.setTimeout(() => setToast(null), 6000);
      return () => window.clearTimeout(t);
    }
  }, [pendingOrders]);

  return { toast, dismissToast: () => setToast(null) };
}
