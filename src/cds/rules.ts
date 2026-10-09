import { RED_FLAGS, SUPPLEMENT_CATALOG, TRIGGERS, labelOf } from '../domain/catalog';
import { addDays, hoursBetween, toISODate } from '../domain/dates';
import type { AppState, Attack, ISODate, Medication, MedicationClass, Recommendation } from '../domain/types';
import {
  acuteMedicationDays,
  hasAura,
  headacheDays,
  latestMidas,
  midasGrade,
  midasScore,
  migraineDays,
  moderateSevereDays,
  windowEnding,
} from './metrics';
import { THRESHOLDS, analyzeTriggers, compareMetrics, menstrualPattern } from './patterns';

export interface RuleContext {
  state: AppState;
  today: ISODate;
  activeMeds: Medication[];
}

export type Rule = (ctx: RuleContext) => Recommendation[];

const has = (ctx: RuleContext, cls: MedicationClass) => ctx.activeMeds.some((m) => m.cls === cls);
const named = (ctx: RuleContext, re: RegExp) => ctx.activeMeds.filter((m) => re.test(m.name));
const hasCondition = (ctx: RuleContext, id: string) => ctx.state.profile.conditions.includes(id);
const recentAttacks = (ctx: RuleContext, days: number) =>
  ctx.state.attacks.filter((a) => toISODate(a.start) >= addDays(ctx.today, -(days - 1)));
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

// ---------------------------------------------------------------------------------------
// Safety: red flags, prolonged attacks and atypical aura

export const redFlagRule: Rule = (ctx) => {
  const out: Recommendation[] = [];
  const recent = recentAttacks(ctx, 14);
  const urgentIds = new Set(RED_FLAGS.filter((f) => f.urgent).map((f) => f.id));
  const urgent = recent.flatMap((a) => a.redFlags.filter((f) => urgentIds.has(f)));
  const other = recent.flatMap((a) => a.redFlags.filter((f) => !urgentIds.has(f)));
  if (urgent.length) {
    out.push({
      id: 'red-flag-urgent',
      severity: 'urgent',
      category: 'safety',
      title: 'Warning signs that need urgent medical assessment',
      detail: `A recent headache had: ${[...new Set(urgent)].map((f) => labelOf(RED_FLAGS, f)).join('; ')}. These can point to a cause other than migraine. Seek emergency care now (call your local emergency number) if they are happening now or have not yet been checked.`,
      sources: ['snnoop10'],
    });
  }
  if (other.length) {
    out.push({
      id: 'red-flag-review',
      severity: 'warning',
      category: 'safety',
      title: 'Headache features to review with your clinician soon',
      detail: `Reported: ${[...new Set(other)].map((f) => labelOf(RED_FLAGS, f)).join('; ')}. These are not emergencies by themselves, but they should be assessed before assuming the headache is migraine.`,
      sources: ['snnoop10'],
    });
  }

  const { birthYear, migraineOnsetYear } = ctx.state.profile;
  if (birthYear && migraineOnsetYear && migraineOnsetYear - birthYear >= 50) {
    out.push({
      id: 'onset-after-50',
      severity: 'warning',
      category: 'safety',
      title: 'Headaches that start after age 50 need evaluation',
      detail: 'Headaches that first begin after age 50 have a higher chance of a secondary cause, such as giant cell arteritis. Make sure this has been evaluated.',
      sources: ['snnoop10'],
    });
  }

  for (const a of recentAttacks(ctx, 30)) {
    const end = a.end ?? (toISODate(a.start) < addDays(ctx.today, -3) ? undefined : new Date().toISOString());
    if (end && hoursBetween(a.start, end) > 72) {
      out.push({
        id: `status-migrainosus-${a.id}`,
        severity: 'warning',
        category: 'safety',
        title: 'Attack lasting more than 72 hours (status migrainosus)',
        detail: 'A debilitating migraine that lasts over 3 days usually needs medical treatment, often in urgent care or an emergency department. Contact your clinician, and discuss a rescue plan for next time.',
        sources: ['ichd-3'],
      });
      break;
    }
  }

  const longAura = recentAttacks(ctx, 90).find((a) => (a.auraMinutes ?? 0) > 60);
  if (longAura) {
    out.push({
      id: 'prolonged-aura',
      severity: 'warning',
      category: 'safety',
      title: 'Aura lasting more than 60 minutes',
      detail: `Typical aura lasts 5–60 minutes. An aura of ${longAura.auraMinutes} minutes is outside that range and should be evaluated, especially if it is new for you.`,
      sources: ['ichd-3'],
    });
  }
  if (recentAttacks(ctx, 90).some((a) => a.symptoms.includes('aura-motor'))) {
    out.push({
      id: 'motor-aura',
      severity: 'warning',
      category: 'safety',
      title: 'Weakness during aura',
      detail: 'Weakness on one side during aura (possible hemiplegic migraine) needs specialist evaluation. If the weakness is new, treat it as a stroke emergency. Triptans and ergots have traditionally been avoided in hemiplegic migraine.',
      sources: ['ichd-3', 'snnoop10'],
    });
  }
  return out;
};

