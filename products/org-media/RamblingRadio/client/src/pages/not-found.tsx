import { Link } from "wouter";
import { AlertTriangle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background text-foreground">
      <div className="text-center space-y-6 p-8 border border-border/50 rounded-2xl bg-card/50 backdrop-blur shadow-2xl max-w-md mx-4">
        <div className="inline-flex p-4 bg-destructive/10 rounded-full text-destructive mb-2">
          <AlertTriangle className="w-10 h-10" />
        </div>
        
        <h1 className="text-4xl font-bold tracking-tight">404 Lost Signal</h1>
        <p className="text-muted-foreground text-lg">
          The frequency you are looking for does not exist or has been jammed.
        </p>

        <Link href="/">
          <a className="inline-flex items-center justify-center px-6 py-3 rounded-xl font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors w-full">
            Return to Base
          </a>
        </Link>
      </div>
    </div>
  );
}
