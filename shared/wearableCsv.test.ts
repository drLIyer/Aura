import { describe, expect, it } from "vitest";
import { parseCsvDate, parseWearableCsv } from "./wearableCsv";

describe("wearable CSV import", () => {
  it("reads an Oura-style export", () => {
    const csv = 'date,Sleep Score,Readiness Score,Average Resting Heart Rate,Average HRV,Total Sleep Duration\n2026-10-01,78,81,56,44,26100\n2026-10-02,61,58,60,31,19800\n';
    const r = parseWearableCsv(csv);
    expect(r.columns.map((c) => c.metric).sort()).toEqual(["hrvRmssd", "readinessScore", "restingHeartRate", "sleepMinutes", "sleepScore"]);
    const sleep = r.samples.filter((s) => s.metric === "sleepMinutes").map((s) => s.value);
    expect(sleep).toEqual([435, 330]);
  });

  it("reads a Whoop-style export with timestamps and units", () => {
    const csv = 'Cycle start time,Recovery score %,Resting heart rate (bpm),Heart rate variability (ms),Asleep duration (min)\n"2026-10-03 23:10:00",42,61,38,371\n';
    const r = parseWearableCsv(csv);
    expect(r.samples).toContainEqual({ date: "2026-10-03", metric: "readinessScore", value: 42 });
    expect(r.samples).toContainEqual({ date: "2026-10-03", metric: "sleepMinutes", value: 371 });
  });

  it("keeps Garmin stress level and Fitbit stress management score apart", () => {
    const csv = "Date,Avg Stress Level,Stress Management Score\n2026-10-04,62,48\n";
    const r = parseWearableCsv(csv);
    expect(r.samples).toContainEqual({ date: "2026-10-04", metric: "stressLevel", value: 62 });
    expect(r.samples).toContainEqual({ date: "2026-10-04", metric: "stressManagementScore", value: 48 });
  });

  it("parses common date formats without shifting the day", () => {
    expect(parseCsvDate("10/05/2026")).toBe("2026-10-05");
    expect(parseCsvDate("2026-10-05T23:59:00Z")).toBe("2026-10-05");
    expect(parseCsvDate("05.10.2026")).toBe("2026-10-05");
    expect(parseCsvDate("yesterday")).toBeNull();
  });
});