// ---------------------------------------------------------------------------------------
// Medication overuse (ICHD-3 8.2)

const TEN_DAY_CLASSES: MedicationClass[] = ['triptan', 'ergot', 'opioid', 'combination-analgesic'];
const FIFTEEN_DAY_CLASSES: MedicationClass[] = ['nsaid', 'simple-analgesic'];

export interface OveruseStatus {
  byClass: { cls: MedicationClass; days: number; threshold: number }[];
  totalDays: number;
  overused: MedicationClass[];
  multipleClassOveruse: boolean;
}

export function overuseStatus(state: AppState, end: ISODate): OveruseStatus {
  const days = acuteMedicationDays(state.attacks, state.medications, windowEnding(end, 30));
  const byClass = [...TEN_DAY_CLASSES, ...FIFTEEN_DAY_CLASSES]
    .filter((c) => days.has(c))
    .map((cls) => ({ cls, days: days.get(cls)!.size, threshold: TEN_DAY_CLASSES.includes(cls) ? 10 : 15 }));
  const all = new Set<ISODate>();
  for (const { cls } of byClass) for (const d of days.get(cls)!) all.add(d);
  const overused = byClass.filter((c) => c.days >= c.threshold).map((c) => c.cls);
  return {
    byClass,
    totalDays: all.size,
    overused,
    multipleClassOveruse: overused.length === 0 && all.size >= 10,
  };
}

export const medicationOveruseRule: Rule = (ctx) => {
  const now = overuseStatus(ctx.state, ctx.today);
  const prior = [30, 60].map((d) => overuseStatus(ctx.state, addDays(ctx.today, -d)));
  const overusing = (s: OveruseStatus) => s.overused.length > 0 || s.multipleClassOveruse;
  const hd = headacheDays(ctx.state, windowEnding(ctx.today, 30)).size;
  const sources = ['ichd-3-moh', 'amf-moh', 'ahs-2021-consensus'];

  if (overusing(now)) {
    const what = now.overused.length
      ? now.byClass.filter((c) => now.overused.includes(c.cls)).map((c) => `${c.cls} on ${c.days} days (limit ${c.threshold - 1})`).join(', ')
      : `several acute medicines on ${now.totalDays} days in total (limit 9)`;
    const sustained = prior.every(overusing);
    return [
      {
        id: 'moh',
        severity: 'warning',
        category: 'medication-overuse',
        title: sustained
          ? 'Acute medication use has been above overuse limits for 3 months'
          : 'Acute medication use is above overuse limits this month',
        detail: `In the last 30 days: ${what}. ${
          sustained && hd >= 15
            ? `Together with ${hd} headache days, this fits the pattern of medication-overuse headache.`
            : 'If this continues for more than 3 months, it can cause medication-overuse headache.'
        } Do not stop prescribed medicines abruptly without advice. Talk to your clinician about a plan, which usually includes starting or adjusting preventive treatment.`,
        sources,
      },
    ];
  }
  const close = now.byClass.filter((c) => c.days >= c.threshold - 2);
  if (close.length || now.totalDays >= 8) {
    return [
      {
        id: 'moh-approaching',
        severity: 'info',
        category: 'medication-overuse',
        title: 'Getting close to the medication-overuse limit',
        detail: `In the last 30 days you used acute medicines on ${plural(now.totalDays, 'day')}${
          close.length ? ` (${close.map((c) => `${c.cls}: ${c.days}/${c.threshold - 1} allowed`).join(', ')})` : ''
        }. Plan how to manage the rest of the month with your clinician. Gepants are not thought to cause overuse headache.`,
        sources,
      },
    ];
  }
  return [];
};

// ---------------------------------------------------------------------------------------
// Chronic migraine & preventive treatment

export const chronicMigraineRule: Rule = (ctx) => {
  const w = windowEnding(ctx.today, 30);
  const hd = headacheDays(ctx.state, w).size;
  const md = migraineDays(ctx.state.attacks, w).size;
  if (hd >= 15 && md >= 8) {
    return [
      {
        id: 'chronic-migraine',
        severity: 'warning',
        category: 'prevention',
        title: 'Headache frequency is in the chronic migraine range',
        detail: `${hd} headache days in the last 30 days, ${md} of them migraine. Chronic migraine is diagnosed when this lasts more than 3 months. Its treatment options include onabotulinumtoxinA and CGRP-targeting medicines, which are worth discussing with a headache specialist.`,
        sources: ['ichd-3', 'aan-ahs-2026-prevention'],
      },
    ];
  }
  return [];
};

