import { NextResponse } from "next/server";
import { getEvents, getEstimatesForEvent } from "@/lib/db";
import { MODELS } from "@/lib/models";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const events = getEvents(50);

    const result = events.map((event) => {
      const estimates = getEstimatesForEvent(event.id);
      const estimateMap = new Map(
        estimates.map((e) => [e.model_id, e.probability])
      );

      return {
        id: event.id,
        question: event.question,
        marketProbability: event.market_probability,
        outcome: event.outcome,
        isResolved: event.is_resolved === 1,
        volume: event.volume,
        estimates: MODELS.map((m) => ({
          modelId: m.id,
          modelName: m.name,
          probability: estimateMap.get(m.id) ?? null,
        })).filter((e) => e.probability !== null),
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
