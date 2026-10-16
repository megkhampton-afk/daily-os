import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { exchangeToken, redirectUri } from "./oauth";

const http = httpRouter();

const DEFAULT_SITE = () => process.env.SITE_URL ?? "http://localhost:5173";

function decodeJwtEmail(idToken?: string): string | undefined {
  if (!idToken) return undefined;
  try {
    const payload = JSON.parse(
      atob(idToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
    ) as { email?: string; preferred_username?: string };
    return payload.email ?? payload.preferred_username;
  } catch {
    return undefined;
  }
}

function safeOrigin(returnTo?: string) {
  if (!returnTo) return DEFAULT_SITE();
  try {
    const u = new URL(returnTo);
    return u.protocol === "https:" || u.hostname === "localhost" ? u.origin : DEFAULT_SITE();
  } catch {
    return DEFAULT_SITE();
  }
}

const callback = httpAction(async (ctx, req) => {
  const url = new URL(req.url);
  let site = DEFAULT_SITE();
  const back = (msg: string) =>
    new Response(null, {
      status: 302,
      headers: { Location: `${site}/?connect=${encodeURIComponent(msg)}` },
    });

  const state = url.searchParams.get("state");
  const login = state
    ? await ctx.runMutation(internal.oauth.consumeState, { nonce: state })
    : null;
  if (login) site = safeOrigin(login.returnTo);

  const err = url.searchParams.get("error_description") ?? url.searchParams.get("error");
  if (err) return back(`error: ${err}`);
  const code = url.searchParams.get("code");
  if (!code) return back("error: missing code");
  if (!login) return back("error: login expired, try again");
  const p = login.provider;

  try {
    const json = await exchangeToken(ctx, p, {
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(p),
    });
    await ctx.runMutation(internal.oauth.saveToken, {
      provider: p,
      account: decodeJwtEmail(json.id_token) ?? p,
      refreshToken: json.refresh_token,
      accessToken: json.access_token!,
      expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
    });
    return back(`${p === "google" ? "Google" : "Microsoft"} connected`);
  } catch (e) {
    return back(`error: ${(e as Error).message}`);
  }
});

http.route({ path: "/google/callback", method: "GET", handler: callback });
http.route({ path: "/ms/callback", method: "GET", handler: callback });

export default http;