export const preventionRule: Rule = (ctx) => {
  const out: Recommendation[] = [];
  const w = windowEnding(ctx.today, 30);
  const mmd = migraineDays(ctx.state.attacks, w).size;
  const msd = moderateSevereDays(ctx.state.attacks, w).size;
  const midas = latestMidas(ctx.state);
  const midasDisabling = midas ? midasScore(midas) >= 11 : false;
  const recent = recentAttacks(ctx, 30);
  const interferes =
    midasDisabling || recent.filter((a) => a.disability === 'moderate' || a.disability === 'severe').length >= 2;
  const indicated = mmd >= 4 || msd >= 4 || interferes;
  const preventives = ctx.activeMeds.filter((m) => m.role === 'preventive');

  if (indicated && preventives.length === 0) {
    const reasons = [
      mmd >= 4 && `${mmd} migraine days in the last 30 days`,
      msd >= 4 && mmd < 4 && `${msd} moderate-to-severe headache days`,
      interferes && (midasDisabling ? `MIDAS score ${midasScore(midas!)} (${midasGrade(midasScore(midas!)).label.toLowerCase()})` : 'attacks are disrupting work or daily activities'),
    ].filter(Boolean);
    out.push({
      id: 'prevention-indicated',
      severity: 'warning',
      category: 'prevention',
      title: 'Preventive treatment should be offered',
      detail: `${reasons.join('; ')}. The 2026 AAN/AHS guideline recommends offering preventive treatment at this level. Options include CGRP monoclonal antibodies, atogepant, propranolol, topiramate and others. The AHS says CGRP-targeting medicines can be a first choice, without first trying older drugs. Bring this summary to your next visit.`,
      sources: ['aan-ahs-2026-prevention', 'ahs-2024-cgrp'],
    });
  } else if (preventives.length > 0) {
    out.push({
      id: 'prevention-monitor',
      severity: 'info',
      category: 'prevention',
      title: 'Track how well your preventive is working',
      detail: `You take ${preventives.map((p) => p.name).join(', ')}. Keep logging, because the main measure of benefit is the change in monthly migraine days (a 50% reduction is the usual goal). Most preventives need 2–3 months at a target dose before they can be judged. Currently: ${mmd} migraine days in 30 days.`,
      sources: ['aan-ahs-2026-prevention', 'ahs-2021-consensus'],
    });
  }

  const { childbearingPotential, pregnant } = ctx.state.profile;
  const teratogenic = named(ctx, /valpro|topiramate/i);
  if ((childbearingPotential || pregnant) && teratogenic.length) {
    out.push({
      id: 'teratogen-counsel',
      severity: 'warning',
      category: 'interaction',
      title: `${teratogenic.map((m) => m.name).join(' and ')}: risk to a pregnancy`,
      detail: 'These medicines can harm a developing baby. The 2026 AAN/AHS guideline says people who could become pregnant must be told about this risk, and that these drugs should be avoided if possible (Level A). Discuss contraception or alternatives with your clinician.',
      sources: ['aan-ahs-2026-prevention'],
    });
  }
  if (named(ctx, /topiramate/i).length && (has(ctx, 'hormonal-contraceptive-combined') || has(ctx, 'hormonal-contraceptive-progestin'))) {
    out.push({
      id: 'topiramate-contraception',
      severity: 'info',
      category: 'interaction',
      title: 'Topiramate may weaken hormonal contraception',
      detail: 'At doses above 200 mg/day, topiramate can make hormonal contraception less effective. Confirm your dose and contraception plan with your clinician.',
      sources: ['aan-ahs-2026-prevention'],
    });
  }
  return out;
};

// ---------------------------------------------------------------------------------------
// Acute treatment effectiveness

export interface MedicationResponse {
  medication: Medication;
  rated: number;
  painFree: number;
  partial: number;
  none: number;
  recurrence: number;
  /** Median minutes from attack onset to first dose. */
  medianDelayMin: number | null;
}

