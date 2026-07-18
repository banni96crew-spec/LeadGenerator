---
name: run-pipeline-stage
description: Run LeadGenerator pipeline stages via CLI — resolve lead, branch routing, execute stage, run gate, update state.json. Use this skill whenever implementing src/orchestrator/, running npm run pipeline, debugging state.json stage status, forcing stage rerun with --force, or understanding gate-before-next-stage flow. Also use for --lead, --data, --stage, --force flags, idempotency hashes, «полный pipeline с gates», «запусти pipeline», or why a stage did not advance. Do NOT use for JSON schema-only validation (validate-contract), Playwright capture (capture-website), site probe (probe-site), or Excel lead import (resolve-lead Level 3).
---

# Run Pipeline Stage

Orchestrator CLI and state machine procedure.

## When to use

- Implementing `src/orchestrator/index.ts`, `pipeline.ts`, `state.ts`.
- Running or debugging `npm run pipeline -- --data ...` or `--lead ... --stage ...`.
- Understanding why `state.json` shows `failed`, `pending`, or stage did not advance.
- Applying `--force` to bypass idempotency skip.
- User asks about gate retry, stage order, or milestone scope through M5 offer + G6.
- User says **«полный pipeline с gates»**, **«запусти pipeline»**, or wants end-to-end run (not just resolve lead).

**Not for:** isolated schema validation (`validate-contract`). Not for probe-only routing (`probe-site`). Not for detailed Excel resolve (`resolve-lead`).

## Routing: «полный pipeline с gates»

When the user asks to run the **full pipeline with gates** — this skill wins over `resolve-lead` (S12). `resolve-lead` is only step 1 inside this flow.

**Expected agent behavior (in order):**

1. **Load this skill** (`run-pipeline-stage`) — not `resolve-lead` alone.
2. **If `src/orchestrator/index.ts` exists** — **run** the CLI, do not start greenfield implementation:
   ```bash
   npm run pipeline -- --data '{"name":"Domeo","site":"https://domeo.ru"}'
   ```
3. **Explain current scope (through M5):** runnable stages `capture|audit|copy|design|publish|offer` + G1–G6; `research` stays pending until a later milestone. Publish: deploy → smoke → G5. Offer: `generateAuditPdf` → A1 await `offer.json` **and** `offer.md` (exit 3) → G6 (`checkOfferLinks` + tone lint).
4. **If `src/` absent** — describe the procedure from §5–§8 (spec-first); ask before implementing Foundation.
5. **Do not** implement Research in response to a run request — only execute what exists.

Wrong response: «Полный pipeline не реализован — создаю схемы, оркестратор…» when `src/orchestrator/` already exists. Check filesystem first, then run or report gap.

## Related rules

- [10-orchestrator.mdc](../../rules/10-orchestrator.mdc) — modules, CLI, idempotency, Foundation scope
- [03-pipeline-gates.mdc](../../rules/03-pipeline-gates.mdc) — gate-before-next-stage, retry, fail policy
- [01-contract-first.mdc](../../rules/01-contract-first.mdc) — `state.json` validation

## Prerequisites

- Planned entry: `src/orchestrator/index.ts` with `node:util` `parseArgs`.
- `src/lib/paths.ts` for lead directories (no hardcoded absolute paths).
- Steps and gates delegated — not inlined in `pipeline.ts`.
- `src/` may be absent — spec-first; current code runs through **offer + G6** (M5).

## Procedure

### 1. CLI invocation

```bash
npm run pipeline -- --data '{"name":"Domeo","site":"https://domeo.ru"}'
npm run pipeline -- --lead leads/domeo/lead.json
npm run pipeline -- --lead leads/domeo --stage capture
npm run pipeline -- --lead leads/domeo --stage publish
npm run pipeline -- --lead leads/domeo --stage offer
npm run pipeline -- --lead leads/domeo --stage capture --force
```

| Flag | Purpose |
|------|---------|
| `--data <json>` | Inline lead → resolve to `leads/{slug}/lead.json` |
| `--lead <path>` | Existing lead dir or `lead.json` path |
| `--stage <name>` | Run single stage (+ its gate) |
| `--force` | Bypass idempotency skip; gates still run |

### 2. Resolve lead (summary)

`resolveLead.ts` normalizes input → `leads/{slug}/lead.json`, validates `lead` schema, `slugify(name)` → `lead_id`.

