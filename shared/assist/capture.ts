import { addDays } from "../engine/domain/dates";
import { RED_FLAGS, TRIGGERS } from "../engine/domain/catalog";
import { screenText } from "./safetyScreen";
import type { AttackDraft, CaptureContext, CaptureProposal, CaptureQuestion, LifeEventInput, LocalDateTime } from "./types";

/**
 * Basic-mode capture: turns everyday wording into the app's own log fields with fixed rules.
 * It never guesses: anything it can't place goes in `heardButNotMapped`, and anything essential
 * that is missing becomes a question for the patient. Nothing is saved here.
 */

// ---------------------------------------------------------------- Phrase tables

type Table = [id: string, re: RegExp][];

const PAIN_LOCATION: Table = [
  ["bilateral", /\b(both sides|all over|whole head|on both)\b/],
  ["right", /\b(right[- ]side(d)?|right temple|right eye|on the right|right half)\b/],
  ["left", /\b(left[- ]side(d)?|left temple|left eye|on the left|left half)\b/],
  ["frontal", /\b(forehead|front of (my )?head)\b/],
  ["temple", /\btemples?\b/],
  ["behind-eye", /\bbehind (my |the )?eyes?\b/],
  ["occipital", /\bback of (my )?head\b/],
  ["vertex", /\btop of (my )?head\b/],
  ["neck", /\b(into|down) (my )?neck\b/],
];

const PAIN_QUALITY: Table = [
  ["throbbing", /\b(throbb\w*|pound\w*|puls\w*|beating)\b/],
  ["pressing", /\b(press\w*|tight\w*|squeez\w*|band around|vice)\b/],
  ["stabbing", /\b(stabb\w*|sharp|ice[- ]pick)\b/],
  ["dull", /\b(dull|aching|achy)\b/],
  ["burning", /\bburn\w*\b/],
];

