import { revalidateTag } from "next/cache";
import { banquetEventTag } from "./banquet-event-tag";

/** Invalidate Next.js cache entries tagged for this event (`"use cache"` / `cacheTag`). */
export function revalidateBanquetEventTag(eventId: string): void {
  revalidateTag(banquetEventTag(eventId), "max");
}
