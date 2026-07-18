# Mobile Polish and Accessibility Implementation Plan

> **For agentic workers:** Execute inline in this workspace. Subagent execution is unavailable under the repository collaboration rules. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the Face ID bypass and make the redesigned mobile command surface consistently accessible and stateful before iPhone QA.

**Architecture:** Keep the shared command UI as the visual boundary. Repair authentication locally in `AuthGate`, use React Native accessibility props on every interactive control, and standardize status presentation through a focused shared component. Reduced-motion behavior is centralized in the two existing feedback primitives.

**Tech Stack:** Expo Router, React Native 0.86, TypeScript, Vitest, React Native Testing Library, React Native Animated.

---

### Task 1: Repair the Face ID lock regression

**Files:**
- Modify: `mobile/src/api/AuthGate.tsx`
- Modify: `mobile/src/__tests__/auth-gate.test.tsx`

- [ ] Add a failing locked-state test that renders `AuthGate` with `isLocked: true` and asserts the protected child is absent and `unlock` has not been called after effects flush.
- [ ] Remove the effect that calls `unlock()` merely because `isLocked` is true.
- [ ] Add `accessibilityRole="button"`, `accessibilityLabel="Unlock with Face ID"`, and an enabled accessibility state to the existing unlock button.
- [ ] Add a test that presses the named unlock control and asserts exactly one `unlock` invocation.
- [ ] Run `npm --prefix mobile test -- auth-gate.test.tsx`; expected result: passing.

### Task 2: Establish shared accessible state primitives

**Files:**
- Modify: `mobile/src/ui/command.tsx`
- Modify: `mobile/src/__tests__/items-screen.test.tsx`

- [ ] Add a `StatusMessage` component with explicit `accessibilityRole="alert"` for errors and permission denial, plus title, detail, and an optional labelled retry action.
- [ ] Keep `EmptyMessage` for non-error empty data only; do not give ordinary empty states alert semantics.
- [ ] Extend `ListRow` so pressable rows expose an enabled accessibility state and use the visual title as the fallback label when no explicit label is supplied.
- [ ] Add focused rendering assertions proving error/retry and fallback labels are exposed.
- [ ] Run the affected mobile screen tests; expected result: passing.

### Task 3: Apply accessibility and state consistency to redesigned screens

**Files:**
- Modify: `mobile/app/(tabs)/activity.tsx`, `mobile/app/(tabs)/reports.tsx`, `mobile/app/(tabs)/orders.tsx`, `mobile/app/(tabs)/settings.tsx`
- Modify: `mobile/app/items/new.tsx`, `mobile/app/items/[id]/index.tsx`, `mobile/app/items/[id]/edit.tsx`, `mobile/app/items/[id]/adjust.tsx`
- Modify: `mobile/app/orders/new.tsx`, `mobile/app/orders/[id].tsx`
- Modify: `mobile/app/settings/account.tsx`, `mobile/app/settings/organization.tsx`, `mobile/app/settings/users/index.tsx`, `mobile/app/settings/users/new.tsx`, `mobile/app/settings/users/[id].tsx`
- Modify: the matching tests under `mobile/src/__tests__/`

- [ ] Replace plain permission/loading/error text with `StatusMessage` where a route is blocked or a fetch fails; include retry only for failed reads.
- [ ] Add a role, descriptive label, and disabled/selected/checked state as appropriate to every actionable `Pressable` in the listed files.
- [ ] Add `accessibilityLabel`, email/password/numeric keyboard hints, and autofill hints to every form `TextInput`; expose validation and success feedback as alerts.
- [ ] Ensure permission selection controls announce their selected state rather than relying on color.
- [ ] Add regression assertions to the existing screen test files for representative destructive, disabled, retry, and selected controls.
- [ ] Run `npm --prefix mobile test`; expected result: all tests passing.

### Task 4: Respect reduced motion and correct documentation

**Files:**
- Modify: `mobile/src/Skeleton.tsx`, `mobile/src/toast.tsx`
- Modify: `mobile/README.md`, `LETITRAINNEXTSPRIN.md`, `STATUS.md`
- Create: `docs/qa/2026-07-18-mobile-device-qa-matrix.md`

- [ ] Read the system reduced-motion preference in the skeleton and toast primitives; render the same feedback without looping or transition animation when reduction is enabled.
- [ ] Add unit coverage for the non-animated reduced-motion branch where the test runtime can control the preference; otherwise document the device-only check in the QA matrix.
- [ ] Correct the mobile README to describe verified accessibility coverage accurately.
- [ ] Clarify that self-service signup is enabled for the current internal deployment while the external paid launch remains deferred until Stripe and email operations are ready.
- [ ] Create the iPhone matrix covering small/large screens, dark/light appearance, VoiceOver, Dynamic Type, reduced motion, role variants, and core flows.
- [ ] Run `npm --prefix mobile run typecheck`, `npm --prefix mobile test`, `npm run typecheck`, `npm test`, and `git diff --check`; expected result: all pass.

### Task 5: Commit and hand off

**Files:**
- Modify: every file changed by Tasks 1–4

- [ ] Review `git status --short` to ensure only intentional project files are staged; leave existing `.claude/`, preview-log, and codebase-memory artifacts untracked.
- [ ] Commit the implementation and documentation with a message beginning `fix: harden mobile accessibility and lock flow`.
- [ ] Report automated verification results separately from device QA that still requires an iPhone/TestFlight run.
