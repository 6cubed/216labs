import Link from "next/link";
import { Shield, GitBranch, Zap, Lock, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 backdrop-blur-sm sticky top-0 z-50 bg-background/80">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-7 w-7 text-primary" />
            <span className="text-xl font-bold tracking-tight">PipeSecure</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost" size="sm">
                Log in
              </Button>
            </Link>
            <Link href="/login">
              <Button size="sm">
                Get Started
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="py-24 md:py-32">
          <div className="max-w-6xl mx-auto px-6 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border/60 bg-muted/50 text-sm text-muted-foreground mb-8">
              <Zap className="h-3.5 w-3.5" />
              AI-powered security scanning
            </div>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight max-w-3xl mx-auto leading-[1.1]">
              Find vulnerabilities before they ship to production
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              PipeSecure integrates into your GitHub workflow and uses AI agents
              with Semgrep, ast-grep, and CVE databases to continuously scan
              every commit for security issues.
            </p>
            <div className="mt-10 flex items-center justify-center gap-4">
              <Link href="/login">
                <Button size="lg" className="text-base px-8">
                  Connect GitHub
                  <GitBranch className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        <section className="py-20 border-t border-border/40">
          <div className="max-w-6xl mx-auto px-6">
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-16">
              How it works
            </h2>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  icon: GitBranch,
                  title: "Connect your repo",
                  description:
                    "Sign in with GitHub and onboard your repositories. We run an initial full scan immediately.",
                },
                {
                  icon: Shield,
                  title: "AI scans every commit",
                  description:
                    "Our AI agents use Semgrep, ast-grep, and CVE databases to analyze each push for vulnerabilities.",
                },
                {
                  icon: Lock,
                  title: "Fix before it ships",
                  description:
                    "Get detailed reports with severity ratings, CWE classifications, and actionable remediation advice.",
                },
              ].map((feature) => (
                <div
                  key={feature.title}
                  className="relative p-6 rounded-xl border border-border/50 bg-card"
                >
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <feature.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20 border-t border-border/40">
          <div className="max-w-6xl mx-auto px-6">
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-16">
              What we detect
            </h2>
            <div className="grid md:grid-cols-2 gap-4 max-w-3xl mx-auto">
              {[
                "SQL Injection (CWE-89)",
                "Cross-Site Scripting / XSS (CWE-79)",
                "Server-Side Request Forgery (CWE-918)",
                "Path Traversal (CWE-22)",
                "Hardcoded Secrets & API Keys (CWE-798)",
                "DOM-based Vulnerabilities",
                "Prototype Pollution (CWE-1321)",
                "Authentication Bypass (CWE-287)",
                "Outdated Dependencies with Known CVEs",
                "Insecure Eval / Code Injection (CWE-95)",
              ].map((item) => (
                <div key={item} className="flex items-center gap-3 py-2">
                  <Check className="h-4 w-4 text-green-500 shrink-0" />
                  <span className="text-sm">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20 border-t border-border/40">
          <div className="max-w-3xl mx-auto px-6 text-center">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">
              Start securing your code today
            </h2>
            <p className="text-muted-foreground mb-8">
              Free to get started. Bring your own OpenAI API key for AI-powered analysis.
            </p>
            <Link href="/login">
              <Button size="lg" className="text-base px-8">
                Get Started Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/40 py-8">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span>PipeSecure</span>
          </div>
          <p>&copy; {new Date().getFullYear()} PipeSecure. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
