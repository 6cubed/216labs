"use client";

import { Fragment, useState, useTransition } from "react";
import {
  createTodoCardAction,
  updateTodoCardAction,
  deleteTodoCardAction,
  moveTodoCardAction,
} from "@/app/actions";
import type { DbTodoBoardColumn } from "@/lib/db";

type Props = { columns: DbTodoBoardColumn[] };

export function TodoBoard({ columns }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [pending, startTransition] = useTransition();
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const beginEdit = (card: { id: string; title: string; body: string }) => {
    setEditingId(card.id);
    setEditTitle(card.title);
    setEditBody(card.body);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle("");
    setEditBody("");
  };

  const saveEdit = () => {
    if (!editingId) return;
    const t = editTitle.trim();
    if (!t) return;
    startTransition(async () => {
      await updateTodoCardAction(editingId, { title: t, body: editBody });
      cancelEdit();
    });
  };

  const handleDropAtIndex = (
    columnId: string,
    index: number,
    e: React.DragEvent
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const id = e.dataTransfer.getData("cardId");
    if (!id) return;
    startTransition(() => {
      void moveTodoCardAction(id, columnId, index);
    });
    setDraggingId(null);
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 -mx-6 px-6 scroll-smooth snap-x snap-mandatory">
      {columns.map((col) => (
        <div
          key={col.id}
          className="flex-shrink-0 w-[min(100vw-3rem,20rem)] snap-start flex flex-col rounded-xl border border-border bg-surface/80 min-h-[22rem] max-h-[calc(100vh-12rem)]"
        >
          <div className="px-3 py-2.5 border-b border-border bg-surface-light/50 rounded-t-xl">
            <h2 className="text-sm font-semibold text-foreground tracking-tight">
              {col.title}
            </h2>
            <p className="text-[11px] text-muted mt-0.5">
              {col.cards.length} item{col.cards.length === 1 ? "" : "s"}
            </p>
          </div>

          <div className="flex-1 flex flex-col gap-0 p-2 overflow-y-auto min-h-[6rem]">
            {col.cards.length === 0 ? (
              <div
                className="flex-1 flex flex-col"
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                }}
                onDrop={(e) => handleDropAtIndex(col.id, 0, e)}
              >
                <p className="text-xs text-muted/90 text-center py-6 px-2 border border-dashed border-border rounded-lg">
                  Drop cards here or add below
                </p>
              </div>
            ) : (
              Array.from({ length: col.cards.length + 1 }).map((_, slot) => (
                <Fragment key={`slot-${col.id}-${slot}`}>
                  <TodoDropSlot
                    active={draggingId !== null}
                    onDrop={(e) => handleDropAtIndex(col.id, slot, e)}
                  />
                  {slot < col.cards.length ? (
                    <article
                      draggable={editingId !== col.cards[slot].id}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("cardId", col.cards[slot].id);
                        e.dataTransfer.effectAllowed = "move";
                        setDraggingId(col.cards[slot].id);
                      }}
                      onDragEnd={() => setDraggingId(null)}
                      className={`rounded-lg border border-border bg-background/90 p-2.5 shadow-sm transition-opacity mb-2 ${
                        draggingId === col.cards[slot].id
                          ? "opacity-50"
                          : "opacity-100"
                      } ${
                        editingId === col.cards[slot].id
                          ? ""
                          : "hover:border-accent/40 cursor-grab active:cursor-grabbing"
                      }`}
                    >
                      {editingId === col.cards[slot].id ? (
                        <div
                          className="space-y-2"
                          onClick={(ev) => ev.stopPropagation()}
                        >
                          <input
                            value={editTitle}
                            onChange={(ev) => setEditTitle(ev.target.value)}
                            className="w-full text-sm font-medium bg-surface border border-border rounded-md px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                            placeholder="Title"
                            autoFocus
                          />
                          <textarea
                            value={editBody}
                            onChange={(ev) => setEditBody(ev.target.value)}
                            rows={3}
                            className="w-full text-xs bg-surface border border-border rounded-md px-2 py-1.5 text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent resize-y min-h-[4rem]"
                            placeholder="Notes (optional)"
                          />
                          <div className="flex gap-2 justify-end">
                            <button
                              type="button"
                              onClick={cancelEdit}
                              className="text-xs px-2 py-1 rounded-md text-muted hover:text-foreground"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              disabled={pending || !editTitle.trim()}
                              onClick={saveEdit}
                              className="text-xs px-2.5 py-1 rounded-md bg-accent/90 text-white hover:bg-accent disabled:opacity-50"
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-start justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => beginEdit(col.cards[slot])}
                              className="text-left text-sm font-medium text-foreground leading-snug flex-1 hover:text-accent transition-colors"
                            >
                              {col.cards[slot].title}
                            </button>
                            <button
                              type="button"
                              aria-label="Delete card"
                              onClick={() =>
                                startTransition(() => {
                                  void deleteTodoCardAction(col.cards[slot].id);
                                })
                              }
                              className="text-muted hover:text-red-400 text-xs px-1 shrink-0"
                            >
                              ×
                            </button>
                          </div>
                          {col.cards[slot].body ? (
                            <p className="text-xs text-muted mt-1.5 line-clamp-6 whitespace-pre-wrap">
                              {col.cards[slot].body}
                            </p>
                          ) : null}
                        </>
                      )}
                    </article>
                  ) : null}
                </Fragment>
              ))
            )}
          </div>

          <AddCardForm columnId={col.id} disabled={pending} />
        </div>
      ))}
    </div>
  );
}

function TodoDropSlot({
  active,
  onDrop,
}: {
  active: boolean;
  onDrop: (e: React.DragEvent) => void;
}) {
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "move";
      }}
      onDrop={(e) => {
        e.stopPropagation();
        onDrop(e);
      }}
      className={`shrink-0 rounded-md transition-colors ${
        active
          ? "min-h-3 border border-dashed border-border/40 hover:border-accent/40 hover:bg-accent/5"
          : "min-h-1"
      }`}
      aria-hidden
    />
  );
}

function AddCardForm({
  columnId,
  disabled,
}: {
  columnId: string;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();

  const submit = () => {
    const t = title.trim();
    if (!t) return;
    startTransition(async () => {
      const r = await createTodoCardAction(columnId, t, body);
      if (r && "error" in r) return;
      setTitle("");
      setBody("");
      setOpen(false);
    });
  };

  if (!open) {
    return (
      <div className="p-2 pt-0 border-t border-border/60">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(true)}
          className="w-full text-left text-xs font-medium text-muted hover:text-foreground py-2 px-2 rounded-lg hover:bg-white/5 transition-colors"
        >
          + Add card
        </button>
      </div>
    );
  }

  return (
    <div className="p-2 pt-0 border-t border-border/60 space-y-2">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title"
        className="w-full text-sm bg-surface border border-border rounded-md px-2 py-1.5 text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent"
        autoFocus
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Description (optional)"
        rows={2}
        className="w-full text-xs bg-surface border border-border rounded-md px-2 py-1.5 text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent resize-none"
      />
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setTitle("");
            setBody("");
          }}
          className="text-xs px-2 py-1 rounded-md text-muted hover:text-foreground"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={pending || !title.trim()}
          onClick={submit}
          className="text-xs px-2.5 py-1 rounded-md bg-accent/90 text-white hover:bg-accent disabled:opacity-50"
        >
          Add
        </button>
      </div>
    </div>
  );
}
