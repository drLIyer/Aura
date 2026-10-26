import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Smartphone, Watch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { formatShortDate } from "@/lib/dates";
import { apiJson, invalidateAll } from "@/lib/queryClient";
import { parseWearableCsv, type CsvParseResult } from "@shared/wearableCsv";
import { WEARABLE_METRIC_INFO } from "@shared/engine/cds/patterns";
import { DEVICES, bandLabel, deviceById } from "@shared/engine/domain/deviceScoring";
import DeviceScoringCard from "@/components/DeviceScoringCard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ProfileRecord } from "@/lib/types";

interface Status {
  configured: boolean;
  linked: boolean;
  lastSyncedAt: string | null;
  connections: { provider: string; status: string }[];
}
interface Sample {
  date: string;
  metric: keyof typeof WEARABLE_METRIC_INFO;
  value: number;
  source: string;
}

const NAMES: Record<string, string> = {
  oura: "Oura Ring",
  fitbit: "Fitbit / Pixel Watch",
  garmin: "Garmin",
  whoop: "Whoop",
  polar: "Polar",
  suunto: "Suunto",
  withings: "Withings",
  ultrahuman: "Ultrahuman",
  strava: "Strava",
  google: "Google Health",
};

const SHOWN_METRICS: (keyof typeof WEARABLE_METRIC_INFO)[] = ["sleepMinutes", "sleepScore", "readinessScore", "stressLevel", "stressManagementScore", "restingHeartRate", "hrvRmssd", "hrvSdnn"];