export function medicationResponses(state: AppState): MedicationResponse[] {
  const out: MedicationResponse[] = [];
  for (const med of state.medications.filter((m) => m.role === 'acute')) {
    const uses: { attack: Attack; relief?: string; recurrence?: boolean; takenAt: string }[] = [];
    for (const a of state.attacks) {
      const doses = a.doses.filter((d) => d.medicationId === med.id).sort((x, y) => x.takenAt.localeCompare(y.takenAt));
      if (doses.length) uses.push({ attack: a, relief: doses[0].reliefAt2h, recurrence: doses[0].recurrence, takenAt: doses[0].takenAt });
    }
    if (!uses.length) continue;
    const rated = uses.filter((u) => u.relief);
    const delays = uses.map((u) => hoursBetween(u.attack.start, u.takenAt) * 60).filter((d) => d >= 0).sort((a, b) => a - b);
    out.push({
      medication: med,
      rated: rated.length,
      painFree: rated.filter((u) => u.relief === 'pain-free').length,
      partial: rated.filter((u) => u.relief === 'partial').length,
      none: rated.filter((u) => u.relief === 'none').length,
      recurrence: uses.filter((u) => u.recurrence).length,
      medianDelayMin: delays.length ? delays[Math.floor(delays.length / 2)] : null,
    });
  }
  return out;
}

export const acuteTreatmentRule: Rule = (ctx) => {
  const out: Recommendation[] = [];
  const responses = medicationResponses(ctx.state);
  const failingTriptans: string[] = [];

  for (const r of responses) {
    if (r.rated < 3) continue;
    const helped = (r.painFree + r.partial) / r.rated;
    if (helped < 0.5 || r.painFree / r.rated < 0.2) {
      if (r.medication.cls === 'triptan') failingTriptans.push(r.medication.name);
      out.push({
        id: `acute-poor-${r.medication.id}`,
        severity: 'warning',
        category: 'acute-treatment',
        title: `${r.medication.name} is often not working`,
        detail: `Pain-free at 2 hours in ${r.painFree}/${r.rated} attacks, partly better in ${r.partial}/${r.rated}. Ask your clinician about the dose, taking it earlier, a different form (nasal, injection), combining it with an NSAID, or switching.`,
        sources: ['ahs-2021-consensus'],
      });
    } else if (r.painFree / r.rated >= 0.6) {
      out.push({
        id: `acute-good-${r.medication.id}`,
        severity: 'positive',
        category: 'acute-treatment',
        title: `${r.medication.name} is working well`,
        detail: `Pain-free at 2 hours in ${r.painFree}/${r.rated} rated attacks, which meets the main goal of acute treatment.`,
        sources: ['ahs-2021-consensus'],
      });
    }
    if (r.recurrence / r.rated >= 0.4) {
      out.push({
        id: `acute-recurrence-${r.medication.id}`,
        severity: 'info',
        category: 'acute-treatment',
        title: `Pain often returns after ${r.medication.name}`,
        detail: `Pain returned within 48 hours in ${r.recurrence} of ${r.rated} attacks. Options to discuss include a longer-acting triptan, adding an NSAID, or a second dose plan.`,
        sources: ['ahs-2021-consensus'],
      });
    }
    if (r.medianDelayMin !== null && r.medianDelayMin > 60 && ['triptan', 'gepant', 'ditan', 'nsaid'].includes(r.medication.cls)) {
      out.push({
        id: `acute-late-${r.medication.id}`,
        severity: 'info',
        category: 'acute-treatment',
        title: `${r.medication.name} is usually taken late`,
        detail: `Median ${Math.round(r.medianDelayMin)} minutes after onset. Acute medicines work best when taken early, while pain is still mild. With triptans, this matters most before skin sensitivity (allodynia) develops.`,
        sources: ['ahs-2021-consensus'],
      });
    }
  }

  if (failingTriptans.length >= 2 && !has(ctx, 'gepant') && !has(ctx, 'ditan')) {
    out.push({
      id: 'triptan-nonresponse',
      severity: 'warning',
      category: 'acute-treatment',
      title: 'Two or more triptans have not worked well enough',
      detail: `${failingTriptans.join(' and ')} have not worked well. The AHS consensus suggests considering a gepant (ubrogepant, rimegepant, zavegepant) or lasmiditan in this situation.`,
      sources: ['ahs-2021-consensus'],
    });
  }

  const recent = recentAttacks(ctx, 60);
  const nauseous = recent.filter((a) => a.symptoms.includes('nausea') || a.symptoms.includes('vomiting'));
  if (recent.length >= 4 && nauseous.length / recent.length >= 0.5 && !has(ctx, 'antiemetic')) {
    out.push({
      id: 'nausea-route',
      severity: 'info',
      category: 'acute-treatment',
      title: 'Nausea in most attacks',
      detail: `Nausea or vomiting in ${nauseous.length} of ${recent.length} recent attacks. Tablets may not be absorbed well during an attack. Ask about non-oral options (nasal spray, injection, dissolving tablets) or an anti-nausea medicine.`,
      sources: ['ahs-2021-consensus'],
    });
  }

  const opioids = ctx.activeMeds.filter((m) => m.cls === 'opioid' || /butalbital/i.test(m.name));
  if (opioids.length) {
    out.push({
      id: 'opioid-use',
      severity: 'warning',
      category: 'acute-treatment',
      title: 'Opioids or butalbital for migraine',
      detail: `${opioids.map((m) => m.name).join(', ')}: these are not recommended for routine migraine treatment because they raise the risk of medication-overuse headache and dependence. Ask about migraine-specific alternatives.`,
      sources: ['ahs-2021-consensus'],
    });
  }

  if (has(ctx, 'ditan')) {
    out.push({
      id: 'lasmiditan-driving',
      severity: 'info',
      category: 'acute-treatment',
      title: 'Lasmiditan: do not drive for 8 hours',
      detail: 'Lasmiditan can impair driving and cause sleepiness. Do not drive or operate machinery for at least 8 hours after a dose.',
      sources: ['ahs-2021-consensus'],
    });
  }
  return out;
};

