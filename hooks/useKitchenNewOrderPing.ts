"use client";

import { useEffect, useRef, useState } from "react";
import { isKitchenSoundMuted, playKitchenBeep } from "@/lib/kitchen/play-beep";

export type KitchenNewOrderPingRow = {
  id: string;
  seat_number: number;
  menu_items: { label: string } | null;
  banquet_tables: { name: string } | null;
};

function announceLine(order: KitchenNewOrderPingRow): string {
  const table = order.banquet_tables?.name?.trim() || "Unknown table";
  const dish = order.menu_items?.label?.trim() || "Unknown dish";
  return `New order on ${table}, seat ${order.seat_number}: ${dish}.`;
}

const LIVE_CLEAR_MS = 8000;

/**
 * After initial hydrate, detects new pending order IDs → beep + toast + polite live region text.
 */
export function useKitchenNewOrderPing(pendingOrders: KitchenNewOrderPingRow[]) {
  const [toast, setToast] = useState<string | null>(null);
  const [liveRegionText, setLiveRegionText] = useState("");
  const seen = useRef<Set<string>>(new Set());
  const boot = useRef(true);

  useEffect(() => {
    const ids = new Set(pendingOrders.map((o) => o.id));

    const clearTimers: number[] = [];
    const scheduleClearLiveRegion = () => {
      clearTimers.push(
        window.setTimeout(() => setLiveRegionText(""), LIVE_CLEAR_MS),
      );
    };

    if (boot.current) {
      boot.current = false;
      seen.current = ids;
      return () => {
        clearTimers.forEach((t) => window.clearTimeout(t));
      };
    }

    const byId = new Map(pendingOrders.map((o) => [o.id, o]));
    const newcomerIds = pendingOrders
      .map((o) => o.id)
      .filter((id) => !seen.current.has(id) && !id.startsWith("optimistic:"));
    seen.current = ids;

    if (newcomerIds.length > 0) {
      if (!isKitchenSoundMuted()) {
        playKitchenBeep();
      }
      setToast(
        newcomerIds.length === 1 ? "New order · pending" : `${newcomerIds.length} new orders · pending`,
      );
      clearTimers.push(
        window.setTimeout(() => setToast(null), 6000),
      );

      if (newcomerIds.length === 1) {
        const row = byId.get(newcomerIds[0]!);
        if (row) {
          const line = announceLine(row);
          setLiveRegionText(line);
          scheduleClearLiveRegion();
        }
      } else {
        const firstId = newcomerIds[0];
        const first = firstId ? byId.get(firstId) : undefined;
        const rest = newcomerIds.length - 1;
        const line = first ? `${announceLine(first)} Plus ${rest} more new orders.` : `${newcomerIds.length} new orders received.`;
        setLiveRegionText(line);
        scheduleClearLiveRegion();
      }
    }

    return () => {
      clearTimers.forEach((t) => window.clearTimeout(t));
    };
  }, [pendingOrders]);

  return {
    toast,
    dismissToast: () => setToast(null),
    liveRegionText,
  };
}
