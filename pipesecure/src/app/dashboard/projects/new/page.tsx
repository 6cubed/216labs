"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GitBranch, Loader2, Search, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import Link from "next/link";

interface Repo {
  id: number;
  fullName: string;
  name: string;
  private: boolean;
  defaultBranch: string;
  language: string | null;
  updatedAt: string;
}

export default function NewProjectPage() {
  const router = useRouter();
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [onboarding, setOnboarding] = useState<string | null>(null);
  const [authError, setAuthError] = useState(false);

  useEffect(() => {
    fetch("/api/github/repos")
      .then(async (r) => {
        if (r.status === 403) {
          setAuthError(true);
          return;
        }
        const data = await r.json();
        if (Array.isArray(data)) setRepos(data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filteredRepos = repos.filter(
    (r) =>
      r.fullName.toLowerCase().includes(search.toLowerCase()) ||
      r.name.toLowerCase().includes(search.toLowerCase())
  );

  async function onboardRepo(repo: Repo) {
    setOnboarding(repo.fullName);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoFullName: repo.fullName,
          defaultBranch: repo.defaultBranch,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        toast.error(error.error || "Failed to onboard repository");
        return;
      }

      const data = await res.json();
      toast.success("Repository onboarded! Initial scan queued.");
      router.push(`/dashboard/projects/${data.project.id}`);
    } catch {
      toast.error("Failed to onboard repository");
    } finally {
      setOnboarding(null);
    }
  }

  return (
    <div>
      <div className="mb-8">
        <Link
          href="/dashboard"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to projects
        </Link>
        <h1 className="text-2xl font-bold">Add a Project</h1>
        <p className="text-muted-foreground mt-1">
          Select a GitHub repository to scan for vulnerabilities.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Your Repositories</CardTitle>
          <CardDescription>
            Choose a repository to onboard. An initial full scan will be triggered immediately.
          </CardDescription>
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search repositories..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          {authError ? (
            <div className="text-center py-12 space-y-3">
              <p className="text-muted-foreground">
                Your GitHub token has expired or lacks permission to access private repos.
              </p>
              <Button variant="outline" asChild>
                <a href="/api/auth/signin">Sign in again to refresh permissions</a>
              </Button>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredRepos.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {search ? "No repositories match your search." : "No repositories found."}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredRepos.map((repo) => (
                <div
                  key={repo.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-border/50 hover:border-border transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <GitBranch className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">{repo.fullName}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {repo.language && (
                          <Badge variant="secondary" className="text-xs">
                            {repo.language}
                          </Badge>
                        )}
                        {repo.private && (
                          <Badge variant="outline" className="text-xs">
                            Private
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          Updated {new Date(repo.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    disabled={onboarding !== null}
                    onClick={() => onboardRepo(repo)}
                  >
                    {onboarding === repo.fullName ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Add"
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
