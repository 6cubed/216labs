/**
 * Minimal transformer in pure TS for in-browser dissection.
 * Records layer activations and supports swapping the LM head for a classifier head (softmax).
 */

export interface TransformerConfig {
  vocabSize: number;
  hiddenSize: number;
  numLayers: number;
  numHeads: number;
  maxLen: number;
  ffnSize: number; // usually 4 * hiddenSize
}

export const DEFAULT_CONFIG: TransformerConfig = {
  vocabSize: 256,
  hiddenSize: 64,
  numLayers: 2,
  numHeads: 4,
  maxLen: 128,
  ffnSize: 256,
};

function seededRandom(seed: number): () => number {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };
}

function alloc(size: number): Float32Array {
  return new Float32Array(size);
}

/** Simple matrix multiply: C = A @ B; A is (m,k), B is (k,n), C is (m,n). */
function matMul(
  A: Float32Array,
  B: Float32Array,
  C: Float32Array,
  m: number,
  k: number,
  n: number
): void {
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      let sum = 0;
      for (let t = 0; t < k; t++) sum += A[i * k + t] * B[t * n + j];
      C[i * n + j] = sum;
    }
  }
}

/** In-place softmax over the last dimension; x has length n. */
function softmaxInPlace(x: Float32Array, start: number, n: number): void {
  let max = x[start];
  for (let i = 1; i < n; i++) {
    const v = x[start + i];
    if (v > max) max = v;
  }
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const v = Math.exp(x[start + i] - max);
    x[start + i] = v;
    sum += v;
  }
  for (let i = 0; i < n; i++) x[start + i] /= sum;
}

/** Layer norm: normalize then scale by gamma and add beta (learned). */
function layerNorm(
  x: Float32Array,
  out: Float32Array,
  gamma: Float32Array,
  beta: Float32Array,
  dim: number,
  eps: number = 1e-5
): void {
  let mean = 0;
  for (let i = 0; i < dim; i++) mean += x[i];
  mean /= dim;
  let var_ = 0;
  for (let i = 0; i < dim; i++) {
    const d = x[i] - mean;
    var_ += d * d;
  }
  var_ = Math.sqrt(var_ / dim + eps);
  for (let i = 0; i < dim; i++) {
    out[i] = gamma[i] * ((x[i] - mean) / var_) + beta[i];
  }
}

export interface TinyTransformerWeights {
  config: TransformerConfig;
  embedding: Float32Array; // vocabSize * hiddenSize
  lnEmbed: { gamma: Float32Array; beta: Float32Array };
  layers: Array<{
    attnQ: Float32Array; // hiddenSize * hiddenSize
    attnK: Float32Array;
    attnV: Float32Array;
    attnOut: Float32Array; // hiddenSize * hiddenSize
    ln1: { gamma: Float32Array; beta: Float32Array };
    ffnW1: Float32Array; // hiddenSize * ffnSize
    ffnW2: Float32Array; // ffnSize * hiddenSize
    ln2: { gamma: Float32Array; beta: Float32Array };
  }>;
  lnFinal: { gamma: Float32Array; beta: Float32Array };
  lmHead: Float32Array; // hiddenSize * vocabSize
  /** Classifier head: hiddenSize * numClasses (optional). */
  classifierHead: Float32Array | null;
  numClasses: number;
}

