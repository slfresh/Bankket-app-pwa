"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getStaffSession } from "@/lib/auth/session";
import { revalidateBanquetEventTag } from "@/lib/cache/revalidate-banquet-event";
import { mapSupabaseError } from "@/lib/errors/map-supabase-error";
import {
  cancelOrderSchema,
  placeOrderSchema,
  placeSeatOrdersBatchSchema,
  updateSeatGuestNoteSchema,
} from "@/lib/validation/actions";
import {
  normalizeOrderRow,
  type OrderWithRelations,
} from "@/lib/orders/order-with-relations";

function firstZodIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input.";
}

export async function placeOrder(input: unknown) {
  const parsed = placeOrderSchema.safeParse(input);
  if (!parsed.success) {
    return { error: firstZodIssue(parsed.error) };
  }
  const { eventId, tableId, seatNumber, menuItemId, course, specialWishes, guestKitchenNote } =
    parsed.data;

  const { profile } = await getStaffSession();
  if (!profile || (profile.role !== "waiter" && profile.role !== "manager")) {
    return { error: "Forbidden" };
  }

  const supabase = await createClient();

  const { data: event } = await supabase
    .from("events")
    .select("id, is_active")
    .eq("id", eventId)
    .maybeSingle();

  if (!event) {
    return { error: "Event not found." };
  }
  if (!event.is_active) {
    return { error: "This event is not accepting orders." };
  }

  const { data: table } = await supabase
    .from("banquet_tables")
    .select("id, event_id, total_seats")
    .eq("id", tableId)
    .maybeSingle();

  if (!table || table.event_id !== eventId) {
    return { error: "Invalid table for this event." };
  }
  if (seatNumber < 1 || seatNumber > table.total_seats) {
    return { error: "Invalid seat number." };
  }

  const { data: item } = await supabase
    .from("menu_items")
    .select("id, course")
    .eq("id", menuItemId)
    .eq("event_id", eventId)
    .maybeSingle();

  if (!item) {
    return { error: "Invalid menu choice for this event." };
  }
  if (item.course !== course) {
    return { error: "Menu item does not match the selected course." };
  }

  const { data: inserted, error } = await supabase
    .from("orders")
    .insert({
      event_id: eventId,
      table_id: tableId,
      seat_number: seatNumber,
      menu_item_id: menuItemId,
      course,
      special_wishes: specialWishes?.trim() || null,
    })
    .select("*, menu_items(label), banquet_tables(name)")
    .maybeSingle();

  if (error) {
    return { error: mapSupabaseError(error.message) };
  }
  if (!inserted) {
    return { error: "Order could not be created." };
  }

  if (guestKitchenNote !== undefined) {
    const trimmedGuest = guestKitchenNote.trim();
    if (trimmedGuest.length > 0) {
      const { error: noteErr } = await supabase.from("seat_guest_notes").upsert(
        {
          event_id: eventId,
          table_id: tableId,
          seat_number: seatNumber,
          kitchen_notice: trimmedGuest,
        },
        { onConflict: "table_id,seat_number" },
      );
      if (noteErr) {
        return { error: mapSupabaseError(noteErr.message) };
      }
    } else {
      const { error: delErr } = await supabase
        .from("seat_guest_notes")
        .delete()
        .eq("table_id", tableId)
        .eq("seat_number", seatNumber);
      if (delErr) {
        return { error: mapSupabaseError(delErr.message) };
      }
    }
  }

  revalidatePath(`/waiter/${eventId}/t/${tableId}`);
  revalidatePath(`/kitchen/${eventId}`);
  revalidatePath(`/kitchen/today`);
  revalidateBanquetEventTag(eventId);
  const orderRow = normalizeOrderRow(inserted as Record<string, unknown>);
  return { ok: true as const, orders: [orderRow] as OrderWithRelations[] };
}

/**
 * Insert multiple orders for one seat in a single DB round-trip (atomic within Postgres).
 * Validates each menu item like {@link placeOrder}.
 */
