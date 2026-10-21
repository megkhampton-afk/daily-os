import { ActionCtx } from "./_generated/server";
import { google } from "./mailApi";

// Calendar lists and event lists both paginate, even within a short date range.
export async function calendarItems<T>(ctx: ActionCtx, url: string): Promise<T[]> {
  const items: T[] = [];
  let pageToken: string | undefined;
  do {
    const pageUrl = new URL(url);
    if (pageToken) pageUrl.searchParams.set("pageToken", pageToken);
    const page = (await google(ctx, pageUrl.toString())) as {
      items?: T[];
      nextPageToken?: string;
    };
    items.push(...(page.items ?? []));
    pageToken = page.nextPageToken;
  } while (pageToken);
  return items;
}

export function calendarError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/insufficient.*scope|insufficientPermissions|Insufficient Permission/i.test(message)) {
    return "Google needs calendar permissions. Open Email triage, choose Reconnect for Google, and allow calendar access. This also enables automatic calendar picking.";
  }
  return message;
}
