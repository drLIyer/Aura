import { Card } from "@/components/ui/card";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface CyclePhaseRow {
  phase: string;
  attacks: number;
  days: number;
  attackShare: number;
  dayShare: number;
  ratio: number | null;
}

const LABELS: Record<string, string> = {
  perimenstrual: "Around period (−2 to +3)",
  follicular: "Follicular",
  ovulation: "Ovulation",
  luteal: "Luteal",
};

/**
 * Compares the share of attacks in each phase with the share of days spent in it.
 * A phase only stands out if it holds more attacks than its share of days would predict.
 */
export default function CycleAnalyticsChart({ data }: { data: CyclePhaseRow[] }) {
  const rows = data.map((d) => ({ name: LABELS[d.phase] ?? d.phase, attacks: Math.round(d.attackShare * 100), days: Math.round(d.dayShare * 100) }));
  const peri = data.find((d) => d.phase === "perimenstrual");
  return (
    <Card className="p-6" data-testid="card-cycle-analytics">
      <h2 className="text-lg font-semibold text-foreground mb-1">Migraines across your cycle</h2>
      <p className="text-sm text-muted-foreground mb-4">
        {peri && peri.attacks > 0 && peri.ratio
          ? `${Math.round(peri.attackShare * 100)}% of your attacks started in the days around your period, which make up ${Math.round(peri.dayShare * 100)}% of your days (${peri.ratio.toFixed(1)}× what chance alone would give).`
          : "Log periods and attacks to see whether a part of your cycle stands out."}
      </p>
      {data.some((d) => d.attacks > 0) ? (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
            <YAxis unit="%" stroke="hsl(var(--muted-foreground))" fontSize={12} />
            <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "0.5rem" }} />
            <Legend />
            <Bar dataKey="attacks" name="Share of attacks" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
            <Bar dataKey="days" name="Share of days" fill="hsl(var(--muted-foreground))" fillOpacity={0.35} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <p className="py-12 text-center text-sm text-muted-foreground">No attacks logged alongside your cycle yet.</p>
      )}
    </Card>
  );
}
