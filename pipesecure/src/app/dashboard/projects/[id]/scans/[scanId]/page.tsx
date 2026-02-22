"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  Shield,
  AlertTriangle,
  FileCode,
  Filter,
  ExternalLink,
  EyeOff,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface Finding {
  id: string;
  severity: string;
  type: string;
  title: string;
  description: string;
  filePath: string | null;
  startLine: number | null;
  endLine: number | null;
  cweId: string | null;
  cveId: string | null;
  cvssScore: number | null;
  cvssVector: string | null;
  tool: string;
  ruleId: string | null;
  confidence: string | null;
  ignored: boolean;
  ignoreReason: string | null;
}

interface Scan {
  id: string;
  type: string;
  commitSha: string | null;
  branch: string | null;
  status: string;
  createdAt: string;
  completedAt: string | null;
  summary: Record<string, unknown> | null;
  findings: Finding[];
  project: {
    githubRepoFullName: string;
    defaultBranch: string;
  };
}

export default function ScanResultsPage() {
  const params = useParams();
  const [scan, setScan] = useState<Scan | null>(null);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [showIgnored, setShowIgnored] = useState(false);
  const [expandedFinding, setExpandedFinding] = useState<string | null>(null);
  const [togglingIgnore, setTogglingIgnore] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/projects/${params.id}/scans/${params.scanId}`)
      .then((r) => r.json())
      .then(setScan)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [params.id, params.scanId]);

  async function toggleIgnore(finding: Finding) {
    setTogglingIgnore(finding.id);
    try {
      const method = finding.ignored ? "DELETE" : "POST";
      const res = await fetch(
        `/api/projects/${params.id}/findings/${finding.id}/ignore`,
        {
          method,
          headers: { "Content-Type": "application/json" },
          body: method === "POST" ? JSON.stringify({ reason: "Dismissed by admin" }) : undefined,
        }
      );
      if (!res.ok) throw new Error();

      setScan((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          findings: prev.findings.map((f) =>
            f.id === finding.id ? { ...f, ignored: !f.ignored } : f
          ),
        };
      });

      toast.success(finding.ignored ? "Finding restored" : "Finding ignored — will be excluded from future scans");
    } catch {
      toast.error("Failed to update finding");
    } finally {
      setTogglingIgnore(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!scan) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Scan not found.</p>
      </div>
    );
  }

  function githubFileUrl(finding: Finding): string | null {
    if (!finding.filePath || !scan) return null;
    const repo = scan.project.githubRepoFullName;
    const ref = scan.commitSha || scan.branch || scan.project.defaultBranch;
    const lineAnchor = finding.startLine
      ? finding.endLine && finding.endLine !== finding.startLine
        ? `#L${finding.startLine}-L${finding.endLine}`
        : `#L${finding.startLine}`
      : "";
    return `https://github.com/${repo}/blob/${ref}/${finding.filePath}${lineAnchor}`;
  }

  const allFindings = scan.findings || [];
  const activeFindings = showIgnored ? allFindings : allFindings.filter((f) => !f.ignored);
  const ignoredCount = allFindings.filter((f) => f.ignored).length;

  const filtered = activeFindings.filter((f) => {
    if (severityFilter !== "all" && f.severity !== severityFilter) return false;
    if (typeFilter !== "all" && f.type !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        f.title.toLowerCase().includes(q) ||
        f.description.toLowerCase().includes(q) ||
        f.filePath?.toLowerCase().includes(q) ||
        f.cveId?.toLowerCase().includes(q) ||
        f.cweId?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const severityCounts = activeFindings.reduce(
    (acc, f) => {
      if (!f.ignored) acc[f.severity] = (acc[f.severity] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div>
      <Link
        href={`/dashboard/projects/${params.id}`}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to project
      </Link>

      <div className="mb-8">
        <h1 className="text-2xl font-bold">
          {scan.type === "initial" ? "Initial Scan" : "Commit Scan"} Results
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {scan.commitSha && (
            <code className="bg-muted px-1.5 py-0.5 rounded mr-2">
              {scan.commitSha.slice(0, 7)}
            </code>
          )}
          {scan.branch && <span className="mr-2">{scan.branch}</span>}
          {scan.completedAt
            ? `Completed ${new Date(scan.completedAt).toLocaleString()}`
            : `Status: ${scan.status}`}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-5 mb-8">
        {["critical", "high", "medium", "low", "info"].map((sev) => (
          <Card
            key={sev}
            className={`cursor-pointer transition-colors ${
              severityFilter === sev ? "border-primary" : ""
            }`}
            onClick={() =>
              setSeverityFilter(severityFilter === sev ? "all" : sev)
            }
          >
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <span className="text-sm capitalize">{sev}</span>
                <SeverityBadge severity={sev} />
              </div>
              <p className="text-2xl font-bold mt-1">
                {severityCounts[sev] || 0}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Findings ({filtered.length})
              {ignoredCount > 0 && (
                <span className="text-sm font-normal text-muted-foreground">
                  · {ignoredCount} ignored
                </span>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              {ignoredCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowIgnored(!showIgnored)}
                  className="text-xs"
                >
                  {showIgnored ? <EyeOff className="h-3.5 w-3.5 mr-1" /> : <Eye className="h-3.5 w-3.5 mr-1" />}
                  {showIgnored ? "Hide ignored" : "Show ignored"}
                </Button>
              )}
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search findings..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9 w-64"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-32 h-9">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="sast">SAST</SelectItem>
                  <SelectItem value="dom">DOM</SelectItem>
                  <SelectItem value="cve">CVE</SelectItem>
                  <SelectItem value="secret">Secret</SelectItem>
                  <SelectItem value="logic">Logic</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {allFindings.length === 0
                ? "No vulnerabilities found. Your code looks clean!"
                : "No findings match the current filters."}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Severity</TableHead>
                  <TableHead className="w-16">CVSS</TableHead>
                  <TableHead className="w-20">Type</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead className="w-48">File</TableHead>
                  <TableHead className="w-24">Tool</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((finding) => (
                  <>
                    <TableRow
                      key={finding.id}
                      className={`cursor-pointer hover:bg-muted/50 ${finding.ignored ? "opacity-50" : ""}`}
                      onClick={() =>
                        setExpandedFinding(
                          expandedFinding === finding.id ? null : finding.id
                        )
                      }
                    >
                      <TableCell>
                        <SeverityBadge severity={finding.severity} />
                      </TableCell>
                      <TableCell>
                        {finding.cvssScore !== null && (
                          <CvssBadge score={finding.cvssScore} />
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs uppercase">
                          {finding.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">
                            {finding.title}
                            {finding.ignored && (
                              <Badge variant="secondary" className="ml-2 text-xs">ignored</Badge>
                            )}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {finding.cweId && (
                              <span className="text-xs text-muted-foreground">
                                {finding.cweId}
                              </span>
                            )}
                            {finding.cveId && (
                              <span className="text-xs text-muted-foreground">
                                {finding.cveId}
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {finding.filePath && (() => {
                          const url = githubFileUrl(finding);
                          const label = (
                            <div className="flex items-center gap-1 text-xs">
                              <FileCode className="h-3 w-3 shrink-0" />
                              <span className="truncate max-w-[180px]">
                                {finding.filePath}
                              </span>
                              {finding.startLine && (
                                <span className="shrink-0">
                                  :{finding.startLine}
                                </span>
                              )}
                              {url && <ExternalLink className="h-3 w-3 shrink-0 opacity-0 group-hover/file:opacity-100 transition-opacity" />}
                            </div>
                          );
                          return url ? (
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group/file text-muted-foreground hover:text-primary transition-colors"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {label}
                            </a>
                          ) : (
                            <div className="text-muted-foreground">{label}</div>
                          );
                        })()}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {finding.tool}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          disabled={togglingIgnore === finding.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleIgnore(finding);
                          }}
                          title={finding.ignored ? "Restore finding" : "Ignore finding"}
                        >
                          {togglingIgnore === finding.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : finding.ignored ? (
                            <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                          ) : (
                            <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                    {expandedFinding === finding.id && (
                      <TableRow key={`${finding.id}-detail`}>
                        <TableCell colSpan={7}>
                          <div className="p-4 bg-muted/30 rounded-lg text-sm space-y-3">
                            <div className="whitespace-pre-wrap">{finding.description}</div>
                            <div className="flex items-center gap-4 flex-wrap">
                              {finding.cvssScore !== null && (
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-medium text-muted-foreground">CVSS:</span>
                                  <CvssBadge score={finding.cvssScore} />
                                  {finding.cvssVector && (
                                    <code className="text-xs text-muted-foreground">{finding.cvssVector}</code>
                                  )}
                                </div>
                              )}
                              {finding.confidence && (
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-medium text-muted-foreground">Confidence:</span>
                                  <span className="text-xs capitalize">{finding.confidence}</span>
                                </div>
                              )}
                            </div>
                            {(() => {
                              const url = githubFileUrl(finding);
                              if (!url) return null;
                              return (
                                <a
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                  View on GitHub
                                  {finding.startLine && (
                                    <span className="text-muted-foreground">
                                      ({finding.filePath}:{finding.startLine}
                                      {finding.endLine && finding.endLine !== finding.startLine ? `-${finding.endLine}` : ""})
                                    </span>
                                  )}
                                </a>
                              );
                            })()}
                            {finding.ignored && finding.ignoreReason && (
                              <p className="text-xs text-muted-foreground italic">
                                Ignored: {finding.ignoreReason}
                              </p>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    critical: "bg-red-500/10 text-red-500 border-red-500/30",
    high: "bg-orange-500/10 text-orange-500 border-orange-500/30",
    medium: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30",
    low: "bg-blue-500/10 text-blue-500 border-blue-500/30",
    info: "bg-gray-500/10 text-gray-400 border-gray-500/30",
  };
  return (
    <Badge
      variant="outline"
      className={`text-xs capitalize ${colors[severity] || ""}`}
    >
      {severity === "critical" && <AlertTriangle className="h-3 w-3 mr-1" />}
      {severity}
    </Badge>
  );
}

function CvssBadge({ score }: { score: number }) {
  let color = "text-gray-400 border-gray-500/30 bg-gray-500/10";
  if (score >= 9.0) color = "text-red-500 border-red-500/30 bg-red-500/10";
  else if (score >= 7.0) color = "text-orange-500 border-orange-500/30 bg-orange-500/10";
  else if (score >= 4.0) color = "text-yellow-500 border-yellow-500/30 bg-yellow-500/10";
  else if (score > 0) color = "text-blue-500 border-blue-500/30 bg-blue-500/10";

  return (
    <Badge variant="outline" className={`text-xs font-mono tabular-nums ${color}`}>
      {score.toFixed(1)}
    </Badge>
  );
}
