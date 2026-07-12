import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { imageSize } from "image-size";
import { assertValid } from "./validate.js";
import type { GateContext, GateResult } from "../lib/types.js";

const MIN_SCREENSHOT_BYTES = 5120;
const MIN_TEXT_CHARS = 200;

function formatGateError(
  ctx: GateContext,
  artifact: string,
  reason: string
): string {
  return `lead_id=${ctx.lead_id} stage=capture gate=G1 artifact=${artifact} ${reason}`;
}

export function runGateG1(ctx: GateContext): GateResult {
  const errors: string[] = [];
  const metaPath = path.join(ctx.leadDir, "capture", "meta.json");

  if (!existsSync(metaPath)) {
    return {
      pass: false,
      gate: "G1",
      errors: [
        formatGateError(ctx, "capture/meta.json", "reason=file missing"),
      ],
    };
  }

  let meta: Record<string, unknown>;
  try {
    meta = JSON.parse(readFileSync(metaPath, "utf8"));
    assertValid(meta, "capture-meta");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    errors.push(formatGateError(ctx, "capture/meta.json", `reason=${message}`));
    return { pass: false, gate: "G1", errors };
  }

  if (meta.http_status !== 200) {
    errors.push(
      formatGateError(
        ctx,
        "capture/meta.json",
        `http_status=${String(meta.http_status)} required=200`
      )
    );
  }

  const screenshots = meta.screenshots as Record<string, string>;
  for (const key of ["desktop", "mobile"] as const) {
    const rel = screenshots[key];
    const abs = path.join(ctx.leadDir, rel);
    if (!existsSync(abs)) {
      errors.push(
        formatGateError(ctx, rel, "reason=file missing")
      );
      continue;
    }
    const stat = readFileSync(abs);
    if (stat.length <= MIN_SCREENSHOT_BYTES) {
      errors.push(
        formatGateError(
          ctx,
          rel,
          `size=${stat.length} required>${MIN_SCREENSHOT_BYTES}`
        )
      );
      continue;
    }
    try {
      const dims = imageSize(abs);
      if (!dims.width || !dims.height || dims.width <= 0 || dims.height <= 0) {
        errors.push(
          formatGateError(ctx, rel, "reason=invalid image dimensions")
        );
      }
    } catch {
      errors.push(formatGateError(ctx, rel, "reason=unreadable image"));
    }
  }

  const textRel = meta.extracted_text as string;
  const textPath = path.join(ctx.leadDir, textRel);
  if (!existsSync(textPath)) {
    errors.push(formatGateError(ctx, textRel, "reason=file missing"));
  } else {
    const text = readFileSync(textPath, "utf8");
    if (text.length < MIN_TEXT_CHARS) {
      errors.push(
        formatGateError(
          ctx,
          textRel,
          `length=${text.length} required>=${MIN_TEXT_CHARS}`
        )
      );
    }
  }

  return {
    pass: errors.length === 0,
    gate: "G1",
    errors,
  };
}
