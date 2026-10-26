import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Activity, Moon, Brain, Save } from "lucide-react";

interface HealthScoreInputProps {
  currentScores?: {
    readiness?: number;
    sleep?: number;
    stress?: number;
  };
  onSave: (scores: { readiness: number; sleep: number; stress: number }) => void;
  isPending?: boolean;
}

export default function HealthScoreInput({ currentScores, onSave, isPending }: HealthScoreInputProps) {
  const hasScores = currentScores?.readiness !== undefined && currentScores?.readiness !== null;
  const [readiness, setReadiness] = useState(currentScores?.readiness ?? 70);
  const [sleep, setSleep] = useState(currentScores?.sleep ?? 70);
  const [stress, setStress] = useState(currentScores?.stress ?? 70);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (currentScores?.readiness !== undefined) setReadiness(currentScores.readiness);
    if (currentScores?.sleep !== undefined) setSleep(currentScores.sleep);
    if (currentScores?.stress !== undefined) setStress(currentScores.stress);
  }, [currentScores]);

  const handleSave = () => {
    onSave({ readiness, sleep, stress });
    setIsEditing(false);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600 dark:text-green-400";
    if (score >= 60) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  if (!isEditing) {
    return (
      <Card className="p-4" data-testid="card-health-score-input">
        <div className="flex items-center justify-between gap-2 mb-4">
          <h3 className="text-lg font-semibold">Daily Health Scores</h3>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setIsEditing(true)}
            data-testid="button-edit-health-scores"
          >
            {hasScores ? 'Edit Scores' : 'Add Scores'}
          </Button>
        </div>
        {hasScores ? (
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <Activity className="w-5 h-5 mx-auto mb-1 text-purple-500" />
              <p className="text-sm text-muted-foreground">Readiness</p>
              <p className={`text-2xl font-bold ${getScoreColor(readiness)}`} data-testid="text-readiness-score">{readiness}</p>
            </div>
            <div>
              <Moon className="w-5 h-5 mx-auto mb-1 text-blue-500" />
              <p className="text-sm text-muted-foreground">Sleep</p>
              <p className={`text-2xl font-bold ${getScoreColor(sleep)}`} data-testid="text-sleep-score">{sleep}</p>
            </div>
            <div>
              <Brain className="w-5 h-5 mx-auto mb-1 text-green-500" />
              <p className="text-sm text-muted-foreground">Stress Mgmt</p>
              <p className={`text-2xl font-bold ${getScoreColor(stress)}`} data-testid="text-stress-score">{stress}</p>
            </div>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground" data-testid="text-no-health-scores">
              No health scores logged for this day. Add your readiness, sleep, and stress scores.
            </p>
          </div>
        )}
      </Card>
    );
  }

  return (
    <Card className="p-4" data-testid="card-health-score-input-edit">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Edit Health Scores</h3>
        <div className="flex gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setIsEditing(false)}
            data-testid="button-cancel-health-scores"
          >
            Cancel
          </Button>
          <Button 
            size="sm" 
            onClick={handleSave}
            disabled={isPending}
            data-testid="button-save-health-scores"
          >
            <Save className="w-4 h-4 mr-1" />
            Save
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-purple-500" />
              Readiness Score
            </Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={readiness}
              onChange={(e) => setReadiness(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
              className="w-16 h-8 text-center"
              data-testid="input-readiness-score"
            />
          </div>
          <Slider
            value={[readiness]}
            onValueChange={([v]) => setReadiness(v)}
            min={0}
            max={100}
            step={1}
            className="w-full"
            data-testid="slider-readiness-score"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="flex items-center gap-2">
              <Moon className="w-4 h-4 text-blue-500" />
              Sleep Score
            </Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={sleep}
              onChange={(e) => setSleep(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
              className="w-16 h-8 text-center"
              data-testid="input-sleep-score"
            />
          </div>
          <Slider
            value={[sleep]}
            onValueChange={([v]) => setSleep(v)}
            min={0}
            max={100}
            step={1}
            className="w-full"
            data-testid="slider-sleep-score"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-green-500" />
              Stress Management Score
            </Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={stress}
              onChange={(e) => setStress(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
              className="w-16 h-8 text-center"
              data-testid="input-stress-score"
            />
          </div>
          <Slider
            value={[stress]}
            onValueChange={([v]) => setStress(v)}
            min={0}
            max={100}
            step={1}
            className="w-full"
            data-testid="slider-stress-score"
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground mt-4">
        Enter your daily scores (0-100). Higher scores indicate better health status.
      </p>
    </Card>
  );
}