// ---------------------------------------------------------------------------------------
// Contraindications and interactions

const VASCULAR = ['coronary-disease', 'stroke-tia', 'peripheral-vascular', 'uncontrolled-hypertension'];

export const interactionRule: Rule = (ctx) => {
  const out: Recommendation[] = [];
  const vasoconstrictors = ctx.activeMeds.filter((m) => m.cls === 'triptan' || m.cls === 'ergot');
  const vascular = VASCULAR.filter((c) => hasCondition(ctx, c));
  if (vasoconstrictors.length && vascular.length) {
    out.push({
      id: 'triptan-vascular',
      severity: 'warning',
      category: 'interaction',
      title: 'Triptans and ergots with heart or blood vessel disease',
      detail: `${vasoconstrictors.map((m) => m.name).join(', ')} narrow blood vessels and are contraindicated with ${vascular.join(', ').replace(/-/g, ' ')}. Gepants and lasmiditan do not narrow blood vessels. Review this with your prescriber.`,
      sources: ['ahs-2021-consensus'],
    });
  }

  const maoiSensitive = named(ctx, /suma|riza|zolmi/i).filter((m) => m.cls === 'triptan');
  if (maoiSensitive.length && has(ctx, 'maoi')) {
    out.push({
      id: 'triptan-maoi',
      severity: 'warning',
      category: 'interaction',
      title: 'Triptan with an MAO inhibitor',
      detail: `${maoiSensitive.map((m) => m.name).join(', ')} should not be used within 2 weeks of an MAO-A inhibitor. Other triptans (eletriptan, naratriptan, frovatriptan, almotriptan) are less affected. Check with your prescriber.`,
      sources: ['ahs-2021-consensus'],
    });
  }

  if (has(ctx, 'triptan') && (has(ctx, 'ssri') || has(ctx, 'snri'))) {
    out.push({
      id: 'triptan-ssri',
      severity: 'info',
      category: 'interaction',
      title: 'Triptan with an SSRI or SNRI',
      detail: 'The FDA has a warning about serotonin syndrome with this combination. The AHS concluded the risk is very low, and the combination does not need to be avoided. Seek care for agitation, fever, tremor, muscle jerks or a racing heart.',
      sources: ['ahs-2010-serotonin'],
    });
  }

  for (const a of recentAttacks(ctx, 30)) {
    const byId = new Map(ctx.state.medications.map((m) => [m.id, m]));
    const timed = a.doses.map((d) => ({ cls: byId.get(d.medicationId)?.cls, t: d.takenAt }));
    const triptans = timed.filter((d) => d.cls === 'triptan');
    const ergots = timed.filter((d) => d.cls === 'ergot');
    if (triptans.some((t) => ergots.some((e) => Math.abs(hoursBetween(t.t, e.t)) < 24))) {
      out.push({
        id: 'triptan-ergot-24h',
        severity: 'warning',
        category: 'interaction',
        title: 'Triptan and ergot taken within 24 hours',
        detail: 'Triptans and ergots (including DHE) should not be taken within 24 hours of each other, because together they can narrow blood vessels too much.',
        sources: ['ahs-2021-consensus'],
      });
      break;
    }
  }

  if (named(ctx, /rizatriptan/i).length && named(ctx, /propranolol/i).length) {
    out.push({
      id: 'riza-propranolol',
      severity: 'info',
      category: 'interaction',
      title: 'Rizatriptan with propranolol',
      detail: 'Propranolol raises rizatriptan levels, so the recommended rizatriptan dose is 5 mg (maximum 15 mg in 24 hours). Check your prescription.',
      sources: ['ahs-2021-consensus'],
    });
  }

  const auraAttacks = ctx.state.attacks.filter(hasAura);
  if (has(ctx, 'hormonal-contraceptive-combined') && auraAttacks.length) {
    out.push({
      id: 'chc-aura',
      severity: 'warning',
      category: 'interaction',
      title: 'Estrogen-containing contraception with migraine with aura',
      detail: `You have logged ${plural(auraAttacks.length, 'attack')} with aura. CDC guidance rates combined hormonal contraception as an unacceptable stroke risk (category 4) for people with migraine with aura. Talk to your prescriber about progestin-only or non-hormonal options.`,
      sources: ['cdc-us-mec'],
    });
  }

  if (ctx.state.profile.pregnant) {
    const avoid = ctx.activeMeds.filter((m) =>
      ['ergot', 'cgrp-mab', 'gepant', 'arb-ace', 'anticonvulsant'].includes(m.cls) || /valpro|topiramate/i.test(m.name),
    );
    if (avoid.length) {
      out.push({
        id: 'pregnancy-meds',
        severity: 'warning',
        category: 'interaction',
        title: 'Medicines to review in pregnancy',
        detail: `${avoid.map((m) => m.name).join(', ')}: these are contraindicated, or there is not enough safety data, during pregnancy. Contact your prescriber before your next dose. Do not stop anticonvulsants abruptly without advice.`,
        sources: ['aan-ahs-2026-prevention'],
      });
    }
  }

  if (has(ctx, 'nsaid')) {
    const risks = [
      has(ctx, 'anticoagulant') && 'an anticoagulant (bleeding risk)',
      hasCondition(ctx, 'gi-bleed') && 'a history of ulcers or GI bleeding',
      hasCondition(ctx, 'kidney-disease') && 'kidney disease',
      vascular.length > 0 && 'cardiovascular disease',
    ].filter(Boolean);
    if (risks.length) {
      out.push({
        id: 'nsaid-risk',
        severity: 'warning',
        category: 'interaction',
        title: 'NSAID caution',
        detail: `You take an NSAID and have ${risks.join(', ')}. Ask your clinician whether it is safe for you and how often you can use it.`,
        sources: ['ahs-2021-consensus'],
      });
    }
  }

  if (has(ctx, 'beta-blocker') && hasCondition(ctx, 'asthma')) {
    out.push({
      id: 'beta-blocker-asthma',
      severity: 'warning',
      category: 'interaction',
      title: 'Beta-blocker with asthma',
      detail: 'Non-selective beta-blockers such as propranolol can trigger bronchospasm in asthma. Confirm this with your prescriber.',
      sources: ['aan-ahs-2026-prevention'],
    });
  }

  if (named(ctx, /topiramate/i).length && (hasCondition(ctx, 'kidney-stones') || hasCondition(ctx, 'glaucoma'))) {
    out.push({
      id: 'topiramate-conditions',
      severity: 'warning',
      category: 'interaction',
      title: 'Topiramate with kidney stones or glaucoma',
      detail: 'Topiramate raises the risk of kidney stones and can cause acute angle-closure glaucoma. Review this with your prescriber.',
      sources: ['aan-ahs-2026-prevention'],
    });
  }
  return out;
};

