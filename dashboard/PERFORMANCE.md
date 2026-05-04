# Admin Dashboard — Performance Guide

This document describes the performance optimisations applied to the Desheena Investments Ltd Admin Dashboard and explains how to measure and verify them.

---

## 1. Server-Side Pagination (Requirements 19.2, 19.7)

All TanStack Table instances use **server-side pagination and sorting** — data is fetched from Supabase one page at a time rather than loading the entire dataset into the browser.

| Page | TanStack Table config |
|---|---|
| Collections (`CollectionsPage.tsx`) | `manualPagination: true`, `manualSorting: true` |
| Clients (`ClientsPage.tsx`) | `manualPagination: true` |

- Default page size: **50 rows**
- Selectable page sizes: 25 / 50 / 100
- Supabase queries use `.range(from, to)` so only the requested slice is transferred over the network.

This keeps memory usage constant regardless of total record count (50,000+ clients, unlimited collections).

---

## 2. CSS Overflow Virtualisation (Requirement 19.8)

All table containers use:

```html
<div class="max-h-[600px] overflow-y-auto overflow-x-auto">
```

This caps the rendered viewport to 600 px and lets the browser discard off-screen rows from the paint tree, providing virtualisation-like behaviour without a JavaScript virtual-scroll library. Combined with server-side pagination (max 100 rows per page), the DOM never holds more than 100 table rows at once.

---

## 3. React.lazy() for Heavy Components (Requirement 19.7)

The following components are **code-split** using `React.lazy()` in `src/App.tsx`:

| Component | Why it's heavy |
|---|---|
| `CollectionsPage` | Leaflet map + large TanStack Table |
| `ClientsPage` | Leaflet map + large TanStack Table |
| `RoutesPage` | Leaflet map |
| `RouteDetailPage` | Leaflet map |
| `KpiPanel` | Recharts charts |

Each lazy component is wrapped in `<Suspense fallback={<PageLoader />}>`. Vite automatically splits these into separate JS chunks at build time, so the initial bundle does **not** include Leaflet or Recharts — they are only downloaded when the user first navigates to a page that needs them.

---

## 4. React Query Cache Settings (Requirement 19.7)

Configured in `src/lib/queryClient.ts`:

| Setting | Value | Effect |
|---|---|---|
| `staleTime` | 5 minutes | Data fetched within the last 5 min is served from cache without a network request |
| `gcTime` | 10 minutes | Inactive (unmounted) query results stay in memory for 10 min before being garbage-collected |
| `retry` | 2 | Failed requests are retried up to 2 times before surfacing an error |
| `refetchOnWindowFocus` | `false` | Switching browser tabs does not trigger unnecessary refetches |

The combination of a 5-min stale time and 10-min GC time means navigating between pages reuses cached data for up to 5 minutes, and returning to a recently-visited page within 10 minutes avoids a full reload.

---

## 5. Measuring Load Time

### Build and preview

```bash
cd dashboard
npm run build
npm run preview
```

Open the preview URL (default `http://localhost:4173`) in Chrome.

### Chrome DevTools — Performance tab

1. Open DevTools → **Performance** tab.
2. Click **Record**, then reload the page (`Ctrl+Shift+R` / `Cmd+Shift+R` for a hard reload).
3. Stop recording after the page is fully interactive.
4. Check the **Timings** row for:
   - **FCP** (First Contentful Paint) — first visible content
   - **LCP** (Largest Contentful Paint) — main content loaded
   - **TTI** (Time to Interactive) — page is fully interactive

### Chrome DevTools — Network tab

1. Open DevTools → **Network** tab.
2. Set throttling to **Fast 3G** to simulate broadband.
3. Hard-reload and observe:
   - Initial JS bundle size (should be small — Leaflet/Recharts are split out)
   - Lazy chunks loaded on first navigation to Collections / Clients / Routes

### Lighthouse

Run a Lighthouse audit (DevTools → **Lighthouse** tab) with the **Performance** category selected. Target scores:

| Metric | Target |
|---|---|
| Performance score | ≥ 80 |
| FCP | < 1.5 s |
| LCP | < 3.0 s |
| TTI | < 3.0 s |

---

## 6. Performance Target

> **Initial dashboard load < 3 seconds on broadband** (Requirements 19.7, 19.8)

This is achieved by:
- Keeping the initial JS bundle small via `React.lazy()` code splitting
- Avoiding large data fetches on load (server-side pagination)
- Caching API responses with React Query to eliminate redundant network requests on navigation