export function createWeights(
  config: TransformerConfig = DEFAULT_CONFIG,
  numClasses: number = 0,
  seed: number = 42
): TinyTransformerWeights {
  const rng = seededRandom(seed);
  const {
    vocabSize,
    hiddenSize,
    numLayers,
    numHeads,
    ffnSize,
  } = config;

  const scale = 0.02;

  const embedding = alloc(vocabSize * hiddenSize);
  for (let i = 0; i < embedding.length; i++) embedding[i] = (rng() - 0.5) * 2 * scale;

  const lnEmbed = {
    gamma: Float32Array.from({ length: hiddenSize }, () => 1),
    beta: alloc(hiddenSize),
  };

  const layers: TinyTransformerWeights["layers"] = [];
  for (let L = 0; L < numLayers; L++) {
    layers.push({
      attnQ: Float32Array.from({ length: hiddenSize * hiddenSize }, () => (rng() - 0.5) * 2 * scale),
      attnK: Float32Array.from({ length: hiddenSize * hiddenSize }, () => (rng() - 0.5) * 2 * scale),
      attnV: Float32Array.from({ length: hiddenSize * hiddenSize }, () => (rng() - 0.5) * 2 * scale),
      attnOut: Float32Array.from({ length: hiddenSize * hiddenSize }, () => (rng() - 0.5) * 2 * scale),
      ln1: {
        gamma: Float32Array.from({ length: hiddenSize }, () => 1),
        beta: alloc(hiddenSize),
      },
      ffnW1: Float32Array.from({ length: hiddenSize * ffnSize }, () => (rng() - 0.5) * 2 * scale),
      ffnW2: Float32Array.from({ length: ffnSize * hiddenSize }, () => (rng() - 0.5) * 2 * scale),
      ln2: {
        gamma: Float32Array.from({ length: hiddenSize }, () => 1),
        beta: alloc(hiddenSize),
      },
    });
  }

  const lnFinal = {
    gamma: Float32Array.from({ length: hiddenSize }, () => 1),
    beta: alloc(hiddenSize),
  };

  const lmHead = Float32Array.from(
    { length: hiddenSize * vocabSize },
    () => (rng() - 0.5) * 2 * scale
  );

  let classifierHead: Float32Array | null = null;
  if (numClasses > 0) {
    classifierHead = Float32Array.from(
      { length: hiddenSize * numClasses },
      () => (rng() - 0.5) * 2 * scale
    );
  }

  return {
    config,
    embedding,
    lnEmbed,
    layers,
    lnFinal,
    lmHead,
    classifierHead,
    numClasses,
  };
}

export interface ForwardResult {
  /** Logits over vocab for next token (last position). */
  logits: Float32Array;
  /** Softmax class probabilities if classifier head is set; else length 0. */
  classProbs: Float32Array;
  /** Per-layer hidden state at last position (after layer norm). Length = numLayers + 1 (embedding + each layer). */
  activations: Float32Array[];
  /** Hidden size. */
  hiddenSize: number;
}

/**
 * Forward pass. Input token ids (seqLen). Outputs logits for next token, optional class probs, and activations.
 */
