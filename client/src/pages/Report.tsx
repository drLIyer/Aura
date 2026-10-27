import { useQuery } from "@tanstack/react-query";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import RecommendationsCard from "@/components/RecommendationsCard";
import PreVisitSummaryCard from "@/components/assist/PreVisitSummaryCard";
import { formatLocalDateTime, formatLongDate } from "@/lib/dates";
import type { Medication, Recommendation } from "@/lib/types";
import { IS_DEMO } from "@/lib/demo";
import { CONDITIONS, FAMILY_HISTORY, MEDICATION_CLASS_LABELS, SYMPTOMS, TRIGGERS, WARNING_SIGNS, labelOf } from "@shared/engine/domain/catalog";
import type { SummaryStats } from "@shared/engine/cds/metrics";
import type { TriggerWeight } from "@shared/engine/cds/riskModel";
import type { AttackInput, PatternsInput, ProfileInput, SupplementInput } from "@shared/api";

interface ReportData {
  generatedFor: string;
  profile: ProfileInput;
  patterns: PatternsInput;
  summary30: SummaryStats;
  summary90: SummaryStats;
  medications: Medication[];
  supplements: SupplementInput[];
  overuse: { byClass: { cls: string; days: number; threshold: number }[]; totalDays: number };
  medicationResponses: { medication: { id: string; name: string }; rated: number; painFree: number; partial: number; recurrence: number; medianDelayMin: number | null }[];
  recommendations: Recommendation[];
  vascularFactors: string[];
  aura: { attacksWithAura: number; averageMinutes: number | null; unusual: { start: string; minutes?: number; onset?: string; usual?: boolean }[] };
  midas: { date: string; score: number; grade: string; label: string } | null;
  attacks: (AttackInput & { id: string })[];
  topTriggers: TriggerWeight[];
}

const ROLE = { acute: "Acute", preventive: "Preventive", other: "Other" } as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="p-6 print:shadow-none print:border-0 print:p-0 print:break-inside-avoid">
      <h2 className="text-lg font-semibold mb-3">{title}</h2>
      {children}
    </Card>
  );
}

