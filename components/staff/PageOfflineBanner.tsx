"use client";

/**
 * Thin page-level banner when `navigator.onLine` is false.
 * Separate from realtime WebSocket/subscription banners.
 */
export function PageOfflineBanner({ online }: { online: boolean }) {
  if (online) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="border-b border-red-800/70 bg-red-950/90 px-4 py-2.5 text-sm font-medium text-red-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:rounded-md"
    >
      You are offline. This page cannot reach the network — wait for reconnect, then refresh data if counts look stale.
    </div>
  );
}
