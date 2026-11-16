import type { SafetyScreen } from "./types";

/**
 * Fixed phrase screen for warning signs (SNNOOP10). Runs on every message before any provider,
 * in both modes, so an emergency never depends on a model. It errs towards flagging: a false
 * alarm costs a moment, a missed one can cost a life.
 */

interface Pattern {
  flag: string;
  re: RegExp;
  /** Ignore the match when a negation ("no", "not", "without") comes just before it. */
  negatable?: boolean;
}

const URGENT: Pattern[] = [
  { flag: "worst-ever", re: /\bworst (headache|migraine|pain)( of| in)? (my|her|his) (life|entire life)\b|\bworst (headache|migraine) ever\b/ },
  {
    flag: "thunderclap",
    re: /\b(thunderclap|like (a|being) (hit|struck)|explod\w*|exploded in my head|came on (suddenly|all of a sudden|instantly|in seconds)|sudden(ly)?,? (severe|explosive|excruciating|blinding)|hit me (suddenly|out of nowhere)|out of nowhere,? (the )?(worst|severe|excruciating))\b/,
  },
  {
    flag: "neuro-deficit",
    re: /\b(face (is )?droop\w*|drooping face|slurr\w* (speech|words)|speech (is |was )?slurr\w*|(can'?t|cannot|couldn'?t|unable to|not able to) (speak|talk|find (my )?words|move (my )?(arm|leg|hand|face))|weak(ness)? (in|on|down) (one|my (left|right)) (side|arm|leg|hand)|one side (of my body )?(is |went )?(weak|numb)|confus(ed|ion))\b/,
    negatable: true,
  },
  { flag: "vision-loss", re: /\b(lost (my )?(vision|sight)|went blind|can'?t see( anything)?|(sudden|seeing) double|double vision)\b/, negatable: true },
  { flag: "fever-stiff-neck", re: /\b(fever|temperature of)\b.{0,60}\b(stiff neck|neck (is )?stiff|rash)\b|\b(stiff neck|neck (is )?stiff)\b.{0,60}\bfever\b/, negatable: true },
  { flag: "head-injury", re: /\b(hit my head|banged my head|head injury|bumped my head|fell and hit|concussion)\b/, negatable: true },
  { flag: "seizure", re: /\b(seizure|had a fit|convuls\w*|fainted|passed out|blacked out|lost consciousness)\b/, negatable: true },
];

const REVIEW: Pattern[] = [
  { flag: "pattern-change", re: /\b(not (like )?my usual|different from (my )?usual|never had (one|a headache|a migraine) like (this|it)|unlike (my )?usual|new kind of headache)\b/ },
  { flag: "progressive", re: /\b(worse (and worse|every day|each day|for weeks)|getting (steadily )?worse (over|for) (weeks|a month))\b/ },
  { flag: "positional", re: /\b(worse (when|if) I (lie|lay) down|worse (when|if) I stand( up)?|better (when|if) I lie down)\b/ },
  { flag: "valsalva", re: /\b(when I (cough|sneeze|strain)|cough(ing)? (makes|made) it|sneez\w* (makes|made) it)\b/ },
  { flag: "pregnancy-postpartum", re: /\b(I'?m pregnant|while pregnant|weeks pregnant|gave birth|postpartum|just had (a|my) baby)\b/ },
];

const NEGATION = /\b(no|not|without|never|isn'?t|wasn'?t|don'?t|didn'?t|nothing like)\W+(\w+\W+){0,2}$/;

function matches(text: string, p: Pattern): boolean {
  const re = new RegExp(p.re.source, "gi");
  for (const m of text.matchAll(re)) {
    if (!p.negatable) return true;
    const before = text.slice(Math.max(0, m.index! - 30), m.index);
    if (!NEGATION.test(before)) return true;
  }
  return false;
}

export const URGENT_MESSAGE =
  "These can be signs of something other than migraine. Get emergency care now: call 911 or your local emergency number. Don't drive yourself.";

export function screenText(raw: string): SafetyScreen {
  const text = raw.toLowerCase().replace(/[’`]/g, "'");
  const urgent = URGENT.filter((p) => matches(text, p)).map((p) => p.flag);
  const review = REVIEW.filter((p) => matches(text, p)).map((p) => p.flag);
  const flags = [...new Set([...urgent, ...review])];
  return urgent.length ? { urgent: true, flags, message: URGENT_MESSAGE } : { urgent: false, flags };
}
