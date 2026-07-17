# ADR 0002: Multi-Tenant Data Model

## Status

Accepted

## Context

Let It Rain moved from a single-tenant inventory system to a multi-tenant product where one `Organization` represents one business.

That change had two hard requirements:

1. strict data isolation between organizations
2. query patterns that stay simple and fast in the hottest paths

This ADR records the tenant-boundary decisions that were actually implemented in the schema and codebase.

## Decision

### Organization is the tenant root

- `Organization` is the top-level tenant entity.
- A signed-in user belongs to exactly one organization in the current product model.
- Tenant scoping is always derived server-side from the authenticated user/session, never trusted from client input.

### Direct organization scoping on tenant-owned tables

The following tables carry a direct `organizationId`:

- `User`
- `Item`
- `Movement`
- `Order`
- `AuditLog`
- `AppConfig`
- `EmailVerificationToken`

The purpose is straightforward: service and reporting queries can filter by organization directly instead of reconstructing tenant scope through multiple joins.

### Denormalization is allowed when it buys real query value

`Movement` has its own direct `organizationId` even though it also links to `Item` and `User`.

That was intentional. `Movement` is one of the hottest read tables in the system:

- activity views
- reporting
- date-range scans

Requiring a join through `Item` only to establish tenant scope would add cost to the most common reads for little benefit.

### OrderLineItem is scoped through Order, not directly

`OrderLineItem` does not carry its own `organizationId`.

That was also intentional:

- it is not queried as an independent tenant-owned aggregate
- it is created and read under an already-org-scoped `Order`
- adding another tenant column there would create extra write and consistency cost without current query benefit

### AppConfig is one row per organization

`AppConfig` is no longer treated as a global singleton.

- the effective key is `organizationId`
- each organization has at most one settings row
- any old `id = 1` global-singleton assumption is invalid

## Consequences

### Positive

- Tenant isolation is explicit in the data model.
- Query scoping is easier to review and reason about.
- The hottest reporting and activity queries avoid unnecessary tenant joins.
- Future features like billing and org-level settings compose naturally around `Organization`.

### Tradeoffs

- Some write paths carry denormalized tenant data.
- Cross-table consistency matters more when a table stores its own `organizationId`.
- Every new tenant-owned table must make an explicit scoping decision rather than inheriting one accidentally.

## Enforcement

The schema decision is only half of the model. In practice, this ADR assumes:

- authenticated sessions carry `organizationId`
- service-layer queries scope by that organization
- API handlers and server actions do not allow client-supplied tenant overrides
- cross-org isolation is verified by tests, not trusted by convention

## Non-Goals

This ADR does not establish:

- multi-organization membership for one user
- subdomain routing per organization
- per-location inventory scoping inside one organization
- customer-facing branding or white-label behavior

Those are separate decisions if the product ever needs them.