/** One-page summary for a clinic visit: everything a doctor needs, with the basis for each flag. */
export default function Report({ date }: { date: string }) {
  const { data: r } = useQuery<ReportData>({ queryKey: [`/api/report?date=${date}`] });
  if (!r) return <p className="text-muted-foreground">Loading…</p>;
  const age = r.profile.birthYear ? Number(date.slice(0, 4)) - r.profile.birthYear : null;
  const medName = new Map(r.medications.map((m) => [m.id, m.name]));

  return (
    <div className="space-y-6 max-w-4xl mx-auto print:space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Migraine summary for your doctor</h1>
          <p className="text-muted-foreground">
            {formatLongDate(r.generatedFor)}
            {age !== null && ` · ${age} years`}
            {r.profile.sex !== "unspecified" && ` · ${r.profile.sex}`}
          </p>
        </div>
        {!IS_DEMO && (
          <Button variant="outline" onClick={() => window.print()} className="print:hidden">
            <Printer className="w-4 h-4 mr-2" /> Print
          </Button>
        )}
      </div>

      <PreVisitSummaryCard date={date} />

      <Section title="Frequency and disability">
        <table className="text-sm w-full">
          <thead className="text-left text-muted-foreground">
            <tr>
              <th />
              <th>Last 30 days</th>
              <th>Last 90 days</th>
            </tr>
          </thead>
          <tbody>
            {(
              [
                ["Migraine days", "migraineDays"],
                ["Moderate-to-severe days", "moderateSevereDays"],
                ["Headache days (any)", "headacheDays"],
                ["Acute medication days", "acuteMedicationDays"],
                ["Attacks", "attacks"],
              ] as const
            ).map(([label, k]) => (
              <tr key={k} className="border-t border-border">
                <td className="py-1">{label}</td>
                <td>{r.summary30[k]}</td>
                <td>{r.summary90[k]}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-sm mt-3">
          MIDAS: {r.midas ? `${r.midas.score} (grade ${r.midas.grade}, ${r.midas.label.toLowerCase()}) on ${r.midas.date}` : "not completed"}
          {" · "}Patient-reported usual frequency: {r.patterns.typicalMigraineDaysPerMonth ?? "—"} days/month
        </p>
      </Section>

      <RecommendationsCard recommendations={r.recommendations} title="Flags and guideline-based considerations" emptyText="No flags." />

      <Section title="All current medicines">
        <table className="text-sm w-full">
          <thead className="text-left text-muted-foreground">
            <tr>
              <th className="py-1">Medicine</th>
              <th>Type</th>
              <th>Use</th>
              <th>Dose / frequency</th>
              <th>Since</th>
            </tr>
          </thead>
          <tbody>
            {r.medications
              .filter((m) => m.active)
              .map((m) => (
                <tr key={m.id} className="border-t border-border">
                  <td className="py-1">{m.name}</td>
                  <td>{MEDICATION_CLASS_LABELS[m.cls]}</td>
                  <td>{ROLE[m.role]}</td>
                  <td>{[m.dose, m.frequency].filter(Boolean).join(", ")}</td>
                  <td>{m.startDate ?? ""}</td>
                </tr>
              ))}
          </tbody>
        </table>
        {r.supplements.length > 0 && (
          <p className="text-sm mt-3">Supplements: {r.supplements.map((s) => `${s.name}${s.dailyMg ? ` ${s.dailyMg} mg/day` : ""}`).join(", ")}</p>
        )}
        {r.medications.some((m) => !m.active) && (
          <p className="text-sm mt-2 text-muted-foreground">
            Previously: {r.medications.filter((m) => !m.active).map((m) => `${m.name} (${m.startDate ?? "?"} – ${m.endDate ?? "?"})`).join(", ")}
          </p>
        )}
        {r.overuse.byClass.length > 0 && (
          <p className="text-sm mt-2">
            Acute-medication days, last 30: {r.overuse.byClass.map((c) => `${c.cls} ${c.days} (limit ${c.threshold - 1})`).join(", ")}
          </p>
        )}
      </Section>

      <Section title="Acute treatment response">
        {r.medicationResponses.length === 0 ? (
          <p className="text-sm text-muted-foreground">No doses logged.</p>
        ) : (
          <ul className="text-sm space-y-1">
            {r.medicationResponses.map((m) => (
              <li key={m.medication.id}>
                {m.medication.name}: pain-free at 2 h {m.painFree}/{m.rated}, partial {m.partial}/{m.rated}, recurrence {m.recurrence}
                {m.medianDelayMin !== null && `, median ${Math.round(m.medianDelayMin)} min after onset`}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Vascular and safety profile">
        <ul className="text-sm list-disc pl-5">
          {r.vascularFactors.length ? r.vascularFactors.map((f) => <li key={f}>{f}</li>) : <li>No vascular risk factors recorded.</li>}
        </ul>
        <p className="text-sm mt-2">
          Aura: {r.aura.attacksWithAura} attacks{r.aura.averageMinutes !== null && `, average ${r.aura.averageMinutes} min`}.
          {r.aura.unusual.length > 0 &&
            ` Atypical features: ${r.aura.unusual
              .map((u) => `${formatLocalDateTime(u.start)} (${[u.onset === "sudden" && "sudden onset", u.usual === false && "unlike usual", (u.minutes ?? 0) > 60 && `${u.minutes} min`].filter(Boolean).join(", ")})`)
              .join("; ")}.`}
        </p>
        <p className="text-sm mt-2">
          Conditions: {r.profile.conditions.map((c) => labelOf(CONDITIONS, c)).join(", ") || "none recorded"}
          {r.profile.smoking && ` · Smoking: ${r.profile.smoking}`}
          {r.profile.pregnant && " · Pregnant/postpartum"}
          {r.profile.childbearingPotential && " · Could become pregnant"}
        </p>
        <p className="text-sm mt-2">
          Family history:{" "}
          {r.profile.familyHistory.length ? r.profile.familyHistory.map((f) => `${labelOf(FAMILY_HISTORY, f.condition)} (${f.relatives.join(", ")})`).join("; ") : "none recorded"}
        </p>
      </Section>

      <Section title="Triggers and patterns">
        <p className="text-sm">Patient-reported: {r.patterns.triggers.filter((t) => t.likelihood !== "unsure").map((t) => `${labelOf([...TRIGGERS, ...r.patterns.customTriggers], t.id)} (${t.likelihood})`).join(", ") || "none"}</p>
        <p className="text-sm mt-1">
          From logs (estimated relative risk):{" "}
          {r.topTriggers.length ? r.topTriggers.map((t) => `${t.label} ×${t.rr.toFixed(1)} (${Math.round(t.personalWeight * 100)}% from data)`).join(", ") : "not enough data yet"}
        </p>
        <p className="text-sm mt-1">Warning signs: {r.patterns.warningSigns.map((w) => labelOf(WARNING_SIGNS, w)).join(", ") || "none reported"}</p>
      </Section>

      <Section title="Attacks, last 90 days">
        <table className="text-sm w-full">
          <thead className="text-left text-muted-foreground">
            <tr>
              <th className="py-1">Start</th>
              <th>Pain</th>
              <th>Symptoms</th>
              <th>Treatment</th>
            </tr>
          </thead>
          <tbody>
            {r.attacks.map((a) => (
              <tr key={a.id} className="border-t border-border align-top">
                <td className="py-1 pr-2 whitespace-nowrap">{formatLocalDateTime(a.start)}</td>
                <td>{a.peakSeverity}/10</td>
                <td className="pr-2">{a.symptoms.map((s) => labelOf(SYMPTOMS, s)).join(", ")}</td>
                <td>{a.doses.map((d) => `${medName.get(d.medicationId) ?? "?"}${d.reliefAt2h ? ` → ${d.reliefAt2h}` : ""}`).join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <p className="text-xs text-muted-foreground">
        Generated from patient-entered data and connected devices. Flags follow the cited guidelines and are meant to support, not replace, clinical
        judgement.
      </p>
    </div>
  );
}
