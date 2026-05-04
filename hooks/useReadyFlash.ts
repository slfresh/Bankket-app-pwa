"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const FLASH_DURATION_MS = 7000;

/**
 * Tracks order IDs that recently moved to "cooked" so the UI can pulse/highlight them.
 * Each ID auto-clears after FLASH_DURATION_MS.
 */
export function useReadyFlash() {
  const [readyFlashOrderIds, setReadyFlashOrderIds] = useState<Set<string>>(() => new Set());
  const timersRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    return () => {
      for (const t of timersRef.current.values()) {
        window.clearTimeout(t);
      }
      timersRef.current.clear();
    };
  }, []);

  const flashReadyIds = useCallback((ids: readonly string[]) => {
    setReadyFlashOrderIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        next.add(id);
        const prevTimer = timersRef.current.get(id);
        if (prevTimer) window.clearTimeout(prevTimer);
        const t = window.setTimeout(() => {
          setReadyFlashOrderIds((s) => {
            const n = new Set(s);
            n.delete(id);
            return n;
          });
          timersRef.current.delete(id);
        }, FLASH_DURATION_MS);
        timersRef.current.set(id, t);
      }
      return next;
    });
  }, []);

  return { readyFlashOrderIds, flashReadyIds };
}
