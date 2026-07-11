# Let It Rain — Mobile

An Expo (React Native + TypeScript) app with full feature parity with the
[Let It Rain](../README.md) web app: inventory management, settings/user management, an
activity calendar, and accounting reports. It's a thin client over the
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
│   ├── _layout.tsx                # root layout: React Query provider, AuthProvider, Stack navigator
│   ├── index.tsx                  # redirects to /login or /items depending on auth state
│   ├── login.tsx
│   ├── items/
│   │   ├── index.tsx               # items list: search, low-stock filter, header nav links
│   │   ├── new.tsx                 # create item
│   │   └── [id]/
│   │       ├── index.tsx           # item detail + movement history
│   │       ├── edit.tsx
│   │       └── adjust.tsx          # receive / remove / adjust stock
│   ├── settings/
│   │   ├── index.tsx               # entry point: Users (if MANAGE_USERS) + Account
│   │   ├── account.tsx             # own name + password
│   │   └── users/
│   │       ├── index.tsx           # user list
│   │       ├── new.tsx             # create user
│   │       └── [id].tsx            # edit permissions, activate/deactivate, reset password
│   ├── activity.tsx                # month-grid calendar with day drill-down
│   └── reports.tsx                 # revenue/COGS/profit/valuation + breakdowns
├── src/
│   └── api/                        # typed API client — one file per feature area
│       ├── client.ts                 # apiFetch() wrapper: attaches bearer token, throws ApiError
│       ├── auth.ts                   # login/logout
│       ├── AuthContext.tsx           # React context holding the signed-in user
│       ├── items.ts
│       ├── settings.ts
│       ├── activity.ts
│       └── reports.ts
├── app.json                        # Expo config (name, scheme, plugins)
├── .env.example
└── package.json
```

**Navigation:** the items list screen (`app/items/index.tsx`) has header links to
Activity, Reports, and Settings — it's the de facto home screen after login.

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

Auth state lives in `AuthContext` (`src/api/AuthContext.tsx`) — set once at login, read
anywhere via `useAuth()`. It's in-memory only (not persisted across app restarts beyond
the token itself); a real "stay logged in" flow would re-hydrate this from the stored
token on launch, which isn't implemented yet (see [Known limitations](#known-limitations)).

## Screens reference

| Screen | Path | Requires |
|---|---|---|
| Login | `/login` | — |
| Items list | `/items` | signed in |
| Item detail | `/items/:id` | signed in |
| New item | `/items/new` | `EDIT_ITEMS` (enforced server-side; the screen itself doesn't hide the link) |
| Edit item | `/items/:id/edit` | `EDIT_ITEMS` |
| Adjust stock | `/items/:id/adjust` | `ADJUST_STOCK` |
| Activity calendar | `/activity` | signed in |
| Reports | `/reports` | signed in |
| Settings | `/settings` | signed in (Users link only shown with `MANAGE_USERS`) |
| Users list | `/settings/users` | `MANAGE_USERS` |
| New user | `/settings/users/new` | `MANAGE_USERS` |
| User detail | `/settings/users/:id` | `MANAGE_USERS` |
| Account | `/settings/account` | signed in |

Permission checks are always enforced by the API — the screens hide/show links based on
the signed-in user's `permissions` as a UX convenience, but attempting a
disallowed action always fails server-side with `403` regardless of what the UI shows.

## Known limitations

- **No offline support.** Every screen requires network connectivity; failed requests
  show an inline error with no local queueing or retry-on-reconnect.
- **No persisted "stay logged in".** The bearer token is stored in `expo-secure-store`,
  but the app doesn't currently re-hydrate the signed-in user from it on a cold start —
  closing and reopening the app requires signing in again even though the token is
  technically still valid and stored on-device.
- **No push notifications.**
- **No EAS Build / app-store distribution configured.** This app is set up for
  development via Expo Go only. Setting up `eas.json` and a build profile for internal
  distribution or app-store submission is future work.
- **No automated test suite.** The app is a thin client over an already-tested API
  ([`docs/API.md`](../docs/API.md), 100+ Vitest tests on the API side); mobile
  correctness is currently verified manually via Expo Go against the real API for each
  feature as it's built (see the phase-by-phase spec/plan docs in
  [`docs/superpowers/`](../docs/superpowers/)).

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
