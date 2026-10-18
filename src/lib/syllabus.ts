import * as chrono from "chrono-node";

export type SyllabusItem = { title: string; due?: number };

const DELIVERABLE_KEYWORDS =
  /\b(?:pset|problem\s+set|homework|hw|assignment|project|lab|quiz|exam|midterm|final|essay|paper|report|due|presentation|reading\s+response)\b/i;
const DAY_MS = 24 * 60 * 60 * 1000;

function cleanTitle(line: string, dateMatches: ReturnType<typeof chrono.parse>) {
  let title = line;

  for (const match of [...dateMatches].sort((a, b) => b.index - a.index)) {
    title =
      title.slice(0, match.index) +
      " " +
      title.slice(match.index + match.text.length);
  }

  title = title
    .replace(/^\s*(?:[-–—*•▪◦‣]+|\d+[.)])\s*/u, "")
    .replace(/\bdue\b(?:\s+(?:on|by))?\s*[:\-–—]?\s*/gi, " ")
    .replace(/\s*[:;]\s*/g, " ")
    .replace(/^[\s\-–—*•▪◦‣|]+|[\s,\-–—*•▪◦‣|]+$/gu, "")
    .replace(/\s+/g, " ")
    .trim();

  if (title.length > 80) {
    title = `${title.slice(0, 77).trimEnd()}...`;
  }
  return title;
}

export function parseSyllabus(
  text: string,
  refYear?: Date,
): SyllabusItem[] {
  const referenceDate = refYear ?? new Date();
  const items: SyllabusItem[] = [];

  for (const line of text.split(/\r?\n/)) {
    if (!DELIVERABLE_KEYWORDS.test(line)) continue;

    const dates = chrono.parse(line, referenceDate, { forwardDate: true });
    const title = cleanTitle(line, dates);
    if (!title) continue;

    const due = dates[0]?.start.date().getTime();
    items.push(due === undefined ? { title } : { title, due });
  }

  return items;
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function assignmentKeys(title: string) {
  const normalized = normalize(title);
  const keys = new Set<string>();
  const patterns: Array<[string, RegExp]> = [
    ["pset", /\b(?:problem\s+set|pset)\s*#?\s*(\d+|[a-z])\b/g],
    ["hw", /\b(?:homework|hw|assignment)\s*#?\s*(\d+|[a-z])\b/g],
    ["exam", /\b(?:exam|midterm)(?:\s+exam)?\s*#?\s*(\d+|[ivx]+)\b/g],
    ["project", /\bproject\s*#?\s*(\d+|[a-z])\b/g],
    ["lab", /\blab(?:oratory)?\s*#?\s*(\d+|[a-z])\b/g],
    ["quiz", /\bquiz\s*#?\s*(\d+|[a-z])\b/g],
    ["essay", /\bessay\s*#?\s*(\d+|[a-z])\b/g],
    ["paper", /\bpaper\s*#?\s*(\d+|[a-z])\b/g],
    ["report", /\breport\s*#?\s*(\d+|[a-z])\b/g],
    ["presentation", /\bpresentation\s*#?\s*(\d+|[a-z])\b/g],
  ];

  for (const [family, pattern] of patterns) {
    for (const match of normalized.matchAll(pattern)) {
      keys.add(`${family}:${match[1]}`);
    }
  }

  if (/\bfinal(?:\s+exam)?\b/.test(normalized)) {
    keys.add("final");
  }
  return keys;
}

function meaningfulWords(title: string) {
  const stopWords = new Set([
    "the",
    "and",
    "for",
    "with",
    "from",
    "this",
    "that",
    "due",
    "on",
    "of",
    "to",
    "in",
    "a",
    "an",
  ]);
  return normalize(title)
    .split(" ")
    .filter((word) => /^[a-z]{2,}$/.test(word) && !stopWords.has(word));
}

export function findMissing(
  parsed: SyllabusItem[],
  existing: { course: string; title: string; due?: number }[],
  course: string,
): SyllabusItem[] {
  const normalizedCourse = normalize(course);
  const canvasItems = existing.filter(
    (item) => normalize(item.course) === normalizedCourse,
  );

  return parsed.filter((item) => {
    const itemTitle = normalize(item.title);
    const itemKeys = assignmentKeys(item.title);
    const itemWords = new Set(meaningfulWords(item.title));

    const isOnCanvas = canvasItems.some((canvasItem) => {
      const canvasTitle = normalize(canvasItem.title);
      if (itemTitle === canvasTitle) return true;

      const canvasKeys = assignmentKeys(canvasItem.title);
      if ([...itemKeys].some((key) => canvasKeys.has(key))) return true;

      if (
        item.due === undefined ||
        canvasItem.due === undefined ||
        Math.abs(item.due - canvasItem.due) > DAY_MS
      ) {
        return false;
      }

      return meaningfulWords(canvasItem.title).some((word) =>
        itemWords.has(word),
      );
    });

    return !isOnCanvas;
  });
}
