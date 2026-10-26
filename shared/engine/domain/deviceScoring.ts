import type { WearableMetric } from './types';

/**
 * How each wearable vendor computes the scores Aura reads. Vendors measure differently: the same
 * "60" can mean "fair" on one device and "poor" on another, Apple reports HRV as SDNN while the
 * others use RMSSD, and Fitbit's stress score runs the opposite way to Garmin's. Aura uses this to:
 *   1. read each score in its own direction,
 *   2. pick a sensible default "low" cut-off per device (until the person sets their own),
 *   3. never mix readings from different devices into one baseline,
 *   4. explain to the user what their device's number means.
 *
 * Facts below come from vendor documentation where noted; `verified: false` marks bands that
 * vendors don't publish and that come from secondary sources or are unknown.
 */

export interface ScoreBand {
  min: number;
  max: number;
  label: string;
}

export interface DeviceMetricInfo {
  metric: WearableMetric;
  vendorName: string;
  range: string;
  /** Which way is better for the person. */
  higherIs: 'better' | 'worse' | 'neither';
  bands?: ScoreBand[];
  verified: boolean;
  inputs: string[];
  measuredWhen: string;
  /** Default cut-off Aura uses for a "low" day with this device (below = low). */
  lowBelow?: number;
  /** How Aura uses the value. */
  howUsed: string;
}

export interface DeviceInfo {
  id: string;
  name: string;
  hrv: { type: 'RMSSD' | 'SDNN' | 'unknown'; window: string };
  personalBaseline: string;
  metrics: DeviceMetricInfo[];
  sources: { label: string; url: string }[];
  reviewedOn: string;
}

