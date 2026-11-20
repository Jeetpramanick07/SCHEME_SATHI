export type ValidationSeverity = "error" | "warn" | "info";

export interface ValidationIssue {
  scheme_id?: string;
  field?: string;
  severity: ValidationSeverity;
  code: string;
  message: string;
  details?: unknown;
}

export interface IngestReport {
  run_id: string;
  timestamp: string;
  dry_run: boolean;
  total_schemes: number;
  accepted_count: number;
  rejected_count: number;
  skipped_count: number;
  issues: ValidationIssue[];
}
