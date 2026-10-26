import { Card } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface CycleAnalyticsData {
  phase: string;
  migraines: number;
  total: number;
}

interface CycleAnalyticsChartProps {
  data: CycleAnalyticsData[];
}

export default function CycleAnalyticsChart({ data }: CycleAnalyticsChartProps) {
  return (
    <Card className="p-6" data-testid="card-cycle-analytics">
      <h2 className="text-lg font-semibold text-foreground mb-4">Migraine Frequency by Cycle Phase</h2>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="phase" stroke="hsl(var(--muted-foreground))" />
          <YAxis stroke="hsl(var(--muted-foreground))" />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'hsl(var(--card))', 
              border: '1px solid hsl(var(--border))',
              borderRadius: '0.5rem'
            }}
          />
          <Legend />
          <Bar dataKey="migraines" fill="hsl(var(--destructive))" name="Migraines" />
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-4 p-4 bg-pink-500/5 border border-pink-500/20 rounded-lg">
        <p className="text-sm text-foreground">
          <strong>Pattern Detected:</strong> 75% of your migraines occur during the luteal phase (days 15-28), 
          particularly 3-5 days before menstruation. This suggests a strong correlation with premenstrual syndrome.
        </p>
      </div>
    </Card>
  );
}
