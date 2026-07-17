# Let It Rain — Mobile

An Expo (React Native + TypeScript) app with feature parity with the
[Let It Rain](../README.md) web app — inventory management, settings/user management, an
activity calendar, and accounting reports — plus a few mobile-only extras the web app
doesn't have: Face ID app lock, a Dashboard landing screen, CSV export via the native
share sheet, and OS-following dark mode. It's a thin client over the
[`/api/v1`](../docs/API.md) JSON API served by the Next.js app in the repo root — this
app has no backend of its own.

## Prerequisites

- The web app's dev server running (see the [repo root README](../README.md#getting-started--web-app))
  or a deployed instance you have the URL for.
- [Expo Go](https://expo.dev/go) installed on your phone (iOS or Android), or an
  iOS/Android simulator set up locally.
- Your phone and computer on the **same Wi-Fi network** if using a physical device with
  Expo Go — this is the #1 cause of connection failures.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Configure the API base URL:

   ```bash
   cp .env.example .env
   ```

   Edit `.env`:

   ```
   EXPO_PUBLIC_API_BASE_URL=http://192.168.1.x:3000
   ```

   Use your computer's **LAN IP**, not `localhost` — a phone running Expo Go is a
   separate device on the network. Find your LAN IP with `ipconfig` (Windows) or
   `ifconfig` / `ip addr` (macOS/Linux). If you're running on a simulator on the same
   machine as the dev server, `http://localhost:3000` (iOS simulator) or
   `http://10.0.2.2:3000` (Android emulator, which maps to the host's `localhost`) will
   also work.

3. Start Expo:

   ```bash
   npx expo start
   ```

   - **Physical device:** scan the QR code with your phone's camera (iOS) or the Expo Go
     app's scanner (Android).
   - **Simulator:** press `i` (iOS) or `a` (Android) in the terminal running `expo start`.
   - **Can't connect?** Try `npx expo start --tunnel` — routes traffic through Expo's
     relay, slower but works across networks/firewalls/guest-network isolation.

4. Sign in with the same credentials as the web app (the seeded default is
   `admin@letitrain.app` / `letitrain123` unless it's been changed).

## Project structure

This app uses [Expo Router](https://docs.expo.dev/router/introduction/) — file-based
routing under `app/`, the same mental model as the web app's Next.js App Router.

```
mobile/
├── app/                          # screens (file-based routing)
│   ├── _layout.tsx                # root layout: GestureHandlerRootView, providers, themed Stack
│   ├── index.tsx                  # redirects to /login or /dashboard depending on auth state
│   ├── login.tsx
│   ├── (tabs)/                     # bottom tab bar group — none of these segments appear in the URL
│   │   ├── _layout.tsx               # Tabs navigator: Dashboard/Items/Orders/Activity/Reports/Settings
│   │   ├── dashboard.tsx             # landing screen: today's revenue, low stock, recent activity
│   │   ├── items.tsx                 # items list: search, category chips, sort, swipe-to-adjust
│   │   ├── orders.tsx                # orders list: role-scoped (all orders vs. just assigned ones)
│   │   ├── activity.tsx              # month-grid calendar with day drill-down
│   │   ├── reports.tsx               # revenue/COGS/profit/valuation + bar-chart revenue-by-day
│   │   └── settings.tsx              # Users (if MANAGE_USERS) + Account + Face ID toggle + sign out
│   ├── items/
│   │   ├── new.tsx                 # create item
│   │   └── [id]/
│   │       ├── index.tsx           # item detail + movement history + CSV export
│   │       ├── edit.tsx
│   │       └── adjust.tsx          # receive / remove (Cash/Interac split) / adjust stock
│   ├── orders/
│   │   ├── new.tsx                 # create order: customer info + repeatable item/quantity rows
│   │   └── [id].tsx                # detail: driver chip-picker, status actions, delivery payment capture
│   └── settings/
│       ├── account.tsx             # own name + password
│       └── users/
│           ├── index.tsx           # user list
│           ├── new.tsx             # create user
│           └── [id].tsx            # edit permissions, activate/deactivate, reset password
├── src/
│   ├── theme.ts                    # light/dark color tokens (hand-matched to web's globals.css)
│   ├── toast.tsx                   # minimal custom toast (no library — sonner isn't RN-usable)
│   ├── Skeleton.tsx                 # pulsing loading placeholder
│   ├── offlineQueue.ts              # persisted queue-and-sync for order delivery actions (see below)
│   └── api/                        # typed API client — one file per feature area
│       ├── client.ts                 # apiFetch()/apiFetchText() wrappers: bearer token, ApiError
│       ├── auth.ts                   # login/logout
│       ├── AuthContext.tsx           # React context holding the signed-in user + Face ID lock state
│       ├── AuthGate.tsx              # renders a Face ID lock screen over the whole navigator
│       ├── items.ts
│       ├── orders.ts                 # orders CRUD + status transitions + driver list
│       ├── settings.ts
│       ├── activity.ts
│       ├── reports.ts
│       └── export.ts                 # CSV export via expo-file-system + expo-sharing
├── app.json                        # Expo config (name, scheme, plugins)
├── .env.example
└── package.json
```

**Navigation:** a bottom tab bar (`app/(tabs)/_layout.tsx`) with six tabs — Dashboard,
Items, Orders, Activity, Reports, Settings. Dashboard (`/dashboard`) is the landing screen
after login/cold-start, not Items; it summarizes today's revenue, low-stock items, and
recent activity by composing the same `fetchReports`/`fetchItems`/`fetchActivity` calls
the other tabs use, with no dedicated dashboard API endpoint. The Items tab shows a live
low-stock count badge. The Orders tab is role-aware: anyone holding at least one of
`CREATE_ORDERS`/`ASSIGN_DRIVERS`/`CANCEL_ORDERS` (post-Phase 1 split of the legacy
`MANAGE_ORDERS`) sees every order plus a create button; anyone else sees only orders
assigned to them as driver. The Reports tab and Dashboard's revenue card are hidden
entirely for callers without `VIEW_REPORTS`.

## How screens talk to the API

Every `src/api/*.ts` file exports typed functions that call `apiFetch()`
(`src/api/client.ts`), which:

1. Reads the stored bearer token from `expo-secure-store`.
2. Sends the request to `EXPO_PUBLIC_API_BASE_URL` + the given path, with
   `Authorization: Bearer <token>`.
3. Throws an `ApiError` (with `.status` and `.message`) on any non-2xx response, using
   the API's `{ error: "..." }` body as the message.

Screens use [`@tanstack/react-query`](https://tanstack.com/query/latest)'s `useQuery`
for reads and call the typed functions directly (inside `try`/`catch`, showing
`err.message` on failure) for mutations, then call
`queryClient.invalidateQueries(...)` to refresh any affected cached data.

Auth state lives in `AuthContext` (`src/api/AuthContext.tsx`), read anywhere via
`useAuth()`. On cold start it re-hydrates from the stored token in `expo-secure-store`
(decoding and checking expiry client-side before trusting it) rather than starting
signed-out every launch. If the user has enabled Face ID (Settings → toggle, stored via
`getFaceIdEnabled`/`setFaceIdEnabled` in `src/api/client.ts`), `AuthGate`
(`src/api/AuthGate.tsx`) renders a lock screen over the whole navigator until
`expo-local-authentication` succeeds — this only gates the UI locally; the API itself
still trusts the bearer token regardless of Face ID state, same as before.

## Screens reference

> **Post-Phase 1 update (2026-07-12):** the permission column below uses the current
> Phase 1 names. `MANAGE_ORDERS` was split into `CREATE_ORDERS`/`ASSIGN_DRIVERS`/
> `CANCEL_ORDERS`; new `VIEW_REPORTS`/`VIEW_COSTS`/`VIEW_AUDIT_LOG`/`MANAGE_SETTINGS`
> perms were added. The web/mobile UI checks these perms server-side; tablets and
> screens hide tabs/links based on the signed-in user's perms as a UX convenience.

| Screen | Path | Requires |
|---|---|---|
| Login | `/login` | — |
| Dashboard | `/dashboard` | signed in (landing screen after login) |
| Items list | `/items` | signed in |
| Item detail | `/items/:id` | signed in (cost/price fields hidden if no `VIEW_COSTS`) |
| New item | `/items/new` | `EDIT_ITEMS` |
| Edit item | `/items/:id/edit` | `EDIT_ITEMS` |
| Adjust stock | `/items/:id/adjust` | `ADJUST_STOCK` |
| Orders list | `/orders` | signed in (role-scoped: all orders with any order-management perm, else only assigned) |
| New order | `/orders/new` | `CREATE_ORDERS` |
| Order detail | `/orders/:id` | signed in (status actions need order-management perm or being the assigned driver) |
| Activity calendar | `/activity` | signed in (driver-scoped unless caller holds order-management perm) |
| Reports | `/reports` | `VIEW_REPORTS` (tab hidden entirely if missing) |
| Settings | `/settings` | signed in |
| Organization & plan | `/settings/organization` | `MANAGE_SETTINGS` |
| Users list | `/settings/users` | `MANAGE_USERS` |
| New user | `/settings/users/new` | `MANAGE_USERS` |
| User detail | `/settings/users/:id` | `MANAGE_USERS` |
| Account | `/settings/account` | signed in (includes "Sign out everywhere") |

Permission checks are always enforced by the API — the screens hide/show links based on
the signed-in user's `permissions` as a UX convenience, but attempting a
disallowed action always fails server-side with `403` regardless of what the UI shows.
The highest-risk direct-route screens (`/items/new`, `/items/:id/edit`,
`/items/:id/adjust`, `/settings/organization`) now also render explicit local
permission-denied states before any mutation attempt.

## Offline queue (order delivery actions)

Marking an order out-for-delivery or delivered is the one flow in the app with offline
support, since a driver mid-route may not have signal. `src/offlineQueue.ts` persists a
small queue (via `expo-secure-store`) of pending actions; when `markOutForDelivery` or
`markDelivered` fails with a connectivity error (`ApiError.status === 0`), the action is
enqueued instead of surfaced as an error, and a toast tells the driver it'll sync
automatically. `startOrderQueueAutoFlush` (wired up in `app/_layout.tsx`) retries the
queue every 15s and once whenever the app returns to the foreground, invalidating the
`orders`/`items`/`reports` React Query caches on a successful flush. This is a narrow,
best-effort at-least-once retry — not full offline-first — and doesn't cover any other
screen (item edits, order creation, etc. still require a live connection).

## Sign out everywhere

`/settings/account` has a "Sign out everywhere" button (added in Phase 1). It
calls `POST /api/v1/me/sessions` (via `mobile/src/api/settings.ts` →
`revokeOwnSessions()`) which bumps the user's `tokenVersion` server-side. This
invalidates *every* authenticated session for that user across every device — the mobile
app, any browser tabs on the web app, anything holding a valid Bearer token or session
cookie for them — all get a `401` on their next request and are forced back to login.
Useful after a device loss or "I forgot to sign out somewhere."

## Known limitations

- **Offline support is limited to order delivery actions** (see above); every other
  screen still requires live network connectivity, with failed requests showing an
  inline error and no local queueing or retry-on-reconnect.
- **No push notifications.** Explicitly deferred — would need a new Apple Push
  Notifications capability, an APNs key, and server-side infrastructure to send them on
  inventory changes, not just mobile-side work.
- **No item photos.** Would need a file-storage decision (Vercel Blob, S3, etc.) that
  doesn't exist anywhere in this stack yet.
- **No iOS Home Screen widget.** Would require a native Xcode widget extension target,
  which Expo's managed workflow can only add via an unofficial config plugin.
- **No automated test suite** was a Phase 11 gap. It now has one: 44 vitest tests
  across 11 files, covering JWT utilities, auth-context bootstrap/lock flows,
  `AuthGate` lock handling, entry-route auth redirects, login success/failure flows,
  account session-revocation flows, offline queue behavior, org settings/plan API
  calls, permission helpers, and mobile API-client auth/error handling — run via
  `npm test`.
- **No error monitoring** was a Phase 11 gap. It now has [Sentry](https://sentry.io/)
  integrated via `@sentry/react-native` + `sentry-expo` plugin, initialized at app
  startup (`src/sentry.ts`) with API breadcrumbs logged in `src/api/client.ts`.
- **No staging environment** was a Phase 11 gap. `eas.json` now has a `staging` build
  profile pointing at a separate Vercel deployment + database, alongside the existing
  `development`/`preview`/`production` profiles.
- **No accessibility labels** was a Phase 11 gap. Every interactive element across all
  screens now has `accessibilityRole`, `accessibilityLabel`, and `accessibilityState`
  set, verified against WCAG AA/AAA contrast ratios.

## Shipping to TestFlight

The app is **already live on TestFlight** (multiple builds submitted). The project is
configured for [EAS Build](https://docs.expo.dev/build/introduction/): `app.json` has a
bundle identifier + real app icon/splash assets, `eas.json` defines
`development`/`preview`/`staging`/`production` build profiles with
`submit.production.ios.ascAppId` set, and iOS Distribution Certificate + Provisioning
Profile are already stored on EAS
(uploaded manually — see `docs/adr/` or ask before re-running `eas credentials`
interactively, since the automated Apple-auth flow in `eas credentials` has a known bug
that made the manual route necessary).

**Everything needed for a build + submit is already in place:**

1. **Build profiles point at the real deployed API.** `eas.json`'s `preview` and
   `production` profiles set `EXPO_PUBLIC_API_BASE_URL` to the deployed web app's HTTPS
   URL (`https://letitrain-jade.vercel.app`) — required because iOS App Transport
   Security blocks plain `http://` requests in a standalone (non-Expo-Go) build.
2. **EAS project is linked.** `app.json`'s `extra.eas.projectId` and `owner` are set
   (`obsidianmedia/letitrain-mobile`).
3. **Bundle identifier** (`ios.bundleIdentifier`: `com.letitrain.mobile`) matches the app
   record in [App Store Connect](https://appstoreconnect.apple.com/) (App ID `6790051300`).
4. `ios.buildNumber`, `android.package`, `android.versionCode` are set in `app.json`, and
   `eas.json`'s `production` profile has `autoIncrement: true` so the build number bumps
   automatically between submissions — commit that bump after every build.
5. Real app icon/splash/favicon/Android adaptive-icon assets are in `assets/`.
6. The app itself: cold-start session persistence, automatic sign-out + redirect to login
   on a `401` (expired/invalidated token) from any screen, a working sign-out button
   (Settings → Sign out), a request timeout so a bad network shows an error instead of an
   infinite spinner, and optional Face ID app-lock.

**To build and submit** (both run fully non-interactively now that credentials are
stored on EAS):
```bash
npx eas build --platform ios --profile preview     # internal testing build (ad hoc)
# or
npx eas build --platform ios --profile production  # TestFlight/App Store build

npx eas submit --platform ios --latest              # upload the most recent build to
                                                      # App Store Connect / TestFlight
```
Add `--non-interactive` to either command once credentials are stored on EAS (already the
case for this project) to run fully unattended — useful for scripting/CI, or for an agent
driving the build without a live terminal. `eas.json`'s
`ITSAppUsesNonExemptEncryption: false` setting (in `app.json`) answers the App Store
Connect export-compliance question automatically, since the app only uses standard
HTTPS/TLS and no custom cryptography.

**If iOS credentials ever need to be regenerated** (new device, revoked cert, etc.):
`eas credentials --platform ios` has a known bug ([expo/eas-cli#2913](https://github.com/expo/eas-cli/issues/2913))
where Apple auth can fail with a cryptic "Apple 401 detected" error even with valid
credentials. If that happens, generate the Distribution Certificate and Provisioning
Profile manually via developer.apple.com (CSR → certificate → profile, entirely outside
EAS's Apple-auth code path) and upload them to EAS as "own files" instead of letting EAS
generate them automatically. Also watch for an OpenSSL 3.x gotcha if you export a `.p12`
yourself: OpenSSL 3's default PKCS#12 cipher isn't readable by Apple's Keychain on EAS's
build workers — re-export with `openssl pkcs12 -export -legacy ...` if you hit
"Distribution Certificate hasn't been imported successfully" during a build.

## Troubleshooting

- **"Network request failed" / spinner never resolves:** almost always
  `EXPO_PUBLIC_API_BASE_URL` pointing at the wrong host. Re-check it's your LAN IP (not
  `localhost`), that the web dev server is actually running, and that your phone and
  computer are on the same network.
- **401 immediately after a successful-looking login:** the stored token and the running
  API's `SESSION_SECRET` don't match (e.g. you logged in against one server, then
  pointed `EXPO_PUBLIC_API_BASE_URL` at a different one with a different secret). Sign
  out and back in against the currently configured API.
- **Changes to `.env` not taking effect:** restart `expo start` — `EXPO_PUBLIC_*`
  env vars are baked in at bundle time, not read live.
- **Metro bundler stuck/slow on first run:** normal on a cold cache; subsequent starts
  are much faster.
