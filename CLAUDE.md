# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

---

## Project-specific: WebCraft AI

Pure-frontend AI web-tool generator (React 18 + TypeScript + Vite + Ant Design 5,
HashRouter), deployed to GitHub Pages. No backend.

### Workflow

- **Develop on** `claude/repo-overview-zbalmv`. Deployment triggers on push to
  `main`, so merge dev → `main` (`--ff-only`) when a change is ready to verify live.
- **Verify before merging** — all three must pass: `npx tsc --noEmit`,
  `npx vitest run`, `npm run build`.
- Commit one logical change at a time. End commit messages with the
  `Co-Authored-By:` and `Claude-Session:` footer lines.
- Tests live next to source as `*.test.ts` (vitest). Add/extend tests for
  pure logic (parsers, diff, patch).
- UI copy is Traditional Chinese (zh-Hant).

### Single source of truth for docs

`docs/webcraft-ai.md` holds spec, architecture, roadmap, and changelog. Update its
變更紀錄 when adding/changing features — don't create new scattered doc files.

### Architecture gotchas (don't reintroduce fixed bugs)

- Generated tools run in a sandboxed iframe (`sandbox="allow-scripts"`, `srcdoc`,
  origin `null`). They **cannot** use `localStorage`/`sessionStorage` — persistence
  goes through `window.bridge.storage`. The bridge script is **inlined** into the
  srcdoc (an opaque-origin iframe can't load it by URL).
- Use Ant Design theme tokens (`theme.useToken()`) for colors, **not hardcoded
  hex** — the app supports dark/light via `ThemeProvider`.
- Do **not** hand-split `react`/`antd`/`icons` via Vite `manualChunks` — it breaks
  cross-chunk init order (`Cannot read properties of undefined (reading 'primary')`).
  Rely on Vite's default chunking.
- LLM streaming must buffer partial SSE lines across network chunks (a `data:` line
  can split across reads).
- Bridge resolves data-source/MCP names tolerantly (exact → case/space-insensitive
  → single source of that type) because the LLM may rename sources in generated code.
