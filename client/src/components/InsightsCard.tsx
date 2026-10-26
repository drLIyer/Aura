import { AlertCircle, Info, CheckCircle, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";

interface Insight {
  type: 'warning' | 'info' | 'success' | 'cycle';
  title: string;
  message: string;
}

interface InsightsCardProps {
  insights: Insight[];
}

export default function InsightsCard({ insights }: InsightsCardProps) {
  const getIcon = (type: string) => {
    switch (type) {
      case 'warning': return <AlertTriangle className="w-5 h-5 text-orange-500" />;
      case 'info': return <Info className="w-5 h-5 text-chart-2" />;
      case 'success': return <CheckCircle className="w-5 h-5 text-chart-3" />;
      case 'cycle': return <AlertCircle className="w-5 h-5 text-pink-500" />;
      default: return <AlertCircle className="w-5 h-5" />;
    }
  };

  const getBorderColor = (type: string) => {
    switch (type) {
      case 'warning': return 'border-l-orange-500 bg-orange-500/5';
      case 'info': return 'border-l-blue-500 bg-blue-500/5';
      case 'success': return 'border-l-green-500 bg-green-500/5';
      case 'cycle': return 'border-l-pink-500 bg-pink-500/5';
      default: return 'border-l-border';
    }
  };

  return (
    <Card className="p-6" data-testid="card-insights">
      <div className="flex items-center gap-2 mb-4">
        <AlertCircle className="w-5 h-5 text-orange-500" />
        <h2 className="text-lg font-semibold text-foreground">Insights & Alerts</h2>
      </div>
      <div className="space-y-3">
        {insights.map((insight, idx) => (
          <div
            key={idx}
            className={`p-4 border-l-4 rounded-md ${getBorderColor(insight.type)}`}
            data-testid={`insight-${idx}`}
          >
            <div className="flex items-start gap-3">
              {getIcon(insight.type)}
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-foreground mb-1">{insight.title}</h3>
                <p className="text-sm text-muted-foreground">{insight.message}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
