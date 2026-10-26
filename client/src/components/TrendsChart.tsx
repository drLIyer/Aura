import { Card } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface TrendData {
  date: string;
  readiness?: number;
  sleep: number;
  stress: number;
  migraine?: number;
}

interface TrendsChartProps {
  data: TrendData[];
  days?: number;
}

export default function TrendsChart({ data, days = 7 }: TrendsChartProps) {
  return (
    <Card className="p-6" data-testid="card-trends-chart">
      <h2 className="text-lg font-semibold text-foreground mb-4">{days}-Day Trends</h2>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
          <YAxis stroke="hsl(var(--muted-foreground))" />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'hsl(var(--card))', 
              border: '1px solid hsl(var(--border))',
              borderRadius: '0.5rem'
            }}
          />
          <Legend />
          <Line type="monotone" dataKey="readiness" stroke="hsl(var(--chart-1))" strokeWidth={2} name="Readiness" />
          <Line type="monotone" dataKey="sleep" stroke="hsl(var(--chart-2))" strokeWidth={2} name="Sleep" />
          <Line type="monotone" dataKey="stress" stroke="hsl(var(--chart-3))" strokeWidth={2} name="Stress" />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}
