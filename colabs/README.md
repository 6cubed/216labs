# Colabs — standalone experiments

Check in **Google Colab** notebooks for short, standalone experiments here.

This is **not** the paper track. Formal research topics (draft + bib + repro notebook) live under [`research/`](../research/).

## Layout

One folder per experiment:

```text
colabs/<experiment-id>/
  README.md          # one-screen: question, status, Colab badge
  experiment.ipynb   # the notebook (any clear name is fine)
```

Use a short kebab-case id (`mink-embed-probe`, `story-prompt-ab`).

Scaffold:

```bash
./scripts/new-colab.sh my-experiment "One-line question?"
```

## Open in Colab

```text
https://colab.research.google.com/github/6cubed/216labs/blob/main/colabs/<experiment-id>/<notebook>.ipynb
```

Badge:

```markdown
[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/6cubed/216labs/blob/main/colabs/<experiment-id>/<notebook>.ipynb)
```

## Index

| Folder | Question |
|--------|----------|
| [`carfac-vs-mel/`](carfac-vs-mel/) | What do CARFAC NAP and a mel spectrogram look like on the same clip? |
| [`_example/`](_example/) | Template — copy and rename |

## Tips

- Prefer self-contained notebooks (pip installs in the first cells).
- Do not commit secrets, API keys, or large datasets — link or download in-notebook.
- If an experiment graduates to a paper thread, move or mirror it under `research/<topic>/` with the standard layout there.
