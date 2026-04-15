"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { MenuCourse, TableLayout } from "@/lib/database.types";
import { useOrdersRealtime, type OrderWithRelations } from "@/hooks/useOrdersRealtime";
import type { LShapeLayoutConfig } from "@/lib/domain/seat-layout";
import { lShapeLegCounts } from "@/lib/domain/seat-layout";
import {
  MENU_COURSE_ORDER,
  menuCourseShortLabel,
  menuCourseSortIndex,
  menuCourseTitle,
} from "@/lib/domain/menu-course";
import {
  cancelPendingOrder,
  placeOrder,
  placeSeatOrdersBatch,
  updateSeatGuestNote,
} from "@/lib/actions/waiter";
import { useSeatGuestNotesForTable } from "@/hooks/useSeatGuestNotesRealtime";
import { RealtimeConnectionBanner } from "@/components/staff/RealtimeConnectionBanner";

type MenuItem = { id: string; label: string; course: MenuCourse };

type CourseOrderRow = { seat_number: number; course: MenuCourse };

function firstAvailableCourseForSeat(
  seat: number,
  orderRows: readonly CourseOrderRow[],
  menuByCourse: Map<MenuCourse, MenuItem[]>,
): MenuCourse | null {
  for (const c of MENU_COURSE_ORDER) {
    const items = menuByCourse.get(c) ?? [];
    if (items.length === 0) continue;
    const taken = orderRows.some((o) => o.seat_number === seat && o.course === c);
    if (!taken) return c;
  }
  return null;
}

function seatOrderStatus(
  seat: number,
  orderRows: readonly CourseOrderRow[],
  menuByCourse: Map<MenuCourse, MenuItem[]>,
): "empty" | "partial" | "full" {
  const availableCourses = MENU_COURSE_ORDER.filter((c) => (menuByCourse.get(c) ?? []).length > 0);
  if (availableCourses.length === 0) return "empty";
  let ordered = 0;
  for (const c of availableCourses) {
    if (orderRows.some((o) => o.seat_number === seat && o.course === c)) ordered += 1;
  }
  if (ordered === 0) return "empty";
  if (ordered === availableCourses.length) return "full";
  return "partial";
}

function compactSeatButtonClass(status: "empty" | "partial" | "full"): string {
  const tone =
    status === "full"
      ? "border-emerald-600 bg-emerald-500/15 text-emerald-900 dark:border-emerald-500 dark:text-emerald-100"
      : status === "partial"
        ? "border-amber-600 bg-amber-500/10 text-amber-950 dark:border-amber-500 dark:text-amber-100"
        : "border-neutral-200 bg-white text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100";
  return `flex min-h-[48px] w-full flex-col items-center justify-center gap-0.5 rounded-lg border px-1 py-1 text-center text-xs font-semibold transition active:scale-[0.98] disabled:opacity-60 ${tone}`;
}

type SeatGridProps = {
  eventId: string;
  tableId: string;
  tableName: string;
  totalSeats: number;
  layout: TableLayout;
  lShapeConfig?: LShapeLayoutConfig | null;
  menuItems: MenuItem[];
  /** Kitchen table preview: same layout as waiter, but no orders, notes, or cancellations. */
  readOnly?: boolean;
};

