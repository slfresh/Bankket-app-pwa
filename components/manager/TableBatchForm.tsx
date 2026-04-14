"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { generateTables } from "@/lib/actions/manager";

import type { TableLayout } from "@/lib/database.types";

type TableRow = {
  id: string;
  name: string;
  total_seats: number;
  layout: TableLayout;
};

export function TableBatchForm({
  eventId,
  tables,
}: {
  eventId: string;
  tables: TableRow[];
}) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(5);
  const [seats, setSeats] = useState(9);
  const [prefix, setPrefix] = useState("Table");
  const [layout, setLayout] = useState<TableLayout>("round");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <h2 className="text-lg font-semibold">Tables</h2>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
        Choose layout: <strong>Round</strong> (ring), <strong>Block</strong> (two long sides), or{" "}
        <strong>L-shape</strong> (seats along an L-shaped perimeter).
      </p>
      <p className="mt-2 text-sm font-medium">
        Current tables: <span className="font-normal">{tables.length}</span>
      </p>
      <ul className="mt-2 max-h-40 list-inside list-disc overflow-y-auto text-sm text-neutral-700 dark:text-neutral-300">
        {tables.slice(0, 12).map((t) => (
          <li key={t.id}>
            {t.name} — {t.total_seats} seats ·{" "}
            {t.layout === "round" ? "Round" : t.layout === "block" ? "Block" : "L-shape"}
          </li>
        ))}
        {tables.length > 12 ? <li>…</li> : null}
      </ul>
      <form
        method="post"
        action="#"
        noValidate
        className="mt-4 grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            setError(null);
            const res = await generateTables(eventId, quantity, seats, prefix, layout);
            if ("error" in res && res.error) {
              setError(res.error);
            } else {
              router.refresh();
            }
          });
        }}
      >
        {error ? (
          <p className="sm:col-span-2 text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : null}
        <label className="flex flex-col gap-1 text-sm font-medium">
          Number of tables
          <input
            type="number"
            min={1}
            max={200}
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            className="rounded-md border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Seats per table
          <input
            type="number"
            min={1}
            max={50}
            value={seats}
            onChange={(e) => setSeats(Number(e.target.value))}
            className="rounded-md border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
          />
        </label>
        <fieldset className="sm:col-span-2 flex flex-col gap-2 text-sm font-medium">
          <legend className="mb-1">Room layout</legend>
          <div className="flex flex-wrap gap-4 font-normal">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="table-layout"
                checked={layout === "round"}
                onChange={() => setLayout("round")}
                className="h-4 w-4"
              />
              Round tables (seats in a ring)
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="table-layout"
                checked={layout === "block"}
                onChange={() => setLayout("block")}
                className="h-4 w-4"
              />
              Block / long tables (seats in rows)
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="table-layout"
                checked={layout === "l_shape"}
                onChange={() => setLayout("l_shape")}
                className="h-4 w-4"
              />
              L-shape (perimeter along two sides meeting at a corner)
            </label>
          </div>
        </fieldset>
        <label className="sm:col-span-2 flex flex-col gap-1 text-sm font-medium">
          Name prefix
          <input
            value={prefix}
            onChange={(e) => setPrefix(e.target.value)}
            placeholder="Table"
            className="rounded-md border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="sm:col-span-2 w-fit rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
        >
          {pending ? "Generating…" : "Generate tables"}
        </button>
      </form>
    </section>
  );
}
