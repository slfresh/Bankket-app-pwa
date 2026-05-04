"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import type { Json } from "@/lib/database.types";
import type { TableLayout } from "@/lib/database.types";
import {
  clearBanquetTableLayoutConfig,
  deleteBanquetTable,
  updateBanquetTableLShapeLegs,
  updateBanquetTableName,
} from "@/lib/actions/manager";
import { lShapeLegCounts, parseLShapeLayoutConfig } from "@/lib/domain/seat-layout";

export type ManagedTableRow = {
  id: string;
  name: string;
  total_seats: number;
  layout: TableLayout;
  layout_config: Json | null;
};

export function TableListManager({
  eventId,
  tables,
}: {
  eventId: string;
  tables: ManagedTableRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <h2 className="text-lg font-semibold">Tables in this event</h2>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
        Rename or remove individual tables. Removing a table deletes its orders. L-shaped tables can
        use custom leg sizes (three numbers that sum to total seats).
      </p>
      {error ? (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}
      <ul className="mt-4 space-y-4">
        {tables.map((t) => (
          <TableRowEditor
            key={`${t.id}-${t.name}-${JSON.stringify(t.layout_config)}`}
            eventId={eventId}
            table={t}
            pending={pending}
            onError={setError}
            onRefresh={() => router.refresh()}
            startTransition={startTransition}
          />
        ))}
      </ul>
      {tables.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-500">No tables yet — generate a batch below.</p>
      ) : null}
    </section>
  );
}

function TableRowEditor({
  eventId,
  table,
  pending,
  onError,
  onRefresh,
  startTransition,
}: {
  eventId: string;
  table: ManagedTableRow;
  pending: boolean;
  onError: (msg: string | null) => void;
  onRefresh: () => void;
  startTransition: (cb: () => void) => void;
}) {
  const [name, setName] = useState(table.name);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const deleteDialogRef = useRef<HTMLDivElement>(null);
  const cfg = parseLShapeLayoutConfig(table.layout_config);
  const defaultLegs = lShapeLegCounts(table.total_seats, null);
  const [leg0, setLeg0] = useState(cfg?.l_legs?.[0] ?? defaultLegs[0]);
  const [leg1, setLeg1] = useState(cfg?.l_legs?.[1] ?? defaultLegs[1]);
  const [leg2, setLeg2] = useState(cfg?.l_legs?.[2] ?? defaultLegs[2]);

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
    <li className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-700">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm font-medium">
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={200}
            className="rounded-md border border-neutral-300 px-2 py-1.5 dark:border-neutral-600 dark:bg-neutral-900"
          />
        </label>
        <button
          type="button"
          disabled={pending || name.trim() === table.name}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-600"
          onClick={() => {
            startTransition(async () => {
              onError(null);
              const res = await updateBanquetTableName(eventId, table.id, name.trim());
              if ("error" in res && res.error) {
                onError(res.error);
                return;
              }
              onRefresh();
            });
          }}
        >
          Save name
        </button>
        <button
          type="button"
          disabled={pending}
          className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-800 dark:border-red-800 dark:text-red-200"
          onClick={() => setDeleteOpen(true)}
        >
          Delete table
        </button>
      </div>
      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500">
        <span>
          {table.total_seats} seats ·{" "}
          {table.layout === "round" ? "Round" : table.layout === "block" ? "Block" : "L-shape"}
        </span>
        <Link
          href={`/manager/events/${eventId}/table/${table.id}/edit`}
          className="min-h-[44px] inline-flex items-center font-medium text-accent underline"
        >
          Quick rename (modal)
        </Link>
      </p>
      {table.layout === "l_shape" ? (
        <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-neutral-100 pt-3 dark:border-neutral-800">
          <span className="w-full text-xs font-medium text-neutral-600 dark:text-neutral-400">
            L-shape legs (must sum to {table.total_seats})
          </span>
          <label className="flex flex-col text-xs">
            Leg 1
            <input
              type="number"
              min={0}
              max={table.total_seats}
              value={leg0}
              onChange={(e) => setLeg0(Number(e.target.value))}
              className="w-20 rounded border border-neutral-300 px-1 py-1 dark:border-neutral-600 dark:bg-neutral-900"
            />
          </label>
          <label className="flex flex-col text-xs">
            Leg 2
            <input
              type="number"
              min={0}
              max={table.total_seats}
              value={leg1}
              onChange={(e) => setLeg1(Number(e.target.value))}
              className="w-20 rounded border border-neutral-300 px-1 py-1 dark:border-neutral-600 dark:bg-neutral-900"
            />
          </label>
          <label className="flex flex-col text-xs">
            Leg 3
            <input
              type="number"
              min={0}
              max={table.total_seats}
              value={leg2}
              onChange={(e) => setLeg2(Number(e.target.value))}
              className="w-20 rounded border border-neutral-300 px-1 py-1 dark:border-neutral-600 dark:bg-neutral-900"
            />
          </label>
          <button
            type="button"
            disabled={pending}
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
            onClick={() => {
              startTransition(async () => {
                onError(null);
                const res = await updateBanquetTableLShapeLegs(eventId, table.id, [leg0, leg1, leg2]);
                if ("error" in res && res.error) {
                  onError(res.error);
                  return;
                }
                onRefresh();
              });
            }}
          >
            Save legs
          </button>
          {cfg?.l_legs ? (
            <button
              type="button"
              disabled={pending}
              className="text-xs text-neutral-600 underline dark:text-neutral-400"
              onClick={() => {
                startTransition(async () => {
                  onError(null);
                  const res = await clearBanquetTableLayoutConfig(eventId, table.id);
                  if ("error" in res && res.error) {
                    onError(res.error);
                    return;
                  }
                  const d = lShapeLegCounts(table.total_seats, null);
                  setLeg0(d[0]);
                  setLeg1(d[1]);
                  setLeg2(d[2]);
                  onRefresh();
                });
              }}
            >
              Reset to auto split
            </button>
          ) : null}
        </div>
      ) : null}

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
            aria-labelledby={`delete-table-title-${table.id}`}
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl outline-none dark:bg-neutral-950"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id={`delete-table-title-${table.id}`}
              className="text-lg font-semibold text-neutral-900 dark:text-neutral-100"
            >
              Delete this table?
            </h2>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
              Remove &quot;{table.name}&quot; and all orders for this table. This cannot be undone.
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
                    onError(null);
                    const res = await deleteBanquetTable(eventId, table.id);
                    setDeleteOpen(false);
                    if ("error" in res && res.error) {
                      onError(res.error);
                      return;
                    }
                    onRefresh();
                  });
                }}
              >
                {pending ? "Deleting…" : "Delete table"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </li>
  );
}
