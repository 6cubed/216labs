# CARFAC SAI on underwater audio

**Question:** What does a **stabilized auditory image (SAI)** look like on hydrophone recordings, and does it carry orca-call detection signal that a mel spectrogram does not?

**Status:** visual demo + small grouped-CV linear probe

Third in the CARFAC line: [`carfac-vs-mel/`](../carfac-vs-mel/) put the NAP next to mel on ordinary audio, [`carfac-sai-drone/`](../carfac-sai-drone/) added the SAI on voice buried in rotor noise. This one goes underwater and asks a **detection** question. Same lag conventions as the drone notebook.

## Run

[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/6cubed/216labs/blob/main/colabs/carfac-sai-underwater/experiment.ipynb)

CPU is fine. Needs **Python ≥ 3.11** (Colab default is fine). Sections 1–3 take ~2 minutes; section 4's probe is **~10–20 minutes** at `N_PER_CLASS = 24` and is tunable down.

## Audio

[Orcasound](https://www.orcasound.net/) **Pod.Cast** labelled test set — 21 WAV files (~61 s, mono, 20 kHz) from the Orcasound Lab hydrophone on 27 Sep 2017, with a TSV of Southern Resident killer whale call intervals. Downloaded in-notebook from AWS Open Data (`s3://acoustic-sandbox`, ~95 MB, **no credentials**). Windows are the 2.45 s Pod.Cast decision window: positive = centred on a labelled call, negative = misses every call by ≥ 0.5 s. That yields 101 call and 372 background windows.

## Result (one run, `N_PER_CLASS = 24`, 3 grouped folds)

| Frontend | Image | ROC-AUC |
|----------|-------|---------|
| log-mel | frequency × time | **0.98 ± 0.03** |
| CARFAC NAP | channel × time | 0.94 ± 0.08 |
| CARFAC SAI, mean over window | channel × lag | 0.69 ± 0.24 |
| CARFAC SAI, lag × time | lag × time | 0.82 ± 0.10 |

Read-out is a logistic regression on 32×32 mean-pooled images, cross-validated **grouped by source WAV** so no model is tested on a recording it trained on. Tens of windows from one day at one hydrophone — a signal check, not a benchmark.

## Paid pilots

216Labs takes this as **labelled-audio detection work** (hydrophone PAM, drone, bird). Offer: [CARFAC pilots](../../docs/CARFAC-PILOTS.md). Start: [6cubed.app/#work](https://6cubed.app/#work). Runnable: [Open in Colab](https://colab.research.google.com/github/6cubed/216labs/blob/main/colabs/carfac-sai-underwater/experiment.ipynb).

## Notes

- **Time averaging is what costs the SAI.** A 2.45 s window contains a call lasting a fraction of a second; collapsing 122 SAI frames into one image discards the temporal envelope that makes it detectable. Marginalising over *channels* instead — keeping lag × time — recovers most of the gap, and the call's periodicity is plainly visible in that view while background ringing stays flat.
- **A time-averaged SAI is not an eyeball-friendly spectrogram.** Both classes are dominated by the bright ridge at lag 0 and its fan of rings, which is largely the filterbank's own impulse response. Class structure shows up frame by frame, in lag × time, or in the class-mean difference image.
- **Tuned for water:** 150 Hz high-pass plus `min_pole_hz = 200`. CARFAC's stock human cochlea spends channels below 200 Hz on ship rumble and flow noise, which is loud enough to dominate the AGC and wash out the SAI. SRKW calls sit at ~0.5–10 kHz, so nothing of interest is lost.
- **Windows are RMS-normalised**, so loudness cannot carry the classification. This is not free — CARFAC's AGC is deliberately level-dependent.
- **The SAI's distinctive cue has little to bite on here.** Lag structure pays off on repetitive pulse trains, and echolocation clicks run to 80 kHz — above the 10 kHz Nyquist of these files. High-rate data (MBARI `pacific-sound-256khz`, NOAA's PAM archive on GCS) is the obvious next step, along with `carfac.jax` for throughput: the NumPy CARFAC is a per-sample Python loop and is essentially the entire runtime.
