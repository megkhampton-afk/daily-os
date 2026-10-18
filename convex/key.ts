import { ConvexError, v } from "convex/values";
import { ActionCtx, internalQuery, MutationCtx, query, QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";

export const keyArg = { key: v.string() };

export const SETTING_NAMES = [
  "APP_PASSCODE",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "MS_CLIENT_ID",
  "MS_CLIENT_SECRET",
  "CANVAS_TOKEN",
  "CANVAS_URL",
  "APPLE_ID",
  "APPLE_APP_PASSWORD",
  "CAPTURE_CALENDAR",
] as const;
export type SettingName = (typeof SETTING_NAMES)[number];

type AnyCtx = QueryCtx | MutationCtx | ActionCtx;

// Values saved in the Setup page win; deployment env vars are the fallback
// so existing CLI-configured deployments keep working.
export async function readSetting(ctx: AnyCtx, name: SettingName): Promise<string | undefined> {
  if ("db" in ctx) {
    const row = await ctx.db
      .query("settings")
      .withIndex("by_name", (q) => q.eq("name", name))
      .unique();
    return row?.value || process.env[name] || undefined;
  }
  const value: string | null = await ctx.runQuery(internal.key.getSetting, { name });
  return value ?? undefined;
}

export const getSetting = internalQuery({
  args: { name: v.string() },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, { name }) => {
    return (await readSetting(ctx, name as SettingName)) ?? null;
  },
});

export async function appleConfigured(ctx: AnyCtx) {
  return !!(await readSetting(ctx, "APPLE_ID")) && !!(await readSetting(ctx, "APPLE_APP_PASSWORD"));
}

/** Where captured events go: the saved preference if that calendar is set up, else Google, else Apple. */
export async function captureCalendar(ctx: QueryCtx | MutationCtx): Promise<"google" | "apple" | null> {
  const google = !!(await ctx.db
    .query("oauthTokens")
    .withIndex("by_provider", (q) => q.eq("provider", "google"))
    .first());
  const apple = await appleConfigured(ctx);
  const pref = await readSetting(ctx, "CAPTURE_CALENDAR");
  if (pref === "apple" && apple) return "apple";
  if (pref === "google" && google) return "google";
  return google ? "google" : apple ? "apple" : null;
}

// Single-user app with no login: every public function must check the
// passcode because the Convex URL is public in the frontend bundle.
export async function checkKey(ctx: AnyCtx, key: string) {
  const expected = await readSetting(ctx, "APP_PASSCODE");
  if (!expected) throw new ConvexError("No passcode set yet. Open the app to create one.");
  if (key !== expected) throw new ConvexError("Wrong passcode");
}

export const verify = query({
  args: keyArg,
  returns: v.object({ ok: v.boolean(), needsPasscode: v.boolean() }),
  handler: async (ctx, { key }) => {
    const expected = await readSetting(ctx, "APP_PASSCODE");
    return { ok: !!expected && key === expected, needsPasscode: !expected };
  },
});
