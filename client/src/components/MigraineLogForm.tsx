import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { X, Plus, Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface MigraineLogFormProps {
  onSubmit: (data: MigraineData) => void;
  onCancel: () => void;
}

export interface MedicationEntry {
  name: string;
  dosage: string;
  timesTaken: number;
}

export interface MigraineData {
  severity: number;
  duration: number;
  symptoms: string[];
  triggers: string;
  notes: string;
  medications?: string;
}

const MEDICATION_OPTIONS = [
  'Diclofenac Sodium',
  'Ibuprofen',
  'Acetaminophen'
];

export default function MigraineLogForm({ onSubmit, onCancel }: MigraineLogFormProps) {
  const [severity, setSeverity] = useState(5);
  const [duration, setDuration] = useState(0);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [triggers, setTriggers] = useState('');
  const [notes, setNotes] = useState('');
  const [medications, setMedications] = useState<MedicationEntry[]>([]);

  const symptomOptions = ['Nausea', 'Aura', 'Light Sensitivity', 'Sound Sensitivity', 'Throbbing Pain', 'Fatigue'];

  const toggleSymptom = (symptom: string) => {
    setSymptoms(prev =>
      prev.includes(symptom)
        ? prev.filter(s => s !== symptom)
        : [...prev, symptom]
    );
  };

  const addMedication = () => {
    setMedications(prev => [...prev, { name: '', dosage: '', timesTaken: 1 }]);
  };

  const updateMedication = (index: number, field: keyof MedicationEntry, value: string | number) => {
    setMedications(prev => prev.map((med, i) => 
      i === index ? { ...med, [field]: value } : med
    ));
  };

  const removeMedication = (index: number) => {
    setMedications(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (duration === 0) {
      return;
    }
    const validMedications = medications.filter(m => m.name && m.dosage);
    onSubmit({ 
      severity, 
      duration, 
      symptoms, 
      triggers, 
      notes, 
      medications: validMedications.length > 0 ? JSON.stringify(validMedications) : undefined 
    });
  };

  return (
    <Card className="p-6" data-testid="form-migraine-log">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-foreground">Log Migraine Episode</h2>
        <Button 
          size="icon" 
          variant="ghost" 
          onClick={onCancel}
          data-testid="button-cancel-migraine"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="space-y-6">
        <div>
          <Label className="text-sm font-medium mb-2 block">Severity (1-10)</Label>
          <div className="flex items-center gap-4">
            <Slider
              value={[severity]}
              onValueChange={(val) => setSeverity(val[0])}
              min={1}
              max={10}
              step={1}
              className="flex-1"
              data-testid="slider-severity"
            />
            <span className="text-2xl font-bold text-primary w-12 text-center" data-testid="text-severity-value">{severity}</span>
          </div>
        </div>

        <div>
          <Label className="text-sm font-medium mb-2 block">Duration (hours)</Label>
          <div className="flex items-center gap-4">
            <Slider
              value={[duration]}
              onValueChange={(val) => setDuration(val[0])}
              min={0}
              max={24}
              step={0.5}
              className="flex-1"
              data-testid="slider-duration"
            />
            <span className="text-lg font-semibold text-foreground w-12 text-center" data-testid="text-duration-value">{duration}h</span>
          </div>
        </div>

        <div>
          <Label className="text-sm font-medium mb-2 block">Symptoms</Label>
          <div className="flex flex-wrap gap-2">
            {symptomOptions.map((symptom) => (
              <Badge
                key={symptom}
                variant={symptoms.includes(symptom) ? "default" : "outline"}
                className="cursor-pointer hover-elevate"
                onClick={() => toggleSymptom(symptom)}
                data-testid={`badge-symptom-${symptom.toLowerCase().replace(/\s+/g, '-')}`}
              >
                {symptom}
              </Badge>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-sm font-medium">Medications Taken</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addMedication}
              data-testid="button-add-medication"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Medication
            </Button>
          </div>
          
          {medications.length === 0 ? (
            <p className="text-sm text-muted-foreground">No medications added yet</p>
          ) : (
            <div className="space-y-3">
              {medications.map((med, index) => (
                <div key={index} className="flex flex-wrap gap-2 items-end p-3 bg-muted/50 rounded-md">
                  <div className="flex-1 min-w-[140px]">
                    <Label className="text-xs text-muted-foreground mb-1 block">Medication</Label>
                    <Select
                      value={med.name}
                      onValueChange={(value) => updateMedication(index, 'name', value)}
                    >
                      <SelectTrigger data-testid={`select-medication-name-${index}`}>
                        <SelectValue placeholder="Select medication" />
                      </SelectTrigger>
                      <SelectContent>
                        {MEDICATION_OPTIONS.map((option) => (
                          <SelectItem key={option} value={option}>{option}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-24">
                    <Label className="text-xs text-muted-foreground mb-1 block">Dosage (mg)</Label>
                    <Input
                      type="text"
                      value={med.dosage}
                      onChange={(e) => updateMedication(index, 'dosage', e.target.value)}
                      placeholder="e.g., 400mg"
                      data-testid={`input-medication-dosage-${index}`}
                    />
                  </div>
                  <div className="w-20">
                    <Label className="text-xs text-muted-foreground mb-1 block">Times</Label>
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      value={med.timesTaken}
                      onChange={(e) => updateMedication(index, 'timesTaken', parseInt(e.target.value) || 1)}
                      data-testid={`input-medication-times-${index}`}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeMedication(index)}
                    className="text-destructive hover:text-destructive"
                    data-testid={`button-remove-medication-${index}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <Label htmlFor="triggers" className="text-sm font-medium mb-2 block">Triggers</Label>
          <Textarea
            id="triggers"
            value={triggers}
            onChange={(e) => setTriggers(e.target.value)}
            placeholder="What might have triggered this migraine? (e.g., skipped meal, poor sleep, stress)"
            className="min-h-[80px]"
            data-testid="textarea-triggers"
          />
        </div>

        <div>
          <Label htmlFor="notes" className="text-sm font-medium mb-2 block">Additional Notes</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any other details about this episode..."
            className="min-h-[80px]"
            data-testid="textarea-notes"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <Button 
            variant="outline" 
            className="flex-1"
            onClick={onCancel}
            data-testid="button-cancel"
          >
            Cancel
          </Button>
          <Button 
            className="flex-1"
            onClick={handleSubmit}
            data-testid="button-submit-migraine"
          >
            Log Migraine
          </Button>
        </div>
      </div>
    </Card>
  );
}
