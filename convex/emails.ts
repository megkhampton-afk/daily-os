import { ConvexError, v } from "convex/values";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { Doc } from "./_generated/dataModel";
import { provider } from "./schema";
import { checkKey, keyArg } from "./key";
import { gmail, graph } from "./mailApi";

export const inbox = query({
  args: keyArg,
  handler: async (ctx, { key }) => {
    await checkKey(ctx, key);
    const rows = await ctx.db
      .query("emails")
      .withIndex("by_folder", (q) => q.eq("folder", undefined))
      .take(100);
    return rows.sort((a, b) => b.receivedAt - a.receivedAt);
  },
});

export const folderCounts = query({
  args: keyArg,
  handler: async (ctx, { key }) => {
    await checkKey(ctx, key);
    const all = await ctx.db.query("emails").take(1000);
    const counts: Record<string, number> = {};
    for (const e of all) if (e.folder) counts[e.folder] = (counts[e.folder] ?? 0) + 1;
    return counts;
  },
});

export const moveToFolder = mutation({
  args: { ...keyArg, id: v.id("emails"), folderId: v.id("triageFolders") },
  returns: v.null(),
  handler: async (ctx, { key, id, folderId }) => {
    await checkKey(ctx, key);
    const email = await ctx.db.get(id);
    const folder = await ctx.db.get(folderId);
    if (!email || !folder) return null;
    if (folder.provider !== email.provider) {
      throw new ConvexError("That folder belongs to a different account");
    }
    await ctx.db.patch(id, { folder: folder.name, folderExternalId: folder.externalId });
    await ctx.scheduler.runAfter(0, internal.emails.remoteMove, {
      id,
      to: folder.externalId,
      from: null,
    });
    return null;
  },
});

export const undoMove = mutation({
  args: { ...keyArg, id: v.id("emails") },
  returns: v.null(),
  handler: async (ctx, { key, id }) => {
    await checkKey(ctx, key);
    const e = await ctx.db.get(id);
    if (!e?.folder) return null;
    await ctx.db.patch(id, { folder: undefined, folderExternalId: undefined });
    await ctx.scheduler.runAfter(0, internal.emails.remoteMove, {
      id,
      to: null,
      from: e.folderExternalId ?? null,
    });
    return null;
  },
});

