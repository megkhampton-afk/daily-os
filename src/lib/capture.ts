import * as chrono from "chrono-node";

export type Parsed = {
  tasks: { title: string; due?: number }[];
  events: { title: string; start: number; text?: string }[];
};

const EVENT_WORDS =
  /\b(meet|meeting|dinner|lunch|breakfast|coffee|call|interview|party|class|lecture|office hours|appointment|dentist|doctor|practice|game|event|with)\b/i;

function clean(s: string) {
  return s
    .replace(/^\s*(and|also|then|to|todo:?|remind me to|i need to|need to)\s+/i, "")
    .replace(/\s+(on|at|by|due)\s*$/i, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s,.;:-]+|[\s,.;:-]+$/g, "")
    .trim();
}

export function parseCapture(text: string, ref = new Date()): Parsed {
  const out: Parsed = { tasks: [], events: [] };
  const chunks = text
    .split(/\n|;|,(?![^(]*\))|\s+and\s+(?=[a-z]+\s)/i)
    .map((c) => c.trim())
    .filter(Boolean);

  for (const chunk of chunks) {
    const results = chrono.parse(chunk, ref, { forwardDate: true });
    const r = results[0];
    let title = chunk;
    if (r) title = chunk.slice(0, r.index) + chunk.slice(r.index + r.text.length);
    title = clean(title);
    if (!title) continue;
    title = title[0].toUpperCase() + title.slice(1);

    const hasTime = r?.start.isCertain("hour") ?? false;
    if (r && (hasTime || EVENT_WORDS.test(chunk))) {
      const start = r.start.date();
      if (!hasTime) start.setHours(9, 0, 0, 0);
      out.events.push({ title, start: start.getTime(), text: chunk });
    } else {
      let due: number | undefined;
      if (r) {
        const d = r.start.date();
        if (!r.start.isCertain("hour")) d.setHours(23, 59, 0, 0);
        due = d.getTime();
      }
      out.tasks.push({ title, due });
    }
  }
  return out;
}

function gcalDate(ms: number) {
  return new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function googleCalendarUrl(title: string, start: number, minutes = 60) {
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${gcalDate(start)}/${gcalDate(start + minutes * 60000)}`,
  });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

export function relTime(ms: number) {
  const d = new Date(ms);
  const now = new Date();
  const days = Math.round(
    (new Date(d.toDateString()).getTime() - new Date(now.toDateString()).getTime()) /
      86400000,
  );
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const day =
    days === 0
      ? "Today"
      : days === 1
        ? "Tomorrow"
        : days === -1
          ? "Yesterday"
          : days > 1 && days < 7
            ? d.toLocaleDateString([], { weekday: "short" })
            : d.toLocaleDateString([], { month: "short", day: "numeric" });
  return `${day} ${time}`;
}
