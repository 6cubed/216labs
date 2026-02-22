import Link from "next/link";

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-background font-bold text-sm">
            H
          </div>
          <span className="text-lg font-semibold tracking-tight">
            Hive<span className="text-accent">Find</span>
          </span>
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link
            href="/"
            className="text-muted transition-colors hover:text-foreground"
          >
            Mysteries
          </Link>
          <Link
            href="/#about"
            className="text-muted transition-colors hover:text-foreground"
          >
            About
          </Link>
          <Link
            href="/#submit"
            className="rounded-lg bg-accent/10 px-3.5 py-1.5 text-accent transition-colors hover:bg-accent/20"
          >
            Submit a Tip
          </Link>
        </nav>
      </div>
    </header>
  );
}
