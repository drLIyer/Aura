/**
 * Turns a wearable app's CSV export into daily samples. Column names differ by vendor
 * (Oura: "Average Resting Heart Rate", Whoop: "Resting heart rate (bpm)", Fitbit: "Resting Heart Rate"),
 * so columns are matched by keywords, and units are read from the header or inferred.
 */
export type CsvMetric = "restingHeartRate" | "hrvRmssd" | "hrvSdnn" | "sleepMinutes" | "sleepScore" | "readinessScore" | "steps" | "spo2" | "skinTempDeviation";

export interface CsvSample {
  date: string;
  metric: CsvMetric;
  value: number;
}

export interface CsvParseResult {
  samples: CsvSample[];
  columns: { header: string; metric: CsvMetric }[];
  dateColumn: string | null;
  skippedRows: number;
}

function splitLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else quoted = !quoted;
    } else if ((c === "," || c === ";" || c === "\t") && !quoted) {
      out.push(cur.trim());
      cur = "";
    } else cur += c;
  }
  out.push(cur.trim());
  return out;
}

const norm = (h: string) => h.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();

export function metricForHeader(header: string): CsvMetric | null {
  const h = norm(header);
  if (/resting/.test(h) && /(heart|hr\b|pulse)/.test(h)) return "restingHeartRate";
  if (/(sdnn)/.test(h)) return "hrvSdnn";
  if (/(hrv|heart rate variability|rmssd)/.test(h)) return "hrvRmssd";
  if (/readiness|recovery score|body battery/.test(h)) return "readinessScore";
  if (/sleep score/.test(h)) return "sleepScore";
  if (/sleep/.test(h) && /(duration|asleep|total|minutes|hours|time)/.test(h) && !/(awake|latency|in bed|deep|rem|light|efficiency|onset)/.test(h)) return "sleepMinutes";
  if (/^steps$|step count|total steps/.test(h)) return "steps";
  if (/spo2|oxygen/.test(h)) return "spo2";
  if (/temperature/.test(h) && /(deviation|delta|trend)/.test(h)) return "skinTempDeviation";
  return null;
}

/** Converts a sleep value to minutes using the header's unit, or its size when none is given. */
function sleepMinutes(header: string, value: number): number {
  const h = norm(header);
  if (/second|\(s\)/.test(h)) return value / 60;
  if (/hour|\(h\)|hrs/.test(h)) return value * 60;
  if (/minute|\(min\)|mins/.test(h)) return value;
  if (value > 2000) return value / 60; // seconds
  if (value <= 24) return value * 60; // hours
  return value;
}

/** Accepts YYYY-MM-DD, ISO timestamps, MM/DD/YYYY and DD.MM.YYYY. Returns the calendar date written in the file. */
export function parseCsvDate(value: string): string | null {
  const v = value.trim().replace(/^"|"$/g, "");
  let m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  m = v.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}

export function parseWearableCsv(text: string): CsvParseResult {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { samples: [], columns: [], dateColumn: null, skippedRows: 0 };
  const headers = splitLine(lines[0]);
  const dateIdx = headers.findIndex((h) => /^(date|day|summary date|calendar date)$/i.test(norm(h)) || /(cycle start|start time|sleep onset|date)/.test(norm(h)));
  const columns = headers
    .map((header, i) => ({ header, i, metric: metricForHeader(header) }))
    .filter((c): c is { header: string; i: number; metric: CsvMetric } => c.metric !== null && c.i !== dateIdx);
  // One column per metric: the first match wins.
  const seen = new Set<CsvMetric>();
  const used = columns.filter((c) => (seen.has(c.metric) ? false : (seen.add(c.metric), true)));

  const samples: CsvSample[] = [];
  let skipped = 0;
  for (const line of lines.slice(1)) {
    const cells = splitLine(line);
    const date = dateIdx >= 0 ? parseCsvDate(cells[dateIdx] ?? "") : null;
    if (!date) {
      skipped++;
      continue;
    }
    for (const c of used) {
      const raw = (cells[c.i] ?? "").replace(/,/g, "");
      if (raw === "") continue;
      let value = Number(raw);
      if (!Number.isFinite(value)) continue;
      if (c.metric === "sleepMinutes") value = Math.round(sleepMinutes(c.header, value));
      samples.push({ date, metric: c.metric, value });
    }
  }
  return { samples, columns: used.map(({ header, metric }) => ({ header, metric })), dateColumn: dateIdx >= 0 ? headers[dateIdx] : null, skippedRows: skipped };
}
