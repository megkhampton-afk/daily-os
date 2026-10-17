import { ConvexError } from "convex/values";

// ConvexError messages arrive wrapped in request IDs and stack text; the
// readable message the server threw is in `data`.
export function errorMessage(err: unknown, fallback = "Something went wrong.") {
  if (err instanceof ConvexError && typeof err.data === "string") return err.data;
  if (err instanceof Error) return err.message;
  return fallback;
}
