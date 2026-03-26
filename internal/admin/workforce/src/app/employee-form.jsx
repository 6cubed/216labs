"use client";

import { useActionState } from "react";

const initialState = {};

export function EmployeeForm({ action }) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="grid">
      <div className="grid two">
        <label>
          Name
          <input name="name" required placeholder="Support Agent Alpha" />
        </label>
        <label>
          Role
          <input name="role" required placeholder="Customer support" />
        </label>
      </div>
      <label>
        Telegram bot token
        <input
          name="botToken"
          required
          placeholder="123456789:AA..."
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      <label>
        Notes
        <textarea
          name="notes"
          rows={4}
          placeholder="Mission, scope, handoff notes, or operating constraints..."
        />
      </label>
      {state?.error ? <p className="error">{state.error}</p> : null}
      {state?.ok ? <p className="ok">Employee created.</p> : null}
      <button type="submit" disabled={isPending}>
        {isPending ? "Creating..." : "Create employee"}
      </button>
    </form>
  );
}