export const DEVICES: DeviceInfo[] = [
  {
    id: 'oura',
    name: 'Oura Ring',
    hrv: { type: 'RMSSD', window: 'Average across the night (Oura shows this as average HRV during sleep)' },
    personalBaseline: 'Scores compare each night with your own averages; Oura needs about 2 weeks to learn them.',
    metrics: [
      {
        metric: 'sleepScore',
        vendorName: 'Sleep Score',
        range: '0–100',
        higherIs: 'better',
        bands: [
          { min: 85, max: 100, label: 'Optimal' },
          { min: 70, max: 84, label: 'Good' },
          { min: 60, max: 69, label: 'Fair' },
          { min: 0, max: 59, label: 'Pay attention' },
        ],
        verified: true,
        inputs: ['Total sleep', 'Efficiency', 'Restfulness', 'REM sleep', 'Deep sleep', 'Latency', 'Timing'],
        measuredWhen: 'Each night',
        lowBelow: 70,
        howUsed: 'A night below your cut-off (default 70, Oura\'s "Good" floor) counts as a low-sleep-score day.',
      },
      {
        metric: 'readinessScore',
        vendorName: 'Readiness Score',
        range: '0–100',
        higherIs: 'better',
        bands: [
          { min: 85, max: 100, label: 'Optimal' },
          { min: 70, max: 84, label: 'Good' },
          { min: 60, max: 69, label: 'Fair' },
          { min: 0, max: 59, label: 'Pay attention' },
        ],
        verified: true,
        inputs: ['Resting heart rate', 'HRV balance', 'Body temperature', 'Recovery index', 'Sleep', 'Sleep balance', 'Previous-day activity', 'Activity balance'],
        measuredWhen: 'Each morning, from the night before and recent days',
        lowBelow: 70,
        howUsed: 'Below your cut-off (default 70) counts as a low-readiness day.',
      },
      { metric: 'hrvRmssd', vendorName: 'Average HRV', range: 'ms', higherIs: 'better', verified: true, inputs: ['Beat-to-beat intervals'], measuredWhen: 'During sleep', howUsed: 'Compared only with your own Oura baseline.' },
      { metric: 'skinTempDeviation', vendorName: 'Temperature deviation', range: '°C from your baseline', higherIs: 'neither', verified: true, inputs: ['Finger skin temperature'], measuredWhen: 'During sleep', howUsed: 'Shown in trends; rises can accompany illness or the luteal phase.' },
    ],
    sources: [
      { label: 'Oura: Readiness Score', url: 'https://support.ouraring.com/hc/en-us/articles/360025589793' },
      { label: 'Oura: Sleep Score', url: 'https://support.ouraring.com/hc/en-us/articles/360057791533' },
    ],
    reviewedOn: '2026-10-26',
  },
  {
    id: 'fitbit',
    name: 'Fitbit / Pixel Watch',
    hrv: { type: 'RMSSD', window: 'During the longest sleep period' },
    personalBaseline: 'Daily Readiness and Stress Management compare with your recent history.',
    metrics: [
      {
        metric: 'sleepScore',
        vendorName: 'Sleep Score',
        range: '0–100',
        higherIs: 'better',
        verified: false,
        inputs: ['Duration', 'Quality (deep and REM sleep)', 'Restoration (sleeping heart rate, restlessness)'],
        measuredWhen: 'Each night',
        lowBelow: 70,
        howUsed: 'Fitbit doesn\'t publish fixed bands; Aura uses 70 until you set your own cut-off.',
      },
      {
        metric: 'readinessScore',
        vendorName: 'Daily Readiness Score (Premium)',
        range: '1–100',
        higherIs: 'better',
        bands: [
          { min: 30, max: 100, label: 'Ready to exercise' },
          { min: 1, max: 29, label: 'Prioritise recovery' },
        ],
        verified: true,
        inputs: ['Heart rate variability', 'Sleep', 'Recent activity'],
        measuredWhen: 'Each morning',
        lowBelow: 30,
        howUsed: 'Below 30 (Fitbit\'s "prioritise recovery") counts as a low-readiness day, unless you set your own cut-off.',
      },
      {
        metric: 'stressManagementScore',
        vendorName: 'Stress Management Score',
        range: '1–100',
        higherIs: 'better',
        verified: true,
        inputs: ['Responsiveness (EDA, heart rate, HRV)', 'Exertion balance', 'Sleep patterns'],
        measuredWhen: 'Each day',
        lowBelow: 60,
        howUsed: 'Higher means FEWER signs of stress. A score under 60 counts as a stressful day when you haven\'t rated stress yourself.',
      },
    ],
    sources: [
      { label: 'Fitbit: Stress Management Score', url: 'https://support.google.com/fitbit/answer/14237928' },
      { label: 'Fitbit: Daily Readiness Score', url: 'https://support.google.com/fitbit/answer/14236710' },
    ],
    reviewedOn: '2026-10-26',
  },
  {
    id: 'garmin',
    name: 'Garmin',
    hrv: { type: 'RMSSD', window: 'Overnight (HRV Status); also used through the day for stress and Body Battery' },
    personalBaseline: 'HRV Status compares with your own 3-week baseline.',
    metrics: [
      {
        metric: 'sleepScore',
        vendorName: 'Sleep Score',
        range: '0–100',
        higherIs: 'better',
        verified: false,
        inputs: ['Duration', 'Sleep stages', 'Stress during sleep', 'Restlessness'],
        measuredWhen: 'Each night',
        lowBelow: 70,
        howUsed: 'Garmin\'s bands weren\'t confirmed; Aura uses 70 until you set your own cut-off.',
      },
      {
        metric: 'readinessScore',
        vendorName: 'Training Readiness',
        range: '1–100',
        higherIs: 'better',
        bands: [
          { min: 95, max: 100, label: 'Prime' },
          { min: 75, max: 94, label: 'High' },
          { min: 50, max: 74, label: 'Moderate' },
          { min: 25, max: 49, label: 'Low' },
          { min: 1, max: 24, label: 'Poor' },
        ],
        verified: true,
        inputs: ['Sleep score', 'Recovery time', 'HRV status', 'Acute load', 'Sleep history (3 nights)', 'Stress history (3 days)'],
        measuredWhen: 'Each morning, updated through the day',
        lowBelow: 50,
        howUsed: 'Below 50 (Garmin\'s "Low" and "Poor") counts as a low-readiness day.',
      },
      {
        metric: 'stressLevel',
        vendorName: 'Stress level',
        range: '0–100',
        higherIs: 'worse',
        bands: [
          { min: 76, max: 100, label: 'High' },
          { min: 51, max: 75, label: 'Medium' },
          { min: 26, max: 50, label: 'Low' },
          { min: 0, max: 25, label: 'Rest' },
        ],
        verified: false,
        inputs: ['Heart rate variability'],
        measuredWhen: 'Through the day; Aura uses the daily average',
        lowBelow: undefined,
        howUsed: 'Higher means MORE stress. A daily average of 76+ counts as a stressful day when you haven\'t rated stress yourself.',
      },
    ],
    sources: [
      { label: 'Garmin manual: Training Readiness', url: 'https://www8.garmin.com/manuals/webhelp/GUID-31D23DBB-57C2-4DF7-A0C9-8D1A00AB4BE7/EN-US/GUID-C21BE0C8-A08E-4DA1-B6C6-2E0E2DDDB372.html' },
      { label: 'Garmin manual: stress score', url: 'https://www8.garmin.com/manuals/webhelp/forerunner735/EN-US/GUID-84D76CAF-F080-40BA-A7F4-C1C82185E71B.html' },
    ],
    reviewedOn: '2026-10-26',
  },
  {
    id: 'whoop',
    name: 'WHOOP',
    hrv: { type: 'RMSSD', window: 'During sleep, weighted to the last slow-wave sleep period' },
    personalBaseline: 'Recovery compares HRV and resting heart rate with your recent baseline.',
    metrics: [
      {
        metric: 'readinessScore',
        vendorName: 'Recovery',
        range: '0–100%',
        higherIs: 'better',
        bands: [
          { min: 67, max: 100, label: 'Green' },
          { min: 34, max: 66, label: 'Yellow' },
          { min: 0, max: 33, label: 'Red' },
        ],
        verified: false,
        inputs: ['HRV (most weight)', 'Resting heart rate', 'Respiratory rate', 'Sleep performance', 'SpO₂ and skin temperature (newer bands)'],
        measuredWhen: 'Each morning, from sleep',
        lowBelow: 34,
        howUsed: 'Red recovery (under 34) counts as a low-readiness day.',
      },
    ],
    sources: [{ label: 'Sleep Foundation: WHOOP review', url: 'https://www.sleepfoundation.org/best-sleep-trackers/whoop-band-review' }],
    reviewedOn: '2026-10-26',
  },
  {
    id: 'apple',
    name: 'Apple Watch',
    hrv: { type: 'SDNN', window: 'Short readings taken periodically through the day and night — not comparable with RMSSD devices' },
    personalBaseline: 'Sleep Score compares each night with your own history.',
    metrics: [
      {
        metric: 'sleepScore',
        vendorName: 'Sleep Score (watchOS 26.2+)',
        range: '0–100',
        higherIs: 'better',
        bands: [
          { min: 96, max: 100, label: 'Very high' },
          { min: 81, max: 95, label: 'High' },
          { min: 61, max: 80, label: 'OK' },
          { min: 41, max: 60, label: 'Low' },
          { min: 0, max: 40, label: 'Very low' },
        ],
        verified: true,
        inputs: ['Duration (up to 50 points)', 'Bedtime consistency (up to 30)', 'Interruptions (up to 20)'],
        measuredWhen: 'Each night',
        lowBelow: 61,
        howUsed: 'Below 61 (Apple\'s "Low" and "Very low") counts as a low-sleep-score day. Bands were tightened in watchOS 26.2.',
      },
      { metric: 'hrvSdnn', vendorName: 'Heart rate variability (SDNN)', range: 'ms', higherIs: 'better', verified: true, inputs: ['Beat-to-beat intervals'], measuredWhen: 'Periodic spot readings', howUsed: 'Kept separate from RMSSD and compared only with your own Apple Watch readings.' },
    ],
    sources: [
      { label: 'AppleInsider: How Sleep Score works', url: 'https://appleinsider.com/articles/25/09/12/how-sleep-score-works-on-apple-watch-with-watchos-26' },
      { label: '9to5Mac: watchOS 26.2 sleep score changes', url: 'https://9to5mac.com/2025/11/04/watchos-26-2-sleep-score-changes-apple-watch/' },
    ],
    reviewedOn: '2026-10-26',
  },
  {
    id: 'polar',
    name: 'Polar',
    hrv: { type: 'RMSSD', window: 'About the first 4 hours of sleep (Nightly Recharge)' },
    personalBaseline: 'ANS charge compares with your 28-day baseline.',
    metrics: [
      { metric: 'hrvRmssd', vendorName: 'Nightly Recharge HRV', range: 'ms', higherIs: 'better', verified: true, inputs: ['Heart rate', 'HRV', 'Breathing rate'], measuredWhen: 'First hours of sleep', howUsed: 'Compared only with your own Polar baseline.' },
    ],
    sources: [{ label: 'Polar: Nightly Recharge', url: 'https://support.polar.com/en/nightly-recharge-recovery-measurement' }],
    reviewedOn: '2026-10-26',
  },
];

export const deviceById = (id: string | undefined): DeviceInfo | undefined =>
  id ? DEVICES.find((d) => d.id === id.toLowerCase() || id.toLowerCase().startsWith(d.id)) : undefined;

export function deviceMetric(source: string | undefined, metric: WearableMetric): DeviceMetricInfo | undefined {
  return deviceById(source)?.metrics.find((m) => m.metric === metric);
}

/** The vendor's own label for a value, e.g. Oura sleep score 64 → "Fair". */
export function bandLabel(source: string | undefined, metric: WearableMetric, value: number): string | undefined {
  return deviceMetric(source, metric)?.bands?.find((b) => value >= b.min && value <= b.max)?.label;
}
