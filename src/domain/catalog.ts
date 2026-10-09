import type { MedicationClass, MedicationRole } from './types';

export interface Option {
  id: string;
  label: string;
}

const opts = (pairs: [string, string][]): Option[] => pairs.map(([id, label]) => ({ id, label }));

export const PAIN_LOCATIONS = opts([
  ['left', 'Left side'],
  ['right', 'Right side'],
  ['bilateral', 'Both sides'],
  ['frontal', 'Forehead'],
  ['temple', 'Temples'],
  ['behind-eye', 'Behind the eye'],
  ['occipital', 'Back of head'],
  ['neck', 'Neck'],
  ['vertex', 'Top of head'],
]);

export const PAIN_QUALITIES = opts([
  ['throbbing', 'Throbbing / pulsating'],
  ['pressing', 'Pressing / tight'],
  ['stabbing', 'Stabbing'],
  ['dull', 'Dull ache'],
  ['burning', 'Burning'],
]);

export const SYMPTOMS = opts([
  ['nausea', 'Nausea'],
  ['vomiting', 'Vomiting'],
  ['photophobia', 'Light sensitivity'],
  ['phonophobia', 'Sound sensitivity'],
  ['osmophobia', 'Smell sensitivity'],
  ['aura-visual', 'Visual aura (zigzags, spots, blind spot)'],
  ['aura-sensory', 'Sensory aura (tingling, numbness)'],
  ['aura-speech', 'Speech/language aura'],
  ['aura-motor', 'Weakness on one side'],
  ['dizziness', 'Dizziness / vertigo'],
  ['neck-pain', 'Neck stiffness'],
  ['fatigue', 'Fatigue'],
  ['brain-fog', 'Difficulty concentrating'],
  ['allodynia', 'Scalp/skin sensitivity (allodynia)'],
  ['yawning', 'Yawning / food cravings (prodrome)'],
  ['mood-change', 'Mood change (prodrome)'],
]);

export const AURA_SYMPTOMS = ['aura-visual', 'aura-sensory', 'aura-speech', 'aura-motor'];

/**
 * Exposures, used both for attack-level "what do you think triggered it" and for
 * daily check-ins (which provide the unexposed-day denominator for trigger analysis).
 */
export const TRIGGERS = opts([
  ['stress', 'Stress'],
  ['stress-letdown', 'Relaxing after stress (let-down)'],
  ['poor-sleep', 'Poor or short sleep'],
  ['oversleep', 'Oversleeping'],
  ['skipped-meal', 'Skipped meal'],
  ['late-meal', 'Late lunch (after 3 pm)'],
  ['conflict', 'Argument, shouting or conflict'],
  ['long-workday', 'Long working hours'],
  ['not-rested', 'Not feeling rested'],
  ['low-sleep-score', 'Low sleep score (wearable)'],
  ['low-readiness', 'Low readiness / recovery score'],
  ['dehydration', 'Dehydration'],
  ['alcohol', 'Alcohol'],
  ['red-wine', 'Red wine'],
  ['caffeine-excess', 'More caffeine than usual'],
  ['caffeine-withdrawal', 'Less caffeine than usual'],
  ['menstruation', 'Menstruation'],
  ['ovulation', 'Ovulation'],
  ['weather', 'Weather / pressure change'],
  ['bright-light', 'Bright or flickering light'],
  ['screen-time', 'Long screen time'],
  ['strong-smell', 'Strong smells / perfume'],
  ['loud-noise', 'Loud noise'],
  ['travel', 'Travel'],
  ['intense-exercise', 'Intense exercise'],
  ['aged-cheese', 'Aged cheese'],
  ['chocolate', 'Chocolate'],
  ['processed-meat', 'Processed meat (nitrates)'],
  ['msg', 'MSG'],
  ['aspartame', 'Artificial sweeteners'],
  ['heat', 'Heat'],
  ['neck-tension', 'Neck / shoulder tension'],
]);

/** Premonitory (prodrome) symptoms that can precede the headache by hours to a day. */
export const WARNING_SIGNS = opts([
  ['yawning', 'Frequent yawning'],
  ['neck-stiffness', 'Neck stiffness'],
  ['fatigue', 'Unusual tiredness'],
  ['food-craving', 'Food cravings'],
  ['mood-change', 'Irritability or low mood'],
  ['concentration', 'Trouble concentrating'],
  ['light-sensitivity', 'Light sensitivity'],
  ['frequent-urination', 'Frequent urination'],
  ['thirst', 'Increased thirst'],
  ['blurred-vision', 'Blurred vision'],
]);

