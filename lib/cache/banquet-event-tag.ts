/** Next.js cache tag for event-scoped server data (use with `revalidateTag`). */
export function banquetEventTag(eventId: string): string {
  return `banquet-event-${eventId}`;
}