const SYMPTOM: Table = [
  ["nausea", /\b(nause\w*|queasy|felt sick|feel(ing)? sick|sick to my stomach)\b/],
  ["vomiting", /\b(vomit\w*|threw up|throwing up|puk\w*)\b/],
  ["photophobia", /\b(light (hurt|hurts|bothered|was too bright)|couldn'?t stand the light|can'?t stand the light|sensitive to light|light sensitiv\w*|bright lights? hurt)\b/],
  ["phonophobia", /\b(noise (hurt|hurts|bothered)|sounds? (hurt|hurts|bothered)|sensitive to (sound|noise)|couldn'?t stand (the )?(noise|sound))\b/],
  ["osmophobia", /\b(smells? (made|make) (me|it)|sensitive to smells?)\b/],
  ["aura-visual", /\b(zig-?zags?|flashing lights|blind spot|sparkl\w*|shimmer\w*|visual aura|(an|my|the|with) aura)\b/],
  ["aura-sensory", /\b(tingl\w*|pins and needles)\b/],
  ["dizziness", /\b(dizz\w*|vertigo|room spinning|spinning)\b/],
  ["fatigue", /\b(exhausted|wiped out|so tired|fatigue\w*)\b/],
  ["brain-fog", /\b(brain fog|foggy|couldn'?t (think|concentrate|focus)|can'?t (think|concentrate|focus))\b/],
  ["allodynia", /\b(scalp (hurts|sore|tender)|hair hurts|skin (hurts|sore))\b/],
  ["yawning", /\byawn\w*\b/],
];

const TRIGGER: Table = [
  ["conflict", /\b(argu\w*|shout\w*|yell\w*|fight|fought|row with|screaming match|blew up at|confrontation)\b/],
  ["stress", /\b(stress(ed|ful)?|anxious|anxiety|overwhelmed|deadline)\b/],
  ["stress-letdown", /\b(let-?down|after the deadline|finally (relaxed|on holiday|on vacation))\b/],
  ["poor-sleep", /\b(slept (terribly|badly|poorly|bad|awful\w*)|bad night|barely slept|(didn'?t|couldn'?t|could not|did not) sleep|no sleep|little sleep|up all night|insomnia|poor sleep|short sleep)\b/],
  ["oversleep", /\b(overslept|slept in|slept too long|slept (for )?1[1-9] hours)\b/],
  ["not-rested", /\b(not rested|didn'?t feel rested|woke up (tired|exhausted)|unrefreshed)\b/],
  ["skipped-meal", /\b(skipped (lunch|breakfast|dinner|a meal|meals)|(didn'?t|did not|forgot to) eat|no (breakfast|lunch|dinner)|missed (lunch|breakfast|dinner|a meal))\b/],
  ["dehydration", /\b(dehydrat\w*|(didn'?t|did not|forgot to) drink (enough )?water|not enough water)\b/],
  ["red-wine", /\bred wine\b/],
  ["alcohol", /\b(a few drinks|had drinks|drinks (last night|yesterday)|drank (wine|beer|alcohol|a lot|too much)|beers?|wine|alcohol|cocktails?|hungover|hangover)\b/],
  ["caffeine-excess", /\b(extra coffee|more coffee than usual|too much coffee|[3-9] coffees|lots of coffee|energy drinks?)\b/],
  ["caffeine-withdrawal", /\b(no coffee|skipped (my )?coffee|missed (my )?coffee|less coffee|cut (out|back on) coffee)\b/],
  ["menstruation", /\b(my period|on my period|period started|time of the month|menstrua\w*)\b/],
  ["weather", /\b(weather|storm\w*|pressure change|barometric|humid\w*)\b/],
  ["bright-light", /\b(bright light|flicker\w*|glare|harsh light|sun(light)? in my eyes)\b/],
  ["screen-time", /\b(screens? all day|on (my |the )?(laptop|computer|screen) all day|screen time|staring at (my |the )?screen)\b/],
  ["strong-smell", /\b(perfume|cologne|strong smell\w*|fumes|paint smell)\b/],
  ["loud-noise", /\b(loud (noise|music|restaurant|party)|concert)\b/],
  ["travel", /\b(flight|flew|travel\w*|jet ?lag|road trip|long drive)\b/],
  ["intense-exercise", /\b(hard workout|intense (workout|exercise)|ran a (race|marathon)|long run|hiit)\b/],
  ["aged-cheese", /\b(cheese|parmesan|cheddar|blue cheese)\b/],
  ["chocolate", /\bchocolate\b/],
  ["processed-meat", /\b(hot ?dogs?|bacon|salami|pepperoni|deli meat|cured meat)\b/],
  ["msg", /\b(msg|monosodium)\b/],
  ["aspartame", /\b(diet (soda|coke|pop)|aspartame|sweetener)\b/],
  ["heat", /\b(hot day|heat ?wave|too hot|in the heat)\b/],
  ["neck-tension", /\b(neck (tension|tight\w*)|tight shoulders|shoulders? (were |are )?tight|tense shoulders)\b/],
];

const ALLEVIATOR: Table = [
  ["dark-room", /\b(dark (room|bedroom)|lay down in the dark|lying in the dark)\b/],
  ["sleep", /\b(slept it off|took a nap|napped|sleeping helped)\b/],
  ["cold-compress", /\b(ice pack|cold compress|ice on)\b/],
  ["heat-pack", /\b(heat pack|hot water bottle|heating pad)\b/],
  ["hydration", /\b(drank (some |lots of |a lot of )?water|water helped)\b/],
  ["eating", /\b(eating helped|ate (something|food) and)\b/],
  ["massage", /\b(massage|pressure points?)\b/],
  ["fresh-air", /\b(fresh air|went outside)\b/],
  ["breathing", /\b(breathing exercises?|meditat\w*)\b/],
];

const EXACERBATOR: Table = [
  ["movement", /\b(worse (when|if) I (move|walk|climb)|stairs|movement made it worse|moving made it worse)\b/],
  ["bending", /\bbending (over|down)\b/],
  ["screens", /\b(screens? (make|made|makes) it worse|looking at (my |the )?screen)\b/],
  ["noise", /\bnoise (make|made|makes) it worse\b/],
  ["light", /\blight (make|made|makes) it worse\b/],
];

/** Phrases worth asking about rather than mapping outright. */
const HINTS: { re: RegExp; heard: string; triggerId: string; ask: string }[] = [
  { re: /\b(back-to-back meetings|meetings all day|non-?stop meetings)\b/, heard: "back-to-back meetings", triggerId: "long-workday", ask: "Was it a long workday? I can add that as a trigger." },
  { re: /\b(busy day|hectic day|crazy day)\b/, heard: "a busy day", triggerId: "stress", ask: "Was it a stressful day? I can add stress as a trigger." },
];

const LIFE_EVENTS: { re: RegExp; label: string; kind: LifeEventInput["kind"] }[] = [
  { re: /\b(started|starting|began) (a |my )?new job\b|\bnew job\b/, label: "Started a new job", kind: "work" },
  { re: /\b(night shifts?|on nights|shift work)\b/, label: "Night shifts", kind: "work" },
  { re: /\b(moved|moving) (house|home|apartment)\b|\bmoved to a new (house|home|apartment|place)\b/, label: "Moved home", kind: "family" },
  { re: /\b(on (vacation|holiday)|trip to|flew to|travell?ing to)\b/, label: "Travel", kind: "travel" },
  { re: /\b(have|got|caught|had) (covid|the flu|flu|a cold|an infection|sinusitis)\b/, label: "Illness", kind: "illness" },
  { re: /\b(exams?|finals) (week|season|coming up)\b/, label: "Exams", kind: "work" },
  { re: /\b(new baby|had (a|my) baby)\b/, label: "New baby", kind: "family" },
  { re: /\b(started|began|starting) (a |the )?(new )?(diet|fast(ing)?|keto|ramadan)\b/, label: "Started a new diet or fasting", kind: "diet" },
  { re: /\b(started|began|starting) (running|training|a new workout|the gym)\b/, label: "Started a new exercise routine", kind: "exercise" },
];

/** Brand and common names → a word that appears in the generic name the patient saved. */
const MED_ALIASES: [RegExp, string][] = [
  [/\bimitrex\b/, "sumatriptan"],
  [/\bmaxalt\b/, "rizatriptan"],
  [/\bzomig\b/, "zolmitriptan"],
  [/\brelpax\b/, "eletriptan"],
  [/\bamerge\b/, "naratriptan"],
  [/\bfrova\b/, "frovatriptan"],
  [/\baxert\b/, "almotriptan"],
  [/\btreximet\b/, "sumatriptan naproxen"],
  [/\bnurtec\b/, "rimegepant"],
  [/\bubrelvy\b/, "ubrogepant"],
  [/\bzavzpret\b/, "zavegepant"],
  [/\breyvow\b/, "lasmiditan"],
  [/\b(tylenol|paracetamol|panadol)\b/, "acetaminophen"],
  [/\b(advil|motrin|nurofen)\b/, "ibuprofen"],
  [/\baleve\b/, "naproxen"],
  [/\bexcedrin\b/, "acetaminophen aspirin caffeine"],
  [/\breglan\b/, "metoclopramide"],
  [/\bcompazine\b/, "prochlorperazine"],
  [/\bzofran\b/, "ondansetron"],
];
/** Medicine words people mention, used to notice a medicine that isn't on their list. */
const KNOWN_MEDICINE_WORDS =
  /\b(sumatriptan|rizatriptan|zolmitriptan|eletriptan|naratriptan|frovatriptan|almotriptan|ubrogepant|rimegepant|zavegepant|lasmiditan|ibuprofen|naproxen|diclofenac|aspirin|acetaminophen|paracetamol|tylenol|advil|motrin|aleve|excedrin|imitrex|maxalt|nurtec|ubrelvy|metoclopramide|ondansetron|codeine|tramadol|triptan)\b/g;
const GENERIC_NAME_WORDS = new Set(["oral", "solution", "nasal", "tablet", "tablets", "combination", "other", "opioid", "and", "with"]);

// ---------------------------------------------------------------- Time

const pad = (n: number) => String(n).padStart(2, "0");
const at = (date: string, h: number, m: number): LocalDateTime => `${date}T${pad(h)}:${pad(m)}`;
const minutesOf = (t: LocalDateTime) => Number(t.slice(11, 13)) * 60 + Number(t.slice(14, 16));

/** Adds minutes to a local date-time, crossing midnight if needed. */
export function shiftLocal(t: LocalDateTime, minutes: number): LocalDateTime {
  let date = t.slice(0, 10);
  let total = minutesOf(t) + minutes;
  while (total < 0) {
    total += 1440;
    date = addDays(date, -1);
  }
  while (total >= 1440) {
    total -= 1440;
    date = addDays(date, 1);
  }
  return at(date, Math.floor(total / 60), total % 60);
}

/** "around 2" → the most recent 2:00 (am or pm) that is not in the future. */
export function resolveClock(hour: number, minute: number, meridiem: string | undefined, now: LocalDateTime): LocalDateTime | null {
  if (hour > 23 || minute > 59) return null;
  const today = now.slice(0, 10);
  const nowMin = minutesOf(now);
  const m = meridiem?.replace(/\./g, "");
  let hours: number[];
  if (m === "am") hours = [hour % 12];
  else if (m === "pm") hours = [(hour % 12) + 12];
  else if (hour > 12 || hour === 0) hours = [hour];
  else hours = [hour % 12, (hour % 12) + 12];
  const past = hours.map((h) => h * 60 + minute).filter((x) => x <= nowMin);
  if (past.length) {
    const best = Math.max(...past);
    return at(today, Math.floor(best / 60), best % 60);
  }
  const latest = Math.max(...hours.map((h) => h * 60 + minute));
  return at(addDays(today, -1), Math.floor(latest / 60), latest % 60);
}

/** A clock time, not a duration or a score ("5 hours", "7/10"). */
const CLOCK = /(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?(?!\s*(?:hours?|hrs?|h\b|minutes?|mins?|days?|times|out of|\/|\d))/;

/** A time in a phrase like "at 2:30", "around 2", "since 9am", or a relative phrase like "this morning". */
function findTime(clause: string, now: LocalDateTime, words = "at|around|about|since|from|by|roughly|approx(?:imately)?|before|after"): LocalDateTime | null {
  const explicit = clause.match(new RegExp(`\\b(?:${words})\\s+(?:about\\s+|around\\s+)?${CLOCK.source}`, "i"));
  if (explicit) return resolveClock(Number(explicit[1]), Number(explicit[2] ?? 0), explicit[3]?.toLowerCase(), now);
  const colon = clause.match(/\b(\d{1,2}):(\d{2})\s*(a\.?m\.?|p\.?m\.?)?/i);
  if (colon) return resolveClock(Number(colon[1]), Number(colon[2]), colon[3]?.toLowerCase(), now);
  const meridiem = clause.match(/\b(\d{1,2})\s*(a\.?m\.?|p\.?m\.?)(?=\W|$)/i);
  if (meridiem) return resolveClock(Number(meridiem[1]), 0, meridiem[2].toLowerCase(), now);
  const ago = clause.match(/\b(\d{1,2}|an?|one|two|three)\s+(hours?|hrs?|minutes?|mins?)\s+ago\b/i);
  if (ago) {
    const n = /^\d+$/.test(ago[1]) ? Number(ago[1]) : ({ a: 1, an: 1, one: 1, two: 2, three: 3 } as Record<string, number>)[ago[1].toLowerCase()];
    return shiftLocal(now, -(ago[2].startsWith("h") ? n * 60 : n));
  }
  const today = now.slice(0, 10);
  const relative: [RegExp, LocalDateTime][] = [
    [/\blast night\b/, at(addDays(today, -1), 22, 0)],
    [/\b(woke up with|when I woke( up)?|first thing)\b/, at(today, 7, 0)],
    [/\bthis morning\b/, at(today, 9, 0)],
    [/\b(at|since|after|before) lunch\b/, at(today, 12, 30)],
    [/\bthis afternoon\b/, at(today, 14, 0)],
    [/\b(this evening|tonight)\b/, at(today, 19, 0)],
    [/\byesterday\b/, at(addDays(today, -1), 12, 0)],
  ];
  for (const [re, t] of relative) if (re.test(clause) && t <= now) return t;
  return null;
}

// ---------------------------------------------------------------- Parsing

const found = (text: string, table: Table) => table.filter(([, re]) => re.test(text)).map(([id]) => id);
const clausesOf = (text: string) =>
  text
    .split(/(?<=[.!?;])\s+|,\s*(?:and|but|then)\s+|\s+(?:and then|but then)\s+/i)
    .map((c) => c.trim())
    .filter(Boolean);

const ATTACK_WORDS = /\b(migraine|headache|head ?ache|head (is |was )?(pounding|killing|hurting|throbbing|splitting)|bad head|my head (hurts|is killing)|(an|my|the|with) aura|attack)\b/;
const START_WORDS = /\b(start\w*|began|begin|kicked in|came on|hit|since|woke up with)\b/;

function severity(text: string): number | undefined {
  for (const m of text.matchAll(/(\d{1,2})(?:\.\d)?\s*(?:\/|out of)\s*10\b/g)) {
    const before = text.slice(Math.max(0, m.index! - 25), m.index);
    if (/stress/.test(before)) continue;
    const n = Number(m[1]);
    if (n <= 10) return n;
  }
  const m = text.match(/\b(?:pain|it)\s+(?:is|was|at|of)\s+(?:a\s+|an\s+)?(\d{1,2})\b(?!\s*(?:am|pm|:|hours?|hrs?))/);
  if (m && Number(m[1]) <= 10) return Number(m[1]);
  return undefined;
}

function relief(clause: string): "none" | "partial" | "pain-free" | undefined {
  if (/\b(didn'?t (help|work|do anything)|no (relief|help|difference)|did nothing|useless)\b/.test(clause)) return "none";
  if (/\b(took the edge off|helped a (bit|little)|helped some|a little better|somewhat|partly|partially|eased it|dulled it|took it down)\b/.test(clause)) return "partial";
  if (/\b(pain[- ]free|completely gone|knocked it out|worked( well| great)?|cleared it|gone (within|after|in))\b/.test(clause)) return "pain-free";
  return undefined;
}

/**
 * Which words name each of the patient's medicines. "A / B" lists alternative names. A
 * combination ("A + B + caffeine") needs two of its ingredients, or a brand name for it, so
 * "took Tylenol" or "had caffeine" is not a dose of a combination painkiller.
 */
const names = (m: { words: string[]; combination: boolean }, said: string[]) => {
  // Caffeine is in coffee, so it never counts towards naming a combination pill.
  const hits = m.words.filter((w) => said.includes(w) && !(m.combination && w === "caffeine")).length;
  return m.combination ? hits >= 2 : hits >= 1;
};
function medicineMatchers(ctx: CaptureContext) {
  return ctx.medications
    .filter((m) => m.active)
    .map((m) => {
      const lower = m.name.toLowerCase();
      const words = lower.split(/[^a-z]+/).filter((w) => w.length >= 4 && !GENERIC_NAME_WORDS.has(w));
      const combination = lower.includes("+");
      if (m.cls === "triptan" && !combination) words.push("triptan");
      return { med: m, words, combination };
    });
}

function lunchTime(text: string): string | undefined {
  const m = text.match(/\blunch\b[^.;!?]*?\b(?:till|until|at|around|about|after|by|before)\s+(?:(almost|nearly|about|around|after|gone|past)\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (!m) return undefined;
  let h = Number(m[2]);
  const min = Number(m[3] ?? 0);
  if (m[4] === "pm" && h < 12) h += 12;
  else if (!m[4] && h <= 7) h += 12;
  if (h > 23) return undefined;
  let total = h * 60 + min;
  if (m[1] === "almost" || m[1] === "nearly") total -= 10;
  if (m[1] === "after" || m[1] === "gone" || m[1] === "past") total += 15;
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

const hoursIn = (text: string, re: RegExp) => {
  const m = text.match(re);
  return m ? Number(m[1]) : undefined;
};

export function parseCapture(raw: string, ctx: CaptureContext, lateLunchAfter = "15:00"): CaptureProposal {
  const text = raw.toLowerCase().replace(/[’`]/g, "'").replace(/\s+/g, " ").trim();
  const screen = screenText(raw);
  const today = ctx.now.slice(0, 10);
  const clauses = clausesOf(text);
  const questions: CaptureQuestion[] = [];
  const heardButNotMapped: string[] = [];

  // Triggers, including the patient's own named ones.
  const triggers = new Set(found(text, TRIGGER));
  if (triggers.has("red-wine")) triggers.add("alcohol");
  if (!ctx.tracksCycle) triggers.delete("menstruation");
  for (const c of ctx.customTriggers) if (text.includes(c.label.toLowerCase())) triggers.add(c.id);

  // Check-in numbers.
  const lunch = lunchTime(text);
  if (lunch && lunch >= lateLunchAfter) triggers.add("late-meal");
  const sleepHours = hoursIn(text, /\b(?:slept|sleep|got)\s+(?:only |just |about |around |maybe )?(\d{1,2}(?:\.\d)?)\s*(?:hours?|hrs?|h)\b/);
  if (sleepHours !== undefined && sleepHours < 6) triggers.add("poor-sleep");
  const workHours =
    hoursIn(text, /\b(?:worked|working|at work(?: for)?|work(?:ed)? for)\s+(?:about |around |nearly |almost )?(\d{1,2})\s*(?:hours?|hrs?|h)\b/) ??
    hoursIn(text, /\b(\d{1,2})[- ]hours? (?:work ?day|day at work|shift)\b/);
  if (workHours !== undefined && workHours >= 10) triggers.add("long-workday");
  if (/\b(long (work ?day|day at work)|worked late|overtime)\b/.test(text)) triggers.add("long-workday");
  const stressMatch = text.match(/\bstress(?:ed)?(?: level)?\s+(?:is |was |at |of |about )?(\d{1,2})\s*(?:\/|out of)\s*10\b/);
  const stress = stressMatch && Number(stressMatch[1]) <= 10 ? Number(stressMatch[1]) : undefined;

  for (const h of HINTS) {
    if (h.re.test(text) && !triggers.has(h.triggerId)) {
      heardButNotMapped.push(h.heard);
      questions.push({ id: `confirm-${h.triggerId}`, field: "confirmTrigger", ask: h.ask, triggerId: h.triggerId });
    }
  }

  // Life events.
  const event = LIFE_EVENTS.find((e) => e.re.test(text));
  const lifeEvent: LifeEventInput | null = event ? { date: today, label: event.label, kind: event.kind } : null;
  if (lifeEvent) questions.push({ id: "life-event", field: "lifeEvent", ask: `Add “${lifeEvent.label}” to your timeline? Aura will keep it in mind when looking at your patterns.` });

  // Medicines.
  const doses: NonNullable<AttackDraft["doses"]> = [];
  const matchers = medicineMatchers(ctx);
  const aliased = (clause: string) => MED_ALIASES.filter(([re]) => re.test(clause)).flatMap(([, w]) => w.split(" "));
  for (const clause of clauses) {
    if (!/\b(took|take|taken|taking|had|used|tried|popped|swallowed|sprayed|injected)\b/.test(clause)) continue;
    const words = [...clause.split(/[^a-z]+/), ...aliased(clause)];
    const hits = matchers.filter((m) => names(m, words));
    // "took sumatriptan" with both Sumatriptan and Sumatriptan + Naproxen on the list: the plain one.
    const plain = hits.filter((h) => !h.combination);
    for (const { med } of plain.length && hits.length > plain.length ? plain : hits) {
      if (doses.some((d) => d.medicationId === med.id)) continue;
      // The dose time is the one after the medicine's name; an earlier time in the clause is usually the start.
      const at = Math.min(...med.name.toLowerCase().split(/[^a-z]+/).concat(["triptan"]).map((w) => clause.indexOf(w)).filter((i) => i >= 0), clause.length);
      const takenAt = findTime(clause.slice(at), ctx.now) ?? (START_WORDS.test(clause.slice(0, at)) ? null : findTime(clause, ctx.now));
      const r = relief(clause) ?? relief(text);
      doses.push({ medicationId: med.id, takenAt: takenAt ?? "", ...(r ? { reliefAt2h: r } : {}) });
    }
  }
  for (const m of text.matchAll(KNOWN_MEDICINE_WORDS)) {
    const word = m[1];
    const said = [word, ...(MED_ALIASES.find(([re]) => re.test(word))?.[1].split(" ") ?? [])];
    const onList = matchers.some((m) => names(m, said));
    if (!onList) {
      const note = `${word[0].toUpperCase()}${word.slice(1)} isn't on your medicines list. Add it under Medicines & supplements to log the dose.`;
      if (!heardButNotMapped.includes(note)) heardButNotMapped.push(note);
    }
  }

  // The attack itself.
  const isAttack = ATTACK_WORDS.test(text) || doses.length > 0 || found(text, PAIN_QUALITY).length > 0;
  let attack: AttackDraft | null = null;
  if (isAttack) {
    const startClause = clauses.find((c) => START_WORDS.test(c) && (ATTACK_WORDS.test(c) || /\b(it|pain)\b/.test(c))) ?? clauses.find((c) => ATTACK_WORDS.test(c));
    // The start time is the one after "started"/"since"; a later time in the clause may be a dose.
    const startAt = startClause ? Math.max(0, startClause.search(START_WORDS)) : 0;
    const start = (startClause && (findTime(startClause.slice(startAt), ctx.now) ?? findTime(startClause, ctx.now))) ?? undefined;
    const ongoing = /\b(still (there|going|here|have it|got it|hurts|hurting|throbbing|ongoing|on)|hasn'?t (gone|stopped|eased|gone away)|ongoing|right now)\b/.test(text);
    let end: string | undefined;
    const lasted = text.match(/\blasted (?:about |around )?(\d{1,2}) (?:hours?|hrs?)\b/);
    if (lasted && start) end = shiftLocal(start, Number(lasted[1]) * 60);
    else {
      const endClause = clauses.find((c) => /\b(gone|went away|stopped|eased off|cleared|ended|finally better)\b/.test(c));
      const t = endClause && findTime(endClause, ctx.now, "by|at|around|about|after");
      if (t && (!start || t >= start)) end = t;
    }
    const exacerbators = found(text, EXACERBATOR);
    let disability: AttackDraft["disability"];
    if (/\b(in bed all day|stayed in bed|couldn'?t (do anything|function|get out of bed)|bed[- ]bound)\b/.test(text)) disability = "severe";
    else if (/\b(had to (leave|go home|cancel|lie down|stop)|left work( early)?|went home|called in sick)\b/.test(text)) disability = "moderate";
    else if (/\b(kept working|still worked|pushed through|carried on)\b/.test(text)) disability = "mild";

    const sev = severity(text);
    attack = {
      ...(start ? { start } : {}),
      ...(end ? { end } : {}),
      ...(sev !== undefined ? { peakSeverity: sev } : {}),
      painLocations: found(text, PAIN_LOCATION).filter((id, _, all) => !(all.includes("bilateral") && (id === "left" || id === "right"))),
      painQualities: found(text, PAIN_QUALITY),
      symptoms: found(text, SYMPTOM),
      triggers: [...triggers],
      alleviators: found(text, ALLEVIATOR),
      exacerbators,
      worsenedByActivity: exacerbators.includes("movement") || undefined,
      doses: doses.map((d) => (d.takenAt ? d : { ...d, takenAt: start ?? "" })),
      ...(disability ? { disability } : {}),
      redFlags: screen.flags.filter((f) => RED_FLAGS.some((r) => r.id === f)),
      notes: raw.trim().slice(0, 4000),
    };
    if (sev === undefined) questions.unshift({ id: "severity", field: "peakSeverity", ask: "How bad was it at its worst, 0 to 10?" });
    if (!start) questions.unshift({ id: "start", field: "start", ask: "When did it start?" });
    if (!ongoing && !end) questions.push({ id: "end", field: "end", ask: "Is it still going, or when did it end?" });
    for (const d of doses) {
      if (!d.takenAt) {
        const name = ctx.medications.find((m) => m.id === d.medicationId)?.name ?? "it";
        questions.push({ id: `dose-${d.medicationId}`, field: "doseTime", ask: `What time did you take ${name}?`, medicationId: d.medicationId });
      }
    }
    if (!disability) questions.push({ id: "disability", field: "disability", ask: "How much did it stop you doing things?" });
  }

  // Check-in fields for today (daily exposures make the trigger analysis work).
  const daily = [...triggers].filter((id) => id !== "menstruation" && id !== "low-sleep-score" && id !== "low-readiness" && (TRIGGERS.some((t) => t.id === id) || id.startsWith("custom:")));
  const checkInFields = {
    ...(lunch ? { lunchTime: lunch } : {}),
    ...(sleepHours !== undefined ? { sleepHours } : {}),
    ...(workHours !== undefined ? { workHours } : {}),
    ...(stress !== undefined ? { stress } : {}),
    ...(daily.length ? { exposures: daily } : {}),
    ...(attack && (!attack.start || attack.start.slice(0, 10) === today) ? { headache: true } : {}),
  };
  const checkIn = Object.keys(checkInFields).length ? checkInFields : null;

  if (!attack && !checkIn && !lifeEvent && !screen.flags.length) {
    questions.push({ id: "what", field: "start", ask: "Is this about a migraine? Tell me when it started, how bad it is (0 to 10), and anything you took." });
  }

  return { mode: "basic", screen, attack, checkIn, checkInDate: today, lifeEvent, heardButNotMapped, questions };
}

/** Labels for chips on the confirm card. */
export const TRIGGER_IDS = new Set(TRIGGERS.map((t) => t.id));
