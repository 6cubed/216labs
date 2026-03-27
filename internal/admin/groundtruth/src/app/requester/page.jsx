import Link from "next/link";
import { revalidatePath } from "next/cache";
import {
  createDatasetWithTask,
  getStorePathForDebug,
  listDatasets,
  listOpenTasks,
} from "../../lib/groundtruth-store";
import { RequesterForm } from "./requester-form";

export const dynamic = "force-dynamic";

async function createTaskAction(_prevState, formData) {
  "use server";
  const result = createDatasetWithTask({
    name: formData.get("name"),
    description: formData.get("description"),
    taskTitle: formData.get("taskTitle"),
    instructions: formData.get("instructions"),
    requiredLabels: formData.get("requiredLabels"),
    imageUrls: formData.get("imageUrls"),
  });
  if (!result.ok) return { error: result.error };
  revalidatePath("/requester");
  revalidatePath("/labeller");
  return { ok: true };
}

export default function RequesterPage() {
  const datasets = listDatasets();
  const openTasks = listOpenTasks();

  return (
    <main>
      <p className="muted" style={{ marginBottom: "0.5rem" }}>
        <Link href="/">Groundtruth</Link> / Requester
      </p>
      <h1 style={{ fontSize: "1.6rem", marginBottom: "0.35rem" }}>Requester flow</h1>
      <p className="muted">
        Define a label schema and publish image-labeling tasks for labellers.
      </p>

      <section className="section">
        <h2 style={{ fontSize: "1.1rem", marginBottom: "0.75rem" }}>Create dataset + task</h2>
        <RequesterForm action={createTaskAction} />
      </section>

      <section className="section">
        <h2 style={{ fontSize: "1.1rem", marginBottom: "0.75rem" }}>
          Open tasks ({openTasks.length})
        </h2>
        <div className="grid">
          {openTasks.map((task) => (
            <article key={task.id} className="card">
              <h3 style={{ fontSize: "1rem" }}>
                {task.title}
                <span className="badge">{task.submissions.length} submissions</span>
              </h3>
              <p className="muted" style={{ marginTop: "0.35rem" }}>
                Dataset: {task.dataset.name}
              </p>
              <p style={{ marginTop: "0.5rem" }}>
                Required labels: {task.dataset.requiredLabels.join(", ")}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="section">
        <h2 style={{ fontSize: "1.1rem", marginBottom: "0.75rem" }}>Datasets ({datasets.length})</h2>
        <div className="grid">
          {datasets.map((dataset) => (
            <article key={dataset.id} className="card">
              <h3 style={{ fontSize: "1rem" }}>{dataset.name}</h3>
              {dataset.description ? (
                <p className="muted" style={{ marginTop: "0.35rem" }}>
                  {dataset.description}
                </p>
              ) : null}
              <p style={{ marginTop: "0.45rem" }}>{dataset.imageUrls.length} images</p>
            </article>
          ))}
        </div>
      </section>

      <p className="muted" style={{ marginTop: "1rem", fontSize: "0.85rem" }}>
        Data file: <code>{getStorePathForDebug()}</code>
      </p>
    </main>
  );
}
