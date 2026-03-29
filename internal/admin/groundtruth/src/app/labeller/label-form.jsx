"use client";

import { useActionState } from "react";

const initialState = {};

export function LabelForm({ action, task }) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="grid">
      <input type="hidden" name="taskId" value={task.id} />
      <label>
        Labeller name
        <input name="workerName" required placeholder="alex-annotator" />
      </label>

      <p className="muted">Enter comma-separated labels per image.</p>
      <div className="imagesGrid">
        {task.dataset.imageUrls.map((imageUrl) => (
          <label key={imageUrl} className="card">
            {/* Dynamic dataset URLs; eslint-disable: next/image needs remotePatterns per host */}
            {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary imageUrl from dataset */}
            <img src={imageUrl} alt="Dataset sample" />
            <span style={{ marginTop: "0.5rem" }}>Labels</span>
            <input
              name={`labels_${encodeURIComponent(imageUrl)}`}
              placeholder={task.dataset.requiredLabels.join(", ")}
            />
          </label>
        ))}
      </div>

      {state?.error ? <p className="error">{state.error}</p> : null}
      {state?.ok ? <p className="ok">Submission received.</p> : null}
      <button type="submit" disabled={isPending}>
        {isPending ? "Submitting..." : "Submit labels"}
      </button>
    </form>
  );
}
