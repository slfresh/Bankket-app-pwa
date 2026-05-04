"use client";

import Link from "next/link";
import {
  memo,
  useEffect,
  useMemo,
  useState,
} from "react";
import { menuCourseTitle } from "@/lib/domain/menu-course";
import {
  buildTableTicket,
  courseHeadingAccentClass,
  courseStripeClass,
  type TableTicket,
} from "@/lib/kitchen/ticket-model";
import {
  flashingOrderSig,
  guestFingerprintForTableRows,
  ordersContentSig,
} from "@/lib/kitchen/order-board-utils";
import type { OrderWithRelations } from "@/lib/orders/order-with-relations";

/** Thresholds for the age escalation: fresh → watch → late (in minutes). */
const AGE_WATCH_MIN = 5;
const AGE_LATE_MIN = 10;

function ageTier(minutes: number): "fresh" | "watch" | "late" {
  if (minutes >= AGE_LATE_MIN) return "late";
  if (minutes >= AGE_WATCH_MIN) return "watch";
  return "fresh";
}

/** Pill classes — pulse only when motion is allowed (`kitchen-age-pulse` in globals.css). */
function ageBadgeClass(tier: "fresh" | "watch" | "late"): string {
  if (tier === "late") {
    return "bg-[color-mix(in_oklab,var(--kitchen-danger-muted)_92%,transparent)] text-red-200 border border-[color-mix(in_oklab,var(--kitchen-danger)_55%,transparent)] kitchen-age-pulse";
  }
  if (tier === "watch") {
    return "bg-amber-500/20 text-amber-100 border border-amber-400/50";
  }
  return "bg-emerald-500/15 text-emerald-200 border border-emerald-400/40";
}

function formatAge(minutes: number): string {
  if (minutes < 1) return "<1m";
  if (minutes < 60) return `${Math.floor(minutes)}m`;
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  return m === 0 ? `${h}h` : `${h}h${m}m`;
}

export type KitchenTableTicketProps = {
  eventId: string;
  tableId: string;
  tableName: string;
  rows: OrderWithRelations[];
  guestNotice: (seat: number) => string | null;
  /** Serialized guest notes for seats — keeps `memo` truthful when notes change alone. */
  guestFingerprint?: string;
  advance: (orderId: string, nextStatus: "cooked" | "served") => void;
  advanceCoursePending: (orderIds: string[]) => void;
  pendingId: string | null;
  isPending: boolean;
  /** Recently cooked — expediter flash state */
  readyFlashOrderIds: ReadonlySet<string>;
  onTableHoverStart?: () => void;
  onTableHoverEnd?: () => void;
};

function formatSeats(orders: OrderWithRelations[]): string {
  const seats = [...new Set(orders.map((o) => o.seat_number))].sort((a, b) => a - b);
  if (seats.length <= 4) return seats.join(", ");
  const first = seats[0];
  const last = seats[seats.length - 1];
  return first !== undefined && last !== undefined ? `${first}–${last}` : "";
}

export function deriveGuestFingerprintDefault(
  tableId: string,
  rows: OrderWithRelations[],
  guestNoticeForSeat: (seat: number) => string | null,
): string {
  return guestFingerprintForTableRows(tableId, rows, (_, seat) =>
    guestNoticeForSeat(seat),
  );
}

