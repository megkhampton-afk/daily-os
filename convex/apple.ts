import { v } from "convex/values";
import { action, ActionCtx, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { checkKey, keyArg, readSetting } from "./key";
import { pickCalendar } from "./calendarMatch";
import { buildEvent, davResponses, icsUtc, isEventCalendar, parseEvents, tagText } from "./caldav";

const ROOT = "https://caldav.icloud.com/";

export type AppleCalendar = { url: string; name: string; color?: string };

export async function appleAuth(ctx: ActionCtx): Promise<string | null> {
  const id = await readSetting(ctx, "APPLE_ID");
  const pw = await readSetting(ctx, "APPLE_APP_PASSWORD");
  if (!id || !pw) return null;
  return "Basic " + btoa(`${id}:${pw.replace(/\s+/g, "")}`);
}

async function dav(auth: string, url: string, method: string, body?: string, extra: Record<string, string> = {}) {
  const res = await fetch(url, {
    method,
    headers: { Authorization: auth, "Content-Type": "application/xml; charset=utf-8", ...extra },
    body,
  });
  if (res.status === 401 || res.status === 403) {
    throw new Error(
      "Apple rejected the sign-in. Use your Apple ID email and an app-specific password, not your normal password.",
    );
  }
  if (!res.ok) throw new Error(`iCloud returned ${res.status} for ${method}`);
  return { text: await res.text(), url: res.url || url };
}

const propfind = (props: string) =>
  `<?xml version="1.0" encoding="utf-8"?><d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:a="http://apple.com/ns/ical/"><d:prop>${props}</d:prop></d:propfind>`;

export async function listCalendars(auth: string): Promise<AppleCalendar[]> {
  const root = await dav(auth, ROOT, "PROPFIND", propfind("<d:current-user-principal/>"), { Depth: "0" });
  const principal = tagText(tagText(root.text, "current-user-principal") ?? "", "href");
  if (!principal) throw new Error("iCloud did not return a calendar account for this Apple ID.");
  const principalUrl = new URL(principal, root.url).toString();

  const p = await dav(auth, principalUrl, "PROPFIND", propfind("<c:calendar-home-set/>"), { Depth: "0" });
  const homeHref = tagText(tagText(p.text, "calendar-home-set") ?? "", "href");
  if (!homeHref) throw new Error("iCloud did not return a calendar home for this Apple ID.");
  const home = new URL(homeHref, p.url).toString();

  const list = await dav(
    auth,
    home,
    "PROPFIND",
    propfind("<d:displayname/><d:resourcetype/><c:supported-calendar-component-set/><a:calendar-color/>"),
    { Depth: "1" },
  );
  return davResponses(list.text)
    .filter((r) => isEventCalendar(r.body))
    .map((r) => ({
      url: new URL(r.href, list.url).toString(),
      name: tagText(r.body, "displayname") || "Calendar",
      color: tagText(r.body, "calendar-color")?.slice(0, 7) || undefined,
    }));
}

function defaultCalendar(cals: AppleCalendar[]) {
  return cals.find((c) => /^(home|calendar|personal)$/i.test(c.name)) ?? cals[0];
}

/** Events overlapping [start, end) across all iCloud calendars, with recurring events expanded by the server. */
export async function appleRange(auth: string, start: number, end: number, zone: string) {
  const cals = await listCalendars(auth);
  const range = `start="${icsUtc(start)}" end="${icsUtc(end)}"`;
  const body =
    `<?xml version="1.0" encoding="utf-8"?><c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">` +
    `<d:prop><c:calendar-data><c:expand ${range}/></c:calendar-data></d:prop>` +
    `<c:filter><c:comp-filter name="VCALENDAR"><c:comp-filter name="VEVENT"><c:time-range ${range}/></c:comp-filter></c:comp-filter></c:filter>` +
    `</c:calendar-query>`;

  const lists = await Promise.all(
    cals.map(async (cal) => {
      try {
        const res = await dav(auth, cal.url, "REPORT", body, { Depth: "1" });
        return davResponses(res.text).flatMap((r) =>
          parseEvents(tagText(r.body, "calendar-data") ?? "", zone)
            .filter((e) => !e.cancelled && e.start < end && (e.end > start || e.start >= start))
            .map((e) => ({
              id: `apple:${r.href}:${e.start}`,
              title: e.summary,
              start: e.start,
              end: e.end,
              allDay: e.allDay,
              calendar: cal.name,
              color: cal.color,
              location: e.location,
            })),
        );
      } catch {
        return [];
      }
    }),
  );
  return lists.flat();
}

export const testConnection = action({
  args: keyArg,
  returns: v.object({ ok: v.boolean(), calendars: v.array(v.string()), error: v.optional(v.string()) }),
  handler: async (ctx, { key }) => {
    await checkKey(ctx, key);
    const auth = await appleAuth(ctx);
    if (!auth) return { ok: false, calendars: [], error: "Save your Apple ID and app-specific password first." };
    try {
      const cals = await listCalendars(auth);
      return { ok: true, calendars: cals.map((c) => c.name) };
    } catch (e) {
      return { ok: false, calendars: [], error: (e as Error).message.slice(0, 300) };
    }
  },
});

export const createAppleEvent = internalAction({
  args: { id: v.id("events"), title: v.string(), start: v.number(), text: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { id, title, start, text }) => {
    try {
      const auth = await appleAuth(ctx);
      if (!auth) throw new Error("Apple Calendar is not set up.");
      const cals = await listCalendars(auth);
      if (!cals.length) throw new Error("No iCloud calendars found.");
      const matched = pickCalendar(text ?? title, cals.map((c) => ({ id: c.url, name: c.name })));
      const cal = cals.find((c) => c.url === matched?.id) ?? defaultCalendar(cals);
      const uid = `${crypto.randomUUID()}@daily-os`;
      const url = new URL(`${uid}.ics`, cal.url.endsWith("/") ? cal.url : cal.url + "/").toString();
      await dav(auth, url, "PUT", buildEvent(uid, title, start, start + 3600_000), {
        "Content-Type": "text/calendar; charset=utf-8",
        "If-None-Match": "*",
      });
      await ctx.runMutation(internal.calendar.markSynced, {
        id,
        provider: "apple",
        appleEventUrl: url,
        calendarId: cal.url,
        calendarName: cal.name,
      });
    } catch (e) {
      await ctx.runMutation(internal.calendar.markSynced, { id, error: (e as Error).message.slice(0, 300) });
    }
    return null;
  },
});

export const deleteAppleEvent = internalAction({
  args: { url: v.string() },
  returns: v.null(),
  handler: async (ctx, { url }) => {
    const auth = await appleAuth(ctx);
    if (auth) await dav(auth, url, "DELETE");
    return null;
  },
});
