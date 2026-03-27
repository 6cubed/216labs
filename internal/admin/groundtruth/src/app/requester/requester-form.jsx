"use client";

import { useActionState } from "react";

const initialState = {};

export function RequesterForm({ action }) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="grid">
      <label>
        Dataset name
        <input name="name" required placeholder="Q2 retail shelf checks" />
      </label>
      <label>
        Dataset description
        <textarea
          name="description"
          rows={2}
          placeholder="What this dataset is for and expected quality bar."
        />
      </label>
      <label>
        Task title
        <input name="taskTitle" required placeholder="Label shelf objects for stock audit" />
      </label>
      <label>
        Required labels (comma separated)
        <input name="requiredLabels" required placeholder="person, shelf, price-tag, product" />
      </label>
      <label>
        Instructions for labellers
        <textarea
          name="instructions"
          rows={3}
          placeholder="Mark all labels visible in each image. Skip blurry content."
        />
      </label>
      <label>
        Image URLs (one per line)
        <textarea
          name="imageUrls"
          rows={6}
          required
          placeholder={"https://example.com/img-1.jpg\nhttps://example.com/img-2.jpg"}
        />
      </label>
      {state?.error ? <p className="error">{state.error}</p> : null}
      {state?.ok ? (
        <p className="ok">Dataset and task created. Labellers can start immediately.</p>
      ) : null}
      <button type="submit" disabled={isPending}>
        {isPending ? "Creating..." : "Create dataset + task"}
      </button>
    </form>
  );
}
