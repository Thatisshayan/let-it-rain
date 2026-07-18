# Mobile Polish and Accessibility Design

## Status

Approved by the project owner on 2026-07-18. This design addresses the confirmed mobile audit findings before device QA.

## Goal

Make the redesigned mobile command surface safe to use with Face ID, consistent across loading/error/permission states, and reliably usable with VoiceOver or TalkBack.

## Scope

1. Correct the Face ID lock so a locked app only unlocks after an explicit successful biometric action.
2. Establish shared, accessible interaction and state patterns, then apply them to the redesigned mobile surfaces.
3. Respect the device reduced-motion preference for feedback animations.
4. Add regression coverage and correct project documentation that currently overstates accessibility coverage.
5. Produce a device QA matrix for iPhone/TestFlight validation after the code pass.

## Non-goals

- No new mobile product features.
- No broad web redesign: the web command-surface redesign is already established and will receive only targeted polish if later QA identifies a concrete issue.
- No Stripe, billing, or public paid-launch work.

## Architecture

The existing `mobile/src/ui/command.tsx` module remains the visual-system boundary. It will gain small, focused primitives or props for action semantics and standardized status presentation; individual screens supply contextual copy and route actions. `AuthGate` remains responsible only for rendering and invoking the existing authentication-context unlock operation; it must never unlock itself as an effect of becoming locked.

Reduced-motion handling will live beside the existing mobile feedback primitives so that skeleton and toast behavior use one policy instead of each screen inventing its own animation rule.

## Interaction and Accessibility Requirements

- Every actionable `Pressable` has an explicit role, unique label, and disabled/selected/checked state where applicable.
- Form inputs have stable programmatic labels, appropriate keyboard/autofill hints where relevant, and errors/success feedback that assistive technology can announce.
- Permission denied, loading, empty, and error states use the same hierarchy: title, concise explanation, and retry only when retry is meaningful.
- The Face ID screen includes an explicit, accessible unlock button and does not bypass the local lock state.
- Skeleton and toast animations respect reduced-motion preferences; feedback remains visible when animation is reduced.

## Verification

- Add focused unit tests for the Face ID gate and shared UI/state behavior.
- Run mobile typecheck and all mobile tests, then root typecheck and all root tests.
- Run the iPhone QA matrix on a small and a large device, in light/dark appearance, with VoiceOver and reduced motion enabled.

## Documentation Policy

The roadmap will distinguish enabled self-service signup from the deferred external paid launch. The mobile README will state the verified accessibility coverage precisely rather than claiming universal metadata before the audit fixes are complete.