export const ALLEVIATORS = opts([
  ['dark-room', 'Resting in a dark, quiet room'],
  ['sleep', 'Sleep'],
  ['cold-compress', 'Cold compress'],
  ['heat-pack', 'Heat pack'],
  ['hydration', 'Drinking water'],
  ['caffeine', 'Caffeine'],
  ['eating', 'Eating'],
  ['massage', 'Massage / pressure'],
  ['vomiting', 'Vomiting'],
  ['fresh-air', 'Fresh air'],
  ['breathing', 'Relaxation / breathing'],
  ['neuromodulation', 'Neuromodulation device'],
  ['medication', 'Medication'],
]);

export const EXACERBATORS = opts([
  ['movement', 'Movement / climbing stairs'],
  ['light', 'Light'],
  ['noise', 'Noise'],
  ['smells', 'Smells'],
  ['bending', 'Bending over'],
  ['coughing', 'Coughing / straining'],
  ['screens', 'Screens'],
  ['lying-down', 'Lying down'],
  ['standing-up', 'Standing up'],
  ['heat', 'Heat'],
]);

/**
 * Red flags adapted from SNNOOP10 (Do et al., Neurology 2019). Any of these warrants
 * urgent medical assessment rather than self-management.
 */
export const RED_FLAGS: (Option & { urgent: boolean })[] = [
  { id: 'thunderclap', label: 'Sudden, explosive onset (peak within 1 minute)', urgent: true },
  { id: 'worst-ever', label: 'Worst headache of my life', urgent: true },
  { id: 'neuro-deficit', label: 'Weakness, numbness, confusion or speech trouble that is new or not my usual aura', urgent: true },
  { id: 'fever-stiff-neck', label: 'Fever with stiff neck or rash', urgent: true },
  { id: 'head-injury', label: 'Started after a head injury', urgent: true },
  { id: 'vision-loss', label: 'Sudden loss of vision or double vision', urgent: true },
  { id: 'seizure', label: 'Seizure or fainting', urgent: true },
  { id: 'positional', label: 'Much worse lying down or standing up', urgent: false },
  { id: 'valsalva', label: 'Triggered by coughing, sneezing or straining', urgent: false },
  { id: 'pattern-change', label: 'Clearly different from my usual headaches', urgent: false },
  { id: 'progressive', label: 'Getting steadily worse over weeks', urgent: false },
  { id: 'pregnancy-postpartum', label: 'Pregnant or recently gave birth', urgent: false },
  { id: 'immunocompromised', label: 'Weakened immune system or history of cancer', urgent: false },
];

export const CONDITIONS = opts([
  ['coronary-disease', 'Coronary artery disease / heart attack'],
  ['stroke-tia', 'Stroke or TIA'],
  ['peripheral-vascular', 'Peripheral vascular disease'],
  ['uncontrolled-hypertension', 'High blood pressure (not well controlled)'],
  ['hypertension', 'High blood pressure (controlled)'],
  ['asthma', 'Asthma'],
  ['depression', 'Depression'],
  ['anxiety', 'Anxiety'],
  ['kidney-disease', 'Kidney disease'],
  ['liver-disease', 'Liver disease'],
  ['kidney-stones', 'Kidney stones'],
  ['glaucoma', 'Glaucoma'],
  ['obesity', 'Obesity'],
  ['raynaud', "Raynaud's"],
  ['gi-bleed', 'Stomach ulcer or GI bleeding'],
  ['smoker', 'Smoker'],
  ['sleep-apnea', 'Sleep apnea'],
]);

export interface CatalogMedication {
  name: string;
  cls: MedicationClass;
  role: MedicationRole;
}

