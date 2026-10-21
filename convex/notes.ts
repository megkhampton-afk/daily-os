import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import schema from "./schema";
import { checkKey, keyArg } from "./key";

export const list = query({
  args: keyArg,
  returns: v.array(schema.doc("notes")),
  handler: async (ctx, { key }) => {
    await checkKey(ctx, key);
    return ctx.db.query("notes").withIndex("by_updatedAt").order("desc").take(100);
  },
});

export const save = mutation({
  args: {
    ...keyArg,
    id: v.optional(v.id("notes")),
    title: v.string(),
    body: v.string(),
  },
  returns: v.id("notes"),
  handler: async (ctx, { key, id, title, body }) => {
    await checkKey(ctx, key);
    const trimmed = title.trim();
    if (!trimmed) throw new ConvexError("Give your note a title.");
    if (trimmed.length > 200 || body.length > 100_000) {
      throw new ConvexError("Use a title under 200 characters and a note under 100,000 characters.");
    }
    const note = { title: trimmed, body, updatedAt: Date.now() };
    if (id) {
      if (!(await ctx.db.get(id))) throw new ConvexError("This note no longer exists.");
      await ctx.db.patch(id, note);
      return id;
    }
    return ctx.db.insert("notes", note);
  },
});
