import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { checkOfferLinks } from "../lib/linkCheck.js";
import { REPO_ROOT } from "../lib/paths.js";
import type { GateContext, GateResult } from "../lib/types.js";
import { lintOfferClientText } from "./offerToneLint.js";
import { assertValid } from "./validate.js";

const MAX_MESSAGE_LENGTH = 1500;
const OFFER_JSON = "offer/offer.json";
const OFFER_MD = "offer/offer.md";
const PORTFOLIO_REL = path.join("context", "portfolio.json");

function formatGateError(
  ctx: GateContext,
  artifact: string,
  reason: string
): string {
  return `lead_id=${ctx.lead_id} stage=offer gate=G6 artifact=${artifact} ${reason}`;
}

function readJsonFile(filePath: string): unknown {
  return JSON.parse(readFileSync(filePath, "utf8")) as unknown;
}

/**
 * Gate G6 — Offer code checks (schema, offer.md, why, length, links, tone).
 *
 * Network exception vs 13-gates-code “no network in gates”: G6 calls
 * `checkOfferLinks` (fetch in lib) by M5 plan lock. Rule patch is M5-T6;
 * G1–G5 stay filesystem-only. No Playwright / Lighthouse here.
 */
export async function runGateG6(ctx: GateContext): Promise<GateResult> {
  const errors: string[] = [];
  const artifactRel = OFFER_JSON;
  const offerPath = path.join(ctx.leadDir, artifactRel);

  if (!existsSync(offerPath)) {
    return {
      pass: false,
      gate: "G6",
      errors: [formatGateError(ctx, artifactRel, "reason=file missing")],
    };
  }

  let offer: Record<string, unknown>;
  try {
    offer = readJsonFile(offerPath) as Record<string, unknown>;
    assertValid(offer, "offer");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    errors.push(formatGateError(ctx, artifactRel, `reason=${message}`));
    return { pass: false, gate: "G6", errors };
  }

  const mdRel = OFFER_MD;
  const mdPath = path.join(ctx.leadDir, mdRel);
  if (!existsSync(mdPath)) {
    errors.push(formatGateError(ctx, mdRel, "reason=file missing"));
  } else {
    const mdBody = readFileSync(mdPath, "utf8").trim();
    if (!mdBody) {
      errors.push(formatGateError(ctx, mdRel, "reason=empty"));
    }
  }

  const whyRaw = offer.why_this_company;
  const why =
    typeof whyRaw === "string" ? whyRaw.trim() : String(whyRaw ?? "").trim();
  if (!why) {
    errors.push(
      formatGateError(
        ctx,
        artifactRel,
        "reason=why_this_company missing or empty"
      )
    );
  }

  const message = typeof offer.message === "string" ? offer.message : "";
  if (message.length > MAX_MESSAGE_LENGTH) {
    errors.push(
      formatGateError(
        ctx,
        artifactRel,
        `reason=message too long length=${message.length} max=${MAX_MESSAGE_LENGTH}`
      )
    );
  }

  const deployPath = path.join(ctx.leadDir, "deploy.json");
  let deploy: { demo_url: string } | undefined;
  if (!existsSync(deployPath)) {
    errors.push(formatGateError(ctx, "deploy.json", "reason=file missing"));
  } else {
    try {
      const deployData = readJsonFile(deployPath) as Record<string, unknown>;
      assertValid(deployData, "deploy");
      deploy = { demo_url: String(deployData.demo_url ?? "") };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(formatGateError(ctx, "deploy.json", `reason=${msg}`));
    }
  }

  const portfolioPath = path.join(REPO_ROOT, PORTFOLIO_REL);
  let portfolio: { cases: Array<{ url: string }> } | undefined;
  if (!existsSync(portfolioPath)) {
    errors.push(
      formatGateError(ctx, PORTFOLIO_REL.replace(/\\/g, "/"), "reason=file missing")
    );
  } else {
    try {
      const portfolioData = readJsonFile(portfolioPath) as {
        cases?: Array<{ url?: string }>;
      };
      portfolio = {
        cases: Array.isArray(portfolioData.cases)
          ? portfolioData.cases.map((c) => ({ url: String(c.url ?? "") }))
          : [],
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(
        formatGateError(
          ctx,
          PORTFOLIO_REL.replace(/\\/g, "/"),
          `reason=${msg}`
        )
      );
    }
  }

  // G6 network exception (pending 13-gates-code.mdc patch in M5-T6).
  if (deploy && portfolio) {
    const links = offer.links as {
      demo: string;
      portfolio: string;
      audit_pdf: string;
    };
    const linkResult = await checkOfferLinks({
      leadDir: ctx.leadDir,
      offer: { links },
      deploy,
      portfolio,
    });
    if (!linkResult.ok) {
      errors.push(...linkResult.errors);
    }
  }

  let companyName: string | undefined;
  const leadPath = path.join(ctx.leadDir, "lead.json");
  if (existsSync(leadPath)) {
    try {
      const lead = readJsonFile(leadPath) as { name?: unknown };
      if (typeof lead.name === "string" && lead.name.trim()) {
        companyName = lead.name.trim();
      }
    } catch {
      // optional — ignore unreadable lead.json for tone lint
    }
  }

  const toneErrors = lintOfferClientText({
    message,
    why_this_company: typeof whyRaw === "string" ? whyRaw : why,
    companyName,
  });
  for (const reason of toneErrors) {
    errors.push(formatGateError(ctx, artifactRel, reason));
  }

  return {
    pass: errors.length === 0,
    gate: "G6",
    errors,
  };
}