// ---------------------------------------------------------------------------------------
// Supplements

export const supplementRule: Rule = (ctx) => {
  const out: Recommendation[] = [];
  const active = ctx.state.supplements.filter((s) => s.active);
  const kinds = new Set(active.map((s) => s.kind));
  const sources = ['aan-ahs-2012-complementary', 'nice-cg150'];

  for (const s of active) {
    const info = SUPPLEMENT_CATALOG.find((c) => c.kind === s.kind);
    if (!info) continue;
    if (info.evidenceDoseMg && s.dailyMg !== undefined && s.dailyMg < info.evidenceDoseMg) {
      out.push({
        id: `supp-dose-${s.id}`,
        severity: 'info',
        category: 'supplement',
        title: `${info.label}: dose is below what studies used`,
        detail: `You take ${s.dailyMg} mg/day. Trials that found benefit used about ${info.evidenceDoseMg} mg/day. ${info.evidence} Check with your clinician before changing the dose.`,
        sources,
      });
    }
    if (info.avoidInPregnancy && (ctx.state.profile.pregnant || ctx.state.profile.childbearingPotential)) {
      out.push({
        id: `supp-pregnancy-${s.id}`,
        severity: ctx.state.profile.pregnant ? 'warning' : 'info',
        category: 'supplement',
        title: `${info.label}: avoid in pregnancy`,
        detail: info.cautions ?? 'Avoid during pregnancy.',
        sources,
      });
    }
  }
  if (kinds.has('butterbur')) {
    out.push({
      id: 'butterbur-liver',
      severity: 'warning',
      category: 'supplement',
      title: 'Butterbur can damage the liver',
      detail: 'The AAN withdrew its butterbur recommendation in 2015 over reports of liver injury. If you use it, choose only certified PA-free products and ask your clinician about liver tests.',
      sources,
    });
  }
  if ((kinds.has('feverfew') || kinds.has('omega-3')) && has(ctx, 'anticoagulant')) {
    out.push({
      id: 'supp-bleeding',
      severity: 'warning',
      category: 'supplement',
      title: 'Supplement may increase bleeding with your anticoagulant',
      detail: 'Feverfew and high-dose omega-3 can add to the effect of anticoagulants. Tell your prescriber.',
      sources,
    });
  }
  if (kinds.has('magnesium') && hasCondition(ctx, 'kidney-disease')) {
    out.push({
      id: 'magnesium-kidney',
      severity: 'warning',
      category: 'supplement',
      title: 'Magnesium with kidney disease',
      detail: 'Magnesium can build up in the body when the kidneys are impaired. Check the dose with your clinician.',
      sources,
    });
  }

  const mmd = migraineDays(ctx.state.attacks, windowEnding(ctx.today, 30)).size;
  const missing = ['magnesium', 'riboflavin'].filter((k) => !kinds.has(k));
  if (mmd >= 2 && missing.length && !ctx.state.profile.pregnant) {
    out.push({
      id: 'supp-consider',
      severity: 'info',
      category: 'supplement',
      title: 'Low-risk supplements with some evidence',
      detail: `${missing
        .map((k) => SUPPLEMENT_CATALOG.find((c) => c.kind === k)!)
        .map((i) => `${i.label}: ${i.evidence}`)
        .join(' ')} These can be used alongside prescription preventives, but do not replace them when prevention is indicated.`,
      sources,
    });
  }
  return out;
};

