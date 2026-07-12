---
name: validate-contract
description: Validate pipeline JSON artifacts against schemas in schemas/ using ajv. Use this skill whenever validating lead.json, state.json, capture/meta.json, audit.json, content.json, build.json, deploy.json, or offer.json — in gates, orchestrator, or before/after writing any blackboard artifact. Also use when implementing assertValid in src/gates/validate.ts, debugging schema validation errors, or checking schema_version and JSON pointer paths. Do not use for HTTP checks, file size, or screenshot validation — that belongs to gate-g1-capture (Level 2).
---

# Validate Contract

Structural JSON Schema validation for LeadGenerator blackboard artifacts.

## When to use

- Before writing any inter-stage JSON artifact to `leads/{lead_id}/`.
- After reading an artifact at a stage boundary.
- Inside gate modules as the **first** deterministic check (before tech checks).
- When implementing or debugging `src/gates/validate.ts`.
- When a user asks to validate a contract, fix schema errors, or register a new schema.

**Not for:** file existence, HTTP status, screenshot size, Lighthouse, link checks — see Level 2 skills (`gate-g1-capture`, `smoke-test-url`, `link-check`).

## Related rules

- [01-contract-first.mdc](../../rules/01-contract-first.mdc) — validation policy, `schema_version`, minimal-io
- [12-schemas.mdc](../../rules/12-schemas.mdc) — schema authoring, registry, `additionalProperties`
- [13-gates-code.mdc](../../rules/13-gates-code.mdc) — `assertValid`, gate integration (schema step only)

## Prerequisites

- `schemas/{contract}.schema.json` exists (or is planned per PRD §7.2).
- `src/gates/validate.ts` registry maps `schemaName` → schema file (planned path; `src/` may be absent — spec-first).
- Artifact is valid JSON; paths inside artifacts are relative to `leads/{lead_id}/`.
- Single shared ajv instance with `ajv-formats` enabled (`uri`, `date-time`, etc.).

## Procedure

### 1. Resolve schema name

Map artifact to registry key:

| Artifact path | Schema name (registry key) |
|---------------|---------------------------|
| `lead.json` | `lead` |
| `state.json` | `state` |
| `capture/meta.json` | `capture-meta` |
| `audit.json` | `audit` |
| `research.json` | `research` |
| `content.json` | `content` |
| `design/build.json` | `design-build` |
| `deploy.json` | `deploy` |
| `offer.json` | `offer` |

File naming convention: `{contract}.schema.json` in `schemas/` (see `12-schemas`).

### 2. Load and compile (once at startup)

In `src/gates/validate.ts`:

1. Create one `Ajv` instance: `{ allErrors: true, strict: true }`.
2. Register `ajv-formats` on the instance.
3. For each file in `schemas/*.schema.json`, compile and cache by registry key.
4. Export `assertValid(data: unknown, schemaName: string): void`.

### 3. Validate artifact

1. Read JSON from `leads/{lead_id}/{artifact_path}`.
2. Call `assertValid(parsed, schemaName)`.
3. On success: return silently or `{ valid: true }`.
4. On failure: collect errors with **JSON instance paths** (e.g. `/findings/0/evidence`, `/schema_version`).

Example error message format for gates/orchestrator:

```
lead_id=domeo stage=audit gate=G2 artifact=audit.json path=/findings/0/severity: must be equal to one of the allowed values
```

### 4. Integration points

- **Gates:** call `assertValid` before filesystem/HTTP tech checks (`13-gates-code`).
- **Steps:** capture step validates `meta.json` before return (`14-capture-step`).
- **Orchestrator:** validate `state.json` on `saveState` (`10-orchestrator`).
- **LLM agents:** output must pass validation before write (`01-contract-first`).

### 5. Adding a new schema

1. Add `schemas/{contract}.schema.json` with `schema_version: "1.0"`, `additionalProperties: false` (except documented exceptions like `lead.raw`).
2. Register key in `validate.ts` map.
3. Update PRD §7.2 example — **only with user approval for PRD edits**.
4. Update consumers (gates/agents) in the same task.

## Inputs / Outputs

| Input | Output |
|-------|--------|
| Parsed JSON object + `schemaName` | Success: no throw / `{ valid: true }` |
| Invalid JSON or schema mismatch | Failure: errors with `instancePath`, `message`, `schemaPath` |
| Registry key unknown | Failure: `Unknown schema: {name}` |

**Code owner (planned):** `src/gates/validate.ts`  
**Stage:** Orchestrator, all gates, all agents writing contracts

## Verification

| Check | Status |
|-------|--------|
| PRD §7.2 example payloads validate against schemas | not run (no `schemas/` yet) |
| `assertValid` returns path-qualified errors | not run |
| Schema registry includes Foundation schemas (`lead`, `state`, `capture-meta`) | not run |
| `quick_validate.py` on this skill | run after write |

Manual spec review:

- [ ] Procedure covers compile-once + `ajv-formats`
- [ ] Forbidden excludes G1 tech checks (S8 scope)
- [ ] No duplicate full text of `01-contract-first` or `03-pipeline-gates`

## Test prompts

1. «Добавь `assertValid` в `src/gates/validate.ts` и проверь `leads/domeo/capture/meta.json` по схеме capture-meta»
2. «Почему audit.json не проходит валидацию — покажи JSON pointer ошибки»
3. «Зарегистрируй новую схему `content.schema.json` в validate.ts» (should trigger schema + registry procedure, not gate file-size checks)

## Forbidden

- Do not perform gate tech checks here (HTTP 200, screenshot >5KB, text length) — use `gate-g1-capture` (S8, Level 2).
- Do not embed file-size or HTTP rules in JSON Schema (`12-schemas`: structural only).
- Do not mutate the artifact during validation — read-only.
- Do not skip validation before writing inter-stage JSON (`01-contract-first`).
- Do not add schema fields without `schemas/` + PRD agreement in the same task.
- Do not swallow validation errors in gate modules.
