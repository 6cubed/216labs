# Can Perch detect American mink from audio out of the box?

**Working draft — 216labs research**  
**Status:** Protocol + notebook ready; empirical verdict pending Colab run with mink clips.

## Abstract

We evaluate whether off-the-shelf **Google bioacoustic classifiers**—specifically the **bird vocalization classifier** used in our Bird Perch product and the newer **Perch 2.0** foundation model—can identify **American mink** (*Neogale vison*) vocalizations without fine-tuning. Mink are invasive in parts of Europe and are increasingly monitored acoustically alongside birds. A positive OOTB result would enable rapid deployment on existing Perch infrastructure; a negative result clarifies the need for agile modeling or custom training.

## 1. Motivation

- **Conservation / management:** Acoustic surveys for mustelids are rare compared to birds; automated detectors could scale riverine and coastal monitoring.
- **Engineering:** 216labs already operates [Bird Perch](https://birdperch.6cubed.app) with `google/bird-vocalization-classifier` (TensorFlow 2, Kaggle Models v4).
- **Research gap:** Product name “Perch” overloads two artifacts: (1) Kaggle **bird-only** classifier, (2) DeepMind **Perch 2.0** multi-taxa model via `perch-hoplite`.

## 2. Research questions

1. **RQ1:** Does the **bird vocalization classifier** assign non-trivial probability to any mink/mustelid-related label when fed known mink audio?
2. **RQ2:** Does **Perch 2.0** (`perch_v2`) surface mink, mustelid, or *Neogale* in top-*k* logits OOTB?
3. **RQ3:** Are **embeddings** from Perch 2.0 separable for mink vs. confounders (water, birds, mustelid-absent riparian audio) with a linear probe on *n* labeled clips?

We treat RQ3 as optional in v1 of this study (requires labeled set).

## 3. Models under test

| Model | Artifact | Training focus | Our deployment |
|-------|----------|----------------|----------------|
| Bird vocalization classifier v4 | `google/bird-vocalization-classifier` (Kaggle TF2) | Avian vocalizations | Bird Perch production |
| Perch 2.0 | `perch_v2` via `perch-hoplite` | Multi-taxa (birds, mammals, frogs, insects, …) | Not in production yet |

**Input contract (both):** ~5 s mono waveform; Perch 2.0 expects **32 kHz**; bird classifier uses **16 kHz / 160000 samples** in our integration.

## 4. Methods

### 4.1 Audio corpus

Collect **positive** clips: mink vocalizations (screams, chuckles, kit calls) from ethical public archives or licensed field work. Target ≥10 clips, ≥3 s each, variable SNR.

**Negative** controls: riparian ambience without mink; common bird species in overlap habitats; optional American otter / other mustelids if available.

Document provenance in the Colab notebook (URL, license, date).

### 4.2 OOTB protocol

For each clip:

1. Resample to model-native rate.
2. Run full forward pass; record top-20 logits with human-readable labels.
3. **Lexical scan:** flag labels matching `mink`, `mustel`, `neogale`, `vison`, `weasel`, `marten` (case-insensitive).
4. **Decision rule (OOTB success):** any flagged label in top-5 with softmax ≥ 0.2, on ≥70% of positive clips.

### 4.3 Reproducibility

All steps live in `research_test.ipynb` (Colab GPU). Hyperparameters and package versions pinned in notebook outputs.

## 5. Expected results (hypothesis)

- **RQ1:** **Fail** for true mink ID — label space is avian; top hits likely misclassified birds or high-entropy garbage.
- **RQ2:** **Uncertain** — Perch 2.0 includes mammals but mink may be absent or rare in training; top logits may be generic “mammal” or wrong species.
- **RQ3:** **Promising** if OOTB logits fail but embedding k-NN clusters mink clips (consistent with Perch agile-modeling claims).

## 6. Discussion

If OOTB fails, recommended path for 216labs:

1. **Agile modeling** (Perch embed + human-in-the-loop labels) per Google’s bioacoustics workflow.
2. **Fine-tune** linear head on mink vs. negative set (<1 h GPU on small corpus).
3. **Product:** optional “Mink Perch” mode in Bird Perch stack or separate manifest app.

## 7. Conclusion

*(To be completed after notebook run.)*

## Appendix A — Notebook

`research_test.ipynb` in this directory.

## Appendix B — 216labs Bird Perch code path

`products/org-platform/ai/bird-perch/app/model_runner.py` — Kaggle download, softmax over avian logits.