// `to` null means back to the inbox; `from` is the label/folder being left.
export const remoteMove = internalAction({
  args: {
    id: v.id("emails"),
    to: v.union(v.string(), v.null()),
    from: v.union(v.string(), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, { id, to, from }) => {
    const email: Doc<"emails"> | null = await ctx.runQuery(internal.emails.get, { id });
    if (!email) return null;
    try {
      if (email.provider === "google") {
        const msgId = email.externalId.replace(/^google:/, "");
        const body = to
          ? { addLabelIds: [to], removeLabelIds: ["INBOX"] }
          : { addLabelIds: ["INBOX"], removeLabelIds: from ? [from] : [] };
        await gmail(ctx, `messages/${msgId}/modify`, {
          method: "POST",
          body: JSON.stringify(body),
        });
      } else {
        const msgId = email.externalId.replace(/^microsoft:/, "");
        // Outlook assigns a new message id after a move.
        const moved = (await graph(ctx, `messages/${msgId}/move`, {
          method: "POST",
          body: JSON.stringify({ destinationId: to ?? "inbox" }),
        })) as { id: string };
        await ctx.runMutation(internal.emails.setExternalId, {
          id,
          externalId: `microsoft:${moved.id}`,
        });
      }
    } catch (e) {
      console.error("remoteMove failed", (e as Error).message);
      await ctx.runMutation(internal.emails.revertFolder, { id, toInbox: !!to });
    }
    return null;
  },
});
export const get = internalQuery({
  args: { id: v.id("emails") },
  handler: async (ctx, { id }) => ctx.db.get(id),
});

export const setExternalId = internalMutation({
  args: { id: v.id("emails"), externalId: v.string() },
  returns: v.null(),
  handler: async (ctx, { id, externalId }) => {
    await ctx.db.patch(id, { externalId });
    return null;
  },
});

export const revertFolder = internalMutation({
  args: { id: v.id("emails"), toInbox: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { id, toInbox }) => {
    // Only a failed move is reverted; a failed undo leaves the email in place.
    if (toInbox) await ctx.db.patch(id, { folder: undefined, folderExternalId: undefined });
    return null;
  },
});

const fetchedEmail = v.object({
  externalId: v.string(),
  from: v.string(),
  subject: v.string(),
  snippet: v.string(),
  receivedAt: v.number(),
});

export const replaceInbox = internalMutation({
  args: { provider, emails: v.array(fetchedEmail) },
  returns: v.null(),
  handler: async (ctx, { provider: p, emails }) => {
    const current = await ctx.db
      .query("emails")
      .withIndex("by_folder", (q) => q.eq("folder", undefined))
      .take(500);
    const keep = new Set(emails.map((e) => e.externalId));
    for (const e of current) {
      if (e.provider === p && !keep.has(e.externalId)) await ctx.db.delete(e._id);
    }
    for (const e of emails) {
      const existing = await ctx.db
        .query("emails")
        .withIndex("by_externalId", (q) => q.eq("externalId", e.externalId))
        .first();
      if (!existing) await ctx.db.insert("emails", { ...e, provider: p });
    }
    return null;
  },
});

export const sync = action({
  args: keyArg,
  returns: v.object({ google: v.optional(v.string()), microsoft: v.optional(v.string()) }),
  handler: async (ctx, { key }) => {
    await checkKey(ctx, key);
    const result: { google?: string; microsoft?: string } = {};

    const g = await ctx.runQuery(internal.oauth.getToken, { provider: "google" });
    if (g) {
      try {
        const list = (await gmail(ctx, "messages?labelIds=INBOX&maxResults=30")) as {
          messages?: { id: string }[];
        };
        const emails = await Promise.all(
          (list.messages ?? []).map(async ({ id }) => {
            const m = (await gmail(
              ctx,
              `messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`,
            )) as {
              snippet: string;
              internalDate: string;
              payload: { headers: { name: string; value: string }[] };
            };
            const h = (n: string) => m.payload.headers.find((x) => x.name === n)?.value ?? "";
            return {
              externalId: `google:${id}`,
              from: h("From").replace(/\s*<.*>$/, "").replace(/"/g, "") || h("From"),
              subject: h("Subject") || "(no subject)",
              snippet: decodeEntities(m.snippet),
              receivedAt: Number(m.internalDate),
            };
          }),
        );
        await ctx.runMutation(internal.emails.replaceInbox, { provider: "google", emails });
        result.google = `${emails.length} emails`;
      } catch (e) {
        result.google = `error: ${(e as Error).message.slice(0, 200)}`;
      }
    }

    const ms = await ctx.runQuery(internal.oauth.getToken, { provider: "microsoft" });
    if (ms) {
      try {
        const { value } = (await graph(
          ctx,
          "mailFolders/inbox/messages?$top=30&$select=id,subject,from,bodyPreview,receivedDateTime&$orderby=receivedDateTime desc",
        )) as {
          value: {
            id: string;
            subject: string | null;
            bodyPreview: string;
            receivedDateTime: string;
            from?: { emailAddress: { name: string; address: string } };
          }[];
        };
        const emails = value.map((m) => ({
          externalId: `microsoft:${m.id}`,
          from: m.from?.emailAddress.name || m.from?.emailAddress.address || "Unknown",
          subject: m.subject || "(no subject)",
          snippet: m.bodyPreview.slice(0, 300),
          receivedAt: Date.parse(m.receivedDateTime),
        }));
        await ctx.runMutation(internal.emails.replaceInbox, { provider: "microsoft", emails });
        result.microsoft = `${emails.length} emails`;
      } catch (e) {
        result.microsoft = `error: ${(e as Error).message.slice(0, 200)}`;
      }
    }
    return result;
  },
});

function decodeEntities(s: string) {
  return s
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}
