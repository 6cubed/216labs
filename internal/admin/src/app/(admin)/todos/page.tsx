import { getTodoBoard } from "@/lib/db";
import { TodoBoard } from "@/components/TodoBoard";

export const dynamic = "force-dynamic";

export default async function TodosPage() {
  const columns = getTodoBoard();

  return (
    <section className="animate-fade-in space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Todo board</h2>
        <p className="text-sm text-muted mt-1 max-w-2xl">
          Drag cards between columns or reorder within a column. Data lives in
          the admin SQLite database — hourly agent runs can pick up backlog items
          later without changing this UI.
        </p>
      </div>
      <TodoBoard columns={columns} />
    </section>
  );
}
