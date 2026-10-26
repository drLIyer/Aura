# ML pipeline — status and limitations

## What changed

The first version exported features and labels that didn't line up. The "next 24 h" label covered the same calendar day as the features, and old 2016 Fitbit rows were paired with current migraine logs, so every label came out 0.

The export (`server/mlExport.ts`) now works like this:

- **One user per export.** It covers only the signed-in user. It is never written to the server's disk.
- **One row per check-in day D.** Features come from day D or earlier.
- **The label is the next day.** `migraine_onset_next_day` is 1 when an attack *starts* on day D+1. Rows whose label day hasn't finished are left out.
- **Cycle features use the person's own cycle.** `cycle_day` and `cycle_length` come from the person's logged periods. Only periods logged by day D are used, so the label day can't leak in.
- **Exposures come from the app's rules.** These are the same derived exposures the app's trigger analysis uses, such as late lunch, short sleep and low readiness.

## Remaining limitations

- **Small numbers.** One person produces about 30 rows a month, with a handful of positive labels. A per-person model needs months of data. A population model needs many consenting users and a governance process, and neither exists yet.
- **The forecast doesn't use this pipeline yet.** The in-app forecast is the Bayesian trigger model in `shared/engine/cds/riskModel.ts`, which is backtested in the app. Any ML model should be compared against that backtest before it replaces anything.
- **No weather data.** Barometric pressure isn't collected yet.
- **Within-person accuracy is modest.** Published trigger and wearable models reach AUC 0.56–0.65 (see `reports/`), so expect the same here.
