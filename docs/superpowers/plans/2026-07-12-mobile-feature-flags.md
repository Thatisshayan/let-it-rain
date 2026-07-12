# Feature Flags Plan (Phase 11)

## Goal

Allow dark-shipping of features per-business once multi-tenancy (Phase 10)
exists. For now, provide a lightweight client-side flag system that can be
used for A/B testing gradual rollouts of new mobile features.

## Approach

### Client-side flag provider

A React context that reads flags from a JSON endpoint or local config:

```typescript
// src/flags.ts
type FeatureFlag = {
  key: string;
  enabled: boolean;
  description?: string;
};

const DEFAULT_FLAGS: Record<string, boolean> = {
  "new-dashboard": false,
  "advanced-reporting": false,
  "offline-queue-v2": false,
  "help-center": false,
};
```

### API-backed resolution (when Phase 10 ships)

1. Add a `GET /api/v1/flags` endpoint that returns per-business flags
2. Cache flags in SecureStore for offline access
3. Provider refreshes on app foreground

### Usage pattern

```typescript
function useFlag(key: string): boolean {
  const { flags } = useFlags();
  return flags[key] ?? DEFAULT_FLAGS[key] ?? false;
}

// In a component:
if (!useFlag("new-dashboard")) return <OldDashboard />;
return <NewDashboard />;
```

## Flag inventory (proposed)

| Flag | Purpose |
|---|---|
| `new-dashboard` | Version 2 dashboard layout |
| `help-center` | Toggle the in-app help center |
| `offline-queue-v2` | Extended offline support beyond delivery actions |
| `advanced-reporting` | Additional report views for power users |

## Implementation notes

- Keep flags simple boolean checks — no percentage rollouts, no gradual ramp
- No server-side evaluation needed until Phase 10 multi-tenancy
- Flags module should be tree-shakeable (dead flags don't bloat bundle)