export function forward(
  weights: TinyTransformerWeights,
  tokenIds: number[],
  captureActivations: boolean = true
): ForwardResult {
  const { config, embedding, lnEmbed, layers, lnFinal, lmHead, classifierHead, numClasses } = weights;
  const { hiddenSize, vocabSize, ffnSize } = config;
  const seqLen = Math.min(tokenIds.length, config.maxLen);
  const headDim = hiddenSize / config.numHeads;

  const activations: Float32Array[] = [];

  // Embed and optionally layer-norm
  const H = alloc(seqLen * hiddenSize);
  for (let i = 0; i < seqLen; i++) {
    const tid = tokenIds[i]!;
    const off = tid * hiddenSize;
    for (let j = 0; j < hiddenSize; j++) H[i * hiddenSize + j] = embedding[off + j];
  }

  const Hln = alloc(seqLen * hiddenSize);
  for (let i = 0; i < seqLen; i++) {
    layerNorm(
      H.subarray(i * hiddenSize, (i + 1) * hiddenSize),
      Hln.subarray(i * hiddenSize, (i + 1) * hiddenSize),
      lnEmbed.gamma,
      lnEmbed.beta,
      hiddenSize
    );
  }
  if (captureActivations) {
    activations.push(Hln.slice((seqLen - 1) * hiddenSize, seqLen * hiddenSize));
  }

  let current = Hln;

  const Q = alloc(seqLen * hiddenSize);
  const K = alloc(seqLen * hiddenSize);
  const V = alloc(seqLen * hiddenSize);
  const scores = alloc(seqLen * seqLen * config.numHeads);
  const attnOut = alloc(seqLen * hiddenSize);
  const residual = alloc(seqLen * hiddenSize);
  const ffnHidden = alloc(seqLen * ffnSize);
  const ffnOut = alloc(seqLen * ffnSize);
  const lnBuf = alloc(hiddenSize);

  for (let L = 0; L < layers.length; L++) {
    const layer = layers[L]!;
    // Residual path
    for (let i = 0; i < current.length; i++) residual[i] = current[i];

    // Multi-head self-attention (simplified: we do one big matmul per Q,K,V then reshape and scale)
    matMul(current, layer.attnQ, Q, seqLen, hiddenSize, hiddenSize);
    matMul(current, layer.attnK, K, seqLen, hiddenSize, hiddenSize);
    matMul(current, layer.attnV, V, seqLen, hiddenSize, hiddenSize);

    for (let h = 0; h < config.numHeads; h++) {
      const qOff = h * headDim;
      const kOff = h * headDim;
      for (let i = 0; i < seqLen; i++) {
        for (let j = 0; j < seqLen; j++) {
          let dot = 0;
          for (let d = 0; d < headDim; d++) {
            dot += Q[i * hiddenSize + qOff + d] * K[j * hiddenSize + kOff + d];
          }
          scores[h * seqLen * seqLen + i * seqLen + j] = dot / Math.sqrt(headDim);
        }
      }
      // Softmax over j for each i
      for (let i = 0; i < seqLen; i++) {
        softmaxInPlace(scores, h * seqLen * seqLen + i * seqLen, seqLen);
      }
    }

    for (let i = 0; i < seqLen; i++) {
      for (let j = 0; j < hiddenSize; j++) {
        let sum = 0;
        for (let h = 0; h < config.numHeads; h++) {
          const vOff = h * headDim;
          for (let k = 0; k < seqLen; k++) {
            sum +=
              scores[h * seqLen * seqLen + i * seqLen + k] *
              V[k * hiddenSize + vOff + (j % headDim)];
          }
        }
        attnOut[i * hiddenSize + j] = sum;
      }
    }
    matMul(attnOut, layer.attnOut, Q, seqLen, hiddenSize, hiddenSize);
    for (let i = 0; i < current.length; i++) current[i] = residual[i] + Q[i];

    for (let i = 0; i < seqLen; i++) {
      layerNorm(
        current.subarray(i * hiddenSize, (i + 1) * hiddenSize),
        Hln.subarray(i * hiddenSize, (i + 1) * hiddenSize),
        layer.ln1.gamma,
        layer.ln1.beta,
        hiddenSize
      );
    }
    for (let i = 0; i < current.length; i++) current[i] = Hln[i];
    for (let i = 0; i < current.length; i++) residual[i] = current[i]; // residual = post-attn for FFN

    // FFN
    matMul(current, layer.ffnW1, ffnHidden, seqLen, hiddenSize, ffnSize);
    for (let i = 0; i < seqLen * ffnSize; i++) {
      ffnOut[i] = Math.max(0, ffnHidden[i]);
    }
    matMul(ffnOut, layer.ffnW2, ffnHidden, seqLen, ffnSize, hiddenSize);
    for (let i = 0; i < seqLen * hiddenSize; i++) current[i] = residual[i] + ffnHidden[i];

    for (let i = 0; i < seqLen; i++) {
      layerNorm(
        current.subarray(i * hiddenSize, (i + 1) * hiddenSize),
        Hln.subarray(i * hiddenSize, (i + 1) * hiddenSize),
        layer.ln2.gamma,
        layer.ln2.beta,
        hiddenSize
      );
    }
    for (let i = 0; i < current.length; i++) current[i] = Hln[i];

    if (captureActivations) {
      activations.push(current.slice((seqLen - 1) * hiddenSize, seqLen * hiddenSize));
    }
  }

  // Final LN
  const lastHidden = current.slice((seqLen - 1) * hiddenSize, seqLen * hiddenSize);
  layerNorm(lastHidden, lnBuf, lnFinal.gamma, lnFinal.beta, hiddenSize);

  const logits = alloc(vocabSize);
  matMul(lnBuf as Float32Array, lmHead, logits, 1, hiddenSize, vocabSize);

  let classProbs: Float32Array = new Float32Array(0);
  if (classifierHead && numClasses > 0) {
    const classLogits = alloc(numClasses);
    matMul(lnBuf as Float32Array, classifierHead, classLogits, 1, hiddenSize, numClasses);
    softmaxInPlace(classLogits, 0, numClasses);
    classProbs = new Float32Array(classLogits);
  }

  return {
    logits,
    classProbs,
    activations,
    hiddenSize,
  };
}

/** Replace LM head with a new classifier head (numClasses). Creates new weights with classifier head. */
export function setClassifierHead(
  weights: TinyTransformerWeights,
  numClasses: number,
  seed: number = 123
): TinyTransformerWeights {
  const rng = seededRandom(seed);
  const scale = 0.02;
  const classifierHead = Float32Array.from(
    { length: weights.config.hiddenSize * numClasses },
    () => (rng() - 0.5) * 2 * scale
  );
  return {
    ...weights,
    classifierHead,
    numClasses,
  };
}

/** Char-level tokenizer: bytes 0..255. */
export function tokenize(text: string): number[] {
  const codes: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    codes.push(c >= 256 ? 32 : c);
  }
  return codes;
}

export function detokenize(ids: number[]): string {
  return ids.map((id) => String.fromCharCode(id)).join("");
}
