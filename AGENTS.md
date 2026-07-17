# LetItRain — Agent Rules

This file is the first-stop instruction set for any agent working in this repository.

## Mandatory Read Order

Before planning, editing, or reporting completion, every agent must read:

1. **[Baseline Rules](#baseline)** — Foundational agent rules (adapted from RemoteCliControl)
2. [README.md](./README.md)
3. [STATUS.md](./STATUS.md) — current project state
4. Phase summaries (PHASE*.md files) — implementation notes
5. [Next.js-specific rules](#nextjs-specific-rules) below

## Baseline

All repositories follow the foundational agent rules established in the RemoteCliControl project:

- Keep docs findable and current while work is in progress
- Do not claim completion without verification
- Do not silently skip requested steps
- Record deferred work in appropriate documentation
- Keep the repo stable, review existing failures, and report what was pre-existing
- Code changes must be actually applied and tested
- Documentation must be updated in the same pass as code changes
- Verification must be run (or concrete blockers reported)

For full details, see [RemoteCliControl/AGENTS.md](../RemoteCliControl/AGENTS.md).

## LetItRain-Specific Context

**Project**: Education/training platform with Next.js 14, Prisma, mobile support, and component registry

**Key Traits**:
- Complex phase-based development (currently in Phase 13)
- Multiple platform support (web + mobile)
- Component registry (components.json) for UI consistency
- Governance and handoff documentation maintained throughout

---

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
