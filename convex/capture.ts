import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { captureCalendar, checkKey, keyArg } from "./key";

export const addItems = mutation({
  args: {
    ...keyArg,
    tasks: v.array(v.object({ title: v.string(), due: v.optional(v.number()) })),
    events: v.array(v.object({ title: v.string(), start: v.number(), text: v.optional(v.string()) })),
  },
  returns: v.null(),
  handler: async (ctx, { key, tasks, events }) => {
    await checkKey(ctx, key);
    for (const t of tasks) {
      await ctx.db.insert("tasks", { ...t, done: false, source: "capture" });
    }
    const target = await captureCalendar(ctx);
    for (const e of events) {
      const id = await ctx.db.insert("events", { title: e.title, start: e.start, calendarSynced: false });
      if (target === "google") {
        await ctx.scheduler.runAfter(0, internal.calendar.createGoogleEvent, { id, ...e });
      } else if (target === "apple") {
        await ctx.scheduler.runAfter(0, internal.apple.createAppleEvent, { id, ...e });
      }
    }
    return null;
  },
});

export const listTasks = query({
  args: keyArg,
  handler: async (ctx, { key }) => {
    await checkKey(ctx, key);
    const tasks = await ctx.db.query("tasks").order("desc").take(200);
    return tasks.sort(
      (a, b) =>
        Number(a.done) - Number(b.done) ||
        (a.due ?? Infinity) - (b.due ?? Infinity),
    );
  },
});

export const toggleTask = mutation({
  args: { ...keyArg, id: v.id("tasks") },
  returns: v.null(),
  handler: async (ctx, { key, id }) => {
    await checkKey(ctx, key);
    const t = await ctx.db.get(id);
    if (t) await ctx.db.patch(id, { done: !t.done });
    return null;
  },
});

export const addManualTask = mutation({
  args: { ...keyArg, title: v.string() },
  returns: v.null(),
  handler: async (ctx, { key, title }) => {
    await checkKey(ctx, key);
    await ctx.db.insert("tasks", { title: title.trim(), done: false, source: "manual" });
    return null;
  },
});

export const clearCompletedTasks = mutation({
  args: keyArg,
  returns: v.null(),
  handler: async (ctx, { key }) => {
    await checkKey(ctx, key);
    const done = await ctx.db
      .query("tasks")
      .withIndex("by_done", (q) => q.eq("done", true))
      .take(500);
    for (const t of done) {
      await ctx.db.delete(t._id);
    }
    return null;
  },
});

export const deleteTask = mutation({
  args: { ...keyArg, id: v.id("tasks") },
  returns: v.null(),
  handler: async (ctx, { key, id }) => {
    await checkKey(ctx, key);
    await ctx.db.delete(id);
    return null;
  },
});

export const listEvents = query({
  args: keyArg,
  handler: async (ctx, { key }) => {
    await checkKey(ctx, key);
    return await ctx.db
      .query("events")
      .withIndex("by_start", (q) => q.gte("start", Date.now() - 86400000))
      .take(50);
  },
});

export const deleteEvent = mutation({
  args: { ...keyArg, id: v.id("events") },
  returns: v.null(),
  handler: async (ctx, { key, id }) => {
    await checkKey(ctx, key);
    const ev = await ctx.db.get(id);
    if (!ev) return null;
    if (ev.googleEventId) {
      await ctx.scheduler.runAfter(0, internal.calendar.deleteGoogleEvent, {
        googleEventId: ev.googleEventId,
        calendarId: ev.calendarId,
      });
    }
    if (ev.appleEventUrl) {
      await ctx.scheduler.runAfter(0, internal.apple.deleteAppleEvent, { url: ev.appleEventUrl });
    }
    await ctx.db.delete(id);
    return null;
  },
});
