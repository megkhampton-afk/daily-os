import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { checkKey, keyArg } from "./key";

// Course-level links (e.g. a Gradescope course page) powering the "Turn in"
// action on assignments. The `code` must match the course code shown on
// assignments (Canvas course_code, e.g. "6.390").
export const list = query({
  args: keyArg,
  handler: async (ctx, { key }) => {
    await checkKey(ctx, key);
    return await ctx.db.query("courses").order("asc").take(100);
  },
});

export const save = mutation({
  args: { ...keyArg, code: v.string(), gradescopeUrl: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { key, code, gradescopeUrl }) => {
    await checkKey(ctx, key);
    const trimmed = code.trim();
    if (!trimmed) throw new ConvexError("Course code is required");
    const url = gradescopeUrl?.trim() ?? "";
    if (url && !/^https?:\/\//i.test(url)) {
      throw new ConvexError("The link must start with http:// or https://");
    }
    const existing = await ctx.db
      .query("courses")
      .withIndex("by_code", (q) => q.eq("code", trimmed))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { gradescopeUrl: url || undefined });
    } else {
      await ctx.db.insert("courses", { code: trimmed, gradescopeUrl: url || undefined });
    }
    return null;
  },
});

export const remove = mutation({
  args: { ...keyArg, id: v.id("courses") },
  returns: v.null(),
  handler: async (ctx, { key, id }) => {
    await checkKey(ctx, key);
    await ctx.db.delete(id);
    return null;
  },
});
