"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { defaultFloorGridPosition } from "@/lib/domain/floor-plan";
import type { Database, MenuCourse, TableLayout } from "@/lib/database.types";
import { getStaffSession } from "@/lib/auth/session";
import {
  createEventFormSchema,
  deleteTableSchema,
  eventIdSchema,
  floorPlanSchema,
  generateTablesSchema,
  menuCourseSchema,
  menuItemLabelSchema,
  updateTableLayoutLegsSchema,
  updateTableNameSchema,
} from "@/lib/validation/actions";
import { z } from "zod";
import { mapSupabaseError } from "@/lib/errors/map-supabase-error";
import { revalidateBanquetEventTag } from "@/lib/cache/revalidate-banquet-event";

type DbClient = SupabaseClient<Database>;

const menuAndEventIdsSchema = z.object({
  menuItemId: z.string().uuid(),
  eventId: z.string().uuid(),
});

async function assertManager() {
  const { profile } = await getStaffSession();
  if (profile?.role !== "manager") {
    return { ok: false as const, error: "Forbidden" };
  }
  return { ok: true as const, supabase: await createClient() };
}

/** Ensures the event exists before mutating rows scoped by event_id (defense in depth with RLS). */
async function requireManagerEvent(
  supabase: DbClient,
  eventId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from("events")
    .select("id")
    .eq("id", eventId)
    .maybeSingle();

  if (error) {
    return { ok: false, error: mapSupabaseError(error.message) };
  }
  if (!data) {
    return { ok: false, error: "Event not found." };
  }
  return { ok: true };
}

function firstZodIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input.";
}

