import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TableNameEditStandaloneBody } from "@/components/manager/TableNameEditStandaloneBody";

type PageProps = { params: Promise<{ eventId: string; tableId: string }> };

export default async function TableRenameStandalonePage({ params }: PageProps) {
  const { eventId, tableId } = await params;
  const supabase = await createClient();

  const { data: table, error } = await supabase
    .from("banquet_tables")
    .select("id, name, event_id")
    .eq("id", tableId)
    .maybeSingle();

  if (error || !table || table.event_id !== eventId) {
    notFound();
  }

  const backHref = `/manager/events/${eventId}`;

  return (
    <main className="mx-auto w-full max-w-md space-y-6 p-4">
      <Link
        href={backHref}
        className="text-sm text-neutral-600 underline dark:text-zinc-400"
      >
        ← Event
      </Link>
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-zinc-50">
          Rename table
        </h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-zinc-400">
          Standalone page — use the back link or save to return.
        </p>
      </div>
      <TableNameEditStandaloneBody
        eventId={eventId}
        tableId={tableId}
        initialName={table.name}
      />
    </main>
  );
}
