---
name: probe-site
description: Probe a lead website URL with fetch to decide has_website vs no_website branch — HTTP 200, not parking, non-empty HTML. Use this skill whenever implementing decideBranch or probeSite in src/orchestrator/routing.ts, debugging why a lead routed to no_website, or checking site availability before Capture. Also use when the user mentions branch routing, site probe, parking page detection, or has_website decision. Do NOT use for Playwright capture, LLM routing, stage graphs, or pipeline CLI — those are capture-website and run-pipeline-stage.
---

# Probe Site

Code-only HTTP probe for orchestrator branch routing.

## When to use

- Implementing `probeSite()` and `decideBranch()` in `src/orchestrator/routing.ts`.
- Debugging why a lead with a URL got `branch: no_website`.
- Pre-flight check before scheduling Capture (orchestrator calls this during resolve/branch).
- User asks about `has_website` / `no_website` routing without browser automation.

**Not for:** Playwright screenshots (`capture-website`). Not for running full pipeline (`run-pipeline-stage`). Not for resolving Excel/inline lead input (`resolve-lead`, Level 3).

## Related rules

- [10-orchestrator.mdc](../../rules/10-orchestrator.mdc) — `routing.ts` scope, `decideBranch`, `probeSite`
- [02-llm-invariants.mdc](../../rules/02-llm-invariants.mdc) — routing is code, not LLM
- [00-project-overview.mdc](../../rules/00-project-overview.mdc) — `routing.ts` exports only branch probe functions

## Prerequisites

- `lead.json` loaded with `site` field (may be empty).
- `fetch` available (Node 18+ global or undici).
- No Playwright required for probe.
- `src/` may be absent — procedure describes planned `routing.ts` only.

## Procedure

### 1. Module scope (strict)

`src/orchestrator/routing.ts` contains **only**:

- `decideBranch(lead): 'has_website' | 'no_website'`
- `probeSite(url): Promise<ProbeResult>` (internal helper)

Stage graph, LLM stage metadata, `getLlm*`, `isLlmStage` belong in `pipeline.ts` or `src/lib/pipeline-graph.ts` — **not** here.

### 2. `decideBranch(lead)`

```
if lead.site is empty / missing / whitespace-only:
  return 'no_website'
else:
  result = await probeSite(lead.site)
  return result.ok ? 'has_website' : 'no_website'
```

Orchestrator on `no_website`: set `capture.status = skipped`, skip Playwright.

### 3. `probeSite(url)` — fetch probe

1. Normalize URL (ensure scheme `https://` if missing).
2. `fetch(url, { signal: AbortSignal.timeout(8_000) })` — timeout ~8s per `10-orchestrator`.
3. Check **HTTP 200**. Non-200 → `ok: false`.
4. Read response body as text (limit size e.g. 512KB to avoid memory issues).
5. **Non-empty HTML:** body length above minimal threshold (e.g. > 100 chars after trim).
6. **Not parking:** reject known parking/placeholder patterns:
   - «domain for sale», «parked», «скоро откроется», registrar parking templates
   - Very short pages with only domain name
   - Implement as small deterministic keyword/heuristic list — no LLM.

Return shape (internal):

```typescript
type ProbeResult = { ok: boolean; httpStatus: number; reason?: string };
```

### 4. Persist branch

Orchestrator writes `branch` to `state.json` after `decideBranch`. Validate `state.json` via `validate-contract`.

### 5. Failure handling

- Timeout / DNS error → `ok: false`, reason logged; branch `no_website` or fail resolve per orchestrator policy.
- Do not run Capture when probe fails or site empty.

## Inputs / Outputs

| Input | Output |
|-------|--------|
| `lead.site` URL string | `has_website` or `no_website` |
| Empty/missing `site` | `no_website` (no fetch) |
| `ProbeResult` (internal) | `ok`, `httpStatus`, optional `reason` |

**Code owner (planned):** `src/orchestrator/routing.ts`  
**Stage:** Orchestrator routing (before Capture)

## Verification

| Check | Status |
|-------|--------|
| Empty site → `no_website` without fetch | not run |
| Live business site → `has_website` | not run |
| Parking domain → `no_website` | not run |
| `routing.ts` has no LLM imports | not run (no `src/`) |

## Test prompts

1. «Реализуй probeSite в routing.ts — fetch 8s timeout, HTTP 200, не парковка»
2. «Добавь LLM routing в routing.ts для выбора ветки» (must refuse — cite Forbidden)
3. «Почему лид с site=https://domeo.ru получил no_website?» (should use probe diagnostics, not Playwright)

## Forbidden

- Do not use LLM for branch decisions or parking detection.
- Do not add stage graph, pipeline stage lists, or `getLlm*` / `isLlmStage` to `routing.ts`.
- Do not use Playwright in probe — fetch only (Capture uses browser).
- Do not run Capture from this module.
- Do not mutate `state.json` inside `routing.ts` — return branch; orchestrator persists.
- Do not implement full lead resolution from Excel (`resolve-lead`, S12).