function KitchenTableTicketInner({
  eventId,
  tableId,
  tableName,
  rows,
  guestNotice,
  guestFingerprint: guestFingerprintFromProps,
  advance,
  advanceCoursePending,
  pendingId,
  isPending,
  readyFlashOrderIds,
  onTableHoverStart,
  onTableHoverEnd,
}: KitchenTableTicketProps) {
  const ticket: TableTicket = useMemo(() => buildTableTicket(rows), [rows]);

  const guestFingerprint =
    guestFingerprintFromProps ??
    deriveGuestFingerprintDefault(tableId, rows, guestNotice);

  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const oldestPendingTier = useMemo<"fresh" | "watch" | "late" | null>(() => {
    let oldestMinutes = -1;
    for (const o of rows) {
      if (o.status !== "pending") continue;
      const minutes = (now - new Date(o.created_at).getTime()) / 60_000;
      if (minutes > oldestMinutes) oldestMinutes = minutes;
    }
    if (oldestMinutes < 0) return null;
    return ageTier(oldestMinutes);
  }, [rows, now]);

  const tablePendingIds = useMemo(
    () => rows.filter((o) => o.status === "pending").map((o) => o.id),
    [rows],
  );

  const cardAccent =
    oldestPendingTier === "late"
      ? "border-[color-mix(in_oklab,var(--kitchen-danger)_60%,transparent)] ring-2 ring-[color-mix(in_oklab,var(--kitchen-danger-muted)_85%,transparent)]"
      : oldestPendingTier === "watch"
        ? "border-amber-500/50"
        : "border-border-kitchen";

  return (
    <article
      className={`rounded-[length:var(--radius-kitchen-card,1rem)] border bg-[var(--kitchen-card-bg)]/95 p-4 shadow-inner transition-colors motion-reduce:transition-none ${cardAccent}`}
      onPointerEnter={onTableHoverStart}
      onPointerLeave={onTableHoverEnd}
      aria-label={
        oldestPendingTier === "late"
          ? `${tableName}, late — oldest pending past ${AGE_LATE_MIN} minutes`
          : tableName
      }
    >
      <header className="flex flex-wrap items-start justify-between gap-2 border-b border-border-kitchen pb-3">
        <div className="min-w-0">
          <h3 className="text-[length:clamp(1.25rem,2vw,1.5rem)] font-bold tracking-tight text-white">
            {tableName}
          </h3>
          <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-neutral-500">
            <span className="tabular-nums">{rows.length}</span>{" "}
            {rows.length === 1 ? "line" : "lines"} · ticket
          </p>
          {tablePendingIds.length > 3 ? (
            <button
              type="button"
              disabled={isPending}
              onClick={() => advanceCoursePending(tablePendingIds)}
              className="focus-visible-kitchen mt-3 min-h-[40px] rounded-lg border border-amber-600/70 bg-amber-500/20 px-3 py-1.5 text-xs font-semibold text-amber-50 hover:bg-amber-500/30 disabled:opacity-50"
            >
              Mark table ready ({tablePendingIds.length})
            </button>
          ) : null}
        </div>
        <Link
          href={`/kitchen/${eventId}/t/${tableId}`}
          className="focus-visible-kitchen shrink-0 rounded-md border border-neutral-600 px-2.5 py-1.5 text-xs font-semibold text-neutral-200 hover:bg-neutral-800"
        >
          Seat map
        </Link>
      </header>

      <div className="mt-4 space-y-5">
        {ticket.courses.map((section) => {
          const pendingInCourse = section.lines.flatMap((l) =>
            l.orders.filter((o) => o.status === "pending"),
          );
          const pendingIds = pendingInCourse.map((o) => o.id);

          return (
            <section
              key={section.course}
              className={`rounded-r-lg border border-border-kitchen/80 bg-surface-kitchen/50 py-3 pr-3 ${courseStripeClass(section.course)}`}
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 pl-1">
                <h4 className={`text-[11px] font-bold uppercase tracking-[0.2em] ${courseHeadingAccentClass(section.course)}`}>
                  {menuCourseTitle(section.course)}
                </h4>
                {pendingIds.length > 1 ? (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => advanceCoursePending(pendingIds)}
                    className="focus-visible-kitchen min-h-[40px] shrink-0 rounded-lg border border-amber-500/60 bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-100 hover:bg-amber-500/25 disabled:opacity-50"
                  >
                    Mark course ready ({pendingIds.length})
                  </button>
                ) : null}
              </div>

              <ul className="space-y-3">
                {section.lines.map((line) => (
                  <li
                    key={line.key}
                    className="rounded-lg border border-border-kitchen/60 bg-surface-kitchen-elevated/80 px-3 py-2.5"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-base font-semibold text-white tabular-nums">
                          <span className="text-amber-200/90">{line.orders.length}</span>×{" "}
                          <span>{line.dishLabel}</span>
                        </p>
                        <p className="mt-0.5 text-[11px] text-neutral-500">
                          Seats {formatSeats(line.orders)}
                        </p>

                        {[...new Set(line.orders.map((o) => o.seat_number))]
                          .sort((a, b) => a - b)
                          .map((seat) => {
                            const gn = guestNotice(seat);
                            if (!gn) return null;
                            return (
                              <div
                                key={`g-${line.key}-${seat}`}
                                className="mt-2 rounded-md border border-red-600/60 bg-[color-mix(in_oklab,var(--kitchen-danger-muted)_82%,transparent)] p-2"
                              >
                                <p className="text-[10px] font-bold uppercase tracking-wide text-red-300">
                                  Guest · seat {seat}
                                </p>
                                <p className="mt-0.5 text-sm font-semibold leading-snug text-red-100">{gn}</p>
                              </div>
                            );
                          })}

                        {line.plateNote ? (
                          <div className="mt-2 rounded-md border border-amber-500/50 bg-amber-400/15 p-2">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-amber-200">
                              Plate / special
                            </p>
                            <p className="mt-0.5 text-sm font-semibold leading-snug text-amber-50">
                              {line.plateNote}
                            </p>
                          </div>
                        ) : null}
                      </div>

                      <div className="flex shrink-0 flex-wrap justify-end gap-1.5 sm:flex-col sm:items-end">
                        {line.orders.map((o) => {
                          const ageMinutes =
                            o.status === "pending"
                              ? (now - new Date(o.created_at).getTime()) / 60_000
                              : 0;
                          const tier =
                            o.status === "pending" ? ageTier(ageMinutes) : null;
                          return (
                            <div
                              key={o.id}
                              className="flex items-center gap-1.5 rounded-md border border-border-kitchen/50 bg-black/20 px-1.5 py-1"
                            >
                              <span className="w-7 text-center text-[10px] font-bold text-neutral-400">
                                S{o.seat_number}
                              </span>
                              {o.status === "pending" ? (
                                <>
                                  <span
                                    title={`Waiting ${formatAge(ageMinutes)} · seat ${o.seat_number}`}
                                    aria-label={`Waiting ${formatAge(ageMinutes)}${tier === "late" ? " — late" : tier === "watch" ? " — watch list" : ""}`}
                                    className={`inline-flex min-w-[2.25rem] items-center justify-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${ageBadgeClass(tier ?? "fresh")}`}
                                  >
                                    {tier === "late" ? (
                                      <span aria-hidden="true">▲</span>
                                    ) : (
                                      <span aria-hidden="true">●</span>
                                    )}
                                    {formatAge(ageMinutes)}
                                  </span>
                                  <button
                                    type="button"
                                    disabled={isPending && pendingId === o.id}
                                    onClick={() => advance(o.id, "cooked")}
                                    className="focus-visible-kitchen min-h-[40px] rounded-lg bg-amber-600 px-2.5 py-1.5 text-xs font-semibold text-neutral-950 hover:bg-amber-500 disabled:opacity-50"
                                  >
                                    Ready
                                  </button>
                                </>
                              ) : null}
                              {o.status === "cooked" ? (
                                <div className="flex flex-col items-end gap-0.5">
                                  <span
                                    className={`flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-300 ${
                                      readyFlashOrderIds.has(o.id)
                                        ? "motion-safe:animate-pulse"
                                        : ""
                                    }`}
                                  >
                                    <span aria-hidden="true">✓</span>
                                    Pickup
                                  </span>
                                  <button
                                    type="button"
                                    disabled={isPending && pendingId === o.id}
                                    onClick={() => advance(o.id, "served")}
                                    className="focus-visible-kitchen min-h-[40px] rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-neutral-950 hover:bg-emerald-500 disabled:opacity-50"
                                  >
                                    Served
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </article>
  );
}

function kitchenTableTicketsAreEqual(a: KitchenTableTicketProps, b: KitchenTableTicketProps): boolean {
  const fpA = a.guestFingerprint ?? deriveGuestFingerprintDefault(a.tableId, a.rows, a.guestNotice);
  const fpB = b.guestFingerprint ?? deriveGuestFingerprintDefault(b.tableId, b.rows, b.guestNotice);

  return (
    a.eventId === b.eventId &&
    a.tableId === b.tableId &&
    a.tableName === b.tableName &&
    a.pendingId === b.pendingId &&
    a.isPending === b.isPending &&
    fpA === fpB &&
    ordersContentSig(a.rows) === ordersContentSig(b.rows) &&
    flashingOrderSig(a.rows, a.readyFlashOrderIds) === flashingOrderSig(b.rows, b.readyFlashOrderIds)
  );
}

export const KitchenTableTicket = memo(KitchenTableTicketInner, kitchenTableTicketsAreEqual);
