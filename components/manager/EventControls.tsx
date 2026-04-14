"use client";

import { useRouter } from "next/navigation";

function isNextRedirectError(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "digest" in e &&
    typeof (e as { digest: string }).digest === "string" &&
    (e as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}
import { useEffect, useRef, useState, useTransition } from "react";
import { deleteEvent, setEventActive } from "@/lib/actions/manager";

type EventControlsProps = {
  event: { id: string; name: string; is_active: boolean };
};

export function EventControls({ event }: EventControlsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const deleteDialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!deleteOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.preventDefault();
      if (!pending) setDeleteOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [deleteOpen, pending]);

  useEffect(() => {
    if (!deleteOpen) return;
    const el = deleteDialogRef.current;
    if (!el) return;
    const focusable = el.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    window.requestAnimationFrame(() => {
      (focusable ?? el).focus();
    });
  }, [deleteOpen]);

  return (
    <div className="flex flex-col gap-2">
      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              setError(null);
              const res = await setEventActive(event.id, !event.is_active);
              if (res && "error" in res && res.error) {
                setError(res.error);
                return;
              }
              router.refresh();
            });
          }}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium dark:border-neutral-600"
        >
          {event.is_active ? "Deactivate" : "Activate"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => setDeleteOpen(true)}
          className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-800 dark:border-red-800 dark:text-red-200"
        >
          Delete event
        </button>
      </div>

      {deleteOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
          role="presentation"
          onClick={() => !pending && setDeleteOpen(false)}
        >
          <div
            ref={deleteDialogRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-event-dialog-title"
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl outline-none dark:bg-neutral-950"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="delete-event-dialog-title" className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              Delete this event?
            </h2>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
              This removes the event and all menu items, tables, and orders. This cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md px-4 py-2 text-sm font-medium text-neutral-600 dark:text-neutral-300"
                onClick={() => setDeleteOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pending}
                className="rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                onClick={() => {
                  startTransition(async () => {
                    setError(null);
                    try {
                      const res = await deleteEvent(event.id);
                      if (res && "error" in res && res.error) {
                        setError(res.error);
                        return;
                      }
                      setDeleteOpen(false);
                    } catch (e) {
                      if (isNextRedirectError(e)) {
                        setDeleteOpen(false);
                        return;
                      }
                      setError("Something went wrong. Please try again.");
                    }
                  });
                }}
              >
                {pending ? "Deleting…" : "Delete permanently"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
