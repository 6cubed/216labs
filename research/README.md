# Research (216labs)

Each subdirectory is a **potential paper** or formal research thread. Every topic uses the same file layout so work can move from experiment → draft → publication without reinventing structure.

For **standalone Colab experiments** (no paper draft required), use [`colabs/`](../colabs/) instead.

Funded teams with labelled audio (hydrophone, drone, bird/mink): [CARFAC pilots](../docs/CARFAC-PILOTS.md) · [paid-pilot issue](https://github.com/6cubed/216labs/issues/new?template=paid-pilot.yml) (no landing form required).

## Standard layout per topic

| File | Purpose |
|------|---------|
| `research_test.ipynb` | End-to-end **Google Colab** notebook: installs deps, reproduces claims the paper relies on, runs the main hypothesis test |
| `paper_draft.md` | Current best draft (Markdown; export to PDF/DOCX when ready) |
| `citations.bib` | BibTeX sources for the draft |
| `README.md` | One-screen summary, Colab link, status |

## Open in Colab

Replace `TOPIC` with the folder name:

```text
https://colab.research.google.com/github/6cubed/216labs/blob/main/research/TOPIC/research_test.ipynb
```

## Active topics

| Folder | Question |
|--------|----------|
| [`detecting_mink_from_audio_vocalizations/`](detecting_mink_from_audio_vocalizations/) | Can **Perch** / the Bird Perch classifier detect **American mink** vocalizations out of the box? |

## Relation to production apps

- [`products/org-platform/ai/bird-perch/`](../products/org-platform/ai/bird-perch/) ships **google/bird-vocalization-classifier** (Kaggle TF2 v4), not Perch 2.0. Research here compares both where relevant.
