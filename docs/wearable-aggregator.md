# Wearable aggregator decision (locked)

**Default:** native HealthKit / Health Connect first (`WEARABLE_AGGREGATOR` unset → `native`).

**When ready for Garmin/WHOOP depth:** set `WEARABLE_AGGREGATOR=terra` (preferred) or `vital` / `spike`, plus the matching API key. Do not build four native OAuth stacks in parallel.

Status endpoint concept: `WearableAggregatorAdapter.status()` used by recovery today providers payload.
