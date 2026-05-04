"use client";

type ErrorBannerProps = {
  title?: string;
  message?: string;
  /** Show the raw error digest for support reference */
  digest?: string;
  onRetry?: () => void;
};

/**
 * Reusable error banner for data-layer failures.
 * Shows a generic user-safe message instead of raw error.message.
 */
export function ErrorBanner({
  title = "Something went wrong",
  message = "An unexpected error occurred. Please try again or reload the page.",
  digest,
  onRetry,
}: ErrorBannerProps) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-red-800/50 bg-red-950/50 px-4 py-3"
    >
      <p className="text-sm font-semibold text-red-200">{title}</p>
      <p className="mt-1 text-sm text-red-300/80">{message}</p>
      {digest ? (
        <p className="mt-1 text-xs text-red-400/60">
          Reference: {digest}
        </p>
      ) : null}
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 min-h-[44px] rounded-md border border-red-700/60 px-4 py-2 text-sm font-medium text-red-100 hover:bg-red-900/40"
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}
