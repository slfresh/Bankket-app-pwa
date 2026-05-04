"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast as sonnerToast } from "sonner";
import { updateBanquetTableName } from "@/lib/actions/manager";

type TableNameEditPanelProps = {
  eventId: string;
  tableId: string;
  initialName: string;
  /** Called after successful save (e.g. close modal + navigate). */
  onSaved?: () => void;
};

export function TableNameEditPanel({
  eventId,
  tableId,
  initialName,
  onSaved,
}: TableNameEditPanelProps) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-4">
      <label className="flex flex-col gap-1 text-sm font-medium text-neutral-800 dark:text-neutral-200">
        Table name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={200}
          autoFocus
          className="min-h-[44px] rounded-lg border border-neutral-300 bg-white px-3 py-2 text-base dark:border-neutral-600 dark:bg-zinc-900"
        />
      </label>
      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          disabled={pending}
          className="min-h-[44px] rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium dark:border-neutral-600"
          onClick={() => {
            if (onSaved) {
              onSaved();
            } else {
              router.push(`/manager/events/${eventId}`);
            }
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={pending || name.trim() === initialName.trim()}
          className="min-h-[44px] rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground disabled:opacity-50"
          onClick={() => {
            startTransition(async () => {
              const res = await updateBanquetTableName(eventId, tableId, name.trim());
              if ("error" in res && res.error) {
                sonnerToast.error(res.error);
                return;
              }
              sonnerToast.success("Table name saved.");
              router.refresh();
              onSaved?.();
            });
          }}
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
