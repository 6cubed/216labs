import { NextResponse } from "next/server";
import { refreshState } from "@/lib/refresh-state";
import { fetchPolymarketEvents } from "@/lib/polymarket";
import { getModelEstimate, MODELS } from "@/lib/models";
import { upsertEvent, upsertEstimate, hasEstimate } from "@/lib/db";

export const dynamic = "force-dynamic";

async function runRefresh(eventCount: number) {
  try {
    refreshState.phase = "fetching-events";
    refreshState.message = "Fetching events from Polymarket...";
    refreshState.completed = 0;
    refreshState.total = 0;
    refreshState.errors = 0;

    const events = await fetchPolymarketEvents(eventCount);

    for (const event of events) {
      upsertEvent(event);
    }

    refreshState.phase = "running-models";

    const tasks: Array<{
      eventId: string;
      modelId: string;
      question: string;
      description: string;
    }> = [];

    for (const event of events) {
      for (const model of MODELS) {
        if (!hasEstimate(event.id, model.id)) {
          tasks.push({
            eventId: event.id,
            modelId: model.id,
            question: event.question,
            description: event.description,
          });
        }
      }
    }

    refreshState.total = tasks.length;
    refreshState.message = `Running ${tasks.length} estimates (${events.length} events × ${MODELS.length} models)...`;

    const CONCURRENCY = 10;
    for (let i = 0; i < tasks.length; i += CONCURRENCY) {
      const batch = tasks.slice(i, i + CONCURRENCY);
      await Promise.all(
        batch.map(async (task) => {
          try {
            const prob = await getModelEstimate(
              task.modelId,
              task.question,
              task.description
            );
            if (prob !== null) {
              upsertEstimate(task.eventId, task.modelId, prob);
            }
          } catch {
            refreshState.errors++;
          } finally {
            refreshState.completed++;
          }
        })
      );
    }

    refreshState.phase = "done";
    refreshState.message = `Complete! ${refreshState.completed - refreshState.errors} estimates collected.`;
  } catch (error) {
    refreshState.phase = "error";
    refreshState.message = `Error: ${error instanceof Error ? error.message : String(error)}`;
    console.error("Refresh error:", error);
  } finally {
    refreshState.isRunning = false;
  }
}

export async function POST(req: Request) {
  if (refreshState.isRunning) {
    return NextResponse.json({
      ...refreshState,
      message: "Refresh already in progress",
    });
  }

  const body = await req.json().catch(() => ({})) as { eventCount?: number };
  const eventCount = Math.min(Number(body.eventCount) || 100, 100);

  refreshState.isRunning = true;
  refreshState.phase = "fetching-events";
  refreshState.startedAt = new Date().toISOString();
  refreshState.message = "Starting...";
  refreshState.completed = 0;
  refreshState.total = 0;
  refreshState.errors = 0;

  // Fire-and-forget background task
  runRefresh(eventCount).catch(console.error);

  return NextResponse.json(refreshState);
}
