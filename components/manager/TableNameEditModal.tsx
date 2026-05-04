"use client";

import { useRouter } from "next/navigation";
import { TableNameEditPanel } from "@/components/manager/TableNameEditPanel";

type TableNameEditModalProps = {
  eventId: string;
  tableId: string;
  initialName: string;
};

export function TableNameEditModal({ eventId, tableId, initialName }: TableNameEditModalProps) {
  const router = useRouter();

  function close() {
    router.back();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] pt-[max(1rem,env(safe-area-inset-top,0px))] sm:items-center"
      role="presentation"
      onClick={close}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="table-rename-title"
        className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-950"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="table-rename-title" className="text-lg font-semibold text-neutral-900 dark:text-zinc-50">
          Rename table
        </h2>
        <p className="mt-1 text-sm text-neutral-600 dark:text-zinc-400">
          Updates the label used on the floor plan and waiter screens.
        </p>
        <div className="mt-4">
          <TableNameEditPanel
            eventId={eventId}
            tableId={tableId}
            initialName={initialName}
            onSaved={close}
          />
        </div>
      </div>
    </div>
  );
}
