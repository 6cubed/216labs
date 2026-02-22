export function Footer() {
  return (
    <footer className="border-t border-border bg-surface py-12">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-accent text-background font-bold text-xs">
              H
            </div>
            <span className="text-sm font-semibold">
              Hive<span className="text-accent">Find</span>
            </span>
          </div>
          <p className="max-w-md text-sm text-muted">
            A crowd-sourced platform for gathering clues and tips about unsolved
            mysteries. If you have information about any case, please contact
            your local police.
          </p>
          <p className="text-xs text-muted/60">
            &copy; {new Date().getFullYear()} HiveFind. This is an informational
            resource. Always report tips to the relevant authorities.
          </p>
        </div>
      </div>
    </footer>
  );
}
