import { afterEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";
import { EMAIL_BATCH_SIZE, mapMailBatch } from "./mailBatch";
import { QUOTES, quoteForDay } from "../src/lib/quotes";
import { gradescopeUrl } from "../src/lib/gradescope";
import { mailLink } from "../src/lib/mailLink";

const modules = import.meta.glob("./**/*.ts");
const key = "fake-test-passcode";

async function app() {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    await ctx.db.insert("settings", { name: "APP_PASSCODE", value: key });
  });
  return t;
}

afterEach(() => vi.unstubAllGlobals());

describe("saved notes", () => {
  it("creates, lists, and edits a titled note without creating duplicates", async () => {
    const t = await app();
    const id = await t.mutation(api.notes.save, { key, title: "  Ideas  ", body: "First thought" });
    expect(await t.query(api.notes.list, { key })).toMatchObject([{ _id: id, title: "Ideas", body: "First thought" }]);
    expect(await t.mutation(api.notes.save, { key, id, title: "New ideas", body: "Second thought" })).toBe(id);
    expect(await t.query(api.notes.list, { key })).toMatchObject([{ _id: id, title: "New ideas", body: "Second thought" }]);
    expect((await t.query(api.notes.list, { key }))).toHaveLength(1);
  });

  it("refuses reads and writes with the wrong passcode", async () => {
    const t = await app();
    await expect(t.query(api.notes.list, { key: "wrong" })).rejects.toThrow(/Wrong passcode/);
    await expect(t.mutation(api.notes.save, { key: "wrong", title: "Private", body: "" })).rejects.toThrow(/Wrong passcode/);
    expect(await t.query(api.notes.list, { key })).toEqual([]);
  });

  it("rejects blank titles, oversized content, and edits to missing notes", async () => {
    const t = await app();
    await expect(t.mutation(api.notes.save, { key, title: " ", body: "" })).rejects.toThrow(/title/);
    await expect(t.mutation(api.notes.save, { key, title: "a".repeat(201), body: "" })).rejects.toThrow(/200/);
    await expect(t.mutation(api.notes.save, { key, title: "Long", body: "a".repeat(100_001) })).rejects.toThrow(/100,000/);
    const id = await t.mutation(api.notes.save, { key, title: "Temporary", body: "" });
    await t.run((ctx) => ctx.db.delete(id));
    await expect(t.mutation(api.notes.save, { key, id, title: "Missing", body: "" })).rejects.toThrow(/no longer exists/);
  });
});

describe("daily quotes", () => {
  it("keeps one quote all day and changes it each day across a year", () => {
    expect(quoteForDay(new Date(2026, 9, 19, 1))).toEqual(quoteForDay(new Date(2026, 9, 19, 23)));
    for (let day = 0; day < 366; day++) {
      expect(quoteForDay(new Date(2026, 0, day + 1))).not.toEqual(quoteForDay(new Date(2026, 0, day + 2)));
    }
    const deck = Array.from({ length: QUOTES.length }, (_, i) => quoteForDay(new Date(2026, 0, i + 1)).text);
    expect(new Set(deck).size).toBe(QUOTES.length);
    expect(QUOTES.filter((quote) => quote.author === "Ursula K. Le Guin").length).toBeGreaterThanOrEqual(3);
  });
});

describe("Gradescope links", () => {
  const courses = [{ code: "2.003", gradescopeUrl: "https://www.gradescope.com/courses/123" }];
  it("uses exact or unique course-number links and preserves assignment-specific links", () => {
    expect(gradescopeUrl({ course: "2.003" }, courses)).toBe(courses[0].gradescopeUrl);
    expect(gradescopeUrl({ course: "2.003 - Dynamics & Control" }, courses)).toBe(courses[0].gradescopeUrl);
    expect(gradescopeUrl({ course: "2.003", gradescopeUrl: "https://www.gradescope.com/courses/123/assignments/456" }, courses)).toContain("/assignments/456");
    expect(gradescopeUrl({ course: "2.005" }, courses)).toBeUndefined();
    expect(gradescopeUrl({ course: "2.003 - Dynamics" }, [...courses, { code: "2.003 - Other", gradescopeUrl: "https://www.gradescope.com/courses/999" }])).toBeUndefined();
  });
});

