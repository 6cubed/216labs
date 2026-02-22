export interface ScanFinding {
  title: string;
  description: string;
  severity: string;
  type: string;
  filePath?: string;
  startLine?: number;
  endLine?: number;
  cweId?: string;
  cveId?: string;
  cvssScore?: number;
  cvssVector?: string;
  tool: string;
  ruleId?: string;
  confidence?: string;
  rawData?: unknown;
}

export interface DependencyInfo {
  name: string;
  version: string;
  ecosystem: string;
  manifestFile: string;
}

export interface SemgrepResult {
  check_id: string;
  path: string;
  start: { line: number; col: number };
  end: { line: number; col: number };
  extra: {
    message?: string;
    severity?: string;
    metadata?: {
      cwe?: string[];
      confidence?: string;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
}

export interface AstGrepResult {
  ruleId: string;
  message: string;
  severity: string;
  file: string;
  range: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
  cweId?: string;
}
