import Link from "next/link";
import { CreateEventForm } from "@/components/manager/CreateEventForm";

export default function NewEventPage() {
  return (
    <main className="mx-auto w-full max-w-3xl p-4">
      <Link
        href="/manager"
        className="text-sm text-neutral-600 underline dark:text-neutral-400"
      >
        ← Back to events
      </Link>
      <h1 className="mt-4 text-xl font-semibold">New event</h1>
      <div className="mt-6">
        <CreateEventForm />
      </div>
    </main>
  );
}
