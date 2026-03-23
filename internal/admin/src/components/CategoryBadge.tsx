import type { AppCategory } from "@/data/apps";
import { categoryLabels, categoryColors } from "@/data/apps";

export function CategoryBadge({ category }: { category: AppCategory }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full border ${categoryColors[category]}`}
    >
      {categoryLabels[category]}
    </span>
  );
}
