import { revalidatePath } from "next/cache";
import {
  createEmployee,
  getStorePathForDebug,
  listEmployees,
} from "../lib/workforce-store";
import { EmployeeForm } from "./employee-form";

export const dynamic = "force-dynamic";

async function createEmployeeAction(_prevState, formData) {
  "use server";
  const result = createEmployee({
    name: formData.get("name"),
    role: formData.get("role"),
    notes: formData.get("notes"),
    botToken: formData.get("botToken"),
  });

  if (!result.ok) {
    return { error: result.error };
  }
  revalidatePath("/");
  return { ok: true };
}

export default function Page() {
  const employees = listEmployees();

  return (
    <main>
      <h1 style={{ fontSize: "1.75rem", marginBottom: "0.5rem" }}>216Labs Workforce</h1>
      <p className="muted">
        Create agentic digital employees. Every employee must have a unique Telegram bot token.
      </p>

      <section className="section">
        <h2 style={{ fontSize: "1.1rem", marginBottom: "0.75rem" }}>New digital employee</h2>
        <EmployeeForm action={createEmployeeAction} />
      </section>

      <section className="section">
        <h2 style={{ fontSize: "1.1rem", marginBottom: "0.75rem" }}>
          Digital employees ({employees.length})
        </h2>
        {employees.length === 0 ? (
          <p className="muted">
            No digital employees yet. Create the first one above.
          </p>
        ) : (
          <div className="grid">
            {employees.map((employee) => (
              <article key={employee.id} className="card">
                <h3 style={{ fontSize: "1rem" }}>{employee.name}</h3>
                <p className="muted" style={{ marginTop: "0.25rem" }}>
                  {employee.role}
                </p>
                {employee.notes ? (
                  <p style={{ marginTop: "0.5rem", whiteSpace: "pre-wrap" }}>{employee.notes}</p>
                ) : null}
                <p className="token">Telegram token: {employee.telegramBotToken}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      <p className="muted" style={{ marginTop: "1rem", fontSize: "0.85rem" }}>
        Data file: <code>{getStorePathForDebug()}</code>. Team structure and reporting lines can be
        layered on this employee registry next.
      </p>
    </main>
  );
}
