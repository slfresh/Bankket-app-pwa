import dynamic from "next/dynamic";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const KitchenBoard = dynamic(
  () => import("@/components/kitchen/KitchenBoard").then((m) => m.KitchenBoard),
  {
    loading: () => (
      <div className="flex flex-1 items-center justify-center p-8 text-lg text-neutral-500">
        Loading kitchen board…
      </div>
    ),
  },
);

type PageProps = { params: Promise<{ eventId: string }> };

export default async function KitchenBoardPage({ params }: PageProps) {
  const { eventId } = await params;
  const supabase = await createClient();
  const { data: banquetEvent, error } = await supabase
    .from("events")
    .select("id, name, is_active")
    .eq("id", eventId)
    .maybeSingle();

  if (error || !banquetEvent) {
    notFound();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-neutral-800 px-4 py-3 sm:px-6">
        <Link href="/kitchen" className="text-lg text-neutral-400 underline">
          ← Events
        </Link>
        {!banquetEvent.is_active ? (
          <p className="mt-2 text-lg text-amber-300">This event is inactive — new orders may be blocked.</p>
        ) : null}
      </div>
      <KitchenBoard eventId={eventId} eventName={banquetEvent.name} />
    </div>
  );
}
