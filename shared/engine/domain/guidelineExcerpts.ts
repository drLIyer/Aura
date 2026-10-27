import { GUIDELINES } from './guidelines';

/**
 * The passages the assistant may quote. Each is one line the registry already records under
 * `usedFor`: the same statements the rules engine is built on, so Ask can never cite something
 * the engine doesn't stand behind. They are short paraphrases, not the guideline text.
 *
 * Every excerpt needs review by a clinician before patients rely on answers built from it.
 * When a guideline changes, update its `usedFor` lines in guidelines.ts and they flow through here.
 */

export interface GuidelineExcerpt {
  /** "<guideline id>#<n>" */
  id: string;
  guidelineId: string;
  organization: string;
  title: string;
  text: string;
  /** Extra words that should find this excerpt in a search. */
  topics: string[];
  review: 'needs-clinician-review' | 'reviewed';
}

const TOPICS: Record<string, string[]> = {
  'aan-ahs-2026-prevention': ['prevention', 'preventive', 'how often', 'frequency', 'migraine days', 'topiramate', 'valproate', 'pregnancy', 'contraception'],
  'ahs-2024-cgrp': ['cgrp', 'gepant', 'antibody', 'prevention', 'aimovig', 'ajovy', 'emgality', 'vyepti', 'nurtec', 'qulipta'],
  'ahs-2021-consensus': ['acute', 'treatment', 'triptan', 'gepant', 'lasmiditan', 'overuse', 'early', 'not working'],
  'ichd-3': ['chronic', 'diagnosis', 'aura', 'status migrainosus', 'menstrual', 'period', 'cycle', '72 hours'],
  'ichd-3-moh': ['overuse', 'rebound', 'medication days', 'too much medicine', 'painkiller', 'triptan', 'nsaid'],
  'snnoop10': ['red flag', 'warning', 'emergency', 'worst', 'sudden', 'stroke', 'danger'],
  'aan-ahs-2012-complementary': ['supplement', 'magnesium', 'riboflavin', 'coq10', 'feverfew', 'butterbur', 'vitamin'],
  'nice-cg150': ['diary', 'riboflavin', 'overuse', 'supplement'],
  'ehf-2022-cgrp': ['cgrp', 'antibody', 'overuse'],
  'acog-2022-pregnancy-headache': ['pregnancy', 'pregnant', 'postpartum', 'tylenol', 'acetaminophen', 'metoclopramide', 'sumatriptan', 'opioid', 'butalbital', 'blood pressure', 'preeclampsia'],
  'fda-2020-nsaid-pregnancy': ['pregnancy', 'pregnant', 'nsaid', 'ibuprofen', 'naproxen', 'aspirin', 'advil', 'aleve', 'motrin', '20 weeks'],
  'cdc-us-mec': ['contraception', 'pill', 'estrogen', 'birth control', 'aura', 'stroke'],
  'ahs-2010-serotonin': ['ssri', 'snri', 'antidepressant', 'serotonin', 'triptan', 'interaction'],
  'kelman-2007-triggers': ['trigger', 'stress', 'hormones', 'sleep', 'food', 'skipped meal'],
  'pellegrino-2018-perceived': ['trigger', 'perceived', 'confirmed'],
  'macgregor-2004': ['period', 'menstrual', 'cycle', 'hormones'],
  'lipton-2014-letdown': ['stress', 'let-down', 'relaxing', 'weekend'],
  'holsteen-2020': ['stress', 'caffeine', 'prediction', 'forecast'],
  'lateef-2024-emotions': ['anger', 'mood', 'argument', 'conflict', 'stress'],
  'mosek-1995-fasting': ['fasting', 'skipped meal', 'not eating', 'lunch'],
  'vives-mestres-2022-alcohol': ['alcohol', 'wine', 'drink'],
  'mostofsky-2019-caffeine': ['caffeine', 'coffee'],
  'mukamal-2009-weather': ['weather', 'heat', 'temperature'],
  'hougaard-2013-provocation': ['light', 'exercise', 'trigger'],
  'giffin-2003-premonitory': ['warning signs', 'prodrome', 'yawning', 'before'],
  'amf-moh': ['overuse', 'rebound'],
  'amf-library': ['trigger', 'treatment', 'lifestyle'],
  'ahs-patient-guides': ['chronic', 'episodic', 'overuse'],
};

export const GUIDELINE_EXCERPTS: GuidelineExcerpt[] = GUIDELINES.flatMap((g) =>
  g.usedFor.map((text, i) => ({
    id: `${g.id}#${i}`,
    guidelineId: g.id,
    organization: g.organization,
    title: g.title,
    text,
    topics: TOPICS[g.id] ?? [],
    review: 'needs-clinician-review' as const,
  })),
);

const words = (s: string) => s.toLowerCase().match(/[a-z0-9]+/g) ?? [];
const STOP = new Set(['the', 'a', 'an', 'is', 'are', 'my', 'i', 'it', 'to', 'of', 'and', 'or', 'in', 'on', 'for', 'can', 'do', 'does', 'what', 'how', 'why', 'with', 'me', 'am', 'be', 'should', 'this', 'that']);

/** Simple keyword search over excerpt text, topics and source names. */
export function searchExcerpts(query: string, limit = 6): GuidelineExcerpt[] {
  const q = words(query).filter((w) => !STOP.has(w));
  if (!q.length) return [];
  const scored = GUIDELINE_EXCERPTS.map((e) => {
    const hay = `${e.text} ${e.topics.join(' ')} ${e.title}`.toLowerCase();
    const score = q.reduce((s, w) => s + (hay.includes(w) ? (e.topics.some((t) => t.includes(w)) ? 2 : 1) : 0), 0);
    return { e, score };
  });
  return scored
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.e);
}

export const excerptsFor = (guidelineId: string) => GUIDELINE_EXCERPTS.filter((e) => e.guidelineId === guidelineId);
