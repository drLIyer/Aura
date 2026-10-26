import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface LogEntry {
  id?: string;
  time: string;
  value: string;
}

interface LoggingPanelProps {
  title: string;
  icon: React.ReactNode;
  entries: LogEntry[];
  quickAddOptions?: { label: string; value: string }[];
  onAdd: (value: string) => void;
  onRemove?: (id: string) => void;
  emptyMessage?: string;
  children?: React.ReactNode;
}

export default function LoggingPanel({ 
  title, 
  icon, 
  entries, 
  quickAddOptions, 
  onAdd,
  onRemove,
  emptyMessage = 'No entries yet',
  children,
}: LoggingPanelProps) {
  return (
    <Card className="p-6" data-testid={`card-log-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        </div>
      </div>

      {quickAddOptions && (
        <div className="flex flex-wrap gap-2 mb-4">
          {quickAddOptions.map((option) => (
            <Button
              key={option.value}
              size="sm"
              variant="outline"
              onClick={() => onAdd(option.value)}
              data-testid={`button-add-${option.value}`}
              className="hover-elevate"
            >
              <Plus className="w-4 h-4 mr-1" />
              {option.label}
            </Button>
          ))}
        </div>
      )}

      {children}

      <div className="space-y-2">
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">{emptyMessage}</p>
        ) : (
          entries.map((entry, idx) => (
            <div
              key={idx}
              className="flex justify-between items-center p-3 bg-muted rounded-md"
              data-testid={`log-entry-${idx}`}
            >
              <span className="text-sm text-muted-foreground">{entry.time}</span>
              <span className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">{entry.value}</span>
                {onRemove && entry.id && (
                  <button className="text-xs text-muted-foreground underline" onClick={() => onRemove(entry.id!)} aria-label={`Remove ${entry.value}`}>
                    remove
                  </button>
                )}
              </span>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
