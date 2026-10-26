import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { DeviceInfo } from "@shared/engine/domain/deviceScoring";

const DIRECTION = { better: "higher is better", worse: "higher means more stress", neither: "no better/worse direction" } as const;

/** Explains how a device computes each score, and how the app reads it. */
export default function DeviceScoringCard({ device, thresholds }: { device: DeviceInfo; thresholds: { sleepScore?: number; readinessScore?: number } }) {
  return (
    <Card className="p-6 space-y-4" data-testid={`device-scoring-${device.id}`}>
      <div>
        <h3 className="text-lg font-semibold">How {device.name} scores</h3>
        <p className="text-sm text-muted-foreground">
          HRV: {device.hrv.type} — {device.hrv.window}. {device.personalBaseline}
        </p>
      </div>
      {device.metrics.map((m) => {
        const own = m.metric === "sleepScore" ? thresholds.sleepScore : m.metric === "readinessScore" ? thresholds.readinessScore : undefined;
        return (
          <div key={m.metric} className="border-t border-border pt-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-sm">{m.vendorName}</span>
              <Badge variant="outline">{m.range}</Badge>
              <Badge variant="outline">{DIRECTION[m.higherIs]}</Badge>
              {!m.verified && <Badge variant="secondary">bands not published by vendor</Badge>}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Built from: {m.inputs.join(", ")}. Measured: {m.measuredWhen.toLowerCase()}.
            </p>
            {m.bands && (
              <div className="flex flex-wrap gap-1 mt-2">
                {m.bands.map((b) => (
                  <span key={b.label} className="text-xs rounded bg-muted px-2 py-0.5">
                    {b.min}–{b.max}: {b.label}
                  </span>
                ))}
              </div>
            )}
            <p className="text-xs mt-2">
              <span className="font-medium">How the app uses it: </span>
              {own !== undefined ? `your own cut-off is below ${own}. ` : ""}
              {m.howUsed}
            </p>
          </div>
        );
      })}
      <p className="text-xs text-muted-foreground">
        Sources:{" "}
        {device.sources.map((s, i) => (
          <span key={s.url}>
            {i > 0 && " · "}
            <a className="underline" href={s.url} target="_blank" rel="noreferrer">
              {s.label}
            </a>
          </span>
        ))}{" "}
        · checked {device.reviewedOn}
      </p>
    </Card>
  );
}