describe("email links and expanded batching", () => {
  it("opens the correct Gmail account and thread, including older stored messages", () => {
    expect(mailLink({ provider: "google", externalId: "google:message", threadId: "thread" }, "test@example.com"))
      .toBe("https://mail.google.com/mail/u/?authuser=test%40example.com#all/thread");
    expect(mailLink({ provider: "google", externalId: "google:message" })).toContain("#all/message");
    expect(mailLink({ provider: "microsoft", externalId: "microsoft:message", webUrl: "https://outlook.office.com/mail/id/123" }))
      .toBe("https://outlook.office.com/mail/id/123");
  });

  it("reads 100 messages in batches of at most ten without losing order", async () => {
    let active = 0;
    let peak = 0;
    const result = await mapMailBatch(Array.from({ length: EMAIL_BATCH_SIZE }, (_, i) => i), async (i) => {
      active++;
      peak = Math.max(peak, active);
      await Promise.resolve();
      active--;
      return i;
    });
    expect(result).toEqual(Array.from({ length: 100 }, (_, i) => i));
    expect(peak).toBeLessThanOrEqual(10);
  });

  it("syncs and displays 100 emails per provider with original-message links", async () => {
    const t = await app();
    await t.run(async (ctx) => {
      for (const provider of ["google", "microsoft"]) {
        await ctx.db.insert("oauthTokens", {
          provider, account: "fake@example.com", accessToken: "fake-access-token",
          refreshToken: "fake-refresh-token", expiresAt: Date.now() + 3_600_000,
        });
      }
    });
    const fakeFetch = vi.fn(async (url) => {
      const parsed = new URL(url);
      if (parsed.hostname === "gmail.googleapis.com" && parsed.pathname.endsWith("/messages")) {
        expect(parsed.searchParams.get("maxResults")).toBe("100");
        return Response.json({ messages: Array.from({ length: 100 }, (_, i) => ({ id: `g${i}` })) });
      }
      if (parsed.hostname === "gmail.googleapis.com" && parsed.pathname.includes("/messages/")) {
        const id = parsed.pathname.split("/").pop();
        return Response.json({
          threadId: `thread-${id}`, snippet: "Fake preview", internalDate: String(1_000 + Number(id.slice(1))),
          payload: { headers: [{ name: "From", value: "Test <fake@example.com>" }, { name: "Subject", value: `Fake ${id}` }] },
        });
      }
      if (parsed.hostname === "graph.microsoft.com") {
        expect(parsed.searchParams.get("$top")).toBe("100");
        return Response.json({ value: Array.from({ length: 100 }, (_, i) => ({
          id: `m${i}`, subject: `Fake ${i}`, bodyPreview: "Fake preview",
          receivedDateTime: new Date(2_000 + i).toISOString(),
          webLink: `https://outlook.office.com/mail/id/m${i}`,
        })) });
      }
      throw new Error("Unexpected network request in fake-email test");
    });
    vi.stubGlobal("fetch", fakeFetch);
    expect(await t.action(api.emails.sync, { key })).toEqual({ google: "100 emails", microsoft: "100 emails" });
    const inbox = await t.query(api.emails.inbox, { key });
    expect(inbox).toHaveLength(200);
    expect(inbox.filter((e) => e.provider === "google")).toHaveLength(100);
    expect(inbox.find((e) => e.provider === "google")?.threadId).toMatch(/^thread-g/);
    expect(inbox[0].webUrl).toMatch(/^https:\/\/outlook/);
    expect(inbox[0].receivedAt).toBeGreaterThanOrEqual(inbox[199].receivedAt);
  });
});
