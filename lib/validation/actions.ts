import { z } from "zod";
import type { MenuCourse, TableLayout } from "@/lib/database.types";

const uuid = z.string().uuid("Invalid id.");
const tableLayout = z.enum(["round", "block", "l_shape"]) satisfies z.ZodType<TableLayout>;
export const menuCourseSchema = z.enum(["starter", "main", "dessert"]) satisfies z.ZodType<MenuCourse>;

export const createEventFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(200),
  room_location: z.string().trim().min(1, "Room / location is required.").max(500),
  event_date: z
    .string()
    .trim()
    .min(1, "Date is required.")
    .refine((s) => !Number.isNaN(Date.parse(s)), "Invalid date or time."),
});

export const eventIdSchema = uuid;
export const menuItemLabelSchema = z.string().trim().min(1, "Label is required.").max(200);

export const generateTablesSchema = z.object({
  eventId: uuid,
  quantity: z.number().int().min(1).max(200),
  seatsPerTable: z.number().int().min(1).max(50),
  namePrefix: z.string().max(100),
  layout: tableLayout,
});

export const floorPlanSchema = z.object({
  eventId: uuid,
  tableId: uuid,
  floor_x: z.number().finite(),
  floor_y: z.number().finite(),
  floor_rotation: z.number().finite(),
});

export const placeOrderSchema = z.object({
  eventId: uuid,
  tableId: uuid,
  seatNumber: z.coerce.number().int().min(1).max(50),
  menuItemId: uuid,
  course: menuCourseSchema,
  specialWishes: z.string().max(2000).nullable(),
  /** Allergies / guest-wide kitchen notice. Omit to leave existing note unchanged. */
  guestKitchenNote: z.string().max(2000).optional(),
});

export const placeSeatOrdersBatchLineSchema = z.object({
  course: menuCourseSchema,
  menuItemId: uuid,
  specialWishes: z.string().max(2000).nullable().optional(),
});

export const placeSeatOrdersBatchSchema = z.object({
  eventId: uuid,
  tableId: uuid,
  seatNumber: z.coerce.number().int().min(1).max(50),
  guestKitchenNote: z.string().max(2000).optional(),
  lines: z
    .array(placeSeatOrdersBatchLineSchema)
    .min(1, "At least one course line is required.")
    .max(3, "At most three course lines."),
}).refine(
  (data) => new Set(data.lines.map((l) => l.course)).size === data.lines.length,
  { message: "Each line must use a different course.", path: ["lines"] },
);

export const updateSeatGuestNoteSchema = z.object({
  eventId: uuid,
  tableId: uuid,
  seatNumber: z.coerce.number().int().min(1).max(50),
  kitchenNotice: z.string().max(2000),
});

export const cancelOrderSchema = z.object({
  eventId: uuid,
  tableId: uuid,
  orderId: uuid,
});

export const advanceOrderStatusSchema = z.object({
  orderId: uuid,
  nextStatus: z.enum(["cooked", "served"]),
});

export const updateTableNameSchema = z.object({
  eventId: uuid,
  tableId: uuid,
  name: z.string().trim().min(1, "Name is required.").max(200),
});

export const updateTableLayoutLegsSchema = z.object({
  eventId: uuid,
  tableId: uuid,
  l_legs: z.tuple([
    z.number().int().min(0),
    z.number().int().min(0),
    z.number().int().min(0),
  ]),
});

export const deleteTableSchema = z.object({
  eventId: uuid,
  tableId: uuid,
});
