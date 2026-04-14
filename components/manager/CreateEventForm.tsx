"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { createEvent } from "@/lib/actions/manager";

/** `datetime-local` value in the browser's local timezone (no `Z` suffix). */
function toDatetimeLocalValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Next quarter-hour at least one hour from now — good default for a dinner service. */
function defaultEventDateTimeLocal(): string {
  const d = new Date();
  d.setSeconds(0, 0);
  d.setHours(d.getHours() + 1);
  const m = d.getMinutes();
  const remainder = m % 15;
  if (remainder !== 0) {
    d.setMinutes(m + (15 - remainder));
  }
  return toDatetimeLocalValue(d);
}

export function CreateEventForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [eventDate, setEventDate] = useState("");
  const [minDate, setMinDate] = useState("");

  useEffect(() => {
    setEventDate((prev) => (prev ? prev : defaultEventDateTimeLocal()));
    setMinDate(toDatetimeLocalValue(new Date()));
  }, []);

  return (
    <form
      method="post"
      action="/manager/events/new"
      data-testid="create-event-form"
      className="flex max-w-lg flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        startTransition(async () => {
          setError(null);
          const result = await createEvent(formData);
          if ("error" in result) {
            setError(result.error);
          } else {
            router.push(`/manager/events/${result.id}`);
          }
        });
      }}
    >
      {error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      ) : null}
      <label className="flex flex-col gap-1 text-sm font-medium">
        Event name
        <input
          required
          name="name"
          maxLength={200}
          className="rounded-md border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Room / location
        <input
          required
          name="room_location"
          maxLength={500}
          placeholder="Salon 4, Restaurant…"
          className="rounded-md border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Event date and time
        <input
          required
          name="event_date"
          type="datetime-local"
          min={minDate || undefined}
          value={eventDate}
          onChange={(e) => setEventDate(e.target.value)}
          className="min-h-11 rounded-md border border-neutral-300 px-3 py-2 text-base dark:border-neutral-700 dark:bg-neutral-900"
        />
        <span className="text-xs font-normal text-neutral-500">
          Opens your device date and time picker. Default time is rounded to the next quarter hour (you can pick any
          minute). Uses local time; stored in UTC in the database.
        </span>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900"
      >
        {pending ? "Creating…" : "Create event"}
      </button>
    </form>
  );
}