export async function placeSeatOrdersBatch(input: unknown) {
  const parsed = placeSeatOrdersBatchSchema.safeParse(input);
  if (!parsed.success) {
    return { error: firstZodIssue(parsed.error) };
  }
  const { eventId, tableId, seatNumber, guestKitchenNote, lines } = parsed.data;

  const { profile } = await getStaffSession();
  if (!profile || (profile.role !== "waiter" && profile.role !== "manager")) {
    return { error: "Forbidden" };
  }

  const supabase = await createClient();

  const { data: event } = await supabase
    .from("events")
    .select("id, is_active")
    .eq("id", eventId)
    .maybeSingle();

  if (!event) {
    return { error: "Event not found." };
  }
  if (!event.is_active) {
    return { error: "This event is not accepting orders." };
  }

  const { data: table } = await supabase
    .from("banquet_tables")
    .select("id, event_id, total_seats")
    .eq("id", tableId)
    .maybeSingle();

  if (!table || table.event_id !== eventId) {
    return { error: "Invalid table for this event." };
  }
  if (seatNumber < 1 || seatNumber > table.total_seats) {
    return { error: "Invalid seat number." };
  }

  const menuIds = [...new Set(lines.map((l) => l.menuItemId))];
  const { data: items, error: itemsErr } = await supabase
    .from("menu_items")
    .select("id, course")
    .eq("event_id", eventId)
    .in("id", menuIds);

  if (itemsErr) {
    return { error: mapSupabaseError(itemsErr.message) };
  }
  const itemById = new Map((items ?? []).map((row) => [row.id, row]));

  for (const line of lines) {
    const item = itemById.get(line.menuItemId);
    if (!item) {
      return { error: "Invalid menu choice for this event." };
    }
    if (item.course !== line.course) {
      return { error: "Menu item does not match the selected course." };
    }
  }

  const insertRows = lines.map((line) => ({
    event_id: eventId,
    table_id: tableId,
    seat_number: seatNumber,
    menu_item_id: line.menuItemId,
    course: line.course,
    special_wishes: line.specialWishes?.trim() || null,
  }));

  const { data: insertedRows, error: insertErr } = await supabase
    .from("orders")
    .insert(insertRows)
    .select("*, menu_items(label), banquet_tables(name)");

  if (insertErr) {
    return { error: mapSupabaseError(insertErr.message) };
  }
  if (!insertedRows?.length) {
    return { error: "Orders could not be created." };
  }

  if (guestKitchenNote !== undefined) {
    const trimmedGuest = guestKitchenNote.trim();
    if (trimmedGuest.length > 0) {
      const { error: noteErr } = await supabase.from("seat_guest_notes").upsert(
        {
          event_id: eventId,
          table_id: tableId,
          seat_number: seatNumber,
          kitchen_notice: trimmedGuest,
        },
        { onConflict: "table_id,seat_number" },
      );
      if (noteErr) {
        return { error: mapSupabaseError(noteErr.message) };
      }
    } else {
      const { error: delErr } = await supabase
        .from("seat_guest_notes")
        .delete()
        .eq("table_id", tableId)
        .eq("seat_number", seatNumber);
      if (delErr) {
        return { error: mapSupabaseError(delErr.message) };
      }
    }
  }

  revalidatePath(`/waiter/${eventId}/t/${tableId}`);
  revalidatePath(`/kitchen/${eventId}`);
  revalidatePath(`/kitchen/today`);
  revalidateBanquetEventTag(eventId);
  const orders = insertedRows.map((r) => normalizeOrderRow(r as Record<string, unknown>));
  return { ok: true as const, orders };
}

export async function updateSeatGuestNote(input: unknown) {
  const parsed = updateSeatGuestNoteSchema.safeParse(input);
  if (!parsed.success) {
    return { error: firstZodIssue(parsed.error) };
  }
  const { eventId, tableId, seatNumber, kitchenNotice } = parsed.data;

  const { profile } = await getStaffSession();
  if (!profile || (profile.role !== "waiter" && profile.role !== "manager")) {
    return { error: "Forbidden" };
  }

  const supabase = await createClient();

  const { data: table } = await supabase
    .from("banquet_tables")
    .select("id, event_id, total_seats")
    .eq("id", tableId)
    .maybeSingle();

  if (!table || table.event_id !== eventId) {
    return { error: "Invalid table for this event." };
  }
  if (seatNumber < 1 || seatNumber > table.total_seats) {
    return { error: "Invalid seat number." };
  }

  const trimmed = kitchenNotice.trim();
  if (trimmed.length === 0) {
    const { error } = await supabase
      .from("seat_guest_notes")
      .delete()
      .eq("table_id", tableId)
      .eq("seat_number", seatNumber);
    if (error) {
      return { error: mapSupabaseError(error.message) };
    }
  } else {
    const { error } = await supabase.from("seat_guest_notes").upsert(
      {
        event_id: eventId,
        table_id: tableId,
        seat_number: seatNumber,
        kitchen_notice: trimmed,
      },
      { onConflict: "table_id,seat_number" },
    );
    if (error) {
      return { error: mapSupabaseError(error.message) };
    }
  }

  revalidatePath(`/waiter/${eventId}/t/${tableId}`);
  revalidatePath(`/kitchen/${eventId}`);
  revalidatePath(`/kitchen/today`);
  revalidateBanquetEventTag(eventId);
  return { ok: true as const };
}

/** Remove a pending order (wrong seat / wrong choice) before the kitchen has cooked it. */
export async function cancelPendingOrder(input: unknown) {
  const parsed = cancelOrderSchema.safeParse(input);
  if (!parsed.success) {
    return { error: firstZodIssue(parsed.error) };
  }
  const { eventId, tableId, orderId } = parsed.data;

  const { profile } = await getStaffSession();
  if (!profile || (profile.role !== "waiter" && profile.role !== "manager")) {
    return { error: "Forbidden" };
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("orders")
    .delete()
    .eq("id", orderId)
    .eq("event_id", eventId)
    .eq("table_id", tableId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (error) {
    return { error: mapSupabaseError(error.message) };
  }
  if (!data) {
    return { error: "Order not found or cannot be cancelled (only pending orders)." };
  }

  revalidatePath(`/waiter/${eventId}/t/${tableId}`);
  revalidatePath(`/kitchen/${eventId}`);
  revalidatePath(`/kitchen/today`);
  revalidateBanquetEventTag(eventId);
  return { ok: true as const, deletedOrderId: orderId };
}