Full Excel/inline procedures: `resolve-lead` skill (S12, Level 3). This skill only references resolve as orchestrator step 1.

### 3. Initialize / load state

`state.ts`:

1. `initState(lead_id, branch)` or `loadState(leadDir)`.
2. Validate against `state` schema on save.
3. Stage statuses: `pending | running | done | skipped | failed`.

### 4. Branch routing

Call `decideBranch(lead)` from `routing.ts` (`probe-site` skill). Persist `branch` in `state.json`.

- `no_website` → `capture.status = skipped`, skip Playwright.
- `has_website` → schedule Capture.

### 5. Stage execution loop

`pipeline.ts` state machine (no LLM, no content generation):

```
resolve → branch → for each stage (or --stage target):
  if shouldSkip(hash, force): continue
  updateStage(running)
  run stage module (e.g. src/steps/capture/)
  run gate after stage (e.g. runGateG1)
  if gate.pass:
    updateStage(done, artifact, hash, cost)
  else:
    retry per 03-pipeline-gates policy
    on exhaustion: updateStage(failed, error)
    STOP — do not start next stage
```

Delegate: Playwright → `src/steps/capture/`; gates → `src/gates/`; validation → `validate-contract`.

### 6. Gate integration (policy reference)

Gate-before-next-stage is mandatory (`03-pipeline-gates`). On fail:

- Record `error` in `state.json.stages.{name}.error`.
- Retry per gate table (e.g. G1: 2× capture).
- Never set `status: done` on gate fail.

Detailed G1 tech checks: `gate-g1-capture` (S8). This skill orchestrates **when** gates run, not **how** each check is implemented.

### 7. Idempotency

`shouldSkip(hash, force)`:

- If input hash unchanged and artifact valid → skip stage.
- `--force` bypasses skip but **still runs gates**.

### 8. Milestone scope (through M5)

Runnable: **capture|audit|copy|design|publish|offer** + G1–G6.

`research` remains pending until a later milestone. Publish cycle: `runPublish` → `smokeTestUrl` → `runGateG5`; `PUBLISH_MAX_ATTEMPTS=2` full-cycle retries; `publish.hash === design.hash`. Offer cycle (A1, no inner while-loop): `syncOfferWithPublishHash` → idempotent skip (sync `offerArtifactIsValid`, no re-fetch) → `generateAuditPdf` → await both `offer/offer.json` and `offer/offer.md` (exit 3 if either missing/empty) → `await runGateG6`; `OFFER_MAX_ATTEMPTS=2` via CLI re-runs; `offer.hash === publish.hash`.

### 9. Logging

`src/lib/log.ts`: `{ stage, status, ms, cost, lead_id }`. Code stages: `cost: 0`.

## Inputs / Outputs

| Input | Output |
|-------|--------|
| CLI flags + lead data | `leads/{id}/lead.json`, `state.json` |
| Stage run success + gate pass | `stages.{name}.status: done`, `artifact`, `hash` |
| Gate fail | `stages.{name}.status: failed`, `error` diagnostic |
| `no_website` | `capture.status: skipped` |

**Code owner (planned):** `src/orchestrator/index.ts`, `pipeline.ts`, `state.ts`  
**Stage:** Orchestrator + CLI

## Verification

| Check | Status |
|-------|--------|
| Lead with site → capture runs, G1 evaluated | not run |
| Lead without site → capture skipped | not run |
| Re-run without `--force` → skip on hash match | not run |
| `--force` → capture reruns | not run |
| Gate fail blocks next stage | not run |

## Test prompts

1. «Запусти pipeline для domeo с --stage capture и объясни state.json после G1»
2. «Запусти полный pipeline с gates» → **this skill**; run CLI if `src/` exists; Foundation = capture+G1 only; other stages `pending`
3. «Audit готов — запусти Copy без G2» (must refuse — gate blocks next stage)
4. «Добавь isLlmStage в routing.ts» (must refuse — belongs in `pipeline.ts`)

## Forbidden

- Do not set `status: done` before gate returns `pass`.
- Do not skip gates because output «looks fine».
- Do not embed Playwright, ajv, or gate logic inline in `pipeline.ts`.
- Do not use LLM for routing or stage decisions.
- Do not implement Research without milestone approval.
- Do not import future LLM agent modules from orchestrator.
- Do not duplicate full G1–G6 table — link `03-pipeline-gates` and Level 2 gate skills (`link-check` for G6).
