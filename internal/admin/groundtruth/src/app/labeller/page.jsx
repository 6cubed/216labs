import Link from "next/link";
import { revalidatePath } from "next/cache";
import { listOpenTasks, submitLabels } from "../../lib/groundtruth-store";
import { LabelForm } from "./label-form";

export const dynamic = "force-dynamic";

async function submitLabelsAction(_prevState, formData) {
  "use server";
  const taskId = String(formData.get("taskId") || "");
  const workerName = String(formData.get("workerName") || "");
  const labelsByImage = {};

  Array.from(formData.entries()).forEach(([key, value]) => {
    if (!key.startsWith("labels_")) return;
    const imageUrl = decodeURIComponent(key.slice("labels_".length));
    labelsByImage[imageUrl] = String(value || "");
  });

  const result = submitLabels({ taskId, workerName, labelsByImage });
  if (!result.ok) return { error: result.error };
  revalidatePath("/requester");
  revalidatePath("/labeller");
  return { ok: true };
}

export default function LabellerPage() {
  const tasks = listOpenTasks();
  const task = tasks[0];

  return (
    <main>
      <p className="muted" style={{ marginBottom: "0.5rem" }}>
        <Link href="/">Groundtruth</Link> / Labeller
      </p>
      <h1 style={{ fontSize: "1.6rem", marginBottom: "0.35rem" }}>Labeller flow</h1>
      <p className="muted">Pick an open task and submit labels per image.</p>

      {!task ? (
        <section className="section">
          <p className="muted">No open tasks yet. Ask a requester to publish one.</p>
        </section>
      ) : (
        <section className="section">
          <h2 style={{ fontSize: "1.1rem", marginBottom: "0.5rem" }}>{task.title}</h2>
          <p className="muted">{task.dataset.name}</p>
          <p style={{ marginTop: "0.5rem" }}>{task.dataset.instructions}</p>
          <p style={{ marginTop: "0.5rem" }}>
            Required labels: {task.dataset.requiredLabels.join(", ")}
          </p>
          <LabelForm action={submitLabelsAction} task={task} />
        </section>
      )}
    </main>
  );
}
