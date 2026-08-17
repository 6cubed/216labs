# Detecting mink from audio vocalizations

**Research question:** Can we use the **Perch** family of bioacoustic models **out of the box** to detect **American mink** (*Neogale vison*) from field audio?

## Status

| Phase | State |
|-------|--------|
| Hypothesis & protocol | Draft in `paper_draft.md` |
| Repro notebook | `research_test.ipynb` (run in Colab) |
| Verdict | **Pending** — run notebook on GPU with real mink clips |

## Run the experiment (Colab)

[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/6cubed/216labs/blob/main/research/detecting_mink_from_audio_vocalizations/research_test.ipynb)

**You will need:**

- Colab **GPU** runtime (required for Perch 2.0 / perch-hoplite)
- **Kaggle API** credentials (`KAGGLE_USERNAME`, `KAGGLE_KEY`) for model download
- One or more **mink vocalization** WAV/MP3 clips (upload in notebook) — see paper draft for sourcing notes

## Files

- `research_test.ipynb` — compares (A) Bird Perch production model and (B) Perch 2.0 logits/embeddings; scans label space for mink/mustelid/neogale
- `paper_draft.md` — working paper
- `citations.bib` — references

## Early expectation (before full run)

- **Bird vocalization classifier (Kaggle v4):** Avian label space (~eBird codes). **Unlikely** to emit a mink class OOTB; useful as a negative control.
- **Perch 2.0:** Multi-taxa (includes some mammals) but **not a dedicated mink detector**. OOTB logits may be uncalibrated for rare mustelids; **agile modeling** (embed + few-shot labels) is the documented path if OOTB fails.

## Paid detection pilots

If you already have labelled field audio and a detection question, 216Labs sells time-boxed pilots: [CARFAC pilots](../../docs/carfac-pilots/) · [open a paid-pilot issue](https://github.com/6cubed/216labs/issues/new?template=paid-pilot.yml).
