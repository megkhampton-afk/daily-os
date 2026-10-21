import { afterEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import { parseCapture } from "../src/lib/capture";
import { findMissing, parseSyllabus } from "../src/lib/syllabus";

const modules = import.meta.glob("./**/*.ts");
const key = "fake-release-test-passcode";
async function app() {
  const t = convexTest(schema, modules);
  await t.run((ctx) => ctx.db.insert("settings", { name: "APP_PASSCODE", value: key }));
  return t;
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("release regressions", () => {
  it("saves calendar visibility and refuses a wrong passcode", async () => {
    const t = await app();
    await t.mutation(api.calendarVisibility.setVisible, { key, calendarId: "google:test", visible: false });
    expect(await t.query(api.calendarVisibility.hidden, { key })).toEqual(["google:test"]);
    await t.mutation(api.calendarVisibility.setVisible, { key, calendarId: "google:test", visible: false });
    expect(await t.query(api.calendarVisibility.hidden, { key })).toHaveLength(1);
    await expect(t.mutation(api.calendarVisibility.setVisible, { key: "wrong", calendarId: "google:test", visible: true })).rejects.toThrow(/Wrong passcode/);
    await t.mutation(api.calendarVisibility.setVisible, { key, calendarId: "google:test", visible: true });
    expect(await t.query(api.calendarVisibility.hidden, { key })).toEqual([]);
  });

  it("requests Gmail, calendar-event, and calendar-list access and consumes OAuth state once", async () => {
    const t = await app();
    vi.stubEnv("CONVEX_SITE_URL", "https://example.convex.site");
    await t.run((ctx) => ctx.db.insert("settings", { name: "GOOGLE_CLIENT_ID", value: "fake-client-id" }));
    const url = new URL(await t.mutation(api.oauth.startLogin, { key, provider: "google", returnTo: "http://localhost:5173" }));
    expect(url.searchParams.get("scope")).toContain("gmail.modify");
    expect(url.searchParams.get("scope")).toContain("calendar.events");
    expect(url.searchParams.get("scope")).toContain("calendar.calendarlist.readonly");
    expect(url.searchParams.get("redirect_uri")).toBe("https://example.convex.site/google/callback");
    expect(url.searchParams.get("access_type")).toBe("offline");
    const nonce = url.searchParams.get("state");
    expect(await t.mutation(internal.oauth.consumeState, { nonce })).toMatchObject({ provider: "google" });
    expect(await t.mutation(internal.oauth.consumeState, { nonce })).toBeNull();
  });

  it("parses a timed event and an assignment-style to-do without network access", () => {
    const result = parseCapture("dinner with Sam tomorrow 7pm; finish homework by Friday", new Date(2026, 9, 21, 10));
    expect(result.events).toHaveLength(1);
    expect(new Date(result.events[0].start).getHours()).toBe(19);
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].title).toMatch(/Finish homework/);
    expect(new Date(result.tasks[0].due).getHours()).toBe(23);
  });

  it("finds syllabus deadlines without duplicating an existing assignment in the same course", () => {
    const parsed = parseSyllabus("Problem Set 3 due October 25, 2026\nLab 4 due October 28, 2026\nOffice location is room 200", new Date(2026, 9, 21));
    expect(parsed).toHaveLength(2);
    const missing = findMissing(parsed, [{ course: "2.003", title: "Pset 3", due: parsed[0].due }], "2.003");
    expect(missing).toHaveLength(1);
    expect(missing[0].title).toMatch(/Lab 4/);
    expect(findMissing(parsed, [{ course: "other", title: "Pset 3" }], "2.003")).toHaveLength(2);
  });

  for (const provider of ["google", "microsoft"]) {
    it(`sorts, trashes, and restores a fake ${provider} message through scheduled actions`, async () => {
      vi.useFakeTimers();
      const t = await app();
      const { id, folderId } = await t.run(async (ctx) => ({
        id: await ctx.db.insert("emails", { provider, externalId: `${provider}:fake-message`, from: "Fake sender", subject: "Disposable test", snippet: "", receivedAt: Date.now() }),
        folderId: await ctx.db.insert("triageFolders", { provider, externalId: "test-folder", name: "Test folder", order: 0 }),
      }));
      await t.run((ctx) => ctx.db.insert("oauthTokens", {
        provider, account: "fake@example.com", accessToken: "fake-access", refreshToken: "fake-refresh", expiresAt: Date.now() + 3_600_000,
      }));
      const calls = [];
      vi.stubGlobal("fetch", vi.fn(async (url, init) => {
        calls.push({ url: String(url), body: init.body ? JSON.parse(init.body) : undefined });
        return Response.json({ id: `new-message-${calls.length}` });
      }));
      await t.mutation(api.emails.moveToFolder, { key, id, folderId });
      await t.finishAllScheduledFunctions(vi.runAllTimers);
      expect(await t.query(api.emails.inbox, { key })).toEqual([]);
      expect(calls.some((call) => provider === "google" ? call.body?.removeLabelIds?.includes("UNREAD") : call.body?.isRead === true)).toBe(true);
      await t.mutation(api.emails.undoMove, { key, id });
      await t.finishAllScheduledFunctions(vi.runAllTimers);
      expect(await t.query(api.emails.inbox, { key })).toHaveLength(1);
      await t.mutation(api.emails.trash, { key, id });
      await t.finishAllScheduledFunctions(vi.runAllTimers);
      expect(await t.query(api.emails.inbox, { key })).toEqual([]);
      expect(calls.some((call) => provider === "google" ? call.url.endsWith("/trash") : call.body?.destinationId === "deleteditems")).toBe(true);
      await t.mutation(api.emails.undoMove, { key, id });
      await t.finishAllScheduledFunctions(vi.runAllTimers);
      expect(await t.query(api.emails.inbox, { key })).toHaveLength(1);
      if (provider === "microsoft") {
        expect((await t.run((ctx) => ctx.db.get(id))).externalId).toMatch(/^microsoft:new-message-/);
      }
    });
  }

  it("restores an email to the queue when the provider refuses a move", async () => {
    vi.useFakeTimers();
    const t = await app();
    const id = await t.run((ctx) => ctx.db.insert("emails", {
      provider: "google", externalId: "google:fake-message", from: "Fake", subject: "Fake", snippet: "", receivedAt: Date.now(),
    }));
    await t.run((ctx) => ctx.db.insert("oauthTokens", {
      provider: "google", account: "fake@example.com", accessToken: "fake-access", refreshToken: "fake-refresh", expiresAt: Date.now() + 3_600_000,
    }));
    vi.stubGlobal("fetch", vi.fn(async () => new Response("Fake permission failure", { status: 403 })));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(t.mutation(api.emails.trash, { key: "wrong", id })).rejects.toThrow(/Wrong passcode/);
    await t.mutation(api.emails.trash, { key, id });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await t.query(api.emails.inbox, { key })).toHaveLength(1);
  });
});
