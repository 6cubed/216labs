# CARFAC audio/ML pilots

216Labs sells **labelled-audio detection pilots**, not another wrapper model. The public demos are the three CARFAC Colabs in this repo — start with the [underwater SAI results](https://github.com/6cubed/216labs/blob/main/colabs/carfac-sai-underwater/README.md) (always on GitHub; the blog write-up is the same notebook when that host is warm).

## Who this is for

Funded teams who already record audio and need a detector, not a research tour:

- Marine survey / offshore PAM (hydrophone, orca and other pulsed calls)
- Conservation NGOs with labelled archives
- Counter-drone or search-and-rescue audio
- Biodiversity / bird vocal ID (related: birdperch)

If you do not have labelled audio and a detection question, this is not the product — use [hire the lab](https://6cubed.app/#work) for a general web/AI retainer instead.

## What you get

A time-boxed pilot (typically 2–6 weeks): frontend comparison (mel vs CARFAC NAP/SAI) on **your** files, a grouped-split readout so we are not testing on the recording we trained on, and a written go/no-go on whether the lag-axis SAI is buying anything over the PAM baseline you already run.

## Price

Same band as other 216Labs paid work: **€5–15k** for a pilot, or a monthly retainer if it continues. Quote after we see the labels and the sampling rate.

## Start

Email via [6cubed.app/#work](https://6cubed.app/#work) (kind: audio/ML pilot), or open a [paid-pilot issue](https://github.com/6cubed/216labs/issues/new?template=paid-pilot.yml). One line on the sensor, rate, and whether labels exist is enough.

Proof and notebooks (no account required):

- [CARFAC SAI on underwater audio](https://github.com/6cubed/216labs/tree/main/colabs/carfac-sai-underwater)
- [CARFAC SAI on drone SAR audio](https://github.com/6cubed/216labs/tree/main/colabs/carfac-sai-drone)
- [CARFAC vs mel](https://github.com/6cubed/216labs/tree/main/colabs/carfac-vs-mel)
