import { Card } from "@/components/ui/card";

interface ScoreCardProps {
  title: string;
  score: number;
  description: string;
  color: 'purple' | 'blue' | 'green';
}

export default function ScoreCard({ title, score, description, color }: ScoreCardProps) {
  const colorClasses = {
    purple: 'from-purple-500/10 to-purple-600/5',
    blue: 'from-blue-500/10 to-blue-600/5',
    green: 'from-green-500/10 to-green-600/5',
  };

  const textColorClasses = {
    purple: 'text-purple-600',
    blue: 'text-blue-600',
    green: 'text-green-600',
  };

  return (
    <Card className={`p-6 bg-gradient-to-br ${colorClasses[color]}`} data-testid={`card-score-${title.toLowerCase()}`}>
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <div className="flex items-baseline gap-2">
          <span className={`text-4xl font-bold ${textColorClasses[color]}`}>{score}</span>
          <span className="text-sm text-muted-foreground">/ 100</span>
        </div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </Card>
  );
}
