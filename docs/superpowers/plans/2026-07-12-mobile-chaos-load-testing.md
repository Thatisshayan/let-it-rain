# Chaos & Load Testing Plan (Phase 11)

## Target

Verify the SERIALIZABLE-transaction stock logic under real concurrent load,
validate the mobile app's behavior under network disruption, and identify
bottlenecks before a busy season.

## Scope

1. **API concurrency** — SERIALIZABLE retry-on-conflict in `items/service.ts`
   (`adjustStock`). Two simultaneous adjustments to the same item must not
   produce a lost update. Test with N concurrent requests (N=10, 50, 100).
2. **Mobile offline resilience** — the offline queue (`src/offlineQueue.ts`)
   must survive network interruptions, app backgrounding, and rapid toggles
   without data loss or duplicate delivery.
3. **Mobile error recovery** — all screens must gracefully handle 4xx/5xx API
   responses, timeouts, and connectivity loss without crashing.

## Tools

- **k6** for API load testing (open-source, scriptable in JS)
- **Manual chaos testing** for mobile: Airplane Mode toggling, slow network
  (Network Link Conditioner on iOS), rapid screen transitions

## API Load Test Scenario (k6)

```javascript
// scripts/load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '1m', target: 50 },
    { duration: '30s', target: 100 },
    { duration: '1m', target: 100 },
    { duration: '30s', target: 0 },
  ],
};

const BASE_URL = __ENV.API_BASE_URL || 'http://localhost:3000';
const AUTH_TOKEN = __ENV.AUTH_TOKEN;

export default function () {
  const headers = { Authorization: `Bearer ${AUTH_TOKEN}`, 'Content-Type': 'application/json' };

  // GET /api/v1/items (read-heavy)
  const itemsRes = http.get(`${BASE_URL}/api/v1/items`, { headers });
  check(itemsRes, { 'items status 200': (r) => r.status === 200 });

  // POST /api/v1/items/:id/movements (write with SERIALIZABLE isolation)
  const items = itemsRes.json().items || [];
  if (items.length > 0) {
    const item = items[Math.floor(Math.random() * items.length)];
    const movRes = http.post(
      `${BASE_URL}/api/v1/items/${item.id}/movements`,
      JSON.stringify({ type: 'RECEIVE', delta: 1 }),
      { headers }
    );
    check(movRes, { 'movement status 200/201': (r) => r.status === 200 || r.status === 201 });
  }

  sleep(1);
}
```

## Mobile Chaos Test Scenarios

| Scenario | How to test | Expected behavior |
|---|---|---|
| Network loss during delivery confirm | Enable Airplane Mode, tap "Mark delivered" | Offline queue captures action; toast shows "will sync" |
| Network restore after offline queue | Disable Airplane Mode after 30s | Queue auto-flushes; toast shows sync count |
| Rapid back-to-back API failures | Use slow 3G throttle, navigate quickly | Each screen shows inline error; no crash |
| 401 expiry mid-session | Modify token to be expired, trigger any API call | `client.ts` catches 401, clears token, redirects to login |
| Timeout | Set `REQUEST_TIMEOUT_MS=1` via DevTools, trigger any API | ApiError(0) with timeout message; no unhandled rejection |
| Rapid screen transitions | Navigate between 6 tabs rapidly | React Query's stale-while-revalidate handles; no blank screens |

## Success Criteria

- No lost-update bugs in SERIALIZABLE concurrency test (100 concurrent writers
  to the same item all succeed without data corruption)
- All 6 chaos scenarios pass without app crash
- 95th percentile API response time < 500ms under 100 concurrent users
- Zero unhandled promise rejections across all scenarios
