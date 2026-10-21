import { v } from "convex/values";
import { action, ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { checkKey, keyArg } from "./key";
import { calendarError, calendarItems } from "./googleCalendar";
import { appleAuth, appleRange } from "./apple";

const CAL = "https://www.googleapis.com/calendar/v3";

const scheduleEvent = v.object({
  id: v.string(),
  title: v.string(),
  start: v.number(),
  end: v.number(),
  allDay: v.boolean(),
  calendar: v.string(),
  calendarId: v.optional(v.string()),
  color: v.optional(v.string()),
  location: v.optional(v.string()),
});

type ScheduleEvent = typeof scheduleEvent.type;
const calendarOption = v.object({
  id: v.string(),
  name: v.string(),
  color: v.optional(v.string()),
});
type CalendarOption = typeof calendarOption.type;

type GEvent = {
  id: string;
  summary?: string;
  status?: string;
  location?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  attendees?: { self?: boolean; responseStatus?: string }[];
};

async function googleRange(ctx: ActionCtx, start: number, end: number, errors: string[], options: CalendarOption[]): Promise<ScheduleEvent[]> {
  const calendars = await calendarItems<{
      id: string;
      summary: string;
      summaryOverride?: string;
      backgroundColor?: string;
      selected?: boolean;
      primary?: boolean;
      deleted?: boolean;
    }>(ctx, `${CAL}/users/me/calendarList`);
  const visible = calendars.filter((c) => !c.deleted);
  options.push(...visible.map((c) => ({
    id: `google:${c.id}`,
    name: c.summaryOverride ?? c.summary,
    color: c.backgroundColor,
  })));
  const timeMin = new Date(start).toISOString();
  const timeMax = new Date(end).toISOString();

  const lists = await Promise.all(
    visible.map(async (c) => {
      const params = new URLSearchParams({
        timeMin,
        timeMax,
        singleEvents: "true",
        orderBy: "startTime",
        maxResults: "100",
      });
      try {
        const items = await calendarItems<GEvent>(
          ctx,
          `${CAL}/calendars/${encodeURIComponent(c.id)}/events?${params.toString()}`,
        );
        return items
          .filter((e) => e.status !== "cancelled")
          .filter((e) => !e.attendees?.some((a) => a.self && a.responseStatus === "declined"))
          .map((e) => {
            const allDay = !e.start.dateTime;
            return {
              id: `${c.id}:${e.id}`,
              title: e.summary ?? "(busy)",
              start: allDay ? localDate(e.start.date!) : Date.parse(e.start.dateTime!),
              end: allDay ? localDate(e.end.date!) : Date.parse(e.end.dateTime!),
              allDay,
              calendar: c.primary ? "Main" : (c.summaryOverride ?? c.summary),
              calendarId: `google:${c.id}`,
              color: c.backgroundColor,
              location: e.location,
            };
          });
      } catch (error) {
        errors.push(`${c.summaryOverride ?? c.summary}: ${calendarError(error)}`);
        return [];
      }
    }),
  );
  return lists.flat();
}

// `start`/`end` are the browser's local-day bounds so all-day and timed events
// are bucketed in the user's own time zone. `tz` resolves iCloud events that
// carry no time zone of their own.
export const range = action({
  args: { ...keyArg, start: v.number(), end: v.number(), tz: v.optional(v.string()) },
  returns: v.object({
    connected: v.boolean(),
    events: v.array(scheduleEvent),
    calendars: v.array(calendarOption),
    error: v.optional(v.string()),
  }),
  handler: async (
    ctx,
    { key, start, end, tz },
  ): Promise<{ connected: boolean; events: ScheduleEvent[]; calendars: CalendarOption[]; error?: string }> => {
    await checkKey(ctx, key);
    const tok: boolean = !!(await ctx.runQuery(internal.oauth.getToken, { provider: "google" }));
    const auth: string | null = await appleAuth(ctx);
    if (!tok && !auth) return { connected: false, events: [], calendars: [] };

    const errors: string[] = [];
    const calendars: CalendarOption[] = [];
    const settle = async (label: string, run: () => Promise<ScheduleEvent[]>) => {
      try {
        return await run();
      } catch (e) {
        errors.push(`${label}: ${calendarError(e)}`);
        return [];
      }
    };
    const [g, a]: ScheduleEvent[][] = await Promise.all([
      tok ? settle("Google", () => googleRange(ctx, start, end, errors, calendars)) : Promise.resolve([]),
      auth ? settle("Apple", () => appleRange(auth, start, end, tz ?? "UTC")) : Promise.resolve([]),
    ]);
    const appleEvents = a.map((event) => ({ ...event, calendarId: `apple:${event.calendar}` }));
    for (const event of appleEvents) {
      if (!calendars.some((c) => c.id === event.calendarId)) {
        calendars.push({ id: event.calendarId, name: event.calendar, color: event.color });
      }
    }
    const events = [...g, ...appleEvents].sort((x, y) => x.start - y.start);
    return { connected: true, events, calendars, error: errors.length ? errors.join(" ").slice(0, 300) : undefined };
  },
});

// All-day dates have no time zone; the client re-interprets them as local dates.
function localDate(ymd: string) {
  return Date.parse(`${ymd}T00:00:00Z`);
}
