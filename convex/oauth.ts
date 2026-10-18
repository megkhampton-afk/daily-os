import { v } from "convex/values";
import {
  ActionCtx,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { provider } from "./schema";
import { appleConfigured, captureCalendar, checkKey, keyArg, readSetting, SettingName } from "./key";

type Provider = "google" | "microsoft";

const SITE_BASE = () => process.env.CONVEX_SITE_URL!;
export const redirectUri = (p: Provider) =>
  `${SITE_BASE()}/${p === "google" ? "google" : "ms"}/callback`;

export const CONFIG = {
  google: {
    authorize: "https://accounts.google.com/o/oauth2/v2/auth",
    token: "https://oauth2.googleapis.com/token",
    scope:
      "openid email https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.calendarlist.readonly",
    clientIdName: "GOOGLE_CLIENT_ID" as SettingName,
    clientSecretName: "GOOGLE_CLIENT_SECRET" as SettingName,
  },
  microsoft: {
    authorize: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    token: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    scope: "openid email offline_access User.Read Mail.ReadWrite",
    clientIdName: "MS_CLIENT_ID" as SettingName,
    clientSecretName: "MS_CLIENT_SECRET" as SettingName,
  },
} as const;

export const status = query({
  args: keyArg,
  handler: async (ctx, { key }) => {
    await checkKey(ctx, key);
    const tokens = await ctx.db.query("oauthTokens").take(10);
    const find = (p: Provider) => tokens.find((t) => t.provider === p)?.account ?? null;
    return {
      google: find("google"),
      microsoft: find("microsoft"),
      googleConfigured: !!(await readSetting(ctx, "GOOGLE_CLIENT_ID")) && !!(await readSetting(ctx, "GOOGLE_CLIENT_SECRET")),
      microsoftConfigured: !!(await readSetting(ctx, "MS_CLIENT_ID")) && !!(await readSetting(ctx, "MS_CLIENT_SECRET")),
      apple: (await appleConfigured(ctx)) ? ((await readSetting(ctx, "APPLE_ID")) ?? null) : null,
      captureCalendar: await captureCalendar(ctx),
    };
  },
});

export const startLogin = mutation({
  args: { ...keyArg, provider, returnTo: v.optional(v.string()) },
  returns: v.string(),
  handler: async (ctx, { key, provider: p, returnTo }) => {
    await checkKey(ctx, key);
    const cfg = CONFIG[p];
    const clientId = await readSetting(ctx, cfg.clientIdName);
    if (!clientId) throw new Error(`${p} client ID is not set. Add it on the Setup tab.`);
    const nonce = crypto.randomUUID();
    await ctx.db.insert("oauthStates", { provider: p, nonce, returnTo });
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri(p),
      response_type: "code",
      scope: cfg.scope,
      state: nonce,
    });
    if (p === "google") {
      params.set("access_type", "offline");
      params.set("prompt", "consent");
    } else {
      params.set("prompt", "select_account");
    }
    return `${cfg.authorize}?${params.toString()}`;
  },
});

export const disconnect = mutation({
  args: { ...keyArg, provider },
  returns: v.null(),
  handler: async (ctx, { key, provider: p }) => {
    await checkKey(ctx, key);
    const rows = await ctx.db
      .query("oauthTokens")
      .withIndex("by_provider", (q) => q.eq("provider", p))
      .take(10);
    for (const r of rows) await ctx.db.delete(r._id);
    return null;
  },
});

export const consumeState = internalMutation({
  args: { nonce: v.string() },
  returns: v.union(
    v.object({ provider, returnTo: v.optional(v.string()) }),
    v.null(),
  ),
  handler: async (ctx, { nonce }) => {
    const row = await ctx.db
      .query("oauthStates")
      .withIndex("by_nonce", (q) => q.eq("nonce", nonce))
      .unique();
    if (!row) return null;
    await ctx.db.delete(row._id);
    return { provider: row.provider, returnTo: row.returnTo };
  },
});

export const saveToken = internalMutation({
  args: {
    provider,
    account: v.string(),
    refreshToken: v.optional(v.string()),
    accessToken: v.string(),
    expiresAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("oauthTokens")
      .withIndex("by_provider", (q) => q.eq("provider", args.provider))
      .first();
    const refreshToken = args.refreshToken ?? existing?.refreshToken;
    if (!refreshToken) throw new Error("No refresh token returned");
    const doc = { ...args, refreshToken };
    if (existing) await ctx.db.patch(existing._id, doc);
    else await ctx.db.insert("oauthTokens", doc);
    return null;
  },
});

export const getToken = internalQuery({
  args: { provider },
  handler: async (ctx, { provider: p }) => {
    return await ctx.db
      .query("oauthTokens")
      .withIndex("by_provider", (q) => q.eq("provider", p))
      .first();
  },
});

export async function exchangeToken(
  ctx: ActionCtx,
  p: Provider,
  body: Record<string, string>,
) {
  const cfg = CONFIG[p];
  const res = await fetch(cfg.token, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: (await readSetting(ctx, cfg.clientIdName)) ?? "",
      client_secret: (await readSetting(ctx, cfg.clientSecretName)) ?? "",
      ...body,
    }),
  });
  const json = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    id_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !json.access_token) {
    throw new Error(json.error_description ?? json.error ?? `Token HTTP ${res.status}`);
  }
  return json;
}

export async function accessToken(ctx: ActionCtx, p: Provider): Promise<string> {
  const tok = await ctx.runQuery(internal.oauth.getToken, { provider: p });
  if (!tok) throw new Error(`${p} is not connected`);
  if (tok.expiresAt > Date.now() + 60_000) return tok.accessToken;
  const json = await exchangeToken(ctx, p, {
    grant_type: "refresh_token",
    refresh_token: tok.refreshToken,
  });
  await ctx.runMutation(internal.oauth.saveToken, {
    provider: p,
    account: tok.account,
    refreshToken: json.refresh_token,
    accessToken: json.access_token!,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
  });
  return json.access_token!;
}
