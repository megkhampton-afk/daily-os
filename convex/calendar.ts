import { v } from "convex/values";
import { internalAction, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { google } from "./mailApi";
import { pickCalendar } from "./calendarMatch";

const CAL = "https://www.googleapis.com/calendar/v3";

async function chooseCalendar(
  ctx: Parameters<typeof google>[0],
  text: string,
): Promise<{ id: string; name: string } | null> {
  try {
    const { items } = (await google(ctx, `${CAL}/users/me/calendarList?minAccessRole=writer`)) as {
      items: { id: string; summary: string; summaryOverride?: string; primary?: boolean }[];
    };
    const options = items
      .filter((c) => !c.primary)
      .map((c) => ({ id: c.id, name: c.summaryOverride ?? c.summary }));
    return pickCalendar(text, options);
  } catch (e) {
    // Older connections may lack the calendar-list permission; fall back to primary.
    console.warn("calendar list unavailable", (e as Error).message);
    return null;
  }
}

export const createGoogleEvent = internalAction({
  args: {
    id: v.id("events"),
    title: v.string(),
    start: v.number(),
    text: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { id, title, start, text }) => {
    try {
      const target = await chooseCalendar(ctx, text ?? title);
      const calendarId = target?.id ?? "primary";
      const json = (await google(ctx, `${CAL}/calendars/${encodeURIComponent(calendarId)}/events`, {
        method: "POST",
        body: JSON.stringify({
          summary: title,
          start: { dateTime: new Date(start).toISOString() },
          end: { dateTime: new Date(start + 3600_000).toISOString() },
        }),
      })) as { id: string };
      await ctx.runMutation(internal.calendar.markSynced, {
        id,
        googleEventId: json.id,
        calendarId,
        calendarName: target?.name,
      });
    } catch (e) {
      await ctx.runMutation(internal.calendar.markSynced, {
        id,
        error: (e as Error).message.slice(0, 300),
      });
    }
    return null;
  },
});

export const deleteGoogleEvent = internalAction({
  args: { googleEventId: v.string(), calendarId: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { googleEventId, calendarId }) => {
    await google(
      ctx,
      `${CAL}/calendars/${encodeURIComponent(calendarId ?? "primary")}/events/${googleEventId}`,
      { method: "DELETE" },
    );
    return null;
  },
});

export const markSynced = internalMutation({
  args: {
    id: v.id("events"),
    googleEventId: v.optional(v.string()),
    calendarId: v.optional(v.string()),
    calendarName: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { id, googleEventId, calendarId, calendarName, error }) => {
    const ev = await ctx.db.get(id);
    if (!ev) return null;
    await ctx.db.patch(id, {
      calendarSynced: !!googleEventId,
      googleEventId,
      calendarId,
      calendarName,
      syncError: error,
    });
    return null;
  },
});
