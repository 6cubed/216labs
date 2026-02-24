import { NextResponse } from "next/server";
import { getEstimatesForModel, getStats } from "@/lib/db";
import { MODELS } from "@/lib/models";
import {
  brierScore,
  logLoss,
  expectedCalibrationError,
  calibrationBias,
  reliabilityDiagramData,
} from "@/lib/calibration";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const stats = getStats();

    const modelMetrics = MODELS.map((model) => {
      const rows = getEstimatesForModel(model.id);
      const data = rows.map((r) => ({
        probability: r.probability,
        outcome: r.outcome,
      }));

      return {
        modelId: model.id,
        modelName: model.name,
        params: model.params,
        provider: model.provider,
        color: model.color,
        brierScore: brierScore(data),
        logLoss: logLoss(data),
        ece: expectedCalibrationError(data),
        bias: calibrationBias(data),
        estimateCount: data.length,
        reliabilityData: reliabilityDiagramData(data),
        rank: 0,
      };
    });

    // Rank by Brier Score; models with no data go to the end
    modelMetrics.sort((a, b) => {
      if (a.estimateCount === 0 && b.estimateCount === 0) return 0;
      if (a.estimateCount === 0) return 1;
      if (b.estimateCount === 0) return -1;
      return a.brierScore - b.brierScore;
    });

    modelMetrics.forEach((m, i) => {
      m.rank = i + 1;
    });

    return NextResponse.json({ models: modelMetrics, stats });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
