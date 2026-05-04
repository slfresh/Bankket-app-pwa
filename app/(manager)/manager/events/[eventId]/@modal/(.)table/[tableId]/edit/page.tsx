import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TableNameEditModal } from "@/components/manager/TableNameEditModal";

type PageProps = { params: Promise<{ eventId: string; tableId: string }> };

export default async function InterceptTableRenamePage({ params }: PageProps) {
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

  return (
    <TableNameEditModal eventId={eventId} tableId={tableId} initialName={table.name} />
  );
}
