"use client";

import { useEffect, useRef } from "react";

/** Matches kitchen single- and multi-event hooks. */
export type StaffRealtimeConnectionState =
  | "idle"
  | "connecting"
  | "subscribed"
  | "disconnected"
  | "error";

type RealtimeConnectionBannerProps = {
  realtimeState: StaffRealtimeConnectionState;
  realtimeMessage: string | null;
  /** Refetch orders/notes when user taps Refresh */
  onRefresh?: () => void | Promise<void>;
  /** Kitchen uses dark styling */
  variant?: "default" | "kitchen";
};

/**
 * Visible banner for bad realtime states + aria-live announcements for screen readers.
 */
export function RealtimeConnectionBanner({
  realtimeState,
  realtimeMessage,
  onRefresh,
  variant = "default",
}: RealtimeConnectionBannerProps) {
  const prevAnnounced = useRef<string>("");

  const announce =
    realtimeState === "error"
      ? realtimeMessage ?? "Live updates connection error."
      : realtimeState === "disconnected"
        ? "Live updates disconnected."
        : realtimeState === "subscribed"
          ? "Live updates connected."
          : null;

  useEffect(() => {
    if (announce && announce !== prevAnnounced.current) {
      prevAnnounced.current = announce;
    }
  }, [announce]);

  const showBanner =
    realtimeState === "error" || realtimeState === "disconnected" || realtimeState === "connecting";

  const isKitchen = variant === "kitchen";

  return (
    <>
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announce ?? ""}
      </div>
      {showBanner ? (
        <div
          className={
            isKitchen
              ? "mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-800/60 bg-amber-950/80 px-4 py-2 text-sm text-amber-100"
              : "mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100"
          }
        >
          <span>
            {realtimeState === "connecting"
              ? "Connecting to live updates…"
              : realtimeState === "disconnected"
                ? "Live updates disconnected."
                : realtimeMessage ?? "Live updates error."}
          </span>
          {onRefresh && (realtimeState === "error" || realtimeState === "disconnected") ? (
            <button
              type="button"
              className={
                isKitchen
                  ? "rounded-md border border-amber-600 px-3 py-1 text-xs font-medium text-amber-50 hover:bg-amber-900/50"
                  : "rounded-md border border-amber-300 px-3 py-1 text-xs font-medium text-amber-950 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-100 dark:hover:bg-amber-900/50"
              }
              onClick={() => void onRefresh()}
            >
              Refresh data
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