export default function Wearables({ date }: { date: string }) {
  const { toast } = useToast();
  const { data: status } = useQuery<Status>({ queryKey: ["/api/wearables/status"] });
  const { data: providers = [] } = useQuery<string[]>({ queryKey: ["/api/wearables/providers"] });
  const { data: samples = [] } = useQuery<Sample[]>({ queryKey: [`/api/wearables/samples?date=${date}&days=14`] });
  const { data: allSamples = [] } = useQuery<Sample[]>({ queryKey: [`/api/wearables/samples?date=${date}&days=120`] });
  const { data: profile } = useQuery<ProfileRecord>({ queryKey: ["/api/profile"] });
  const [parsed, setParsed] = useState<(CsvParseResult & { source: string }) | null>(null);
  const [csvDevice, setCsvDevice] = useState("oura");

  const onError = (e: Error) => toast({ title: "Something went wrong", description: e.message, variant: "destructive" });
  const connect = useMutation({
    mutationFn: (provider: string) => apiJson<{ url: string }>("/api/wearables/connect", "POST", { provider }),
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
    onError,
  });
  const sync = useMutation({
    mutationFn: () => apiJson<{ samples: number }>("/api/wearables/sync", "POST"),
    onSuccess: (r) => {
      invalidateAll();
      toast({ title: `Synced ${r.samples} readings` });
    },
    onError,
  });
  const importCsv = useMutation({
    mutationFn: (p: NonNullable<typeof parsed>) => apiJson<{ samples: number }>("/api/wearables/import", "POST", { source: p.source, samples: p.samples }),
    onSuccess: (r) => {
      setParsed(null);
      invalidateAll();
      toast({ title: `Imported ${r.samples} readings` });
    },
    onError,
  });

  const onFile = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = parseWearableCsv(String(reader.result));
      if (!result.samples.length) toast({ title: "No readings found", description: "Couldn't find a date column and any sleep, heart rate, HRV, readiness or step columns.", variant: "destructive" });
      // The source is the device, so its scores are read on that device's scale.
      setParsed({ ...result, source: csvDevice === "other" ? `csv:${file.name.replace(/\.[^.]+$/, "").slice(0, 40)}` : csvDevice });
    };
    reader.readAsText(file);
  };

  const sourceIds = new Set([...allSamples.map((s) => s.source), ...(status?.connections ?? []).map((c) => c.provider)]);
  const myDevices = DEVICES.filter((d) => [...sourceIds].some((id) => deviceById(id)?.id === d.id));
  const sourceByMetric = new Map(samples.map((s) => [s.metric, s.source]));
  const connected = new Set((status?.connections ?? []).filter((c) => c.status === "active").map((c) => c.provider));
  const byDate = new Map<string, Partial<Record<string, number>>>();
  for (const s of samples) byDate.set(s.date, { ...byDate.get(s.date), [s.metric]: s.value });
  const dates = [...byDate.keys()].sort().reverse();
  const columns = SHOWN_METRICS.filter((m) => samples.some((s) => s.metric === m));

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold">Wearables</h1>
        <p className="text-muted-foreground mt-1">Sleep, readiness, resting heart rate and HRV feed your forecast and show what changes before your attacks.</p>
      </div>

      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Connect a device</h2>
          {status?.linked && (
            <Button size="sm" variant="outline" onClick={() => sync.mutate()} disabled={sync.isPending} data-testid="button-sync-wearables">
              Sync now
            </Button>
          )}
        </div>
        {status && !status.configured ? (
          <p className="text-sm text-muted-foreground" data-testid="text-gateway-not-configured">
            Device connections need the Open Wearables gateway, which isn't set up on this server yet (set OPEN_WEARABLES_URL and OPEN_WEARABLES_API_KEY).
            Meanwhile, import a CSV export below.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {providers.map((p) => (
                <Button key={p} variant={connected.has(p) ? "default" : "outline"} className="h-auto py-3" onClick={() => connect.mutate(p)} disabled={connect.isPending} data-testid={`button-connect-${p}`}>
                  <Watch className="w-4 h-4 mr-2" />
                  {NAMES[p] ?? p}
                  {connected.has(p) && " ✓"}
                </Button>
              ))}
            </div>
            {status?.lastSyncedAt && <p className="text-xs text-muted-foreground">Last synced {new Date(status.lastSyncedAt).toLocaleString()}</p>}
            <p className="text-xs text-muted-foreground">You sign in with the device maker directly. The app never sees your device password.</p>
          </>
        )}
      </Card>

      <Card className="p-6">
        <div className="flex items-start gap-3">
          <Smartphone className="w-5 h-5 mt-1 text-primary" />
          <div className="text-sm space-y-2">
            <h2 className="text-lg font-semibold">Apple Watch</h2>
            <p className="text-muted-foreground">
              Apple Health data stays on the iPhone and has no web connection, so a web app can't read it directly. Two ways to bring it in:
            </p>
            <ul className="list-disc pl-5 text-muted-foreground">
              <li>An iPhone companion app using the Open Wearables iOS SDK syncs Apple Health automatically (planned).</li>
              <li>Today: use an app such as Health Auto Export to save daily resting heart rate, HRV and sleep as CSV, then import it below.</li>
            </ul>
          </div>
        </div>
      </Card>

      <Card className="p-6 space-y-3">
        <h2 className="text-lg font-semibold">Import a CSV</h2>
        <p className="text-sm text-muted-foreground">Works with daily exports from Oura, Whoop, Fitbit, Garmin and others: a date column plus any of sleep, sleep score, readiness, resting heart rate, HRV, SpO₂ or steps.</p>
        <div className="flex flex-wrap items-center gap-3">
          <Select value={csvDevice} onValueChange={setCsvDevice}>
            <SelectTrigger className="w-56" aria-label="Which device is this export from?">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DEVICES.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
              <SelectItem value="other">Other device</SelectItem>
            </SelectContent>
          </Select>
          <input type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0])} aria-label="Choose CSV file" data-testid="input-wearable-csv" />
        </div>
        <p className="text-xs text-muted-foreground">Choosing the device matters: each vendor scores sleep, readiness and stress differently.</p>
        {parsed && parsed.samples.length > 0 && (
          <div className="rounded-md bg-muted p-3 text-sm space-y-2">
            <p>
              Found {parsed.samples.length} readings from {new Set(parsed.samples.map((s) => s.date)).size} days using columns:{" "}
              {parsed.columns.map((c) => `${c.header} → ${WEARABLE_METRIC_INFO[c.metric].label}`).join("; ")}.
              {parsed.skippedRows > 0 && ` ${parsed.skippedRows} rows without a readable date were skipped.`}
            </p>
            <Button size="sm" onClick={() => importCsv.mutate(parsed)} disabled={importCsv.isPending} data-testid="button-import-wearable-csv">
              Import
            </Button>
          </div>
        )}
      </Card>

      {myDevices.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">How your devices measure and score</h2>
          {myDevices.map((d) => (
            <DeviceScoringCard key={d.id} device={d} thresholds={{ sleepScore: profile?.patterns.thresholds?.sleepScoreBelow, readinessScore: profile?.patterns.thresholds?.readinessBelow }} />
          ))}
        </div>
      )}

      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-3">Last 14 days</h2>
        {dates.length === 0 ? (
          <p className="text-sm text-muted-foreground">No wearable readings yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="py-1 pr-3">Date</th>
                  {columns.map((m) => (
                    <th key={m} className="pr-3">
                      {WEARABLE_METRIC_INFO[m].label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dates.map((d) => (
                  <tr key={d} className="border-t border-border">
                    <td className="py-1 pr-3">{formatShortDate(d)}</td>
                    {columns.map((m) => (
                      <td key={m} className="pr-3">
                        {byDate.get(d)?.[m] === undefined ? "—" : m === "sleepMinutes" ? `${(byDate.get(d)![m]! / 60).toFixed(1)} h` : Math.round(byDate.get(d)![m]!)}
                        {byDate.get(d)?.[m] !== undefined && bandLabel(sourceByMetric.get(m), m, byDate.get(d)![m]!) && (
                          <span className="block text-[10px] text-muted-foreground">{bandLabel(sourceByMetric.get(m), m, byDate.get(d)![m]!)}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
