---
name: web-research-company
description: Research a company without a website using Firecrawl or Exa web search — niche, services, geo, competitors with evidence — to gather distilled facts for the Research agent before it writes research.json. Use this skill when implementing agents/research/, gathering facts for no_website branch, or planning MCP search queries from lead.json. Also use when the user mentions Firecrawl, Exa, web research for lead, or competitors with sources. Do NOT use for has_website audit (agent-audit), G2 gate failures or evidence validation (gate-g2-audit-research S9), pipeline routing (probe-site), writing leads/{id}/research.json to blackboard, or inventing competitors without web sources.
---

# Web Research Company

Web fact-gathering helper for Research stage (`branch=no_website`).

## When to use

- Research agent needs external facts — company has no site to capture.
- Implementing `agents/research/` input gathering before LLM synthesis.
- User asks to research niche, services, geo, competitors for a lead without website.
- Drafting or enriching `research.json` with **verified** web sources.

**Not for:** `has_website` branch (use Audit + `capture-website`). Not for G2 validation or evidence path checks (`gate-g2-audit-research`, S9). Not for orchestrator routing (`probe-site`). Not for writing `leads/{id}/research.json` — Research agent owns the blackboard artifact (`20-agent-research`).

## Related rules

- [20-agent-research.mdc](../../rules/20-agent-research.mdc) — Research agent scope, findings, confidence, G2
- [02-llm-invariants.mdc](../../rules/02-llm-invariants.mdc) — evidence-only, no fabricated competitors
- [01-contract-first.mdc](../../rules/01-contract-first.mdc) — `research.json` contract

## Prerequisites

- `leads/{lead_id}/lead.json` exists (`resolve-lead`).
- `branch === no_website` (set by orchestrator after `probe-site`).
- MCP web tools available: **Firecrawl** (`user-firecrawl`) and/or **Exa** (`user-exa`).
- Research agent reads **only** `lead.json` + static context — this skill gathers facts; agent writes contract JSON.
- `src/` / `agents/research/` may be absent — spec-first.
- Milestone 6 — not required in Foundation.

## Procedure

### 1. Read lead context

From `leads/{id}/lead.json` only:

- `name`, `category`, `geo`, `phone` (if any)
- Do **not** read `capture/*` — Capture skipped on this branch.

### 2. Plan search queries

Derive 2–4 targeted queries from lead fields:

```
"{name}" {category} {geo} услуги
"{category}" {geo} конкуренты
"{name}" отзывы {geo}
```

Queries must be specific — avoid generic «лучшие компании России».

### 3. Gather facts via MCP (code/browser, not LLM routing)

**Firecrawl** (`firecrawl_search` or `firecrawl_scrape`):

- Search for company presence, services pages, maps listings
- Scrape public pages; extract text snippets only — no raw HTML in artifacts

**Exa** (`web_search_exa`):

- Alternative/supplement for niche and competitor discovery
- Record result URLs as evidence sources

For each fact record:

| Field | Value |
|-------|--------|
| claim | Short factual statement |
| evidence | Source URL or `search: "{query}"` |
| confidence | `verified` if from fetched page; `inferred` if weak signal |

### 4. Competitors policy

Per `02-llm-invariants` and `20-agent-research`:

- Competitor names **only** from search results with URL evidence
- Do not invent competitor list
- If none found, omit or note gap in findings — do not fabricate

### 5. Distilled fact bundle (interim — not blackboard)

Output **in-memory / agent prompt input** only — do not write `research.json` to disk from this skill.

Shape for Research agent consumption:

```json
{
  "sources": ["https://...", "search: \"{query}\""],
  "business_facts_draft": { "services": [], "usp_existing": [], "audience": "..." },
  "finding_seeds": [
    {
      "category": "позиционирование",
      "claim": "...",
      "evidence": "https://...",
      "confidence": "verified"
    }
  ]
}
```

Requirements for seeds:

- Each `evidence`: URL, `search: "..."`, or `lead.json#field` (G2 rules in S9 apply after agent writes contract)
- Aim for ≥3 seeds so agent can produce ≥3 G2 findings
- Russian client-facing strings in claims
- No raw HTML; no `schema_version` on interim bundle

### 6. Research agent writes `research.json`

Pipeline agent in `agents/research/`:

1. Consumes distilled fact bundle from this skill (not full HTML dumps)
2. Synthesizes and writes **only** `leads/{id}/research.json` (no prose wrapper)
3. Validates with `validate-contract` / `assertValid(data, 'research')` before save
4. Orchestrator runs G2 via `gate-g2-audit-research` (S9) after Research stage — not this skill

### 7. Cost discipline

- Summarize extracts; do not store full page HTML in `research.json`
- Prefer 3–5 high-quality sources over volume
- Log `cost` in `state.json` for Research LLM stage separately

## Inputs / Outputs

| Input | Output |
|-------|--------|
| `lead.json` | Distilled fact bundle (interim, not on blackboard) |
| Firecrawl/Exa results | Finding seeds with URL/search evidence |
| Research agent | `leads/{id}/research.json` (contract artifact) |

**Code owner (planned):** `agents/research/` (+ optional `src/lib/researchWeb.ts` helper)  
**Stage:** Research (`no_website` branch)

## Verification

| Check | Status |
|-------|--------|
| Only runs when `branch=no_website` | not run |
| Competitors have URL evidence in fact bundle | not run |
| Does not write `research.json` to blackboard | not run |
| G2 pass after agent write (S9) | not run — orchestrator + `gate-g2-audit-research` |
| `quick_validate.py` | pass |

## Test prompts

1. «Исследуй компанию из lead.json без сайта — ниша, услуги, конкуренты с URL в evidence для Research agent»
2. «Выдумай 5 конкурентов для research» (must refuse — evidence-only)
3. «Запусти research для лида с site=domeo.ru» (must refuse — has_website uses Audit)
4. «G2 упал на evidence в research.json» (must redirect to `gate-g2-audit-research` S9, not re-run Firecrawl here)

## Forbidden

- Do not invent competitors, reviews, prices, or services.
- Do not run on `has_website` branch.
- Do not read `capture/*` or `audit.json`.
- Do not use LLM for routing or schema validation decisions.
- Do not store raw HTML blobs in `research.json`.
- Do not write `leads/{id}/research.json` — Research agent + `validate-contract` only.
- Do not invoke `runGateG2` or verify evidence paths — orchestrator runs S9 after Research.
- Do not dump full Firecrawl crawl into blackboard — distill only.
