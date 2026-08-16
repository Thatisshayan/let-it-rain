# Let It Rain - Repository Index

A comprehensive guide to the codebase structure, features, and key files.

## Quick Links

- **[Project Setup](#project-setup)** – Getting started
- **[Directory Structure](#directory-structure)** – Folder organization
- **[Data Model](#data-model)** – Database schema
- **[Features](#features)** – Core functionality
- **[Routes & Pages](#routes--pages)** – App routes
- **[Server Actions](#server-actions)** – Backend operations
- **[Components](#components)** – UI components
- **[Utilities & Helpers](#utilities--helpers)** – Shared code
- **[Configuration](#configuration)** – Project config files
- **[Testing](#testing)** – Test files and setup
- **[Key Implementation Details](#key-implementation-details)** – Notable patterns

---

## Project Setup

**Technology Stack:**
- **Framework:** Next.js 16 (App Router)
- **Database:** PostgreSQL with Prisma 7 (@prisma/adapter-pg)
- **Authentication:** JWT via jose + bcryptjs password hashing
- **Validation:** Zod for server actions
- **UI:** shadcn/ui + Tailwind CSS v4
- **Testing:** Vitest
- **Styling:** Next Themes for dark mode support

**Initial Setup:**
1. Install dependencies: `npm install`
2. Configure `.env` with `DATABASE_URL` and `SESSION_SECRET`
3. Apply migrations: `npx prisma migrate deploy && npx prisma generate`
4. Seed data: `npm run seed`
5. Start dev server: `npm run dev`

---

## Directory Structure

```
let-it-rain/
├── src/
│   ├── app/                          # Next.js app router
│   │   ├── layout.tsx                # Root layout with auth check
│   │   ├── proxy.ts                  # Route protection middleware
│   │   ├── login/
│   │   │   ├── page.tsx              # Login page
│   │   │   ├── actions.ts            # Auth/login server actions
│   │   │   └── form.tsx              # Login form component
│   │   ├── logout/
│   │   │   └── actions.ts            # Logout action
│   │   └── (app)/                    # Protected routes layout
│   │       ├── layout.tsx            # App layout with nav
│   │       ├── page.tsx              # Dashboard page
│   │       ├── items/                # Inventory management
│   │       │   ├── page.tsx          # Items list page
│   │       │   ├── actions.ts        # Item CRUD/stock actions
│   │       │   ├── new/
│   │       │   │   ├── page.tsx      # Create item page
│   │       │   │   └── new-item-form.tsx  # Item creation form
│   │       │   ├── export.csv/       # CSV export endpoint
│   │       │   │   └── route.ts
│   │       │   └── [id]/             # Item detail routes
│   │       │       ├── page.tsx      # Item detail page
│   │       │       ├── actions.ts    # Item-specific actions
│   │       │       ├── adjust-form.tsx      # Stock adjust form
│   │       │       ├── delete-button.tsx    # Delete UI
│   │       │       ├── movement-history.tsx # Audit trail
│   │       │       ├── edit/
│   │       │       │   ├── page.tsx  # Edit item page
│   │       │       │   └── edit-form.tsx
│   │       │       └── movements/    # Movement export
│   │       │           └── export.csv/
│   │       ├── activity/             # Activity & calendar
│   │       │   ├── page.tsx          # Activity page
│   │       │   ├── calendar.ts       # Calendar logic
│   │       │   └── calendar.test.ts  # Calendar tests
│   │       ├── settings/             # User settings
│   │       │   ├── page.tsx          # Settings page
│   │       │   ├── actions.ts        # Settings mutations
│   │       │   └── settings-form.tsx # Settings form
│   │       └── reports/              # Financial reports
│   │           ├── page.tsx          # Reports page
│   │           └── actions.ts        # Report generation
│   ├── components/
│   │   └── ui/                       # shadcn/ui components
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── dialog.tsx
│   │       ├── input.tsx
│   │       ├── label.tsx
│   │       ├── table.tsx
│   │       ├── badge.tsx
│   │       ├── select.tsx
│   │       ├── checkbox.tsx
│   │       ├── dropdown-menu.tsx
│   │       ├── avatar.tsx
│   │       ├── textarea.tsx
│   │       ├── separator.tsx
│   │       └── sonner.tsx            # Toast notifications
│   ├── lib/
│   │   ├── auth.ts                   # Auth utilities (session, JWT)
│   │   ├── password.ts               # Password hashing
│   │   ├── rate-limit.ts             # IP+email rate limiting
│   │   ├── permissions.ts            # Permission checking
│   │   ├── permissions.test.ts       # Permission tests
│   │   ├── prisma.ts                 # Prisma client singleton
│   │   ├── csv.ts                    # CSV export utilities
│   │   ├── csv.test.ts               # CSV tests
│   │   └── utils.ts                  # General utilities
│   ├── generated/
│   │   └── prisma/                   # Auto-generated Prisma client
│   └── proxy.ts                      # Route protection
├── prisma/
│   ├── schema.prisma                 # Database schema
│   ├── seed.ts                       # Initial data seeding
│   └── migrations/                   # Database migrations
├── docs/
│   ├── REPOSITORY_INDEX.md           # This file
│   └── superpowers/                  # Design specs
│       └── specs/
│           └── 2026-07-10-permissions-settings-calendar-design.md
├── public/                           # Static assets
├── package.json                      # Dependencies & scripts
├── tsconfig.json                     # TypeScript config
├── next.config.ts                    # Next.js config
├── tailwind.config.ts                # Tailwind CSS config
├── postcss.config.mjs                # PostCSS config
├── vitest.config.ts                  # Vitest config
├── eslint.config.mjs                 # ESLint config
├── components.json                   # shadcn/ui config
└── README.md                         # Project README
```

---

## Data Model

### User
Core authentication model for app users.

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | Primary key |
| `name` | String | Display name |
| `email` | String | Unique, login identifier |
| `passwordHash` | String | Bcrypt hashed password |
| `permissions` | String[] | Granted permissions (MANAGE_USERS, DELETE_ITEMS, EDIT_ITEMS, ADJUST_STOCK) |
| `active` | Boolean | Account status |
| `createdAt` | DateTime | Timestamp |
| **Relations** | | |
| `movements` | Movement[] | Stock adjustments made by this user |

**Current Authorization:** Any signed-in user has all default permissions. No role-based access control yet.

### Item
Inventory item with stock tracking and financial data.

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | Primary key |
| `name` | String | Item identifier (indexed) |
| `category` | String? | Optional category/type |
| `description` | String? | Long description |
| `quantity` | Int | Current stock level |
| `minStock` | Int | Low stock threshold |
| `customFields` | JSON? | Extensible metadata |
| `unitCost` | Decimal(12,2) | Acquisition cost per unit |
| `unitPrice` | Decimal(12,2) | Sale price per unit |
| `createdAt` | DateTime | Timestamp |
| `updatedAt` | DateTime | Auto-updated |
| `deletedAt` | DateTime? | Soft delete marker (indexed) |
| **Relations** | | |
| `movements` | Movement[] | Audit trail of all stock changes |

**Indexes:** `name`, `deletedAt` (soft delete queries)

### Movement
Immutable audit log of every stock change (receive, remove, adjust).

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | Primary key |
| `itemId` | UUID | FK to Item (cascade delete) |
| `type` | RECEIVE \| REMOVE \| ADJUST | Movement category |
| `delta` | Int | Quantity change (can be negative) |
| `quantityAfter` | Int | Stock level after movement |
| `reason` | String? | Optional explanation |
| `isSale` | Boolean | Marks REMOVE as revenue-generating |
| `unitCostAtTime` | Decimal(12,2)? | Unit cost snapshot |
| `unitPriceAtTime` | Decimal(12,2)? | Unit price snapshot |
| `userId` | UUID | FK to User (who made change) |
| `createdAt` | DateTime | Immutable timestamp |
| **Relations** | | |
| `item` | Item | Parent item |
| `user` | User | Author |

**Indexes:** `itemId`, `createdAt`, `(isSale, createdAt)` (for report queries)

**Immutability:** Movements are never edited or deleted; audit trail is permanent.

---

## Features

### 1. Authentication & User Management
- **Login:** Email + password (JWT session cookies)
- **Password hashing:** bcryptjs with automatic salt
- **Rate limiting:** Per IP + email sliding window (in-memory)
- **Session validation:** Automatic redirect to login for expired sessions
- **User creation:** Seeded during initial setup

**Files:**
- `src/lib/auth.ts` – Session/JWT utilities
- `src/lib/password.ts` – Bcrypt wrappers
- `src/lib/rate-limit.ts` – Sliding window limiter
- `src/app/login/` – Login page & form

### 2. Inventory Management
- **CRUD:** Create, read, update, delete (soft delete) items
- **Search/filter:** By name, category, low stock
- **Stock adjustments:** RECEIVE, REMOVE, ADJUST with reasons
- **Atomic updates:** Serializable transactions prevent lost updates
- **Custom fields:** JSON metadata per item (extensible)
- **Soft delete:** Deleted items hide from UI but preserve audit trail

**Files:**
- `src/app/(app)/items/` – Item pages
- `src/app/(app)/items/actions.ts` – Item/stock mutations
- `src/app/(app)/items/movement.ts` – Stock math logic (tested)

### 3. Audit Trail & Movement History
- **Per-item timeline:** Every stock change logged immutably
- **Full context:** Who, what, when, why, quantity-before/after
- **CSV export:** Download movement history per item
- **Financial snapshot:** Unit cost/price at time of transaction

**Files:**
- `src/app/(app)/items/[id]/movement-history.tsx` – Display component
- `src/app/(app)/items/[id]/movements/export.csv/route.ts` – Export endpoint
- Movement model in `prisma/schema.prisma`

### 4. Low Stock Alerts
- **Automatic flag:** Items with `quantity < minStock` highlighted
- **Persistent badge:** Count shown in app navigation
- **Filtered view:** `/items?low=1` to jump to low-stock items
- **Configurable threshold:** Per-item `minStock` value

**Files:**
- `src/app/(app)/items/page.tsx` – List with low-stock filter
- Layout navigation component

### 5. Activity & Calendar
- **Activity calendar:** Heatmap of stock adjustments by date
- **Daily summary:** Count of movements per day
- **Color-coded intensity:** Visual distribution across year

**Files:**
- `src/app/(app)/activity/page.tsx` – Calendar page
- `src/app/(app)/activity/calendar.ts` – Calendar logic (tested)
- `src/app/(app)/activity/calendar.test.ts` – Test suite

### 6. User Settings
- **Per-user preferences:** Extensible settings object
- **Profile editing:** Name, email updates
- **Theme selection:** Dark/light mode via next-themes
- **Permission display:** View current permissions

**Files:**
- `src/app/(app)/settings/page.tsx`
- `src/app/(app)/settings/actions.ts`
- `src/app/(app)/settings/settings-form.tsx`

### 7. Financial Reporting
- **Costing:** FIFO-style inventory value tracking
- **Revenue:** Sale-flagged movements aggregated by date/item
- **Profit/Loss:** Cost of goods sold calculations
- **Summary reports:** CSV export of financial data

**Files:**
- `src/app/(app)/reports/page.tsx`
- `src/app/(app)/reports/actions.ts`

### 8. CSV Export
- **Per-item movements:** Full audit trail download
- **Bulk export:** All items and their history
- **Format:** Standard CSV (importable to Excel, Google Sheets)

**Files:**
- `src/lib/csv.ts` – CSV generation (tested)
- `src/lib/csv.test.ts`
- Route handlers in `movements/export.csv/` and `export.csv/`

---

## Routes & Pages

### Public Routes

| Route | Component | Purpose |
|-------|-----------|---------|
| `/login` | `src/app/login/page.tsx` | Login form |
| `/logout` | Action redirect | Sign out |

### Protected Routes (Requires Auth)

| Route | Component | Purpose |
|-------|-----------|---------|
| `/` | `src/app/(app)/page.tsx` | Dashboard (home) |
| `/items` | `src/app/(app)/items/page.tsx` | Item list & search |
| `/items/new` | `src/app/(app)/items/new/page.tsx` | Create item form |
| `/items/:id` | `src/app/(app)/items/[id]/page.tsx` | Item detail & history |
| `/items/:id/edit` | `src/app/(app)/items/[id]/edit/page.tsx` | Edit item form |
| `/items/:id/movements/export.csv` | Route handler | Download item movements |
| `/items/export.csv` | Route handler | Download all movements |
| `/activity` | `src/app/(app)/activity/page.tsx` | Activity calendar |
| `/settings` | `src/app/(app)/settings/page.tsx` | User settings & profile |
| `/reports` | `src/app/(app)/reports/page.tsx` | Financial reports |

**Query Parameters:**
- `?low=1` – Filter items to low stock only (on `/items`)

---

## Server Actions

Located in `**/actions.ts` files throughout `/app`, invoked from client components.

### Authentication (`src/app/login/actions.ts`)
- **`loginAction(email, password)`** – Authenticate and create session
- **`logoutAction()`** – Clear session cookie

### Items Management (`src/app/(app)/items/actions.ts`)
- **`createItemAction(data)`** – Create new item (validates with Zod)
- **`updateItemAction(id, data)`** – Update item metadata
- **`deleteItemAction(id)`** – Soft delete (set deletedAt)
- **`adjustStockAction(id, delta, reason, type)`** – Add/remove/adjust stock (atomic transaction)
- **`duplicateItemAction(id)`** – Clone item with stock 0
- **`listItemsAction(query, filters)`** – Search/filter items

### Item Detail (`src/app/(app)/items/[id]/actions.ts`)
- **`getItemWithMovements(id)`** – Fetch item + movement history
- **`exportMovementsCSV(id)`** – Generate CSV of movements

### Settings (`src/app/(app)/settings/actions.ts`)
- **`updateSettingsAction(data)`** – Update user preferences
- **`updateProfileAction(name, email)`** – Update profile

### Reports (`src/app/(app)/reports/actions.ts`)
- **`generateReportAction(start, end, filters)`** – Generate financial report
- **`exportReportCSV(data)`** – Export report as CSV

### Activity (`src/app/(app)/activity/calendar.ts`)
- **`getCalendarData(userId, year?)`** – Fetch movement counts by day
- **`buildCalendarHeatmap(movements)`** – Transform to display format

---

## Components

### Layout Components
- **`src/app/layout.tsx`** – Root layout with auth middleware
- **`src/app/(app)/layout.tsx`** – App layout with navigation, footer

### Page Components
- **`src/app/(app)/page.tsx`** – Dashboard (quick stats)
- **`src/app/(app)/items/page.tsx`** – Items list (search, filter, pagination)
- **`src/app/(app)/items/new/new-item-form.tsx`** – Create item form
- **`src/app/(app)/items/[id]/page.tsx`** – Item detail + movement history
- **`src/app/(app)/items/[id]/edit/edit-form.tsx`** – Edit item form
- **`src/app/(app)/items/[id]/adjust-form.tsx`** – Stock adjustment UI
- **`src/app/(app)/items/[id]/delete-button.tsx`** – Soft delete UI
- **`src/app/(app)/items/[id]/movement-history.tsx`** – Audit table
- **`src/app/(app)/activity/page.tsx`** – Activity calendar
- **`src/app/(app)/settings/settings-form.tsx`** – Settings form
- **`src/app/(app)/reports/page.tsx`** – Report generation & display

### UI Components (shadcn/ui)
- `ui/button.tsx` – Base button
- `ui/card.tsx` – Card container
- `ui/dialog.tsx` – Modal dialog
- `ui/input.tsx` – Text input
- `ui/label.tsx` – Form label
- `ui/table.tsx` – Data table
- `ui/badge.tsx` – Badge/pill
- `ui/select.tsx` – Dropdown select
- `ui/checkbox.tsx` – Checkbox
- `ui/dropdown-menu.tsx` – Dropdown menu
- `ui/avatar.tsx` – User avatar
- `ui/textarea.tsx` – Multi-line textarea
- `ui/separator.tsx` – Divider
- `ui/sonner.tsx` – Toast notifications (Sonner integration)

---

## Utilities & Helpers

### Authentication & Security (`src/lib/`)

**`auth.ts`**
- `getSessionCookie()` – Retrieve session JWT from cookies
- `createSessionCookie(user)` – Generate JWT session cookie
- `validateSession(cookie)` – Verify and decode JWT
- `getCurrentUser(cookies)` – Extract authenticated user from request

**`password.ts`**
- `hashPassword(plain)` – Bcrypt hash with salt
- `verifyPassword(plain, hash)` – Timing-safe comparison
- `validatePasswordStrength(password)` – Check length/complexity

**`rate-limit.ts`**
- `createRateLimiter(key, max, window)` – Instantiate sliding-window limiter
- `loginLimiter` – Pre-configured IP+email limiter (max 5 attempts / 15 min)

**`permissions.ts`** (with tests)
- `hasPermission(user, action)` – Check if user can perform action
- `requirePermission(user, action)` – Throw if not permitted
- Permissions: MANAGE_USERS, DELETE_ITEMS, EDIT_ITEMS, ADJUST_STOCK

**`prisma.ts`**
- `prisma` – Singleton Prisma client (with connection pooling configured)

### Data Utilities

**`csv.ts`** (with tests)
- `generateMovementCSV(movements)` – Format movements to CSV rows
- `generateReportCSV(data)` – Format report to CSV rows
- `parseCustomFields(json)` – JSON to display string

### General

**`utils.ts`**
- `cn(...)` – Tailwind class merging (clsx + tailwind-merge)
- `formatDate(date)` – Date formatting
- `formatCurrency(amount)` – Number to $USD
- `formatDecimal(amount, decimals)` – Decimal formatting

---

## Configuration

### `package.json`
- **Dependencies:** Next.js, Prisma, React, shadcn/ui, Zod, Jose, etc.
- **Dev dependencies:** TypeScript, Tailwind CSS, Vitest, ESLint
- **Scripts:**
  - `npm run dev` – Start dev server
  - `npm run build` – Prod build
  - `npm run start` – Start prod server
  - `npm run lint` – Run ESLint
  - `npm test` – Run Vitest
  - `npm run seed` – Seed initial data

### `tsconfig.json`
- **Target:** ES2020 + ESNext modules
- **Strict mode:** Enabled
- **Paths:** `@/*` aliases to `src/*`

### `next.config.ts`
- Prod-grade config for Vercel deployment
- Configured for App Router

### `tailwind.config.ts`
- Extended theme with custom colors (Rain & Storm design system)
- CSS grid layout defaults

### `vitest.config.ts`
- Unit test runner with React support
- Glob pattern for `.test.ts` and `.test.tsx` files

### `components.json`
- shadcn/ui configuration (component paths, TypeScript settings)

### `postcss.config.mjs`
- Tailwind CSS v4 PostCSS plugin

---

## Testing

### Test Files

**`src/lib/permissions.test.ts`**
- Permission checking logic
- CRUD permission matrices
- Role-based scenarios (when roles added)

**`src/lib/csv.test.ts`**
- CSV generation for movements
- CSV generation for reports
- Custom field serialization
- Edge cases (special chars, nulls)

**`src/app/(app)/activity/calendar.test.ts`**
- Calendar heatmap data structure
- Date aggregation logic
- Edge cases (leap years, month boundaries)

**`src/app/(app)/items/movement.test.ts`** (implicit)
- Stock movement math (FIFO costing)
- Concurrent adjustment handling
- Lost-update prevention

### Running Tests
```bash
npm test                  # Run all tests (watch mode)
npm run test --no-watch  # Single run
```

---

## Key Implementation Details

### 1. Atomic Stock Adjustments
**File:** `src/app/(app)/items/actions.ts` – `adjustStockAction`

Stock adjustments use a `SERIALIZABLE` Prisma transaction with automatic retry-on-conflict:
```typescript
const result = await prisma.$transaction(
  async (tx) => {
    // Fetch item, compute new quantity, create movement
    // All within serializable transaction
  },
  { isolationLevel: 'Serializable' }
)
```
This prevents lost updates when two users adjust the same item simultaneously.

### 2. Soft Delete Pattern
**Files:** `prisma/schema.prisma`, `src/app/(app)/items/actions.ts`

Deleted items are not cascade-deleted but marked with `deletedAt`:
```typescript
await prisma.item.update({
  where: { id },
  data: { deletedAt: new Date() }
})
```
Queries implicitly filter `deletedAt IS NULL`, preserving audit trail permanently.

### 3. JWT Session Cookies
**File:** `src/lib/auth.ts`

- Created with `jose` (JOSE library, not OAuth/OIDC)
- Signed with `SESSION_SECRET` env var
- Stored as `session` cookie (httpOnly, Secure, SameSite)
- Validated on every protected route via middleware

### 4. Rate Limiting
**File:** `src/lib/rate-limit.ts`

In-memory sliding-window limiter per IP+email:
- 5 failed attempts allowed per 15 minutes
- Per-session in-memory store (not shared across instances)
- TODO: Migrate to Redis for multi-instance deployments

### 5. Custom Fields
**Model:** `Item.customFields` (JSON)

Items can store arbitrary JSON metadata:
```typescript
customFields: {
  sku: "ABC-123",
  supplier: "Acme Corp",
  warranty: "2 years"
}
```
UI and CSV export handle JSON serialization/parsing.

### 6. Financial Tracking
**Model:** Movement fields `unitCostAtTime`, `unitPriceAtTime`, `isSale`

Stock movements snapshot the unit cost/price at transaction time:
- Enables FIFO costing reports
- Tracks revenue separately via `isSale` flag
- Supports profit/loss calculations

### 7. Dark Mode
**Library:** `next-themes`

Theme toggle in settings persists to localStorage and applies via CSS class.

### 8. Route Protection
**File:** `src/proxy.ts`

Global middleware redirects unauthenticated requests to `/login`:
```typescript
export const middleware = (request) => {
  if (!hasValidSession && !isPublicRoute) {
    redirect('/login')
  }
}
```

---

## Quick Development Tasks

### Add a New Feature
1. Define Prisma schema changes in `prisma/schema.prisma`
2. Create migration: `npx prisma migrate dev --name feature_name`
3. Regenerate client: `npx prisma generate`
4. Create route/page in `src/app/(app)/`
5. Write server actions in `actions.ts`
6. Build UI components
7. Write tests if business logic
8. Commit and push

### Add a New Permission
1. Add to `User.permissions` enum logic in `src/lib/permissions.ts`
2. Use `requirePermission(user, 'ACTION')` in server actions
3. Add tests to `permissions.test.ts`

### Debug Stock Calculations
- Test math in `src/app/(app)/items/movement.ts`
- Run `npm test` to verify
- Check transaction isolation in `adjustStockAction`

### Export Data
- Movements CSV: `src/lib/csv.ts`
- Reports CSV: Same file, different formatter
- Add new export format by extending CSV generation

### Add UI Component
1. Copy from shadcn/ui: `npx shadcn-ui@latest add component-name`
2. Edit in `src/components/ui/`
3. Import and use in page components

---

## Environment Variables

Required in `.env` or `.env.local`:

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `SESSION_SECRET` | Yes | JWT signing key (long random string) |
| `NODE_ENV` | Optional | development \| production (defaults to production in deployed) |

---

## Deployment

### Vercel (Recommended)
1. Connect repository to Vercel
2. Set `DATABASE_URL` and `SESSION_SECRET` env vars
3. Vercel auto-runs `npm run build` and `npm start`
4. Migrations applied by running `npx prisma migrate deploy` pre-build (configure in Vercel UI)

### Self-Hosted
1. Build: `npm run build`
2. Start: `npm start` (runs Next.js server)
3. Ensure DATABASE_URL is accessible
4. Run migrations before boot: `npx prisma migrate deploy`
5. Use a process manager (PM2, systemd) to keep app running

---

## Resources

- **Next.js Docs:** https://nextjs.org/docs
- **Prisma Docs:** https://www.prisma.io/docs
- **Zod Validation:** https://zod.dev
- **shadcn/ui:** https://ui.shadcn.com
- **Tailwind CSS:** https://tailwindcss.com
- **Jose JWT:** https://github.com/panva/jose
- **Sonner Toasts:** https://sonner.emilkowal.ski

---

## Contributing

When modifying the codebase:
1. Follow the existing structure (route-based organization)
2. Add tests for business logic (`*.test.ts`)
3. Use Zod for all server action input validation
4. Check permissions at action boundaries
5. Update this index if adding major features/files
6. Keep migrations pure (no data mutations in migration files)

---

*Last updated: 2026-07-10*
*Repository: https://github.com/thatisshayan/let-it-rain*
