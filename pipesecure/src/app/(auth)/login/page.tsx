"use client";

import { Shield, GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { signIn } from "next-auth/react";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md mx-4">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Welcome to PipeSecure</CardTitle>
          <CardDescription>
            Sign in with your GitHub account to start scanning your repositories
            for security vulnerabilities.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            className="w-full"
            size="lg"
            onClick={() => signIn("github", { callbackUrl: "/dashboard" })}
          >
            <GitBranch className="mr-2 h-5 w-5" />
            Continue with GitHub
          </Button>
          <p className="mt-4 text-xs text-center text-muted-foreground">
            We&apos;ll request access to read your repositories so we can scan
            them for vulnerabilities. Your code is never stored permanently.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