// ---------------------------------------------------------------------------------------
// Personal patterns

export const patternRule: Rule = (ctx) => {
  const out: Recommendation[] = [];
  const triggers = analyzeTriggers(ctx.state);
  const strong = triggers.filter((t) => t.significant);
  const suggestive = triggers.filter((t) => !t.significant && t.relativeRisk >= 1.5 && t.exposedWithAttack >= 2);

  if (strong.length) {
    out.push({
      id: 'triggers-confirmed',
      severity: 'info',
      category: 'pattern',
      title: 'Triggers your data supports',
      detail: strong
        .map((t) => `${labelOf(TRIGGERS, t.trigger)}: attacks ${t.relativeRisk.toFixed(1)}× as likely on the day or next day (${t.exposedWithAttack}/${t.exposedDays} exposed days vs ${t.unexposedWithAttack}/${t.unexposedDays} other days)`)
        .join('; ') + '. Managing the ones you can control may lower attack frequency.',
      sources: ['amf-library', 'nice-cg150'],
    });
  }
  if (suggestive.length) {
    out.push({
      id: 'triggers-possible',
      severity: 'info',
      category: 'pattern',
      title: 'Possible triggers (not enough data yet)',
      detail: `${suggestive.map((t) => `${labelOf(TRIGGERS, t.trigger)} (${t.relativeRisk.toFixed(1)}×)`).join(', ')}. Keep doing daily check-ins to confirm or rule these out.`,
      sources: ['amf-library'],
    });
  }

  const tested = new Map(triggers.map((t) => [t.trigger, t]));
  const notSupported = ctx.state.patterns.triggers.map((b) => b.id).filter((id) => {
    const t = tested.get(id);
    return t && t.exposedDays >= 8 && t.ciHigh < 1.5 && t.relativeRisk < 1.2;
  });
  if (notSupported.length) {
    out.push({
      id: 'triggers-not-supported',
      severity: 'info',
      category: 'pattern',
      title: 'Suspected triggers your data does not support',
      detail: `${notSupported.map((id) => labelOf(TRIGGERS, id)).join(', ')}: in your logs, attacks were no more likely after these exposures. Avoiding a trigger that isn't one can reduce quality of life without helping.`,
      sources: ['amf-library'],
    });
  }

  const mp = menstrualPattern(ctx.state);
  if (mp?.meetsCriteria) {
    out.push({
      id: 'menstrual-migraine',
      severity: 'info',
      category: 'pattern',
      title: mp.pure ? 'Pattern fits pure menstrual migraine' : 'Pattern fits menstrually related migraine',
      detail: `Attacks started from 2 days before to 3 days after your period began in ${mp.cyclesWithAttack} of ${mp.cycles} cycles. Options to discuss include short-term prevention around your period (for example frovatriptan or naratriptan, or an NSAID), or adjusting hormonal treatment.`,
      sources: ['ichd-3', 'amf-library'],
    });
  }

  const meals = triggers.find((t) => t.trigger === 'late-meal' || t.trigger === 'skipped-meal');
  if (meals && meals.relativeRisk >= 1.5) {
    out.push({
      id: 'meal-timing',
      severity: 'info',
      category: 'pattern',
      title: 'Meal timing matters for you',
      detail: `Late or skipped meals precede more of your attacks. Practical steps include a fixed lunch time, a reminder before ${THRESHOLDS.lateLunch}, and keeping a snack with protein on hand for long days.`,
      sources: ['amf-library'],
    });
  }
  return out;
};

