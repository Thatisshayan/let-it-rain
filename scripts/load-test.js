// k6 load test for Let It Rain API — concurrent stock adjustments
// Usage:
//   k6 run scripts/load-test.js -e API_BASE_URL=http://localhost:3000 -e AUTH_TOKEN=<token>
//
// See docs/superpowers/plans/2026-07-12-mobile-chaos-load-testing.md

import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "30s", target: 10 },
    { duration: "1m", target: 50 },
    { duration: "30s", target: 100 },
    { duration: "1m", target: 100 },
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<500"],
    http_req_failed: ["rate<0.01"],
  },
};

const BASE_URL = __ENV.API_BASE_URL || "http://localhost:3000";
const AUTH_TOKEN = __ENV.AUTH_TOKEN;
const HEADERS = {
  Authorization: `Bearer ${AUTH_TOKEN}`,
  "Content-Type": "application/json",
};

export default function () {
  const itemsRes = http.get(`${BASE_URL}/api/v1/items`, { headers: HEADERS });
  check(itemsRes, { "items status 200": (r) => r.status === 200 });

  const items = itemsRes.json().items || [];
  if (items.length > 0) {
    const item = items[Math.floor(Math.random() * items.length)];
    const movRes = http.post(
      `${BASE_URL}/api/v1/items/${item.id}/movements`,
      JSON.stringify({ type: "RECEIVE", delta: 1 }),
      { headers: HEADERS }
    );
    check(movRes, {
      "movement accepted": (r) => r.status === 200 || r.status === 201,
    });
  }

  const ordersRes = http.get(`${BASE_URL}/api/v1/orders`, { headers: HEADERS });
  check(ordersRes, { "orders status 200": (r) => r.status === 200 });

  const reportsRes = http.get(`${BASE_URL}/api/v1/reports`, { headers: HEADERS });
  check(reportsRes, { "reports status 200": (r) => r.status === 200 });

  sleep(1);
}
