import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, MutationCtx, query } from "./_generated/server";
import { checkKey, keyArg, readSetting, SETTING_NAMES, SettingName } from "./key";

const settingName = v.union(...SETTING_NAMES.map((n) => v.literal(n)));

export const status = query({
  args: keyArg,
  handler: async (ctx, { key }) => {
    await checkKey(ctx, key);
    const isSet: Record<string, boolean> = {};
    for (const name of SETTING_NAMES) isSet[name] = !!(await readSetting(ctx, name));
    const site = process.env.CONVEX_SITE_URL ?? "";
    return {
      isSet,
      canvasUrl: (await readSetting(ctx, "CANVAS_URL")) ?? "https://canvas.instructure.com",
      googleRedirect: `${site}/google/callback`,
      microsoftRedirect: `${site}/ms/callback`,
    };
  },
});

async function upsert(
  ctx: MutationCtx,
  name: SettingName,
  value: string,
) {
  const row = await ctx.db
    .query("settings")
    .withIndex("by_name", (q) => q.eq("name", name))
    .unique();
  if (!value) {
    if (row) await ctx.db.delete(row._id);
  } else if (row) {
    await ctx.db.patch(row._id, { value });
  } else {
    await ctx.db.insert("settings", { name, value });
  }
}

export const save = mutation({
  args: { ...keyArg, values: v.array(v.object({ name: settingName, value: v.string() })) },
  returns: v.null(),
  handler: async (ctx, { key, values }) => {
    await checkKey(ctx, key);
    for (const { name, value } of values) await upsert(ctx, name, value.trim());
    return null;
  },
});

export const createPasscode = mutation({
  args: { passcode: v.string() },
  returns: v.null(),
  handler: async (ctx, { passcode }) => {
    if (await readSetting(ctx, "APP_PASSCODE")) {
      throw new ConvexError("A passcode already exists");
    }
    if (passcode.trim().length < 4) throw new ConvexError("Use at least 4 characters");
    await upsert(ctx, "APP_PASSCODE", passcode.trim());
    return null;
  },
});

// Recovery for a forgotten passcode. Internal, so it can only be run by
// whoever controls the backend: `npx convex run settings:resetPasscode`.
export const resetPasscode = internalMutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    await upsert(ctx, "APP_PASSCODE", "");
    if (process.env.APP_PASSCODE) {
      return "Cleared the saved passcode, but APP_PASSCODE is also set as a deployment environment variable, which still applies. Remove it with: npx convex env remove APP_PASSCODE";
    }
    return "Passcode cleared. Reload the app to create a new one.";
  },
});
