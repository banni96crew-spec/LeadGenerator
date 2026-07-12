export type Branch = "has_website" | "no_website";

export type StageStatus =
  | "pending"
  | "running"
  | "done"
  | "skipped"
  | "failed";

export type StageName =
  | "capture"
  | "research"
  | "audit"
  | "copy"
  | "design"
  | "publish"
  | "offer";

export type StageRecord = {
  status: StageStatus;
  hash?: string;
  attempts?: number;
  artifact?: string;
  cost?: number;
  error?: string;
};

export type PipelineState = {
  schema_version: "1.0";
  lead_id: string;
  branch: Branch;
  stages: Record<StageName, StageRecord>;
  updated_at: string;
};

export type Lead = {
  schema_version: "1.0";
  lead_id: string;
  name: string;
  site?: string;
  category?: string;
  geo?: string;
  phone?: string;
  source?: string;
  raw?: Record<string, unknown>;
};

export type GateResult = {
  pass: boolean;
  gate: "G1" | "G2" | "G3" | "G4" | "G5" | "G6";
  errors: string[];
  warnings?: string[];
};

export type GateContext = {
  lead_id: string;
  leadDir: string;
};

export const ALL_STAGES: StageName[] = [
  "capture",
  "research",
  "audit",
  "copy",
  "design",
  "publish",
  "offer",
];

export const BRANCH_EXCLUSIVE_STAGES: StageName[] = ALL_STAGES.filter(
  (stage) =>
    getInitialStageStatus(stage, "has_website") !==
    getInitialStageStatus(stage, "no_website")
);

export function getInitialStageStatus(
  stage: StageName,
  branch: Branch
): StageStatus {
  if (branch === "has_website") {
    if (stage === "research") return "skipped";
    if (stage === "capture") return "pending";
  } else {
    if (stage === "capture" || stage === "audit") return "skipped";
    if (stage === "research") return "pending";
  }
  return "pending";
}
