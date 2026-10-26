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
  const hasCycleData = data.some((phase) => phase.migraines > 0);

  return (
    <Card className="p-6" data-testid="card-cycle-analytics">
      <h2 className="text-lg font-semibold text-foreground mb-4">Migraine Frequency by Cycle Phase</h2>
      {hasCycleData ? (
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
      ) : (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Log migraine and cycle data to see patterns by cycle phase.
        </p>
      )}
      <div className="mt-4 p-4 bg-pink-500/5 border border-pink-500/20 rounded-lg">
        <p className="text-sm text-foreground">
          <strong>Personal cycle insights</strong> are based on your logged migraine and cycle data.
        </p>
      </div>
    </Card>
  );
}
