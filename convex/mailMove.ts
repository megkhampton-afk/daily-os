type Request = (path: string, init: RequestInit) => Promise<unknown>;

// A null destination restores the inbox. Trash is reversible, never a delete.
export async function moveMail(
  email: { provider: "google" | "microsoft"; externalId: string },
  to: string | null,
  from: string | null,
  request: { gmail: Request; graph: Request },
): Promise<string | null> {
  if (email.provider === "google") {
    const id = encodeURIComponent(email.externalId.replace(/^google:/, ""));
    if (from === "TRASH" && !to) {
      await request.gmail(`messages/${id}/untrash`, { method: "POST" });
    }
    const body = to === "TRASH"
      ? { removeLabelIds: ["UNREAD"] }
      : to
      ? { addLabelIds: [to], removeLabelIds: ["INBOX", "UNREAD"] }
      : { addLabelIds: ["INBOX"], removeLabelIds: from && from !== "TRASH" ? [from] : [] };
    await request.gmail(`messages/${id}/modify`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (to === "TRASH") {
      await request.gmail(`messages/${id}/trash`, { method: "POST" });
    }
    return null;
  }

  const id = encodeURIComponent(email.externalId.replace(/^microsoft:/, ""));
  if (to) {
    await request.graph(`messages/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ isRead: true }),
    });
  }
  const moved = (await request.graph(`messages/${id}/move`, {
    method: "POST",
    body: JSON.stringify({ destinationId: to ?? "inbox" }),
  })) as { id: string };
  // Outlook assigns a new message id after each move.
  return `microsoft:${moved.id}`;
}
