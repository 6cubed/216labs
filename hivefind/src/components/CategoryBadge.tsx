import { MysteryCategory } from "@/data/types";

const labels: Record<MysteryCategory, string> = {
  disappearance: "Disappearance",
  murder: "Murder",
  unsolved_death: "Unsolved Death",
  robbery: "Robbery",
  other: "Other",
};

export function CategoryBadge({ category }: { category: MysteryCategory }) {
  return (
    <span className="rounded bg-surface-light px-2 py-0.5 text-xs font-medium text-muted">
      {labels[category]}
    </span>
  );
}
