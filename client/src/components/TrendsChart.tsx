import { Card } from "@/components/ui/card";
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatShortDate } from "@/lib/dates";

interface TrendPoint {
  date: string;
  readiness: number | null;
  sleep: number | null;
  stress: number | null;
  migraine: number;
}

/** Scores (0–100) on the left axis, stress (0–10) on the right, migraine days as bars. */
export default function TrendsChart({ data, days }: { data: TrendPoint[]; days: number }) {
  const rows = data.map((d) => ({ ...d, label: formatShortDate(d.date), migraineBar: d.migraine ? 100 : null }));
  return (
    <Card className="p-6" data-testid="card-trends-chart">
      <h2 className="text-lg font-semibold text-foreground mb-4">{days}-day trends</h2>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={rows}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} />
          <YAxis yAxisId="score" domain={[0, 100]} stroke="hsl(var(--muted-foreground))" fontSize={12} />
          <YAxis yAxisId="stress" orientation="right" domain={[0, 10]} stroke="hsl(var(--muted-foreground))" fontSize={12} />
          <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "0.5rem" }} />
          <Legend />
          <Bar yAxisId="score" dataKey="migraineBar" name="Migraine day" fill="hsl(var(--destructive))" fillOpacity={0.15} />
          <Line yAxisId="score" type="monotone" dataKey="readiness" stroke="hsl(var(--chart-1))" strokeWidth={2} name="Readiness" connectNulls />
          <Line yAxisId="score" type="monotone" dataKey="sleep" stroke="hsl(var(--chart-2))" strokeWidth={2} name="Sleep score" connectNulls />
          <Line yAxisId="stress" type="monotone" dataKey="stress" stroke="hsl(var(--chart-5))" strokeWidth={2} name="Stress (0–10)" connectNulls />
        </ComposedChart>
      </ResponsiveContainer>
    </Card>
  );
}
