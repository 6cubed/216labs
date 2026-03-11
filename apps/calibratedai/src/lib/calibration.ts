export interface CalibrationInput {
  probability: number;
  outcome: number;
}

export interface ReliabilityPoint {
  midpoint: number;
  predicted: number;
  actual: number;
  count: number;
}

const EPS = 1e-7;

export function brierScore(data: CalibrationInput[]): number {
  if (data.length === 0) return 1;
  return (
    data.reduce((sum, d) => sum + Math.pow(d.probability - d.outcome, 2), 0) /
    data.length
  );
}

export function logLoss(data: CalibrationInput[]): number {
  if (data.length === 0) return Infinity;
  return (
    -data.reduce((sum, d) => {
      const p = Math.max(EPS, Math.min(1 - EPS, d.probability));
      return sum + d.outcome * Math.log(p) + (1 - d.outcome) * Math.log(1 - p);
    }, 0) / data.length
  );
}

export function expectedCalibrationError(
  data: CalibrationInput[],
  numBins = 10
): number {
  if (data.length === 0) return 0;

  const bins = Array.from({ length: numBins }, () => ({
    count: 0,
    sumP: 0,
    sumO: 0,
  }));

  for (const { probability, outcome } of data) {
    const idx = Math.min(Math.floor(probability * numBins), numBins - 1);
    bins[idx].count++;
    bins[idx].sumP += probability;
    bins[idx].sumO += outcome;
  }

  return bins.reduce((ece, bin) => {
    if (bin.count === 0) return ece;
    const avgP = bin.sumP / bin.count;
    const avgO = bin.sumO / bin.count;
    return ece + (bin.count / data.length) * Math.abs(avgP - avgO);
  }, 0);
}

export function calibrationBias(data: CalibrationInput[]): number {
  if (data.length === 0) return 0;
  return (
    data.reduce((sum, d) => sum + (d.probability - d.outcome), 0) / data.length
  );
}

export function reliabilityDiagramData(
  data: CalibrationInput[],
  numBins = 10
): ReliabilityPoint[] {
  const bins = Array.from({ length: numBins }, (_, i) => ({
    midpoint: (i + 0.5) / numBins,
    count: 0,
    sumP: 0,
    sumO: 0,
  }));

  for (const { probability, outcome } of data) {
    const idx = Math.min(Math.floor(probability * numBins), numBins - 1);
    bins[idx].count++;
    bins[idx].sumP += probability;
    bins[idx].sumO += outcome;
  }

  return bins
    .filter((b) => b.count >= 2)
    .map((b) => ({
      midpoint: b.midpoint,
      predicted: b.sumP / b.count,
      actual: b.sumO / b.count,
      count: b.count,
    }));
}
