/**
 * Maps Supabase/PostgREST error strings to short staff-facing messages.
 * Avoids leaking internal schema or SQL details to the UI.
 */
export function mapSupabaseError(raw: string | null | undefined): string {
  const msg = (raw ?? "").trim();
  if (!msg) {
    return "Something went wrong. Please try again.";
  }
  const lower = msg.toLowerCase();

  if (
    lower.includes("forbidden") ||
    lower.includes("permission denied") ||
    lower.includes("rls") ||
    lower.includes("row-level security")
  ) {
    return "You do not have permission to do that.";
  }
  if (lower.includes("jwt") || lower.includes("session") || lower.includes("invalid login")) {
    return "Your session expired. Sign in again.";
  }
  if (lower.includes("order not found") || lower.includes("not found")) {
    return "That record was not found or is no longer available.";
  }
  if (lower.includes("invalid transition")) {
    return "That status change is not allowed right now.";
  }
  if (lower.includes("maximum 3 menu items") || lower.includes("maximum 3")) {
    return "Maximum menu options for this course reached.";
  }
  if (lower.includes("unique") || lower.includes("duplicate") || lower.includes("23505")) {
    return "That value conflicts with an existing record.";
  }
  if (lower.includes("foreign key") || lower.includes("23503")) {
    return "Related data is missing or was removed.";
  }
  if (lower.includes("network") || lower.includes("fetch") || lower.includes("timeout")) {
    return "Network error. Check your connection and try again.";
  }

  return "Something went wrong. Please try again.";
}