export async function createEvent(
  formData: FormData,
): Promise<{ error: string } | { id: string }> {
  const gate = await assertManager();
  if (!gate.ok) {
    return { error: gate.error };
  }
  const supabase = gate.supabase;

  const parsed = createEventFormSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    room_location: String(formData.get("room_location") ?? ""),
    event_date: String(formData.get("event_date") ?? ""),
  });
  if (!parsed.success) {
    return { error: firstZodIssue(parsed.error) };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { name, room_location, event_date } = parsed.data;

  const { data, error } = await supabase
    .from("events")
    .insert({
      name,
      room_location,
      event_date: new Date(event_date).toISOString(),
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();

  if (error) {
    return { error: mapSupabaseError(error.message) };
  }

  revalidatePath("/manager");
  revalidatePath("/waiter");
  revalidatePath("/kitchen");
  revalidateBanquetEventTag(data.id);
  return { id: data.id };
}

export async function setEventActive(eventId: string, is_active: boolean) {
  const gate = await assertManager();
  if (!gate.ok) {
    return { error: gate.error };
  }
  const idParsed = eventIdSchema.safeParse(eventId);
  if (!idParsed.success) {
    return { error: "Invalid event." };
  }
  const ev = await requireManagerEvent(gate.supabase, idParsed.data);
  if (!ev.ok) {
    return { error: ev.error };
  }
  const { data, error } = await gate.supabase
    .from("events")
    .update({ is_active })
    .eq("id", idParsed.data)
    .select("id")
    .maybeSingle();
  if (error) {
    return { error: mapSupabaseError(error.message) };
  }
  if (!data) {
    return { error: "Event not found." };
  }
  const id = idParsed.data;
  revalidatePath("/manager");
  revalidatePath(`/manager/events/${id}`);
  revalidatePath("/waiter");
  revalidatePath("/kitchen");
  revalidatePath("/kitchen/today");
  revalidatePath(`/waiter/${id}`);
  revalidatePath(`/kitchen/${id}`);
  revalidateBanquetEventTag(id);
  return { ok: true };
}

export async function deleteEvent(eventId: string) {
  const gate = await assertManager();
  if (!gate.ok) {
    return { error: gate.error };
  }
  const idParsed = eventIdSchema.safeParse(eventId);
  if (!idParsed.success) {
    return { error: "Invalid event." };
  }
  const ev = await requireManagerEvent(gate.supabase, idParsed.data);
  if (!ev.ok) {
    return { error: ev.error };
  }
  const eventPk = idParsed.data;
  // Orders reference menu_items with ON DELETE RESTRICT, so Postgres cannot cascade
  // event → menu_items while orders still exist. Remove orders first, then the event.
  const { error: ordersDelErr } = await gate.supabase.from("orders").delete().eq("event_id", eventPk);
  if (ordersDelErr) {
    return { error: mapSupabaseError(ordersDelErr.message) };
  }
  const { data, error } = await gate.supabase.from("events").delete().eq("id", eventPk).select("id");
  if (error) {
    return { error: mapSupabaseError(error.message) };
  }
  if (!data?.length) {
    return { error: "Event not found." };
  }
  const deletedId = idParsed.data;
  revalidatePath("/manager");
  revalidatePath("/waiter");
  revalidatePath("/kitchen");
  revalidatePath("/kitchen/today");
  revalidateBanquetEventTag(deletedId);
  redirect("/manager");
}

export async function addMenuItem(eventId: string, label: string, course: MenuCourse) {
  const gate = await assertManager();
  if (!gate.ok) {
    return { error: gate.error };
  }
  const evId = eventIdSchema.safeParse(eventId);
  const labelParsed = menuItemLabelSchema.safeParse(label);
  const courseParsed = menuCourseSchema.safeParse(course);
  if (!evId.success) {
    return { error: "Invalid event." };
  }
  if (!labelParsed.success) {
    return { error: firstZodIssue(labelParsed.error) };
  }
  if (!courseParsed.success) {
    return { error: "Invalid course." };
  }
  const supabase = gate.supabase;
  const allowed = await requireManagerEvent(supabase, evId.data);
  if (!allowed.ok) {
    return { error: allowed.error };
  }
  const trimmed = labelParsed.data;
  const courseVal = courseParsed.data;

  const { count, error: countError } = await supabase
    .from("menu_items")
    .select("*", { count: "exact", head: true })
    .eq("event_id", evId.data)
    .eq("course", courseVal);

  if (countError) {
    return { error: mapSupabaseError(countError.message) };
  }
  if ((count ?? 0) >= 3) {
    return { error: "Maximum 3 menu items per course for this event." };
  }

  const { error } = await supabase.from("menu_items").insert({
    event_id: evId.data,
    label: trimmed,
    course: courseVal,
    sort_order: count ?? 0,
  });
  if (error) {
    return { error: mapSupabaseError(error.message) };
  }
  const eid = evId.data;
  revalidatePath(`/manager/events/${eid}`);
  revalidatePath(`/waiter/${eid}`);
  revalidatePath(`/kitchen/${eid}`);
  revalidateBanquetEventTag(eid);
  return { ok: true };
}

export async function deleteMenuItem(menuItemId: string, eventId: string) {
  const gate = await assertManager();
  if (!gate.ok) {
    return { error: gate.error };
  }
  const ids = menuAndEventIdsSchema.safeParse({ menuItemId, eventId });
  if (!ids.success) {
    return { error: "Invalid request." };
  }
  const ev = await requireManagerEvent(gate.supabase, ids.data.eventId);
  if (!ev.ok) {
    return { error: ev.error };
  }
  const { data, error } = await gate.supabase
    .from("menu_items")
    .delete()
    .eq("id", ids.data.menuItemId)
    .eq("event_id", ids.data.eventId)
    .select("id");
  if (error) {
    return { error: mapSupabaseError(error.message) };
  }
  if (!data?.length) {
    return { error: "Menu item not found for this event." };
  }
  const eid = ids.data.eventId;
  revalidatePath(`/manager/events/${eid}`);
  revalidatePath(`/waiter/${eid}`);
  revalidatePath(`/kitchen/${eid}`);
  revalidateBanquetEventTag(eid);
  return { ok: true };
}

export async function generateTables(
  eventId: string,
  quantity: number,
  seatsPerTable: number,
  namePrefix: string,
  layout: TableLayout,
) {
  const gate = await assertManager();
  if (!gate.ok) {
    return { error: gate.error };
  }
  const supabase = gate.supabase;

  const parsed = generateTablesSchema.safeParse({
    eventId,
    quantity,
    seatsPerTable,
    namePrefix: namePrefix.trim() || "Table",
    layout,
  });
  if (!parsed.success) {
    return { error: firstZodIssue(parsed.error) };
  }

  const { eventId: evId, quantity: qty, seatsPerTable: seats, namePrefix: prefix, layout: lay } =
    parsed.data;

  const ev = await requireManagerEvent(supabase, evId);
  if (!ev.ok) {
    return { error: ev.error };
  }

  const { count: existingCount, error: countError } = await supabase
    .from("banquet_tables")
    .select("id", { count: "exact", head: true })
    .eq("event_id", evId);

  if (countError) {
    return { error: mapSupabaseError(countError.message) };
  }

  const base = existingCount ?? 0;
  const rows = Array.from({ length: qty }, (_, i) => {
    const idx = base + i;
    const pos = defaultFloorGridPosition(idx);
    return {
      event_id: evId,
      name: `${prefix} ${idx + 1}`,
      total_seats: seats,
      layout: lay,
      sort_order: idx,
      floor_x: pos.floor_x,
      floor_y: pos.floor_y,
      floor_rotation: 0,
      layout_config: null,
    };
  });

  const { error } = await supabase.from("banquet_tables").insert(rows);
  if (error) {
    return { error: mapSupabaseError(error.message) };
  }
  revalidatePath(`/manager/events/${evId}`);
  revalidatePath(`/waiter/${evId}`);
  revalidatePath(`/kitchen/${evId}`);
  revalidateBanquetEventTag(evId);
  return { ok: true };
}

export async function updateTableFloorPlan(
  eventId: string,
  tableId: string,
  floor_x: number,
  floor_y: number,
  floor_rotation: number,
): Promise<{ ok: true } | { error: string }> {
  const gate = await assertManager();
  if (!gate.ok) {
    return { error: gate.error };
  }
  const supabase = gate.supabase;

  const parsed = floorPlanSchema.safeParse({
    eventId,
    tableId,
    floor_x,
    floor_y,
    floor_rotation,
  });
  if (!parsed.success) {
    return { error: firstZodIssue(parsed.error) };
  }

  const ev = await requireManagerEvent(supabase, parsed.data.eventId);
  if (!ev.ok) {
    return { error: ev.error };
  }

  const x = Math.min(1, Math.max(0, parsed.data.floor_x));
  const y = Math.min(1, Math.max(0, parsed.data.floor_y));
  let rot = parsed.data.floor_rotation % 360;
  if (rot < 0) {
    rot += 360;
  }

  const { data, error } = await supabase
    .from("banquet_tables")
    .update({
      floor_x: x,
      floor_y: y,
      floor_rotation: rot,
    })
    .eq("id", parsed.data.tableId)
    .eq("event_id", parsed.data.eventId)
    .select("id")
    .maybeSingle();

  if (error) {
    return { error: mapSupabaseError(error.message) };
  }
  if (!data) {
    return { error: "Table not found for this event." };
  }

  const eid = parsed.data.eventId;
  revalidatePath(`/manager/events/${eid}`);
  revalidatePath(`/waiter/${eid}`);
  revalidatePath(`/kitchen/${eid}`);
  revalidateBanquetEventTag(eid);
  return { ok: true };
}

export async function updateBanquetTableName(
  eventId: string,
  tableId: string,
  name: string,
): Promise<{ ok: true } | { error: string }> {
  const gate = await assertManager();
  if (!gate.ok) {
    return { error: gate.error };
  }
  const parsed = updateTableNameSchema.safeParse({ eventId, tableId, name });
  if (!parsed.success) {
    return { error: firstZodIssue(parsed.error) };
  }
  const supabase = gate.supabase;
  const ev = await requireManagerEvent(supabase, parsed.data.eventId);
  if (!ev.ok) {
    return { error: ev.error };
  }
  const { data, error } = await supabase
    .from("banquet_tables")
    .update({ name: parsed.data.name })
    .eq("id", parsed.data.tableId)
    .eq("event_id", parsed.data.eventId)
    .select("id")
    .maybeSingle();
  if (error) {
    return { error: mapSupabaseError(error.message) };
  }
  if (!data) {
    return { error: "Table not found for this event." };
  }
  const eid = parsed.data.eventId;
  revalidatePath(`/manager/events/${eid}`);
  revalidatePath(`/waiter/${eid}`);
  revalidatePath(`/kitchen/${eid}`);
  revalidateBanquetEventTag(eid);
  return { ok: true };
}

export async function updateBanquetTableLShapeLegs(
  eventId: string,
  tableId: string,
  l_legs: [number, number, number],
): Promise<{ ok: true } | { error: string }> {
  const gate = await assertManager();
  if (!gate.ok) {
    return { error: gate.error };
  }
  const parsed = updateTableLayoutLegsSchema.safeParse({ eventId, tableId, l_legs });
  if (!parsed.success) {
    return { error: firstZodIssue(parsed.error) };
  }
  const supabase = gate.supabase;
  const ev = await requireManagerEvent(supabase, parsed.data.eventId);
  if (!ev.ok) {
    return { error: ev.error };
  }

  const { data: table, error: fetchErr } = await supabase
    .from("banquet_tables")
    .select("id, total_seats, layout")
    .eq("id", parsed.data.tableId)
    .eq("event_id", parsed.data.eventId)
    .maybeSingle();

  if (fetchErr) {
    return { error: mapSupabaseError(fetchErr.message) };
  }
  if (!table || table.layout !== "l_shape") {
    return { error: "L-shape leg editor applies only to L-shaped tables." };
  }
  const sum = parsed.data.l_legs[0] + parsed.data.l_legs[1] + parsed.data.l_legs[2];
  if (sum !== table.total_seats) {
    return {
      error: `The three leg counts must sum to ${table.total_seats} (this table’s total seats).`,
    };
  }

  const { data, error } = await supabase
    .from("banquet_tables")
    .update({ layout_config: { l_legs: parsed.data.l_legs } })
    .eq("id", parsed.data.tableId)
    .eq("event_id", parsed.data.eventId)
    .select("id")
    .maybeSingle();

  if (error) {
    return { error: mapSupabaseError(error.message) };
  }
  if (!data) {
    return { error: "Table not found for this event." };
  }
  const eid = parsed.data.eventId;
  revalidatePath(`/manager/events/${eid}`);
  revalidatePath(`/waiter/${eid}`);
  revalidatePath(`/kitchen/${eid}`);
  revalidateBanquetEventTag(eid);
  return { ok: true };
}

export async function clearBanquetTableLayoutConfig(
  eventId: string,
  tableId: string,
): Promise<{ ok: true } | { error: string }> {
  const gate = await assertManager();
  if (!gate.ok) {
    return { error: gate.error };
  }
  const parsed = deleteTableSchema.safeParse({ eventId, tableId });
  if (!parsed.success) {
    return { error: firstZodIssue(parsed.error) };
  }
  const supabase = gate.supabase;
  const ev = await requireManagerEvent(supabase, parsed.data.eventId);
  if (!ev.ok) {
    return { error: ev.error };
  }
  const { data, error } = await supabase
    .from("banquet_tables")
    .update({ layout_config: null })
    .eq("id", parsed.data.tableId)
    .eq("event_id", parsed.data.eventId)
    .select("id")
    .maybeSingle();
  if (error) {
    return { error: mapSupabaseError(error.message) };
  }
  if (!data) {
    return { error: "Table not found for this event." };
  }
  const eid = parsed.data.eventId;
  revalidatePath(`/manager/events/${eid}`);
  revalidatePath(`/waiter/${eid}`);
  revalidatePath(`/kitchen/${eid}`);
  revalidateBanquetEventTag(eid);
  return { ok: true };
}

export async function deleteBanquetTable(
  eventId: string,
  tableId: string,
): Promise<{ ok: true } | { error: string }> {
  const gate = await assertManager();
  if (!gate.ok) {
    return { error: gate.error };
  }
  const parsed = deleteTableSchema.safeParse({ eventId, tableId });
  if (!parsed.success) {
    return { error: firstZodIssue(parsed.error) };
  }
  const supabase = gate.supabase;
  const ev = await requireManagerEvent(supabase, parsed.data.eventId);
  if (!ev.ok) {
    return { error: ev.error };
  }
  const { data, error } = await supabase
    .from("banquet_tables")
    .delete()
    .eq("id", parsed.data.tableId)
    .eq("event_id", parsed.data.eventId)
    .select("id");
  if (error) {
    return { error: mapSupabaseError(error.message) };
  }
  if (!data?.length) {
    return { error: "Table not found for this event." };
  }
  const eid = parsed.data.eventId;
  revalidatePath(`/manager/events/${eid}`);
  revalidatePath(`/waiter/${eid}`);
  revalidatePath(`/kitchen/${eid}`);
  revalidateBanquetEventTag(eid);
  return { ok: true };
}
