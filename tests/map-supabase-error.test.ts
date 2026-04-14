import { describe, expect, it } from "vitest";
import { mapSupabaseError } from "@/lib/errors/map-supabase-error";

describe("mapSupabaseError", () => {
  it("returns a generic message for empty input", () => {
    expect(mapSupabaseError("")).toBe("Something went wrong. Please try again.");
    expect(mapSupabaseError(null)).toBe("Something went wrong. Please try again.");
  });

  it("maps permission and RLS hints", () => {
    expect(mapSupabaseError("new row violates row-level security policy")).toBe(
      "You do not have permission to do that.",
    );
    expect(mapSupabaseError("permission denied for table orders")).toBe(
      "You do not have permission to do that.",
    );
  });

  it("maps session errors", () => {
    expect(mapSupabaseError("JWT expired")).toBe("Your session expired. Sign in again.");
  });

  it("maps not-found and transition errors from RPC", () => {
    expect(mapSupabaseError("Order not found")).toBe(
      "That record was not found or is no longer available.",
    );
    expect(mapSupabaseError("Invalid transition")).toBe(
      "That status change is not allowed right now.",
    );
  });

  it("maps unique constraint violations", () => {
    expect(mapSupabaseError('duplicate key value violates unique constraint "x"')).toBe(
      "That value conflicts with an existing record.",
    );
    expect(mapSupabaseError("23505: unique violation")).toBe(
      "That value conflicts with an existing record.",
    );
  });

  it("does not echo arbitrary internal messages", () => {
    expect(mapSupabaseError("select * from secret.internal_table failed")).toBe(
      "Something went wrong. Please try again.",
    );
  });
});
