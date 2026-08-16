# CARFAC vs mel spectrogram

**Question:** What do a **CARFAC** neural activity pattern and a **mel spectrogram** look like on the same short audio clip?

**Status:** minimal visual demo (side-by-side frontends)

## Run

[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/6cubed/216labs/blob/main/colabs/carfac-vs-mel/experiment.ipynb)

CPU is fine. Needs **Python ≥ 3.11** (Colab default is fine). Installs [google/carfac](https://github.com/google/carfac) (NumPy) + librosa, loads a short public sample (or optional upload), then plots waveform + mel + CARFAC NAP.

## Paid pilots

If this frontend comparison is the start of a detection job (hydrophone, drone, bird), 216Labs sells time-boxed pilots: [CARFAC pilots](../../docs/CARFAC-PILOTS.md) · [paid-pilot issue](https://github.com/6cubed/216labs/issues/new?template=paid-pilot.yml) · [6cubed.app/#work](https://6cubed.app/#work).

## Notes

- CARFAC runs at **22.05 kHz** (library default); mel uses the same resampled mono clip.
- This is a **frontend look** comparison, not a claim about which is better for any task.
