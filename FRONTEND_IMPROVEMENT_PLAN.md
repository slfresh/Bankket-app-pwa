# Banquet Ordering PWA — Frontend Improvement Plan

**Scope:** `C:\Users\slfresh\Desktop\banquet-ordering-pwa`
**Primary user:** Kitchen staff on big screens (live board)
**Pillars (in priority order):** 1) Visual polish  2) UX flow  3) Performance & PWA  4) Accessibility & i18n
**Author:** April 22, 2026

---

## 1. Where We Are Today

The app is a Next.js 16 / React 19 / Tailwind 4 PWA, forced into dark mode for kitchen readability. Three role-based route groups exist: `(waiter)`, `(kitchen)`, `(manager)`. The kitchen board is the most complex screen — a 70/30 split of a floor-plan overlay on the left and a stacked list of table tickets on the right, with a fixed totals footer and a Sonner toast layer. State is React-local, real-time data comes from Supabase, and optimistic updates are wired through `useOptimistic` + `useTransition`.

Strengths: clean Tailwind 4 token setup (`--color-surface-kitchen`, `--color-accent`), a working PWA shell via `@ducanh2912/next-pwa`, Sonner for toasts, and thoughtful mobile concessions (44-px touch targets, safe-area insets). The real-time connection banner degrades gracefully.

Weaknesses, in short: the ticket list stays single-column even on 27"+ screens, status filters are plain buttons with no keyboard shortcuts, tickets don't signal how long an order has been waiting, loading states are minimal, there is no i18n layer despite a German-speaking user base, and the PWA's caching strategy is default — it isn't tuned to the kitchen's offline-reconnect case.

---

## 2. Priority 1 — Visual Polish

The kitchen board should read like an airport departure board from across the room. Today it's competent but dense: text collapses to `text-xs` when space is tight, courses blend together, and there is no visual hierarchy between a one-minute-old order and a twenty-minute-old order.

Concrete changes:

**Order-age escalation on ticket lines.** Every pending order carries a `created_at`. We'll render that as a short badge (`3m`, `12m`) next to each seat button, with color escalation — green under 5 minutes, amber 5 to 10, red past 10. A pulsing red outline on the ticket card when any line is past the 10-minute threshold gives the expediter a room-scale cue. This is a kitchen-specific upgrade and the single highest-value change on the list. *Implemented in this pass.*

**Status filter as a real tab bar with counts.** Replace the current three buttons with a `role="tablist"` that shows live counts (`All 24 · Pending 9 · Cooking 15`), uses larger typography (`text-base`, `font-bold`), and gets keyboard shortcuts (`1`, `2`, `3` plus arrow keys). *Implemented in this pass.*

**Multi-column ticket grid at ≥1280 px.** Today the right 30% stacks cards vertically; on a 27" monitor that wastes half the board. Switch to a CSS grid with `grid-template-columns: repeat(auto-fill, minmax(22rem, 1fr))` inside the tickets pane, and make the pane 40% of the split above 1280 px.

**Typography scale tuned for distance reading.** Promote table headers to `text-2xl`, course titles to `text-sm uppercase` with a solid accent stripe on the left edge of the card (not just the thin stripe we have now). Drop `tabular-nums` on counts so columns align.

**Design tokens.** Introduce `--radius-card`, `--shadow-card`, `--stripe-*` custom properties in `globals.css` so courses aren't re-declaring colors in `lib/kitchen/ticket-model.ts`. Also add a single "danger" token for the >10-minute escalation state so it is consistent across tickets, toasts, and the connection banner.

**Reduce motion when requested.** All the pulse and flash animations should wrap in `@media (prefers-reduced-motion: no-preference)`.

---

## 3. Priority 2 — UX Flow

Kitchen staff should never need to mouse. Waiters need the fewest taps.

**Keyboard shortcuts on the kitchen board.** `1/2/3` for status filters (in this pass), plus `j/k` to move the highlighted ticket, `Enter` to mark the course ready, `m` to toggle mute, `/` to focus a table-name search. All shortcuts should be visible in a `?` help overlay and respect `input` focus.

**Search-by-table.** A small filter input above the ticket list — when the board has 30 tables a manager or runner just wants to find Table 7 fast.

**Sticky ready-queue panel.** When a ticket has at least one cooked line, surface it at the top of the ticket column in a compact "ready for pickup" tray. This reduces the expediter's scanning cost dramatically.

**Bulk "mark table ready" action.** The component already supports per-course bulk ready; add a whole-table bulk ready button in the ticket header once the pending count exceeds three.

**Undo for "Served."** Right now served orders vanish. A 5-second "Undo" toast on served lets a waiter recover a misclick without bothering the kitchen.

**Reorder tickets by priority.** Sort grouped tickets by oldest pending order first (not table name). Table-name sort becomes a toggle. The whole point of a kitchen board is to surface what is most late.

