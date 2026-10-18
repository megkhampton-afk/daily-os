// Minimal CalDAV + iCalendar helpers for iCloud. Pure functions (no Convex
// APIs) so they can be tested directly. The Convex runtime has no DOM parser,
// so multistatus XML is read with namespace-agnostic regexes.

export type DavResponse = { href: string; body: string };

const NS = "(?:[\\w-]+:)?";

function decodeXml(s: string) {
  const cdata = s.match(/^<!\[CDATA\[([\s\S]*)\]\]>$/);
  if (cdata) return cdata[1];
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCharCode(Number(d)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Text content of the first `<tag>` (any namespace prefix), or null. Self-closing tags count as absent. */
export function tagText(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<${NS}${tag}(?:\\s[^>]*)?(?<!/)>([\\s\\S]*?)</${NS}${tag}>`));
  return m ? decodeXml(m[1].trim()) : null;
}

export function davResponses(xml: string): DavResponse[] {
  const re = new RegExp(`<${NS}response(?:\\s[^>]*)?>([\\s\\S]*?)</${NS}response>`, "g");
  const out: DavResponse[] = [];
  for (const m of xml.matchAll(re)) {
    const href = tagText(m[1], "href");
    if (href) out.push({ href, body: m[1] });
  }
  return out;
}

/** True when a PROPFIND response describes a calendar that can hold events (not a Reminders list). */
export function isEventCalendar(body: string) {
  const type = tagText(body, "resourcetype") ?? "";
  if (!new RegExp(`<${NS}calendar[\\s/>]`).test(type)) return false;
  const comps = tagText(body, "supported-calendar-component-set");
  return comps === null || /name=["']VEVENT["']/i.test(comps);
}

// ---------- iCalendar ----------

export type IcsEvent = {
  uid?: string;
  summary: string;
  start: number;
  end: number;
  allDay: boolean;
  location?: string;
  cancelled: boolean;
};

type Prop = { params: Record<string, string>; value: string };

function parseLine(line: string): [string, Prop] | null {
  let inQuote = false;
  let colon = -1;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') inQuote = !inQuote;
    else if (line[i] === ":" && !inQuote) {
      colon = i;
      break;
    }
  }
  if (colon < 0) return null;
  const [name, ...rawParams] = line.slice(0, colon).split(";");
  const params: Record<string, string> = {};
  for (const p of rawParams) {
    const eq = p.indexOf("=");
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, "");
  }
  return [name.toUpperCase(), { params, value: line.slice(colon + 1) }];
}

function unescapeText(s: string) {
  return s.replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1");
}

function offsetMs(utc: number, zone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utc));
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - utc;
}

/** Wall-clock time in an IANA zone -> epoch ms. Two passes settle DST edges. */
export function zonedToUtc(y: number, mo: number, d: number, h: number, mi: number, s: number, zone: string) {
  const guess = Date.UTC(y, mo - 1, d, h, mi, s);
  const first = guess - offsetMs(guess, zone);
  return guess - offsetMs(first, zone);
}

function validZone(zone: string | undefined) {
  if (!zone) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/** All-day dates are returned as UTC midnight, matching how Google all-day events are passed to the client. */
export function parseIcsDate(prop: Prop, fallbackZone: string): { ms: number; allDay: boolean } | null {
  const v = prop.value.trim();
  const date = v.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (date || prop.params.VALUE === "DATE") {
    if (!date) return null;
    return { ms: Date.UTC(+date[1], +date[2] - 1, +date[3]), allDay: true };
  }
  const m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
  if (!m) return null;
  const [y, mo, d, h, mi, s] = m.slice(1, 7).map(Number);
  if (m[7]) return { ms: Date.UTC(y, mo - 1, d, h, mi, s), allDay: false };
  // Non-IANA TZIDs (e.g. "Eastern Standard Time") fall back to the viewer's zone.
  const zone = validZone(prop.params.TZID) ? prop.params.TZID : fallbackZone;
  return { ms: zonedToUtc(y, mo, d, h, mi, s, zone), allDay: false };
}

function durationMs(v: string) {
  const m = v.match(/^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!m) return null;
  const [w, d, h, mi, s] = m.slice(2).map((x) => Number(x ?? 0));
  return (((w * 7 + d) * 24 + h) * 60 + mi) * 60_000 + s * 1000;
}

export function parseEvents(ics: string, fallbackZone: string): IcsEvent[] {
  const lines = ics.replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
  const events: IcsEvent[] = [];
  let cur: Record<string, Prop> | null = null;
  let nested = 0;

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      cur = {};
      nested = 0;
      continue;
    }
    if (!cur) continue;
    if (line.startsWith("BEGIN:")) nested++;
    else if (line === "END:VEVENT") {
      const start = cur.DTSTART && parseIcsDate(cur.DTSTART, fallbackZone);
      if (start) {
        const endParsed = cur.DTEND && parseIcsDate(cur.DTEND, fallbackZone);
        const dur = cur.DURATION && durationMs(cur.DURATION.value);
        const end = endParsed
          ? endParsed.ms
          : dur != null
            ? start.ms + dur
            : start.allDay
              ? start.ms + 86_400_000
              : start.ms;
        events.push({
          uid: cur.UID?.value,
          summary: cur.SUMMARY ? unescapeText(cur.SUMMARY.value) : "(busy)",
          start: start.ms,
          end,
          allDay: start.allDay,
          location: cur.LOCATION ? unescapeText(cur.LOCATION.value) || undefined : undefined,
          cancelled: cur.STATUS?.value.toUpperCase() === "CANCELLED",
        });
      }
      cur = null;
    } else if (line.startsWith("END:")) nested--;
    else if (nested === 0) {
      const parsed = parseLine(line);
      if (parsed && !(parsed[0] in cur)) cur[parsed[0]] = parsed[1];
    }
  }
  return events;
}

function icsUtc(ms: number) {
  return new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escapeText(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

// RFC 5545 caps lines at 75 octets; folding by 60 characters stays under it for most text.
function fold(line: string) {
  const chunks: string[] = [];
  for (let i = 0; i < line.length; i += 60) chunks.push(line.slice(i, i + 60));
  return chunks.join("\r\n ");
}

export function buildEvent(uid: string, title: string, start: number, end: number) {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Daily OS//EN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${icsUtc(Date.now())}`,
    `DTSTART:${icsUtc(start)}`,
    `DTEND:${icsUtc(end)}`,
    fold(`SUMMARY:${escapeText(title)}`),
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

export { icsUtc };
