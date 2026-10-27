import { useMutation, useQuery } from "@tanstack/react-query";
import { Eye, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { apiJson, invalidateAll } from "@/lib/queryClient";
import type { Note } from "@shared/assist/types";
import AnswerView from "./AnswerView";

/** "Aura noticed": changes in the patient's own records worth a second look. */
export default function NoticedCard({ limit, onSeeAll }: { limit?: number; onSeeAll?: () => void }) {
  const { data: notes = [] } = useQuery<Note[]>({ queryKey: ["/api/assist/notes"] });
  const dismiss = useMutation({
    mutationFn: (id: string) => apiJson("/api/assist/notes/dismiss", "POST", { id }),
    onSuccess: () => invalidateAll(),
  });
  if (!notes.length) return limit ? null : <p className="text-sm text-muted-foreground">Nothing new right now. Aura checks again every time you log.</p>;
  const shown = limit ? notes.slice(0, limit) : notes;
  return (
    <Card className="p-6 space-y-4" data-testid="card-noticed">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Eye className="w-5 h-5 text-primary" /> Aura noticed
        </h2>
        {onSeeAll && (
          <Button variant="ghost" size="sm" className="px-2 text-primary underline-offset-2 hover:underline" onClick={onSeeAll}>
            What Aura remembers
          </Button>
        )}
      </div>
      {shown.map((n) => (
        <div key={n.id} className="flex items-start gap-3 border-t border-border pt-3 first:border-0 first:pt-0" data-testid={`note-${n.kind}`}>
          <div className="flex-1">
            <h3 className="text-sm font-semibold">{n.title}</h3>
            <AnswerView blocks={[{ text: n.text, sources: n.sources }]} />
          </div>
          <Button variant="ghost" size="icon" className="shrink-0" aria-label={`Dismiss: ${n.title}`} onClick={() => dismiss.mutate(n.id)}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      ))}
      {limit && notes.length > limit && <p className="text-xs text-muted-foreground">{notes.length - limit} more on What Aura remembers.</p>}
    </Card>
  );
}
