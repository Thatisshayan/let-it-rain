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
- **No push notifications.**
- **Not yet submitted to TestFlight/the App Store.** `eas.json` and the required
  `app.json` fields (bundle identifier, build number) are in place — see
  [Preparing for TestFlight](#preparing-for-testflight) below for what's left, all of
  which requires your Apple Developer account credentials and can't be done from here.
- **No automated test suite.** The app is a thin client over an already-tested API
  ([`docs/API.md`](../docs/API.md), 100+ Vitest tests on the API side); mobile
  correctness is currently verified manually via Expo Go against the real API for each
  feature as it's built (see the phase-by-phase spec/plan docs in
  [`docs/superpowers/`](../docs/superpowers/)).

## Preparing for TestFlight

The project is configured for [EAS Build](https://docs.expo.dev/build/introduction/):
`app.json` has a bundle identifier and `eas.json` defines
`development`/`preview`/`production` build profiles.

**Already done:**

1. **Build profiles point at the real deployed API.** `eas.json`'s `preview` and
   `production` profiles set `EXPO_PUBLIC_API_BASE_URL` to the deployed web app's HTTPS
   URL (`https://letitrain-jade.vercel.app`) — required because iOS App Transport
   Security blocks plain `http://` requests in a standalone (non-Expo-Go) build.
2. **EAS project is linked.** `app.json`'s `extra.eas.projectId` and `owner` are set
   (`obsidianstudio/letitrain-mobile`); `eas init`/`eas login` don't need to be re-run
   unless you're switching Expo accounts.
3. **Bundle identifier is set** in `app.json` (`ios.bundleIdentifier`:
   `com.letitrain.mobile`) — verify this still matches the app record in
   [App Store Connect](https://appstoreconnect.apple.com/) before submitting.
4. `ios.buildNumber`, `android.package`, `android.versionCode` are set in `app.json`, and
   `eas.json`'s `production` profile has `autoIncrement: true` so the build number bumps
   automatically between submissions.
5. The app itself: cold-start session persistence (a valid stored token signs you back in
   automatically — see `AuthProvider` in `src/api/AuthContext.tsx`), automatic sign-out +
   redirect to login on a `401` (expired/invalidated token) from any screen, a working
   sign-out button (Settings → Sign out), and a request timeout so a bad network shows an
   error instead of an infinite spinner.

**Still needed before shipping to real testers:**
- App icon and splash screen assets are currently Expo's generic defaults — replace
  `assets/icon.png`, `assets/android-icon-*.png`, `assets/splash-icon.png`,
  `assets/favicon.png` with your own branded assets.
- An app record in App Store Connect with a matching bundle identifier (needed for
  `eas submit`, not for `eas build` itself).

**To build and submit:**
```bash
npx eas build --platform ios --profile preview     # internal testing build (ad hoc)
# or
npx eas build --platform ios --profile production  # TestFlight/App Store build

npx eas submit --platform ios --latest              # upload the most recent build to
                                                      # App Store Connect / TestFlight
```
The first iOS build will interactively prompt for your Apple Developer credentials and
generate/select signing certificates and provisioning profiles — EAS manages this for
you, but it does require an active Apple Developer Program membership. `eas.json`'s
`ITSAppUsesNonExemptEncryption: false` setting (in `app.json`) answers the App Store
Connect export-compliance question automatically, since the app only uses standard
HTTPS/TLS and no custom cryptography.

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