function sortOrdersForSeat(list: OrderWithRelations[]): OrderWithRelations[] {
  return [...list].sort(
    (a, b) =>
      menuCourseSortIndex(a.course) - menuCourseSortIndex(b.course) ||
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
}

export function SeatGrid({
  eventId,
  tableId,
  tableName,
  totalSeats,
  layout,
  lShapeConfig = null,
  menuItems,
  readOnly = false,
}: SeatGridProps) {
  const { orders, loading, error, realtimeState, realtimeMessage, refetch } = useOrdersRealtime({
    eventId,
    tableId,
  });
  const {
    bySeatNumber: guestNotesBySeat,
    refetch: refetchNotes,
    error: guestNotesError,
  } = useSeatGuestNotesForTable(eventId, tableId);
  const [pending, startTransition] = useTransition();
  const [modalSeat, setModalSeat] = useState<number | null>(null);
  const [detailSeat, setDetailSeat] = useState<number | null>(null);
  const [noteModalSeat, setNoteModalSeat] = useState<number | null>(null);
  const [cancelOrderId, setCancelOrderId] = useState<string | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<MenuCourse>("main");
  const [selectedMenuId, setSelectedMenuId] = useState<string>("");
  const [guestKitchenNote, setGuestKitchenNote] = useState("");
  const [courseWish, setCourseWish] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [orderModalTip, setOrderModalTip] = useState<string | null>(null);
  const [batchSendOpen, setBatchSendOpen] = useState(false);
  const [batchLineSelection, setBatchLineSelection] = useState<Partial<Record<MenuCourse, string>>>(
    {},
  );
  const [batchWishes, setBatchWishes] = useState<Partial<Record<MenuCourse, string>>>({});

  const orderDialogRef = useRef<HTMLDivElement>(null);
  const detailDialogRef = useRef<HTMLDivElement>(null);
  const noteDialogRef = useRef<HTMLDivElement>(null);
  const cancelDialogRef = useRef<HTMLDivElement>(null);

  const bySeatOrders = useMemo(() => {
    const map = new Map<number, OrderWithRelations[]>();
    for (const o of orders) {
      const list = map.get(o.seat_number) ?? [];
      list.push(o);
      map.set(o.seat_number, list);
    }
    for (const [seat, list] of map) {
      map.set(seat, sortOrdersForSeat(list));
    }
    return map;
  }, [orders]);

  const menuByCourse = useMemo(() => {
    const m = new Map<MenuCourse, MenuItem[]>();
    for (const c of MENU_COURSE_ORDER) {
      m.set(
        c,
        menuItems.filter((x) => x.course === c),
      );
    }
    return m;
  }, [menuItems]);

  const seats = Array.from({ length: totalSeats }, (_, i) => i + 1);

  function firstAvailableCourse(seat: number): MenuCourse | null {
    return firstAvailableCourseForSeat(seat, orders, menuByCourse);
  }

  function openDetailSheet(seat: number) {
    setFormError(null);
    setDetailSeat(seat);
  }

  function prepareOrderModalForSeat(seat: number): boolean {
    if (menuItems.length === 0) {
      setFormError("No menu items for this event yet.");
      return false;
    }
    const nextCourse = firstAvailableCourse(seat);
    if (nextCourse === null) {
      setFormError(
        "Every course is already ordered for this seat. Cancel a pending order for one course to change it, or use Guest note for allergies.",
      );
      return false;
    }
    setFormError(null);
    setOrderModalTip(null);
    setBatchSendOpen(false);
    setSelectedCourse(nextCourse);
    const firstId = (menuByCourse.get(nextCourse) ?? [])[0]?.id ?? "";
    setSelectedMenuId(firstId);
    setGuestKitchenNote(guestNotesBySeat.get(seat)?.kitchen_notice?.trim() ?? "");
    setCourseWish("");
    return true;
  }

  function openOrderFromDetail(seat: number) {
    if (!prepareOrderModalForSeat(seat)) return;
    setDetailSeat(null);
    setModalSeat(seat);
  }

  function openGuestNoteModal(seat: number) {
    setFormError(null);
    setNoteDraft(guestNotesBySeat.get(seat)?.kitchen_notice ?? "");
    setNoteModalSeat(seat);
  }

  const itemsForSelectedCourse = useMemo(
    () => menuByCourse.get(selectedCourse) ?? [],
    [menuByCourse, selectedCourse],
  );

  const missingCoursesForModalSeat = useMemo(() => {
    if (modalSeat === null) return [] as MenuCourse[];
    return MENU_COURSE_ORDER.filter((c) => {
      const items = menuByCourse.get(c) ?? [];
      if (items.length === 0) return false;
      return !orders.some((o) => o.seat_number === modalSeat && o.course === c);
    });
  }, [modalSeat, orders, menuByCourse]);

  useEffect(() => {
    if (itemsForSelectedCourse.length && !itemsForSelectedCourse.some((m) => m.id === selectedMenuId)) {
      setSelectedMenuId(itemsForSelectedCourse[0]?.id ?? "");
    }
  }, [selectedCourse, itemsForSelectedCourse, selectedMenuId]);

  useEffect(() => {
    if (!batchSendOpen || modalSeat === null || missingCoursesForModalSeat.length === 0) return;
    setBatchLineSelection((prev) => {
      const next = { ...prev };
      for (const c of missingCoursesForModalSeat) {
        if (!next[c]) {
          next[c] = (menuByCourse.get(c) ?? [])[0]?.id ?? "";
        }
      }
      return next;
    });
  }, [batchSendOpen, modalSeat, missingCoursesForModalSeat, menuByCourse]);

  useEffect(() => {
    const open =
      modalSeat !== null ||
      detailSeat !== null ||
      noteModalSeat !== null ||
      cancelOrderId !== null;
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.preventDefault();
      if (readOnly) {
        if (detailSeat !== null) setDetailSeat(null);
        return;
      }
      if (cancelOrderId) setCancelOrderId(null);
      else if (noteModalSeat !== null) setNoteModalSeat(null);
      else if (modalSeat !== null) {
        setModalSeat(null);
        setOrderModalTip(null);
        setBatchSendOpen(false);
      } else if (detailSeat !== null) setDetailSeat(null);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [modalSeat, detailSeat, noteModalSeat, cancelOrderId, readOnly]);

  useEffect(() => {
    const el =
      !readOnly && cancelOrderId
        ? cancelDialogRef.current
        : !readOnly && noteModalSeat !== null
          ? noteDialogRef.current
          : !readOnly && modalSeat !== null
            ? orderDialogRef.current
            : detailSeat !== null
              ? detailDialogRef.current
              : null;
    if (!el) return;
    const focusable = el.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    window.requestAnimationFrame(() => {
      (focusable ?? el).focus();
    });
  }, [modalSeat, detailSeat, noteModalSeat, cancelOrderId, readOnly]);

  function renderSeatButton(seat: number) {
    const status = seatOrderStatus(seat, orders, menuByCourse);
    const guestLine = guestNotesBySeat.get(seat)?.kitchen_notice?.trim();
    const statusLabel =
      status === "empty" ? "No orders" : status === "partial" ? "Partial" : "All courses";
    return (
      <button
        type="button"
        disabled={pending}
        onClick={() => openDetailSheet(seat)}
        className={compactSeatButtonClass(status)}
        aria-label={`Seat ${seat}, ${statusLabel}${guestLine ? ", has guest kitchen note" : ""}. Open seat details.`}
      >
        <span className="leading-tight">Seat {seat}</span>
        <span className="flex items-center justify-center gap-1 text-[10px] font-normal leading-tight text-neutral-600 dark:text-neutral-400">
          <span className="truncate">{statusLabel}</span>
          {guestLine ? (
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500"
              title="Guest kitchen note"
              aria-hidden
            />
          ) : null}
        </span>
      </button>
    );
  }

  const topSeatCount = Math.ceil(totalSeats / 2);
  const topSeats = seats.slice(0, topSeatCount);
  const bottomSeats = seats.slice(topSeatCount);
  const seatColClass =
    layout === "round" ? "w-[22%] max-w-[4.75rem] min-w-[3.5rem]" : "w-[4.5rem] shrink-0";

  return (
    <div>
      {error ? (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      ) : null}
      {guestNotesError ? (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
          Guest notes could not load ({guestNotesError}). If you just added this feature, apply the
          latest Supabase migration so the <code className="rounded bg-red-100 px-1 dark:bg-red-900">seat_guest_notes</code> table exists.
        </p>
      ) : null}
      {formError && modalSeat === null && noteModalSeat === null && detailSeat === null ? (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
          {formError}
        </p>
      ) : null}
      {loading ? (
        <p className="mb-4 text-sm text-neutral-500">Loading seat status…</p>
      ) : null}
      <RealtimeConnectionBanner
        realtimeState={realtimeState}
        realtimeMessage={realtimeMessage}
        onRefresh={() => {
          void refetch({ silent: true });
          void refetchNotes();
        }}
      />

      {layout === "block" ? (
        <div
          className="mx-auto w-full max-w-3xl space-y-3"
          aria-label={`Block table: seats 1–${topSeatCount} along one long side; seats ${topSeatCount + 1}–${totalSeats} along the opposite side.`}
        >
          <p className="text-center text-[11px] font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            One long side
          </p>
          <div className="flex min-h-0 justify-center gap-2 overflow-x-auto overflow-y-hidden pb-3 [-webkit-overflow-scrolling:touch] [scrollbar-width:thin]">
            {topSeats.map((seat) => (
              <div key={seat} className={seatColClass}>
                {renderSeatButton(seat)}
              </div>
            ))}
          </div>

          <div
            className="mx-auto flex min-h-[5rem] w-[92%] max-w-xl items-center justify-center rounded-2xl border-2 border-dashed border-neutral-400 dark:border-neutral-500"
            aria-hidden
          >
            <span className="px-2 text-center text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
              Table
            </span>
          </div>

          <p className="text-center text-[11px] font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            Opposite long side
          </p>
          <div className="flex min-h-0 justify-center gap-2 overflow-x-auto overflow-y-hidden pb-3 [-webkit-overflow-scrolling:touch] [scrollbar-width:thin]">
            {bottomSeats.map((seat) => (
              <div key={seat} className={seatColClass}>
                {renderSeatButton(seat)}
              </div>
            ))}
          </div>
        </div>
      ) : layout === "l_shape" ? (
        (() => {
          const [n1, n2, n3] = lShapeLegCounts(totalSeats, lShapeConfig);
          const leg1 = seats.slice(0, n1);
          const leg2 = seats.slice(n1, n1 + n2);
          const leg3 = seats.slice(n1 + n2);
          return (
            <div
              className="mx-auto w-full max-w-3xl space-y-3"
              aria-label={`L-shaped table: seats numbered 1 to ${totalSeats} clockwise along the outer L, starting at the top horizontal leg.`}
            >
              {n1 > 0 ? (
                <>
                  <p className="text-center text-[11px] font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                    Top leg (horizontal)
                  </p>
                  <div className="flex min-h-0 justify-center gap-2 overflow-x-auto overflow-y-hidden pb-3 [-webkit-overflow-scrolling:touch] [scrollbar-width:thin]">
                    {leg1.map((seat) => (
                      <div key={seat} className={seatColClass}>
                        {renderSeatButton(seat)}
                      </div>
                    ))}
                  </div>
                </>
              ) : null}

              {n2 > 0 ? (
                <>
                  <p className="text-center text-[11px] font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                    Outer leg (vertical)
                  </p>
                  <div className="flex min-h-0 justify-center gap-2 overflow-x-auto overflow-y-hidden pb-3 [-webkit-overflow-scrolling:touch] [scrollbar-width:thin]">
                    {leg2.map((seat) => (
                      <div key={seat} className={seatColClass}>
                        {renderSeatButton(seat)}
                      </div>
                    ))}
                  </div>
                </>
              ) : null}

              {n3 > 0 ? (
                <>
                  <p className="text-center text-[11px] font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                    Bottom leg (horizontal)
                  </p>
                  <div className="flex min-h-0 justify-center gap-2 overflow-x-auto overflow-y-hidden pb-3 [-webkit-overflow-scrolling:touch] [scrollbar-width:thin]">
                    {leg3.map((seat) => (
                      <div key={seat} className={seatColClass}>
                        {renderSeatButton(seat)}
                      </div>
                    ))}
                  </div>
                </>
              ) : null}

              <div
                className="mx-auto mt-1 h-16 w-[70%] max-w-md border-b-2 border-l-2 border-dashed border-neutral-400 dark:border-neutral-500"
                aria-hidden
              />
            </div>
          );
        })()
      ) : (
        <div className="relative mx-auto aspect-square w-full max-w-[min(100%,26rem)]">
          <div
            className="pointer-events-none absolute inset-[5%] rounded-full border-2 border-dashed border-neutral-400 dark:border-neutral-500"
            aria-hidden
          />
          {seats.map((seat, i) => {
            const n = Math.max(totalSeats, 1);
            const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
            const rPct = 32;
            const x = 50 + rPct * Math.cos(angle);
            const y = 50 + rPct * Math.sin(angle);
            return (
              <div
                key={seat}
                className="absolute w-[22%] max-w-[4.75rem] min-w-[3.5rem]"
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  transform: "translate(-50%, -50%)",
                }}
              >
                {renderSeatButton(seat)}
              </div>
            );
          })}
        </div>
      )}

      {detailSeat !== null ? (
        <div
          className="fixed inset-0 z-[51] flex items-end justify-center bg-black/50 p-4 sm:items-center"
          role="presentation"
          onClick={() => {
            if (!pending) {
              setDetailSeat(null);
            }
          }}
        >
          <div
            ref={detailDialogRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="seat-detail-dialog-title"
            className={`max-h-[85vh] w-full overflow-y-auto rounded-2xl bg-white p-5 shadow-xl outline-none dark:bg-neutral-950 ${
              readOnly ? "max-w-lg" : "max-w-md"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="seat-detail-dialog-title" className="text-lg font-semibold">
              Seat {detailSeat} · {tableName}
            </h2>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              {readOnly
                ? "View only — same layout as the waiter ticket. Use the kitchen board to mark dishes cooked or served."
                : "Full orders, kitchen note, and cancel pending lines. Use Add or change order to send dishes."}
            </p>
            {formError ? (
              <p className="mt-3 text-sm text-red-600 dark:text-red-400">{formError}</p>
            ) : null}
            {readOnly ? (
              <>
                <div className="mt-5 border-t border-neutral-200 pt-5 dark:border-neutral-800">
                  <p className="text-sm font-medium text-red-700 dark:text-red-300">
                    Guest note for kitchen (allergies, all courses)
                  </p>
                  <div className="mt-1 min-h-[3.25rem] rounded-md border border-red-200 bg-neutral-50 px-3 py-2 text-sm leading-snug text-neutral-900 dark:border-red-900/50 dark:bg-neutral-900 dark:text-neutral-100">
                    {guestNotesBySeat.get(detailSeat)?.kitchen_notice?.trim() || (
                      <span className="text-neutral-500 dark:text-neutral-500">None</span>
                    )}
                  </div>
                </div>
                <div className="mt-5 space-y-3">
                  {MENU_COURSE_ORDER.map((c) => {
                    const items = menuByCourse.get(c) ?? [];
                    if (items.length === 0) return null;
                    const seatOrdersList = bySeatOrders.get(detailSeat) ?? [];
                    const o = seatOrdersList.find((x) => x.course === c);
                    return (
                      <div
                        key={c}
                        className="rounded-lg border border-neutral-200 bg-neutral-50/80 p-3 dark:border-neutral-700 dark:bg-neutral-900/60"
                      >
                        <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                          {menuCourseTitle(c)}
                        </p>
                        <p className="mt-3 text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                          Dish
                        </p>
                        <p className="mt-0.5 text-base font-medium text-neutral-900 dark:text-neutral-100">
                          {o?.menu_items?.label ?? "Not ordered"}
                        </p>
                        {o ? (
                          <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                            {o.status}
                          </p>
                        ) : null}
                        <p className="mt-3 text-xs font-medium text-neutral-600 dark:text-neutral-400">
                          Only this plate (optional)
                        </p>
                        <p className="mt-0.5 text-sm leading-snug text-neutral-700 dark:text-neutral-300">
                          {o?.special_wishes?.trim() || "—"}
                        </p>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-6 flex justify-end border-t border-neutral-200 pt-4 dark:border-neutral-800">
                  <button
                    type="button"
                    className="rounded-md bg-neutral-200 px-4 py-2 text-sm font-medium text-neutral-900 dark:bg-neutral-700 dark:text-neutral-100"
                    onClick={() => setDetailSeat(null)}
                  >
                    Close
                  </button>
                </div>
              </>
            ) : (
              <>
                <ul className="mt-4 space-y-3 border-t border-neutral-200 pt-4 dark:border-neutral-800">
                  {MENU_COURSE_ORDER.map((c) => {
                    const items = menuByCourse.get(c) ?? [];
                    const seatOrdersList = bySeatOrders.get(detailSeat) ?? [];
                    const o = seatOrdersList.find((x) => x.course === c);
                    if (items.length === 0 && !o) return null;
                    return (
                      <li key={c} className="text-sm">
                        <div className="font-medium text-neutral-800 dark:text-neutral-200">
                          {menuCourseTitle(c)}
                        </div>
                        {o ? (
                          <div className="mt-1 flex flex-col gap-1 text-neutral-600 dark:text-neutral-400">
                            <span>
                              {o.menu_items?.label ?? "—"} ·{" "}
                              <span className="capitalize">{o.status}</span>
                            </span>
                            {o.special_wishes?.trim() ? (
                              <p className="text-xs leading-snug text-neutral-500 dark:text-neutral-500">
                                <span className="font-medium text-neutral-600 dark:text-neutral-400">
                                  Plate:{" "}
                                </span>
                                {o.special_wishes.trim()}
                              </p>
                            ) : null}
                            {o.status === "pending" ? (
                              <button
                                type="button"
                                disabled={pending}
                                className="self-start text-left text-xs font-medium text-red-700 underline dark:text-red-300"
                                onClick={() => setCancelOrderId(o.id)}
                              >
                                Cancel {menuCourseShortLabel(o.course)}
                              </button>
                            ) : null}
                          </div>
                        ) : (
                          <p className="mt-1 text-neutral-500 dark:text-neutral-400">Not ordered yet</p>
                        )}
                      </li>
                    );
                  })}
                </ul>
                {guestNotesBySeat.get(detailSeat)?.kitchen_notice?.trim() ? (
                  <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-900 dark:bg-red-950 dark:text-red-100">
                    <span className="font-semibold">Kitchen note: </span>
                    {guestNotesBySeat.get(detailSeat)?.kitchen_notice?.trim()}
                  </p>
                ) : (
                  <p className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">No kitchen note yet.</p>
                )}
                <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
                  <button
                    type="button"
                    className="rounded-md px-4 py-2 text-sm font-medium text-neutral-600 dark:text-neutral-300"
                    onClick={() => setDetailSeat(null)}
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    className="rounded-md border border-amber-700 px-4 py-2 text-sm font-medium text-amber-900 dark:border-amber-500 dark:text-amber-100"
                    onClick={() => openGuestNoteModal(detailSeat)}
                  >
                    Edit guest note
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
                    onClick={() => openOrderFromDetail(detailSeat)}
                  >
                    Add or change order
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

      {!readOnly && modalSeat !== null ? (
        <div
          className="fixed inset-0 z-[52] flex items-end justify-center bg-black/50 p-4 sm:items-center"
          role="presentation"
          onClick={() => {
            if (!pending) {
              setModalSeat(null);
              setOrderModalTip(null);
              setBatchSendOpen(false);
            }
          }}
        >
          <div
            ref={orderDialogRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="order-dialog-title"
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl outline-none dark:bg-neutral-950"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="order-dialog-title" className="text-lg font-semibold">
              Seat {modalSeat} · {tableName}
            </h2>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              {orderModalTip ??
                "Choose a course and dish, then send. You can send the next course without closing—tap Done when finished. Guest note applies to every course at this seat."}
            </p>
            {formError ? (
              <p className="mt-3 text-sm text-red-600 dark:text-red-400">{formError}</p>
            ) : null}
            <label className="mt-4 flex flex-col gap-1 text-sm font-medium">
              Course
              <select
                value={selectedCourse}
                onChange={(e) => setSelectedCourse(e.target.value as MenuCourse)}
                className="rounded-md border border-neutral-300 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
              >
                {MENU_COURSE_ORDER.filter((c) => {
                  const items = menuByCourse.get(c) ?? [];
                  if (items.length === 0) return false;
                  return !orders.some((o) => o.seat_number === modalSeat && o.course === c);
                }).map((c) => (
                  <option key={c} value={c}>
                    {menuCourseTitle(c)}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-4 flex flex-col gap-1 text-sm font-medium">
              Dish
              <select
                value={selectedMenuId}
                onChange={(e) => setSelectedMenuId(e.target.value)}
                disabled={itemsForSelectedCourse.length === 0}
                className="rounded-md border border-neutral-300 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
              >
                {itemsForSelectedCourse.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            {itemsForSelectedCourse.length === 0 ? (
              <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
                No menu options for this course — ask a manager to add them.
              </p>
            ) : null}
            <label className="mt-3 flex flex-col gap-1 text-sm font-medium text-red-700 dark:text-red-300">
              Guest note for kitchen (allergies, all courses)
              <textarea
                value={guestKitchenNote}
                onChange={(e) => setGuestKitchenNote(e.target.value)}
                rows={2}
                placeholder="e.g. Gluten allergy — all courses gluten-free"
                className="rounded-md border border-red-200 bg-white px-3 py-2 text-base dark:border-red-900/50 dark:bg-neutral-900"
              />
            </label>
            <label className="mt-3 flex flex-col gap-1 text-sm font-medium">
              Only this plate / course
              <textarea
                value={courseWish}
                onChange={(e) => setCourseWish(e.target.value)}
                rows={2}
                placeholder="e.g. Sauce on the side for this plate"
                className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-base dark:border-neutral-700 dark:bg-neutral-900"
              />
            </label>
            {missingCoursesForModalSeat.length >= 2 ? (
              <div className="mt-4 border-t border-neutral-200 pt-4 dark:border-neutral-800">
                <button
                  type="button"
                  className="text-left text-sm font-medium text-neutral-800 underline dark:text-neutral-200"
                  onClick={() => setBatchSendOpen((open) => !open)}
                >
                  {batchSendOpen ? "Hide" : "Send"} all missing courses at once (
                  {missingCoursesForModalSeat.length} courses)
                </button>
                {batchSendOpen ? (
                  <div className="mt-3 space-y-4">
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      One kitchen notification with all lines below. Uses the guest note field above for this seat.
                    </p>
                    {missingCoursesForModalSeat.map((c) => {
                      const courseItems = menuByCourse.get(c) ?? [];
                      return (
                        <div key={c} className="space-y-2 rounded-lg border border-neutral-200 p-3 dark:border-neutral-700">
                          <p className="text-sm font-medium">{menuCourseTitle(c)}</p>
                          <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600 dark:text-neutral-400">
                            Dish
                            <select
                              value={batchLineSelection[c] ?? ""}
                              onChange={(e) =>
                                setBatchLineSelection((prev) => ({ ...prev, [c]: e.target.value }))
                              }
                              className="rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                            >
                              {courseItems.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600 dark:text-neutral-400">
                            Only this plate (optional)
                            <textarea
                              value={batchWishes[c] ?? ""}
                              onChange={(e) =>
                                setBatchWishes((prev) => ({ ...prev, [c]: e.target.value }))
                              }
                              rows={2}
                              className="rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                            />
                          </label>
                        </div>
                      );
                    })}
                    <button
                      type="button"
                      disabled={pending}
                      className="w-full rounded-md bg-emerald-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-emerald-700"
                      onClick={() => {
                        startTransition(async () => {
                          setFormError(null);
                          const lines = missingCoursesForModalSeat.map((c) => ({
                            course: c,
                            menuItemId: batchLineSelection[c] ?? "",
                            specialWishes: batchWishes[c]?.trim()
                              ? batchWishes[c]!.trim()
                              : null,
                          }));
                          if (lines.some((l) => !l.menuItemId)) {
                            setFormError("Pick a dish for every course in the batch.");
                            return;
                          }
                          const res = await placeSeatOrdersBatch({
                            eventId,
                            tableId,
                            seatNumber: modalSeat,
                            guestKitchenNote,
                            lines,
                          });
                          if ("error" in res && res.error) {
                            setFormError(res.error);
                            return;
                          }
                          await refetch({ silent: true });
                          await refetchNotes({ silent: true });
                          setModalSeat(null);
                          setOrderModalTip(null);
                          setBatchSendOpen(false);
                          setBatchLineSelection({});
                          setBatchWishes({});
                        });
                      }}
                    >
                      {pending ? "Sending…" : "Send all to kitchen"}
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
              {missingCoursesForModalSeat.length >= 2 && batchSendOpen ? (
                <p className="order-first text-xs text-neutral-500 dark:text-neutral-400 sm:order-none sm:mr-auto sm:max-w-[55%]">
                  Use the green <span className="font-medium text-neutral-700 dark:text-neutral-300">Send all to kitchen</span>{" "}
                  button for this batch — single-course send is hidden here.
                </p>
              ) : null}
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  className="rounded-md px-4 py-2 text-sm font-medium text-neutral-600 dark:text-neutral-300"
                  onClick={() => {
                    setModalSeat(null);
                    setOrderModalTip(null);
                    setBatchSendOpen(false);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="rounded-md border border-neutral-400 px-4 py-2 text-sm font-medium text-neutral-800 dark:border-neutral-600 dark:text-neutral-200"
                  onClick={() => {
                    setModalSeat(null);
                    setOrderModalTip(null);
                    setBatchSendOpen(false);
                  }}
                >
                  Done
                </button>
                {!(missingCoursesForModalSeat.length >= 2 && batchSendOpen) ? (
                  <button
                    type="button"
                    disabled={pending || !selectedMenuId || itemsForSelectedCourse.length === 0}
                    className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
                    onClick={() => {
                      startTransition(async () => {
                        setFormError(null);
                        const seatNum = modalSeat;
                        const sentCourse = selectedCourse;
                        const res = await placeOrder({
                          eventId,
                          tableId,
                          seatNumber: seatNum,
                          menuItemId: selectedMenuId,
                          course: sentCourse,
                          specialWishes: courseWish || null,
                          guestKitchenNote,
                        });
                        if ("error" in res && res.error) {
                          setFormError(res.error);
                          return;
                        }
                        await refetch({ silent: true });
                        await refetchNotes({ silent: true });
                        const optimisticRows: CourseOrderRow[] = [
                          ...orders.map((o) => ({ seat_number: o.seat_number, course: o.course })),
                          { seat_number: seatNum, course: sentCourse },
                        ];
                        const nextCourse = firstAvailableCourseForSeat(
                          seatNum,
                          optimisticRows,
                          menuByCourse,
                        );
                        if (nextCourse) {
                          setOrderModalTip(
                            `${menuCourseTitle(sentCourse)} sent to kitchen. Choose the next course or tap Done when finished.`,
                          );
                          setSelectedCourse(nextCourse);
                          setSelectedMenuId((menuByCourse.get(nextCourse) ?? [])[0]?.id ?? "");
                          setCourseWish("");
                        } else {
                          setModalSeat(null);
                          setOrderModalTip(null);
                          setBatchSendOpen(false);
                        }
                      });
                    }}
                  >
                    {pending ? "Sending…" : "Send to kitchen"}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {!readOnly && noteModalSeat !== null ? (
        <div
          className="fixed inset-0 z-[53] flex items-end justify-center bg-black/50 p-4 sm:items-center"
          role="presentation"
          onClick={() => {
            if (!pending) {
              setNoteModalSeat(null);
            }
          }}
        >
          <div
            ref={noteDialogRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="note-dialog-title"
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl outline-none dark:bg-neutral-950"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="note-dialog-title" className="text-lg font-semibold">
              Guest note · Seat {noteModalSeat} · {tableName}
            </h2>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              Shown to the kitchen for every course at this seat. Leave empty to remove.
            </p>
            {formError ? (
              <p className="mt-3 text-sm text-red-600 dark:text-red-400">{formError}</p>
            ) : null}
            <label className="mt-4 flex flex-col gap-1 text-sm font-medium text-red-700 dark:text-red-300">
              Kitchen notice
              <textarea
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                rows={4}
                className="rounded-md border border-red-200 bg-white px-3 py-2 text-base dark:border-red-900/50 dark:bg-neutral-900"
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md px-4 py-2 text-sm font-medium text-neutral-600 dark:text-neutral-300"
                onClick={() => setNoteModalSeat(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pending}
                className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
                onClick={() => {
                  startTransition(async () => {
                    setFormError(null);
                    const res = await updateSeatGuestNote({
                      eventId,
                      tableId,
                      seatNumber: noteModalSeat,
                      kitchenNotice: noteDraft,
                    });
                    if ("error" in res && res.error) {
                      setFormError(res.error);
                      return;
                    }
                    await refetchNotes({ silent: true });
                    setNoteModalSeat(null);
                  });
                }}
              >
                {pending ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {!readOnly && cancelOrderId !== null ? (
        <div
          className="fixed inset-0 z-[54] flex items-end justify-center bg-black/50 p-4 sm:items-center"
          role="presentation"
          onClick={() => !pending && setCancelOrderId(null)}
        >
          <div
            ref={cancelDialogRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-dialog-title"
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl outline-none dark:bg-neutral-950"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="cancel-dialog-title" className="text-lg font-semibold">
              Cancel pending order?
            </h2>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
              Only use this if the guest changed their mind before the kitchen started cooking.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md px-4 py-2 text-sm font-medium text-neutral-600 dark:text-neutral-300"
                onClick={() => setCancelOrderId(null)}
              >
                Keep order
              </button>
              <button
                type="button"
                disabled={pending}
                className="rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                onClick={() => {
                  startTransition(async () => {
                    setFormError(null);
                    const res = await cancelPendingOrder({
                      eventId,
                      tableId,
                      orderId: cancelOrderId,
                    });
                    setCancelOrderId(null);
                    if ("error" in res && res.error) {
                      setFormError(res.error);
                      return;
                    }
                    await refetch({ silent: true });
                  });
                }}
              >
                {pending ? "Removing…" : "Remove order"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
