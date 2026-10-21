const DIGIT_WORDS: Record<string, string> = {
  zero: "0",
  oh: "0",
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  nine: "9",
};
const REPEAT: Record<string, number> = { double: 2, triple: 3 };

// Turns "two double zero five", "2.005", and "2 005" into the same tokens so
// spoken or typed course numbers match calendar names like "2.005".
export function tokens(text: string): string[] {
  const raw = text
    .toLowerCase()
    .replace(/(\w)[.](?=\w)/g, "$1")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const words: { t: string; digit: boolean }[] = [];
  for (let i = 0; i < raw.length; i++) {
    const w = raw[i];
    if (REPEAT[w] && DIGIT_WORDS[raw[i + 1]]) {
      words.push({ t: DIGIT_WORDS[raw[i + 1]].repeat(REPEAT[w]), digit: true });
      i++;
    } else if (DIGIT_WORDS[w]) {
      words.push({ t: DIGIT_WORDS[w], digit: true });
    } else {
      words.push({ t: w, digit: /^\d+$/.test(w) });
    }
  }

  const out: string[] = [];
  for (const w of words) {
    const prev = out[out.length - 1];
    if (w.digit && prev !== undefined && /^\d+$/.test(prev)) out[out.length - 1] = prev + w.t;
    else out.push(w.t);
  }
  return out;
}

export type CalendarOption = { id: string; name: string };

export function pickCalendar(text: string, calendars: CalendarOption[]): CalendarOption | null {
  const hay = tokens(text);
  let best: { cal: CalendarOption; score: number } | null = null;
  for (const cal of calendars) {
    // Course calendars often include a description after the course number.
    const courseCodes = cal.name.match(/\b(?:\d+|[a-z]{2,})\.\d+[a-z]?\b/gi) ?? [];
    for (const name of [cal.name, ...courseCodes]) {
      const needle = tokens(name);
      if (!needle.length) continue;
      const joined = needle.join("");
      if (joined.length < 3) continue;
      if (containsRun(hay, needle) || containsJoined(hay, joined)) {
        const score = joined.length;
        if (!best || score > best.score) best = { cal, score };
      }
    }
  }
  return best?.cal ?? null;
}

// "cms 300" should match "CMS.300", "robotics club" should match "RoboticsClub".
function containsJoined(hay: string[], joined: string) {
  for (let i = 0; i < hay.length; i++) {
    let acc = "";
    for (let j = i; j < Math.min(hay.length, i + 4); j++) {
      acc += hay[j];
      if (acc === joined) return true;
      if (acc.length >= joined.length) break;
    }
  }
  return false;
}

function containsRun(hay: string[], needle: string[]) {
  outer: for (let i = 0; i + needle.length <= hay.length; i++) {
    for (let j = 0; j < needle.length; j++) if (hay[i + j] !== needle[j]) continue outer;
    return true;
  }
  return false;
}
