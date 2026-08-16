# CARFAC SAI on drone search-and-rescue audio

**Question:** What does a **stabilized auditory image (SAI)** add over a mel spectrogram and a CARFAC NAP on drone-recorded speech and distress calls?

**Status:** minimal visual demo (three frontends, four clips)

Follow-on to [`carfac-vs-mel/`](../carfac-vs-mel/) — same two frontends plus the SAI, on audio where the voice is buried in rotor noise.

## Run

[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/6cubed/216labs/blob/main/colabs/carfac-sai-drone/experiment.ipynb)

CPU is fine, ~2 minutes end to end. Needs **Python ≥ 3.11** (Colab default is fine). Installs [google/carfac](https://github.com/google/carfac) (NumPy) + librosa, downloads ~52 MB of sample audio, then plots mel + NAP + SAI for four clips.

## Audio

Samples from [DroneAudioSet](https://huggingface.co/datasets/ahlab-drone-project/DroneAudioSet) (drone-based search and rescue, [arXiv:2510.15383](https://arxiv.org/abs/2510.15383), MIT license), pulled from the authors' [code repo](https://github.com/augmented-human-lab/DroneAudioSet-code) so the notebook does not have to touch the 23.5 h dataset:

| Clip | Source |
|------|--------|
| **speech** (male, t=16 s) | clean playback signal, and the same session off the drone's 8-mic array |
| **distress cry** (t=70 s) | same pair |

Both files run a fixed 152 s script: male speech (0–31 s), female speech (31–62 s), crying (62–92 s), other human sounds (92–122 s), non-human sounds (122–152 s). The drone recording is matched to the clean source by that script, not sample-aligned.

## Paid pilots

Same offer as the underwater notebook: labelled-audio detection on **your** files. [CARFAC pilots](../../docs/CARFAC-PILOTS.md) · [paid-pilot issue](https://github.com/6cubed/216labs/issues/new?template=paid-pilot.yml) · [hire](https://6cubed.app/#work).

## Notes

- The SAI is a trigger-aligned running autocorrelation of the NAP: cochlear channel × **lag**, one frame per ~46 ms. Voiced sound shows a comb of vertical ridges at its pitch period and multiples.
- Frames are flipped so **lag increases to the right**, with the trigger (zero lag) marked; `SAI_FUTURE_LAGS` controls how much sits to the right of it.
- The loudest-frame picker skips the first `SAI_WARMUP_S` — CARFAC's AGC has a large settling transient, and without the skip every drone clip selects frame 0.
- Drone clips are recorded at SNRs well below 0 dB, so the ridges you see there are largely rotor periodicity, not the voice. That is the point of the comparison, not a failure of the frontend.