**Waiter-side (out of scope for this pass but worth capturing):** the seat-grid ordering screen could benefit from last-ordered chips per seat, a "repeat for all seats" button, and a course stepper so waiters can place a whole course with one tap per seat.

---

## 4. Priority 3 — Performance & PWA

The board is live, but it does not feel instant.

**Memoize `KitchenTableTicket` with `React.memo`.** Each card re-renders whenever any order in the event changes, even if the card's own rows did not. `React.memo` with a shallow comparator on `rows`, `pendingId`, and `readyFlashOrderIds` will cut re-renders significantly on busy events.

**Virtualize the ticket list at ≥50 tickets** using `@tanstack/react-virtual`. Today a 60-ticket board scrolls fine but paints all 60 every state change.

**Rich skeletons in `loading.tsx`.** Replace the two generic `SkeletonCard`s with a kitchen-shaped skeleton: a dimmed floor-plan rectangle on the left and three grouped ticket shapes on the right. Users perceive the shape of the page faster than a spinner.

**Workbox tuning.** Today `next-pwa` uses defaults. For the kitchen case we want: `NetworkFirst` for `/kitchen/*` HTML with a short 3-second timeout and a same-page fallback; `StaleWhileRevalidate` for the Supabase REST calls (safe because we also have live subscriptions); and `CacheFirst` with a 30-day expiration for `/icons/*`, `/_next/static/*`, and fonts. Add a `runtimeCaching` array in `next.config.ts`.

**Offline reconnect banner.** The realtime banner handles WebSocket state, but not page-level offline. A thin banner driven by `navigator.onLine` that queues ready-state writes in IndexedDB and flushes on reconnect would make the board trustworthy in a flaky venue-WiFi scenario.

**Bundle hygiene.** Audit imports in `lib/kitchen/*` for incidental `lodash`/`date-fns` inclusions, switch to native `Intl.RelativeTimeFormat` for the age badges, and confirm that `sonner` is not pulling the full package.

---

## 5. Priority 4 — Accessibility & Internationalization

Kitchen and manager UIs have real accessibility gaps today.

**ARIA for the tab bar.** This pass introduces `role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`, and roving tabindex on the filter. The associated ticket list becomes a `role="tabpanel"`.

**Keyboard navigation on the floor plan.** Tables should be focusable buttons with `aria-label={`Table ${name}, ${count} open orders`}`, Enter toggles the filter, and the floor plan root should expose `role="group"` with a descriptive label.

**Color is never the only signal.** Today the status dot and order badge rely on hue (red vs green vs amber). Pair each with a glyph (✓ for cooked, ● for pending, ▲ for late) so red/green colorblind users can distinguish states.

**Focus rings across dark surfaces.** Tailwind's default ring is too subtle on `surface-kitchen`. Add `focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-kitchen` as a utility class baked into `globals.css`.

**Live region for new orders.** A visually-hidden `aria-live="polite"` element should announce "New order on Table 7, seat 3: Duck breast" so screen readers and voice-assist users keep up.

**i18n — set up `next-intl`.** The venue is German-speaking per the `Bankket` sibling project, yet strings are hardcoded English. The plan:
- Install `next-intl`, add `[locale]` route segment for each role group.
- Extract strings to `messages/en.json` and `messages/de.json`.
- Default to `de`; fall back to `en`.
- Translate status labels, filter labels, toasts, and ticket copy first; menu/dish labels come from the DB and stay as-is.

This is a one-sprint task on its own and is the biggest deferred item in this plan.

---

## 6. What's Shipped in This Pass

Two upgrades land in code alongside this document:

1. **Status-filter tab bar.** KitchenBoard's filter row becomes a proper tablist with live counts, keyboard shortcuts `1/2/3`, arrow-key navigation, `aria-selected`, and focus-visible rings. The all/pending/cooking labels are unchanged so muscle memory survives.

2. **Order-age escalation on tickets.** Every pending order line gets a compact age badge (`3m` / `12m`) that escalates green → amber → red based on wait time, ticking every 30 seconds while the board is open. Tickets with any line past the 10-minute threshold get a red left-edge accent so the expediter sees them from across the room.

Both changes are additive and don't touch the data layer.

---

## 7. Suggested Sequence After This Pass

Sprint 1 (1 week): multi-column ticket grid, memoization + virtualization, richer skeletons.
Sprint 2 (1 week): Workbox runtime caching, offline-online banner, live region for new orders, keyboard nav on the floor plan.
Sprint 3 (2 weeks): `next-intl` setup end-to-end, German translations, route-level locale segment.
Sprint 4 (1 week): waiter screen pass (last-ordered chips, course stepper), manager dashboard polish.

Each sprint has a clear acceptance check — for example, "cold reload of `/kitchen/[eventId]` on a throttled 3G connection shows meaningful content in under 2 seconds" for Sprint 1.
