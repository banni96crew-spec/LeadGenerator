import { parseArgs } from "node:util";
import { loadEnvFile } from "../lib/loadEnv.js";
import { runPipeline } from "./pipeline.js";
import type { StageName } from "../lib/types.js";

async function main(): Promise<void> {
  loadEnvFile();

  const { values } = parseArgs({
    options: {
      data: { type: "string" },
      lead: { type: "string" },
      stage: { type: "string" },
      force: { type: "boolean", default: false },
    },
    allowPositionals: true,
    strict: false,
  });

  const force = values.force === true;
  const stage =
    typeof values.stage === "string" ? (values.stage as StageName) : undefined;

  if (typeof values.data === "string") {
    const { exitCode } = await runPipeline({
      resolveInput: { kind: "data", data: values.data },
      stage,
      force,
    });
    process.exit(exitCode);
    return;
  }

  if (typeof values.lead === "string") {
    const { exitCode } = await runPipeline({
      resolveInput: { kind: "lead", path: values.lead },
      stage,
      force,
    });
    process.exit(exitCode);
    return;
  }

  console.error(
    "Usage: npm run pipeline -- --data '{\"name\":\"...\",\"site\":\"...\"}' [--stage capture|audit|copy|design|publish] [--force]"
  );
  console.error(
    "   or: npm run pipeline -- --lead leads/domeo [--stage capture|audit|copy|design|publish] [--force]"
  );
  process.exit(2);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