/** Common medications, so the patient can pick from a list and get the class right. */
export const MEDICATION_CATALOG: CatalogMedication[] = [
  // Acute — triptans
  ...['Sumatriptan', 'Rizatriptan', 'Zolmitriptan', 'Eletriptan', 'Naratriptan', 'Frovatriptan', 'Almotriptan'].map(
    (name) => ({ name, cls: 'triptan' as const, role: 'acute' as const }),
  ),
  { name: 'Dihydroergotamine (DHE)', cls: 'ergot', role: 'acute' },
  { name: 'Ergotamine', cls: 'ergot', role: 'acute' },
  { name: 'Ubrogepant', cls: 'gepant', role: 'acute' },
  { name: 'Rimegepant', cls: 'gepant', role: 'acute' },
  { name: 'Zavegepant (nasal)', cls: 'gepant', role: 'acute' },
  { name: 'Lasmiditan', cls: 'ditan', role: 'acute' },
  { name: 'Ibuprofen', cls: 'nsaid', role: 'acute' },
  { name: 'Naproxen', cls: 'nsaid', role: 'acute' },
  { name: 'Diclofenac', cls: 'nsaid', role: 'acute' },
  { name: 'Aspirin', cls: 'nsaid', role: 'acute' },
  { name: 'Celecoxib (oral solution)', cls: 'nsaid', role: 'acute' },
  { name: 'Acetaminophen / Paracetamol', cls: 'simple-analgesic', role: 'acute' },
  { name: 'Acetaminophen + Aspirin + Caffeine', cls: 'combination-analgesic', role: 'acute' },
  { name: 'Sumatriptan + Naproxen', cls: 'triptan', role: 'acute' },
  { name: 'Butalbital combination', cls: 'combination-analgesic', role: 'acute' },
  { name: 'Codeine / Tramadol / other opioid', cls: 'opioid', role: 'acute' },
  { name: 'Metoclopramide', cls: 'antiemetic', role: 'acute' },
  { name: 'Prochlorperazine', cls: 'antiemetic', role: 'acute' },
  { name: 'Ondansetron', cls: 'antiemetic', role: 'acute' },
  // Preventive
  { name: 'Propranolol', cls: 'beta-blocker', role: 'preventive' },
  { name: 'Metoprolol', cls: 'beta-blocker', role: 'preventive' },
  { name: 'Topiramate', cls: 'anticonvulsant', role: 'preventive' },
  { name: 'Valproate / Divalproex', cls: 'anticonvulsant', role: 'preventive' },
  { name: 'Amitriptyline', cls: 'tricyclic', role: 'preventive' },
  { name: 'Nortriptyline', cls: 'tricyclic', role: 'preventive' },
  { name: 'Venlafaxine', cls: 'snri', role: 'preventive' },
  { name: 'Duloxetine', cls: 'snri', role: 'other' },
  { name: 'Candesartan', cls: 'arb-ace', role: 'preventive' },
  { name: 'Lisinopril', cls: 'arb-ace', role: 'preventive' },
  { name: 'Flunarizine', cls: 'calcium-channel-blocker', role: 'preventive' },
  { name: 'Verapamil', cls: 'calcium-channel-blocker', role: 'other' },
  { name: 'Erenumab', cls: 'cgrp-mab', role: 'preventive' },
  { name: 'Fremanezumab', cls: 'cgrp-mab', role: 'preventive' },
  { name: 'Galcanezumab', cls: 'cgrp-mab', role: 'preventive' },
  { name: 'Eptinezumab', cls: 'cgrp-mab', role: 'preventive' },
  { name: 'Atogepant', cls: 'gepant', role: 'preventive' },
  { name: 'Rimegepant (every other day)', cls: 'gepant', role: 'preventive' },
  { name: 'OnabotulinumtoxinA (Botox)', cls: 'onabotulinumtoxinA', role: 'preventive' },
  // Other medicines that matter for interactions
  { name: 'Sertraline', cls: 'ssri', role: 'other' },
  { name: 'Fluoxetine', cls: 'ssri', role: 'other' },
  { name: 'Escitalopram', cls: 'ssri', role: 'other' },
  { name: 'Citalopram', cls: 'ssri', role: 'other' },
  { name: 'Paroxetine', cls: 'ssri', role: 'other' },
  { name: 'Phenelzine', cls: 'maoi', role: 'other' },
  { name: 'Selegiline', cls: 'maoi', role: 'other' },
  { name: 'Combined oral contraceptive (estrogen + progestin)', cls: 'hormonal-contraceptive-combined', role: 'other' },
  { name: 'Progestin-only contraceptive', cls: 'hormonal-contraceptive-progestin', role: 'other' },
  { name: 'Warfarin', cls: 'anticoagulant', role: 'other' },
  { name: 'Apixaban / Rivaroxaban', cls: 'anticoagulant', role: 'other' },
];

