"use client";

import { type ReactNode, useEffect, useRef } from "react";

export type KitchenShortcutsDialogProps = {
  open: boolean;
  titleId?: string;
  /** Body content (shortcut rows). */
  children: ReactNode;
  /** Close modal (Escape wires here). */
  onClose: () => void;
};

/**
 * Accessible modal listing keyboard shortcuts; parent controls `open` and focus return.
 */
export function KitchenShortcutsDialog({
  open,
  titleId = "kitchen-shortcuts-heading",
  children,
  onClose,
}: KitchenShortcutsDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const prev = document.activeElement as HTMLElement | null;
    const focusTrap = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", focusTrap);
    panel?.focus();
    return () => {
      window.removeEventListener("keydown", focusTrap);
      prev?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[140] flex items-end justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center sm:pb-4"
      role="presentation"
    >
      <button
        type="button"
        aria-label="Close shortcuts"
        className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
        onClick={() => onClose()}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="focus-visible-kitchen relative z-[141] max-h-[85vh] w-full max-w-lg overflow-auto rounded-xl border border-border-kitchen bg-surface-kitchen-elevated px-5 py-4 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-lg font-bold text-white">
            Kitchen shortcuts
          </h2>
          <button
            type="button"
            className="focus-visible-kitchen min-h-[44px] rounded-md px-2 text-sm text-neutral-300 hover:text-white"
            onClick={() => onClose()}
          >
            Close
          </button>
        </div>
        <p className="mt-1 text-xs text-neutral-500">Disabled while typing in a field.</p>
        <div className="mt-4 space-y-3 text-sm text-neutral-200">{children}</div>
      </div>
    </div>
  );
}

function Row({ keys, detail }: { keys: string; detail: string }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-lg bg-neutral-950/50 px-3 py-2">
      <span className="min-w-[7rem] font-mono text-xs font-semibold text-amber-200">{keys}</span>
      <span className="min-w-[12rem] flex-1">{detail}</span>
    </div>
  );
}

export function KitchenShortcutsDialogBodyDefault() {
  return (
    <>
      <Row keys="1 · 2 · 3" detail="Jump to All · Pending · Cooking filters." />
      <Row keys="← · → · Home · End" detail="Within the filter bar, move between tabs." />
      <Row keys="M" detail="Mute or unmute the new-order beep." />
      <Row keys="/" detail="Focus the table-name search box." />
      <Row keys="?" detail="Show this shortcut list." />
      <Row keys="← · → · Home · End (floor)" detail="Cycle table buttons on the floor plan (sorted A–Z by name)." />
    </>
  );
}