// ---------------------------------------------------------------------------------------
// Wearables: today's readings vs personal baseline

export const wearableRule: Rule = (ctx) => {
  const out: Recommendation[] = [];
  const latest = (metric: string) => {
    const samples = ctx.state.wearableSamples.filter((s) => s.metric === metric && s.date >= addDays(ctx.today, -1));
    return samples.length ? samples[samples.length - 1].value : undefined;
  };
  const baseline = (metric: string) => {
    const vals = ctx.state.wearableSamples
      .filter((s) => s.metric === metric && s.date < addDays(ctx.today, -1) && s.date >= addDays(ctx.today, -31))
      .map((s) => s.value);
    if (vals.length < 7) return undefined;
    const m = vals.reduce((a, b) => a + b, 0) / vals.length;
    const sd = Math.sqrt(vals.reduce((a, b) => a + (b - m) ** 2, 0) / (vals.length - 1));
    return { m, sd };
  };

  const signals: string[] = [];
  for (const [metric, label, dir] of [
    ['hrvRmssd', 'HRV', -1],
    ['hrvSdnn', 'HRV', -1],
    ['restingHeartRate', 'resting heart rate', 1],
    ['sleepScore', 'sleep score', -1],
    ['readinessScore', 'readiness score', -1],
  ] as const) {
    const v = latest(metric);
    const b = baseline(metric);
    if (v === undefined || !b || b.sd === 0) continue;
    if ((v - b.m) / b.sd * dir >= 1) signals.push(`${label} ${Math.round(v)} vs your usual ${Math.round(b.m)}`);
  }
  const sleep = latest('sleepMinutes');
  if (sleep !== undefined && sleep < THRESHOLDS.shortSleepHours * 60) signals.push(`only ${(sleep / 60).toFixed(1)} h sleep`);

  if (signals.length) {
    const personal = compareMetrics(ctx.state).filter((c) => Math.abs(c.effectSize) >= 0.5).map((c) => c.label);
    out.push({
      id: 'wearable-strain',
      severity: 'info',
      category: 'wearable',
      title: 'Your wearable shows a strained day',
      detail: `${signals.join('; ')}.${
        personal.length ? ` In your history, ${personal.join(', ')} differed noticeably before attacks.` : ''
      } On days like this: eat lunch on time, drink water, avoid extra caffeine, take breaks, and keep your acute medicine with you. This is a personal pattern signal, not a validated prediction.`,
      sources: ['amf-library'],
    });
  }
  return out;
};

// ---------------------------------------------------------------------------------------
// Data quality

export const dataQualityRule: Rule = (ctx) => {
  const out: Recommendation[] = [];
  const since = addDays(ctx.today, -29);
  const logs = ctx.state.dailyLogs.filter((l) => l.date >= since).length;
  if (logs < 20) {
    out.push({
      id: 'checkins-low',
      severity: 'info',
      category: 'data-quality',
      title: 'More daily check-ins will sharpen the analysis',
      detail: `${logs} check-ins in the last 30 days. Trigger analysis compares days before attacks with attack-free days, so it needs check-ins on good days too. Daily check-ins take under a minute.`,
      sources: ['nice-cg150'],
    });
  }
  const unrated = recentAttacks(ctx, 60).filter((a) => a.doses.some((d) => !d.reliefAt2h)).length;
  if (unrated >= 2) {
    out.push({
      id: 'relief-unrated',
      severity: 'info',
      category: 'data-quality',
      title: 'Rate how your medicine worked',
      detail: `${unrated} recent attacks have doses without a 2-hour relief rating. These ratings show whether your acute treatment is working.`,
      sources: ['ahs-2021-consensus'],
    });
  }
  const midas = latestMidas(ctx.state);
  if (!midas || midas.date < addDays(ctx.today, -90)) {
    out.push({
      id: 'midas-due',
      severity: 'info',
      category: 'data-quality',
      title: 'Complete the MIDAS disability questionnaire',
      detail: 'MIDAS takes 2 minutes and measures how migraine affects your work and life over 3 months. Guidelines use disability, not only attack frequency, to decide on prevention.',
      sources: ['aan-ahs-2026-prevention'],
    });
  }
  return out;
};

export const RULES: Rule[] = [
  redFlagRule,
  medicationOveruseRule,
  chronicMigraineRule,
  preventionRule,
  acuteTreatmentRule,
  interactionRule,
  supplementRule,
  patternRule,
  wearableRule,
  dataQualityRule,
];
