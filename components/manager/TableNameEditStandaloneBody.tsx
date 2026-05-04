"use client";

import { useRouter } from "next/navigation";
import { TableNameEditPanel } from "@/components/manager/TableNameEditPanel";

export function TableNameEditStandaloneBody({
  eventId,
  tableId,
  initialName,
}: {
  eventId: string;
  tableId: string;
  initialName: string;
}) {
  const router = useRouter();
  const back = () => {
    router.push(`/manager/events/${eventId}`);
  };
  return (
    <TableNameEditPanel eventId={eventId} tableId={tableId} initialName={initialName} onSaved={back} />
  );
}
