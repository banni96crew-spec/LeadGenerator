---
name: resolve-lead
description: Resolve pipeline input into leads/{slug}/lead.json and lead_id — inline JSON via --data (Foundation) or Excel row from leads.xlsx (milestone 7). Use this skill when implementing src/orchestrator/resolveLead.ts, slugify company name, validating lead.schema.json, or debugging missing lead directory before capture. Also use for --data CLI payload, leads.xlsx import, or normalizing lead fields name/site/geo. Do NOT use for full pipeline CLI (run-pipeline-stage), branch routing probe-site, or writing state.json stage graph.
---

# Resolve Lead

Normalize user/CLI input into blackboard lead entry.

## When to use

- Implementing `resolveLead()` in `src/orchestrator/resolveLead.ts`.
- First step of pipeline before `probe-site` / `run-pipeline-stage`.
- User passes `--data '{"name":"...","site":"..."}'` or Excel row.
- Debugging missing `leads/{slug}/lead.json` or invalid `lead_id`.

**Not for:** full orchestrator loop (`run-pipeline-stage`). Not for `has_website` probe (`probe-site`). Not for gate execution or stage status updates.

## Routing: redirect «полный pipeline»

If the user asks **«запусти полный pipeline с gates»**, **«запусти pipeline»**, or end-to-end run with gates:

1. **Stop** — this skill alone is insufficient.
2. **Redirect** to `run-pipeline-stage` (S4): resolve is step 1 inside that flow.
3. **Do not** implement orchestrator, capture, or gates from this skill in response to a run request.
4. **Do not** claim «реализован только resolveLead» without checking whether `src/orchestrator/pipeline.ts` exists.

Expected one-liner: «Это `run-pipeline-stage`: resolve → branch → stages + gates. Загружаю S4 и запускаю CLI.»

## Related rules

- [10-orchestrator.mdc](../../rules/10-orchestrator.mdc) — `resolveLead.ts`, `slugify`, CLI `--data` / `--lead`
- [01-contract-first.mdc](../../rules/01-contract-first.mdc) — `lead.json` contract, `validate-contract`

## Prerequisites

- `schemas/lead.schema.json` (planned) defines `lead.json` shape per PRD §7.2.
- `validate-contract` / `assertValid(data, 'lead')` before write.
- `src/lib/paths.ts` for `leads/{slug}/` — no absolute paths in artifacts.
- `src/` may be absent — spec-first.
- **Foundation (M1):** inline JSON / existing `lead.json` path only.
- **Milestone 7:** Excel import from `leads.xlsx` at repo root.

## Procedure

### 1. Entry point

```typescript
export function resolveLead(input: ResolveInput): ResolveResult
```

`ResolveInput` variants:

| Source | Input |
|--------|--------|
| CLI `--data` | JSON string or object |
| CLI `--lead` | Path to `lead.json` or lead directory |
| Excel (M7) | Row index or batch from `leads.xlsx` |

Returns `{ leadId, leadDir, leadPath }` where `leadPath = leads/{slug}/lead.json`.

### 2. Slugify `lead_id`

From `name` field (company name):

```
"Domeo Renovation" → "domeo-renovation"
```

Rules:

- Lowercase, Cyrillic/Latin preserved or transliterated per project convention
- Spaces → `-`; strip unsafe chars
- `lead_id` = slug; used in paths and `state.json`

### 3. Normalize `lead.json` fields

PRD §7.2 minimum:

```json
{
  "schema_version": "1.0",
  "lead_id": "domeo",
  "name": "Domeo",
  "site": "https://domeo.ru",
  "phone": "...",
  "category": "ремонт квартир",
  "geo": "Москва",
  "source": "inline",
  "raw": {}
}
```

| Field | Notes |
|-------|--------|
| `site` | Optional; empty → `no_website` branch later (`probe-site`) |
| `source` | `inline`, `excel`, `yandex_maps`, etc. |
| `raw` | Optional bag for unmapped Excel columns |

Merge CLI/Excel input; do not invent business facts.

### 4. Inline JSON path (Foundation — M1)

1. Parse `--data` JSON.
2. Require `name` (non-empty).
3. Build `lead.json` object with `schema_version`, `lead_id` from slugify.
4. Create `leads/{slug}/` if missing.
5. `assertValid(lead, 'lead')` via `validate-contract`.
6. Write `leads/{slug}/lead.json`.
7. Return paths for orchestrator to `initState` / `loadState`.

```bash
npm run pipeline -- --data '{"name":"Domeo","site":"https://domeo.ru","geo":"Москва"}'
```

### 5. Existing lead path (`--lead`)

1. If path is directory → read `lead.json` inside.
2. If path is file → use directly.
3. Validate against `lead` schema on read.
4. Return without rewrite unless fields normalized.

### 6. Excel import (Milestone 7 — stub in Foundation)

Planned procedure (document only until M7):

1. Read `leads.xlsx` from repo root.
2. Map columns → `name`, `site`, `phone`, `category`, `geo` (per CONVENTIONS when present).
3. One row → one `leads/{slug}/lead.json`.
4. Set `source: "excel"`; stash extra columns in `raw`.
5. Validate each `lead.json` before write.

Foundation: export function stub or throw `not implemented` with clear message.

### 7. Handoff to orchestrator

`run-pipeline-stage` calls resolve as **step 1 only**:

1. `resolveLead` → `lead.json`
2. `initState` / `loadState`
3. `decideBranch` (`probe-site`)
4. Stage loop

Resolve does **not** write `state.json` — `state.ts` does after resolve returns.

## Inputs / Outputs

| Input | Output |
|-------|--------|
| `--data` JSON, `--lead` path, or Excel row (M7) | `leads/{slug}/lead.json` |
| Company `name` | `lead_id` slug |

**Code owner (planned):** `src/orchestrator/resolveLead.ts`  
**Stage:** Orchestrator (Resolve, before routing)

## Verification

| Check | Status |
|-------|--------|
| Inline `--data` creates valid `lead.json` | not run |
| `lead.json` passes `lead` schema | not run |
| Excel import | not run (M7) |
| `quick_validate.py` | run after write |

## Test prompts

1. «Реализуй resolveLead — slugify name, запиши leads/domeo/lead.json из --data» → **this skill**
2. «Запусти полный pipeline с gates» → **negative routing**: redirect to `run-pipeline-stage` (S4); do not implement orchestrator here
3. «Импортируй все лиды из leads.xlsx» → M7 procedure; stub OK in Foundation

## Forbidden

- Do not use LLM for slugify or field normalization.
- Do not run `probeSite` / branch routing here — `probe-site`.
- Do not write or advance `state.json` stages — orchestrator `state.ts`.
- Do not skip `lead` schema validation before write.
- Do not invent `site`, `phone`, or `category` not present in input.
- Do not implement full pipeline in `resolveLead.ts`.
- Do not commit secrets or client PII outside `leads/` (gitignore `leads/` per project policy).
