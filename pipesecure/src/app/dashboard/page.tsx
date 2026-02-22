"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, FolderGit2, Clock, AlertTriangle, CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Project {
  id: string;
  name: string;
  githubRepoFullName: string;
  status: string;
  lastScannedAt: string | null;
  _count: { scans: number; findings: number };
  scans: Array<{
    id: string;
    status: string;
    createdAt: string;
    type: string;
  }>;
}

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then(setProjects)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Projects</h1>
          <p className="text-muted-foreground mt-1">
            Your connected GitHub repositories
          </p>
        </div>
        <Link href="/dashboard/projects/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Project
          </Button>
        </Link>
      </div>

      {projects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FolderGit2 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No projects yet</h3>
            <p className="text-muted-foreground text-sm mb-6">
              Connect a GitHub repository to start scanning for vulnerabilities.
            </p>
            <Link href="/dashboard/projects/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Your First Project
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => {
            const latestScan = project.scans[0];
            return (
              <Link key={project.id} href={`/dashboard/projects/${project.id}`}>
                <Card className="hover:border-primary/30 transition-colors cursor-pointer h-full">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base font-semibold">
                        {project.name}
                      </CardTitle>
                      <StatusBadge status={project.status} />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {project.githubRepoFullName}
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          {project._count.findings} findings
                        </span>
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" />
                          {project._count.scans} scans
                        </span>
                      </div>
                    </div>
                    {latestScan && (
                      <div className="mt-3 pt-3 border-t border-border/50 text-xs text-muted-foreground">
                        Last scan: <ScanStatusBadge status={latestScan.status} />{" "}
                        {new Date(latestScan.createdAt).toLocaleDateString()}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "active") {
    return (
      <Badge variant="outline" className="text-green-500 border-green-500/30 text-xs">
        Active
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-muted-foreground text-xs">
      {status}
    </Badge>
  );
}

function ScanStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "completed":
      return <Badge variant="outline" className="text-green-500 border-green-500/30 text-xs"><CheckCircle className="h-3 w-3 mr-1" />Done</Badge>;
    case "running":
      return <Badge variant="outline" className="text-blue-500 border-blue-500/30 text-xs"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Running</Badge>;
    case "failed":
      return <Badge variant="outline" className="text-red-500 border-red-500/30 text-xs"><AlertTriangle className="h-3 w-3 mr-1" />Failed</Badge>;
    default:
      return <Badge variant="outline" className="text-xs">{status}</Badge>;
  }
}
