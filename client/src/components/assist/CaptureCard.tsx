import { useMemo, useState } from "react";
import { Check, PencilLine, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { formatLocalDateTime } from "@/lib/dates";
import { apiJson, invalidateAll } from "@/lib/queryClient";
import type { CheckIn, Medication } from "@/lib/types";
import { ALLEVIATORS, EXACERBATORS, PAIN_LOCATIONS, PAIN_QUALITIES, RED_FLAGS, SYMPTOMS, TRIGGERS, labelOf } from "@shared/engine/domain/catalog";
import type { AttackDraft, CaptureProposal } from "@shared/assist/types";
import type { AttackInput } from "@shared/api";

interface Props {
  proposal: CaptureProposal;
  medications: Medication[];
  customTriggers: { id: string; label: string }[];
  onSaved: () => void;
  onEditInForm: (draft: AttackDraft) => void;
  onDiscard: () => void;
}

const DISABILITY: { id: NonNullable<AttackDraft["disability"]>; label: string }[] = [
  { id: "none", label: "Not at all" },
  { id: "mild", label: "A little" },
  { id: "moderate", label: "A lot" },
  { id: "severe", label: "Couldn't do anything" },
];

const time = (t?: string) => (t ? formatLocalDateTime(t).replace(/^.*?, /, "") : "");
const dateOf = (t?: string) => t?.slice(0, 10);

/** The confirm card: what Aura understood, the questions it still has, and Save. Nothing is saved before Save. */
export default function CaptureCard({ proposal, medications, customTriggers, onSaved, onEditInForm, onDiscard }: Props) {
  const { toast } = useToast();
  const [attack, setAttack] = useState<AttackDraft | null>(proposal.attack);
  const [checkIn, setCheckIn] = useState(proposal.checkIn);
  const [answered, setAnswered] = useState<Set<string>>(new Set());
  const [ongoing, setOngoing] = useState<boolean | null>(null);
  const [addEvent, setAddEvent] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  const triggerName = (id: string) => customTriggers.find((c) => c.id === id)?.label ?? labelOf(TRIGGERS, id);
  const medName = (id: string) => medications.find((m) => m.id === id)?.name ?? "medicine";
  const answer = (id: string) => setAnswered((s) => new Set(s).add(id));
  const setA = (patch: Partial<AttackDraft>) => setAttack((a) => (a ? { ...a, ...patch } : a));

  const open = proposal.questions.filter((q) => !answered.has(q.id));
  const missing = attack ? [!attack.start && "when it started", attack.peakSeverity === undefined && "how bad it was"].filter(Boolean) : [];
  const nonUrgentFlags = proposal.screen.flags.filter((f) => !RED_FLAGS.find((r) => r.id === f)?.urgent);
  const empty = !attack && !checkIn && !(proposal.lifeEvent && addEvent);

  const lines = useMemo(() => {
    if (!attack) return [];
    const out: string[] = [];
    out.push(
      [
        "Migraine",
        attack.start && `started ${formatLocalDateTime(attack.start)}`,
        attack.end ? `ended ${time(attack.end)}` : ongoing !== false && (ongoing || !proposal.questions.some((q) => q.field === "end")) ? "ongoing" : null,
        attack.peakSeverity !== undefined && `${attack.peakSeverity}/10`,
      ]
        .filter(Boolean)
        .join(" · "),
    );
    const where = [...(attack.painLocations ?? []).map((id) => labelOf(PAIN_LOCATIONS, id)), ...(attack.painQualities ?? []).map((id) => labelOf(PAIN_QUALITIES, id))];
    if (where.length) out.push(where.join(", "));
    if (attack.symptoms?.length) out.push(attack.symptoms.map((id) => labelOf(SYMPTOMS, id)).join(", "));
    for (const d of attack.doses ?? []) {
      out.push(`${medName(d.medicationId)}${d.takenAt ? ` at ${time(d.takenAt)}` : ""}${d.reliefAt2h ? ` · ${d.reliefAt2h === "pain-free" ? "pain-free" : d.reliefAt2h === "partial" ? "partial relief" : "no relief"}` : ""}`);
    }
    if (attack.alleviators?.length) out.push(`Helped: ${attack.alleviators.map((id) => labelOf(ALLEVIATORS, id)).join(", ")}`);
    if (attack.exacerbators?.length) out.push(`Worse with: ${attack.exacerbators.map((id) => labelOf(EXACERBATORS, id)).join(", ")}`);
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attack, ongoing, medications]);

  const checkInLine = checkIn
    ? [
        checkIn.lunchTime && `lunch ${checkIn.lunchTime}`,
        checkIn.sleepHours !== undefined && `slept ${checkIn.sleepHours} h`,
        checkIn.workHours !== undefined && `worked ${checkIn.workHours} h`,
        checkIn.stress !== undefined && `stress ${checkIn.stress}/10`,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";
  const triggers = [...new Set([...(attack?.triggers ?? []), ...(checkIn?.exposures ?? [])])];

  async function save() {
    setSaving(true);
    try {
      if (attack) {
        const start = attack.start!;
        const body: AttackInput = {
          painLocations: [],
          painQualities: [],
          symptoms: [],
          triggers: [],
          alleviators: [],
          exacerbators: [],
          redFlags: [],
          worsenedByActivity: false,
          disability: "mild",
          ...attack,
          start,
          peakSeverity: attack.peakSeverity!,
          end: ongoing ? undefined : attack.end,
          doses: (attack.doses ?? []).map((d) => ({ ...d, takenAt: d.takenAt || start })),
        };
        await apiJson("/api/attacks", "POST", body);
      }
      if (checkIn) {
        const date = proposal.checkInDate;
        const existing = await apiJson<CheckIn | null>(`/api/checkins/${date}`);
        const { date: _d, ...prev } = existing ?? ({ exposures: [], warningSigns: [], headache: false } as unknown as CheckIn);
        const exposures = [...new Set([...(prev.exposures ?? []), ...(checkIn.exposures ?? []), ...(attack && dateOf(attack.start) === date ? (attack.triggers ?? []).filter((t) => t !== "menstruation") : [])])];
        await apiJson(`/api/checkins/${date}`, "PUT", { ...prev, ...checkIn, exposures, headache: Boolean(prev.headache || checkIn.headache) });
      }
      if (proposal.lifeEvent && addEvent) await apiJson("/api/memory/life-events", "POST", proposal.lifeEvent);
      invalidateAll();
      toast({ title: "Saved to your log" });
      onSaved();
    } catch (e) {
      toast({ title: "Couldn't save", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3 text-sm" data-testid="capture-card">
      {lines.length > 0 && (
        <div className="space-y-1">
          {lines.map((l, i) => (
            <p key={i} className={i === 0 ? "font-semibold" : "text-muted-foreground"}>
              {l}
            </p>
          ))}
        </div>
      )}
      {triggers.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <span className="text-muted-foreground">Triggers:</span>
          {triggers.map((t) => (
            <span key={t} className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs">
              {triggerName(t)}
            </span>
          ))}
        </div>
      )}
      {checkInLine && <p className="text-muted-foreground">Check-in: {checkInLine}</p>}
      {nonUrgentFlags.length > 0 && (
        <p className="rounded-md bg-amber-500/10 border border-amber-500/30 p-2 text-amber-900 dark:text-amber-200">
          You mentioned: {nonUrgentFlags.map((f) => labelOf(RED_FLAGS, f).toLowerCase()).join("; ")}. Worth telling your clinician soon.
        </p>
      )}
      {proposal.heardButNotMapped.length > 0 && (
        <div className="text-xs text-muted-foreground">
          <span className="font-medium">Also heard:</span>
          <ul className="list-disc pl-5">
            {proposal.heardButNotMapped.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        </div>
      )}

      {open.length > 0 && (
        <div className="space-y-3 border-t border-border pt-3">
          {open.map((q) => (
            <div key={q.id} className="space-y-1.5" data-testid={`question-${q.field}`}>
              <p className="font-medium">{q.ask}</p>
              {q.field === "peakSeverity" && (
                <div className="flex flex-wrap gap-1">
                  {Array.from({ length: 11 }, (_, n) => (
                    <Button key={n} size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => (setA({ peakSeverity: n }), answer(q.id))} aria-label={`${n} out of 10`}>
                      {n}
                    </Button>
                  ))}
                </div>
              )}
              {q.field === "start" && (
                <Input type="datetime-local" className="w-56" aria-label="Start time" onChange={(e) => e.target.value && (attack ? setA({ start: e.target.value }) : setAttack({ start: e.target.value, doses: [] }), answer(q.id))} />
              )}
              {q.field === "end" && (
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => (setOngoing(true), answer(q.id))}>
                    Still going
                  </Button>
                  <span className="text-muted-foreground">or ended at</span>
                  <Input type="datetime-local" className="w-56" aria-label="End time" onChange={(e) => e.target.value && (setA({ end: e.target.value }), setOngoing(false), answer(q.id))} />
                </div>
              )}
              {q.field === "disability" && (
                <div className="flex flex-wrap gap-1.5">
                  {DISABILITY.map((d) => (
                    <Button key={d.id} size="sm" variant="outline" onClick={() => (setA({ disability: d.id }), answer(q.id))}>
                      {d.label}
                    </Button>
                  ))}
                  <Button size="sm" variant="ghost" onClick={() => answer(q.id)}>
                    Skip
                  </Button>
                </div>
              )}
              {q.field === "confirmTrigger" && q.triggerId && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (attack) setA({ triggers: [...new Set([...(attack.triggers ?? []), q.triggerId!])] });
                      setCheckIn((c) => ({ ...(c ?? {}), exposures: [...new Set([...(c?.exposures ?? []), q.triggerId!])] }));
                      answer(q.id);
                    }}
                  >
                    Yes
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => answer(q.id)}>
                    No
                  </Button>
                </div>
              )}
              {q.field === "doseTime" && q.medicationId && (
                <Input
                  type="datetime-local"
                  className="w-56"
                  aria-label={`Time taken: ${medName(q.medicationId)}`}
                  onChange={(e) => e.target.value && (setA({ doses: (attack?.doses ?? []).map((d) => (d.medicationId === q.medicationId ? { ...d, takenAt: e.target.value } : d)) }), answer(q.id))}
                />
              )}
              {q.field === "lifeEvent" && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => (setAddEvent(true), answer(q.id))}>
                    Yes, add it
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => (setAddEvent(false), answer(q.id))}>
                    No
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {missing.length > 0 && <p className="text-xs text-muted-foreground">To save the attack I still need {missing.join(" and ")}.</p>}
      <div className="flex flex-wrap justify-end gap-2 pt-1">
        <Button size="sm" variant="ghost" onClick={onDiscard}>
          <X className="w-4 h-4 mr-1" /> Discard
        </Button>
        {attack && (
          <Button size="sm" variant="outline" onClick={() => onEditInForm(attack)}>
            <PencilLine className="w-4 h-4 mr-1" /> Edit in full form
          </Button>
        )}
        <Button size="sm" onClick={save} disabled={saving || missing.length > 0 || empty} data-testid="button-capture-save">
          <Check className="w-4 h-4 mr-1" /> Save
        </Button>
      </div>
    </div>
  );
}
