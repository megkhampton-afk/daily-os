import { action, internalAction, internalMutation, mutation, query } from "./_generated/server";
import { ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { ConvexError, v } from "convex/values";
import { checkKey, keyArg, readSetting } from "./key";

// Done assignments stick around for two weeks so you keep the context,
// then age out instead of piling up.
const DONE_RETENTION_MS = 14 * 24 * 60 * 60 * 1000;

export const list = query({
  args: { ...keyArg, now: v.number() },
  handler: async (ctx, { key, now }) => {
    await checkKey(ctx, key);
    const all = await ctx.db.query("assignments").take(500);
    return all
      // Past-due items stay visible (the Overdue bucket is real); only
      // done items age out, once their retention window has passed.
      .filter((a) => !a.done || a.doneAt === undefined || a.doneAt >= now - DONE_RETENTION_MS)
      .sort((a, b) => (a.due ?? Infinity) - (b.due ?? Infinity));
  },
});

export const toggle = mutation({
  args: { ...keyArg, id: v.id("assignments") },
  returns: v.null(),
  handler: async (ctx, { key, id }) => {
    await checkKey(ctx, key);
    const a = await ctx.db.get(id);
    if (!a) return null;
    // Stamp when it was finished so old done items can age out.
    await ctx.db.patch(id, { done: !a.done, doneAt: !a.done ? Date.now() : undefined });
    return null;
  },
});

export const addFromSyllabus = mutation({
  args: {
    ...keyArg,
    course: v.string(),
    items: v.array(v.object({ title: v.string(), due: v.optional(v.number()) })),
  },
  returns: v.null(),
  handler: async (ctx, { key, course, items }) => {
    await checkKey(ctx, key);
    for (const item of items) {
      await ctx.db.insert("assignments", {
        course,
        title: item.title,
        due: item.due,
        source: "syllabus",
        done: false,
      });
    }
    return null;
  },
});

export const upsertCanvas = internalMutation({
  args: {
    items: v.array(
      v.object({
        externalId: v.string(),
        course: v.string(),
        title: v.string(),
        due: v.optional(v.number()),
        url: v.optional(v.string()),
        done: v.optional(v.boolean()),
      }),
    ),
  },
  returns: v.number(),
  handler: async (ctx, { items }) => {
    const now = Date.now();
    const keep = new Set(items.map((i) => i.externalId));
    const all = await ctx.db.query("assignments").take(1000);
    for (const a of all) {
      if (a.source !== "canvas") continue;
      if (a.done && a.doneAt !== undefined && a.doneAt < now - DONE_RETENTION_MS) {
        // Aged-out done item: prune it.
        await ctx.db.delete(a._id);
      } else if (a.externalId && !keep.has(a.externalId)) {
        // Canvas row that vanished from the sync (e.g. course ended).
        await ctx.db.delete(a._id);
      }
    }
    for (const item of items) {
      const existing = await ctx.db
        .query("assignments")
        .withIndex("by_externalId", (q) => q.eq("externalId", item.externalId))
        .unique();
      // `done` is only written when Canvas first reports the item submitted;
      // once done it is never flipped back, and doneAt is never reset.
      const fields = { course: item.course, title: item.title, due: item.due, url: item.url };
      if (existing) {
        if (item.done && !existing.done) {
          await ctx.db.patch(existing._id, { ...fields, done: true, doneAt: now });
        } else {
          await ctx.db.patch(existing._id, fields);
        }
      } else {
        await ctx.db.insert("assignments", {
          ...fields,
          done: item.done ?? false,
          doneAt: item.done ? now : undefined,
          externalId: item.externalId,
          source: "canvas",
        });
      }
    }
    return items.length;
  },
});

type CanvasItem = {
  externalId: string;
  course: string;
  title: string;
  due?: number;
  url?: string;
  done: boolean;
};

type CanvasFetch = {
  items: CanvasItem[];
  error?: string;
  notConfigured?: boolean;
};

// Shared fetch for the manual and the scheduled Canvas sync.
// Requires CANVAS_TOKEN (Canvas > Account > Settings > New Access Token).
// CANVAS_URL defaults to MIT's instance.
async function fetchCanvasItems(ctx: ActionCtx): Promise<CanvasFetch> {
  const token = await readSetting(ctx, "CANVAS_TOKEN");
  const base = ((await readSetting(ctx, "CANVAS_URL")) ?? "https://canvas.instructure.com").replace(/\/+$/, "");
  if (!token) {
    return { items: [], error: "Canvas token not set. Add it on the Setup tab.", notConfigured: true };
  }
  const headers = { Authorization: `Bearer ${token}` };

  const coursesRes = await fetch(
    `${base}/api/v1/courses?enrollment_state=active&per_page=50`,
    { headers },
  );
  if (!coursesRes.ok) {
    return { items: [], error: `Canvas courses: HTTP ${coursesRes.status}` };
  }
  const courses = (await coursesRes.json()) as Array<{
    id: number;
    course_code?: string;
    name?: string;
  }>;

  const items: CanvasItem[] = [];
  for (const c of courses) {
    if (!c.name) continue;
    const res = await fetch(
      `${base}/api/v1/courses/${c.id}/assignments?per_page=100&order_by=due_at&include[]=submission`,
      { headers },
    );
    if (!res.ok) continue;
    const list = (await res.json()) as Array<{
      id: number;
      name: string;
      due_at: string | null;
      html_url?: string;
      submission?: { workflow_state?: string; submitted_at?: string | null };
    }>;
    for (const a of list) {
      const sub = a.submission;
      const submitted =
        !!sub?.submitted_at ||
        sub?.workflow_state === "submitted" ||
        sub?.workflow_state === "graded" ||
        sub?.workflow_state === "pending_review";
      // Submitted items come back done; past-due unsubmitted ones stay
      // visible so the Overdue bucket has real content.
      items.push({
        externalId: `canvas-${a.id}`,
        course: c.course_code ?? c.name,
        title: a.name,
        due: a.due_at ? Date.parse(a.due_at) : undefined,
        url: a.html_url,
        done: submitted,
      });
    }
  }
  return { items };
}

export const syncCanvas = action({
  args: keyArg,
  returns: v.object({ synced: v.number(), error: v.optional(v.string()) }),
  handler: async (ctx, { key }): Promise<{ synced: number; error?: string }> => {
    await checkKey(ctx, key);
    const { items, error } = await fetchCanvasItems(ctx);
    if (error) return { synced: 0, error };
    const synced: number = await ctx.runMutation(
      internal.assignments.upsertCanvas,
      { items },
    );
    return { synced };
  },
});

// Server-initiated twin of syncCanvas, invoked by the daily cron in crons.ts.
// No passcode: crons run inside the backend.
export const syncCanvasScheduled = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx): Promise<null> => {
    const { items, error, notConfigured } = await fetchCanvasItems(ctx);
    if (error) {
      // Quietly no-op until Canvas is configured; real failures should be
      // visible in the Convex dashboard logs.
      if (notConfigured) return null;
      throw new ConvexError(`Canvas sync failed: ${error}`);
    }
    await ctx.runMutation(internal.assignments.upsertCanvas, { items });
    return null;
  },
});
