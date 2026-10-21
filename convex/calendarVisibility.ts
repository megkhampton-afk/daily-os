import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { checkKey, keyArg } from "./key";

export const hidden = query({
  args: keyArg,
  returns: v.array(v.string()),
  handler: async (ctx, { key }) => {
    await checkKey(ctx, key);
    const rows = await ctx.db.query("hiddenCalendars").take(500);
    return rows.map((row) => row.calendarId);
  },
});

export const setVisible = mutation({
  args: { ...keyArg, calendarId: v.string(), visible: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { key, calendarId, visible }) => {
    await checkKey(ctx, key);
    if (!calendarId || calendarId.length > 2048) throw new Error("Invalid calendar");
    const existing = await ctx.db
      .query("hiddenCalendars")
      .withIndex("by_calendarId", (q) => q.eq("calendarId", calendarId))
      .unique();
    if (visible && existing) await ctx.db.delete(existing._id);
    if (!visible && !existing) await ctx.db.insert("hiddenCalendars", { calendarId });
    return null;
  },
});
