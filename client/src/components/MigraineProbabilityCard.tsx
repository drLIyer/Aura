import { Card } from "@/components/ui/card";
import { AlertTriangle, Shield, Activity, TrendingDown, TrendingUp, Minus } from "lucide-react";

interface Factor {
  name: string;
  impact: 'positive' | 'negative' | 'neutral';
  value: number;
  contribution: number;
}

interface MigraineProbabilityCardProps {
  probability: number;
  riskLevel: 'low' | 'moderate' | 'high' | 'very_high';
  factors: Factor[];
}

export default function MigraineProbabilityCard({ probability, riskLevel, factors }: MigraineProbabilityCardProps) {
  const riskConfig = {
    low: {
      color: 'text-green-600',
      bgColor: 'from-green-500/10 to-green-600/5',
      borderColor: 'border-green-200',
      label: 'Low Risk',
      icon: Shield
    },
    moderate: {
      color: 'text-yellow-600',
      bgColor: 'from-yellow-500/10 to-yellow-600/5',
      borderColor: 'border-yellow-200',
      label: 'Moderate Risk',
      icon: Activity
    },
    high: {
      color: 'text-orange-600',
      bgColor: 'from-orange-500/10 to-orange-600/5',
      borderColor: 'border-orange-200',
      label: 'High Risk',
      icon: AlertTriangle
    },
    very_high: {
      color: 'text-red-600',
      bgColor: 'from-red-500/10 to-red-600/5',
      borderColor: 'border-red-200',
      label: 'Very High Risk',
      icon: AlertTriangle
    }
  };

  const config = riskConfig[riskLevel];
  const RiskIcon = config.icon;

  const getImpactIcon = (impact: 'positive' | 'negative' | 'neutral') => {
    switch (impact) {
      case 'positive':
        return <TrendingDown className="h-3 w-3 text-green-500" />;
      case 'negative':
        return <TrendingUp className="h-3 w-3 text-red-500" />;
      default:
        return <Minus className="h-3 w-3 text-muted-foreground" />;
    }
  };

  return (
    <Card 
      className={`p-6 bg-gradient-to-br ${config.bgColor} border ${config.borderColor}`}
      data-testid="card-migraine-probability"
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RiskIcon className={`h-5 w-5 ${config.color}`} />
            <p className="text-sm font-medium text-muted-foreground">Migraine Probability</p>
          </div>
          <span 
            className={`text-xs px-2 py-1 rounded-full ${config.color} bg-white/50 dark:bg-black/20`}
            data-testid="badge-risk-level"
          >
            {config.label}
          </span>
        </div>
        
        <div className="flex items-baseline gap-2">
          <span className={`text-4xl font-bold ${config.color}`} data-testid="text-probability-value">
            {probability}%
          </span>
          <span className="text-sm text-muted-foreground">chance</span>
        </div>
        
        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all duration-500 ${
              riskLevel === 'low' ? 'bg-green-500' :
              riskLevel === 'moderate' ? 'bg-yellow-500' :
              riskLevel === 'high' ? 'bg-orange-500' : 'bg-red-500'
            }`}
            style={{ width: `${probability}%` }}
            data-testid="progress-probability"
          />
        </div>
        
        {factors.length > 0 && (
          <div className="pt-2 border-t border-border/50">
            <p className="text-xs font-medium text-muted-foreground mb-2">Contributing Factors</p>
            <div className="space-y-1.5">
              {factors.map((factor, index) => (
                <div 
                  key={factor.name}
                  className="flex items-center justify-between text-xs"
                  data-testid={`factor-${index}`}
                >
                  <div className="flex items-center gap-1.5">
                    {getImpactIcon(factor.impact)}
                    <span className="text-muted-foreground">{factor.name}</span>
                  </div>
                  <span className={`font-medium ${
                    factor.impact === 'positive' ? 'text-green-600' :
                    factor.impact === 'negative' ? 'text-red-600' : 'text-muted-foreground'
                  }`}>
                    {factor.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
