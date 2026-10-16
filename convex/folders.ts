import { ConvexError, v } from "convex/values";
import { action, internalMutation, mutation, MutationCtx, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { provider } from "./schema";
import { checkKey, keyArg } from "./key";
import { gmail, graph } from "./mailApi";

type RemoteFolder = { externalId: string; name: string };
const remoteFolder = v.object({ externalId: v.string(), name: v.string() });

export const selected = query({
  args: keyArg,
  handler: async (ctx, { key }) => {
    await checkKey(ctx, key);
    const rows = await ctx.db.query("triageFolders").take(100);
    return rows.sort((a, b) => a.order - b.order);
  },
});

export const setSelected = mutation({
  args: { ...keyArg, provider, folders: v.array(remoteFolder) },
  returns: v.null(),
  handler: async (ctx, { key, provider: p, folders }) => {
    await checkKey(ctx, key);
    await replace(ctx, p, folders);
    return null;
  },
});

async function replace(
  ctx: MutationCtx,
  p: "google" | "microsoft",
  folders: RemoteFolder[],
) {
  const existing = await ctx.db
    .query("triageFolders")
    .withIndex("by_provider", (q) => q.eq("provider", p))
    .take(100);
  for (const row of existing) await ctx.db.delete(row._id);
  for (let i = 0; i < folders.length; i++) {
    await ctx.db.insert("triageFolders", { provider: p, ...folders[i], order: i });
  }
}

export const addSelected = internalMutation({
  args: { provider, folder: remoteFolder },
  returns: v.null(),
  handler: async (ctx, { provider: p, folder }) => {
    const existing = await ctx.db
      .query("triageFolders")
      .withIndex("by_provider", (q) => q.eq("provider", p))
      .take(100);
    if (existing.some((f) => f.externalId === folder.externalId)) return null;
    await ctx.db.insert("triageFolders", { provider: p, ...folder, order: existing.length });
    return null;
  },
});

// Gmail system labels (INBOX, SENT, CATEGORY_*) can't be meaningful sort targets.
async function gmailLabels(ctx: Parameters<typeof gmail>[0]): Promise<RemoteFolder[]> {
  const { labels } = (await gmail(ctx, "labels")) as {
    labels: { id: string; name: string; type: string }[];
  };
  return labels
    .filter((l) => l.type === "user")
    .map((l) => ({ externalId: l.id, name: l.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

const OUTLOOK_SKIP = new Set(["Inbox", "Outbox", "Sent Items", "Drafts", "Conversation History", "Sync Issues", "Junk Email"]);

async function outlookFolders(ctx: Parameters<typeof graph>[0]): Promise<RemoteFolder[]> {
  const { value } = (await graph(ctx, "mailFolders?$top=100&$select=id,displayName")) as {
    value: { id: string; displayName: string }[];
  };
  return value
    .filter((f) => !OUTLOOK_SKIP.has(f.displayName))
    .map((f) => ({ externalId: f.id, name: f.displayName }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export const listRemote = action({
  args: { ...keyArg, provider },
  returns: v.object({ folders: v.array(remoteFolder), error: v.optional(v.string()) }),
  handler: async (ctx, { key, provider: p }) => {
    await checkKey(ctx, key);
    try {
      const folders = p === "google" ? await gmailLabels(ctx) : await outlookFolders(ctx);
      return { folders };
    } catch (e) {
      return { folders: [], error: (e as Error).message.slice(0, 200) };
    }
  },
});

export const createRemote = action({
  args: { ...keyArg, provider, name: v.string() },
  returns: remoteFolder,
  handler: async (ctx, { key, provider: p, name }): Promise<RemoteFolder> => {
    await checkKey(ctx, key);
    const clean = name.trim();
    if (!clean) throw new ConvexError("Folder name is empty");
    let folder: RemoteFolder;
    if (p === "google") {
      const created = (await gmail(ctx, "labels", {
        method: "POST",
        body: JSON.stringify({
          name: clean,
          labelListVisibility: "labelShow",
          messageListVisibility: "show",
        }),
      })) as { id: string; name: string };
      folder = { externalId: created.id, name: created.name };
    } else {
      const created = (await graph(ctx, "mailFolders", {
        method: "POST",
        body: JSON.stringify({ displayName: clean }),
      })) as { id: string; displayName: string };
      folder = { externalId: created.id, name: created.displayName };
    }
    await ctx.runMutation(internal.folders.addSelected, { provider: p, folder });
    return folder;
  },
});