export const MEDICATION_CLASS_LABELS: Record<MedicationClass, string> = {
  triptan: 'Triptan',
  ergot: 'Ergot',
  gepant: 'Gepant (CGRP receptor antagonist)',
  ditan: 'Ditan',
  nsaid: 'NSAID',
  'simple-analgesic': 'Simple analgesic',
  'combination-analgesic': 'Combination analgesic',
  opioid: 'Opioid',
  antiemetic: 'Antiemetic',
  'beta-blocker': 'Beta-blocker',
  anticonvulsant: 'Anticonvulsant',
  tricyclic: 'Tricyclic antidepressant',
  snri: 'SNRI',
  ssri: 'SSRI',
  maoi: 'MAO inhibitor',
  'cgrp-mab': 'CGRP monoclonal antibody',
  onabotulinumtoxinA: 'OnabotulinumtoxinA',
  'arb-ace': 'ARB / ACE inhibitor',
  'calcium-channel-blocker': 'Calcium-channel blocker',
  'hormonal-contraceptive-combined': 'Combined hormonal contraceptive',
  'hormonal-contraceptive-progestin': 'Progestin-only contraceptive',
  anticoagulant: 'Anticoagulant',
  other: 'Other',
};

export interface SupplementInfo {
  kind: string;
  label: string;
  /** Lower bound of the dose used in supportive trials, mg/day. */
  evidenceDoseMg?: number;
  evidence: string;
  cautions?: string;
  avoidInPregnancy?: boolean;
}

/**
 * Evidence levels from the AAN/AHS 2012 guideline on NSAIDs and complementary treatments
 * for episodic migraine prevention (Holland et al., Neurology 2012), with later safety notes.
 */
export const SUPPLEMENT_CATALOG: SupplementInfo[] = [
  {
    kind: 'magnesium',
    label: 'Magnesium',
    evidenceDoseMg: 400,
    evidence: 'Level B ("probably effective"); 400–600 mg/day, often as magnesium oxide or citrate.',
    cautions: 'Diarrhea is common. Avoid high doses in kidney disease.',
  },
  {
    kind: 'riboflavin',
    label: 'Riboflavin (vitamin B2)',
    evidenceDoseMg: 400,
    evidence: 'Level B; 400 mg/day. Benefit usually appears after about 3 months.',
    cautions: 'Turns urine bright yellow (harmless).',
  },
  {
    kind: 'coq10',
    label: 'Coenzyme Q10',
    evidenceDoseMg: 300,
    evidence: 'Level C ("possibly effective"); 100 mg three times daily in trials.',
  },
  {
    kind: 'feverfew',
    label: 'Feverfew',
    evidence: 'Level B, but products vary widely in strength.',
    cautions: 'Avoid in pregnancy. Stopping suddenly can cause rebound headaches. May increase bleeding with anticoagulants.',
    avoidInPregnancy: true,
  },
  {
    kind: 'butterbur',
    label: 'Butterbur (Petasites)',
    evidence: 'Was Level A, but the AAN withdrew its endorsement in 2015 over liver-toxicity concerns.',
    cautions: 'Only certified PA-free extracts. Can cause liver injury. Avoid in pregnancy and liver disease.',
    avoidInPregnancy: true,
  },
  {
    kind: 'melatonin',
    label: 'Melatonin',
    evidence: 'Mixed trial results; one trial found 3 mg comparable to amitriptyline 25 mg.',
    cautions: 'Can cause drowsiness.',
  },
  {
    kind: 'vitamin-d',
    label: 'Vitamin D',
    evidence: 'Limited evidence; mainly considered when the patient is deficient.',
  },
  {
    kind: 'omega-3',
    label: 'Omega-3 fatty acids',
    evidence: 'Limited; small trials suggest diets rich in omega-3 and low in omega-6 may help.',
    cautions: 'May increase bleeding with anticoagulants.',
  },
  { kind: 'other', label: 'Other', evidence: 'No migraine-specific evidence on file.' },
];

export const labelOf = (list: Option[], id: string): string => list.find((o) => o.id === id)?.label ?? id;
