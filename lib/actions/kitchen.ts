"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getStaffSession } from "@/lib/auth/session";
import { mapSupabaseError } from "@/lib/errors/map-supabase-error";
import { revalidateBanquetEventTag } from "@/lib/cache/revalidate-banquet-event";
import { advanceOrderStatusSchema } from "@/lib/validation/actions";

function firstZodIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input.";
}

export async function advanceOrderStatus(input: unknown) {
  const parsed = advanceOrderStatusSchema.safeParse(input);
  if (!parsed.success) {
    return { error: firstZodIssue(parsed.error) };
  }

  const { profile } = await getStaffSession();
  if (!profile || (profile.role !== "kitchen" && profile.role !== "manager")) {
    return { error: "Forbidden" };
  }

  const supabase = await createClient();
  const { orderId, nextStatus } = parsed.data;

  const { data: row, error: fetchErr } = await supabase
    .from("orders")
    .select("id, event_id, table_id")
    .eq("id", orderId)
    .maybeSingle();

  if (fetchErr) {
    return { error: mapSupabaseError(fetchErr.message) };
  }
  if (!row) {
    return { error: mapSupabaseError("Order not found") };
  }

  const { error } = await supabase.rpc("advance_order_status", {
    order_id: orderId,
    next_status: nextStatus,
  });

  if (error) {
    return { error: mapSupabaseError(error.message) };
  }

  const evId = row.event_id;
  const tableId = row.table_id;
  revalidatePath(`/kitchen/${evId}`);
  revalidatePath(`/kitchen/today`);
  revalidatePath(`/waiter/${evId}`);
  revalidatePath(`/waiter/${evId}/t/${tableId}`);
  revalidateBanquetEventTag(evId);
  return { ok: true as const };
}
