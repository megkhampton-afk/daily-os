import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const provider = v.union(v.literal("google"), v.literal("microsoft"));

export default defineSchema({
  tasks: defineTable({
    title: v.string(),
    due: v.optional(v.number()),
    done: v.boolean(),
    source: v.union(v.literal("capture"), v.literal("manual")),
  }).index("by_done", ["done"]),

  events: defineTable({
    title: v.string(),
    start: v.number(),
    calendarSynced: v.boolean(),
    googleEventId: v.optional(v.string()),
    calendarId: v.optional(v.string()),
    calendarName: v.optional(v.string()),
    syncError: v.optional(v.string()),
  }).index("by_start", ["start"]),

  assignments: defineTable({
    course: v.string(),
    title: v.string(),
    due: v.optional(v.number()),
    source: v.union(v.literal("canvas"), v.literal("syllabus")),
    externalId: v.optional(v.string()),
    url: v.optional(v.string()),
    gradescopeUrl: v.optional(v.string()),
    done: v.boolean(),
    doneAt: v.optional(v.number()),
  })
    .index("by_due", ["due"])
    .index("by_externalId", ["externalId"]),

  // One row per course code, linking it to where its assignments get turned
  // in (e.g. a Gradescope course page).
  courses: defineTable({
    code: v.string(),
    gradescopeUrl: v.optional(v.string()),
  }).index("by_code", ["code"]),

  emails: defineTable({
    provider,
    externalId: v.string(),
    from: v.string(),
    subject: v.string(),
    snippet: v.string(),
    receivedAt: v.number(),
    folder: v.optional(v.string()),
    folderExternalId: v.optional(v.string()),
  })
    .index("by_folder", ["folder"])
    .index("by_externalId", ["externalId"]),

  oauthTokens: defineTable({
    provider,
    account: v.string(),
    refreshToken: v.string(),
    accessToken: v.string(),
    expiresAt: v.number(),
  }).index("by_provider", ["provider"]),

  oauthStates: defineTable({
    provider,
    nonce: v.string(),
    returnTo: v.optional(v.string()),
  }).index("by_nonce", ["nonce"]),

  triageFolders: defineTable({
    provider,
    externalId: v.string(),
    name: v.string(),
    order: v.number(),
  }).index("by_provider", ["provider"]),

  settings: defineTable({
    name: v.string(),
    value: v.string(),
  }).index("by_name", ["name"]),
});
