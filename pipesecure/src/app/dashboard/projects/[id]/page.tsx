"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  GitCommit,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Shield,
  ExternalLink,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

interface Scan {
  id: string;
  type: string;
  commitSha: string | null;
  branch: string | null;
  status: string;
  createdAt: string;
  completedAt: string | null;
  summary: { totalFindings?: number; severityCounts?: Record<string, number> } | null;
  _count: { findings: number };
}

interface Project {
  id: string;
  name: string;
  githubRepoFullName: string;
  status: string;
  defaultBranch: string;
  lastScannedAt: string | null;
  scans: Scan[];
  _count: { findings: number };
}

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [scanning, setScanning] = useState(false);

  async function handleRescan() {
    setScanning(true);
    try {
      const res = await fetch(`/api/projects/${params.id}/scans`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to start scan");
        return;
      }
      toast.success("Scan queued — it will appear below shortly");
      setTimeout(() => {
        fetch(`/api/projects/${params.id}`)
          .then((r) => r.json())
          .then(setProject)
          .catch(console.error);
      }, 2000);
    } catch {
      toast.error("Failed to start scan");
    } finally {
      setScanning(false);
    }
  }

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`/api/projects/${params.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete project");
      toast.success("Project removed");
      router.push("/dashboard");
    } catch {
      toast.error("Failed to remove project");
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  useEffect(() => {
    fetch(`/api/projects/${params.id}`)
      .then((r) => r.json())
      .then(setProject)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Project not found.</p>
      </div>
    );
  }

  const completedScans = project.scans.filter((s) => s.status === "completed");
  const latestScan = completedScans[0];
  const totalFindings = latestScan?.summary?.totalFindings ?? 0;
  const severityCounts = latestScan?.summary?.severityCounts ?? {};

  return (
    <div>
      <Link
        href="/dashboard"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to projects
      </Link>

      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">{project.name}</h1>
          <a
            href={`https://github.com/${project.githubRepoFullName}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mt-1"
          >
            {project.githubRepoFullName}
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        <div className="flex items-center gap-3">
          <Badge
            variant="outline"
            className={
              project.status === "active"
                ? "text-green-500 border-green-500/30"
                : "text-muted-foreground"
            }
          >
            {project.status}
          </Badge>
          <Button
            variant="default"
            size="sm"
            disabled={scanning}
            onClick={handleRescan}
          >
            {scanning ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-1" />
            )}
            Re-scan
          </Button>
          <Button
            variant={confirmDelete ? "destructive" : "outline"}
            size="sm"
            disabled={deleting}
            onClick={handleDelete}
            onBlur={() => setConfirmDelete(false)}
          >
            {deleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-1" />
                {confirmDelete ? "Confirm remove?" : "Remove project"}
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4 mb-8">
        <StatCard
          label="Total Findings"
          value={totalFindings}
          icon={Shield}
        />
        <StatCard
          label="Critical / High"
          value={(severityCounts.critical || 0) + (severityCounts.high || 0)}
          icon={AlertTriangle}
          className="text-red-500"
        />
        <StatCard
          label="Medium"
          value={severityCounts.medium || 0}
          icon={AlertTriangle}
          className="text-yellow-500"
        />
        <StatCard
          label="Total Scans"
          value={project.scans.length}
          icon={GitCommit}
        />
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">Scan History</h2>
        <div className="space-y-3">
          {project.scans.map((scan) => (
            <Link
              key={scan.id}
              href={`/dashboard/projects/${project.id}/scans/${scan.id}`}
            >
              <Card className="hover:border-primary/30 transition-colors cursor-pointer">
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-4">
                    <ScanStatusIcon status={scan.status} />
                    <div>
                      <p className="text-sm font-medium">
                        {scan.type === "initial" ? "Initial Scan" : "Commit Scan"}
                        {scan.commitSha && (
                          <code className="ml-2 text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {scan.commitSha.slice(0, 7)}
                          </code>
                        )}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {new Date(scan.createdAt).toLocaleString()}
                        {scan.branch && (
                          <>
                            <Separator orientation="vertical" className="h-3" />
                            <span>{scan.branch}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {scan._count.findings > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {scan._count.findings} findings
                      </Badge>
                    )}
                    <ScanStatusBadge status={scan.status} />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  className,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  className?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <Icon className={`h-5 w-5 ${className || "text-muted-foreground"}`} />
          <span className="text-2xl font-bold">{value}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function ScanStatusIcon({ status }: { status: string }) {
  switch (status) {
    case "completed":
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    case "running":
      return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
    case "failed":
      return <XCircle className="h-5 w-5 text-red-500" />;
    default:
      return <Clock className="h-5 w-5 text-muted-foreground" />;
  }
}

function ScanStatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    completed: "text-green-500 border-green-500/30",
    running: "text-blue-500 border-blue-500/30",
    failed: "text-red-500 border-red-500/30",
    queued: "text-muted-foreground",
  };
  return (
    <Badge variant="outline" className={`text-xs ${variants[status] || ""}`}>
      {status}
    </Badge>
  );
}
