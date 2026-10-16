import { ActionCtx } from "./_generated/server";
import { accessToken } from "./oauth";

export async function gmail(ctx: ActionCtx, path: string, init?: RequestInit) {
  const token = await accessToken(ctx, "google");
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`Gmail HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function graph(ctx: ActionCtx, path: string, init?: RequestInit) {
  const token = await accessToken(ctx, "microsoft");
  const res = await fetch(`https://graph.microsoft.com/v1.0/me/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`Outlook HTTP ${res.status}: ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

export async function google(ctx: ActionCtx, url: string, init?: RequestInit) {
  const token = await accessToken(ctx, "google");
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`Google HTTP ${res.status}: ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}
