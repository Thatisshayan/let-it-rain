# Mobile Device QA Matrix — 2026-07-18

Run this after the accessibility/polish changes are installed in a TestFlight or development build. Record the device, iOS version, account role, and pass/fail result for each row.

| Area | Required check |
|---|---|
| Device sizes | iPhone SE-class and large iPhone; light and dark appearance; no clipped header, tab bar, modal, or keyboard-covered primary action. |
| Authentication | Sign in, background/resume, enable Face ID, verify the app stays locked until the named Face ID unlock action succeeds, then sign out. |
| VoiceOver | Traverse every tab, month control, list row, form field, destructive action, selected permission, and retry button; labels and state must match visible meaning. |
| Dynamic Type | Largest supported text size on Dashboard, Items, Orders, Activity, Reports, and Settings; content wraps or scrolls without overlap. |
| Reduced motion | Enable Reduce Motion; skeleton and toast feedback remain visible without distracting looping or transition animation. |
| Inventory | Search, low-stock switch, category/sort chips, item detail, create/edit/adjust, export, empty state, failed load/retry, and swipe alternative. |
| Orders | Admin creates/assigns/cancels; driver opens assigned order, marks out for delivery/delivered, then verifies queued delivery recovery after reconnect. |
| Permissions | Admin, limited inventory user, driver, and no-reports user each see correct tabs, denied states, and API-backed constraints. |
| Settings | Account name/password, sign out everywhere, organization settings, user creation, permission selection, activation, and password reset. |
