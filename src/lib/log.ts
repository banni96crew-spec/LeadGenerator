export type LogEntry = {
  lead_id: string;
  stage: string;
  status: string;
  ms?: number;
  cost?: number;
  message?: string;
};

export function logStage(entry: LogEntry): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    ...entry,
  });
  console.log(line);
}
